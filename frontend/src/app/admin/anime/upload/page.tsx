"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function UploadAnimePage() {
  const router = useRouter();

  // State quản lý form
  const [title, setTitle] = useState("");
  // 🌟 1. STATE MỚI: Quản lý Fandom Prefix
  const [fandomPrefix, setFandomPrefix] = useState(""); 
  const [description, setDescription] = useState("");
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  
  // Quản lý loading khi AI đang viết tóm tắt
  const [isGeneratingDesc, setIsGeneratingDesc] = useState(false);

  // Hàm xử lý chọn file ảnh bìa
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setCoverFile(e.target.files[0]);
    }
  };

  // Gọi AI viết tóm tắt
  const handleGenerateDescription = async () => {
    if (!title) {
      alert("Vui lòng nhập Tên Anime trước khi dùng AI!");
      return;
    }
    
    setIsGeneratingDesc(true);
    try {
      const res = await fetch("http://localhost:5000/api/admin/generate-anime-desc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      
      const data = await res.json();
      
      if (res.ok) {
        // Tự động điền kết quả AI trả về vào ô Textarea
        setDescription(data.description);
      } else {
        alert(data.message || "Không thể tạo tóm tắt.");
      }
    } catch (error) {
      console.error("Lỗi:", error);
      alert("Lỗi kết nối tới Server AI.");
    } finally {
      setIsGeneratingDesc(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      let uploadedCoverUrl = "";

      // 1. Tải ảnh bìa lên Cloudinary
      if (coverFile) {
        const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
        const animePreset = process.env.NEXT_PUBLIC_CLOUDINARY_ANIME_PRESET;

        if (!cloudName || !animePreset) throw new Error("Thiếu cấu hình Cloudinary!");

        const formData = new FormData();
        formData.append("file", coverFile);
        formData.append("upload_preset", animePreset);

        const cloudinaryRes = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
          method: "POST",
          body: formData,
        });

        const cloudinaryData = await cloudinaryRes.json();
        if (!cloudinaryRes.ok) throw new Error("Lỗi upload ảnh bìa");
        uploadedCoverUrl = cloudinaryData.secure_url;
      }

      // 2. Gửi thông tin về Backend để lưu vào Database
      const res = await fetch("http://localhost:5000/api/admin/anime", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          fandomPrefix, // 🌟 2. BỔ SUNG GỬI FANDOM PREFIX LÊN BACKEND
          description,
          coverImage: uploadedCoverUrl,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message);

      alert("Đã thêm bộ Anime mới thành công!");
      router.push("/admin/anime"); 

    } catch (error) {
      if (error instanceof Error) {
        alert(`Lỗi: ${error.message}`);
      } else {
        alert("Đã xảy ra lỗi không xác định!");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0f0f11] text-white p-8">
      <div className="max-w-3xl mx-auto bg-gray-800 p-8 rounded-2xl shadow-2xl border border-gray-700">
        <div className="flex justify-between items-center mb-8 border-b border-gray-700 pb-4">
          <h1 className="text-3xl font-black text-blue-400">Thêm Bộ Anime Mới</h1>
          <Link href="/admin/anime" className="text-gray-400 hover:text-white transition">
            &larr; Quay lại
          </Link>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Tên phim */}
          <div>
            <label className="block text-sm font-bold text-gray-300 mb-2">Tên Anime (*)</label>
            <input
              type="text"
              required
              placeholder="Ví dụ: Overlord IV"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition"
            />
          </div>

          {/* 🌟 3. GIAO DIỆN NHẬP FANDOM PREFIX ĐÃ ĐƯỢC ĐỒNG BỘ STYLING */}
          <div>
            <label className="block text-sm font-bold text-gray-300 mb-2">Fandom Prefix (Dùng cho Auto-fill Data)</label>
            <div className="flex bg-gray-900 border border-gray-700 rounded-xl overflow-hidden focus-within:border-blue-500 transition">
              <span className="bg-gray-800 text-gray-500 text-sm px-4 py-3 border-r border-gray-700 select-none flex items-center">
                https://
              </span>
              <input 
                type="text" 
                value={fandomPrefix}
                onChange={(e) => setFandomPrefix(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
                placeholder="Ví dụ: jujutsu-kaisen, naruto..."
                className="w-full bg-transparent p-3 text-sm outline-none text-white"
              />
              <span className="bg-gray-800 text-gray-500 text-sm px-4 py-3 border-l border-gray-700 select-none hidden sm:flex items-center">
                .fandom.com
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-2 italic">
              * Bắt buộc phải có để tính năng 🪄 Auto-fill via AI ở trong trang Chi tiết Tập phim có thể hoạt động.
            </p>
          </div>

          {/* Chọn ảnh bìa */}
          <div>
            <label className="block text-sm font-bold text-gray-300 mb-2">Ảnh bìa phim (Cover)</label>
            <input
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="block w-full text-sm text-gray-400 file:mr-4 file:py-2.5 file:px-6 file:rounded-xl file:border-0 file:text-sm file:font-bold file:bg-blue-600 file:text-white hover:file:bg-blue-700 cursor-pointer transition"
            />
            {coverFile && <p className="text-xs text-green-400 mt-2">✓ Đã chọn: {coverFile.name}</p>}
          </div>

          {/* Tóm tắt nội dung + NÚT AI */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-sm font-bold text-gray-300">Tóm tắt nội dung</label>
              
              <button
                type="button"
                onClick={handleGenerateDescription}
                disabled={isGeneratingDesc || !title}
                className="bg-purple-600 hover:bg-purple-500 disabled:bg-gray-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition flex items-center gap-1 shadow-lg"
              >
                {isGeneratingDesc ? (
                  <>
                    <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Đang viết...
                  </>
                ) : (
                  "✨ AI Viết Tóm Tắt"
                )}
              </button>
            </div>
            
            <textarea
              rows={5}
              placeholder="Nhập mô tả bộ phim hoặc dùng AI để tự động tạo..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition resize-none"
            ></textarea>
          </div>

          {/* Nút bấm Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-black text-lg rounded-xl shadow-lg shadow-blue-600/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center"
          >
            {loading ? (
              <div className="flex items-center gap-3">
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Processing data...</span>
              </div>
            ) : "Upload Anime to the System"}
          </button>
        </form>
      </div>
    </div>
  );
}