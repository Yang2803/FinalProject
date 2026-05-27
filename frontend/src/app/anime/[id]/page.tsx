"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import CommentSection from "@/components/CommentSection"; // Đảm bảo đường dẫn này khớp với project của bạn

// 1. Cấu trúc Type
interface Episode {
  id: string;
  title: string;
  createdAt: string;
}

interface AnimeDetail {
  id: string;
  title: string;
  description: string | null;
  coverImage: string | null;
  status: string; // Thêm status nếu DB của bạn có
  episodes: Episode[];
}

export default function UserAnimeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const animeId = resolvedParams.id;
  
  const [anime, setAnime] = useState<AnimeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const { data: session } = useSession();

  // --- STATE QUẢN LÝ RATING ---
  const [userRating, setUserRating] = useState<number>(0);
  const [avgRating, setAvgRating] = useState<number>(0);
  const [ratingCount, setRatingCount] = useState<number>(0);

  // --- STATE QUẢN LÝ DANH SÁCH XEM (WATCHLIST) ---
  const [isInWatchList, setIsInWatchList] = useState<boolean>(false);
  const [isToggling, setIsToggling] = useState<boolean>(false);

  // Gọi API lấy dữ liệu Phim, Rating và trạng thái Danh sách xem
  useEffect(() => {
    const fetchAnime = async () => {
      try {
        const res = await fetch(`http://localhost:5000/api/anime/${animeId}`);
        if (res.ok) setAnime(await res.json());
      } catch (error) {
        console.error("Lỗi tải phim:", error);
      } finally {
        setLoading(false);
      }
    };

    const fetchRatingInfo = async () => {
      try {
        const userIdQuery = session?.user?.id ? `?userId=${session.user.id}` : "";
        const res = await fetch(`http://localhost:5000/api/rating/anime/${animeId}${userIdQuery}`);
        if (res.ok) {
          const data = await res.json();
          setAvgRating(data.average);
          setRatingCount(data.count);
          if (data.userScore > 0) setUserRating(data.userScore);
        }
      } catch (error) {
        console.error("Lỗi tải rating:", error);
      }
    };

    const checkWatchListStatus = async () => {
      if (!session?.user?.id) return;
      try {
        const res = await fetch(`http://localhost:5000/api/watchlist/status?userId=${session.user.id}&animeId=${animeId}`);
        if (res.ok) {
          const data = await res.json();
          setIsInWatchList(data.isInList);
        }
      } catch (error) {
        console.error("Lỗi kiểm tra Watchlist:", error);
      }
    };

    fetchAnime();
    fetchRatingInfo();
    if (session?.user?.id) checkWatchListStatus();
  }, [animeId, session?.user?.id]);

  // Hàm xử lý Đánh giá Sao
  const handleRate = async (score: number) => {
    if (!session) return alert("Vui lòng đăng nhập để đánh giá!");
    setUserRating(score);
    
    const res = await fetch("http://localhost:5000/api/rating/anime", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: session.user.id, animeId, score })
    });

    if (res.ok) {
      const updatedRes = await fetch(`http://localhost:5000/api/rating/anime/${animeId}?userId=${session.user.id}`);
      if (updatedRes.ok) {
        const data = await updatedRes.json();
        setAvgRating(data.average);
        setRatingCount(data.count);
      }
    }
  };

  // Hàm xử lý Thêm/Xóa danh sách xem
  const handleToggleWatchList = async () => {
    if (!session) return alert("Vui lòng đăng nhập để sử dụng tính năng này!");
    setIsToggling(true);
    try {
      const res = await fetch("http://localhost:5000/api/watchlist/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: session.user.id, animeId })
      });
      if (res.ok) {
        const data = await res.json();
        setIsInWatchList(data.isInList);
      }
    } catch (error) {
      alert("Lỗi kết nối khi cập nhật danh sách xem!");
    } finally {
      setIsToggling(false);
    }
  };

  if (loading) return <div className="min-h-screen bg-[#0f0f11] text-white flex justify-center items-center">Loading...</div>;
  if (!anime) return <div className="min-h-screen bg-[#0f0f11] text-white flex justify-center items-center">Anime not found!</div>;

  return (
    <div className="min-h-screen bg-[#0f0f11] text-white">
      {/* Banner Ảnh Bìa mờ phía sau */}
      <div className="relative w-full h-[40vh] md:h-[50vh] overflow-hidden">
        <div className="absolute inset-0 bg-black/70 z-10"></div>
        {anime.coverImage && (
          <img src={anime.coverImage} className="w-full h-full object-cover blur-md opacity-50" alt="Banner" />
        )}
      </div>

      <div className="max-w-6xl mx-auto px-4 md:px-6 -mt-32 relative z-20 pb-12">
        <Link href="/anime" className="text-gray-400 hover:text-white mb-6 inline-block font-medium drop-shadow-md">&larr; Return to anime list</Link>

        {/* KHU VỰC THÔNG TIN PHIM */}
        <div className="bg-gray-800 rounded-2xl p-6 md:p-8 flex flex-col md:flex-row gap-8 shadow-2xl mb-10 border border-gray-700">
          
          {/* Cột trái: Ảnh chính */}
          <div className="w-48 md:w-64 flex-shrink-0 mx-auto md:mx-0">
            {anime.coverImage ? (
              <img src={anime.coverImage} alt={anime.title} className="w-full rounded-xl shadow-2xl border-4 border-gray-900" />
            ) : (
              <div className="w-full aspect-[2/3] rounded-xl shadow-2xl border-4 border-gray-900 bg-gray-900 flex items-center justify-center text-gray-500 font-medium">
                No image available
              </div>
            )}
          </div>

          {/* Cột phải: Chi tiết */}
          <div className="flex-1 flex flex-col">
            <h1 className="text-4xl md:text-5xl font-black text-blue-400 mb-4">{anime.title}</h1>
            
            {/* Hệ thống Rating 5 sao có Thống kê */}
            <div className="flex flex-col gap-2 mb-6 bg-gray-900/60 p-4 rounded-xl border border-gray-700/50 w-fit">
              <div className="flex items-end gap-2">
                <span className="text-3xl font-black text-yellow-400 leading-none">{avgRating > 0 ? avgRating : "-"}</span>
                <span className="text-gray-400 text-sm font-medium pb-1">
                  / 5 <span className="text-gray-500 text-xs ml-1">({ratingCount} ratings)</span>
                </span>
              </div>
              <div className="flex items-center gap-1 mt-1">
                <span className="text-xs text-gray-400 mr-2 uppercase tracking-wider font-bold">Rating:</span>
                {[1, 2, 3, 4, 5].map((star) => (
                  <button 
                    key={star} 
                    onClick={() => handleRate(star)}
                    className={`text-2xl leading-none transition-all hover:scale-110 ${star <= userRating ? "text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.6)]" : "text-gray-600 hover:text-yellow-200"}`}
                  >
                    ★
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2 mb-6">
              <span className="px-3 py-1 bg-blue-900/50 text-blue-300 text-xs font-bold rounded-full border border-blue-700/50">
                {anime.status || "Currently Airing"}
              </span>
              <span className="px-3 py-1 bg-gray-700 text-gray-300 text-xs font-bold rounded-full">
                {anime.episodes.length} Episodes
              </span>
            </div>

            <div className="bg-gray-900/50 p-4 rounded-xl flex-1 border border-gray-800">
              <h3 className="font-bold text-gray-300 mb-2">Summary:</h3>
              <p className="text-gray-400 text-sm leading-relaxed whitespace-pre-wrap">
                {anime.description || "No description available."}
              </p>
            </div>

            {/* Cụm nút bấm hành động */}
            {anime.episodes.length > 0 && (
              <div className="mt-6 flex flex-wrap gap-4">
                <Link 
                  href={`/anime/${animeId}/watch/${anime.episodes[0].id}`}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-full shadow-lg shadow-blue-600/30 transition-all inline-block"
                >
                  ▶ Watch Episode 1
                </Link>

                {/* Nút Thêm vào danh sách xem */}
                <button
                  onClick={handleToggleWatchList}
                  disabled={isToggling}
                  className={`font-bold py-3 px-6 rounded-full transition-all flex items-center gap-2 border shadow-lg ${
                    isInWatchList
                      ? "bg-gray-700 border-gray-600 hover:bg-red-900/40 hover:border-red-700 hover:text-red-400 text-gray-300"
                      : "bg-transparent border-blue-500 hover:bg-blue-600/10 text-blue-400"
                  }`}
                >
                  {isToggling ? (
                    <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                  ) : isInWatchList ? (
                    <>✓ Currently Following</>
                  ) : (
                    <>+ Add to Watch List</>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* KHU VỰC DANH SÁCH TẬP PHIM */}
        <div className="bg-gray-800 rounded-xl p-6 md:p-8 shadow-xl mb-10 border border-gray-700">
          <h2 className="text-2xl font-bold mb-6 border-b border-gray-700 pb-4 text-white">Episode List</h2>
          
          {anime.episodes.length === 0 ? (
            <div className="text-center py-10 text-gray-500 italic">
              The anime is currently being updated, please check back later!
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {anime.episodes.map((ep, index) => (
                <Link 
                  key={ep.id} 
                  href={`/anime/${animeId}/watch/${ep.id}`}
                  className="bg-gray-900 hover:bg-blue-600 border border-gray-700 hover:border-blue-500 text-center py-4 rounded-xl transition-all font-semibold shadow-md group flex flex-col items-center justify-center h-full"
                >
                  <span className="text-gray-400 group-hover:text-white text-xs block mb-1">Episode {index + 1}</span>
                  <span className="text-gray-200 truncate w-full px-2 text-sm">{ep.title}</span>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* KHU VỰC BÌNH LUẬN CHUNG DÀNH CHO ANIME */}
        <CommentSection targetType="anime" targetId={animeId} />

      </div>
    </div>
  );
}