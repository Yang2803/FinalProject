import express, { Request, Response } from 'express';
// 🌟 1. CẬP NHẬT IMPORT: Lấy thêm FunctionDeclarationSchemaType từ SDK
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import prisma from '../config/db'; 

const router = express.Router();

// 1. API Lấy danh sách các Phiên chat
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
          title: message.substring(0, 30) + "..." 
        }
      });
      currentSessionId = newSession.id;
    }

    // B. LƯU TIN NHẮN CỦA USER VÀO DB
    await prisma.aiChatMessage.create({
      data: { sessionId: currentSessionId, role: "user", content: message }
    });

    // C. LẤY LỊCH SỬ CHAT TỪ DB ĐỂ TRUYỀN CHO AI
    const history = await prisma.aiChatMessage.findMany({
      where: { sessionId: currentSessionId },
      orderBy: { createdAt: 'asc' }
    });

    // D. CHUẨN BỊ DỮ LIỆU BỐI CẢNH 
    const animes = await prisma.anime.findMany({ select: { id: true, title: true } });
    const mangas = await prisma.manga.findMany({ select: { id: true, title: true } });
    
    const systemAnimes = animes.map(a => `- [${a.title}](/anime/${a.id})`).join("\n");
    const systemMangas = mangas.map(m => `- [${m.title}](/manga/${m.id})`).join("\n");

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);

    // =====================================================================
    // 🌟 2. KHAI BÁO TOOL (VŨ KHÍ MỚI CHO GEMINI)
    // =====================================================================
    const tools: any = [{
      functionDeclarations: [{
        name: "findEpisodesByCharacter",
        description: "Dùng để tìm danh sách các tập phim mà một nhân vật anime cụ thể xuất hiện.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            characterName: {
              type: SchemaType.STRING,
              description: "Tên nhân vật cần tìm. Ví dụ: Gojo, Yuji Itadori, Naruto"
            }
          },
          required: ["characterName"]
        }
      },
    
    {
          name: "searchEpisodeByPlot",
          description: "Tìm kiếm thông tin tập phim dựa trên cốt truyện, sự kiện hoặc trận chiến mà User hỏi.",
          parameters: {
            type: SchemaType.OBJECT,
            properties: {
              searchQuery: {
                type: SchemaType.STRING,
                description: "BẮT BUỘC: Dịch ý chính của câu hỏi sang Tiếng Anh và chuyển thành câu khẳng định. Ví dụ: User hỏi 'Yuji lần đầu gặp Nobara ở đâu?', bạn phải trả về 'Yuji meets Nobara for the first time'. User hỏi 'Yuta chiến đấu với Uro', trả về 'Yuta fights Uro'."
              }
            },
            required: ["searchQuery"]
          }
        }]
    }];

    // Gắn Tool vào cấu hình của AI Model
    const aiModel = genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash",
      tools: tools 
    });

    const systemInstruction = `
      You are a highly intelligent Otaku/Anime assistant for the "Smart Anime Platform".
      Your primary task is to recommend, discuss, and analyze Anime and Manga based on user preferences.

      HERE IS THE SYSTEM'S CURRENT DATABASE:
      [AVAILABLE ANIME]
      ${systemAnimes || "No anime available"}

      [AVAILABLE MANGA]
      ${systemMangas || "No manga available"}

      CRITICAL RULES YOU MUST FOLLOW:
      1. If you recommend a series from the lists above, you MUST use the EXACT markdown link provided. 
         - Correct Example: "Cậu có thể xem [Jujutsu Kaisen](/anime/12345) ngay nhé!"
      2. If you recommend a series that IS NOT in the list, explicitly inform the user that it's not available in the system and suggest external legal platforms.
      3. NEVER translate Anime/Manga titles into Vietnamese.
      4. Your tone should be enthusiastic, friendly, and relatable to the anime community (use emojis). Use bullet points for readability.
      5. DYNAMIC LANGUAGE BEHAVIOR: Detect the language used by the user and respond in that EXACT SAME LANGUAGE.
      --- TOOL USAGE & RAG CONSTRAINTS ---
      6. CHARACTER SEARCH: If the user asks which episodes a specific character appears in, you MUST use the "findEpisodesByCharacter" tool.
      7. PLOT/BATTLE SEARCH: If the user asks about specific events, plots, or battles (e.g., "Yuta vs Uro"), you MUST use the "searchEpisodeByPlot" tool.
         - DEPENDENCY RULE A: If the tool returns text starting with "SYSTEM_DATA:", you MUST base your answer ENTIRELY and STRICTLY on the provided data. Do not invent episodes.
         - DEPENDENCY RULE B: If the tool returns "NO_DATA_FOUND", you are ALLOWED to answer using your internal knowledge. HOWEVER, you MUST explicitly append this EXACT string at the very end of your response:
           "⚠️ Lưu ý: Thông tin này được lấy từ nguồn bên ngoài, hiện chưa có trong cơ sở dữ liệu của hệ thống và chưa được kiểm chứng."
    `;

    // Khởi tạo phiên chat
    const chat = aiModel.startChat({
      history: [
        { role: "user", parts: [{ text: systemInstruction }] },
        { role: "model", parts: [{ text: "Đã hiểu! Tôi sẽ tuân thủ tuyệt đối các quy tắc và sử dụng Tool khi cần thiết." }] },
        ...history.slice(0, -1).map(msg => ({
          role: msg.role === "user" ? "user" : "model",
          parts: [{ text: msg.content }]
        }))
      ]
    });

// =====================================================================
    // 🌟 3. THỰC THI CHUỖI LOGIC HỎI/ĐÁP & TRUY XUẤT DATABASE
    // =====================================================================
    // Gửi tin nhắn lần 1: Đợi xem AI trả lời bình thường hay muốn dùng Tool
    let aiResult = await chat.sendMessage(message);
    let responseText = "";

    // Bắt sóng xem AI có yêu cầu gọi Tool nào không
    const call = aiResult.response.functionCalls()?.[0];

    if (call && call.name === "findEpisodesByCharacter") {
      // --- LOGIC XỬ LÝ TÌM THEO NHÂN VẬT (GIỮ NGUYÊN CỦA CẬU) ---
      const charName = (call.args as any).characterName as string;

      const allEpisodes = await prisma.episode.findMany({
        select: { episodeNumber: true, title: true, characters: true, anime: { select: { title: true } } }
      });

      const safeCharName = charName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`\\b${safeCharName}\\b`, 'i');

      const matchedEps = allEpisodes.filter(ep => 
        ep.characters.some(c => regex.test(c))
      );

      let dbResultStr = "";
      if (matchedEps.length > 0) {
        dbResultStr = matchedEps.map(ep => `- Phim ${ep.anime.title} | Tập ${ep.episodeNumber}: ${ep.title}`).join("\n");
      } else {
        dbResultStr = "Hệ thống không tìm thấy tập phim nào có sự xuất hiện của nhân vật này.";
      }

      aiResult = await chat.sendMessage([{
        functionResponse: {
          name: "findEpisodesByCharacter",
          response: { result: dbResultStr }
        }
      }]);

    } 
    // 🌟 KHỐI LỆNH MỚI: XỬ LÝ VECTOR SEARCH CHO TÌM KIẾM CỐT TRUYỆN
    else if (call && call.name === "searchEpisodeByPlot") {
      const searchQuery = (call.args as any).searchQuery as string;
      
      try {
        // Bước 1: Gọi model Embedding để biến câu hỏi của User thành Tọa độ Vector
        const embedModel = genAI.getGenerativeModel({ model: "gemini-embedding-001" });
        const embedResult = await embedModel.embedContent(searchQuery);
        const queryVector = embedResult.embedding.values;
        const vectorStr = `[${queryVector.join(',')}]`;

        // Bước 2: Dùng lệnh SQL thuần (Raw SQL) để tính khoảng cách Cosine (<=>) 
        // Giới hạn lấy 3 tập phim có nội dung sát nghĩa nhất và khoảng cách < 0.6
        const matchedEpisodes = await prisma.$queryRawUnsafe<any[]>(`
          SELECT 
            "id", 
            "title", 
            "episodeNumber", 
            "plotSummary",
            "animeId",
            embedding <=> '${vectorStr}'::vector AS distance
          FROM "Episode"
          WHERE embedding IS NOT NULL
          ORDER BY distance ASC
          LIMIT 3
        `);

        // Bước 3: Lọc các kết quả đủ độ chính xác (Ví dụ: distance < 0.6 là khá chuẩn)
        const validMatches = matchedEpisodes.filter(ep => ep.distance < 0.7);

        let dbResultStr = "";
        
        if (validMatches.length > 0) {
          // Trả về kèm tiền tố SYSTEM_DATA: để AI tuân thủ Luật A
          dbResultStr = "SYSTEM_DATA:\n" + validMatches.map(ep => 
            `- Tập ${ep.episodeNumber}: ${ep.title}\n  Nội dung tóm tắt: ${ep.plotSummary}`
          ).join("\n\n");
        } else {
          // Trả về cờ NO_DATA_FOUND để AI kích hoạt Luật B (Báo cáo nguồn ngoài)
          dbResultStr = "NO_DATA_FOUND";
        }

        // Bước 4: Trả dữ liệu Database lại cho AI xào nấu
        aiResult = await chat.sendMessage([{
          functionResponse: {
            name: "searchEpisodeByPlot",
            response: { result: dbResultStr }
          }
        }]);

      } catch (vectorError) {
        console.error("Lỗi Vector Search:", vectorError);
        // Fallback: Lỗi kết nối hoặc AI hết hạn thì cứ báo là không có data để web không sập
        aiResult = await chat.sendMessage([{
          functionResponse: {
            name: "searchEpisodeByPlot",
            response: { result: "NO_DATA_FOUND" }
          }
        }]);
      }
    }

    // Chốt sổ: Lấy text cuối cùng từ AI (dù có xài Tool hay không)
    responseText = aiResult.response.text();

    // =====================================================================

    // Lưu kết quả vào DB
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