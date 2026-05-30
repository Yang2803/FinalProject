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

// 2. API: Tạo tập phim mới kèm theo mảng phụ đề tương ứng
router.post('/api/admin/episode', async (req: Request, res: Response): Promise<any> => {
  try {
    const { animeId, title, videoUrl, subtitles } = req.body;

    if (!animeId || !title || !videoUrl) {
      return res.status(400).json({ message: "Vui lòng điền đủ thông tin bắt buộc!" });
    }

    // Tiến hành lưu thông tin tập phim và các phụ đề vào DB bằng cơ chế lồng dữ liệu (create Many)
    const newEpisode = await prisma.episode.create({
      data: {
        animeId,
        title,
        videoUrl,
        subtitles: {
          create: subtitles // Mảng object chứa { label, url } gửi từ Frontend lên
        }
      },
      include: { subtitles: true }
    });

    res.status(201).json({ message: "New episode uploaded successfully!", episode: newEpisode });
  } catch (error) {
    console.error("Lỗi đăng tập phim:", error);
    res.status(500).json({ message: "Lỗi server khi lưu tập phim." });
  }
});

// API: Đăng bộ Anime mới
router.post('/api/admin/anime', async (req: Request, res: Response): Promise<any> => {
  try {
    const { title, description, coverImage, author, status } = req.body;

    if (!title) {
      return res.status(400).json({ message: "Tên phim không được để trống!" });
    }

    const newAnime = await prisma.anime.create({
      data: {
        title,
        description,
        coverImage,
        // Nếu bạn đã thêm author và status vào schema.prisma thì bổ sung vào đây
        // author, 
        // status 
      }
    });

    res.status(201).json({ message: "New anime added successfully!", anime: newAnime });
  } catch (error) {
    console.error("Lỗi khi thêm Anime:", error);
    res.status(500).json({ message: "Lỗi server khi thêm phim mới." });
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

// 6. [THÊM MỚI] API: Chỉnh sửa thông tin phim (Sửa Tên, Mô tả, Ảnh bìa)
router.put('/api/admin/anime/:id', async (req: Request, res: Response): Promise<any> => {
  try {
    const animeId = req.params.id as string;
    const { title, description, coverImage } = req.body;

    if (!title) return res.status(400).json({ message: "The anime title cannot be empty!" });

    const updatedAnime = await prisma.anime.update({
      where: { id: animeId },
      data: { title, description, coverImage }
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

// 9. API: Cập nhật tập phim (Đổi tên hoặc Đổi link video)
router.put('/api/admin/episode/:id', async (req: Request, res: Response): Promise<any> => {
  try {
    const episodeId = req.params.id as string;
    const { title, videoUrl, newSubtitles } = req.body;

    const updatedEpisode = await prisma.episode.update({
      where: { id: episodeId },
      data: {
        title,
        ...(videoUrl && { videoUrl }) // Nếu có videoUrl mới gửi lên thì mới update trường này
      }
    });

    // 2. Xử lý phụ đề: Nếu Frontend có gửi mảng phụ đề mới lên -> Thay thế toàn bộ
    if (newSubtitles && newSubtitles.length > 0) {
      // Xóa sạch phụ đề cũ của tập này
      await prisma.subtitle.deleteMany({
        where: { episodeId: episodeId }
      });
      // Tạo các phụ đề mới
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

export default router;