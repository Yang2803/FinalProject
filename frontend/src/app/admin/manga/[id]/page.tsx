"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

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

export default function AdminMangaDetails({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const mangaId = resolvedParams.id;
  const router = useRouter();

  // State lưu trữ dữ liệu gốc
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [coverImage, setCoverImage] = useState("");
  const [mangaStatus, setMangaStatus] = useState("ONGOING");
  const [description, setDescription] = useState("");
  const [chapters, setChapters] = useState<Chapter[]>([]);

  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // Gọi API lấy thông tin bộ truyện
  useEffect(() => {
    const fetchMangaDetails = async () => {
      try {
        const res = await fetch(`http://localhost:5000/api/admin/manga/${mangaId}`);
        if (!res.ok) throw new Error("Không thể tải thông tin truyện");
        
        const data: MangaData = await res.json();
        setTitle(data.title);
        setAuthor(data.author || "");
        setCoverImage(data.coverImage || "");
        setMangaStatus(data.status);
        setDescription(data.description || "");
        setChapters(data.chapters || []);
      } catch (err) {
        setError("Lỗi kết nối hoặc bộ truyện không tồn tại.");
      } finally {
        setLoading(false);
      }
    };
    fetchMangaDetails();
  }, [mangaId]);

  // Hàm xử lý CẬP NHẬT (SỬA) truyện
  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setMessage("");
    setError("");

    try {
      const res = await fetch(`http://localhost:5000/api/admin/manga/${mangaId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title, author, coverImage, status: mangaStatus, description
        })
      });
      const data = await res.json();
      if (res.ok) {
        setMessage(data.message);
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError("Lỗi kết nối server Backend!");
    } finally {
      setIsSaving(false);
    }
  };

  // Hàm xử lý XÓA truyện
  const handleDelete = async () => {
    const confirmDelete = confirm(`Bạn có chắc chắn muốn XÓA HOÀN TOÀN bộ truyện "${title}" cùng toàn bộ các chương truyện đã đăng không? Hành động này không thể hoàn tác!`);
    if (!confirmDelete) return;

    try {
      const res = await fetch(`http://localhost:5000/api/admin/manga/${mangaId}`, {
        method: "DELETE"
      });
      const data = await res.json();
      if (res.ok) {
        alert(data.message);
        router.push("/admin/manga"); // Xóa xong đẩy về trang danh sách
      } else {
        alert(data.message);
      }
    } catch (err) {
      alert("Lỗi kết nối khi xóa truyện!");
    }
  };
  
  // Hàm xử lý XÓA CHƯƠNG
  const handleDeleteChapter = async (chapterId: string, chapterTitle: string) => {
    const confirmDelete = confirm(`Bạn có chắc muốn xóa "${chapterTitle}" không?`);
    if (!confirmDelete) return;

    try {
      const res = await fetch(`http://localhost:5000/api/admin/chapter/${chapterId}`, {
        method: "DELETE"
      });
      const data = await res.json();
      
      if (res.ok) {
        // Lọc bỏ chương vừa xóa ra khỏi giao diện
        setChapters(chapters.filter(chap => chap.id !== chapterId));
        alert(data.message);
      } else {
        alert(data.message);
      }
    } catch (err) {
      alert("Lỗi kết nối khi xóa chương!");
    }
  };

  if (loading) return <div className="p-8 text-white text-center">Đang tải dữ liệu bộ truyện...</div>;

  return (
    <div className="p-8 text-white min-h-screen max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
      
      {/* CỘT TRÁI: FORM XEM VÀ SỬA THÔNG TIN TRUYỆN */}
      <div className="lg:col-span-2 bg-gray-800 p-6 rounded-xl shadow-lg h-fit">
        <div className="flex justify-between items-center mb-6 border-b border-gray-700 pb-4">
          <h1 className="text-2xl font-bold text-blue-400">Thông tin chi tiết</h1>
          <button 
            onClick={handleDelete}
            className="bg-red-600 hover:bg-red-700 text-white text-sm px-4 py-2 rounded-md font-bold transition"
          >
            Xóa Bộ Truyện
          </button>
        </div>

        {message && <div className="mb-4 p-3 bg-green-900/50 text-green-400 border border-green-500 rounded text-sm">{message}</div>}
        {error && <div className="mb-4 p-3 bg-red-900/50 text-red-400 border border-red-500 rounded text-sm">{error}</div>}

        <form onSubmit={handleUpdate} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Tên truyện</label>
            <input type="text" required value={title} onChange={(e) => setTitle(e.target.value)} className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg outline-none focus:border-blue-500"/>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Tác giả</label>
            <input type="text" value={author} onChange={(e) => setAuthor(e.target.value)} className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg outline-none focus:border-blue-500"/>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Link ảnh bìa (URL)</label>
            <input type="text" value={coverImage} onChange={(e) => setCoverImage(e.target.value)} className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg outline-none focus:border-blue-500"/>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Trạng thái phát hành</label>
            <select value={mangaStatus} onChange={(e) => setMangaStatus(e.target.value)} className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg outline-none focus:border-blue-500">
              <option value="ONGOING">Đang tiến hành (Ongoing)</option>
              <option value="COMPLETED">Đã hoàn thành (Completed)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Tóm tắt nội dung</label>
            <textarea rows={5} value={description} onChange={(e) => setDescription(e.target.value)} className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg outline-none focus:border-blue-500 resize-none"></textarea>
          </div>

          <div className="flex space-x-4 pt-2">
            <button type="submit" disabled={isSaving} className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition disabled:bg-gray-600">
              {isSaving ? "Đang lưu biến động..." : "Lưu Thay Đổi"}
            </button>
            <Link href="/admin/manga" className="px-6 py-2.5 bg-gray-700 hover:bg-gray-600 text-center rounded-lg transition">
              Quay Lại
            </Link>
          </div>
        </form>
      </div>

      {/* CỘT PHẢI: QUẢN LÝ SỐ CHAPTER ĐÃ ĐĂNG */}
      <div className="space-y-2 max-h-[450px] overflow-y-auto pr-1">
          {chapters.map((chap) => (
            // Thêm class 'group' vào đây để bắt sự kiện hover
            <div key={chap.id} className="flex justify-between items-center p-3 bg-gray-900 rounded-lg border border-gray-700 hover:border-blue-500 transition group">
              <div>
                <span className="font-medium text-sm block">{chap.title}</span>
                <span className="text-xs text-gray-500">
                  {new Date(chap.createdAt).toLocaleDateString("vi-VN")}
                </span>
              </div>
              
              {/* Cụm nút Sửa/Xóa (Chỉ hiện khi rê chuột vào) */}
              <div className="flex space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                {/* THAY ĐỔI TẠI ĐÂY */}
                <Link 
                  href={`/admin/manga/${mangaId}/chapter/${chap.id}/edit`}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-3 py-1.5 rounded transition"
                >
                  Sửa
                </Link>
                
                <button 
                  onClick={() => handleDeleteChapter(chap.id, chap.title)}
                  className="bg-red-600 hover:bg-red-700 text-white text-xs px-3 py-1.5 rounded transition"
                >
                  Xóa
                </button>
              </div>
            </div>
          ))}
          {chapters.length === 0 && (
            <p className="text-sm text-gray-500 text-center py-6">Bộ truyện này chưa được đăng chương nào.</p>
          )}
        </div>
    </div>
  );
}