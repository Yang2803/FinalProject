"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

// 1. Khai báo Interface mô tả cấu trúc của một bộ Anime
interface Anime {
  id: string;
  title: string;
  coverImage: string | null;
  _count: {
    episodes: number;
  };
}

export default function UserAnimeListPage() {
  const router = useRouter();
  
  // 2. Thay <any[]> thành <Anime[]>
  const [animes, setAnimes] = useState<Anime[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAnimes = async () => {
      try {
        const res = await fetch("http://localhost:5000/api/anime");
        if (res.ok) {
          const data = await res.json();
          setAnimes(data);
        }
      } catch (error) {
        console.error("Lỗi:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchAnimes();
  }, []);

  if (loading) return <div className="text-white text-center mt-20">Đang tải danh sách phim...</div>;

  return (
    <div className="min-h-screen bg-[#0f0f11] text-white p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-black text-blue-400 mb-8 border-l-4 border-blue-500 pl-4">Khám Phá Anime</h1>
        
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
          {animes.map((anime) => (
            <Link key={anime.id} href={`/anime/${anime.id}`}>
              <div className="bg-gray-800 rounded-xl overflow-hidden shadow-lg group cursor-pointer border border-gray-800 hover:border-blue-500 transition-all duration-300">
                <div className="relative aspect-[2/3] w-full bg-gray-900 overflow-hidden">
                  {anime.coverImage ? (
                    <img src={anime.coverImage} alt={anime.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-600">Trống</div>
                  )}
                  {/* Overlay đen bóng */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                  
                  {/* Badge số tập */}
                  <div className="absolute top-2 left-2 bg-blue-600/90 text-white font-bold text-xs px-2 py-1 rounded">
                    {anime._count.episodes} Tập
                  </div>
                </div>
                <div className="p-4">
                  <h3 className="font-bold text-gray-200 truncate group-hover:text-blue-400 transition">{anime.title}</h3>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}