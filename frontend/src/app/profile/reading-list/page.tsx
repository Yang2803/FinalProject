"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";

interface Manga {
  id: string;
  title: string;
  coverImage: string;
  status: string;
}

export default function ReadingListPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  
  const [mangas, setMangas] = useState<Manga[]>([]);
  const [loading, setLoading] = useState(true);

  // 1. Bảo vệ trang: Chuyển hướng nếu chưa đăng nhập
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  // 2. Gọi API lấy dữ liệu Reading List
  useEffect(() => {
    const fetchReadingList = async () => {
      if (!session?.user?.id) return;
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/reading-list/${session.user.id}`);
        if (res.ok) {
          const data = await res.json();
          setMangas(data);
        }
      } catch (error) {
        console.error("Lỗi tải danh sách đọc:", error);
      } finally {
        setLoading(false);
      }
    };

    if (session?.user?.id) {
      fetchReadingList();
    }
  }, [session?.user?.id]);

  // 3. Hàm xử lý: Xóa nhanh truyện khỏi danh sách
  const handleRemove = async (mangaId: string, e: React.MouseEvent) => {
    e.preventDefault(); // Quan trọng: Chặn sự kiện click thẻ <Link> lan tỏa
    const confirmDelete = confirm("Are you sure you want to remove this manga from reading list?");
    if (!confirmDelete) return;

    try {
      // Tận dụng luôn API Toggle đã viết từ trước để xóa
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/reading-list/toggle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: session?.user?.id, mangaId })
      });

      if (res.ok) {
        // Xóa truyện khỏi giao diện ngay lập tức mà không cần F5
        setMangas(mangas.filter(manga => manga.id !== mangaId));
      }
    } catch (error) {
      alert("Error deleting from list!");
    }
  };

  if (status === "loading" || loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-900">
        <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!session?.user) return null;

  return (
  <div className="min-h-screen bg-[#0f0f13] text-white p-4 md:p-8">
    <div className="max-w-7xl mx-auto">
      
      {/* 🌟 HEADER: Thêm hiệu ứng viền gradient, đếm số lượng truyện và nút Back dạng icon tròn hiện đại */}
      <div className="flex items-center justify-between mb-10 pb-6 border-b border-gray-800/60 relative">
        <div className="absolute bottom-0 left-0 w-32 h-px bg-gradient-to-r from-blue-500 to-purple-500"></div>
        <div className="flex items-center gap-5">
          <Link 
            href="/profile" 
            className="group flex items-center justify-center w-10 h-10 bg-gray-800/50 hover:bg-gray-700 rounded-full transition-all border border-gray-700 hover:border-gray-500 text-gray-400 hover:text-white shadow-sm"
          >
            <svg className="w-5 h-5 group-hover:-translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </Link>
          <h1 className="text-3xl md:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500 tracking-tight">
            My Reading List
          </h1>
        </div>
        <div className="text-sm font-bold text-gray-400 bg-gray-800/40 px-4 py-1.5 rounded-full border border-gray-700/50 shadow-inner">
          {mangas.length} {mangas.length <= 1 ? 'Title' : 'Titles'}
        </div>
      </div>

      {/* 🌟 KHU VỰC DANH SÁCH */}
      {mangas.length === 0 ? (
        /* 🌟 EMPTY STATE: Thiết kế lại thành một khối Glassmorphism với hiệu ứng glow phát sáng nhẹ ở nền */
        <div className="relative overflow-hidden bg-gradient-to-b from-gray-800/40 to-[#0f0f13] rounded-3xl p-12 md:p-16 text-center border border-gray-800 shadow-2xl flex flex-col items-center justify-center min-h-[40vh]">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-500/10 blur-[100px] rounded-full pointer-events-none"></div>
          
          <div className="relative z-10 flex flex-col items-center">
            <span className="text-6xl mb-6 drop-shadow-2xl hover:scale-110 transition-transform duration-300">📚</span>
            <h2 className="text-2xl md:text-3xl font-bold text-gray-200 mb-3 tracking-wide">Your list is empty</h2>
            <p className="text-gray-400 mb-8 max-w-md mx-auto text-sm md:text-base leading-relaxed">
              You have added any manga to your reading list yet. Explore our collection and find your next favorite story!
            </p>
            
            {/* Nút bấm gradient với hiệu ứng viền chạy */}
            <Link href="/manga" className="relative group overflow-hidden rounded-xl p-[1px]">
              <span className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl opacity-70 group-hover:opacity-100 transition-opacity duration-300"></span>
              <div className="relative bg-gray-900 px-8 py-3.5 rounded-xl transition-all duration-300 group-hover:bg-opacity-0">
                <span className="font-bold text-gray-200 group-hover:text-white transition-colors tracking-wide">
                  Discover Manga &rarr;
                </span>
              </div>
            </Link>
          </div>
        </div>
      ) : (
        /* 🌟 GRID TRUYỆN: Chỉnh lại tỷ lệ grid để responsive đẹp hơn */
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-6">
          {mangas.map((manga) => (
            /* 🌟 Tách button ra khỏi thẻ Link để tránh lỗi HTML lồng nhau và click nhầm */
            <div key={manga.id} className="group relative block rounded-2xl overflow-hidden bg-[#1a1a24] border border-gray-800/80 hover:border-gray-600 transition-all duration-500 hover:-translate-y-2 shadow-lg hover:shadow-blue-500/20">
              
              <Link href={`/manga/${manga.id}`} className="block h-full cursor-pointer">
                <div className="relative aspect-[2/3] w-full overflow-hidden bg-gray-900">
                  {manga.coverImage ? (
                    <img 
                      src={manga.coverImage} 
                      alt={manga.title} 
                      className="w-full h-full object-cover opacity-90 group-hover:opacity-100 group-hover:scale-110 transition-all duration-700 ease-out" 
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-gray-600">
                      <svg className="w-10 h-10 mb-2 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                      <span className="text-xs font-medium tracking-widest uppercase">No Cover</span>
                    </div>
                  )}
                  
                  {/* Lớp gradient bóng mờ từ dưới lên để chữ và nhãn nổi bật hơn */}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#1a1a24] via-[#1a1a24]/20 to-transparent opacity-90"></div>
                  
                  {/* Nhãn trạng thái (Đưa xuống góc trái dưới cùng với icon trạng thái) */}
                  <div className="absolute bottom-3 left-3 z-10 flex items-center gap-1.5 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-md border border-gray-700/50">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse shadow-[0_0_5px_#4ade80]"></span>
                    <span className="text-[10px] font-bold text-gray-200 uppercase tracking-wider">{manga.status}</span>
                  </div>
                </div>
                
                <div className="p-4 pt-2">
                  <h3 className="font-bold text-sm text-gray-200 line-clamp-2 group-hover:text-blue-400 transition-colors duration-300 leading-snug">
                    {manga.title}
                  </h3>
                </div>
              </Link>

              {/* 🌟 NÚT XÓA CHUYÊN NGHIỆP: Nằm góc trên phải, hiệu ứng trượt mượt mà, dùng SVG icon thay vì chữ X */}
              <button 
                onClick={(e) => {
                  e.preventDefault(); // Ngăn sự kiện click lan xuống thẻ Link ở trên
                  handleRemove(manga.id, e);
                }}
                className="absolute top-3 right-3 z-20 bg-red-500/80 backdrop-blur-md hover:bg-red-500 text-white w-8 h-8 rounded-full flex justify-center items-center opacity-0 translate-y-2 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300 shadow-lg border border-red-400/30 hover:scale-110 focus:outline-none"
                title="Remove from reading list"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>

            </div>
          ))}
        </div>
      )}
    </div>
  </div>
);}