"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Manga {
  id: string;
  title: string;
  author: string;
  status: string;
  coverImage: string;
  // Bổ sung thêm đếm số chapter nếu API backend có hỗ trợ
  _count?: {
    chapters: number;
  };
}

export default function AdminMangaList() {
  const [mangas, setMangas] = useState<Manga[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMangas = async () => {
      try {
        const res = await fetch("http://localhost:5000/api/admin/manga");
        if (res.ok) {
          const data = await res.json();
          setMangas(data);
        }
      } catch (error) {
        console.error("Lỗi fetch manga:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchMangas();
  }, []);

  return (
    <div className="p-8 text-white min-h-screen bg-[#0f0f11]">
      
      {/* THANH HEADER GIỐNG GIAO DIỆN ANIME */}
      <div className="bg-[#1a1d24] rounded-2xl p-6 flex flex-col md:flex-row justify-between items-center mb-8 shadow-lg border border-gray-800">
        <div>
          <h1 className="text-2xl font-black text-green-400 mb-1">Manga Inventory Management</h1>
          <p className="text-sm text-gray-400">
            System currently has <span className="text-white font-bold">{mangas.length}</span> manga titles
          </p>
        </div>
        
        <div className="flex gap-4 mt-4 md:mt-0">
          <Link 
            href="/admin" 
            className="px-5 py-2.5 bg-[#2a2d35] hover:bg-[#353943] rounded-lg font-bold transition text-gray-300 flex items-center justify-center text-sm shadow-md"
          >
            Return Dashboard
          </Link>

          <Link 
            href="/admin/manga/upload" 
            className="px-5 py-2.5 bg-green-600 hover:bg-blue-500 rounded-lg font-bold shadow-lg shadow-blue-600/30 transition text-white flex items-center justify-center text-sm"
          >
            + Add New Manga
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : (
        <>
          {mangas.length === 0 ? (
            <div className="bg-[#1a1d24] p-12 text-center rounded-2xl border border-gray-800 text-gray-500">
              No manga available in the system.
            </div>
          ) : (
            /* DANH SÁCH THẺ MANGA (GRID) */
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
              {mangas.map((manga) => (
                <Link 
                  href={`/admin/manga/${manga.id}`} 
                  key={manga.id} 
                  className="group relative rounded-xl overflow-hidden bg-[#1a1d24] border border-gray-800 hover:border-blue-500 transition-all duration-300 shadow-lg flex flex-col cursor-pointer"
                >
                  {/* KHU VỰC ẢNH BÌA */}
                  <div className="relative aspect-[2/3] w-full overflow-hidden bg-gray-900">
                    <img 
                      src={manga.coverImage || "https://via.placeholder.com/300x450?text=No+Image"} 
                      alt={manga.title} 
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                    />
                    
                    {/* NHÃN DÁN ĐẾM SỐ CHAPTER */}
                    <div className="absolute top-2 left-2 bg-black/80 backdrop-blur-sm text-green-400 font-bold px-2.5 py-1 rounded-lg text-xs">
                      {manga._count?.chapters || 0} Chapters
                    </div>
                  </div>

                  {/* KHU VỰC TIÊU ĐỀ */}
                  <div className="p-3.5 bg-[#1a1d24]">
                    <h3 className="font-bold text-gray-200 text-sm truncate group-hover:text-blue-400 transition-colors">
                      {manga.title}
                    </h3>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}