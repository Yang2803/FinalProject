"use client";

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";

export default function TopHeader() {
  const [searchQuery, setSearchQuery] = useState("");
  const router = useRouter();
  const pathname = usePathname();

  if (pathname === "/login" || pathname === "/register") return null;

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    
    // Chuyển hướng sang trang kết quả kèm theo query string
    router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
  };

  return (
    <header className="sticky top-0 z-40 w-full h-20 bg-[#0f0f11]/80 backdrop-blur-md border-b border-gray-800 flex items-center justify-between px-8 shrink-0">
      <div className="flex-1 max-w-2xl">
        <form onSubmit={handleSearch} className="relative group">
          {/* Icon Kính lúp */}
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

      
    </header>
  );
}