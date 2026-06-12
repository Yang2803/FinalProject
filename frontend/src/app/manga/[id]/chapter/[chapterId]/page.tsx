"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import CommentSection from "@/components/CommentSection";
import { SUPPORTED_LANGUAGES } from "@/components/constants/languages";
import { useState, useEffect, use } from "react"; // Đã xóa useRef vì không còn cần thiết

// 1. Interface Dữ liệu
interface ChapterData {
  id: string;
  title: string;
  images: string[];
  mangaId: string;
  manga: {
    title: string;
  };
  prevChapterId: string | null;
  nextChapterId: string | null;
}

// Cập nhật lại Interface để nhận tọa độ % từ Backend
interface TextBlock {
  translatedText: string;
  topPercent: number;
  leftPercent: number;
  widthPercent: number;
  heightPercent: number;
}

// =====================================================================
// COMPONENT CON: ẢNH MANGA HỖ TRỢ DỊCH THUẬT BẰNG GEMINI VISION
// =====================================================================
function TranslateableImage({ 
  imgUrl, 
  targetLang, 
  mode 
}: { 
  imgUrl: string; 
  targetLang: string;
  mode: "vertical" | "horizontal" 
}) {
  const [blocks, setBlocks] = useState<TextBlock[]>([]);
  const [isTranslating, setIsTranslating] = useState(false);
  
  // ➕ THÊM STATE ĐỂ QUẢN LÝ ẨN/HIỆN
  const [showTranslation, setShowTranslation] = useState(true);

  const handleTranslate = async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    // Nếu đã có bản dịch rồi thì chỉ cần bật/tắt, KHÔNG gọi API nữa
    if (blocks.length > 0) {
      setShowTranslation(!showTranslation);
      return;
    }

    setIsTranslating(true);
    const absoluteImageUrl = imgUrl.startsWith("http") 
      ? imgUrl 
      : `${window.location.origin}${imgUrl}`;

    try {
      const res = await fetch("http://localhost:5000/api/manga/translate-page", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl: absoluteImageUrl, targetLang })
      });
      
      if (res.ok) {
        const data = await res.json();
        if (data.blocks.length === 0) {
           alert("AI không tìm thấy chữ nào hợp lệ trên trang này!");
        }
        setBlocks(data.blocks);
        setShowTranslation(true); // Mặc định hiện khi dịch xong
      }
    } catch (error) {
      console.error("Lỗi dịch trang:", error);
    } finally {
      setIsTranslating(false);
    }
  };

  const wrapperClass = mode === "vertical" 
    ? "relative w-full mb-4" 
    : "relative h-full inline-block z-0"; 

  const imgClass = mode === "vertical"
    ? "w-full h-auto block object-contain"
    : "h-full w-auto block object-contain transition-opacity duration-300";

  return (
    <div className={wrapperClass}>
      <img src={imgUrl} alt="Manga Page" className={imgClass} />
      
      {/* ➕ LOGIC HIỂN THỊ NÚT THÔNG MINH */}
      <button 
        onClick={handleTranslate} 
        disabled={isTranslating}
        className={`absolute top-4 right-4 text-white px-3 py-1.5 text-xs md:text-sm font-bold rounded shadow-lg z-20 backdrop-blur-sm transition disabled:opacity-50
          ${blocks.length > 0 ? "bg-gray-800/90 hover:bg-gray-700" : "bg-blue-600/90 hover:bg-blue-500"}
        `}
      >
        {isTranslating ? "✨ Đang quét..." : 
         blocks.length > 0 ? (showTranslation ? "👁️ Hide translation" : "👁️ Show translation") : 
         "✨ Translate with AI"}
      </button>

      {/* ➕ CHỈ RENDER BẢN DỊCH KHI SHOWTRANSLATION = TRUE */}
     {showTranslation && blocks.map((block, index) => (
        <div 
          key={index}
          // Xóa class 'p-2' ở đây để kiểm soát padding trực tiếp trong style cho linh hoạt hơn
          className="absolute bg-white text-black flex items-center justify-center text-center z-10 overflow-hidden"
          style={{
            top: `${block.topPercent}%`,
            left: `${block.leftPercent}%`,
            width: `${block.widthPercent}%`,
            height: `${block.heightPercent}%`,
            borderRadius: '12px', 
            transform: 'scale(1.15)', 
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.3)', 
            
            padding: '4px', 
            fontSize: 'clamp(0.4rem, 1vw, 0.85rem)', 
            lineHeight: '1.35', 
            fontWeight: '500', 
            fontFamily: "'Segoe UI', Roboto, Helvetica, Arial, sans-serif", 
            wordBreak: 'break-word' 
          }}
        >
          {block.translatedText}
        </div>
      ))}
    </div>
  );
}
// =====================================================================


export default function MangaReaderPage({ params }: { params: Promise<{ id: string; chapterId: string }> }) {
  const resolvedParams = use(params);
  const mangaId = resolvedParams.id;
  const chapterId = resolvedParams.chapterId;

  const [chapter, setChapter] = useState<ChapterData | null>(null);
  const [loading, setLoading] = useState(true);

  const [viewMode, setViewMode] = useState<"vertical" | "horizontal">("vertical");
  const [currentPage, setCurrentPage] = useState(0);
  
  // STATE: Quản lý ngôn ngữ Dịch (AI Lang)
  const [targetLang, setTargetLang] = useState("Vietnamese");

  useEffect(() => {
    const fetchChapter = async () => {
      try {
        const res = await fetch(`http://localhost:5000/api/chapter/${chapterId}`);
        if (res.ok) {
          const data = await res.json();
          setChapter(data);
        }
      } catch (error) {
        console.error("Lỗi tải chương:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchChapter();
  }, [chapterId]);

  const { data: session } = useSession();

  useEffect(() => {
    const recordHistory = async () => {
      if (session?.user?.id && mangaId && chapterId) {
        try {
          await fetch("http://localhost:5000/api/history/manga", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId: session.user.id, mangaId, chapterId })
          });
        } catch (error) {
          console.error("Lỗi ghi nhận lịch sử", error);
        }
      }
    };
    recordHistory();
  }, [session?.user?.id, mangaId, chapterId]);

  const handleNextPage = () => {
    if (chapter && currentPage < chapter.images.length) {
      setCurrentPage((prev) => prev + 1);
    }
  };

  const handlePrevPage = () => {
    if (currentPage > 0) {
      setCurrentPage((prev) => prev - 1);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (viewMode !== "horizontal") return;
      if (e.key === "ArrowRight") handleNextPage();
      if (e.key === "ArrowLeft") handlePrevPage();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [viewMode, currentPage, chapter]);

  if (loading) return <div className="min-h-screen bg-gray-900 text-white flex justify-center items-center">Loading content...</div>;
  if (!chapter) return <div className="min-h-screen bg-gray-900 text-white flex justify-center items-center">Chapter not found!</div>;

  return (
    <div className="min-h-screen bg-[#0f0f11] text-white">
      
      {/* THANH ĐIỀU HƯỚNG BÊN TRÊN (STICKY NAVBAR) */}
      <div className="sticky top-0 z-50 bg-gray-900/95 backdrop-blur-md border-b border-gray-800 p-4 shadow-lg flex flex-wrap md:flex-nowrap justify-between items-center gap-4">
        
        {/* Nút quay lại & Tiêu đề */}
        <div className="flex items-center gap-4">
          <Link href={`/manga/${mangaId}`} className="text-gray-400 hover:text-white bg-gray-800 px-3 py-1.5 rounded-lg transition shrink-0">
            &larr; Back to Series
          </Link>
          <div>
            <h1 className="font-bold text-blue-400 truncate max-w-[150px] md:max-w-[200px]">{chapter.manga.title}</h1>
            <h2 className="text-sm text-gray-400">{chapter.title}</h2>
          </div>
        </div>

        <div className="flex items-center gap-4 overflow-x-auto w-full md:w-auto pb-2 md:pb-0 hide-scrollbar">
          
          {/* Menu Chọn ngôn ngữ dịch AI */}
          <div className="flex items-center gap-2 bg-gray-800 p-1 rounded-lg shrink-0 border border-gray-700">
            <span className="text-xs font-bold text-gray-400 pl-2">Dịch ra:</span>
            <select 
              value={targetLang}
              onChange={(e) => setTargetLang(e.target.value)}
              className="bg-gray-900 text-white text-sm px-2 py-1 rounded outline-none border border-gray-600 cursor-pointer"
            >
              {SUPPORTED_LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.code}>{lang.label}</option>
              ))}
            </select>
          </div>

          {/* Cụm nút Đổi chế độ đọc */}
          <div className="flex items-center gap-2 bg-gray-800 p-1 rounded-lg shrink-0">
            <button
              onClick={() => setViewMode("vertical")}
              className={`px-3 py-1.5 rounded-md text-sm font-bold transition ${viewMode === "vertical" ? "bg-blue-600 text-white shadow-md" : "text-gray-400 hover:text-white"}`}
            >
              ↓ Vertical
            </button>
            <button
              onClick={() => setViewMode("horizontal")}
              className={`px-3 py-1.5 rounded-md text-sm font-bold transition ${viewMode === "horizontal" ? "bg-blue-600 text-white shadow-md" : "text-gray-400 hover:text-white"}`}
            >
              ↔ Horizontal
            </button>
          </div>
        </div>
      </div>

      {/* KHU VỰC HIỂN THỊ NỘI DUNG TRUYỆN */}
      <div className="w-full flex justify-center">
        
        {/* CHẾ ĐỘ 1: CUỘN DỌC TRUYỀN THỐNG */}
        {viewMode === "vertical" && (
          <div className="flex flex-col items-center w-full max-w-3xl px-2 md:px-0 pt-4">
            {chapter.images.map((imgUrl, index) => (
              <TranslateableImage 
                key={index} 
                imgUrl={imgUrl} 
                targetLang={targetLang} 
                mode="vertical" 
              />
            ))}
            
            {/* Thanh điều hướng ở cuối chương dọc */}
            <div className="my-12 w-full px-4 flex flex-col md:flex-row justify-between items-center gap-4 bg-gray-900 p-6 rounded-2xl border border-gray-800">
              <p className="text-gray-400 font-medium md:hidden mb-2">No more chapters</p>
              
              {chapter.prevChapterId ? (
                <Link href={`/manga/${mangaId}/chapter/${chapter.prevChapterId}`} className="w-full md:w-auto text-center bg-gray-800 hover:bg-gray-700 text-white px-8 py-3 rounded-xl font-bold transition">
                  &larr; Previous Chapter
                </Link>
              ) : (
                <div className="w-full md:w-auto text-center bg-gray-800/30 text-gray-600 px-8 py-3 rounded-xl font-bold cursor-not-allowed">First Chapter</div>
              )}

              <Link href={`/manga/${mangaId}`} className="w-full md:w-auto text-center text-blue-400 hover:text-blue-300 font-bold px-6 py-3 transition hover:bg-gray-800 rounded-xl">
                ≡ All Chapters
              </Link>

              {chapter.nextChapterId ? (
                <Link href={`/manga/${mangaId}/chapter/${chapter.nextChapterId}`} className="w-full md:w-auto text-center bg-blue-600 hover:bg-blue-500 text-white px-8 py-3 rounded-xl font-bold transition shadow-lg shadow-blue-600/20">
                  Next Chapter &rarr;
                </Link>
              ) : (
                <div className="w-full md:w-auto text-center bg-gray-800/30 text-gray-600 px-8 py-3 rounded-xl font-bold cursor-not-allowed">Updating...</div>
              )}
            </div>
          </div>
        )}

        {/* CHẾ ĐỘ 2: LƯỚT NGANG TỪNG TRANG */}
        {viewMode === "horizontal" && (
          <div className="relative w-full h-[calc(100vh-80px)] flex flex-col justify-center items-center bg-black select-none overflow-hidden py-4">
            
            <div className="absolute top-4 right-4 bg-black/60 px-3 py-1 rounded-full text-xs text-gray-300 z-30">
              Trang {currentPage < chapter.images.length ? currentPage + 1 : chapter.images.length} / {chapter.images.length}
            </div>

            {/* Vùng bấm ẩn chuyển trang */}
            <div className="absolute top-0 left-0 w-1/4 h-full z-10 cursor-w-resize" onClick={handlePrevPage} title="Trang trước" />
            <div className="absolute top-0 right-0 w-1/4 h-full z-10 cursor-e-resize" onClick={handleNextPage} title="Trang tiếp theo" />

            {/* HIỂN THỊ ẢNH HOẶC MENU KẾT THÚC */}
            {currentPage < chapter.images.length ? (
              <TranslateableImage 
                imgUrl={chapter.images[currentPage]} 
                targetLang={targetLang} 
                mode="horizontal" 
              />
            ) : (
              <div className="bg-gray-900/95 backdrop-blur-md p-8 rounded-2xl border border-gray-700 text-center z-30 shadow-2xl w-[90%] max-w-md relative">
                 <h3 className="text-xl font-bold text-white mb-2">The chapter has ended.</h3>
                 <p className="mb-6 text-gray-400 text-sm">You want to do next?</p>
                 
                 <div className="flex flex-col gap-3">
                   {chapter.nextChapterId ? (
                     <Link href={`/manga/${mangaId}/chapter/${chapter.nextChapterId}`} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-3 rounded-xl font-bold transition w-full shadow-lg z-50 relative pointer-events-auto">
                       Read next Chapter &rarr;
                     </Link>
                   ) : (
                     <div className="bg-gray-800 text-gray-500 px-4 py-3 rounded-xl font-bold cursor-not-allowed w-full border border-gray-700">
                       Waiting for new Chapter...
                     </div>
                   )}
                   <Link href={`/manga/${mangaId}`} className="bg-gray-800 hover:bg-gray-700 text-gray-300 px-4 py-3 rounded-xl font-bold transition w-full z-50 relative pointer-events-auto">
                     ≡ All Chapters
                   </Link>
                 </div>
              </div>
            )}

            {/* Thanh điều hướng */}
            <div className="absolute bottom-6 flex gap-4 z-30 pointer-events-auto">
              <button 
                onClick={handlePrevPage}
                disabled={currentPage === 0}
                className="bg-gray-800/80 backdrop-blur hover:bg-gray-700 disabled:opacity-50 text-white w-12 h-12 rounded-full flex justify-center items-center font-bold text-xl shadow-lg border border-gray-600 transition"
              >
                &larr;
              </button>
              <button 
                onClick={handleNextPage}
                disabled={currentPage === chapter.images.length}
                className="bg-gray-800/80 backdrop-blur hover:bg-gray-700 disabled:opacity-50 text-white w-12 h-12 rounded-full flex justify-center items-center font-bold text-xl shadow-lg border border-gray-600 transition"
              >
                &rarr;
              </button>
            </div>
          </div>
        )}
      </div>

      {/* KHU VỰC BÌNH LUẬN */}
      <div className="w-full flex justify-center mt-12 pb-20">
        <div className="w-full max-w-4xl px-4">
           <CommentSection targetType="chapter" targetId={chapterId} />
        </div>
      </div>
    </div> 
  );
}