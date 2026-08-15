import express, { Request, Response } from 'express';
import prisma from '../config/db';

const router = express.Router();


// 1. Lấy danh sách thông báo & đếm số lượng chưa đọc
router.get('/api/notifications/:userId', async (req: Request, res: Response): Promise<any> => {
  try {
    const userId = req.params.userId as string;
    const notifications = await prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    });
    
    // Đếm số lượng chưa đọc
    const unreadCount = notifications.filter(n => !n.isRead).length;

    res.status(200).json({ notifications, unreadCount });
  } catch (error) {
    res.status(500).json({ error: "Lỗi tải thông báo" });
  }
});

// 2. Đánh dấu TẤT CẢ thông báo là đã đọc (Gọi khi user vào trang /notifications)
router.put('/api/notifications/:userId/read', async (req: Request, res: Response): Promise<any> => {
  try {
    const userId = req.params.userId as string;
    await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true }
    });
    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Lỗi cập nhật thông báo" });
  }
});

export default router;