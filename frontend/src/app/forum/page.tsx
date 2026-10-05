"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";


const getAvatarColor = (name?: string) => {
  const colors = ['bg-red-500', 'bg-green-500', 'bg-blue-500', 'bg-yellow-500', 'bg-purple-500', 'bg-pink-500', 'bg-teal-500', 'bg-orange-500'];
  if (!name) return colors[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
};

// 🌟 1. ĐỊNH NGHĨA INTERFACE RÕ RÀNG ĐỂ TRÁNH LỖI `any`
interface Author {
  id?: string;
  name?: string;
  image?: string;
}

interface ForumPostItem {
  id: string;
  title: string;
  content: string;
  mediaUrl?: string | null;
  category: "GENERAL" | "ANIME" | "MANGA";
  tags: string[];
  isSpoiler: boolean;
  upvoteCount: number;
  createdAt: string;
  author?: Author;
  authorId: string;
  community?: { id: string; name: string } | null;
}

interface ForumCommentItem {
  id: string;
  content: string;
  createdAt: string;
  author?: Author; // Tận dụng luôn interface Author đã khai báo ở trên nhé!
  authorId: string;        // Bổ sung
  parentId?: string | null; // Bổ sung
  upvoteCount: number;
}

export default function ForumFeed() {
  
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const currentCategory = searchParams.get("category") || "ALL";
  const currentTag = searchParams.get("tag"); 
  const [isModalOpen, setIsModalOpen] = useState(false);

  // 🌟 2. KHAI BÁO TYPE CHUẨN XÁC NÀY
  const [posts, setPosts] = useState<ForumPostItem[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(true);

  // States cho Form đăng bài...
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState<"GENERAL" | "ANIME" | "MANGA">("GENERAL");
  const [isSpoiler, setIsSpoiler] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [isPosting, setIsPosting] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // States cho tính năng Edit/Delete/Comment
  const [editingPost, setEditingPost] = useState<ForumPostItem | null>(null);
  const [activeCommentPostId, setActiveCommentPostId] = useState<string | null>(null);
  const [comments, setComments] = useState<ForumCommentItem[]>([]);
  const [newComment, setNewComment] = useState("");

  const [replyingToCommentId, setReplyingToCommentId] = useState<string | null>(null);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editCommentContent, setEditCommentContent] = useState("");


  // 🌟 ĐƯA HÀM FETCH VÀO TRỰC TIẾP TRONG USEEFFECT
  useEffect(() => {
    let isMounted = true; // Cờ đánh dấu component còn hoạt động
    

    const loadInitialPosts = async () => {
      try {

        if (isMounted) setLoadingPosts(true);
        // 🌟 BỔ SUNG: { cache: "no-store" } để cấm Next.js/Trình duyệt lưu cache cũ
        const fetchUrl = `http://localhost:5000/api/forum/posts?category=${currentCategory}${currentTag ? `&tag=${currentTag}` : ''}`;
        
        const res = await fetch(fetchUrl, {
          cache: "no-store", 
          headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }
        });

        if (res.ok) {
          const data: ForumPostItem[] = await res.json();
          if (isMounted) setPosts(data);
        } else {
          // Bắt lỗi rõ ràng nếu backend trả về HTTP Status lỗi (VD: 500)
          console.error("Server trả về lỗi:", await res.text());
        }
      } catch (error) {
        console.error("Lỗi khi tải danh sách bài viết:", error);
      } finally {
        if (isMounted) setLoadingPosts(false);
      }
    };

    loadInitialPosts();

    return () => {
      isMounted = false; // Cleanup function để tránh lỗi bộ nhớ
    };
  }, [currentCategory, currentTag]); // Theo dõi thay đổi của currentCategory

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setMediaFile(file);
      setMediaPreview(URL.createObjectURL(file));
    }
  };

  const handleKeyDownTag = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && tagInput.trim() !== '') {
      e.preventDefault();
      const newTag = tagInput.trim().replace(/^#/, ''); 
      if (!tags.includes(newTag)) {
        setTags([...tags, newTag]);
      }
      setTagInput("");
    }
  };

  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter(t => t !== tagToRemove));
  };

  const handleAIAnalyze = async () => {
    if (!title || !content) return alert("Nhập nội dung trước khi dùng AI nhé!");
    setIsAnalyzing(true);
    try {
      const res = await fetch("http://localhost:5000/api/forum/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content })
      });
      const data = await res.json();
      
      const mergedTags = Array.from(new Set([...tags, ...data.tags]));
      setTags(mergedTags);
      setIsSpoiler(data.isSpoiler);
    } catch (error) {
      alert("Lỗi AI");
    } finally {
      setIsAnalyzing(false);
    }
  };

  // HÀM RESET FORM (Dùng chung khi đóng popup)
  const resetForm = () => {
    setIsModalOpen(false);
    setEditingPost(null); // Thoát chế độ Edit
    setTitle(""); setContent(""); setTags([]); 
    setMediaFile(null); setMediaPreview(null);
    setIsSpoiler(false); setCategory("GENERAL");
  };

  // HÀM MỞ POPUP VÀ NẠP DỮ LIỆU CŨ KHI BẤM SỬA
  const handleEditClick = (post: ForumPostItem) => {
    setEditingPost(post);
    setTitle(post.title);
    setContent(post.content);
    setCategory(post.category);
    setTags(post.tags || []);
    setIsSpoiler(post.isSpoiler);
    setMediaPreview(post.mediaUrl || null); // Hiển thị lại ảnh cũ
    setIsModalOpen(true);
  };

  const handleSubmit = async () => {
    if (!title || !content) return alert("Vui lòng nhập tiêu đề và nội dung!");
    if (!session?.user?.id) return alert("Vui lòng đăng nhập để đăng bài!");

    setIsPosting(true);

    try {
      // 🌟 1. Nếu đang sửa bài, lấy lại link ảnh cũ. Nếu tạo mới thì để null.
      let finalMediaUrl = editingPost ? editingPost.mediaUrl : null;

      // 🌟 2. Nếu có đính kèm file mới thì upload lên Cloudinary để lấy link mới
      if (mediaFile) {
        const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
        const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;
        
        if (!cloudName || !uploadPreset) {
          alert("Chưa cấu hình Cloudinary!");
          setIsPosting(false);
          return;
        }

        const formData = new FormData();
        formData.append("file", mediaFile);
        formData.append("upload_preset", uploadPreset);

        const resourceType = mediaFile.type.startsWith('video/') ? 'video' : 'image';
        const cloudRes = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`, {
          method: "POST",
          body: formData
        });
        
        const cloudData = await cloudRes.json();
        if (!cloudRes.ok) throw new Error(cloudData.error?.message || "Lỗi upload ảnh");
        finalMediaUrl = cloudData.secure_url;
      }

      // 🌟 3. PHÂN NHÁNH LOGIC: SỬA BÀI HAY TẠO BÀI MỚI?
      if (editingPost) {
        // 👉 TRƯỜNG HỢP: SỬA BÀI (GỌI API PUT)
        const res = await fetch(`http://localhost:5000/api/forum/posts/${editingPost.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            title, content, category, tags, isSpoiler, mediaUrl: finalMediaUrl, authorId: session.user.id 
          })
        });

        if (res.ok) {
          // Cập nhật lại UI lập tức: Tìm bài viết cũ trong danh sách và đắp dữ liệu mới vào
          setPosts(posts.map(p => p.id === editingPost.id 
            ? { ...p, title, content, category, tags, isSpoiler, mediaUrl: finalMediaUrl } 
            : p
          ));
          alert("Đã cập nhật bài viết!");
          resetForm(); // Gọi hàm reset để đóng form
        } else {
          const data = await res.json();
          alert(data.error || "Lỗi khi sửa bài!");
        }

      } else {
        // 👉 TRƯỜNG HỢP: TẠO BÀI MỚI (GỌI API POST)
        const res = await fetch("http://localhost:5000/api/forum/posts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            title, content, category, tags, isSpoiler, mediaUrl: finalMediaUrl, authorId: session.user.id 
          })
        });

        if (res.ok) {
          const data = await res.json(); 
          alert("Đăng bài thành công!");
          
          if (data.post) {
            const newPost = {
              ...data.post,
              author: {
                name: session?.user?.name || "Người dùng",
                image: session?.user?.image || null,
              }
            };
            setPosts(prevPosts => [newPost, ...prevPosts]); 
          }
          resetForm(); // Gọi hàm reset để đóng form
        } else {
          const data = await res.json();
          alert(data.error || "Lỗi khi đăng bài từ Server!");
        }
      }

    } catch (error) {
      console.error(error);
      alert("Đã xảy ra lỗi kết nối.");
    } finally {
      setIsPosting(false);
    }
  };

  // XỬ LÝ XÓA
  const handleDeletePost = async (postId: string) => {
    if (!confirm("Bạn có chắc chắn muốn xóa bài đăng này?")) return;
    try {
      const res = await fetch(`http://localhost:5000/api/forum/posts/${postId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ authorId: session?.user?.id })
      });
      if (res.ok) {
        setPosts(posts.filter(p => p.id !== postId)); // Xóa khỏi giao diện
        alert("Đã xóa bài viết!");
      }
    } catch (error) { alert("Lỗi khi xóa!"); }
  };

  // XỬ LÝ VOTE
  const handleVote = async (postId: string, type: 'UP' | 'DOWN') => {
    if (!session?.user?.id) return alert("Đăng nhập để vote nhé!");
    try {
      const res = await fetch(`http://localhost:5000/api/forum/posts/${postId}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: session.user.id, type })
      });
      if (res.ok) {
        const data = await res.json();
        // Cập nhật điểm ngay trên UI
        setPosts(posts.map(p => p.id === postId ? { ...p, upvoteCount: data.upvoteCount } : p));
      }
    } catch (error) { console.error("Lỗi vote", error); }
  };

  // XỬ LÝ BÌNH LUẬN (MỞ/ĐÓNG & FETCH)
  const toggleComments = async (postId: string) => {
    if (activeCommentPostId === postId) {
      setActiveCommentPostId(null); // Đóng nếu đang mở
    } else {
      setActiveCommentPostId(postId);
      const res = await fetch(`http://localhost:5000/api/forum/posts/${postId}/comments`);
      if (res.ok) setComments(await res.json());
    }
  };

  // GỬI BÌNH LUẬN (HOẶC REPLY)
  const handlePostComment = async (postId: string, parentId: string | null = null) => {
    if (!newComment.trim()) return;
    if (!session?.user?.id) return alert("Đăng nhập để bình luận!");
    try {
      const res = await fetch(`http://localhost:5000/api/forum/posts/${postId}/comments`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: newComment, authorId: session.user.id, parentId })
      });
      if (res.ok) {
        const addedComment = await res.json();
        setComments([...comments, addedComment]);
        setNewComment("");
        setReplyingToCommentId(null);
      }
    } catch (error) { alert("Lỗi gửi bình luận"); }
  };

  // SỬA BÌNH LUẬN
  const submitEditComment = async (commentId: string) => {
    if (!editCommentContent.trim()) return;
    try {
      const res = await fetch(`http://localhost:5000/api/forum/comments/${commentId}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: editCommentContent, authorId: session?.user?.id })
      });
      if (res.ok) {
        const updated = await res.json();
        setComments(comments.map(c => c.id === commentId ? updated : c));
        setEditingCommentId(null);
      }
    } catch (error) { alert("Lỗi sửa comment"); }
  };

  // XÓA BÌNH LUẬN
  const handleDeleteComment = async (commentId: string) => {
    if (!confirm("Xóa bình luận này?")) return;
    try {
      const res = await fetch(`http://localhost:5000/api/forum/comments/${commentId}`, {
        method: "DELETE", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ authorId: session?.user?.id })
      });
      if (res.ok) {
        setComments(comments.filter(c => c.id !== commentId));
      }
    } catch (error) { alert("Lỗi xóa comment"); }
  };

  // VOTE BÌNH LUẬN
  const handleVoteComment = async (commentId: string, type: 'UP' | 'DOWN') => {
    if (!session?.user?.id) return alert("Đăng nhập để vote!");
    try {
      const res = await fetch(`http://localhost:5000/api/forum/comments/${commentId}/vote`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: session.user.id, type })
      });
      if (res.ok) {
        const data = await res.json();
        setComments(comments.map(c => c.id === commentId ? { ...c, upvoteCount: data.upvoteCount } : c));
      }
    } catch (error) { console.error("Lỗi vote comment", error); }
  };

  // Hàm biến đổi format [Text](URL) thành thẻ Link click được
  const renderFormattedContent = (text: string) => {
    // Regex tìm đúng cấu trúc [Tên hiển thị](Link web)
    const linkRegex = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
    const parts = [];
    let lastIndex = 0;
    let match;
    
    while ((match = linkRegex.exec(text)) !== null) {
      // Đẩy phần chữ bình thường phía trước link vào mảng
      if (match.index > lastIndex) {
        parts.push(text.substring(lastIndex, match.index));
      }
      // Đẩy thẻ <a> chứa link vào mảng
      parts.push(
        <a 
          key={match.index} 
          href={match[2]} 
          target="_blank" 
          rel="noopener noreferrer" 
          className="text-blue-400 hover:text-blue-300 font-bold underline decoration-blue-500/50 underline-offset-2 transition"
        >
          {match[1]}
        </a>
      );
      lastIndex = linkRegex.lastIndex;
    }
    
    // Đẩy nốt phần chữ còn lại sau link cuối cùng
    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }
    
    return parts.length > 0 ? parts : text;
  };

  return (
    <>
      {/* ======================================================== */}
      {/* 🌟 THANH ĐIỀU HƯỚNG TABS & HIỂN THỊ TAG ĐANG LỌC */}
      {/* ======================================================== */}
      <div className="flex flex-wrap items-center justify-between mb-8 border-b border-gray-800/80 pb-4 relative">
        {/* Đường line gradient phát sáng chạy dưới đáy */}
        <div className="absolute bottom-[-1px] left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-gray-700 to-transparent"></div>

        <div className="flex items-center gap-8">
          <Link href="/forum" className={`relative font-bold transition-all duration-300 text-lg ${currentCategory === 'ALL' ? 'text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400 drop-shadow-[0_0_8px_rgba(192,132,252,0.5)]' : 'text-gray-400 hover:text-gray-200'}`}>
            All
            {currentCategory === 'ALL' && <div className="absolute -bottom-[17px] left-0 w-full h-[3px] bg-gradient-to-r from-purple-500 to-pink-500 rounded-t-full shadow-[0_-2px_10px_rgba(192,132,252,0.5)]"></div>}
          </Link>
          <Link href="/forum?category=ANIME" className={`relative font-bold transition-all duration-300 text-lg ${currentCategory === 'ANIME' ? 'text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400 drop-shadow-[0_0_8px_rgba(56,189,248,0.5)]' : 'text-gray-400 hover:text-gray-200'}`}>
            🎬 Anime
            {currentCategory === 'ANIME' && <div className="absolute -bottom-[17px] left-0 w-full h-[3px] bg-gradient-to-r from-blue-500 to-cyan-500 rounded-t-full shadow-[0_-2px_10px_rgba(56,189,248,0.5)]"></div>}
          </Link>
          <Link href="/forum?category=MANGA" className={`relative font-bold transition-all duration-300 text-lg ${currentCategory === 'MANGA' ? 'text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.5)]' : 'text-gray-400 hover:text-gray-200'}`}>
            📖 Manga
            {currentCategory === 'MANGA' && <div className="absolute -bottom-[17px] left-0 w-full h-[3px] bg-gradient-to-r from-green-500 to-emerald-500 rounded-t-full shadow-[0_-2px_10px_rgba(52,211,153,0.5)]"></div>}
          </Link>
        </div>
        
        {currentTag && (
          <div className="flex items-center gap-2 bg-gradient-to-r from-blue-900/40 to-purple-900/40 text-blue-300 px-4 py-1.5 rounded-full text-sm font-bold border border-blue-700/50 shadow-[0_0_15px_rgba(59,130,246,0.15)] backdrop-blur-md">
            <span>✨ Đang lọc: #{currentTag}</span>
            <Link href={`/forum?category=${currentCategory}`} className="hover:text-pink-400 ml-2 transition-colors flex items-center justify-center bg-blue-900/50 rounded-full w-5 h-5" title="Bỏ lọc">✕</Link>
          </div>
        )}
      </div>

      {/* ======================================================== */}
      {/* 🌟 KHUNG TẠO BÀI VIẾT (TRIGGER) */}
      {/* ======================================================== */}
      <div className="bg-gradient-to-r from-[#1a1d24] to-gray-900 rounded-2xl border border-gray-700/50 p-4 mb-8 flex items-center gap-4 shadow-[0_4px_20px_rgba(0,0,0,0.2)] hover:border-blue-500/30 hover:shadow-[0_0_20px_rgba(59,130,246,0.1)] transition-all duration-300 group">
        <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-blue-600 to-purple-600 p-[2px] shrink-0 shadow-lg">
          <div className="w-full h-full rounded-full overflow-hidden bg-gray-900 flex items-center justify-center font-bold text-lg border-2 border-[#1a1d24]">
            {session?.user?.image ? (
              <img src={session.user.image} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">{session?.user?.name?.charAt(0) || "U"}</span>
            )}
          </div>
        </div>
        
        <div 
          onClick={() => setIsModalOpen(true)}
          className="flex-1 bg-gray-800/40 hover:bg-gray-800/80 rounded-full px-6 py-3 text-sm text-gray-400 cursor-text transition-all duration-300 border border-gray-700/50 hover:border-gray-500 group-hover:bg-gray-800/60"
        >
          Chia sẻ giả thuyết, fanfic hoặc thảo luận của bạn...
        </div>

        <button onClick={() => setIsModalOpen(true)} className="p-3 text-blue-400 hover:text-white hover:bg-blue-600 transition-all duration-300 bg-blue-900/20 rounded-full border border-blue-500/20 hover:shadow-[0_0_15px_rgba(59,130,246,0.5)]">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
        </button>
      </div>

      {/* ======================================================== */}
      {/* 🌟 HIỂN THỊ DANH SÁCH BÀI VIẾT (FEED) */}
      {/* ======================================================== */}
      <div className="space-y-6">
        {loadingPosts ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-4">
            <div className="w-10 h-10 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin shadow-[0_0_15px_rgba(59,130,246,0.5)]"></div>
            <p className="text-blue-400 font-medium animate-pulse">Đang tải vũ trụ thảo luận...</p>
          </div>
        ) : posts.length === 0 ? (
          <div className="bg-gray-800/20 border border-gray-700/50 rounded-2xl py-20 flex flex-col items-center justify-center text-center backdrop-blur-sm">
            <span className="text-6xl mb-4 opacity-50">🌌</span>
            <h3 className="text-xl font-bold text-gray-300 mb-2">Vùng không gian tĩnh lặng</h3>
            <p className="text-gray-500">Chưa có bài đăng nào. Hãy là người đầu tiên khai phá nhé!</p>
          </div>
        ) : (
          posts.map((post) => (
            // Bọc ngoài bài viết với hiệu ứng nổi 3D và Glow viền khi hover
            <div key={post.id} className="group relative bg-[#13151a]/80 backdrop-blur-sm rounded-3xl p-6 sm:p-7 transition-all duration-500 hover:-translate-y-1.5 hover:shadow-[0_15px_40px_-10px_rgba(59,130,246,0.15)] border border-gray-800/60 hover:border-blue-500/30 overflow-hidden z-0">
              
              {/* 🌟 Vệt sáng chìm (Glow Orb) ở góc trên phải, sẽ sáng lên khi di chuột */}
              <div className="absolute -top-20 -right-20 w-48 h-48 bg-blue-500/5 blur-[60px] rounded-full pointer-events-none group-hover:bg-blue-500/15 transition-all duration-700 z-[-1]"></div>

              {/* Header bài viết */}
              <div className="flex flex-wrap items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-full overflow-hidden flex-shrink-0 ring-2 ring-gray-800/80 group-hover:ring-blue-500/40 transition-all duration-300 shadow-md">
                {post.author?.image ? (
                  <img src={post.author.image} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <div className={`w-full h-full flex items-center justify-center font-bold text-white text-lg ${getAvatarColor(post.author?.name)}`}>
                    {post.author?.name?.charAt(0) || "U"}
                  </div>
                )}
              </div>
                
                <div className="flex flex-col flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    {post.community ? (
                      <>
                        <Link href={`/forum/communities/${post.community.id}`} className="font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400 text-sm hover:drop-shadow-[0_0_5px_rgba(56,189,248,0.8)] transition-all">
                          c/{post.community.name}
                        </Link>
                        <span className="text-gray-600 text-xs">•</span>
                        <span className="text-gray-400 text-xs font-medium">bởi <span className="text-gray-300">{post.author?.name || "Ẩn danh"}</span></span>
                      </>
                    ) : (
                      <h4 className="font-bold text-gray-200 text-sm hover:text-blue-400 cursor-pointer transition-colors">
                        {post.author?.name || "Người dùng ẩn danh"}
                      </h4>
                    )}
                  </div>
                  <p className="text-[11px] text-gray-500 mt-1 flex items-center gap-1.5 font-medium">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    {new Date(post.createdAt).toLocaleString('vi-VN')}
                  </p>
                </div>
                
                <span className={`ml-auto text-[10px] font-black px-3 py-1.5 rounded-full uppercase tracking-wider border shadow-sm ${
                  post.category === 'ANIME' ? 'bg-blue-900/20 text-cyan-400 border-cyan-800/40' : 
                  post.category === 'MANGA' ? 'bg-green-900/20 text-emerald-400 border-emerald-800/40' : 'bg-purple-900/20 text-pink-400 border-pink-800/40'
                }`}>
                  {post.category === 'GENERAL' ? 'GENERAL' : post.category}
                </span>
              </div>

              {/* 🌟 Nội dung bài viết: Đổi hiệu ứng Hover cho Tiêu đề */}
              <h3 className="text-xl md:text-2xl font-extrabold text-gray-100 mb-3 leading-tight group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-blue-400 group-hover:to-purple-400 transition-all duration-300">
                {post.title}
              </h3>
              <p className="text-gray-400 text-sm md:text-base whitespace-pre-wrap mb-6 leading-relaxed">
                  {renderFormattedContent(post.content)}
              </p>

              {/* Hình ảnh/Video đính kèm */}
              {post.mediaUrl && (
                <div className="mb-6 rounded-2xl overflow-hidden border border-gray-700/40 bg-black/50 relative group/media shadow-lg">
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover/media:opacity-100 transition-opacity pointer-events-none z-10"></div>
                  {post.mediaUrl.includes('/video/upload/') ? (
                    <video src={post.mediaUrl} controls className="w-full max-h-[500px] object-contain relative z-20" />
                  ) : (
                    <img src={post.mediaUrl} alt="Post media" className="w-full max-h-[500px] object-cover md:object-contain transform group-hover/media:scale-[1.03] transition-transform duration-700 relative z-20" />
                  )}
                </div>
              )}

              {/* Tags & Spoiler */}
              <div className="flex flex-wrap items-center gap-2.5 mt-2">
                {post.isSpoiler && (
                  <span className="bg-red-900/30 text-red-400 text-xs px-3 py-1.5 rounded-lg border border-red-500/40 font-bold shadow-[0_0_10px_rgba(239,68,68,0.15)] flex items-center gap-1.5">
                    <span className="animate-pulse text-sm">⚠️</span> CẢNH BÁO SPOILER
                  </span>
                )}
                {post.tags?.map((tag: string, index: number) => (
                  <Link key={index} href={`/forum?tag=${tag}`}>
                    <span className="bg-gray-800/40 border border-gray-700/60 hover:border-blue-500/50 hover:bg-blue-900/20 text-gray-400 hover:text-blue-300 cursor-pointer text-xs font-bold px-3 py-1.5 rounded-lg transition-all duration-300">
                      #{tag}
                    </span>
                  </Link>
                ))}
              </div>

              {/* THANH TƯƠNG TÁC */}
              <div className="flex items-center justify-between mt-7 pt-5 border-t border-gray-800/50 text-gray-400">
                <div className="flex items-center gap-3 md:gap-5">
                  {/* Cụm Vote */}
                  <div className="flex items-center bg-gray-800/40 rounded-full border border-gray-700/50 overflow-hidden shadow-sm hover:border-gray-600 transition-colors">
                    <button onClick={() => handleVote(post.id, 'UP')} className="p-2.5 hover:text-emerald-400 hover:bg-gray-700/80 transition-colors active:scale-90">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" /></svg>
                    </button>
                    <span className={`font-black text-sm px-2 w-8 text-center ${post.upvoteCount > 0 ? 'text-emerald-400' : post.upvoteCount < 0 ? 'text-red-400' : 'text-gray-300'}`}>
                      {post.upvoteCount}
                    </span>
                    <button onClick={() => handleVote(post.id, 'DOWN')} className="p-2.5 hover:text-red-400 hover:bg-gray-700/80 transition-colors active:scale-90">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                    </button>
                  </div>

                  {/* Nút Bình Luận */}
                  <button onClick={() => toggleComments(post.id)} className="flex items-center gap-2 text-gray-400 hover:text-blue-400 hover:bg-blue-900/20 border border-transparent hover:border-blue-800/50 px-4 py-2.5 rounded-full transition-all text-sm font-bold shadow-sm active:scale-95">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                    Thảo luận
                  </button>
                </div>

                {/* Nút Edit/Delete */}
                {session?.user?.id === post.authorId && (
                  <div className="flex gap-1.5">
                    <button onClick={() => handleEditClick(post)} className="text-gray-500 hover:text-cyan-400 bg-gray-800/30 hover:bg-gray-800 p-2.5 rounded-full transition-all active:scale-90" title="Sửa bài">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                    </button>
                    <button onClick={() => handleDeletePost(post.id)} className="text-gray-500 hover:text-red-400 bg-gray-800/30 hover:bg-gray-800 p-2.5 rounded-full transition-all active:scale-90" title="Xóa bài">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  </div>
                )}
              </div>

              {/* KHU VỰC BÌNH LUẬN (Được làm chìm nhẹ vào trong) */}
              {activeCommentPostId === post.id && (
                <div className="mt-6 pt-6 border-t border-gray-800/60 relative">
                  
                  {/* Ô nhập Comment gốc */}
                  <div className="flex gap-3 mb-8 relative">
                    <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-blue-500 to-purple-500 rounded-full"></div>
                    <input 
                      type="text" placeholder="Để lại suy nghĩ của bạn..." value={newComment} 
                      onChange={e => { setNewComment(e.target.value); setReplyingToCommentId(null); }}
                      className="flex-1 bg-gray-900/80 border border-gray-700/50 rounded-full pl-6 pr-4 py-3 text-sm outline-none focus:border-blue-500 focus:bg-gray-900 transition-all shadow-inner text-gray-200"
                    />
                    <button onClick={() => handlePostComment(post.id, null)} className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white px-6 py-3 rounded-full text-sm font-extrabold shadow-[0_0_15px_rgba(59,130,246,0.3)] hover:shadow-[0_0_20px_rgba(59,130,246,0.5)] transition-all">Gửi</button>
                  </div>
                  
                  {/* Danh sách Comment */}
                  <div className="space-y-5">
                    {comments.filter(c => !c.parentId).map(cmt => {
                      const renderCommentNode = (comment: ForumCommentItem, isReply = false) => {
                        const replies = comments.filter(c => c.parentId === comment.id);
                        const isEditing = editingCommentId === comment.id;
                        const isReplying = replyingToCommentId === comment.id;

                        return (
                          <div key={comment.id} className={`flex gap-3 ${isReply ? 'mt-4 relative before:absolute before:-left-6 before:top-5 before:w-5 before:h-[2px] before:bg-gray-700/60' : ''}`}>
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-700 to-gray-800 p-[1px] flex-shrink-0 z-10 shadow-sm overflow-hidden">
                              {comment.author?.image ? (
                                <img src={comment.author.image} alt="Avatar" className="w-full h-full rounded-full object-cover" />
                              ) : (
                                <div className={`w-full h-full rounded-full flex justify-center items-center font-bold text-sm text-white ${getAvatarColor(comment.author?.name)}`}>
                                  {comment.author?.name?.charAt(0) || "U"}
                                </div>
                              )}
                            </div>
                            
                            <div className="flex-1 min-w-0">
                              <div className="bg-gray-800/40 hover:bg-gray-800/60 p-4 rounded-2xl rounded-tl-sm border border-gray-700/30 transition-colors">
                                <h5 className="font-extrabold text-[13px] text-gray-200">{comment.author?.name}</h5>
                                
                                {isEditing ? (
                                  <div className="mt-3 flex gap-2">
                                    <input autoFocus type="text" value={editCommentContent} onChange={e => setEditCommentContent(e.target.value)} className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500 text-gray-100" />
                                    <button onClick={() => submitEditComment(comment.id)} className="bg-green-600 hover:bg-green-500 text-white text-xs font-bold px-4 rounded-lg transition-colors">Lưu</button>
                                    <button onClick={() => setEditingCommentId(null)} className="text-gray-400 hover:text-white text-xs px-3 transition-colors">Hủy</button>
                                  </div>
                                ) : (
                                  <p className="text-[14px] text-gray-300 mt-2 leading-relaxed">{comment.content}</p>
                                )}
                              </div>

                              <div className="flex items-center gap-4 mt-2 ml-1 text-xs font-bold text-gray-500">
                                <div className="flex items-center gap-1.5 bg-gray-900/50 rounded-full px-2 py-0.5 border border-gray-800">
                                  <button onClick={() => handleVoteComment(comment.id, 'UP')} className="hover:text-emerald-400 p-1">▲</button>
                                  <span className={comment.upvoteCount > 0 ? "text-emerald-500" : comment.upvoteCount < 0 ? "text-red-500" : ""}>{comment.upvoteCount}</span>
                                  <button onClick={() => handleVoteComment(comment.id, 'DOWN')} className="hover:text-red-400 p-1">▼</button>
                                </div>
                                <button onClick={() => { setReplyingToCommentId(comment.id); setNewComment(""); }} className="hover:text-blue-400 flex items-center gap-1"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg> Reply</button>
                                
                                {session?.user?.id === comment.authorId && (
                                  <>
                                    <button onClick={() => { setEditingCommentId(comment.id); setEditCommentContent(comment.content); }} className="hover:text-cyan-400">Edit</button>
                                    <button onClick={() => handleDeleteComment(comment.id)} className="hover:text-red-400">Delete</button>
                                  </>
                                )}
                                <span className="font-medium text-gray-600 text-[11px] ml-auto">
                                  {new Date(comment.createdAt).toLocaleTimeString('vi-VN')}
                                </span>
                              </div>

                              {isReplying && (
                                <div className="flex gap-2 mt-3 ml-2 relative">
                                  <div className="absolute -left-3 top-1/2 w-2 h-[2px] bg-gray-700"></div>
                                  <input autoFocus type="text" placeholder={`Trả lời ${comment.author?.name}...`} value={newComment} onChange={e => setNewComment(e.target.value)} className="flex-1 bg-gray-900 border border-gray-700 rounded-full px-4 py-2 text-sm outline-none focus:border-blue-500 text-white shadow-inner" />
                                  <button onClick={() => handlePostComment(post.id, comment.id)} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-full text-xs font-bold shadow-md">Gửi</button>
                                </div>
                              )}

                              {replies.length > 0 && (
                                <div className="pl-7 border-l-2 border-gray-800/60 relative mt-3 space-y-4">
                                  {replies.map(reply => renderCommentNode(reply, true))}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      };

                      return renderCommentNode(cmt);
                    })}
                  </div>
                </div>
              )}

            </div>
          ))
        )}
      </div>

      {/* ======================================================== */}
      {/* 🌟 MODAL (POPUP) ĐĂNG BÀI */}
      {/* ======================================================== */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="bg-[#13151a] w-full max-w-2xl rounded-3xl border border-gray-700/50 shadow-[0_0_40px_rgba(0,0,0,0.5)] flex flex-col max-h-[90vh] relative overflow-hidden">
            
            {/* Glow effect on top */}
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500"></div>

            <div className="flex justify-between items-center p-6 border-b border-gray-800/80">
              <h2 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-gray-100 to-gray-400">Create new discussion</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-red-400 hover:rotate-90 transition-all duration-300 bg-gray-800/50 hover:bg-red-900/20 w-10 h-10 rounded-full flex items-center justify-center border border-transparent hover:border-red-500/30">
                ✕
              </button>
            </div>

            <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-5">
              <input 
                type="text" placeholder="Title..." value={title} onChange={e => setTitle(e.target.value)}
                className="w-full bg-gray-900/30 border border-gray-800 rounded-xl px-5 py-4 outline-none font-extrabold text-xl focus:border-blue-500 focus:bg-gray-900/80 transition-all shadow-inner placeholder-gray-600 text-gray-100"
              />
              <textarea 
                placeholder="Content..." value={content} onChange={e => setContent(e.target.value)}
                className="w-full bg-gray-900/30 border border-gray-800 rounded-xl px-5 py-4 outline-none resize-none h-40 text-base text-gray-300 focus:border-blue-500 focus:bg-gray-900/80 transition-all shadow-inner custom-scrollbar placeholder-gray-600 leading-relaxed"
              />

              {mediaPreview && (
                <div className="relative rounded-2xl overflow-hidden border border-gray-700/50 bg-black aspect-video flex items-center justify-center shadow-lg group">
                  {mediaFile?.type.startsWith('video/') ? (
                    <video src={mediaPreview} controls className="max-h-full max-w-full" />
                  ) : (
                    <img src={mediaPreview} alt="Preview" className="max-h-full max-w-full object-contain" />
                  )}
                  <button onClick={() => { setMediaFile(null); setMediaPreview(null); }} className="absolute top-3 right-3 bg-red-600/90 hover:bg-red-500 text-white rounded-full w-8 h-8 flex items-center justify-center shadow-lg transition-transform hover:scale-110 opacity-0 group-hover:opacity-100 backdrop-blur-sm">
                    ✕
                  </button>
                </div>
              )}

              <div className="bg-gradient-to-br from-gray-900 to-gray-800/50 p-4 rounded-xl border border-gray-800 shadow-inner">
                <div className="flex flex-wrap gap-2 mb-3">
                  {isSpoiler && <span className="bg-red-900/40 text-red-400 text-xs px-3 py-1.5 rounded-md border border-red-500/50 font-bold shadow-[0_0_10px_rgba(239,68,68,0.2)]">⚠️ Có chứa Spoiler</span>}
                  {tags.map(tag => (
                    <span key={tag} className="bg-blue-900/30 border border-blue-700/50 text-blue-300 text-xs px-3 py-1.5 rounded-md flex items-center gap-1.5 font-medium shadow-sm">
                      #{tag}
                      <button onClick={() => removeTag(tag)} className="hover:text-red-400 hover:bg-blue-900/50 rounded-full w-4 h-4 flex items-center justify-center transition-colors">✕</button>
                    </span>
                  ))}
                </div>
                <input 
                  type="text" placeholder="Thêm thẻ (Tag) và nhấn Enter (VD: #Review, #Giathuyet...)" 
                  value={tagInput} onChange={e => setTagInput(e.target.value)} onKeyDown={handleKeyDownTag}
                  className="w-full bg-transparent outline-none text-sm text-gray-300 placeholder-gray-600"
                />
              </div>
            </div>

            <div className="p-6 border-t border-gray-800/80 flex flex-wrap justify-between items-center bg-[#181a20] rounded-b-3xl gap-4">
              <div className="flex items-center gap-4">
                <div className="relative group">
                  <select 
                    value={category} onChange={e => setCategory(e.target.value as "GENERAL" | "ANIME" | "MANGA")}
                    className="bg-gray-800 appearance-none text-sm font-bold px-4 py-2.5 pr-10 rounded-xl outline-none cursor-pointer border border-gray-700 focus:border-blue-500 hover:border-gray-500 transition-all text-gray-300"
                  >
                    <option value="GENERAL">📍 Thảo luận chung</option>
                    <option value="ANIME">🎬 Phân loại Anime</option>
                    <option value="MANGA">📖 Phân loại Manga</option>
                  </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500 group-hover:text-gray-300 transition-colors">▼</div>
                </div>

                <input type="file" accept="image/*,video/*" hidden ref={fileInputRef} onChange={handleFileChange} />
                
                <button onClick={() => fileInputRef.current?.click()} className="text-gray-400 hover:text-green-400 hover:bg-green-900/20 transition-all p-2.5 bg-gray-800 rounded-xl border border-gray-700 hover:border-green-500/50 shadow-sm" title="Đính kèm Ảnh/Video">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                </button>
              </div>

              <div className="flex gap-3 w-full sm:w-auto">
                <button onClick={handleAIAnalyze} disabled={isAnalyzing} className="flex-1 sm:flex-none bg-gradient-to-r from-purple-600/20 to-pink-600/20 text-pink-300 border border-purple-500/50 hover:from-purple-600 hover:to-pink-600 hover:text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-sm hover:shadow-[0_0_15px_rgba(168,85,247,0.4)] flex items-center justify-center gap-2 disabled:opacity-50">
                  {isAnalyzing ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : "🪄 AI Hỗ Trợ"}
                </button>
                <button onClick={handleSubmit} disabled={isPosting} className="flex-1 sm:flex-none bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white px-8 py-2.5 rounded-xl text-sm font-black transition-all shadow-[0_0_10px_rgba(59,130,246,0.3)] hover:shadow-[0_0_20px_rgba(59,130,246,0.5)] disabled:opacity-50">
                  {isPosting ? "Đang đẩy lên..." : "Đăng Bài"}
                </button>
              </div>
            </div>
            
          </div>
        </div>
      )}
    </>
  )};