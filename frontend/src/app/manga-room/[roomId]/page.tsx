"use client";

import { useState, useRef, useEffect, use, useMemo } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useMangaRoom } from "@/hooks/useMangaRoom";
import { SUPPORTED_LANGUAGES } from "@/components/constants/languages";
import { MangaVoiceChat } from "@/components/manga-room/MangaVoiceChat";
import { MangaPageCanvas } from "@/components/manga-room/MangaPageCanvas";

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
  isPrivate?: boolean;
}

interface MangaOption {
  id: string;
  title: string;
  chapters?: { id: string; title: string }[];
}

// 🌟 HÀM SINH MÀU CỐ ĐỊNH THEO USER ID
const getUserColor = (userId: string): string => {
  const colors = [
    "#10b981", "#3b82f6", "#f59e0b", "#ec4899", 
    "#8b5cf6", "#06b6d4", "#f97316", "#14b8a6"
  ];
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
};

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
  const [readMode, setReadMode] = useState<"SINGLE" | "VERTICAL">("SINGLE");

  // State Modal chọn truyện cho Host
  const [isSelectMangaOpen, setIsSelectMangaOpen] = useState(false);
  const [mangaList, setMangaList] = useState<MangaOption[]>([]);
  const [selectedMangaId, setSelectedMangaId] = useState("");
  const [chaptersOfManga, setChaptersOfManga] = useState<{ id: string; title: string }[]>([]);
  const [isUpdatingChapter, setIsUpdatingChapter] = useState(false);

  // 🌟 Laser Pen State
  const [isLaserPenActive, setIsLaserPenActive] = useState(false);
  const [laserWidth, setLaserWidth] = useState<number>(0.8);

  // Ref container đồng bộ cuộn
  const isRemoteSyncing = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const isHost = Boolean(session?.user?.id && String(room?.hostId) === String(session.user.id));
  const userColor = useMemo(() => getUserColor(session?.user?.id || "default_user"), [session?.user?.id]);

  // Hook socket co-reading
  const {
    isLocked,
    setIsLocked,
    emitPageChange,
    emitScroll,
    emitCursorMove,
    emitLaserDraw,
    emitClearMyLaser,
    emitClearAllLaser,
    emitLeaveRoom,
    emitDisbandRoom,
    respondJoinRequest,
    emitChangeTheme,
    emitChangeReadMode,
    theme,
    joinRequests,
    approvalStatus,
    remoteCursors,
    laserLines,
  } = useMangaRoom({
    roomId,
    user: session?.user ? {
      id: session.user.id,
      name: session.user.name || "Bạn đọc",
      color: userColor
    } : null,
    isHost,
    isPrivate: room?.isPrivate,
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
      setTimeout(() => { isRemoteSyncing.current = false; }, 150);
    },

    onRemoteReadModeChange: (newMode) => {
      setReadMode(newMode);
    },
  });

  const [isThemePickerOpen, setIsThemePickerOpen] = useState(false);
  const [customImageUrl, setCustomImageUrl] = useState("");

  // Tải chi tiết chapter
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
        emitPageChange(chapId, 0);
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

  const hasMyStrokes = laserLines.some((line) => line.userId === session?.user?.id);

  // Điều khiển lật trang
  const handleNextPage = () => {
    if (!chapter || !chapter.images || chapter.images.length === 0) return;
    if (!isHost && isLocked) return;
    if (currentPage < chapter.images.length - 1) {
      const nextPage = currentPage + 1;
      setCurrentPage(nextPage);
      emitPageChange(currentChapterId, nextPage);
      emitClearAllLaser();
    }
  };

  const handlePrevPage = () => {
    if (!chapter || !chapter.images || chapter.images.length === 0) return;
    if (!isHost && isLocked) return;
    if (currentPage > 0) {
      const prevPage = currentPage - 1;
      setCurrentPage(prevPage);
      emitPageChange(currentChapterId, prevPage);
      emitClearAllLaser();
    }
  };

  // Cuộn trang
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    // Nếu đang nhận tín hiệu cuộn từ người khác hoặc phòng bị khóa mà mình không phải Host thì bỏ qua
    if (isRemoteSyncing.current || (!isHost && isLocked)) return;

    const target = e.currentTarget;
    const scrollHeight = target.scrollHeight - target.clientHeight;
    if (scrollHeight <= 0) return;

    const scrollPercent = target.scrollTop / scrollHeight;
    emitScroll(scrollPercent);
  };

  const handleToggleReadMode = () => {
    // Nếu phòng bị khóa và không phải Host thì không được đổi mode
    if (!isHost && isLocked) {
      alert("Trưởng phòng đang khóa thao tác điều khiển!");
      return;
    }
    const nextMode = readMode === "SINGLE" ? "VERTICAL" : "SINGLE";
    setReadMode(nextMode);
    emitChangeReadMode(nextMode); // Bắn socket đồng bộ cho tất cả mọi người
  };

  // Xác nhận rời phòng
  const handleLeaveRoom = () => {
    if (confirm("Bạn có chắc chắn muốn rời khỏi phòng đọc này?")) {
      emitLeaveRoom();
    }
  };

  // Xác nhận giải tán phòng (chỉ Host)
  const handleDisbandRoom = async () => {
    if (confirm("Bạn có chắc chắn muốn giải tán phòng? Tất cả thành viên sẽ bị đưa về sảnh!")) {
      try {
        await fetch(`http://localhost:5000/api/manga-room/rooms/${room?.id}`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ hostId: session?.user?.id }),
        }).catch(() => {});
      } finally {
        emitDisbandRoom();
      }
    }
  };

  if (loading) return <div className="min-h-screen bg-[#0f0f11] text-white flex items-center justify-center">Đang tải phòng đọc...</div>;

  if (!room) {
    return (
      <div className="min-h-screen bg-[#0f0f11] text-white flex flex-col items-center justify-center gap-4">
        <p className="text-gray-400">Không tìm thấy phòng đọc này hoặc phòng đã giải tán.</p>
        <Link href="/manga-room" className="text-emerald-400 hover:underline">&larr; Quay về sảnh</Link>
      </div>
    );
  }

  // MÀN HÌNH CHỜ PHÊ DUYỆT CỦA PHÒNG KÍN
  if (!isHost && room.isPrivate && approvalStatus === "PENDING") {
    return (
      <div className="min-h-screen bg-[#0f0f11] text-white flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-full bg-amber-500/10 text-amber-400 flex items-center justify-center text-3xl mb-4 border border-amber-500/20 animate-pulse">
          ⏳
        </div>
        <h2 className="text-xl font-bold mb-2">Đang Chờ Phê Duyệt</h2>
        <p className="text-gray-400 text-sm max-w-sm mb-6">
          Đây là phòng kín. Yêu cầu tham gia của bạn đã được gửi tới Trưởng phòng, vui lòng đợi trong giây lát...
        </p>
        <Link
          href="/manga-room"
          className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-xs font-semibold transition"
        >
          Hủy & Quay lại sảnh
        </Link>
      </div>
    );
  }

  // MÀN HÌNH BỊ TỪ CHỐI
  if (!isHost && approvalStatus === "REJECTED") {
    return (
      <div className="min-h-screen bg-[#0f0f11] text-white flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-full bg-red-500/10 text-red-400 flex items-center justify-center text-3xl mb-4 border border-red-500/20">
          🚫
        </div>
        <h2 className="text-xl font-bold mb-2">Yêu Cầu Bị Từ Chối</h2>
        <p className="text-gray-400 text-sm max-w-sm mb-6">
          Trưởng phòng đã từ chối yêu cầu tham gia phòng đọc này của bạn.
        </p>
        <Link
          href="/manga-room"
          className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition"
        >
          Quay lại sảnh phòng đọc
        </Link>
      </div>
    );
  }

  // MÀN HÌNH CHỜ KHI CHƯA CHỌN TRUYỆN
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

        {/* MODAL CHỌN TRUYỆN */}
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

  return (
    <div className="min-h-screen relative flex flex-col select-none bg-[#090a0f] text-gray-100">
      {/* HEADER PHÒNG */}
      <header className="h-14 border-b border-gray-800 bg-gray-900/95 backdrop-blur px-3 md:px-4 flex items-center justify-between z-30 shrink-0 gap-2">
        {/* CỤM TRÁI: THÔNG TIN PHÒNG & QUYỀN HOST */}
        <div className="flex items-center gap-2 min-w-0 shrink">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
          <div className="flex items-center gap-1.5 min-w-0 text-xs md:text-sm font-semibold text-gray-200">
            <span className="text-emerald-400 font-mono shrink-0">
              #{room.inviteCode || room.id.slice(0, 6)}
            </span>
            <span className="text-gray-600 hidden sm:inline">|</span>
            <span className="truncate max-w-[120px] sm:max-w-[200px] lg:max-w-[260px] text-gray-300">
              {chapter.manga.title}
            </span>
            <span className="text-gray-500 font-normal truncate hidden md:inline">
              ({chapter.title})
            </span>
          </div>

          {isHost && (
            <div className="flex items-center gap-1.5 ml-1 shrink-0">
              <button
                type="button"
                onClick={() => setIsLocked(!isLocked)}
                className={`px-2 py-1 rounded text-xs font-medium border whitespace-nowrap transition ${
                  isLocked
                    ? "bg-amber-500/15 text-amber-300 border-amber-500/40"
                    : "bg-gray-800 text-gray-400 border-gray-700 hover:text-gray-200"
                }`}
                title="Khóa/mở khóa quyền chuyển trang"
              >
                {isLocked ? "🔒 Khóa" : "🔓 Tự do"}
              </button>
              <button
                type="button"
                onClick={openMangaSelector}
                className="px-2 py-1 bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700 rounded text-xs font-medium whitespace-nowrap transition cursor-pointer"
              >
                🔄 Đổi truyện
              </button>
            </div>
          )}
        </div>

        {/* CỤM PHẢI: LASER PEN, XÓA, VOICE CHAT, DỊCH, RỜI/GIẢI TÁN */}
        <div className="flex items-center gap-1.5 md:gap-2 shrink-0">
          {/* 1. Laser Pen + Kích thước nét */}
          <div className="flex items-center bg-gray-800/80 border border-gray-700/80 rounded-lg p-0.5">
            <button
              type="button"
              onClick={() => setIsLaserPenActive(!isLaserPenActive)}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold whitespace-nowrap transition flex items-center gap-1 cursor-pointer ${
                isLaserPenActive
                  ? "bg-red-500 text-white shadow-sm shadow-red-900/50"
                  : "text-gray-300 hover:text-white"
              }`}
            >
              <span>{isLaserPenActive ? "🔴 Đang vẽ" : "✏️ Laser"}</span>
            </button>

            {isLaserPenActive && (
              <div className="flex items-center gap-0.5 pl-1 pr-0.5 border-l border-gray-700 ml-1">
                {[
                  { label: "S", value: 0.8, title: "Mảnh" },
                  { label: "M", value: 1.6, title: "Vừa" },
                  { label: "L", value: 2.4, title: "Dày" },
                ].map((size) => (
                  <button
                    key={size.value}
                    type="button"
                    title={size.title}
                    onClick={() => setLaserWidth(size.value)}
                    className={`w-5 h-5 rounded text-[10px] font-bold transition flex items-center justify-center cursor-pointer ${
                      laserWidth === size.value
                        ? "bg-emerald-600 text-white"
                        : "text-gray-400 hover:text-gray-200"
                    }`}
                  >
                    {size.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 2. Nút xóa nét của tôi */}
          {hasMyStrokes && (
            <button
              type="button"
              onClick={emitClearMyLaser}
              className="px-2 py-1 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white border border-gray-700 rounded-lg text-xs font-medium whitespace-nowrap transition flex items-center gap-1 cursor-pointer"
              title="Chỉ xóa nét vẽ của bạn"
            >
              <span>🧹 Xóa nét</span>
            </button>
          )}

          {/* 3. Nút xóa tất cả dành cho Host */}
          {isHost && laserLines.length > 0 && (
            <button
              type="button"
              onClick={emitClearAllLaser}
              className="px-2 py-1 bg-red-950/40 hover:bg-red-900/60 text-red-300 border border-red-800/60 rounded-lg text-xs font-medium whitespace-nowrap transition flex items-center gap-1 cursor-pointer"
              title="Xóa toàn bộ nét của tất cả mọi người"
            >
              <span>🗑️ Xóa hết</span>
            </button>
          )}

          {/* 4. LiveKit Voice Chat */}
          {session?.user?.id && (
            <div className="shrink-0">
              <MangaVoiceChat
                roomId={room.id}
                userId={session.user.id}
                userName={session.user.name || "Bạn đọc"}
              />
            </div>
          )}

          {/* 5. Dropdown ngôn ngữ dịch */}
          <div className="hidden lg:flex items-center gap-1 bg-gray-800/60 border border-gray-700/80 rounded-lg px-2 py-1">
            <span className="text-[11px] text-gray-400 whitespace-nowrap">Dịch:</span>
            <select
              value={targetLang}
              onChange={(e) => setTargetLang(e.target.value)}
              className="bg-transparent text-xs text-gray-200 outline-none cursor-pointer"
            >
              {SUPPORTED_LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.code} className="bg-gray-900 text-white">
                  {lang.label}
                </option>
              ))}
            </select>
          </div>

          {/* 6. Nút Rời phòng / Giải tán */}
          <div className="border-l border-gray-800 pl-1.5 md:pl-2 shrink-0">
            {isHost ? (
              <button
                type="button"
                onClick={handleDisbandRoom}
                className="px-2.5 py-1 bg-red-600/20 hover:bg-red-600 text-red-300 hover:text-white border border-red-500/40 rounded-lg text-xs font-semibold whitespace-nowrap transition flex items-center gap-1 cursor-pointer"
                title="Giải tán phòng cho tất cả mọi người"
              >
                <span>🚪 Giải tán</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleLeaveRoom}
                className="px-2.5 py-1 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white border border-gray-700 rounded-lg text-xs font-semibold whitespace-nowrap transition flex items-center gap-1 cursor-pointer"
                title="Rời khỏi phòng đọc"
              >
                <span>🚪 Rời</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* NỘI DUNG TRANG TRUYỆN + CANVAS LASER + LIVE CURSORS */}
      <div 
        ref={containerRef} 
        onScroll={handleScroll}
        style={{
          backgroundColor: theme.type === "color" ? theme.value : undefined,
          backgroundImage: theme.type === "image" ? `url(${theme.value})` : undefined,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
        }}
        className={`flex-1 overflow-y-auto relative flex flex-col items-center p-4 custom-scrollbar transition-colors duration-500 ${
          readMode === "VERTICAL" ? "justify-start" : "justify-center"
        } ${isLaserPenActive ? "cursor-crosshair" : "cursor-default"}`}
      >
        {readMode === "VERTICAL" ? (
          /* CHẾ ĐỘ CUỘN DỌC: Render danh sách ảnh nối tiếp */
          <div className="w-full flex flex-col items-center gap-2">
            {chapter.images.map((imgUrl, idx) => (
              <MangaPageCanvas
                key={imgUrl || idx}
                pageIndex={idx}
                imageUrl={imgUrl}
                mode="VERTICAL"
                isLaserActive={isLaserPenActive}
                userColor={userColor}
                laserWidth={laserWidth}
                laserLines={laserLines}
                remoteCursors={remoteCursors}
                onDrawComplete={(pIdx, points) => emitLaserDraw(pIdx, points, laserWidth)}
                onCursorMove={(pIdx, x, y) => emitCursorMove(pIdx, x, y)}
              />
            ))}
          </div>
        ) : (
          /* CHẾ ĐỘ TỪNG TRANG: Render 1 trang hiện tại */
          <div className="flex items-center justify-center">
            <MangaPageCanvas
              key={chapter.images[currentPage] || currentPage}
              pageIndex={currentPage}
              imageUrl={chapter.images[currentPage]}
              mode="SINGLE"
              isLaserActive={isLaserPenActive}
              userColor={userColor}
              laserWidth={laserWidth}
              laserLines={laserLines}
              remoteCursors={remoteCursors}
              onDrawComplete={(pIdx, points) => emitLaserDraw(pIdx, points, laserWidth)}
              onCursorMove={(pIdx, x, y) => emitCursorMove(pIdx, x, y)}
            />
          </div>
        )}
      </div>

      {/* THANH ĐIỀU KHIỂN TRANG */}
      <div className="h-14 border-t border-gray-800 bg-gray-900/90 backdrop-blur px-4 flex items-center justify-between text-sm z-50 sticky bottom-0 shrink-0">
        {/* GÓC TRÁI: NÚT ĐỔI NỀN & ĐỔI CHẾ ĐỘ ĐỌC */}
        <div className="relative flex items-center gap-2 min-w-[200px]">
          {isHost && (
            <button
              type="button"
              onClick={() => setIsThemePickerOpen(!isThemePickerOpen)}
              className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white border border-gray-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
            >
              <span>🎨 Nền phòng</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleToggleReadMode}
            disabled={!isHost && isLocked}
            className={`px-3 py-1.5 border rounded-lg text-xs font-semibold flex items-center gap-1.5 transition select-none ${
              !isHost && isLocked
                ? "bg-gray-900 border-gray-800 text-gray-500 cursor-not-allowed opacity-50"
                : "bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white border-gray-700 cursor-pointer"
            }`}
            title={!isHost && isLocked ? "Trưởng phòng đang khóa điều khiển" : "Đổi kiểu đọc"}
          >
            <span>{readMode === "SINGLE" ? "📜 Cuộn dọc" : "📖 Từng trang"}</span>
          </button>

          {/* POPUP BẢNG CHỌN NỀN CỦA HOST */}
          {isHost && isThemePickerOpen && (
            <div className="absolute bottom-12 left-0 bg-gray-900 border border-gray-700 p-3.5 rounded-xl shadow-2xl w-64 z-50 flex flex-col gap-3">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-gray-200">Chọn màu nền phòng</span>
                <button 
                  type="button"
                  onClick={() => setIsThemePickerOpen(false)} 
                  className="text-xs text-gray-400 hover:text-white cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {/* Các mã màu đọc truyện có sẵn */}
              <div className="grid grid-cols-4 gap-2">
                {[
                  { name: "Đen tuyền", color: "#000000" },
                  { name: "Xám tối", color: "#18181b" },
                  { name: "Navy", color: "#0f172a" },
                  { name: "Giấy ấm", color: "#292524" },
                ].map((item) => (
                  <button
                    key={item.color}
                    type="button"
                    title={item.name}
                    onClick={() => {
                      emitChangeTheme({ type: "color", value: item.color });
                      setIsThemePickerOpen(false);
                    }}
                    style={{ backgroundColor: item.color }}
                    className="h-8 rounded-lg border border-gray-600 hover:scale-105 transition shadow-sm cursor-pointer"
                  />
                ))}
              </div>

              {/* Tùy chọn dán URL ảnh nền */}
              <div className="flex flex-col gap-1.5 border-t border-gray-800 pt-2">
                <span className="text-[11px] text-gray-400">Hoặc link ảnh nền:</span>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    placeholder="https://...jpg/png"
                    value={customImageUrl}
                    onChange={(e) => setCustomImageUrl(e.target.value)}
                    className="flex-1 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-[11px] text-white focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (customImageUrl.trim()) {
                        emitChangeTheme({ type: "image", value: customImageUrl.trim() });
                        setIsThemePickerOpen(false);
                      }
                    }}
                    className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[11px] font-bold cursor-pointer"
                  >
                    Lưu
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Ở GIỮA: CỤM CHUYỂN TRANG (Ẩn khi bật cuộn dọc) */}
        {readMode === "SINGLE" ? (
          <div className="flex items-center gap-6">
            <button
              type="button"
              onClick={handlePrevPage}
              disabled={currentPage === 0 || (!isHost && isLocked)}
              className="px-4 py-2 bg-gray-800 hover:bg-emerald-600 disabled:opacity-30 disabled:hover:bg-gray-800 text-white font-medium rounded-lg transition cursor-pointer select-none"
            >
              &larr; Trang trước
            </button>

            <span className="font-bold text-emerald-400 text-base select-none">
              Trang {currentPage + 1} / {chapter.images.length}
            </span>

            <button
              type="button"
              onClick={handleNextPage}
              disabled={currentPage >= chapter.images.length - 1 || (!isHost && isLocked)}
              className="px-4 py-2 bg-gray-800 hover:bg-emerald-600 disabled:opacity-30 disabled:hover:bg-gray-800 text-white font-medium rounded-lg transition cursor-pointer select-none"
            >
              Trang sau &rarr;
            </button>
          </div>
        ) : (
          <div className="text-xs text-gray-400 font-medium">
            Đang hiển thị toàn bộ {chapter.images.length} trang theo chiều dọc
          </div>
        )}

        {/* GÓC PHẢI: KHOẢNG ĐỆM ĐỂ CÂN BẰNG LAYOUT */}
        <div className="min-w-[200px]" />
      </div>

      {/* MODAL ĐỔI TRUYỆN TRONG KHI ĐANG ĐỌC */}
      {isSelectMangaOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#1a1d24] border border-gray-800 rounded-2xl max-w-lg w-full p-6 text-left">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-lg text-white">Đổi Manga & Chương Khác</h3>
              <button onClick={() => setIsSelectMangaOpen(false)} className="text-gray-400 hover:text-white cursor-pointer">✕</button>
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
                  <button onClick={() => setSelectedMangaId("")} className="text-xs text-blue-400 hover:underline cursor-pointer">← Chọn manga khác</button>
                </div>
                <div className="max-h-80 overflow-y-auto space-y-2">
                  {chaptersOfManga.map((c) => (
                    <button
                      key={c.id}
                      disabled={isUpdatingChapter}
                      onClick={() => handleConfirmChapter(c.id)}
                      className="w-full text-left p-3 bg-gray-900 hover:bg-emerald-600 rounded-xl text-sm transition font-medium flex justify-between items-center cursor-pointer"
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

      {/* 🌟 MODAL PHÊ DUYỆT THAM GIA PHÒNG (CHỈ HOST MỚI NHÌN THẤY) */}
      {isHost && joinRequests.length > 0 && (
        <div className="fixed bottom-16 right-6 z-50 flex flex-col gap-2 max-w-sm w-full animate-bounce-short">
          {joinRequests.map((req) => (
            <div
              key={req.applicant.id}
              className="bg-gray-900/95 border border-amber-500/40 p-4 rounded-xl shadow-2xl backdrop-blur flex flex-col gap-3"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-amber-500/20 text-amber-300 flex items-center justify-center font-bold text-sm">
                  {req.applicant.name?.charAt(0).toUpperCase() || "U"}
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">{req.applicant.name || "Người dùng"}</h4>
                  <p className="text-[11px] text-gray-400">Đang xin vào phòng đọc này</p>
                </div>
              </div>

              <div className="flex items-center gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => respondJoinRequest(req.applicantSocketId, req.applicant.id, false)}
                  className="px-3 py-1.5 bg-gray-800 hover:bg-red-950/60 text-gray-300 hover:text-red-400 border border-gray-700 rounded-lg text-xs font-semibold transition cursor-pointer"
                >
                  Từ chối
                </button>
                <button
                  type="button"
                  onClick={() => respondJoinRequest(req.applicantSocketId, req.applicant.id, true)}
                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition shadow-lg shadow-emerald-900/40 cursor-pointer"
                >
                  Đồng ý
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}