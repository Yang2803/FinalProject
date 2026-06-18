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
  
  const [animeTitle, setAnimeTitle] = useState("Loading...");
  const [episodeTitle, setEpisodeTitle] = useState("");
  const [episodeNumber, setEpisodeNumber] = useState<number | "">(""); 
  const [videoFile, setVideoFile] = useState<File | null>(null);
  
  // State quản lý liên kết Manga
  const [mangaId, setMangaId] = useState<string | null>(null);
  const [mappedIds, setMappedIds] = useState<string[]>([]);
  const [isMapping, setIsMapping] = useState(false);
  const [allMangas, setAllMangas] = useState<{id: string, title: string}[]>([]);
  const [availableChapters, setAvailableChapters] = useState<{id: string, title: string}[]>([]);

  // 🌟 STATE "TÀNG HÌNH": Chỉ dùng để chứa dữ liệu chạy Auto Map, không hiển thị ra UI
  const [adaptedFrom, setAdaptedFrom] = useState("");

  // State quản lý phụ đề
  const [oldSubtitles, setOldSubtitles] = useState<OldSubtitle[]>([]);
  const [subtitleInputs, setSubtitleInputs] = useState<SubtitleInput[]>([]);
  
  const [loadingData, setLoadingData] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Theo dõi tiến độ Upload (%)
  const [uploadProgress, setUploadProgress] = useState(0);

  // 1. Tải dữ liệu ban đầu (Anime, Tập phim, Danh sách Manga)
  useEffect(() => {
    const fetchAllData = async () => {
      try {
        const animeRes = await fetch(`http://localhost:5000/api/admin/anime/${animeId}`);
        if (animeRes.ok) {
          const animeData = await animeRes.json();
          setAnimeTitle(animeData.title);
          if (animeData.mangaId) setMangaId(animeData.mangaId);
        }

        const epRes = await fetch(`http://localhost:5000/api/admin/episode-detail/${episodeId}`);
        if (epRes.ok) {
          const epData = await epRes.json();
          setEpisodeTitle(epData.title);
          if (epData.episodeNumber !== undefined) setEpisodeNumber(epData.episodeNumber);
          if (epData.mappedChapterIds) setMappedIds(epData.mappedChapterIds);
          if (epData.subtitles) setOldSubtitles(epData.subtitles);
          
          // 🌟 LẤY DỮ LIỆU TỪ DATABASE VÀ LƯU VÀO STATE NGẦM
          if (epData.adaptedFrom) setAdaptedFrom(epData.adaptedFrom);
        } else {
          alert("Không tìm thấy tập phim!");
          router.push(`/admin/anime/${animeId}`);
        }

        const mangaRes = await fetch("http://localhost:5000/api/manga");
        if (mangaRes.ok) {
          const mangaData = await mangaRes.json();
          const mangaList = Array.isArray(mangaData) ? mangaData : (mangaData.mangas || []);
          setAllMangas(mangaList);
        }
      } catch (error) {
        console.error("Lỗi tải dữ liệu ban đầu:", error);
      } finally {
        setLoadingData(false);
      }
    };
    fetchAllData();
  }, [episodeId, animeId, router]);

  // 2. Tự động tải danh sách Chapter khi Manga ID thay đổi
  useEffect(() => {
    const fetchChapters = async () => {
      if (!mangaId) {
        setAvailableChapters([]);
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
    fetchChapters();
  }, [mangaId]);

  // Các hàm hỗ trợ
  const toggleChapterSelection = (chapterId: string) => {
    if (mappedIds.includes(chapterId)) {
      setMappedIds(mappedIds.filter(id => id !== chapterId));
    } else {
      setMappedIds([...mappedIds, chapterId]);
    }
  };

  const addSubtitleField = () => {
    setSubtitleInputs([...subtitleInputs, { id: Math.random().toString(36).substring(2, 9), label: "Tiếng Việt", file: null }]);
  };

  const removeSubtitleField = (id: string) => {
    setSubtitleInputs(subtitleInputs.filter(item => item.id !== id));
  };

  const updateSubtitleField = (id: string, key: "label" | "file", value: string | File | null) => {
    setSubtitleInputs(subtitleInputs.map(item => item.id === id ? { ...item, [key]: value } : item));
  };

  const handleAutoMap = async () => {
    if (!mangaId) return alert("Vui lòng chọn bộ Manga liên kết trước!");
    if (!episodeNumber) return alert("Vui lòng nhập số tập (Ep Number) trước!");

    setIsMapping(true);
    try {
      const res = await fetch("http://localhost:5000/api/admin/auto-map-chapters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // 🌟 BƠM BIẾN TÀNG HÌNH adaptedFrom VÀO PAYLOAD ĐỂ GỬI LÊN BACKEND CHUẨN XÁC NHƯ BÊN UPLOAD
        body: JSON.stringify({ animeName: animeTitle, episodeNumber: Number(episodeNumber), mangaId, adaptedFrom })
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
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percentComplete = Math.round((event.loaded / event.total) * 100);
          setUploadProgress(percentComplete);
        }
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) resolve();
        else reject(new Error(`Upload failed with status ${xhr.status}`));
      };
      xhr.onerror = () => reject(new Error("Network error during upload"));
      xhr.send(file);
    });
  };

  // Nút Lưu Thay Đổi
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setUploadProgress(0);

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
        
        // DÙNG HÀM XHR ĐỂ LẤY PROGRESS BAR
        await uploadFileWithProgress(urlData.uploadUrl, videoBlob);
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
          episodeNumber: episodeNumber === "" ? undefined : Number(episodeNumber),
          mappedChapterIds: mappedIds, 
          videoUrl: newVideoUrl,
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
      setUploadProgress(0);
    }
  };

  if (loadingData) return <div className="text-white text-center mt-20">Loading data...</div>;

  return (
    <div className="min-h-screen bg-[#0f0f11] text-white p-8">
      <div className="max-w-3xl mx-auto bg-gray-800 p-8 rounded-2xl shadow-xl border border-gray-700">
        <div className="flex justify-between items-center mb-6 border-b border-gray-700 pb-4">
          <div>
            <h1 className="text-2xl font-black text-blue-400">Edit Episode</h1>
            <p className="text-gray-400 text-sm mt-1">Anime: <span className="text-white font-bold">{animeTitle}</span></p>
          </div>
          <Link href={`/admin/anime/${animeId}`} className="text-sm text-gray-400 hover:text-white transition">&larr; Back to Anime</Link>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          
          {/* HÀNG 1: TẬP SỐ MẤY VÀ TÊN TẬP PHIM */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="col-span-1">
              <label className="block text-sm font-semibold text-gray-300 mb-2">Ep Number (*)</label>
              <input
                type="number"
                required
                min="0"
                value={episodeNumber}
                onChange={(e) => setEpisodeNumber(e.target.value === "" ? "" : Number(e.target.value))}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white outline-none focus:border-blue-500"
              />
            </div>
            
            <div className="col-span-1 md:col-span-3">
              <label className="block text-sm font-semibold text-gray-300 mb-2">Episode Name (*)</label>
              <input
                type="text"
                required
                value={episodeTitle}
                onChange={(e) => setEpisodeTitle(e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white outline-none focus:border-blue-500"
              />
            </div>
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

          {/* KHU VỰC LIÊN KẾT MANGA - NÚT BẤM THÔNG MINH */}
          <div className="border border-blue-900/50 bg-blue-900/10 p-5 rounded-xl space-y-4">
             <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <label className="block text-sm font-semibold text-blue-300">Sync with Manga (Optional)</label>
                  {!mangaId ? (
                    <div className="mt-2 flex flex-col gap-1">
                      <span className="text-xs text-red-400 italic">* Chưa tìm thấy Manga liên kết. Vui lòng chọn thủ công:</span>
                      <select 
                        className="bg-gray-900 text-white text-sm px-3 py-1.5 rounded border border-gray-600 outline-none focus:border-blue-500"
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
                  type="button"
                  onClick={handleAutoMap}
                  disabled={isMapping || !episodeNumber || !mangaId}
                  className="bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 text-white text-sm font-bold px-4 py-2 rounded-lg transition shrink-0 shadow-lg"
                >
                  {isMapping ? "✨ AI đang phân tích..." : "✨ Auto Map bằng AI"}
                </button>
             </div>
             
             {/* Danh sách các nút Chapter */}
             <div className="mt-4 border-t border-blue-900/50 pt-4">
                <label className="block text-sm text-blue-300 mb-3 font-medium">
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
                              ? "bg-blue-600 border-blue-400 text-white shadow-[0_0_10px_rgba(59,130,246,0.5)]" 
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

          {/* ========================================== */}
          {/* KHU VỰC NÚT SUBMIT & THANH TIẾN ĐỘ UPLOAD */}
          {/* ========================================== */}
          <div className="mt-8 pt-4">
            {isSubmitting && uploadProgress > 0 ? (
              <div className="w-full bg-gray-800 rounded-xl p-4 border border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.2)]">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-bold text-blue-400 animate-pulse">Đang tải video mới lên Cloudflare R2...</span>
                  <span className="text-sm font-black text-white">{uploadProgress}%</span>
                </div>
                
                {/* Thanh Progress Bar */}
                <div className="w-full bg-gray-900 rounded-full h-4 overflow-hidden relative border border-gray-700">
                  <div 
                    className="bg-gradient-to-r from-blue-600 to-cyan-500 h-4 rounded-full transition-all duration-300 ease-out"
                    style={{ width: `${uploadProgress}%` }}
                  ></div>
                </div>
                
                <p className="text-xs text-gray-400 mt-3 text-center italic">Vui lòng không đóng tab trình duyệt trong lúc tải.</p>
              </div>
            ) : (
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition disabled:opacity-50 flex justify-center items-center"
              >
                {isSubmitting ? "Đang xử lý & Lưu dữ liệu..." : "Save Changes"}
              </button>
            )}
          </div>

        </form>
      </div>
    </div>
  );
}