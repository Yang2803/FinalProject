"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

interface Episode {
  id: string;
  title: string;
  createdAt: string;
}

interface AnimeDetail {
  id: string;
  title: string;
  description: string | null;
  coverImage: string | null;
  episodes: Episode[];
}

export default function AdminAnimeDetailPage() {
  const params = useParams();
  const router = useRouter();
  const animeId = params.id as string;

  const [anime, setAnime] = useState<AnimeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  
  // States phục vụ tính năng chỉnh sửa thông tin
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [newCoverFile, setNewCoverFile] = useState<File | null>(null);
  const [saveLoading, setSaveLoading] = useState(false);

  // 1. Khai báo một "công tắc" để kích hoạt tải lại dữ liệu
  const [refreshKey, setRefreshKey] = useState(0);

  // 2. Gom toàn bộ logic tải dữ liệu vào thẳng bên trong useEffect
  useEffect(() => {
    const loadData = async () => {
      try {
        const res = await fetch(`http://localhost:5000/api/admin/anime/${animeId}`);
        if (res.ok) {
          const data = await res.json();
          setAnime(data);
          setEditTitle(data.title);
          setEditDescription(data.description || "");
        } else {
          alert("Không tìm thấy bộ phim này!");
          router.push("/admin/anime");
        }
      } catch (error) {
        console.error("Lỗi kết nối:", error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [animeId, router, refreshKey]); // <--- Khi refreshKey thay đổi, useEffect sẽ tự động chạy lại hàm loadData

  // 2. Hàm Xử lý Lưu thông tin sau khi Sửa
  const handleUpdateAnime = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveLoading(true);

    try {
      let finalCoverUrl = anime?.coverImage || "";

      // Nếu admin chọn ảnh bìa mới, tiến hành đẩy lên Cloudinary trước
      if (newCoverFile) {
        const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
        const animePreset = process.env.NEXT_PUBLIC_CLOUDINARY_ANIME_PRESET;

        const formData = new FormData();
        formData.append("file", newCoverFile);
        formData.append("upload_preset", animePreset || "anime_uploads");

        const cloudRes = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
          method: "POST",
          body: formData
        });
        const cloudData = await cloudRes.json();
        if (!cloudRes.ok) throw new Error("Lỗi tải ảnh bìa mới lên Cloudinary");
        finalCoverUrl = cloudData.secure_url;
      }

      // Gửi dữ liệu cập nhật về Backend
      const res = await fetch(`http://localhost:5000/api/admin/anime/${animeId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editTitle,
          description: editDescription,
          coverImage: finalCoverUrl
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message);
      }

      alert("Cập nhật thông tin Anime thành công!");
      setIsEditing(false);
      setNewCoverFile(null);
      setRefreshKey((prev) => prev + 1);// Tải lại dữ liệu mới cập nhật lên UI

    } catch (error) {
      alert(error instanceof Error ? error.message : "Có lỗi xảy ra");
    } finally {
      setSaveLoading(false);
    }
  };

  // Hàm xử lý Xóa Anime
  const handleDeleteAnime = async () => {
    if (!anime) return;
    const confirmDelete = confirm(`CẢNH BÁO: Bạn có chắc chắn muốn xóa bộ phim "${anime.title}"?\nHành động này sẽ XÓA TOÀN BỘ các tập phim và phụ đề bên trong. Không thể hoàn tác!`);
    if (!confirmDelete) return;

    try {
      setLoading(true); // Tận dụng state loading để khóa giao diện lúc đang xóa
      const res = await fetch(`http://localhost:5000/api/admin/anime/${animeId}`, {
        method: "DELETE"
      });

      if (res.ok) {
        alert("Đã xóa bộ phim thành công!");
        router.push("/admin/anime"); // Xóa xong thì điều hướng Admin về lại danh sách
      } else {
        const errorData = await res.json();
        alert(`Lỗi: ${errorData.message}`);
        setLoading(false);
      }
    } catch (error) {
      alert("Đã xảy ra lỗi khi kết nối với server!");
      setLoading(false);
    }
  };

  // Hàm xử lý Xóa Tập Phim
  const handleDeleteEpisode = async (epId: string, epTitle: string) => {
    const confirmDelete = confirm(`Bạn có chắc muốn xóa "${epTitle}"? Không thể hoàn tác!`);
    if (!confirmDelete) return;

    try {
      const res = await fetch(`http://localhost:5000/api/admin/episode/${epId}`, {
        method: "DELETE"
      });

      if (res.ok) {
        alert("Đã xóa tập phim!");
        setRefreshKey(prev => prev + 1); // Load lại danh sách tập phim lập tức
      } else {
        const err = await res.json();
        alert(`Lỗi: ${err.message}`);
      }
    } catch (error) {
      alert("Lỗi kết nối server!");
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-900">
        <div className="w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!anime) return null;

  return (
    <div className="min-h-screen bg-[#0f0f11] text-white p-8">
      <div className="max-w-5xl mx-auto">
        
        {/* NÚT BACK VỀ TRANH CHỦ ADMIN */}
        <div className="mb-6">
          <Link href="/admin/anime" className="text-sm text-gray-400 hover:text-purple-400 transition">&larr; Quản lý kho phim</Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          
          {/* CỘT TRÁI: HIỂN THỊ / SỬA ẢNH BÌA */}
          <div className="space-y-4">
            <div className="bg-gray-800 p-4 rounded-2xl border border-gray-700">
              <div className="aspect-[2/3] relative w-full bg-gray-900 rounded-xl overflow-hidden mb-4">
                {anime.coverImage ? (
                  <img src={anime.coverImage} alt={anime.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-600">Không có ảnh</div>
                )}
              </div>
              <Link 
                href={`/admin/anime/${anime.id}/upload-episode`}
                className="block w-full text-center bg-purple-600 hover:bg-purple-700 text-white font-bold py-2.5 rounded-xl transition text-sm"
              >
                + Đăng Tập Phim Mới
              </Link>
            </div>
          </div>

          {/* CỘT PHẢI: CHI TIẾT PHIM HOẶC FORM CHỈNH SỬA */}
          <div className="md:col-span-2 space-y-6">
            
            <div className="bg-gray-800 p-6 rounded-2xl border border-gray-700 shadow-xl">
              {!isEditing ? (
                /* CHẾ ĐỘ XEM CHI TIẾT */
                <div>
                  <div className="flex justify-between items-start mb-4">
                    <h1 className="text-3xl font-black text-blue-400">{anime.title}</h1>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => setIsEditing(true)}
                        className="bg-gray-700 hover:bg-gray-600 text-xs font-bold px-4 py-2 rounded-lg transition"
                      >
                        ✏️ Sửa thông tin
                      </button>
                      <button 
                        onClick={handleDeleteAnime}
                        className="bg-red-900/30 hover:bg-red-600 text-red-400 hover:text-white border border-red-800 hover:border-red-600 text-xs font-bold px-4 py-2 rounded-lg transition"
                      >
                        🗑️ Xóa phim
                      </button>
                    </div>
                  </div>
                  <p className="text-gray-300 leading-relaxed text-sm whitespace-pre-line bg-gray-900/40 p-4 rounded-xl border border-gray-700/60">
                    {anime.description || "Chưa có tóm tắt nội dung cho bộ phim này."}
                  </p>
                </div>
              ) : (
                /* CHẾ ĐỘ CHỈNH SỬA (FORM) */
                <form onSubmit={handleUpdateAnime} className="space-y-4">
                  <h2 className="text-xl font-bold text-yellow-400">Chỉnh sửa thông tin Anime</h2>
                  
                  <div>
                    <label className="block text-xs text-gray-400 font-bold mb-1">Tên phim (*)</label>
                    <input 
                      type="text" 
                      required
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2.5 text-sm outline-none text-white focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-gray-400 font-bold mb-1">Thay đổi ảnh bìa (Tùy chọn)</label>
                    <input 
                      type="file" 
                      accept="image/*"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) setNewCoverFile(e.target.files[0]);
                      }}
                      className="block w-full text-xs text-gray-400 file:mr-4 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:bg-blue-600 file:text-white cursor-pointer"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-gray-400 font-bold mb-1">Tóm tắt nội dung</label>
                    <textarea 
                      rows={5}
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2.5 text-sm outline-none text-white focus:border-blue-500 resize-none"
                    />
                  </div>

                  <div className="flex gap-3 justify-end pt-2">
                    <button 
                      type="button" 
                      disabled={saveLoading}
                      onClick={() => { setIsEditing(false); setNewCoverFile(null); }}
                      className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg text-sm transition"
                    >
                      Hủy
                    </button>
                    <button 
                      type="submit"
                      disabled={saveLoading}
                      className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-5 py-2 rounded-lg text-sm transition disabled:opacity-50"
                    >
                      {saveLoading ? "Đang lưu..." : "Lưu thay đổi"}
                    </button>
                  </div>
                </form>
              )}
            </div>

            {/* DANH SÁCH CÁC TẬP PHIM ĐÃ ĐĂNG */}
            <div className="bg-gray-800 p-6 rounded-2xl border border-gray-700 shadow-xl">
              <h2 className="text-xl font-black text-purple-400 mb-4 border-b border-gray-700 pb-2">
                Danh sách tập phim đã đăng ({anime.episodes.length})
              </h2>

              {anime.episodes.length === 0 ? (
                <p className="text-sm text-gray-500 italic py-4">Bộ phim này hiện chưa phát hành tập phim nào.</p>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto pr-2">
                  {anime.episodes.map((ep, idx) => (
                    <div 
                      key={ep.id} 
                      className="flex justify-between items-center bg-gray-900/50 hover:bg-gray-900 p-3.5 rounded-xl border border-gray-700/60 transition group"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-bold text-gray-500 w-6">#{idx + 1}</span>
                        <span className="font-semibold text-gray-200 text-sm">{ep.title}</span>
                        <span className="text-xs text-gray-600 hidden md:inline-block">
                          ({new Date(ep.createdAt).toLocaleDateString('vi-VN')})
                        </span>
                      </div>
                      
                      {/* CÁC NÚT THAO TÁC: Chỉ hiện rõ khi hover */}
                      <div className="flex gap-2 opacity-50 group-hover:opacity-100 transition-opacity">
                        <Link 
                          href={`/admin/anime/${animeId}/episode/${ep.id}/edit`}
                          className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-3 py-1.5 rounded transition"
                        >
                          Sửa / Up lại
                        </Link>
                        <button 
                          onClick={() => handleDeleteEpisode(ep.id, ep.title)}
                          className="bg-red-600 hover:bg-red-500 text-white text-xs font-bold px-3 py-1.5 rounded transition"
                        >
                          Xóa
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}