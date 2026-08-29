import express, { Request, Response } from 'express';
import prisma from '../config/db';
import { AccessToken } from 'livekit-server-sdk';

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

    // 🌟 TRƯỞNG PHÒNG THÌ KHÔNG CẦN XIN PHÉP CHÍNH MÌNH
    if (room.hostId === userId) {
      return res.status(200).json({ message: "Trưởng phòng được vào thẳng.", status: "JOINED", room });
    }

    // Kiểm tra xem user này đã có trong phòng chưa
    const existingMember = await prisma.roomMember.findUnique({
      where: {
        roomId_userId: { roomId: room.id, userId: userId }
      }
    });

    if (existingMember) {
      if (existingMember.status === "BANNED") {
        return res.status(403).json({ message: "Bạn đã bị cấm khỏi phòng này." });
      }

      // 🌟 NẾU TỪNG BỊ TỪ CHỐI -> RESET LẠI THÀNH PENDING ĐỂ HỌ XIN LẠI
      if (existingMember.status === "REJECTED") {
        const newStatus = room.isPrivate ? "PENDING" : "JOINED";
        await prisma.roomMember.update({
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
      return res.status(202).json({ message: "Đã gửi yêu cầu tham gia. Vui lòng đợi Trưởng phòng duyệt!", status: "PENDING" });
    } else {
      return res.status(200).json({ message: "Vào phòng thành công!", status: "JOINED", room });
    }

  } catch (error) {
    console.error("Lỗi join phòng:", error);
    return res.status(500).json({ message: "Lỗi server khi xin vào phòng." });
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
      // 🌟 ĐÃ SỬA TẠI ĐÂY: KHÔNG DÙNG DELETE NỮA. 
      // Update trạng thái thành REJECTED để lưu lịch sử từ chối, chặn Frontend tự auto-join lại.
      await prisma.roomMember.update({
        where: { roomId_userId: { roomId, userId: targetUserId } },
        data: { status: "REJECTED" }
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
router.delete('/rooms/:roomId', async (req: Request, res: Response): Promise<any> => {
  try {
    const roomId = String(req.params.roomId);

    // 🌟 Dựa theo schema, model của bạn là RoomMember
    // Xóa tất cả thành viên trong phòng trước để tránh kẹt khóa ngoại
    await prisma.roomMember.deleteMany({ 
      where: { roomId: roomId } 
    });

    // Sau đó mới xóa phòng
    await prisma.partyRoom.delete({ 
      where: { id: roomId } 
    });

    return res.status(200).json({ message: "Phòng chiếu đã được giải tán thành công!" });
  } catch (error) {
    console.error("Lỗi CHI TIẾT khi giải tán phòng:", error);
    return res.status(500).json({ message: "Lỗi server khi giải tán phòng." });
  }
});


// ==========================================
// 🔍 7. API: LẤY DANH SÁCH CÁC PHÒNG ĐANG HOẠT ĐỘNG
// ==========================================
router.get('/rooms', async (req: Request, res: Response): Promise<any> => {
  try {
    const rooms = await prisma.partyRoom.findMany({
      include: {
        host: { select: { id: true, name: true} },
        members: { where: { status: 'JOINED' } }, // Chỉ đếm những người đã duyệt
        episode: { select: { title: true } },
        anime: { select: { title: true } }
      },
      // 🌟 Khôi phục lại orderBy vì model của bạn ĐÃ CÓ cột createdAt
      // Database tự sắp xếp sẽ nhanh và tối ưu hơn dùng JS rất nhiều!
      orderBy: { createdAt: 'desc' } 
    });
    
    return res.status(200).json(rooms);
  } catch (error) {
    console.error("Lỗi CHI TIẾT khi lấy danh sách phòng:", error);
    return res.status(500).json({ message: "Lỗi server khi lấy danh sách phòng.", error: String(error) });
  }
});

// ==========================================
// 🎤 8. API: LẤY TOKEN VOICE CHAT LIVEKIT
// ==========================================
router.get('/rooms/:roomId/voice-token', async (req: Request, res: Response): Promise<any> => {
  try {
    const roomId = req.params.roomId as string;
    const userName = (req.query.userName as string) || "Ẩn danh";

    // 🌟 THÊM: Kiểm tra cấu hình .env để tránh sập Server
    if (!process.env.LIVEKIT_API_KEY || !process.env.LIVEKIT_API_SECRET) {
      return res.status(500).json({ message: "Máy chủ chưa được cấu hình LiveKit!" });
    }

    // 🌟 SỬA: Tạo định danh duy nhất chống trùng lặp
    const uniqueIdentity = `user_${Math.random().toString(36).substring(2, 10)}`;

    const at = new AccessToken(
      process.env.LIVEKIT_API_KEY,
      process.env.LIVEKIT_API_SECRET,
      { 
        identity: uniqueIdentity, // Mã định danh kỹ thuật (BẮT BUỘC DUY NHẤT)
        name: userName            // Tên hiển thị thật sự trên giao diện
      } 
    );

    at.addGrant({ roomJoin: true, room: roomId, canPublish: true, canSubscribe: true });

    const token = await at.toJwt();
    res.status(200).json({ token });
  } catch (error) {
    console.error("Lỗi tạo LiveKit token:", error);
    res.status(500).json({ message: "Không thể khởi tạo Voice Chat." });
  }
});

export default router;