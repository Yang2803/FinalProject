"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";

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

interface LaserPointer {
  userId: string;
  username: string;
  color: string;
  xPercent: number;
  yPercent: number;
  pageIndex: number;
}

export function useMangaRoom({
  roomId,
  user,
  isHost,
  onRemotePageChange,
  onRemoteScroll,
}: {
  roomId: string;
  user: MangaRoomUser | null;
  isHost: boolean;
  onRemotePageChange: (chapterId: string, page: number) => void;
  onRemoteScroll: (percent: number) => void;
}) {
  const [isLocked, setIsLocked] = useState(true);
  const [members, setMembers] = useState<MangaRoomMember[]>([]);
  const [lasers, setLasers] = useState<Record<string, LaserPointer>>({});
  const socketRef = useRef<Socket | null>(null);
  const laserTimeouts = useRef<Record<string, NodeJS.Timeout>>({});

  useEffect(() => {
    if (!roomId) return;

    // Tự khởi tạo Socket bên trong hook
    const socket = io("http://localhost:5000");
    socketRef.current = socket;

    if (user) {
      socket.emit("manga:join_room", { roomId, user });
    }

    socket.on("manga:page_synced", (data) => {
      onRemotePageChange(data.chapterId, data.currentPage);
    });

    socket.on("manga:scroll_synced", (data) => {
      onRemoteScroll(data.scrollPercent);
    });

    socket.on("manga:lock_updated", ({ isHostLocked }) => {
      setIsLocked(isHostLocked);
    });

    socket.on("manga:laser_updated", (data: LaserPointer) => {
      setLasers((prev) => ({ ...prev, [data.userId]: data }));

      if (laserTimeouts.current[data.userId]) {
        clearTimeout(laserTimeouts.current[data.userId]);
      }
      laserTimeouts.current[data.userId] = setTimeout(() => {
        setLasers((prev) => {
          const next = { ...prev };
          delete next[data.userId];
          return next;
        });
      }, 1500);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [roomId, user?.id]);

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

  const emitScroll = useCallback(
    (percent: number) => {
      if (!socketRef.current || (!isHost && isLocked)) return;
      socketRef.current.emit("manga:sync_scroll", { roomId, scrollPercent: percent });
    },
    [roomId, isHost, isLocked]
  );

  const emitLaser = useCallback(
    (xPercent: number, yPercent: number, pageIndex: number) => {
      if (!socketRef.current || !user) return;
      socketRef.current.emit("manga:laser_pointer", {
        roomId,
        userId: user.id,
        username: user.name || "Bạn đọc",
        color: user.color || "#ef4444",
        xPercent,
        yPercent,
        pageIndex,
      });
    },
    [roomId, user]
  );

  return {
    isLocked,
    setIsLocked: (locked: boolean) => {
      setIsLocked(locked);
      socketRef.current?.emit("manga:toggle_lock", { roomId, isHostLocked: locked });
    },
    emitPageChange,
    emitScroll,
    emitLaser,
    lasers,
    members,
  };
}