import express, { Request, Response } from 'express';
import prisma from '../config/db';
import { GoogleGenerativeAI } from "@google/generative-ai";


const router = express.Router();

async function generateEmbedding(text: string): Promise<number[]> {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);
  const model = genAI.getGenerativeModel({ model: "gemini-embedding-001" });
  const result = await model.embedContent(text);
  return result.embedding.values;
}

// ================= API ADMIN (MANGA & CHAPTER) =================

// ==========================================
// 🏆 1. API: GET TOP MANGA RANKING
// ==========================================
router.get('/api/manga/top', async (req: Request, res: Response): Promise<any> => {
  try {
    const period = req.query.period as string; // Recieve 'day', 'week', hoặc 'month'
    
    // 1. The start time for the filter.
    const startDate = new Date();
    if (period === 'day') startDate.setDate(startDate.getDate() - 1);
    else if (period === 'week') startDate.setDate(startDate.getDate() - 7);
    else if (period === 'month') startDate.setMonth(startDate.getMonth() - 1);
    else return res.status(400).json({ message: "Invalid period. Please provide day, week, or month." });

    // 2. Group the logs by and count the number of views within that time period.
    const topViews = await prisma.mangaViewLog.groupBy({
      by: ['mangaId'],
      where: { createdAt: { gte: startDate } },
      _count: { mangaId: true },
      orderBy: { _count: { mangaId: 'desc' } },
      take: 10 // Get Top 10
    });

    if (topViews.length === 0) return res.status(200).json([]);

    // 3. Get detailed information on this Top 10 Manga.
    const mangaIds = topViews.map(v => v.mangaId);
    const mangas = await prisma.manga.findMany({
      where: { id: { in: mangaIds } },
      select: { 
        id: true, 
        title: true, 
        coverImage: true, 
        _count: { select: { chapters: true } } 
      }
    });

    // 4. Map the data again in the correct ranking order (because findMany doesn't maintain the order).
    const sortedTopMangas = topViews.map(view => {
      const mangaDetail = mangas.find(m => m.id === view.mangaId);
      return {
        ...mangaDetail,
        periodViews: view._count.mangaId // Add a view number field for the frontend to display.
      };
    }).filter(m => m.id); // Remove any error records (if any).

    res.status(200).json(sortedTopMangas);
  } catch (error) {
    console.error("Error fetching Top Manga:", error);
    res.status(500).json({ message: "Server error when fetching manga ranking." });
  }
});

// ==========================================
// 👁️ 2. API: LOG VIEW (for ranking)
// ==========================================
router.post('/api/manga/:id/view', async (req: Request, res: Response): Promise<any> => {
  try {
    const mangaId = String(req.params.id);

    // Check if the manga exists.
    const manga = await prisma.manga.findUnique({ where: { id: mangaId } });
    if (!manga) return res.status(404).json({ message: "Manga does not exist!" });

    // Create a new view log entry
    await prisma.mangaViewLog.create({
      data: { mangaId: manga.id }
    });

    res.status(200).json({ message: "View logged successfully!" });
  } catch (error) {
    console.error("Error logging manga view:", error);
    res.status(500).json({ message: "Server error when logging view." });
  }
});

//API ADMIN: CRUD MANGA & CHAPTER
//Create new manga (only for Admin to manage manga)
router.post('/api/admin/manga', async (req: Request, res: Response): Promise<any> => {
  try {
    // 1. Receive data sent from the frontend, including the user ID, to check permissions.
    const { title, description, author, coverImage, status, userId, fandomPrefix } = req.body;

    if (!title || !userId) {
      return res.status(400).json({ message: "Missing required information (Title or User ID)!" });
    }

    // 2. Security check: Does this user exist and is they an administrator?
    const user = await prisma.user.findUnique({ where: { id: userId } });
    
    if (!user || user.role !== "ADMIN") {
      return res.status(403).json({ message: "Access denied! Only Admins can perform this action." });
    }

    // 3. If the user is an ADMIN, proceed to save the manga to the database
    const newManga = await prisma.manga.create({
      data: {
        title,
        description,
        author,
        coverImage,
        status,
        fandomPrefix: fandomPrefix || "",
      },
    });

    res.status(201).json({ message: "New manga added successfully!", manga: newManga });
  } catch (error) {
    console.error("Error adding manga:", error);
    res.status(500).json({ message: "Server error while adding manga." });
  }
});

//Get all manga (Admin)
router.get('/api/admin/manga', async (req: Request, res: Response): Promise<any> => {
  try {
    const mangas = await prisma.manga.findMany({
      orderBy: { createdAt: 'desc' }, // Arrange the manga stories at the top.
      include: { _count: { select: { chapters: true } } }
    });
    res.status(200).json(mangas);
  } catch (error) {
    console.error("Error fetching manga list:", error);
    res.status(500).json({ message: "Server error while fetching manga list" });
  }
});

//Get each manga detail (Admin)
router.get('/api/admin/manga/:id', async (req: Request, res: Response): Promise<any> => {
  try {
    const id = req.params.id as string;
    const manga = await prisma.manga.findUnique({
      where: { id },
      include: {
        chapters: {
          orderBy: { createdAt: 'desc' } // Arrange new chapters at the top
        }
      }
    });

    if (!manga) return res.status(404).json({ message: "This series could not be found!" });
    res.status(200).json(manga);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error while fetching manga details." });
  }
});

// API: Get a list of chapters for a manga (for use on the Episode Upload/Edit page)
router.get('/api/admin/manga/:id/chapters', async (req: Request, res: Response): Promise<any> => {
  try {
    const id = req.params.id as string;

    const chapters = await prisma.chapter.findMany({
      where: { mangaId: id },
      select: {
        id: true,
        title: true,
      },
      orderBy: { createdAt: 'asc' }
    });

    res.status(200).json(chapters);
  } catch (error) {
    console.error("Error fetching manga chapters:", error);
    res.status(500).json({ message: "Server error while fetching chapters." });
  }
});

//Update manga information (Admin)
router.put('/api/admin/manga/:id', async (req: Request, res: Response): Promise<any> => {
  try {
    const id = req.params.id as string;
    const { title, author, coverImage, status, description, fandomPrefix } = req.body;

    const updatedManga = await prisma.manga.update({
      where: { id },
      data: { title, author, coverImage, status, description, fandomPrefix }
    });

    res.status(200).json({ message: "Update manga information successfully!", manga: updatedManga });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error while updating manga." });
  }
});

//Delete manga (Admin)
router.delete('/api/admin/manga/:id', async (req: Request, res: Response): Promise<any> => {
  try {
    const id = req.params.id as string;

    // Because the schema is configured with onDelete: Cascade, when a manga is deleted, all chapters belonging to it will be automatically deleted from the database.
    await prisma.manga.delete({ where: { id } });

    res.status(200).json({ message: "New manga deleted successfully!" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error when deleting a story." });
  }
});

//Create new chapter (Admin)
router.post('/api/admin/chapter', async (req: Request, res: Response): Promise<any> => {
  try {
    // 🌟 1. Receive data from FRONTEND
    const { mangaId, title, chapterNumber, characters, plotSummary, images } = req.body;

    if (!mangaId || !title || !images || images.length === 0) {
      return res.status(400).json({ message: "Missing information or no images provided!" });
    }

    // 🌟 2. Process the CHARACTERS string into an array
    let characterArray: string[] = [];
    if (typeof characters === 'string' && characters.trim().length > 0) {
      characterArray = characters.split(",").map(name => name.trim()).filter(name => name.length > 0);
    } else if (Array.isArray(characters)) {
      characterArray = characters;
    }

    // 🌟 3. SAVE TO DATABASE
    const newChapter = await prisma.chapter.create({
      data: {
        mangaId,
        title,
        images,
        chapterNumber: chapterNumber ? Number(chapterNumber) : null,
        characters: characterArray,
        plotSummary: plotSummary || ""
      }
    });

    // ==========================================
    // 🌟 4. AUTOMATICALLY GENERATE EMBEDDING VECTORS AND SAVE THEM TO THE DATABASE
    // ==========================================
    if (plotSummary && plotSummary.trim().length > 0) {
      try {
        const vectorValues = await generateEmbedding(plotSummary);
        const vectorStr = `[${vectorValues.join(',')}]`; 
        
        await prisma.$executeRawUnsafe(
          `UPDATE "Chapter" SET embedding = $1::vector WHERE id = $2`,
          vectorStr,
          newChapter.id
        );
        console.log(`✨ Vector Embedding for the new Chapter has been successfully loaded.`);
      } catch (embedError) {
        console.error("Vector Embedding Loading Error:", embedError);
      }
    }

    // ==========================================
    // 🌟 5. AUTOMATICALLY SEND NOTIFICATIONS TO FOLLOWERS
    // ==========================================
    try {
      const usersInReadingList = await prisma.readingList.findMany({
        where: { mangaId: mangaId }
      });

      if (usersInReadingList.length > 0) {
        const mangaInfo = await prisma.manga.findUnique({
          where: { id: mangaId },
          select: { title: true }
        });

        const mangaTitleStr = mangaInfo?.title || "A series you follow";

        const notificationsToInsert = usersInReadingList.map((item: any) => ({
          userId: item.userId,
          title: "New Chapter is out now! 📚",
          message: `${mangaTitleStr} just updated: ${newChapter.title}`,
          linkUrl: `/manga/${mangaId}/chapter/${newChapter.id}`, 
          isRead: false
        }));

        await prisma.notification.createMany({
          data: notificationsToInsert
        });
        console.log(`✨ Sended notification for ${usersInReadingList.length} users!`);
      }
    } catch (notiError) {
      console.error("Error sending notifications:", notiError);
    }

    res.status(201).json({ message: "New chapter added successfully!", chapter: newChapter });
  } catch (error) {
    console.error("Error adding chapter:", error);
    res.status(500).json({ message: "Server error while saving chapter." });
  }
});

// Get details of a single Chapter (Admin)
router.get('/api/admin/chapter/:id', async (req: Request, res: Response): Promise<any> => {
  try {
    const id = req.params.id as string;
    const chapter = await prisma.chapter.findUnique({ where: { id } });
    if (!chapter) return res.status(404).json({ message: "Chapter not found!" });
    res.status(200).json(chapter);
  } catch (error) {
    res.status(500).json({ message: "Server error while fetching chapter details." });
  }
});

// Edit chapter (Admin)
router.put('/api/admin/chapter/:id', async (req: Request, res: Response): Promise<any> => {
  try {
    const id = req.params.id as string;
    // 🌟 1. Receive new variables from the Frontend.
    const { title, chapterNumber, characters, plotSummary, images } = req.body; 

    if (!title) {
      return res.status(400).json({ message: "Chapter name cannot be empty!" });
    }

    // 🌟 2. Process the characters string into an Array
    let characterArray: string[] | undefined = undefined;
    if (characters !== undefined) {
      if (typeof characters === 'string' && characters.trim().length > 0) {
        characterArray = characters.split(",").map(name => name.trim()).filter(name => name.length > 0);
      } else if (Array.isArray(characters)) {
        characterArray = characters;
      } else {
        characterArray = []; 
      }
    }

    // 🌟 3. Update the data
    const updatedChapter = await prisma.chapter.update({
      where: { id },
      data: { 
        title,
        ...(chapterNumber !== undefined && { chapterNumber: chapterNumber ? Number(chapterNumber) : null }),
        ...(characterArray !== undefined && { characters: characterArray }),
        ...(plotSummary !== undefined && { plotSummary }),
        ...(images && { images }) 
      }
    });

    // ==========================================
    // 🌟 4. PROCESS VECTOR COORDINATES IF PLOT SUMMARY IS CHANGED
    // ==========================================
    if (plotSummary !== undefined) {
      if (plotSummary.trim().length > 0) {
        try {
          const vectorValues = await generateEmbedding(plotSummary);
          const vectorStr = `[${vectorValues.join(',')}]`;
          
          await prisma.$executeRawUnsafe(
            `UPDATE "Chapter" SET embedding = $1::vector WHERE id = $2`,
            vectorStr,
            id
          );
          console.log(`✨ Successfully updated Vector 3072 dimensions for Chapter ID: ${id}`);
        } catch (embedError) {
          console.error("Error loading Vector Embedding when editing:", embedError);
        }
      } else {
        // Reset about NULL if admin clears the summary
        await prisma.$executeRawUnsafe(
          `UPDATE "Chapter" SET embedding = NULL WHERE id = $1`,
          id
        );
      }
    }

    res.status(200).json({ message: "Chapter update successful!", chapter: updatedChapter });
  } catch (error) {
    console.error("Error updating chapter:", error);
    res.status(500).json({ message: "Server error while updating chapter." });
  }
});

// Delete chapter (Admin)
router.delete('/api/admin/chapter/:id', async (req: Request, res: Response): Promise<any> => {
  try {
    const id = req.params.id as string;

    await prisma.chapter.delete({
      where: { id }
    });

    res.status(200).json({ message: "Chapter deleted successfully!" });
  } catch (error) {
    console.error("Error deleting chapter:", error);
    res.status(500).json({ message: "Server error while deleting chapter." });
  }
});


// ================= API PUBLIC (For users) =================

// Get all manga (For homepage, Explore Manga, dropdown choose manga, etc.)
router.get('/api/manga', async (req: Request, res: Response): Promise<any> => {
  try {
    const mangas = await prisma.manga.findMany({
      orderBy: { createdAt: 'desc' }, // Newest at the top
      include: { _count: { select: { chapters: true } } }
    });
    res.status(200).json(mangas);
  } catch (error) {
    res.status(500).json({ message: "Error on server while loading manga list." });
  }
});

// Get details of a single Manga (For users reading)
router.get('/api/manga/:id', async (req: Request, res: Response): Promise<any> => {
  try {
    const id = req.params.id as string;
    const manga = await prisma.manga.findUnique({
      where: { id },
      include: {
        chapters: {
          orderBy: { createdAt: 'desc' } // Newest chapter at the top for easy tracking
        }
      }
    });

    if (!manga) return res.status(404).json({ message: "This series could not be found!" });
    res.status(200).json(manga);
  } catch (error) {
    res.status(500).json({ message: "Server error while loading series details." });
  }
});

// Get details of a single Chapter (For users reading)
router.get('/api/chapter/:chapterId', async (req: Request, res: Response): Promise<any> => {
  try {
    const chapterId = req.params.chapterId as string;
    
    // 1. Find chapters and get manga information along with them.
    const chapter = await prisma.chapter.findUnique({
      where: { id: chapterId },
      include: {
        manga: {
          select: { title: true } // Just get the title of the manga to make it sound simpler.
        }
      }
    });

    if (!chapter) return res.status(404).json({ message: "This chapter could not be found!" });
    
    // ==========================================
    // 2. ADDITIONAL SECTION: Find the IDs of the previous and next chapters.
    // ==========================================
    
    // Get the complete list of chapters for this series, sorted by creation date.
    const allChapters = await prisma.chapter.findMany({
      where: { mangaId: chapter.mangaId },
      orderBy: { createdAt: 'asc' }, // Form old to new
      select: { id: true } // Just get the ID to make it sound simpler.
    });

    // Find the position (index) of the current chapter in the array
    const currentIndex = allChapters.findIndex(c => c.id === chapterId);

    // Get the IDs of the previous and next chapters based on the index (if they are at the edge, assign null).
   const prevChapterId = currentIndex > 0 ? allChapters[currentIndex - 1]?.id ?? null : null;
   const nextChapterId = currentIndex < allChapters.length - 1 ? allChapters[currentIndex + 1]?.id ?? null : null;
   
    // 3. It returns the exact same data as before, but adds two new variables.
    res.status(200).json({
      ...chapter,
      prevChapterId,
      nextChapterId
    });
    
  } catch (error) {
    res.status(500).json({ message: "Server error while loading chapter content." });
  }
});

// translate manga page (OCR + Translation)
const pendingMangaTranslations = new Map<string, Promise<any[]>>();

router.post('/api/manga/translate-page', async (req: Request, res: Response): Promise<any> => {
  try {
    const { imageUrl, targetLang = "Vietnamese" } = req.body;

    if (!imageUrl) {
      return res.status(400).json({
        message: "Missing image link for translation!"
      });
    }

    const taskKey = `${imageUrl}_${targetLang.toLowerCase()}`;

    // ==========================================
    // 1. Checking CACHE
    // ==========================================
    const cachedData = await prisma.translationCache.findUnique({
      where: {
        imageUrl_targetLang: {
          imageUrl,
          targetLang
        }
      }
    });

    if (
      cachedData &&
      Array.isArray(cachedData.blocks) &&
      cachedData.blocks.length > 0
    ) {
      console.log("⚡ [CACHE HIT] Getting translation from Database!");
      return res.status(200).json({
        blocks: cachedData.blocks
      });
    }

    // ==========================================
    // 2. Checking RUNNING PROCESS (REQUEST COALESCING)
    // ==========================================
    let translationPromise = pendingMangaTranslations.get(taskKey);

    if (!translationPromise) {
      console.log("🐢 [CACHE MISS] Start analysis image...");

      translationPromise = (async () => {
        try {
          // 2.1. Load image and convert to BASE64
          const imageResponse = await fetch(imageUrl);

          if (!imageResponse.ok) {
            throw {
              status: 400,
              message: "Cannot load image."
            };
          }

          const arrayBuffer = await imageResponse.arrayBuffer();
          const base64Image = Buffer.from(arrayBuffer).toString("base64");

          // 2.2. PROMPT FOR MANGA OCR
          const prompt = `
            You are an expert manga translator, typesetter and OCR vision AI.
            Analyze this manga page image. Detect and translate ALL text elements without missing any, including:
            1. Oval/round dialogue and thought bubbles.
            2. Rectangular narration boxes, captions, info cards, and character introduction panels.
            3. Explanation tables, bullet points, and charts.
            4. Floating side text, outer thoughts, and notes outside bubbles.

            For each text element, provide:
            - "translatedText": Translate the text into ${targetLang}. Keep the translation concise, punchy, and formatted to fit manga spaces.
            - "type": Classify into one of:
              - "bubble"
              - "box"
              - "floating"
            - "box": The bounding box coordinates [ymin, xmin, ymax, xmax] normalized on a 0 to 1000 scale.

            COORDINATE SYSTEM RULES:
            - Coordinate format is strictly [ymin, xmin, ymax, xmax].
            - (0,0) is TOP-LEFT and (1000,1000) is BOTTOM-RIGHT.
            - For bubble: tightly bound the OUTER BORDER of the speech bubble.
            - For box: tightly bound the rectangular narration box.
            - For floating: tightly bound the text block itself.
            - Do NOT shift or add artificial margins.

            Return ONLY a JSON array:
            [
              {
                "translatedText": "string",
                "type": "bubble" | "box" | "floating",
                "box": [ymin, xmin, ymax, xmax]
              }
            ]

            If no readable text is found, return [].
          `;

          // 2.3. FUNCTION TO CALL MODEL AND VALIDATE RESULTS
          const genAI = new GoogleGenerativeAI(
            process.env.GEMINI_API_KEY as string
          );

          const analyzeWithModel = async (modelName: string) => {
            console.log(`🤖 Currently using model: ${modelName}`);

            const model = genAI.getGenerativeModel({
              model: modelName,
              generationConfig: {
                responseMimeType: "application/json",
                temperature: 0.1
              }
            });

            const aiResult = await model.generateContent([
              prompt,
              {
                inlineData: {
                  data: base64Image,
                  mimeType: "image/png"
                }
              }
            ]);

            let resultText = aiResult.response.text().trim();

            resultText = resultText
              .replace(/^```json\s*/i, "")
              .replace(/^```\s*/i, "")
              .replace(/\s*```$/, "")
              .trim();

            let blocks: any[];

            try {
              const parsed = JSON.parse(resultText);
              blocks = Array.isArray(parsed) ? parsed : [];
            } catch {
              console.warn(`⚠️ ${modelName} returned invalid JSON.`);
              return [];
            }

            const validBlocks = blocks
              .filter((block: any) => {
                if (!block || typeof block !== "object") return false;

                const text = block.translatedText;
                const type = block.type;
                const box = block.box;

                if (typeof text !== "string" || !text.trim()) return false;
                if (!["bubble", "box", "floating"].includes(type)) return false;

                if (
                  !Array.isArray(box) ||
                  box.length !== 4 ||
                  !box.every(
                    (value: any) =>
                      typeof value === "number" &&
                      Number.isFinite(value) &&
                      value >= 0 &&
                      value <= 1000
                  )
                ) {
                  return false;
                }

                const [ymin, xmin, ymax, xmax] = box;
                return ymax > ymin && xmax > xmin;
              })
              .map((block: any) => {
                const [ymin, xmin, ymax, xmax] = block.box;

                return {
                  translatedText: block.translatedText.trim(),
                  type: block.type,
                  topPercent: ymin / 10,
                  leftPercent: xmin / 10,
                  widthPercent: (xmax - xmin) / 10,
                  heightPercent: (ymax - ymin) / 10
                };
              });

            console.log(
              `📊 ${modelName}: Found ${validBlocks.length} valid blocks.`
            );

            return validBlocks;
          };

          // 2.4. PRIMARY MODEL: GEMINI 3.5 FLASH-LITE
          let finalBlocks: any[] = [];

          try {
            finalBlocks = await analyzeWithModel("gemini-3.5-flash-lite");
          } catch (error) {
            // Don't throw anything here so the code automatically falls back to step 2.5 (fallback).
            console.warn("⚠️ Gemini 3.5 Flash-Lite error/overload, in progressing to fallback...");
          }

          // 2.5. FALLBACK: GEMINI 3.6 FLASH
          if (finalBlocks.length === 0) {
            console.warn(
              "⚠️ Switching to Gemini 3.6 Flash..."
            );

            try {
              finalBlocks = await analyzeWithModel("gemini-3.6-flash");
            } catch (fallbackError) {
              console.error("❌ The entire fallback process encountered an error:", fallbackError);

              throw {
                status: 503,
                message: "The AI ​​cannot analyze the manga page at this time.",
                blocks: []
              };
            }
          }

          // 2.6. SAVE FINAL RESULT TO CACHE
          console.log(
            `✅ Final results: ${finalBlocks.length} valid blocks.`
          );

          await prisma.translationCache.upsert({
            where: {
              imageUrl_targetLang: {
                imageUrl,
                targetLang
              }
            },
            update: {
              blocks: finalBlocks
            },
            create: {
              imageUrl,
              targetLang,
              blocks: finalBlocks
            }
          });

          console.log("💾 Final results saved to Database!");

          return finalBlocks;
        } finally {
          // Safely free up RAM without generating unnecessary Promises that could crash Node.js.
          pendingMangaTranslations.delete(taskKey);
        }
      })();

      pendingMangaTranslations.set(taskKey, translationPromise);
    } else {
      console.log(`⏳ [Manga OCR] Currently grouping requests into existing translation process: ${taskKey}`);
    }

    // ==========================================
    // 3. Users who click simultaneously will wait for the same promise.
    // ==========================================
    const finalBlocks = await translationPromise;

    return res.status(200).json({
      blocks: finalBlocks
    });

  } catch (error: any) {
    if (error?.status) {
      return res.status(error.status).json({
        message: error.message,
        ...(error.blocks !== undefined && { blocks: error.blocks })
      });
    }

    console.error("AI error in translating manga:", error);

    return res.status(500).json({
      message: "Error on server while scanning and translating image."
    });
  }
});


// API: Using AI to write manga summaries.
router.post('/api/admin/generate-manga-desc', async (req: Request, res: Response): Promise<any> => {
  try {
    const { title } = req.body;

    if (!title) {
      return res.status(400).json({ message: "Please provide the title of the story." });
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);
    const model = genAI.getGenerativeModel({ model: "gemini-3.5-flash-lite" });

    const prompt = `
      You are an expert Manga/Comic reviewer and a true Otaku enthusiast.
      Write an engaging, intriguing, and accurate synopsis for the manga titled "${title}".

      MANDATORY REQUIREMENTS:
      1. Write entirely in English.
      2. Keep it approximately 3-4 sentences long, concise and to the point.
      3. Absolutely NO major plot spoilers. Do not reveal any important plot twists or key story developments.
      4. Return ONLY the synopsis text. Do not include any additional explanations or wrap the response in a Markdown code block.
    `;

    const aiResult = await model.generateContent(prompt);
    const description = aiResult.response.text().trim();

    res.status(200).json({ description });

  } catch (error) {
    console.error("AI error in writing manga summaries:", error);
    res.status(500).json({ message: "Error on server while using AI to write manga summaries." });
  }
});



export default router;