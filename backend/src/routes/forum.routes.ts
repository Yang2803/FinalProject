import express, { Request, Response } from 'express';
import { GoogleGenerativeAI } from "@google/generative-ai";
import prisma from '../config/db';

const router = express.Router();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);

// ==========================================
// 🪄 API 1: AI Auto-Tagging & Spoiler Detection
// ==========================================
router.post('/api/forum/analyze', async (req: Request, res: Response): Promise<any> => {
  try {
    const { title, content } = req.body;
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash",
      generationConfig: { responseMimeType: "application/json" }
    });

    const prompt = `
      Bạn là hệ thống kiểm duyệt Forum Anime/Manga. Hãy phân tích bài viết này.
      Title: "${title}"
      Content: "${content}"
      
      Nhiệm vụ:
      1. isSpoiler: Trả về true nếu nội dung có chứa tiết lộ tình tiết quan trọng, kết cục, hoặc cái chết của nhân vật. Nếu an toàn, trả về false.
      2. tags: Trích xuất 3-5 keywords ngắn gọn nhất làm mảng chuỗi (ví dụ: ["Jujutsu Kaisen", "Review", "Gojo"]).
      
      Trả về ĐÚNG định dạng JSON: {"isSpoiler": boolean, "tags": [string]}
    `;

    const result = await model.generateContent(prompt);
    const analysis = JSON.parse(result.response.text());

    res.status(200).json(analysis);
  } catch (error) {
    res.status(500).json({ error: "Lỗi AI phân tích" });
  }
});

// ==========================================
// 📝 API 2: Tạo bài viết mới
// ==========================================
router.post('/api/forum/posts', async (req: Request, res: Response): Promise<any> => {
  try {
    // 🌟 Hứng thêm mediaUrl từ Frontend
    const { title, content, mediaUrl, category, tags, isSpoiler, authorId, communityId } = req.body;

    const post = await prisma.forumPost.create({
      data: {
        title, content, mediaUrl, category, tags, isSpoiler, authorId,
        ...(communityId && { communityId })
      }
    });

    res.status(201).json({ message: "Đăng bài thành công!", post });
  } catch (error) {
    res.status(500).json({ error: "Lỗi khi lưu bài viết" });
  }
});

// ==========================================
// 🔍 API 3: Lấy danh sách Feed (Có lọc Anime/Manga)
// ==========================================
router.get('/api/forum/posts', async (req: Request, res: Response): Promise<any> => {
  try {
    const { category, tag } = req.query; // 🌟 Hứng thêm biến tag từ URL
    
    let filterCondition: any = {};
    
    // Nếu có chọn Category (ANIME/MANGA)
    if (category && category !== 'ALL') {
      filterCondition.category = category;
    }

    // 🌟 Nếu có truyền Tag, dùng lệnh { has: tag } của Prisma để tìm trong mảng
    if (tag) {
      filterCondition.tags = { has: tag as string };
    }

    const posts = await prisma.forumPost.findMany({
      where: filterCondition,
      orderBy: { createdAt: 'desc' },
      include: { author: { select: { name: true } }, community: true }
    });

    res.status(200).json(posts);
  } catch (error) {
    res.status(500).json({ error: "Lỗi tải Feed" });
  }
});

// ==========================================
// ✏️ API 4: Sửa bài viết (Chỉ chính chủ)
// ==========================================
router.put('/api/forum/posts/:id', async (req: Request, res: Response): Promise<any> => {
  try {
    // 1. Ép kiểu id chuẩn xác để tránh lỗi TypeScript
    const postId = req.params.id as string; 
    
    // 2. Nhận đầy đủ dữ liệu từ Frontend (Bao gồm cả mediaUrl)
    const { title, content, tags, category, isSpoiler, mediaUrl, authorId } = req.body;

    const post = await prisma.forumPost.findUnique({ where: { id: postId } });
    if (!post) return res.status(404).json({ error: "Không tìm thấy bài viết!" });
    if (post.authorId !== authorId) return res.status(403).json({ error: "Không có quyền sửa bài viết này!" });

    // 3. Cập nhật vào Database
    const updatedPost = await prisma.forumPost.update({
      where: { id: postId },
      data: { title, content, tags, category, isSpoiler, mediaUrl }, // 🌟 Bổ sung mediaUrl
      include: { author: { select: { name: true } } }
    });

    res.status(200).json({ message: "Đã cập nhật bài viết!", post: updatedPost });
  } catch (error) {
    // 🌟 In thẳng lỗi ra màn hình Terminal của VS Code để dễ bắt bệnh
    console.error("LỖI BACKEND KHI SỬA BÀI:", error); 
    res.status(500).json({ error: "Lỗi khi sửa bài" });
  }
});

// ==========================================
// 🗑️ API 5: Xóa bài viết (Chỉ chính chủ)
// ==========================================
router.delete('/api/forum/posts/:id', async (req: Request, res: Response): Promise<any> => {
  try {
    const id = req.params.id as string;
    const { authorId } = req.body;

    const post = await prisma.forumPost.findUnique({ where: { id } });
    if (!post || post.authorId !== authorId) return res.status(403).json({ error: "Không có quyền xóa bài viết này!" });

    await prisma.forumPost.delete({ where: { id } });
    res.status(200).json({ message: "Đã xóa bài viết thành công!" });
  } catch (error) {
    res.status(500).json({ error: "Lỗi khi xóa bài" });
  }
});

// ==========================================
// ⚖️ API 6: Hệ thống Vote (Upvote / Downvote)
// ==========================================
router.post('/api/forum/posts/:id/vote', async (req: Request, res: Response): Promise<any> => {
  try {
   const postId = req.params.id as string;
    const { userId, type } = req.body; // type = 'UP' hoặc 'DOWN'

    const existingVote = await prisma.forumVote.findUnique({
      where: { userId_postId: { userId, postId } }
    });

    let scoreChange = 0;

    if (existingVote) {
      if (existingVote.type === type) {
        // Bấm lại nút cũ -> Bỏ vote
        await prisma.forumVote.delete({ where: { id: existingVote.id } });
        scoreChange = type === 'UP' ? -1 : 1;
      } else {
        // Đổi từ Up sang Down (hoặc ngược lại) -> Trừ/Cộng 2 điểm
        await prisma.forumVote.update({
          where: { id: existingVote.id },
          data: { type }
        });
        scoreChange = type === 'UP' ? 2 : -2;
      }
    } else {
      // Chưa từng vote -> Tạo mới vote
      await prisma.forumVote.create({ data: { userId, postId, type } });
      scoreChange = type === 'UP' ? 1 : -1;
    }

    // Cập nhật lại tổng số điểm
    const updatedPost = await prisma.forumPost.update({
      where: { id: postId },
      data: { upvoteCount: { increment: scoreChange } }
    });

    res.status(200).json({ upvoteCount: updatedPost.upvoteCount });
  } catch (error) {
    res.status(500).json({ error: "Lỗi khi vote" });
  }
});

// ==========================================
// 💬 API 7: BÌNH LUẬN (ĐẦY ĐỦ TÍNH NĂNG)
// ==========================================

// 1. Lấy danh sách comment của bài viết
router.get('/api/forum/posts/:id/comments', async (req: Request, res: Response): Promise<any> => {
  try {
    const comments = await prisma.forumComment.findMany({
      where: { postId: req.params.id as string },
      include: { author: { select: { name: true } } }, // Giữ đúng select name như đã fix
      orderBy: { createdAt: 'asc' }
    });
    res.status(200).json(comments);
  } catch (error) { res.status(500).json({ error: "Lỗi tải comment" }); }
});

// 2. Viết comment mới (hoặc Reply)
router.post('/api/forum/posts/:id/comments', async (req: Request, res: Response): Promise<any> => {
  try {
    const { content, authorId, parentId } = req.body; // Thêm parentId
    const comment = await prisma.forumComment.create({
      data: { content, authorId, postId: req.params.id as string, parentId },
      include: { author: { select: { name: true } } }
    });
    res.status(201).json(comment);
  } catch (error) { res.status(500).json({ error: "Lỗi đăng comment" }); }
});

// 3. Sửa comment
router.put('/api/forum/comments/:id', async (req: Request, res: Response): Promise<any> => {
  try {
    const commentId = req.params.id as string;
    const { content, authorId } = req.body;
    
    const comment = await prisma.forumComment.findUnique({ where: { id: commentId } });
    if (!comment || comment.authorId !== authorId) return res.status(403).json({ error: "Không có quyền sửa!" });

    const updatedComment = await prisma.forumComment.update({
      where: { id: commentId },
      data: { content },
      include: { author: { select: { name: true } } }
    });
    res.status(200).json(updatedComment);
  } catch (error) { res.status(500).json({ error: "Lỗi sửa comment" }); }
});

// 4. Xóa comment
router.delete('/api/forum/comments/:id', async (req: Request, res: Response): Promise<any> => {
  try {
    const commentId = req.params.id as string;
    const { authorId } = req.body;

    const comment = await prisma.forumComment.findUnique({ where: { id: commentId } });
    if (!comment || comment.authorId !== authorId) return res.status(403).json({ error: "Không có quyền xóa!" });

    await prisma.forumComment.delete({ where: { id: commentId } });
    res.status(200).json({ message: "Đã xóa comment" });
  } catch (error) { res.status(500).json({ error: "Lỗi xóa comment" }); }
});

// 5. Vote Comment
router.post('/api/forum/comments/:id/vote', async (req: Request, res: Response): Promise<any> => {
  try {
    const commentId = req.params.id as string;
    const { userId, type } = req.body;

    const existingVote = await prisma.forumCommentVote.findUnique({
      where: { userId_commentId: { userId, commentId } }
    });

    let scoreChange = 0;
    if (existingVote) {
      if (existingVote.type === type) {
        await prisma.forumCommentVote.delete({ where: { id: existingVote.id } });
        scoreChange = type === 'UP' ? -1 : 1;
      } else {
        await prisma.forumCommentVote.update({ where: { id: existingVote.id }, data: { type } });
        scoreChange = type === 'UP' ? 2 : -2;
      }
    } else {
      await prisma.forumCommentVote.create({ data: { userId, commentId, type } });
      scoreChange = type === 'UP' ? 1 : -1;
    }

    const updatedComment = await prisma.forumComment.update({
      where: { id: commentId }, data: { upvoteCount: { increment: scoreChange } }
    });
    res.status(200).json({ upvoteCount: updatedComment.upvoteCount });
  } catch (error) { res.status(500).json({ error: "Lỗi vote comment" }); }
});

// ==========================================
// 📈 API 8: Lấy danh sách Trending Tags (Top 5)
// ==========================================
router.get('/api/forum/trending-tags', async (req: Request, res: Response): Promise<any> => {
  try {
    // Lấy tất cả bài viết và chỉ lấy trường tags
    const posts = await prisma.forumPost.findMany({
      select: { tags: true }
    });

    // Tạo một object (từ điển) để đếm số lần xuất hiện của từng tag
    const tagCount: Record<string, number> = {};
    
    posts.forEach(post => {
      if (post.tags && Array.isArray(post.tags)) {
        post.tags.forEach(tag => {
          tagCount[tag] = (tagCount[tag] || 0) + 1;
        });
      }
    });

    // Chuyển object thành mảng, sắp xếp giảm dần theo số lượng và cắt lấy top 5
    const trendingTags = Object.entries(tagCount)
      .sort((a, b) => b[1] - a[1]) // Sắp xếp giảm dần (b - a)
      .slice(0, 5)                 // Lấy 5 phần tử đầu tiên
      .map(entry => entry[0]);     // Chỉ lấy tên tag, bỏ phần số lượng đi

    res.status(200).json(trendingTags);
  } catch (error) {
    console.error("LỖI TRENDING TAGS:", error);
    res.status(500).json({ error: "Lỗi tải trending tags" });
  }
});

export default router;