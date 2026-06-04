import express, { Request, Response } from 'express';
import { GoogleGenerativeAI } from "@google/generative-ai";
import prisma from '../config/db'; // Đường dẫn tới file Prisma của bạn

const router = express.Router();

// 1. API Lấy danh sách các Phiên chat của 1 User (Dùng cho Sidebar)
router.get('/api/chat/sessions/:userId', async (req: Request, res: Response) => {
  try {
    const sessions = await prisma.aiChatSession.findMany({
      where: { userId: req.params.userId as string },
      orderBy: { updatedAt: 'desc' }
    });
    res.status(200).json(sessions);
  } catch (error) {
    res.status(500).json({ message: "Error fetching sessions" });
  }
});

// 2. API Lấy chi tiết các tin nhắn trong 1 Phiên chat
router.get('/api/chat/session/:sessionId', async (req: Request, res: Response) => {
  try {
    const messages = await prisma.aiChatMessage.findMany({
      where: { sessionId: req.params.sessionId as string },
      orderBy: { createdAt: 'asc' }
    });
    res.status(200).json(messages);
  } catch (error) {
    res.status(500).json({ message: "Error fetching messages" });
  }
});

// 3. API Chính: Gửi tin nhắn, Gọi Gemini, và Lưu Database
router.post('/api/chat/send', async (req: Request, res: Response): Promise<any> => {
  try {
    const { userId, sessionId, message } = req.body;
    if (!userId || !message) return res.status(400).json({ message: "Missing data" });

    let currentSessionId = sessionId;

    // A. NẾU LÀ CHAT MỚI -> TẠO SESSION TRƯỚC
    if (!currentSessionId) {
      const newSession = await prisma.aiChatSession.create({
        data: {
          userId: userId,
          title: message.substring(0, 30) + "..." // Lấy 30 chữ đầu làm tên Session
        }
      });
      currentSessionId = newSession.id;
    }

    // B. LƯU TIN NHẮN CỦA USER VÀO DB
    await prisma.aiChatMessage.create({
      data: { sessionId: currentSessionId, role: "user", content: message }
    });

    // C. LẤY LỊCH SỬ CHAT TỪ DB ĐỂ TRUYỀN CHO AI (Giúp AI có trí nhớ)
    const history = await prisma.aiChatMessage.findMany({
      where: { sessionId: currentSessionId },
      orderBy: { createdAt: 'asc' }
    });

    // D. CHUẨN BỊ DỮ LIỆU BỐI CẢNH TỪ HỆ THỐNG (Ghép sẵn thành chuẩn Markdown)
    const animes = await prisma.anime.findMany({ select: { id: true, title: true } });
    const mangas = await prisma.manga.findMany({ select: { id: true, title: true } });
    
    // Đã thay đổi: Ghép sẵn thành định dạng [Tên Phim](/anime/id)
    const systemAnimes = animes.map(a => `- [${a.title}](/anime/${a.id})`).join("\n");
    const systemMangas = mangas.map(m => `- [${m.title}](/manga/${m.id})`).join("\n");

    // E. GỌI GEMINI (VỚI PROMPT TIẾNG ANH ĐÃ ĐƯỢC NÂNG CẤP)
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);
    const aiModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const systemInstruction = `
      You are a highly intelligent Otaku/Anime assistant for the "Smart Anime Platform".
      Your primary task is to recommend, discuss, and analyze Anime and Manga based on user preferences.

      HERE IS THE SYSTEM'S CURRENT DATABASE (Pre-formatted as Markdown Links):
      [AVAILABLE ANIME]
      ${systemAnimes || "No anime available"}

      [AVAILABLE MANGA]
      ${systemMangas || "No manga available"}

      CRITICAL RULES YOU MUST FOLLOW:
      1. If you recommend a series from the lists above, you MUST use the EXACT markdown link provided in the list. 
         - DO NOT modify the URL inside the parentheses.
         - DO NOT translate the text inside the parentheses. 
         - DO NOT output raw text like "(Link: /anime/...)". ONLY output the hidden markdown link.
         - Correct Example: "Cậu có thể xem [Jujutsu Kaisen](/anime/12345) ngay nhé!"
      2. If you recommend a series that IS NOT in the list, explicitly inform the user that it's not available in the system (e.g., "Bộ này hiện chưa có trên hệ thống của chúng mình." or "This series is currently not available on our system.") and suggest external legal platforms (Netflix, Crunchyroll, MangaPlus) using standard external HTTP links.
      3. NEVER translate Anime/Manga titles into Vietnamese (e.g., keep "One Piece", absolutely do not write "Một Mảnh").
      4. Your tone should be enthusiastic, friendly, and relatable to the anime community (use emojis). Use bullet points for readability.
      5. DYNAMIC LANGUAGE BEHAVIOR: You MUST detect the language used by the user in their prompt and respond in that EXACT SAME LANGUAGE. If the user asks in English, reply entirely in English. If the user asks in Vietnamese, reply entirely in Vietnamese.
    `;


    // Khởi tạo phiên chat với Gemini, truyền System Prompt và Lịch sử cũ
    const chat = aiModel.startChat({
      history: [
        { role: "user", parts: [{ text: systemInstruction }] },
        { role: "model", parts: [{ text: "Đã hiểu! Tôi sẽ tuân thủ tuyệt đối các quy tắc và trả lời bằng Tiếng Việt." }] },
        // Bỏ qua tin nhắn cuối cùng vì đó chính là tin nhắn user vừa gửi
        ...history.slice(0, -1).map(msg => ({
          role: msg.role === "user" ? "user" : "model",
          parts: [{ text: msg.content }]
        }))
      ]
    });

    // F. NHẬN KẾT QUẢ TỪ AI VÀ LƯU VÀO DB
    const aiResult = await chat.sendMessage(message);
    const responseText = aiResult.response.text();

    const savedAiMessage = await prisma.aiChatMessage.create({
      data: { sessionId: currentSessionId, role: "model", content: responseText }
    });

    res.status(200).json({ 
      sessionId: currentSessionId, 
      reply: savedAiMessage 
    });

  } catch (error) {
    console.error("Chat API Error:", error);
    res.status(500).json({ message: "Lỗi kết nối AI" });
  }
});

export default router;