"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

// Khai báo kiểu dữ liệu cho Manga
interface Manga {
  id: string;
  title: string;
  coverImage: string | null;
}

// Khai báo kiểu dữ liệu cho Anime
interface Anime {
  id: string;
  title: string;
  coverImage: string | null;
  _count: {
    episodes: number;
  };
}

export default function Home() {
  const [recentMangas, setRecentMangas] = useState<Manga[]>([]);
  const [recentAnimes, setRecentAnimes] = useState<Anime[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHomepageData = async () => {
      try {
        // Dùng Promise.all để gọi 2 API song song, giúp trang tải nhanh gấp đôi
        const [mangaRes, animeRes] = await Promise.all([
          fetch("http://localhost:5000/api/manga"),
          fetch("http://localhost:5000/api/anime")
        ]);

        if (mangaRes.ok) {
          const mangaData = await mangaRes.json();
          setRecentMangas(mangaData.slice(0, 10)); // Chỉ lấy 10 truyện mới nhất
        }

        if (animeRes.ok) {
          const animeData = await animeRes.json();
          setRecentAnimes(animeData.slice(0, 10)); // Chỉ lấy 10 phim mới nhất
        }
      } catch (err) {
        console.error("Lỗi khi tải dữ liệu trang chủ:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchHomepageData();
  }, []);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-900">
        <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-7xl mx-auto">
        
        {/* HERO SECTION */}
        <div className="bg-gray-800 rounded-2xl p-10 mb-12 text-center shadow-2xl relative overflow-hidden border border-gray-700">
          {/* Hiệu ứng nền trang trí mờ */}
          <div className="absolute top-[-50%] left-[-10%] w-64 h-64 bg-blue-600/20 blur-3xl rounded-full"></div>
          <div className="absolute bottom-[-50%] right-[-10%] w-64 h-64 bg-purple-600/20 blur-3xl rounded-full"></div>
          
          <div className="relative z-10">
            <h1 className="text-4xl md:text-5xl font-black mb-4 text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500">
              Welcome to Smart Anime Platform
            </h1>
            <p className="text-gray-400 text-lg mb-6 max-w-2xl mx-auto">
              The ultimate platform for exploring and enjoying the world of Anime & Manga. Fastest updates, smoothest experience.
            </p>
          </div>
        </div>

        {/* =========================================
            SECTION: ANIME MỚI CẬP NHẬT
        ========================================== */}
        <div className="mb-12">
          <div className="flex justify-between items-end mb-6">
            <h2 className="text-2xl font-bold border-l-4 border-blue-500 pl-3">New Anime Updates</h2>
            <Link href="/anime" className="text-sm text-blue-400 hover:text-blue-300 hover:underline transition">
              View All &rarr;
            </Link>
          </div>

          {recentAnimes.length === 0 ? (
            <p className="text-gray-500 italic">No new anime updates available.</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
              {recentAnimes.map((anime) => (
                <Link key={anime.id} href={`/anime/${anime.id}`} className="group">
                  <div className="bg-gray-800 rounded-xl overflow-hidden shadow-lg border border-gray-800 hover:border-blue-500 transition-all duration-300">
                    <div className="relative aspect-[2/3] w-full bg-gray-900 overflow-hidden">
                      {anime.coverImage ? (
                        <img src={anime.coverImage} alt={anime.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-600">Trống</div>
                      )}
                      
                      {/* Overlay mờ khi hover */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                      
                      {/* Badge Số Tập */}
                      <div className="absolute top-2 left-2 bg-blue-600/90 backdrop-blur-sm text-white font-bold text-xs px-2 py-1 rounded">
                        {anime._count?.episodes || 0} Episodes
                      </div>
                    </div>
                    <div className="p-4">
                      <h3 className="font-bold text-gray-200 truncate group-hover:text-blue-400 transition">{anime.title}</h3>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* =========================================
            SECTION: MANGA MỚI CẬP NHẬT
        ========================================== */}
        <div>
          <div className="flex justify-between items-end mb-6">
            <h2 className="text-2xl font-bold border-l-4 border-green-500 pl-3">New Manga Updates</h2>
            <Link href="/manga" className="text-sm text-green-400 hover:text-green-300 hover:underline transition">
              View All &rarr;
            </Link>
          </div>

          {recentMangas.length === 0 ? (
            <p className="text-gray-500 italic">No new manga updates available.</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
              {recentMangas.map((manga) => (
                <Link key={manga.id} href={`/manga/${manga.id}`} className="group">
                  <div className="bg-gray-800 rounded-xl overflow-hidden shadow-lg border border-gray-800 hover:border-green-500 transition-all duration-300">
                    <div className="relative aspect-[2/3] w-full bg-gray-900 overflow-hidden">
                      {manga.coverImage ? (
                        <img src={manga.coverImage} alt={manga.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-600">Trống</div>
                      )}
                      {/* Overlay mờ khi hover */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                    </div>
                    <div className="p-4">
                      <h3 className="font-bold text-gray-200 truncate group-hover:text-green-400 transition">{manga.title}</h3>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}