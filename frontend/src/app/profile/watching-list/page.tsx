"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";

// Tái sử dụng Interface Anime
interface Anime {
  id: string;
  title: string;
  coverImage: string | null;
  _count: {
    episodes: number;
  };
}

interface WatchListItem {
  id: string;
  anime: Anime;
  createdAt: string;
}

export default function ProfileWatchingListPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  
  const [watchList, setWatchList] = useState<WatchListItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  useEffect(() => {
    const fetchWatchList = async () => {
      if (!session?.user?.id) return;
      
      try {
        const res = await fetch(`http://localhost:5000/api/watchlist/${session.user.id}`);
        if (res.ok) {
          const data = await res.json();
          setWatchList(data);
        }
      } catch (error) {
        console.error("Error loading Watchlist:", error);
      } finally {
        setLoading(false);
      }
    };

    if (status === "authenticated") {
      fetchWatchList();
    }
  }, [session, status]);

  const handleRemove = async (animeId: string, e: React.MouseEvent) => {
    e.preventDefault(); 
    if (!confirm("Are you sure you want to remove this anime from your watchlist?")) return;

    try {
      const res = await fetch("http://localhost:5000/api/watchlist/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: session?.user?.id, animeId })
      });

      if (res.ok) {
        setWatchList(prevList => prevList.filter(item => item.anime.id !== animeId));
      }
    } catch (error) {
      alert("An error occurred while removing the anime.");
    }
  };

  if (status === "loading" || loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center bg-[#0f0f11]">
        <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!session?.user) return null;

  return (
    <div className="min-h-screen bg-[#0f0f11] text-white p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        
        {/* Nút quay lại trang Profile tổng */}
        <Link href="/profile" className="text-gray-400 hover:text-white mb-6 inline-block font-medium drop-shadow-md">
          &larr; Return Profile
        </Link>

        {/* HEADER CỦA TRANG */}
        <div className="flex items-end justify-between mb-10 border-b border-gray-800 pb-6">
          <div>
            <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500 mb-2">
              My Watching List
            </h1>
            <p className="text-gray-400 text-sm">
              You are currently watching <span className="font-bold text-white">{watchList.length}</span> anime
            </p>
          </div>
          <Link href="/anime" className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg transition shadow-lg shadow-blue-900/20 text-sm">
            + Find More Anime
          </Link>
        </div>

        {/* DANH SÁCH PHIM */}
        {watchList.length === 0 ? (
          <div className="text-center bg-gray-900 border border-gray-800 rounded-2xl p-16">
            <div className="text-6xl mb-4">🎬</div>
            <h3 className="text-2xl font-bold text-gray-300 mb-2">Empty List</h3>
            <p className="text-gray-500 max-w-md mx-auto mb-6">You have not added any anime to your watchlist yet. Explore our collection and click Add to Watchlist to get started!</p>
            <Link href="/anime" className="text-blue-400 hover:text-blue-300 font-bold hover:underline">
              Discover now &rarr;
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
            {watchList.map((item) => (
              <Link key={item.id} href={`/anime/${item.anime.id}`} className="group relative block">
                <div className="bg-gray-800 rounded-xl overflow-hidden shadow-lg border border-gray-800 group-hover:border-blue-500 transition-all duration-300 h-full flex flex-col">
                  
                  <div className="relative aspect-[2/3] w-full bg-gray-900 overflow-hidden shrink-0">
                    {item.anime.coverImage ? (
                      <img src={item.anime.coverImage} alt={item.anime.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-600">Trống</div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                    
                    <div className="absolute top-2 left-2 bg-blue-600/90 backdrop-blur-sm text-white font-bold text-xs px-2 py-1 rounded">
                      {item.anime._count.episodes} Tập
                    </div>

                    <button 
                      onClick={(e) => handleRemove(item.anime.id, e)}
                      className="absolute top-2 right-2 bg-red-600/90 hover:bg-red-500 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300 shadow-lg"
                      title="Remove from list"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  <div className="p-4 flex flex-col flex-1 justify-between">
                    <h3 className="font-bold text-gray-200 line-clamp-2 group-hover:text-blue-400 transition mb-2">
                      {item.anime.title}
                    </h3>
                    <p className="text-[10px] text-gray-500 italic">
                      Added on: {new Date(item.createdAt).toLocaleDateString('vi-VN')}
                    </p>
                  </div>
                  
                </div>
              </Link>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}