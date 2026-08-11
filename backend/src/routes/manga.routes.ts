import express, { Request, Response } from 'express';
import prisma from '../config/db';
import { GoogleGenerativeAI } from "@google/generative-ai";


const router = express.Router();

async function generateEmbedding(text: string): Promise<number[]> {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);
  const model = genAI.getGenerativeModel({ model: "gemini-embedding-001" });
  const result = await model.embedContent(text);
  return result.embedding.values;
}

// ================= API ADMIN (MANGA & CHAPTER) =================

router.post('/api/admin/manga', async (req: Request, res: Response): Promise<any> => {
  /* ... Paste ruột API Thêm Manga mới ... */
  try {
    // 1. Nhận dữ liệu từ Frontend gửi lên, bao gồm cả userId để check quyền
    const { title, description, author, coverImage, status, userId, fandomPrefix } = req.body;

    if (!title || !userId) {
      return res.status(400).json({ message: "Thiếu thông tin bắt buộc (Tiêu đề hoặc ID người dùng)!" });
    }

    // 2. Kiểm tra bảo mật: User này có tồn tại không và có phải ADMIN không?
    const user = await prisma.user.findUnique({ where: { id: userId } });
    
    if (!user || user.role !== "ADMIN") {
      return res.status(403).json({ message: "Từ chối truy cập! Chỉ Admin mới có quyền thực hiện hành động này." });
    }

    // 3. Nếu là ADMIN, tiến hành lưu Manga vào Database
    const newManga = await prisma.manga.create({
      data: {
        title,
        description,
        author,
        coverImage,
        status,
        fandomPrefix: fandomPrefix || "",
      },
    });

    res.status(201).json({ message: "New manga added successfully!", manga: newManga });
  } catch (error) {
    console.error("Error adding manga:", error);
    res.status(500).json({ message: "Server error while adding manga." });
  }
});

router.get('/api/admin/manga', async (req: Request, res: Response): Promise<any> => {
  /* ... Paste ruột API Lấy danh sách toàn bộ Manga (Admin) ... */
  try {
    const mangas = await prisma.manga.findMany({
      orderBy: { createdAt: 'desc' }, // Sắp xếp truyện mới nhất lên đầu
      include: { _count: { select: { chapters: true } } }
    });
    res.status(200).json(mangas);
  } catch (error) {
    console.error("Error fetching manga list:", error);
    res.status(500).json({ message: "Server error while fetching manga list" });
  }
});

router.get('/api/admin/manga/:id', async (req: Request, res: Response): Promise<any> => {
  /* ... Paste ruột API Lấy chi tiết 1 Manga (Admin) ... */
  try {
    const id = req.params.id as string;
    const manga = await prisma.manga.findUnique({
      where: { id },
      include: {
        chapters: {
          orderBy: { createdAt: 'desc' } // Chương mới lên đầu
        }
      }
    });

    if (!manga) return res.status(404).json({ message: "This series could not be found!" });
    res.status(200).json(manga);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error while fetching manga details." });
  }
});

router.put('/api/admin/manga/:id', async (req: Request, res: Response): Promise<any> => {
  /* ... Paste ruột API Cập nhật thông tin truyện ... */
  try {
    const id = req.params.id as string;
    const { title, author, coverImage, status, description, fandomPrefix } = req.body;

    const updatedManga = await prisma.manga.update({
      where: { id },
      data: { title, author, coverImage, status, description, fandomPrefix }
    });

    res.status(200).json({ message: "Update manga information successfully!", manga: updatedManga });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error while updating manga." });
  }
});

router.delete('/api/admin/manga/:id', async (req: Request, res: Response): Promise<any> => {
  /* ... Paste ruột API Xóa truyện ... */
  try {
    const id = req.params.id as string;

    // Vì schema đã cấu hình onDelete: Cascade nên khi xóa Manga, toàn bộ Chapter thuộc về nó sẽ tự động bị xóa sạch trong DB
    await prisma.manga.delete({ where: { id } });

    res.status(200).json({ message: "New manga deleted successfully!" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Lỗi server khi xóa truyện." });
  }
});

router.post('/api/admin/chapter', async (req: Request, res: Response): Promise<any> => {
  try {
    // 🌟 1. HỨNG THÊM DỮ LIỆU TỪ FRONTEND
    const { mangaId, title, chapterNumber, characters, plotSummary, images } = req.body;

    if (!mangaId || !title || !images || images.length === 0) {
      return res.status(400).json({ message: "Thiếu thông tin hoặc chưa có ảnh!" });
    }

    // 🌟 2. XỬ LÝ CHUỖI CHARACTERS THÀNH ARRAY
    let characterArray: string[] = [];
    if (typeof characters === 'string' && characters.trim().length > 0) {
      characterArray = characters.split(",").map(name => name.trim()).filter(name => name.length > 0);
    } else if (Array.isArray(characters)) {
      characterArray = characters;
    }

    // 🌟 3. LƯU VÀO DATABASE
    const newChapter = await prisma.chapter.create({
      data: {
        mangaId,
        title,
        images,
        chapterNumber: chapterNumber ? Number(chapterNumber) : null,
        characters: characterArray,
        plotSummary: plotSummary || ""
      }
    });

    // ==========================================
    // 🌟 4. TỰ ĐỘNG SINH VECTOR EMBEDDING VÀ LƯU VÀO DB
    // ==========================================
    if (plotSummary && plotSummary.trim().length > 0) {
      try {
        const vectorValues = await generateEmbedding(plotSummary);
        const vectorStr = `[${vectorValues.join(',')}]`; 
        
        await prisma.$executeRawUnsafe(
          `UPDATE "Chapter" SET embedding = $1::vector WHERE id = $2`,
          vectorStr,
          newChapter.id
        );
        console.log(`✨ Đã nạp thành công Vector Embedding cho Chapter mới.`);
      } catch (embedError) {
        console.error("Lỗi nạp Vector Embedding:", embedError);
      }
    }

    res.status(201).json({ message: "New chapter added successfully!", chapter: newChapter });
  } catch (error) {
    console.error("Error adding chapter:", error);
    res.status(500).json({ message: "Server error while saving chapter." });
  }
});

// Lấy chi tiết 1 Chapter (Admin)
router.get('/api/admin/chapter/:id', async (req: Request, res: Response): Promise<any> => {
  try {
    const id = req.params.id as string;
    const chapter = await prisma.chapter.findUnique({ where: { id } });
    if (!chapter) return res.status(404).json({ message: "Không tìm thấy chương truyện này!" });
    res.status(200).json(chapter);
  } catch (error) {
    res.status(500).json({ message: "Lỗi server khi tải thông tin chương." });
  }
});

// Sửa chương truyện (SỬA)
router.put('/api/admin/chapter/:id', async (req: Request, res: Response): Promise<any> => {
  try {
    const id = req.params.id as string;
    // 🌟 1. Hứng thêm các biến mới từ Frontend
    const { title, chapterNumber, characters, plotSummary, images } = req.body; 

    if (!title) {
      return res.status(400).json({ message: "Tên chương không được để trống!" });
    }

    // 🌟 2. Xử lý chuỗi characters thành Array
    let characterArray: string[] | undefined = undefined;
    if (characters !== undefined) {
      if (typeof characters === 'string' && characters.trim().length > 0) {
        characterArray = characters.split(",").map(name => name.trim()).filter(name => name.length > 0);
      } else if (Array.isArray(characters)) {
        characterArray = characters;
      } else {
        characterArray = []; 
      }
    }

    // 🌟 3. Cập nhật dữ liệu
    const updatedChapter = await prisma.chapter.update({
      where: { id },
      data: { 
        title,
        ...(chapterNumber !== undefined && { chapterNumber: chapterNumber ? Number(chapterNumber) : null }),
        ...(characterArray !== undefined && { characters: characterArray }),
        ...(plotSummary !== undefined && { plotSummary }),
        ...(images && { images }) 
      }
    });

    // ==========================================
    // 🌟 4. XỬ LÝ LẠI TỌA ĐỘ VECTOR NẾU PLOT SUMMARY BỊ THAY ĐỔI
    // ==========================================
    if (plotSummary !== undefined) {
      if (plotSummary.trim().length > 0) {
        try {
          const vectorValues = await generateEmbedding(plotSummary);
          const vectorStr = `[${vectorValues.join(',')}]`;
          
          await prisma.$executeRawUnsafe(
            `UPDATE "Chapter" SET embedding = $1::vector WHERE id = $2`,
            vectorStr,
            id
          );
          console.log(`✨ Đã cập nhật lại Vector 3072 chiều cho Chapter ID: ${id}`);
        } catch (embedError) {
          console.error("Lỗi nạp Vector Embedding khi Edit:", embedError);
        }
      } else {
        // Reset về NULL nếu admin xóa trắng tóm tắt
        await prisma.$executeRawUnsafe(
          `UPDATE "Chapter" SET embedding = NULL WHERE id = $1`,
          id
        );
      }
    }

    res.status(200).json({ message: "Chapter update successful!", chapter: updatedChapter });
  } catch (error) {
    console.error("Error updating chapter:", error);
    res.status(500).json({ message: "Server error while updating chapter." });
  }
});

// Xóa chương truyện (XÓA)
router.delete('/api/admin/chapter/:id', async (req: Request, res: Response): Promise<any> => {
  try {
    const id = req.params.id as string;

    // Đổi lại đúng là prisma.chapter.delete
    await prisma.chapter.delete({
      where: { id }
    });

    res.status(200).json({ message: "Chapter deleted successfully!" });
  } catch (error) {
    console.error("Error deleting chapter:", error);
    res.status(500).json({ message: "Lỗi server khi xóa chương truyện." });
  }
});


// ================= API PUBLIC (DÀNH CHO NGƯỜI DÙNG) =================

router.post('/api/manga', async (req: Request, res: Response): Promise<any> => {
  /* ... Paste ruột API Upload Chapter mới kèm ảnh từ Frontend ... */
  try {
    const { mangaTitle, chapterTitle, images } = req.body;

    if (!mangaTitle || !chapterTitle || !images || images.length === 0) {
      return res.status(400).json({ message: "Thiếu thông tin hoặc chưa có ảnh!" });
    }

    // 1. Tìm truyện trong DB xem đã có chưa
    let manga = await prisma.manga.findUnique({
      where: { title: mangaTitle }
    });

    // 2. Nếu truyện chưa tồn tại, tự động tạo truyện mới
    if (!manga) {
      manga = await prisma.manga.create({
        data: {
          title: mangaTitle,
          description: "Đang cập nhật...", // Thông tin phụ có thể sửa ở trang Admin sau
        }
      });
    }

    // 3. Tạo Chương mới và nhét toàn bộ link ảnh Cloudinary vào
    const newChapter = await prisma.chapter.create({
      data: {
        title: chapterTitle,
        images: images, // Prisma tự động hiểu và lưu mảng URL này
        mangaId: manga.id
      }
    });

    res.status(201).json({ 
      message: "Save chapter successfully!", 
      chapter: newChapter 
    });

  } catch (error) {
    console.error("Error saving chapter to database:", error);
    res.status(500).json({ message: "Server error while saving data." });
  }
});

router.get('/api/manga', async (req: Request, res: Response): Promise<any> => {
  /* ... Paste ruột API Lấy danh sách toàn bộ Manga (Public) ... */
  try {
    const mangas = await prisma.manga.findMany({
      orderBy: { createdAt: 'desc' }, // Mới nhất lên đầu
      include: { _count: { select: { chapters: true } } }
    });
    res.status(200).json(mangas);
  } catch (error) {
    res.status(500).json({ message: "Lỗi server khi tải danh sách truyện." });
  }
});

router.get('/api/manga/:id', async (req: Request, res: Response): Promise<any> => {
  /* ... Paste ruột API Lấy chi tiết 1 Manga kèm danh sách Chapter ... */
  try {
    const id = req.params.id as string;
    const manga = await prisma.manga.findUnique({
      where: { id },
      include: {
        chapters: {
          orderBy: { createdAt: 'desc' } // Chương mới nhất lên đầu để user dễ theo dõi
        }
      }
    });

    if (!manga) return res.status(404).json({ message: "This series could not be found!" });
    res.status(200).json(manga);
  } catch (error) {
    res.status(500).json({ message: "Server error while loading series details." });
  }
});

router.get('/api/chapter/:chapterId', async (req: Request, res: Response): Promise<any> => {
  /* ... Paste ruột API Lấy chi tiết nội dung 1 Chapter (Bao gồm Next/Prev chapter) ... */
  try {
    const chapterId = req.params.chapterId as string;
    
    // 1. GIỮ NGUYÊN LOGIC CŨ: Tìm chương truyện và lấy kèm thông tin Manga
    const chapter = await prisma.chapter.findUnique({
      where: { id: chapterId },
      include: {
        manga: {
          select: { title: true } // Chỉ lấy tên truyện cho nhẹ
        }
      }
    });

    if (!chapter) return res.status(404).json({ message: "This chapter could not be found!" });
    
    // ==========================================
    // 2. PHẦN BỔ SUNG: Tìm ID của chương trước và chương sau
    // ==========================================
    
    // Lấy toàn bộ danh sách chương của bộ truyện này, sắp xếp theo thời gian tạo
    const allChapters = await prisma.chapter.findMany({
      where: { mangaId: chapter.mangaId },
      orderBy: { createdAt: 'asc' }, // Xếp từ cũ đến mới
      select: { id: true } // Chỉ lấy đúng ID ra để tính toán cho nhẹ Database
    });

    // Tìm vị trí (index) của chương hiện tại trong mảng
    const currentIndex = allChapters.findIndex(c => c.id === chapterId);

    // Lấy ID của chap trước và sau dựa trên index (nếu nằm ở rìa thì gán null)
   const prevChapterId = currentIndex > 0 ? allChapters[currentIndex - 1]?.id ?? null : null;
   const nextChapterId = currentIndex < allChapters.length - 1 ? allChapters[currentIndex + 1]?.id ?? null : null;
   
    // 3. Trả về cục data y hệt lúc trước, nhưng nhét thêm 2 biến mới vào
    res.status(200).json({
      ...chapter,
      prevChapterId,
      nextChapterId
    });
    
  } catch (error) {
    res.status(500).json({ message: "Lỗi server khi tải nội dung chương truyện." });
  }
});

// API: Quét ảnh và Dịch trang truyện Manga
router.post('/api/manga/translate-page', async (req: Request, res: Response): Promise<any> => {
  try {
    const { imageUrl, targetLang = "Vietnamese" } = req.body;

    if (!imageUrl) {
      return res.status(400).json({ message: "Thiếu link ảnh để dịch!" });
    }

    // ==========================================
    // 1. CƠ CHẾ CACHE: KIỂM TRA TRONG DATABASE TRƯỚC
    // ==========================================
    const cachedData = await prisma.translationCache.findUnique({
      where: {
        imageUrl_targetLang: {
          imageUrl: imageUrl,
          targetLang: targetLang
        }
      }
    });

    // Nếu đã có người dịch trang này ra ngôn ngữ này rồi -> Trả về lập tức!
    if (cachedData) {
      console.log("⚡ [CACHE HIT] Lấy bản dịch từ Database siêu tốc!");
      return res.status(200).json({ blocks: cachedData.blocks });
    }

    // ==========================================
    // 2. NẾU CHƯA CÓ CACHE (CACHE MISS): GỌI GEMINI AI
    // ==========================================
    console.log("🐢 [CACHE MISS] Chưa có dữ liệu, đang nhờ Gemini phân tích...");
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      return res.status(400).json({ message: "Không thể tải ảnh." });
    }

    // Biến ảnh thành Base64 để gửi cho Gemini
    const arrayBuffer = await imageResponse.arrayBuffer();
    const base64Image = Buffer.from(arrayBuffer).toString("base64");

    console.log("Đã tải ảnh, đang nhờ Gemini phân tích và dịch...");

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash",
      generationConfig: { responseMimeType: "application/json" } 
    });

    // PROMPT ĐẶC BIỆT DÀNH CHO BÀI TOÁN MANGA
    // Yêu cầu AI tìm bong bóng thoại, dịch, và trả về tọa độ [ymin, xmin, ymax, xmax] theo tỷ lệ 1000
    const prompt = `
      You are an expert manga translator and OCR vision AI.
      Analyze this manga page image. Find all speech bubbles and text elements.
      For each text element, provide:
      1. "translatedText": Translate the text into ${targetLang}. Keep the manga tone.
      2. "box": The bounding box coordinates of the text bubble in the format [ymin, xmin, ymax, xmax], where coordinates are normalized from 0 to 1000 (0 is top/left, 1000 is bottom/right).
      
      Return ONLY a valid JSON array. If no text is found, return [].
      Example format: [{"translatedText": "Chết tiệt!", "box": [150, 200, 300, 450]}]
    `;

    // Gửi CẢ câu lệnh VÀ bức ảnh cho Gemini
    const aiResult = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: base64Image,
          mimeType: "image/png" // Hoặc jpeg tùy ảnh của bạn
        }
      }
    ]);

    const resultText = aiResult.response.text();
    const blocks = JSON.parse(resultText);

    console.log("=== KẾT QUẢ GEMINI TRẢ VỀ ===");
    console.log("Tìm thấy số bong bóng thoại:", blocks.length);

    if (blocks.length === 0) {
      return res.status(200).json({ blocks: [] });
    }

    // Đổi tọa độ [ymin, xmin, ymax, xmax] (thang 1000) của Gemini sang dạng phần trăm (%)
    const finalBlocks = blocks.map((b: any) => {
      const [ymin, xmin, ymax, xmax] = b.box;
      return {
        translatedText: b.translatedText,
        // Chuyển sang phần trăm bằng cách chia cho 10
        topPercent: ymin / 10,
        leftPercent: xmin / 10,
        widthPercent: (xmax - xmin) / 10,
        heightPercent: (ymax - ymin) / 10
      };
    });

    // ==========================================
    // 3. LƯU KẾT QUẢ VÀO CACHE ĐỂ LẦN SAU DÙNG
    // ==========================================
    await prisma.translationCache.create({
      data: {
        imageUrl: imageUrl,
        targetLang: targetLang,
        // Prisma hỗ trợ lưu mảng JSON trực tiếp
        blocks: finalBlocks 
      }
    });

    console.log("💾 Đã lưu bản dịch mới vào Database!");

    res.status(200).json({ blocks: finalBlocks });

  } catch (error) {
    console.error("Lỗi AI Dịch:", error);
    res.status(500).json({ message: "Lỗi server khi quét và dịch ảnh." });
  }
});

// Lấy danh sách các Chapter của 1 bộ Manga để làm UI chọn liên kết
router.get('/api/admin/manga/:id/chapters', async (req: Request, res: Response): Promise<any> => {
  try {
    const mangaId = req.params.id as string;
    const chapters = await prisma.chapter.findMany({
      where: { mangaId: mangaId },
      select: { id: true, title: true }, // Chỉ lấy ID và Tên cho nhẹ server
      orderBy: { createdAt: 'asc' } // Hoặc sắp xếp theo title tùy bạn
    });
    
    res.status(200).json(chapters);
  } catch (error) {
    console.error("Lỗi lấy danh sách chapter:", error);
    res.status(500).json({ message: "Lỗi server khi tải chapters." });
  }
});



// API: Dùng AI viết tóm tắt Manga
router.post('/api/admin/generate-manga-desc', async (req: Request, res: Response): Promise<any> => {
  try {
    const { title } = req.body;

    if (!title) {
      return res.status(400).json({ message: "Vui lòng cung cấp tên truyện." });
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const prompt = `
      Bạn là một chuyên gia đánh giá Manga/Truyện tranh (Otaku chính hiệu).
      Hãy viết một đoạn tóm tắt nội dung hấp dẫn, tò mò và chính xác cho bộ manga có tên là "${title}".
      YÊU CẦU BẮT BUỘC:
      1. Viết bằng Tiếng Anh.
      2. Độ dài khoảng 3-4 câu (ngắn gọn, súc tích).
      3. Tuyệt đối KHÔNG tiết lộ nội dung quan trọng (No spoilers).
      4. Chỉ trả về văn bản tóm tắt, không giải thích gì thêm, không bọc trong markdown code block.
    `;

    const aiResult = await model.generateContent(prompt);
    const description = aiResult.response.text().trim();

    res.status(200).json({ description });

  } catch (error) {
    console.error("Lỗi AI viết tóm tắt Manga:", error);
    res.status(500).json({ message: "Lỗi server khi nhờ AI viết tóm tắt." });
  }
});

export default router;