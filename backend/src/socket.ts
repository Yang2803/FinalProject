import { Server as HttpServer } from "http";
import { Server, Socket } from "socket.io";
import prisma from "./config/db";

export function initSocket(server: HttpServer) {
  const io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  io.on("connection", (socket: Socket) => {
    console.log(`🔌 Thiết bị kết nối Socket: ${socket.id}`);

    // ============================================
    // 1. NHÓM SỰ KIỆN WATCH PARTY (ANIME)
    // ============================================
    socket.on("join_room", (roomId: string, userName: string) => {
      socket.join(roomId);
      console.log(`👤 ${userName} đã tham gia phòng: ${roomId}`);
      socket.to(roomId).emit("receive_message", {
        sender: "Hệ thống",
        text: `${userName} vừa tham gia phòng!`,
        isSystemMsg: true
      });
    });

    socket.on("new_join_request", (data: { roomId: string }) => {
      socket.to(data.roomId).emit("receive_join_request", data);
    });

    socket.on("send_approve_result", (data: { roomId: string; targetUserId: string; action: string }) => {
      socket.to(data.roomId).emit("receive_approve_result", data);
    });

    socket.on("send_message", (data: { roomId: string; sender: string; text: string }) => {
      socket.to(data.roomId).emit("receive_message", {
        sender: data.sender,
        text: data.text,
        isSystemMsg: false
      });
    });

    socket.on("sync_video", (data: { roomId: string; action: string; currentTime: number }) => {
      socket.to(data.roomId).emit("receive_video_sync", {
        action: data.action,
        currentTime: data.currentTime
      });
    });

    socket.on("change_video", (roomId: string) => {
      socket.to(roomId).emit("receive_video_change");
    });

    socket.on("leave_room", (roomId: string, userName: string) => {
      socket.leave(roomId);
      socket.to(roomId).emit("receive_message", {
        sender: "Hệ thống",
        text: `${userName} đã rời phòng.`,
        isSystemMsg: true
      });
    });

    socket.on("disband_room", (roomId: string) => {
      socket.to(roomId).emit("receive_disband_room");
    });

    socket.on("update_room_theme", async (data: { roomId: string; hostId: string; newTheme: any }) => {
      try {
        const room = await prisma.partyRoom.findUnique({
          where: { id: data.roomId },
          select: { hostId: true }
        });

        if (!room || room.hostId !== data.hostId) {
          return socket.emit("error_message", "Chỉ trưởng phòng mới có quyền đổi theme!");
        }

        await prisma.partyRoom.update({
          where: { id: data.roomId },
          data: { themeConfig: data.newTheme }
        });

        io.to(data.roomId).emit("receive_room_theme", data.newTheme);
        console.log(`🎨 Phòng ${data.roomId} vừa đổi theme:`, data.newTheme.accent);
      } catch (error) {
        console.error("Lỗi khi cập nhật theme phòng:", error);
      }
    });

    // ============================================
    // 2. NHÓM SỰ KIỆN CO-READING ROOM (MANGA)
    // ============================================
    socket.on("manga:join_room", ({ roomId, user }: { roomId: string; user: any }) => {
      socket.join(`manga_${roomId}`);
      console.log(`📖 [Manga Room] ${user?.name || socket.id} đã vào phòng: ${roomId}`);
      socket.to(`manga_${roomId}`).emit("manga:member_joined", { user });
    });

    socket.on("manga:sync_page", (data: { roomId: string; chapterId: string; currentPage: number }) => {
      socket.to(`manga_${data.roomId}`).emit("manga:page_synced", data);
    });

    socket.on("manga:sync_scroll", (data: { roomId: string; scrollPercent: number }) => {
      socket.to(`manga_${data.roomId}`).emit("manga:scroll_synced", data);
    });

    socket.on("manga:toggle_lock", ({ roomId, isHostLocked }: { roomId: string; isHostLocked: boolean }) => {
      io.to(`manga_${roomId}`).emit("manga:lock_updated", { isHostLocked });
    });

    socket.on("manga:laser_pointer", (data: any) => {
      socket.to(`manga_${data.roomId}`).emit("manga:laser_updated", data);
    });

    socket.on("manga:leave_room", ({ roomId, userId }: { roomId: string; userId: string }) => {
      socket.leave(`manga_${roomId}`);
      socket.to(`manga_${roomId}`).emit("manga:member_left", { userId });
    });

    // ============================================
    // 3. NGẮT KẾT NỐI CHUNG
    // ============================================
    socket.on("disconnect", () => {
      console.log(`🔌 Thiết bị đã ngắt kết nối: ${socket.id}`);
    });
  });

  return io;
}