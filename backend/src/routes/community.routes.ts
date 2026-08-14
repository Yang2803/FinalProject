import express, { Request, Response } from 'express';
import prisma from '../config/db';

const router = express.Router();

// 1. TẠO COMMUNITY MỚI
router.post('/api/communities', async (req: Request, res: Response): Promise<any> => {
  try {
    const { name, description, coverImage, creatorId } = req.body;
    
    // Kiểm tra tên trùng
    const existing = await prisma.community.findUnique({ where: { name } });
    if (existing) return res.status(400).json({ error: "Tên cộng đồng đã tồn tại!" });

    const community = await prisma.community.create({
      data: {
        name, description, coverImage, creatorId,
        members: { connect: { id: creatorId } } // Tự động cho người tạo làm thành viên luôn
      }
    });
    res.status(201).json(community);
  } catch (error) { res.status(500).json({ error: "Lỗi tạo cộng đồng" }); }
});

// 2. LẤY DANH SÁCH TẤT CẢ CỘNG ĐỒNG (Kèm số lượng thành viên)
router.get('/api/communities', async (req: Request, res: Response): Promise<any> => {
  try {
    const communities = await prisma.community.findMany({
      include: {
        _count: { select: { members: true, posts: true } },
        members: { select: { id: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.status(200).json(communities);
  } catch (error) { res.status(500).json({ error: "Lỗi tải danh sách cộng đồng" }); }
});

// 3. XEM CHI TIẾT 1 CỘNG ĐỒNG (Kèm danh sách bài viết)
router.get('/api/communities/:id', async (req: Request, res: Response): Promise<any> => {
  try {
    const community = await prisma.community.findUnique({
      where: { id: req.params.id as string },
      include: {
        members: { select: { id: true, name: true} },
        posts: {
          orderBy: { createdAt: 'desc' },
          include: { author: { select: { name: true } } }
        },
        _count: { select: { members: true } }
      }
    });
    if (!community) return res.status(404).json({ error: "Không tìm thấy cộng đồng" });
    res.status(200).json(community);
  } catch (error) { res.status(500).json({ error: "Lỗi tải dữ liệu cộng đồng" }); }
});

// 4. THAM GIA / RỜI KHỎI CỘNG ĐỒNG (Nút Join/Leave)
router.post('/api/communities/:id/join', async (req: Request, res: Response): Promise<any> => {
  try {
    const communityId = req.params.id as string;
    const { userId } = req.body;

    const community = await prisma.community.findUnique({
      where: { id: communityId },
      include: { members: { where: { id: userId } } }
    });

    if (!community) return res.status(404).json({ error: "Không tìm thấy cộng đồng" });

    const isMember = community.members.length > 0;

    if (isMember) {
      // Đã tham gia -> Bấm để Rời
      await prisma.community.update({
        where: { id: communityId },
        data: { members: { disconnect: { id: userId } } }
      });
      res.status(200).json({ message: "Đã rời nhóm", joined: false });
    } else {
      // Chưa tham gia -> Bấm để Tham gia
      await prisma.community.update({
        where: { id: communityId },
        data: { members: { connect: { id: userId } } }
      });
      res.status(200).json({ message: "Đã tham gia nhóm", joined: true });
    }
  } catch (error) { res.status(500).json({ error: "Lỗi xử lý tham gia" }); }
});

// 5. CẬP NHẬT THÔNG TIN CỘNG ĐỒNG (Chỉ Admin)
router.put('/api/communities/:id', async (req: Request, res: Response): Promise<any> => {
  try {
    const communityId = req.params.id as string;
    const { name, description, coverImage, userId } = req.body;

    const community = await prisma.community.findUnique({ where: { id: communityId } });
    if (!community) return res.status(404).json({ error: "Không tìm thấy cộng đồng" });
    
    // Kiểm tra quyền Admin (Chỉ người tạo mới được sửa)
    if (community.creatorId !== userId) return res.status(403).json({ error: "Không có quyền chỉnh sửa!" });

    // Kiểm tra trùng tên (nếu Admin đổi tên mới)
    if (name !== community.name) {
      const existing = await prisma.community.findUnique({ where: { name } });
      if (existing) return res.status(400).json({ error: "Tên cộng đồng đã tồn tại!" });
    }

    const updatedCommunity = await prisma.community.update({
      where: { id: communityId },
      data: { name, description, coverImage },
      include: {
        members: { select: { id: true, name: true } },
        posts: { orderBy: { createdAt: 'desc' }, include: { author: { select: { name: true } } } },
        _count: { select: { members: true } }
      }
    });

    res.status(200).json(updatedCommunity);
  } catch (error) { 
    console.error("LỖI SỬA COMMUNITY:", error);
    res.status(500).json({ error: "Lỗi cập nhật cộng đồng" }); 
  }
});

export default router;