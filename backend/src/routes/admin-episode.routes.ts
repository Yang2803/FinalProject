import express from 'express';
import * as cheerio from 'cheerio';
import prisma from '../config/db';

const router = express.Router();

// Hàm gọi trực tiếp MediaWiki API của Fandom (Không cần Puppeteer, tương thích 100% với Render)
async function fetchFandomApi(url: string) {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    console.error("Fetch Fandom API Error:", error);
    return null;
  }
}

router.post('/api/admin/episode/auto-fill', async (req, res) => {
  const { animeId, episodeNumber } = req.body;

  try {
    const anime = await prisma.anime.findUnique({
      where: { id: animeId }
    });

    if (!anime || !anime.fandomPrefix) {
      return res.status(400).json({ error: "Anime chưa được cấu hình Fandom Prefix!" });
    }

    const apiBase = `https://${anime.fandomPrefix}.fandom.com/api.php`;

    // =========================================================
    // GIAI ĐOẠN 1: DÒ TÌM ĐA TẦNG VÀ GIỮ VỮNG BEST MATCH TITLE
    // =========================================================
    let contentData: any = null;
    let bestMatchTitle: string = "";

    // ---------------------------------------------------------
    // 🛡️ TẦNG 1: DÒ TÌM TRỰC TIẾP (Bơm thêm anime.title để trị Franchise Collision)
    // ---------------------------------------------------------
    const directTitles = [
      `${anime.title} Episode ${episodeNumber}`,                      // VD: "Naruto Episode 1"
      `${anime.title} Episode ${String(episodeNumber).padStart(2, '0')}`, // VD: "Naruto Episode 01"
      `Episode ${episodeNumber} (${anime.title})`,                    // VD: "Episode 1 (Naruto)"
      `Episode ${episodeNumber}`,                                     // Dự phòng mặc định
      `Episode ${String(episodeNumber).padStart(2, '0')}`,
      `Episode ${episodeNumber} (Anime)`
    ];

    for (const title of directTitles) {
      const parseUrl = `${apiBase}?action=parse&page=${encodeURIComponent(title)}&redirects=1&format=json&prop=text&origin=*`;
      const data = await fetchFandomApi(parseUrl);

      // 🌟 CHỐT CHẶN: Phải đảm bảo data có parse và KHÔNG CÓ trường error
      if (data && data.parse && !data.error) {
        contentData = data;
        bestMatchTitle = data.parse.title;
        break;
      }
    }

    // ---------------------------------------------------------
    // 🛡️ TẦNG 2: NẾU TẦNG 1 THẤT BẠI, DÙNG API TÌM KIẾM
    // ---------------------------------------------------------
    if (!contentData) {
      // 🌟 Đưa anime.title vào từ khóa tìm kiếm để ép hệ thống Fandom nhả đúng phim
      const searchQuery = encodeURIComponent(`${anime.title} Episode ${episodeNumber}`);
      const searchUrl = `${apiBase}?action=query&list=search&srsearch=${searchQuery}&format=json&utf8=1&origin=*`;

      const searchData = await fetchFandomApi(searchUrl);
      const searchResults = searchData?.query?.search;

      if (searchResults && searchResults.length > 0) {
        const candidateTitle = searchResults[0].title;
        const contentUrl = `${apiBase}?action=parse&page=${encodeURIComponent(candidateTitle)}&redirects=1&format=json&prop=text&origin=*`;

        const data = await fetchFandomApi(contentUrl);
        if (data && data.parse && !data.error) {
          contentData = data;
          bestMatchTitle = data.parse.title;
        }
      }
    }

    // Kiểm tra chốt chặn trước khi đưa cho Cheerio
    if (!contentData) {
      return res.status(404).json({ error: "Không tìm thấy dữ liệu tập phim này trên Fandom." });
    }

    const rawHtml = contentData.parse?.text?.['*'];

    if (!rawHtml) {
      return res.status(500).json({ error: "Dữ liệu HTML trả về bị rỗng." });
    }

    // =========================================================
    // GIAI ĐOẠN 2: CHEERIO BÓC TÁCH DỮ LIỆU (KHÔNG DÙNG AI)
    // =========================================================
    const $ = cheerio.load(rawHtml);

    let extractedData = {
      plotSummary: "",
      characters: [] as string[],
      adaptedFrom: "Không rõ"
    };

    // A. BÓC TÁCH "ADAPTED FROM"
    $('.pi-data-label').each((_, el) => {
      const labelText = $(el).text().toLowerCase();
      if (labelText.includes('manga') || labelText.includes('chapter') || labelText.includes('adapted')) {
        extractedData.adaptedFrom = $(el).next('.pi-data-value').text().trim();
      }
    });

    // =========================================================
    // B. BÓC TÁCH "PLOT SUMMARY / PLOT DETAILS" (SMART FALLBACK)
    // =========================================================
    const potentialHeaders: { id: string, element: any, priority: number }[] = [];

    // 1. Quét trang, thu gom các thẻ tiêu đề và GẮN ĐIỂM ƯU TIÊN
    $('span.mw-headline').each((_: number, el: any) => {
      const id = $(el).attr('id')?.toLowerCase() || '';
      let priority = 99; // Mặc định điểm cực thấp

      if (id.includes('plot')) priority = 1;          // Ưu tiên 1: Plot Details, Plot...
      else if (id.includes('long')) priority = 2;     // Ưu tiên 2: Long Summary...
      else if (id.includes('summary')) priority = 3;  // Ưu tiên 3: Summary...
      else if (id.includes('synopsis')) priority = 4; // Ưu tiên 4: Synopsis...
      else if (id.includes('story')) priority = 5;    // Ưu tiên 5: Story...

      if (priority < 99) {
        potentialHeaders.push({ id: id, element: $(el).parent(), priority: priority });
      }
    });

    // Sắp xếp mảng theo độ ưu tiên (từ 1 đến 5)
    potentialHeaders.sort((a, b) => a.priority - b.priority);

    // 2. Lặp qua từng thẻ đã xếp hạng để ĐỌC THỬ
    for (const header of potentialHeaders) {
      let tempText = ""; // Biến chứa nháp

      header.element.nextUntil('h2').each((_: number, el: any) => {
        if (el.tagName.toLowerCase() === 'p') {
          let paragraph = $(el).text().replace(/\[\d+\]/g, '').trim(); // Xóa các số ref dạng [1], [2]

          // 🌟 BỘ LỌC RÁC: Bỏ qua dòng chữ báo hiệu trang chưa hoàn thiện (stub)
          if (paragraph && !paragraph.toLowerCase().includes('this section is a stub')) {
            tempText += paragraph + "\n\n";
          }
        }
      });

      tempText = tempText.trim();

      // 3. CHỐT KẾT QUẢ: Nếu cào được chữ thật sự (dài hơn 10 ký tự), thì chốt luôn và thoát vòng lặp!
      if (tempText.length > 10) {
        extractedData.plotSummary = tempText;
        break;
      }
    }

    // C. BÓC TÁCH "CHARACTERS"
    let charHeader: any = null;

    // =========================================================
    // 1. TÌM TRONG NỘI DUNG CHÍNH (Xử lý cả List và Table)
    // =========================================================
    $('span.mw-headline').each((_: number, el: any) => {
      const id = $(el).attr('id')?.toLowerCase() || '';

      if (id.includes('character') || id.includes('cast') || id.includes('credit')) {
        charHeader = $(el).parent();
        return false;
      }
    });

    if (charHeader && charHeader.length > 0) {
      const sectionContent = charHeader.nextUntil('h2');

      // 🌟 TÌM TẤT CẢ CÁC BẢNG (Dù nó là thẻ gốc hay bị bọc trong div)
      const tables = sectionContent.filter('table').add(sectionContent.find('table'));

      // TRƯỜNG HỢP A: Nếu có BẢNG (Như mục Credits của Naruto)
      if (tables.length > 0) {
        tables.find('tr').each((_: number, tr: any) => {
          const firstCol = $(tr).find('td, th').first(); // Chỉ túm lấy cột đầu tiên

          let charName = firstCol.find('a').first().text().trim();
          if (!charName) charName = firstCol.text().trim();

          // Dọn rác (ví dụ: Naruto Uzumaki [1] -> Naruto Uzumaki)
          charName = charName.replace(/\[\d+\]/g, '').trim();

          if (charName && charName.length > 1 && charName.toLowerCase() !== 'role' && !charName.includes('File:') && !extractedData.characters.includes(charName)) {
            extractedData.characters.push(charName);
          }
        });
      }
      // TRƯỜNG HỢP B: Nếu là DANH SÁCH (Như Jujutsu Kaisen, One Piece)
      else {
        sectionContent.find('li a').each((_: number, el: any) => {
          let charName = $(el).text().trim();
          charName = charName.replace(/\[\d+\]/g, '').trim();

          if (charName && charName.length > 1 && !charName.includes('File:') && !extractedData.characters.includes(charName)) {
            extractedData.characters.push(charName);
          }
        });
      }
    }

    // =========================================================
    // 2. PHƯƠNG ÁN B: TÌM TRONG INFOBOX (Vớt vát nếu nội dung chính không có)
    // =========================================================
    if (extractedData.characters.length === 0) {
      const infoboxChars = $('.portable-infobox [data-source*="character" i], .portable-infobox [data-source*="Character" i]');

      if (infoboxChars.length > 0) {
        infoboxChars.find('a').each((_: number, el: any) => {
          const charName = $(el).text().trim();
          if (charName && charName.length > 1 && !charName.includes('File:') && !extractedData.characters.includes(charName)) {
            extractedData.characters.push(charName);
          }
        });
      } else {
        $('.portable-infobox h2, .portable-infobox h3, .portable-infobox .pi-header').each((_: number, el: any) => {
          if ($(el).text().toLowerCase().includes('character')) {
            $(el).parent().find('a').each((_: number, aEl: any) => {
              const charName = $(aEl).text().trim();
              if (charName && charName.length > 1 && !charName.includes('File:') && !extractedData.characters.includes(charName)) {
                extractedData.characters.push(charName);
              }
            });
          }
        });
      }
    }

    // =========================================================
    // 3. DỌN DẸP DỮ LIỆU LẦN CUỐI
    // =========================================================
    extractedData.characters = extractedData.characters.filter(c => c.length > 1 && !c.includes('File:'));
    extractedData.plotSummary = extractedData.plotSummary.trim();

    res.status(200).json({
      success: true,
      data: extractedData,
      sourceTitle: bestMatchTitle
    });

  } catch (error) {
    console.error("Lỗi Auto-fill Episode:", error);
    res.status(500).json({ error: "Lỗi hệ thống khi tự động cào và xử lý dữ liệu." });
  }
});

export default router;