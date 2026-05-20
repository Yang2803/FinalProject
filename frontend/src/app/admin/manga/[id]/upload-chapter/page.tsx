"use client";

import { useState, use } from "react"; // 1. Bổ sung import 'use' từ thư viện react

// 2. Định nghĩa lại kiểu của params là một Promise
export default function UploadChapterPage({ params }: { params: Promise<{ id: string }> }) {
  
  // 3. Dùng hàm use() để giải nén Promise và lấy mangaId ra
  const resolvedParams = use(params);
  const mangaId = resolvedParams.id; 

  const [chapterTitle, setChapterTitle] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      // Chuyển FileList thành Mảng để dễ xử lý
      setFiles(Array.from(e.target.files));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (files.length === 0) return alert("Vui lòng chọn ít nhất 1 ảnh cho chương truyện!");
    setIsUploading(true);

    try {
      const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
      const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

      if (!cloudName || !uploadPreset) {
        throw new Error("Thiếu cấu hình Cloudinary!");
      }

      // 1. Upload từng ảnh lên Cloudinary
      const imageUrls = await Promise.all(
        files.map(async (file) => {
          const formData = new FormData();
          formData.append("file", file);
          formData.append("upload_preset", uploadPreset);

          const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
            method: "POST",
            body: formData,
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error?.message || "Lỗi upload ảnh");
          return data.secure_url;
        })
      );

      // 2. Gửi link ảnh và ID Manga về Backend
      const backendRes = await fetch("http://localhost:5000/api/admin/chapter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          mangaId, // ID lấy từ URL
          title: chapterTitle, 
          images: imageUrls 
        })
      }); 
      
      const backendData = await backendRes.json();
      if (!backendRes.ok) throw new Error(backendData.message);

      alert("Đăng chương truyện thành công!");
      setChapterTitle("");
      setFiles([]);
      
    } catch (error) {
      if (error instanceof Error) {
        alert(`Lỗi: ${error.message}`);
      } else {
        alert("Đã xảy ra lỗi không xác định!");
      }
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="p-8 min-h-screen text-white">
      <div className="max-w-2xl mx-auto bg-gray-800 p-8 rounded-xl shadow-lg">
        <h1 className="text-3xl font-bold mb-6 text-blue-400 border-b border-gray-700 pb-4">
          Tải lên Chương mới
        </h1>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Tên chương (*)</label>
            <input
              type="text"
              required
              value={chapterTitle}
              onChange={(e) => setChapterTitle(e.target.value)}
              className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500"
              placeholder="Ví dụ: Chapter 101"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Trang truyện (Chọn nhiều ảnh cùng lúc)</label>
            <input
              type="file"
              multiple
              accept="image/*"
              onChange={handleFileChange}
              className="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-gray-700 file:text-white hover:file:bg-gray-600"
            />
            {files.length > 0 && (
              <p className="mt-2 text-sm text-green-400">Đã chọn {files.length} ảnh trang truyện.</p>
            )}
          </div>

          <button
            type="submit"
            disabled={isUploading}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center"
          >
            {isUploading ? "Đang xử lý tải ảnh lên..." : "Hoàn Tất Tải Lên"}
          </button>
        </form>
      </div>
    </div>
  );
}