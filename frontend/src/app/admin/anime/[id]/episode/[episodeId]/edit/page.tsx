"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";

export default function EditEpisodePage() {
  const router = useRouter();
  const params = useParams();
  const animeId = params.id as string;
  const episodeId = params.episodeId as string;
  
  const [episodeTitle, setEpisodeTitle] = useState("");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  
  const [loadingData, setLoadingData] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  console.log("Anime ID là:", animeId);
  console.log("Episode ID là:", episodeId);

  // 1. Lấy dữ liệu tập phim cũ để điền vào form
  // Xóa bỏ dòng import useCallback ở trên cùng (nếu muốn cho code gọn)
  // import { useState, useEffect } from "react";

  // Gom toàn bộ logic vào thẳng bên trong useEffect
  useEffect(() => {
    const fetchEpisode = async () => {
      try {
        const res = await fetch(`http://localhost:5000/api/admin/episode-detail/${episodeId}`);
        if (res.ok) {
          const data = await res.json();
          setEpisodeTitle(data.title);
        } else {
          alert("Không tìm thấy tập phim!");
          router.push(`/admin/anime/${animeId}`);
        }
      } catch (error) {
        console.error("Lỗi:", error);
      } finally {
        // Cập nhật state sau khi fetch xong
        setLoadingData(false);
      }
    };

    fetchEpisode();
  }, [episodeId, animeId, router]);

  // 2. Submit Cập nhật
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      let newVideoUrl = null;

      // Nếu Admin có chọn file video mới -> Up lên Cloudflare R2
      if (videoFile) {
        const safeVideoType = videoFile.type || "application/octet-stream";
        
        // Xin link
        const urlRes = await fetch("http://localhost:5000/api/admin/get-upload-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fileName: videoFile.name, fileType: safeVideoType })
        });
        const urlData = await urlRes.json();
        if (!urlRes.ok) throw new Error("Lỗi cấp quyền tải Video");

        // Đẩy lên R2
        const videoBlob = new Blob([videoFile], { type: safeVideoType });
        const uploadVideoRes = await fetch(urlData.uploadUrl, {
          method: "PUT",
          body: videoBlob 
        });
        
        if (!uploadVideoRes.ok) throw new Error("Lỗi tải video lên Cloudflare R2");
        newVideoUrl = urlData.publicUrl;
      }

      // Gửi data về Backend (Nếu newVideoUrl = null thì Backend sẽ tự hiểu là giữ nguyên link cũ)
      const backendRes = await fetch(`http://localhost:5000/api/admin/episode/${episodeId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: episodeTitle,
          videoUrl: newVideoUrl
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

  if (loadingData) return <div className="text-white text-center mt-20">Đang tải dữ liệu...</div>;

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-2xl mx-auto bg-gray-800 p-8 rounded-2xl shadow-xl border border-gray-700">
        <div className="flex justify-between items-center mb-6 border-b border-gray-700 pb-4">
          <h1 className="text-2xl font-black text-blue-400">Chỉnh Sửa Tập Phim</h1>
          <Link href={`/admin/anime/${animeId}`} className="text-sm text-gray-400 hover:text-white">&larr; Trở về</Link>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-2">Tên tập phim</label>
            <input
              type="text"
              required
              value={episodeTitle}
              onChange={(e) => setEpisodeTitle(e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white outline-none focus:border-blue-500"
            />
          </div>

          <div className="bg-gray-900/50 p-4 rounded-xl border border-gray-700 border-dashed">
            <label className="block text-sm font-semibold text-gray-300 mb-2 text-yellow-400">
              Up lại Video khác (Bỏ qua nếu giữ nguyên video cũ)
            </label>
            <input
              type="file"
              accept=".mp4,.mkv"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) setVideoFile(e.target.files[0]);
              }}
              className="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:bg-gray-700 file:text-white hover:file:bg-gray-600 cursor-pointer"
            />
            {videoFile && <p className="text-xs text-green-400 mt-2">✓ Sẽ thay thế bằng: {videoFile.name}</p>}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition disabled:opacity-50"
          >
            {isSubmitting ? "Đang xử lý & Lưu..." : "Lưu Thay Đổi"}
          </button>
        </form>
      </div>
    </div>
  );
}