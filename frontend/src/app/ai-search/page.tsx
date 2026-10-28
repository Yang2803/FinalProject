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
      alert("Vui lòng chỉ chọn file hình ảnh (JPG, PNG, WEBP...)!");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert("Dung lượng ảnh quá lớn! Vui lòng chọn ảnh nhỏ hơn 5MB.");
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
    <div className="flex h-[calc(100vh-80px)] bg-[#0f0f11] overflow-hidden font-sans">
      {/* ==================================================== */}
      {/* SIDEBAR: LỊCH SỬ CHAT */}
      {/* ==================================================== */}
      <div
        className={`${
          isSidebarOpen ? "w-64" : "w-0"
        } transition-all duration-300 flex-shrink-0 bg-gray-900/50 backdrop-blur-xl border-r border-gray-800 flex flex-col`}
      >
        <div className="p-4">
          <button
            onClick={createNewChat}
            className="w-full py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-bold rounded-xl shadow-lg shadow-purple-500/20 transition flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>+</span> New Chat
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 custom-scrollbar space-y-1">
          <p className="text-xs text-gray-500 font-bold px-2 py-2 uppercase">
            Search History
          </p>
          {sessions.map((s) => (
            <button
              key={s.id}
              onClick={() => setActiveSessionId(s.id)}
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
      <div className="flex-1 flex flex-col relative bg-[url('/your-anime-bg.jpg')] bg-cover bg-center bg-no-repeat bg-fixed">
        <div className="absolute inset-0 bg-[#0f0f11]/90 backdrop-blur-sm z-0"></div>

        <div className="relative z-10 p-4 border-b border-gray-800 flex items-center gap-3 bg-gray-900/40 backdrop-blur-md">
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="text-gray-400 hover:text-white lg:hidden"
          >
            ☰
          </button>
          <h2 className="font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-cyan-400 text-xl tracking-wider">
            SMART AI ASSISTANT
          </h2>
        </div>

        <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 relative z-10 custom-scrollbar">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${
                msg.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              {msg.role === "model" && (
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center text-sm mr-3 shadow-[0_0_10px_rgba(34,211,238,0.5)] shrink-0">
                  🤖
                </div>
              )}

              <div
                className={`max-w-[85%] md:max-w-[70%] p-4 text-[15px] leading-relaxed relative ${
                  msg.role === "user"
                    ? "bg-gradient-to-br from-purple-600 to-indigo-600 text-white rounded-2xl rounded-tr-sm shadow-[0_0_15px_rgba(147,51,234,0.3)]"
                    : "bg-gray-800/80 backdrop-blur-md text-gray-200 border border-gray-700/50 rounded-2xl rounded-tl-sm shadow-xl"
                }`}
              >
                {msg.role === "user" ? (
                  <div className="flex flex-col gap-2.5">
                    {msg.imageUrl && (
                      <img
                        src={msg.imageUrl}
                        alt="Uploaded search"
                        className="max-h-60 w-auto rounded-xl border border-white/20 object-contain self-end"
                      />
                    )}
                    <div className="whitespace-pre-wrap">{msg.content}</div>
                  </div>
                ) : (
                  <div className="prose prose-invert max-w-none prose-p:mb-2 prose-ul:my-2">
                    <ReactMarkdown
                      components={{
                        a: ({ ...props }) => {
                          const isExternal = props.href?.startsWith("http");
                          return (
                            <Link
                              href={props.href || "#"}
                              target={isExternal ? "_blank" : "_self"}
                              className="text-cyan-400 font-extrabold hover:text-cyan-300 hover:underline transition-all duration-200 decoration-cyan-400 decoration-2"
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
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center text-sm mr-3 shadow-[0_0_10px_rgba(34,211,238,0.5)] shrink-0">
                🤖
              </div>
              <div className="bg-gray-800/80 backdrop-blur-md border border-gray-700/50 rounded-2xl rounded-tl-sm p-4 flex gap-2 items-center w-20 h-[52px]">
                <span className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce shadow-[0_0_5px_cyan]"></span>
                <span className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce delay-100 shadow-[0_0_5px_cyan]"></span>
                <span className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce delay-200 shadow-[0_0_5px_cyan]"></span>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        <div className="p-4 md:p-6 bg-gradient-to-t from-[#0f0f11] to-transparent relative z-10">
          {/* KHUNG XEM TRƯỚC ẢNH ĐANG ĐÍNH KÈM */}
          {selectedImage && (
            <div className="max-w-4xl mx-auto mb-3 flex items-center gap-3 bg-gray-900/95 border border-purple-500/50 p-2.5 rounded-2xl w-fit shadow-xl backdrop-blur-md">
              <img
                src={selectedImage}
                alt="Upload preview"
                className="w-16 h-16 object-cover rounded-xl border border-gray-700"
              />
              <div className="text-xs text-gray-200 pr-2">
                <p className="font-bold text-purple-400 flex items-center gap-1">
                  <span>✨ Image is ready</span>
                </p>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  Enter additional questions or click submit to search for Anime/Manga
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedImage(null);
                  setImageMimeType("");
                }}
                className="w-7 h-7 rounded-full bg-gray-800 hover:bg-red-500 text-gray-400 hover:text-white text-xs flex items-center justify-center transition cursor-pointer"
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
              className="absolute left-2.5 top-2 w-10 h-10 rounded-full bg-gray-800 hover:bg-gray-700 text-cyan-400 flex items-center justify-center transition z-10 border border-gray-700 cursor-pointer disabled:opacity-50"
            >
              📷
            </button>

            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                selectedImage
                  ? "Enter additional requests (or click submit now)..."
                  : "What are you looking for? Or click 📷 to search by image..."
              }
              className="relative w-full bg-gray-900 border border-gray-700 rounded-full py-4 pl-14 pr-14 text-sm outline-none text-white focus:bg-gray-800 transition"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={(!input.trim() && !selectedImage) || isLoading}
              className="absolute right-2 top-2 w-10 h-10 bg-gradient-to-r from-purple-600 to-cyan-500 hover:opacity-80 disabled:opacity-50 disabled:grayscale rounded-full flex items-center justify-center text-white transition shadow-lg cursor-pointer"
            >
              ➤
            </button>
          </form>
          <p className="text-center text-[10px] text-gray-500 mt-3">
            AI Assistant can identify Anime scenes, Manga pages, and characters from uploaded images.
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