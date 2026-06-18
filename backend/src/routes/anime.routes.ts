import express, { Request, Response } from 'express';
import prisma from '../config/db'; // Nhúng DB dùng chung
import { GoogleGenerativeAI } from "@google/generative-ai";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const router = express.Router();

// ==========================================
// API QUẢN LÝ ANIME & EPISODE (ADMIN)
// ==========================================

// 1. Lấy danh sách rút gọn của Anime để đưa vào ô chọn (Dropdown Select)
router.get('/api/admin/anime/list-select', async (req: Request, res: Response) => {
  try {
    const animes = await prisma.anime.findMany({
      select: { id: true, title: true },
      orderBy: { title: 'asc' }
    });
    res.status(200).json(animes);
  } catch (error) {
    res.status(500).json({ message: "Lỗi tải danh sách phim." });
  }
});

// 2. API: Tạo tập phim mới kèm theo mảng phụ đề và liên kết Manga

// 🌟 HÀM HELPER: Nhúng chuỗi văn bản (bất kể ngôn ngữ) thành Vector 768 chiều
async function generateEmbedding(text: string): Promise<number[]> {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);
  const model = genAI.getGenerativeModel({ model: "gemini-embedding-001" });
  const result = await model.embedContent(text);
  return result.embedding.values;
}

// 2. API: Tạo tập phim mới kèm theo mảng phụ đề, liên kết Manga và Tọa độ Vector Plot
router.post('/api/admin/episode', async (req: Request, res: Response): Promise<any> => {
  try {
    const { 
      animeId, 
      title, 
      videoUrl, 
      subtitles, 
      episodeNumber, 
      mappedChapterIds,
      adaptedFrom,
      characters, 
      plotSummary 
    } = req.body;

    if (!animeId || !title || !videoUrl || episodeNumber === undefined) {
      return res.status(400).json({ message: "Vui lòng điền đủ thông tin bắt buộc!" });
    }

    // CHUYỂN ĐỔI CHUỖI CHARACTERS THÀNH MẢNG (ARRAY)
    let characterArray: string[] = [];
    if (typeof characters === 'string' && characters.trim().length > 0) {
      characterArray = characters
        .split(",")
        .map(name => name.trim())
        .filter(name => name.length > 0);
    } else if (Array.isArray(characters)) {
      characterArray = characters;
    }

    // BƯỚC 1: Tạo dữ liệu văn bản thuần túy trước để lấy ID tập phim
    const newEpisode = await prisma.episode.create({
      data: {
        animeId,
        title,
        videoUrl,
        episodeNumber: Number(episodeNumber), 
        mappedChapterIds: mappedChapterIds || [], 
        adaptedFrom: adaptedFrom || "",
        plotSummary: plotSummary || "",
        characters: characterArray, 
        subtitles: {
          create: subtitles 
        }
      },
      include: { subtitles: true }
    });

    // BƯỚC 2: TỰ ĐỘNG SINH VECTOR EMBEDDING VÀ LƯU VÀO CỘT UNSUPPORTED
    if (plotSummary && plotSummary.trim().length > 0) {
      try {
        // Gọi AI của Google để tính toán chuỗi số tọa độ ngữ nghĩa
        const vectorValues = await generateEmbedding(plotSummary);
        
        // Định dạng mảng số thành chuỗi cấu trúc mảng PostgreSQL: "[0.123, -0.456, ...]"
        const vectorStr = `[${vectorValues.join(',')}]`; 
        
        // Ép kiểu chuỗi số về dạng dữ liệu dữ liệu dạng ::vector và nạp vào Postgres
        await prisma.$executeRawUnsafe(
          `UPDATE "Episode" SET embedding = $1::vector WHERE id = $2`,
          vectorStr,
          newEpisode.id
        );
        
        console.log(`✨ Đã nạp thành công Vector Embedding cho Tập số ${episodeNumber}.`);
      } catch (embedError) {
        // Bọc try-catch riêng ở đây để nếu AI Key hết hạn hoặc lỗi mạng, 
        // tập phim vẫn được tải lên thành công (không làm hỏng luồng chính của hệ thống).
        console.error("Lỗi trong quá trình sinh hoặc nạp Vector Embedding:", embedError);
      }
    }

    res.status(201).json({ 
      message: "New episode uploaded successfully with Vector Space activated!", 
      episode: newEpisode 
    });

  } catch (error) {
    console.error("Lỗi đăng tập phim:", error);
    res.status(500).json({ message: "Lỗi server khi lưu tập phim." });
  }
});

// 3. API: Lấy danh sách toàn bộ Anime cho trang Quản trị
router.get('/api/admin/anime', async (req: Request, res: Response) => {
  try {
    const animes = await prisma.anime.findMany({
      orderBy: { createdAt: 'desc' }, // Phim mới thêm lên đầu
      include: {
        _count: {
          select: { episodes: true } // Đếm số lượng tập phim để hiển thị cho Admin dễ quản lý
        }
      }
    });
    res.status(200).json(animes);
  } catch (error) {
    res.status(500).json({ message: "Lỗi server khi tải danh sách Anime." });
  }
});

// 4. API: Xóa bộ Anime (Sẽ tự động xóa luôn các Episode và Subtitle bên trong nhờ onDelete: Cascade)
router.delete('/api/admin/anime/:id', async (req: Request, res: Response): Promise<any> => {
  try {
    const id = req.params.id as string;
    await prisma.anime.delete({
      where: { id }
    });
    res.status(200).json({ message: "New anime deleted successfully!" });
  } catch (error) {
    console.error("Lỗi xóa Anime:", error);
    res.status(500).json({ message: "Lỗi server khi xóa phim." });
  }
});

// 5. [NÂNG CẤP] API: Lấy chi tiết 1 bộ Anime kèm danh sách tập phim đã đăng
router.get('/api/admin/anime/:id', async (req: Request, res: Response): Promise<any> => {
  try {
    const animeId = req.params.id as string;
    
    const anime = await prisma.anime.findUnique({
      where: { id: animeId },
      include: {
        episodes: {
          orderBy: { createdAt: 'asc' } // Sắp xếp tập phim từ cũ đến mới (Tập 1, 2, 3...)
        }
      }
    });
    
    if (!anime) return res.status(404).json({ message: "The requested anime series was not found." });
    res.status(200).json(anime);
  } catch (error) {
    res.status(500).json({ message: "Server error while loading anime details." });
  }
});

// 6. [THÊM MỚI] API: Chỉnh sửa thông tin phim (Sửa Tên, Mô tả, Ảnh bìa, Fandom Prefix)
router.put('/api/admin/anime/:id', async (req: Request, res: Response): Promise<any> => {
  try {
    const animeId = req.params.id as string;
    
    // 🌟 THÊM fandomPrefix VÀO ĐÂY ĐỂ HỨNG DỮ LIỆU
    const { title, description, coverImage, fandomPrefix } = req.body;

    if (!title) return res.status(400).json({ message: "The anime title cannot be empty!" });

    const updatedAnime = await prisma.anime.update({
      where: { id: animeId },
      // 🌟 THÊM fandomPrefix VÀO ĐÂY ĐỂ LƯU VÀO DATABASE
      data: { 
        title, 
        description, 
        coverImage,
        fandomPrefix 
      }
    });

    res.status(200).json({ message: "Update anime information successfully!", anime: updatedAnime });
  } catch (error) {
    console.error("Error updating anime:", error);
    res.status(500).json({ message: "Server error while updating anime." });
  }
});

// 7. API: Xóa tập phim
router.delete('/api/admin/episode/:id', async (req: Request, res: Response): Promise<any> => {
  try {
    const episodeId = req.params.id as string;
    await prisma.episode.delete({
      where: { id: episodeId }
    });
    res.status(200).json({ message: "Episode deleted successfully!" });
  } catch (error) {
    console.error("Lỗi xóa tập phim:", error);
    res.status(500).json({ message: "Lỗi server khi xóa tập phim." });
  }
});

// 8. API: Lấy chi tiết 1 tập phim (Dùng cho trang Edit)
router.get('/api/admin/episode-detail/:id', async (req: Request, res: Response): Promise<any> => {
  try {
    const episodeId = req.params.id as string;
    const episode = await prisma.episode.findUnique({
      where: { id: episodeId },
      include: { subtitles: true }
    });
    if (!episode) return res.status(404).json({ message: "Không tìm thấy tập phim" });
    res.status(200).json(episode);
  } catch (error) {
    res.status(500).json({ message: "Lỗi tải thông tin tập phim." });
  }
});

// 9. API: Cập nhật tập phim (Đổi tên, video, subtitle, Manga Sync hoặc Cập nhật chi tiết AI)
router.put('/api/admin/episode/:id', async (req: Request, res: Response): Promise<any> => {
  try {
    const episodeId = req.params.id as string;
    
    // 1. BÓC TÁCH CÁC TRƯỜNG DỮ LIỆU TỪ FRONTEND
    const { 
      title, 
      videoUrl, 
      newSubtitles, 
      episodeNumber, 
      mappedChapterIds,
      adaptedFrom,   
      characters,    
      plotSummary    
    } = req.body;

    // 2. CẬP NHẬT DỮ LIỆU VĂN BẢN VÀO PRISMA TRƯỚC
    const updatedEpisode = await prisma.episode.update({
      where: { id: episodeId },
      data: {
        ...(title && { title }), 
        ...(videoUrl && { videoUrl }), 
        ...(episodeNumber !== undefined && { episodeNumber: Number(episodeNumber) }),
        ...(mappedChapterIds && { mappedChapterIds }),
        ...(adaptedFrom !== undefined && { adaptedFrom }),
        ...(characters !== undefined && { characters }), 
        ...(plotSummary !== undefined && { plotSummary })
      }
    });

    // 🌟 3. XỬ LÝ LẠI TỌA ĐỘ VECTOR NẾU PLOT SUMMARY BỊ THAY ĐỔI
    if (plotSummary !== undefined) {
      if (plotSummary.trim().length > 0) {
        // NẾU CÓ NỘI DUNG: Gọi AI sinh Vector mới và ghi đè vào DB
        try {
          const vectorValues = await generateEmbedding(plotSummary);
          const vectorStr = `[${vectorValues.join(',')}]`;
          
          await prisma.$executeRawUnsafe(
            `UPDATE "Episode" SET embedding = $1::vector WHERE id = $2`,
            vectorStr,
            episodeId
          );
          console.log(`✨ Đã cập nhật lại Vector 3072 chiều cho tập phim ID: ${episodeId}`);
        } catch (embedError) {
          console.error("Lỗi nạp Vector Embedding khi Edit:", embedError);
        }
      } else {
        // NẾU BỊ XÓA TRẮNG: Reset cột vector về NULL cho sạch Database
        await prisma.$executeRawUnsafe(
          `UPDATE "Episode" SET embedding = NULL WHERE id = $1`,
          episodeId
        );
      }
    }

    // 4. XỬ LÝ PHỤ ĐỀ MỚI (NẾU CÓ GỬI LÊN)
    if (newSubtitles && newSubtitles.length > 0) {
      await prisma.subtitle.deleteMany({ where: { episodeId: episodeId } });
      await prisma.subtitle.createMany({
        data: newSubtitles.map((sub: any) => ({
          label: sub.label,
          url: sub.url,
          episodeId: episodeId
        }))
      });
    }

    res.status(200).json({ message: "Episode updated successfully!", episode: updatedEpisode });
  } catch (error) {
    console.error("Lỗi cập nhật tập phim:", error);
    res.status(500).json({ message: "Lỗi server khi cập nhật tập phim." });
  }
});

// ==========================================
// API ANIME DÀNH CHO USER (PUBLIC)
// ==========================================

// 1. Lấy danh sách tất cả Anime (Mới nhất lên đầu)
router.get('/api/anime', async (req: Request, res: Response) => {
  try {
    const animes = await prisma.anime.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { episodes: true } }
      }
    });
    res.status(200).json(animes);
  } catch (error) {
    res.status(500).json({ message: "Lỗi tải danh sách phim." });
  }
});

// 2. Lấy chi tiết 1 bộ Anime kèm toàn bộ Tập phim và Phụ đề
router.get('/api/anime/:id', async (req: Request, res: Response): Promise<any> => {
  try {
    const animeId = req.params.id as string;
    const anime = await prisma.anime.findUnique({
      where: { id: animeId },
      include: {
        episodes: {
          orderBy: { createdAt: 'asc' }, // Sắp xếp Tập 1, Tập 2...
          include: { subtitles: true }   // Lấy luôn phụ đề để xem
        }
      }
    });
    
    if (!anime) return res.status(404).json({ message: "The anime could not be found." });
    res.status(200).json(anime);
  } catch (error) {
    res.status(500).json({ message: "Lỗi tải thông tin phim." });
  }
});

// Cấu hình lại S3 Client (Dùng cho việc upload file dịch lên R2)
const s3Client = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT as string,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID as string,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY as string,
  },
  forcePathStyle: true,
});

// API: Dịch phụ đề tự động bằng Gemini 1.5 Flash
router.post('/api/anime/translate-sub', async (req: Request, res: Response): Promise<any> => {
  try {
    const { episodeId, targetLang } = req.body;

    if (!episodeId || !targetLang) {
      return res.status(400).json({ message: "Thiếu thông tin tập phim hoặc ngôn ngữ đích." });
    }

    const newLabel = `${targetLang} (Auto)`;

    // 1. KIỂM TRA CACHE: Xem ngôn ngữ này đã từng được dịch chưa
    const existingSub = await prisma.subtitle.findFirst({
      where: { episodeId, label: newLabel }
    });

    // Nếu có rồi, trả về luôn, không cần gọi AI tốn thời gian
    if (existingSub) {
      return res.status(200).json({ message: "Loaded from cache", subtitle: existingSub });
    }

    // 2. TÌM FILE GỐC (Ưu tiên tiếng Anh)
    const episode = await prisma.episode.findUnique({
      where: { id: episodeId },
      include: { subtitles: true }
    });

    if (!episode || episode.subtitles.length === 0) {
      return res.status(404).json({ message: "Tập phim này chưa có phụ đề gốc nào để dịch." });
    }

    // Thuật toán chọn file gốc: Ưu tiên file có chữ "English" hoặc "Full"
    let sourceSub = episode.subtitles.find(sub => 
      sub.label.toLowerCase().includes("english") || sub.label.toLowerCase().includes("full")
    );
    
    // Nếu không tìm thấy, lấy file đầu tiên
    if (!sourceSub) {
      sourceSub = episode.subtitles[0];
    }
    if (!sourceSub) {
      return res.status(404).json({ message: "Không tìm thấy dữ liệu phụ đề gốc hợp lệ." });
    }

    // 3. TẢI NỘI DUNG FILE VTT GỐC
    const response = await fetch(sourceSub.url); // Vết gạch đỏ sẽ biến mất ngay lập tức!
    if (!response.ok) throw new Error("Không thể tải file phụ đề gốc");
    const vttContent = await response.text();

    // 4. GỌI GEMINI 1.5 FLASH DỊCH THUẬT
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    // Prompt (Câu lệnh) thiết kế đặc biệt để ép AI không làm hỏng cấu trúc VTT
    const prompt = `
      You are a professional anime subtitle translator. Translate the following WEBVTT subtitle file into ${targetLang}.
      IMPORTANT RULES:
      1. Keep the 'WEBVTT' header exactly as it is.
      2. DO NOT translate, change, or format the timestamps (e.g., 00:00:01.000 --> 00:00:03.000).
      3. DO NOT alter the sequence numbers.
      4. ONLY translate the spoken dialogue text. Keep character names sounding natural.
      5. Return ONLY the translated WEBVTT content, without any markdown formatting like \`\`\`vtt.
      
      Here is the file:
      ${vttContent}
    `;

    const aiResult = await model.generateContent(prompt);
    let translatedVtt = aiResult.response.text();
    
    // Đảm bảo AI không tự bọc markdown vào kết quả (Xóa bỏ ```vtt nếu có)
    translatedVtt = translatedVtt.replace(/```vtt/g, '').replace(/```/g, '').trim();

    // 5. UPLOAD FILE VTT MỚI LÊN CLOUDFLARE R2
    const fileName = `translated-${episodeId}-${Date.now()}.vtt`;
    
    const command = new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME as string,
      Key: fileName,
      Body: translatedVtt, // Đẩy thẳng chuỗi text lên làm nội dung file
      ContentType: "text/vtt",
    });

    await s3Client.send(command);
    const publicUrl = `${process.env.R2_PUBLIC_DOMAIN}/${fileName}`;

    // 6. LƯU VÀO DATABASE
    const newSubtitle = await prisma.subtitle.create({
      data: {
        label: newLabel,
        url: publicUrl,
        episodeId: episodeId
      }
    });

    res.status(200).json({ message: "Translated successfully", subtitle: newSubtitle });
  } catch (error) {
    console.error("Lỗi Dịch Auto:", error);
    res.status(500).json({ message: "Lỗi server khi dịch tự động." });
  }
});


//API Tự động liên kết Tập Anime với Chapter Manga bằng AI (Dùng Gemini 2.5 Flash)

// =========================================================================
// HÀM PHỤ TRỢ: CHUYÊN GIA BÓC TÁCH SỐ CHAPTER TỪ CHUỖI TEXT CỦA WIKI
// =========================================================================
function extractChapterNumbers(text: string): number[] {
  if (!text || typeof text !== 'string') return [];
  // Bỏ qua nếu Fandom ghi "Không rõ", "TBA", "Unknown"
  if (text.toLowerCase().includes('không rõ') || text.toLowerCase().includes('tba') || text.toLowerCase().includes('unknown')) {
    return [];
  }

  const chapters = new Set<number>();
  
  // 1. Dọn rác: Xóa sạch mọi thứ nằm trong dấu ngoặc đơn (Ví dụ: "(p. 4 - 25)")
  const cleanText = text.replace(/\([^)]*\)/g, ' '); 

  // 2. Bộ Regex thông minh: 
  // Bắt các chữ "Chapter", "Chap", "Ch", theo sau là 1 con số, và có thể có dấu gạch ngang kéo dài (vd: 4-6)
  const regex = /(?:chapter|chap|ch)\w*\.?\s*(\d+)(?:\s*(?:-|–|to)\s*(\d+))?/gi;
  let match;

  while ((match = regex.exec(cleanText)) !== null) {
    const start = parseInt(match[1]!); // Số bắt đầu
    const end = match[2] ? parseInt(match[2]) : start; // Số kết thúc (nếu có dấu -)

    // Chống vòng lặp vô hạn và map dữ liệu từ start đến end
    if (start && end && start <= end && end - start < 100) { 
      for (let i = start; i <= end; i++) {
        chapters.add(i);
      }
    } else if (start) {
      chapters.add(start);
    }
  }

  return Array.from(chapters);
}


// =========================================================================
// API TỰ ĐỘNG LIÊN KẾT (SMART MAP: REGEX FIRST -> AI FALLBACK)
// =========================================================================
router.post('/api/admin/auto-map-chapters', async (req: Request, res: Response): Promise<any> => {
  try {
    const { animeName, episodeNumber, mangaId, adaptedFrom } = req.body;
    let chapterNumbers: number[] = [];
    let mappingSource = "Hệ thống Bóc tách Văn bản (Regex)";

    // -------------------------------------------------------------
    // GIAI ĐOẠN 1: THỬ TRÍCH XUẤT TỪ TRƯỜNG "ADAPTED FROM"
    // -------------------------------------------------------------
    if (adaptedFrom) {
      chapterNumbers = extractChapterNumbers(adaptedFrom);
    }

    // -------------------------------------------------------------
    // GIAI ĐOẠN 2: NẾU THẤT BẠI (Rỗng), GỌI AI RA CỨU GIÁ
    // -------------------------------------------------------------
    if (chapterNumbers.length === 0) {
      mappingSource = "Trí tuệ nhân tạo (Gemini AI)";
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);
      const model = genAI.getGenerativeModel({ 
        model: "gemini-2.5-flash",
        generationConfig: { responseMimeType: "application/json" } 
      });

      const prompt = `
        You are an anime/manga database expert. 
        The anime is "${animeName}". 
        Which manga chapter numbers correspond exactly to episode ${episodeNumber} of this anime?
        Return ONLY a JSON array of integers representing the chapter numbers. 
        For example, if it covers chapters 4 and 5, return: [4, 5]. 
        If it's a filler episode with no manga chapters, return: [].
      `;

      const aiResult = await model.generateContent(prompt);
      chapterNumbers = JSON.parse(aiResult.response.text());
    }

    // -------------------------------------------------------------
    // GIAI ĐOẠN 3: LƯU TRỮ VÀ KHỚP VỚI DATABASE
    // -------------------------------------------------------------
    if (chapterNumbers.length === 0) {
      return res.status(200).json({ 
        mappedChapterIds: [], 
        message: `Đây là tập Filler (Ngoại truyện), không có Manga. (Nguồn: ${mappingSource})` 
      });
    }

    const mappedChapterIds: string[] = [];
    for (const chapNum of chapterNumbers) {
      // Tìm chap trong DB thuộc bộ Manga đó, có chứa số chapter
      const chapterInDb = await prisma.chapter.findFirst({
        where: {
          mangaId: mangaId,
          title: {
            contains: chapNum.toString()
          }
        }
      });

      if (chapterInDb) {
        mappedChapterIds.push(chapterInDb.id);
      }
    }

    res.status(200).json({ 
      mappedChapterIds, 
      foundNumbers: chapterNumbers,
      message: `Tìm liên kết thành công qua: ${mappingSource}!` 
    });

  } catch (error) {
    console.error("Lỗi Auto-Map:", error);
    res.status(500).json({ message: "Lỗi server khi tự động liên kết." });
  }
});


// Auto generate Anime description using Gemini 2.5 Flash
router.post('/api/admin/generate-anime-desc', async (req: Request, res: Response): Promise<any> => {
  try {
    const { title } = req.body;

    if (!title) {
      return res.status(400).json({ message: "Vui lòng cung cấp tên phim." });
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    // Cấu hình Prompt (Câu lệnh) cho AI
    const prompt = `
      Bạn là một chuyên gia đánh giá Anime (Wibu chính hiệu).
      Hãy viết một đoạn tóm tắt nội dung hấp dẫn, chính xác cho bộ anime có tên là "${title}".
      YÊU CẦU BẮT BUỘC:
      1. Viết bằng Tiếng Anh.
      2. Độ dài khoảng 3-4 câu (ngắn gọn, súc tích).
      3. Tuyệt đối KHÔNG tiết lộ nội dung quan trọng (No spoilers).
      4. Chỉ trả về văn bản tóm tắt, không giải thích gì thêm, không dùng markdown code block.
    `;

    const aiResult = await model.generateContent(prompt);
    const description = aiResult.response.text().trim();

    res.status(200).json({ description });

  } catch (error) {
    console.error("Lỗi AI viết tóm tắt:", error);
    res.status(500).json({ message: "Lỗi server khi nhờ AI viết tóm tắt." });
  }
});



export default router;