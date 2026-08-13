"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

export default function ForumLayout({ children }: { children: React.ReactNode }) {
  // State để lưu danh sách top 5 tags từ Backend
  const [trendingTags, setTrendingTags] = useState<string[]>([]);
  const [isLoadingTags, setIsLoadingTags] = useState(true);

  // Gọi API khi Layout được render lần đầu
  useEffect(() => {
    const fetchTrendingTags = async () => {
      try {
        const res = await fetch("http://localhost:5000/api/forum/trending-tags");
        if (res.ok) {
          const data = await res.json();
          setTrendingTags(data);
        }
      } catch (error) {
        console.error("Lỗi khi tải Trending Tags:", error);
      } finally {
        setIsLoadingTags(false);
      }
    };

    fetchTrendingTags();
  }, []);

  return (
    // Giả sử component bọc ngoài cùng đã chứa Navbar cố định bên trái (w-64)
    // Phần này là không gian bên phải Navbar
    <div className="flex justify-center min-h-screen bg-[#0f0f11] text-white">
      
      {/* CỘT GIỮA: FEED CHÍNH (Chiếm diện tích lớn nhất) */}
      <main className="w-full max-w-3xl border-l border-r border-gray-800">
        {/* Nơi chứa Form đăng bài và List bài viết */}
        <div className="p-6">
          {children}
        </div>
      </main>

      {/* CỘT PHẢI: WIDGETS CỘNG ĐỒNG (Ẩn trên mobile) */}
      <aside className="hidden lg:block w-80 p-6 space-y-6 sticky top-0 h-screen overflow-y-auto">
        
        {/* Nút Community */}
        <Link href="/forum/communities">
          <button className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-4 rounded-xl transition shadow-lg shadow-blue-600/20 mb-6">
             Explore Community
          </button>
        </Link>

        {/* 🌟 THAY ĐỔI Ở ĐÂY: Trending Tags Động */}
        <div className="bg-[#1a1d24] rounded-xl border border-gray-800 p-4 shadow-sm">
          <h3 className="font-bold text-gray-200 mb-4 flex items-center gap-2">
            <svg className="w-4 h-4 text-orange-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M12.395 2.553a1 1 0 00-1.45-.385c-.345.23-.614.558-.822.88-.214.33-.403.713-.57 1.116-.334.804-.614 1.768-.84 2.734a31.365 31.365 0 00-.613 3.58 2.64 2.64 0 01-.945-1.067c-.328-.68-.398-1.534-.398-2.654A1 1 0 005.05 6.05 6.981 6.981 0 003 11a7 7 0 1011.95-4.95c-.592-.591-.98-.985-1.348-1.467-.363-.476-.724-1.063-1.207-2.03zM12.12 15.12A3 3 0 017 13s.879.5 2.5.5c0-1 .5-4 1.25-4.5.5 1 .786 1.293 1.371 1.879A2.99 2.99 0 0113 13a2.99 2.99 0 01-.879 2.121z" clipRule="evenodd" />
            </svg>
            Trending Tags
          </h3>
          
          <div className="flex flex-wrap gap-2">
            {isLoadingTags ? (
              <span className="text-gray-500 text-sm italic">Đang tải...</span>
            ) : trendingTags.length === 0 ? (
              <span className="text-gray-500 text-sm italic">Chưa có dữ liệu</span>
            ) : (
              trendingTags.map((tag) => (
              // 🌟 Bọc bằng thẻ Link để chuyển hướng
              <Link key={tag} href={`/forum?tag=${tag}`}>
                <span className="bg-gray-800/80 border border-gray-700 text-xs px-3 py-1.5 rounded-full text-blue-400 cursor-pointer hover:bg-gray-700 hover:border-gray-600 transition inline-block">
                  #{tag}
                </span>
              </Link>
            ))
            )}
          </div>
        </div>

      </aside>
    </div>
  );
}