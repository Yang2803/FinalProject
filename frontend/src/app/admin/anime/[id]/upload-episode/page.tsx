"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";

interface SubtitleInput {
  id: string;
  label: string;
  file: File | null;
}

export default function UploadEpisodePage() {
  const router = useRouter();
  const params = useParams();
  const animeId = params.id as string; // <--- LẤY ID TỪ URL
  
  // State quản lý form
  const [animeTitle, setAnimeTitle] = useState("Đang tải dữ liệu phim...");
  const [episodeTitle, setEpisodeTitle] = useState("");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [subtitleInputs, setSubtitleInputs] = useState<SubtitleInput[]>([]);
  const [loading, setLoading] = useState(false);

  // 1. Tự động lấy tên Anime dựa vào ID trên URL để hiển thị cho đẹp
  useEffect(() => {
    fetch(`http://localhost:5000/api/admin/anime/${animeId}`)
      .then(res => res.json())
      .then(data => {
        if (data && data.title) setAnimeTitle(data.title);
        else setAnimeTitle("Không tìm thấy dữ liệu phim");
      })
      .catch(() => setAnimeTitle("Lỗi kết nối server"));
  }, [animeId]);

  // 2. Các hàm bổ trợ phụ đề
  const addSubtitleField = () => {
    const newField: SubtitleInput = {
      id: Math.random().toString(36).substring(2, 9),
      label: "Tiếng Việt",
      file: null
    };
    setSubtitleInputs([...subtitleInputs, newField]);
  };

  const removeSubtitleField = (id: string) => {
    setSubtitleInputs(subtitleInputs.filter(item => item.id !== id));
  };

  const updateSubtitleField = (id: string, key: "label" | "file", value: string | File | null) => {
    setSubtitleInputs(subtitleInputs.map(item => {
      if (item.id === id) return { ...item, [key]: value };
      return item;
    }));
  };

  // 3. Hàm Submit đẩy lên Cloudflare R2
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!videoFile) return alert("Vui lòng chọn file video!");

    setLoading(true);

    try {
      // --- PHẦN A: UPLOAD VIDEO ---
      const safeVideoType = videoFile.type || "application/octet-stream";

      const urlRes = await fetch("http://localhost:5000/api/admin/get-upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: videoFile.name, fileType: safeVideoType })
      });
      const urlData = await urlRes.json();
      if (!urlRes.ok) throw new Error(`Lỗi cấp quyền Video: ${urlData.message}`);

      // Bọc Blob để vượt lỗi Cloudflare R2
      const videoBlob = new Blob([videoFile], { type: safeVideoType });

      const uploadVideoRes = await fetch(urlData.uploadUrl, {
        method: "PUT",
        body: videoBlob // Headerless PUT
      });
      
      if (!uploadVideoRes.ok) throw new Error("Lỗi khi tải video lên R2");
      const finalVideoUrl = urlData.publicUrl;

      // --- PHẦN B: UPLOAD SUBTITLES ---
      const uploadedSubtitles = await Promise.all(
        subtitleInputs
          .filter((sub) => sub.file !== null)
          .map(async (sub) => {
            const currentFile = sub.file as File;
            const safeSubType = currentFile.type || "text/plain";
            
            const subUrlRes = await fetch("http://localhost:5000/api/admin/get-upload-url", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ fileName: currentFile.name, fileType: safeSubType })
            });
            const subUrlData = await subUrlRes.json();

            const uploadSubRes = await fetch(subUrlData.uploadUrl, {
              method: "PUT",
              body: currentFile // Headerless PUT
            });
            
            if (!uploadSubRes.ok) throw new Error("Lỗi tải phụ đề");
            return { label: sub.label, url: subUrlData.publicUrl };
          })
      );

      // --- PHẦN C: LƯU VÀO DATABASE ---
      const backendRes = await fetch("http://localhost:5000/api/admin/episode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          animeId: animeId, // Đã tự có ID từ URL
          title: episodeTitle,
          videoUrl: finalVideoUrl,
          subtitles: uploadedSubtitles
        })
      });

      if (!backendRes.ok) throw new Error("Lỗi lưu dữ liệu vào hệ thống");

      alert("Tải lên tập phim mới thành công!");
      router.push(`/admin/anime/${animeId}`);
      setEpisodeTitle("");
      setVideoFile(null);
      setSubtitleInputs([]);

    } catch (error) {
      if (error instanceof Error) {
        alert(`Lỗi: ${error.message}`);
      } else {
        alert("Lỗi upload không xác định!");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-3xl mx-auto bg-gray-800 p-8 rounded-2xl shadow-xl border border-gray-700">
        <div className="flex justify-between items-center mb-6 border-b border-gray-700 pb-4">
          <div>
            <h1 className="text-2xl font-black text-purple-400">Đăng Tập Phim Anime</h1>
            <p className="text-gray-400 text-sm mt-1">Phim: <span className="text-white font-bold">{animeTitle}</span></p>
          </div>
          <Link href="/admin/anime" className="text-sm text-gray-400 hover:text-white">&larr; Trở về</Link>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Ô NHẬP TÊN TẬP PHIM */}
          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-2">Tên tập phim (*)</label>
            <input
              type="text"
              required
              placeholder="Ví dụ: Tập 01: Khởi đầu mới"
              value={episodeTitle}
              onChange={(e) => setEpisodeTitle(e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white outline-none focus:border-purple-500"
            />
          </div>

          {/* Ô CHỌN FILE VIDEO */}
          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-2">Tệp Video (Chấp nhận .mp4, .mkv) (*)</label>
            <input
              type="file"
              required
              accept=".mp4,.mkv"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) setVideoFile(e.target.files[0]);
              }}
              className="block w-full text-sm text-gray-400 file:mr-4 file:py-2.5 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-purple-600 file:text-white hover:file:bg-purple-700 cursor-pointer"
            />
          </div>

          {/* KHU VỰC PHỤ ĐỀ */}
          <div className="border-t border-gray-700 pt-6">
            <div className="flex justify-between items-center mb-4">
              <label className="block text-sm font-semibold text-gray-300">Tệp Phụ đề (Tùy chọn)</label>
              <button
                type="button"
                onClick={addSubtitleField}
                className="bg-gray-700 hover:bg-gray-600 text-xs font-bold px-3 py-1.5 rounded-lg transition text-purple-400"
              >
                + Thêm dòng phụ đề
              </button>
            </div>

            <div className="space-y-4">
              {subtitleInputs.map((sub) => (
                <div key={sub.id} className="flex flex-col sm:flex-row items-center gap-4 bg-gray-900/60 p-4 rounded-xl border border-gray-700">
                  <input
                    type="text"
                    required
                    placeholder="Nhãn sub (VD: Tiếng Việt)"
                    value={sub.label}
                    onChange={(e) => updateSubtitleField(sub.id, "label", e.target.value)}
                    className="w-full sm:w-1/3 bg-gray-800 border border-gray-700 rounded-lg p-2 text-sm text-white outline-none"
                  />
                  <input
                    type="file"
                    required
                    accept=".srt,.ass"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        updateSubtitleField(sub.id, "file", e.target.files[0]);
                      }
                    }}
                    className="w-full flex-1 text-xs text-gray-400 file:mr-2 file:py-1 file:px-3 file:rounded file:border-0 file:bg-gray-700 file:text-gray-300 hover:file:bg-gray-600"
                  />
                  <button
                    type="button"
                    onClick={() => removeSubtitleField(sub.id)}
                    className="bg-red-900/30 hover:bg-red-600 text-red-400 hover:text-white w-8 h-8 rounded-full font-bold text-sm transition"
                  >✕</button>
                </div>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 mt-4 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl shadow-lg transition disabled:opacity-50 flex justify-center"
          >
            {loading ? "Đang xử lý tải lên..." : "Phát Hành Tập Phim Mới"}
          </button>
        </form>
      </div>
    </div>
  );
}