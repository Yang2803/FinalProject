import express from 'express';
import * as cheerio from 'cheerio';
import prisma from '../config/db';

const router = express.Router();

// Hàm gọi trực tiếp MediaWiki API của Fandom (Không cần Puppeteer, chạy siêu nhẹ trên Render)
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

// API Auto-fill dành riêng cho Manga Chapter
router.post('/api/admin/chapter/auto-fill', async (req, res) => {
  const { mangaId, chapterNumber } = req.body;

  try {
    // 1. Lấy thông tin Manga từ Database
    const manga = await prisma.manga.findUnique({
      where: { id: mangaId }
    });

    if (!manga || !manga.fandomPrefix) {
      return res.status(400).json({ error: "Manga chưa được cấu hình Fandom Prefix!" });
    }

    const apiBase = `https://${manga.fandomPrefix}.fandom.com/api.php`;

    // =========================================================
    // GIAI ĐOẠN 1: DÒ TÌM ĐA TẦNG CHO MANGA CHAPTER QUA FANDOM API
    // =========================================================
    let contentData: any = null;
    let bestMatchTitle: string = "";

    // ---------------------------------------------------------
    // 🛡️ TẦNG 1: Dò tìm trực tiếp với từ khóa "Chapter"
    // ---------------------------------------------------------
    const directTitles = [
      `Chapter ${chapterNumber}`,                             // Dạng chuẩn nhất: "Chapter 1"
      `Chapter ${String(chapterNumber).padStart(3, '0')}`,    // Dạng 3 số: "Chapter 001"
      `Chapter ${String(chapterNumber).padStart(2, '0')}`,    // Dạng 2 số: "Chapter 01"
      `${manga.title} Chapter ${chapterNumber}`,              // VD: "Jujutsu Kaisen Chapter 1"
      `Chapter ${chapterNumber} (${manga.title})`             // VD: "Chapter 1 (Jujutsu Kaisen)"
    ];

    for (const title of directTitles) {
      const parseUrl = `${apiBase}?action=parse&page=${encodeURIComponent(title)}&redirects=1&format=json&prop=text&origin=*`;
      const data = await fetchFandomApi(parseUrl);

      if (data && data.parse && !data.error) {
        contentData = data;
        bestMatchTitle = data.parse.title;
        break;
      }
    }

    // ---------------------------------------------------------
    // 🛡️ TẦNG 2: Nếu Tầng 1 thất bại, dùng API tìm kiếm
    // ---------------------------------------------------------
    if (!contentData) {
      const searchQuery = encodeURIComponent(`Chapter ${chapterNumber}`);
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

    if (!contentData) {
      return res.status(404).json({ error: "Không tìm thấy dữ liệu Chapter này trên Fandom." });
    }

    const rawHtml = contentData.parse?.text?.['*'];

    if (!rawHtml) {
      return res.status(500).json({ error: "Dữ liệu HTML trả về bị rỗng." });
    }

    // =========================================================
    // GIAI ĐOẠN 2: CHEERIO BÓC TÁCH (Plot Summary & Characters)
    // =========================================================
    const $ = cheerio.load(rawHtml);

    let extractedData = {
      plotSummary: "",
      characters: [] as string[]
    };

    // A. BÓC TÁCH "PLOT SUMMARY / SYNOPSIS"
    const potentialHeaders: { id: string, element: any, priority: number }[] = [];

    $('span.mw-headline').each((_: number, el: any) => {
      const id = $(el).attr('id')?.toLowerCase() || '';
      let priority = 99;

      if (id.includes('plot')) priority = 1;          // Ưu tiên 1: Plot Details, Plot...
      else if (id.includes('long')) priority = 2;     // Ưu tiên 2: Long Summary...
      else if (id.includes('summary')) priority = 3;  // Ưu tiên 3: Summary...
      else if (id.includes('synopsis')) priority = 4; // Ưu tiên 4: Synopsis...
      else if (id.includes('story')) priority = 5;    // Ưu tiên 5: Story...

      if (priority < 99) {
        potentialHeaders.push({ id: id, element: $(el).parent(), priority: priority });
      }
    });

    potentialHeaders.sort((a, b) => a.priority - b.priority);

    for (const header of potentialHeaders) {
      let tempText = "";

      header.element.nextUntil('h2').each((_: number, el: any) => {
        if (el.tagName.toLowerCase() === 'p') {
          let paragraph = $(el).text().replace(/\[\d+\]/g, '').trim();

          if (paragraph && !paragraph.toLowerCase().includes('this section is a stub')) {
            tempText += paragraph + "\n\n";
          }
        }
      });

      tempText = tempText.trim();

      if (tempText.length > 10) {
        extractedData.plotSummary = tempText;
        break;
      }
    }

    // B. BÓC TÁCH "CHARACTERS"
    let charHeader: any = null;

    // 1. TÌM TRONG NỘI DUNG CHÍNH (Xử lý List và Table)
    $('span.mw-headline').each((_: number, el: any) => {
      const id = $(el).attr('id')?.toLowerCase() || '';

      if (id.includes('character') || id.includes('featured')) {
        charHeader = $(el).parent();
        return false;
      }
    });

    if (charHeader && charHeader.length > 0) {
      const sectionContent = charHeader.nextUntil('h2');
      const tables = sectionContent.filter('table').add(sectionContent.find('table'));

      if (tables.length > 0) {
        tables.find('tr').each((_: number, tr: any) => {
          const firstCol = $(tr).find('td, th').first();

          let charName = firstCol.find('a').first().text().trim();
          if (!charName) charName = firstCol.text().trim();

          charName = charName.replace(/\[\d+\]/g, '').trim();

          if (charName && charName.length > 1 && charName.toLowerCase() !== 'role' && !charName.includes('File:') && !extractedData.characters.includes(charName)) {
            extractedData.characters.push(charName);
          }
        });
      }
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

    // 2. TÌM TRONG INFOBOX (Vớt vát)
    if (extractedData.characters.length === 0) {
      const infoboxChars = $('.portable-infobox [data-source*="character" i]');

      if (infoboxChars.length > 0) {
        infoboxChars.find('a').each((_: number, el: any) => {
          const charName = $(el).text().trim();
          if (charName && charName.length > 1 && !charName.includes('File:') && !extractedData.characters.includes(charName)) {
            extractedData.characters.push(charName);
          }
        });
      }
    }

    // 3. DỌN DẸP LẦN CUỐI
    extractedData.characters = extractedData.characters.filter(c => c.length > 1 && !c.includes('File:'));
    extractedData.plotSummary = extractedData.plotSummary.trim();

    res.status(200).json({
      success: true,
      data: extractedData,
      sourceTitle: bestMatchTitle
    });

  } catch (error) {
    console.error("Lỗi Auto-fill Manga Chapter:", error);
    res.status(500).json({ error: "Lỗi hệ thống khi tự động cào dữ liệu Manga Chapter." });
  }
});

export default router;