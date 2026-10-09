"use client";

import { useState, useRef, useEffect, use } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useMangaRoom } from "@/hooks/useMangaRoom";
import { SUPPORTED_LANGUAGES } from "@/components/constants/languages";
import { ReaderSettings, BG_THEMES } from "@/types/theme";

// =====================================================================
// INTERFACES
// =====================================================================
interface ChapterData {
  id: string;
  title: string;
  images: string[];
  mangaId: string;
  manga: { title: string };
  prevChapterId: string | null;
  nextChapterId: string | null;
}

interface RoomData {
  id: string;
  name: string;
  inviteCode: string;
  mangaId: string | null;
  chapterId: string | null;
  hostId: string;
  isHostLocked?: boolean;
}

interface TextBlock {
  translatedText: string;
  type?: "bubble" | "box" | "floating";
  topPercent: number;
  leftPercent: number;
  widthPercent: number;
  heightPercent: number;
}

interface MangaOption {
  id: string;
  title: string;
  chapters?: { id: string; title: string }[];
}

// =====================================================================
// COMPONENT DỊCH AI (GEMINI VISION)
// =====================================================================
function TranslateableImage({ 
  imgUrl, 
  targetLang, 
  mode 
}: { 
  imgUrl: string; 
  targetLang: string;
  mode: "vertical" | "horizontal";
}) {
  const [blocks, setBlocks] = useState<TextBlock[]>([]);
  const [isTranslating, setIsTranslating] = useState(false);
  const [showTranslation, setShowTranslation] = useState(true);

  const handleTranslate = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (blocks.length > 0) {
      setShowTranslation(!showTranslation);
      return;
    }

    setIsTranslating(true);
    const absoluteImageUrl = imgUrl.startsWith("http") 
      ? imgUrl 
      : `${window.location.origin}${imgUrl}`;

    try {
      const res = await fetch("http://localhost:5000/api/manga/translate-page", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl: absoluteImageUrl, targetLang })
      });
      if (res.ok) {
        const data = await res.json();
        setBlocks(data.blocks || []);
        setShowTranslation(true);
      }
    } catch (error) {
      console.error("Lỗi dịch:", error);
    } finally {
      setIsTranslating(false);
    }
  };

  const wrapperClass = mode === "vertical" 
    ? "relative w-full max-w-full mb-4 mx-auto block" 
    : "relative max-h-[85vh] w-fit mx-auto inline-flex items-center justify-center";

  return (
    <div className={wrapperClass} style={{ lineHeight: 0 }}>
      <img src={imgUrl} alt="Manga Page" className={mode === "vertical" ? "w-full h-auto block" : "max-h-[85vh] w-auto block"} />

      <button 
        onClick={handleTranslate} 
        disabled={isTranslating}
        className="absolute top-4 right-4 text-white px-3 py-1.5 text-xs font-bold rounded shadow-lg z-20 backdrop-blur-sm bg-emerald-600/90 hover:bg-emerald-500 transition disabled:opacity-50"
      >
        {isTranslating ? "✨ Đang quét..." : blocks.length > 0 ? (showTranslation ? "👁️ Hide" : "👁️ Show") : "✨ Translate with AI"}
      </button>

      {showTranslation && blocks.map((block, index) => {
        const isVertical = block.heightPercent > block.widthPercent;
        const blockType = block.type || "bubble";

        let borderRadius = "4px";
        let background = "rgba(255, 255, 255, 0.98)";
        let textColor = "#000000";

        if (blockType === "bubble") borderRadius = isVertical ? "45% / 35%" : "20px";
        else if (blockType === "floating") { background = "rgba(0,0,0,0.85)"; textColor = "#fff"; }

        return (
          <div 
            key={index}
            className="absolute flex items-center justify-center text-center z-10 pointer-events-none"
            style={{
              top: `${block.topPercent}%`,
              left: `${block.leftPercent}%`,
              width: `${block.widthPercent}%`,
              minHeight: `${block.heightPercent}%`,
              backgroundColor: background,
              color: textColor,
              borderRadius,
              padding: "2px 3px",
              fontSize: "clamp(9px, 0.75vw, 13px)",
              lineHeight: "1.15",
              fontWeight: "600",
            }}
          >
            <span className="w-full break-words">{block.translatedText}</span>
          </div>
        );
      })}
    </div>
  );
}

// =====================================================================
// COMPONENT CHÍNH
// =====================================================================
export default function MangaCoReadingRoom({ 
  params 
}: { 
  params: Promise<{ roomId: string }> 
}) {
  const resolvedParams = use(params);
  const roomId = resolvedParams.roomId;
  const { data: session } = useSession();

  // Room & Chapter State
  const [room, setRoom] = useState<RoomData | null>(null);
  const [chapter, setChapter] = useState<ChapterData | null>(null);
  const [currentChapterId, setCurrentChapterId] = useState<string>("");
  const [currentPage, setCurrentPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [targetLang, setTargetLang] = useState("Vietnamese");

  // State Modal chọn truyện cho Host
  const [isSelectMangaOpen, setIsSelectMangaOpen] = useState(false);
  const [mangaList, setMangaList] = useState<MangaOption[]>([]);
  const [selectedMangaId, setSelectedMangaId] = useState("");
  const [chaptersOfManga, setChaptersOfManga] = useState<{ id: string; title: string }[]>([]);
  const [isUpdatingChapter, setIsUpdatingChapter] = useState(false);

  // Reader Settings
  const [settings, setSettings] = useState<ReaderSettings>({
    mode: "PAGED_RTL",
    bgTheme: "oled",
    maxWidth: "fit"
  });

  const isRemoteSyncing = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const isHost = Boolean(session?.user?.id && room?.hostId === session.user.id);

  // Hook socket co-reading
  const {
    isLocked,
    setIsLocked,
    emitPageChange,
    emitScroll,
    emitLaser,
    lasers,
  } = useMangaRoom({
    roomId,
    user: session?.user ? {
      id: session.user.id,
      name: session.user.name || "Bạn đọc",
      color: "#10b981"
    } : null,
    isHost,
    onRemotePageChange: async (newChapterId, page) => {
      isRemoteSyncing.current = true;
      if (newChapterId && newChapterId !== currentChapterId) {
        setCurrentChapterId(newChapterId);
        await fetchChapterDetail(newChapterId);
      }
      setCurrentPage(page);
      setTimeout(() => { isRemoteSyncing.current = false; }, 100);
    },
    onRemoteScroll: (percent) => {
      if (!containerRef.current) return;
      isRemoteSyncing.current = true;
      const targetScroll = percent * (containerRef.current.scrollHeight - containerRef.current.clientHeight);
      containerRef.current.scrollTo({ top: targetScroll, behavior: "smooth" });
      setTimeout(() => { isRemoteSyncing.current = false; }, 100);
    },
  });

  // Hàm tải chi tiết chapter
  const fetchChapterDetail = async (chapId: string) => {
    try {
      const res = await fetch(`http://localhost:5000/api/chapter/${chapId}`);
      if (res.ok) {
        const data = await res.json();
        setChapter(data);
      }
    } catch (e) {
      console.error("Lỗi tải chapter:", e);
    }
  };

  // 1. Tải thông tin phòng
  useEffect(() => {
    const initRoom = async () => {
      try {
        setLoading(true);
        // Sửa endpoint sang manga-room
        const resRoom = await fetch(`http://localhost:5000/api/manga-room/rooms/${roomId}`);
        if (!resRoom.ok) throw new Error("Không tìm thấy phòng");
        const roomData: RoomData = await resRoom.json();
        setRoom(roomData);

        if (roomData.chapterId) {
          setCurrentChapterId(roomData.chapterId);
          await fetchChapterDetail(roomData.chapterId);
        }
      } catch (err) {
        console.error("Lỗi khởi tạo:", err);
      } finally {
        setLoading(false);
      }
    };
    if (roomId) initRoom();
  }, [roomId]);

  // 2. Tải danh sách Manga khi Host mở modal chọn truyện
  const openMangaSelector = async () => {
    setIsSelectMangaOpen(true);
    try {
      const res = await fetch("http://localhost:5000/api/manga");
      if (res.ok) {
        const data = await res.json();
        setMangaList(Array.isArray(data) ? data : data.mangas || []);
      }
    } catch (e) {
      console.error("Lỗi lấy danh sách manga:", e);
    }
  };

  // Khi Host chọn 1 bộ Manga -> tải danh sách chapter của bộ đó
  const handleSelectManga = async (mangaId: string) => {
    setSelectedMangaId(mangaId);
    try {
      const res = await fetch(`http://localhost:5000/api/manga/${mangaId}`);
      if (res.ok) {
        const data = await res.json();
        setChaptersOfManga(data.chapters || []);
      }
    } catch (e) {
      console.error("Lỗi tải chapters:", e);
    }
  };

  // Host xác nhận chọn Chapter để cả phòng bắt đầu đọc
  const handleConfirmChapter = async (chapId: string) => {
    if (!room) return;
    setIsUpdatingChapter(true);
    try {
      const res = await fetch(`http://localhost:5000/api/manga-room/rooms/${room.id}/change-chapter`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hostId: session?.user?.id,
          mangaId: selectedMangaId,
          chapterId: chapId,
        }),
      });

      if (res.ok) {
        setCurrentChapterId(chapId);
        await fetchChapterDetail(chapId);
        setCurrentPage(0);
        emitPageChange(chapId, 0); // Bắn socket đồng bộ cho tất cả khách
        setIsSelectMangaOpen(false);
      } else {
        alert("Không thể đổi chương!");
      }
    } catch (e) {
      console.error(e);
      alert("Lỗi kết nối khi đổi chương.");
    } finally {
      setIsUpdatingChapter(false);
    }
  };

  // Điều khiển lật trang
  const handleNextPage = () => {
    if (!chapter) return;
    if (!isHost && isLocked) return;
    if (currentPage < chapter.images.length - 1) {
      const nextPage = currentPage + 1;
      setCurrentPage(nextPage);
      emitPageChange(currentChapterId, nextPage);
    }
  };

  const handlePrevPage = () => {
    if (!chapter) return;
    if (!isHost && isLocked) return;
    if (currentPage > 0) {
      const prevPage = currentPage - 1;
      setCurrentPage(prevPage);
      emitPageChange(currentChapterId, prevPage);
    }
  };

  // Laser Pointer
  const handleMouseMoveOnPage = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const xPercent = ((e.clientX - rect.left) / rect.width) * 100;
    const yPercent = ((e.clientY - rect.top) / rect.height) * 100;
    emitLaser(xPercent, yPercent, currentPage);
  };

  // Cuộn dọc Webtoon
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (isRemoteSyncing.current || (!isHost && isLocked)) return;
    const target = e.currentTarget;
    const scrollPercent = target.scrollTop / (target.scrollHeight - target.clientHeight);
    emitScroll(scrollPercent);
  };

  if (loading) {
    return <div className="min-h-screen bg-[#0f0f11] text-white flex items-center justify-center">Đang tải phòng đọc...</div>;
  }

  if (!room) {
    return (
      <div className="min-h-screen bg-[#0f0f11] text-white flex flex-col items-center justify-center gap-4">
        <p className="text-gray-400">Không tìm thấy phòng đọc này hoặc phòng đã giải tán.</p>
        <Link href="/manga-room" className="text-emerald-400 hover:underline">&larr; Quay về sảnh</Link>
      </div>
    );
  }

  // 🌟 MÀN HÌNH CHỜ: KHI PHÒNG CHƯA ĐƯỢC CHỌN MANGA
  if (!chapter) {
    return (
      <div className="min-h-screen bg-[#0f0f11] text-white flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center text-3xl mb-4 border border-emerald-500/20">
          📖
        </div>
        <h2 className="text-2xl font-bold mb-2">{room.name}</h2>
        <p className="text-gray-400 mb-6 max-w-md text-sm">
          {isHost
            ? "Bạn là Trưởng phòng! Hãy chọn bộ manga và chương bạn muốn cùng đọc với mọi người."
            : "Trưởng phòng đang chọn truyện... Bạn vui lòng chờ một chút nhé!"}
        </p>

        {isHost ? (
          <button
            onClick={openMangaSelector}
            className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition shadow-lg shadow-emerald-900/30"
          >
            + Chọn Manga để bắt đầu đọc
          </button>
        ) : (
          <div className="flex items-center gap-2 text-emerald-400 text-sm">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" /> Đang chờ Trưởng phòng chọn truyện...
          </div>
        )}

        {/* MODAL CHỌN TRUYỆN DÀNH CHO HOST */}
        {isSelectMangaOpen && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-[#1a1d24] border border-gray-800 rounded-2xl max-w-lg w-full p-6 text-left">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-lg text-white">Chọn Manga & Chương Đọc</h3>
                <button onClick={() => setIsSelectMangaOpen(false)} className="text-gray-400 hover:text-white">✕</button>
              </div>

              {!selectedMangaId ? (
                <div className="max-h-80 overflow-y-auto space-y-2">
                  <p className="text-xs text-gray-400 mb-2">Bước 1: Chọn một bộ truyện</p>
                  {mangaList.map((m) => (
                    <div
                      key={m.id}
                      onClick={() => handleSelectManga(m.id)}
                      className="p-3 bg-gray-900 hover:bg-emerald-950/40 border border-gray-800 hover:border-emerald-500/50 rounded-xl cursor-pointer transition flex justify-between items-center"
                    >
                      <span className="font-medium text-sm text-gray-200">{m.title}</span>
                      <span className="text-emerald-400 text-xs">Chọn &rarr;</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs text-gray-400">Bước 2: Chọn chương</p>
                    <button onClick={() => setSelectedMangaId("")} className="text-xs text-blue-400 hover:underline">← Đổi manga khác</button>
                  </div>
                  <div className="max-h-80 overflow-y-auto space-y-2">
                    {chaptersOfManga.length === 0 ? (
                      <p className="text-sm text-gray-500 py-4 text-center">Truyện này chưa có chương nào!</p>
                    ) : (
                      chaptersOfManga.map((c) => (
                        <button
                          key={c.id}
                          disabled={isUpdatingChapter}
                          onClick={() => handleConfirmChapter(c.id)}
                          className="w-full text-left p-3 bg-gray-900 hover:bg-emerald-600 rounded-xl text-sm transition font-medium flex justify-between items-center"
                        >
                          <span>{c.title}</span>
                          <span className="text-xs opacity-75">Bắt đầu đọc</span>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  const currentTheme = BG_THEMES[settings.bgTheme] || BG_THEMES.oled;

  return (
    <div className="min-h-screen relative flex flex-col" style={{ backgroundColor: currentTheme.bg, color: currentTheme.text }}>
      {/* HEADER PHÒNG */}
      <div className="h-14 border-b border-gray-800 bg-gray-900/90 backdrop-blur px-4 flex items-center justify-between z-30">
        <div className="flex items-center gap-3">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <h2 className="font-bold text-sm">
            Phòng #{room.inviteCode || room.id.slice(0, 6)} - {chapter.manga.title} ({chapter.title})
          </h2>
          {isHost && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsLocked(!isLocked)}
                className={`px-2.5 py-1 rounded text-xs font-bold border transition ${
                  isLocked ? "bg-amber-500/20 text-amber-300 border-amber-500/40" : "bg-gray-800 text-gray-400 border-gray-700"
                }`}
              >
                {isLocked ? "🔒 Host Lock: Bật" : "🔓 Tự do: Bật"}
              </button>
              <button
                onClick={openMangaSelector}
                className="px-2.5 py-1 bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700 rounded text-xs font-medium transition"
              >
                🔄 Đổi truyện/chương
              </button>
            </div>
          )}
        </div>

        {/* Ngôn ngữ dịch AI */}
        <div className="flex items-center gap-2">
          <span className="text-xs opacity-70">Dịch:</span>
          <select 
            value={targetLang}
            onChange={(e) => setTargetLang(e.target.value)}
            className="bg-gray-800 text-xs px-2 py-1 rounded outline-none border border-gray-700 text-white"
          >
            {SUPPORTED_LANGUAGES.map((lang) => (
              <option key={lang.code} value={lang.code}>{lang.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* NỘI DUNG TRANG TRUYỆN */}
      <div 
        ref={containerRef} 
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto relative flex flex-col items-center justify-center p-4 custom-scrollbar"
      >
        <div 
          className="relative max-w-3xl w-full flex justify-center"
          onMouseMove={handleMouseMoveOnPage}
        >
          {settings.mode === "VERTICAL" ? (
            <div className="w-full flex flex-col items-center">
              {chapter.images.map((img) => (
                <TranslateableImage key={img} imgUrl={img} targetLang={targetLang} mode="vertical" />
              ))}
            </div>
          ) : (
            <TranslateableImage 
              key={chapter.images[currentPage]} 
              imgUrl={chapter.images[currentPage]} 
              targetLang={targetLang} 
              mode="horizontal" 
            />
          )}

          {/* RENDER CON TRỎ LASER CỦA BẠN BÈ */}
          {Object.values(lasers).map((laser) => (
            <div
              key={laser.userId}
              className="absolute pointer-events-none z-50 flex items-center gap-1.5 transition-all duration-75"
              style={{
                top: `${laser.yPercent}%`,
                left: `${laser.xPercent}%`,
                transform: "translate(-50%, -50%)",
              }}
            >
              <div className="w-3.5 h-3.5 rounded-full animate-ping opacity-75" style={{ backgroundColor: laser.color }} />
              <div className="w-3 h-3 rounded-full shadow-lg absolute inset-0" style={{ backgroundColor: laser.color }} />
              <span className="text-[10px] font-black px-1.5 py-0.5 rounded text-white ml-2 shadow whitespace-nowrap" style={{ backgroundColor: laser.color }}>
                {laser.username}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* THANH ĐIỀU KHIỂN TRANG */}
      {settings.mode !== "VERTICAL" && (
        <div className="h-12 border-t border-gray-800 bg-gray-900/60 backdrop-blur flex items-center justify-center gap-4 text-sm z-20">
          <button 
            onClick={settings.mode === "PAGED_RTL" ? handleNextPage : handlePrevPage}
            disabled={(!isHost && isLocked) || currentPage === 0}
            className="px-3 py-1 bg-gray-800 rounded disabled:opacity-40"
          >
            Trang trước
          </button>
          <span>{currentPage + 1} / {chapter.images.length}</span>
          <button 
            onClick={settings.mode === "PAGED_RTL" ? handlePrevPage : handleNextPage}
            disabled={(!isHost && isLocked) || currentPage === chapter.images.length - 1}
            className="px-3 py-1 bg-gray-800 rounded disabled:opacity-40"
          >
            Trang sau
          </button>
        </div>
      )}

      {/* MODAL ĐỔI TRUYỆN TRONG KHI ĐANG ĐỌC (NẾU HOST BẤM ĐỔI) */}
      {isSelectMangaOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#1a1d24] border border-gray-800 rounded-2xl max-w-lg w-full p-6 text-left">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-lg text-white">Đổi Manga & Chương Khác</h3>
              <button onClick={() => setIsSelectMangaOpen(false)} className="text-gray-400 hover:text-white">✕</button>
            </div>

            {!selectedMangaId ? (
              <div className="max-h-80 overflow-y-auto space-y-2">
                <p className="text-xs text-gray-400 mb-2">Chọn một bộ truyện:</p>
                {mangaList.map((m) => (
                  <div
                    key={m.id}
                    onClick={() => handleSelectManga(m.id)}
                    className="p-3 bg-gray-900 hover:bg-emerald-950/40 border border-gray-800 hover:border-emerald-500/50 rounded-xl cursor-pointer transition flex justify-between items-center"
                  >
                    <span className="font-medium text-sm text-gray-200">{m.title}</span>
                    <span className="text-emerald-400 text-xs">Chọn &rarr;</span>
                  </div>
                ))}
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs text-gray-400">Chọn chương để chuyển:</p>
                  <button onClick={() => setSelectedMangaId("")} className="text-xs text-blue-400 hover:underline">← Chọn manga khác</button>
                </div>
                <div className="max-h-80 overflow-y-auto space-y-2">
                  {chaptersOfManga.map((c) => (
                    <button
                      key={c.id}
                      disabled={isUpdatingChapter}
                      onClick={() => handleConfirmChapter(c.id)}
                      className="w-full text-left p-3 bg-gray-900 hover:bg-emerald-600 rounded-xl text-sm transition font-medium flex justify-between items-center"
                    >
                      <span>{c.title}</span>
                      <span className="text-xs opacity-75">Chuyển ngay</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}