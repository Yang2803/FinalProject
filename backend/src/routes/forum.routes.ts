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
      model: "gemini-3.5-flash-lite",
      generationConfig: { responseMimeType: "application/json" }
    });

    const prompt = `
      You are an Anime/Manga Forum moderation system. Analyze this post.
      Title: "${title}"
      Content: "${content}"
      
      Tasks:
      1. isSpoiler: Return true if the content contains major plot reveals, endings, or character deaths. If safe, return false.
      2. tags: Extract 3-5 of the most concise keywords as an array of strings (e.g., ["Jujutsu Kaisen", "Review", "Gojo"]).
      
      Return ONLY the EXACT JSON format: {"isSpoiler": boolean, "tags": [string]}
    `;

    const result = await model.generateContent(prompt);
    const analysis = JSON.parse(result.response.text());

    res.status(200).json(analysis);
  } catch (error) {
    res.status(500).json({ error: "Error analyzing with AI" });
  }
});

// ==========================================
// 📝 API 2: Create a new forum post
// ==========================================
router.post('/api/forum/posts', async (req: Request, res: Response): Promise<any> => {
  try {
    // 🌟 Receive `mediaUrl` from the frontend
    const { title, content, mediaUrl, category, tags, isSpoiler, authorId, communityId } = req.body;

    const post = await prisma.forumPost.create({
      data: {
        title, content, mediaUrl, category, tags, isSpoiler, authorId,
        ...(communityId && { communityId })
      }
    });

    res.status(201).json({ message: "Successfully created a forum post!", post });
  } catch (error) {
    res.status(500).json({ error: "Error saving the forum post" });
  }
});

// ==========================================
// 🔍 API 3: Get Feed List (With Anime/Manga Filtering)
// ==========================================
router.get('/api/forum/posts', async (req: Request, res: Response): Promise<any> => {
  try {
    const { category, tag } = req.query; // 🌟 Receive additional `tag` parameter from URL
    
    let filterCondition: any = {};
    
    // Nếu có chọn Category (ANIME/MANGA)
    if (category && category !== 'ALL') {
      filterCondition.category = category;
    }

    // 🌟 If a tag is passed, use the `{ has: tag }` command in Prisma to search within the array.
    if (tag) {
      filterCondition.tags = { has: tag as string };
    }

    const posts = await prisma.forumPost.findMany({
      where: filterCondition,
      orderBy: { createdAt: 'desc' },
      include: { author: { select: { id: true, name: true, image: true } }, community: true }
    });

    res.status(200).json(posts);
  } catch (error) {
    res.status(500).json({ error: "Error loading Feed" });
  }
});

// ==========================================
// ✏️ API 4: Edit post (Owner only)
// ==========================================
router.put('/api/forum/posts/:id', async (req: Request, res: Response): Promise<any> => {
  try {
    // 1. Accurately casting the 'id' type to avoid TypeScript errors
    const postId = req.params.id as string; 
    
    // 2. Receive all data from the frontend (including mediaUrl)
    const { title, content, tags, category, isSpoiler, mediaUrl, authorId } = req.body;

    const post = await prisma.forumPost.findUnique({ where: { id: postId } });
    if (!post) return res.status(404).json({ error: "Post not found!" });
    if (post.authorId !== authorId) return res.status(403).json({ error: "You are not the owner of this post!" });

    // 3. Cập nhật vào Database
    const updatedPost = await prisma.forumPost.update({
      where: { id: postId },
      data: { title, content, tags, category, isSpoiler, mediaUrl }, 
      include: { author: { select: { id: true, name: true, image: true } } }
    });

    res.status(200).json({ message: "Successfully updated the post!", post: updatedPost });
  } catch (error) {
    console.error("ERROR BACKEND WHEN EDITING POST:", error); 
    res.status(500).json({ error: "Error updating the post" });
  }
});

// ==========================================
// 🗑️ API 5: Delete post (Owner only)
// ==========================================
router.delete('/api/forum/posts/:id', async (req: Request, res: Response): Promise<any> => {
  try {
    const id = req.params.id as string;
    const { authorId } = req.body;

    const post = await prisma.forumPost.findUnique({ where: { id } });
    if (!post || post.authorId !== authorId) return res.status(403).json({ error: "You are not the owner of this post!" });

    await prisma.forumPost.delete({ where: { id } });
    res.status(200).json({ message: "Successfully deleted the post!" });
  } catch (error) {
    res.status(500).json({ error: "Error deleting the post" });
  }
});

// ==========================================
// ⚖️ API 6: Systems Vote (Upvote / Downvote)
// ==========================================
router.post('/api/forum/posts/:id/vote', async (req: Request, res: Response): Promise<any> => {
  try {
    const postId = req.params.id as string;
    const { userId, type } = req.body; // type = 'UP' hoặc 'DOWN'

    const existingVote = await prisma.forumVote.findUnique({
      where: { userId_postId: { userId, postId } }
    });

    let upIncrement = 0;
    let downIncrement = 0;

    if (existingVote) {
      if (existingVote.type === type) {
        // Press the same button again -> Cancel vote
        await prisma.forumVote.delete({ where: { id: existingVote.id } });
        if (type === 'UP') upIncrement = -1;
        else downIncrement = -1;
      } else {
        // Switch from UP to DOWN or DOWN to UP
        await prisma.forumVote.update({
          where: { id: existingVote.id },
          data: { type }
        });
        if (type === 'UP') {
          upIncrement = 1;
          downIncrement = -1;
        } else {
          upIncrement = -1;
          downIncrement = 1;
        }
      }
    } else {
      // No previous vote -> Create new vote
      await prisma.forumVote.create({ data: { userId, postId, type } });
      if (type === 'UP') upIncrement = 1;
      else downIncrement = 1;
    }

    // Independently update both 2 columns in the database
    const updatedPost = await prisma.forumPost.update({
      where: { id: postId },
      data: {
        upvoteCount: { increment: upIncrement },
        downvoteCount: { increment: downIncrement }
      },
      select: {
        upvoteCount: true,
        downvoteCount: true
      }
    });

    res.status(200).json({
      upvoteCount: Math.max(0, updatedPost.upvoteCount),
      downvoteCount: Math.max(0, updatedPost.downvoteCount)
    });
  } catch (error) {
    console.error("Error voting for post:", error);
    res.status(500).json({ error: "Error occurred while voting" });
  }
});

// ==========================================
// 💬 API 7: COMMENTS (FULLY FUNCTIONAL)
// ==========================================

// 1. Get post's comments list (including replies)
router.get('/api/forum/posts/:id/comments', async (req: Request, res: Response): Promise<any> => {
  try {
    const comments = await prisma.forumComment.findMany({
      where: { postId: req.params.id as string },
      include: { author: { select: { id: true, name: true, image: true } } }, 
      orderBy: { createdAt: 'asc' }
    });
    res.status(200).json(comments);
  } catch (error) { res.status(500).json({ error: "Error loading comments" }); }
});

// 2. Write new comment (or Reply)
router.post('/api/forum/posts/:id/comments', async (req: Request, res: Response): Promise<any> => {
  try {
    const { content, authorId, parentId } = req.body; 
    const postId = req.params.id as string;
    
    // 1. Save comment to Database
    const comment = await prisma.forumComment.create({
      data: { content, authorId, postId, parentId },
      include: { author: { select: { id: true, name: true, image: true } } }
    });

    // ==========================================
    // 🌟 AUTO-SEND NOTIFICATIONS (REPLY & POST OWNER)
    // ==========================================
    try {
      const replierName = comment.author?.name || "A user";
      
      // A. Get original post information to know the "owner" and fetch the post title
      const post = await prisma.forumPost.findUnique({
        where: { id: postId },
        select: { authorId: true, title: true }
      });

      // Store the ID of the person who received a reply notification (to avoid sending duplicate notifications to the original poster)
      let notifiedReplyUserId: string | null = null;

      // B. HANDLING NOTIFICATIONS FOR THE RECIPIENT OF A REPLY (If a parentId exists)
      if (parentId) {
        const parentComment = await prisma.forumComment.findUnique({
          where: { id: parentId },
          select: { authorId: true }
        });

        // Only send notification if the replier is different from the original comment author
        if (parentComment && parentComment.authorId !== authorId) {
          notifiedReplyUserId = parentComment.authorId;
          await prisma.notification.create({
            data: {
              userId: parentComment.authorId,
              title: "Someone responded to you. 💬",
              message: `${replierName} just replied to your comment.`,
              linkUrl: `/forum/${postId}`,
              isRead: false
            }
          });
          console.log(`✨ Reply notification sent to user ID: ${parentComment.authorId}`);
        }
      }

      // C. HANDLING NOTIFICATIONS FOR THE POST OWNER
      // - Only send when the post exists
      // The person commenting is someone OTHER than the author of the post (i.e., one cannot notify oneself)
      // - The author of the post has NOT yet received a "Reply" notification at step B (to avoid receiving two notifications simultaneously).
      if (post && post.authorId !== authorId && post.authorId !== notifiedReplyUserId) {
        await prisma.notification.create({
          data: {
            userId: post.authorId,
            title: "New comment 📝",
            message: `${replierName} just commented on your post "${post.title}".`,
            linkUrl: `/forum/${postId}`,
            isRead: false
          }
        });
        console.log(`✨ New comment notification sent to user ID: ${post.authorId}`);
      }

    } catch (notiError) {
      console.error("Error occurred while processing notifications:", notiError);
    }
    // ==========================================

    res.status(201).json(comment);
  } catch (error) { 
    res.status(500).json({ error: "Comment upload error" }); 
  }
});

// 3. Edit comment
router.put('/api/forum/comments/:id', async (req: Request, res: Response): Promise<any> => {
  try {
    const commentId = req.params.id as string;
    const { content, authorId } = req.body;
    
    const comment = await prisma.forumComment.findUnique({ where: { id: commentId } });
    if (!comment || comment.authorId !== authorId) return res.status(403).json({ error: "You do not have permission to edit this comment!" });

    const updatedComment = await prisma.forumComment.update({
      where: { id: commentId },
      data: { content },
      include: { author: { select: { id: true, name: true, image: true } } }
    });
    res.status(200).json(updatedComment);
  } catch (error) { res.status(500).json({ error: "Comment edit error" }); }
});

// 4. Delete comment
router.delete('/api/forum/comments/:id', async (req: Request, res: Response): Promise<any> => {
  try {
    const commentId = req.params.id as string;
    const { authorId } = req.body;

    const comment = await prisma.forumComment.findUnique({ where: { id: commentId } });
    if (!comment || comment.authorId !== authorId) return res.status(403).json({ error: "You do not have permission to delete this comment!" });

    await prisma.forumComment.delete({ where: { id: commentId } });
    res.status(200).json({ message: "Comment deleted successfully" });
  } catch (error) { res.status(500).json({ error: "Comment delete error" }); }
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
  } catch (error) { res.status(500).json({ error: "Comment vote error" }); }
});

// ==========================================
// 📈 API 8: Get a list of Trending Tags (Top 5)
// ==========================================
router.get('/api/forum/trending-tags', async (req: Request, res: Response): Promise<any> => {
  try {
    // Get all forum posts and only select the tags field
    const posts = await prisma.forumPost.findMany({
      select: { tags: true }
    });

    // Create an object (dictionary) to count the occurrences of each tag
    const tagCount: Record<string, number> = {};
    
    posts.forEach(post => {
      if (post.tags && Array.isArray(post.tags)) {
        post.tags.forEach(tag => {
          tagCount[tag] = (tagCount[tag] || 0) + 1;
        });
      }
    });

    // Convert object to array, sort descending by count and slice top 5
    const trendingTags = Object.entries(tagCount)
      .sort((a, b) => b[1] - a[1]) // Sort descending (b - a)
      .slice(0, 5)                 // Take first 5 elements
      .map(entry => entry[0]);     // Only take tag names, discard counts

    res.status(200).json(trendingTags);
  } catch (error) {
    console.error("TRENDING TAGS ERROR:", error);
    res.status(500).json({ error: "Error fetching trending tags" });
  }
});

// ==========================================
// 📄 API 9: Get details of a Forum Post
// ==========================================
router.get('/api/forum/posts/:id', async (req: Request, res: Response): Promise<any> => {
  try {
    const postId = req.params.id as string;
    const post = await prisma.forumPost.findUnique({
      where: { id: postId },
      include: { 
        author: { select: { id: true, name: true, image: true} }, 
        community: true 
      }
    });

    if (!post) return res.status(404).json({ error: "Post not found" });
    
    res.status(200).json(post);
  } catch (error) {
    res.status(500).json({ error: "Error fetching post details" });
  }
});

// ==========================================
// 📊 API 10: Get all statistics data for Sidebar
// ==========================================
router.get('/api/forum/sidebar-stats', async (req: Request, res: Response): Promise<any> => {
  try {
    // 1. Top 5 communities with the most posts
    const topCommunities = await prisma.community.findMany({
      take: 5,
      orderBy: { posts: { _count: 'desc' } },
      select: {
        id: true,
        name: true,
        _count: { select: { posts: true } }
      }
    });

    // 2. Top 5 Users who post, comment, and vote the most
    const topPosters = await prisma.user.findMany({
      take: 5,
      orderBy: { forumPosts: { _count: 'desc' } },
      select: { id: true, name: true, image: true, _count: { select: { forumPosts: true } } }
    });

    const topCommenters = await prisma.user.findMany({
      take: 5,
      orderBy: { forumComments: { _count: 'desc' } },
      select: { id: true, name: true, image: true, _count: { select: { forumComments: true } } }
    });

    const topVoters = await prisma.user.findMany({
      take: 5,
      orderBy: { forumVotes: { _count: 'desc' } },
      select: { id: true, name: true, image: true, _count: { select: { forumVotes: true } } }
    });

    // 3. Top 5 Hot Posts (Based on Upvote Count)
    const hotPosts = await prisma.forumPost.findMany({
      take: 5,
      orderBy: { upvoteCount: 'desc' },
      select: {
        id: true,
        title: true,
        upvoteCount: true,
        _count: { select: { forumComments: true } }
      }
    });

    res.status(200).json({
      topCommunities,
      topUsers: { posters: topPosters, commenters: topCommenters, voters: topVoters },
      hotPosts
    });
  } catch (error) {
    console.error("SIDEBAR STATS ERROR:", error);
    res.status(500).json({ error: "Error fetching sidebar statistics" });
  }
});

export default router;