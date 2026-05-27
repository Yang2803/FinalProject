"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";

interface SubtitleInput {
  id: string;
  label: string;
  file: File | null;
}

interface OldSubtitle {
  id: string;
  label: string;
  url: string;
}

export default function EditEpisodePage() {
  const router = useRouter();
  const params = useParams();
  const animeId = params.id as string;
  const episodeId = params.episodeId as string;
  
  const [episodeTitle, setEpisodeTitle] = useState("");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  
  // State quản lý phụ đề
  const [oldSubtitles, setOldSubtitles] = useState<OldSubtitle[]>([]);
  const [subtitleInputs, setSubtitleInputs] = useState<SubtitleInput[]>([]);
  
  const [loadingData, setLoadingData] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 1. Tải dữ liệu tập phim (Bao gồm cả phụ đề cũ)
  useEffect(() => {
    const fetchEpisode = async () => {
      try {
        const res = await fetch(`http://localhost:5000/api/admin/episode-detail/${episodeId}`);
        if (res.ok) {
          const data = await res.json();
          setEpisodeTitle(data.title);
          if (data.subtitles) setOldSubtitles(data.subtitles);
        } else {
          alert("Không tìm thấy tập phim!");
          router.push(`/admin/anime/${animeId}`);
        }
      } catch (error) {
        console.error("Lỗi:", error);
      } finally {
        setLoadingData(false);
      }
    };
    fetchEpisode();
  }, [episodeId, animeId, router]);

  // Các hàm hỗ trợ thêm/xóa dòng phụ đề mới trên UI
  const addSubtitleField = () => {
    setSubtitleInputs([...subtitleInputs, { id: Math.random().toString(36).substring(2, 9), label: "Tiếng Việt", file: null }]);
  };

  const removeSubtitleField = (id: string) => {
    setSubtitleInputs(subtitleInputs.filter(item => item.id !== id));
  };

  const updateSubtitleField = (id: string, key: "label" | "file", value: string | File | null) => {
    setSubtitleInputs(subtitleInputs.map(item => item.id === id ? { ...item, [key]: value } : item));
  };

  // 2. Nút Lưu Thay Đổi
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      let newVideoUrl = null;

      // --- A: UPLOAD VIDEO MỚI (NẾU CÓ) ---
      if (videoFile) {
        const safeVideoType = videoFile.type || "application/octet-stream";
        const urlRes = await fetch("http://localhost:5000/api/admin/get-upload-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fileName: videoFile.name, fileType: safeVideoType })
        });
        const urlData = await urlRes.json();
        
        const videoBlob = new Blob([videoFile], { type: safeVideoType });
        await fetch(urlData.uploadUrl, { method: "PUT", body: videoBlob });
        newVideoUrl = urlData.publicUrl;
      }

      // --- B: UPLOAD PHỤ ĐỀ MỚI (NẾU CÓ) ---
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
            
            await fetch(subUrlData.uploadUrl, { method: "PUT", body: currentFile });
            return { label: sub.label, url: subUrlData.publicUrl };
          })
      );

      // --- C: GỬI LÊN BACKEND ---
      const backendRes = await fetch(`http://localhost:5000/api/admin/episode/${episodeId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: episodeTitle,
          videoUrl: newVideoUrl,
          // Chỉ gửi mảng newSubtitles nếu người dùng thực sự có up file mới
          newSubtitles: uploadedSubtitles.length > 0 ? uploadedSubtitles : undefined
        })
      });

      if (!backendRes.ok) throw new Error("Lỗi lưu dữ liệu cập nhật");

      alert("Cập nhật tập phim thành công!");
      router.push(`/admin/anime/${animeId}`);

    } catch (error) {
      alert(error instanceof Error ? `Lỗi: ${error.message}` : "Có lỗi xảy ra");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loadingData) return <div className="text-white text-center mt-20">Loading data...</div>;

  return (
    <div className="min-h-screen bg-[#0f0f11] text-white p-8">
      <div className="max-w-2xl mx-auto bg-gray-800 p-8 rounded-2xl shadow-xl border border-gray-700">
        <div className="flex justify-between items-center mb-6 border-b border-gray-700 pb-4">
          <h1 className="text-2xl font-black text-blue-400">Edit Episode</h1>
          <Link href={`/admin/anime/${animeId}`} className="text-sm text-gray-400 hover:text-white transition">&larr; Back to Anime</Link>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Tên tập */}
          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-2">Episode Name</label>
            <input
              type="text"
              required
              value={episodeTitle}
              onChange={(e) => setEpisodeTitle(e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white outline-none focus:border-blue-500"
            />
          </div>

          {/* Thay video */}
          <div className="bg-gray-900/50 p-4 rounded-xl border border-gray-700 border-dashed">
            <label className="block text-sm font-semibold text-yellow-400 mb-2">
              🎬 Re-upload Video (Skip if keeping the same video)
            </label>
            <input
              type="file"
              accept=".mp4,.mkv"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) setVideoFile(e.target.files[0]);
              }}
              className="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:bg-gray-700 file:text-white hover:file:bg-gray-600 cursor-pointer"
            />
          </div>

          {/* KHU VỰC PHỤ ĐỀ */}
          <div className="border-t border-gray-700 pt-6">
            
            {/* Hiển thị phụ đề cũ */}
            <div className="mb-4">
              <label className="block text-sm font-semibold text-gray-300 mb-2">Subtitles are currently available:</label>
              {oldSubtitles.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {oldSubtitles.map(sub => (
                    <span key={sub.id} className="bg-gray-700 px-3 py-1 rounded text-xs text-gray-300">{sub.label}</span>
                  ))}
                </div>
              ) : (
                <span className="text-xs text-gray-500 italic">This episode does not have any subtitles available.</span>
              )}
            </div>

            {/* Up phụ đề mới */}
            <div className="bg-gray-900/50 p-4 rounded-xl border border-gray-700 border-dashed mt-4">
              <div className="flex justify-between items-center mb-4">
                <label className="block text-sm font-semibold text-yellow-400">
                  📝 Replace all subtitles (Skip if keeping the same)
                </label>
                <button
                  type="button"
                  onClick={addSubtitleField}
                  className="bg-gray-700 hover:bg-gray-600 text-xs font-bold px-3 py-1.5 rounded-lg transition text-blue-400"
                >
                  + Add file
                </button>
              </div>

              {subtitleInputs.length > 0 && <p className="text-xs text-red-400 mb-3 italic">Note: Uploading new subtitles will delete all old subtitles.</p>}

              <div className="space-y-3">
                {subtitleInputs.map((sub) => (
                  <div key={sub.id} className="flex flex-col sm:flex-row items-center gap-3">
                    <input
                      type="text"
                      required
                      placeholder="Nhãn (VD: Tiếng Việt)"
                      value={sub.label}
                      onChange={(e) => updateSubtitleField(sub.id, "label", e.target.value)}
                      className="w-full sm:w-1/3 bg-gray-800 border border-gray-700 rounded p-2 text-sm text-white outline-none"
                    />
                    <input
                      type="file"
                      required
                      accept=".srt,.ass,.vtt"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) updateSubtitleField(sub.id, "file", e.target.files[0]);
                      }}
                      className="w-full flex-1 text-xs text-gray-400 file:mr-2 file:py-1 file:px-3 file:rounded file:border-0 file:bg-gray-700 file:text-gray-300 cursor-pointer"
                    />
                    <button type="button" onClick={() => removeSubtitleField(sub.id)} className="text-red-400 hover:text-red-300 font-bold text-xl">×</button>
                  </div>
                ))}
              </div>
            </div>

          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition disabled:opacity-50"
          >
            {isSubmitting ? "Processing & Saving..." : "Save Changes"}
          </button>
        </form>
      </div>
    </div>
  );
}