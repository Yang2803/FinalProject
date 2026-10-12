"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { io, Socket } from "socket.io-client";
import { useRouter } from "next/navigation";

export interface MangaRoomUser {
  id: string;
  name?: string;
  username?: string;
  avatar?: string;
  color?: string;
}

export interface MangaRoomMember extends MangaRoomUser {
  role?: "HOST" | "MEMBER";
}

export interface JoinRequest {
  applicant: MangaRoomUser;
  applicantSocketId: string;
}

// Con trỏ chuột thời gian thực
export interface RemoteCursor {
  userId: string;
  userName: string;
  color: string;
  pageIndex: number;
  xPercent: number;
  yPercent: number;
}

// Nét vẽ laser khoanh vùng tạm thời
export interface LaserLine {
  id: string;
  userId: string;
  pageIndex: number;
  points: { x: number; y: number }[];
  color: string;
  strokeWidth: number;
}

export interface MangaTheme {
  type: "color" | "image";
  value: string;
}

export function useMangaRoom({
  roomId,
  user,
  isHost,
  isPrivate,
  onRemotePageChange,
  onRemoteScroll,
  onRemoteReadModeChange,
}: {
  roomId: string;
  user: MangaRoomUser | null;
  isHost: boolean;
  isPrivate?: boolean;
  onRemotePageChange: (chapterId: string, page: number) => void;
  onRemoteScroll: (percent: number) => void;
  onRemoteReadModeChange?: (mode: "SINGLE" | "VERTICAL") => void;
}) {
  const router = useRouter();
  const socketRef = useRef<Socket | null>(null);

  const [theme, setTheme] = useState<MangaTheme>({ type: "color", value: "#000000" });

  // 🌟 Cờ đánh dấu đã gửi yêu cầu xin vào hay chưa (tránh gửi lặp lại khi re-render)
  const hasRequestedRef = useRef(false);
  // 🌟 Danh sách ID những người Host đã duyệt trong phiên này
  const approvedUserIdsRef = useRef<Set<string>>(new Set());

  // States cơ bản
  const [isLocked, setIsLocked] = useState(false);
  const [members, setMembers] = useState<MangaRoomMember[]>([]);
  const [remoteCursors, setRemoteCursors] = useState<Record<string, RemoteCursor>>({});
  const [laserLines, setLaserLines] = useState<LaserLine[]>([]);

  // 🌟 States quản lý phê duyệt phòng kín
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);
  const [isApprovedByHost, setIsApprovedByHost] = useState(false);
  const [isRejectedByHost, setIsRejectedByHost] = useState(false);

  // 🌟 Suy diễn trạng thái duyệt phòng (Tránh setState trong useEffect gây lỗi cascading renders)
  const approvalStatus: "APPROVED" | "PENDING" | "REJECTED" = useMemo(() => {
    if (isHost || !isPrivate) return "APPROVED";
    if (isRejectedByHost) return "REJECTED";
    if (isApprovedByHost) return "APPROVED";
    return "PENDING";
  }, [isHost, isPrivate, isApprovedByHost, isRejectedByHost]);

  useEffect(() => {
    if (!roomId) return;

    const socket = io("http://localhost:5000");
    socketRef.current = socket;

    if (user) {
      socket.emit("manga:join_room", { roomId, user });

      // 🌟 CHỈ GỬI YÊU CẦU NẾU CHƯA GỬI LẦN NÀO VÀ CHƯA ĐƯỢC DUYỆT
      if (isPrivate && !isHost && !isApprovedByHost && !hasRequestedRef.current) {
        socket.emit("manga:request_join", { roomId, user });
        hasRequestedRef.current = true; // Đánh dấu đã gửi
      }
    }

    // 🌟 Host: Nhận yêu cầu xin vào phòng kín
    socket.on("manga:receive_join_request", (req: JoinRequest) => {
      if (isHost) {
        // Nếu người này đã được Host duyệt rồi thì bỏ qua không hiện lại popup nữa
        if (approvedUserIdsRef.current.has(req.applicant.id)) return;

        setJoinRequests((prev) => [
          ...prev.filter((r) => r.applicant.id !== req.applicant.id),
          req,
        ]);
      }
    });

    // 🌟 Khách: Nhận kết quả duyệt từ Host
    socket.on("manga:join_response", ({ approved }: { approved: boolean }) => {
      if (approved) {
        setIsApprovedByHost(true);
      } else {
        setIsRejectedByHost(true);
      }
    });

    // 1. Đồng bộ lật trang
    socket.on("manga:page_synced", (data: { chapterId: string; currentPage: number }) => {
      onRemotePageChange(data.chapterId, data.currentPage);
    });

    // 2. Đồng bộ cuộn dọc (Webtoon)
    socket.on("manga:scroll_synced", (data: { scrollPercent: number }) => {
      onRemoteScroll(data.scrollPercent);
    });

    // 3. Cập nhật trạng thái khóa của Host
    socket.on("manga:lock_updated", ({ isHostLocked }: { isHostLocked: boolean }) => {
      setIsLocked(isHostLocked);
    });

    // 4. Nhận vị trí Live Cursor từ thành viên khác
    socket.on("manga:cursor_moved", (cursor: RemoteCursor) => {
      if (cursor.userId === user?.id) return;
      setRemoteCursors((prev) => ({ ...prev, [cursor.userId]: cursor }));
    });

    // 5. Xóa con trỏ khi có người rời phòng
    socket.on("manga:user_left", ({ userId }: { userId: string }) => {
      setRemoteCursors((prev) => {
        const next = { ...prev };
        delete next[userId];
        return next;
      });
    });

    // 6. Nhận nét vẽ Laser khoanh vùng từ thành viên khác
    socket.on("manga:laser_draw", (line: LaserLine) => {
      setLaserLines((prev) => [...prev, line]);
    });

    // 7. Lắng nghe sự kiện xóa nét vẽ
    socket.on("manga:laser_cleared", ({ targetUserId }: { targetUserId?: string }) => {
      if (targetUserId) {
        // Chỉ xóa nét của người tương ứng
        setLaserLines((prev) => prev.filter((line) => line.userId !== targetUserId));
      } else {
        // Trưởng phòng yêu cầu xóa tất cả
        setLaserLines([]);
      }
    });

    // 🌟 1. Lắng nghe Host đổi chế độ đọc (Từng trang / Cuộn dọc)
    socket.on("manga:read_mode_updated", ({ readMode }: { readMode: "SINGLE" | "VERTICAL" }) => {
      if (onRemoteReadModeChange) {
        onRemoteReadModeChange(readMode);
      }
    });

    // 🌟 2. Cập nhật trạng thái khóa phòng cho tất cả mọi người
    socket.on("manga:lock_updated", ({ isHostLocked }: { isHostLocked: boolean }) => {
      setIsLocked(isHostLocked);
    });

    // 🌟 3. Đồng bộ cuộn từ xa
    socket.on("manga:scroll_synced", (data: { scrollPercent: number }) => {
      onRemoteScroll(data.scrollPercent);
    });

    // 8. Lắng nghe sự kiện phòng bị giải tán
    socket.on("manga:room_disbanded", () => {
      alert("Trưởng phòng đã giải tán phòng đọc này!");
      router.push("/manga-room");
    });

    // 9. Lắng nghe sự kiện cập nhật theme background Manga Room
    socket.on("manga:theme_updated", (newTheme: MangaTheme) => {
      setTheme(newTheme);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [roomId, user?.id, isHost, isPrivate, isApprovedByHost, router]);

  // 🌟 Host duyệt hoặc từ chối
  const respondJoinRequest = useCallback(
    (applicantSocketId: string, applicantId: string, approved: boolean) => {
      if (!socketRef.current || !isHost) return;

      // Đánh dấu đã duyệt vào Set để không bao giờ nhận lại request của người này nữa
      if (approved) {
        approvedUserIdsRef.current.add(applicantId);
      }

      socketRef.current.emit("manga:respond_join_request", { applicantSocketId, approved });

      // Xóa ngay lập tức khỏi danh sách popup
      setJoinRequests((prev) => prev.filter((r) => r.applicant.id !== applicantId));
    },
    [isHost]
  );

  // Rời phòng của thành viên
  const emitLeaveRoom = useCallback(() => {
    if (socketRef.current && user) {
      socketRef.current.emit("manga:leave_room", { roomId, userId: user.id });
    }
    router.push("/manga-room");
  }, [roomId, user, router]);

  // Giải tán phòng của Host
  const emitDisbandRoom = useCallback(async () => {
    if (!socketRef.current || !isHost) return;
    socketRef.current.emit("manga:disband_room", { roomId });
    router.push("/manga-room");
  }, [roomId, isHost, router]);

  // Phát tín hiệu lật trang
  const emitPageChange = useCallback(
    (chapterId: string, page: number) => {
      if (!socketRef.current || (!isHost && isLocked)) return;
      socketRef.current.emit("manga:sync_page", {
        roomId,
        chapterId,
        currentPage: page,
      });
    },
    [roomId, isHost, isLocked]
  );

  // Phát tín hiệu cuộn trang
  const emitScroll = useCallback(
    (percent: number) => {
      if (!socketRef.current || (!isHost && isLocked)) return;
      socketRef.current.emit("manga:sync_scroll", { roomId, scrollPercent: percent });
    },
    [roomId, isHost, isLocked]
  );

  // Hàm phát sự kiện đổi theme
  const emitChangeTheme = useCallback(
    (newTheme: MangaTheme) => {
      if (!socketRef.current || !isHost) return;
      setTheme(newTheme);
      socketRef.current.emit("manga:change_theme", { roomId, theme: newTheme });
    },
    [roomId, isHost]
  );

  // Phát tọa độ con trỏ chuột thời gian thực (Live Cursor)
  const emitCursorMove = useCallback(
    (pageIndex: number, xPercent: number, yPercent: number) => {
      if (!socketRef.current || !user) return;
      socketRef.current.emit("manga:move_cursor", {
        roomId,
        cursor: {
          userId: user.id,
          userName: user.name || user.username || "Bạn đọc",
          color: user.color || "#10b981",
          pageIndex,
          xPercent,
          yPercent,
        },
      });
    },
    [roomId, user]
  );

  // Phát nét vẽ khoanh vùng Laser
  const emitLaserDraw = useCallback(
    (pageIndex: number, points: { x: number; y: number }[], strokeWidth: number = 0.8) => {
      if (!socketRef.current || !user) return;
      const newLine: LaserLine = {
        id: `${user.id}_${Date.now()}`,
        userId: user.id,
        pageIndex,
        points,
        color: user.color || "#10b981",
        strokeWidth,
      };

      setLaserLines((prev) => [...prev, newLine]);
      socketRef.current.emit("manga:laser_draw", { roomId, line: newLine });
    },
    [roomId, user]
  );

  // Chỉ xóa nét vẽ của chính mình
  const emitClearMyLaser = useCallback(() => {
    if (!socketRef.current || !user) return;
    setLaserLines((prev) => prev.filter((line) => line.userId !== user.id));
    socketRef.current.emit("manga:clear_laser", { 
      roomId, 
      targetUserId: user.id 
    });
  }, [roomId, user]);

  // Trưởng phòng xóa toàn bộ nét vẽ trong phòng
  const emitClearAllLaser = useCallback(() => {
    if (!socketRef.current || !isHost) return;
    setLaserLines([]);
    socketRef.current.emit("manga:clear_laser", { 
      roomId 
    });
  }, [roomId, isHost]);

  // 🌟 Hàm phát tín hiệu đổi chế độ đọc
  const emitChangeReadMode = useCallback(
    (mode: "SINGLE" | "VERTICAL") => {
      if (!socketRef.current || (!isHost && isLocked)) return;
      socketRef.current.emit("manga:change_read_mode", { roomId, readMode: mode });
    },
    [roomId, isHost, isLocked]
  );

  // 🌟 Hàm khóa/mở khóa phòng
  const toggleLock = useCallback(
    (nextLocked: boolean) => {
      if (!socketRef.current || !isHost) return;
      setIsLocked(nextLocked);
      socketRef.current.emit("manga:toggle_lock", { roomId, isHostLocked: nextLocked });
    },
    [roomId, isHost]
  );

  return {
    isLocked,
    setIsLocked: toggleLock,
    approvalStatus,
    joinRequests,
    respondJoinRequest,
    emitPageChange,
    emitScroll,
    emitCursorMove,
    emitLaserDraw,
    emitClearMyLaser,
    emitClearAllLaser,
    emitLeaveRoom,
    emitDisbandRoom,
    emitChangeTheme,
    emitChangeReadMode,
    toggleLock,
    theme,
    remoteCursors,
    laserLines,
    members,
  };
}