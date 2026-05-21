"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";

interface Comment {
  id: string;
  content: string;
  createdAt: string;
  user: { name: string | null; email: string };
}

// Component này nhận vào 2 props: loại (manga/chapter) và ID tương ứng
export default function CommentSection({ targetType, targetId }: { targetType: "manga" | "chapter", targetId: string }) {
  const { data: session } = useSession();
  const [comments, setComments] = useState<Comment[]>([]);
  const [content, setContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    // Gọi API lấy comment dựa trên loại target
    const fetchComments = async () => {
      const query = targetType === "manga" ? `mangaId=${targetId}` : `chapterId=${targetId}`;
      const res = await fetch(`http://localhost:5000/api/comments?${query}`);
      if (res.ok) {
        const data = await res.json();
        setComments(data);
      }
    };
    fetchComments();
  }, [targetType, targetId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) return alert("Vui lòng đăng nhập để bình luận!");
    if (!content.trim()) return;

    setIsSubmitting(true);
    try {
      const payload = {
        userId: session.user.id,
        content,
        ...(targetType === "manga" ? { mangaId: targetId } : { chapterId: targetId })
      };

      const res = await fetch("http://localhost:5000/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const newComment = await res.json();
        setComments([newComment, ...comments]); // Đẩy comment mới lên đầu danh sách
        setContent(""); // Xóa trắng ô nhập
      }
    } catch (error) {
      alert("Lỗi đăng bình luận!");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-gray-800 rounded-xl p-6 shadow-xl mt-8">
      <h3 className="text-xl font-bold mb-4 border-b border-gray-700 pb-2 text-blue-400">
        Bình luận ({comments.length})
      </h3>

      {/* Form đăng bình luận */}
      {session ? (
        <form onSubmit={handleSubmit} className="mb-8">
          <textarea
            rows={3}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Bạn nghĩ gì về nội dung này?"
            className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white focus:outline-none focus:border-blue-500 resize-none"
            required
          />
          <div className="flex justify-end mt-2">
            <button type="submit" disabled={isSubmitting} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-bold transition disabled:opacity-50">
              {isSubmitting ? "Đang gửi..." : "Gửi bình luận"}
            </button>
          </div>
        </form>
      ) : (
        <div className="mb-8 p-4 bg-gray-900 border border-gray-700 rounded-lg text-center text-gray-400">
          Vui lòng <a href="/login" className="text-blue-400 hover:underline">đăng nhập</a> để tham gia bình luận.
        </div>
      )}

      {/* Danh sách bình luận */}
      <div className="space-y-4">
        {comments.map((cmt) => (
          <div key={cmt.id} className="flex gap-4 p-4 bg-gray-900/50 rounded-lg">
            <div className="w-10 h-10 bg-blue-600 rounded-full flex justify-center items-center font-bold text-lg shrink-0">
              {/* Lấy chữ cái đầu của Tên hoặc Email làm Avatar */}
              {(cmt.user.name || cmt.user.email).charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="font-bold text-gray-200">{cmt.user.name || cmt.user.email.split('@')[0]}</span>
                <span className="text-xs text-gray-500">{new Date(cmt.createdAt).toLocaleString("vi-VN")}</span>
              </div>
              <p className="text-gray-300 text-sm whitespace-pre-wrap">{cmt.content}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}