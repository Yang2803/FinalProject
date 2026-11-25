"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

// 🌟 1. DECLARING DATA TYPES TO SYNCHRONIZE WITH SCHEMA PRISMA
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

// Function to assign a random avatar color based on name
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
  
  // Conversion tab in the Member Ranking Board
  const [activeUserTab, setActiveUserTab] = useState<'posters' | 'commenters' | 'voters'>('posters');

  const [isMobileWidgetsOpen, setIsMobileWidgetsOpen] = useState(false);

  useEffect(() => {
    const fetchSidebarData = async () => {
      try {
        const [tagsRes, statsRes] = await Promise.all([
          fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/forum/trending-tags`),
          fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/forum/sidebar-stats`)
        ]);

        if (tagsRes.ok) setTrendingTags(await tagsRes.json());
        if (statsRes.ok) setStats(await statsRes.json());
      } catch (error) {
        console.error("Error loading Sidebar data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSidebarData();
  }, []);

  

 const renderWidgetsContent = () => (
    <>
      {/* Explore community button */}
      <Link
        href="/forum/communities"
        onClick={() => setIsMobileWidgetsOpen(false)}
        className="block w-full text-center bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-extrabold py-3.5 px-4 rounded-2xl transition-all duration-300 shadow-[0_0_15px_rgba(59,130,246,0.3)] hover:shadow-[0_0_25px_rgba(59,130,246,0.5)] active:scale-95 border border-blue-400/20"
      >
        ✨ Explore Communities
      </Link>

      {/* 1. WIDGET: TRENDING TAGS */}
      <div className="bg-gradient-to-br from-[#1a1d24] to-[#121418] rounded-3xl border border-gray-800/80 p-5 shadow-2xl relative overflow-hidden group">
        <div className="absolute -top-10 -right-10 w-32 h-32 bg-orange-500/10 blur-3xl rounded-full pointer-events-none group-hover:bg-orange-500/20 transition-all duration-500"></div>

        <h3 className="font-extrabold text-gray-100 mb-4 flex items-center gap-2 relative z-10 text-base">
          <span className="text-orange-500 drop-shadow-[0_0_8px_rgba(249,115,22,0.8)]">
            🔥
          </span>
          Trending Tags
        </h3>

        <div className="flex flex-wrap gap-2 relative z-10">
          {isLoading ? (
            <span className="text-gray-500 text-xs italic">Scanning...</span>
          ) : trendingTags.length === 0 ? (
            <span className="text-gray-500 text-xs italic">
              No trending tags available
            </span>
          ) : (
            trendingTags.map((tag) => (
              <Link
                key={tag}
                href={`/forum?tag=${tag}`}
                onClick={() => setIsMobileWidgetsOpen(false)}
              >
                <span className="bg-gray-800/40 hover:bg-gray-700/80 text-cyan-300 hover:text-cyan-200 cursor-pointer text-xs font-bold px-3 py-1.5 rounded-lg border border-gray-700 hover:border-cyan-500/50 transition-all duration-300 inline-block shadow-sm hover:shadow-[0_0_12px_rgba(34,211,238,0.3)] hover:-translate-y-0.5">
                  #{tag}
                </span>
              </Link>
            ))
          )}
        </div>
      </div>

      {/* 2. WIDGET: TOP Community */}
      <div className="bg-gradient-to-br from-[#1a1d24] to-[#121418] rounded-3xl border border-gray-800/80 p-5 shadow-2xl relative overflow-hidden group">
        <div className="absolute -top-10 -right-10 w-32 h-32 bg-emerald-500/10 blur-3xl rounded-full pointer-events-none group-hover:bg-emerald-500/20 transition-all"></div>

        <h3 className="font-extrabold text-gray-100 mb-4 flex items-center gap-2 relative z-10 text-base">
          <span className="text-emerald-500 drop-shadow-[0_0_8px_rgba(16,185,129,0.8)]">
            🛡️
          </span>
          Community Activity
        </h3>

        <div className="space-y-3 relative z-10">
          {isLoading ? (
            <span className="text-gray-500 text-xs italic">Updating...</span>
          ) : !stats?.topCommunities || stats.topCommunities.length === 0 ? (
            <span className="text-gray-500 text-xs italic">
              No Community Yet.
            </span>
          ) : (
            stats.topCommunities.map((community, index) => (
              <Link
                key={community.id}
                href={`/forum/communities/${community.id}`}
                onClick={() => setIsMobileWidgetsOpen(false)}
                className="flex items-center justify-between group/item hover:bg-gray-800/30 p-1.5 rounded-xl transition-all"
              >
                <div className="flex items-center gap-2.5 truncate mr-2">
                  <span
                    className={`font-black text-xs w-4 text-center ${
                      index === 0
                        ? "text-yellow-400"
                        : index === 1
                        ? "text-gray-300"
                        : index === 2
                        ? "text-amber-600"
                        : "text-gray-600"
                    }`}
                  >
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

      {/* 3. WIDGET: TOP CONTRIBUTORS BOARD */}
      <div className="bg-gradient-to-br from-[#1a1d24] to-[#121418] rounded-3xl border border-gray-800/80 p-5 shadow-2xl relative overflow-hidden group">
        <div className="absolute -top-10 -right-10 w-32 h-32 bg-purple-500/10 blur-3xl rounded-full pointer-events-none group-hover:bg-purple-500/20 transition-all"></div>

        <h3 className="font-extrabold text-gray-100 mb-3 flex items-center gap-2 relative z-10 text-base">
          <span className="text-purple-500 drop-shadow-[0_0_8px_rgba(168,85,247,0.8)]">
            👑
          </span>
          Top Contributors
        </h3>

        {/* Mini-Tabs */}
        <div className="flex bg-gray-900/60 p-1 rounded-xl mb-4 relative z-10 border border-gray-800">
          <button
            onClick={() => setActiveUserTab("posters")}
            className={`flex-1 text-[11px] font-bold py-1.5 rounded-lg transition-all ${
              activeUserTab === "posters"
                ? "bg-purple-600 text-white shadow-md"
                : "text-gray-400 hover:text-gray-200"
            }`}
          >
            Up Posts
          </button>
          <button
            onClick={() => setActiveUserTab("commenters")}
            className={`flex-1 text-[11px] font-bold py-1.5 rounded-lg transition-all ${
              activeUserTab === "commenters"
                ? "bg-blue-600 text-white shadow-md"
                : "text-gray-400 hover:text-gray-200"
            }`}
          >
            Comments
          </button>
          <button
            onClick={() => setActiveUserTab("voters")}
            className={`flex-1 text-[11px] font-bold py-1.5 rounded-lg transition-all ${
              activeUserTab === "voters"
                ? "bg-emerald-600 text-white shadow-md"
                : "text-gray-400 hover:text-gray-200"
            }`}
          >
            Vote
          </button>
        </div>

        {/* List of top members */}
        <div className="space-y-3 relative z-10">
          {isLoading ? (
            <span className="text-gray-500 text-xs italic">Updating...</span>
          ) : !stats?.topUsers[activeUserTab] ||
            stats.topUsers[activeUserTab].length === 0 ? (
            <span className="text-gray-500 text-xs italic">
              No active members yet
            </span>
          ) : (
            stats.topUsers[activeUserTab].map((user, index) => (
              <div key={user.id} className="flex items-center justify-between">
                <div className="flex items-center gap-2.5 min-w-0 mr-2">
                  <span
                    className={`font-black text-xs w-4 text-center ${
                      index === 0
                        ? "text-yellow-400"
                        : index === 1
                        ? "text-gray-300"
                        : index === 2
                        ? "text-amber-600"
                        : "text-gray-600"
                    }`}
                  >
                    {index + 1}
                  </span>
                  <div className="w-7 h-7 rounded-full overflow-hidden shrink-0 ring-1 ring-gray-700">
                    {user.image ? (
                      <img
                        src={user.image}
                        alt={user.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div
                        className={`w-full h-full flex items-center justify-center font-bold text-[10px] text-white ${getAvatarColor(
                          user.name
                        )}`}
                      >
                        {user.name?.charAt(0) || "U"}
                      </div>
                    )}
                  </div>
                  <span
                    className="font-bold text-xs text-gray-300 truncate"
                    title={user.name}
                  >
                    {user.name || "Anonymous"}
                  </span>
                </div>

                <span className="text-[10px] font-black text-purple-300 bg-purple-950/40 border border-purple-800/40 px-2 py-0.5 rounded-md shrink-0">
                  {activeUserTab === "posters"
                    ? `${(user._count as Record<string, number>).forumPosts} Posts`
                    : activeUserTab === "commenters"
                    ? `${(user._count as Record<string, number>).forumComments} Cmt`
                    : `${(user._count as Record<string, number>).forumVotes} Vote`}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 4. WIDGET: HOT POSTS */}
      <div className="bg-gradient-to-br from-[#1a1d24] to-[#121418] rounded-3xl border border-gray-800/80 p-5 shadow-2xl relative overflow-hidden group">
        <div className="absolute -top-10 -right-10 w-32 h-32 bg-pink-500/10 blur-3xl rounded-full pointer-events-none group-hover:bg-pink-500/20 transition-all"></div>

        <h3 className="font-extrabold text-gray-100 mb-4 flex items-center gap-2 relative z-10 text-base">
          <span className="text-pink-500 drop-shadow-[0_0_8px_rgba(236,72,153,0.8)]">
            💎
          </span>
          Hot Posts
        </h3>

        <div className="space-y-3.5 relative z-10">
          {isLoading ? (
            <span className="text-gray-500 text-xs italic">Updating...</span>
          ) : !stats?.hotPosts || stats.hotPosts.length === 0 ? (
            <span className="text-gray-500 text-xs italic">
              No hot posts available
            </span>
          ) : (
            stats.hotPosts.map((post) => (
              <Link
                key={post.id}
                href={`/forum/${post.id}`}
                onClick={() => setIsMobileWidgetsOpen(false)}
                className="group/post block"
              >
                <h4 className="font-bold text-xs text-gray-300 group-hover/post:text-pink-400 transition-colors line-clamp-2 leading-relaxed mb-1.5">
                  {post.title}
                </h4>
                <div className="flex items-center gap-3 text-[10px] font-medium text-gray-500">
                  <span className="flex items-center gap-1">
                    <span className="text-emerald-400 font-bold">▲</span>{" "}
                    {post.upvoteCount}
                  </span>
                  <span className="flex items-center gap-1">
                    💬 {post._count.forumComments} comment
                  </span>
                </div>
              </Link>
            ))
          )}
        </div>
      </div>
    </>
  );

  return (
    <div className="flex justify-center min-h-full bg-[#0a0b0f] text-white relative">
      {/* ======================================================== */}
      {/* 🌟 MIDDLE COLUMN: MAIN FEED */}
      {/* ======================================================== */}
      <main className="w-full max-w-3xl border-x-0 md:border-x border-gray-800/60 bg-[#12141a]/80 min-w-0">
        {/* QUICK ACCESS BAR FOR MOBILE & TABLET (Hidden on large screen) */}
        <div className="lg:hidden px-3.5 pt-3.5 sm:px-6 sm:pt-5 flex items-center gap-2.5">
          <Link
            href="/forum/communities"
            className="flex-1 text-center bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-extrabold text-xs sm:text-sm py-2.5 px-3 rounded-xl shadow-[0_0_12px_rgba(59,130,246,0.3)] active:scale-95 transition-all truncate"
          >
            ✨ Explore Communities
          </Link>
          <button
            type="button"
            onClick={() => setIsMobileWidgetsOpen(true)}
            className="bg-[#1a1d24] hover:bg-gray-800 text-gray-200 border border-gray-700/80 font-bold text-xs sm:text-sm py-2.5 px-3.5 rounded-xl flex items-center gap-1.5 shrink-0 active:scale-95 transition-all shadow-sm"
          >
            <span>🔥</span>
            <span>Community Hub</span>
          </button>
        </div>

        <div className="p-3.5 sm:p-6 md:p-8">{children}</div>
      </main>

      {/* ======================================================== */}
      {/* 🌟 RIGHT COLUMN: COMMUNITY WIDGETS ON DESKTOP (lg and above) */}
      {/* ======================================================== */}
      <aside className="hidden lg:block w-[340px] p-6 space-y-6 sticky top-0 h-[calc(100dvh-64px)] overflow-y-auto custom-sidebar-scroll shrink-0">
        {renderWidgetsContent()}
      </aside>

      {/* ======================================================== */}
      {/* 🌟 DRAWER WIDGETS COMMUNITY ON MOBILE (< lg) */}
      {/* ======================================================== */}
      {isMobileWidgetsOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex justify-end">
          <div
            className="fixed inset-0 bg-black/75 backdrop-blur-sm transition-opacity"
            onClick={() => setIsMobileWidgetsOpen(false)}
          />

          {/* Sidebar for mobile devices */}
          <aside className="relative w-80 max-w-[85vw] h-full bg-[#0d0f14] border-l border-gray-800 p-4 pb-20 space-y-5 overflow-y-auto z-10 shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-800 pb-3">
              <h2 className="font-black text-base text-white flex items-center gap-2">
                <span>🌐</span> Community Hub
              </h2>
              <button
                type="button"
                onClick={() => setIsMobileWidgetsOpen(false)}
                className="w-8 h-8 rounded-lg bg-gray-800/80 text-gray-400 hover:text-white flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            {renderWidgetsContent()}
          </aside>
        </div>
      )}
    </div>
  );}