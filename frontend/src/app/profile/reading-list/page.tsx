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
        const res = await fetch(`http://localhost:5000/api/reading-list/${session.user.id}`);
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
    const confirmDelete = confirm("Bạn có chắc chắn muốn bỏ truyện này khỏi danh sách đọc?");
    if (!confirmDelete) return;

    try {
      // Tận dụng luôn API Toggle đã viết từ trước để xóa
      const res = await fetch("http://localhost:5000/api/reading-list/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: session?.user?.id, mangaId })
      });

      if (res.ok) {
        // Xóa truyện khỏi giao diện ngay lập tức mà không cần F5
        setMangas(mangas.filter(manga => manga.id !== mangaId));
      }
    } catch (error) {
      alert("Lỗi khi xóa khỏi danh sách!");
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
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-6xl mx-auto">
        
        {/* Header với nút quay lại */}
        <div className="flex items-center gap-4 mb-8 border-b border-gray-700 pb-6">
          <Link href="/profile" className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition text-gray-300">
            &larr; Hồ sơ
          </Link>
          <h1 className="text-3xl font-bold text-blue-400">📚 My Reading List</h1>
        </div>

        {/* Khu vực hiển thị danh sách truyện */}
        {mangas.length === 0 ? (
          <div className="bg-gray-800 rounded-xl p-12 text-center shadow-lg border border-gray-700">
            <p className="text-gray-400 mb-4 text-lg">Danh sách đọc của bạn đang trống.</p>
            <Link href="/manga" className="inline-block bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-bold transition">
              Khám phá truyện ngay
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
            {mangas.map((manga) => (
              <Link key={manga.id} href={`/manga/${manga.id}`} className="group relative block">
                <div className="bg-gray-800 rounded-lg overflow-hidden shadow-lg transition-all duration-300 transform group-hover:-translate-y-2 group-hover:shadow-blue-500/30">
                  
                  {/* Nút Xóa nhanh (Chỉ hiện rõ khi rê chuột vào truyện) */}
                  <button 
                    onClick={(e) => handleRemove(manga.id, e)}
                    className="absolute top-2 left-2 z-20 bg-red-600/80 hover:bg-red-600 text-white w-8 h-8 rounded-full flex justify-center items-center font-bold opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Bỏ khỏi danh sách"
                  >
                    X
                  </button>

                  <div className="relative aspect-[2/3] w-full">
                    {manga.coverImage ? (
                      <img src={manga.coverImage} alt={manga.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-gray-700 flex items-center justify-center text-gray-500 text-sm">No Image</div>
                    )}
                    
                    {/* Nhãn trạng thái */}
                    <div className="absolute top-2 right-2 z-10 bg-black/70 px-2 py-1 rounded text-[10px] font-bold text-blue-400 backdrop-blur-sm">
                      {manga.status}
                    </div>
                  </div>
                  
                  <div className="p-3 bg-gray-800 relative z-10">
                    <h3 className="font-bold text-sm truncate group-hover:text-blue-400 transition">{manga.title}</h3>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}