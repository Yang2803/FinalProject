import express, { Request, Response } from 'express';
import prisma from '../config/db';

const router = express.Router();

router.get('/api/search', async (req: Request, res: Response) => {
  try {
    const query = req.query.q as string;

    if (!query || query.length < 2) {
      return res.status(200).json({ animes: [], mangas: [] });
    }

    // Tìm kiếm đồng thời trong cả 2 bảng bằng Promise.all để tối ưu tốc độ
    const [animes, mangas] = await Promise.all([
      prisma.anime.findMany({
        where: {
          title: { contains: query, mode: 'insensitive' } // insensitive: Không phân biệt hoa thường
        },
        select: { id: true, title: true, coverImage: true, description: true }
      }),
      prisma.manga.findMany({
        where: {
          title: { contains: query, mode: 'insensitive' }
        },
        select: { id: true, title: true, coverImage: true, description: true }
      })
    ]);

    res.status(200).json({ animes, mangas });
  } catch (error) {
    res.status(500).json({ message: "Lỗi tìm kiếm" });
  }
});

export default router;