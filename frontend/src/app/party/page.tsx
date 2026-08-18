"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function WatchPartyLobby() {
  const { data: session } = useSession();
  const router = useRouter();

  const [inviteCode, setInviteCode] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [roomName, setRoomName] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);

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
          // Có thể truyền animeId và episodeId vào đây nếu mún gọi từ trang chi tiết Anime
          animeId: null, 
          episodeId: null
        })
      });

      if (res.ok) {
        const data = await res.json();
        // Chuyển hướng thẳng vào phòng vừa tạo bằng Mã mời
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
  // HÀM VÀO PHÒNG BẰNG MÃ (HOẶC LINK)
  // ==========================================
  const handleJoinRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteCode.trim()) return;
    router.push(`/party/${inviteCode.trim().toUpperCase()}`);
  };

  return (
    <div className="min-h-screen bg-[#0f0f11] text-white flex flex-col items-center justify-center p-4">
      

      <div className="text-center mb-10">
        <h1 className="text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500 mb-4">
          Cày Phim Cùng Nhau
        </h1>
        <p className="text-gray-400 max-w-lg mx-auto">
          Tạo phòng chiếu riêng tư, mời bạn bè và cùng nhau thưởng thức những bộ Anime đỉnh cao với tính năng đồng bộ thời gian thực!
        </p>
      </div>

      <div className="w-full max-w-4xl grid md:grid-cols-2 gap-6">
        
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
          
          <form onSubmit={handleJoinRoom} className="flex-1 flex flex-col justify-center">
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
    </div>
  );
}