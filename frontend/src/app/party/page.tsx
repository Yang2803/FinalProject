"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

// 🌟 ĐÃ SỬA LỖI ANY Ở ĐÂY: Khai báo rõ ràng cấu trúc của members
interface ActiveRoom {
  id: string;
  name: string;
  inviteCode: string;
  isPrivate: boolean;
  host: { id: string; name: string; image: string | null };
  members: { id: string; status: string }[]; 
  anime?: { title: string } | null;
  episode?: { title: string } | null;
}

export default function WatchPartyLobby() {
  const { data: session } = useSession();
  const router = useRouter();

  const [inviteCode, setInviteCode] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [roomName, setRoomName] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);

  // 🌟 STATE QUẢN LÝ DANH SÁCH PHÒNG
  const [activeRooms, setActiveRooms] = useState<ActiveRoom[]>([]);
  const [isLoadingRooms, setIsLoadingRooms] = useState(true);
  
  // 🌟 THÊM 1 STATE "CHÌA KHÓA" ĐỂ KÍCH HOẠT TẢI LẠI TRANG
  const [refreshKey, setRefreshKey] = useState(0);

  // ==========================================
  // HÀM LẤY DANH SÁCH PHÒNG TỪ SERVER (VIẾT GỌN VÀO TRONG EFFECT)
  // ==========================================
  useEffect(() => {
    let isMounted = true; // Cờ an toàn để tránh set state khi component đã unmount

    const loadRooms = async () => {
      try {
        const res = await fetch("http://localhost:5000/api/party/rooms");
        if (res.ok) {
          const data = await res.json();
          if (isMounted) setActiveRooms(data);
        }
      } catch (error) {
        console.error("Lỗi tải danh sách phòng:", error);
      } finally {
        if (isMounted) setIsLoadingRooms(false);
      }
    };

    loadRooms();

    return () => {
      isMounted = false; // Dọn dẹp cờ khi thoát trang
    };
  }, [refreshKey]); // 🌟 Effect này sẽ tự động chạy lại mỗi khi refreshKey thay đổi

  // ==========================================
  // HÀM XỬ LÝ NÚT LÀM MỚI
  // ==========================================
  const handleRefreshRooms = () => {
    setIsLoadingRooms(true);
    setRefreshKey(prev => prev + 1); // 🌟 Tăng key lên 1 -> Kích hoạt useEffect bên trên chạy lại
  };

  // ==========================================
  // HÀM TẠO PHÒNG MỚI
  // ==========================================
  const handleCreateRoom = async () => {
    if (!session?.user?.id) return alert("Vui lòng đăng nhập để tạo phòng!");
    if (!roomName.trim()) return alert("Vui lòng đặt tên cho phòng chiếu của bạn!");

    setIsCreating(true);
    try {
      const res = await fetch("http://localhost:5000/api/party/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: roomName,
          isPrivate: isPrivate,
          hostId: session.user.id,
          animeId: null, 
          episodeId: null
        })
      });

      if (res.ok) {
        const data = await res.json();
        router.push(`/party/${data.room.inviteCode}`);
      } else {
        alert("Có lỗi xảy ra khi tạo phòng.");
      }
    } catch (error) {
      console.error(error);
      alert("Lỗi kết nối đến Server.");
    } finally {
      setIsCreating(false);
    }
  };

  // ==========================================
  // HÀM VÀO PHÒNG BẰNG MÃ
  // ==========================================
  const handleJoinRoom = (e?: React.FormEvent, code?: string) => {
    e?.preventDefault();
    const targetCode = code || inviteCode;
    if (!targetCode.trim()) return;
    router.push(`/party/${targetCode.trim().toUpperCase()}`);
  };

  return (
    <div className="min-h-screen bg-[#0f0f11] text-white p-6 md:p-12 overflow-y-auto">
      
      <div className="max-w-6xl mx-auto">
        {/* === HEADER === */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500 mb-4">
            Cày Phim Cùng Nhau
          </h1>
          <p className="text-gray-400 max-w-lg mx-auto">
            Tạo phòng chiếu riêng tư, mời bạn bè và cùng nhau thưởng thức những bộ Anime đỉnh cao với tính năng đồng bộ thời gian thực!
          </p>
        </div>

        {/* === GRID 2 THẺ: TẠO PHÒNG & VÀO PHÒNG === */}
        <div className="grid md:grid-cols-2 gap-6 mb-16">
          
          {/* CARD 1: TẠO PHÒNG MỚI */}
          <div className="bg-[#1a1d24] p-8 rounded-2xl border border-blue-900/50 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-blue-500"></div>
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
              🍿 Tạo Phòng Mới
            </h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-400 mb-2">Tên phòng chiếu</label>
                <input 
                  type="text" 
                  placeholder="VD: Cày cuốc Wano Quốc đêm nay..." 
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-800 rounded-lg px-4 py-3 outline-none focus:border-blue-500 transition text-white"
                />
              </div>
              
              <div className="flex items-center gap-3 bg-gray-900/50 p-3 rounded-lg border border-gray-800">
                <input 
                  type="checkbox" 
                  id="private-mode"
                  checked={isPrivate}
                  onChange={(e) => setIsPrivate(e.target.checked)}
                  className="w-5 h-5 accent-blue-600 rounded"
                />
                <label htmlFor="private-mode" className="text-sm font-medium cursor-pointer flex-1">
                  Phòng Kín (Private)
                  <p className="text-xs text-gray-500 mt-0.5">Yêu cầu Trưởng phòng duyệt trước khi vào.</p>
                </label>
              </div>

              <button 
                onClick={handleCreateRoom}
                disabled={isCreating || !session}
                className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold py-3 rounded-lg mt-4 transition shadow-lg shadow-blue-900/20"
              >
                {isCreating ? "Đang tạo phòng..." : session ? "Tạo Phòng Ngay" : "Vui lòng Đăng nhập"}
              </button>
            </div>
          </div>

          {/* CARD 2: THAM GIA BẰNG MÃ MỜI */}
          <div className="bg-[#1a1d24] p-8 rounded-2xl border border-purple-900/50 shadow-2xl relative overflow-hidden flex flex-col">
            <div className="absolute top-0 left-0 w-full h-1 bg-purple-500"></div>
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
              🎟️ Vào Phòng
            </h2>
            
            <form onSubmit={(e) => handleJoinRoom(e)} className="flex-1 flex flex-col justify-center">
              <p className="text-gray-400 text-sm mb-4">Bạn có mã mời (Invite Code) từ bạn bè? Nhập vào đây để tham gia phòng chiếu ngay lập tức.</p>
              
              <div className="flex flex-col gap-4">
                <input 
                  type="text" 
                  placeholder="Nhập mã gồm 6 ký tự (VD: X7K9P2)" 
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value)}
                  maxLength={6}
                  className="w-full bg-gray-900 border border-gray-800 rounded-lg px-4 py-4 outline-none focus:border-purple-500 transition text-white text-center text-xl font-bold tracking-widest uppercase"
                />
                <button 
                  type="submit"
                  disabled={!inviteCode.trim() || inviteCode.length < 6}
                  className="w-full bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-bold py-3 rounded-lg transition shadow-lg shadow-purple-900/20"
                >
                  Tham Gia Kênh
                </button>
              </div>
            </form>
          </div>

        </div>

        {/* === DANH SÁCH PHÒNG ĐANG HOẠT ĐỘNG === */}
        <div className="mb-10 flex items-center justify-between">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-red-500 animate-pulse"></span>
            Phòng đang phát sóng
          </h2>
          <button 
            onClick={handleRefreshRooms} // 🌟 GỌI HÀM LÀM MỚI Ở ĐÂY
            className="text-sm font-bold text-gray-400 hover:text-white flex items-center gap-2 bg-gray-900 hover:bg-gray-800 px-4 py-2 rounded-lg border border-gray-800 transition"
          >
            <svg className={`w-4 h-4 ${isLoadingRooms ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            Làm mới
          </button>
        </div>

        {isLoadingRooms ? (
          <div className="flex justify-center py-12">
            <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : activeRooms.length === 0 ? (
          <div className="bg-[#1a1d24] border border-gray-800 rounded-xl p-12 text-center">
            <span className="text-4xl block mb-4">👻</span>
            <h3 className="text-xl font-bold text-gray-300 mb-2">Chưa có phòng nào đang Live!</h3>
            <p className="text-gray-500">Hãy là người đầu tiên tạo phòng và rủ bạn bè vào xem nhé.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {activeRooms.map((r) => (
              <div key={r.id} className="bg-[#1a1d24] border border-gray-800 hover:border-blue-500/50 rounded-xl p-5 transition hover:shadow-lg hover:shadow-blue-900/10 group flex flex-col">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="font-bold text-lg text-gray-200 group-hover:text-blue-400 transition line-clamp-2">
                    {r.name}
                  </h3>
                  {r.isPrivate ? (
                    <span className="bg-red-500/10 text-red-400 text-xs font-bold px-2 py-1 rounded border border-red-500/20 shrink-0 ml-2">Private 🔒</span>
                  ) : (
                    <span className="bg-green-500/10 text-green-400 text-xs font-bold px-2 py-1 rounded border border-green-500/20 shrink-0 ml-2">Public 🌍</span>
                  )}
                </div>

                <div className="flex items-center gap-3 mb-4">
                  {r.host?.image ? (
                    <img src={r.host.image} alt={r.host.name} className="w-8 h-8 rounded-full bg-gray-700 object-cover" />
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
                  <p className="text-xs text-gray-400 mb-1">Đang chiếu:</p>
                  <p className="text-sm font-medium text-gray-200 line-clamp-1">
                    {r.anime ? `${r.anime.title} - ${r.episode?.title}` : "Chưa chọn phim"}
                  </p>
                </div>

                <div className="flex items-center justify-between mt-auto">
                  <span className="text-sm text-gray-400 flex items-center gap-1.5">
                    👥 {r.members?.length || 1} người đang xem
                  </span>
                  <button 
                    onClick={() => handleJoinRoom(undefined, r.inviteCode)}
                    className="bg-gray-800 hover:bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold transition"
                  >
                    Tham gia ngay
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