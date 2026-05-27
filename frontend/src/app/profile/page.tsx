"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";

// Định nghĩa kiểu dữ liệu cho từng loại
interface MangaHistoryItem {
  id: string;
  updatedAt: string;
  manga: { id: string; title: string; coverImage: string | null };
  chapter: { id: string; title: string };
}

interface AnimeHistoryItem {
  id: string;
  updatedAt: string;
  anime: { id: string; title: string; coverImage: string | null };
  episode: { id: string; title: string };
}

// Tạo kiểu hợp nhất (Union) để TypeScript hiểu "item" có thể là 1 trong 2
type HistoryUnion = 
  | (MangaHistoryItem & { type: 'manga' }) 
  | (AnimeHistoryItem & { type: 'anime' });

export default function ProfilePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [mangaHistory, setMangaHistory] = useState<MangaHistoryItem[]>([]);
  const [animeHistory, setAnimeHistory] = useState<AnimeHistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      if (!session?.user?.id) return;
      try {
        const res = await fetch(`http://localhost:5000/api/history/${session.user.id}`);
        if (res.ok) {
          const data = await res.json();
          // Đảm bảo dữ liệu luôn là mảng để tránh lỗi undefined
          setMangaHistory(data.mangaHistory || []);
          setAnimeHistory(data.animeHistory || []);
        }
      } catch (error) {
        console.error("Lỗi lấy lịch sử:", error);
      } finally {
        setLoadingHistory(false);
      }
    };
    
    if (session?.user?.id) {
      fetchHistory();
    }
  }, [session?.user?.id]);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  if (status === "loading") {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0f0f11]">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin shadow-[0_0_15px_rgba(59,130,246,0.5)]"></div>
      </div>
    );
  }

  if (!session?.user) return null;

  // ==========================================
  // XỬ LÝ LỖI PHÂN QUYỀN
  // Lấy role từ session để hiển thị động
  // ==========================================
  const isAdmin = session.user.role === "ADMIN";
  const roleText = isAdmin ? "ADMIN" : "USER";
  const roleColor = isAdmin ? "text-red-400" : "text-blue-400";
  const roleBadge = isAdmin ? "bg-red-500/20 border-red-500/50" : "bg-blue-500/20 border-blue-500/50";
  const glowColor = isAdmin ? "bg-red-500" : "bg-blue-500";

  // ==========================================
  // XỬ LÝ DỮ LIỆU LỊCH SỬ GỘP (MANGA + ANIME)
  // ==========================================
  const combinedHistory: HistoryUnion[] = [
    ...(mangaHistory || []).map((item) => ({ ...item, type: "manga" as const })),
    ...(animeHistory || []).map((item) => ({ ...item, type: "anime" as const })),
  ].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  return (
    <div className="min-h-screen bg-[#0f0f11] text-white font-sans pb-12">
      
      {/* 1. COVER BANNER: Nâng cấp thành phong cách Dark Aesthetic */}
      <div className="relative h-64 md:h-80 w-full bg-gradient-to-br from-indigo-950 via-purple-950 to-black overflow-hidden">
        {/* Layer ảnh pattern mờ ảo */}
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1618336753974-aae8e04506aa?q=80&w=2070&auto=format&fit=crop')] bg-cover bg-center opacity-20 mix-blend-overlay"></div>
        {/* Gradient sương mù hòa trộn với background */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0f0f11] via-transparent to-transparent"></div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 md:px-8 relative z-10 -mt-24 md:-mt-32">
        {/* Khối Glassmorphism (Kính mờ) */}
        <div className="bg-gray-800/60 backdrop-blur-xl rounded-3xl shadow-2xl border border-gray-700/50 overflow-hidden">
          
          {/* HEADER: Avatar & Tên */}
          <div className="p-6 md:p-10 flex flex-col md:flex-row items-center md:items-end gap-6 border-b border-gray-700/50 relative">
            
            {/* Avatar phát sáng */}
            <div className="relative group shrink-0">
              <div className={`absolute inset-0 rounded-full blur-xl opacity-50 group-hover:opacity-100 transition duration-500 ${glowColor}`}></div>
              <img
                src={session.user.image || "https://www.svgrepo.com/show/507442/user-circle.svg"}
                alt="Avatar"
                className="relative w-32 h-32 md:w-40 md:h-40 rounded-full object-cover border-4 border-[#1a1a24] bg-gray-900 shadow-xl z-10"
              />
            </div>

            <div className="text-center md:text-left flex-1 mb-2">
              <h1 className="text-3xl md:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-400">
                {session.user.name || "Kẻ lang thang bí ẩn"}
              </h1>
              <p className="text-gray-400 mt-1.5 font-medium text-sm md:text-base">{session.user.email}</p>
            </div>

            {/* Huy hiệu Role nằm nổi bật ở góc */}
            <div className={`mb-4 md:mb-3 px-5 py-2 rounded-full border ${roleBadge} shadow-lg backdrop-blur-md flex items-center gap-2`}>
              <span className={`text-sm font-bold tracking-wider ${roleColor}`}>
                {isAdmin ? "👑 " : "🌟 "}{roleText}
              </span>
            </div>
          </div>

          {/* THANH ĐIỀU HƯỚNG TỦ TRUYỆN / PHIM */}
          <div className="bg-gray-900/40 p-6 md:px-10 flex flex-wrap gap-4 justify-center md:justify-start border-b border-gray-700/50">
            <Link 
              href="/profile/reading-list" 
              className="group relative overflow-hidden flex items-center gap-3 bg-blue-600/10 hover:bg-blue-600 text-blue-400 hover:text-white border border-blue-600/30 font-bold py-3 px-6 rounded-xl transition-all duration-300"
            >
              <span className="text-xl group-hover:scale-125 transition-transform">📚</span> 
              <span>Manga Collection</span>
            </Link>
            
            <Link 
              href="/profile/watching-list" 
              className="group relative overflow-hidden flex items-center gap-3 bg-purple-600/10 hover:bg-purple-600 text-purple-400 hover:text-white border border-purple-600/30 font-bold py-3 px-6 rounded-xl transition-all duration-300"
            >
              <span className="text-xl group-hover:scale-125 transition-transform">🎬</span> 
              <span>Anime Library</span>
            </Link>

            {/* Nút đặc quyền: Chỉ Admin mới thấy nút nhảy nhanh sang trang Quản trị */}
            {isAdmin && (
              <Link 
                href="/admin" 
                className="group md:ml-auto relative overflow-hidden flex items-center gap-3 bg-red-600/10 hover:bg-red-600 text-red-400 hover:text-white border border-red-600/30 font-bold py-3 px-6 rounded-xl transition-all duration-300"
              >
                <span className="text-xl group-hover:scale-125 transition-transform">⚙️</span> 
                <span>System Administration</span>
              </Link>
            )}
          </div>

          {/* KHOẢNG THÔNG TIN (INFO CARDS) */}
          <div className="p-6 md:p-10 grid grid-cols-1 md:grid-cols-2 gap-8">
            
            {/* Card 1: Account Details */}
            <div className="bg-gray-900/60 p-6 rounded-2xl border border-gray-700/50 hover:border-gray-500 transition duration-300 shadow-inner group">
              <h3 className="text-lg font-bold text-gray-200 mb-6 flex items-center gap-2">
                <span className="text-blue-500 text-xl group-hover:rotate-180 transition-transform duration-500">❖</span> Account Information
              </h3>
              <ul className="space-y-4 text-sm text-gray-400">
                <li className="flex justify-between items-center bg-gray-800/50 p-3.5 rounded-lg border border-gray-700/30">
                  <span className="font-medium">Status:</span>
                  <span className="flex items-center gap-2 text-green-400 font-bold">
                    <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_#22c55e]"></span>
                    Active
                  </span>
                </li>
                <li className="flex justify-between items-center bg-gray-800/50 p-3.5 rounded-lg border border-gray-700/30">
                  <span className="font-medium">Role:</span>
                  <span className={`${roleColor} font-bold`}>{roleText}</span>
                </li>
              </ul>
            </div>

            {/* Card 2: Recent Activity */}
            <div className="bg-gray-900/60 p-6 rounded-2xl border border-gray-700/50 hover:border-gray-500 transition duration-300 shadow-inner group">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold text-gray-200 flex items-center gap-2">
                  <span className="text-purple-500 text-xl group-hover:animate-spin">⟳</span> Recent Activity
                </h3>
              </div>

              {loadingHistory ? (
                <div className="text-center text-gray-500 py-4">Loading history...</div>
              ) : combinedHistory.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 text-center bg-gray-800/30 rounded-lg border border-gray-700/30 border-dashed">
                  <span className="text-3xl mb-2 opacity-30 grayscale group-hover:grayscale-0 transition">📭</span>
                  <p className="text-sm text-gray-500 italic">
                    No activity history available.<br/>Lets start your journey now!
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {combinedHistory.map((item) => {
                    // Phân loại logic hiển thị dựa trên type
                    const isManga = item.type === "manga";
                    const linkUrl = isManga 
                      ? `/manga/${item.manga.id}/chapter/${item.chapter.id}` 
                      : `/anime/${item.anime.id}/watch/${item.episode.id}`;
                    const coverImg = isManga ? item.manga.coverImage : item.anime.coverImage;
                    const mainTitle = isManga ? item.manga.title : item.anime.title;
                    const subTitle = isManga 
                      ? <><span className="text-blue-400">Reading:</span> {item.chapter.title}</>
                      : <><span className="text-purple-400">Watching:</span> {item.episode.title}</>;

                    return (
                      <Link 
                        key={`${item.type}-${item.id}`} 
                        href={linkUrl}
                        className="flex items-center gap-4 p-3 bg-gray-800/40 hover:bg-gray-700/50 rounded-xl border border-transparent hover:border-gray-600 transition-all"
                      >
                        {/* Bìa mini */}
                        <div className="w-12 h-16 shrink-0 bg-gray-800 rounded-md overflow-hidden relative">
                          {/* Tag nhỏ hiển thị Manga hay Anime */}
                          <div className={`absolute top-0 left-0 text-[8px] font-bold px-1 py-0.5 rounded-br-md z-10 text-white ${isManga ? 'bg-blue-600' : 'bg-purple-600'}`}>
                            {isManga ? 'MANGA' : 'ANIME'}
                          </div>
                          
                          {coverImg ? (
                            <img src={coverImg} alt={mainTitle} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full text-[8px] text-gray-500 flex items-center justify-center">No Img</div>
                          )}
                        </div>
                        
                        {/* Thông tin */}
                        <div className="flex-1 min-w-0">
                          <h4 className="font-bold text-sm text-gray-200 truncate group-hover:text-purple-400">
                            {mainTitle}
                          </h4>
                          <p className="text-xs text-gray-400 mt-1 truncate">
                            {subTitle}
                          </p>
                          <p className="text-[10px] text-gray-500 mt-1">
                            {new Date(item.updatedAt).toLocaleString("vi-VN", { 
                              hour: '2-digit', minute: '2-digit', 
                              day: '2-digit', month: '2-digit', year: 'numeric' 
                            })}
                          </p>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}