"use client";

import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Sidebar() {
  const { data: session, status } = useSession();
  const pathname = usePathname();

  // Ẩn thanh Sidebar hoàn toàn nếu người dùng đang ở trang login hoặc register
  if (pathname === "/login" || pathname === "/register") {
    return null;
  }

  // Danh sách các menu chức năng dựa theo các mô-đun cốt lõi của dự án
  const menuItems = [
    { name: "Home", href: "/", icon: "🏠" },
    { name: "Explore Anime", href: "/anime", icon: "🎬" },
    { name: "Explore Manga", href: "/manga", icon: "📚" },
    { name: "AI Search Assistant", href: "/ai-search", icon: "🤖" },
  ];

  return (
    <aside className="w-64 h-screen bg-gray-900 text-white flex flex-col justify-between border-r border-gray-800 sticky top-0 left-0">
      
      {/* Phần trên cùng: Logo / Tên ứng dụng */}
      <div>
        <div className="p-6 border-b border-gray-800">
          <Link href="/" className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
            Smart Anime Platform
          </Link>
        </div>

        {/* Danh sách các nút điều hướng */}
        <nav className="px-4 py-6 space-y-1">
          {menuItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                  isActive
                    ? "bg-blue-600 text-white font-medium shadow-md shadow-blue-600/20"
                    : "text-gray-400 hover:bg-gray-800 hover:text-white"
                }`}
              >
                <span className="text-lg">{item.icon}</span>
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Phần dưới cùng: Trạng thái User (Xác thực với NextAuth) */}
<div className="p-4 border-t border-gray-800 bg-gray-950/40">
  {status === "loading" ? (
    <div className="flex justify-center py-2">
      <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
    </div>
  ) : session ? (
    /* TRẠNG THÁI: ĐÃ ĐĂNG NHẬP */
    <div className="space-y-4">
      
      {/* THAY ĐỔI Ở ĐÂY: Bọc thông tin bằng thẻ Link để chuyển hướng sang /profile */}
      <Link
        href="/profile"
        className="flex items-center space-x-3 p-2 rounded-xl hover:bg-gray-800/60 transition-all duration-200 group block cursor-pointer"
      >
        <div className="flex items-center space-x-3">
          <img
            src={session.user?.image || "https://www.svgrepo.com/show/507442/user-circle.svg"}
            alt={session.user?.name || "User Avatar"}
            className="w-10 h-10 rounded-full object-cover border border-gray-700 bg-gray-800 group-hover:border-blue-500 transition-colors duration-200"
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate text-gray-100 group-hover:text-blue-400 transition-colors duration-200">
              {session.user?.name || "Người dùng"}
            </p>
            <p className="text-xs text-gray-500 truncate">
              {session.user?.email}
            </p>
          </div>
        </div>
      </Link>
      
      <button
        onClick={() => signOut({ callbackUrl: "/login" })}
        className="w-full py-2 px-4 bg-red-500/10 hover:bg-red-600 text-red-400 hover:text-white border border-red-500/20 hover:border-transparent text-sm font-medium rounded-xl transition-all duration-200 cursor-pointer"
      >
        Sign Out
      </button>
    </div>
  ) : (
    /* TRẠNG THÁI: CHƯA ĐĂNG NHẬP */
    <div className="py-2 space-y-2">
      <p className="text-xs text-gray-400 text-center mb-3">
        Sign in to experience all cloud features
      </p>
      <Link
        href="/login"
        className="block w-full py-2.5 text-center text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-lg shadow-blue-600/10 transition-all duration-200"
      >
        Sign In / Sign Up
      </Link>
    </div>
  )}
</div>

    </aside>
  );
}