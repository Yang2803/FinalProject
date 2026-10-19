"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";

// =====================================================================
// INTERFACES
// =====================================================================
interface Manga {
  id: string;
  title: string;
  description?: string | null;
  coverImage: string | null;
  periodViews?: number;
  _count?: { chapters: number };
}

interface Anime {
  id: string;
  title: string;
  description?: string | null;
  coverImage: string | null;
  periodViews?: number;
  _count: { episodes: number };
}

interface SpotlightItem {
  id: string;
  title: string;
  description: string;
  coverImage: string | null;
  type: "ANIME" | "MANGA";
  countLabel: string;
  detailUrl: string;
  roomUrl: string;
}

interface ContinueItem {
  id: string;
  type: "ANIME" | "MANGA";
  title: string;
  coverImage: string | null;
  progressText: string;
  targetUrl: string;
  updatedAt: string;
}

interface LivePartyRoom {
  id: string;
  name: string;
  inviteCode: string;
  isPrivate?: boolean;
  anime?: { id: string; title: string; coverImage?: string | null } | null;
  episode?: { id: string; title: string; episodeNumber?: number } | null;
  host?: { name?: string | null } | null;
  members?: { id: string; status?: string }[];
  _count?: { members: number };
}

interface LiveMangaRoom {
  id: string;
  roomId?: string;
  name?: string;
  inviteCode?: string;
  isPrivate?: boolean;
  manga?: { id: string; title: string; coverImage?: string | null } | null;
  chapter?: { id: string; title: string } | null;
  host?: { name?: string | null } | null;
  members?: { id: string }[];
  _count?: { members: number };
}

// Danh sách Thể loại & Chủ đề chuẩn bị sẵn cho UI
const GENRE_PILLS = [
  { id: "ALL", label: "✨ Tất cả", prompt: "" },
  {
    id: "Action",
    label: "⚔️ Action",
    prompt: "Gợi ý các bộ Anime/Manga thể loại Hành động (Action) đánh nhau mãn nhãn",
  },
  {
    id: "Fantasy",
    label: "🔮 Fantasy",
    prompt: "Gợi ý các bộ Anime/Manga thể loại Phép thuật / Thế giới giả tưởng (Fantasy)",
  },
  {
    id: "Supernatural",
    label: "👻 Supernatural",
    prompt: "Gợi ý các bộ Anime/Manga thể loại Siêu nhiên, chú thuật, trừ tà",
  },
  {
    id: "Romance",
    label: "💘 Romance",
    prompt: "Gợi ý các bộ Anime/Manga thể loại Tình cảm lãng mạn (Romance)",
  },
  {
    id: "Comedy",
    label: "😂 Comedy",
    prompt: "Gợi ý các bộ Anime/Manga thể loại Hài hước giải trí (Comedy)",
  },
  {
    id: "School",
    label: "🏫 School Life",
    prompt: "Gợi ý các bộ Anime/Manga lấy bối cảnh Học đường",
  },
  {
    id: "Mystery",
    label: "🕵️ Mystery",
    prompt: "Gợi ý các bộ Anime/Manga Trinh thám, Bí ẩn, Plot twist",
  },
];

// Component TabButton ở ngoài tránh lỗi re-render
const TabButton = ({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) => (
  <button
    onClick={onClick}
    className={`px-3 py-1 text-xs font-bold rounded-md transition cursor-pointer ${
      active
        ? "bg-blue-600 text-white"
        : "bg-gray-800 text-gray-400 hover:bg-gray-700"
    }`}
  >
    {label}
  </button>
);

export default function Home() {
  const { data: session } = useSession();

  // States cho phim/truyện mới
  const [recentMangas, setRecentMangas] = useState<Manga[]>([]);
  const [recentAnimes, setRecentAnimes] = useState<Anime[]>([]);
  const [loading, setLoading] = useState(true);

  // States cho Hero Spotlight Slider
  const [currentSlide, setCurrentSlide] = useState(0);

  // State cho thanh Thể loại & Lọc nhanh
  const [selectedGenre, setSelectedGenre] = useState("ALL");
  const [quickFilterKeyword, setQuickFilterKeyword] = useState("");

  // 🌟 State cho mục Xem & Đọc Tiếp (Continue Watching/Reading)
  const [continueList, setContinueList] = useState<ContinueItem[]>([]);

  // 🌟 State cho mục Phòng Xem & Đọc Chung Đang Mở (Tối đa 4 phòng mỗi loại)
  const [livePartyRooms, setLivePartyRooms] = useState<LivePartyRoom[]>([]);
  const [liveMangaRooms, setLiveMangaRooms] = useState<LiveMangaRoom[]>([]);

  // States cho bảng xếp hạng
  const [topAnimePeriod, setTopAnimePeriod] = useState<"day" | "week" | "month">("day");
  const [topMangaPeriod, setTopMangaPeriod] = useState<"day" | "week" | "month">("day");
  const [topAnimes, setTopAnimes] = useState<Anime[]>([]);
  const [topMangas, setTopMangas] = useState<Manga[]>([]);
  const [loadingTopAnime, setLoadingTopAnime] = useState(false);
  const [loadingTopManga, setLoadingTopManga] = useState(false);

  // 1. Fetch dữ liệu mới cập nhật & danh sách phòng Live
  useEffect(() => {
    const fetchHomepageData = async () => {
      try {
        const [mangaRes, animeRes] = await Promise.all([
          fetch("http://localhost:5000/api/manga"),
          fetch("http://localhost:5000/api/anime"),
        ]);

        if (mangaRes.ok) setRecentMangas((await mangaRes.json()).slice(0, 12));
        if (animeRes.ok) setRecentAnimes((await animeRes.json()).slice(0, 12));

        // Fetch danh sách phòng Watch Party đang mở (lấy tối đa 4 phòng)
        try {
          const partyRes = await fetch("http://localhost:5000/api/party/rooms");
          if (partyRes.ok) {
            const partyData = await partyRes.json();
            const roomsArray = Array.isArray(partyData) ? partyData : partyData.rooms || [];
            setLivePartyRooms(roomsArray.slice(0, 4));
          }
        } catch {
          // Bỏ qua nếu endpoint khác tên
        }

        // Fetch danh sách phòng Đọc Manga đang mở (thử cả 2 đường dẫn phổ biến, lấy tối đa 4 phòng)
        try {
          let mangaRoomRes = await fetch("http://localhost:5000/api/manga-room/rooms");
          if (!mangaRoomRes.ok) {
            mangaRoomRes = await fetch("http://localhost:5000/api/manga-rooms");
          }
          if (mangaRoomRes.ok) {
            const mangaRoomData = await mangaRoomRes.json();
            const mRoomsArray = Array.isArray(mangaRoomData)
              ? mangaRoomData
              : mangaRoomData.rooms || [];
            setLiveMangaRooms(mRoomsArray.slice(0, 4));
          }
        } catch {
          // Bỏ qua nếu endpoint chưa bật
        }
      } catch (err) {
        console.error("Lỗi khi tải dữ liệu trang chủ:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchHomepageData();
  }, []);

  // 🌟 2. Fetch Lịch sử Xem & Đọc Tiếp khi người dùng đã đăng nhập
  useEffect(() => {
    const fetchContinueHistory = async () => {
      if (!session?.user?.id) {
        setContinueList([]);
        return;
      }

      const userId = session.user.id;
      const items: ContinueItem[] = [];

      try {
        // Thử lấy từ endpoint tổng hợp /api/history/:userId hoặc từng phần
        const [generalRes, animeHistRes, mangaHistRes] = await Promise.allSettled([
          fetch(`http://localhost:5000/api/history/${userId}`),
          fetch(`http://localhost:5000/api/history/anime/${userId}`),
          fetch(`http://localhost:5000/api/history/manga/${userId}`),
        ]);

        // Hàm chuẩn hóa 1 bản ghi lịch sử bất kỳ thành ContinueItem
        const parseRecord = (rec: Record<string, unknown>) => {
          if (!rec || typeof rec !== "object") return;
          const r = rec as {
            id?: string;
            updatedAt?: string;
            viewedAt?: string;
            createdAt?: string;
            animeId?: string;
            episodeId?: string;
            mangaId?: string;
            chapterId?: string;
            anime?: { id: string; title: string; coverImage?: string | null };
            episode?: { id: string; title?: string; episodeNumber?: number };
            manga?: { id: string; title: string; coverImage?: string | null };
            chapter?: { id: string; title?: string };
          };

          if (r.anime && (r.episode || r.episodeId)) {
            const epId = r.episode?.id || r.episodeId || "";
            const epLabel = r.episode?.episodeNumber
              ? `Tập ${r.episode.episodeNumber}`
              : r.episode?.title || "Xem tiếp";
            items.push({
              id: `anime_${r.anime.id}`,
              type: "ANIME",
              title: r.anime.title,
              coverImage: r.anime.coverImage || null,
              progressText: `Đang xem: ${epLabel}`,
              targetUrl: epId ? `/anime/${r.anime.id}/watch/${epId}` : `/anime/${r.anime.id}`,
              updatedAt: r.updatedAt || r.viewedAt || r.createdAt || "",
            });
          } else if (r.manga && (r.chapter || r.chapterId)) {
            const chapId = r.chapter?.id || r.chapterId || "";
            const chapLabel = r.chapter?.title || "Đọc tiếp";
            items.push({
              id: `manga_${r.manga.id}`,
              type: "MANGA",
              title: r.manga.title,
              coverImage: r.manga.coverImage || null,
              progressText: `Đang đọc: ${chapLabel}`,
              targetUrl: chapId
                ? `/manga/${r.manga.id}/chapter/${chapId}`
                : `/manga/${r.manga.id}`,
              updatedAt: r.updatedAt || r.viewedAt || r.createdAt || "",
            });
          }
        };

        if (generalRes.status === "fulfilled" && generalRes.value.ok) {
          const data = await generalRes.value.json();
          if (Array.isArray(data)) {
            data.forEach(parseRecord);
          } else if (data && typeof data === "object") {
            if (Array.isArray(data.animeHistory)) data.animeHistory.forEach(parseRecord);
            if (Array.isArray(data.mangaHistory)) data.mangaHistory.forEach(parseRecord);
            if (Array.isArray(data.history)) data.history.forEach(parseRecord);
          }
        }

        if (animeHistRes.status === "fulfilled" && animeHistRes.value.ok) {
          const data = await animeHistRes.value.json();
          if (Array.isArray(data)) data.forEach(parseRecord);
        }

        if (mangaHistRes.status === "fulfilled" && mangaHistRes.value.ok) {
          const data = await mangaHistRes.value.json();
          if (Array.isArray(data)) data.forEach(parseRecord);
        }

        // Lọc trùng theo id bộ phim/truyện và lấy tối đa 6 bộ gần nhất
        const uniqueMap = new Map<string, ContinueItem>();
        for (const item of items) {
          if (!uniqueMap.has(item.id)) {
            uniqueMap.set(item.id, item);
          }
        }

        const finalItems = Array.from(uniqueMap.values())
          .sort((a, b) => (b.updatedAt > a.updatedAt ? 1 : -1))
          .slice(0, 6);

        setContinueList(finalItems);
      } catch (err) {
        console.error("Lỗi khi tải lịch sử xem/đọc tiếp:", err);
      }
    };

    fetchContinueHistory();
  }, [session?.user?.id]);

  // 3. Fetch Top Anime mỗi khi đổi Tab thời gian
  useEffect(() => {
    const fetchTopAnime = async () => {
      setLoadingTopAnime(true);
      try {
        const res = await fetch(`http://localhost:5000/api/anime/top?period=${topAnimePeriod}`);
        if (res.ok) setTopAnimes(await res.json());
      } catch (error) {
        console.error("Lỗi Top Anime:", error);
      } finally {
        setLoadingTopAnime(false);
      }
    };
    fetchTopAnime();
  }, [topAnimePeriod]);

  // 4. Fetch Top Manga mỗi khi đổi Tab thời gian
  useEffect(() => {
    const fetchTopManga = async () => {
      setLoadingTopManga(true);
      try {
        const res = await fetch(`http://localhost:5000/api/manga/top?period=${topMangaPeriod}`);
        if (res.ok) setTopMangas(await res.json());
      } catch (error) {
        console.error("Lỗi Top Manga:", error);
      } finally {
        setLoadingTopManga(false);
      }
    };
    fetchTopManga();
  }, [topMangaPeriod]);

  // Tạo danh sách 5 tác phẩm nổi bật cho Hero Spotlight Slider
  const spotlightItems: SpotlightItem[] = [
    ...recentAnimes.slice(0, 3).map((a) => ({
      id: a.id,
      title: a.title,
      description:
        a.description ||
        "Trải nghiệm bộ Anime siêu hấp dẫn với tính năng xem chung Watch Party, phụ đề đa ngôn ngữ và trợ lý AI thông minh ngay trên Smart Anime Platform.",
      coverImage: a.coverImage,
      type: "ANIME" as const,
      countLabel: `${a._count?.episodes || 0} Episodes`,
      detailUrl: `/anime/${a.id}`,
      roomUrl: `/party`,
    })),
    ...recentMangas.slice(0, 2).map((m) => ({
      id: m.id,
      title: m.title,
      description:
        m.description ||
        "Đọc ngay những chương truyện mới nhất với công nghệ AI dịch trực tiếp trên trang tranh (Gemini Vision) và phòng đọc chung Co-reading thời gian thực.",
      coverImage: m.coverImage,
      type: "MANGA" as const,
      countLabel: `${m._count?.chapters || 0} Chapters`,
      detailUrl: `/manga/${m.id}`,
      roomUrl: `/manga-room`,
    })),
  ];

  // Tự động chuyển slide mỗi 5 giây
  useEffect(() => {
    if (spotlightItems.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % spotlightItems.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [spotlightItems.length]);

  const activeSpotlight =
    spotlightItems.length > 0 ? spotlightItems[currentSlide % spotlightItems.length] : null;

  const filteredAnimes = recentAnimes.filter((a) =>
    quickFilterKeyword
      ? a.title.toLowerCase().includes(quickFilterKeyword.toLowerCase())
      : true
  );
  const filteredMangas = recentMangas.filter((m) =>
    quickFilterKeyword
      ? m.title.toLowerCase().includes(quickFilterKeyword.toLowerCase())
      : true
  );

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-900">
        <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f0f11] text-white p-4 md:p-8">
      {/* Ẩn thanh cuộn ngang cho dải nút Thể loại */}
      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>

      <div className="max-w-[1400px] mx-auto space-y-8">
        
        {/* ===================================================================== */}
        {/* 🌟 1. HERO SPOTLIGHT SLIDER (TRÊN CÙNG) */}
        {/* ===================================================================== */}
        {activeSpotlight ? (
          <div className="relative rounded-3xl overflow-hidden border border-gray-800 shadow-2xl min-h-[360px] md:min-h-[420px] flex items-center bg-gray-900 group">
            {activeSpotlight.coverImage && (
              <div
                className="absolute inset-0 bg-cover bg-center scale-110 blur-2xl opacity-35 transition-all duration-700"
                style={{ backgroundImage: `url("${activeSpotlight.coverImage}")` }}
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-r from-[#0f0f11] via-[#0f0f11]/85 to-transparent z-0" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0f0f11] via-transparent to-black/30 z-0" />

            <div className="relative z-10 w-full px-6 md:px-12 py-8 flex flex-col md:flex-row items-center justify-between gap-8">
              <div className="flex-1 max-w-2xl space-y-4 text-left">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-lg">
                    🔥 Spotlight #{(currentSlide % spotlightItems.length) + 1}
                  </span>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-bold border ${
                      activeSpotlight.type === "ANIME"
                        ? "bg-blue-500/15 border-blue-500/40 text-blue-400"
                        : "bg-green-500/15 border-green-500/40 text-green-400"
                    }`}
                  >
                    {activeSpotlight.type === "ANIME" ? "🎬 ANIME SERIES" : "📖 MANGA SERIES"}
                  </span>
                  <span className="px-3 py-1 rounded-full text-xs font-semibold bg-gray-800/80 text-gray-300 border border-gray-700">
                    {activeSpotlight.countLabel}
                  </span>
                  <span className="px-3 py-1 rounded-full text-xs font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                    ✨ AI Supported
                  </span>
                </div>

                <h1 className="text-3xl md:text-5xl font-black text-white leading-tight line-clamp-2 drop-shadow-md">
                  {activeSpotlight.title}
                </h1>

                <p className="text-gray-300 text-sm md:text-base line-clamp-3 leading-relaxed max-w-xl">
                  {activeSpotlight.description}
                </p>

                <div className="pt-2 flex flex-wrap items-center gap-3.5">
                  <Link
                    href={activeSpotlight.detailUrl}
                    className={`px-6 py-3 rounded-xl font-bold text-sm flex items-center gap-2 shadow-lg transition transform hover:-translate-y-0.5 ${
                      activeSpotlight.type === "ANIME"
                        ? "bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/30"
                        : "bg-green-600 hover:bg-green-500 text-white shadow-green-600/30"
                    }`}
                  >
                    <span>
                      {activeSpotlight.type === "ANIME" ? "▶️ Xem Phim Ngay" : "📖 Đọc Truyện Ngay"}
                    </span>
                  </Link>

                  <Link
                    href={activeSpotlight.roomUrl}
                    className="px-5 py-3 rounded-xl font-bold text-sm bg-gray-800/90 hover:bg-gray-700 text-gray-200 border border-gray-700 flex items-center gap-2 transition backdrop-blur-md"
                  >
                    <span>
                      {activeSpotlight.type === "ANIME" ? "🎉 Phòng Xem Chung" : "👥 Phòng Đọc Chung"}
                    </span>
                  </Link>
                </div>
              </div>

              <div className="hidden md:flex shrink-0 pr-4">
                <Link href={activeSpotlight.detailUrl} className="relative group/poster block">
                  <div className="absolute -inset-1 bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl blur opacity-40 group-hover/poster:opacity-80 transition duration-500"></div>
                  <div className="relative w-52 h-72 rounded-2xl overflow-hidden border-2 border-white/15 shadow-2xl transform rotate-2 group-hover/poster:rotate-0 group-hover/poster:scale-105 transition-all duration-500 bg-gray-800">
                    {activeSpotlight.coverImage ? (
                      <img
                        src={activeSpotlight.coverImage}
                        alt={activeSpotlight.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-500">
                        No Cover
                      </div>
                    )}
                  </div>
                </Link>
              </div>
            </div>

            {spotlightItems.length > 1 && (
              <>
                <button
                  onClick={() =>
                    setCurrentSlide(
                      (prev) => (prev - 1 + spotlightItems.length) % spotlightItems.length
                    )
                  }
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/50 hover:bg-black/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition z-20 border border-white/10 cursor-pointer"
                  title="Slide trước"
                >
                  &#10094;
                </button>
                <button
                  onClick={() =>
                    setCurrentSlide((prev) => (prev + 1) % spotlightItems.length)
                  }
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/50 hover:bg-black/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition z-20 border border-white/10 cursor-pointer"
                  title="Slide tiếp"
                >
                  &#10095;
                </button>

                <div className="absolute bottom-4 left-6 md:left-12 flex items-center gap-2 z-20">
                  {spotlightItems.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => setCurrentSlide(idx)}
                      className={`h-2 rounded-full transition-all cursor-pointer ${
                        idx === currentSlide % spotlightItems.length
                          ? "w-7 bg-blue-500"
                          : "w-2 bg-gray-600 hover:bg-gray-400"
                      }`}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="bg-gray-800 rounded-2xl p-8 md:p-10 text-center shadow-2xl relative overflow-hidden border border-gray-700">
            <h1 className="text-3xl md:text-5xl font-black mb-4 text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500">
              Welcome to Smart Anime Platform
            </h1>
            <p className="text-gray-400 text-base md:text-lg max-w-2xl mx-auto">
              The ultimate platform for exploring and enjoying the world of Anime & Manga.
            </p>
          </div>
        )}

        {/* ===================================================================== */}
        {/* 🌟 2. DẢI KHÁM PHÁ NHANH BẰNG AI & THỂ LOẠI */}
        {/* ===================================================================== */}
        <div className="bg-[#16181f] border border-gray-800/90 rounded-2xl p-4 md:p-5 shadow-xl space-y-4">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-gray-800/80">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-purple-600 to-cyan-500 flex items-center justify-center text-xl shadow-lg shadow-purple-500/20 shrink-0">
                🤖
              </div>
              <div>
                <h3 className="font-extrabold text-sm md:text-base text-white flex items-center gap-2">
                  <span>Explore Quickly with AI Assistant</span>
                  <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                    Gemini 2.5 Vision
                  </span>
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  Quên tên phim? Nhớ mang máng cốt truyện hoặc chỉ có 1 tấm ảnh chụp màn hình? Hãy để AI tìm giúp bạn!
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
              <Link
                href="/ai-search?mode=image"
                className="flex-1 md:flex-none justify-center px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-purple-600/20 transition"
              >
                <span>📷 Tìm bằng Hình Ảnh</span>
              </Link>
              <Link
                href="/ai-search"
                className="flex-1 md:flex-none justify-center px-4 py-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-cyan-400 border border-gray-700 text-xs font-bold flex items-center gap-1.5 transition"
              >
                <span>🔍 Tìm theo Cốt Truyện</span>
              </Link>
            </div>
          </div>

          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
            <div className="flex items-center gap-2 overflow-x-auto pb-1 lg:pb-0 no-scrollbar">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider mr-1 shrink-0">
                Thể loại:
              </span>
              {GENRE_PILLS.map((genre) => {
                const isSelected = selectedGenre === genre.id;
                return (
                  <button
                    key={genre.id}
                    type="button"
                    onClick={() => setSelectedGenre(genre.id)}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all cursor-pointer border ${
                      isSelected
                        ? "bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-500/25 scale-105"
                        : "bg-gray-900/90 text-gray-300 border-gray-800 hover:border-gray-600 hover:text-white"
                    }`}
                  >
                    {genre.label}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {selectedGenre !== "ALL" && (
                <Link
                  href={`/ai-search?prompt=${encodeURIComponent(
                    GENRE_PILLS.find((g) => g.id === selectedGenre)?.prompt ||
                      `Gợi ý các bộ Anime và Manga thể loại ${selectedGenre} hay nhất trong hệ thống`
                  )}`}
                  className="text-xs font-bold text-purple-400 hover:text-purple-300 bg-purple-950/40 border border-purple-500/30 px-3 py-1.5 rounded-lg transition whitespace-nowrap"
                >
                  ✨ Nhờ AI gợi ý bộ {selectedGenre} &rarr;
                </Link>
              )}
              
            </div>
          </div>
        </div>

        {/* ===================================================================== */}
        {/* 🌟 3. [DẢI NGANG - NẾU ĐÃ ĐĂNG NHẬP] ⏱️ XEM & ĐỌC TIẾP */}
        {/* ===================================================================== */}
        {session?.user && continueList.length > 0 && (
          <section className="bg-[#16181f]/90 border border-gray-800/80 rounded-2xl p-5 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <span className="text-xl">⏱️</span>
                <h2 className="text-lg md:text-xl font-extrabold text-white">
                  Continue Watching & Reading
                </h2>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/30 font-semibold">
                  {continueList.length} tác phẩm gần đây
                </span>
              </div>
              <Link
                href="/profile"
                className="text-xs font-bold text-gray-400 hover:text-white transition"
              >
                Lịch sử đầy đủ &rarr;
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {continueList.map((item) => (
                <Link
                  key={item.id}
                  href={item.targetUrl}
                  className="group flex items-center gap-3.5 bg-gray-900/90 hover:bg-gray-800/90 border border-gray-800 hover:border-blue-500/60 p-3 rounded-xl transition-all duration-300 shadow-md"
                >
                  <div className="w-14 h-20 rounded-lg overflow-hidden bg-gray-800 shrink-0 relative">
                    {item.coverImage ? (
                      <img
                        src={item.coverImage}
                        alt={item.title}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[10px] text-gray-500">
                        Trống
                      </div>
                    )}
                    <span
                      className={`absolute bottom-1 left-1 text-[9px] font-black px-1.5 py-0.5 rounded ${
                        item.type === "ANIME"
                          ? "bg-blue-600 text-white"
                          : "bg-green-600 text-white"
                      }`}
                    >
                      {item.type}
                    </span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-sm text-gray-100 truncate group-hover:text-blue-400 transition">
                      {item.title}
                    </h4>
                    <p className="text-xs text-gray-400 mt-1 truncate">
                      {item.progressText}
                    </p>
                    <div className="mt-2 flex items-center gap-1.5 text-[11px] font-bold text-blue-400 group-hover:translate-x-1 transition-transform">
                      <span>{item.type === "ANIME" ? "▶️ Xem tiếp ngay" : "📖 Đọc tiếp ngay"}</span>
                      <span>&rarr;</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* ===================================================================== */}
        {/* 🌟 4. LAYOUT GRID: TRÁI (UPDATES) - PHẢI (TOP RANKINGS) */}
        {/* ===================================================================== */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* CỘT TRÁI (Chiếm 8 phần): NỘI DUNG MỚI CẬP NHẬT */}
          <div className="lg:col-span-8 space-y-12">
            
            {/* ANIME MỚI */}
            <section>
              <div className="flex justify-between items-end mb-6">
                <div className="flex items-center gap-3">
                  <h2 className="text-xl md:text-2xl font-bold border-l-4 border-blue-500 pl-3">
                    New Anime Updates
                  </h2>
                  {selectedGenre !== "ALL" && (
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/30 font-semibold">
                      {selectedGenre}
                    </span>
                  )}
                </div>
                <Link
                  href="/anime"
                  className="text-sm text-blue-400 hover:text-blue-300 hover:underline"
                >
                  View All &rarr;
                </Link>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 md:gap-6">
                {filteredAnimes.map((anime) => (
                  <Link key={anime.id} href={`/anime/${anime.id}`} className="group block">
                    <div className="bg-gray-800/80 rounded-xl overflow-hidden shadow-lg border border-gray-800 hover:border-blue-500 transition-all duration-300">
                      <div className="relative aspect-[2/3] w-full bg-gray-900 overflow-hidden">
                        {anime.coverImage ? (
                          <img
                            src={anime.coverImage}
                            alt={anime.title}
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-600">
                            Trống
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                        <div className="absolute top-2 left-2 bg-blue-600/90 backdrop-blur-sm text-white font-bold text-xs px-2 py-1 rounded">
                          {anime._count?.episodes || 0} Episodes
                        </div>
                      </div>
                      <div className="p-3">
                        <h3 className="font-bold text-gray-200 text-sm md:text-base truncate group-hover:text-blue-400">
                          {anime.title}
                        </h3>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>

            {/* MANGA MỚI */}
            <section>
              <div className="flex justify-between items-end mb-6">
                <div className="flex items-center gap-3">
                  <h2 className="text-xl md:text-2xl font-bold border-l-4 border-green-500 pl-3">
                    New Manga Updates
                  </h2>
                  {selectedGenre !== "ALL" && (
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-green-500/15 text-green-400 border border-green-500/30 font-semibold">
                      {selectedGenre}
                    </span>
                  )}
                </div>
                <Link
                  href="/manga"
                  className="text-sm text-green-400 hover:text-green-300 hover:underline"
                >
                  View All &rarr;
                </Link>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 md:gap-6">
                {filteredMangas.map((manga) => (
                  <Link key={manga.id} href={`/manga/${manga.id}`} className="group block">
                    <div className="bg-gray-800/80 rounded-xl overflow-hidden shadow-lg border border-gray-800 hover:border-green-500 transition-all duration-300">
                      <div className="relative aspect-[2/3] w-full bg-gray-900 overflow-hidden">
                        {manga.coverImage ? (
                          <img
                            src={manga.coverImage}
                            alt={manga.title}
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-600">
                            Trống
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                        <div className="absolute top-2 left-2 bg-green-600/90 backdrop-blur-sm text-white font-bold text-xs px-2 py-1 rounded">
                          {manga._count?.chapters || 0} Chapters
                        </div>
                      </div>
                      <div className="p-3">
                        <h3 className="font-bold text-gray-200 text-sm md:text-base truncate group-hover:text-green-400">
                          {manga.title}
                        </h3>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>

          </div>

          {/* CỘT PHẢI (Chiếm 4 phần): BẢNG XẾP HẠNG SIDEBAR */}
          <div className="lg:col-span-4 space-y-8">
            
            {/* TOP ANIME WIDGET */}
            <div className="bg-gray-800/50 border border-gray-700/80 rounded-2xl p-5">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-5 gap-3">
                <h2 className="text-lg font-bold text-blue-400 flex items-center gap-2">
                  🔥 Top Anime
                </h2>
                <div className="flex bg-gray-900 rounded-lg p-1 gap-1">
                  <TabButton
                    label="Day"
                    active={topAnimePeriod === "day"}
                    onClick={() => setTopAnimePeriod("day")}
                  />
                  <TabButton
                    label="Week"
                    active={topAnimePeriod === "week"}
                    onClick={() => setTopAnimePeriod("week")}
                  />
                  <TabButton
                    label="Month"
                    active={topAnimePeriod === "month"}
                    onClick={() => setTopAnimePeriod("month")}
                  />
                </div>
              </div>

              <div className="space-y-4 min-h-[300px]">
                {loadingTopAnime ? (
                  <div className="animate-pulse space-y-4">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div key={i} className="h-16 bg-gray-700/50 rounded-lg w-full"></div>
                    ))}
                  </div>
                ) : topAnimes.length === 0 ? (
                  <p className="text-gray-500 text-sm text-center py-10">
                    Chưa có dữ liệu lượt xem
                  </p>
                ) : (
                  topAnimes.slice(0, 10).map((anime, index) => (
                    <Link
                      key={anime.id}
                      href={`/anime/${anime.id}`}
                      className="flex items-center gap-4 group"
                    >
                      <div
                        className={`text-xl font-black w-6 text-center ${
                          index === 0
                            ? "text-yellow-400"
                            : index === 1
                            ? "text-gray-300"
                            : index === 2
                            ? "text-amber-600"
                            : "text-gray-600"
                        }`}
                      >
                        {index + 1}
                      </div>
                      <div className="w-12 h-16 rounded bg-gray-700 overflow-hidden shrink-0">
                        {anime.coverImage && (
                          <img
                            src={anime.coverImage}
                            alt={anime.title}
                            className="w-full h-full object-cover group-hover:scale-110 transition"
                          />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-gray-200 text-sm truncate group-hover:text-blue-400">
                          {anime.title}
                        </h4>
                        <p className="text-xs text-gray-500 mt-1">
                          {anime.periodViews} lượt xem
                        </p>
                      </div>
                    </Link>
                  ))
                )}
              </div>
            </div>

            {/* TOP MANGA WIDGET */}
            <div className="bg-gray-800/50 border border-gray-700/80 rounded-2xl p-5">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-5 gap-3">
                <h2 className="text-lg font-bold text-green-400 flex items-center gap-2">
                  🔥 Top Manga
                </h2>
                <div className="flex bg-gray-900 rounded-lg p-1 gap-1">
                  <TabButton
                    label="Day"
                    active={topMangaPeriod === "day"}
                    onClick={() => setTopMangaPeriod("day")}
                  />
                  <TabButton
                    label="Week"
                    active={topMangaPeriod === "week"}
                    onClick={() => setTopMangaPeriod("week")}
                  />
                  <TabButton
                    label="Month"
                    active={topMangaPeriod === "month"}
                    onClick={() => setTopMangaPeriod("month")}
                  />
                </div>
              </div>

              <div className="space-y-4 min-h-[300px]">
                {loadingTopManga ? (
                  <div className="animate-pulse space-y-4">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div key={i} className="h-16 bg-gray-700/50 rounded-lg w-full"></div>
                    ))}
                  </div>
                ) : topMangas.length === 0 ? (
                  <p className="text-gray-500 text-sm text-center py-10">
                    Chưa có lượt đọc nào
                  </p>
                ) : (
                  topMangas.slice(0, 10).map((manga, index) => (
                    <Link
                      key={manga.id}
                      href={`/manga/${manga.id}`}
                      className="flex items-center gap-4 group"
                    >
                      <div
                        className={`text-xl font-black w-6 text-center ${
                          index === 0
                            ? "text-yellow-400"
                            : index === 1
                            ? "text-gray-300"
                            : index === 2
                            ? "text-amber-600"
                            : "text-gray-600"
                        }`}
                      >
                        {index + 1}
                      </div>
                      <div className="w-12 h-16 rounded bg-gray-700 overflow-hidden shrink-0">
                        {manga.coverImage && (
                          <img
                            src={manga.coverImage}
                            alt={manga.title}
                            className="w-full h-full object-cover group-hover:scale-110 transition"
                          />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-gray-200 text-sm truncate group-hover:text-green-400">
                          {manga.title}
                        </h4>
                        <p className="text-xs text-gray-500 mt-1">
                          {manga.periodViews} lượt đọc
                        </p>
                      </div>
                    </Link>
                  ))
                )}
              </div>
            </div>

          </div>
        </div>

        {/* ===================================================================== */}
        {/* 🌟 5. [CUỐI TRANG] 🔴 PHÒNG XEM & ĐỌC CHUNG ĐANG MỞ (TỐI ĐA 4 PHÒNG MỖI LOẠI) */}
        {/* ===================================================================== */}
        <section className="pt-4 border-t border-gray-800/80 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="relative flex h-3.5 w-3.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-red-500"></span>
              </span>
              <h2 className="text-xl md:text-2xl font-black text-white">
                Watch Party & Co-Reading Room Currently in Use
              </h2>
            </div>

            <div className="flex items-center gap-3">
              <Link
                href="/party"
                className="px-4 py-2 rounded-xl bg-blue-600/15 hover:bg-blue-600/25 text-blue-400 border border-blue-500/30 text-xs font-bold transition"
              >
                🎉 Sảnh Watch Party &rarr;
              </Link>
              <Link
                href="/manga-room"
                className="px-4 py-2 rounded-xl bg-green-600/15 hover:bg-green-600/25 text-green-400 border border-green-500/30 text-xs font-bold transition"
              >
                📖 Sảnh Co-Reading &rarr;
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* KHỐI 1: TỐI ĐA 4 PHÒNG XEM PHIM (WATCH PARTY) */}
            <div className="bg-[#16181f] border border-gray-800 rounded-2xl p-5 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-800">
                  <h3 className="font-bold text-blue-400 flex items-center gap-2 text-base">
                    <span>🎬 Phòng Xem Anime (Watch Party)</span>
                  </h3>
                </div>

                {livePartyRooms.length === 0 ? (
                  <div className="py-10 text-center space-y-3">
                    <p className="text-gray-400 text-sm">
                      Hiện chưa có phòng xem phim công khai nào đang phát.
                    </p>
                    <Link
                      href="/party"
                      className="inline-block px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition shadow-lg shadow-blue-600/20"
                    >
                      + Tạo Phòng Xem Chung Ngay
                    </Link>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {livePartyRooms.slice(0, 4).map((room) => {
                      const memberCount =
                        room._count?.members ??
                        room.members?.filter((m) => !m.status || m.status === "JOINED").length ??
                        1;

                      return (
                        <Link
                          key={room.id}
                          href={`/party/${room.inviteCode}`}
                          className="group bg-gray-900/90 hover:bg-gray-800 border border-gray-800 hover:border-blue-500/60 rounded-xl p-3.5 transition flex flex-col justify-between gap-3"
                        >
                          <div>
                            <div className="flex items-center justify-between gap-2 mb-1.5">
                              <span className="px-2 py-0.5 rounded text-[10px] font-black bg-red-500/20 text-red-400 border border-red-500/30 flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>
                                LIVE
                              </span>
                              <span className="text-[11px] text-gray-400 font-semibold">
                                👥 {memberCount} người
                              </span>
                            </div>

                            <h4 className="font-bold text-sm text-white truncate group-hover:text-blue-400 transition">
                              {room.name}
                            </h4>
                            <p className="text-xs text-gray-400 truncate mt-0.5">
                              {room.anime?.title || "Đang chọn phim..."}
                              {room.episode?.title ? ` • ${room.episode.title}` : ""}
                            </p>
                          </div>

                          <div className="flex items-center justify-between pt-2 border-t border-gray-800/80 text-[11px]">
                            <span className="text-gray-500">
                              Mã: <strong className="text-gray-300">{room.inviteCode}</strong>
                            </span>
                            <span className="font-bold text-blue-400 group-hover:translate-x-0.5 transition-transform">
                              Tham gia &rarr;
                            </span>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* KHỐI 2: TỐI ĐA 4 PHÒNG ĐỌC TRUYỆN (CO-READING ROOM) */}
            <div className="bg-[#16181f] border border-gray-800 rounded-2xl p-5 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-800">
                  <h3 className="font-bold text-green-400 flex items-center gap-2 text-base">
                    <span>📖 Phòng Đọc Manga (Co-Reading)</span>
                  </h3>
                </div>

                {liveMangaRooms.length === 0 ? (
                  <div className="py-10 text-center space-y-3">
                    <p className="text-gray-400 text-sm">
                      Hiện chưa có phòng đọc truyện chung nào đang mở.
                    </p>
                    <Link
                      href="/manga-room"
                      className="inline-block px-4 py-2 rounded-xl bg-green-600 hover:bg-green-500 text-white text-xs font-bold transition shadow-lg shadow-green-600/20"
                    >
                      + Tạo Phòng Đọc Chung Ngay
                    </Link>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {liveMangaRooms.slice(0, 4).map((mRoom) => {
                      const targetCode = mRoom.inviteCode || mRoom.roomId || mRoom.id;
                      const memberCount =
                        mRoom._count?.members ?? mRoom.members?.length ?? 1;

                      return (
                        <Link
                          key={mRoom.id}
                          href={`/manga-room/${targetCode}`}
                          className="group bg-gray-900/90 hover:bg-gray-800 border border-gray-800 hover:border-green-500/60 rounded-xl p-3.5 transition flex flex-col justify-between gap-3"
                        >
                          <div>
                            <div className="flex items-center justify-between gap-2 mb-1.5">
                              <span className="px-2 py-0.5 rounded text-[10px] font-black bg-green-500/20 text-green-400 border border-green-500/30 flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"></span>
                                READING
                              </span>
                              <span className="text-[11px] text-gray-400 font-semibold">
                                👥 {memberCount} bạn đọc
                              </span>
                            </div>

                            <h4 className="font-bold text-sm text-white truncate group-hover:text-green-400 transition">
                              {mRoom.name || `Phòng #${targetCode}`}
                            </h4>
                            <p className="text-xs text-gray-400 truncate mt-0.5">
                              {mRoom.manga?.title || "Đang chọn truyện..."}
                              {mRoom.chapter?.title ? ` • ${mRoom.chapter.title}` : ""}
                            </p>
                          </div>

                          <div className="flex items-center justify-between pt-2 border-t border-gray-800/80 text-[11px]">
                            <span className="text-gray-500">
                              Mã: <strong className="text-gray-300">{targetCode}</strong>
                            </span>
                            <span className="font-bold text-green-400 group-hover:translate-x-0.5 transition-transform">
                              Vào đọc &rarr;
                            </span>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

          </div>
        </section>

      </div>
    </div>
  );
}