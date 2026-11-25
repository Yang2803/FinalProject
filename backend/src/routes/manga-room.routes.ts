import express, { Request, Response } from 'express';
import prisma from '../config/db';
import { AccessToken } from 'livekit-server-sdk';

const router = express.Router();

// 🌟 SUPPORT FUNCTION: Generate a random 6-character invitation code (e.g., MG7K9Q)
const generateInviteCode = (): string => {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
};

// ==========================================
// 🏠 1. API: CREATE NEW MANGA CO-READING ROOMS
// ==========================================
router.post('/rooms', async (req: Request, res: Response): Promise<any> => {
  try {
    const { name, isPrivate, hostId, mangaId, chapterId } = req.body;

    if (!name || !hostId) {
      return res.status(400).json({ message: "Missing room name or host ID!" });
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

    return res.status(201).json({ message: "Successfully created a reading room!", room: newRoom });
  } catch (error) {
    console.error("Lỗi tạo phòng manga:", error);
    return res.status(500).json({ message: "Server error when creating a manga room." });
  }
});

// ==========================================
// 🔍 2. API: GET ROOM INFORMATION (BY INVITE CODE OR ID)
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
        },
        manga: { select: { id: true, title: true } },
        chapter: { select: { id: true, title: true } }
      }
    });

    if (!room) {
      return res.status(404).json({ message: "Invite code not found or room is closed!" });
    }

    return res.status(200).json(room);
  } catch (error) {
    console.error("Error fetching manga room information:", error);
    return res.status(500).json({ message: "Server error when fetching manga room information." });
  }
});

// ==========================================
// 🚪 3. API: JOIN REQUEST
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
      return res.status(404).json({ message: "Reading room not found." });
    }

    if (room.hostId === userId) {
      return res.status(200).json({ message: "Room host can join directly.", status: "JOINED", room });
    }

    const existingMember = await prisma.mangaCoMember.findUnique({
      where: {
        roomId_userId: { roomId: room.id, userId: userId }
      }
    });

    if (existingMember) {
      if (existingMember.status === "BANNED") {
        return res.status(403).json({ message: "You have been banned from this reading room." });
      }

      if (existingMember.status === "REJECTED") {
        const newStatus = room.isPrivate ? "PENDING" : "JOINED";
        await prisma.mangaCoMember.update({
          where: { id: existingMember.id },
          data: { status: newStatus }
        });
        return res.status(newStatus === "PENDING" ? 202 : 200).json({
          message: newStatus === "PENDING" ? "Request to participate has been submitted. Please wait for the Department Head to approve it!" : "Successfully joined the reading room!",
          status: newStatus,
          room
        });
      }

      return res.status(200).json({ message: "You are already in the room.", status: existingMember.status, room });
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
      return res.status(202).json({ message: "Request to participate has been submitted. Please wait for the Department Head to approve it!", status: "PENDING" });
    } else {
      return res.status(200).json({ message: "Successfully joined the reading room!", status: "JOINED", room });
    }
  } catch (error) {
    console.error("Manga Room Join Error:", error);
    return res.status(500).json({ message: "Server error when joining manga room." });
  }
});

// ==========================================
// 👑 4. API: HOST APPROVAL / REJECTION OF MEMBER
// ==========================================
router.put('/rooms/:roomId/approve', async (req: Request, res: Response): Promise<any> => {
  try {
    const roomId = String(req.params.roomId);
    const { hostId, targetUserId, action } = req.body;

    const room = await prisma.mangaCoRoom.findUnique({ where: { id: roomId } });
    if (!room || room.hostId !== hostId) {
      return res.status(403).json({ message: "You do not have permission to approve members for this room!" });
    }

    if (action === "APPROVE") {
      await prisma.mangaCoMember.update({
        where: { roomId_userId: { roomId, userId: targetUserId } },
        data: { status: "JOINED" }
      });
      return res.status(200).json({ message: "Member approved successfully!" });
    } else {
      await prisma.mangaCoMember.update({
        where: { roomId_userId: { roomId, userId: targetUserId } },
        data: { status: "REJECTED" }
      });
      return res.status(200).json({ message: "Member rejected successfully!" });
    }
  } catch (error) {
    return res.status(500).json({ message: "Server error when approving member." });
  }
});

// ==========================================
// 🔄 5. API: HOST CHANGE MANGA / CHANGE CHAPTER
// ==========================================
router.put('/rooms/:roomId/change-chapter', async (req: Request, res: Response): Promise<any> => {
  try {
    const roomId = String(req.params.roomId);
    const { hostId, mangaId, chapterId } = req.body;

    const room = await prisma.mangaCoRoom.findUnique({ where: { id: roomId } });
    if (!room || room.hostId !== hostId) {
      return res.status(403).json({ message: "Only the room host has permission to change the manga/chapter!" });
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

    return res.status(200).json({ message: "Successfully changed the manga/chapter!", room: updatedRoom });
  } catch (error) {
    console.error("Manga Room Change Chapter Error:", error);
    return res.status(500).json({ message: "Server error when changing manga/chapter." });
  }
});

// ==========================================
// 🗑️ 6. API: DISSBAND READING ROOM
// ==========================================
router.delete('/rooms/:roomId', async (req: Request, res: Response): Promise<any> => {
  try {
    const roomId = String(req.params.roomId);

    await prisma.mangaCoMember.deleteMany({ where: { roomId } });
    await prisma.mangaCoRoom.delete({ where: { id: roomId } });

    return res.status(200).json({ message: "Reading room has been disbanded successfully!" });
  } catch (error) {
    console.error("Error when disbanding reading room:", error);
    return res.status(500).json({ message: "Server error when disbanding room." });
  }
});

// ==========================================
// 🔍 7. API: GET A LIST OF AVAILABLE ROOMS
// ==========================================
router.get('/rooms', async (req: Request, res: Response): Promise<any> => {
  try {
    const rooms = await prisma.mangaCoRoom.findMany({
      include: {
        host: { select: { id: true, name: true, image: true } },
        members: { where: { status: 'JOINED' } },
        manga: { select: { title: true } }, 
        chapter: { select: { title: true, chapterNumber: true } }

      },
      orderBy: { createdAt: 'desc' }
    });

    return res.status(200).json(rooms);
  } catch (error) {
    console.error("Error when fetching manga rooms:", error);
    return res.status(500).json({ message: "Server error when fetching room list." });
  }
});

// ==========================================
// 🎤 8. API: GET VOICE CHAT TOKEN FOR LIVEKIT
// ==========================================
router.get('/rooms/:roomId/voice-token', async (req: Request, res: Response): Promise<any> => {
  try {
    const rawRoomId = String(req.params.roomId);
    const userName = (req.query.userName as string) || "Reader";
    // 🌟 Prioritize using a fixed user ID from the Session.
    const userId = (req.query.userId as string) || `user_${Math.random().toString(36).substring(2, 8)}`;

    if (!process.env.LIVEKIT_API_KEY || !process.env.LIVEKIT_API_SECRET) {
      return res.status(500).json({ message: "Server has not been configured with LiveKit!" });
    }

    // 🌟 Standardize room IDs: Ensure everyone joins the same voice room whether from the client provides an ID or invite code.
    const existingRoom = await prisma.mangaCoRoom.findFirst({
      where: {
        OR: [
          { id: rawRoomId },
          { inviteCode: rawRoomId.toUpperCase() }
        ]
      },
      select: { id: true }
    });

    // If a room is found, retrieve the exact ID from the database; otherwise, fallback to rawRoomId.
    const canonicalRoomId = existingRoom ? existingRoom.id : rawRoomId;

    const at = new AccessToken(
      process.env.LIVEKIT_API_KEY,
      process.env.LIVEKIT_API_SECRET,
      {
        identity: userId, // 🌟 Fixed user ID for unique identification
        name: userName    // Actual display name when speaking
      }
    );

    // Token lifespan (e.g., 6 hours)
    at.ttl = '6h';

    at.addGrant({
      roomJoin: true,
      room: `manga_${canonicalRoomId}`,
      canPublish: true,   // allow turn on Mic
      canSubscribe: true  // allow listening to other users
    });

    const token = await at.toJwt();
    return res.status(200).json({ token });
  } catch (error) {
    console.error("Error creating LiveKit token for manga room:", error);
    return res.status(500).json({ message: "Unable to create Voice Chat token." });
  }
});

export default router;