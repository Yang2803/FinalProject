"use client";

import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import CommentSection from "@/components/CommentSection";
import { SUPPORTED_LANGUAGES } from '@/components/constants/languages';

// ⚠️ ĐIỀN ĐƯỜNG LINK R2 CỦA CẬU VÀO ĐÂY (KHÔNG CÓ DẤU / Ở CUỐI)
const R2_BASE_URL = "https://pub-67a4b86a3ac64626ac476f9978ec23d2.r2.dev"; 

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
  dubbedLanguages?: string[];  // ➕ Thêm mảng ngôn ngữ lồng tiếng từ Database
}

interface ChapterData {
  id: string;
  title: string;
  images: string[];
  mangaId: string;
}

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

  // --- ➕ STATE LỒNG TIẾNG AI ---
  const [selectedDubLang, setSelectedDubLang] = useState<string>("");
  const audioDubRef = useRef<HTMLAudioElement | null>(null);

  // --- STATE DỊCH SUBTITLE (ANIME) ---
  const [isTranslatingSub, setIsTranslatingSub] = useState(false);
  const [translateProgress, setTranslateProgress] = useState(0);

  // --- STATE TẠO LỒNG TIẾNG (GENERATE DUB) ---
  const [isGeneratingDub, setIsGeneratingDub] = useState(false);
  const [dubProgress, setDubProgress] = useState(0);

  // Hàm gọi API yêu cầu Backend sinh file MP3 lồng tiếng
  const handleGenerateDub = async (targetLang: string, subtitleUrl: string) => {
    if (!episode || !targetLang || !subtitleUrl) return;
    
    const confirmMsg = `Hệ thống sẽ bắt đầu tạo lồng tiếng AI cho ngôn ngữ [${targetLang}]. Quá trình này có thể mất 1 - 2 phút. Bạn có muốn tiếp tục?`;
    if (!window.confirm(confirmMsg)) return;

    setIsGeneratingDub(true);
    setDubProgress(0);

    // 🌟 THUẬT TOÁN TIẾN ĐỘ GIẢ LẬP (Chạy mỗi 1 giây)
    const progressInterval = setInterval(() => {
      setDubProgress(prev => {
        if (prev >= 99) return 99; // Khựng lại ở 99% đợi API
        if (prev < 40) return prev + Math.floor(Math.random() * 3) + 2; // Tăng 2-4%
        if (prev < 80) return prev + 1; // Tăng 1%
        return prev + 0.2; // Tăng rất chậm 0.2%
      });
    }, 1000);

    try {
      const res = await fetch("http://localhost:5000/api/anime/generate-dub", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ episodeId: episode.id, subtitleUrl, targetLang })
      });

      if (res.ok) {
        clearInterval(progressInterval); // Dừng giả lập
        setDubProgress(100); // 🌟 Kéo full 100%
        
        // Đợi 500ms cho UI thanh progress chạy mượt tới đích rồi mới báo Alert
        setTimeout(() => {
          alert("🎉 Đã tạo lồng tiếng thành công! Bạn có thể bật nghe ngay bây giờ.");
          setEpisode(prev => {
            if (!prev) return prev;
            const currentDubs = prev.dubbedLanguages || [];
            if (!currentDubs.includes(targetLang)) {
              return { ...prev, dubbedLanguages: [...currentDubs, targetLang] };
            }
            return prev;
          });
          setSelectedDubLang(targetLang);
        }, 500);
      } else {
        alert("❌ Có lỗi xảy ra trong quá trình tạo lồng tiếng.");
      }
    } catch (error) {
      console.error("Generate dub error:", error);
      alert("❌ Lỗi kết nối đến máy chủ!");
    } finally {
      clearInterval(progressInterval);
      // Đợi 2s rồi mới dọn dẹp UI tiến trình
      setTimeout(() => {
        setIsGeneratingDub(false);
        setDubProgress(0);
      }, 2000);
    }
  };

  // --- STATE SPLIT-SCREEN MANGA ---
  const [showSplitScreen, setShowSplitScreen] = useState(false);
  const [linkedChapters, setLinkedChapters] = useState<ChapterData[]>([]);
  const [mangaTargetLang, setMangaTargetLang] = useState("Vietnamese"); 

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

  // =====================================================================
  // ➕ 4. LOGIC ĐỒNG BỘ LỒNG TIẾNG & AUDIO DUCKING (NÂNG CẤP CHẠY NGẦM)
  // =====================================================================
  useEffect(() => {
    const videoElement = videoRef.current;
    const audioEl = audioDubRef.current;

    if (!videoElement) return;

    // 🌟 FIX LỖI 1: XỬ LÝ KHI CHỌN ORIGINAL AUDIO (TẮT DUB)
    if (!selectedDubLang) {
      if (audioEl) {
        audioEl.pause();
        audioEl.currentTime = 0;
      }
      videoElement.volume = 1.0; // Trả lại 100% âm lượng gốc
      return; // Thoát luôn, không chạy các logic đồng bộ phía dưới nữa
    }

    // Hàm tìm kiếm và cấu hình trạng thái chạy ngầm cho Track phụ đề
    const setupTargetTrack = () => {
      const textTracks = videoElement.textTracks;
      let targetTrack: TextTrack | null = null;

      // 1. Dò tìm track phụ đề khớp với ngôn ngữ lồng tiếng đang chọn
      for (let i = 0; i < textTracks.length; i++) {
        if (selectedDubLang.includes(textTracks[i].label) || textTracks[i].label.includes(selectedDubLang)) {
          targetTrack = textTracks[i];
          break;
        }
      }

      // Fallback: Nếu không khớp tên, lấy đại track phụ đề đầu tiên trong hệ thống làm đồng hồ đếm nhịp
      if (!targetTrack && textTracks.length > 0) {
        const fallbackTrack = Array.from(textTracks).find(t => t.kind === 'subtitles' || t.kind === 'captions');
        if (fallbackTrack) targetTrack = fallbackTrack;
      }

      if (!targetTrack) return null;

      // 🌟 FIX TÍNH NĂNG 2: ÉP CHẠY NGẦM KHI USER TẮT SUB
      // Nếu người dùng chọn "Tắt phụ đề" (disabled) ở giao diện Player, 
      // ta chuyển nó thành 'hidden' để ẩn chữ đi nhưng sự kiện cuechange VẪN CHẠY NGẦM dưới nền!
      if (targetTrack.mode === 'disabled') {
        targetTrack.mode = 'hidden';
      }

      return targetTrack;
    };

    // Khởi tạo track mục tiêu ban đầu
    let activeTrack = setupTargetTrack();

    // Logic xử lý khi mốc thời gian phụ đề thay đổi (Hiện câu thoại)
    const handleCueChange = (e: Event) => {
      const track = e.target as TextTrack;
      const activeCues = track.activeCues;

      if (activeCues && activeCues.length > 0 && audioEl) {
        const currentCue = activeCues[0];
        const allCues = Array.from(track.cues || []);
        const index = allCues.indexOf(currentCue as TextTrackCue);

        if (index !== -1) {
          const encodedLang = encodeURIComponent(selectedDubLang);
          const audioUrl = `${R2_BASE_URL}/dubs/${episodeId}/${encodedLang}/${index}.mp3`;
          
          audioEl.src = audioUrl;
          const cueDuration = currentCue.endTime - currentCue.startTime;

          audioEl.onloadedmetadata = () => {
            const audioDuration = audioEl.duration;
            // Thuật toán Co giãn tốc độ động (Dynamic Playback Rate)
            if (audioDuration > cueDuration) {
              let neededSpeed = audioDuration / cueDuration;
              if (neededSpeed > 1.4) neededSpeed = 1.4;
              audioEl.playbackRate = neededSpeed;
            } else {
              audioEl.playbackRate = 1.0;
            }
            audioEl.play().catch(err => console.log("Lỗi Autoplay ngầm:", err));
          };

          // Kích hoạt Audio Ducking (Hạ âm phim xuống 20%)
          videoElement.volume = 0.2; 

          audioEl.onended = () => { videoElement.volume = 1.0; };
          audioEl.onerror = () => { videoElement.volume = 1.0; };
        }
      }
    };

    // Gắn cổng lắng nghe cuechange vào track phụ đề
    if (activeTrack) {
      activeTrack.addEventListener("cuechange", handleCueChange);
    }

    // 🌟 VŨ KHÍ BÍ MẬT: Lắng nghe sự kiện user bấm nút Bật/Tắt phụ đề trên thanh công cụ của Player
    const handlePlayerCcToggle = () => {
      if (activeTrack) {
        activeTrack.removeEventListener("cuechange", handleCueChange);
      }
      
      // Cấu hình tái lập lại chế độ 'hidden' nếu user vừa bấm tắt CC
      activeTrack = setupTargetTrack();
      
      if (activeTrack) {
        activeTrack.addEventListener("cuechange", handleCueChange);
      }
    };

    // Bắt sự kiện thay đổi trạng thái phụ đề của toàn bộ Player
    videoElement.textTracks.addEventListener("change", handlePlayerCcToggle);

    // Dọn dẹp bộ nhớ (Cleanup) khi component unmount
    return () => {
      if (activeTrack) {
        activeTrack.removeEventListener("cuechange", handleCueChange);
      }
      videoElement.textTracks.removeEventListener("change", handlePlayerCcToggle);
    };
  }, [selectedDubLang, episodeId, episode?.subtitles]);

  // ➕ 5. ANTI-SEEK GLITCH: Tắt âm thanh lồng tiếng nếu Tua/Dừng phim
  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement) return;

    const handlePause = () => audioDubRef.current?.pause();
    const handleSeek = () => {
      if (audioDubRef.current) {
        audioDubRef.current.pause();
        audioDubRef.current.currentTime = 0;
      }
      videoElement.volume = 1.0;
    };

    videoElement.addEventListener("pause", handlePause);
    videoElement.addEventListener("seeking", handleSeek);

    return () => {
      videoElement.removeEventListener("pause", handlePause);
      videoElement.removeEventListener("seeking", handleSeek);
    };
  }, []);
  // =====================================================================

  // HÀM GỌI API DỊCH AI CHO PHỤ ĐỀ (VIDEO)
  const handleAutoTranslateSub = async (targetLang: string) => {
    if (!episode || !targetLang) return;
    
    setIsTranslatingSub(true);
    setTranslateProgress(0);

    // 🌟 THUẬT TOÁN TIẾN ĐỘ GIẢ LẬP (Nhanh hơn vì dịch Text lẹ hơn Audio)
    const progressInterval = setInterval(() => {
      setTranslateProgress(prev => {
        if (prev >= 99) return 99;
        if (prev < 60) return prev + Math.floor(Math.random() * 5) + 5; 
        if (prev < 90) return prev + 2; 
        return prev + 1; 
      });
    }, 600);

    try {
      const res = await fetch("http://localhost:5000/api/anime/translate-sub", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ episodeId, targetLang })
      });
      
      if (res.ok) {
        const data = await res.json();
        clearInterval(progressInterval);
        setTranslateProgress(100); // 🌟 Kéo full 100%

        setTimeout(() => {
          setEpisode(prev => {
            if (!prev) return prev;
            const exists = prev.subtitles?.find(s => s.id === data.subtitle.id);
            if (exists) return prev;
            return { ...prev, subtitles: [...(prev.subtitles || []), data.subtitle] };
          });
          alert(`✨ Đã hoàn tất dịch sang ${targetLang}! Vui lòng bật phụ đề trong Player (CC).`);
        }, 400);
      } else {
        alert("❌ Có lỗi xảy ra trong quá trình dịch thuật.");
      }
    } catch (error) {
      console.error("Translate error:", error);
    } finally {
      clearInterval(progressInterval);
      setTimeout(() => {
        setIsTranslatingSub(false);
        setTranslateProgress(0);
      }, 2000);
    }
  };

  if (loading) return <div className="text-white text-center mt-20">Loading video...</div>;
  if (!episode) return <div className="text-white text-center mt-20">Episode not found!</div>;

  return (
    <div className="min-h-screen bg-black text-white pb-12">
      
      {/* ➕ THẺ AUDIO CHẠY NGẦM ĐỂ PHÁT TIẾNG AI */}
      <audio ref={audioDubRef} className="hidden" />

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

      {/* KHU VỰC SPLIT-SCREEN */}
      <div className={`mx-auto mt-4 px-4 flex flex-col lg:flex-row gap-6 transition-all duration-300 ${showSplitScreen ? 'max-w-[1600px]' : 'max-w-6xl'}`}>
        
        {/* CỘT TRÁI: VIDEO PLAYER */}
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
              <button onClick={() => skipTime(-10)} className="pointer-events-auto bg-black/60 hover:bg-blue-600 text-white p-4 rounded-full backdrop-blur-sm transition-transform hover:scale-110 flex flex-col items-center justify-center w-16 h-16 shadow-lg border border-gray-700">
                <span className="text-xl font-black mb-1">↺</span>
                <span className="text-[10px] font-bold">-10s</span>
              </button>
              <button onClick={() => skipTime(10)} className="pointer-events-auto bg-black/60 hover:bg-blue-600 text-white p-4 rounded-full backdrop-blur-sm transition-transform hover:scale-110 flex flex-col items-center justify-center w-16 h-16 shadow-lg border border-gray-700">
                <span className="text-xl font-black mb-1">↻</span>
                <span className="text-[10px] font-bold">+10s</span>
              </button>
            </div>
          </div>
          
          {/* Box thông tin bên dưới Video */}
          <div className="mt-6 bg-gray-900 p-6 rounded-xl border border-gray-800 flex flex-col md:flex-row md:items-start justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold">{episode.title}</h2>
              <p className="text-gray-400 text-sm mt-2">Date posted: {new Date(episode.createdAt).toLocaleDateString('vi-VN')}</p>
            </div>

            {/* ➕ UI CHỌN LỒNG TIẾNG (Chỉ hiện khi DB báo có lồng tiếng) */}
            {(episode.dubbedLanguages && episode.dubbedLanguages.length > 0) ? (
              <div className="bg-purple-900/30 border border-purple-500/50 p-3 rounded-lg flex items-center gap-3 shrink-0">
                <span className="text-sm font-bold text-purple-400 flex items-center gap-1">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd"></path></svg>
                  AI Dub:
                </span>
                <select 
                  value={selectedDubLang}
                  onChange={(e) => setSelectedDubLang(e.target.value)}
                  className="bg-gray-900 text-white text-sm px-3 py-1.5 rounded outline-none border border-gray-600 focus:border-purple-500 transition-all cursor-pointer shadow-inner"
                >
                  <option value="">Original Audio</option>
                  
                  {/* DÙNG VÒNG LẶP MAP ĐỂ RENDER ĐỘNG MỌI NGÔN NGỮ CÓ TRONG DATABASE */}
                  {episode.dubbedLanguages.map((lang) => (
                    <option key={lang} value={lang}>
                      {lang} (AI Voice)
                    </option>
                  ))}
                  
                </select>
                {selectedDubLang && <span className="relative flex h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-purple-500"></span></span>}
              </div>
            ) : null}
          </div>

         {/* ================================================================= */}
          {/* KHU VỰC CÁC TÍNH NĂNG AI: DỊCH PHỤ ĐỀ & TẠO LỒNG TIẾNG            */}
          {/* ================================================================= */}
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* 1. BOX DỊCH PHỤ ĐỀ AI */}
            <div className="bg-gray-800 p-3 rounded-lg flex flex-col xl:flex-row items-center justify-between gap-3 border border-gray-700">
              <span className="text-sm font-bold text-blue-400 shrink-0">✨ Auto-translate subtitle:</span>
              <div className="flex items-center gap-3 w-full xl:w-auto">
                <select 
                  className="bg-gray-900 text-white text-sm px-3 py-1.5 rounded outline-none border border-gray-600 disabled:opacity-50 w-full xl:w-auto"
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
                
                {/* 🌟 UI HIỂN THỊ % DỊCH THUẬT */}
                {isTranslatingSub && (
                  <div className="flex flex-col items-end gap-1 shrink-0 min-w-[80px]">
                    <span className="text-[10px] text-blue-400 font-bold animate-pulse">
                      Translating... {Math.floor(translateProgress)}%
                    </span>
                    <div className="w-full h-1.5 bg-gray-700 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-blue-500 transition-all duration-300 ease-out" 
                        style={{ width: `${translateProgress}%` }}
                      ></div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 2. BOX TẠO LỒNG TIẾNG AI (Chỉ hiện khi đã có phụ đề) */}
            {episode.subtitles && episode.subtitles.length > 0 && (
              <div className="bg-gray-800 p-3 rounded-lg flex flex-col xl:flex-row items-center justify-between gap-3 border border-gray-700">
                <span className="text-sm font-bold text-pink-400 shrink-0 flex items-center gap-1">
                  🎙️ Generate AI Voiceover:
                </span>
                <div className="flex items-center gap-3 w-full xl:w-auto">
                  <select 
                    className="bg-gray-900 text-white text-sm px-3 py-1.5 rounded outline-none border border-gray-600 disabled:opacity-50 w-full xl:w-auto"
                    disabled={isGeneratingDub}
                    onChange={(e) => {
                      const selectedLang = e.target.value;
                      if (selectedLang) {
                        const targetSub = episode.subtitles?.find(s => s.label === selectedLang);
                        if (targetSub) {
                          handleGenerateDub(selectedLang, targetSub.url);
                        }
                      }
                      e.target.value = ""; 
                    }}
                  >
                    <option value="">Select sub to dub...</option>
                    {episode.subtitles
                      .filter(sub => !(episode.dubbedLanguages || []).includes(sub.label))
                      .map((sub) => (
                        <option key={sub.id} value={sub.label}>
                          {sub.label}
                        </option>
                      ))
                    }
                  </select>
                  
                  {/* 🌟 UI HIỂN THỊ % LỒNG TIẾNG */}
                  {isGeneratingDub && (
                    <div className="flex flex-col items-end gap-1 shrink-0 min-w-[80px]">
                      <span className="text-[10px] text-pink-400 font-bold animate-pulse flex items-center gap-1">
                        <svg className="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                        {Math.floor(dubProgress)}%
                      </span>
                      <div className="w-full h-1.5 bg-gray-700 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-pink-500 transition-all duration-300 ease-out" 
                          style={{ width: `${dubProgress}%` }}
                        ></div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

          </div>
        </div>
        {/* ======================= KẾT THÚC CỘT TRÁI (VIDEO) ======================= */}

        

        {/* CỘT PHẢI: KHU VỰC MANGA ĐỒNG BỘ */}
        {showSplitScreen && (
          <div className="w-full lg:w-[40%] flex flex-col h-[70vh] lg:h-[calc(100vh-100px)] bg-gray-900 rounded-xl border border-gray-800 shadow-2xl overflow-hidden sticky top-[80px]">
            <div className="bg-gray-800 p-4 border-b border-gray-700 flex flex-wrap justify-between items-center gap-2">
              <span className="font-bold text-purple-400 uppercase tracking-wide text-sm">📖 Manga</span>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-[#0f0f11]">
              {linkedChapters.map((chapter) => (
                <div key={chapter.id} className="mb-10">
                  <div className="flex items-center justify-between gap-4 mb-6 relative">
                     <div className="h-px bg-gray-700 flex-1"></div>
                     <div className="flex flex-col items-center">
                       <h3 className="text-gray-300 font-bold text-sm tracking-wider uppercase">
                         {chapter.title}
                       </h3>
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

                  {chapter.images.map((imgUrl, index) => (
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