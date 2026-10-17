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

// Tạo kiểu hợp nhất (Union)
type HistoryUnion =
  | (MangaHistoryItem & { type: "manga" })
  | (AnimeHistoryItem & { type: "anime" });

export default function ProfilePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [mangaHistory, setMangaHistory] = useState<MangaHistoryItem[]>([]);
  const [animeHistory, setAnimeHistory] = useState<AnimeHistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  // 🌟 Bộ lọc cho Recent Activity để người dùng chuyển đổi nhanh
  const [activityFilter, setActivityFilter] = useState<"all" | "anime" | "manga">("all");

  useEffect(() => {
    const fetchHistory = async () => {
      if (!session?.user?.id) return;
      try {
        const res = await fetch(`http://localhost:5000/api/history/${session.user.id}`);
        if (res.ok) {
          const data = await res.json();
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
  // XỬ LÝ PHÂN QUYỀN & DANH HIỆU
  // ==========================================
  const isAdmin = session.user.role === "ADMIN";
  const roleText = isAdmin ? "ADMIN" : "MEMBER";
  const roleColor = isAdmin ? "text-red-400" : "text-blue-400";
  const roleBadge = isAdmin
    ? "bg-red-500/15 border-red-500/40 text-red-300"
    : "bg-blue-500/15 border-blue-500/40 text-blue-300";
  const glowColor = isAdmin ? "from-red-500 to-orange-500" : "from-blue-500 to-purple-600";

  // ==========================================
  // XỬ LÝ DỮ LIỆU LỊCH SỬ GỘP & THỐNG KÊ
  // ==========================================
  const combinedHistory: HistoryUnion[] = [
    ...(mangaHistory || []).map((item) => ({ ...item, type: "manga" as const })),
    ...(animeHistory || []).map((item) => ({ ...item, type: "anime" as const })),
  ].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  const filteredHistory = combinedHistory.filter((item) =>
    activityFilter === "all" ? true : item.type === activityFilter
  );

  const animeCount = animeHistory.length;
  const mangaCount = mangaHistory.length;
  const totalActivity = animeCount + mangaCount;
  const animePercent = totalActivity > 0 ? Math.round((animeCount / totalActivity) * 100) : 50;
  const mangaPercent = totalActivity > 0 ? 100 - animePercent : 50;

  // Tính danh hiệu dựa trên mức độ hoạt động
  const otakuRank =
    totalActivity >= 20
      ? "🏆 Otaku Huyền Thoại"
      : totalActivity >= 10
      ? "⚡ Tín Đồ Anime/Manga"
      : totalActivity >= 3
      ? "🌟 Nhà Thám Hiểm Mới"
      : "🌱 Tân Binh Khởi Đầu";

  return (
    <div className="min-h-screen bg-[#0f0f11] text-white font-sans pb-14">
      {/* CSS làm đẹp thanh cuộn bên trong khung Recent Activity */}
      <style>{`
        .activity-scroll::-webkit-scrollbar {
          width: 6px;
        }
        .activity-scroll::-webkit-scrollbar-track {
          background: rgba(17, 24, 39, 0.4);
          border-radius: 9999px;
        }
        .activity-scroll::-webkit-scrollbar-thumb {
          background: rgba(99, 102, 241, 0.35);
          border-radius: 9999px;
        }
        .activity-scroll::-webkit-scrollbar-thumb:hover {
          background: rgba(99, 102, 241, 0.65);
        }
      `}</style>

      {/* 1. COVER BANNER */}
      <div className="relative h-56 md:h-72 w-full bg-gradient-to-br from-indigo-950 via-[#170f2e] to-[#0f0f11] overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1618336753974-aae8e04506aa?q=80&w=2070&auto=format&fit=crop')] bg-cover bg-center opacity-25 mix-blend-overlay"></div>
        <div className="absolute -top-24 left-1/4 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-10 right-1/4 w-96 h-96 bg-purple-600/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0f0f11] via-[#0f0f11]/40 to-transparent"></div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 md:px-8 relative z-10 -mt-24 md:-mt-28">
        <div className="bg-[#15171e]/90 backdrop-blur-2xl rounded-3xl shadow-2xl border border-white/[0.08] overflow-hidden">
          
          {/* ============================================================== */}
          {/* HEADER: AVATAR, TÊN & CÁC NÚT ĐIỀU HƯỚNG NHANH */}
          {/* ============================================================== */}
          <div className="p-6 md:p-8 flex flex-col lg:flex-row items-center lg:items-end justify-between gap-6 border-b border-white/[0.07]">
            <div className="flex flex-col md:flex-row items-center md:items-end gap-6 text-center md:text-left">
              {/* Avatar có viền phát sáng */}
              <div className="relative group shrink-0">
                <div
                  className={`absolute -inset-1 rounded-full bg-gradient-to-tr ${glowColor} blur-md opacity-60 group-hover:opacity-100 transition duration-500`}
                ></div>
                <img
                  src={
                    session.user.image ||
                    "https://www.svgrepo.com/show/507442/user-circle.svg"
                  }
                  alt="Avatar"
                  className="relative w-28 h-28 md:w-36 md:h-36 rounded-full object-cover border-4 border-[#15171e] bg-gray-900 shadow-2xl z-10"
                />
                <span
                  className="absolute bottom-2 right-2 w-4 h-4 rounded-full bg-emerald-500 ring-4 ring-[#15171e] z-20"
                  title="Đang trực tuyến"
                />
              </div>

              {/* Tên, Email & Badges */}
              <div className="space-y-2 mb-1">
                <div className="flex flex-wrap items-center justify-center md:justify-start gap-2.5">
                  <span
                    className={`px-3.5 py-1 rounded-full text-xs font-extrabold tracking-wider border ${roleBadge} flex items-center gap-1.5`}
                  >
                    <span>{isAdmin ? "👑" : "🌟"}</span>
                    <span>{roleText}</span>
                  </span>
                  <span className="px-3.5 py-1 rounded-full text-xs font-bold bg-purple-500/15 border border-purple-500/30 text-purple-300">
                    {otakuRank}
                  </span>
                </div>

                <h1 className="text-2xl md:text-4xl font-black text-white tracking-tight">
                  {session.user.name || "Kẻ lang thang bí ẩn"}
                </h1>
                <p className="text-gray-400 text-sm font-medium">{session.user.email}</p>
              </div>
            </div>

            {/* Cụm nút Tủ Truyện / Tủ Phim / Quản trị */}
            <div className="flex flex-wrap items-center justify-center gap-3 w-full lg:w-auto">
              <Link
                href="/profile/reading-list"
                className="group flex items-center gap-2.5 bg-blue-600/15 hover:bg-blue-600 text-blue-400 hover:text-white border border-blue-500/30 font-bold py-2.5 px-5 rounded-xl text-sm transition-all duration-200 shadow-lg shadow-blue-600/5"
              >
                <span className="text-lg group-hover:scale-110 transition-transform">📚</span>
                <span>Manga Collection</span>
              </Link>

              <Link
                href="/profile/watching-list"
                className="group flex items-center gap-2.5 bg-purple-600/15 hover:bg-purple-600 text-purple-400 hover:text-white border border-purple-500/30 font-bold py-2.5 px-5 rounded-xl text-sm transition-all duration-200 shadow-lg shadow-purple-600/5"
              >
                <span className="text-lg group-hover:scale-110 transition-transform">🎬</span>
                <span>Anime Library</span>
              </Link>

              {isAdmin && (
                <Link
                  href="/admin"
                  className="group flex items-center gap-2.5 bg-red-600/15 hover:bg-red-600 text-red-400 hover:text-white border border-red-500/30 font-bold py-2.5 px-5 rounded-xl text-sm transition-all duration-200 shadow-lg shadow-red-600/5"
                >
                  <span className="text-lg group-hover:rotate-90 transition-transform duration-300">
                    ⚙️
                  </span>
                  <span>Admin Panel</span>
                </Link>
              )}
            </div>
          </div>

          {/* ============================================================== */}
          {/* DẢI 4 Ô THỐNG KÊ NHANH (BENTO STATS BAR) */}
          {/* ============================================================== */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 p-6 md:px-8 bg-[#101218]/60 border-b border-white/[0.06]">
            <div className="bg-gray-900/80 border border-white/[0.06] rounded-2xl p-4 flex items-center gap-4">
              <div className="w-11 h-11 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-xl shrink-0">
                🎬
              </div>
              <div>
                <p className="text-xs text-gray-400 font-medium">Anime watched</p>
                <p className="text-xl font-black text-white mt-0.5">{animeCount} episodes</p>
              </div>
            </div>

            <div className="bg-gray-900/80 border border-white/[0.06] rounded-2xl p-4 flex items-center gap-4">
              <div className="w-11 h-11 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-xl shrink-0">
                📖
              </div>
              <div>
                <p className="text-xs text-gray-400 font-medium">Manga read</p>
                <p className="text-xl font-black text-white mt-0.5">{mangaCount} chapters</p>
              </div>
            </div>

            <div className="bg-gray-900/80 border border-white/[0.06] rounded-2xl p-4 flex items-center gap-4">
              <div className="w-11 h-11 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-xl shrink-0">
                🔥
              </div>
              <div>
                <p className="text-xs text-gray-400 font-medium">Total interactions</p>
                <p className="text-xl font-black text-white mt-0.5">{totalActivity} activities</p>
              </div>
            </div>

            <div className="bg-gray-900/80 border border-white/[0.06] rounded-2xl p-4 flex items-center gap-4">
              <div className="w-11 h-11 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-xl shrink-0">
                🛡️
              </div>
              <div>
                <p className="text-xs text-gray-400 font-medium">Status</p>
                <p className="text-sm font-extrabold text-emerald-400 mt-1 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  Active
                </p>
              </div>
            </div>
          </div>

          {/* ============================================================== */}
          {/* NỘI DUNG CHÍNH: CỘT TRÁI (4 PHẦN) - CỘT PHẢI RECENT ACTIVITY (8 PHẦN) */}
          {/* ============================================================== */}
          <div className="p-6 md:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* CỘT TRÁI (Chiếm 4/12): THÔNG TIN TÀI KHOẢN & PHÂN TÍCH SỞ THÍCH */}
            <div className="lg:col-span-4 space-y-6">
              {/* Card 1: Thông tin chi tiết */}
              <div className="bg-gray-900/70 p-6 rounded-2xl border border-white/[0.07] space-y-5">
                <h3 className="text-base font-extrabold text-gray-100 flex items-center gap-2">
                  <span className="text-blue-400">❖</span> Account Details
                </h3>

                <div className="space-y-3 text-sm">
                  <div className="flex justify-between items-center bg-gray-800/50 p-3 rounded-xl border border-white/[0.05]">
                    <span className="text-gray-400">System Role</span>
                    <span className={`font-extrabold ${roleColor}`}>{roleText}</span>
                  </div>

                </div>
              </div>

              {/* Card 2: Biểu đồ Tỷ lệ thưởng thức Anime vs Manga */}
              <div className="bg-gray-900/70 p-6 rounded-2xl border border-white/[0.07] space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-extrabold text-gray-100 flex items-center gap-2">
                    <span>📊</span> Enjoyment Rate
                  </h3>
                  <span className="text-[11px] text-gray-400 font-semibold">
                    Anime vs Manga
                  </span>
                </div>

                {/* Thanh Progress đôi */}
                <div className="w-full h-3 bg-gray-800 rounded-full overflow-hidden flex p-0.5 gap-0.5">
                  <div
                    style={{ width: `${animePercent}%` }}
                    className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 rounded-l-full transition-all duration-500"
                  />
                  <div
                    style={{ width: `${mangaPercent}%` }}
                    className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 rounded-r-full transition-all duration-500"
                  />
                </div>

                <div className="flex justify-between text-xs font-bold pt-1">
                  <span className="text-purple-400 flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-purple-500" />
                    Anime ({animePercent}%)
                  </span>
                  <span className="text-cyan-400 flex items-center gap-1.5">
                    Manga ({mangaPercent}%)
                    <span className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
                  </span>
                </div>

                {/* Gợi ý nhanh từ AI */}
                <div className="pt-3 border-t border-white/[0.06]">
                  <Link
                    href="/ai-search?prompt=Gợi%20ý%20cho%20tôi%20một%20bộ%20Anime%20hoặc%20Manga%20đặc%20sắc%20để%20cày%20cuối%20tuần"
                    className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-purple-600/20 to-blue-600/20 hover:from-purple-600/35 hover:to-blue-600/35 border border-purple-500/30 text-xs font-bold text-purple-300 flex items-center justify-center gap-2 transition"
                  >
                    <span>🤖 AI Recommend that match your taste</span>
                    <span>&rarr;</span>
                  </Link>
                </div>
              </div>
            </div>

            {/* CỘT PHẢI (Chiếm 8/12): RECENT ACTIVITY DẠNG LƯỚI 2 CỘT GỌN ĐẸP */}
            <div className="lg:col-span-8 bg-gray-900/70 p-6 rounded-2xl border border-white/[0.07] flex flex-col">
              {/* Tiêu đề + Bộ lọc Tab */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 mb-5 border-b border-white/[0.07]">
                <div>
                  <h3 className="text-lg font-extrabold text-white flex items-center gap-2">
                    <span className="text-purple-400">⏱️</span> Recent Activity
                  </h3>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Click on any item to continue watching or reading from where you left off
                  </p>
                </div>

                {/* Nút lọc All / Anime / Manga */}
                <div className="flex items-center bg-gray-950 p-1 rounded-xl border border-white/[0.06] self-start sm:self-auto shrink-0">
                  <button
                    type="button"
                    onClick={() => setActivityFilter("all")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                      activityFilter === "all"
                        ? "bg-blue-600 text-white shadow"
                        : "text-gray-400 hover:text-white"
                    }`}
                  >
                    All ({combinedHistory.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setActivityFilter("anime")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                      activityFilter === "anime"
                        ? "bg-purple-600 text-white shadow"
                        : "text-gray-400 hover:text-white"
                    }`}
                  >
                    🎬 Anime ({animeCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setActivityFilter("manga")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                      activityFilter === "manga"
                        ? "bg-blue-600 text-white shadow"
                        : "text-gray-400 hover:text-white"
                    }`}
                  >
                    📚 Manga ({mangaCount})
                  </button>
                </div>
              </div>

              {/* Danh sách hoạt động: Hiển thị dạng Lưới 2 cột + giới hạn chiều cao có thanh cuộn mượt */}
              {loadingHistory ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className="h-24 rounded-xl bg-gray-800/50 animate-pulse border border-white/[0.04]"
                    />
                  ))}
                </div>
              ) : filteredHistory.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-14 text-center bg-gray-800/20 rounded-2xl border border-gray-700/40 border-dashed">
                  <span className="text-4xl mb-3 opacity-50">📭</span>
                  <p className="text-sm font-bold text-gray-300">
                    Chưa có lịch sử hoạt động nào ở mục này
                  </p>
                  <p className="text-xs text-gray-500 mt-1 mb-4">
                    Hãy bắt đầu khám phá các bộ Anime & Manga hấp dẫn trên hệ thống nhé!
                  </p>
                  <div className="flex gap-3">
                    <Link
                      href="/anime"
                      className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition"
                    >
                      Khám phá Anime
                    </Link>
                    <Link
                      href="/manga"
                      className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition"
                    >
                      Khám phá Manga
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 max-h-[380px] overflow-y-auto activity-scroll pr-1.5">
                  {filteredHistory.map((item) => {
                    const isManga = item.type === "manga";
                    const linkUrl = isManga
                      ? `/manga/${item.manga.id}/chapter/${item.chapter.id}`
                      : `/anime/${item.anime.id}/watch/${item.episode.id}`;
                    const coverImg = isManga
                      ? item.manga.coverImage
                      : item.anime.coverImage;
                    const mainTitle = isManga ? item.manga.title : item.anime.title;

                    return (
                      <Link
                        key={`${item.type}-${item.id}`}
                        href={linkUrl}
                        className="group/item flex items-center gap-3.5 p-3 bg-gray-800/45 hover:bg-gray-800/90 rounded-xl border border-white/[0.05] hover:border-indigo-500/50 transition-all duration-200 shadow-sm"
                      >
                        {/* Ảnh bìa mini */}
                        <div className="w-14 h-20 shrink-0 bg-gray-900 rounded-lg overflow-hidden relative shadow-md">
                          <div
                            className={`absolute top-1 left-1 text-[8px] font-black px-1.5 py-0.5 rounded z-10 text-white shadow ${
                              isManga ? "bg-blue-600" : "bg-purple-600"
                            }`}
                          >
                            {isManga ? "MANGA" : "ANIME"}
                          </div>

                          {coverImg ? (
                            <img
                              src={coverImg}
                              alt={mainTitle}
                              className="w-full h-full object-cover group-hover/item:scale-110 transition-transform duration-300"
                            />
                          ) : (
                            <div className="w-full h-full text-[9px] text-gray-500 flex items-center justify-center">
                              No Img
                            </div>
                          )}
                        </div>

                        {/* Thông tin chi tiết */}
                        <div className="flex-1 min-w-0">
                          <h4 className="font-bold text-sm text-gray-100 truncate group-hover/item:text-blue-400 transition-colors">
                            {mainTitle}
                          </h4>

                          <p className="text-xs text-gray-300 mt-1 truncate">
                            {isManga ? (
                              <>
                                <span className="text-blue-400 font-semibold">Reading:</span>{" "}
                                {item.chapter.title}
                              </>
                            ) : (
                              <>
                                <span className="text-purple-400 font-semibold">Watching:</span>{" "}
                                {item.episode.title}
                              </>
                            )}
                          </p>

                          <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-white/[0.05]">
                            <span className="text-[10px] text-gray-500">
                              {new Date(item.updatedAt).toLocaleString("vi-VN", {
                                hour: "2-digit",
                                minute: "2-digit",
                                day: "2-digit",
                                month: "2-digit",
                                year: "numeric",
                              })}
                            </span>
                            <span className="text-[11px] font-bold text-indigo-400 opacity-0 group-hover/item:opacity-100 group-hover/item:translate-x-0.5 transition-all">
                              Tiếp tục &rarr;
                            </span>
                          </div>
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