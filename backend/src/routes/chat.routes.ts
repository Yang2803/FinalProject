import express, { Request, Response } from 'express';
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import prisma from '../config/db'; 

const router = express.Router();

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

router.post('/api/chat/send', async (req: Request, res: Response): Promise<any> => {
  try {
    // 🌟 Nhận thêm imageBase64 và mimeType từ Frontend
    const { userId, sessionId, message, imageBase64, mimeType } = req.body;
    if (!userId || (!message?.trim() && !imageBase64)) {
      return res.status(400).json({ message: "Missing data" });
    }

    const userText = message?.trim() || "Hãy cho tôi biết bức ảnh này thuộc bộ Anime hay Manga nào, tên nhân vật là gì?";
    let currentSessionId = sessionId;

    if (!currentSessionId) {
      const titlePrefix = imageBase64 ? "📷 [Tìm bằng ảnh] " : "";
      const newSession = await prisma.aiChatSession.create({
        data: {
          userId: userId,
          title: (titlePrefix + userText).substring(0, 35) + "..." 
        }
      });
      currentSessionId = newSession.id;
    }

    // Lưu tin nhắn của user vào Database
    const savedUserContent = imageBase64 
      ? `📷 *[Đã đính kèm một hình ảnh]*\n\n${userText}` 
      : userText;

    await prisma.aiChatMessage.create({
      data: { sessionId: currentSessionId, role: "user", content: savedUserContent }
    });

    const history = await prisma.aiChatMessage.findMany({
      where: { sessionId: currentSessionId },
      orderBy: { createdAt: 'asc' }
    });

    const animes = await prisma.anime.findMany({ select: { id: true, title: true } });
    const mangas = await prisma.manga.findMany({ select: { id: true, title: true } });
    
    const systemAnimes = animes.map(a => `- [${a.title}](/anime/${a.id})`).join("\n");
    const systemMangas = mangas.map(m => `- [${m.title}](/manga/${m.id})`).join("\n");

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);

    // =====================================================================
    // 🌟 1. KHAI BÁO TOOLS CHO AI
    // =====================================================================
    const tools: any = [{
      functionDeclarations: [{
        name: "findCharacterAppearances",
        description: "Tìm danh sách các tập phim (Anime) và chương truyện (Manga) mà nhân vật xuất hiện.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            characterName: {
              type: SchemaType.STRING,
              description: "Tên nhân vật cần tìm. Ví dụ: Gojo, Yuji Itadori, Naruto"
            },
            mediaType: {
              type: SchemaType.STRING,
              description: "PHÂN LOẠI YÊU CẦU: Trả về 'anime' nếu câu hỏi có chữ (tập, phim, anime). Trả về 'manga' nếu có chữ (chapter, chương, truyện, manga). Trả về 'both' nếu không nói rõ."
            }
          },
          required: ["characterName", "mediaType"]
        }
      },
      {
        name: "searchStoryByPlot",
        description: "Tìm kiếm thông tin tập phim hoặc chương truyện dựa trên cốt truyện, sự kiện.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            searchQuery: {
              type: SchemaType.STRING,
              description: "BẮT BUỘC: Dịch ý chính của câu hỏi sang Tiếng Anh. Ví dụ: 'Yuji lần đầu gặp Nobara ở đâu?' -> 'Yuji meets Nobara for the first time'."
            },
            mediaType: {
              type: SchemaType.STRING,
              description: "PHÂN LOẠI YÊU CẦU: Trả về 'anime' nếu câu hỏi có chữ (tập, phim, anime). Trả về 'manga' nếu có chữ (chapter, chương, truyện, manga). Trả về 'both' nếu không nói rõ."
            }
          },
          required: ["searchQuery", "mediaType"]
        }
      }]
    }];

    const aiModel = genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash",
      tools: tools 
    });

    const systemInstruction = `
      You are a highly intelligent Otaku/Anime assistant for the "Smart Anime Platform".
      Your primary task is to recommend, discuss, and analyze Anime and Manga based on user preferences or uploaded images.

      HERE IS THE SYSTEM'S CURRENT DATABASE:
      [AVAILABLE ANIME]
      ${systemAnimes || "No anime available"}

      [AVAILABLE MANGA]
      ${systemMangas || "No manga available"}

      CRITICAL RULES YOU MUST FOLLOW:
      1. If you recommend or identify a series from the lists above, you MUST use the EXACT markdown link provided. 
         - Correct Example: "Cậu có thể xem [Jujutsu Kaisen](/anime/12345) ngay nhé!"
      2. If you recommend or identify a series that IS NOT in the list, explicitly inform the user that it's not available in the system and suggest external legal platforms.
      3. NEVER translate Anime/Manga titles into Vietnamese.
      4. Your tone should be enthusiastic, friendly, and relatable to the anime community (use emojis). Use bullet points for readability.
      5. DYNAMIC LANGUAGE BEHAVIOR: Detect the language used by the user and respond in that EXACT SAME LANGUAGE.
      --- TOOL USAGE & RAG CONSTRAINTS ---
      6. CHARACTER SEARCH: If the user asks which episodes/chapters a specific character appears in, you MUST use the "findCharacterAppearances" tool.
      7. PLOT/BATTLE SEARCH: If the user asks about specific events, plots, or battles, you MUST use the "searchStoryByPlot" tool.
         - DEPENDENCY RULE A: If the tool returns text starting with "SYSTEM_DATA:", you MUST base your answer ENTIRELY and STRICTLY on the provided data. Do not invent episodes/chapters.
         - DEPENDENCY RULE B: If the tool returns "NO_DATA_FOUND", you are ALLOWED to answer using your internal knowledge. HOWEVER, you MUST explicitly append this EXACT string at the very end of your response:
           "⚠️ Lưu ý: Thông tin này được lấy từ nguồn bên ngoài, hiện chưa có trong cơ sở dữ liệu của hệ thống và chưa được kiểm chứng."
      8. IMAGE RECOGNITION: If the user attaches an image, analyze the character appearance, art style, dialogue text, or scene carefully:
         - State the exact Anime/Manga title, character names, and context of the scene/page.
         - Match the identified series with [AVAILABLE ANIME] and [AVAILABLE MANGA] above and provide the direct clickable Markdown link if available in the system.
    `;

    const chat = aiModel.startChat({
      history: [
        { role: "user", parts: [{ text: systemInstruction }] },
        { role: "model", parts: [{ text: "Đã hiểu! Tôi sẽ tuân thủ tuyệt đối các quy tắc, nhận diện hình ảnh chuẩn xác và sử dụng Tool khi cần thiết." }] },
        ...history.slice(0, -1).map(msg => ({
          role: msg.role === "user" ? "user" : "model",
          parts: [{ text: msg.content }]
        }))
      ]
    });

    // =====================================================================
    // 🌟 2. ĐÓNG GÓI PAYLOAD (TEXT + IMAGE NẾU CÓ) GỬI CHO GEMINI
    // =====================================================================
    const messageParts: any[] = [{ text: userText }];

    if (imageBase64 && mimeType) {
      const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, "");
      messageParts.push({
        inlineData: {
          data: cleanBase64,
          mimeType: mimeType
        }
      });
    }

    let aiResult = await chat.sendMessage(messageParts);
    let responseText = "";
    const call = aiResult.response.functionCalls()?.[0];

    // 🟢 XỬ LÝ: TÌM KIẾM NHÂN VẬT
    if (call && call.name === "findCharacterAppearances") {
      const charName = (call.args as any).characterName as string;
      const mediaType = (call.args as any).mediaType as string; 
      
      const safeCharName = charName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`\\b${safeCharName}\\b`, 'i');

      let combinedResults: string[] = [];

      if (mediaType === 'anime' || mediaType === 'both') {
        const allEpisodes = await prisma.episode.findMany({
          select: { episodeNumber: true, title: true, characters: true, anime: { select: { title: true } } },
          orderBy: { episodeNumber: 'asc' }
        });
        const matchedEps = allEpisodes.filter(ep => ep.characters.some(c => regex.test(c)));
        combinedResults.push(...matchedEps.map(ep => `- [Anime] ${ep.anime.title} | Tập ${ep.episodeNumber}: ${ep.title}`));
      }

      if (mediaType === 'manga' || mediaType === 'both') {
        const allChapters = await prisma.chapter.findMany({
          select: { chapterNumber: true, title: true, characters: true, manga: { select: { title: true } } },
          orderBy: { chapterNumber: 'asc' }
        });
        const matchedChaps = allChapters.filter(chap => chap.characters.some(c => regex.test(c)));
        combinedResults.push(...matchedChaps.map(chap => `- [Manga] ${chap.manga.title} | ${chap.title}`));
      }

      const dbResultStr = combinedResults.length > 0 
        ? combinedResults.join("\n") 
        : "Hệ thống không tìm thấy kết quả phù hợp.";

      aiResult = await chat.sendMessage([{
        functionResponse: { name: "findCharacterAppearances", response: { result: dbResultStr } }
      }]);
    }
    
    // 🟢 XỬ LÝ: TÌM KIẾM CỐT TRUYỆN BẰNG VECTOR RAG
    else if (call && call.name === "searchStoryByPlot") {
      const searchQuery = (call.args as any).searchQuery as string;
      const mediaType = (call.args as any).mediaType as string;
      
      try {
        const embedModel = genAI.getGenerativeModel({ model: "gemini-embedding-001" });
        const embedResult = await embedModel.embedContent(searchQuery);
        const queryVector = embedResult.embedding.values;
        const vectorStr = `[${queryVector.join(',')}]`;

        let matchedData: any[] = [];

        if (mediaType === 'anime' || mediaType === 'both') {
          const matchedEpisodes = await prisma.$queryRawUnsafe<any[]>(`
            SELECT e."title", e."episodeNumber" AS "number", e."plotSummary", a."title" AS "seriesTitle", 'Anime' AS "mediaType", e.embedding <=> '${vectorStr}'::vector AS distance
            FROM "Episode" e JOIN "Anime" a ON e."animeId" = a.id
            WHERE e.embedding IS NOT NULL ORDER BY distance ASC LIMIT 3
          `);
          matchedData.push(...matchedEpisodes);
        }

        if (mediaType === 'manga' || mediaType === 'both') {
          const matchedChapters = await prisma.$queryRawUnsafe<any[]>(`
            SELECT c."title", c."chapterNumber" AS "number", c."plotSummary", m."title" AS "seriesTitle", 'Manga' AS "mediaType", c.embedding <=> '${vectorStr}'::vector AS distance
            FROM "Chapter" c JOIN "Manga" m ON c."mangaId" = m.id
            WHERE c.embedding IS NOT NULL ORDER BY distance ASC LIMIT 3
          `);
          matchedData.push(...matchedChapters);
        }

        const validMatches = matchedData
          .filter(item => item.distance < 0.7)
          .sort((a, b) => a.distance - b.distance)
          .slice(0, 3);

        const dbResultStr = validMatches.length > 0 
          ? "SYSTEM_DATA:\n" + validMatches.map(item => `- [${item.mediaType}] ${item.seriesTitle} | Số ${item.number}: ${item.title}\n  Nội dung tóm tắt: ${item.plotSummary}`).join("\n\n")
          : "NO_DATA_FOUND";

        aiResult = await chat.sendMessage([{
          functionResponse: { name: "searchStoryByPlot", response: { result: dbResultStr } }
        }]);

      } catch (vectorError) {
        console.error("Lỗi Vector Search:", vectorError);
        aiResult = await chat.sendMessage([{
          functionResponse: { name: "searchStoryByPlot", response: { result: "NO_DATA_FOUND" } }
        }]);
      }
    }

    responseText = aiResult.response.text();

    // Update lại thời gian updatedAt của Session
    await prisma.aiChatSession.update({
      where: { id: currentSessionId },
      data: { updatedAt: new Date() }
    }).catch(() => {});

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