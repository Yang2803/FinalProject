"use client";

import { useEffect, useState, useRef, Suspense } from "react";
// 🌟 1. THÊM BỔ SUNG useSearchParams để đọc tham số thời gian ?t=... từ URL
import { useParams, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import CommentSection from "@/components/CommentSection";
import { SUPPORTED_LANGUAGES } from '@/components/constants/languages';

const R2_BASE_URL = "https://pub-67a4b86a3ac64626ac476f9978ec23d2.r2.dev"; 

// =====================================================================
// 1. INTERFACE Data for Episode, Subtitle, Chapter
// =====================================================================
interface Subtitle {
  id: string;
  label: string;
  url: string;
}

interface Episode {
  id: string;
  title: string;
  videoUrl: string;
  createdAt: string;
  subtitles?: Subtitle[];
  mappedChapterIds?: string[]; 
  dubbedLanguages?: string[];  
}

interface ChapterData {
  id: string;
  title: string;
  images: string[];
  mangaId: string;
}

// =====================================================================
// 3. MAIN PAGE: Watch anime & SPLIT-SCREEN MANGA
// =====================================================================
function WatchEpisodeContent() {
  const params = useParams();
  // 🌟 2. CAPTURE TIME PARAMETERS (e.g., ?t=600) FROM URL
  const searchParams = useSearchParams();
  const timeParam = searchParams.get("t");

  const animeId = params.id as string || params.animeId as string;
  const episodeId = params.episodeId as string;
  
  const { data: session } = useSession();

  // --- STATE VIDEO ---
  const [animeTitle, setAnimeTitle] = useState("");
  const [episode, setEpisode] = useState<Episode | null>(null);
  const [allEpisodes, setAllEpisodes] = useState<Episode[]>([]); 
  const [loading, setLoading] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);

  // --- STATE DUBBING AI ---
  const [selectedDubLang, setSelectedDubLang] = useState<string>("");
  const audioDubRef = useRef<HTMLAudioElement | null>(null);

  // --- STATE SUBTITLE (ANIME) ---
  const [isTranslatingSub, setIsTranslatingSub] = useState(false);
  const [translateProgress, setTranslateProgress] = useState(0);

  // --- STATE GENERATE DUB ---
  const [isGeneratingDub, setIsGeneratingDub] = useState(false);
  const [dubProgress, setDubProgress] = useState(0);

  // =====================================================================
  // 🌟 STATE FOR FORUM POSTING (FROM WATCH PAGE)
  // =====================================================================
  const [isForumModalOpen, setIsForumModalOpen] = useState(false);
  const [postTitle, setPostTitle] = useState("");
  const [postContent, setPostContent] = useState("");
  const [postCategory, setPostCategory] = useState<"GENERAL" | "ANIME" | "MANGA">("ANIME");
  const [postTags, setPostTags] = useState<string[]>([]);
  const [postTagInput, setPostTagInput] = useState("");
  const [postIsSpoiler, setPostIsSpoiler] = useState(false);
  const [isPostingToForum, setIsPostingToForum] = useState(false);

  // ➕ STATE FOR ATTACHING TIMESTAMP TO FORUM POST
  const [postMediaFile, setPostMediaFile] = useState<File | null>(null);
  const [postMediaPreview, setPostMediaPreview] = useState<string | null>(null);
  const [isAnalyzingForum, setIsAnalyzingForum] = useState(false);
  const postFileInputRef = useRef<HTMLInputElement>(null);
  const [attachedTimestamp, setAttachedTimestamp] = useState<{title: string, url: string} | null>(null);

  // 🌟 FUNCTION TO INSERT CURRENT VIDEO TIMESTAMP INTO FORUM POST
  const handleInsertTimestamp = () => {
    if (!videoRef.current || !episode) return;
    
    const currentTime = videoRef.current.currentTime;
    const minutes = Math.floor(currentTime / 60);
    const seconds = Math.floor(currentTime % 60).toString().padStart(2, '0');
    const timeString = `${minutes}:${seconds}`;

    const baseUrl = window.location.origin;
    const videoUrl = `${baseUrl}/anime/${animeId}/watch/${episodeId}?t=${Math.floor(currentTime)}`;
    const titleText = `${animeTitle} - ${episode.title} (${timeString})`;

    // 🌟 UPDATE STATE TO ATTACH TIMESTAMP
    setAttachedTimestamp({ title: titleText, url: videoUrl });
    
    if (!postTitle) setPostTitle(`Discuss about scene ${timeString} in ${animeTitle}`);
  };

  // --- LOGIC: Choose image for FORUM ---
  const handlePostFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setPostMediaFile(file);
      setPostMediaPreview(URL.createObjectURL(file));
    }
  };

  // --- LOGIC: AI CHECK CHO FORUM ---
  const handleForumAIAnalyze = async () => {
    if (!postTitle || !postContent) return alert("Input content for AI analysis.!");
    setIsAnalyzingForum(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/forum/analyze`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: postTitle, content: postContent })
      });
      const data = await res.json();
      setPostTags(Array.from(new Set([...postTags, ...data.tags])));
      setPostIsSpoiler(data.isSpoiler);
    } catch (error) { alert("Error with AI"); } finally { setIsAnalyzingForum(false); }
  };

  // --- LOGIC: AUTOMATICALLY fast-forward/ rewind VIDEO IF THE PARAMETER ?t= IS PRESENT IN THE URL ---
  useEffect(() => {
    if (timeParam && videoRef.current) {
      const timeToSeek = Number(timeParam);
      if (!isNaN(timeToSeek)) {
        const video = videoRef.current;

        // fast-forward/ rewind video
        const seekToTime = () => {
          video.currentTime = timeToSeek;
        };

        // SCENARIO 1: If the browser loads extremely fast or retrieves from the cache
        if (video.readyState >= 1) { // 1 = HAVE_METADATA
          seekToTime();
        } 
        // SCENARIO 2: If the network is slow, the video will continue to spin while loading.
        else {
          video.addEventListener('loadedmetadata', seekToTime);
          return () => {
            video.removeEventListener('loadedmetadata', seekToTime);
          }
        }
      }
    }
  }, [timeParam, episode]); // 🌟 Re-run this logic after the episode has finished loading.

  // --- LOGIC: Submit upload post forum ---
  const handleSubmitForumPost = async () => {
    //Updated error handling conditions: Must include Content OR File OR Link attached
    if (!postTitle.trim() || (!postContent.trim() && !postMediaFile && !attachedTimestamp)) {
      return alert("Please enter the title and content of your post!");
    }
    if (!session?.user?.id) return alert("Please log in to post!");

    setIsPostingToForum(true);
    try {
      let finalMediaUrl = null;

      // 1. Upload image to Cloudinary (if have)
      if (postMediaFile) {
        const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
        const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;
        if (!cloudName || !uploadPreset) { alert("Cloudinary not configured!"); setIsPostingToForum(false); return; }
        
        const formData = new FormData();
        formData.append("file", postMediaFile);
        formData.append("upload_preset", uploadPreset);
        const resourceType = postMediaFile.type.startsWith('video/') ? 'video' : 'image';
        
        const cloudRes = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`, { method: "POST", body: formData });
        const cloudData = await cloudRes.json();
        if (!cloudRes.ok) throw new Error("Lỗi upload ảnh");
        finalMediaUrl = cloudData.secure_url;
      }

      // 2.nclude the attached tags in the content you send as follows: [Text](Link)
      let finalContent = postContent;
      if (attachedTimestamp) {
        finalContent += `\n\n📺 Đang xem: [${attachedTimestamp.title}](${attachedTimestamp.url})`;
      }

      // 3. Gọi API Đăng bài
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/forum/posts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          title: postTitle, 
          content: finalContent, // 🌟 Sending implicitly merged content
          category: postCategory, 
          tags: postTags, 
          isSpoiler: postIsSpoiler, 
          mediaUrl: finalMediaUrl, 
          authorId: session.user.id 
        })
      });

      if (res.ok) {
        alert("🎉 Your post to the forum has been successful! You can continue watching the movie.");
        setIsForumModalOpen(false);
        // Reset all form states after successful submission
        setPostTitle(""); setPostContent(""); setPostTags([]); setPostIsSpoiler(false);
        setPostMediaFile(null); setPostMediaPreview(null); setAttachedTimestamp(null);
      } else {
        const data = await res.json();
        alert(data.error || "Error occurred while posting!");
      }
    } catch (error) {
      console.error(error);
      alert("An error occurred while connecting to the server.");
    } finally {
      setIsPostingToForum(false);
    }
  };
  // =====================================================================

  // The API call function requests the Backend to generate an MP3 file with voiceover.
  const handleGenerateDub = async (targetLang: string, subtitleUrl: string) => {
    if (!episode || !targetLang || !subtitleUrl) return;
    
    const confirmMsg = `The system will begin generating voiceovers for the language. [${targetLang}]. This process may take a few minutes (depending on video length). Do you want to continue?`;
    if (!window.confirm(confirmMsg)) return;

    setIsGeneratingDub(true);
    setDubProgress(0);

    const progressInterval = setInterval(() => {
      setDubProgress(prev => {
        if (prev >= 99) return 99; 
        if (prev < 40) return prev + Math.floor(Math.random() * 3) + 2; 
        if (prev < 80) return prev + 1; 
        return prev + 0.2; 
      });
    }, 1000);

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/anime/generate-dub`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ episodeId: episode.id, subtitleUrl, targetLang })
      });

      if (res.ok) {
        clearInterval(progressInterval); 
        setDubProgress(100); 
        
        setTimeout(() => {
          alert("🎉 Successfully generated dubbed audio! You can play it now.");
          setEpisode(prev => {
            if (!prev) return prev;
            const currentDubs = prev.dubbedLanguages || [];
            if (!currentDubs.includes(targetLang)) {
              return { ...prev, dubbedLanguages: [...currentDubs, targetLang] };
            }
            return prev;
          });
          setSelectedDubLang(targetLang);
        }, 500);
      } else {
        alert("❌ An error occurred while generating the dubbed audio. Please try again after 2-5 minutes.");
      }
    } catch (error) {
      console.error("Generate dub error:", error);
      alert("❌ Error connecting to the server!");
    } finally {
      clearInterval(progressInterval);
      setTimeout(() => {
        setIsGeneratingDub(false);
        setDubProgress(0);
      }, 2000);
    }
  };

  // --- STATE SPLIT-SCREEN MANGA ---
  const [showSplitScreen, setShowSplitScreen] = useState(false);
  const [linkedChapters, setLinkedChapters] = useState<ChapterData[]>([]);
  const [mangaTargetLang, setMangaTargetLang] = useState("Vietnamese"); 

  const skipTime = (seconds: number) => {
    if (videoRef.current) videoRef.current.currentTime += seconds;
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "TEXTAREA") return;
      if (e.key === "ArrowRight") skipTime(10);
      if (e.key === "ArrowLeft") skipTime(-10);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // 1. LOAD ANIME AND EPISODE INFORMATION
  useEffect(() => {
    const fetchVideoData = async () => {
      try {
        const resAnime = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/anime/${animeId}`);
        if (resAnime.ok) {
          const data = await resAnime.json();
          setAnimeTitle(data.title);
          setAllEpisodes(data.episodes); 
          const currentEp = data.episodes.find((ep: Episode) => ep.id === episodeId);
          setEpisode(currentEp || null);
        }
      } catch (error) {
        console.error("Error:", error);
      } finally {
        setLoading(false);
      }
    };
    if (animeId && episodeId) fetchVideoData();
  }, [animeId, episodeId]);

  // 2. LOAD INFORMATION ON RELATED MANGA CHAPTERS (IF ANY)
  useEffect(() => {
    const fetchLinkedChapters = async () => {
      if (!episode?.mappedChapterIds || episode.mappedChapterIds.length === 0) return;
      
      try {
        const chapterPromises = episode.mappedChapterIds.map(id =>
          fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/chapter/${id}`).then(res => res.json())
        );
        const chapters = await Promise.all(chapterPromises);
        setLinkedChapters(chapters);
      } catch (error) {
        console.error("Error loading linked chapters:", error);
      }
    };
    fetchLinkedChapters();
  }, [episode?.mappedChapterIds]);

  // 3. SAVE VIEWING HISTORY
  useEffect(() => {
    const saveHistory = async () => {
      if (!session?.user?.id || !animeId || !episodeId) return;
      try {
        await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/history/anime`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: session.user.id, animeId, episodeId })
        });
      } catch (error) {
        console.error("Error saving anime history:", error);
      }
    };
    saveHistory();
  }, [session?.user?.id, animeId, episodeId]);

  
  // Declare flags to block multiple API calls.
  const hasLoggedView = useRef(false);

  // =====================================================================
  // LOGIC FOR RECORDING VIEWS FOR RANKINGS
  // =====================================================================
  useEffect(() => {
    const logAnimeView = async () => {
      // If no ID is found or the flag is set to true -> Stop immediately
      if (!animeId || !episodeId || hasLoggedView.current) return;
      
      // Set the flag right before calling the API to block the second Strict Mode thread.
      hasLoggedView.current = true; 

      try {
        await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/anime/${animeId}/view`, {
          method: 'POST',
        });
      } catch (error) {
        console.error("Lỗi khi ghi nhận lượt xem:", error);
        // If the API fails, return the flag to false to allow the callback.
        hasLoggedView.current = false; 
      }
    };
    
    logAnimeView();
  }, [animeId, episodeId]);

  // =====================================================================
  // ➕ 4. SYNCHRONIZED VOICE-OVER & AUDIO DUCKING LOGIC (BUNKER RUNNING UPGRADE)
  // =====================================================================
  useEffect(() => {
    const videoElement = videoRef.current;
    const audioEl = audioDubRef.current;

    if (!videoElement) return;

    if (!selectedDubLang) {
      if (audioEl) {
        audioEl.pause();
        audioEl.currentTime = 0;
      }
      videoElement.volume = 1.0; 
      return; 
    }

    const setupTargetTrack = () => {
      const textTracks = videoElement.textTracks;
      let targetTrack: TextTrack | null = null;

      for (let i = 0; i < textTracks.length; i++) {
        if (selectedDubLang.includes(textTracks[i].label) || textTracks[i].label.includes(selectedDubLang)) {
          targetTrack = textTracks[i];
          break;
        }
      }

      if (!targetTrack && textTracks.length > 0) {
        const fallbackTrack = Array.from(textTracks).find(t => t.kind === 'subtitles' || t.kind === 'captions');
        if (fallbackTrack) targetTrack = fallbackTrack;
      }

      if (!targetTrack) return null;

      if (targetTrack.mode === 'disabled') {
        targetTrack.mode = 'hidden';
      }

      return targetTrack;
    };

    let activeTrack = setupTargetTrack();

    const handleCueChange = (e: Event) => {
      const track = e.target as TextTrack;
      const activeCues = track.activeCues;

      if (activeCues && activeCues.length > 0 && audioEl) {
        const currentCue = activeCues[0];
        const allCues = Array.from(track.cues || []);
        const index = allCues.indexOf(currentCue as TextTrackCue);

        if (index !== -1) {
          const encodedLang = encodeURIComponent(selectedDubLang);
          const audioUrl = `${R2_BASE_URL}/dubs/${episodeId}/${encodedLang}/${index}.mp3`;
          
          audioEl.src = audioUrl;
          const cueDuration = currentCue.endTime - currentCue.startTime;

          audioEl.onloadedmetadata = () => {
            const audioDuration = audioEl.duration;
            if (audioDuration > cueDuration) {
              let neededSpeed = audioDuration / cueDuration;
              if (neededSpeed > 1.7) neededSpeed = 1.7; 
              audioEl.playbackRate = neededSpeed;
            } else {
              audioEl.playbackRate = 1.0;
            }
            audioEl.play().catch(err => console.log("Lỗi Autoplay ngầm:", err));
          };

          videoElement.volume = 0.2; 

          audioEl.onended = () => { videoElement.volume = 1.0; };
          audioEl.onerror = () => { videoElement.volume = 1.0; };
        }
      }
    };

    if (activeTrack) {
      activeTrack.addEventListener("cuechange", handleCueChange);
    }

    const handlePlayerCcToggle = () => {
      if (activeTrack) {
        activeTrack.removeEventListener("cuechange", handleCueChange);
      }
      
      activeTrack = setupTargetTrack();
      
      if (activeTrack) {
        activeTrack.addEventListener("cuechange", handleCueChange);
      }
    };

    videoElement.textTracks.addEventListener("change", handlePlayerCcToggle);

    return () => {
      if (activeTrack) {
        activeTrack.removeEventListener("cuechange", handleCueChange);
      }
      videoElement.textTracks.removeEventListener("change", handlePlayerCcToggle);
    };
  }, [selectedDubLang, episodeId, episode?.subtitles]);

  // ➕ 5. ANTI-SEEK GLITCH: Mute voiceover audio if fast forward/pause the movie.
  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement) return;

    const handlePause = () => audioDubRef.current?.pause();
    const handleSeek = () => {
      if (audioDubRef.current) {
        audioDubRef.current.pause();
        audioDubRef.current.currentTime = 0;
      }
      videoElement.volume = 1.0;
    };

    videoElement.addEventListener("pause", handlePause);
    videoElement.addEventListener("seeking", handleSeek);

    return () => {
      videoElement.removeEventListener("pause", handlePause);
      videoElement.removeEventListener("seeking", handleSeek);
    };
  }, []);

  // Function call api to translate subtitle and return a new subtitle file.
  const handleAutoTranslateSub = async (targetLang: string) => {
    if (!episode || !targetLang) return;
    
    setIsTranslatingSub(true);
    setTranslateProgress(0);

    const progressInterval = setInterval(() => {
      setTranslateProgress(prev => {
        if (prev >= 99) return 99;
        if (prev < 60) return prev + Math.floor(Math.random() * 5) + 5; 
        if (prev < 90) return prev + 2; 
        return prev + 1; 
      });
    }, 600);

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/anime/translate-sub`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ episodeId, targetLang })
      });
      
      if (res.ok) {
        const data = await res.json();
        clearInterval(progressInterval);
        setTranslateProgress(100); 

        setTimeout(() => {
          setEpisode(prev => {
            if (!prev) return prev;
            const exists = prev.subtitles?.find(s => s.id === data.subtitle.id);
            if (exists) return prev;
            return { ...prev, subtitles: [...(prev.subtitles || []), data.subtitle] };
          });
          alert(`✨ Translation completed to ${targetLang}! Please enable subtitles in the player (CC).`);
        }, 400);
      } else {
        alert("❌ An error occurred during translation.");
      }
    } catch (error) {
      console.error("Translate error:", error);
    } finally {
      clearInterval(progressInterval);
      setTimeout(() => {
        setIsTranslatingSub(false);
        setTranslateProgress(0);
      }, 2000);
    }
  };

  

  if (loading) return <div className="text-white text-center mt-20">Loading video...</div>;
  if (!episode) return <div className="text-white text-center mt-20">Episode not found!</div>;

  // --- LOGIC: HANDLING TAGS FOR FORUMS (INCREASE AND DELETE) ---
  const handleKeyDownTag = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && postTagInput.trim() !== '') {
      e.preventDefault();
      const newTag = postTagInput.trim().replace(/^#/, ''); 
      if (!postTags.includes(newTag)) setPostTags([...postTags, newTag]);
      setPostTagInput("");
    }
  };

  const removeTag = (tagToRemove: string) => {
    setPostTags(postTags.filter(t => t !== tagToRemove));
  };


  return (
    <div className="min-h-screen bg-black text-white pb-12 relative">
      
      {/* ➕ BACKGROUND AUDIO CARD FOR AI VOICE PLAYBACK */}
      <audio ref={audioDubRef} className="hidden" />

      {/* NAVIGATION BAR WITH MANGA ON/OFF BUTTON */}
      <div className="p-4 bg-gray-900/80 backdrop-blur-md sticky top-0 z-50 flex items-center gap-4">
        <Link href={`/anime/${animeId}`} className="text-gray-400 hover:text-white bg-gray-800 px-4 py-2 rounded-lg transition shrink-0">
          &larr; Return
        </Link>
        <div className="flex-1 truncate">
          <h1 className="text-lg font-bold text-blue-400 truncate">{animeTitle}</h1>
          <p className="text-xs text-gray-300 truncate">{episode.title}</p>
        </div>

        {/* 🌟 BUtton ost to FORUM */}
        <button 
          onClick={() => {
            setIsForumModalOpen(true);
            if (videoRef.current) videoRef.current.pause(); // Pause the video to type.
          }}
          className="px-4 py-2 rounded-lg font-bold text-sm transition shrink-0 bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-500/30 flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
          Discuss Forum
        </button>

        {/* tuuron/off manga*/}
        {linkedChapters.length > 0 && (
          <button 
            onClick={() => setShowSplitScreen(!showSplitScreen)}
            className={`px-4 py-2 rounded-lg font-bold text-sm transition shrink-0 shadow-lg ${
              showSplitScreen ? 'bg-red-600 hover:bg-red-500' : 'bg-purple-600 hover:bg-purple-500 shadow-purple-500/30'
            }`}
          >
            {showSplitScreen ? "✕ Close Manga" : "📖 Read Original Manga"}
          </button>
        )}
      </div>

      {/* SPLIT-SCREEN */}
      <div className={`mx-auto mt-4 px-4 flex flex-col lg:flex-row gap-6 transition-all duration-300 ${showSplitScreen ? 'max-w-[1600px]' : 'max-w-6xl'}`}>
        
        {/* Left column: VIDEO PLAYER */}
        <div className={`flex flex-col transition-all duration-500 ${showSplitScreen ? 'w-full lg:w-[60%]' : 'w-full'}`}>
          <div className="relative w-full aspect-video bg-gray-900 rounded-xl overflow-hidden shadow-2xl border border-gray-800 group">
            <video 
              ref={videoRef}
              controls 
              className="w-full h-full outline-none"
              controlsList="nodownload"
              crossOrigin="anonymous"
            >
              <source src={episode.videoUrl} type="video/mp4" />
              {episode.subtitles && episode.subtitles.map((sub, index) => (
                <track key={sub.id} kind="subtitles" srcLang={sub.label} label={sub.label} src={sub.url} default={index === 0} />
              ))}
            </video>

            {/* OVERLAY fast forward button */}
            <div className="absolute inset-0 flex items-center justify-center gap-32 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
              <button onClick={() => skipTime(-10)} className="pointer-events-auto bg-black/60 hover:bg-blue-600 text-white p-4 rounded-full backdrop-blur-sm transition-transform hover:scale-110 flex flex-col items-center justify-center w-16 h-16 shadow-lg border border-gray-700">
                <span className="text-xl font-black mb-1">↺</span>
                <span className="text-[10px] font-bold">-10s</span>
              </button>
              <button onClick={() => skipTime(10)} className="pointer-events-auto bg-black/60 hover:bg-blue-600 text-white p-4 rounded-full backdrop-blur-sm transition-transform hover:scale-110 flex flex-col items-center justify-center w-16 h-16 shadow-lg border border-gray-700">
                <span className="text-xl font-black mb-1">↻</span>
                <span className="text-[10px] font-bold">+10s</span>
              </button>
            </div>
          </div>
          
          {/* Information box below video */}
          <div className="mt-6 bg-gray-900 p-6 rounded-xl border border-gray-800 flex flex-col md:flex-row md:items-start justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold">{episode.title}</h2>
              <p className="text-gray-400 text-sm mt-2">Date posted: {new Date(episode.createdAt).toLocaleDateString('vi-VN')}</p>
            </div>

            {/* ➕ UI VOICE SELECTION (Only appears when the database indicates voice acting is available) */}
            {(episode.dubbedLanguages && episode.dubbedLanguages.length > 0) ? (
              <div className="bg-purple-900/30 border border-purple-500/50 p-3 rounded-lg flex items-center gap-3 shrink-0">
                <span className="text-sm font-bold text-purple-400 flex items-center gap-1">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd"></path></svg>
                  Auto Dub:
                </span>
                <select 
                  value={selectedDubLang}
                  onChange={(e) => setSelectedDubLang(e.target.value)}
                  className="bg-gray-900 text-white text-sm px-3 py-1.5 rounded outline-none border border-gray-600 focus:border-purple-500 transition-all cursor-pointer shadow-inner"
                >
                  <option value="">Original Audio</option>
                  
                  {/* USE A MAP LOOP TO DYNAMICLY RENDER ANY LANGUAGE IN THE DATABASE */}
                  {episode.dubbedLanguages.map((lang) => (
                    <option key={lang} value={lang}>
                      {lang} (AI Voice)
                    </option>
                  ))}
                  
                </select>
                {selectedDubLang && <span className="relative flex h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-purple-500"></span></span>}
              </div>
            ) : null}
          </div>

         {/* ================================================================= */}
          {/*AI FEATURES AREA: SUBTITLE TRANSLATION & VOICE-OVER CREATION           */}
          {/* ================================================================= */}
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* 1. BOX Trans sub AI */}
            <div className="bg-gray-800 p-3 rounded-lg flex flex-col xl:flex-row items-center justify-between gap-3 border border-gray-700">
              <span className="text-sm font-bold text-blue-400 shrink-0">✨ Auto-translate subtitle:</span>
              <div className="flex items-center gap-3 w-full xl:w-auto">
                <select 
                  className="bg-gray-900 text-white text-sm px-3 py-1.5 rounded outline-none border border-gray-600 disabled:opacity-50 w-full xl:w-auto"
                  disabled={isTranslatingSub}
                  onChange={(e) => {
                    if(e.target.value) handleAutoTranslateSub(e.target.value);
                    e.target.value = ""; 
                  }}
                >
                  <option value="">Select language...</option>
                  {SUPPORTED_LANGUAGES.map((lang) => (
                    <option key={lang.code} value={lang.code}>{lang.label}</option>
                  ))}
                </select>
                
                {/* 🌟UI displays translation % */}
                {isTranslatingSub && (
                  <div className="flex flex-col items-end gap-1 shrink-0 min-w-[80px]">
                    <span className="text-[10px] text-blue-400 font-bold animate-pulse">
                      Translating... {Math.floor(translateProgress)}%
                    </span>
                    <div className="w-full h-1.5 bg-gray-700 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-blue-500 transition-all duration-300 ease-out" 
                        style={{ width: `${translateProgress}%` }}
                      ></div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 2. AI VOICE-OVER GENERATOR BOX (Only appears when subtitles are available) */}
            {episode.subtitles && episode.subtitles.length > 0 && (
              <div className="bg-gray-800 p-3 rounded-lg flex flex-col xl:flex-row items-center justify-between gap-3 border border-gray-700">
                <span className="text-sm font-bold text-pink-400 shrink-0 flex items-center gap-1">
                  🎙️ Generate Dub Voiceover:
                </span>
                <div className="flex items-center gap-3 w-full xl:w-auto">
                  <select 
                    className="bg-gray-900 text-white text-sm px-3 py-1.5 rounded outline-none border border-gray-600 disabled:opacity-50 w-full xl:w-auto"
                    disabled={isGeneratingDub}
                    onChange={(e) => {
                      const selectedLang = e.target.value;
                      if (selectedLang) {
                        const targetSub = episode.subtitles?.find(s => s.label === selectedLang);
                        if (targetSub) {
                          handleGenerateDub(selectedLang, targetSub.url);
                        }
                      }
                      e.target.value = ""; 
                    }}
                  >
                    <option value="">Select sub to dub...</option>
                    {episode.subtitles
                      .filter(sub => !(episode.dubbedLanguages || []).includes(sub.label))
                      .map((sub) => (
                        <option key={sub.id} value={sub.label}>
                          {sub.label}
                        </option>
                      ))
                    }
                  </select>
                  
                  {/* 🌟 UI displays voiceover progress % */}
                  {isGeneratingDub && (
                    <div className="flex flex-col items-end gap-1 shrink-0 min-w-[80px]">
                      <span className="text-[10px] text-pink-400 font-bold animate-pulse flex items-center gap-1">
                        <svg className="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                        {Math.floor(dubProgress)}%
                      </span>
                      <div className="w-full h-1.5 bg-gray-700 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-pink-500 transition-all duration-300 ease-out" 
                          style={{ width: `${dubProgress}%` }}
                        ></div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

          </div>
        </div>
        {/* ======================= End of left column (VIDEO) ======================= */}

        

        {/* RIGHT COLUMN: SYNCHRONIZED MANGA AREA */}
        {showSplitScreen && (
          <div className="w-full lg:w-[40%] flex flex-col h-[70vh] lg:h-[calc(100vh-100px)] bg-gray-900 rounded-xl border border-gray-800 shadow-2xl overflow-hidden sticky top-[80px]">
            <div className="bg-gray-800 p-4 border-b border-gray-700 flex flex-wrap justify-between items-center gap-2">
              <span className="font-bold text-purple-400 uppercase tracking-wide text-sm">📖 Manga</span>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-[#0f0f11]">
              {linkedChapters.map((chapter) => (
                <div key={chapter.id} className="mb-10">
                  <div className="flex items-center justify-between gap-4 mb-6 relative">
                     <div className="h-px bg-gray-700 flex-1"></div>
                     <div className="flex flex-col items-center">
                       <h3 className="text-gray-300 font-bold text-sm tracking-wider uppercase">
                         {chapter.title}
                       </h3>
                       <Link 
                         href={`/manga/${chapter.mangaId}/chapter/${chapter.id}`}
                         target="_blank"
                         className="text-blue-400 hover:text-blue-300 text-[11px] font-semibold mt-2 flex items-center gap-1 transition bg-gray-800/60 px-4 py-1.5 rounded-full border border-gray-700 hover:bg-gray-700 hover:scale-105"
                       >
                         Read in Full Screen ↗
                       </Link>
                     </div>
                     <div className="h-px bg-gray-700 flex-1"></div>
                  </div>

                  {chapter.images.map((imgUrl, index) => (
                    <div key={index} className="w-full mb-4">
                      <img 
                        src={imgUrl} 
                        alt={`Trang ${index + 1}`} 
                        className="w-full h-auto block object-contain rounded-md" 
                      />
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="max-w-6xl mx-auto px-4">
        {/*_episode list */}
        <div className="mt-8 bg-gray-900 rounded-xl p-6 md:p-8 shadow-xl border border-gray-800">
          <h3 className="text-xl font-bold text-white mb-6 border-l-4 border-blue-500 pl-3">Select Episode</h3>
          {allEpisodes.length === 0 ? (
            <div className="text-center py-10 text-gray-500 italic">Loading episode list...</div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {allEpisodes.map((ep, index) => {
                const isActive = ep.id === episodeId; 
                return (
                  <Link 
                    key={ep.id} 
                    href={`/anime/${animeId}/watch/${ep.id}`}
                    className={`text-center py-4 rounded-xl transition-all font-semibold shadow-md group flex flex-col items-center justify-center h-full border ${
                      isActive ? "bg-blue-600 border-blue-400 text-white shadow-[0_0_15px_rgba(37,99,235,0.4)]" : "bg-gray-800 hover:bg-gray-700 border-gray-700 hover:border-gray-500"
                    }`}
                  >
                    <span className={`${isActive ? "text-blue-200" : "text-gray-400 group-hover:text-white"} text-xs block mb-1`}>Tập {index + 1}</span>
                    <span className={`${isActive ? "text-white" : "text-gray-200"} truncate w-full px-2 text-sm`}>{ep.title}</span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* BÌNH LUẬN */}
        <div className="mt-8">
          <CommentSection targetType="episode" targetId={episodeId} />
        </div>
      </div>

      {/* ===================================================================== */}
      {/* 🌟 4. POPUP MODAL POST ON THE FORUM WITH TIMESTAMP AND IMAGE */}
      {/* ===================================================================== */}
      {isForumModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#1a1d24] w-full max-w-2xl rounded-2xl border border-gray-800 shadow-2xl flex flex-col max-h-[90vh]">
            
            <div className="flex justify-between items-center p-5 border-b border-gray-800">
              <h2 className="text-xl font-bold text-gray-100 flex items-center gap-2">
                Posting on the Forum
              </h2>
              <button 
                onClick={() => {
                  setIsForumModalOpen(false);
                  if (videoRef.current) videoRef.current.play(); // Đóng thì chạy tiếp video
                }} 
                className="text-gray-400 hover:text-white transition bg-gray-800 hover:bg-gray-700 w-8 h-8 rounded-full flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            <div className="p-5 overflow-y-auto custom-scrollbar flex-1 space-y-4">
              <input 
                type="text" placeholder="Post title..." value={postTitle} onChange={e => setPostTitle(e.target.value)}
                className="w-full bg-transparent border border-gray-800 rounded-lg px-4 py-3 outline-none font-bold text-lg focus:border-blue-500 transition"
              />
              
              {/* TIMESTAMP INSERT BUTTON BECOMES AN ATTACHMENT CARD */}
              {!attachedTimestamp ? (
                <button 
                  onClick={handleInsertTimestamp}
                  className="w-full bg-blue-900/30 hover:bg-blue-900/50 text-blue-400 border border-blue-800/50 border-dashed py-2 rounded-lg text-sm font-bold transition flex justify-center items-center gap-2"
                >
                  ⏱️ Extract time link from this scene
                </button>
              ) : (
                <div className="bg-blue-900/20 border border-blue-800/50 rounded-lg p-3 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-blue-400">📺 Currently watching:</span>
                    <span className="font-bold text-gray-200 underline decoration-blue-500/50 underline-offset-2">
                      {attachedTimestamp.title}
                    </span>
                  </div>
                  <button onClick={() => setAttachedTimestamp(null)} className="text-gray-400 hover:text-red-400 p-1">✕</button>
                </div>
              )}

              <textarea 
                placeholder="Post content, hypotheses, your thoughts..." 
                value={postContent} onChange={e => setPostContent(e.target.value)}
                className="w-full bg-transparent border border-gray-800 rounded-lg px-4 py-3 outline-none resize-none h-32 text-sm text-gray-200 focus:border-blue-500 transition custom-scrollbar leading-relaxed"
              />

              {/* PREVIEW AREA FOR UPLOADED MEDIA */}
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

              {/* TAGS AND SPOILER AREA */}
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
                  type="text" placeholder="Adding Tag and press Enter (E.g., #JujutsuKaisen, #Review...)" 
                  value={postTagInput} onChange={e => setPostTagInput(e.target.value)} onKeyDown={handleKeyDownTag}
                  className="w-full bg-transparent outline-none text-sm text-gray-300"
                />
              </div>
            </div>

            <div className="p-5 border-t border-gray-800 flex justify-between items-center bg-gray-900/50 rounded-b-2xl">
              
              {/* LEFT TOOLBAR (Select Category, Upload Image, AI Button)*/}
              <div className="flex items-center gap-3">
                <select 
                  value={postCategory} onChange={e => setPostCategory(e.target.value as "GENERAL" | "ANIME" | "MANGA")}
                  className="bg-gray-800 text-sm px-3 py-2 rounded-lg outline-none cursor-pointer border border-gray-700 hover:border-gray-600 transition hidden sm:block"
                >
                  <option value="ANIME">🎬 Anime</option>
                  <option value="MANGA">📖 Manga</option>
                  <option value="GENERAL">📍 Chung</option>
                </select>

                <input type="file" accept="image/*,video/*" hidden ref={postFileInputRef} onChange={handlePostFileChange} />
                <button onClick={() => postFileInputRef.current?.click()} className="text-gray-400 hover:text-green-400 transition p-2 bg-gray-800 rounded-lg border border-gray-700 hover:border-green-600" title="Đính kèm Ảnh/Video">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                </button>

                <button onClick={handleForumAIAnalyze} disabled={isAnalyzingForum} className="bg-purple-600/20 text-purple-400 border border-purple-600 hover:bg-purple-600 hover:text-white px-3 py-1.5 rounded-lg text-sm font-bold transition flex items-center gap-1">
                  {isAnalyzingForum ? <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> : "🪄 AI Check"}
                </button>
              </div>

              {/* RIGHT TOOLBAR (Post Button) */}
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
                  {isPostingToForum ? "Posting..." : "Post"}
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default function WatchEpisodePage() {
  return (
    <Suspense fallback={<div className="text-white text-center mt-20">Loading episode...</div>}>
      <WatchEpisodeContent />
    </Suspense>
  );
}