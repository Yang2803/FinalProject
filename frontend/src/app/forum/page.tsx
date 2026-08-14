"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

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
      {/* 🌟 THANH ĐIỀU HƯỚNG TABS & HIỂN THỊ TAG ĐANG LỌC */}
      <div className="flex items-center justify-between mb-6 border-b border-gray-800 pb-3">
        <div className="flex items-center gap-6">
          <Link href="/forum" className={`font-bold transition ${currentCategory === 'ALL' ? 'text-blue-500 border-b-2 border-blue-500 pb-3 -mb-[14px]' : 'text-gray-400 hover:text-gray-200'}`}>All</Link>
          <Link href="/forum?category=ANIME" className={`font-bold transition ${currentCategory === 'ANIME' ? 'text-blue-500 border-b-2 border-blue-500 pb-3 -mb-[14px]' : 'text-gray-400 hover:text-gray-200'}`}>Anime</Link>
          <Link href="/forum?category=MANGA" className={`font-bold transition ${currentCategory === 'MANGA' ? 'text-green-500 border-b-2 border-green-500 pb-3 -mb-[14px]' : 'text-gray-400 hover:text-gray-200'}`}>Manga</Link>
        </div>
        
        {/* Cục hiển thị Tag đang được lọc */}
        {currentTag && (
          <div className="flex items-center gap-2 bg-blue-900/30 text-blue-400 px-3 py-1.5 rounded-full text-sm font-bold border border-blue-800/50">
            <span>Đang lọc: #{currentTag}</span>
            <Link href={`/forum?category=${currentCategory}`} className="hover:text-red-400 ml-1" title="Bỏ lọc">✕</Link>
          </div>
        )}
      </div>

      {/* KHUNG TẠO BÀI VIẾT (TRIGGER) */}
      <div className="bg-[#1a1d24] rounded-xl border border-gray-800 p-4 mb-6 flex items-center gap-4 shadow-sm hover:border-gray-700 transition">
        <div className="w-10 h-10 rounded-full bg-blue-600 overflow-hidden flex-shrink-0 flex items-center justify-center font-bold">
          {session?.user?.image ? (
            <img src={session.user.image} alt="Avatar" className="w-full h-full object-cover" />
          ) : (
            <span>{session?.user?.name?.charAt(0) || "U"}</span>
          )}
        </div>
        
        <div 
          onClick={() => setIsModalOpen(true)}
          className="flex-1 bg-gray-800/50 hover:bg-gray-800 rounded-full px-5 py-2.5 text-sm text-gray-400 cursor-text transition border border-gray-700 hover:border-gray-600"
        >
          Chia sẻ giả thuyết, fanfic hoặc thảo luận của bạn...
        </div>

        <button onClick={() => setIsModalOpen(true)} className="p-2 text-gray-400 hover:text-blue-400 transition bg-gray-800/50 rounded-full">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
        </button>
      </div>

      {/* ======================================================== */}
      {/* 🌟 HIỂN THỊ DANH SÁCH BÀI VIẾT (FEED) */}
      {/* ======================================================== */}
      <div className="space-y-6">
        {loadingPosts ? (
          <div className="flex justify-center py-10">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : posts.length === 0 ? (
          <p className="text-gray-500 italic text-center py-10">Chưa có bài đăng nào. Hãy là người đầu tiên chia sẻ nhé!</p>
        ) : (
          posts.map((post) => (
            <div key={post.id} className="bg-[#1a1d24] rounded-xl border border-gray-800 p-5 shadow-sm hover:border-gray-700 transition">
              
              {/* Header bài viết: Avatar, Name, Community, Time, Category */}
              <div className="flex flex-wrap items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-gray-700 overflow-hidden flex-shrink-0">
                  {post.author?.image ? (
                    <img src={post.author.image} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center font-bold text-gray-400">
                      {post.author?.name?.charAt(0) || "U"}
                    </div>
                  )}
                </div>
                
                <div className="flex flex-col">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {/* 🌟 NẾU CÓ COMMUNITY THÌ HIỆN TÊN CỘNG ĐỒNG CÓ LINK */}
                    {post.community ? (
                      <>
                        <Link 
                          href={`/forum/communities/${post.community.id}`} 
                          className="font-bold text-blue-400 text-sm hover:underline"
                        >
                          c/{post.community.name}
                        </Link>
                        <span className="text-gray-600 text-xs">•</span>
                        <span className="text-gray-400 text-xs">Đăng bởi {post.author?.name || "Ẩn danh"}</span>
                      </>
                    ) : (
                      /* Nếu bài đăng tự do (không thuộc nhóm nào) */
                      <h4 className="font-bold text-gray-200 text-sm hover:underline cursor-pointer">
                        {post.author?.name || "Người dùng ẩn danh"}
                      </h4>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{new Date(post.createdAt).toLocaleString('vi-VN')}</p>
                </div>
                
                <span className={`ml-auto text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${
                  post.category === 'ANIME' ? 'bg-blue-900/50 text-blue-400' : 
                  post.category === 'MANGA' ? 'bg-green-900/50 text-green-400' : 'bg-gray-800 text-gray-400'
                }`}>
                  {post.category}
                </span>
              </div>

              {/* Nội dung bài viết */}
              <h3 className="text-xl font-bold text-gray-100 mb-2">{post.title}</h3>
              <p className="text-gray-300 text-sm whitespace-pre-wrap mb-4 leading-relaxed">
                  {renderFormattedContent(post.content)}
              </p>

              {/* Hình ảnh/Video đính kèm */}
              {post.mediaUrl && (
                <div className="mb-4 rounded-xl overflow-hidden border border-gray-800 bg-gray-900">
                  {post.mediaUrl.includes('/video/upload/') ? (
                    <video src={post.mediaUrl} controls className="w-full max-h-[500px] object-contain" />
                  ) : (
                    <img src={post.mediaUrl} alt="Post media" className="w-full max-h-[500px] object-contain" />
                  )}
                </div>
              )}

              {/* Tags & Spoiler */}
              <div className="flex flex-wrap items-center gap-2 mt-4">
                {post.isSpoiler && (
                  <span className="bg-red-900/50 text-red-400 text-xs px-2.5 py-1 rounded border border-red-500 font-bold">⚠️ Spoiler</span>
                )}
                {post.tags?.map((tag: string, index: number) => (
                  <Link key={index} href={`/forum?tag=${tag}`}>
                    <span className="text-blue-400 hover:text-blue-300 cursor-pointer text-sm font-medium">
                      #{tag}
                    </span>
                  </Link>
                ))}
              </div>

              {/* THANH TƯƠNG TÁC CHUẨN REDDIT */}
              <div className="flex items-center justify-between mt-5 pt-4 border-t border-gray-800/50 text-gray-400">
                
                <div className="flex items-center gap-4">
                  {/* Cụm Vote */}
                  <div className="flex items-center bg-gray-800/50 rounded-full">
                    <button onClick={() => handleVote(post.id, 'UP')} className="p-2 hover:text-green-500 hover:bg-gray-800 rounded-l-full transition">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
                    </button>
                    <span className="font-bold text-sm px-1 text-gray-300">{post.upvoteCount}</span>
                    <button onClick={() => handleVote(post.id, 'DOWN')} className="p-2 hover:text-red-500 hover:bg-gray-800 rounded-r-full transition">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </button>
                  </div>

                  {/* Nút Bình Luận */}
                  <button onClick={() => toggleComments(post.id)} className="flex items-center gap-2 hover:text-blue-400 hover:bg-gray-800/50 px-3 py-2 rounded-full transition text-sm font-medium">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                    Bình luận
                  </button>
                </div>

                {/* 🌟 Nút Edit/Delete (Chỉ hiện nếu là bài của mình) */}
                {session?.user?.id === post.authorId && (
                  <div className="flex gap-2">
                    
                    {/* Nút Sửa Bài */}
                    <button onClick={() => handleEditClick(post)} className="text-gray-500 hover:text-blue-500 p-2 transition" title="Sửa bài">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                    </button>

                    {/* Nút Xóa Bài */}
                    <button onClick={() => handleDeletePost(post.id)} className="text-gray-500 hover:text-red-500 p-2 transition" title="Xóa bài">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                    
                  </div>
                )}
              </div>

              {/* KHU VỰC BÌNH LUẬN CỰC XỊN */}
              {activeCommentPostId === post.id && (
                <div className="mt-4 pt-4 border-t border-gray-800">
                  
                  {/* Ô nhập Comment gốc */}
                  <div className="flex gap-3 mb-6">
                    <input 
                      type="text" placeholder="Viết bình luận của bạn..." value={newComment} 
                      onChange={e => { setNewComment(e.target.value); setReplyingToCommentId(null); }}
                      className="flex-1 bg-gray-900 border border-gray-800 rounded-full px-4 py-2.5 text-sm outline-none focus:border-blue-500"
                    />
                    <button onClick={() => handlePostComment(post.id, null)} className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-full text-sm font-bold">Gửi</button>
                  </div>
                  
                  {/* Danh sách Comment */}
                  <div className="space-y-4">
                    {/* Thuật toán lọc comment gốc (không có parentId) và vẽ ra */}
                    {comments.filter(c => !c.parentId).map(cmt => {
                      
                      // Hàm con này dùng để đệ quy tìm các comment reply cho comment hiện tại
                      const renderCommentNode = (comment: ForumCommentItem, isReply = false) => {
                        const replies = comments.filter(c => c.parentId === comment.id); // Lấy các reply của nó
                        const isEditing = editingCommentId === comment.id;
                        const isReplying = replyingToCommentId === comment.id;

                        return (
                          <div key={comment.id} className={`flex gap-3 ${isReply ? 'mt-3 relative before:absolute before:-left-6 before:top-4 before:w-4 before:h-px before:bg-gray-700' : ''}`}>
                            <div className="w-8 h-8 rounded-full bg-gray-700 overflow-hidden flex-shrink-0 z-10 border-2 border-[#1a1d24]">
                              <div className="w-full h-full flex justify-center items-center font-bold text-xs text-gray-400">{comment.author?.name?.charAt(0) || "U"}</div>
                            </div>
                            
                            <div className="flex-1">
                              {/* Box nội dung */}
                              <div className="bg-gray-900/40 p-3 rounded-2xl rounded-tl-none border border-gray-800/50">
                                <h5 className="font-bold text-xs text-gray-300">{comment.author?.name}</h5>
                                
                                {isEditing ? (
                                  <div className="mt-2 flex gap-2">
                                    <input autoFocus type="text" value={editCommentContent} onChange={e => setEditCommentContent(e.target.value)} className="flex-1 bg-gray-800 rounded px-2 py-1 text-sm outline-none text-white" />
                                    <button onClick={() => submitEditComment(comment.id)} className="text-green-400 text-xs font-bold px-2">Lưu</button>
                                    <button onClick={() => setEditingCommentId(null)} className="text-gray-400 text-xs px-2">Hủy</button>
                                  </div>
                                ) : (
                                  <p className="text-sm text-gray-400 mt-1">{comment.content}</p>
                                )}
                              </div>

                              {/* Thanh tương tác dưới comment */}
                              <div className="flex items-center gap-4 mt-1.5 ml-2 text-xs font-bold text-gray-500">
                                <div className="flex items-center gap-1">
                                  <button onClick={() => handleVoteComment(comment.id, 'UP')} className="hover:text-green-500">▲</button>
                                  <span className={comment.upvoteCount > 0 ? "text-green-500" : comment.upvoteCount < 0 ? "text-red-500" : ""}>{comment.upvoteCount}</span>
                                  <button onClick={() => handleVoteComment(comment.id, 'DOWN')} className="hover:text-red-500">▼</button>
                                </div>
                                <button onClick={() => { setReplyingToCommentId(comment.id); setNewComment(""); }} className="hover:text-gray-300">Reply</button>
                                
                                {session?.user?.id === comment.authorId && (
                                  <>
                                    <button onClick={() => { setEditingCommentId(comment.id); setEditCommentContent(comment.content); }} className="hover:text-blue-400">Edit</button>
                                    <button onClick={() => handleDeleteComment(comment.id)} className="hover:text-red-400">Delete</button>
                                  </>
                                )}
                                <span className="font-normal text-gray-600 text-[10px] ml-auto">{new Date(comment.createdAt).toLocaleTimeString('vi-VN')}</span>
                              </div>

                              {/* Ô nhập khi bấm Reply */}
                              {isReplying && (
                                <div className="flex gap-2 mt-2 ml-2">
                                  <input autoFocus type="text" placeholder={`Trả lời ${comment.author?.name}...`} value={newComment} onChange={e => setNewComment(e.target.value)} className="flex-1 bg-gray-900 border border-gray-700 rounded-full px-3 py-1.5 text-xs outline-none focus:border-blue-500 text-white" />
                                  <button onClick={() => handlePostComment(post.id, comment.id)} className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-full text-xs font-bold">Gửi</button>
                                </div>
                              )}

                              {/* ĐỆ QUY: Render tiếp các comment con nếu có */}
                              {replies.length > 0 && (
                                <div className="pl-6 border-l-2 border-gray-800/50 relative mt-2 space-y-3">
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
      {/* 🌟 MODAL (POPUP) ĐĂNG BÀI - ĐÃ ẨN ĐI ĐỂ CODE NGẮN GỌN (Giữ nguyên của cậu) */}
      {/* ======================================================== */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[#1a1d24] w-full max-w-2xl rounded-2xl border border-gray-800 shadow-2xl flex flex-col max-h-[90vh]">
            
            <div className="flex justify-between items-center p-5 border-b border-gray-800">
              <h2 className="text-xl font-bold text-gray-100">Tạo bài viết mới</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-white transition bg-gray-800 hover:bg-gray-700 w-8 h-8 rounded-full flex items-center justify-center">
                ✕
              </button>
            </div>

            <div className="p-5 overflow-y-auto custom-scrollbar flex-1 space-y-4">
              <input 
                type="text" placeholder="Tiêu đề bài viết..." value={title} onChange={e => setTitle(e.target.value)}
                className="w-full bg-transparent border border-gray-800 rounded-lg px-4 py-3 outline-none font-bold text-lg focus:border-blue-500 transition"
              />
              <textarea 
                placeholder="Nội dung bài viết..." value={content} onChange={e => setContent(e.target.value)}
                className="w-full bg-transparent border border-gray-800 rounded-lg px-4 py-3 outline-none resize-none h-32 text-sm text-gray-200 focus:border-blue-500 transition custom-scrollbar"
              />

              {mediaPreview && (
                <div className="relative rounded-xl overflow-hidden border border-gray-800 bg-gray-900 aspect-video flex items-center justify-center">
                  {mediaFile?.type.startsWith('video/') ? (
                    <video src={mediaPreview} controls className="max-h-full max-w-full" />
                  ) : (
                    <img src={mediaPreview} alt="Preview" className="max-h-full max-w-full object-contain" />
                  )}
                  <button onClick={() => { setMediaFile(null); setMediaPreview(null); }} className="absolute top-2 right-2 bg-black/60 text-white rounded-full p-1.5 hover:bg-red-500 transition">
                    ✕
                  </button>
                </div>
              )}

              <div className="bg-gray-900/50 p-3 rounded-lg border border-gray-800">
                <div className="flex flex-wrap gap-2 mb-2">
                  {isSpoiler && <span className="bg-red-900/50 text-red-400 text-xs px-2.5 py-1 rounded border border-red-500">⚠️ Spoiler</span>}
                  {tags.map(tag => (
                    <span key={tag} className="bg-blue-900/40 border border-blue-800/50 text-blue-300 text-xs px-2.5 py-1 rounded flex items-center gap-1">
                      #{tag}
                      <button onClick={() => removeTag(tag)} className="hover:text-red-400 ml-1">✕</button>
                    </span>
                  ))}
                </div>
                <input 
                  type="text" placeholder="Nhập tag tự do và nhấn Enter (VD: #Soukoku, #Review...)" 
                  value={tagInput} onChange={e => setTagInput(e.target.value)} onKeyDown={handleKeyDownTag}
                  className="w-full bg-transparent outline-none text-sm text-gray-300"
                />
              </div>
            </div>

            <div className="p-5 border-t border-gray-800 flex justify-between items-center bg-gray-900/50 rounded-b-2xl">
              <div className="flex items-center gap-3">
                <select 
                  value={category} onChange={e => setCategory(e.target.value as "GENERAL" | "ANIME" | "MANGA")}
                  className="bg-gray-800 text-sm px-3 py-2 rounded-lg outline-none cursor-pointer border border-gray-700 hover:border-gray-600 transition"
                >
                  <option value="GENERAL">📍 Chung</option>
                  <option value="ANIME">🎬 Anime</option>
                  <option value="MANGA">📖 Manga</option>
                </select>

                <input type="file" accept="image/*,video/*" hidden ref={fileInputRef} onChange={handleFileChange} />
                
                <button onClick={() => fileInputRef.current?.click()} className="text-gray-400 hover:text-green-400 transition p-2 bg-gray-800 rounded-lg border border-gray-700 hover:border-green-600" title="Đính kèm Ảnh/Video">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                </button>
              </div>

              <div className="flex gap-3">
                <button onClick={handleAIAnalyze} disabled={isAnalyzing} className="bg-purple-600/20 text-purple-400 border border-purple-600 hover:bg-purple-600 hover:text-white px-4 py-2 rounded-lg text-sm font-bold transition flex items-center gap-1">
                  {isAnalyzing ? <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> : "🪄 AI Check"}
                </button>
                <button onClick={handleSubmit} disabled={isPosting} className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-lg text-sm font-bold transition disabled:opacity-50">
                  {isPosting ? "Đang xử lý..." : "Post"}
                </button>
              </div>
            </div>
            
          </div>
        </div>
      )}
    </>
  );
}