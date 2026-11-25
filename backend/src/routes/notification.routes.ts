import express, { Request, Response } from 'express';
import prisma from '../config/db';

const router = express.Router();


// 1. Get the list of notifications and count the number of unread notifications.
router.get('/api/notifications/:userId', async (req: Request, res: Response): Promise<any> => {
  try {
    const userId = req.params.userId as string;
    const notifications = await prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    });
    
    // Count the number of unread notifications
    const unreadCount = notifications.filter(n => !n.isRead).length;

    res.status(200).json({ notifications, unreadCount });
  } catch (error) {
    res.status(500).json({ error: "Error loading notifications" });
  }
});

// 2. Mark ALL notifications as read (Called when user visits the /notifications page)
router.put('/api/notifications/:userId/read', async (req: Request, res: Response): Promise<any> => {
  try {
    const userId = req.params.userId as string;
    await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true }
    });
    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Error updating notifications" });
  }
});

export default router;