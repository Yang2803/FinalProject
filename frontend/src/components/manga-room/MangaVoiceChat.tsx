"use client";

import { useEffect, useState } from "react";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useLocalParticipant,
  useParticipants,
} from "@livekit/components-react";
import "@livekit/components-styles";

// Component con: Nút Bật/Tắt Microphone & Trạng thái phát âm
function VoiceControls() {
  const { localParticipant } = useLocalParticipant();
  const participants = useParticipants();
  const [isMicEnabled, setIsMicEnabled] = useState(false);

  const toggleMic = async () => {
    if (!localParticipant) return;
    const nextState = !localParticipant.isMicrophoneEnabled;
    await localParticipant.setMicrophoneEnabled(nextState);
    setIsMicEnabled(nextState);
  };

  return (
    <div className="flex items-center gap-3">
      {/* Nút bấm Mic */}
      <button
        onClick={toggleMic}
        type="button"
        className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition select-none ${
          isMicEnabled
            ? "bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/40 animate-pulse"
            : "bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700"
        }`}
      >
        <span>{isMicEnabled ? "🎙️ Mic Đang Bật" : "🔇 Mic Đang Tắt"}</span>
      </button>

      {/* Danh sách avatar những người đang trong kênh Voice */}
      <div className="flex items-center -space-x-1.5 overflow-hidden">
        {participants.map((p) => {
          const isSpeaking = p.isSpeaking;
          return (
            <div
              key={p.identity}
              title={`${p.name || p.identity} ${isSpeaking ? "(Đang nói...)" : ""}`}
              className={`w-6 h-6 rounded-full bg-gray-700 flex items-center justify-center text-[10px] font-bold border-2 transition-all ${
                isSpeaking
                  ? "border-emerald-400 scale-110 shadow-[0_0_8px_#34d399]"
                  : "border-gray-900 text-gray-300"
              }`}
            >
              {p.name?.charAt(0).toUpperCase() || "U"}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Component chính bao bọc LiveKit Room
export function MangaVoiceChat({
  roomId,
  userId,
  userName,
}: {
  roomId: string;
  userId: string;
  userName: string;
}) {
  const [token, setToken] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchToken = async () => {
      try {
        const res = await fetch(
          `http://localhost:5000/api/manga-room/rooms/${roomId}/voice-token?userId=${encodeURIComponent(
            userId
          )}&userName=${encodeURIComponent(userName)}`
        );
        if (!res.ok) throw new Error("Không lấy được token đàm thoại.");
        const data = await res.json();
        setToken(data.token);
      } catch (err: unknown) {
      console.error("Voice chat error:", err);
      const errorMessage = err instanceof Error ? err.message : "Đã xảy ra lỗi Voice Chat";
      setError(errorMessage);
    }
    };

    if (roomId && userId) {
      fetchToken();
    }
  }, [roomId, userId, userName]);

  if (error) {
    return <span className="text-xs text-red-400">Lỗi Voice Chat</span>;
  }

  if (!token) {
    return <span className="text-xs text-gray-500 animate-pulse">Kết nối Voice...</span>;
  }

  return (
    <LiveKitRoom
      token={token}
      serverUrl={process.env.NEXT_PUBLIC_LIVEKIT_URL}
      connect={true}
      audio={true}
      video={false}
    >
      <VoiceControls />
      {/* Tự động phát âm thanh của những người khác */}
      <RoomAudioRenderer />
    </LiveKitRoom>
  );
}