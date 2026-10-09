import express, { Request, Response } from 'express';
import prisma from '../config/db';
import { AccessToken } from 'livekit-server-sdk';

const router = express.Router();

// 🌟 HÀM PHỤ TRỢ: Tạo mã mời ngẫu nhiên 6 ký tự (VD: MG7K9Q)
const generateInviteCode = (): string => {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
};

// ==========================================
// 🏠 1. API: TẠO PHÒNG MANGA CO-READING MỚI
// ==========================================
router.post('/rooms', async (req: Request, res: Response): Promise<any> => {
  try {
    const { name, isPrivate, hostId, mangaId, chapterId } = req.body;

    if (!name || !hostId) {
      return res.status(400).json({ message: "Thiếu tên phòng hoặc ID chủ phòng!" });
    }

    let inviteCode = generateInviteCode();
    let isUnique = false;
    while (!isUnique) {
      const existingRoom = await prisma.mangaCoRoom.findUnique({ where: { inviteCode } });
      if (!existingRoom) isUnique = true;
      else inviteCode = generateInviteCode();
    }

    const newRoom = await prisma.mangaCoRoom.create({
      data: {
        name,
        inviteCode,
        isPrivate: Boolean(isPrivate),
        hostId,
        mangaId: mangaId || null,
        chapterId: chapterId || null,
        members: {
          create: {
            userId: hostId,
            status: "JOINED"
          }
        }
      },
      include: {
        host: { select: { id: true, name: true, image: true } }
      }
    });

    return res.status(201).json({ message: "Tạo phòng đọc thành công!", room: newRoom });
  } catch (error) {
    console.error("Lỗi tạo phòng manga:", error);
    return res.status(500).json({ message: "Lỗi server khi tạo phòng manga." });
  }
});

// ==========================================
// 🔍 2. API: LẤY THÔNG TIN PHÒNG (BẰNG MÃ MỜI HOẶC ID)
// ==========================================
router.get('/rooms/:inviteCode', async (req: Request, res: Response): Promise<any> => {
  try {
    const inviteCodeParam = String(req.params.inviteCode || "");
    const inviteCode = inviteCodeParam.toUpperCase();

    const room = await prisma.mangaCoRoom.findFirst({
      where: {
        OR: [
          { inviteCode },
          { id: inviteCodeParam }
        ]
      },
      include: {
        host: { select: { id: true, name: true, image: true } },
        members: {
          where: { status: 'JOINED' },
          include: {
            user: { select: { id: true, name: true, image: true } }
          }
        }
      }
    });

    if (!room) {
      return res.status(404).json({ message: "Mã phòng không tồn tại hoặc phòng đã đóng!" });
    }

    return res.status(200).json(room);
  } catch (error) {
    console.error("Lỗi tải thông tin phòng manga:", error);
    return res.status(500).json({ message: "Lỗi server khi tải thông tin phòng manga." });
  }
});

// ==========================================
// 🚪 3. API: XIN VÀO PHÒNG (JOIN REQUEST)
// ==========================================
router.post('/rooms/:inviteCode/join', async (req: Request, res: Response): Promise<any> => {
  try {
    const inviteCodeParam = String(req.params.inviteCode || "");
    const inviteCode = inviteCodeParam.toUpperCase();
    const { userId } = req.body;

    const room = await prisma.mangaCoRoom.findFirst({
      where: {
        OR: [
          { inviteCode },
          { id: inviteCodeParam }
        ]
      }
    });

    if (!room) {
      return res.status(404).json({ message: "Phòng đọc không tồn tại." });
    }

    if (room.hostId === userId) {
      return res.status(200).json({ message: "Trưởng phòng được vào thẳng.", status: "JOINED", room });
    }

    const existingMember = await prisma.mangaCoMember.findUnique({
      where: {
        roomId_userId: { roomId: room.id, userId: userId }
      }
    });

    if (existingMember) {
      if (existingMember.status === "BANNED") {
        return res.status(403).json({ message: "Bạn đã bị cấm khỏi phòng đọc này." });
      }

      if (existingMember.status === "REJECTED") {
        const newStatus = room.isPrivate ? "PENDING" : "JOINED";
        await prisma.mangaCoMember.update({
          where: { id: existingMember.id },
          data: { status: newStatus }
        });
        return res.status(newStatus === "PENDING" ? 202 : 200).json({
          message: newStatus === "PENDING" ? "Đã gửi lại yêu cầu tham gia." : "Vào phòng thành công!",
          status: newStatus,
          room
        });
      }

      return res.status(200).json({ message: "Bạn đã ở trong phòng.", status: existingMember.status, room });
    }

    const memberStatus = room.isPrivate ? "PENDING" : "JOINED";
    await prisma.mangaCoMember.create({
      data: {
        roomId: room.id,
        userId: userId,
        status: memberStatus
      }
    });

    if (memberStatus === "PENDING") {
      return res.status(202).json({ message: "Đã gửi yêu cầu tham gia. Vui lòng đợi Trưởng phòng duyệt!", status: "PENDING" });
    } else {
      return res.status(200).json({ message: "Vào phòng thành công!", status: "JOINED", room });
    }
  } catch (error) {
    console.error("Lỗi join phòng manga:", error);
    return res.status(500).json({ message: "Lỗi server khi xin vào phòng đọc." });
  }
});

// ==========================================
// 👑 4. API: TRƯỞNG PHÒNG DUYỆT / TỪ CHỐI THÀNH VIÊN
// ==========================================
router.put('/rooms/:roomId/approve', async (req: Request, res: Response): Promise<any> => {
  try {
    const roomId = String(req.params.roomId);
    const { hostId, targetUserId, action } = req.body;

    const room = await prisma.mangaCoRoom.findUnique({ where: { id: roomId } });
    if (!room || room.hostId !== hostId) {
      return res.status(403).json({ message: "Bạn không có quyền duyệt thành viên cho phòng này!" });
    }

    if (action === "APPROVE") {
      await prisma.mangaCoMember.update({
        where: { roomId_userId: { roomId, userId: targetUserId } },
        data: { status: "JOINED" }
      });
      return res.status(200).json({ message: "Đã duyệt thành viên thành công!" });
    } else {
      await prisma.mangaCoMember.update({
        where: { roomId_userId: { roomId, userId: targetUserId } },
        data: { status: "REJECTED" }
      });
      return res.status(200).json({ message: "Đã từ chối thành viên." });
    }
  } catch (error) {
    return res.status(500).json({ message: "Lỗi server khi duyệt thành viên." });
  }
});

// ==========================================
// 🔄 5. API: TRƯỞNG PHÒNG ĐỔI MANGA / ĐỔI CHƯƠNG ĐỌC
// ==========================================
router.put('/rooms/:roomId/change-chapter', async (req: Request, res: Response): Promise<any> => {
  try {
    const roomId = String(req.params.roomId);
    const { hostId, mangaId, chapterId } = req.body;

    const room = await prisma.mangaCoRoom.findUnique({ where: { id: roomId } });
    if (!room || room.hostId !== hostId) {
      return res.status(403).json({ message: "Chỉ Trưởng phòng mới có quyền đổi truyện/chương!" });
    }

    const updatedRoom = await prisma.mangaCoRoom.update({
      where: { id: roomId },
      data: {
        mangaId: mangaId || null,
        chapterId: chapterId || null,
        currentPage: 0,
        scrollPercent: 0
      }
    });

    return res.status(200).json({ message: "Đã chuyển chương đọc thành công!", room: updatedRoom });
  } catch (error) {
    console.error("Lỗi đổi chương manga:", error);
    return res.status(500).json({ message: "Lỗi server khi đổi chương." });
  }
});

// ==========================================
// 🗑️ 6. API: GIẢI TÁN PHÒNG ĐỌC
// ==========================================
router.delete('/rooms/:roomId', async (req: Request, res: Response): Promise<any> => {
  try {
    const roomId = String(req.params.roomId);

    await prisma.mangaCoMember.deleteMany({ where: { roomId } });
    await prisma.mangaCoRoom.delete({ where: { id: roomId } });

    return res.status(200).json({ message: "Phòng đọc đã được giải tán thành công!" });
  } catch (error) {
    console.error("Lỗi khi giải tán phòng đọc:", error);
    return res.status(500).json({ message: "Lỗi server khi giải tán phòng." });
  }
});

// ==========================================
// 🔍 7. API: LẤY DANH SÁCH CÁC PHÒNG ĐANG MỞ
// ==========================================
router.get('/rooms', async (req: Request, res: Response): Promise<any> => {
  try {
    const rooms = await prisma.mangaCoRoom.findMany({
      include: {
        host: { select: { id: true, name: true, image: true } },
        members: { where: { status: 'JOINED' } }
      },
      orderBy: { createdAt: 'desc' }
    });

    return res.status(200).json(rooms);
  } catch (error) {
    console.error("Lỗi khi lấy danh sách phòng manga:", error);
    return res.status(500).json({ message: "Lỗi server khi lấy danh sách phòng." });
  }
});

// ==========================================
// 🎤 8. API: LẤY TOKEN VOICE CHAT LIVEKIT
// ==========================================
router.get('/rooms/:roomId/voice-token', async (req: Request, res: Response): Promise<any> => {
  try {
    const roomId = String(req.params.roomId);
    const userName = (req.query.userName as string) || "Bạn đọc";

    if (!process.env.LIVEKIT_API_KEY || !process.env.LIVEKIT_API_SECRET) {
      return res.status(500).json({ message: "Máy chủ chưa được cấu hình LiveKit!" });
    }

    const uniqueIdentity = `user_${Math.random().toString(36).substring(2, 10)}`;

    const at = new AccessToken(
      process.env.LIVEKIT_API_KEY,
      process.env.LIVEKIT_API_SECRET,
      {
        identity: uniqueIdentity,
        name: userName
      }
    );

    at.addGrant({ roomJoin: true, room: `manga_${roomId}`, canPublish: true, canSubscribe: true });

    const token = await at.toJwt();
    return res.status(200).json({ token });
  } catch (error) {
    console.error("Lỗi tạo LiveKit token cho manga room:", error);
    return res.status(500).json({ message: "Không thể khởi tạo Voice Chat." });
  }
});

export default router;