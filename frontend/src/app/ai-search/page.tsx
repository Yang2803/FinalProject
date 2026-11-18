"use client";

import { useState, useRef, useEffect, Suspense } from "react";
import { useSession } from "next-auth/react";
import { useSearchParams, useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import Link from "next/link";

interface ChatMessage {
  id: string;
  role: "user" | "model";
  content: string;
  imageUrl?: string;
}

interface ChatSession {
  id: string;
  title: string;
  updatedAt: string;
}

function AiSearchChatContent() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const router = useRouter();

  // States
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // States cho tính năng tìm kiếm bằng hình ảnh
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [imageMimeType, setImageMimeType] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Cờ khóa để đảm bảo chỉ tự động gửi prompt từ URL đúng 1 lần
  const autoPromptTriggeredRef = useRef<string | null>(null);

  const chatEndRef = useRef<HTMLDivElement>(null);

  // Tự động cuộn xuống cuối
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // Load danh sách Session khi mới vào
  useEffect(() => {
    if (session?.user?.id) {
      fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/chat/sessions/${session.user.id}`)
        .then((res) => res.json())
        .then((data) => setSessions(data))
        .catch(console.error);
    }
  }, [session?.user?.id]);

  // Load tin nhắn khi bấm vào một Session cụ thể
  useEffect(() => {
    const fetchSessionMessages = async () => {
      if (activeSessionId) {
        try {
          const res = await fetch(
            `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/chat/session/${activeSessionId}`
          );
          const data = await res.json();
          setMessages(data);
        } catch (error) {
          console.error(error);
        }
      } else {
        setMessages([
          {
            id: "welcome",
            role: "model",
            content:
              "Hi! I'm the AI Assistant from Smart Anime Platform 🌸. Are you looking for Anime/Manga based on a storyline, or would you like to upload an image (📷) so I can help identify it?",
          },
        ]);
      }
    };

    fetchSessionMessages();
  }, [activeSessionId]);

  // 🌟 HÀM GỬI TIN NHẮN DÙNG CHUNG (HỖ TRỢ CẢ GÕ TAY LẪN AUTO-PROMPT TỪ TRANG CHỦ)
  const sendPromptToAi = async (
    textToSend: string,
    imageBase64ToSend?: string | null,
    mimeTypeToSend?: string,
    targetSessionId?: string | null
  ) => {
    if ((!textToSend.trim() && !imageBase64ToSend) || !session?.user?.id) return;

    const userMsg = textToSend.trim();

    const tempUserMsg: ChatMessage = {
      id: `user_${userMsg.length}_${messages.length}`,
      role: "user",
      content:
        userMsg ||
        "Please identify which Anime or Manga this image belongs to and who the characters are.",
      imageUrl: imageBase64ToSend || undefined,
    };

    setMessages((prev) => [...prev, tempUserMsg]);
    setIsLoading(true);

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/chat/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: session.user.id,
          sessionId: targetSessionId ?? activeSessionId,
          message: userMsg,
          imageBase64: imageBase64ToSend,
          mimeType: mimeTypeToSend,
        }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        console.error("Lỗi từ Backend:", errorText);
        throw new Error(`API Error: ${res.status}`);
      }

      const data = await res.json();

      // Nạp tin nhắn AI vào UI
      setMessages((prev) => [...prev, data.reply]);

      // Nếu là chat mới tinh, cập nhật lại SessionID và load lại Sidebar
      if (!(targetSessionId ?? activeSessionId)) {
        setActiveSessionId(data.sessionId);
        const sessionRes = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/chat/sessions/${session.user.id}`
        );
        const sessionData = await sessionRes.json();
        setSessions(sessionData);
      }
    } catch (error) {
      console.error(error);
      setMessages((prev) => [
        ...prev,
        {
          id: "err",
          role: "model",
          content:
            "Sorry, the magical connection is being disrupted or the image is too heavy. Please try again later! 💦",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // 🌟 TỰ ĐỘNG NHẬN PROMPT HOẶC CHẾ ĐỘ TÌM ẢNH TỪ TRANG CHỦ
  useEffect(() => {
    if (!session?.user?.id) return;

    const urlPrompt = searchParams.get("prompt");
    const urlMode = searchParams.get("mode");

    // 1. Nếu có ?prompt=... trên URL -> Tự động gửi câu hỏi cho AI ngay lập tức
    if (urlPrompt && autoPromptTriggeredRef.current !== urlPrompt) {
      autoPromptTriggeredRef.current = urlPrompt;
      setActiveSessionId(null);

      // Xóa query trên thanh địa chỉ để F5 không bị gửi lặp lại
      router.replace("/ai-search");

      sendPromptToAi(urlPrompt, null, "", null);
    }
    // 2. Nếu bấm nút "Tìm bằng Hình Ảnh" từ trang chủ (?mode=image) -> Tự bật hộp chọn ảnh
    else if (urlMode === "image" && autoPromptTriggeredRef.current !== "MODE_IMAGE") {
      autoPromptTriggeredRef.current = "MODE_IMAGE";
      router.replace("/ai-search");
      setTimeout(() => {
        fileInputRef.current?.click();
      }, 300);
    }
  }, [searchParams, session?.user?.id]);

  // Hàm xử lý khi người dùng chọn ảnh từ máy
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Please select only image files (JPG, PNG, WEBP...)!");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert("Image size is too large! Please select an image smaller than 5MB.");
      return;
    }

    setImageMimeType(file.type);
    const reader = new FileReader();
    reader.onloadend = () => {
      setSelectedImage(reader.result as string);
    };
    reader.readAsDataURL(file);

    e.target.value = "";
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!input.trim() && !selectedImage) || !session?.user?.id) return;

    const userMsg = input.trim();
    const currentImage = selectedImage;
    const currentMime = imageMimeType;

    setInput("");
    setSelectedImage(null);
    setImageMimeType("");

    await sendPromptToAi(userMsg, currentImage, currentMime, activeSessionId);
  };

  const createNewChat = () => {
    setActiveSessionId(null);
    setSelectedImage(null);
    setImageMimeType("");
  };

  if (!session)
    return (
      <div className="min-h-screen bg-[#0f0f11] text-white flex items-center justify-center">
        Please log in to use the AI.
      </div>
    );

  return (
    <div className="flex h-full bg-[#0f0f11] overflow-hidden font-sans relative">
      {/* LỚP NỀN MỜ (BACKDROP) KHI MỞ LỊCH SỬ CHAT TRÊN MOBILE */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-30 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* ==================================================== */}
      {/* SIDEBAR: LỊCH SỬ CHAT */}
      {/* ==================================================== */}
      <div
        className={`${
          isSidebarOpen
            ? "translate-x-0 w-72 sm:w-64"
            : "-translate-x-full w-72 sm:w-64 lg:translate-x-0 lg:w-0 lg:border-r-0"
        } fixed lg:static inset-y-0 left-0 z-40 lg:z-20 transition-all duration-300 flex-shrink-0 bg-gray-900/95 lg:bg-gray-900/50 backdrop-blur-xl border-r border-gray-800 flex flex-col overflow-hidden pb-16 md:pb-0`}
      >
        <div className="p-4 flex items-center gap-2">
          <button
            onClick={() => {
              createNewChat();
              if (window.innerWidth < 1024) setIsSidebarOpen(false);
            }}
            className="flex-1 py-2.5 sm:py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white text-sm font-bold rounded-xl shadow-lg shadow-purple-500/20 transition flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
          >
            <span>+</span> New Chat
          </button>

          {/* Nút đóng nhanh Sidebar trên Mobile */}
          <button
            type="button"
            onClick={() => setIsSidebarOpen(false)}
            className="lg:hidden w-10 h-10 rounded-xl bg-gray-800 text-gray-400 hover:text-white flex items-center justify-center border border-gray-700 shrink-0"
            aria-label="Close History"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 custom-scrollbar space-y-1">
          <p className="text-xs text-gray-500 font-bold px-2 py-2 uppercase whitespace-nowrap">
            Search History
          </p>
          {sessions.map((s) => (
            <button
              key={s.id}
              onClick={() => {
                setActiveSessionId(s.id);
                if (window.innerWidth < 1024) setIsSidebarOpen(false);
              }}
              className={`w-full text-left p-3 rounded-lg text-sm truncate transition cursor-pointer ${
                activeSessionId === s.id
                  ? "bg-gray-800 text-purple-400 font-bold border border-gray-700"
                  : "text-gray-400 hover:bg-gray-800/50 hover:text-white"
              }`}
            >
              💬 {s.title}
            </button>
          ))}
        </div>
      </div>

      {/* ==================================================== */}
      {/* MAIN CHAT AREA (Cyberpunk UI) */}
      {/* ==================================================== */}
      <div className="flex-1 flex flex-col min-w-0 relative bg-[url('/your-anime-bg.jpg')] bg-cover bg-center bg-no-repeat">
        <div className="absolute inset-0 bg-[#0f0f11]/90 backdrop-blur-sm z-0"></div>

        {/* HEADER KHUNG CHAT */}
        <div className="relative z-10 px-3.5 py-3 sm:p-4 border-b border-gray-800 flex items-center gap-3 bg-gray-900/40 backdrop-blur-md shrink-0">
          <button
            type="button"
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="w-9 h-9 rounded-lg bg-gray-800/70 hover:bg-gray-800 text-gray-300 hover:text-white flex items-center justify-center border border-gray-700/60 transition cursor-pointer shrink-0"
            title="Toggle Search History"
          >
            ☰
          </button>
          <h2 className="font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-cyan-400 text-base sm:text-xl tracking-wider truncate">
            SMART AI ASSISTANT
          </h2>
        </div>

        {/* DANH SÁCH TIN NHẮN */}
        <div className="flex-1 overflow-y-auto p-3.5 sm:p-6 md:p-8 space-y-5 sm:space-y-6 relative z-10 custom-scrollbar">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${
                msg.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              {msg.role === "model" && (
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center text-xs sm:text-sm mr-2 sm:mr-3 shadow-[0_0_10px_rgba(34,211,238,0.5)] shrink-0 mt-0.5">
                  🤖
                </div>
              )}

              <div
                className={`max-w-[88%] sm:max-w-[85%] md:max-w-[70%] p-3 sm:p-4 text-sm sm:text-[15px] leading-relaxed relative break-words ${
                  msg.role === "user"
                    ? "bg-gradient-to-br from-purple-600 to-indigo-600 text-white rounded-2xl rounded-tr-sm shadow-[0_0_15px_rgba(147,51,234,0.3)]"
                    : "bg-gray-800/80 backdrop-blur-md text-gray-200 border border-gray-700/50 rounded-2xl rounded-tl-sm shadow-xl"
                }`}
              >
                {msg.role === "user" ? (
                  <div className="flex flex-col gap-2 sm:gap-2.5">
                    {msg.imageUrl && (
                      <img
                        src={msg.imageUrl}
                        alt="Uploaded search"
                        className="max-h-52 sm:max-h-60 w-auto rounded-xl border border-white/20 object-contain self-end"
                      />
                    )}
                    <div className="whitespace-pre-wrap break-words">
                      {msg.content}
                    </div>
                  </div>
                ) : (
                  <div className="prose prose-invert prose-sm sm:prose-base max-w-none prose-p:mb-2 prose-ul:my-2 break-words">
                    <ReactMarkdown
                      components={{
                        a: ({ ...props }) => {
                          const isExternal = props.href?.startsWith("http");
                          return (
                            <Link
                              href={props.href || "#"}
                              target={isExternal ? "_blank" : "_self"}
                              className="text-cyan-400 font-extrabold hover:text-cyan-300 hover:underline transition-all duration-200 decoration-cyan-400 decoration-2 break-all"
                            >
                              {props.children}
                            </Link>
                          );
                        },
                      }}
                    >
                      {msg.content}
                    </ReactMarkdown>
                  </div>
                )}
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start items-center">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center text-xs sm:text-sm mr-2 sm:mr-3 shadow-[0_0_10px_rgba(34,211,238,0.5)] shrink-0">
                🤖
              </div>
              <div className="bg-gray-800/80 backdrop-blur-md border border-gray-700/50 rounded-2xl rounded-tl-sm p-3.5 sm:p-4 flex gap-2 items-center w-20 h-[46px] sm:h-[52px]">
                <span className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce shadow-[0_0_5px_cyan]"></span>
                <span className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce delay-100 shadow-[0_0_5px_cyan]"></span>
                <span className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce delay-200 shadow-[0_0_5px_cyan]"></span>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* KHUNG NHẬP TIN NHẮN & TẢI ẢNH */}
        <div className="p-3 sm:p-4 md:p-6 bg-gradient-to-t from-[#0f0f11] via-[#0f0f11]/95 to-transparent relative z-10 shrink-0">
          {/* KHUNG XEM TRƯỚC ẢNH ĐANG ĐÍNH KÈM */}
          {selectedImage && (
            <div className="max-w-4xl mx-auto mb-2.5 sm:mb-3 flex items-center gap-2.5 sm:gap-3 bg-gray-900/95 border border-purple-500/50 p-2 sm:p-2.5 rounded-2xl w-full sm:w-fit shadow-xl backdrop-blur-md">
              <img
                src={selectedImage}
                alt="Upload preview"
                className="w-12 h-12 sm:w-16 sm:h-16 object-cover rounded-xl border border-gray-700 shrink-0"
              />
              <div className="text-xs text-gray-200 pr-1 flex-1 min-w-0">
                <p className="font-bold text-purple-400 flex items-center gap-1 truncate">
                  <span>✨ Image is ready</span>
                </p>
                <p className="text-[11px] text-gray-400 mt-0.5 line-clamp-2">
                  Enter additional questions or click submit to search for
                  Anime/Manga
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedImage(null);
                  setImageMimeType("");
                }}
                className="w-7 h-7 rounded-full bg-gray-800 hover:bg-red-500 text-gray-400 hover:text-white text-xs flex items-center justify-center transition cursor-pointer shrink-0"
                title="Remove attached image"
              >
                ✕
              </button>
            </div>
          )}

          <form
            onSubmit={handleSendMessage}
            className="max-w-4xl mx-auto relative group"
          >
            <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-500 to-cyan-500 rounded-full blur opacity-30 group-focus-within:opacity-100 transition duration-500"></div>

            {/* Input chọn file ảnh ẩn */}
            <input
              type="file"
              accept="image/*"
              ref={fileInputRef}
              onChange={handleImageSelect}
              className="hidden"
            />

            {/* Nút bấm tải ảnh lên */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading}
              title="Upload an image to search for Anime/Manga"
              className="absolute left-1.5 sm:left-2.5 top-1/2 -translate-y-1/2 w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-gray-800 hover:bg-gray-700 text-cyan-400 flex items-center justify-center transition z-10 border border-gray-700 cursor-pointer disabled:opacity-50"
            >
              📷
            </button>

            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                selectedImage
                  ? "Enter additional requests (or submit)..."
                  : "Ask anything or tap 📷 to search by image..."
              }
              className="relative w-full bg-gray-900 border border-gray-700 rounded-full py-3 sm:py-4 pl-12 sm:pl-14 pr-12 sm:pr-14 text-xs sm:text-sm outline-none text-white focus:bg-gray-800 transition"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={(!input.trim() && !selectedImage) || isLoading}
              className="absolute right-1.5 sm:right-2 top-1/2 -translate-y-1/2 w-9 h-9 sm:w-10 sm:h-10 bg-gradient-to-r from-purple-600 to-cyan-500 hover:opacity-80 disabled:opacity-50 disabled:grayscale rounded-full flex items-center justify-center text-white transition shadow-lg cursor-pointer z-10"
            >
              ➤
            </button>
          </form>
          <p className="text-center text-[10px] text-gray-500 mt-2 sm:mt-3 px-2">
            AI Assistant can identify Anime scenes, Manga pages, and characters
            from uploaded images.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function AiSearchChatPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#0f0f11] text-white flex items-center justify-center">
          Loading AI Assistant...
        </div>
      }
    >
      <AiSearchChatContent />
    </Suspense>
  );
}