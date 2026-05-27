"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Anime {
  id: string;
  title: string;
  coverImage: string | null;
  _count: {
    episodes: number;
  };
}

export default function AdminAnimeListPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  
  const [animes, setAnimes] = useState<Anime[]>([]);
  const [loading, setLoading] = useState(true);

  // 1. Bảo vệ trang: Yêu cầu đăng nhập và có quyền ADMIN
  useEffect(() => {
    if (status === "loading") return;
    if (!session || session.user.role !== "ADMIN") {
      router.push("/");
    }
  }, [session, status, router]);

  // 2. Fetch danh sách Anime
  useEffect(() => {
    const fetchAnimes = async () => {
      try {
        const res = await fetch("http://localhost:5000/api/admin/anime");
        if (res.ok) {
          const data = await res.json();
          setAnimes(data);
        }
      } catch (error) {
        console.error("Lỗi tải danh sách:", error);
      } finally {
        setLoading(false);
      }
    };

    if (session?.user?.role === "ADMIN") {
      fetchAnimes();
    }
  }, [session]);

  // 3. Hàm xử lý xóa Anime
  const handleDelete = async (id: string, title: string) => {
    const confirmDelete = confirm(`CẢNH BÁO: Bạn có chắc chắn muốn xóa bộ phim "${title}"?\nHành động này sẽ XÓA TOÀN BỘ các tập phim và phụ đề bên trong. Không thể hoàn tác!`);
    if (!confirmDelete) return;

    try {
      const res = await fetch(`http://localhost:5000/api/admin/anime/${id}`, {
        method: "DELETE"
      });

      if (res.ok) {
        // Xóa khỏi UI ngay lập tức
        setAnimes(animes.filter(anime => anime.id !== id));
        alert("Đã xóa bộ phim thành công!");
      } else {
        const errorData = await res.json();
        alert(`Lỗi: ${errorData.message}`);
      }
    } catch (error) {
      alert("Đã xảy ra lỗi khi kết nối với server!");
    }
  };

  if (status === "loading" || loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0f0f11]">
        <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!session || session.user.role !== "ADMIN") return null;

  return (
    <div className="min-h-screen bg-[#0f0f11] text-white p-8">
      <div className="max-w-7xl mx-auto">
        
        {/* THANH ĐIỀU HƯỚNG & TIÊU ĐỀ */}
        <div className="flex flex-col md:flex-row justify-between items-center mb-8 bg-gray-800 p-6 rounded-2xl shadow-lg border border-gray-700">
          <div>
            <h1 className="text-3xl font-black text-blue-400 mb-2">Anime Inventory Management</h1>
            <p className="text-gray-400 text-sm">System currently has <span className="font-bold text-white">{animes.length}</span> anime titles</p>
          </div>
          <div className="flex gap-4 mt-4 md:mt-0">
            <Link 
              href="/admin" 
              className="px-6 py-2.5 bg-gray-700 hover:bg-gray-600 rounded-lg font-bold transition text-gray-200"
            >
              Return Dashboard
            </Link>
            <Link 
              href="/admin/anime/upload" 
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 rounded-lg font-bold shadow-lg shadow-blue-600/30 transition text-white"
            >
              + Add New Anime
            </Link>
          </div>
        </div>

        {/* DANH SÁCH LƯỚI ANIME */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
            {animes.map((anime) => (
              <div 
                key={anime.id} 
                onClick={() => router.push(`/admin/anime/${anime.id}`)}
                className="bg-gray-800 rounded-xl overflow-hidden border border-gray-700 shadow-xl group hover:border-blue-500/50 transition-all cursor-pointer"
              >
                {/* Khu vực ảnh bìa */}
                <div className="relative aspect-[2/3] w-full bg-gray-900">
                  {anime.coverImage ? (
                    <img src={anime.coverImage} alt={anime.title} className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-600 text-sm">Trống</div>
                  )}
                  
                  {/* Badge số lượng tập */}
                  <div className="absolute top-2 left-2 bg-black/80 backdrop-blur text-blue-400 font-bold text-xs px-2 py-1 rounded">
                    {anime._count.episodes} Episodes
                  </div>
                  
                  {/* ĐÃ XÓA PHẦN OVERLAY HOVER Ở ĐÂY */}
                </div>
                
                {/* Tên phim */}
                <div className="p-4">
                  <h3 className="font-bold text-gray-200 truncate" title={anime.title}>
                    {anime.title}
                  </h3>
                </div>
              </div>
            ))}
          </div>

      </div>
    </div>
  );
}