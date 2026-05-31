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
  const animeId = params.id as string; 
  
  // State quản lý form
  const [animeTitle, setAnimeTitle] = useState("Đang tải dữ liệu phim...");
  const [episodeTitle, setEpisodeTitle] = useState("");
  const [episodeNumber, setEpisodeNumber] = useState<number | "">(""); 
  
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [subtitleInputs, setSubtitleInputs] = useState<SubtitleInput[]>([]);
  const [loading, setLoading] = useState(false);

  // Theo dõi tiến độ Upload (%)
  const [uploadProgress, setUploadProgress] = useState(0);

  // State lưu Manga ID để phục vụ việc liên kết
  const [mangaId, setMangaId] = useState<string | null>(null);
  const [mappedIds, setMappedIds] = useState<string[]>([]);
  const [isMapping, setIsMapping] = useState(false);
  const [allMangas, setAllMangas] = useState<{id: string, title: string}[]>([]);
  const [availableChapters, setAvailableChapters] = useState<{id: string, title: string}[]>([]);

  // 1. Tự động lấy tên Anime và Manga ID liên kết
  useEffect(() => {
    fetch(`http://localhost:5000/api/admin/anime/${animeId}`)
      .then(res => res.json())
      .then(data => {
        if (data && data.title) {
          setAnimeTitle(data.title);
          if (data.mangaId) setMangaId(data.mangaId);
        } else {
          setAnimeTitle("Không tìm thấy dữ liệu phim");
        }
      })
      .catch(() => setAnimeTitle("Lỗi kết nối server"));
  }, [animeId]);

  // 2. Lấy danh sách Manga
  useEffect(() => {
    fetch("http://localhost:5000/api/manga") 
      .then(res => res.json())
      .then(data => {
         const mangaList = Array.isArray(data) ? data : (data.mangas || []);
         setAllMangas(mangaList);
      })
      .catch(err => console.error("Lỗi tải danh sách Manga:", err));
  }, []);

  // ➕ 3. HÀM MỚI: Tự động tải danh sách Chapter khi Manga ID thay đổi
  useEffect(() => {
    // Bọc logic vào một hàm async để tránh lỗi "synchronous setState"
    const fetchChapters = async () => {
      if (!mangaId) {
        setAvailableChapters([]); // Lúc này gọi an toàn vì nó nằm trong hàm async
        return;
      }
      
      try {
        const res = await fetch(`http://localhost:5000/api/admin/manga/${mangaId}/chapters`);
        const data = await res.json();
        setAvailableChapters(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("Lỗi tải chapters:", err);
      }
    };

    // Gọi hàm thực thi
    fetchChapters();
  }, [mangaId]);

  // ➕ 4. HÀM MỚI: Xử lý khi click chọn/bỏ chọn Chapter thủ công
  const toggleChapterSelection = (chapterId: string) => {
    if (mappedIds.includes(chapterId)) {
      setMappedIds(mappedIds.filter(id => id !== chapterId));
    } else {
      setMappedIds([...mappedIds, chapterId]);
    }
  };

  const addSubtitleField = () => {
    setSubtitleInputs([...subtitleInputs, { id: Math.random().toString(36).substring(2, 9), label: "Vietnamese", file: null }]);
  };

  const removeSubtitleField = (id: string) => {
    setSubtitleInputs(subtitleInputs.filter(item => item.id !== id));
  };

  const updateSubtitleField = (id: string, key: "label" | "file", value: string | File | null) => {
    setSubtitleInputs(subtitleInputs.map(item => item.id === id ? { ...item, [key]: value } : item));
  };

  const handleAutoMap = async () => {
    if (!mangaId) return alert("Bộ Anime này chưa được liên kết với bộ Manga nào trong hệ thống!");
    if (!episodeNumber) return alert("Vui lòng nhập số tập (Episode Number) trước khi dùng AI!");

    setIsMapping(true);
    try {
      const res = await fetch("http://localhost:5000/api/admin/auto-map-chapters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ animeName: animeTitle, episodeNumber: Number(episodeNumber), mangaId })
      });
      const data = await res.json();
      
      if (res.ok) {
        setMappedIds(data.mappedChapterIds);
        if (data.foundNumbers && data.foundNumbers.length > 0) {
           alert(`✨ AI tìm thấy các chapter số: ${data.foundNumbers.join(', ')}`);
        } else {
           alert(`✨ AI báo đây là tập Filler, không có Manga tương ứng!`);
        }
      } else {
        alert(data.message || "Lỗi AI mapping");
      }
    } catch (error) {
      console.error(error);
      alert("Lỗi kết nối đến server AI.");
    } finally {
      setIsMapping(false);
    }
  };

  // Tải file lên và theo dõi % bằng XMLHttpRequest
  const uploadFileWithProgress = (url: string, file: Blob): Promise<void> => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", url, true);

      // Theo dõi tiến trình tải lên
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percentComplete = Math.round((event.loaded / event.total) * 100);
          setUploadProgress(percentComplete); // Cập nhật State %
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve();
        } else {
          reject(new Error(`Upload failed with status ${xhr.status}`));
        }
      };

      xhr.onerror = () => reject(new Error("Network error during upload"));
      xhr.send(file);
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!videoFile) return alert("Please select a video file!");
    if (episodeNumber === "") return alert("Please enter the episode number!");

    setLoading(true);
    setUploadProgress(0); // Reset thanh tiến độ về 0%

    try {
      // --- PHẦN A: UPLOAD VIDEO ---
      const safeVideoType = videoFile.type || "application/octet-stream";
      const urlRes = await fetch("http://localhost:5000/api/admin/get-upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: videoFile.name, fileType: safeVideoType })
      });
      const urlData = await urlRes.json();
      if (!urlRes.ok) throw new Error(`Video Permission Error: ${urlData.message}`);

      const videoBlob = new Blob([videoFile], { type: safeVideoType });

      // GỌI HÀM XHR ĐỂ UPLOAD VÀ LẤY %
      await uploadFileWithProgress(urlData.uploadUrl, videoBlob);
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
              body: currentFile 
            });
            
            if (!uploadSubRes.ok) throw new Error("Error uploading subtitles");
            return { label: sub.label, url: subUrlData.publicUrl };
          })
      );

      // --- PHẦN C: LƯU VÀO DATABASE ---
      const backendRes = await fetch("http://localhost:5000/api/admin/episode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          animeId: animeId, 
          title: episodeTitle,
          episodeNumber: Number(episodeNumber), 
          videoUrl: finalVideoUrl,
          subtitles: uploadedSubtitles,
          mappedChapterIds: mappedIds 
        })
      });

      if (!backendRes.ok) throw new Error("Error saving data to the system");

      alert("Successfully uploaded the new episode!");
      router.push(`/admin/anime/${animeId}`);
      
    } catch (error) {
      if (error instanceof Error) {
        alert(`Error: ${error.message}`);
      } else {
        alert("Undefined upload error!");
      }
    } finally {
      setLoading(false);
      setUploadProgress(0); // Reset khi xong
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-3xl mx-auto bg-gray-800 p-8 rounded-2xl shadow-xl border border-gray-700">
        <div className="flex justify-between items-center mb-6 border-b border-gray-700 pb-4">
          <div>
            <h1 className="text-2xl font-black text-purple-400">Upload New Episode</h1>
            <p className="text-gray-400 text-sm mt-1">Anime: <span className="text-white font-bold">{animeTitle}</span></p>
          </div>
          <Link href="/admin/anime" className="text-sm text-gray-400 hover:text-white">&larr; Back to Anime List</Link>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="col-span-1">
              <label className="block text-sm font-semibold text-gray-300 mb-2">Ep Number (*)</label>
              <input
                type="number" required min="0" placeholder="Ex: 1"
                value={episodeNumber}
                onChange={(e) => setEpisodeNumber(e.target.value === "" ? "" : Number(e.target.value))}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white outline-none focus:border-purple-500"
              />
            </div>
            
            <div className="col-span-1 md:col-span-3">
              <label className="block text-sm font-semibold text-gray-300 mb-2">Episode Title (*)</label>
              <input
                type="text" required placeholder="Example: A New Beginning"
                value={episodeTitle} onChange={(e) => setEpisodeTitle(e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white outline-none focus:border-purple-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-2">Video file (Accepts .mp4, .mkv) (*)</label>
            <input
              type="file" required accept=".mp4,.mkv"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) setVideoFile(e.target.files[0]);
              }}
              className="block w-full text-sm text-gray-400 file:mr-4 file:py-2.5 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-purple-600 file:text-white hover:file:bg-purple-700 cursor-pointer"
            />
          </div>

          {/* KHU VỰC LIÊN KẾT MANGA - GIAO DIỆN NÚT BẤM MỚI */}
          <div className="border border-indigo-900/50 bg-indigo-900/10 p-5 rounded-xl space-y-4">
             <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <label className="block text-sm font-semibold text-indigo-300">Sync with Manga (Optional)</label>
                  {!mangaId ? (
                    <div className="mt-2 flex flex-col gap-1">
                      <span className="text-xs text-red-400 italic">* Chưa tìm thấy Manga liên kết. Vui lòng chọn thủ công:</span>
                      <select 
                        className="bg-gray-900 text-white text-sm px-3 py-1.5 rounded border border-gray-600 outline-none focus:border-indigo-500"
                        onChange={(e) => setMangaId(e.target.value)}
                        value={mangaId || ""}
                      >
                        <option value="">-- Chọn bộ Manga để liên kết --</option>
                        {allMangas.map(m => (
                          <option key={m.id} value={m.id}>{m.title}</option>
                        ))}
                      </select>
                    </div>
                  ) : (
                     <span className="text-xs text-green-400 font-bold block mt-1">✓ Đã liên kết với Manga ID</span>
                  )}
                </div>

                <button 
                  type="button" onClick={handleAutoMap}
                  disabled={isMapping || !episodeNumber || !mangaId}
                  className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 text-white text-sm font-bold px-4 py-2 rounded-lg transition shrink-0 shadow-lg shadow-indigo-500/20"
                >
                  {isMapping ? "✨ AI đang phân tích..." : "✨ Auto Map bằng AI"}
                </button>
             </div>
             
             {/* Danh sách các nút Chapter */}
             <div className="mt-4 border-t border-indigo-900/50 pt-4">
                <label className="block text-sm text-indigo-300 mb-3 font-medium">
                  Các chapter tương ứng: <span className="text-xs text-gray-400 italic">(Nhấn để chọn thủ công hoặc dùng nút AI ở trên)</span>
                </label>
                
                {availableChapters.length === 0 ? (
                  <p className="text-sm text-gray-500 italic">Vui lòng chọn bộ Manga để xem danh sách chapter...</p>
                ) : (
                  <div className="flex flex-wrap gap-2 max-h-[200px] overflow-y-auto custom-scrollbar p-1">
                    {availableChapters.map(chapter => {
                      const isSelected = mappedIds.includes(chapter.id);
                      
                      return (
                        <button
                          key={chapter.id}
                          type="button"
                          onClick={() => toggleChapterSelection(chapter.id)}
                          className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all duration-200 ${
                            isSelected 
                              ? "bg-indigo-600 border-indigo-400 text-white shadow-[0_0_10px_rgba(79,70,229,0.5)]" 
                              : "bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700 hover:text-white"
                          }`}
                        >
                          {isSelected ? "✓ " : ""}{chapter.title}
                        </button>
                      )
                    })}
                  </div>
                )}
             </div>
          </div>

          <div className="border-t border-gray-700 pt-6">
            <div className="flex justify-between items-center mb-4">
              <label className="block text-sm font-semibold text-gray-300">Subtitle files (Optional)</label>
              <button
                type="button" onClick={addSubtitleField}
                className="bg-gray-700 hover:bg-gray-600 text-xs font-bold px-3 py-1.5 rounded-lg transition text-purple-400"
              >
                + Add subtitle file
              </button>
            </div>

            <div className="space-y-4">
              {subtitleInputs.map((sub) => (
                <div key={sub.id} className="flex flex-col sm:flex-row items-center gap-4 bg-gray-900/60 p-4 rounded-xl border border-gray-700">
                  <input
                    type="text" required placeholder="Subtitle label (e.g., Vietnamese)"
                    value={sub.label} onChange={(e) => updateSubtitleField(sub.id, "label", e.target.value)}
                    className="w-full sm:w-1/3 bg-gray-800 border border-gray-700 rounded-lg p-2 text-sm text-white outline-none"
                  />
                  <input
                    type="file" required accept=".srt,.ass,.vtt"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) updateSubtitleField(sub.id, "file", e.target.files[0]);
                    }}
                    className="w-full flex-1 text-xs text-gray-400 file:mr-2 file:py-1 file:px-3 file:rounded file:border-0 file:bg-gray-700 file:text-gray-300 hover:file:bg-gray-600"
                  />
                  <button
                    type="button" onClick={() => removeSubtitleField(sub.id)}
                    className="bg-red-900/30 hover:bg-red-600 text-red-400 hover:text-white w-8 h-8 rounded-full font-bold text-sm transition"
                  >✕</button>
                </div>
              ))}
            </div>
          </div>

          {/* ========================================== */}
          {/* KHU VỰC NÚT SUBMIT & THANH TIẾN ĐỘ UPLOAD */}
          {/* ========================================== */}
          <div className="mt-8 pt-4">
            {loading && uploadProgress > 0 ? (
              <div className="w-full bg-gray-800 rounded-xl p-4 border border-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.2)]">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-bold text-purple-400 animate-pulse">Đang tải video lên Cloudflare R2...</span>
                  <span className="text-sm font-black text-white">{uploadProgress}%</span>
                </div>
                
                {/* Thanh Progress Bar */}
                <div className="w-full bg-gray-900 rounded-full h-4 overflow-hidden relative border border-gray-700">
                  <div 
                    className="bg-gradient-to-r from-purple-600 to-blue-500 h-4 rounded-full transition-all duration-300 ease-out"
                    style={{ width: `${uploadProgress}%` }}
                  ></div>
                </div>
                
                <p className="text-xs text-gray-400 mt-3 text-center italic">Vui lòng không đóng tab trình duyệt trong lúc tải.</p>
              </div>
            ) : (
              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl shadow-lg transition disabled:opacity-50 flex justify-center items-center text-lg"
              >
                {loading ? "Đang chuẩn bị Upload..." : "🚀 Upload New Episode"}
              </button>
            )}
          </div>

        </form>
      </div>
    </div>
  );
}