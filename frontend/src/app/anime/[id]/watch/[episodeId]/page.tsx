"use client";

import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import CommentSection from "@/components/CommentSection";

import { SUPPORTED_LANGUAGES } from '@/components/constants/languages';

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
  const animeId = params.id as string || params.animeId as string;
  const episodeId = params.episodeId as string;
  
  const { data: session } = useSession();

  // --- STATE CỦA VIDEO ---
  const [animeTitle, setAnimeTitle] = useState("");
  const [episode, setEpisode] = useState<Episode | null>(null);
  
  // 1. BỔ SUNG STATE LƯU TOÀN BỘ DANH SÁCH TẬP PHIM
  const [allEpisodes, setAllEpisodes] = useState<Episode[]>([]); 
  
  const [loading, setLoading] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);

  const skipTime = (seconds: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime += seconds;
    }
  };

  //State của auto translate
  const [isTranslating, setIsTranslating] = useState(false);
  const [activeSubId, setActiveSubId] = useState<string | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "TEXTAREA") return;
      if (e.key === "ArrowRight") skipTime(10);
      if (e.key === "ArrowLeft") skipTime(-10);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    const fetchVideoData = async () => {
      try {
        const resAnime = await fetch(`http://localhost:5000/api/anime/${animeId}`);
        if (resAnime.ok) {
          const data = await resAnime.json();
          setAnimeTitle(data.title);
          
          // 2. LƯU MẢNG EPISODES VÀO STATE
          setAllEpisodes(data.episodes); 
          
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

  useEffect(() => {
    const saveHistory = async () => {
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

  // HÀM GỌI API DỊCH AI
  const handleAutoTranslate = async (targetLang: string) => {
    if (!episode || !targetLang) return;
    
    setIsTranslating(true);
    try {
      const res = await fetch("http://localhost:5000/api/anime/translate-sub", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ episodeId, targetLang })
      });

      if (res.ok) {
        const data = await res.json();
        
        // Cập nhật lại mảng phụ đề của tập phim hiện tại để nhét file mới vào
        setEpisode(prev => {
          if (!prev) return prev;
          // Kiểm tra xem đã có trong list chưa (tránh add trùng nếu bấm liên tục)
          const exists = prev.subtitles?.find(s => s.id === data.subtitle.id);
          if (exists) return prev;
          return {
            ...prev,
            subtitles: [...(prev.subtitles || []), data.subtitle]
          };
        });
        
        alert(`Đã hoàn tất dịch sang ${targetLang}! Vui lòng bật phụ đề trong Player (CC).`);
      } else {
        alert("Có lỗi xảy ra trong quá trình dịch thuật.");
      }
    } catch (error) {
      console.error("Translate error:", error);
    } finally {
      setIsTranslating(false);
    }
  };

  if (loading) return <div className="text-white text-center mt-20">Loading video...</div>;
  if (!episode) return <div className="text-white text-center mt-20">Episode not found!</div>;

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
            Your browser does not support video tags.
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
            Date posted: {new Date(episode.createdAt).toLocaleDateString('vi-VN')}
          </p>
        </div>

        {/* CỤM NÚT AUTO TRANSLATE AI */}
          <div className="bg-gray-800 p-3 rounded-lg flex items-center gap-3 border border-gray-700">
            <span className="text-sm font-bold text-blue-400 flex items-center gap-1">
              ✨ AI Translate:
            </span>
            <select 
              className="bg-gray-900 text-white text-sm px-3 py-1.5 rounded outline-none border border-gray-600 disabled:opacity-50"
              disabled={isTranslating}
              onChange={(e) => {
                if(e.target.value) handleAutoTranslate(e.target.value);
                e.target.value = ""; // Reset dropdown sau khi chọn
              }}
            >
              <option value="">Chọn ngôn ngữ...</option>
              
              {/* Dùng map để tự động sinh ra danh sách ngôn ngữ */}
              {SUPPORTED_LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.label}
                </option>
              ))}
              
            </select>
            
            {isTranslating && (
              <span className="text-xs text-yellow-400 animate-pulse flex items-center gap-1">
                <div className="w-3 h-3 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin"></div>
                Đang dịch...
              </span>
            )}
          </div>

        {/* =========================================
            3. KHU VỰC DANH SÁCH TẬP PHIM BỔ SUNG
        ========================================== */}
        <div className="mt-8 bg-gray-900 rounded-xl p-6 md:p-8 shadow-xl border border-gray-800">
          <h3 className="text-xl font-bold text-white mb-6 border-l-4 border-blue-500 pl-3">
            Select Episode
          </h3>
          
          {allEpisodes.length === 0 ? (
            <div className="text-center py-10 text-gray-500 italic">
              Loading episode list...
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {allEpisodes.map((ep, index) => {
                // Kiểm tra xem đây có phải là tập phim đang phát không
                const isActive = ep.id === episodeId; 
                
                return (
                  <Link 
                    key={ep.id} 
                    href={`/anime/${animeId}/watch/${ep.id}`}
                    className={`text-center py-4 rounded-xl transition-all font-semibold shadow-md group flex flex-col items-center justify-center h-full border ${
                      isActive 
                        ? "bg-blue-600 border-blue-400 text-white shadow-[0_0_15px_rgba(37,99,235,0.4)]" // Nổi bật tập đang xem
                        : "bg-gray-800 hover:bg-gray-700 border-gray-700 hover:border-gray-500" // Cấu hình tập bình thường
                    }`}
                  >
                    <span className={`${isActive ? "text-blue-200" : "text-gray-400 group-hover:text-white"} text-xs block mb-1`}>
                      Tập {index + 1}
                    </span>
                    <span className={`${isActive ? "text-white" : "text-gray-200"} truncate w-full px-2 text-sm`}>
                      {ep.title}
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* NHÚNG COMPONENT BÌNH LUẬN */}
        <div className="mt-8">
          <CommentSection targetType="episode" targetId={episodeId} />
        </div>

      </div>
    </div>
  );
}