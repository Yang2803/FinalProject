"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import CommentSection from "@/components/CommentSection";

// 1. Đã cập nhật Interface để nhận thêm ID của chương trước và sau
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

export default function MangaReaderPage({ params }: { params: Promise<{ id: string; chapterId: string }> }) {
  const resolvedParams = use(params);
  const mangaId = resolvedParams.id;
  const chapterId = resolvedParams.chapterId;

  const [chapter, setChapter] = useState<ChapterData | null>(null);
  const [loading, setLoading] = useState(true);

  // STATE ĐIỀU KHIỂN CHẾ ĐỘ ĐỌC
  const [viewMode, setViewMode] = useState<"vertical" | "horizontal">("vertical");
  const [currentPage, setCurrentPage] = useState(0);

  // GỌI API LẤY NỘI DUNG CHƯƠNG
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

  // Ghi nhận Lịch sử đọc ngầm
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

  // HÀM XỬ LÝ CHUYỂN TRANG (Cho chế độ lướt ngang)
  const handleNextPage = () => {
    if (chapter && currentPage < chapter.images.length - 1) {
      setCurrentPage((prev) => prev + 1);
    }
  };

  const handlePrevPage = () => {
    if (currentPage > 0) {
      setCurrentPage((prev) => prev - 1);
    }
  };

  // TÍCH HỢP BÀN PHÍM (ArrowRight / ArrowLeft)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (viewMode !== "horizontal") return;
      if (e.key === "ArrowRight") handleNextPage();
      if (e.key === "ArrowLeft") handlePrevPage();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [viewMode, currentPage, chapter]);

  if (loading) return <div className="min-h-screen bg-gray-900 text-white flex justify-center items-center">Đang tải nội dung...</div>;
  if (!chapter) return <div className="min-h-screen bg-gray-900 text-white flex justify-center items-center">Chương không tồn tại!</div>;

  return (
    <div className="min-h-screen bg-[#0f0f11] text-white">
      
      {/* THANH ĐIỀU HƯỚNG BÊN TRÊN (STICKY NAVBAR) */}
      <div className="sticky top-0 z-50 bg-gray-900/90 backdrop-blur-md border-b border-gray-800 p-4 shadow-lg flex flex-col md:flex-row justify-between items-center gap-4">
        
        {/* Nút quay lại & Tiêu đề */}
        <div className="flex items-center gap-4">
          <Link href={`/manga/${mangaId}`} className="text-gray-400 hover:text-white bg-gray-800 px-3 py-1.5 rounded-lg transition shrink-0">
            &larr; Quay lại
          </Link>
          <div>
            <h1 className="font-bold text-blue-400 truncate max-w-[150px] md:max-w-[300px]">{chapter.manga.title}</h1>
            <h2 className="text-sm text-gray-400">{chapter.title}</h2>
          </div>
        </div>

        {/* CỤM NÚT ĐIỀU HƯỚNG CHƯƠNG MỚI ĐƯỢC THÊM VÀO */}
        <div className="flex items-center gap-2">
          {chapter.prevChapterId ? (
            <Link href={`/manga/${mangaId}/chapter/${chapter.prevChapterId}`} className="bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-1.5 rounded-lg text-sm font-bold transition">
              &larr; Chap trước
            </Link>
          ) : (
            <span className="bg-gray-800/50 text-gray-600 px-3 py-1.5 rounded-lg text-sm font-bold cursor-not-allowed">
              &larr; Chap trước
            </span>
          )}

          {chapter.nextChapterId ? (
            <Link href={`/manga/${mangaId}/chapter/${chapter.nextChapterId}`} className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg text-sm font-bold transition">
              Chap sau &rarr;
            </Link>
          ) : (
            <span className="bg-gray-800/50 text-gray-600 px-3 py-1.5 rounded-lg text-sm font-bold cursor-not-allowed">
              Chap sau &rarr;
            </span>
          )}
        </div>

        {/* Cụm nút Đổi chế độ đọc */}
        <div className="flex items-center gap-2 bg-gray-800 p-1 rounded-lg shrink-0">
          <button
            onClick={() => setViewMode("vertical")}
            className={`px-4 py-1.5 rounded-md text-sm font-bold transition ${viewMode === "vertical" ? "bg-blue-600 text-white shadow-md" : "text-gray-400 hover:text-white"}`}
          >
            Cuộn dọc ↓
          </button>
          <button
            onClick={() => setViewMode("horizontal")}
            className={`px-4 py-1.5 rounded-md text-sm font-bold transition ${viewMode === "horizontal" ? "bg-blue-600 text-white shadow-md" : "text-gray-400 hover:text-white"}`}
          >
            Lướt ngang ↔
          </button>
        </div>
      </div>

      {/* KHU VỰC HIỂN THỊ NỘI DUNG TRUYỆN */}
      <div className="w-full flex justify-center">
        
        {/* CHẾ ĐỘ 1: CUỘN DỌC TRUYỀN THỐNG */}
        {viewMode === "vertical" && (
          <div className="flex flex-col items-center w-full max-w-3xl">
            {chapter.images.map((imgUrl, index) => (
              <img 
                key={index} 
                src={imgUrl} 
                alt={`Page ${index + 1}`} 
                className="w-full object-contain block" 
              />
            ))}
            
            {/* Thanh điều hướng ở cuối chương dọc */}
            <div className="my-12 w-full px-4 flex flex-col md:flex-row justify-between items-center gap-4 bg-gray-900 p-6 rounded-2xl border border-gray-800">
              <p className="text-gray-400 font-medium md:hidden mb-2">Đã hết chương</p>
              
              {chapter.prevChapterId ? (
                <Link href={`/manga/${mangaId}/chapter/${chapter.prevChapterId}`} className="w-full md:w-auto text-center bg-gray-800 hover:bg-gray-700 text-white px-8 py-3 rounded-xl font-bold transition">
                  &larr; Chương Trước
                </Link>
              ) : (
                <div className="w-full md:w-auto text-center bg-gray-800/30 text-gray-600 px-8 py-3 rounded-xl font-bold cursor-not-allowed">Chương Đầu Tiên</div>
              )}

              <Link href={`/manga/${mangaId}`} className="w-full md:w-auto text-center text-blue-400 hover:text-blue-300 font-bold px-6 py-3 transition hover:bg-gray-800 rounded-xl">
                ≡ Mục Lục
              </Link>

              {chapter.nextChapterId ? (
                <Link href={`/manga/${mangaId}/chapter/${chapter.nextChapterId}`} className="w-full md:w-auto text-center bg-blue-600 hover:bg-blue-500 text-white px-8 py-3 rounded-xl font-bold transition shadow-lg shadow-blue-600/20">
                  Chương Tiếp Theo &rarr;
                </Link>
              ) : (
                <div className="w-full md:w-auto text-center bg-gray-800/30 text-gray-600 px-8 py-3 rounded-xl font-bold cursor-not-allowed">Đang Cập Nhật...</div>
              )}
            </div>
          </div>
        )}

        {/* CHẾ ĐỘ 2: LƯỚT NGANG TỪNG TRANG */}
        {viewMode === "horizontal" && (
          <div className="relative w-full max-w-4xl h-[calc(100vh-80px)] flex flex-col justify-center items-center bg-black select-none">
            
            <div className="absolute top-4 right-4 bg-black/60 px-3 py-1 rounded-full text-xs text-gray-300 z-20">
              Trang {currentPage + 1} / {chapter.images.length}
            </div>

            <div className="absolute top-0 left-0 w-1/3 h-full z-10 cursor-w-resize" onClick={handlePrevPage} title="Trang trước" />
            <div className="absolute top-0 right-0 w-1/3 h-full z-10 cursor-e-resize" onClick={handleNextPage} title="Trang tiếp theo" />

            <img 
              src={chapter.images[currentPage]} 
              alt={`Page ${currentPage + 1}`} 
              className="max-w-full max-h-full object-contain relative z-0 transition-opacity duration-300" 
            />

            <div className="absolute bottom-6 flex gap-4 z-20 pointer-events-auto">
              <button 
                onClick={handlePrevPage}
                disabled={currentPage === 0}
                className="bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-white w-12 h-12 rounded-full flex justify-center items-center font-bold text-xl shadow-lg border border-gray-600 transition"
              >
                &larr;
              </button>
              <button 
                onClick={handleNextPage}
                disabled={currentPage === chapter.images.length - 1}
                className="bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-white w-12 h-12 rounded-full flex justify-center items-center font-bold text-xl shadow-lg border border-gray-600 transition"
              >
                &rarr;
              </button>
            </div>

            {/* Popup hiện ra khi lướt tới trang cuối cùng */}
            {currentPage === chapter.images.length - 1 && (
               <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-gray-900/95 backdrop-blur-md p-8 rounded-2xl border border-gray-700 text-center z-30 shadow-2xl w-[90%] max-w-md">
                  <h3 className="text-xl font-bold text-white mb-2">Đã hết chương</h3>
                  <p className="mb-6 text-gray-400 text-sm">Bạn muốn làm gì tiếp theo?</p>
                  
                  <div className="flex flex-col gap-3">
                    {chapter.nextChapterId ? (
                      <Link href={`/manga/${mangaId}/chapter/${chapter.nextChapterId}`} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-3 rounded-xl font-bold transition w-full shadow-lg shadow-blue-600/20">
                        Đọc Chương Kế Tiếp &rarr;
                      </Link>
                    ) : (
                      <div className="bg-gray-800 text-gray-500 px-4 py-3 rounded-xl font-bold cursor-not-allowed w-full border border-gray-700">
                        Đang chờ chương mới...
                      </div>
                    )}
                    <Link href={`/manga/${mangaId}`} className="bg-gray-800 hover:bg-gray-700 text-gray-300 px-4 py-3 rounded-xl font-bold transition w-full">
                      ≡ Trở Về Mục Lục
                    </Link>
                  </div>
               </div>
            )}
          </div>
        )}
      </div>

      {/* KHU VỰC BÌNH LUẬN CỦA CHƯƠNG */}
      <div className="w-full flex justify-center mt-12 pb-20">
        <div className="w-full max-w-4xl px-4">
           <CommentSection targetType="chapter" targetId={chapterId} />
        </div>
      </div>

    </div> 
  );
}