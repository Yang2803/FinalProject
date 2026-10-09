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
       const resRoom = await fetch("http://localhost:5000/api/manga-room/rooms");
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
      const res = await fetch("http://localhost:5000/api/party/rooms", {
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
    <div className="min-h-screen bg-[#0f0f11] text-white p-6 md:p-12 overflow-y-auto">
      <div className="max-w-6xl mx-auto">
        {/* === HEADER === */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-500 mb-4">
            Đọc Truyện Cùng Nhau
          </h1>
          <p className="text-gray-400 max-w-lg mx-auto">
            Tạo phòng đọc Manga trực tiếp, đồng bộ thao tác lật trang, cuộn dọc và trỏ Laser cùng bạn bè theo thời gian thực!
          </p>
        </div>

        {/* === GRID 2 THẺ: TẠO PHÒNG & NHẬP MÃ === */}
        <div className="grid md:grid-cols-2 gap-6 mb-16">
          {/* CARD 1: TẠO PHÒNG */}
          <div className="bg-[#1a1d24] p-8 rounded-2xl border border-emerald-900/50 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-emerald-500"></div>
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
              📖 Tạo Phòng Đọc Mới
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-400 mb-2">Tên phòng đọc</label>
                <input
                  type="text"
                  placeholder="VD: Cùng cày Jujutsu Kaisen tối nay..."
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-800 rounded-lg px-4 py-3 outline-none focus:border-emerald-500 transition text-white"
                />
              </div>

              <div className="flex items-center gap-3 bg-gray-900/50 p-3 rounded-lg border border-gray-800">
                <input
                  type="checkbox"
                  id="private-manga-mode"
                  checked={isPrivate}
                  onChange={(e) => setIsPrivate(e.target.checked)}
                  className="w-5 h-5 accent-emerald-600 rounded"
                />
                <label htmlFor="private-manga-mode" className="text-sm font-medium cursor-pointer flex-1">
                  Phòng Kín (Private)
                  <p className="text-xs text-gray-500 mt-0.5">Yêu cầu Trưởng phòng duyệt trước khi vào đọc.</p>
                </label>
              </div>

              <button
                onClick={handleCreateRoom}
                disabled={isCreating || !session}
                className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold py-3 rounded-lg mt-4 transition shadow-lg shadow-emerald-900/20"
              >
                {isCreating ? "Đang tạo phòng..." : session ? "Tạo Phòng Đọc Ngay" : "Vui lòng Đăng nhập"}
              </button>
            </div>
          </div>

          {/* CARD 2: VÀO PHÒNG BẰNG MÃ */}
          <div className="bg-[#1a1d24] p-8 rounded-2xl border border-cyan-900/50 shadow-2xl relative overflow-hidden flex flex-col">
            <div className="absolute top-0 left-0 w-full h-1 bg-cyan-500"></div>
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
              🎟️ Vào Phòng Bằng Mã
            </h2>

            <form onSubmit={(e) => handleJoinRoom(e)} className="flex-1 flex flex-col justify-center">
              <p className="text-gray-400 text-sm mb-4">
                Nhập mã mời (Invite Code) gồm 6 chữ số từ bạn bè để tham gia cùng đọc manga.
              </p>

              <div className="flex flex-col gap-4">
                <input
                  type="text"
                  placeholder="Nhập mã (VD: MG8K92)"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value)}
                  maxLength={6}
                  className="w-full bg-gray-900 border border-gray-800 rounded-lg px-4 py-4 outline-none focus:border-cyan-500 transition text-white text-center text-xl font-bold tracking-widest uppercase"
                />
                <button
                  type="submit"
                  disabled={!inviteCode.trim() || inviteCode.length < 6}
                  className="w-full bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-bold py-3 rounded-lg transition shadow-lg shadow-cyan-900/20"
                >
                  Tham Gia Phòng
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* === DANH SÁCH CÁC PHÒNG ĐANG MỞ === */}
        <div className="mb-10 flex items-center justify-between">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse"></span>
            Phòng đọc đang mở
          </h2>
          <button
            onClick={handleRefreshRooms}
            className="text-sm font-bold text-gray-400 hover:text-white flex items-center gap-2 bg-gray-900 hover:bg-gray-800 px-4 py-2 rounded-lg border border-gray-800 transition"
          >
            <svg
              className={`w-4 h-4 ${isLoadingRooms ? "animate-spin" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Làm mới
          </button>
        </div>

        {isLoadingRooms ? (
          <div className="flex justify-center py-12">
            <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : activeRooms.length === 0 ? (
          <div className="bg-[#1a1d24] border border-gray-800 rounded-xl p-12 text-center">
            <span className="text-4xl block mb-4">📚</span>
            <h3 className="text-xl font-bold text-gray-300 mb-2">Chưa có phòng đọc nào!</h3>
            <p className="text-gray-500">Hãy tạo phòng đầu tiên và rủ bạn bè vào cùng đọc nhé.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {activeRooms.map((r) => (
              <div
                key={r.id}
                className="bg-[#1a1d24] border border-gray-800 hover:border-emerald-500/50 rounded-xl p-5 transition hover:shadow-lg hover:shadow-emerald-900/10 group flex flex-col"
              >
                <div className="flex justify-between items-start mb-4">
                  <h3 className="font-bold text-lg text-gray-200 group-hover:text-emerald-400 transition line-clamp-2">
                    {r.name}
                  </h3>
                  {r.isPrivate ? (
                    <span className="bg-red-500/10 text-red-400 text-xs font-bold px-2 py-1 rounded border border-red-500/20 shrink-0 ml-2">
                      Private 🔒
                    </span>
                  ) : (
                    <span className="bg-emerald-500/10 text-emerald-400 text-xs font-bold px-2 py-1 rounded border border-emerald-500/20 shrink-0 ml-2">
                      Public 🌍
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3 mb-4">
                  {r.host?.image ? (
                    <img src={r.host.image} alt={r.host.name || "Host"} className="w-8 h-8 rounded-full bg-gray-700 object-cover" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center font-bold text-xs">
                      {r.host?.name?.charAt(0).toUpperCase() || "H"}
                    </div>
                  )}
                  <div>
                    <p className="text-xs text-gray-500">Trưởng phòng</p>
                    <p className="text-sm font-semibold">{r.host?.name || "Ẩn danh"}</p>
                  </div>
                </div>

                <div className="bg-gray-900/50 rounded-lg p-3 mb-5 border border-gray-800 flex-1">
                  <p className="text-xs text-gray-400 mb-1">Đang đọc:</p>
                  <p className="text-sm font-medium text-gray-200 line-clamp-1">
                    {r.manga ? `${r.manga.title} - ${r.chapter?.title || ""}` : "Trưởng phòng chưa chọn truyện"}
                  </p>
                </div>

                <div className="flex items-center justify-between mt-auto">
                  <span className="text-sm text-gray-400 flex items-center gap-1.5">
                    👥 {r.members?.length || 1} người đang đọc
                  </span>
                  <button
                    onClick={() => handleJoinRoom(undefined, r.inviteCode)}
                    className="bg-gray-800 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-bold transition"
                  >
                    Vào đọc ngay
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}