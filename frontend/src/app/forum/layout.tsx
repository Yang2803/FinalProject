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
    // Nền đen sâu để làm nổi bật các hiệu ứng phát sáng (Glow)
    <div className="flex justify-center min-h-screen bg-[#0a0b0f] text-white">
      
      {/* CỘT GIỮA: FEED CHÍNH */}
      <main className="w-full max-w-3xl border-l border-r border-gray-800/60 bg-[#12141a]/80">
        <div className="p-6 md:p-8">
          {children}
        </div>
      </main>

      {/* CỘT PHẢI: WIDGETS CỘNG ĐỒNG */}
      <aside className="hidden lg:block w-80 p-6 space-y-8 sticky top-0 h-screen overflow-y-auto custom-scrollbar">
        
        {/* Nút Community - Đổi sang thẻ Link khối với hiệu ứng Gradient & Glow */}
        <Link 
          href="/forum/communities" 
          className="block w-full text-center bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-extrabold py-3.5 px-4 rounded-2xl transition-all duration-300 shadow-[0_0_15px_rgba(59,130,246,0.3)] hover:shadow-[0_0_25px_rgba(59,130,246,0.5)] active:scale-95 border border-blue-400/20"
        >
          ✨ Expolre Communities
        </Link>

        {/* 🌟 Widget Trending Tags - Phong cách Glassmorphism */}
        <div className="bg-gradient-to-br from-[#1a1d24] to-[#121418] rounded-3xl border border-gray-800/80 p-6 shadow-2xl relative overflow-hidden group">
          
          {/* Lớp phủ sáng mờ màu cam ở góc (Hologram effect) */}
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-orange-500/10 blur-3xl rounded-full pointer-events-none group-hover:bg-orange-500/20 transition-all duration-500"></div>

          <h3 className="font-extrabold text-gray-100 mb-5 flex items-center gap-2 relative z-10 text-lg">
            <svg className="w-5 h-5 text-orange-500 drop-shadow-[0_0_8px_rgba(249,115,22,0.8)]" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M12.395 2.553a1 1 0 00-1.45-.385c-.345.23-.614.558-.822.88-.214.33-.403.713-.57 1.116-.334.804-.614 1.768-.84 2.734a31.365 31.365 0 00-.613 3.58 2.64 2.64 0 01-.945-1.067c-.328-.68-.398-1.534-.398-2.654A1 1 0 005.05 6.05 6.981 6.981 0 003 11a7 7 0 1011.95-4.95c-.592-.591-.98-.985-1.348-1.467-.363-.476-.724-1.063-1.207-2.03zM12.12 15.12A3 3 0 017 13s.879.5 2.5.5c0-1 .5-4 1.25-4.5.5 1 .786 1.293 1.371 1.879A2.99 2.99 0 0113 13a2.99 2.99 0 01-.879 2.121z" clipRule="evenodd" />
            </svg>
            Trending Tags
          </h3>
          
          <div className="flex flex-wrap gap-2.5 relative z-10">
            {isLoadingTags ? (
              <div className="flex items-center gap-3 text-orange-400/80 text-sm font-bold w-full py-2">
                 <div className="w-4 h-4 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
                 Đang quét tín hiệu...
              </div>
            ) : trendingTags.length === 0 ? (
              <span className="text-gray-500 text-sm font-medium italic w-full text-center py-2">Vùng không gian trống</span>
            ) : (
              trendingTags.map((tag) => (
                <Link key={tag} href={`/forum?tag=${tag}`}>
                  <span className="bg-gray-800/40 hover:bg-gray-700/80 text-cyan-300 hover:text-cyan-200 cursor-pointer text-xs font-bold px-3.5 py-2 rounded-lg border border-gray-700 hover:border-cyan-500/50 transition-all duration-300 inline-block shadow-sm hover:shadow-[0_0_12px_rgba(34,211,238,0.3)] hover:-translate-y-0.5">
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