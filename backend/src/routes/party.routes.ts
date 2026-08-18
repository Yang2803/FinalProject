import express, { Request, Response } from 'express';
import prisma from '../config/db';

const router = express.Router();

// 🌟 HÀM PHỤ TRỢ: Tạo mã mời ngẫu nhiên 6 ký tự (VD: A7X9KQ)
const generateInviteCode = () => {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
};

// ==========================================
// 🏠 1. API: TẠO PHÒNG WATCH PARTY MỚI
// ==========================================
router.post('/rooms', async (req: Request, res: Response): Promise<any> => {
  try {
    const { name, isPrivate, hostId, animeId, episodeId } = req.body;

    if (!name || !hostId) {
      return res.status(400).json({ message: "Thiếu tên phòng hoặc ID chủ phòng!" });
    }

    // Tạo mã mời độc nhất
    let inviteCode = generateInviteCode();
    let isUnique = false;
    while (!isUnique) {
      const existingRoom = await prisma.partyRoom.findUnique({ where: { inviteCode } });
      if (!existingRoom) isUnique = true;
      else inviteCode = generateInviteCode();
    }

    // Tạo phòng mới VÀ tự động thêm Trưởng phòng vào danh sách Member với trạng thái JOINED
    const newRoom = await prisma.partyRoom.create({
      data: {
        name,
        inviteCode,
        isPrivate: isPrivate || false,
        hostId,
        animeId: animeId || null,
        episodeId: episodeId || null,
        status: "ACTIVE",
        members: {
          create: {
            userId: hostId,
            status: "JOINED"
          }
        }
      },
      include: {
        anime: { select: { title: true, coverImage: true } },
        episode: { select: { title: true, episodeNumber: true } }
      }
    });

    res.status(201).json({ message: "Tạo phòng thành công!", room: newRoom });
  } catch (error) {
    console.error("Lỗi tạo phòng:", error);
    res.status(500).json({ message: "Lỗi server khi tạo phòng." });
  }
});

// ==========================================
// 🔍 2. API: LẤY THÔNG TIN PHÒNG (BẰNG MÃ MỜI)
// ==========================================
router.get('/rooms/:inviteCode', async (req: Request, res: Response): Promise<any> => {
  try {
    const inviteCode = req.params.inviteCode as string;
    
    const room = await prisma.partyRoom.findUnique({
      where: { inviteCode },
      include: {
        host: { select: { id: true, name: true} },
        anime: { select: { id: true, title: true } },
        episode: { 
          select: { 
            id: true, 
            title: true, 
            videoUrl: true,
            episodeNumber: true,
            dubbedLanguages: true, // Lấy mảng ngôn ngữ lồng tiếng có sẵn
            subtitles: {
              select: {
                id: true,
                label: true,
                url: true
              }
            }
          } 
        },
        
        // Chỉ lấy những thành viên ĐÃ ĐƯỢC DUYỆT (JOINED) để hiển thị danh sách trong phòng
        members: {
          include: { user: { select: { id: true, name: true} } }
        }
      }
    });

    if (!room) return res.status(404).json({ message: "Mã phòng không tồn tại hoặc phòng đã đóng!" });
    if (room.status === "CLOSED") return res.status(403).json({ message: "Phòng chiếu này đã kết thúc." });

    res.status(200).json(room);
  } catch (error) {
    res.status(500).json({ message: "Lỗi server khi tải thông tin phòng." });
  }
});

// ==========================================
// 🚪 3. API: XIN VÀO PHÒNG (JOIN REQUEST)
// ==========================================
router.post('/rooms/:inviteCode/join', async (req: Request, res: Response): Promise<any> => {
  try {
    const inviteCode = req.params.inviteCode as string;
    const { userId } = req.body;

    const room = await prisma.partyRoom.findUnique({ where: { inviteCode } });
    if (!room || room.status === "CLOSED") {
      return res.status(404).json({ message: "Phòng không tồn tại hoặc đã đóng." });
    }

    // Kiểm tra xem user này đã có trong phòng chưa
    const existingMember = await prisma.roomMember.findUnique({
      where: {
        roomId_userId: { roomId: room.id, userId: userId }
      }
    });

    if (existingMember) {
      if (existingMember.status === "BANNED") return res.status(403).json({ message: "Bạn đã bị cấm khỏi phòng này." });
      return res.status(200).json({ message: "Bạn đã ở trong phòng.", status: existingMember.status, room });
    }

    // QUYẾT ĐỊNH TRẠNG THÁI DỰA TRÊN LOẠI PHÒNG
    const memberStatus = room.isPrivate ? "PENDING" : "JOINED";

    await prisma.roomMember.create({
      data: {
        roomId: room.id,
        userId: userId,
        status: memberStatus
      }
    });

    if (memberStatus === "PENDING") {
      res.status(202).json({ message: "Đã gửi yêu cầu tham gia. Vui lòng đợi Trưởng phòng duyệt!", status: "PENDING" });
    } else {
      res.status(200).json({ message: "Vào phòng thành công!", status: "JOINED", room });
    }

  } catch (error) {
    console.error("Lỗi join phòng:", error);
    res.status(500).json({ message: "Lỗi server khi xin vào phòng." });
  }
});

// ==========================================
// 👑 4. API: TRƯỞNG PHÒNG DUYỆT / TỪ CHỐI THÀNH VIÊN
// ==========================================
router.put('/rooms/:roomId/approve', async (req: Request, res: Response): Promise<any> => {
  try {
    const roomId = req.params.roomId as string;

    const { hostId, targetUserId, action } = req.body; // action = "APPROVE" hoặc "REJECT"

    // Kiểm tra quyền Trưởng phòng
    const room = await prisma.partyRoom.findUnique({ where: { id: roomId } });
    if (!room || room.hostId !== hostId) {
      return res.status(403).json({ message: "Bạn không có quyền duyệt thành viên cho phòng này!" });
    }

    if (action === "APPROVE") {
      await prisma.roomMember.update({
        where: { roomId_userId: { roomId, userId: targetUserId } },
        data: { status: "JOINED" }
      });
      res.status(200).json({ message: "Đã duyệt thành viên thành công!" });
    } else {
      // Nếu Reject, ta có thể xóa luôn bản ghi yêu cầu hoặc đổi thành "BANNED" tùy logic của cậu
      await prisma.roomMember.delete({
        where: { roomId_userId: { roomId, userId: targetUserId } }
      });
      res.status(200).json({ message: "Đã từ chối thành viên." });
    }

  } catch (error) {
    res.status(500).json({ message: "Lỗi server khi duyệt thành viên." });
  }
});

// ==========================================
// 🔄 5. API: TRƯỞNG PHÒNG ĐỔI PHIM / ĐỔI TẬP
// ==========================================
router.put('/rooms/:roomId/change-video', async (req: Request, res: Response): Promise<any> => {
  try {
    const roomId = String(req.params.roomId);
    const { hostId, animeId, episodeId } = req.body;

    const room = await prisma.partyRoom.findUnique({ where: { id: roomId } });
    
    if (!room || room.hostId !== hostId) {
      return res.status(403).json({ message: "Chỉ Trưởng phòng mới có quyền đổi phim!" });
    }

    const updatedRoom = await prisma.partyRoom.update({
      where: { id: roomId },
      data: { animeId, episodeId }
    });

    res.status(200).json({ message: "Đã chuyển phim thành công!", room: updatedRoom });
  } catch (error) {
    console.error("Lỗi đổi phim:", error);
    res.status(500).json({ message: "Lỗi server khi đổi phim." });
  }
});

// ==========================================
// 🗑️ 6. API: GIẢI TÁN PHÒNG CHIẾU
// ==========================================
router.delete('/rooms/:roomId', async (req: Request, res: Response) => {
  try {
    const roomId = String(req.params.roomId);
    await prisma.partyRoom.delete({ where: { id: roomId } });
    res.status(200).json({ message: "Phòng chiếu đã được giải tán thành công!" });
  } catch (error) {
    console.error("Lỗi khi giải tán phòng:", error);
    res.status(500).json({ message: "Lỗi server khi giải tán phòng." });
  }
});

export default router;