import { Server as HttpServer } from "http";
import { Server, Socket } from "socket.io";
import prisma from "./config/db";

// 🌟 Bộ nhớ lưu danh sách userId đã được phê duyệt theo từng roomId
const roomApprovedUsers = new Map<string, Set<string>>();

// 🌟 Bộ nhớ lưu trạng thái BGM của từng phòng (url & trạng thái phát)
const roomBgmState = new Map<string, { url: string; isPlaying: boolean }>();

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

      // 🌟 Khi có người vào phòng: nếu Host đã bật nhạc trước đó, gửi ngay cho người mới
      const currentBgm = roomBgmState.get(roomId);
      if (currentBgm && currentBgm.url) {
        socket.emit("manga:bgm_synced", currentBgm);
      }
    });

    

    // 🌟 KHÁCH XIN VÀO PHÒNG KÍN: Kiểm tra xem đã từng được duyệt chưa
    socket.on("manga:request_join", ({ roomId, user }: { roomId: string; user: { id: string; name?: string } }) => {
      if (!roomApprovedUsers.has(roomId)) {
        roomApprovedUsers.set(roomId, new Set<string>());
      }

      const approvedSet = roomApprovedUsers.get(roomId)!;

      // Nếu đã được duyệt trước đó -> Tự động cho vào luôn, không gọi Host
      if (approvedSet.has(user?.id)) {
        socket.emit("manga:join_response", { approved: true });
        return;
      }

      // Nếu là người mới -> Bắn yêu cầu tới Host
      socket.to(`manga_${roomId}`).emit("manga:receive_join_request", {
        applicant: user,
        applicantSocketId: socket.id,
      });
    });

    // 🌟 HOST TRẢ LỜI KẾT QUẢ DUYỆT: Lưu lại userId nếu đồng ý
    socket.on(
      "manga:respond_join_request",
      ({
        roomId,
        applicantSocketId,
        applicantId,
        approved,
      }: {
        roomId: string;
        applicantSocketId: string;
        applicantId: string;
        approved: boolean;
      }) => {
        if (approved && roomId && applicantId) {
          if (!roomApprovedUsers.has(roomId)) {
            roomApprovedUsers.set(roomId, new Set<string>());
          }
          // Ghi nhớ userId này vĩnh viễn trong phiên phòng
          roomApprovedUsers.get(roomId)!.add(applicantId);
        }

        io.to(applicantSocketId).emit("manga:join_response", { approved });
      }
    );

    socket.on("manga:sync_page", (data: { roomId: string; chapterId: string; currentPage: number }) => {
      socket.to(`manga_${data.roomId}`).emit("manga:page_synced", data);
    });

    // Đồng bộ cuộn dọc mượt mà
    socket.on("manga:sync_scroll", (data: { roomId: string; scrollPercent: number }) => {
      socket.to(`manga_${data.roomId}`).emit("manga:scroll_synced", data);
    });

    // Bật / Tắt Khóa phòng (Chỉ Host mới có quyền phát lệnh này)
    socket.on("manga:toggle_lock", ({ roomId, isHostLocked }: { roomId: string; isHostLocked: boolean }) => {
      io.to(`manga_${roomId}`).emit("manga:lock_updated", { isHostLocked });
    });

    // Đồng bộ chế độ đọc (Single Page / Vertical Webtoon)
    socket.on("manga:change_read_mode", ({ roomId, readMode }: { roomId: string; readMode: "SINGLE" | "VERTICAL" }) => {
      io.to(`manga_${roomId}`).emit("manga:read_mode_updated", { readMode });
    });

    socket.on("manga:laser_pointer", (data: any) => {
      socket.to(`manga_${data.roomId}`).emit("manga:laser_updated", data);
    });

    socket.on("manga:leave_room", ({ roomId, userId }: { roomId: string; userId: string }) => {
      socket.leave(`manga_${roomId}`);
      socket.to(`manga_${roomId}`).emit("manga:member_left", { userId });
    });

    // Giải tán phòng: Dọn sạch danh sách duyệt và thông báo mọi người out
    socket.on("manga:disband_room", ({ roomId }: { roomId: string }) => {
      roomApprovedUsers.delete(roomId);
      io.to(`manga_${roomId}`).emit("manga:room_disbanded");
    });

    // Lắng nghe di chuyển chuột
    socket.on("manga:move_cursor", ({ roomId, cursor }: { roomId: string; cursor: any }) => {
      socket.to(`manga_${roomId}`).emit("manga:cursor_moved", cursor);
    });

    // Lắng nghe nét vẽ laser khoanh vùng
    socket.on("manga:laser_draw", ({ roomId, line }: { roomId: string; line: any }) => {
      socket.to(`manga_${roomId}`).emit("manga:laser_draw", line);
    });

    // Lắng nghe sự kiện xóa nét vẽ
    socket.on("manga:clear_laser", ({ roomId, targetUserId }: { roomId: string; targetUserId?: string }) => {
      io.to(`manga_${roomId}`).emit("manga:laser_cleared", { targetUserId });
    });

    // Đồng bộ theme background Manga Room
    socket.on("manga:change_theme", ({ roomId, theme }: { roomId: string; theme: { type: "color" | "image"; value: string } }) => {
      io.to(`manga_${roomId}`).emit("manga:theme_updated", theme);
    });


    // 🌟 ĐỒNG BỘ NHẠC NỀN YOUTUBE (BGM)
    socket.on("manga:sync_bgm", (data: { roomId: string; url: string; isPlaying: boolean }) => {
      // 1. Lưu lại vào cache để thành viên vào sau vẫn nhận được
      roomBgmState.set(data.roomId, { url: data.url, isPlaying: data.isPlaying });
      // 2. Phát cho tất cả thành viên trong phòng (bao gồm cả các tab khác nếu có)
      io.to(`manga_${data.roomId}`).emit("manga:bgm_synced", {
        url: data.url,
        isPlaying: data.isPlaying,
      });
      console.log(`🎵 [Manga Room ${data.roomId}] BGM updated: ${data.url} (playing: ${data.isPlaying})`);
    });

    // 🌟 ĐỒNG BỘ TUA NHẠC (SEEK)
    socket.on("manga:seek_bgm", (data: { roomId: string; currentTime: number }) => {
      // Phát tới tất cả thành viên khác trong phòng
      socket.to(`manga_${data.roomId}`).emit("manga:bgm_seeked", {
        currentTime: data.currentTime,
      });
      console.log(`⏩ [Manga Room ${data.roomId}] Seeked to: ${data.currentTime}s`);
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