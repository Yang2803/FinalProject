"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function UploadMangaPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [title, setTitle] = useState("");
  // 🌟 1. STATE MỚI: Quản lý Fandom Prefix
  const [fandomPrefix, setFandomPrefix] = useState("");
  const [description, setDescription] = useState("");
  const [author, setAuthor] = useState("");
  const [mangaStatus, setMangaStatus] = useState("ONGOING");
  
  const [coverFile, setCoverFile] = useState<File | null>(null);
  
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Quản lý loading khi AI đang viết tóm tắt
  const [isGeneratingDesc, setIsGeneratingDesc] = useState(false);

  useEffect(() => {
    if (status === "loading") return;
    if (!session || session.user.role !== "ADMIN") {
      router.push("/");
    }
  }, [session, status, router]);

  if (status === "loading" || !session || session.user.role !== "ADMIN") {
    return <div className="flex h-screen items-center justify-center bg-gray-900 text-white">Authorization in progress...</div>;
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setCoverFile(e.target.files[0]);
    }
  };

  // Gọi API để AI tự động viết tóm tắt dựa trên Title
  const handleGenerateDescription = async () => {
    if (!title) {
      alert("Vui lòng nhập Tên Manga trước khi dùng AI!");
      return;
    }
    
    setIsGeneratingDesc(true);
    try {
      const res = await fetch("http://localhost:5000/api/admin/generate-manga-desc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      
      const data = await res.json();
      
      if (res.ok) {
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
    setMessage("");
    setError("");
    setLoading(true);

    try {
      let uploadedCoverUrl = ""; 

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
        
        uploadedCoverUrl = cloudinaryData.secure_url;
      }

      const res = await fetch("http://localhost:5000/api/admin/manga", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          fandomPrefix, // 🌟 2. BỔ SUNG GỬI FANDOM PREFIX LÊN BACKEND
          description,
          author,
          coverImage: uploadedCoverUrl, 
          status: mangaStatus,
          userId: session.user.id,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setMessage(data.message);
        // 🌟 3. RESET LẠI STATE FANDOM PREFIX KHI UPLOAD THÀNH CÔNG
        setTitle(""); setDescription(""); setAuthor(""); setFandomPrefix(""); setCoverFile(null);
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

          {/* 🌟 4. GIAO DIỆN NHẬP FANDOM PREFIX */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Fandom Prefix (Dùng cho Auto-fill Data)</label>
            <div className="flex bg-gray-700 border border-gray-600 rounded-md overflow-hidden focus-within:ring focus-within:ring-blue-500 transition">
              <span className="bg-gray-800 text-gray-400 text-sm px-3 py-2 border-r border-gray-600 select-none flex items-center">
                https://
              </span>
              <input 
                type="text" 
                value={fandomPrefix}
                onChange={(e) => setFandomPrefix(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
                placeholder="e.g., bungostraydogs, jujutsu-kaisen..."
                className="w-full bg-transparent p-2 text-sm outline-none text-white"
              />
              <span className="bg-gray-800 text-gray-400 text-sm px-3 py-2 border-l border-gray-600 select-none hidden sm:flex items-center">
                .fandom.com
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-1 italic">
              * Bắt buộc phải có để tính năng 🪄 Auto-fill via AI ở trong trang Manga Chapter hoạt động.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Author</label>
            <input type="text" placeholder="e.g., Asagiri Kafka" value={author} onChange={(e) => setAuthor(e.target.value)} className="w-full px-4 py-2 bg-gray-700 rounded-md focus:ring focus:ring-blue-500 outline-none" />
          </div>

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
            <div className="flex justify-between items-center mb-1">
              <label className="block text-sm font-medium text-gray-300">Content Summary</label>
              <button
                type="button"
                onClick={handleGenerateDescription}
                disabled={isGeneratingDesc || !title}
                className="bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 text-white text-xs font-bold px-3 py-1.5 rounded transition flex items-center gap-1 shadow-md"
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
            <textarea rows={4} placeholder="Enter manga description or use AI..." value={description} onChange={(e) => setDescription(e.target.value)} className="w-full px-4 py-2 bg-gray-700 rounded-md focus:ring focus:ring-blue-500 outline-none resize-none"></textarea>
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