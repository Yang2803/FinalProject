"use client";

import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Socket } from "socket.io-client";

interface MangaRoomReactionsProps {
  roomId: string;
  socket: Socket | null;
  userName: string;
  userColor: string;
  popupAlign?: "left" | "right"; // 🌟 Thêm tuỳ chỉnh hướng bung của thanh cảm xúc
}

interface FloatingReaction {
  id: string;
  emoji: string;
  userName: string;
  color: string;
  leftPercent: number;
}

const REACTION_LIST = [
  { emoji: "🔥", label: "Cháy quá" },
  { emoji: "😭", label: "Cảm động" },
  { emoji: "😱", label: "Plot twist" },
  { emoji: "🤣", label: "Hề hước" },
  { emoji: "❤️", label: "Yêu thích" },
  { emoji: "👏", label: "Đỉnh chóp" },
];

const POCKET_POSITIONS = [22, 68, 38, 80, 18, 54, 30, 74, 46, 62];

export function MangaRoomReactions({
  roomId,
  socket,
  userName,
  userColor,
  popupAlign = "right", // Mặc định cho phòng Manga
}: MangaRoomReactionsProps) {
  const [reactions, setReactions] = useState<FloatingReaction[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const seqRef = useRef(0);

  const spawnReaction = (item: FloatingReaction) => {
    setReactions((prev) => {
      if (prev.some((r) => r.id === item.id)) return prev;
      return [...prev, item];
    });

    setTimeout(() => {
      setReactions((prev) => prev.filter((r) => r.id !== item.id));
    }, 3000);
  };

  useEffect(() => {
    if (!socket) return;

    const handleReactionReceived = (data: FloatingReaction) => {
      spawnReaction(data);
    };

    socket.on("manga:reaction_received", handleReactionReceived);
    return () => {
      socket.off("manga:reaction_received", handleReactionReceived);
    };
  }, [socket]);

  const sendReaction = (emoji: string) => {
    seqRef.current += 1;
    const count = seqRef.current;
    const leftPercent = POCKET_POSITIONS[count % POCKET_POSITIONS.length];

    const newReaction: FloatingReaction = {
      id: `${userName}_${userColor}_${count}_${emoji}`,
      emoji,
      userName,
      color: userColor,
      leftPercent,
    };

    spawnReaction(newReaction);

    if (socket) {
      socket.emit("manga:send_reaction", {
        roomId,
        ...newReaction,
      });
    }
  };

  return (
    <>
      {typeof document !== "undefined" &&
        reactions.length > 0 &&
        createPortal(
          <div className="fixed inset-0 pointer-events-none z-[9999] overflow-hidden">
            <style>{`
              @keyframes floatUpManga {
                0% {
                  transform: translateY(0) scale(0.6) rotate(0deg);
                  opacity: 0;
                }
                15% {
                  transform: translateY(-40px) scale(1.2) rotate(-6deg);
                  opacity: 1;
                }
                50% {
                  transform: translateY(-200px) scale(1.05) rotate(6deg);
                  opacity: 0.95;
                }
                100% {
                  transform: translateY(-420px) scale(0.85) rotate(-4deg);
                  opacity: 0;
                }
              }
              .animate-manga-float {
                animation: floatUpManga 3s cubic-bezier(0.22, 1, 0.36, 1) forwards;
              }
            `}</style>

            {reactions.map((item) => (
              <div
                key={item.id}
                style={{ left: `${item.leftPercent}%` }}
                className="absolute bottom-20 flex flex-col items-center animate-manga-float"
              >
                <span className="text-4xl drop-shadow-[0_4px_12px_rgba(0,0,0,0.6)] select-none">
                  {item.emoji}
                </span>
                <span
                  style={{ backgroundColor: item.color }}
                  className="mt-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold text-white shadow-lg whitespace-nowrap"
                >
                  {item.userName}
                </span>
              </div>
            ))}
          </div>,
          document.body
        )}

      {/* 🌟 NÚT BẤM & THANH CHỌN CẢM XÚC */}
      <div className="relative flex items-center shrink-0">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={`px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition border cursor-pointer select-none whitespace-nowrap ${
            isOpen
              ? "bg-pink-950/60 border-pink-500/60 text-pink-300"
              : "bg-gray-800 border-gray-700 text-gray-300 hover:text-white"
          }`}
          title="Thả cảm xúc tương tác"
        >
          <span>✨ Cảm xúc</span>
        </button>

        {isOpen && (
          <div
            className={`absolute bottom-12 ${
              popupAlign === "left" ? "left-0" : "right-20"
            } bg-[#16181f]/95 backdrop-blur-md border border-gray-700 p-2 rounded-2xl shadow-2xl flex items-center gap-1.5 z-[60]`}
          >
            {REACTION_LIST.map((r) => (
              <button
                key={r.emoji}
                type="button"
                onClick={() => sendReaction(r.emoji)}
                title={r.label}
                className="w-9 h-9 rounded-xl bg-gray-800/80 hover:bg-gray-700 hover:scale-125 active:scale-95 transition-all flex items-center justify-center text-xl cursor-pointer shrink-0"
              >
                {r.emoji}
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  );
}