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
  fandomPrefix?: string;
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
  const [fandomPrefix, setFandomPrefix] = useState(""); 
  const [chapters, setChapters] = useState<Chapter[]>([]);

  // State quản lý file ảnh mới
  const [newCoverFile, setNewCoverFile] = useState<File | null>(null);

  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // Hàm xử lý chọn ảnh mới
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setNewCoverFile(e.target.files[0]);
    }
  };

  // Gọi API lấy thông tin bộ truyện
  useEffect(() => {
    const fetchMangaDetails = async () => {
      try {
        const res = await fetch(`http://localhost:5000/api/admin/manga/${mangaId}`);
        if (!res.ok) throw new Error("Unable to load manga information");
        
        const data: MangaData = await res.json();
        setTitle(data.title);
        setAuthor(data.author || "");
        setCoverImage(data.coverImage || "");
        setMangaStatus(data.status);
        setDescription(data.description || "");
        setFandomPrefix(data.fandomPrefix || "");
        setChapters(data.chapters || []);
      } catch (err) {
        setError("Connection error or manga does not exist.");
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
      let finalCoverUrl = coverImage;

      // Nếu có ảnh mới, up lên Cloudinary trước
      if (newCoverFile) {
        const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
        const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

        const formData = new FormData();
        formData.append("file", newCoverFile);
        formData.append("upload_preset", uploadPreset || "manga_uploads");

        const cloudRes = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
          method: "POST",
          body: formData
        });
        const cloudData = await cloudRes.json();
        if (!cloudRes.ok) throw new Error("Lỗi tải ảnh bìa lên Cloudinary");
        finalCoverUrl = cloudData.secure_url;
      }

      // Gửi dữ liệu cập nhật về Backend
      const res = await fetch(`http://localhost:5000/api/admin/manga/${mangaId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title, 
          author, 
          coverImage: finalCoverUrl, 
          status: mangaStatus, 
          description,
          fandomPrefix
        })
      });
      
      const data = await res.json();
      if (res.ok) {
        setMessage(data.message);
        setCoverImage(finalCoverUrl); 
        setNewCoverFile(null); 
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Backend server connection error!");
    } finally {
      setIsSaving(false);
    }
  };

  // Hàm xử lý XÓA truyện
  const handleDelete = async () => {
    const confirmDelete = confirm(`Are you sure you want to DELETE the entire manga "${title}" along with all its chapters? This action cannot be undone!`);
    if (!confirmDelete) return;

    try {
      const res = await fetch(`http://localhost:5000/api/admin/manga/${mangaId}`, {
        method: "DELETE"
      });
      const data = await res.json();
      if (res.ok) {
        alert(data.message);
        router.push("/admin/manga");
      } else {
        alert(data.message);
      }
    } catch (err) {
      alert("Connection error when deleting a manga!");
    }
  };
  
  // Hàm xử lý XÓA CHƯƠNG
  const handleDeleteChapter = async (chapterId: string, chapterTitle: string) => {
    const confirmDelete = confirm(`Are you sure you want to delete "${chapterTitle}"?`);
    if (!confirmDelete) return;

    try {
      const res = await fetch(`http://localhost:5000/api/admin/chapter/${chapterId}`, {
        method: "DELETE"
      });
      const data = await res.json();
      
      if (res.ok) {
        setChapters(chapters.filter(chap => chap.id !== chapterId));
        alert(data.message);
      } else {
        alert(data.message);
      }
    } catch (err) {
      alert("Connection error when deleting a chapter!");
    }
  };

  if (loading) return (
    <div className="p-8 text-white flex h-screen justify-center items-center">
      <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
    </div>
  );

  return (
    <div className="p-8 text-white min-h-screen max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
      
      {/* CỘT TRÁI: FORM XEM VÀ SỬA THÔNG TIN TRUYỆN */}
      <div className="lg:col-span-2 bg-gray-800 p-6 rounded-2xl shadow-lg h-fit border border-gray-700">
        <div className="flex justify-between items-center mb-6 border-b border-gray-700 pb-4">
          <h1 className="text-2xl font-black text-blue-400">Detailed Information</h1>
          <button 
            onClick={handleDelete}
            className="bg-red-900/40 hover:bg-red-600 text-red-400 hover:text-white text-xs border border-red-800 hover:border-red-600 px-4 py-2 rounded-lg font-bold transition"
          >
            🗑️ Delete Manga
          </button>
        </div>

        {message && <div className="mb-4 p-3 bg-green-900/50 text-green-400 border border-green-500 rounded-lg text-sm">{message}</div>}
        {error && <div className="mb-4 p-3 bg-red-900/50 text-red-400 border border-red-500 rounded-lg text-sm">{error}</div>}

        <form onSubmit={handleUpdate}>
          {/* Bố cục chia 2 cột: Ảnh bên trái, Form bên phải */}
          <div className="flex flex-col md:flex-row gap-8">
            
            {/* KHU VỰC ẢNH BÌA */}
            <div className="w-full md:w-1/3 space-y-4">
              <div className="aspect-[2/3] w-full bg-gray-900 rounded-xl overflow-hidden border border-gray-700 relative">
                {(newCoverFile || coverImage) ? (
                  <img 
                    src={newCoverFile ? URL.createObjectURL(newCoverFile) : coverImage} 
                    alt={title} 
                    className="w-full h-full object-cover" 
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-600 text-sm">No Image</div>
                )}
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 mb-1">Change Cover Image</label>
                <input 
                  type="file" 
                  accept="image/*"
                  onChange={handleFileChange}
                  className="block w-full text-xs text-gray-400 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-blue-600 file:text-white hover:file:bg-blue-700 cursor-pointer"
                />
              </div>
            </div>

            {/* KHU VỰC NHẬP TEXT */}
            <div className="w-full md:w-2/3 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-400 mb-1">Manga name (*)</label>
                <input type="text" required value={title} onChange={(e) => setTitle(e.target.value)} className="w-full px-4 py-2.5 text-sm bg-gray-900 border border-gray-700 rounded-lg outline-none focus:border-blue-500 transition"/>
              </div>

              {/* FORM NHẬP FANDOM PREFIX */}
              <div>
                <label className="block text-xs text-gray-400 font-bold mb-1">Fandom Prefix (Dùng cho Auto-fill Data)</label>
                <div className="flex bg-gray-900 border border-gray-700 rounded-lg overflow-hidden focus-within:border-blue-500 transition">
                  <span className="bg-gray-800 text-gray-500 text-sm px-3 py-2.5 border-r border-gray-700 select-none">
                    https://
                  </span>
                  <input 
                    type="text" 
                    value={fandomPrefix}
                    onChange={(e) => setFandomPrefix(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
                    placeholder="e.g., jujutsu-kaisen..."
                    className="w-full bg-transparent p-2.5 text-sm outline-none text-white"
                  />
                  <span className="bg-gray-800 text-gray-500 text-sm px-3 py-2.5 border-l border-gray-700 select-none hidden sm:block">
                    .fandom.com
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-400 mb-1">Author</label>
                <input type="text" value={author} onChange={(e) => setAuthor(e.target.value)} className="w-full px-4 py-2.5 text-sm bg-gray-900 border border-gray-700 rounded-lg outline-none focus:border-blue-500 transition"/>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-400 mb-1">Release Status</label>
                <select value={mangaStatus} onChange={(e) => setMangaStatus(e.target.value)} className="w-full px-4 py-2.5 text-sm bg-gray-900 border border-gray-700 rounded-lg outline-none focus:border-blue-500 transition cursor-pointer">
                  <option value="ONGOING">Ongoing</option>
                  <option value="COMPLETED">Completed</option>
                </select>
              </div>
            </div>
          </div>

          {/* KHU VỰC TÓM TẮT DƯỚI CÙNG */}
          <div className="mt-6">
            <label className="block text-xs font-bold text-gray-400 mb-1">Description</label>
            <textarea rows={6} value={description} onChange={(e) => setDescription(e.target.value)} className="w-full px-4 py-3 text-sm bg-gray-900 border border-gray-700 rounded-lg outline-none focus:border-blue-500 resize-none transition"></textarea>
          </div>

          <div className="flex space-x-4 pt-6">
            <button type="submit" disabled={isSaving} className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl transition shadow-lg shadow-blue-600/20 disabled:opacity-50 flex justify-center items-center">
              {isSaving ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : "Save Changes"}
            </button>
            <Link href="/admin/manga" className="px-8 py-3 bg-gray-700 hover:bg-gray-600 text-sm font-bold text-center rounded-xl transition">
              Back
            </Link>
          </div>
        </form>
      </div>

      {/* CỘT PHẢI: QUẢN LÝ SỐ CHAPTER ĐÃ ĐĂNG */}
      <div className="bg-gray-800 p-6 rounded-2xl shadow-lg border border-gray-700 h-fit">
        
        {/* 🌟 THÊM NÚT NEW CHAPTER VÀO KHU VỰC HEADER */}
        <div className="flex justify-between items-center mb-4 border-b border-gray-700 pb-4">
          <h2 className="text-xl font-black text-purple-400">
            Chapters ({chapters.length})
          </h2>
          <Link 
            href={`/admin/manga/${mangaId}/upload-chapter`}
            className="bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold px-4 py-2 rounded-lg transition flex items-center gap-1 shadow-md"
          >
            + New Chapter
          </Link>
        </div>

        <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
          {chapters.map((chap) => (
            <div key={chap.id} className="flex justify-between items-center p-3.5 bg-gray-900/50 rounded-xl border border-gray-700/60 hover:border-blue-500 hover:bg-gray-900 transition group">
              <div>
                <span className="font-bold text-sm block text-gray-200">{chap.title}</span>
                <span className="text-xs text-gray-500">
                  {new Date(chap.createdAt).toLocaleDateString("vi-VN")}
                </span>
              </div>
              
              <div className="flex space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <Link 
                  href={`/admin/manga/${mangaId}/chapter/${chap.id}/edit`}
                  className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-3 py-1.5 rounded-md transition shadow-md"
                >
                  Edit
                </Link>
                
                <button 
                  onClick={() => handleDeleteChapter(chap.id, chap.title)}
                  className="bg-red-600 hover:bg-red-500 text-white text-xs font-bold px-3 py-1.5 rounded-md transition shadow-md"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
          {chapters.length === 0 && (
            <p className="text-sm text-gray-500 italic text-center py-8">No chapters have been published yet for this manga.</p>
          )}
        </div>
      </div>
    </div>
  );
}