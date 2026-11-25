import express, { Request, Response } from 'express';
import prisma from '../config/db'; // Nhúng DB dùng chung

const router = express.Router();

// ==========================================
// API Rating manga, anime
// ==========================================

// 1. Send or update Rating (Manga)
router.post('/api/rating', async (req: Request, res: Response): Promise<any> => {
  try {
    const { userId, mangaId, score } = req.body;
    if (!userId || !mangaId || !score) return res.status(400).json({ message: "Missing data!" });

    // Use upsert: If the user has already rated, update the rating; otherwise, create a new one.
    const rating = await prisma.rating.upsert({
      where: { userId_mangaId: { userId, mangaId } },
      update: { score },
      create: { userId, mangaId, score }
    });

    res.status(200).json({ message: "Thank you for your rating!", rating });
  } catch (error) {
    res.status(500).json({ message: "Server error while submitting rating." });
  }
});

// 2. Get the Rating Information for a manga series.
router.get('/api/rating/:mangaId', async (req: Request, res: Response): Promise<any> => {
  try {
    const mangaId = req.params.mangaId as string;
    const { userId } = req.query; // Get userId from Frontend (if the user is logged in))

    //The database calculates the average score (_avg) and the total number of reviews (_count).
    const aggregations = await prisma.rating.aggregate({
      _avg: { score: true },
      _count: { score: true },
      where: { mangaId }
    });

    // Round to 1 decimal place (e.g., 4.5). If no one has rated, default to 0.
    const average = aggregations._avg.score ? Number(aggregations._avg.score.toFixed(1)) : 0;
    const count = aggregations._count.score;

    // Retrieve the current user's rating (to highlight the star)
    let userScore = 0;
    if (userId) {
      const userRating = await prisma.rating.findUnique({
        where: { userId_mangaId: { userId: String(userId), mangaId } }
      });
      if (userRating) userScore = userRating.score;
    }

    res.status(200).json({ average, count, userScore });
  } catch (error) {
    console.error("Error fetching rating statistics:", error);
    res.status(500).json({ message: "Server error while fetching rating." });
  }
});

// 3. POST: Send or update Anime rating (Upsert)
router.post('/api/rating/anime', async (req: Request, res: Response): Promise<any> => {
  try {
    const { userId, animeId, score } = req.body;
    if (!userId || !animeId || !score) return res.status(400).json({ message: "Missing data" });

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

// 4. GET: Get the average score and the current user's rating for an anime
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
    res.status(500).json({ message: "Error loading rating information" });
  }
});


// ==========================================
// API COMMENTS FOR SHARED USE (MANGA, CHAPTER, ANIME, EPISODE)
// ==========================================

// 1. GET COMMENT LIST
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
    res.status(500).json({ message: "Error fetching comments" });
  }
});

// 2. Send new comment (Manga, Chapter, Anime, Episode)
router.post('/api/comments', async (req: Request, res: Response): Promise<any> => {
  try {
    const { userId, content, mangaId, chapterId, animeId, episodeId } = req.body;

    if (!userId || !content || (!mangaId && !chapterId && !animeId && !episodeId)) {
      return res.status(400).json({ message: "Missing required data" });
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
    res.status(500).json({ message: "Error posting comment" });
  }
});


// ==========================================
// API manage Reading List (Manga) for Users
// ==========================================

// 1. Check Reading List status
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
    res.status(500).json({ message: "Error checking reading list status." });
  }
});

// 2. Toggle Reading List status
router.post('/api/reading-list/toggle', async (req: Request, res: Response): Promise<any> => {
  try {
    const { userId, mangaId } = req.body;

    if (!userId || !mangaId) {
      return res.status(400).json({ message: "Missing User ID or Manga ID!" });
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
      return res.status(200).json({ isInList: false, message: "Removed from reading list!" });
    } else {
      await prisma.readingList.create({
        data: { userId, mangaId }
      });
      return res.status(201).json({ isInList: true, message: "Added to reading list!" });
    }
  } catch (error) {
    console.error("Toggle reading list error:", error);
    res.status(500).json({ message: "Server error while updating the reading list." });
  }
});

// 3. Get the entire reading list for a user
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
    console.error("Error loading reading list:", error);
    res.status(500).json({ message: "Server error when loading reading list." });
  }
});


// ==========================================
// API WATCHLIST (ANIME) FOR USERS
// ==========================================

// 1. POST:Toggle Anime (Add or Remove)
router.post('/api/watchlist/toggle', async (req: Request, res: Response): Promise<any> => {
  try {
    const { userId, animeId } = req.body;
    if (!userId || !animeId) return res.status(400).json({ message: "Missing data" });

    const existingItem = await prisma.watchList.findUnique({
      where: { userId_animeId: { userId, animeId } }
    });

    if (existingItem) {
      await prisma.watchList.delete({ where: { id: existingItem.id } });
      res.status(200).json({ isInList: false, message: "Removed from watch list!" });
    } else {
      await prisma.watchList.create({ data: { userId, animeId } });
      res.status(200).json({ isInList: true, message: "Added to watch list!" });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error while updating the watch list." });
  }
});

// 2. GET: Check the current status of the watchlist
router.get('/api/watchlist/status', async (req: Request, res: Response): Promise<any> => {
  try {
    const userId = req.query.userId as string;
    const animeId = req.query.animeId as string;

    if (!userId || !animeId) return res.status(400).json({ message: "Missing data" });

    const existingItem = await prisma.watchList.findUnique({
      where: { userId_animeId: { userId, animeId } }
    });

    res.status(200).json({ isInList: !!existingItem });
  } catch (error) {
    res.status(500).json({ message: "Server error when checking watchlist status." });
  }
});

// 3. GET: Get the entire watchlist for a user
router.get('/api/watchlist/:userId', async (req: Request, res: Response): Promise<any> => {
  try {
    const userId = req.params.userId as string;
    if (!userId) return res.status(400).json({ message: "Missing user ID" });

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
    console.error("Error loading watchlist:", error);
    res.status(500).json({ message: "Server error when loading watchlist." });
  }
});


// ==========================================
// API History
// ==========================================

// 1. POST: Record Manga Reading History
router.post('/api/history/manga', async (req: Request, res: Response): Promise<any> => {
  try {
    const { userId, mangaId, chapterId } = req.body;
    if (!userId || !mangaId || !chapterId) return res.status(400).json({ message: "Missing data" });

    await prisma.mangaHistory.upsert({
      where: { userId_mangaId: { userId, mangaId } },
      update: { chapterId, updatedAt: new Date() },
      create: { userId, mangaId, chapterId }
    });

    res.status(200).json({ message: "Reading history saved!" });
  } catch (error) {
    console.error("Error saving history:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// 2. POST: Record or update Anime viewing history
router.post('/api/history/anime', async (req: Request, res: Response): Promise<any> => {
  try {
    const { userId, animeId, episodeId } = req.body;

    if (!userId || !animeId || !episodeId) {
      return res.status(400).json({ message: "Missing information (userId, animeId, episodeId)" });
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

    res.status(200).json({ message: "Viewing history saved!", history: savedHistory });
  } catch (error) {
    console.error("Error saving Anime history:", error);
    res.status(500).json({ message: "Server error when saving history" });
  }
});

// 3. Get History List for a User (Displayed in Profile)
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
      take: 20 
    });

    const animeHistory = await prisma.animeHistory.findMany({
      where: { userId },
      include: {
        anime: { select: { id: true, title: true, coverImage: true } },
        episode: { select: { id: true, title: true } }
      },
      orderBy: { updatedAt: 'desc' },
      take: 20 
    });

    res.status(200).json({ mangaHistory, animeHistory });
  } catch (error) {
    console.error("Error loading history:", error);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;