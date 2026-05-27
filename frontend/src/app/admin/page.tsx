"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function AdminDashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  // 1. Bảo vệ trang: Yêu cầu đăng nhập và có quyền ADMIN
  useEffect(() => {
    if (status === "loading") return;
    if (!session || session.user.role !== "ADMIN") {
      router.push("/"); // Đuổi người dùng thường về trang chủ
    }
  }, [session, status, router]);

  // Hiển thị vòng xoay trong lúc kiểm tra quyền
  if (status === "loading") {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0f0f11]">
        <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // Nếu không phải Admin thì không render gì cả (tránh chớp nhoáng giao diện)
  if (!session || session.user.role !== "ADMIN") return null;

  return (
    <div className="min-h-screen bg-[#0f0f11] text-white p-8 flex flex-col items-center justify-center">
      
      <div className="w-full max-w-4xl">
        {/* LỜI CHÀO & NÚT BACK VỀ PROFILE */}
        <div className="flex justify-between items-center mb-10">
          <div>
            <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500">
              Admin Dashboard
            </h1>
            <p className="text-gray-400 mt-2">
              Welcome, administrator <span className="font-bold text-white">{session.user.name}</span>. You want to do what today?
            </p>
          </div>
          <Link 
            href="/profile" 
            className="px-6 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold rounded-lg border border-gray-700 transition"
          >
            Back to profile
          </Link>
        </div>

        {/* LƯỚI ĐIỀU HƯỚNG */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          
          {/* CARD ANIME */}
          <Link href="/admin/anime" className="group">
            <div className="bg-gray-800 p-8 rounded-2xl border border-gray-700 shadow-xl group-hover:border-blue-500 group-hover:shadow-blue-900/20 group-hover:-translate-y-2 transition-all duration-300 h-full flex flex-col items-center text-center">
              <div className="w-20 h-20 bg-blue-900/30 text-blue-400 rounded-full flex items-center justify-center text-4xl mb-6 group-hover:scale-110 transition-transform">
                🎬
              </div>
              <h2 className="text-2xl font-bold text-gray-100 mb-3 group-hover:text-blue-400 transition-colors">
                Anime Management
              </h2>
              <p className="text-gray-400 text-sm leading-relaxed">
                Add new movies, upload videos, manage episode lists and subtitles.
              </p>
            </div>
          </Link>

          {/* CARD MANGA */}
          <Link href="/admin/manga" className="group">
            <div className="bg-gray-800 p-8 rounded-2xl border border-gray-700 shadow-xl group-hover:border-green-500 group-hover:shadow-green-900/20 group-hover:-translate-y-2 transition-all duration-300 h-full flex flex-col items-center text-center">
              <div className="w-20 h-20 bg-green-900/30 text-green-400 rounded-full flex items-center justify-center text-4xl mb-6 group-hover:scale-110 transition-transform">
                📚
              </div>
              <h2 className="text-2xl font-bold text-gray-100 mb-3 group-hover:text-green-400 transition-colors">
                Manga Management
              </h2>
              <p className="text-gray-400 text-sm leading-relaxed">
                Create new manga, upload chapters, manage images for each manga page.
              </p>
            </div>
          </Link>

        </div>
      </div>
      
    </div>
  );
}