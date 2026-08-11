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
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-8 border-l-4 border-green-500 pl-4">Explore Manga</h1>
        
        {loading ? (
          <p className="text-center text-gray-400">Loading manga list...</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
            {mangas.map((manga) => (
              <Link key={manga.id} href={`/manga/${manga.id}`} className="group">
                <div className="bg-gray-800 rounded-lg overflow-hidden shadow-lg transition-transform group-hover:-translate-y-2 group-hover:shadow-green-500/20">
                  <div className="relative aspect-[2/3] w-full">
                    {/* Nếu không có coverImage thì hiển thị màu xám mờ */}
                    {manga.coverImage ? (
                      <img src={manga.coverImage} alt={manga.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-gray-700 flex items-center justify-center text-gray-500 text-sm">No Image</div>
                    )}
                    
                    {/* 🌟 Nhãn Số Chapters: Góc trái, nền xanh, chữ trắng */}
                    <div className="absolute top-2 left-2 bg-green-600/90 px-2 py-1 rounded text-[10px] font-bold text-white shadow-md backdrop-blur-sm">
                      {manga._count?.chapters || 0} Chapters
                    </div>
                  </div>
                  <div className="p-3">
                    <h3 className="font-bold text-sm truncate group-hover:text-green-400 transition">{manga.title}</h3>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}