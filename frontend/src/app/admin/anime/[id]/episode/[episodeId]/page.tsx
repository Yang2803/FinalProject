"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

export default function AdminEpisodeDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const animeId = params.id as string;
  const episodeId = params.episodeId as string;

  // --- STATE QUẢN LÝ BIỂU MẪU ---
  const [episodeNumber, setEpisodeNumber] = useState<string>("1");
  const [title, setTitle] = useState<string>("");
  const [plotSummary, setPlotSummary] = useState<string>("");
  const [characters, setCharacters] = useState<string>(""); // Lưu chuỗi phân tách bằng dấu phẩy
  const [adaptedFrom, setAdaptedFrom] = useState<string>("");
  
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isCrawlLoading, setIsCrawlLoading] = useState<boolean>(false);

  // Load thông tin hiện tại của tập phim nếu có
  useEffect(() => {
    const loadEpisodeData = async () => {
      try {
        const res = await fetch(`http://localhost:5000/api/admin/episode-detail/${episodeId}`);
        if (res.ok) {
          const data = await res.json();
          setTitle(data.title);
          setEpisodeNumber(data.episodeNumber || "1");
          setPlotSummary(data.plotSummary || "");
          setCharacters(data.characters ? data.characters.join(", ") : "");
          setAdaptedFrom(data.adaptedFrom || "");
        }
      } catch (err) {
        console.error("Lỗi load dữ liệu tập phim:", err);
      }
    };
    if (episodeId) loadEpisodeData();
  }, [episodeId]);

  // 🔥 LOGIC MA THUẬT: GỌI BACKEND AUTO-FILL DATA BẰNG AI
  const handleAutoFill = async () => {
    if (!episodeNumber) {
      alert("Vui lòng điền số tập phim trước khi tự động quét dữ liệu!");
      return;
    }

    setIsCrawlLoading(true);
    try {
      const res = await fetch("http://localhost:5000/api/admin/episode/auto-fill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ animeId, episodeNumber })
      });

      const result = await res.json();

      if (res.ok && result.success) {
        const { plotSummary, characters, adaptedFrom } = result.data;
        
        // Cập nhật giá trị trực tiếp vào các ô Input/Textarea trên Form
        setPlotSummary(plotSummary);
        setAdaptedFrom(adaptedFrom);
        setCharacters(characters ? characters.join(", ") : "");
        
        alert(`✨ Đã tự động điền thông tin dựa trên dữ liệu trang: "${result.sourceTitle}"! Hãy kiểm tra và bấm Lưu.`);
      } else {
        alert(`❌ Lỗi: ${result.error || "Không thể tự động điền."}`);
      }
    } catch (err) {
      console.error(err);
      alert("❌ Gặp sự cố khi kết nối tới máy chủ.");
    } finally {
      setIsCrawlLoading(false);
    }
  };

  // LOGIC LƯU THAY ĐỔI VÀO DATABASE
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    // Chuyển chuỗi kí tự nhân vật ngược lại thành mảng để lưu vào Postgres
    const characterArray = characters
      .split(",")
      .map(name => name.trim())
      .filter(name => name.length > 0);

    try {
      const res = await fetch(`http://localhost:5000/api/admin/episode/${episodeId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          plotSummary,
          adaptedFrom,
          characters: characterArray
        })
      });

      if (res.ok) {
        alert("🎉 Cập nhật thông tin chi tiết tập phim thành công!");
        router.push(`/admin/anime/${animeId}`);
      } else {
        alert("❌ Cập nhật thất bại.");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white p-8">
      <div className="max-w-4xl mx-auto bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-2xl">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 pb-4 border-b border-gray-800">
          <div>
            <h1 className="text-2xl font-bold text-blue-400">Episode Page Details Configuration</h1>
            <p className="text-gray-400 text-sm mt-1">Cấu hình dữ liệu Cốt truyện, Nhân vật xuất hiện và Chương chuyển thể</p>
          </div>
          
          {/* NÚT AUTO-FILL THẦN THÁNH */}
          <button
            type="button"
            onClick={handleAutoFill}
            disabled={isCrawlLoading}
            className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-sm px-5 py-2.5 rounded-xl transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transform active:scale-95 shrink-0"
          >
            {isCrawlLoading ? (
              <>
                <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                Analyzing Wiki Data...
              </>
            ) : (
              <>
                <span>🪄 Auto-fill via AI</span>
              </>
            )}
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Số thứ tự tập phim</label>
              <input
                type="number"
                value={episodeNumber}
                onChange={(e) => setEpisodeNumber(e.target.value)}
                className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-2.5 outline-none focus:border-blue-500 transition text-sm"
                placeholder="Ví dụ: 1"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Adapted From (Manga Chapter)</label>
              <input
                type="text"
                value={adaptedFrom}
                onChange={(e) => setAdaptedFrom(e.target.value)}
                className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-2.5 outline-none focus:border-blue-500 transition text-sm"
                placeholder="Ví dụ: Chapters 1-2 hoặc Volume 1 Chapter 5"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Characters (Phân cách bằng dấu phẩy)</label>
            <input
              type="text"
              value={characters}
              onChange={(e) => setCharacters(e.target.value)}
              className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-2.5 outline-none focus:border-blue-500 transition text-sm"
              placeholder="Yuji Itadori, Megumi Fushiguro, Satoru Gojo..."
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Plot Details (Cốt truyện chi tiết)</label>
            <textarea
              value={plotSummary}
              onChange={(e) => setPlotSummary(e.target.value)}
              rows={6}
              className="w-full bg-gray-950 border border-gray-800 rounded-xl p-4 outline-none focus:border-blue-500 transition text-sm leading-relaxed custom-scrollbar"
              placeholder="Nhập phần tóm tắt nội dung cốt truyện chi tiết của tập phim tại đây..."
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-800">
            <button
              type="button"
              onClick={() => router.back()}
              className="bg-gray-800 hover:bg-gray-700 text-gray-200 font-semibold text-sm px-5 py-2.5 rounded-xl transition"
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm px-6 py-2.5 rounded-xl transition shadow-lg shadow-blue-500/20 disabled:opacity-50"
            >
              {isSubmitting ? "Saving..." : "Lưu Thay Đổi"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}