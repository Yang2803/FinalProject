import express, { Request, Response } from 'express';
import prisma from '../config/db'; // Nhúng DB dùng chung

const router = express.Router();

// ==========================================
// API ĐÁNH GIÁ (RATING)
// ==========================================

// 1. Gửi hoặc Cập nhật Rating (Manga)
router.post('/api/rating', async (req: Request, res: Response): Promise<any> => {
  try {
    const { userId, mangaId, score } = req.body;
    if (!userId || !mangaId || !score) return res.status(400).json({ message: "Thiếu dữ liệu!" });

    // Dùng upsert: Nếu user đã rate rồi thì update điểm mới, chưa thì tạo mới
    const rating = await prisma.rating.upsert({
      where: { userId_mangaId: { userId, mangaId } },
      update: { score },
      create: { userId, mangaId, score }
    });

    res.status(200).json({ message: "Cảm ơn bạn đã đánh giá!", rating });
  } catch (error) {
    res.status(500).json({ message: "Lỗi server khi đánh giá." });
  }
});

// 2. Lấy thông tin Rating của 1 truyện Manga
router.get('/api/rating/:mangaId', async (req: Request, res: Response): Promise<any> => {
  try {
    const mangaId = req.params.mangaId as string;
    const { userId } = req.query; // Nhận userId từ Frontend (nếu user đã đăng nhập)

    // Nhờ DB tính điểm trung bình (_avg) và tổng số lượt đánh giá (_count)
    const aggregations = await prisma.rating.aggregate({
      _avg: { score: true },
      _count: { score: true },
      where: { mangaId }
    });

    // Làm tròn 1 chữ số thập phân (VD: 4.5). Nếu chưa ai đánh giá thì mặc định là 0.
    const average = aggregations._avg.score ? Number(aggregations._avg.score.toFixed(1)) : 0;
    const count = aggregations._count.score;

    // Phục hồi điểm của User hiện tại (Để tô vàng lại ngôi sao)
    let userScore = 0;
    if (userId) {
      const userRating = await prisma.rating.findUnique({
        where: { userId_mangaId: { userId: String(userId), mangaId } }
      });
      if (userRating) userScore = userRating.score;
    }

    res.status(200).json({ average, count, userScore });
  } catch (error) {
    console.error("Lỗi tải thống kê rating:", error);
    res.status(500).json({ message: "Lỗi server khi tải rating." });
  }
});

// 3. POST: Gửi hoặc Cập nhật đánh giá Anime (Upsert)
router.post('/api/rating/anime', async (req: Request, res: Response): Promise<any> => {
  try {
    const { userId, animeId, score } = req.body;
    if (!userId || !animeId || !score) return res.status(400).json({ message: "Thiếu dữ liệu" });

    const rating = await prisma.animeRating.upsert({
      where: {
        userId_animeId: { userId, animeId }
      },
      update: { score },
      create: { userId, animeId, score }
    });

    res.status(200).json({ message: "Rating submitted successfully", rating });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error saving rating" });
  }
});

// 4. GET: Lấy điểm trung bình và điểm Anime của User hiện tại
router.get('/api/rating/anime/:id', async (req: Request, res: Response) => {
  try {
    const animeId = req.params.id as string;
    const userId = req.query.userId as string | undefined;

    const aggregations = await prisma.animeRating.aggregate({
      _avg: { score: true },
      _count: { score: true },
      where: { animeId }
    });

    let userScore = 0;
    if (userId) {
      const userRating = await prisma.animeRating.findUnique({
        where: { userId_animeId: { userId, animeId } }
      });
      if (userRating) userScore = userRating.score;
    }

    res.status(200).json({
      average: aggregations._avg.score ? Number(aggregations._avg.score.toFixed(1)) : 0,
      count: aggregations._count.score,
      userScore
    });
  } catch (error) {
    res.status(500).json({ message: "Lỗi tải thông tin đánh giá" });
  }
});


// ==========================================
// API BÌNH LUẬN DÙNG CHUNG (MANGA, CHAPTER, ANIME, EPISODE)
// ==========================================

// 1. LẤY DANH SÁCH BÌNH LUẬN
router.get('/api/comments', async (req: Request, res: Response) => {
  try {
    const { mangaId, chapterId, animeId, episodeId } = req.query;

    const whereClause: any = {};
    if (mangaId) whereClause.mangaId = mangaId as string;
    if (chapterId) whereClause.chapterId = chapterId as string;
    if (animeId) whereClause.animeId = animeId as string;
    if (episodeId) whereClause.episodeId = episodeId as string;

    const comments = await prisma.comment.findMany({
      where: whereClause,
      include: { user: { select: { name: true, email: true } } },
      orderBy: { createdAt: 'desc' }
    });
    res.status(200).json(comments);
  } catch (error) {
    res.status(500).json({ message: "Lỗi tải bình luận" });
  }
});

// 2. GỬI BÌNH LUẬN MỚI
router.post('/api/comments', async (req: Request, res: Response): Promise<any> => {
  try {
    const { userId, content, mangaId, chapterId, animeId, episodeId } = req.body;

    if (!userId || !content || (!mangaId && !chapterId && !animeId && !episodeId)) {
      return res.status(400).json({ message: "Thiếu dữ liệu bắt buộc" });
    }

    const newComment = await prisma.comment.create({
      data: {
        userId,
        content,
        mangaId,
        chapterId,
        animeId,
        episodeId
      },
      include: { user: { select: { name: true, email: true } } }
    });

    res.status(201).json(newComment);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Lỗi đăng bình luận" });
  }
});


// ==========================================
// API QUẢN LÝ DANH SÁCH ĐỌC (READING LIST)
// ==========================================

// 1. Kiểm tra trạng thái Reading List
router.get('/api/reading-list/status', async (req: Request, res: Response): Promise<any> => {
  try {
    const userId = req.query.userId as string;
    const mangaId = req.query.mangaId as string;

    if (!userId || !mangaId) {
      return res.status(450).json({ isInList: false });
    }

    const item = await prisma.readingList.findUnique({
      where: {
        userId_mangaId: { userId, mangaId }
      }
    });

    res.status(200).json({ isInList: !!item });
  } catch (error) {
    res.status(500).json({ message: "Lỗi kiểm tra danh sách đọc." });
  }
});

// 2. Toggle trạng thái Reading List
router.post('/api/reading-list/toggle', async (req: Request, res: Response): Promise<any> => {
  try {
    const { userId, mangaId } = req.body;

    if (!userId || !mangaId) {
      return res.status(400).json({ message: "Thiếu thông tin User ID hoặc Manga ID!" });
    }

    const existingItem = await prisma.readingList.findUnique({
      where: {
        userId_mangaId: { userId, mangaId }
      }
    });

    if (existingItem) {
      await prisma.readingList.delete({
        where: {
          userId_mangaId: { userId, mangaId }
        }
      });
      return res.status(200).json({ isInList: false, message: "Đã xóa khỏi danh sách đọc!" });
    } else {
      await prisma.readingList.create({
        data: { userId, mangaId }
      });
      return res.status(201).json({ isInList: true, message: "Đã thêm vào danh sách đọc!" });
    }
  } catch (error) {
    console.error("Lỗi toggle reading list:", error);
    res.status(500).json({ message: "Lỗi server khi cập nhật danh sách đọc." });
  }
});

// 3. Lấy toàn bộ danh sách truyện trong Reading List của một User
router.get('/api/reading-list/:userId', async (req: Request, res: Response): Promise<any> => {
  try {
    const userId = req.params.userId as string;

    const readingList = await prisma.readingList.findMany({
      where: { userId },
      include: {
        manga: true 
      },
      orderBy: { createdAt: 'desc' }
    });

    const mangas = readingList.map(item => item.manga);
    res.status(200).json(mangas);
  } catch (error) {
    console.error("Lỗi tải Reading List:", error);
    res.status(500).json({ message: "Lỗi server khi tải danh sách đọc." });
  }
});


// ==========================================
// API WATCHLIST (DANH SÁCH XEM ANIME)
// ==========================================

// 1. POST: Bật/Tắt danh sách xem (Toggle)
router.post('/api/watchlist/toggle', async (req: Request, res: Response): Promise<any> => {
  try {
    const { userId, animeId } = req.body;
    if (!userId || !animeId) return res.status(400).json({ message: "Thiếu dữ liệu" });

    const existingItem = await prisma.watchList.findUnique({
      where: { userId_animeId: { userId, animeId } }
    });

    if (existingItem) {
      await prisma.watchList.delete({ where: { id: existingItem.id } });
      res.status(200).json({ isInList: false, message: "Đã xóa khỏi danh sách xem" });
    } else {
      await prisma.watchList.create({ data: { userId, animeId } });
      res.status(200).json({ isInList: true, message: "Đã thêm vào danh sách xem" });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Lỗi thao tác danh sách xem" });
  }
});

// 2. GET: Kiểm tra trạng thái hiện tại Watchlist
router.get('/api/watchlist/status', async (req: Request, res: Response): Promise<any> => {
  try {
    const userId = req.query.userId as string;
    const animeId = req.query.animeId as string;

    if (!userId || !animeId) return res.status(400).json({ message: "Thiếu dữ liệu" });

    const existingItem = await prisma.watchList.findUnique({
      where: { userId_animeId: { userId, animeId } }
    });

    res.status(200).json({ isInList: !!existingItem });
  } catch (error) {
    res.status(500).json({ message: "Lỗi kiểm tra trạng thái" });
  }
});

// 3. GET: Lấy toàn bộ danh sách xem của 1 User
router.get('/api/watchlist/:userId', async (req: Request, res: Response): Promise<any> => {
  try {
    const userId = req.params.userId as string;
    if (!userId) return res.status(400).json({ message: "Thiếu ID người dùng" });

    const watchlists = await prisma.watchList.findMany({
      where: { userId: userId },
      include: {
        anime: {
          include: {
            _count: { select: { episodes: true } }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.status(200).json(watchlists);
  } catch (error) {
    console.error("Lỗi lấy danh sách xem:", error);
    res.status(500).json({ message: "Lỗi máy chủ khi tải danh sách" });
  }
});


// ==========================================
// API LỊCH SỬ HOẠT ĐỘNG (HISTORY)
// ==========================================

// 1. Ghi nhận lịch sử đọc Manga
router.post('/api/history/manga', async (req: Request, res: Response): Promise<any> => {
  try {
    const { userId, mangaId, chapterId } = req.body;
    if (!userId || !mangaId || !chapterId) return res.status(400).json({ message: "Thiếu dữ liệu" });

    await prisma.mangaHistory.upsert({
      where: { userId_mangaId: { userId, mangaId } },
      update: { chapterId, updatedAt: new Date() },
      create: { userId, mangaId, chapterId }
    });

    res.status(200).json({ message: "Đã lưu lịch sử đọc" });
  } catch (error) {
    console.error("Lỗi lưu lịch sử:", error);
    res.status(500).json({ message: "Lỗi server" });
  }
});

// 2. POST: Lưu hoặc cập nhật lịch sử xem Anime
router.post('/api/history/anime', async (req: Request, res: Response): Promise<any> => {
  try {
    const { userId, animeId, episodeId } = req.body;

    if (!userId || !animeId || !episodeId) {
      return res.status(400).json({ message: "Thiếu thông tin (userId, animeId, episodeId)" });
    }

    const savedHistory = await prisma.animeHistory.upsert({
      where: {
        userId_animeId: {
          userId: userId,
          animeId: animeId,
        }
      },
      update: {
        episodeId: episodeId
      },
      create: {
        userId,
        animeId,
        episodeId
      }
    });

    res.status(200).json({ message: "Đã lưu lịch sử xem", history: savedHistory });
  } catch (error) {
    console.error("Lỗi lưu lịch sử Anime:", error);
    res.status(500).json({ message: "Lỗi máy chủ khi lưu lịch sử" });
  }
});

// 3. Lấy danh sách Lịch sử của User (Hiển thị ở Profile)
router.get('/api/history/:userId', async (req: Request, res: Response): Promise<any> => {
  try {
    const userId = req.params.userId as string;

    const mangaHistory = await prisma.mangaHistory.findMany({
      where: { userId },
      include: {
        manga: { select: { id: true, title: true, coverImage: true } },
        chapter: { select: { id: true, title: true } }
      },
      orderBy: { updatedAt: 'desc' },
      take: 5 
    });

    const animeHistory = await prisma.animeHistory.findMany({
      where: { userId },
      include: {
        anime: { select: { id: true, title: true, coverImage: true } },
        episode: { select: { id: true, title: true } }
      },
      orderBy: { updatedAt: 'desc' },
      take: 5 
    });

    res.status(200).json({ mangaHistory, animeHistory });
  } catch (error) {
    console.error("Lỗi lấy lịch sử:", error);
    res.status(500).json({ message: "Lỗi server" });
  }
});

export default router;