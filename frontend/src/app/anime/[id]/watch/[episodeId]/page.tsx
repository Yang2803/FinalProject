"use client";

import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react"; // 1. Import thêm useSession
import Link from "next/link";
import CommentSection from "@/components/CommentSection";

// Khai báo cấu trúc Phụ đề
interface Subtitle {
  id: string;
  label: string;
  url: string;
}

// Khai báo cấu trúc Tập phim
interface Episode {
  id: string;
  title: string;
  videoUrl: string;
  createdAt: string;
  subtitles?: Subtitle[];
}

export default function WatchEpisodePage() {
  const params = useParams();
  const animeId = params.id as string || params.animeId as string; // Fix an toàn cho params
  const episodeId = params.episodeId as string;
  
  // Lấy thông tin user đang đăng nhập
  const { data: session } = useSession();

  // --- STATE CỦA VIDEO ---
  const [animeTitle, setAnimeTitle] = useState("");
  const [episode, setEpisode] = useState<Episode | null>(null);
  const [loading, setLoading] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Hàm xử lý Tua video (+10 hoặc -10)
  const skipTime = (seconds: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime += seconds;
    }
  };

  // Bắt sự kiện bàn phím để tua bằng phím Mũi tên Trái/Phải
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "TEXTAREA") return;
      if (e.key === "ArrowRight") skipTime(10);
      if (e.key === "ArrowLeft") skipTime(-10);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Gọi API lấy dữ liệu Phim
  useEffect(() => {
    const fetchVideoData = async () => {
      try {
        const resAnime = await fetch(`http://localhost:5000/api/anime/${animeId}`);
        if (resAnime.ok) {
          const data = await resAnime.json();
          setAnimeTitle(data.title);
          const currentEp = data.episodes.find((ep: Episode) => ep.id === episodeId);
          setEpisode(currentEp || null);
        }
      } catch (error) {
        console.error("Lỗi:", error);
      } finally {
        setLoading(false);
      }
    };
    
    if (animeId && episodeId) {
      fetchVideoData();
    }
  }, [animeId, episodeId]);

  // ==========================================
  // GỌI API LƯU LỊCH SỬ XEM PHIM NGẦM
  // ==========================================
  useEffect(() => {
    const saveHistory = async () => {
      // Nếu chưa đăng nhập hoặc thiếu param thì không lưu
      if (!session?.user?.id || !animeId || !episodeId) return;
      
      try {
        await fetch("http://localhost:5000/api/history/anime", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: session.user.id,
            animeId: animeId,
            episodeId: episodeId
          })
        });
      } catch (error) {
        console.error("Lỗi lưu lịch sử anime:", error);
      }
    };

    saveHistory();
  }, [session?.user?.id, animeId, episodeId]);
  // ==========================================

  // Các lệnh return chặn (BẮT BUỘC ĐẶT DƯỚI CÙNG CÁC HOOKS)
  if (loading) return <div className="text-white text-center mt-20">Đang tải video...</div>;
  if (!episode) return <div className="text-white text-center mt-20">Không tìm thấy tập phim!</div>;

  return (
    <div className="min-h-screen bg-black text-white pb-12">
      
      {/* THANH ĐIỀU HƯỚNG */}
      <div className="p-4 bg-gray-900/80 backdrop-blur-md sticky top-0 z-50 flex items-center gap-4">
        <Link href={`/anime/${animeId}`} className="text-gray-400 hover:text-white bg-gray-800 px-4 py-2 rounded-lg transition">
          &larr; Trở về
        </Link>
        <div>
          <h1 className="text-lg font-bold text-blue-400">{animeTitle}</h1>
          <p className="text-xs text-gray-300">{episode.title}</p>
        </div>
      </div>

      {/* KHU VỰC TRÌNH PHÁT VIDEO */}
      <div className="max-w-6xl mx-auto mt-4 px-4">
        <div className="relative aspect-video w-full bg-gray-900 rounded-xl overflow-hidden shadow-2xl border border-gray-800 group">
          
          <video 
            ref={videoRef}
            controls 
            className="w-full h-full outline-none"
            controlsList="nodownload"
            crossOrigin="anonymous"
          >
            <source src={episode.videoUrl} type="video/mp4" />
            {episode.subtitles && episode.subtitles.map((sub, index) => (
              <track key={sub.id} kind="subtitles" srcLang={sub.label} label={sub.label} src={sub.url} default={index === 0} />
            ))}
            Trình duyệt của bạn không hỗ trợ thẻ video.
          </video>

          {/* LỚP PHỦ CHỨA 2 NÚT TUA */}
          <div className="absolute inset-0 flex items-center justify-center gap-32 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
            
            <button 
              onClick={() => skipTime(-10)}
              className="pointer-events-auto bg-black/60 hover:bg-blue-600 text-white p-4 rounded-full backdrop-blur-sm transition-transform hover:scale-110 flex flex-col items-center justify-center w-16 h-16 shadow-lg border border-gray-700"
              title="Lùi 10 giây (Phím mũi tên Trái)"
            >
              <span className="text-xl font-black mb-1">↺</span>
              <span className="text-[10px] font-bold">-10s</span>
            </button>

            <button 
              onClick={() => skipTime(10)}
              className="pointer-events-auto bg-black/60 hover:bg-blue-600 text-white p-4 rounded-full backdrop-blur-sm transition-transform hover:scale-110 flex flex-col items-center justify-center w-16 h-16 shadow-lg border border-gray-700"
              title="Tiến 10 giây (Phím mũi tên Phải)"
            >
              <span className="text-xl font-black mb-1">↻</span>
              <span className="text-[10px] font-bold">+10s</span>
            </button>
            
          </div>
        </div>
        
        {/* Box thông tin bên dưới Video */}
        <div className="mt-6 bg-gray-900 p-6 rounded-xl border border-gray-800">
          <h2 className="text-2xl font-bold">{episode.title}</h2>
          <p className="text-gray-400 text-sm mt-2">
            Ngày đăng: {new Date(episode.createdAt).toLocaleDateString('vi-VN')}
          </p>
        </div>

        {/* NHÚNG COMPONENT BÌNH LUẬN */}
        <CommentSection targetType="episode" targetId={episodeId} />

      </div>
    </div>
  );
}