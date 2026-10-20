import express, { Request, Response } from "express";
import {
  GoogleGenerativeAI,
  SchemaType,
  Tool,
  Part,
} from "@google/generative-ai";
import prisma from "../config/db";

const router = express.Router();

interface VectorMatchItem {
  title: string;
  number: number;
  plotSummary: string | null;
  seriesTitle: string;
  mediaType: string;
  distance: number;
}

router.get(
  "/api/chat/sessions/:userId",
  async (req: Request, res: Response) => {
    try {
      const sessions = await prisma.aiChatSession.findMany({
        where: { userId: req.params.userId as string },
        orderBy: { updatedAt: "desc" },
      });
      res.status(200).json(sessions);
    } catch {
      res.status(500).json({ message: "Error fetching sessions" });
    }
  }
);

router.get(
  "/api/chat/session/:sessionId",
  async (req: Request, res: Response) => {
    try {
      const messages = await prisma.aiChatMessage.findMany({
        where: { sessionId: req.params.sessionId as string },
        orderBy: { createdAt: "asc" },
      });
      res.status(200).json(messages);
    } catch {
      res.status(500).json({ message: "Error fetching messages" });
    }
  }
);

router.post(
  "/api/chat/send",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { userId, sessionId, message, imageBase64, mimeType } = req.body;
      if (!userId || (!message?.trim() && !imageBase64)) {
        res.status(400).json({ message: "Missing data" });
        return;
      }

      const userText =
        message?.trim() ||
        "Please identify which Anime or Manga this image belongs to and who the characters are.";
      let currentSessionId = sessionId as string | undefined;

      if (!currentSessionId) {
        const titlePrefix = imageBase64 ? "📷 [Image] " : "";
        const newSession = await prisma.aiChatSession.create({
          data: {
            userId: userId as string,
            title: (titlePrefix + userText).substring(0, 35) + "...",
          },
        });
        currentSessionId = newSession.id;
      }

      // Lưu tin nhắn của user vào Database
      const savedUserContent = imageBase64
        ? `📷 *[Attached an image]*\n\n${userText}`
        : userText;

      await prisma.aiChatMessage.create({
        data: {
          sessionId: currentSessionId,
          role: "user",
          content: savedUserContent,
        },
      });

      const history = await prisma.aiChatMessage.findMany({
        where: { sessionId: currentSessionId },
        orderBy: { createdAt: "asc" },
      });

      const animes = await prisma.anime.findMany({
        select: { id: true, title: true },
      });
      const mangas = await prisma.manga.findMany({
        select: { id: true, title: true },
      });

      const systemAnimes = animes
        .map((a) => `- [${a.title}](/anime/${a.id})`)
        .join("\n");
      const systemMangas = mangas
        .map((m) => `- [${m.title}](/manga/${m.id})`)
        .join("\n");

      const genAI = new GoogleGenerativeAI(
        process.env.GEMINI_API_KEY as string
      );

      // =====================================================================
      // 🌟 1. KHAI BÁO TOOLS CHO AI (Dùng mô tả song ngữ trung lập)
      // =====================================================================
      const tools: Tool[] = [
        {
          functionDeclarations: [
            {
              name: "findCharacterAppearances",
              description:
                "Find the list of Anime episodes and Manga chapters where a specific character appears.",
              parameters: {
                type: SchemaType.OBJECT,
                properties: {
                  characterName: {
                    type: SchemaType.STRING,
                    description:
                      "Name of the character to search for (e.g., Gojo, Yuji Itadori, Naruto).",
                  },
                  mediaType: {
                    type: SchemaType.STRING,
                    description:
                      "Return 'anime' if the user asks about episodes/anime. Return 'manga' if the user asks about chapters/manga. Return 'both' if unspecified.",
                  },
                },
                required: ["characterName", "mediaType"],
              },
            },
            {
              name: "searchStoryByPlot",
              description:
                "Search for Anime episodes or Manga chapters based on plot, events, or battles.",
              parameters: {
                type: SchemaType.OBJECT,
                properties: {
                  searchQuery: {
                    type: SchemaType.STRING,
                    description:
                      "REQUIRED: Translate the core meaning of the user's query into English (e.g., 'Yuji meets Nobara for the first time').",
                  },
                  mediaType: {
                    type: SchemaType.STRING,
                    description:
                      "Return 'anime' if the user asks about episodes/anime. Return 'manga' if the user asks about chapters/manga. Return 'both' if unspecified.",
                  },
                },
                required: ["searchQuery", "mediaType"],
              },
            },
          ],
        },
      ];

      // =====================================================================
      // 🌟 2. SYSTEM INSTRUCTION CHUẨN HÓA ĐA NGÔN NGỮ
      // =====================================================================
      const systemInstruction = `
        You are a highly intelligent Otaku/Anime assistant for the "Smart Anime Platform".
        Your primary task is to recommend, discuss, and analyze Anime and Manga based on user preferences or uploaded images.

        HERE IS THE SYSTEM'S CURRENT DATABASE:
        [AVAILABLE ANIME]
        ${systemAnimes || "No anime available"}

        [AVAILABLE MANGA]
        ${systemMangas || "No manga available"}

        CRITICAL RULES YOU MUST FOLLOW:
        1. STRICT LANGUAGE MATCHING (HIGHEST PRIORITY):
          - Detect the language of the user's LATEST message in the chat and respond 100% in that EXACT SAME LANGUAGE.
        2. EXACT MARKDOWN LINKS:
          - If you recommend or identify a series from the lists above, you MUST use the EXACT markdown link provided.
          - English Example: "You can watch [Jujutsu Kaisen](/anime/12345) right now!"
          - Vietnamese Example: "Cậu có thể xem [Jujutsu Kaisen](/anime/12345) ngay nhé!"
        3. If you recommend or identify a series that IS NOT in the list, explicitly inform the user (in their language) that it is not available in the system yet and suggest external legal platforms.
        4. NEVER translate Anime/Manga titles into Vietnamese.
        5. Your tone should be enthusiastic, friendly, and relatable to the anime community (use emojis). Use bullet points for readability.

        --- TOOL USAGE & RAG CONSTRAINTS ---
        6. CHARACTER SEARCH: If the user asks which episodes/chapters a specific character appears in, you MUST use the "findCharacterAppearances" tool.
        7. PLOT/BATTLE SEARCH: If the user asks about specific events, plots, or battles, you MUST use the "searchStoryByPlot" tool.
          - DEPENDENCY RULE A: If the tool returns text starting with "SYSTEM_DATA:", you MUST base your answer ENTIRELY and STRICTLY on the provided data (translated into the user's language). Do not invent episodes/chapters.
          - DEPENDENCY RULE B: If the tool returns "NO_DATA_FOUND", you are ALLOWED to answer using your internal knowledge. HOWEVER, you MUST explicitly append a disclaimer at the very end of your response in the user's language:
            * If responding in Vietnamese: "⚠️ Lưu ý: Thông tin này được lấy từ nguồn bên ngoài, hiện chưa có trong cơ sở dữ liệu của hệ thống và chưa được kiểm chứng."
            * If responding in English: "⚠️ Note: This information is retrieved from external knowledge, is not currently in the system database, and has not been verified."
        8. IMAGE RECOGNITION: If the user attaches an image, analyze the character appearance, art style, dialogue text, or scene carefully:
          - State the exact Anime/Manga title, character names, and context of the scene/page in the user's language.
          - Match the identified series with [AVAILABLE ANIME] and [AVAILABLE MANGA] above and provide the direct clickable Markdown link if available in the system.
        `;

      // 🌟 Truyền systemInstruction vào đúng thuộc tính chuẩn của Gemini SDK
      const aiModel = genAI.getGenerativeModel({
        model: "gemini-2.5-flash",
        systemInstruction,
        tools,
      });

      // Không chèn câu trả lời tiếng Việt giả định vào đầu history nữa
      const chat = aiModel.startChat({
        history: history.slice(0, -1).map((msg) => ({
          role: msg.role === "user" ? "user" : "model",
          parts: [{ text: msg.content }],
        })),
      });

      // =====================================================================
      // 🌟 3. ĐÓNG GÓI PAYLOAD (TEXT + IMAGE NẾU CÓ) GỬI CHO GEMINI
      // =====================================================================
      const messageParts: Part[] = [
        {
          text: `${userText}\n\n[System Reminder: Please respond strictly in the same language as the user's message above.]`,
        },
      ];

      if (imageBase64 && mimeType) {
        const cleanBase64 = (imageBase64 as string).replace(
          /^data:image\/\w+;base64,/,
          ""
        );
        messageParts.push({
          inlineData: {
            data: cleanBase64,
            mimeType: mimeType as string,
          },
        });
      }

      let aiResult = await chat.sendMessage(messageParts);
      const call = aiResult.response.functionCalls()?.[0];

      // 🟢 XỬ LÝ: TÌM KIẾM NHÂN VẬT
      if (call && call.name === "findCharacterAppearances") {
        const args = call.args as {
          characterName?: string;
          mediaType?: string;
        };
        const charName = args.characterName || "";
        const mediaType = args.mediaType || "both";

        const safeCharName = charName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const regex = new RegExp(`\\b${safeCharName}\\b`, "i");

        const combinedResults: string[] = [];

        if (mediaType === "anime" || mediaType === "both") {
          const allEpisodes = await prisma.episode.findMany({
            select: {
              episodeNumber: true,
              title: true,
              characters: true,
              anime: { select: { title: true } },
            },
            orderBy: { episodeNumber: "asc" },
          });
          const matchedEps = allEpisodes.filter((ep) =>
            ep.characters.some((c) => regex.test(c))
          );
          combinedResults.push(
            ...matchedEps.map(
              (ep) =>
                `- [Anime] ${ep.anime.title} | Episode ${ep.episodeNumber}: ${ep.title}`
            )
          );
        }

        if (mediaType === "manga" || mediaType === "both") {
          const allChapters = await prisma.chapter.findMany({
            select: {
              chapterNumber: true,
              title: true,
              characters: true,
              manga: { select: { title: true } },
            },
            orderBy: { chapterNumber: "asc" },
          });
          const matchedChaps = allChapters.filter((chap) =>
            chap.characters.some((c) => regex.test(c))
          );
          combinedResults.push(
            ...matchedChaps.map(
              (chap) => `- [Manga] ${chap.manga.title} | ${chap.title}`
            )
          );
        }

        const dbResultStr =
          combinedResults.length > 0
            ? combinedResults.join("\n")
            : "NO_MATCHING_RECORDS_IN_DATABASE";

        aiResult = await chat.sendMessage([
          {
            functionResponse: {
              name: "findCharacterAppearances",
              response: { result: dbResultStr },
            },
          },
        ]);
      }

      // 🟢 XỬ LÝ: TÌM KIẾM CỐT TRUYỆN BẰNG VECTOR RAG
      else if (call && call.name === "searchStoryByPlot") {
        const args = call.args as {
          searchQuery?: string;
          mediaType?: string;
        };
        const searchQuery = args.searchQuery || "";
        const mediaType = args.mediaType || "both";

        try {
          const embedModel = genAI.getGenerativeModel({
            model: "gemini-embedding-001",
          });
          const embedResult = await embedModel.embedContent(searchQuery);
          const queryVector = embedResult.embedding.values;
          const vectorStr = `[${queryVector.join(",")}]`;

          const matchedData: VectorMatchItem[] = [];

          if (mediaType === "anime" || mediaType === "both") {
            const matchedEpisodes = await prisma.$queryRawUnsafe<
              VectorMatchItem[]
            >(`
              SELECT e."title", e."episodeNumber" AS "number", e."plotSummary", a."title" AS "seriesTitle", 'Anime' AS "mediaType", e.embedding <=> '${vectorStr}'::vector AS distance
              FROM "Episode" e JOIN "Anime" a ON e."animeId" = a.id
              WHERE e.embedding IS NOT NULL ORDER BY distance ASC LIMIT 3
            `);
            matchedData.push(...matchedEpisodes);
          }

          if (mediaType === "manga" || mediaType === "both") {
            const matchedChapters = await prisma.$queryRawUnsafe<
              VectorMatchItem[]
            >(`
              SELECT c."title", c."chapterNumber" AS "number", c."plotSummary", m."title" AS "seriesTitle", 'Manga' AS "mediaType", c.embedding <=> '${vectorStr}'::vector AS distance
              FROM "Chapter" c JOIN "Manga" m ON c."mangaId" = m.id
              WHERE c.embedding IS NOT NULL ORDER BY distance ASC LIMIT 3
            `);
            matchedData.push(...matchedChapters);
          }

          const validMatches = matchedData
            .filter((item) => item.distance < 0.7)
            .sort((a, b) => a.distance - b.distance)
            .slice(0, 3);

          const dbResultStr =
            validMatches.length > 0
              ? "SYSTEM_DATA:\n" +
                validMatches
                  .map(
                    (item) =>
                      `- [${item.mediaType}] ${item.seriesTitle} | #${item.number}: ${item.title}\n  Plot Summary: ${item.plotSummary}`
                  )
                  .join("\n\n")
              : "NO_DATA_FOUND";

          aiResult = await chat.sendMessage([
            {
              functionResponse: {
                name: "searchStoryByPlot",
                response: { result: dbResultStr },
              },
            },
          ]);
        } catch (vectorError) {
          console.error("Lỗi Vector Search:", vectorError);
          aiResult = await chat.sendMessage([
            {
              functionResponse: {
                name: "searchStoryByPlot",
                response: { result: "NO_DATA_FOUND" },
              },
            },
          ]);
        }
      }

      const responseText = aiResult.response.text();

      // Update lại thời gian updatedAt của Session
      await prisma.aiChatSession
        .update({
          where: { id: currentSessionId },
          data: { updatedAt: new Date() },
        })
        .catch(() => {});

      const savedAiMessage = await prisma.aiChatMessage.create({
        data: {
          sessionId: currentSessionId,
          role: "model",
          content: responseText,
        },
      });

      res.status(200).json({
        sessionId: currentSessionId,
        reply: savedAiMessage,
      });
    } catch (error) {
      console.error("Chat API Error:", error);
      res.status(500).json({ message: "Lỗi kết nối AI" });
    }
  }
);

export default router;