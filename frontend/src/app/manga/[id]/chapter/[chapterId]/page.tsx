"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import CommentSection from "@/components/CommentSection";
import { SUPPORTED_LANGUAGES } from "@/components/constants/languages";
// 🌟 1. THÊM LẠI useRef VÀO ĐÂY VÌ FORM ĐĂNG BÀI CẦN DÙNG NÓ
import { useState, useEffect, use, useRef } from "react"; 
import { useRouter } from "next/navigation";
import { 
  ReaderMode, 
  BackgroundTheme, 
  ReaderSettings, 
  BG_THEMES 
} from "@/types/theme";

// =====================================================================
// 1. INTERFACES
// =====================================================================
interface ChapterData {
  id: string;
  title: string;
  images: string[];
  mangaId: string;
  manga: {
    title: string;
  };
  prevChapterId: string | null;
  nextChapterId: string | null;
}

interface TextBlock {
  translatedText: string;
  type?: "bubble" | "box" | "floating";
  topPercent: number;
  leftPercent: number;
  widthPercent: number;
  heightPercent: number;
}

// =====================================================================
// COMPONENT CON: ẢNH MANGA HỖ TRỢ DỊCH THUẬT BẰNG GEMINI VISION
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
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/manga/translate-page`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl: absoluteImageUrl, targetLang })
      });
      
      if (res.ok) {
        const data = await res.json();
        if (data.blocks.length === 0) {
          alert("AI không tìm thấy chữ nào hợp lệ trên trang này!");
        }
        setBlocks(data.blocks);
        setShowTranslation(true); 
      }
    } catch (error) {
      console.error("Lỗi dịch trang:", error);
    } finally {
      setIsTranslating(false);
    }
  };

  const wrapperClass = mode === "vertical" 
    ? "relative inline-block w-fit max-w-full mb-6 mx-auto" 
    : "relative inline-flex items-center justify-center max-h-[85vh] w-fit mx-auto";

  const imgClass = mode === "vertical"
    ? "w-full max-w-3xl h-auto block select-none"
    : "max-h-[85vh] w-auto block object-contain select-none";

  return (
    <div className={wrapperClass}>
      <img src={imgUrl} alt="Manga Page" className={imgClass} />
      
      <button 
        onClick={handleTranslate} 
        disabled={isTranslating}
        className={`absolute top-4 right-4 text-white px-3 py-1.5 text-xs md:text-sm font-bold rounded shadow-lg z-20 backdrop-blur-sm transition disabled:opacity-50
          ${blocks.length > 0 ? "bg-gray-800/90 hover:bg-gray-700" : "bg-blue-600/90 hover:bg-blue-500"}
        `}
      >
        {isTranslating ? "✨ Scanning..." : 
         blocks.length > 0 ? (showTranslation ? "👁️ Hide translation" : "👁️ Show translation") : 
         "✨ Translate with AI"}
      </button>

      {showTranslation && blocks.map((block, index) => {
        const blockType = block.type || "bubble";
        const isVertical = block.heightPercent > block.widthPercent;
        const isHorizontal = mode === "horizontal";

        // 🌟 1. THU GỌN KHUNG (INSET) ĐỂ KHÔNG ĐÈ LÊN VIỀN ĐEN & NHÂN VẬT XUNG QUANH
        // Nếu là bubble, bóp nhẹ chiều ngang (86%) và chiều dọc (90%) để nằm gọn trong lòng bóng thoại gốc
        const scaleW = blockType === "bubble" ? (isVertical ? 0.76 : 0.84) : 0.92;
        const scaleH = blockType === "bubble" ? 0.88 : 0.92;

        const adjustedWidth = block.widthPercent * scaleW;
        const adjustedHeight = block.heightPercent * scaleH;
        const adjustedLeft = block.leftPercent + (block.widthPercent - adjustedWidth) / 2;
        const adjustedTop = block.topPercent + (block.heightPercent - adjustedHeight) / 2;

        // 🌟 2. TẠO DÁNG HÌNH ELIP / OVAL CHUẨN MANGA ĐỂ KHÔNG CHE 4 GÓC TRANH
        let borderRadius = "50%";
        let background = "rgba(255, 255, 255, 0.92)";
        let textColor = "#000000";
        // Ép padding 2 bên sườn (12% - 14%) để chữ tự động xếp thành cột dọc thay vì dàn ngang
        let boxPadding = isVertical ? "6% 14%" : "6% 10%";

        if (blockType === "bubble") {
          borderRadius = isVertical ? "50% / 42%" : "42% / 50%";
        } else if (blockType === "box") {
          borderRadius = "4px";
          background = "rgba(255, 255, 255, 0.98)";
          boxPadding = "4px 6px";
        } else if (blockType === "floating") {
          borderRadius = "6px";
          background = "rgba(0, 0, 0, 0.85)";
          textColor = "#ffffff";
          boxPadding = "3px 5px";
        }

        // 🌟 3. CỠ CHỮ THEO CHẾ ĐỘ ĐỌC
        const textLen = block.translatedText.length;
        const fontSize = isHorizontal
          ? textLen > 90
            ? "clamp(5.5px, 0.5vw, 6.5px)"
            : textLen > 40
            ? "clamp(6.5px, 0.65vw, 8.0px)"
            : "clamp(8.5px, 0.8vw, 10px)"
          : textLen > 90
            ? "clamp(8px, 0.72vw, 9.5px)"
            : textLen > 40
            ? "clamp(9.5px, 0.9vw, 11px)"
            : "clamp(10.5px, 1.0vw, 12px)";

        return (
          <div 
            key={index}
            className="absolute flex items-center justify-center text-center z-10 pointer-events-none transition-all duration-150"
            style={{
              top: `${adjustedTop}%`,
              left: `${adjustedLeft}%`,
              width: `${adjustedWidth}%`,
              height: `${adjustedHeight}%`,
            }}
          >
            <div
              className="w-full h-full flex items-center justify-center text-center overflow-hidden"
              style={{
                backgroundColor: background,
                color: textColor,
                borderRadius: borderRadius,
                padding: boxPadding,
                fontSize: fontSize,
                lineHeight: "1.2",
                fontWeight: "600",
                fontFamily: "'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
              }}
            >
              <span 
                className="w-full text-center select-none"
                style={{
                  wordBreak: "break-word",
                  whiteSpace: "normal",
                  overflowWrap: "break-word",
                  // 🌟 Giúp các dòng chữ tự cân bằng độ dài thành cột dọc đẹp mắt
                  textWrap: "balance",
                  display: "-webkit-box",
                  WebkitLineClamp: isVertical ? 10 : 7,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }}
              >
                {block.translatedText}
              </span>
            </div>
          </div>
        );
      })}
    </div>   
  );         
}
      

// =====================================================================
// COMPONENT CHÍNH
// =====================================================================
export default function MangaReaderPage({ params }: { params: Promise<{ id: string; chapterId: string }> }) {
  const lastLoggedChapter = useRef<string | null>(null);
  const resolvedParams = use(params);
  const mangaId = resolvedParams.id;
  const chapterId = resolvedParams.chapterId;
  const router = useRouter();

  const [chapter, setChapter] = useState<ChapterData | null>(null);
  const [loading, setLoading] = useState(true);

  // 🌟 CẤU HÌNH THEME & CHẾ ĐỘ ĐỌC (TỰ ĐỘNG LƯU VÀO LOCALSTORAGE)
  const [settings, setSettings] = useState<ReaderSettings>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("manga_reader_settings");
        if (saved) return JSON.parse(saved);
      } catch (e) {
        console.error("Lỗi đọc cài đặt manga reader:", e);
      }
    }
    return {
      mode: "VERTICAL",
      bgTheme: "oled",
      maxWidth: "fit",
    };
  });
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

  const [currentPage, setCurrentPage] = useState(0);
  const [targetLang, setTargetLang] = useState("Vietnamese");

  const { data: session } = useSession();

  // =====================================================================
  // 🌟 CÁC STATE CHO TÍNH NĂNG ĐĂNG BÀI LÊN FORUM
  // =====================================================================
  const [isForumModalOpen, setIsForumModalOpen] = useState(false);
  const [postTitle, setPostTitle] = useState("");
  const [postContent, setPostContent] = useState("");
  const [postCategory, setPostCategory] = useState<"GENERAL" | "ANIME" | "MANGA">("MANGA");
  const [postTags, setPostTags] = useState<string[]>([]);
  const [postTagInput, setPostTagInput] = useState("");
  const [postIsSpoiler, setPostIsSpoiler] = useState(false);
  const [isPostingToForum, setIsPostingToForum] = useState(false);

  const [postMediaFile, setPostMediaFile] = useState<File | null>(null);
  const [postMediaPreview, setPostMediaPreview] = useState<string | null>(null);
  const [isAnalyzingForum, setIsAnalyzingForum] = useState(false);
  const postFileInputRef = useRef<HTMLInputElement>(null);
  const [attachedLink, setAttachedLink] = useState<{title: string, url: string} | null>(null);

 

  const updateSettings = (partial: Partial<ReaderSettings>) => {
    setSettings((prev) => {
      const updated = { ...prev, ...partial };
      localStorage.setItem("manga_reader_settings", JSON.stringify(updated));
      return updated;
    });
  };

  // --- LOGIC FORUM: CHÈN LIÊN KẾT TRUYỆN THÀNH THẺ ĐÍNH KÈM ---
  const handleInsertMangaLink = () => {
    if (!chapter) return;
    
    const baseUrl = window.location.origin;
    const pageParam = settings.mode !== "VERTICAL" ? `?page=${currentPage + 1}` : "";
    const mangaUrl = `${baseUrl}/manga/${mangaId}/chapter/${chapterId}${pageParam}`;
    
    const pageText = settings.mode !== "VERTICAL" ? ` - Trang ${currentPage + 1}` : "";
    const titleText = `${chapter.manga.title} - ${chapter.title}${pageText}`;

    setAttachedLink({ title: titleText, url: mangaUrl });
    
    if (!postTitle) setPostTitle(`Discuss about ${chapter.manga.title} - ${chapter.title}`);
  };

  // --- LOGIC FORUM: CHỌN ẢNH ---
  const handlePostFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setPostMediaFile(file);
      setPostMediaPreview(URL.createObjectURL(file));
    }
  };

  // --- LOGIC FORUM: AI CHECK ---
  const handleForumAIAnalyze = async () => {
    if (!postTitle || !postContent) return alert("Nhập nội dung để AI phân tích!");
    setIsAnalyzingForum(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/forum/analyze`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: postTitle, content: postContent })
      });
      const data = await res.json();
      setPostTags(Array.from(new Set([...postTags, ...data.tags])));
      setPostIsSpoiler(data.isSpoiler);
    } catch (error) { alert("Lỗi AI"); } finally { setIsAnalyzingForum(false); }
  };

  // --- LOGIC FORUM: XỬ LÝ TAGS ---
  const handleKeyDownTag = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && postTagInput.trim() !== '') {
      e.preventDefault();
      const newTag = postTagInput.trim().replace(/^#/, ''); 
      if (!postTags.includes(newTag)) setPostTags([...postTags, newTag]);
      setPostTagInput("");
    }
  };
  const removeTag = (tagToRemove: string) => setPostTags(postTags.filter(t => t !== tagToRemove));

  // --- LOGIC FORUM: SUBMIT BÀI ĐĂNG ---
  const handleSubmitForumPost = async () => {
    if (!postTitle.trim() || (!postContent.trim() && !postMediaFile && !attachedLink)) {
      return alert("Vui lòng nhập tiêu đề và nội dung bài viết!");
    }
    if (!session?.user?.id) return alert("Vui lòng đăng nhập để đăng bài!");

    setIsPostingToForum(true);
    try {
      let finalMediaUrl = null;
      if (postMediaFile) {
        const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
        const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;
        if (!cloudName || !uploadPreset) { alert("Chưa cấu hình Cloudinary!"); setIsPostingToForum(false); return; }
        
        const formData = new FormData(); formData.append("file", postMediaFile); formData.append("upload_preset", uploadPreset);
        const resourceType = postMediaFile.type.startsWith('video/') ? 'video' : 'image';
        
        const cloudRes = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`, { method: "POST", body: formData });
        const cloudData = await cloudRes.json();
        if (!cloudRes.ok) throw new Error("Lỗi upload ảnh");
        finalMediaUrl = cloudData.secure_url;
      }

      let finalContent = postContent;
      if (attachedLink) {
        finalContent += `\n\n📖 Đang đọc: [${attachedLink.title}](${attachedLink.url})`;
      }

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/forum/posts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          title: postTitle, content: finalContent, category: postCategory, tags: postTags, 
          isSpoiler: postIsSpoiler, mediaUrl: finalMediaUrl, authorId: session.user.id 
        })
      });

      if (res.ok) {
        alert("🎉 Successfully posted to the forum! You can continue reading the manga.");
        setIsForumModalOpen(false);
        setPostTitle(""); setPostContent(""); setPostTags([]); setPostIsSpoiler(false);
        setPostMediaFile(null); setPostMediaPreview(null); setAttachedLink(null);
      } else {
        const data = await res.json(); alert(data.error || "Error posting to the forum!");
      }
    } catch (error) { alert("An error occurred while connecting to the server."); } finally { setIsPostingToForum(false); }
  };

  // =====================================================================
  // FETCH DỮ LIỆU CHƯƠNG & LỊCH SỬ
  // =====================================================================
  useEffect(() => {
    const fetchChapter = async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/chapter/${chapterId}`);
        if (res.ok) {
          const data = await res.json();
          setChapter(data);
        }
      } catch (error) {
        console.error("Lỗi tải chương:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchChapter();
  }, [chapterId]);

  useEffect(() => {
    const recordHistory = async () => {
      if (session?.user?.id && mangaId && chapterId) {
        try {
          await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/history/manga`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId: session.user.id, mangaId, chapterId })
          });
        } catch (error) {
          console.error("Lỗi ghi nhận lịch sử", error);
        }
      }
    };
    recordHistory();
  }, [session?.user?.id, mangaId, chapterId]);

  // LOG LƯỢT XEM
  useEffect(() => {
    const logMangaView = async () => {
      if (!mangaId || !chapterId || lastLoggedChapter.current === chapterId) return;
      lastLoggedChapter.current = chapterId;

      try {
        await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/manga/${mangaId}/view`, {
          method: 'POST',
        });
      } catch (error) {
        console.error("Lỗi khi ghi nhận lượt đọc:", error);
        lastLoggedChapter.current = null;
      }
    };

    logMangaView();
  }, [mangaId, chapterId]);

  // 🌟 ĐỊNH NGHĨA LẠI 2 HÀM CHUYỂN TRANG
  const handleNextPage = () => {
    if (chapter && currentPage < chapter.images.length) {
      setCurrentPage((prev) => prev + 1);
    }
  };

  const handlePrevPage = () => {
    if (currentPage > 0) {
      setCurrentPage((prev) => prev - 1);
    }
  };

  // =====================================================================
  // BẮT PHÍM MŨI TÊN (HỖ TRỢ MANGA RTL / LTR)
  // =====================================================================
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "TEXTAREA") return;
      if (settings.mode === "VERTICAL" || !chapter) return;

      if (e.key === "ArrowRight") {
        if (settings.mode === "PAGED_RTL") {
          handlePrevPage();
        } else {
          handleNextPage();
        }
      } else if (e.key === "ArrowLeft") {
        if (settings.mode === "PAGED_RTL") {
          handleNextPage();
        } else {
          handlePrevPage();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [settings.mode, currentPage, chapter]);

  // =====================================================================
  // BẮT PHÍM MŨI TÊN (HỖ TRỢ MANGA RTL / LTR)
  // =====================================================================
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "TEXTAREA") return;
      if (settings.mode === "VERTICAL" || !chapter) return;

      if (e.key === "ArrowRight") {
        if (settings.mode === "PAGED_RTL") {
          setCurrentPage((prev) => Math.max(0, prev - 1));
        } else {
          setCurrentPage((prev) => Math.min(chapter.images.length - 1, prev + 1));
        }
      } else if (e.key === "ArrowLeft") {
        if (settings.mode === "PAGED_RTL") {
          setCurrentPage((prev) => Math.min(chapter.images.length - 1, prev + 1));
        } else {
          setCurrentPage((prev) => Math.max(0, prev - 1));
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [settings.mode, currentPage, chapter]);

  if (loading) return <div className="min-h-screen bg-gray-900 text-white flex justify-center items-center">Loading content...</div>;
  if (!chapter) return <div className="min-h-screen bg-gray-900 text-white flex justify-center items-center">Chapter not found!</div>;

 if (loading) {
    return (
      <div className="min-h-screen bg-[#0f0f11] flex items-center justify-center text-white">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
      </div>
    );
  }

  if (!chapter) {
    return (
      <div className="min-h-screen bg-[#0f0f11] flex flex-col items-center justify-center text-white gap-4">
        <p className="text-gray-400">Không tìm thấy nội dung chương truyện.</p>
        <Link href={`/manga/${mangaId}`} className="text-blue-400 hover:underline">
          &larr; Quay lại danh sách chương
        </Link>
      </div>
    );
  }

  const currentTheme = BG_THEMES[settings.bgTheme];
  const isPaged = settings.mode !== "VERTICAL";

  return (
    <div 
      style={{ backgroundColor: currentTheme.bg, color: currentTheme.text }} 
      className="min-h-screen transition-colors duration-300 relative select-none"
    >
      {/* ===================================================================== */}
      {/* 🌟 THANH ĐIỀU HƯỚNG BÊN TRÊN (STICKY NAVBAR) */}
      {/* ===================================================================== */}
      <div 
        className="sticky top-0 z-40 backdrop-blur-md border-b p-4 shadow-lg flex flex-wrap md:flex-nowrap justify-between items-center gap-4 transition-colors duration-300"
        style={{ 
          backgroundColor: `${currentTheme.bg}e6`,
          borderColor: settings.bgTheme === 'light' || settings.bgTheme === 'sepia' ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)'
        }}
      >
        {/* Nút quay lại & Tiêu đề */}
        <div className="flex items-center gap-4">
          <Link 
            href={`/manga/${mangaId}`} 
            className="px-3 py-1.5 rounded-lg text-sm font-bold transition shrink-0 border"
            style={{ 
              backgroundColor: currentTheme.cardBg, 
              borderColor: 'rgba(128,128,128,0.2)',
              color: currentTheme.text 
            }}
          >
            &larr; Back to Series
          </Link>
          <div>
            <h1 className="font-bold text-blue-500 truncate max-w-[150px] md:max-w-[200px]">{chapter.manga.title}</h1>
            <h2 className="text-sm opacity-70 truncate max-w-[150px] md:max-w-[200px]">{chapter.title}</h2>
          </div>
        </div>

        <div className="flex items-center gap-3 overflow-x-auto w-full md:w-auto pb-2 md:pb-0 hide-scrollbar">
          {/* NÚT THẢO LUẬN FORUM */}
          <button 
            onClick={() => setIsForumModalOpen(true)}
            className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg text-sm font-bold transition shadow-lg shadow-blue-500/20 flex items-center gap-1.5 shrink-0"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
            <span className="hidden sm:inline">Discuss</span>
          </button>

          {/* Menu Chọn ngôn ngữ dịch AI */}
          <div 
            className="flex items-center gap-2 p-1 rounded-lg shrink-0 border"
            style={{ backgroundColor: currentTheme.cardBg, borderColor: 'rgba(128,128,128,0.2)' }}
          >
            <span className="text-xs font-bold opacity-70 pl-2">Translate:</span>
            <select 
              value={targetLang}
              onChange={(e) => setTargetLang(e.target.value)}
              className="bg-transparent text-sm px-2 py-1 rounded outline-none cursor-pointer"
              style={{ color: currentTheme.text }}
            >
              {SUPPORTED_LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.code} className="bg-gray-900 text-white">
                  {lang.label}
                </option>
              ))}
            </select>
          </div>

          {/* 🌟 NÚT MỞ CÀI ĐẶT ĐỌC (Kiểu đọc & Màu nền) */}
          <button
            onClick={() => setIsSettingsModalOpen(true)}
            className="px-3 py-1.5 rounded-lg text-sm font-bold transition flex items-center gap-1.5 shrink-0 border shadow-sm active:scale-95"
            style={{ 
              backgroundColor: currentTheme.cardBg, 
              borderColor: 'rgba(128,128,128,0.25)',
              color: currentTheme.text
            }}
          >
            ⚙️ <span className="hidden sm:inline">Reading Settings</span>
          </button>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* 🌟 KHU VỰC HIỂN THỊ NỘI DUNG TRUYỆN */}
      {/* ===================================================================== */}
      <div className="w-full flex justify-center">
        {/* CHẾ ĐỘ 1: CUỘN DỌC TRUYỀN THỐNG (VERTICAL) */}
        {settings.mode === "VERTICAL" && (
          <div className={`flex flex-col items-center w-full px-2 md:px-0 pt-4 ${
            settings.maxWidth === 'fit' ? 'max-w-3xl' : settings.maxWidth === 'medium' ? 'max-w-5xl' : 'w-full'
          }`}>
            {chapter.images.map((imgUrl, index) => (
              <TranslateableImage 
                key={index} 
                imgUrl={imgUrl} 
                targetLang={targetLang} 
                mode="vertical" 
              />
            ))}
            
            {/* Thanh điều hướng ở cuối chương */}
            <div 
              className="my-12 w-full px-4 flex flex-col md:flex-row justify-between items-center gap-4 p-6 rounded-2xl border transition-colors"
              style={{ backgroundColor: currentTheme.cardBg, borderColor: 'rgba(128,128,128,0.2)' }}
            >
              <p className="opacity-70 font-medium md:hidden mb-2">End of Chapter</p>
              
              {chapter.prevChapterId ? (
                <Link 
                  href={`/manga/${mangaId}/chapter/${chapter.prevChapterId}`} 
                  className="w-full md:w-auto text-center px-8 py-3 rounded-xl font-bold transition border"
                  style={{ backgroundColor: currentTheme.bg, borderColor: 'rgba(128,128,128,0.2)' }}
                >
                  &larr; Previous Chapter
                </Link>
              ) : (
                <div className="w-full md:w-auto text-center opacity-40 px-8 py-3 rounded-xl font-bold cursor-not-allowed">First Chapter</div>
              )}

              <Link 
                href={`/manga/${mangaId}`} 
                className="w-full md:w-auto text-center text-blue-500 hover:underline font-bold px-6 py-3 transition rounded-xl"
              >
                ≡ All Chapters
              </Link>

              {chapter.nextChapterId ? (
                <Link 
                  href={`/manga/${mangaId}/chapter/${chapter.nextChapterId}`} 
                  className="w-full md:w-auto text-center bg-blue-600 hover:bg-blue-500 text-white px-8 py-3 rounded-xl font-bold transition shadow-lg shadow-blue-600/20"
                >
                  Next Chapter &rarr;
                </Link>
              ) : (
                <div className="w-full md:w-auto text-center opacity-40 px-8 py-3 rounded-xl font-bold cursor-not-allowed">Updating...</div>
              )}
            </div>
          </div>
        )}

        {/* CHẾ ĐỘ 2 & 3: LẬT TRANG ĐƠN (MANGA RTL / LTR) */}
        {isPaged && (
          <div className="relative w-full h-[calc(100vh-80px)] flex flex-col justify-center items-center select-none overflow-hidden py-4">
            
            {/* Huy hiệu số trang */}
            <div 
              className="absolute top-4 right-4 backdrop-blur-md px-3 py-1 rounded-full text-xs font-bold z-30 border"
              style={{ backgroundColor: `${currentTheme.cardBg}cc`, borderColor: 'rgba(128,128,128,0.2)' }}
            >
              Trang {currentPage < chapter.images.length ? currentPage + 1 : chapter.images.length} / {chapter.images.length}
            </div>

            {/* Vùng bấm ẩn để lùi / tiến trang */}
            <div 
              className="absolute top-0 left-0 w-1/4 h-full z-10 cursor-w-resize" 
              onClick={() => {
                if (settings.mode === "PAGED_RTL") {
                  handleNextPage();
                } else {
                  handlePrevPage();
                }
              }} 
              title={settings.mode === "PAGED_RTL" ? "Trang sau" : "Trang trước"} 
            />
            <div 
              className="absolute top-0 right-0 w-1/4 h-full z-10 cursor-e-resize" 
              onClick={() => {
                if (settings.mode === "PAGED_RTL") {
                  handlePrevPage();
                } else {
                  handleNextPage();
                }
              }} 
              title={settings.mode === "PAGED_RTL" ? "Trang trước" : "Trang sau"} 
            />

            {/* HIỂN THỊ ẢNH HOẶC MENU KẾT THÚC CHƯƠNG */}
            {currentPage < chapter.images.length ? (
              <TranslateableImage 
                key={chapter.images[currentPage]}
                imgUrl={chapter.images[currentPage]} 
                targetLang={targetLang} 
                mode="horizontal" 
              />
            ) : (
              <div 
                className="p-8 rounded-2xl border text-center z-30 shadow-2xl w-[90%] max-w-md relative backdrop-blur-md"
                style={{ backgroundColor: currentTheme.cardBg, borderColor: 'rgba(128,128,128,0.2)' }}
              >
                <h3 className="text-xl font-bold mb-2">The chapter has ended.</h3>
                <p className="mb-6 opacity-70 text-sm">You want to do next?</p>
                
                <div className="flex flex-col gap-3">
                  {chapter.nextChapterId ? (
                    <Link 
                      href={`/manga/${mangaId}/chapter/${chapter.nextChapterId}`} 
                      className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-3 rounded-xl font-bold transition w-full shadow-lg z-50 relative pointer-events-auto"
                    >
                      Read next Chapter &rarr;
                    </Link>
                  ) : (
                    <div 
                      className="px-4 py-3 rounded-xl font-bold cursor-not-allowed w-full border opacity-50"
                      style={{ backgroundColor: currentTheme.bg, borderColor: 'rgba(128,128,128,0.2)' }}
                    >
                      Waiting for new Chapter...
                    </div>
                  )}
                  <Link 
                    href={`/manga/${mangaId}`} 
                    className="px-4 py-3 rounded-xl font-bold transition w-full z-50 relative pointer-events-auto border"
                    style={{ backgroundColor: currentTheme.bg, borderColor: 'rgba(128,128,128,0.2)' }}
                  >
                    ≡ All Chapters
                  </Link>
                </div>
              </div>
            )}

            {/* Thanh nút bấm điều hướng trang */}
            <div className="absolute bottom-6 flex gap-4 z-30 pointer-events-auto">
              <button 
                onClick={settings.mode === "PAGED_RTL" ? handleNextPage : handlePrevPage}
                disabled={settings.mode === "PAGED_RTL" ? currentPage === chapter.images.length : currentPage === 0}
                className="w-12 h-12 rounded-full flex justify-center items-center font-bold text-xl shadow-lg border transition disabled:opacity-30"
                style={{ backgroundColor: currentTheme.cardBg, borderColor: 'rgba(128,128,128,0.3)' }}
              >
                &larr;
              </button>
              <button 
                onClick={settings.mode === "PAGED_RTL" ? handlePrevPage : handleNextPage}
                disabled={settings.mode === "PAGED_RTL" ? currentPage === 0 : currentPage === chapter.images.length}
                className="w-12 h-12 rounded-full flex justify-center items-center font-bold text-xl shadow-lg border transition disabled:opacity-30"
                style={{ backgroundColor: currentTheme.cardBg, borderColor: 'rgba(128,128,128,0.3)' }}
              >
                &rarr;
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ===================================================================== */}
      {/* KHU VỰC BÌNH LUẬN (CHỈ HIỆN KHI CUỘN DỌC) */}
      {/* ===================================================================== */}
      {settings.mode === "VERTICAL" && (
        <div className="w-full flex justify-center mt-12 pb-20">
          <div className="w-full max-w-4xl px-4">
            <CommentSection targetType="chapter" targetId={chapterId} />
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 🌟 MODAL TÙY CHỈNH READER (KIỂU ĐỌC & BẢNG MÀU) */}
      {/* ===================================================================== */}
      {isSettingsModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div 
            className="w-full max-w-sm rounded-3xl p-6 shadow-2xl border transition-all"
            style={{ backgroundColor: currentTheme.cardBg, borderColor: 'rgba(128,128,128,0.2)' }}
          >
            <div className="flex items-center justify-between mb-5 border-b pb-3" style={{ borderColor: 'rgba(128,128,128,0.2)' }}>
              <h3 className="font-extrabold text-base">Settings</h3>
              <button onClick={() => setIsSettingsModalOpen(false)} className="opacity-60 hover:opacity-100">✕</button>
            </div>

            {/* 1. Chọn chế độ cuộn / lật trang */}
            <div className="mb-5">
              <label className="block text-xs font-bold uppercase tracking-wider mb-2 opacity-70">
                Reading Mode
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button 
                  onClick={() => updateSettings({ mode: 'VERTICAL' })}
                  className={`p-2 rounded-xl text-xs font-bold border transition ${settings.mode === 'VERTICAL' ? 'border-blue-500 bg-blue-600/20 text-blue-400 font-black' : 'border-gray-500/20 opacity-70'}`}
                >
                  Scroll (Vertical)
                </button>
                <button 
                  onClick={() => updateSettings({ mode: 'PAGED_RTL' })}
                  className={`p-2 rounded-xl text-xs font-bold border transition ${settings.mode === 'PAGED_RTL' ? 'border-blue-500 bg-blue-600/20 text-blue-400 font-black' : 'border-gray-500/20 opacity-70'}`}
                  title="Chuẩn truyện tranh Nhật (Phải sang Trái)"
                >
                  Manga (RTL)
                </button>
                <button 
                  onClick={() => updateSettings({ mode: 'PAGED_LTR' })}
                  className={`p-2 rounded-xl text-xs font-bold border transition ${settings.mode === 'PAGED_LTR' ? 'border-blue-500 bg-blue-600/20 text-blue-400 font-black' : 'border-gray-500/20 opacity-70'}`}
                  title="Chuẩn phương Tây (Trái sang Phải)"
                >
                  Western (LTR)
                </button>
              </div>
            </div>

            {/* 2. Chọn màu nền */}
            <div className="mb-5">
              <label className="block text-xs font-bold uppercase tracking-wider mb-2 opacity-70">
                Background Color
              </label>
              <div className="grid grid-cols-2 gap-2">
                {(Object.keys(BG_THEMES) as BackgroundTheme[]).map((themeKey) => (
                  <button
                    key={themeKey}
                    onClick={() => updateSettings({ bgTheme: themeKey })}
                    className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs font-bold transition ${settings.bgTheme === themeKey ? 'border-blue-500 shadow-sm' : 'border-gray-500/20 opacity-70'}`}
                    style={{ backgroundColor: BG_THEMES[themeKey].bg, color: BG_THEMES[themeKey].text }}
                  >
                    <span className="w-3.5 h-3.5 rounded-full border border-gray-400/40 shrink-0" style={{ backgroundColor: BG_THEMES[themeKey].bg }} />
                    <span className="truncate">{BG_THEMES[themeKey].name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* 3. Độ rộng khung đọc (cho chế độ Cuộn dọc) */}
            {settings.mode === 'VERTICAL' && (
              <div className="mb-6">
                <label className="block text-xs font-bold uppercase tracking-wider mb-2 opacity-70">
                  Maximum Width
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['fit', 'medium', 'full'] as const).map((w) => (
                    <button
                      key={w}
                      onClick={() => updateSettings({ maxWidth: w })}
                      className={`p-2 rounded-xl text-xs font-bold border transition ${settings.maxWidth === w ? 'border-blue-500 bg-blue-600/20 text-blue-400 font-black' : 'border-gray-500/20 opacity-70'}`}
                    >
                      {w === 'fit' ? 'Fit (768px)' : w === 'medium' ? 'Medium (1024px)' : 'Full (100%)'}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <button 
              onClick={() => setIsSettingsModalOpen(false)}
              className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition shadow-lg shadow-blue-600/20"
            >
              Close Settings
            </button>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 🌟 POPUP MODAL ĐĂNG BÀI LÊN FORUM KÈM LIÊN KẾT TRUYỆN */}
      {/* ===================================================================== */}
      {isForumModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#1a1d24] text-white w-full max-w-2xl rounded-2xl border border-gray-800 shadow-2xl flex flex-col max-h-[90vh]">
            
            <div className="flex justify-between items-center p-5 border-b border-gray-800">
              <h2 className="text-xl font-bold text-gray-100 flex items-center gap-2">
                Post to Forum
              </h2>
              <button 
                onClick={() => setIsForumModalOpen(false)} 
                className="text-gray-400 hover:text-white transition bg-gray-800 hover:bg-gray-700 w-8 h-8 rounded-full flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            <div className="p-5 overflow-y-auto custom-scrollbar flex-1 space-y-4">
              <input 
                type="text" placeholder="Tiêu đề bài viết..." value={postTitle} onChange={e => setPostTitle(e.target.value)}
                className="w-full bg-transparent border border-gray-800 rounded-lg px-4 py-3 outline-none font-bold text-lg focus:border-blue-500 transition"
              />
              
              {!attachedLink ? (
                <button 
                  onClick={handleInsertMangaLink}
                  className="w-full bg-blue-900/30 hover:bg-blue-900/50 text-blue-400 border border-blue-800/50 border-dashed py-2 rounded-lg text-sm font-bold transition flex justify-center items-center gap-2"
                >
                  🔗 Extract the link to this comic.
                </button>
              ) : (
                <div className="bg-blue-900/20 border border-blue-800/50 rounded-lg p-3 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-blue-400">📖 Đang đọc:</span>
                    <span className="font-bold text-gray-200 underline decoration-blue-500/50 underline-offset-2">
                      {attachedLink.title}
                    </span>
                  </div>
                  <button onClick={() => setAttachedLink(null)} className="text-gray-400 hover:text-red-400 p-1">✕</button>
                </div>
              )}

              <textarea 
                placeholder="Content of the post, theories, your thoughts..." 
                value={postContent} onChange={e => setPostContent(e.target.value)}
                className="w-full bg-transparent border border-gray-800 rounded-lg px-4 py-3 outline-none resize-none h-32 text-sm text-gray-200 focus:border-blue-500 transition custom-scrollbar leading-relaxed"
              />

              {postMediaPreview && (
                <div className="relative rounded-xl overflow-hidden border border-gray-800 bg-gray-900 aspect-video flex items-center justify-center">
                  {postMediaFile?.type.startsWith('video/') ? (
                    <video src={postMediaPreview} controls className="max-h-full max-w-full" />
                  ) : (
                    <img src={postMediaPreview} alt="Preview" className="max-h-full max-w-full object-contain" />
                  )}
                  <button onClick={() => { setPostMediaFile(null); setPostMediaPreview(null); }} className="absolute top-2 right-2 bg-black/60 text-white rounded-full p-1.5 hover:bg-red-500 transition">✕</button>
                </div>
              )}

              <div className="bg-gray-900/50 p-3 rounded-lg border border-gray-800">
                <div className="flex flex-wrap gap-2 mb-2">
                  {postIsSpoiler && <span className="bg-red-900/50 text-red-400 text-xs px-2.5 py-1 rounded border border-red-500">⚠️ Spoiler</span>}
                  {postTags.map(tag => (
                    <span key={tag} className="bg-blue-900/40 border border-blue-800/50 text-blue-300 text-xs px-2.5 py-1 rounded flex items-center gap-1">
                      #{tag}
                      <button onClick={() => removeTag(tag)} className="hover:text-red-400 ml-1">✕</button>
                    </span>
                  ))}
                </div>
                <input 
                  type="text" placeholder="Enter tags and press Enter (e.g., #Manga, #Theory...)" 
                  value={postTagInput} onChange={e => setPostTagInput(e.target.value)} onKeyDown={handleKeyDownTag}
                  className="w-full bg-transparent outline-none text-sm text-gray-300"
                />
              </div>
            </div>

            <div className="p-5 border-t border-gray-800 flex justify-between items-center bg-gray-900/50 rounded-b-2xl">
              <div className="flex items-center gap-3">
                <select 
                  value={postCategory} onChange={e => setPostCategory(e.target.value as "GENERAL" | "ANIME" | "MANGA")}
                  className="bg-gray-800 text-sm px-3 py-2 rounded-lg outline-none cursor-pointer border border-gray-700 hover:border-gray-600 transition hidden sm:block"
                >
                  <option value="MANGA">📖 Manga</option>
                  <option value="ANIME">🎬 Anime</option>
                  <option value="GENERAL">📍All</option>
                </select>

                <input type="file" accept="image/*,video/*" hidden ref={postFileInputRef} onChange={handlePostFileChange} />
                <button onClick={() => postFileInputRef.current?.click()} className="text-gray-400 hover:text-green-400 transition p-2 bg-gray-800 rounded-lg border border-gray-700 hover:border-green-600" title="Đính kèm Ảnh/Video">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                </button>

                <button onClick={handleForumAIAnalyze} disabled={isAnalyzingForum} className="bg-purple-600/20 text-purple-400 border border-purple-600 hover:bg-purple-600 hover:text-white px-3 py-1.5 rounded-lg text-sm font-bold transition flex items-center gap-1">
                  {isAnalyzingForum ? <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> : "🪄 AI"}
                </button>
              </div>

              <div className="flex items-center gap-3">
                <label className="hidden sm:flex items-center gap-2 text-sm text-gray-400 cursor-pointer hover:text-gray-200 transition">
                  <input type="checkbox" checked={postIsSpoiler} onChange={(e) => setPostIsSpoiler(e.target.checked)} className="rounded bg-gray-800 border-gray-700 text-red-500 focus:ring-red-500 focus:ring-offset-gray-900" />
                  Contains Spoiler?
                </label>

                <button 
                  onClick={handleSubmitForumPost} 
                  disabled={isPostingToForum} 
                  className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2.5 rounded-lg text-sm font-bold transition disabled:opacity-50 shadow-lg shadow-blue-500/20"
                >
                  {isPostingToForum ? "Uploading..." : "Post"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div> 
  );
}