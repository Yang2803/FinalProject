"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

// 🌟 1. KHAI BÁO KIỂU DỮ LIỆU ĐỒNG BỘ VỚI SCHEMA PRISMA
interface SidebarStats {
  topCommunities: { 
    id: string; 
    name: string; 
    _count: { posts: number } 
  }[];
  topUsers: {
    posters: { id: string; name: string; image: string | null; _count: { forumPosts: number } }[];
    commenters: { id: string; name: string; image: string | null; _count: { forumComments: number } }[];
    voters: { id: string; name: string; image: string | null; _count: { forumVotes: number } }[];
  };
  hotPosts: { 
    id: string; 
    title: string; 
    upvoteCount: number; 
    _count: { forumComments: number } 
  }[];
}

// Hàm gán màu avatar ngẫu nhiên theo tên
const getAvatarColor = (name?: string) => {
  const colors = [
    'bg-red-500', 'bg-green-500', 'bg-blue-500', 'bg-yellow-500', 
    'bg-purple-500', 'bg-pink-500', 'bg-teal-500', 'bg-orange-500'
  ];
  if (!name) return colors[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
};

export default function ForumLayout({ children }: { children: React.ReactNode }) {
  const [trendingTags, setTrendingTags] = useState<string[]>([]);
  const [stats, setStats] = useState<SidebarStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Tab chuyển đổi trong Bảng vàng thành viên
  const [activeUserTab, setActiveUserTab] = useState<'posters' | 'commenters' | 'voters'>('posters');

  useEffect(() => {
    const fetchSidebarData = async () => {
      try {
        const [tagsRes, statsRes] = await Promise.all([
          fetch("http://localhost:5000/api/forum/trending-tags"),
          fetch("http://localhost:5000/api/forum/sidebar-stats")
        ]);

        if (tagsRes.ok) setTrendingTags(await tagsRes.json());
        if (statsRes.ok) setStats(await statsRes.json());
      } catch (error) {
        console.error("Lỗi khi tải dữ liệu Sidebar:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSidebarData();
  }, []);

  return (
    <div className="flex justify-center min-h-screen bg-[#0a0b0f] text-white">
      
      {/* ======================================================== */}
      {/* 🌟 CỘT GIỮA: FEED CHÍNH */}
      {/* ======================================================== */}
      <main className="w-full max-w-3xl border-l border-r border-gray-800/60 bg-[#12141a]/80">
        <div className="p-6 md:p-8">
          {children}
        </div>
      </main>

      {/* ======================================================== */}
      {/* 🌟 CỘT PHẢI: WIDGETS CỘNG ĐỒNG */}
      {/* ======================================================== */}
      <aside className="hidden lg:block w-[340px] p-6 space-y-6 sticky top-0 h-screen overflow-y-auto custom-sidebar-scroll">
        
        {/* Nút Khám phá Cộng đồng */}
        <Link 
          href="/forum/communities" 
          className="block w-full text-center bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-extrabold py-3.5 px-4 rounded-2xl transition-all duration-300 shadow-[0_0_15px_rgba(59,130,246,0.3)] hover:shadow-[0_0_25px_rgba(59,130,246,0.5)] active:scale-95 border border-blue-400/20"
        >
          ✨ Explore Communities
        </Link>

        {/* 1. WIDGET: TRENDING TAGS */}
        <div className="bg-gradient-to-br from-[#1a1d24] to-[#121418] rounded-3xl border border-gray-800/80 p-5 shadow-2xl relative overflow-hidden group">
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-orange-500/10 blur-3xl rounded-full pointer-events-none group-hover:bg-orange-500/20 transition-all duration-500"></div>

          <h3 className="font-extrabold text-gray-100 mb-4 flex items-center gap-2 relative z-10 text-base">
            <span className="text-orange-500 drop-shadow-[0_0_8px_rgba(249,115,22,0.8)]">🔥</span> 
            Trending Tags
          </h3>
          
          <div className="flex flex-wrap gap-2 relative z-10">
            {isLoading ? (
              <span className="text-gray-500 text-xs italic">Đang quét...</span>
            ) : trendingTags.length === 0 ? (
              <span className="text-gray-500 text-xs italic">Chưa có thẻ nổi bật</span>
            ) : (
              trendingTags.map((tag) => (
                <Link key={tag} href={`/forum?tag=${tag}`}>
                  <span className="bg-gray-800/40 hover:bg-gray-700/80 text-cyan-300 hover:text-cyan-200 cursor-pointer text-xs font-bold px-3 py-1.5 rounded-lg border border-gray-700 hover:border-cyan-500/50 transition-all duration-300 inline-block shadow-sm hover:shadow-[0_0_12px_rgba(34,211,238,0.3)] hover:-translate-y-0.5">
                    #{tag}
                  </span>
                </Link>
              ))
            )}
          </div>
        </div>

        {/* 2. WIDGET: TOP CỘNG ĐỒNG SÔI NỔI */}
        <div className="bg-gradient-to-br from-[#1a1d24] to-[#121418] rounded-3xl border border-gray-800/80 p-5 shadow-2xl relative overflow-hidden group">
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-emerald-500/10 blur-3xl rounded-full pointer-events-none group-hover:bg-emerald-500/20 transition-all"></div>
          
          <h3 className="font-extrabold text-gray-100 mb-4 flex items-center gap-2 relative z-10 text-base">
            <span className="text-emerald-500 drop-shadow-[0_0_8px_rgba(16,185,129,0.8)]">🛡️</span> 
            Community Activity
          </h3>

          <div className="space-y-3 relative z-10">
            {isLoading ? (
              <span className="text-gray-500 text-xs italic">Đang cập nhật...</span>
            ) : !stats?.topCommunities || stats.topCommunities.length === 0 ? (
              <span className="text-gray-500 text-xs italic">Chưa có cộng đồng nào</span>
            ) : (
              stats.topCommunities.map((community, index) => (
                <Link 
                  key={community.id} 
                  href={`/forum/communities/${community.id}`}
                  className="flex items-center justify-between group/item hover:bg-gray-800/30 p-1.5 rounded-xl transition-all"
                >
                  <div className="flex items-center gap-2.5 truncate mr-2">
                    <span className={`font-black text-xs w-4 text-center ${
                      index === 0 ? 'text-yellow-400' : index === 1 ? 'text-gray-300' : index === 2 ? 'text-amber-600' : 'text-gray-600'
                    }`}>
                      {index + 1}
                    </span>
                    <span className="font-bold text-xs text-gray-300 group-hover/item:text-emerald-400 transition-colors truncate">
                      c/{community.name}
                    </span>
                  </div>
                  <span className="text-[11px] font-semibold text-gray-400 bg-gray-800/80 px-2 py-0.5 rounded-md border border-gray-700/50 shrink-0">
                    {community._count.posts} Post
                  </span>
                </Link>
              ))
            )}
          </div>
        </div>

        {/* 3. WIDGET: BẢNG VÀNG THÀNH VIÊN TÍCH CỰC */}
        <div className="bg-gradient-to-br from-[#1a1d24] to-[#121418] rounded-3xl border border-gray-800/80 p-5 shadow-2xl relative overflow-hidden group">
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-purple-500/10 blur-3xl rounded-full pointer-events-none group-hover:bg-purple-500/20 transition-all"></div>
          
          <h3 className="font-extrabold text-gray-100 mb-3 flex items-center gap-2 relative z-10 text-base">
            <span className="text-purple-500 drop-shadow-[0_0_8px_rgba(168,85,247,0.8)]">👑</span> 
            Top Contributors
          </h3>

          {/* Mini-Tabs */}
          <div className="flex bg-gray-900/60 p-1 rounded-xl mb-4 relative z-10 border border-gray-800">
            <button 
              onClick={() => setActiveUserTab('posters')} 
              className={`flex-1 text-[11px] font-bold py-1.5 rounded-lg transition-all ${
                activeUserTab === 'posters' ? 'bg-purple-600 text-white shadow-md' : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              Up Posts
            </button>
            <button 
              onClick={() => setActiveUserTab('commenters')} 
              className={`flex-1 text-[11px] font-bold py-1.5 rounded-lg transition-all ${
                activeUserTab === 'commenters' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              Comments
            </button>
            <button 
              onClick={() => setActiveUserTab('voters')} 
              className={`flex-1 text-[11px] font-bold py-1.5 rounded-lg transition-all ${
                activeUserTab === 'voters' ? 'bg-emerald-600 text-white shadow-md' : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              Vote
            </button>
          </div>

          {/* Danh sách thành viên */}
          <div className="space-y-3 relative z-10">
            {isLoading ? (
              <span className="text-gray-500 text-xs italic">Đang cập nhật...</span>
            ) : !stats?.topUsers[activeUserTab] || stats.topUsers[activeUserTab].length === 0 ? (
              <span className="text-gray-500 text-xs italic">Chưa có thành viên nào</span>
            ) : (
              stats.topUsers[activeUserTab].map((user, index) => (
                <div key={user.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5 min-w-0 mr-2">
                    <span className={`font-black text-xs w-4 text-center ${
                      index === 0 ? 'text-yellow-400' : index === 1 ? 'text-gray-300' : index === 2 ? 'text-amber-600' : 'text-gray-600'
                    }`}>
                      {index + 1}
                    </span>
                    <div className="w-7 h-7 rounded-full overflow-hidden shrink-0 ring-1 ring-gray-700">
                      {user.image ? (
                        <img src={user.image} alt={user.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className={`w-full h-full flex items-center justify-center font-bold text-[10px] text-white ${getAvatarColor(user.name)}`}>
                          {user.name?.charAt(0) || "U"}
                        </div>
                      )}
                    </div>
                    <span className="font-bold text-xs text-gray-300 truncate" title={user.name}>
                      {user.name || "Ẩn danh"}
                    </span>
                  </div>

                  <span className="text-[10px] font-black text-purple-300 bg-purple-950/40 border border-purple-800/40 px-2 py-0.5 rounded-md shrink-0">
                    {activeUserTab === 'posters' 
                      ? `${(user._count as Record<string, number>).forumPosts} Bài` 
                      : activeUserTab === 'commenters' 
                      ? `${(user._count as Record<string, number>).forumComments} Cmt` 
                      : `${(user._count as Record<string, number>).forumVotes} Vote`}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* 4. WIDGET: BÀI VIẾT ĐANG HOT */}
        <div className="bg-gradient-to-br from-[#1a1d24] to-[#121418] rounded-3xl border border-gray-800/80 p-5 shadow-2xl relative overflow-hidden group">
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-pink-500/10 blur-3xl rounded-full pointer-events-none group-hover:bg-pink-500/20 transition-all"></div>
          
          <h3 className="font-extrabold text-gray-100 mb-4 flex items-center gap-2 relative z-10 text-base">
            <span className="text-pink-500 drop-shadow-[0_0_8px_rgba(236,72,153,0.8)]">💎</span> 
            Hot Posts
          </h3>

          <div className="space-y-3.5 relative z-10">
            {isLoading ? (
              <span className="text-gray-500 text-xs italic">Đang cập nhật...</span>
            ) : !stats?.hotPosts || stats.hotPosts.length === 0 ? (
              <span className="text-gray-500 text-xs italic">Chưa có bài viết hot</span>
            ) : (
              stats.hotPosts.map((post) => (
                <Link key={post.id} href={`/forum/${post.id}`} className="group/post block">
                  <h4 className="font-bold text-xs text-gray-300 group-hover/post:text-pink-400 transition-colors line-clamp-2 leading-relaxed mb-1.5">
                    {post.title}
                  </h4>
                  <div className="flex items-center gap-3 text-[10px] font-medium text-gray-500">
                    <span className="flex items-center gap-1">
                      <span className="text-emerald-400 font-bold">▲</span> {post.upvoteCount}
                    </span>
                    <span className="flex items-center gap-1">
                      💬 {post._count.forumComments} bình luận
                    </span>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>

      </aside>
    </div>
  );
}