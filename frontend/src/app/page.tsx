"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Manga {
  id: string;
  title: string;
  coverImage: string;
}

export default function Home() {
  const [recentMangas, setRecentMangas] = useState<Manga[]>([]);

  useEffect(() => {
    // Gọi API lấy truyện, có thể viết thêm logic slice(0, 10) để chỉ lấy 10 truyện mới nhất
    fetch("http://localhost:5000/api/manga")
      .then(res => res.json())
      .then(data => setRecentMangas(data.slice(0, 10))) 
      .catch(err => console.error(err));
  }, []);

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-6xl mx-auto">
        
        {/* Banner hoặc Hero Section của bạn ở đây */}
        <div className="bg-gray-800 rounded-2xl p-10 mb-12 text-center shadow-2xl">
          <h1 className="text-4xl font-black mb-4">Welcome to the Smart Anime Platform</h1>
          <p className="text-gray-400 mb-6">Discover the amazing world of Anime and Manga.</p>
        </div>

        {/* Section: Manga Mới Cập Nhật */}
        <div className="flex justify-between items-end mb-6">
          <h2 className="text-2xl font-bold border-l-4 border-blue-500 pl-3">Manga Mới Cập Nhật</h2>
          <Link href="/manga" className="text-sm text-blue-400 hover:underline">Xem tất cả &rarr;</Link>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
          {recentMangas.map((manga) => (
            <Link key={manga.id} href={`/manga/${manga.id}`} className="group">
              <div className="bg-gray-800 rounded-lg overflow-hidden shadow-lg transition-transform group-hover:-translate-y-2">
                <div className="aspect-[2/3] w-full bg-gray-700">
                  {manga.coverImage && <img src={manga.coverImage} alt={manga.title} className="w-full h-full object-cover" />}
                </div>
                <div className="p-3"><h3 className="font-bold text-sm truncate group-hover:text-blue-400">{manga.title}</h3></div>
              </div>
            </Link>
          ))}
        </div>

      </div>
    </div>
  );
}