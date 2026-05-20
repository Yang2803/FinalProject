"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function UploadMangaPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [author, setAuthor] = useState("");
  const [coverImage, setCoverImage] = useState(""); // Tạm thời dùng link URL
  const [mangaStatus, setMangaStatus] = useState("ONGOING");
  
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // BẢO VỆ ROUTE: Kiểm tra quyền Admin ngay khi vào trang
  useEffect(() => {
    if (status === "loading") return; // Đang kiểm tra session thì đợi
    
    // Nếu chưa đăng nhập HOẶC không phải ADMIN thì đá về trang chủ
    if (!session || session.user.role !== "ADMIN") {
      router.push("/");
    }
  }, [session, status, router]);

  // Nếu đang loading session hoặc bị đá đi thì hiện màn hình chờ để không bị lộ giao diện
  if (status === "loading" || !session || session.user.role !== "ADMIN") {
    return <div className="flex h-screen items-center justify-center bg-gray-900 text-white">Đang xác thực quyền truy cập...</div>;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");
    setError("");
    setLoading(true);

    try {
      const res = await fetch("http://localhost:5000/api/admin/manga", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          author,
          coverImage,
          status: mangaStatus,
          userId: session.user.id, // Truyền ID của Admin xuống Backend để xác thực
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setMessage(data.message);
        // Reset form sau khi đăng thành công
        setTitle(""); setDescription(""); setAuthor(""); setCoverImage("");
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError("Lỗi kết nối đến Server!");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-2xl mx-auto bg-gray-800 p-8 rounded-xl shadow-lg">
        <h1 className="text-3xl font-bold mb-6 text-blue-400 border-b border-gray-700 pb-4">Quản lý nội dung: Thêm Manga mới</h1>
        
        {message && <div className="mb-4 p-3 bg-green-900/50 text-green-400 border border-green-500 rounded">{message}</div>}
        {error && <div className="mb-4 p-3 bg-red-900/50 text-red-400 border border-red-500 rounded">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Tên truyện (*)</label>
            <input
              type="text"
              required
              placeholder="VD: Bungou Stray Dogs"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-2 bg-gray-700 rounded-md focus:ring focus:ring-blue-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Tác giả</label>
            <input
              type="text"
              placeholder="VD: Asagiri Kafka"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              className="w-full px-4 py-2 bg-gray-700 rounded-md focus:ring focus:ring-blue-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Link ảnh bìa (URL)</label>
            <input
              type="url"
              placeholder="https://..."
              value={coverImage}
              onChange={(e) => setCoverImage(e.target.value)}
              className="w-full px-4 py-2 bg-gray-700 rounded-md focus:ring focus:ring-blue-500 outline-none"
            />
            <p className="text-xs text-gray-500 mt-1">Tạm thời dán link ảnh từ web khác. Chức năng upload file lên Cloudinary sẽ làm sau.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Tóm tắt nội dung</label>
            <textarea
              rows={4}
              placeholder="Nhập mô tả truyện..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-4 py-2 bg-gray-700 rounded-md focus:ring focus:ring-blue-500 outline-none resize-none"
            ></textarea>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Trạng thái</label>
            <select
              value={mangaStatus}
              onChange={(e) => setMangaStatus(e.target.value)}
              className="w-full px-4 py-2 bg-gray-700 rounded-md focus:ring focus:ring-blue-500 outline-none"
            >
              <option value="ONGOING">Đang tiến hành (Ongoing)</option>
              <option value="COMPLETED">Đã hoàn thành (Completed)</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 mt-4 bg-blue-600 text-white font-bold rounded-md hover:bg-blue-700 transition disabled:bg-gray-600"
          >
            {loading ? "Đang xử lý..." : "Đăng Manga Lên Hệ Thống"}
          </button>
        </form>
      </div>
    </div>
  );
}