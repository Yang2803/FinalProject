"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react"; // 🌟 Import thêm useSession để check đăng nhập

// ==========================================
// ĐỊNH NGHĨA INTERFACES
// ==========================================
interface Author {
  id?: string;
  name?: string;
  image?: string;
}

interface ForumPost {
  id: string;
  title: string;
  content: string;
  mediaUrl: string | null;
  category: string;
  tags: string[];
  isSpoiler: boolean;
  upvoteCount: number;
  createdAt: string;
  authorId: string;
  author: Author;
  community?: {
    name: string;
  } | null;
}

interface ForumCommentItem {
  id: string;
  content: string;
  createdAt: string;
  author?: Author;
  authorId: string;
  parentId?: string | null;
  upvoteCount: number;
}

export default function ForumPostDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { data: session } = useSession(); // 🌟 Lấy thông tin user hiện tại
  
  // Giải nén ID từ URL
  const resolvedParams = use(params);
  const postId = resolvedParams.id;

  // States cho bài viết
  const [post, setPost] = useState<ForumPost | null>(null);
  const [loading, setLoading] = useState(true);

  // 🌟 States cho bình luận (Bê từ forum/page.tsx sang)
  const [comments, setComments] = useState<ForumCommentItem[]>([]);
  const [newComment, setNewComment] = useState("");
  const [replyingToCommentId, setReplyingToCommentId] = useState<string | null>(null);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editCommentContent, setEditCommentContent] = useState("");

  // Gọi API lấy dữ liệu bài viết VÀ bình luận
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Lấy chi tiết bài viết
        const postRes = await fetch(`http://localhost:5000/api/forum/posts/${postId}`);
        if (postRes.ok) {
          const postData = await postRes.json();
          setPost(postData);
        }

        // 🌟 Lấy luôn danh sách bình luận của bài viết này
        const cmtRes = await fetch(`http://localhost:5000/api/forum/posts/${postId}/comments`);
        if (cmtRes.ok) {
          const cmtData = await cmtRes.json();
          setComments(cmtData);
        }

      } catch (error) {
        console.error("Lỗi khi tải dữ liệu:", error);
      } finally {
        setLoading(false);
      }
    };

    if (postId) fetchData();
  }, [postId]);

  // ==========================================
  // 🌟 CÁC HÀM XỬ LÝ BÌNH LUẬN
  // ==========================================
  
  // GỬI BÌNH LUẬN (HOẶC REPLY)
  const handlePostComment = async (parentId: string | null = null) => {
    if (!newComment.trim()) return;
    if (!session?.user?.id) return alert("Vui lòng đăng nhập để bình luận!");
    try {
      const res = await fetch(`http://localhost:5000/api/forum/posts/${postId}/comments`, {
        method: "POST", 
        headers: { "Content-Type": "application/json" },
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
    if (!confirm("Bạn có chắc muốn xóa bình luận này?")) return;
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
    if (!session?.user?.id) return alert("Đăng nhập để vote nhé!");
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

  // Hàm dịch thuật Link
  const renderFormattedContent = (text: string) => {
    const linkRegex = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
    const parts = [];
    let lastIndex = 0;
    let match;
    
    while ((match = linkRegex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(text.substring(lastIndex, match.index));
      }
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
    
    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }
    
    return parts.length > 0 ? parts : text;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f0f11] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="min-h-screen bg-[#0f0f11] text-white flex flex-col items-center justify-center">
        <h1 className="text-4xl font-bold mb-4">404</h1>
        <p className="text-gray-400 mb-6">Bài viết này không tồn tại hoặc đã bị xóa.</p>
        <Link href="/forum" className="bg-blue-600 px-6 py-2 rounded-lg font-bold hover:bg-blue-500 transition">
          Trở về Forum
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f0f11] text-white pb-20">
      <div className="max-w-4xl mx-auto px-4 pt-8">
        
        {/* Nút quay lại */}
        <Link href="/forum" className="inline-flex items-center gap-2 text-gray-400 hover:text-blue-400 transition mb-6 font-bold text-sm">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
          Back to Forum
        </Link>

        {/* NỘI DUNG BÀI VIẾT */}
        <div className="bg-[#1a1d24] rounded-2xl border border-gray-800 p-6 md:p-8 shadow-xl mb-8">
          
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center font-bold text-lg overflow-hidden shrink-0">
                {post.author?.image ? (
                  <img src={post.author.image} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  post.author?.name?.charAt(0).toUpperCase() || "U"
                )}
              </div>
              <div>
                <p className="font-bold text-gray-200">{post.author?.name || "Ẩn danh"}</p>
                <p className="text-xs text-gray-500">{new Date(post.createdAt).toLocaleString('vi-VN')}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {post.isSpoiler && (
                <span className="bg-red-900/50 text-red-400 text-xs px-2.5 py-1 rounded border border-red-500 font-bold">⚠️ Spoiler</span>
              )}
              <span className={`text-xs px-3 py-1 rounded-full font-bold border ${
                post.category === 'ANIME' ? 'bg-blue-900/30 text-blue-400 border-blue-800' :
                post.category === 'MANGA' ? 'bg-green-900/30 text-green-400 border-green-800' :
                'bg-gray-800 text-gray-300 border-gray-700'
              }`}>
                {post.category}
              </span>
            </div>
          </div>

          <h1 className="text-2xl md:text-3xl font-bold text-white mb-4 leading-snug">{post.title}</h1>
          
          <div className="text-gray-300 text-base md:text-lg whitespace-pre-wrap leading-relaxed mb-6">
            {renderFormattedContent(post.content)}
          </div>

          {post.mediaUrl && (
            <div className="mb-6 rounded-xl overflow-hidden border border-gray-800 bg-black">
              {post.mediaUrl.match(/\.(mp4|webm|ogg)$/i) ? (
                <video src={post.mediaUrl} controls className="w-full max-h-[500px] object-contain" />
              ) : (
                <img src={post.mediaUrl} alt="Post media" className="w-full max-h-[500px] object-contain" />
              )}
            </div>
          )}

          {post.tags && post.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-4 border-t border-gray-800/50">
              {post.tags.map((tag, idx) => (
                <span key={idx} className="text-sm font-medium text-blue-400 hover:text-blue-300 cursor-pointer transition">
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* ======================================================= */}
        {/* 🌟 KHU VỰC BÌNH LUẬN ĐÃ ĐỒNG BỘ UI TỪ TRANG CHỦ FORUM */}
        {/* ======================================================= */}
        <div className="bg-[#1a1d24] rounded-2xl border border-gray-800 p-6 md:p-8 shadow-xl">
          <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
            <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" /></svg>
            Bình luận ({comments.length})
          </h2>

          {/* Ô nhập Comment gốc */}
          <div className="flex gap-3 mb-8">
            <input 
              type="text" placeholder="Viết bình luận của bạn..." value={newComment} 
              onChange={e => { setNewComment(e.target.value); setReplyingToCommentId(null); }}
              className="flex-1 bg-gray-900 border border-gray-800 rounded-full px-4 py-3 text-sm outline-none focus:border-blue-500 text-white transition"
            />
            <button onClick={() => handlePostComment(null)} className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-full text-sm font-bold shadow-lg shadow-blue-900/20 transition">
              Gửi
            </button>
          </div>
          
          {/* Danh sách Comment */}
          <div className="space-y-5">
            {comments.filter(c => !c.parentId).map(cmt => {
              
              const renderCommentNode = (comment: ForumCommentItem, isReply = false) => {
                const replies = comments.filter(c => c.parentId === comment.id);
                const isEditing = editingCommentId === comment.id;
                const isReplying = replyingToCommentId === comment.id;

                return (
                  <div key={comment.id} className={`flex gap-3 ${isReply ? 'mt-3 relative before:absolute before:-left-6 before:top-4 before:w-4 before:h-px before:bg-gray-700' : ''}`}>
                    <div className="w-9 h-9 rounded-full bg-gray-700 overflow-hidden flex-shrink-0 z-10 border-2 border-[#1a1d24]">
                      {comment.author?.image ? (
                         <img src={comment.author.image} alt="Avatar" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex justify-center items-center font-bold text-xs text-gray-400">
                          {comment.author?.name?.charAt(0) || "U"}
                        </div>
                      )}
                    </div>
                    
                    <div className="flex-1">
                      <div className="bg-gray-900/50 p-3.5 rounded-2xl rounded-tl-none border border-gray-800/50">
                        <h5 className="font-bold text-sm text-gray-200">{comment.author?.name || "Ẩn danh"}</h5>
                        
                        {isEditing ? (
                          <div className="mt-2 flex gap-2">
                            <input autoFocus type="text" value={editCommentContent} onChange={e => setEditCommentContent(e.target.value)} className="flex-1 bg-gray-800 rounded px-2 py-1 text-sm outline-none text-white border border-blue-500/50" />
                            <button onClick={() => submitEditComment(comment.id)} className="text-green-400 text-xs font-bold px-2 hover:bg-green-400/10 rounded">Lưu</button>
                            <button onClick={() => setEditingCommentId(null)} className="text-gray-400 text-xs px-2 hover:bg-gray-800 rounded">Hủy</button>
                          </div>
                        ) : (
                          <p className="text-sm text-gray-300 mt-1 leading-relaxed">{comment.content}</p>
                        )}
                      </div>

                      <div className="flex items-center gap-4 mt-2 ml-2 text-xs font-bold text-gray-500">
                        <div className="flex items-center gap-1 bg-gray-900/50 rounded-full px-2 py-0.5 border border-gray-800">
                          <button onClick={() => handleVoteComment(comment.id, 'UP')} className="hover:text-green-500 p-1">▲</button>
                          <span className={comment.upvoteCount > 0 ? "text-green-500" : comment.upvoteCount < 0 ? "text-red-500" : "text-gray-400"}>{comment.upvoteCount}</span>
                          <button onClick={() => handleVoteComment(comment.id, 'DOWN')} className="hover:text-red-500 p-1">▼</button>
                        </div>
                        <button onClick={() => { setReplyingToCommentId(comment.id); setNewComment(""); }} className="hover:text-gray-300 transition">Reply</button>
                        
                        {session?.user?.id === comment.authorId && (
                          <>
                            <button onClick={() => { setEditingCommentId(comment.id); setEditCommentContent(comment.content); }} className="hover:text-blue-400 transition">Edit</button>
                            <button onClick={() => handleDeleteComment(comment.id)} className="hover:text-red-400 transition">Delete</button>
                          </>
                        )}
                        <span className="font-normal text-gray-600 text-[10px] ml-auto">{new Date(comment.createdAt).toLocaleTimeString('vi-VN')}</span>
                      </div>

                      {isReplying && (
                        <div className="flex gap-2 mt-3 ml-2">
                          <input autoFocus type="text" placeholder={`Trả lời ${comment.author?.name || "bạn này"}...`} value={newComment} onChange={e => setNewComment(e.target.value)} className="flex-1 bg-gray-900 border border-gray-700 rounded-full px-4 py-2 text-xs outline-none focus:border-blue-500 text-white transition shadow-inner" />
                          <button onClick={() => handlePostComment(comment.id)} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-full text-xs font-bold transition">Gửi</button>
                        </div>
                      )}

                      {replies.length > 0 && (
                        <div className="pl-7 border-l-2 border-gray-800/50 relative mt-3 space-y-4">
                          {replies.map(reply => renderCommentNode(reply, true))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              };

              return renderCommentNode(cmt);
            })}
            
            {comments.length === 0 && (
              <p className="text-gray-500 italic text-center py-8">Chưa có bình luận nào. Hãy là người đầu tiên chia sẻ suy nghĩ của bạn!</p>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}