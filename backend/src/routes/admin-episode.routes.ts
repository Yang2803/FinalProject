import express from 'express';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import * as cheerio from 'cheerio'; // 🌟 Dùng Cheerio thay cho AI
import prisma from '../config/db';

// Kích hoạt tính năng ẩn danh để qua mặt Cloudflare
puppeteer.use(StealthPlugin());

const router = express.Router();

router.post('/api/admin/episode/auto-fill', async (req, res) => {
  const { animeId, episodeNumber } = req.body;
  let browser; 

  try {
    const anime = await prisma.anime.findUnique({
      where: { id: animeId }
    });

    if (!anime || !anime.fandomPrefix) {
      return res.status(400).json({ error: "Anime chưa được cấu hình Fandom Prefix!" });
    }

    const apiBase = `https://${anime.fandomPrefix}.fandom.com/api.php`;

    // =========================================================
    // GIAI ĐOẠN 1: PHIÊN BẢN SĂN LỖI ĐỂ KIỂM TRA DỮ LIỆU
    // =========================================================
    browser = await puppeteer.launch({ 
      headless: false, // 🌟 ĐỔI THÀNH FALSE: Hiển thị trình duyệt để lách luật và làm Demo
      defaultViewport: null,
      args: [
        '--no-sandbox', 
        '--disable-setuid-sandbox', 
        '--window-size=1024,768' // Mở cửa sổ kích thước vừa phải
      ] 
    });
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

   // 1. Vào trang chủ để lấy Cookies
    const homeUrl = `https://${anime.fandomPrefix}.fandom.com/`;
    await page.goto(homeUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

    // 2. Gõ link API Tìm kiếm
    const searchUrl = `${apiBase}?action=query&list=search&srsearch=Episode+${episodeNumber}&format=json&utf8=1`;
    await page.goto(searchUrl, { waitUntil: 'domcontentloaded' });
    
    // 🌟 CHỜ ĐẾN KHI VƯỢT QUA CLOUDFLARE VÀ XUẤT HIỆN THẺ CHỨA JSON
    await page.waitForSelector('pre', { timeout: 25000 }); 

    const searchRawText = await page.evaluate(() => {
      // @ts-ignore
      return document.querySelector("pre")?.innerText || "{}";
    });

    const searchData = JSON.parse(searchRawText);
    const searchResults = searchData.query?.search;
    
    if (!searchResults || searchResults.length === 0) {
      await browser.close();
      return res.status(404).json({ error: "Không tìm thấy dữ liệu tập phim này." });
    }
    const bestMatchTitle = searchResults[0].title;

    // 3. Gõ link API lấy Nội dung chi tiết
    const contentUrl = `${apiBase}?action=parse&page=${encodeURIComponent(bestMatchTitle)}&format=json&prop=text`;
    await page.goto(contentUrl, { waitUntil: 'domcontentloaded' });
    
    // 🌟 TIẾP TỤC CHỜ ĐỢI
    await page.waitForSelector('pre', { timeout: 25000 });

    const contentRawText = await page.evaluate(() => {
      // @ts-ignore
      return document.querySelector("pre")?.innerText || "{}";
    });

    // Xong việc, đóng cửa sổ Chrome
    
    await browser.close(); 
    browser = null; 

    const contentData = JSON.parse(contentRawText);
    const rawHtml = contentData.parse?.text?.['*'];

    if(!rawHtml) {
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

    // B. BÓC TÁCH "PLOT SUMMARY / PLOT DETAILS"
    // Ưu tiên tìm thẻ có ID là Plot_Details trước. Nếu không có mới tìm lùi về Plot, Summary...
    let summaryHeader = $('#Plot_Details').first().parent();
    if (summaryHeader.length === 0) summaryHeader = $('#Plot').first().parent();
    if (summaryHeader.length === 0) summaryHeader = $('#Summary').first().parent();
    if (summaryHeader.length === 0) summaryHeader = $('#Synopsis').first().parent();

    if (summaryHeader.length > 0) {
      summaryHeader.nextUntil('h2').each((_, el) => {
        if (el.tagName.toLowerCase() === 'p') {
          let paragraph = $(el).text().replace(/\[\d+\]/g, '').trim(); // Xóa các số ref dạng [1], [2]
          if (paragraph) {
            extractedData.plotSummary += paragraph + "\n\n";
          }
        }
      });
    }

    // C. BÓC TÁCH "CHARACTERS"
    let charHeader: any = null; // Biến lưu trữ thẻ tiêu đề Nhân vật
    
    // Quét qua tất cả các tiêu đề (thẻ span có class mw-headline) trên trang
    $('span.mw-headline').each((_, el) => {
      const id = $(el).attr('id') || '';
      // TÌM TƯƠNG ĐỐI: Nếu ID có chứa chữ "Character" hoặc "Cast"
      if (id.includes('Character') || id.includes('Cast')) {
        charHeader = $(el).parent(); // Lấy thẻ <h2> chứa thẻ span đó
        return false; // Break vòng lặp (dừng tìm kiếm khi đã thấy)
      }
    });

    if (charHeader && charHeader.length > 0) {
      // Tìm tất cả các thẻ <a> bên trong danh sách <li> hoặc bảng <td>
      charHeader.nextUntil('h2').find('li a, td a').each((_: number, el: any) => {
        const charName = $(el).text().trim();
        // Lọc các link rác, đảm bảo tên nhân vật hợp lệ và chưa bị trùng lặp
        if (charName && charName.length > 1 && !charName.includes('File:') && !extractedData.characters.includes(charName)) {
          extractedData.characters.push(charName);
        }
      });
    }
    
    extractedData.characters = extractedData.characters.filter(c => c.length > 1 && !c.includes('File:'));
    extractedData.plotSummary = extractedData.plotSummary.trim();

    // =========================================================

    res.status(200).json({
      success: true,
      data: extractedData,
      sourceTitle: bestMatchTitle
    });

  } catch (error) {
    console.error("Lỗi Auto-fill Puppeteer + Cheerio:", error);
    if (browser) {
        await browser.close().catch(console.error); 
    }
    res.status(500).json({ error: "Lỗi hệ thống khi tự động cào và xử lý dữ liệu." });
  }
});

export default router;