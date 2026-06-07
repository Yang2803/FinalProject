"use client";

import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import CommentSection from "@/components/CommentSection";
import { SUPPORTED_LANGUAGES } from '@/components/constants/languages';

// =====================================================================
// 1. CÁC INTERFACE DỮ LIỆU
// =====================================================================
interface Subtitle {
  id: string;
  label: string;
  url: string;
}

interface Episode {
  id: string;
  title: string;
  videoUrl: string;
  createdAt: string;
  subtitles?: Subtitle[];
  mappedChapterIds?: string[]; // Mảng chứa ID các Chapter Manga liên kết
}

interface ChapterData {
  id: string;
  title: string;
  images: string[];
  mangaId: string;
}

// interface TextBlock {
//   translatedText: string;
//   topPercent: number;
//   leftPercent: number;
//   widthPercent: number;
//   heightPercent: number;
// }


// =====================================================================
// 3. PAGE CHÍNH: XEM PHIM & SPLIT-SCREEN MANGA
// =====================================================================
export default function WatchEpisodePage() {
  const params = useParams();
  const animeId = params.id as string || params.animeId as string;
  const episodeId = params.episodeId as string;
  
  const { data: session } = useSession();

  // --- STATE CỦA VIDEO ---
  const [animeTitle, setAnimeTitle] = useState("");
  const [episode, setEpisode] = useState<Episode | null>(null);
  const [allEpisodes, setAllEpisodes] = useState<Episode[]>([]); 
  const [loading, setLoading] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);

  // --- STATE DỊCH SUBTITLE (ANIME) ---
  const [isTranslatingSub, setIsTranslatingSub] = useState(false);

  // --- STATE SPLIT-SCREEN MANGA ---
  const [showSplitScreen, setShowSplitScreen] = useState(false);
  const [linkedChapters, setLinkedChapters] = useState<ChapterData[]>([]);
  const [mangaTargetLang, setMangaTargetLang] = useState("Vietnamese"); // Dành cho AI quét ảnh truyện

  const skipTime = (seconds: number) => {
    if (videoRef.current) videoRef.current.currentTime += seconds;
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "TEXTAREA") return;
      if (e.key === "ArrowRight") skipTime(10);
      if (e.key === "ArrowLeft") skipTime(-10);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // 1. LOAD THÔNG TIN ANIME VÀ TẬP PHIM
  useEffect(() => {
    const fetchVideoData = async () => {
      try {
        const resAnime = await fetch(`http://localhost:5000/api/anime/${animeId}`);
        if (resAnime.ok) {
          const data = await resAnime.json();
          setAnimeTitle(data.title);
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
    if (animeId && episodeId) fetchVideoData();
  }, [animeId, episodeId]);

  // 2. LOAD THÔNG TIN CÁC CHƯƠNG MANGA LIÊN KẾT (NẾU CÓ)
  useEffect(() => {
    const fetchLinkedChapters = async () => {
      if (!episode?.mappedChapterIds || episode.mappedChapterIds.length === 0) return;
      
      try {
        // Dùng Promise.all để gọi API lấy ảnh của tất cả các chapter liên kết cùng lúc
        const chapterPromises = episode.mappedChapterIds.map(id =>
          fetch(`http://localhost:5000/api/chapter/${id}`).then(res => res.json())
        );
        const chapters = await Promise.all(chapterPromises);
        setLinkedChapters(chapters);
      } catch (error) {
        console.error("Lỗi tải chapter liên kết:", error);
      }
    };
    fetchLinkedChapters();
  }, [episode?.mappedChapterIds]);

  // 3. LƯU LỊCH SỬ XEM
  useEffect(() => {
    const saveHistory = async () => {
      if (!session?.user?.id || !animeId || !episodeId) return;
      try {
        await fetch("http://localhost:5000/api/history/anime", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: session.user.id, animeId, episodeId })
        });
      } catch (error) {
        console.error("Lỗi lưu lịch sử anime:", error);
      }
    };
    saveHistory();
  }, [session?.user?.id, animeId, episodeId]);

  // HÀM GỌI API DỊCH AI CHO PHỤ ĐỀ (VIDEO)
  const handleAutoTranslateSub = async (targetLang: string) => {
    if (!episode || !targetLang) return;
    setIsTranslatingSub(true);
    try {
      const res = await fetch("http://localhost:5000/api/anime/translate-sub", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ episodeId, targetLang })
      });
      if (res.ok) {
        const data = await res.json();
        setEpisode(prev => {
          if (!prev) return prev;
          const exists = prev.subtitles?.find(s => s.id === data.subtitle.id);
          if (exists) return prev;
          return { ...prev, subtitles: [...(prev.subtitles || []), data.subtitle] };
        });
        alert(`Đã hoàn tất dịch sang ${targetLang}! Vui lòng bật phụ đề trong Player (CC).`);
      } else {
        alert("Có lỗi xảy ra trong quá trình dịch thuật.");
      }
    } catch (error) {
      console.error("Translate error:", error);
    } finally {
      setIsTranslatingSub(false);
    }
  };

  if (loading) return <div className="text-white text-center mt-20">Loading video...</div>;
  if (!episode) return <div className="text-white text-center mt-20">Episode not found!</div>;

  return (
    <div className="min-h-screen bg-black text-white pb-12">
      
      {/* THANH ĐIỀU HƯỚNG CÓ NÚT BẬT TẮT MANGA */}
      <div className="p-4 bg-gray-900/80 backdrop-blur-md sticky top-0 z-50 flex items-center gap-4">
        <Link href={`/anime/${animeId}`} className="text-gray-400 hover:text-white bg-gray-800 px-4 py-2 rounded-lg transition shrink-0">
          &larr; Trở về
        </Link>
        <div className="flex-1 truncate">
          <h1 className="text-lg font-bold text-blue-400 truncate">{animeTitle}</h1>
          <p className="text-xs text-gray-300 truncate">{episode.title}</p>
        </div>

        {/* NÚT THẦN THÁNH: BẬT/TẮT ĐỒNG BỘ MANGA */}
        {linkedChapters.length > 0 && (
          <button 
            onClick={() => setShowSplitScreen(!showSplitScreen)}
            className={`px-4 py-2 rounded-lg font-bold text-sm transition shrink-0 shadow-lg ${
              showSplitScreen ? 'bg-red-600 hover:bg-red-500' : 'bg-purple-600 hover:bg-purple-500 shadow-purple-500/30'
            }`}
          >
            {showSplitScreen ? "✕ Close Manga" : "📖 Read Original Manga"}
          </button>
        )}
      </div>

      {/* ================================================================= */}
      {/* KHU VỰC SPLIT-SCREEN (CHIA ĐÔI MÀN HÌNH NẾU BẬT) */}
      {/* ================================================================= */}
      <div className={`mx-auto mt-4 px-4 flex flex-col lg:flex-row gap-6 transition-all duration-300 ${showSplitScreen ? 'max-w-[1600px]' : 'max-w-6xl'}`}>
        
        {/* CỘT TRÁI: VIDEO PLAYER (Co giãn theo trạng thái Split Screen) */}
        <div className={`flex flex-col transition-all duration-500 ${showSplitScreen ? 'w-full lg:w-[60%]' : 'w-full'}`}>
          <div className="relative w-full aspect-video bg-gray-900 rounded-xl overflow-hidden shadow-2xl border border-gray-800 group">
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
            </video>

            {/* OVERLAY NÚT TUA */}
            <div className="absolute inset-0 flex items-center justify-center gap-32 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
              <button 
                onClick={() => skipTime(-10)}
                className="pointer-events-auto bg-black/60 hover:bg-blue-600 text-white p-4 rounded-full backdrop-blur-sm transition-transform hover:scale-110 flex flex-col items-center justify-center w-16 h-16 shadow-lg border border-gray-700"
              >
                <span className="text-xl font-black mb-1">↺</span>
                <span className="text-[10px] font-bold">-10s</span>
              </button>
              <button 
                onClick={() => skipTime(10)}
                className="pointer-events-auto bg-black/60 hover:bg-blue-600 text-white p-4 rounded-full backdrop-blur-sm transition-transform hover:scale-110 flex flex-col items-center justify-center w-16 h-16 shadow-lg border border-gray-700"
              >
                <span className="text-xl font-black mb-1">↻</span>
                <span className="text-[10px] font-bold">+10s</span>
              </button>
            </div>
          </div>
          
          {/* Box thông tin bên dưới Video */}
          <div className="mt-6 bg-gray-900 p-6 rounded-xl border border-gray-800">
            <h2 className="text-2xl font-bold">{episode.title}</h2>
            <p className="text-gray-400 text-sm mt-2">Date posted: {new Date(episode.createdAt).toLocaleDateString('vi-VN')}</p>
          </div>

          {/* DỊCH PHỤ ĐỀ AI */}
          <div className="mt-4 bg-gray-800 p-3 rounded-lg flex items-center gap-3 border border-gray-700">
            <span className="text-sm font-bold text-blue-400">✨ Auto-translate subtitile:</span>
            <select 
              className="bg-gray-900 text-white text-sm px-3 py-1.5 rounded outline-none border border-gray-600 disabled:opacity-50"
              disabled={isTranslatingSub}
              onChange={(e) => {
                if(e.target.value) handleAutoTranslateSub(e.target.value);
                e.target.value = ""; 
              }}
            >
              <option value="">Select language...</option>
              {SUPPORTED_LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.code}>{lang.label}</option>
              ))}
            </select>
            {isTranslatingSub && <span className="text-xs text-yellow-400 animate-pulse">Translating...</span>}
          </div>
        </div>

        {/* CỘT PHẢI: KHU VỰC MANGA ĐỒNG BỘ */}
        {showSplitScreen && (
          <div className="w-full lg:w-[40%] flex flex-col h-[70vh] lg:h-[calc(100vh-100px)] bg-gray-900 rounded-xl border border-gray-800 shadow-2xl overflow-hidden sticky top-[80px]">
            
            {/* Header Manga Panel */}
            <div className="bg-gray-800 p-4 border-b border-gray-700 flex flex-wrap justify-between items-center gap-2">
              <span className="font-bold text-purple-400 uppercase tracking-wide text-sm">📖 Manga</span>
              
              
            </div>
            
            {/* Vùng cuộn đọc truyện (Độc lập không trôi trang) */}
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-[#0f0f11]">
              {linkedChapters.map((chapter) => (
                <div key={chapter.id} className="mb-10">
                  
                  {/* ======================================================= */}
                  {/* KHU VỰC TIÊU ĐỀ CHƯƠNG & NÚT LINK ĐÃ ĐƯỢC THIẾT KẾ LẠI */}
                  {/* ======================================================= */}
                  <div className="flex items-center justify-between gap-4 mb-6 relative">
                     <div className="h-px bg-gray-700 flex-1"></div>
                     
                     <div className="flex flex-col items-center">
                       <h3 className="text-gray-300 font-bold text-sm tracking-wider uppercase">
                         {chapter.title}
                       </h3>
                       {/* NÚT ĐIỀU HƯỚNG VÀO CHÍNH XÁC CHƯƠNG NÀY */}
                       <Link 
                         href={`/manga/${chapter.mangaId}/chapter/${chapter.id}`}
                         target="_blank"
                         className="text-blue-400 hover:text-blue-300 text-[11px] font-semibold mt-2 flex items-center gap-1 transition bg-gray-800/60 px-4 py-1.5 rounded-full border border-gray-700 hover:bg-gray-700 hover:scale-105"
                       >
                         Read in Full Screen ↗
                       </Link>
                     </div>
                     
                     <div className="h-px bg-gray-700 flex-1"></div>
                  </div>
                  {/* ======================================================= */}

                  {chapter.images.map((imgUrl, index) => (
                    // Chỉ hiển thị ảnh thô, không kèm nút dịch
                    <div key={index} className="w-full mb-4">
                      <img 
                        src={imgUrl} 
                        alt={`Trang ${index + 1}`} 
                        className="w-full h-auto block object-contain rounded-md" 
                      />
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      {/* ================================================================= */}

      <div className="max-w-6xl mx-auto px-4">
        {/* DANH SÁCH CÁC TẬP PHIM */}
        <div className="mt-8 bg-gray-900 rounded-xl p-6 md:p-8 shadow-xl border border-gray-800">
          <h3 className="text-xl font-bold text-white mb-6 border-l-4 border-blue-500 pl-3">Select Episode</h3>
          {allEpisodes.length === 0 ? (
            <div className="text-center py-10 text-gray-500 italic">Loading episode list...</div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {allEpisodes.map((ep, index) => {
                const isActive = ep.id === episodeId; 
                return (
                  <Link 
                    key={ep.id} 
                    href={`/anime/${animeId}/watch/${ep.id}`}
                    className={`text-center py-4 rounded-xl transition-all font-semibold shadow-md group flex flex-col items-center justify-center h-full border ${
                      isActive ? "bg-blue-600 border-blue-400 text-white shadow-[0_0_15px_rgba(37,99,235,0.4)]" : "bg-gray-800 hover:bg-gray-700 border-gray-700 hover:border-gray-500"
                    }`}
                  >
                    <span className={`${isActive ? "text-blue-200" : "text-gray-400 group-hover:text-white"} text-xs block mb-1`}>Tập {index + 1}</span>
                    <span className={`${isActive ? "text-white" : "text-gray-200"} truncate w-full px-2 text-sm`}>{ep.title}</span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* BÌNH LUẬN */}
        <div className="mt-8">
          <CommentSection targetType="episode" targetId={episodeId} />
        </div>
      </div>
    </div>
  );
}