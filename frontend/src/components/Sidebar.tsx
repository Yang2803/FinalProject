"use client";

import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface MenuItem {
  name: string;
  href: string;
  icon: string;
  badge?: string;
  badgeColor?: string;
  liveDot?: string;
}

interface MenuGroup {
  title: string;
  items: MenuItem[];
}

export default function Sidebar() {
  const { data: session, status } = useSession();
  const pathname = usePathname();

  // Ẩn thanh Sidebar hoàn toàn nếu người dùng đang ở trang login hoặc register
  if (pathname === "/login" || pathname === "/register") {
    return null;
  }

  // Phân nhóm các chức năng để Sidebar có chiều sâu và chuyên nghiệp hơn
  const menuGroups: MenuGroup[] = [
    {
      title: "Explore & Discover",
      items: [
        { name: "Home", href: "/", icon: "🏠" },
        { name: "Explore Anime", href: "/anime", icon: "🎬" },
        { name: "Explore Manga", href: "/manga", icon: "📚" },
      ],
    },
    {
      title: "AI Support & Search",
      items: [
        {
          name: "AI Search Assistant",
          href: "/ai-search",
          icon: "🤖",
          badge: "AI",
          badgeColor:
            "bg-gradient-to-r from-purple-500/20 to-cyan-500/20 text-cyan-300 border-cyan-500/40",
        },
      ],
    },
    {
      title: "Community & Live Rooms",
      items: [
        {
          name: "Watch Party",
          href: "/party",
          icon: "🎉",
          liveDot: "bg-red-500",
        },
        {
          name: "Co-reading Room",
          href: "/manga-room",
          icon: "📖",
          liveDot: "bg-emerald-400",
        },
        {
          name: "Forum",
          href: "/forum",
          icon: "💬",
          badge: "Hot",
          badgeColor: "bg-orange-500/15 text-orange-400 border-orange-500/30",
        },
      ],
    },
  ];

  const isProfileActive = pathname === "/profile" || pathname.startsWith("/profile/");

  return (
    <aside className="w-64 h-screen bg-[#0b0c10] text-white flex flex-col justify-between border-r border-white/[0.07] sticky top-0 left-0 select-none relative overflow-hidden shrink-0">
      {/* Hiệu ứng ánh sáng Ambient mờ phía sau Sidebar */}
      <div className="absolute -top-24 -left-24 w-56 h-56 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 -right-24 w-56 h-56 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* ===================================================================== */}
      {/* PHẦN TRÊN: LOGO & DANH SÁCH ĐIỀU HƯỚNG */}
      {/* ===================================================================== */}
      <div className="relative z-10 flex-1 overflow-y-auto no-scrollbar">
        {/* Header Logo */}
        <div className="p-5 border-b border-white/[0.06]">
          <Link href="/" className="flex items-center gap-3.5 group">
            
            <div className="min-w-0">
              <h1 className="text-base font-black tracking-tight bg-gradient-to-r from-white via-blue-100 to-purple-300 bg-clip-text text-transparent truncate">
                Smart Anime
              </h1>
              <p className="text-[10px] font-bold uppercase tracking-widest text-blue-400/80">
                Platform
              </p>
            </div>
          </Link>
        </div>

        {/* Các nhóm Menu */}
        <nav className="px-3 py-4 space-y-6">
          {menuGroups.map((group) => (
            <div key={group.title} className="space-y-1">
              <p className="px-3 text-[10px] font-extrabold uppercase tracking-wider text-gray-500 mb-2">
                {group.title}
              </p>

              {group.items.map((item) => {
                const isActive =
                  item.href === "/"
                    ? pathname === "/"
                    : pathname === item.href || pathname.startsWith(`${item.href}/`);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`group relative flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm transition-all duration-200 ${
                      isActive
                        ? "bg-gradient-to-r from-blue-600/25 via-indigo-600/15 to-transparent text-white font-bold border border-blue-500/30 shadow-lg shadow-blue-500/5"
                        : "text-gray-400 hover:bg-white/[0.04] hover:text-gray-100 font-medium border border-transparent"
                    }`}
                  >
                    {/* Thanh sáng Neon chỉ thị mục đang chọn */}
                    {isActive && (
                      <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r-full bg-gradient-to-b from-blue-400 to-purple-500 shadow-[0_0_10px_#3b82f6]" />
                    )}

                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className={`w-8 h-8 rounded-lg flex items-center justify-center text-base transition-transform duration-200 group-hover:scale-110 shrink-0 ${
                          isActive
                            ? "bg-blue-500/20 text-white shadow-inner"
                            : "bg-gray-900/80 text-gray-300 group-hover:bg-gray-800"
                        }`}
                      >
                        {item.icon}
                      </span>
                      <span className="truncate">{item.name}</span>
                    </div>

                    {/* Huy hiệu (Badge) hoặc Chấm Live */}
                    {item.badge && (
                      <span
                        className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border shrink-0 ${item.badgeColor}`}
                      >
                        {item.badge}
                      </span>
                    )}

                    {item.liveDot && (
                      <span className="relative flex h-2 w-2 shrink-0 mr-1" title="Trực tuyến">
                        <span
                          className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${item.liveDot}`}
                        />
                        <span
                          className={`relative inline-flex rounded-full h-2 w-2 ${item.liveDot}`}
                        />
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
      </div>

      {/* ===================================================================== */}
      {/* PHẦN DƯỚI: THẺ TÀI KHOẢN NGƯỜI DÙNG (USER PROFILE CARD) */}
      {/* ===================================================================== */}
      <div className="relative z-10 p-3.5 border-t border-white/[0.07] bg-[#08090c]/80 backdrop-blur-md">
        {status === "loading" ? (
          <div className="flex justify-center py-4">
            <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : session ? (
          /* TRẠNG THÁI: ĐÃ ĐĂNG NHẬP */
          <div className="space-y-2.5">
            <Link
              href="/profile"
              className={`flex items-center gap-3 p-2.5 rounded-xl border transition-all duration-200 group cursor-pointer ${
                isProfileActive
                  ? "bg-blue-600/15 border-blue-500/40"
                  : "bg-gray-900/70 hover:bg-gray-800/80 border-white/[0.06]"
              }`}
            >
              <div className="relative shrink-0">
                <img
                  src={
                    session.user?.image ||
                    "https://www.svgrepo.com/show/507442/user-circle.svg"
                  }
                  alt={session.user?.name || "User Avatar"}
                  className="w-10 h-10 rounded-full object-cover border-2 border-gray-700 bg-gray-800 group-hover:border-blue-400 transition-colors"
                />
                {/* Chấm xanh Online */}
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-[#0b0c10]" />
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold truncate text-gray-100 group-hover:text-blue-400 transition-colors">
                  {session.user?.name || "Người dùng"}
                </p>
                <p className="text-[11px] text-gray-500 truncate">
                  {session.user?.email}
                </p>
              </div>

              <span className="text-gray-500 group-hover:text-gray-300 group-hover:translate-x-0.5 transition-all text-xs">
                &#10095;
              </span>
            </Link>

            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="w-full py-2 px-3 bg-red-500/10 hover:bg-red-600 text-red-400 hover:text-white border border-red-500/20 hover:border-red-500 text-xs font-bold rounded-xl transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer shadow-sm"
            >
              <span>🚪</span>
              <span>Sign Out</span>
            </button>
          </div>
        ) : (
          /* TRẠNG THÁI: CHƯA ĐĂNG NHẬP */
          <div className="p-2 rounded-2xl bg-gradient-to-b from-gray-900/90 to-gray-950 border border-white/[0.06] space-y-2.5">
            <p className="text-[11px] text-gray-400 text-center px-1 leading-relaxed">
              Đăng nhập để lưu lịch sử xem, bình luận & tạo phòng chung
            </p>
            <Link
              href="/login"
              className="block w-full py-2.5 text-center text-xs font-bold text-white bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 rounded-xl shadow-lg shadow-blue-600/20 transition-all duration-200"
            >
              ✨ Sign In / Sign Up
            </Link>
          </div>
        )}
      </div>
    </aside>
  );
}