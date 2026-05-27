"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function UploadMangaPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [author, setAuthor] = useState("");
  const [mangaStatus, setMangaStatus] = useState("ONGOING");
  
  // 1. ĐỔI STATE: Thay vì lưu URL string, ta lưu trực tiếp File ảnh admin chọn
  const [coverFile, setCoverFile] = useState<File | null>(null);
  
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (status === "loading") return;
    if (!session || session.user.role !== "ADMIN") {
      router.push("/");
    }
  }, [session, status, router]);

  if (status === "loading" || !session || session.user.role !== "ADMIN") {
    return <div className="flex h-screen items-center justify-center bg-gray-900 text-white">Authorization in progress...</div>;
  }

  // Hàm bắt sự kiện khi admin chọn file
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setCoverFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");
    setError("");
    setLoading(true);

    try {
      let uploadedCoverUrl = ""; // Biến chứa link ảnh sau khi up lên Cloudinary

      // 2. NẾU CÓ CHỌN ẢNH BÌA -> TẢI LÊN CLOUDINARY TRƯỚC
      if (coverFile) {
        const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
        const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

        if (!cloudName || !uploadPreset) {
          throw new Error("Missing Cloudinary configuration!");
        }

        const formData = new FormData();
        formData.append("file", coverFile);
        formData.append("upload_preset", uploadPreset);

        const cloudinaryRes = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
          method: "POST",
          body: formData,
        });

        const cloudinaryData = await cloudinaryRes.json();
        
        if (!cloudinaryRes.ok) {
          throw new Error(cloudinaryData.error?.message || "Error uploading cover image to Cloudinary");
        }
        
        // Lấy link URL an toàn từ Cloudinary
        uploadedCoverUrl = cloudinaryData.secure_url;
      }

      // 3. GỬI DỮ LIỆU KÈM LINK ẢNH VỀ BACKEND API NHƯ BÌNH THƯỜNG
      const res = await fetch("http://localhost:5000/api/admin/manga", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          author,
          coverImage: uploadedCoverUrl, // Truyền link vừa lấy được vào đây
          status: mangaStatus,
          userId: session.user.id,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setMessage(data.message);
        // Reset form
        setTitle(""); setDescription(""); setAuthor(""); setCoverFile(null);
        // Reset lại input file bằng cách query element (vì input type="file" không binding 2 chiều trực tiếp qua value được)
        const fileInput = document.getElementById('cover-upload') as HTMLInputElement;
        if (fileInput) fileInput.value = '';
        
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError("Error connecting to the server!");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-2xl mx-auto bg-gray-800 p-8 rounded-xl shadow-lg">
        <div className="flex justify-between items-center mb-6 border-b border-gray-700 pb-4">
          <h1 className="text-3xl font-bold text-blue-400">Add New Manga</h1>
          <Link 
            href="/admin/manga" 
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-sm text-white font-medium rounded-md transition"
          >
            &larr; Back to List
          </Link>
        </div>
        
        {message && <div className="mb-4 p-3 bg-green-900/50 text-green-400 border border-green-500 rounded">{message}</div>}
        {error && <div className="mb-4 p-3 bg-red-900/50 text-red-400 border border-red-500 rounded">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Title (*)</label>
            <input type="text" required placeholder="e.g., Bungou Stray Dogs" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full px-4 py-2 bg-gray-700 rounded-md focus:ring focus:ring-blue-500 outline-none" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Author</label>
            <input type="text" placeholder="e.g., Asagiri Kafka" value={author} onChange={(e) => setAuthor(e.target.value)} className="w-full px-4 py-2 bg-gray-700 rounded-md focus:ring focus:ring-blue-500 outline-none" />
          </div>

          {/* 4. ĐỔI GIAO DIỆN SANG DẠNG CHỌN FILE */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Upload Cover Image</label>
            <input
              id="cover-upload"
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700"
            />
            {coverFile && <p className="text-xs text-green-400 mt-2">Selected file: {coverFile.name}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Content Summary</label>
            <textarea rows={4} placeholder="Enter manga description..." value={description} onChange={(e) => setDescription(e.target.value)} className="w-full px-4 py-2 bg-gray-700 rounded-md focus:ring focus:ring-blue-500 outline-none resize-none"></textarea>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Status</label>
            <select value={mangaStatus} onChange={(e) => setMangaStatus(e.target.value)} className="w-full px-4 py-2 bg-gray-700 rounded-md focus:ring focus:ring-blue-500 outline-none">
              <option value="ONGOING">Ongoing</option>
              <option value="COMPLETED">Completed</option>
            </select>
          </div>

          <button type="submit" disabled={loading} className="w-full py-3 mt-4 bg-blue-600 text-white font-bold rounded-md hover:bg-blue-700 transition disabled:bg-gray-600 flex justify-center items-center">
            {loading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : "Upload Manga"}
          </button>
        </form>
      </div>
    </div>
  );
}