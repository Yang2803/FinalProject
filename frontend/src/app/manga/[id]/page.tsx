"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import CommentSection from "@/components/CommentSection"; // Đường dẫn tuỳ vào cấu hình của bạn, hoặc dùng "../../../components/CommentSection"

// Cấu trúc Type (Giống bên Admin)
interface Chapter {
  id: string;
  title: string;
  createdAt: string;
}

interface MangaData {
  id: string;
  title: string;
  author: string;
  coverImage: string;
  status: string;
  description: string;
  chapters: Chapter[];
}

export default function PublicMangaDetails({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const mangaId = resolvedParams.id;
  
  const [manga, setManga] = useState<MangaData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchManga = async () => {
      try {
        const res = await fetch(`http://localhost:5000/api/manga/${mangaId}`);
        if (res.ok) {
          const data = await res.json();
          setManga(data);
        }
      } catch (error) {
        console.error("Lỗi:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchManga();
  }, [mangaId]);

  const { data: session } = useSession();
  
  // Các state quản lý Rating
  const [userRating, setUserRating] = useState<number>(0);
  const [avgRating, setAvgRating] = useState<number>(0);
  const [ratingCount, setRatingCount] = useState<number>(0);

  // State quản lý Reading List
  const [isInReadingList, setIsInReadingList] = useState<boolean>(false);
  const [isToggling, setIsToggling] = useState<boolean>(false);

  // Gọi hàm lấy Rating ngay khi vào trang hoặc khi session thay đổi
  useEffect(() => {
    const fetchRatingInfo = async () => {
      try {
        // Truyền kèm userId nếu người dùng đã đăng nhập
        const userIdQuery = session?.user?.id ? `?userId=${session.user.id}` : "";
        const res = await fetch(`http://localhost:5000/api/rating/${mangaId}${userIdQuery}`);
        
        if (res.ok) {
          const data = await res.json();
          setAvgRating(data.average);
          setRatingCount(data.count);
          if (data.userScore > 0) {
            setUserRating(data.userScore); // Phục hồi các ngôi sao vàng!
          }
        }
      } catch (error) {
        console.error("Lỗi tải rating:", error);
      }
    };

    const checkReadingListStatus = async () => {
      if (!session?.user?.id) return;
      try {
        const res = await fetch(`http://localhost:5000/api/reading-list/status?userId=${session.user.id}&mangaId=${mangaId}`);
        if (res.ok) {
          const data = await res.json();
          setIsInReadingList(data.isInList);
        }
      } catch (error) {
        console.error("Lỗi kiểm tra trạng thái danh sách đọc:", error);
      }
    };
    
    if (session?.user?.id) {
      checkReadingListStatus();
    }
    fetchRatingInfo();
  }, [mangaId, session?.user?.id]); // Phụ thuộc vào ID user để tự động tải lại nếu họ đăng nhập/đăng xuất

  // Hàm xử lý khi user click vào Ngôi sao
  const handleRate = async (score: number) => {
    if (!session) return alert("Vui lòng đăng nhập để đánh giá!");
    setUserRating(score); // Đổi màu sao ngay lập tức cho mượt
    
    const res = await fetch("http://localhost:5000/api/rating", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: session.user.id, mangaId, score })
    });

    // Nếu gửi đánh giá thành công, tải lại thống kê để cập nhật điểm trung bình mới
    if (res.ok) {
      const updatedRes = await fetch(`http://localhost:5000/api/rating/${mangaId}?userId=${session.user.id}`);
      if (updatedRes.ok) {
        const data = await updatedRes.json();
        setAvgRating(data.average);
        setRatingCount(data.count);
      }
    }
  };

  // Hàm xử lý khi user click vào nút Thêm/Xóa khỏi danh sách đọc
  const handleToggleReadingList = async () => {
    if (!session) {
      return alert("Vui lòng đăng nhập để sử dụng tính năng này!");
    }

    setIsToggling(true);
    try {
      const res = await fetch("http://localhost:5000/api/reading-list/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: session.user.id,
          mangaId: mangaId
        })
      });

      if (res.ok) {
        const data = await res.json();
        setIsInReadingList(data.isInList); // Cập nhật lại giao diện dựa theo kết quả trả về
      }
    } catch (error) {
      alert("Lỗi kết nối khi cập nhật danh sách đọc!");
    } finally {
      setIsToggling(false);
    }
  };

  if (loading) return <div className="min-h-screen bg-gray-900 text-white flex justify-center items-center">Loading...</div>;
  if (!manga) return <div className="min-h-screen bg-gray-900 text-white flex justify-center items-center">Manga not found!</div>;

  return (
    <div className="min-h-screen bg-gray-900 text-white py-10 px-4">
      <div className="max-w-5xl mx-auto">
        
        {/* Breadcrumb quay lại */}
        <Link href="/manga" className="text-gray-400 hover:text-white mb-6 inline-block">&larr; Return to manga list</Link>

        {/* KHU VỰC THÔNG TIN TRUYỆN */}
        <div className="bg-gray-800 rounded-xl p-6 md:p-8 flex flex-col md:flex-row gap-8 shadow-2xl mb-10">
          {/* Ảnh bìa */}
          <div className="w-full md:w-1/3 lg:w-1/4 shrink-0">
            <div className="aspect-[2/3] rounded-lg overflow-hidden shadow-lg border border-gray-700 bg-gray-700">
              {manga.coverImage && <img src={manga.coverImage} alt={manga.title} className="w-full h-full object-cover" />}
            </div>
          </div>

          {/* Chi tiết */}
          <div className="flex-1 flex flex-col">
            <h1 className="text-3xl md:text-4xl font-black mb-2 text-blue-400">{manga.title}</h1>
            <p className="text-gray-400 mb-4 font-medium">Author: <span className="text-white">{manga.author || "Updating..."}</span></p>
            {/* Hệ thống Rating 5 sao có Thống kê */}
            <div className="flex flex-col gap-2 mb-6 bg-gray-900/40 p-4 rounded-xl border border-gray-700/50 w-fit">
              
              {/* Phần hiển thị điểm trung bình */}
              <div className="flex items-end gap-2">
                <span className="text-3xl font-black text-yellow-400 leading-none">{avgRating > 0 ? avgRating : "-"}</span>
                <span className="text-gray-400 text-sm font-medium pb-1">
                  / 5 <span className="text-gray-500 text-xs ml-1">({ratingCount} Ratings)</span>
                </span>
              </div>

              {/* Phần cho user bấm sao */}
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
                {manga.status}
              </span>
              <span className="px-3 py-1 bg-gray-700 text-gray-300 text-xs font-bold rounded-full">
                {manga.chapters.length} Chapters
              </span>
            </div>

            <div className="bg-gray-900/50 p-4 rounded-lg flex-1">
              <h3 className="font-bold text-gray-300 mb-2">Summary:</h3>
              <p className="text-gray-400 text-sm leading-relaxed whitespace-pre-wrap">
                {manga.description || "No description available for this manga."}
              </p>
            </div>
            
            {/* Cụm nút bấm hành động */}
            {manga.chapters.length > 0 && (
              <div className="mt-6 flex flex-wrap gap-4">
                <Link 
                  href={`/manga/${manga.id}/chapter/${manga.chapters[manga.chapters.length - 1].id}`}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-full shadow-lg shadow-blue-600/30 transition-all inline-block"
                >
                  Read From Beginning
                </Link>

                {/* NÚT THÊM VÀO DANH SÁCH ĐỌC MỚI BỔ SUNG */}
                <button
                  onClick={handleToggleReadingList}
                  disabled={isToggling}
                  className={`font-bold py-3 px-6 rounded-full transition-all flex items-center gap-2 border shadow-lg ${
                    isInReadingList
                      ? "bg-gray-700 border-gray-600 hover:bg-red-900/40 hover:border-red-700 hover:text-red-400 text-gray-300"
                      : "bg-transparent border-blue-500 hover:bg-blue-600/10 text-blue-400"
                  }`}
                >
                  {isToggling ? (
                    <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                  ) : isInReadingList ? (
                    <>✓ Currently Following</>
                  ) : (
                    <>+ Add to Reading List</>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* KHU VỰC DANH SÁCH CHƯƠNG */}
        <div className="bg-gray-800 rounded-xl p-6 md:p-8 shadow-xl">
          <h2 className="text-2xl font-bold mb-6 border-b border-gray-700 pb-4">Chapter List</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {manga.chapters.map((chap) => (
              <Link 
                key={chap.id} 
                href={`/manga/${manga.id}/chapter/${chap.id}`} // Đường dẫn chuẩn bị cho trang Đọc Truyện tiếp theo
                className="flex justify-between items-center bg-gray-900 hover:bg-gray-700 p-4 rounded-lg border border-gray-700 hover:border-blue-500 transition cursor-pointer group"
              >
                <span className="font-semibold text-gray-200 group-hover:text-blue-400">{chap.title}</span>
                <span className="text-xs text-gray-500">{new Date(chap.createdAt).toLocaleDateString("vi-VN")}</span>
              </Link>
            ))}
          </div>

          {manga.chapters.length === 0 && (
            <div className="text-center py-10 text-gray-500">
              Manga has not been updated with any chapters yet. Please check back later!
            </div>
          )}
        </div>

        {/* Gắn Component Comment dành cho MANGA vào đây */}
        <CommentSection targetType="manga" targetId={mangaId} />

      </div>
    </div>
  );
}