"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import CommentSection from "@/components/CommentSection";

interface ChapterData {
  id: string;
  title: string;
  images: string[];
  mangaId: string;
  manga: {
    title: string;
  };
}

export default function MangaReaderPage({ params }: { params: Promise<{ id: string; chapterId: string }> }) {
  const resolvedParams = use(params);
  const mangaId = resolvedParams.id;
  const chapterId = resolvedParams.chapterId;

  const [chapter, setChapter] = useState<ChapterData | null>(null);
  const [loading, setLoading] = useState(true);

  // STATE ĐIỀU KHIỂN CHẾ ĐỘ ĐỌC
  // 'vertical': Cuộn dọc | 'horizontal': Lướt ngang từng trang
  const [viewMode, setViewMode] = useState<"vertical" | "horizontal">("vertical");
  
  // STATE CHỈ MỤC TRANG (Dành riêng cho chế độ Lướt ngang)
  const [currentPage, setCurrentPage] = useState(0);

  // 1. GỌI API LẤY NỘI DUNG CHƯƠNG
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

  // Thêm useEffect này để Ghi nhận Lịch sử đọc ngầm
  useEffect(() => {
    const recordHistory = async () => {
      if (session?.user?.id && mangaId && chapterId) {
        try {
          await fetch("http://localhost:5000/api/history/manga", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              userId: session.user.id,
              mangaId,
              chapterId
            })
          });
        } catch (error) {
          console.error("Lỗi ghi nhận lịch sử", error);
        }
      }
    };

    recordHistory();
  }, [session?.user?.id, mangaId, chapterId]);

  // 2. HÀM XỬ LÝ CHUYỂN TRANG (Cho chế độ lướt ngang)
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

  // 3. TÍCH HỢP BÀN PHÍM (ArrowRight / ArrowLeft) CHO CHẾ ĐỘ LƯỚT NGANG
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
          <Link href={`/manga/${mangaId}`} className="text-gray-400 hover:text-white bg-gray-800 px-3 py-1.5 rounded-lg transition">
            &larr; Quay lại
          </Link>
          <div>
            <h1 className="font-bold text-blue-400 truncate max-w-[200px] md:max-w-[400px]">{chapter.manga.title}</h1>
            <h2 className="text-sm text-gray-400">{chapter.title}</h2>
          </div>
        </div>

        {/* Cụm nút Đổi chế độ đọc */}
        <div className="flex items-center gap-2 bg-gray-800 p-1 rounded-lg">
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

      {/* =========================================
          KHU VỰC HIỂN THỊ NỘI DUNG TRUYỆN
          ========================================= */}
      
      <div className="w-full flex justify-center">
        
        {/* CHẾ ĐỘ 1: CUỘN DỌC TRUYỀN THỐNG */}
        {viewMode === "vertical" && (
          <div className="flex flex-col items-center w-full max-w-3xl">
            {chapter.images.map((imgUrl, index) => (
              <img 
                key={index} 
                src={imgUrl} 
                alt={`Page ${index + 1}`} 
                className="w-full object-contain block" // block giúp xóa khoảng trắng nhỏ giữa các thẻ img
              />
            ))}
            
            {/* Nút báo hiệu hết chương */}
            <div className="my-10 text-center">
              <p className="text-gray-500 mb-4">Bạn đã đọc hết chương này.</p>
              <Link href={`/manga/${mangaId}`} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-full font-bold transition">
                Về lại Trang Truyện
              </Link>
            </div>
          </div>
        )}

        {/* CHẾ ĐỘ 2: LƯỚT NGANG TỪNG TRANG */}
        {viewMode === "horizontal" && (
          <div className="relative w-full max-w-4xl h-[calc(100vh-80px)] flex flex-col justify-center items-center bg-black select-none">
            
            {/* Hiển thị số trang */}
            <div className="absolute top-4 right-4 bg-black/60 px-3 py-1 rounded-full text-xs text-gray-300 z-20">
              Trang {currentPage + 1} / {chapter.images.length}
            </div>

            {/* Vùng bấm phía TRÁI để lùi trang */}
            <div 
              className="absolute top-0 left-0 w-1/3 h-full z-10 cursor-w-resize"
              onClick={handlePrevPage}
              title="Trang trước"
            />
            
            {/* Vùng bấm phía PHẢI để tiến trang */}
            <div 
              className="absolute top-0 right-0 w-1/3 h-full z-10 cursor-e-resize"
              onClick={handleNextPage}
              title="Trang tiếp theo"
            />

            {/* Tấm ảnh đang hiển thị */}
            <img 
              src={chapter.images[currentPage]} 
              alt={`Page ${currentPage + 1}`} 
              className="max-w-full max-h-full object-contain relative z-0 transition-opacity duration-300" 
            />

            {/* Thanh điều hướng nhanh cho mobile */}
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

            {/* Nếu ở trang cuối, hiện nút quay về */}
            {currentPage === chapter.images.length - 1 && (
               <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-black/80 p-6 rounded-xl border border-gray-700 text-center z-30">
                  <p className="mb-4 text-gray-300">Đã hết chương</p>
                  <Link href={`/manga/${mangaId}`} className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold">
                    Về Trang Truyện
                  </Link>
               </div>
            )}
          </div>
        )}

        

      </div>

      {/* ... Phần đọc truyện (Vertical hoặc Horizontal) ... */}

      {/* KHU VỰC BÌNH LUẬN CỦA CHƯƠNG */}
      <div className="w-full flex justify-center mt-12 pb-20">
        <div className="w-full max-w-4xl px-4">
           <CommentSection targetType="chapter" targetId={chapterId} />
        </div>
      </div>

    </div> 
    
  );
}