"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

// =====================================================================
// INTERFACES (Đảm bảo Type-safety tuyệt đối, không dùng any)
// =====================================================================
interface MangaRoomMember {
  id: string;
  status?: string;
}

interface MangaRoomHost {
  id: string;
  name: string | null;
  image: string | null;
}

interface ActiveMangaRoom {
  id: string;
  name: string;
  inviteCode: string;
  isPrivate: boolean;
  host: MangaRoomHost;
  members: MangaRoomMember[];
  manga?: { title: string } | null;
  chapter?: { title: string } | null;
}

export default function MangaCoReadingLobby() {
  const { data: session } = useSession();
  const router = useRouter();

  const [inviteCode, setInviteCode] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [roomName, setRoomName] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);

  // State quản lý danh sách phòng Co-reading
  const [activeRooms, setActiveRooms] = useState<ActiveMangaRoom[]>([]);
  const [isLoadingRooms, setIsLoadingRooms] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  // ==========================================
  // LẤY DANH SÁCH PHÒNG TỪ BACKEND
  // ==========================================
  useEffect(() => {
    let isMounted = true;

    const loadRooms = async () => {
      try {
       const resRoom = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/manga-room/rooms`);
        if (resRoom.ok) {
          const data: ActiveMangaRoom[] = await resRoom.json();
          if (isMounted) setActiveRooms(data);
        }
      } catch (error) {
        console.error("Lỗi tải danh sách phòng đọc:", error);
      } finally {
        if (isMounted) setIsLoadingRooms(false);
      }
    };

    loadRooms();

    return () => {
      isMounted = false;
    };
  }, [refreshKey]);

  const handleRefreshRooms = () => {
    setIsLoadingRooms(true);
    setRefreshKey((prev) => prev + 1);
  };

  // ==========================================
  // TẠO PHÒNG MỚI (CHƯA CẦN CHỌN TRUYỆN TRƯỚC)
  // ==========================================
  const handleCreateRoom = async () => {
    if (!session?.user?.id) return alert("Vui lòng đăng nhập để tạo phòng!");
    if (!roomName.trim()) return alert("Vui lòng đặt tên cho phòng đọc của bạn!");

    setIsCreating(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/manga-room/rooms`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: roomName,
          isPrivate: isPrivate,
          hostId: session.user.id,
          type: "MANGA",
          mangaId: null,
          chapterId: null,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        router.push(`/manga-room/${data.room.inviteCode || data.room.id}`);
      } else {
        alert("Có lỗi xảy ra khi tạo phòng đọc.");
      }
    } catch (error) {
      console.error(error);
      alert("Lỗi kết nối đến Server.");
    } finally {
      setIsCreating(false);
    }
  };

  // ==========================================
  // THAM GIA BẰNG INVITE CODE
  // ==========================================
  const handleJoinRoom = (e?: React.FormEvent, code?: string) => {
    e?.preventDefault();
    const targetCode = code || inviteCode;
    if (!targetCode.trim()) return;
    router.push(`/manga-room/${targetCode.trim().toUpperCase()}`);
  };

  return (
    <div className="min-h-screen bg-[#0f0f11] text-white p-4 sm:p-8 md:p-12 relative overflow-hidden select-none">
      {/* Hiệu ứng ánh sáng nền (Ambient Background Glow) */}
      <div className="absolute -top-32 left-1/4 w-96 h-96 bg-emerald-600/15 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute top-40 right-1/4 w-96 h-96 bg-cyan-600/15 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-6xl mx-auto relative z-10 space-y-12">
        
        {/* ===================================================================== */}
        {/* 🌟 1. HERO HEADER BANNER */}
        {/* ===================================================================== */}
        <div className="relative rounded-3xl bg-gradient-to-b from-[#161922] to-[#12141c] border border-white/[0.08] p-8 md:p-10 text-center shadow-2xl overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.12),transparent_60%)] pointer-events-none" />

          <div className="relative z-10 max-w-2xl mx-auto space-y-4">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-extrabold uppercase tracking-wider">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span>Real-time Co-Reading Space</span>
            </div>

            <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-200 to-cyan-400 leading-tight">
              Reading Together
            </h1>

            {/* Các huy hiệu tính năng của phòng đọc */}
            <div className="pt-2 flex flex-wrap items-center justify-center gap-2 text-xs font-semibold text-gray-300">
              <span className="px-3 py-1.5 rounded-xl bg-gray-900/80 border border-white/[0.06] flex items-center gap-1.5">
                📖 Synchronized page turning
              </span>
              <span className="px-3 py-1.5 rounded-xl bg-gray-900/80 border border-white/[0.06] flex items-center gap-1.5">
                🔦 Pointers & Laser Pens
              </span>
              <span className="px-3 py-1.5 rounded-xl bg-gray-900/80 border border-white/[0.06] flex items-center gap-1.5">
                🎵 General BGM
              </span>
              <span className="px-3 py-1.5 rounded-xl bg-gray-900/80 border border-white/[0.06] flex items-center gap-1.5">
                🎙️ Conversation
              </span>
            </div>
          </div>
        </div>

        {/* ===================================================================== */}
        {/* 🌟 2. GRID 2 THẺ: TẠO PHÒNG MỚI & VÀO PHÒNG BẰNG MÃ */}
        {/* ===================================================================== */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
          
          {/* CARD 1: TẠO PHÒNG ĐỌC MỚI */}
          <div className="group bg-[#151821]/90 backdrop-blur-xl p-7 md:p-8 rounded-3xl border border-emerald-500/20 hover:border-emerald-500/40 shadow-2xl relative overflow-hidden flex flex-col justify-between transition-all duration-300">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-500" />
            <div className="absolute -right-16 -top-16 w-40 h-40 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none group-hover:bg-emerald-500/20 transition" />

            <div>
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-2xl shadow-lg shadow-emerald-500/10">
                    📖
                  </div>
                  <div>
                    <h2 className="text-xl md:text-2xl font-extrabold text-white">
                      Create New Reading Room
                    </h2>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Become the host and control the manga reading experience
                    </p>
                  </div>
                </div>
                <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Host
                </span>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
                    Room Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., Let's read Jujutsu Kaisen together tonight..."
                    value={roomName}
                    onChange={(e) => setRoomName(e.target.value)}
                    className="w-full bg-gray-900/90 border border-gray-800 focus:border-emerald-500 rounded-xl px-4 py-3.5 text-sm outline-none transition text-white placeholder:text-gray-600 shadow-inner"
                  />
                </div>

                {/* Hộp chọn Phòng Kín (Private) hiện đại */}
                <label
                  htmlFor="private-manga-mode"
                  className={`flex items-center justify-between gap-4 p-4 rounded-2xl border cursor-pointer transition-all ${
                    isPrivate
                      ? "bg-emerald-950/30 border-emerald-500/50"
                      : "bg-gray-900/60 border-gray-800 hover:border-gray-700"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">🔒</span>
                    <div>
                      <p className="text-sm font-bold text-gray-200">
                        Private Room
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Requires host approval before joining.
                      </p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    id="private-manga-mode"
                    checked={isPrivate}
                    onChange={(e) => setIsPrivate(e.target.checked)}
                    className="w-5 h-5 accent-emerald-500 rounded cursor-pointer shrink-0"
                  />
                </label>
              </div>
            </div>

            <button
              onClick={handleCreateRoom}
              disabled={isCreating || !session}
              className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white font-bold py-3.5 rounded-xl mt-6 transition-all shadow-lg shadow-emerald-900/30 active:scale-[0.99] cursor-pointer flex items-center justify-center gap-2"
            >
              <span>{isCreating ? "⏳ Creating..." : session ? "✨ Create Reading Room" : "🔒 Please log in"}</span>
            </button>
          </div>

          {/* CARD 2: JOIN ROOM BY INVITE CODE */}
          <div className="group bg-[#151821]/90 backdrop-blur-xl p-7 md:p-8 rounded-3xl border border-cyan-500/20 hover:border-cyan-500/40 shadow-2xl relative overflow-hidden flex flex-col justify-between transition-all duration-300">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-cyan-500 via-sky-400 to-blue-500" />
            <div className="absolute -right-16 -top-16 w-40 h-40 bg-cyan-500/10 rounded-full blur-2xl pointer-events-none group-hover:bg-cyan-500/20 transition" />

            <div>
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-2xl shadow-lg shadow-cyan-500/10">
                    🎟️
                  </div>
                  <div>
                    <h2 className="text-xl md:text-2xl font-extrabold text-white">
                      Join Room by Invite Code
                    </h2>
                    <p className="text-xs text-gray-400 mt-0.5">
                      For guests with an invite code from friends
                    </p>
                  </div>
                </div>
                <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                  Quick Join
                </span>
              </div>

              <p className="text-gray-400 text-sm mb-5 leading-relaxed">
                Enter the invite code (<strong className="text-gray-200">Invite Code</strong>) with 6 characters from your friends to connect directly to the shared reading room.
              </p>
            </div>

            <form onSubmit={(e) => handleJoinRoom(e)} className="space-y-5 mt-auto">
              <div className="relative">
                <input
                  type="text"
                  placeholder="e.g., MG8K92"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                  maxLength={6}
                  className="w-full bg-gray-900/90 border-2 border-dashed border-gray-700 focus:border-cyan-500 rounded-2xl px-4 py-4 outline-none transition text-cyan-300 text-center text-2xl font-black tracking-[0.35em] uppercase placeholder:text-gray-600 placeholder:tracking-normal placeholder:text-base placeholder:font-semibold"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-500">
                  {inviteCode.length}/6
                </span>
              </div>

              <button
                type="submit"
                disabled={!inviteCode.trim() || inviteCode.length < 6}
                className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:opacity-50 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-cyan-900/30 active:scale-[0.99] cursor-pointer flex items-center justify-center gap-2"
              >
                <span>🚀 Join Room Now</span>
              </button>
            </form>
          </div>

        </div>

        {/* ===================================================================== */}
        {/* 🌟 3. DANH SÁCH CÁC PHÒNG ĐANG MỞ (LIVE ROOMS) */}
        {/* ===================================================================== */}
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/[0.07]">
            <div className="flex items-center gap-3">
              <span className="relative flex h-3.5 w-3.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500"></span>
              </span>
              <h2 className="text-2xl font-black text-white">
                Active Reading Rooms
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                {activeRooms.length} rooms
              </span>
            </div>

            <button
              onClick={handleRefreshRooms}
              className="self-start sm:self-auto text-xs font-bold text-gray-300 hover:text-white flex items-center gap-2 bg-[#161922] hover:bg-gray-800 px-4 py-2.5 rounded-xl border border-white/[0.08] transition cursor-pointer shadow-sm"
            >
              <svg
                className={`w-4 h-4 text-emerald-400 ${isLoadingRooms ? "animate-spin" : ""}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              <span>Refresh List</span>
            </button>
          </div>

          {isLoadingRooms ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-56 rounded-2xl bg-[#151821]/80 border border-white/[0.05] animate-pulse p-5"
                />
              ))}
            </div>
          ) : activeRooms.length === 0 ? (
            <div className="bg-[#151821]/80 border border-dashed border-gray-800 rounded-3xl p-12 text-center max-w-lg mx-auto my-6">
              <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-3xl mx-auto mb-4">
                📚
              </div>
              <h3 className="text-xl font-extrabold text-gray-200 mb-2">
                No active reading rooms available!
              </h3>
              <p className="text-sm text-gray-500">
                Please enter a room name in the field above to create your first reading room and invite friends to join.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {activeRooms.map((r) => (
                <div
                  key={r.id}
                  className="bg-[#151821]/90 hover:bg-[#191d28] border border-white/[0.07] hover:border-emerald-500/50 rounded-2xl p-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-emerald-950/30 group flex flex-col justify-between relative overflow-hidden"
                >
                  {/* Thanh sáng mảnh trên đỉnh thẻ */}
                  <div
                    className={`absolute top-0 left-0 w-full h-1 ${
                      r.isPrivate ? "bg-amber-500/70" : "bg-emerald-500"
                    }`}
                  />

                  <div>
                    {/* Hàng trên: Trạng thái Public/Private & Mã phòng */}
                    <div className="flex items-center justify-between gap-2 mb-3">
                      {r.isPrivate ? (
                        <span className="bg-amber-500/10 text-amber-400 text-[11px] font-extrabold px-2.5 py-1 rounded-full border border-amber-500/25 flex items-center gap-1">
                          🔒 Private Room
                        </span>
                      ) : (
                        <span className="bg-emerald-500/10 text-emerald-400 text-[11px] font-extrabold px-2.5 py-1 rounded-full border border-emerald-500/25 flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          Public
                        </span>
                      )}

                      <span className="text-[11px] font-mono font-bold text-gray-400 bg-gray-900 px-2.5 py-1 rounded-lg border border-gray-800">
                        #{r.inviteCode}
                      </span>
                    </div>

                    {/* Tên phòng */}
                    <h3 className="font-extrabold text-lg text-white group-hover:text-emerald-400 transition line-clamp-1 mb-4">
                      {r.name}
                    </h3>

                    {/* Thông tin Trưởng phòng */}
                    <div className="flex items-center gap-3 mb-4 pb-4 border-b border-white/[0.06]">
                      <div className="relative shrink-0">
                        {r.host?.image ? (
                          <img
                            src={r.host.image}
                            alt={r.host.name || "Host"}
                            className="w-9 h-9 rounded-full bg-gray-800 object-cover border border-emerald-500/40"
                          />
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-600 to-teal-700 flex items-center justify-center font-bold text-xs text-white">
                            {r.host?.name?.charAt(0).toUpperCase() || "H"}
                          </div>
                        )}
                        <span
                          className="absolute -top-1 -right-1 text-[10px]"
                          title="Host of the Room"
                        >
                          👑
                        </span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-[11px] text-gray-500 font-medium">Host of the Room</p>
                        <p className="text-sm font-bold text-gray-200 truncate">
                          {r.host?.name || "Ẩn danh"}
                        </p>
                      </div>
                    </div>

                    {/* Khung bộ truyện đang đọc */}
                    <div className="bg-gray-900/75 rounded-xl p-3.5 mb-5 border border-white/[0.05]">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-400/80 mb-1 flex items-center gap-1.5">
                        <span>📖 Currently Reading:</span>
                      </p>
                      <p className="text-sm font-bold text-gray-100 line-clamp-1">
                        {r.manga
                          ? `${r.manga.title}${r.chapter?.title ? ` • ${r.chapter.title}` : ""}`
                          : "The host is choosing a manga to read..."}
                      </p>
                    </div>
                  </div>

                  {/* Hàng cuối: Số người & Nút tham gia */}
                  <div className="flex items-center justify-between pt-1 mt-auto">
                    <span className="text-xs font-bold text-gray-400 bg-gray-900/80 px-3 py-1.5 rounded-lg border border-white/[0.05] flex items-center gap-1.5">
                      <span>👥</span>
                      <span>{r.members?.length || 1} readers</span>
                    </span>

                    <button
                      onClick={() => handleJoinRoom(undefined, r.inviteCode)}
                      className="bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-500/30 hover:border-emerald-500 px-4 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-1.5 shadow-sm"
                    >
                      <span>{r.isPrivate ? "Request to Join" : "Join Reading"}</span>
                      <span>&rarr;</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}