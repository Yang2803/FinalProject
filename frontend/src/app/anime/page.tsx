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

  if (loading) return <div className="text-white text-center mt-20">Loading anime list...</div>;

  return (
  <div className="min-h-screen bg-[#0f0f13] text-white p-4 md:p-8">
    <div className="max-w-7xl mx-auto">
      
      {/* 🌟 HEADER: Tiêu đề Gradient Text với gạch viền trang trí và tổng số lượng phim */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10 pb-6 border-b border-gray-800/60 relative">
        <div className="absolute bottom-0 left-0 w-36 h-px bg-gradient-to-r from-blue-500 to-purple-500"></div>
        <div>
          <div className="flex items-center gap-3 mb-2">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse shadow-[0_0_10px_#3b82f6]"></span>
            <span className="text-xs font-bold uppercase tracking-widest text-blue-400">Library Collection</span>
          </div>
          <h1 className="text-3xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-500 tracking-tight">
            Explore Anime
          </h1>
        </div>

        <div className="text-sm font-bold text-gray-400 bg-gray-800/40 px-4 py-2 rounded-full border border-gray-700/50 shadow-inner flex items-center gap-2 self-start sm:self-auto">
          <span>🎬</span>
          <span>{animes.length} {animes.length <= 1 ? 'Anime' : 'Animes'} Available</span>
        </div>
      </div>

      {/* 🌟 DANH SÁCH ANIME */}
      {animes.length === 0 ? (
        /* Empty State */
        <div className="relative overflow-hidden bg-gradient-to-b from-gray-800/40 to-[#0f0f13] rounded-3xl p-12 md:p-16 text-center border border-gray-800 shadow-2xl flex flex-col items-center justify-center min-h-[40vh]">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-500/10 blur-[100px] rounded-full pointer-events-none"></div>
          <span className="text-6xl mb-4 drop-shadow-2xl">📽️</span>
          <h3 className="text-2xl font-bold text-gray-200 mb-2">No Anime Found</h3>
          <p className="text-gray-400 max-w-md mx-auto text-sm">
            There are no anime titles available at the moment. Please check back later!
          </p>
        </div>
      ) : (
        /* Grid Anime: Tỷ lệ co giãn mượt từ 2 cột điện thoại đến 6 cột màn hình rộng */
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-6">
          {animes.map((anime) => (
            <Link 
              key={anime.id} 
              href={`/anime/${anime.id}`}
              className="group relative flex flex-col rounded-2xl overflow-hidden bg-[#1a1a24] border border-gray-800/80 hover:border-blue-500/50 transition-all duration-500 hover:-translate-y-2 shadow-lg hover:shadow-blue-500/20"
            >
              {/* Poster Frame */}
              <div className="relative aspect-[2/3] w-full bg-gray-900 overflow-hidden shrink-0">
                {anime.coverImage ? (
                  <img 
                    src={anime.coverImage} 
                    alt={anime.title} 
                    className="w-full h-full object-cover opacity-90 group-hover:opacity-100 group-hover:scale-110 transition-all duration-700 ease-out" 
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-gray-600 bg-gray-900">
                    <svg className="w-10 h-10 mb-2 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    <span className="text-xs font-medium tracking-widest uppercase">No Poster</span>
                  </div>
                )}

                {/* Gradient che tối chân ảnh tạo độ nổi cho badge và tiêu đề */}
                <div className="absolute inset-0 bg-gradient-to-t from-[#1a1a24] via-black/20 to-transparent opacity-90"></div>
                
                {/* 🌟 Nút Play hiển thị mượt mà khi hover */}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 bg-black/20 backdrop-blur-[2px]">
                  <div className="w-11 h-11 rounded-full bg-blue-600/90 text-white flex items-center justify-center shadow-[0_0_15px_rgba(37,99,235,0.6)] transform scale-75 group-hover:scale-100 transition-transform duration-300">
                    <svg className="w-5 h-5 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </div>
                </div>

                {/* Badge Số Tập */}
                <div className="absolute bottom-3 left-3 z-10 flex items-center gap-1.5 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-md border border-gray-700/50 shadow-md">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse shadow-[0_0_5px_#60a5fa]"></span>
                  <span className="text-[10px] font-bold text-gray-200 uppercase tracking-wider">
                    {anime._count?.episodes || 0} Episodes
                  </span>
                </div>
              </div>

              {/* Thông tin tên Anime */}
              <div className="p-4 pt-3 flex-1 flex flex-col justify-between">
                <h3 className="font-bold text-sm text-gray-200 line-clamp-2 group-hover:text-blue-400 transition-colors duration-300 leading-snug">
                  {anime.title}
                </h3>
              </div>
            </Link>
          ))}
        </div>
      )}

    </div>
  </div>
);}