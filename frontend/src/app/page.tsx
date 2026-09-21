"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Manga {
  id: string;
  title: string;
  coverImage: string | null;
  periodViews?: number;
  _count?: { chapters: number };
}

interface Anime {
  id: string;
  title: string;
  coverImage: string | null;
  periodViews?: number;
  _count: { episodes: number };
}

// 🌟 Đã đưa component TabButton ra ngoài để tránh lỗi "Cannot create components during render"
const TabButton = ({ active, onClick, label }: { active: boolean, onClick: () => void, label: string }) => (
  <button 
    onClick={onClick}
    className={`px-3 py-1 text-xs font-bold rounded-md transition ${active ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
  >
    {label}
  </button>
);

export default function Home() {
  // States cho phim mới
  const [recentMangas, setRecentMangas] = useState<Manga[]>([]);
  const [recentAnimes, setRecentAnimes] = useState<Anime[]>([]);
  const [loading, setLoading] = useState(true);

  // States cho bảng xếp hạng
  const [topAnimePeriod, setTopAnimePeriod] = useState<"day" | "week" | "month">("day");
  const [topMangaPeriod, setTopMangaPeriod] = useState<"day" | "week" | "month">("day");
  const [topAnimes, setTopAnimes] = useState<Anime[]>([]);
  const [topMangas, setTopMangas] = useState<Manga[]>([]);
  const [loadingTopAnime, setLoadingTopAnime] = useState(false);
  const [loadingTopManga, setLoadingTopManga] = useState(false);

  // 1. Fetch dữ liệu mới cập nhật (chạy 1 lần)
  useEffect(() => {
    const fetchHomepageData = async () => {
      try {
        const [mangaRes, animeRes] = await Promise.all([
          fetch("http://localhost:5000/api/manga"),
          fetch("http://localhost:5000/api/anime")
        ]);

        if (mangaRes.ok) setRecentMangas((await mangaRes.json()).slice(0, 10));
        if (animeRes.ok) setRecentAnimes((await animeRes.json()).slice(0, 10));
      } catch (err) {
        console.error("Lỗi khi tải dữ liệu trang chủ:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchHomepageData();
  }, []);

  // 2. Fetch Top Anime mỗi khi đổi Tab thời gian
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

  // 3. Fetch Top Manga mỗi khi đổi Tab thời gian
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

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-900">
        <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4 md:p-8">
      <div className="max-w-[1400px] mx-auto">
        
        {/* HERO SECTION */}
        <div className="bg-gray-800 rounded-2xl p-8 md:p-10 mb-8 md:mb-12 text-center shadow-2xl relative overflow-hidden border border-gray-700">
          <div className="absolute top-[-50%] left-[-10%] w-64 h-64 bg-blue-600/20 blur-3xl rounded-full"></div>
          <div className="absolute bottom-[-50%] right-[-10%] w-64 h-64 bg-purple-600/20 blur-3xl rounded-full"></div>
          
          <div className="relative z-10">
            <h1 className="text-3xl md:text-5xl font-black mb-4 text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500">
              Welcome to Smart Anime Platform
            </h1>
            <p className="text-gray-400 text-base md:text-lg mb-2 max-w-2xl mx-auto">
              The ultimate platform for exploring and enjoying the world of Anime & Manga. 
            </p>
          </div>
        </div>

        {/* LAYOUT GRID: Trái (Updates) - Phải (Top Rankings) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* CỘT TRÁI (Chiếm 8 phần): NỘI DUNG MỚI CẬP NHẬT */}
          <div className="lg:col-span-8 space-y-12">
            
            {/* ANIME MỚI */}
            <section>
              <div className="flex justify-between items-end mb-6">
                <h2 className="text-xl md:text-2xl font-bold border-l-4 border-blue-500 pl-3">New Anime Updates</h2>
                <Link href="/anime" className="text-sm text-blue-400 hover:text-blue-300 hover:underline">View All &rarr;</Link>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 md:gap-6">
                {recentAnimes.map((anime) => (
                  <Link key={anime.id} href={`/anime/${anime.id}`} className="group block">
                    <div className="bg-gray-800 rounded-xl overflow-hidden shadow-lg border border-gray-800 hover:border-blue-500 transition-all duration-300">
                      <div className="relative aspect-[2/3] w-full bg-gray-900 overflow-hidden">
                        {anime.coverImage ? (
                          <img src={anime.coverImage} alt={anime.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-600">Trống</div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                        <div className="absolute top-2 left-2 bg-blue-600/90 backdrop-blur-sm text-white font-bold text-xs px-2 py-1 rounded">
                          {anime._count?.episodes || 0} Episodes
                        </div>
                      </div>
                      <div className="p-3">
                        <h3 className="font-bold text-gray-200 text-sm md:text-base truncate group-hover:text-blue-400">{anime.title}</h3>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>

            {/* MANGA MỚI */}
            <section>
              <div className="flex justify-between items-end mb-6">
                <h2 className="text-xl md:text-2xl font-bold border-l-4 border-green-500 pl-3">New Manga Updates</h2>
                <Link href="/manga" className="text-sm text-green-400 hover:text-green-300 hover:underline">View All &rarr;</Link>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 md:gap-6">
                {recentMangas.map((manga) => (
                  <Link key={manga.id} href={`/manga/${manga.id}`} className="group block">
                    <div className="bg-gray-800 rounded-xl overflow-hidden shadow-lg border border-gray-800 hover:border-green-500 transition-all duration-300">
                      <div className="relative aspect-[2/3] w-full bg-gray-900 overflow-hidden">
                        {manga.coverImage ? (
                          <img src={manga.coverImage} alt={manga.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-600">Trống</div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                        <div className="absolute top-2 left-2 bg-green-600/90 backdrop-blur-sm text-white font-bold text-xs px-2 py-1 rounded">
                          {manga._count?.chapters || 0} Chapters
                        </div>
                      </div>
                      <div className="p-3">
                        <h3 className="font-bold text-gray-200 text-sm md:text-base truncate group-hover:text-green-400">{manga.title}</h3>
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
            <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-5">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-5 gap-3">
                <h2 className="text-lg font-bold text-blue-400 flex items-center gap-2">
                  🔥 Top Anime
                </h2>
                <div className="flex bg-gray-900 rounded-lg p-1 gap-1">
                  <TabButton label="Day" active={topAnimePeriod === "day"} onClick={() => setTopAnimePeriod("day")} />
                  <TabButton label="Week" active={topAnimePeriod === "week"} onClick={() => setTopAnimePeriod("week")} />
                  <TabButton label="Month" active={topAnimePeriod === "month"} onClick={() => setTopAnimePeriod("month")} />
                </div>
              </div>

              <div className="space-y-4 min-h-[300px]">
                {loadingTopAnime ? (
                   <div className="animate-pulse space-y-4">
                     {[1,2,3,4,5].map(i => <div key={i} className="h-16 bg-gray-700/50 rounded-lg w-full"></div>)}
                   </div>
                ) : topAnimes.length === 0 ? (
                  <p className="text-gray-500 text-sm text-center py-10">Chưa có dữ liệu lượt xem</p>
                ) : (
                  topAnimes.slice(0, 10).map((anime, index) => (
                    <Link key={anime.id} href={`/anime/${anime.id}`} className="flex items-center gap-4 group">
                      <div className={`text-xl font-black w-6 text-center ${index === 0 ? 'text-yellow-400' : index === 1 ? 'text-gray-300' : index === 2 ? 'text-amber-600' : 'text-gray-600'}`}>
                        {index + 1}
                      </div>
                      <div className="w-12 h-16 rounded bg-gray-700 overflow-hidden shrink-0">
                        {anime.coverImage && <img src={anime.coverImage} className="w-full h-full object-cover group-hover:scale-110 transition" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-gray-200 text-sm truncate group-hover:text-blue-400">{anime.title}</h4>
                        <p className="text-xs text-gray-500 mt-1">{anime.periodViews} lượt xem</p>
                      </div>
                    </Link>
                  ))
                )}
              </div>
            </div>

            {/* TOP MANGA WIDGET */}
            <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-5">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-5 gap-3">
                <h2 className="text-lg font-bold text-green-400 flex items-center gap-2">
                  🔥 Top Manga
                </h2>
                <div className="flex bg-gray-900 rounded-lg p-1 gap-1">
                  <TabButton label="Day" active={topMangaPeriod === "day"} onClick={() => setTopMangaPeriod("day")} />
                  <TabButton label="Week" active={topMangaPeriod === "week"} onClick={() => setTopMangaPeriod("week")} />
                  <TabButton label="Month" active={topMangaPeriod === "month"} onClick={() => setTopMangaPeriod("month")} />
                </div>
              </div>

              <div className="space-y-4 min-h-[300px]">
                {loadingTopManga ? (
                   <div className="animate-pulse space-y-4">
                     {[1,2,3,4,5].map(i => <div key={i} className="h-16 bg-gray-700/50 rounded-lg w-full"></div>)}
                   </div>
                ) : topMangas.length === 0 ? (
                  <p className="text-gray-500 text-sm text-center py-10">Chưa có lượt đọc nào</p>
                ) : (
                  topMangas.slice(0, 10).map((manga, index) => (
                    <Link key={manga.id} href={`/manga/${manga.id}`} className="flex items-center gap-4 group">
                      <div className={`text-xl font-black w-6 text-center ${index === 0 ? 'text-yellow-400' : index === 1 ? 'text-gray-300' : index === 2 ? 'text-amber-600' : 'text-gray-600'}`}>
                        {index + 1}
                      </div>
                      <div className="w-12 h-16 rounded bg-gray-700 overflow-hidden shrink-0">
                        {manga.coverImage && <img src={manga.coverImage} className="w-full h-full object-cover group-hover:scale-110 transition" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-gray-200 text-sm truncate group-hover:text-green-400">{manga.title}</h4>
                        <p className="text-xs text-gray-500 mt-1">{manga.periodViews} lượt đọc</p>
                      </div>
                    </Link>
                  ))
                )}
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}