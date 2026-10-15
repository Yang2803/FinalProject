"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { Socket } from "socket.io-client";

interface MangaRoomBGMProps {
  roomId: string;
  isHost: boolean;
  socket: Socket | null;
}

function extractYouTubeId(url: string): string | null {
  if (!url) return null;
  const match = url.match(
    /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([\w-]{11})/
  );
  return match ? match[1] : null;
}

export function MangaRoomBGM({ roomId, isHost, socket }: MangaRoomBGMProps) {
  const [bgmUrl, setBgmUrl] = useState<string>("");
  const [inputUrl, setInputUrl] = useState<string>("");
  const [isOpenMenu, setIsOpenMenu] = useState<boolean>(false);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentSeconds, setCurrentSeconds] = useState<number>(0);

  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const videoId = useMemo(() => extractYouTubeId(bgmUrl), [bgmUrl]);

  // Gửi lệnh điều khiển Play/Pause tới Iframe
  const sendIframeCommand = (command: "playVideo" | "pauseVideo") => {
    if (iframeRef.current && iframeRef.current.contentWindow) {
      iframeRef.current.contentWindow.postMessage(
        JSON.stringify({ event: "command", func: command, args: [] }),
        "*"
      );
    }
  };

  // Gửi lệnh tua thời gian tới Iframe
  const seekIframe = (seconds: number) => {
    if (iframeRef.current && iframeRef.current.contentWindow) {
      iframeRef.current.contentWindow.postMessage(
        JSON.stringify({
          event: "command",
          func: "seekTo",
          args: [seconds, true],
        }),
        "*"
      );
    }
  };

  useEffect(() => {
    if (!socket) return;

    // 1. Đồng bộ bài hát & trạng thái phát
    const handleSync = (data: { url: string; isPlaying: boolean }) => {
      setBgmUrl(data.url);
      setIsPlaying(data.isPlaying);
      if (data.isPlaying) {
        sendIframeCommand("playVideo");
      } else {
        sendIframeCommand("pauseVideo");
      }
    };

    // 2. Đồng bộ thời gian tua từ Trưởng phòng
    const handleSeek = (data: { currentTime: number }) => {
      setCurrentSeconds(data.currentTime);
      seekIframe(data.currentTime);
    };

    socket.on("manga:bgm_synced", handleSync);
    socket.on("manga:bgm_seeked", handleSeek);
    socket.emit("manga:request_bgm", { roomId });

    return () => {
      socket.off("manga:bgm_synced", handleSync);
      socket.off("manga:bgm_seeked", handleSeek);
    };
  }, [socket]);

  // Bắn socket đồng bộ bài hát
  const emitBgmSync = (url: string, playing: boolean) => {
    if (!socket || !isHost) return;
    socket.emit("manga:sync_bgm", { roomId, url, isPlaying: playing });
  };

  // Bắn socket đồng bộ tua thời gian
  const emitSeekSync = (targetSeconds: number) => {
    if (!socket || !isHost) return;
    socket.emit("manga:seek_bgm", { roomId, currentTime: targetSeconds });
  };

  const handleApplyUrl = () => {
    let trimmed = inputUrl.trim();
    if (!trimmed) return;
    if (trimmed.includes("watchv=")) {
      trimmed = trimmed.replace("watchv=", "watch?v=");
    }
    setBgmUrl(trimmed);
    setIsPlaying(true);
    setCurrentSeconds(0);
    emitBgmSync(trimmed, true);
  };

  const handleTogglePlay = () => {
    const nextState = !isPlaying;
    setIsPlaying(nextState);
    if (nextState) {
      sendIframeCommand("playVideo");
    } else {
      sendIframeCommand("pauseVideo");
    }
    emitBgmSync(bgmUrl, nextState);
  };

  // Trưởng phòng tua +/- giây
  const handleSeekOffset = (offset: number) => {
    const nextTime = Math.max(0, currentSeconds + offset);
    setCurrentSeconds(nextTime);
    seekIframe(nextTime);
    emitSeekSync(nextTime);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpenMenu(!isOpenMenu)}
        className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition border cursor-pointer select-none ${
          isPlaying && videoId
            ? "bg-purple-950/60 border-purple-500/60 text-purple-300 shadow-sm shadow-purple-900/50"
            : "bg-gray-800 border-gray-700 text-gray-300 hover:text-white"
        }`}
      >
        <span>{isPlaying && videoId ? "🎵 Đang phát" : "🎶 Nhạc nền"}</span>
      </button>

      {isOpenMenu && (
        <div className="absolute bottom-12 right-0 bg-[#16181f] border border-gray-700 p-3.5 rounded-xl shadow-2xl w-80 z-50 flex flex-col gap-3">
          <div className="flex justify-between items-center pb-2 border-b border-gray-800">
            <span className="text-xs font-bold text-white flex items-center gap-1.5">
              <span>🎧 Nhạc nền phòng đọc</span>
            </span>
            <button
              type="button"
              onClick={() => setIsOpenMenu(false)}
              className="text-xs text-gray-400 hover:text-white cursor-pointer"
            >
              ✕
            </button>
          </div>

          {isHost ? (
            <div className="flex flex-col gap-1.5">
              <span className="text-[11px] text-gray-400">Dán link YouTube:</span>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  placeholder="https://www.youtube.com/watch?v=..."
                  value={inputUrl}
                  onChange={(e) => setInputUrl(e.target.value)}
                  className="flex-1 bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs text-white focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleApplyUrl}
                  className="px-2.5 py-1 bg-purple-600 hover:bg-purple-500 text-white rounded text-xs font-bold transition cursor-pointer"
                >
                  Phát
                </button>
              </div>
            </div>
          ) : (
            <p className="text-[11px] text-gray-400 italic">
              {videoId ? "Nhạc đang được đồng bộ từ Trưởng phòng" : "Trưởng phòng chưa chọn bài nhạc nào"}
            </p>
          )}

          {/* Iframe YouTube Native */}
          {videoId ? (
            <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-black border border-gray-800">
              <iframe
                ref={iframeRef}
                key={videoId}
                src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&enablejsapi=1&playsinline=1`}
                title="YouTube BGM"
                className="w-full h-full border-0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          ) : bgmUrl ? (
            <div className="text-xs text-red-400 py-2 text-center bg-red-950/20 border border-red-900/40 rounded">
              Đường link không hợp lệ!
            </div>
          ) : null}

          {/* CỤM ĐIỀU KHIỂN & TUA DÀNH CHO TRƯỞNG PHÒNG */}
          {videoId && isHost && (
            <div className="flex flex-col gap-2 pt-1 border-t border-gray-800">
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-400">Đồng bộ cả phòng:</span>
                <button
                  type="button"
                  onClick={handleTogglePlay}
                  className={`px-3 py-1 rounded text-xs font-bold transition cursor-pointer ${
                    isPlaying
                      ? "bg-amber-600/30 text-amber-300 border border-amber-500/40 hover:bg-amber-600/50"
                      : "bg-emerald-600 hover:bg-emerald-500 text-white"
                  }`}
                >
                  {isPlaying ? "⏸️ Tạm dừng" : "▶️ Tiếp tục"}
                </button>
              </div>

              {/* Cụm nút tua đồng bộ */}
              <div className="flex items-center justify-between bg-gray-900/80 p-1.5 rounded-lg border border-gray-800">
                <span className="text-[11px] text-gray-400">Tua đồng bộ:</span>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleSeekOffset(-10)}
                    className="px-2 py-0.5 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded text-xs font-semibold cursor-pointer border border-gray-700"
                    title="Lùi 10 giây"
                  >
                    ⏪ -10s
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSeekOffset(10)}
                    className="px-2 py-0.5 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded text-xs font-semibold cursor-pointer border border-gray-700"
                    title="Tiến 10 giây"
                  >
                    +10s ⏩
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}