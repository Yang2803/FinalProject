"use client";

import { useEffect, useState, useRef, use } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { io, Socket } from "socket.io-client";

// ==========================================
// ĐỊNH NGHĨA INTERFACES
// ==========================================
interface Member {
  id: string;
  status: string;
  user: { id: string; name: string; image: string | null };
}

interface Subtitle {
  id: string;
  label: string;
  url: string;
}

interface PartyRoom {
  id: string;
  name: string;
  inviteCode: string;
  isPrivate: boolean;
  hostId: string;
  status: string;
  anime?: { id: string; title: string } | null;
  episode?: { 
    id: string; 
    title: string; 
    videoUrl: string;
    dubbedLanguages?: string[]; 
    subtitles?: Subtitle[];
  } | null;
  members: Member[];
}

interface ChatMessage {
  sender: string;
  text: string;
  isSystemMsg: boolean;
}

interface AnimeOption {
  id: string;
  title: string;
}

interface EpisodeOption {
  id: string;
  title: string;
  episodeNumber: number;
}

let globalSocket: Socket | null = null;
let globalJoinedRoom: string | null = null; // 🌟 CỜ KHÓA SPAM TIN NHẮN "VỪA THAM GIA"

export default function WatchPartyRoomPage({ params }: { params: Promise<{ inviteCode: string }> }) {
  const { data: session } = useSession();
  const resolvedParams = use(params);
  const inviteCode = resolvedParams.inviteCode;

  const router = useRouter();

  const [room, setRoom] = useState<PartyRoom | null>(null);
  const [loading, setLoading] = useState(true);
  const [socket, setSocket] = useState<Socket | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [animeList, setAnimeList] = useState<AnimeOption[]>([]);
  const [episodeList, setEpisodeList] = useState<EpisodeOption[]>([]);
  const [selectedAnimeId, setSelectedAnimeId] = useState("");
  const [selectedEpisodeId, setSelectedEpisodeId] = useState("");
  const [isChangingVideo, setIsChangingVideo] = useState(false);

  const [activeVideoUrl, setActiveVideoUrl] = useState<string>("");

  const [hasInteracted, setHasInteracted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);

  // BẪY CLICK TOÀN TRANG
  useEffect(() => {
    const unlockAudio = () => {
      setHasInteracted(true);
      window.removeEventListener("click", unlockAudio);
      window.removeEventListener("keydown", unlockAudio);
    };

    window.addEventListener("click", unlockAudio);
    window.addEventListener("keydown", unlockAudio);

    return () => {
      window.removeEventListener("click", unlockAudio);
      window.removeEventListener("keydown", unlockAudio);
    };
  }, []);

  // 🌟 LƯU LỊCH SỬ CHAT VÀO LOCAL STORAGE
  useEffect(() => {
    if (room && messages.length > 0) {
      localStorage.setItem(`party_chat_${room.id}`, JSON.stringify(messages));
    }
  }, [messages, room]);

  // ==========================================
  // 1. TẢI DỮ LIỆU PHÒNG & KHỞI TẠO SOCKET
  // ==========================================
  useEffect(() => {
    const fetchRoomAndConnectSocket = async () => {
      if (!session?.user?.id) return;

      try {
        const res = await fetch(`http://localhost:5000/api/party/rooms/${inviteCode}`);
        if (res.ok) {
          const roomData: PartyRoom = await res.json();
          setRoom(roomData);
          
          // 🌟 KHÔI PHỤC LỊCH SỬ CHAT (Chỉ nạp vào nếu chat đang trống)
          setMessages((prev) => {
            if (prev.length === 0) {
               const savedChat = localStorage.getItem(`party_chat_${roomData.id}`);
               return savedChat ? JSON.parse(savedChat) : [];
            }
            return prev;
          });

          if (roomData.episode) {
            setActiveVideoUrl(roomData.episode.videoUrl);
          }

          const isMember = roomData.members.find(m => m.user.id === session.user.id);

          // 🌟 ĐÃ SỬA TẠI ĐÂY: Xử lý hiển thị thông báo từ chối và điều hướng (Không load lại trang)
          if (isMember?.status === "REJECTED") {
            alert("Yêu cầu tham gia phòng của bạn đã bị từ chối.");
            router.push("/party");
            return;
          }

          let isNewRequest = false;

          if (!isMember && roomData.hostId !== session.user.id) {
            await fetch(`http://localhost:5000/api/party/rooms/${inviteCode}/join`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ userId: session.user.id })
            });

            const newMemberStatus = roomData.isPrivate ? "PENDING" : "JOINED";

            // 🌟 ĐÃ SỬA TẠI ĐÂY: Bỏ window.location.reload() đi, cập nhật state thủ công để UI hiện màn chờ duyệt
            setRoom({
              ...roomData,
              members: [...roomData.members, { 
                id: "temp_" + session.user.id, 
                status: newMemberStatus, 
                user: { 
                    id: session.user.id, 
                    name: session.user.name || "Ẩn danh", 
                    image: session.user.image || null 
                } 
              }]
            });
            isNewRequest = true;
          }

          

          if (!globalSocket) {
            globalSocket = io("http://localhost:5000");
          }

          // 🌟 CHÌA KHÓA CHỐNG SPAM NẰM Ở ĐÂY: Chỉ gửi lệnh tham gia đúng 1 lần
          if (globalJoinedRoom !== roomData.id) {
            globalSocket.emit("join_room", roomData.id, session.user.name);
            globalJoinedRoom = roomData.id;
          }
          
          setSocket(globalSocket);

          if (isNewRequest) {
            globalSocket.emit("new_join_request", { roomId: roomData.id });
          }

          globalSocket.off("receive_video_sync");
          globalSocket.off("receive_message");
          globalSocket.off("receive_video_change");
          globalSocket.off("receive_disband_room");
          globalSocket.off("receive_join_request");   // 🌟 Thêm dòng này
          globalSocket.off("receive_approve_result");

          globalSocket.on("receive_video_sync", (data: { action: string, currentTime: number }) => {
            if (videoRef.current && roomData.hostId !== session.user.id) {
              
              if (Math.abs(videoRef.current.currentTime - data.currentTime) > 1.5) {
                videoRef.current.currentTime = data.currentTime;
              }
              
              if (data.action === "PLAY" && videoRef.current.paused) {
                const playPromise = videoRef.current.play();
                if (playPromise !== undefined) {
                  playPromise.catch(() => {
                    if (videoRef.current) {
                      videoRef.current.muted = true;
                      videoRef.current.play().catch(() => {});
                      setIsMuted(true);
                      setVolume(0);
                    }
                  });
                }
              } else if (data.action === "PAUSE" && !videoRef.current.paused) {
                videoRef.current.pause();
              }
            }
          });

          globalSocket.on("receive_message", (data: ChatMessage) => {
            setMessages((prev) => [...prev, data]);
          });

          globalSocket.on("receive_video_change", () => {
            window.location.reload(); 
          });

          globalSocket.off("receive_join_request");   
          globalSocket.off("receive_approve_result"); 

          // 🌟 1. LẮNG NGHE YÊU CẦU XIN VÀO PHÒNG
          globalSocket.on("receive_join_request", () => {
            // Khi có tín hiệu, TẤT CẢ mọi người (bao gồm trưởng phòng) tải lại danh sách để UI cập nhật ngay lập tức
            fetch(`http://localhost:5000/api/party/rooms/${inviteCode}`)
              .then(res => res.json())
              .then(updatedRoom => setRoom(updatedRoom));
          });

          // 🌟 2. LẮNG NGHE KẾT QUẢ DUYỆT TỪ TRƯỞNG PHÒNG
          globalSocket.on("receive_approve_result", (data: { targetUserId: string, action: string }) => {
            if (data.targetUserId === session?.user?.id) {
              // Nếu TÔI là người bị réo tên
              if (data.action === "REJECT") {
                alert("Yêu cầu tham gia phòng của bạn đã bị từ chối.");
                window.location.href = "/party"; 
              } else if (data.action === "APPROVE") {
                alert("Bạn đã được Trưởng phòng duyệt tham gia!");
                window.location.reload(); // Tải lại nhẹ 1 lần để vào giao diện chính
              }
            } else {
              // Nếu người khác được duyệt/từ chối, cập nhật lại danh sách bên cột chat
              fetch(`http://localhost:5000/api/party/rooms/${inviteCode}`)
                .then(res => res.json())
                .then(updatedRoom => setRoom(updatedRoom));
            }
          });

          // 🌟 LẮNG NGHE TÍN HIỆU GIẢI TÁN TỪ TRƯỞNG PHÒNG
          globalSocket.on("receive_disband_room", () => {
            localStorage.removeItem(`party_chat_${roomData.id}`);
            alert("Trưởng phòng đã giải tán phòng chiếu! Bạn sẽ được đưa về Sảnh chờ.");
            if (globalSocket) {
              globalSocket.disconnect();
              globalSocket = null;
              globalJoinedRoom = null;
            }
            window.location.href = "/party"; 
          });

        }
      } catch (error) {
        console.error("Lỗi:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchRoomAndConnectSocket();

    return () => {
      if (globalSocket) {
        globalSocket.off("receive_video_sync");
        globalSocket.off("receive_message");
        globalSocket.off("receive_video_change");
        globalSocket.off("receive_disband_room");
      }
    };
  }, [inviteCode, session?.user?.id, router]);

  const isHost = session?.user?.id === room?.hostId;

  // ==========================================
  // HỆ THỐNG "HEARTBEAT" TỰ ĐỘNG ĐỒNG BỘ 
  // ==========================================
  useEffect(() => {
    if (!isHost || !socket || !room) return;

    const syncInterval = setInterval(() => {
      if (videoRef.current) {
        socket.emit("sync_video", {
          roomId: room.id,
          action: videoRef.current.paused ? "PAUSE" : "PLAY",
          currentTime: videoRef.current.currentTime
        });
      }
    }, 3000); 

    return () => clearInterval(syncInterval);
  }, [isHost, socket, room]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (isModalOpen && animeList.length === 0) {
      fetch("http://localhost:5000/api/anime")
        .then(res => res.json())
        .then(data => setAnimeList(data))
        .catch(err => console.error("Lỗi tải list anime", err));
    }
  }, [isModalOpen]);

  useEffect(() => {
    if (selectedAnimeId) {
      fetch(`http://localhost:5000/api/anime/${selectedAnimeId}`)
        .then(res => res.json())
        .then(data => {
          setEpisodeList(data.episodes || []);
          setSelectedEpisodeId(""); 
        })
        .catch(err => console.error("Lỗi tải list episode", err));
    } 
  }, [selectedAnimeId]);


  const forceSyncVideo = (action: "PLAY" | "PAUSE" | "SEEK") => {
    if (!socket || !room || !videoRef.current) return;
    socket.emit("sync_video", {
      roomId: room.id,
      action: action,
      currentTime: videoRef.current.currentTime
    });
  };

  const handleApproveMember = async (targetUserId: string, action: "APPROVE" | "REJECT") => {
    if (!room) return;
    try {
      const res = await fetch(`http://localhost:5000/api/party/rooms/${room.id}/approve`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hostId: session?.user?.id, targetUserId, action })
      });
      if (res.ok) {
        setRoom({
          ...room,
          members: room.members.map(m => 
            m.user.id === targetUserId ? { ...m, status: action === "APPROVE" ? "JOINED" : "REJECTED" } : m
          )
        });
        
        // 🌟 SỬA TẠI ĐÂY: Dùng trực tiếp globalSocket để đảm bảo 100% tín hiệu được bắn đi, không bị kẹt bởi React State
        if (globalSocket) {
          globalSocket.emit("send_approve_result", { roomId: room.id, targetUserId, action });
        }
      }
    } catch (error) {}
  };

  const handleSendMessage = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!chatInput.trim() || !socket || !room) return;
    socket.emit("send_message", {
      roomId: room.id,
      sender: session?.user?.name || "Ẩn danh",
      text: chatInput.trim()
    });
    setMessages(prev => [...prev, { sender: "Bạn", text: chatInput.trim(), isSystemMsg: false }]);
    setChatInput("");
  };

  const handleSubmitChangeVideo = async () => {
    if (!selectedAnimeId || !selectedEpisodeId || !room) return;
    setIsChangingVideo(true);
    try {
      const res = await fetch(`http://localhost:5000/api/party/rooms/${room.id}/change-video`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hostId: session?.user?.id, animeId: selectedAnimeId, episodeId: selectedEpisodeId })
      });

      if (res.ok) {
        socket?.emit("change_video", room.id); 
        window.location.reload(); 
      } else {
        alert("Có lỗi khi đổi phim");
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsChangingVideo(false);
    }
  };

  // 🌟 HÀM GIẢI TÁN PHÒNG (DÀNH CHO TRƯỞNG PHÒNG HOẶC KHI PHÒNG TRỐNG)
  const handleDisbandRoom = async () => {
    if (!room) return;
    
    const joinedMembers = room.members.filter(m => m.status === "JOINED");
    if (joinedMembers.length > 1 && !confirm("Bạn có chắc chắn muốn giải tán phòng? Mọi thành viên sẽ bị thoát và toàn bộ dữ liệu phòng sẽ bị xóa.")) return;
    
    try {
      await fetch(`http://localhost:5000/api/party/rooms/${room.id}`, {
        method: "DELETE",
      });

      socket?.emit("disband_room", room.id);
      localStorage.removeItem(`party_chat_${room.id}`);
      
      if (globalSocket) {
        globalSocket.disconnect();
        globalSocket = null;
        globalJoinedRoom = null; // Mở khóa
      }
      router.push("/party");
    } catch (error) {
      console.error("Lỗi xóa phòng:", error);
    }
  };

  // 🌟 HÀM RỜI PHÒNG THÔNG MINH
  const handleLeaveRoom = () => {
    if (!room) return;
    const joinedMembers = room.members.filter(m => m.status === "JOINED");

    if (joinedMembers.length <= 1) {
      handleDisbandRoom();
      return;
    }

    if (globalSocket) {
      globalSocket.emit("leave_room", room.id, session?.user?.name);
      globalSocket.disconnect();
      globalSocket = null; 
      globalJoinedRoom = null; // Mở khóa
    }
    router.push("/party");
  };

  const handleDubChange = (newUrl: string) => {
    if (!videoRef.current) return;
    const currentTime = videoRef.current.currentTime;
    const isPlaying = !videoRef.current.paused;
    setActiveVideoUrl(newUrl);
    setTimeout(() => {
      if (videoRef.current) {
        videoRef.current.currentTime = currentTime;
        if (isPlaying) {
          const playPromise = videoRef.current.play();
          if (playPromise !== undefined) playPromise.catch(()=>{});
        }
      }
    }, 200);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (videoRef.current) {
      videoRef.current.volume = val;
      videoRef.current.muted = val === 0;
      setIsMuted(val === 0);
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      const newMuted = !isMuted;
      videoRef.current.muted = newMuted;
      setIsMuted(newMuted);
      if (newMuted) setVolume(0);
      else setVolume(videoRef.current.volume || 1);
    }
  };

  const handleSubtitleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const langLabel = e.target.value;
    if (videoRef.current) {
      const tracks = videoRef.current.textTracks;
      for (let i = 0; i < tracks.length; i++) {
        if (tracks[i].label === langLabel) {
          tracks[i].mode = 'showing';
        } else {
          tracks[i].mode = 'hidden';
        }
      }
    }
  };

  if (loading) return <div className="min-h-screen bg-[#0f0f11] flex items-center justify-center text-white">Đang tải phòng...</div>;
  if (!room) return <div className="min-h-screen bg-[#0f0f11] flex items-center justify-center text-white">Phòng không tồn tại.</div>;

  const myMembership = room.members.find(m => m.user.id === session?.user?.id);
  if (myMembership?.status === "PENDING" && !isHost) {
    return (
      <div className="min-h-screen bg-[#0f0f11] flex flex-col items-center justify-center text-white">
        <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-6"></div>
        <h2 className="text-2xl font-bold mb-2">Phòng riêng tư (Private)</h2>
        <p className="text-gray-400">Vui lòng đợi Trưởng phòng duyệt yêu cầu tham gia của bạn...</p>
        <button onClick={() => window.location.reload()} className="mt-6 text-blue-400 hover:underline">Tải lại trang</button>
      </div>
    );
  }

  const pendingMembers = room.members.filter(m => m.status === "PENDING");
  const joinedMembers = room.members.filter(m => m.status === "JOINED");

  return (
    <div className="min-h-screen bg-[#0f0f11] text-white flex flex-col md:flex-row p-4 gap-6 h-screen overflow-hidden relative">
      
      {isModalOpen && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="bg-[#1a1d24] w-[400px] p-6 rounded-2xl border border-gray-800 shadow-2xl">
            <h2 className="text-xl font-bold mb-4 flex items-center justify-between">
              📺 Chọn Phim Mới
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-white">✕</button>
            </h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Chọn Anime</label>
                <select 
                  value={selectedAnimeId} 
                  onChange={(e) => {
                    const newAnimeId = e.target.value;
                    setSelectedAnimeId(newAnimeId);
                    if (!newAnimeId) {
                      setEpisodeList([]);
                      setSelectedEpisodeId("");
                    }
                  }}
                  className="w-full bg-gray-900 border border-gray-800 rounded-lg p-3 text-sm outline-none focus:border-blue-500"
                >
                  <option value="">-- Chọn một bộ phim --</option>
                  {animeList.map(anime => (
                    <option key={anime.id} value={anime.id}>{anime.title}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Chọn Tập</label>
                <select 
                  value={selectedEpisodeId} 
                  onChange={(e) => setSelectedEpisodeId(e.target.value)}
                  disabled={!selectedAnimeId || episodeList.length === 0}
                  className="w-full bg-gray-900 border border-gray-800 rounded-lg p-3 text-sm outline-none focus:border-blue-500 disabled:opacity-50"
                >
                  <option value="">{episodeList.length === 0 ? '-- Chọn Anime trước --' : '-- Chọn một tập --'}</option>
                  {episodeList.map(ep => (
                    <option key={ep.id} value={ep.id}>Tập {ep.episodeNumber} - {ep.title}</option>
                  ))}
                </select>
              </div>

              <button 
                onClick={handleSubmitChangeVideo}
                disabled={!selectedEpisodeId || isChangingVideo}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-lg mt-2 transition disabled:opacity-50"
              >
                {isChangingVideo ? "Đang xử lý..." : "Bắt đầu phát!"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🔴 CỘT TRÁI: VIDEO PLAYER */}
      <div className="flex-1 flex flex-col overflow-y-auto custom-scrollbar pr-2">
        <div className="flex items-center justify-between mb-4 shrink-0">
          <div>
            <h1 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500">{room.name}</h1>
            <p className="text-sm text-gray-400">Mã phòng: <span className="font-bold text-white bg-gray-800 px-2 py-0.5 rounded">{room.inviteCode}</span></p>
          </div>
          <button onClick={handleLeaveRoom} className="bg-red-600/20 text-red-500 hover:bg-red-600 hover:text-white px-4 py-2 rounded-lg font-bold transition">
            Rời phòng
          </button>
        </div>

        {room.episode && (
          <div className="bg-[#1a1d24] border border-gray-800 rounded-xl p-4 mb-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shrink-0 shadow-lg">
            <div>
              <h2 className="text-xl font-bold">{room.episode.title}</h2>
              <p className="text-sm text-gray-500 mt-1 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                Trực tiếp Watch Party
              </p>
            </div>
          </div>
        )}

        <div className="w-full aspect-video bg-black rounded-2xl border border-gray-800 overflow-hidden relative shadow-2xl mb-4 shrink-0 flex items-center justify-center">
          
          {room.episode ? (
            <video 
              ref={videoRef}
              src={activeVideoUrl || room.episode.videoUrl} 
              className="w-full h-full object-contain"
              controls={isHost} 
              crossOrigin="anonymous" 
              onPlay={() => forceSyncVideo("PLAY")}
              onPause={() => forceSyncVideo("PAUSE")}
              onSeeked={() => forceSyncVideo("SEEK")}
            >
              {room.episode?.subtitles?.map((sub) => (
                <track 
                    key={sub.id} 
                    kind="captions" 
                    src={sub.url} 
                    srcLang={sub.label} 
                    label={sub.label} 
                />
                ))}
            </video>
          ) : (
            <div className="text-gray-500 flex flex-col items-center">
              <svg className="w-16 h-16 mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" /></svg>
              Trưởng phòng chưa chọn tập phim nào
            </div>
          )}

          {!isHost && <div className="absolute inset-0 z-10" title="Đang đồng bộ với Trưởng phòng"></div>}
        </div>

        {!isHost && !hasInteracted && room.episode && (
          <div className="text-center mb-2 animate-pulse">
            <span className="text-xs bg-yellow-500/20 text-yellow-400 px-3 py-1 rounded-full border border-yellow-500/50">
              Hãy click bất kỳ đâu trên trang để cho phép phát âm thanh
            </span>
          </div>
        )}

        {!isHost && room.episode && (
          <div className="bg-[#1a1d24] border border-gray-800 rounded-xl p-4 mb-6 flex flex-wrap items-center justify-between gap-4 shrink-0 shadow-lg">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-3">
                <button onClick={toggleMute} className="text-gray-400 hover:text-white transition w-6 text-center">
                  {isMuted || volume === 0 ? "🔇" : "🔊"}
                </button>
                <input 
                  type="range" 
                  min="0" max="1" step="0.05" 
                  value={isMuted ? 0 : volume} 
                  onChange={handleVolumeChange}
                  className="w-24 accent-blue-500 cursor-pointer"
                />
              </div>

              {room.episode.subtitles && room.episode.subtitles.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-gray-400 font-bold text-sm">CC:</span>
                  <select 
                    onChange={handleSubtitleChange} 
                    defaultValue="off"
                    className="bg-gray-900 border border-gray-800 text-white text-sm rounded px-3 py-1.5 outline-none focus:border-blue-500 cursor-pointer"
                  >
                    <option value="off">Tắt phụ đề</option>
                    {room.episode.subtitles.map(sub => (
                      <option key={sub.id} value={sub.label}>{sub.label}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            
            <span className="text-xs text-gray-500 italic bg-gray-900 px-3 py-1 rounded-full border border-gray-800">
              Trưởng phòng đang giữ remote
            </span>
          </div>
        )}

        {isHost && (
          <div className="bg-[#1a1d24] rounded-xl border border-blue-900/50 p-5 shadow-lg relative overflow-hidden shrink-0 mb-6">
            <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
              <span className="text-xl">👑</span> Bảng điều khiển Trưởng Phòng
            </h3>
            
            <div className="flex flex-wrap gap-4">
              <button 
                onClick={() => setIsModalOpen(true)}
                className="bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700 px-5 py-2.5 rounded-lg text-sm font-bold transition"
              >
                📺 Chọn Anime/Đổi tập khác
              </button>

              {/* 🌟 NÚT GIẢI TÁN PHÒNG */}
              <button 
                onClick={handleDisbandRoom}
                className="bg-red-600 hover:bg-red-500 text-white px-5 py-2.5 rounded-lg text-sm font-bold transition shadow-lg shadow-red-900/20"
              >
                🧨 Giải tán phòng
              </button>
            </div>

            {pendingMembers.length > 0 && (
              <div className="mt-6">
                <h4 className="text-sm font-bold text-gray-400 mb-3 uppercase tracking-wider">Hàng đợi duyệt vào phòng ({pendingMembers.length})</h4>
                <div className="space-y-2">
                  {pendingMembers.map(member => (
                    <div key={member.id} className="flex items-center justify-between bg-gray-900/50 p-3 rounded-lg border border-gray-800">
                      <div className="flex items-center gap-3">
                        {member.user.image ? (
                          <img src={member.user.image} alt="Avatar" className="w-8 h-8 rounded-full bg-gray-700 object-cover" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center font-bold text-xs text-gray-400">
                            {member.user.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <span className="font-bold text-sm">{member.user.name}</span>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => handleApproveMember(member.user.id, "APPROVE")} className="bg-green-600/20 text-green-500 hover:bg-green-600 hover:text-white px-3 py-1.5 rounded font-bold text-xs transition">Duyệt</button>
                        <button onClick={() => handleApproveMember(member.user.id, "REJECT")} className="bg-red-600/20 text-red-500 hover:bg-red-600 hover:text-white px-3 py-1.5 rounded font-bold text-xs transition">Từ chối</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 🟢 CỘT PHẢI: KHUNG CHAT & DANH SÁCH THÀNH VIÊN */}
      <div className="w-full md:w-80 flex flex-col gap-4 h-full shrink-0">
        <div className="bg-[#1a1d24] rounded-xl border border-gray-800 p-4 shrink-0">
          <h3 className="font-bold text-gray-300 mb-4 flex items-center justify-between">
            <span>Đang xem ({joinedMembers.length})</span>
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
          </h3>
          <div className="space-y-3 max-h-[20vh] overflow-y-auto custom-scrollbar pr-2">
            {joinedMembers.map(member => (
              <div key={member.id} className="flex items-center gap-3">
                <div className="relative">
                  {member.user.image ? (
                    <img src={member.user.image} alt="Avatar" className="w-8 h-8 rounded-full bg-gray-700 object-cover border border-gray-600" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-gray-700 border border-gray-600 flex items-center justify-center font-bold text-xs text-gray-400">
                      {member.user.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  {member.user.id === room.hostId && <span className="absolute -top-1 -right-1 text-xs" title="Trưởng phòng">👑</span>}
                </div>
                <span className="font-bold text-sm text-gray-200 truncate">{member.user.name}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-[#1a1d24] rounded-xl border border-gray-800 p-4 flex-1 flex flex-col overflow-hidden">
          <h3 className="font-bold text-gray-300 mb-4 border-b border-gray-800 pb-2 shrink-0">Live Chat</h3>
          <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 flex flex-col gap-3">
            {messages.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-gray-500 italic text-center">
                Chưa có tin nhắn nào. <br/> Hãy gửi lời chào đến mọi người nhé!
              </div>
            ) : (
              messages.map((msg, index) => (
                <div key={index} className={`flex flex-col ${msg.isSystemMsg ? 'items-center my-2' : msg.sender === 'Bạn' ? 'items-end' : 'items-start'}`}>
                  {msg.isSystemMsg ? (
                    <span className="text-xs bg-gray-800/50 text-gray-400 px-3 py-1 rounded-full">{msg.text}</span>
                  ) : (
                    <div className={`max-w-[85%] flex flex-col ${msg.sender === 'Bạn' ? 'items-end' : 'items-start'}`}>
                      <span className="text-[10px] text-gray-500 mb-0.5 ml-1">{msg.sender}</span>
                      <div className={`px-3 py-2 rounded-2xl text-sm ${msg.sender === 'Bạn' ? 'bg-blue-600 text-white rounded-br-none' : 'bg-gray-800 text-gray-200 rounded-bl-none'}`}>
                        {msg.text}
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          <form onSubmit={handleSendMessage} className="mt-4 pt-4 border-t border-gray-800 flex gap-2 shrink-0">
            <input 
              type="text" 
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Nhập tin nhắn..." 
              className="flex-1 bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500 text-white transition" 
            />
            <button type="submit" disabled={!chatInput.trim()} className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg font-bold text-sm transition">
              Gửi
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}