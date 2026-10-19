"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Manga {
  id: string;
  title: string;
  coverImage: string | null;
  status: string;
  _count?: {
    chapters: number;
  };
}

export default function PublicMangaList() {
  const [mangas, setMangas] = useState<Manga[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMangas = async () => {
      try {
        const res = await fetch("http://localhost:5000/api/manga");
        if (res.ok) {
          const data = await res.json();
          setMangas(data);
        }
      } catch (error) {
        console.error("Lỗi fetch:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchMangas();
  }, []);

  return (
  <div className="min-h-screen bg-[#0f0f13] text-white p-4 md:p-8">
    <div className="max-w-7xl mx-auto">
      
      {/* 🌟 HEADER: Gradient Text tông Emerald / Green với gạch trang trí & badge đếm số lượng truyện */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10 pb-6 border-b border-gray-800/60 relative">
        <div className="absolute bottom-0 left-0 w-36 h-px bg-gradient-to-r from-emerald-500 to-teal-400"></div>
        <div>
          <div className="flex items-center gap-3 mb-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_#10b981]"></span>
            <span className="text-xs font-bold uppercase tracking-widest text-emerald-400">Manga Library</span>
          </div>
          <h1 className="text-3xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 tracking-tight">
            Explore Manga
          </h1>
        </div>

        <div className="text-sm font-bold text-gray-400 bg-gray-800/40 px-4 py-2 rounded-full border border-gray-700/50 shadow-inner flex items-center gap-2 self-start sm:self-auto">
          <span>📖</span>
          <span>{mangas.length} {mangas.length <= 1 ? 'Manga' : 'Mangas'} Available</span>
        </div>
      </div>

      {/* 🌟 KHU VỰC HIỂN THỊ DANH SÁCH */}
      {loading ? (
        /* Loading Skeleton / Spinner State */
        <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4">
          <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin shadow-[0_0_15px_rgba(16,185,129,0.4)]"></div>
          <p className="text-gray-400 text-sm font-medium animate-pulse tracking-wide">Loading manga library...</p>
        </div>
      ) : mangas.length === 0 ? (
        /* Empty State */
        <div className="relative overflow-hidden bg-gradient-to-b from-gray-800/40 to-[#0f0f13] rounded-3xl p-12 md:p-16 text-center border border-gray-800 shadow-2xl flex flex-col items-center justify-center min-h-[40vh]">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-emerald-500/10 blur-[100px] rounded-full pointer-events-none"></div>
          <span className="text-6xl mb-4 drop-shadow-2xl">📚</span>
          <h3 className="text-2xl font-bold text-gray-200 mb-2">No Manga Found</h3>
          <p className="text-gray-400 max-w-md mx-auto text-sm">
            There are no manga titles available right now. Please check back later!
          </p>
        </div>
      ) : (
        /* Grid Manga: Responsive mượt mà từ 2 cột điện thoại đến 6 cột màn hình PC */
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-6">
          {mangas.map((manga) => (
            <Link 
              key={manga.id} 
              href={`/manga/${manga.id}`}
              className="group relative flex flex-col rounded-2xl overflow-hidden bg-[#1a1a24] border border-gray-800/80 hover:border-emerald-500/50 transition-all duration-500 hover:-translate-y-2 shadow-lg hover:shadow-emerald-500/20"
            >
              {/* Khung Poster */}
              <div className="relative aspect-[2/3] w-full bg-gray-900 overflow-hidden shrink-0">
                {manga.coverImage ? (
                  <img 
                    src={manga.coverImage} 
                    alt={manga.title} 
                    className="w-full h-full object-cover opacity-90 group-hover:opacity-100 group-hover:scale-110 transition-all duration-700 ease-out" 
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-gray-600 bg-gray-900">
                    <svg className="w-10 h-10 mb-2 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                    <span className="text-xs font-medium tracking-widest uppercase">No Cover</span>
                  </div>
                )}

                {/* Gradient tối dần tạo chiều sâu chân ảnh */}
                <div className="absolute inset-0 bg-gradient-to-t from-[#1a1a24] via-black/20 to-transparent opacity-90"></div>
                
                {/* 🌟 Nút "Read" hiển thị mượt mà khi hover */}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 bg-black/20 backdrop-blur-[2px]">
                  <div className="w-11 h-11 rounded-full bg-emerald-600/90 text-white flex items-center justify-center shadow-[0_0_15px_rgba(16,185,129,0.6)] transform scale-75 group-hover:scale-100 transition-transform duration-300">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                  </div>
                </div>

                {/* Nhãn Số Chapters (Badge kính mờ ở góc dưới trái) */}
                <div className="absolute bottom-3 left-3 z-10 flex items-center gap-1.5 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-md border border-gray-700/50 shadow-md">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_5px_#34d399]"></span>
                  <span className="text-[10px] font-bold text-gray-200 uppercase tracking-wider">
                    {manga._count?.chapters || 0} Chapters
                  </span>
                </div>
              </div>

              {/* Thông tin tên Manga */}
              <div className="p-4 pt-3 flex-1 flex flex-col justify-between">
                <h3 className="font-bold text-sm text-gray-200 line-clamp-2 group-hover:text-emerald-400 transition-colors duration-300 leading-snug">
                  {manga.title}
                </h3>
              </div>
            </Link>
          ))}
        </div>
      )}

    </div>
  </div>
);}