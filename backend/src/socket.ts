import { Server as HttpServer } from "http";
import { Server, Socket } from "socket.io";
import prisma from "./config/db";

// 🌟 The memory stores a list of approved user IDs categorized by room ID.
const roomApprovedUsers = new Map<string, Set<string>>();

// 🌟 The memory stores the BGM state of each room (including the real-time timestamp for synchronization with latecomers)
interface RoomBgmState {
  url: string;
  isPlaying: boolean;
  currentTime: number;
  updatedAt: number;
}
const roomBgmState = new Map<string, RoomBgmState>();

// Function to calculate the current BGM state with elapsed seconds for latecomers
function getCurrentRoomBgm(roomId: string) {
  const state = roomBgmState.get(roomId);
  if (!state || !state.url) return null;

  const elapsedSeconds = state.isPlaying
    ? (Date.now() - state.updatedAt) / 1000
    : 0;

  return {
    url: state.url,
    isPlaying: state.isPlaying,
    currentTime: Math.max(0, state.currentTime + elapsedSeconds),
  };
}

export function initSocket(server: HttpServer) {
  const io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", (socket: Socket) => {
    console.log(`🔌 Device connected to Socket: ${socket.id}`);

    // ============================================
    // 1.WATCH PARTY (ANIME) EVENT GROUP
    // ============================================
    socket.on("join_room", (roomId: string, userName: string) => {
      socket.join(roomId);
      console.log(`👤 ${userName} joined the room: ${roomId}`);
      socket.to(roomId).emit("receive_message", {
        sender: "System",
        text: `${userName} just joined the room!`,
        isSystemMsg: true,
      });
    });

    socket.on("new_join_request", (data: { roomId: string }) => {
      socket.to(data.roomId).emit("receive_join_request", data);
    });

    socket.on(
      "send_approve_result",
      (data: { roomId: string; targetUserId: string; action: string }) => {
        socket.to(data.roomId).emit("receive_approve_result", data);
      }
    );

    socket.on(
      "send_message",
      (data: { roomId: string; sender: string; text: string }) => {
        socket.to(data.roomId).emit("receive_message", {
          sender: data.sender,
          text: data.text,
          isSystemMsg: false,
        });
      }
    );

    socket.on(
      "sync_video",
      (data: { roomId: string; action: string; currentTime: number }) => {
        socket.to(data.roomId).emit("receive_video_sync", {
          action: data.action,
          currentTime: data.currentTime,
        });
      }
    );

    socket.on("change_video", (roomId: string) => {
      socket.to(roomId).emit("receive_video_change");
    });

    socket.on("leave_room", (roomId: string, userName: string) => {
      socket.leave(roomId);
      socket.to(roomId).emit("receive_message", {
        sender: "System",
        text: `${userName} has left the room.`,
        isSystemMsg: true,
      });
    });

    socket.on("disband_room", (roomId: string) => {
      socket.to(roomId).emit("receive_disband_room");
    });

    socket.on(
      "update_room_theme",
      async (data: { roomId: string; hostId: string; newTheme: any }) => {
        try {
          const room = await prisma.partyRoom.findUnique({
            where: { id: data.roomId },
            select: { hostId: true },
          });

          if (!room || room.hostId !== data.hostId) {
            return socket.emit(
              "error_message",
              "Only the room host can change the theme!"
            );
          }

          await prisma.partyRoom.update({
            where: { id: data.roomId },
            data: { themeConfig: data.newTheme },
          });

          io.to(data.roomId).emit("receive_room_theme", data.newTheme);
          console.log(
            `🎨 Room ${data.roomId} just changed its theme:`,
            data.newTheme.accent
          );
        } catch (error) {
          console.error("Error updating room theme:", error);
        }
      }
    );

    // ============================================
    // 2. CO-READING ROOM EVENT GROUP (MANGA)
    // ============================================
    socket.on(
      "manga:join_room",
      ({ roomId, user }: { roomId: string; user: any }) => {
        socket.join(`manga_${roomId}`);
        console.log(
          `📖 [Manga Room] ${user?.name || socket.id} has joined the room: ${roomId}`
        );
        socket.to(`manga_${roomId}`).emit("manga:member_joined", { user });

        // 🌟 Send the current music if available (And send an extra beat after 600ms in case the UI has just been mounted).
        const currentBgm = getCurrentRoomBgm(roomId);
        if (currentBgm) {
          socket.emit("manga:bgm_synced", currentBgm);
          setTimeout(() => {
            const latestBgm = getCurrentRoomBgm(roomId);
            if (latestBgm) {
              socket.emit("manga:bgm_synced", latestBgm);
            }
          }, 600);
        }
      }
    );

    // 🌟 event for latecomers to sync the current BGM state
    socket.on("manga:request_bgm", ({ roomId }: { roomId: string }) => {
      const currentBgm = getCurrentRoomBgm(roomId);
      if (currentBgm) {
        socket.emit("manga:bgm_synced", currentBgm);
        if (currentBgm.currentTime > 1) {
          setTimeout(() => {
            const latestBgm = getCurrentRoomBgm(roomId);
            if (latestBgm) {
              socket.emit("manga:bgm_seeked", {
                currentTime: latestBgm.currentTime,
              });
            }
          }, 1200);
        }
      }
    });

    // 🌟 GUEST REQUESTING PRIVATE ROOM: Check if this has been approved before.
    socket.on(
      "manga:request_join",
      ({
        roomId,
        user,
      }: {
        roomId: string;
        user: { id: string; name?: string };
      }) => {
        if (!roomApprovedUsers.has(roomId)) {
          roomApprovedUsers.set(roomId, new Set<string>());
        }

        const approvedSet = roomApprovedUsers.get(roomId)!;

        // If it has been previously approved -> It will be automatically added, no need to call the host.
        if (approvedSet.has(user?.id)) {
          socket.emit("manga:join_response", { approved: true });
          return;
        }

        // If a new user -> Send a request to the Host
        socket.to(`manga_${roomId}`).emit("manga:receive_join_request", {
          applicant: user,
          applicantSocketId: socket.id,
        });
      }
    );

    // 🌟 HOST'S REVIEW RESULT: Save userId if aprroved, and send the result to the applicant.
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
          // Remember this userId permanently in the room session.
          roomApprovedUsers.get(roomId)!.add(applicantId);
        }

        io.to(applicantSocketId).emit("manga:join_response", { approved });

        // 🌟 As soon as the host approves the guest into the room, immediately play the currently playing music for that guest.
        if (approved && roomId) {
          setTimeout(() => {
            const currentBgm = getCurrentRoomBgm(roomId);
            if (currentBgm) {
              io.to(applicantSocketId).emit("manga:bgm_synced", currentBgm);
            }
          }, 800);
        }
      }
    );

    socket.on(
      "manga:sync_page",
      (data: { roomId: string; chapterId: string; currentPage: number }) => {
        socket.to(`manga_${data.roomId}`).emit("manga:page_synced", data);
      }
    );

    // vertical scrolling synchronization
    socket.on(
      "manga:sync_scroll",
      (data: { roomId: string; scrollPercent: number }) => {
        socket.to(`manga_${data.roomId}`).emit("manga:scroll_synced", data);
      }
    );

    // Turn Room Lock On/Off (Only the Host has the authority to issue this command)
    socket.on(
      "manga:toggle_lock",
      ({ roomId, isHostLocked }: { roomId: string; isHostLocked: boolean }) => {
        io.to(`manga_${roomId}`).emit("manga:lock_updated", { isHostLocked });
      }
    );

    // Synchronize reading modes (Single Page / Vertical)
    socket.on(
      "manga:change_read_mode",
      ({
        roomId,
        readMode,
      }: {
        roomId: string;
        readMode: "SINGLE" | "VERTICAL";
      }) => {
        io.to(`manga_${roomId}`).emit("manga:read_mode_updated", { readMode });
      }
    );

    socket.on(
      "manga:leave_room",
      ({ roomId, userId }: { roomId: string; userId: string }) => {
        socket.leave(`manga_${roomId}`);
        socket.to(`manga_${roomId}`).emit("manga:member_left", { userId });
      }
    );

    // Disband the room: Clear the browsing list + music and notify everyone to leave.
    socket.on("manga:disband_room", ({ roomId }: { roomId: string }) => {
      roomApprovedUsers.delete(roomId);
      roomBgmState.delete(roomId);
      io.to(`manga_${roomId}`).emit("manga:room_disbanded");
    });

    // Listen for mouse movements.
    socket.on(
      "manga:move_cursor",
      ({ roomId, cursor }: { roomId: string; cursor: any }) => {
        socket.to(`manga_${roomId}`).emit("manga:cursor_moved", cursor);
      }
    );

    // Listin for drawing lines (laser pointer).
    socket.on(
      "manga:laser_draw",
      ({ roomId, line }: { roomId: string; line: any }) => {
        socket.to(`manga_${roomId}`).emit("manga:laser_draw", line);
      }
    );

    // Listen for the event to clear laser lines
    socket.on(
      "manga:clear_laser",
      ({ roomId, targetUserId }: { roomId: string; targetUserId?: string }) => {
        io.to(`manga_${roomId}`).emit("manga:laser_cleared", { targetUserId });
      }
    );

    // Synchronize Manga Room background theme
    socket.on(
      "manga:change_theme",
      ({
        roomId,
        theme,
      }: {
        roomId: string;
        theme: { type: "color" | "image"; value: string };
      }) => {
        io.to(`manga_${roomId}`).emit("manga:theme_updated", theme);
      }
    );

    // 🌟 Synchronize YouTube Background Music (BGM)
    socket.on(
      "manga:sync_bgm",
      (data: {
        roomId: string;
        url: string;
        isPlaying: boolean;
        currentTime?: number;
      }) => {
        const prev = roomBgmState.get(data.roomId);
        let nextTime = data.currentTime ?? 0;

        // If only press Pause/Play on the same song without passing currentTime, it will automatically calculate the elapsed seconds.
        if (data.currentTime === undefined && prev && prev.url === data.url) {
          const elapsed = prev.isPlaying
            ? (Date.now() - prev.updatedAt) / 1000
            : 0;
          nextTime = prev.currentTime + elapsed;
        }

        // 1. Save to cache with real-time timestamp.
        roomBgmState.set(data.roomId, {
          url: data.url,
          isPlaying: data.isPlaying,
          currentTime: nextTime,
          updatedAt: Date.now(),
        });

        // 2. Distribute to all members in the room.
        io.to(`manga_${data.roomId}`).emit("manga:bgm_synced", {
          url: data.url,
          isPlaying: data.isPlaying,
          currentTime: nextTime,
        });
        console.log(
          `🎵 [Manga Room ${data.roomId}] BGM updated: ${data.url} (playing: ${data.isPlaying}, time: ${Math.round(nextTime)}s)`
        );
      }
    );

    // 🌟 SYNCHRONIZE MUSIC ROUTE (SEEK)
    socket.on(
      "manga:seek_bgm",
      (data: { roomId: string; currentTime: number }) => {
        const prev = roomBgmState.get(data.roomId);
        if (prev) {
          roomBgmState.set(data.roomId, {
            ...prev,
            currentTime: data.currentTime,
            updatedAt: Date.now(),
          });
        }

        // Sync music to all other members in the room
        socket.to(`manga_${data.roomId}`).emit("manga:bgm_seeked", {
          currentTime: data.currentTime,
        });
        console.log(
          `⏩ [Manga Room ${data.roomId}] Seeked to: ${data.currentTime}s`
        );
      }
    );

    // 🌟 SYNCHRONIZE EMOTICON EMISSION (SHARED FOR BOTH MANGA ROOM & WATCH PARTY)
    socket.on(
      "manga:send_reaction",
      (data: {
        roomId: string;
        id: string;
        emoji: string;
        userName: string;
        color: string;
        leftPercent: number;
      }) => {
        socket
          .to(`manga_${data.roomId}`)
          .to(data.roomId)
          .emit("manga:reaction_received", data);
      }
    );

    // ============================================
    // 3. Disconnect Event
    // ============================================
    socket.on("disconnect", () => {
      console.log(`🔌 The device has disconnected: ${socket.id}`);
    });
  });

  return io;
}