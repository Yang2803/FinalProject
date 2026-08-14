"use client";

import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

// ==========================================
// 🌟 1. INTERFACES
// ==========================================
interface Author { id?: string; name?: string; image?: string; }
interface ForumPostItem {
  id: string; title: string; content: string; mediaUrl?: string | null;
  category: "GENERAL" | "ANIME" | "MANGA"; tags: string[]; isSpoiler: boolean;
  upvoteCount: number; createdAt: string; author?: Author; authorId: string;
}
interface ForumCommentItem {
  id: string; content: string; createdAt: string; author?: Author; authorId: string;
  parentId?: string | null; upvoteCount: number;
}
interface CommunityDetail {
  id: string; name: string; description: string; coverImage: string | null; creatorId: string;
  members: { id: string; name: string; image: string }[]; posts: ForumPostItem[];
  _count: { members: number; };
}

export default function CommunityDetailPage() {
  const { data: session } = useSession();
  const params = useParams();
  const router = useRouter();
  const communityId = params.id as string;

  const [community, setCommunity] = useState<CommunityDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [isProcessingJoin, setIsProcessingJoin] = useState(false);

  // States Modal Đăng bài 
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<ForumPostItem | null>(null);
  const [title, setTitle] = useState(""); const [content, setContent] = useState("");
  const [category, setCategory] = useState<"GENERAL" | "ANIME" | "MANGA">("GENERAL");
  const [isSpoiler, setIsSpoiler] = useState(false); const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [tagInput, setTagInput] = useState(""); const [tags, setTags] = useState<string[]>([]);
  const [mediaFile, setMediaFile] = useState<File | null>(null); const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [isPosting, setIsPosting] = useState(false); const fileInputRef = useRef<HTMLInputElement>(null);

  // States Comment 
  const [activeCommentPostId, setActiveCommentPostId] = useState<string | null>(null);
  const [comments, setComments] = useState<ForumCommentItem[]>([]); const [newComment, setNewComment] = useState("");
  const [replyingToCommentId, setReplyingToCommentId] = useState<string | null>(null);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null); const [editCommentContent, setEditCommentContent] = useState("");

  // 🌟 KHU VỰC DÀNH CHO ADMIN
  const [isEditCommunityModalOpen, setIsEditCommunityModalOpen] = useState(false);
  const [isMembersModalOpen, setIsMembersModalOpen] = useState(false);
  const [editComName, setEditComName] = useState("");
  const [editComDesc, setEditComDesc] = useState("");
  const [editComCover, setEditComCover] = useState<File | null>(null);
  const [editComCoverPreview, setEditComCoverPreview] = useState<string | null>(null);
  const [isUpdatingCommunity, setIsUpdatingCommunity] = useState(false);
  const comCoverInputRef = useRef<HTMLInputElement>(null);

  // ==========================================
  // ⚙️ 2. FETCH DATA & JOIN LOGIC
  // ==========================================
  useEffect(() => {
    let isMounted = true;
    const fetchCommunityDetail = async () => {
      try {
        const res = await fetch(`http://localhost:5000/api/communities/${communityId}`);
        if (res.ok) {
          const data = await res.json();
          if (isMounted) setCommunity(data);
        } else { router.push('/forum/communities'); }
      } catch (error) { console.error("Lỗi:", error); } 
      finally { if (isMounted) setLoading(false); }
    };
    if (communityId) fetchCommunityDetail();
    return () => { isMounted = false; };
  }, [communityId, router]);

  // BIẾN KIỂM TRA QUYỀN
  const isMember = community?.members.some(m => m.id === session?.user?.id) || false;
  const isAdmin = session?.user?.id === community?.creatorId;

  const handleToggleJoin = async () => {
    if (!session?.user?.id) return alert("Đăng nhập để tham gia!");
    setIsProcessingJoin(true);
    try {
      const res = await fetch(`http://localhost:5000/api/communities/${communityId}/join`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: session.user.id })
      });
      if (res.ok) {
        const data = await res.json();
        setCommunity(prev => {
          if (!prev) return prev;
          let newMembers = [...prev.members];
          if (data.joined) { newMembers.push({ id: session.user.id, name: session.user.name || "", image: session.user.image || "" }); } 
          else { newMembers = newMembers.filter(m => m.id !== session.user.id); }
          return { ...prev, members: newMembers, _count: { members: data.joined ? prev._count.members + 1 : prev._count.members - 1 } };
        });
      }
    } catch (error) { alert("Lỗi!"); } finally { setIsProcessingJoin(false); }
  };

  // ==========================================
  // 👑 3. LOGIC ADMIN (SỬA CỘNG ĐỒNG)
  // ==========================================
  const openEditCommunity = () => {
    if (!community) return;
    setEditComName(community.name);
    setEditComDesc(community.description);
    setEditComCoverPreview(community.coverImage);
    setIsEditCommunityModalOpen(true);
  };

  const handleUpdateCommunity = async () => {
    if (!editComName.trim() || !editComDesc.trim()) return alert("Nhập đủ Tên và Mô tả!");
    setIsUpdatingCommunity(true);
    try {
      let finalCoverUrl = community?.coverImage;
      if (editComCover) {
        const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
        const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;
        const formData = new FormData(); formData.append("file", editComCover); formData.append("upload_preset", uploadPreset!);
        const cloudRes = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, { method: "POST", body: formData });
        const cloudData = await cloudRes.json();
        if (!cloudRes.ok) throw new Error("Lỗi upload ảnh");
        finalCoverUrl = cloudData.secure_url;
      }

      const res = await fetch(`http://localhost:5000/api/communities/${communityId}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editComName, description: editComDesc, coverImage: finalCoverUrl, userId: session?.user?.id })
      });

      if (res.ok) {
        const updated = await res.json();
        setCommunity(updated);
        setIsEditCommunityModalOpen(false);
        alert("Đã cập nhật thông tin Cộng đồng!");
      } else {
        const data = await res.json(); alert(data.error || "Lỗi cập nhật!");
      }
    } catch (error) { alert("Đã xảy ra lỗi."); } finally { setIsUpdatingCommunity(false); }
  };

  // ... (Giữ nguyên các Logic Bài Viết & Bình Luận như cũ - handleFileChange, handleSubmitPost, etc.) ...
  const resetForm = () => { setIsModalOpen(false); setEditingPost(null); setTitle(""); setContent(""); setTags([]); setMediaFile(null); setMediaPreview(null); setIsSpoiler(false); setCategory("GENERAL"); };
  const handleEditClick = (post: ForumPostItem) => { setEditingPost(post); setTitle(post.title); setContent(post.content); setCategory(post.category); setTags(post.tags || []); setIsSpoiler(post.isSpoiler); setMediaPreview(post.mediaUrl || null); setIsModalOpen(true); };
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => { if (e.target.files && e.target.files[0]) { const file = e.target.files[0]; setMediaFile(file); setMediaPreview(URL.createObjectURL(file)); } };
  const handleKeyDownTag = (e: React.KeyboardEvent<HTMLInputElement>) => { if (e.key === 'Enter' && tagInput.trim() !== '') { e.preventDefault(); const newTag = tagInput.trim().replace(/^#/, ''); if (!tags.includes(newTag)) setTags([...tags, newTag]); setTagInput(""); } };
  const removeTag = (tagToRemove: string) => setTags(tags.filter(t => t !== tagToRemove));
  const handleAIAnalyze = async () => { if (!title || !content) return alert("Nhập nội dung!"); setIsAnalyzing(true); try { const res = await fetch("http://localhost:5000/api/forum/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title, content }) }); const data = await res.json(); setTags(Array.from(new Set([...tags, ...data.tags]))); setIsSpoiler(data.isSpoiler); } catch (error) { alert("Lỗi AI"); } finally { setIsAnalyzing(false); } };
  
  const handleSubmitPost = async () => {
    if (!title || !content) return alert("Vui lòng nhập đủ nội dung!");
    if (!session?.user?.id) return alert("Đăng nhập để post!");
    if (!isMember && !isAdmin) return alert("Phải tham gia nhóm mới được đăng bài!");
    setIsPosting(true);
    try {
      let finalMediaUrl = editingPost ? editingPost.mediaUrl : null;
      if (mediaFile) {
        const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME; const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;
        if (!cloudName || !uploadPreset) { alert("Chưa cấu hình Cloudinary!"); setIsPosting(false); return; }
        const formData = new FormData(); formData.append("file", mediaFile); formData.append("upload_preset", uploadPreset);
        const cloudRes = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/${mediaFile.type.startsWith('video/') ? 'video' : 'image'}/upload`, { method: "POST", body: formData });
        const cloudData = await cloudRes.json();
        finalMediaUrl = cloudData.secure_url;
      }
      if (editingPost) {
        const res = await fetch(`http://localhost:5000/api/forum/posts/${editingPost.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title, content, category, tags, isSpoiler, mediaUrl: finalMediaUrl, authorId: session.user.id }) });
        if (res.ok) { setCommunity(prev => prev ? { ...prev, posts: prev.posts.map(p => p.id === editingPost.id ? { ...p, title, content, category, tags, isSpoiler, mediaUrl: finalMediaUrl } : p) } : prev); alert("Đã cập nhật!"); resetForm(); }
      } else {
        const res = await fetch("http://localhost:5000/api/forum/posts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title, content, category, tags, isSpoiler, mediaUrl: finalMediaUrl, authorId: session.user.id, communityId }) });
        if (res.ok) { const data = await res.json(); if (data.post) { const newPost = { ...data.post, author: { name: session.user.name, image: session.user.image } }; setCommunity(prev => prev ? { ...prev, posts: [newPost, ...prev.posts] } : prev); } resetForm(); }
      }
    } catch (error) { alert("Lỗi kết nối."); } finally { setIsPosting(false); }
  };
  const handleDeletePost = async (postId: string) => { if (!confirm("Xóa bài đăng này?")) return; try { const res = await fetch(`http://localhost:5000/api/forum/posts/${postId}`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ authorId: session?.user?.id }) }); if (res.ok) { setCommunity(prev => prev ? { ...prev, posts: prev.posts.filter(p => p.id !== postId) } : prev); } } catch (error) { alert("Lỗi xóa!"); } };
  const handleVote = async (postId: string, type: 'UP' | 'DOWN') => { if (!session?.user?.id) return alert("Đăng nhập để vote!"); try { const res = await fetch(`http://localhost:5000/api/forum/posts/${postId}/vote`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: session.user.id, type }) }); if (res.ok) { const data = await res.json(); setCommunity(prev => prev ? { ...prev, posts: prev.posts.map(p => p.id === postId ? { ...p, upvoteCount: data.upvoteCount } : p) } : prev); } } catch (error) { console.error("Lỗi vote", error); } };
  
  const toggleComments = async (postId: string) => { if (activeCommentPostId === postId) { setActiveCommentPostId(null); } else { setActiveCommentPostId(postId); const res = await fetch(`http://localhost:5000/api/forum/posts/${postId}/comments`); if (res.ok) setComments(await res.json()); } };
  const handlePostComment = async (postId: string, parentId: string | null = null) => { if (!newComment.trim()) return; if (!session?.user?.id) return alert("Đăng nhập để bình luận!"); try { const res = await fetch(`http://localhost:5000/api/forum/posts/${postId}/comments`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: newComment, authorId: session.user.id, parentId }) }); if (res.ok) { const addedComment = await res.json(); setComments([...comments, addedComment]); setNewComment(""); setReplyingToCommentId(null); } } catch (error) { alert("Lỗi gửi bình luận"); } };
  const submitEditComment = async (commentId: string) => { if (!editCommentContent.trim()) return; try { const res = await fetch(`http://localhost:5000/api/forum/comments/${commentId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: editCommentContent, authorId: session?.user?.id }) }); if (res.ok) { const updated = await res.json(); setComments(comments.map(c => c.id === commentId ? updated : c)); setEditingCommentId(null); } } catch (error) { alert("Lỗi sửa comment"); } };
  const handleDeleteComment = async (commentId: string) => { if (!confirm("Xóa bình luận này?")) return; try { const res = await fetch(`http://localhost:5000/api/forum/comments/${commentId}`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ authorId: session?.user?.id }) }); if (res.ok) setComments(comments.filter(c => c.id !== commentId)); } catch (error) { alert("Lỗi xóa comment"); } };
  const handleVoteComment = async (commentId: string, type: 'UP' | 'DOWN') => { if (!session?.user?.id) return alert("Đăng nhập để vote!"); try { const res = await fetch(`http://localhost:5000/api/forum/comments/${commentId}/vote`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: session.user.id, type }) }); if (res.ok) { const data = await res.json(); setComments(comments.map(c => c.id === commentId ? { ...c, upvoteCount: data.upvoteCount } : c)); } } catch (error) { console.error("Lỗi vote comment", error); } };

  // ==========================================
  // 🎨 5. RENDERING
  // ==========================================
  if (loading) return <div className="flex justify-center items-center min-h-[50vh]"><div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div></div>;
  if (!community) return null;

  

  return (
    <div className="max-w-4xl mx-auto px-4 pb-12 relative">
      <Link href="/forum/communities" className="inline-flex items-center gap-2 text-gray-400 hover:text-blue-400 transition mb-4 font-bold text-sm">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg> Quay lại
      </Link>

      {/* HEADER CỘNG ĐỒNG */}
      <div className="bg-[#1a1d24] rounded-2xl border border-gray-800 overflow-hidden mb-8 shadow-xl">
        <div className="h-48 md:h-64 bg-gray-800 relative group">
          {community.coverImage ? <img src={community.coverImage} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-gradient-to-r from-blue-900 to-indigo-900"></div>}
          <div className="absolute inset-0 bg-gradient-to-t from-[#1a1d24] via-transparent to-transparent"></div>
        </div>
        <div className="px-6 py-6 relative">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-3xl font-bold text-white">{community.name}</h1>
                {isAdmin && <span className="bg-yellow-500/20 text-yellow-500 text-xs px-2 py-0.5 rounded font-bold border border-yellow-500/50">Admin</span>}
              </div>
              <p className="text-gray-400 text-sm mb-4 max-w-2xl">{community.description}</p>
              <div className="flex items-center gap-4 text-sm font-bold text-gray-500">
                <button onClick={() => isAdmin && setIsMembersModalOpen(true)} className={`flex items-center gap-1.5 ${isAdmin ? 'hover:text-blue-400 transition' : ''}`}>
                  <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                  {community._count.members} Thành viên
                </button>
                <span className="flex items-center gap-1.5"><svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>{community.posts.length} Bài viết</span>
              </div>
            </div>
            
            {/* 🌟 NÚT TƯƠNG TÁC (TÙY THEO QUYỀN) */}
            <div className="flex items-center gap-3">
              {isAdmin ? (
                <>
                  <button onClick={() => setIsMembersModalOpen(true)} className="bg-gray-800 hover:bg-gray-700 text-white px-5 py-2.5 rounded-full font-bold transition text-sm flex items-center gap-2 border border-gray-700">
                    👥 <span className="hidden sm:inline">Thành viên</span>
                  </button>
                  <button onClick={openEditCommunity} className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-full font-bold transition text-sm flex items-center gap-2 shadow-lg shadow-blue-600/20">
                    ⚙️ <span className="hidden sm:inline">Cài đặt</span>
                  </button>
                </>
              ) : (
                <button onClick={handleToggleJoin} disabled={isProcessingJoin} className={`px-8 py-3 rounded-full font-bold transition shadow-lg whitespace-nowrap disabled:opacity-50 ${isMember ? 'bg-transparent border-2 border-gray-600 text-gray-300 hover:border-red-500 hover:text-red-500' : 'bg-blue-600 border-2 border-blue-600 text-white hover:bg-blue-500 hover:border-blue-500'}`}>
                  {isProcessingJoin ? "Đang xử lý..." : (isMember ? "Đã tham gia" : "Tham gia nhóm")}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* FEED BÀI VIẾT (Giữ nguyên cấu trúc đã có) */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white border-b-2 border-blue-500 pb-2 inline-block">Bài viết trong nhóm</h2>
          <button onClick={() => setIsModalOpen(true)} className="text-sm font-bold text-blue-400 hover:text-blue-300 bg-blue-900/20 hover:bg-blue-900/40 px-4 py-2 rounded-lg transition">+ Viết bài mới</button>
        </div>
        <div className="space-y-6">
          {community.posts.length === 0 ? (
            <div className="text-center py-16 bg-[#1a1d24] rounded-2xl border border-gray-800"><p className="text-gray-400">Chưa có bài viết nào.</p></div>
          ) : (
            community.posts.map((post) => (
              <div key={post.id} className="bg-[#1a1d24] rounded-xl border border-gray-800 p-5 shadow-sm hover:border-gray-700 transition">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-gray-700 overflow-hidden flex-shrink-0">
                    {post.author?.image ? <img src={post.author.image} alt="Avatar" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center font-bold text-gray-400">{post.author?.name?.charAt(0) || "U"}</div>}
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-200 text-sm">{post.author?.name || "Người dùng ẩn danh"}</h4>
                    <p className="text-xs text-gray-500">{new Date(post.createdAt).toLocaleString('vi-VN')}</p>
                  </div>
                  <span className={`ml-auto text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${post.category === 'ANIME' ? 'bg-blue-900/50 text-blue-400' : post.category === 'MANGA' ? 'bg-green-900/50 text-green-400' : 'bg-gray-800 text-gray-400'}`}>{post.category}</span>
                </div>

                <h3 className="text-xl font-bold text-gray-100 mb-2">{post.title}</h3>
                <p className="text-gray-300 text-sm whitespace-pre-wrap mb-4 leading-relaxed">{post.content}</p>

                {post.mediaUrl && (
                  <div className="mb-4 rounded-xl overflow-hidden border border-gray-800 bg-gray-900">
                    {post.mediaUrl.includes('/video/upload/') ? <video src={post.mediaUrl} controls className="w-full max-h-[500px] object-contain" /> : <img src={post.mediaUrl} className="w-full max-h-[500px] object-contain" />}
                  </div>
                )}
                
                {/* Tags & Spoiler */}
                <div className="flex flex-wrap items-center gap-2 mt-4">
                  {post.isSpoiler && <span className="bg-red-900/50 text-red-400 text-xs px-2.5 py-1 rounded border border-red-500 font-bold">⚠️ Spoiler</span>}
                  {post.tags?.map((tag: string, index: number) => <span key={index} className="text-blue-400 hover:text-blue-300 cursor-pointer text-sm font-medium">#{tag}</span>)}
                </div>

                {/* THANH TƯƠNG TÁC */}
                <div className="flex items-center justify-between mt-5 pt-4 border-t border-gray-800/50 text-gray-400">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center bg-gray-800/50 rounded-full">
                      <button onClick={() => handleVote(post.id, 'UP')} className="p-2 hover:text-green-500 hover:bg-gray-800 rounded-l-full transition"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg></button>
                      <span className="font-bold text-sm px-1 text-gray-300">{post.upvoteCount}</span>
                      <button onClick={() => handleVote(post.id, 'DOWN')} className="p-2 hover:text-red-500 hover:bg-gray-800 rounded-r-full transition"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg></button>
                    </div>
                    <button onClick={() => toggleComments(post.id)} className="flex items-center gap-2 hover:text-blue-400 hover:bg-gray-800/50 px-3 py-2 rounded-full transition text-sm font-medium"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg> Bình luận</button>
                  </div>
                  {(session?.user?.id === post.authorId || isAdmin) && (
                    <div className="flex gap-2">
                      {session?.user?.id === post.authorId && <button onClick={() => handleEditClick(post)} className="text-gray-500 hover:text-blue-500 p-2 transition"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg></button>}
                      <button onClick={() => handleDeletePost(post.id)} className="text-gray-500 hover:text-red-500 p-2 transition"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                    </div>
                  )}
                </div>

                {/* KHU VỰC BÌNH LUẬN ĐA CẤP */}
                {activeCommentPostId === post.id && (
                  <div className="mt-4 pt-4 border-t border-gray-800">
                    <div className="flex gap-3 mb-6">
                      <input type="text" placeholder="Viết bình luận của bạn..." value={newComment} onChange={e => { setNewComment(e.target.value); setReplyingToCommentId(null); }} className="flex-1 bg-gray-900 border border-gray-800 rounded-full px-4 py-2.5 text-sm outline-none focus:border-blue-500" />
                      <button onClick={() => handlePostComment(post.id, null)} className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-full text-sm font-bold">Gửi</button>
                    </div>
                    
                    <div className="space-y-4">
                      {comments.filter(c => !c.parentId).map(cmt => {
                        const renderCommentNode = (comment: ForumCommentItem, isReply = false) => {
                          const replies = comments.filter(c => c.parentId === comment.id);
                          const isEditing = editingCommentId === comment.id;
                          const isReplying = replyingToCommentId === comment.id;

                          return (
                            <div key={comment.id} className={`flex gap-3 ${isReply ? 'mt-3 relative before:absolute before:-left-6 before:top-4 before:w-4 before:h-px before:bg-gray-700' : ''}`}>
                              <div className="w-8 h-8 rounded-full bg-gray-700 overflow-hidden flex-shrink-0 z-10 border-2 border-[#1a1d24]">
                                <div className="w-full h-full flex justify-center items-center font-bold text-xs text-gray-400">{comment.author?.name?.charAt(0) || "U"}</div>
                              </div>
                              <div className="flex-1">
                                <div className="bg-gray-900/40 p-3 rounded-2xl rounded-tl-none border border-gray-800/50">
                                  <h5 className="font-bold text-xs text-gray-300">{comment.author?.name} {comment.authorId === community.creatorId && <span className="ml-1 text-[10px] bg-yellow-500/20 text-yellow-500 px-1.5 py-0.5 rounded border border-yellow-500/50">Admin</span>}</h5>
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
                                <div className="flex items-center gap-4 mt-1.5 ml-2 text-xs font-bold text-gray-500">
                                  <div className="flex items-center gap-1">
                                    <button onClick={() => handleVoteComment(comment.id, 'UP')} className="hover:text-green-500">▲</button>
                                    <span className={comment.upvoteCount > 0 ? "text-green-500" : comment.upvoteCount < 0 ? "text-red-500" : ""}>{comment.upvoteCount}</span>
                                    <button onClick={() => handleVoteComment(comment.id, 'DOWN')} className="hover:text-red-500">▼</button>
                                  </div>
                                  <button onClick={() => { setReplyingToCommentId(comment.id); setNewComment(""); }} className="hover:text-gray-300">Reply</button>
                                  {(session?.user?.id === comment.authorId || isAdmin) && (
                                    <>
                                      {session?.user?.id === comment.authorId && <button onClick={() => { setEditingCommentId(comment.id); setEditCommentContent(comment.content); }} className="hover:text-blue-400">Edit</button>}
                                      <button onClick={() => handleDeleteComment(comment.id)} className="hover:text-red-400">Delete</button>
                                    </>
                                  )}
                                </div>
                                {isReplying && (
                                  <div className="flex gap-2 mt-2 ml-2">
                                    <input autoFocus type="text" placeholder={`Trả lời ${comment.author?.name}...`} value={newComment} onChange={e => setNewComment(e.target.value)} className="flex-1 bg-gray-900 border border-gray-700 rounded-full px-3 py-1.5 text-xs outline-none focus:border-blue-500 text-white" />
                                    <button onClick={() => handlePostComment(post.id, comment.id)} className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-full text-xs font-bold">Gửi</button>
                                  </div>
                                )}
                                {replies.length > 0 && <div className="pl-6 border-l-2 border-gray-800/50 relative mt-2 space-y-3">{replies.map(reply => renderCommentNode(reply, true))}</div>}
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
      </div>

      {/* POPUP MODAL ĐĂNG BÀI */}
      {isModalOpen && (
        /* ... Giữ nguyên Modal đăng bài cũ ... */
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[#1a1d24] w-full max-w-2xl rounded-2xl border border-gray-800 shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center p-5 border-b border-gray-800">
              <h2 className="text-xl font-bold text-gray-100">{editingPost ? "Sửa bài viết" : `Đăng bài vào ${community.name}`}</h2>
              <button onClick={resetForm} className="text-gray-400 hover:text-white transition bg-gray-800 hover:bg-gray-700 w-8 h-8 rounded-full flex items-center justify-center">✕</button>
            </div>
            <div className="p-5 overflow-y-auto custom-scrollbar flex-1 space-y-4">
              <input type="text" placeholder="Tiêu đề bài viết..." value={title} onChange={e => setTitle(e.target.value)} className="w-full bg-transparent border border-gray-800 rounded-lg px-4 py-3 outline-none font-bold text-lg focus:border-blue-500 transition" />
              <textarea placeholder="Nội dung bài viết..." value={content} onChange={e => setContent(e.target.value)} className="w-full bg-transparent border border-gray-800 rounded-lg px-4 py-3 outline-none resize-none h-32 text-sm text-gray-200 focus:border-blue-500 transition custom-scrollbar" />
              {mediaPreview && (
                <div className="relative rounded-xl overflow-hidden border border-gray-800 bg-gray-900 aspect-video flex items-center justify-center">
                  {mediaFile?.type.startsWith('video/') ? <video src={mediaPreview} controls className="max-h-full max-w-full" /> : <img src={mediaPreview} className="max-h-full max-w-full object-contain" />}
                  <button onClick={() => { setMediaFile(null); setMediaPreview(null); }} className="absolute top-2 right-2 bg-black/60 text-white rounded-full p-1.5 hover:bg-red-500 transition">✕</button>
                </div>
              )}
              <div className="bg-gray-900/50 p-3 rounded-lg border border-gray-800">
                <div className="flex flex-wrap gap-2 mb-2">
                  {isSpoiler && <span className="bg-red-900/50 text-red-400 text-xs px-2.5 py-1 rounded border border-red-500">⚠️ Spoiler</span>}
                  {tags.map(tag => <span key={tag} className="bg-blue-900/40 border border-blue-800/50 text-blue-300 text-xs px-2.5 py-1 rounded flex items-center gap-1">#{tag} <button onClick={() => removeTag(tag)} className="hover:text-red-400 ml-1">✕</button></span>)}
                </div>
                <input type="text" placeholder="Nhập tag và Enter..." value={tagInput} onChange={e => setTagInput(e.target.value)} onKeyDown={handleKeyDownTag} className="w-full bg-transparent outline-none text-sm text-gray-300" />
              </div>
            </div>
            <div className="p-5 border-t border-gray-800 flex justify-between items-center bg-gray-900/50 rounded-b-2xl">
              <div className="flex items-center gap-3">
                <select value={category} onChange={e => setCategory(e.target.value as "GENERAL" | "ANIME" | "MANGA")} className="bg-gray-800 text-sm px-3 py-2 rounded-lg outline-none border border-gray-700 hover:border-gray-600 transition">
                  <option value="GENERAL">📍 Chung</option><option value="ANIME">🎬 Anime</option><option value="MANGA">📖 Manga</option>
                </select>
                <input type="file" accept="image/*,video/*" hidden ref={fileInputRef} onChange={handleFileChange} />
                <button onClick={() => fileInputRef.current?.click()} className="text-gray-400 hover:text-green-400 transition p-2 bg-gray-800 rounded-lg border border-gray-700"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg></button>
              </div>
              <div className="flex gap-3">
                <button onClick={handleAIAnalyze} disabled={isAnalyzing} className="bg-purple-600/20 text-purple-400 border border-purple-600 hover:bg-purple-600 hover:text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center">{isAnalyzing ? "..." : "🪄 AI Check"}</button>
                <button onClick={handleSubmitPost} disabled={isPosting} className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-lg text-sm font-bold">{isPosting ? "Đang xử lý..." : "Post"}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 🌟 1. POPUP SỬA THÔNG TIN CỘNG ĐỒNG (Chỉ Admin) */}
      {isEditCommunityModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#1a1d24] w-full max-w-lg rounded-2xl border border-gray-800 shadow-2xl flex flex-col">
            <div className="flex justify-between items-center p-5 border-b border-gray-800">
              <h2 className="text-xl font-bold text-gray-100">Cài đặt Cộng đồng</h2>
              <button onClick={() => setIsEditCommunityModalOpen(false)} className="text-gray-400 hover:text-white transition w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-800">✕</button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-400 mb-1.5">Tên cộng đồng</label>
                <input type="text" value={editComName} onChange={e => setEditComName(e.target.value)} className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2.5 outline-none text-white focus:border-blue-500 transition" />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-400 mb-1.5">Mô tả chi tiết</label>
                <textarea value={editComDesc} onChange={e => setEditComDesc(e.target.value)} className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2.5 outline-none text-white focus:border-blue-500 transition resize-none h-24 custom-scrollbar" />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-400 mb-1.5">Ảnh bìa mới</label>
                <input type="file" accept="image/*" hidden ref={comCoverInputRef} onChange={e => { if (e.target.files && e.target.files[0]) { setEditComCover(e.target.files[0]); setEditComCoverPreview(URL.createObjectURL(e.target.files[0])); } }} />
                {editComCoverPreview ? (
                  <div className="relative h-32 rounded-lg overflow-hidden border border-gray-700 cursor-pointer" onClick={() => comCoverInputRef.current?.click()}>
                    <img src={editComCoverPreview} alt="Cover" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition"><span className="text-white font-bold text-sm">Đổi ảnh</span></div>
                  </div>
                ) : (
                  <button onClick={() => comCoverInputRef.current?.click()} className="w-full py-4 border-2 border-dashed border-gray-700 rounded-lg text-gray-500 hover:text-blue-400 hover:border-blue-500 transition">Tải ảnh lên</button>
                )}
              </div>
            </div>
            <div className="p-5 border-t border-gray-800 flex justify-end gap-3 bg-gray-900/50 rounded-b-2xl">
              <button onClick={() => setIsEditCommunityModalOpen(false)} className="px-5 py-2.5 rounded-lg text-sm font-bold text-gray-400 hover:text-white transition">Hủy</button>
              <button onClick={handleUpdateCommunity} disabled={isUpdatingCommunity} className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2.5 rounded-lg text-sm font-bold transition disabled:opacity-50">{isUpdatingCommunity ? "Đang lưu..." : "Lưu thay đổi"}</button>
            </div>
          </div>
        </div>
      )}

      {/* 🌟 2. POPUP DANH SÁCH THÀNH VIÊN (Chỉ Admin) */}
      {isMembersModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#1a1d24] w-full max-w-md rounded-2xl border border-gray-800 shadow-2xl flex flex-col max-h-[80vh]">
            <div className="flex justify-between items-center p-5 border-b border-gray-800">
              <h2 className="text-xl font-bold text-gray-100">Thành viên ({community.members.length})</h2>
              <button onClick={() => setIsMembersModalOpen(false)} className="text-gray-400 hover:text-white transition w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-800">✕</button>
            </div>
            <div className="p-5 overflow-y-auto custom-scrollbar flex-1 space-y-3">
              {community.members.map(member => (
                <div key={member.id} className="flex items-center justify-between p-3 bg-gray-900/50 rounded-xl border border-gray-800/50">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gray-700 overflow-hidden flex-shrink-0">
                      {member.image ? <img src={member.image} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center font-bold text-gray-400">{member.name?.charAt(0)}</div>}
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-200 text-sm flex items-center gap-2">
                        {member.name}
                        {member.id === community.creatorId && <span className="text-[10px] bg-yellow-500/20 text-yellow-500 px-1.5 py-0.5 rounded border border-yellow-500/50">Quản trị viên</span>}
                      </h4>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}