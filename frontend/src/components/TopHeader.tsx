"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";

export default function TopHeader() {
  const [searchQuery, setSearchQuery] = useState("");
  const router = useRouter();
  const pathname = usePathname();
  
  // 🌟 KHAI BÁO THÊM STATE THÔNG BÁO
  const { data: session } = useSession();
  const [unreadCount, setUnreadCount] = useState(0);

  // 🌟 GỌI API LẤY SỐ LƯỢNG THÔNG BÁO CHƯA ĐỌC
  useEffect(() => {
    const fetchUnreadCount = async () => {
      if (!session?.user?.id) return;
      try {
        const res = await fetch(`http://localhost:5000/api/notifications/${session.user.id}`);
        if (res.ok) {
          const data = await res.json();
          setUnreadCount(data.unreadCount);
        }
      } catch (error) {
        console.error("Lỗi lấy thông báo:", error);
      }
    };

    fetchUnreadCount();
    // Tự động kiểm tra lại mỗi 30 giây để cập nhật chuông real-time
    const interval = setInterval(fetchUnreadCount, 30000); 
    return () => clearInterval(interval);
  }, [session?.user?.id]);

  if (pathname === "/login" || pathname === "/register") return null;

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
  };

  return (
    <header className="sticky top-0 z-40 w-full h-20 bg-[#0f0f11]/80 backdrop-blur-md border-b border-gray-800 flex items-center justify-between px-8 shrink-0">
      
      <div className="flex-1 max-w-2xl">
        <form onSubmit={handleSearch} className="relative group">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <svg className="w-5 h-5 text-gray-500 group-focus-within:text-blue-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>

          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search anime, manga..."
            className="w-full bg-gray-900/50 border border-gray-700 rounded-full py-2.5 pl-12 pr-28 text-sm text-white outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
          />
        </form>
      </div>

      {/* ======================================================= */}
      {/* 🌟 THÊM KHU VỰC CHUÔNG THÔNG BÁO BÊN PHẢI HEADER */}
      {/* ======================================================= */}
      <div className="flex items-center gap-4 ml-4">
        {session?.user && (
          <Link href="/notifications" className="relative p-2 text-gray-400 hover:text-white transition">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            
            {/* Cục hiển thị số lượng chưa đọc */}
            {unreadCount > 0 && (
              <span className="absolute top-0 right-0 inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] font-bold leading-none text-white transform translate-x-1/4 -translate-y-1/4 bg-red-600 rounded-full">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </Link>
        )}
      </div>

    </header>
  );
}