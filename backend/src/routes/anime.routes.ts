import express, { Request, Response } from 'express';
import prisma from '../config/db'; 
import { GoogleGenerativeAI } from "@google/generative-ai";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const router = express.Router();


router.get('/api/anime/top', async (req: Request, res: Response): Promise<any> => {
  try {
    const period = req.query.period as string;
    const startDate = new Date();
    
    if (period === 'day') startDate.setDate(startDate.getDate() - 1);
    else if (period === 'week') startDate.setDate(startDate.getDate() - 7);
    else if (period === 'month') startDate.setMonth(startDate.getMonth() - 1);
    else return res.status(400).json({ message: "Invalid period." });

    const topViews = await prisma.animeViewLog.groupBy({
      by: ['animeId'],
      where: { createdAt: { gte: startDate } },
      _count: { animeId: true },
      orderBy: { _count: { animeId: 'desc' } },
      take: 10
    });

    if (topViews.length === 0) return res.status(200).json([]);

    const animeIds = topViews.map(v => v.animeId);
    const animes = await prisma.anime.findMany({
      where: { id: { in: animeIds } },
      select: { 
        id: true, 
        title: true, 
        coverImage: true, 
        _count: { select: { episodes: true } }
      }
    });

    const sortedTopAnimes = topViews.map(view => {
      const animeDetail = animes.find(a => a.id === view.animeId);
      return {
        ...animeDetail,
        periodViews: view._count.animeId
      };
    }).filter(a => a.id);

    res.status(200).json(sortedTopAnimes);
  } catch (error) {
    console.error("Error retrieving Top Anime:", error);
    res.status(500).json({ message: "Error occurred while fetching top anime." });
  }
});

// ==========================================
// 👁️ 2. API: RECORD ANIME VIEW (LOG VIEW)
// ==========================================
router.post('/api/anime/:id/view', async (req: Request, res: Response): Promise<any> => {
  try {
    const animeId = String(req.params.id);

    const anime = await prisma.anime.findUnique({ where: { id: animeId } });
    if (!anime) return res.status(404).json({ message: "Anime not found!" });

    await prisma.animeViewLog.create({
      data: { animeId: anime.id }
    });

    res.status(200).json({ message: "View log recorded!" });
  } catch (error) {
    console.error("Error recording anime view:", error);
    res.status(500).json({ message: "Error occurred while recording view." });
  }
});

// ==========================================
// API MANAGE ANIME & EPISODE (ADMIN)
// ==========================================

// 1. Retrieve a list of anime to populate a dropdown selection menu.
router.get('/api/admin/anime/list-select', async (req: Request, res: Response) => {
  try {
    const animes = await prisma.anime.findMany({
      select: { id: true, title: true },
      orderBy: { title: 'asc' }
    });
    res.status(200).json(animes);
  } catch (error) {
    res.status(500).json({ message: "Error occurred while fetching anime list." });
  }
});

// 2. API: Create a new episode, including a set of subtitles and a link to the manga.

// 🌟 HELPER FUNCTION: Embeds a text string (regardless of language) into a 768-dimensional vector
async function generateEmbedding(text: string): Promise<number[]> {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);
  const model = genAI.getGenerativeModel({ model: "gemini-embedding-001" });
  const result = await model.embedContent(text);
  return result.embedding.values;
}

// 2. API: Create a new episode, including a set of subtitles and a link to the manga
router.post('/api/admin/episode', async (req: Request, res: Response): Promise<any> => {
  try {
    const { 
      animeId, 
      title, 
      videoUrl, 
      subtitles, 
      episodeNumber, 
      mappedChapterIds,
      adaptedFrom,
      characters, 
      plotSummary 
    } = req.body;

    if (!animeId || !title || !videoUrl || episodeNumber === undefined) {
      return res.status(400).json({ message: "Please fill in all required information!" });
    }

    // CONVERTING A STRING OF CHARACTERS INTO AN ARRAY
    let characterArray: string[] = [];
    if (typeof characters === 'string' && characters.trim().length > 0) {
      characterArray = characters
        .split(",")
        .map(name => name.trim())
        .filter(name => name.length > 0);
    } else if (Array.isArray(characters)) {
      characterArray = characters;
    }

    // STEP 1: Create the episode data before fetching the episode ID
    const newEpisode = await prisma.episode.create({
      data: {
        animeId,
        title,
        videoUrl,
        episodeNumber: Number(episodeNumber), 
        mappedChapterIds: mappedChapterIds || [], 
        adaptedFrom: adaptedFrom || "",
        plotSummary: plotSummary || "",
        characters: characterArray, 
        subtitles: {
          create: subtitles 
        }
      },
      include: { subtitles: true }
    });

    // STEP 2: AUTOMATICALLY GENERATE VECTOR EMBEDDING AND STORE IT IN THE UNSUPPORTED COLUMN
    if (plotSummary && plotSummary.trim().length > 0) {
      try {
        // Call Google's AI to calculate the semantic coordinates
        const vectorValues = await generateEmbedding(plotSummary);
        
        // Format the array of numbers into a PostgreSQL array string: "[0.123, -0.456, ...]"
        const vectorStr = `[${vectorValues.join(',')}]`; 
        
        // Cast the string of numbers into the ::vector data type and insert into Postgres
        await prisma.$executeRawUnsafe(
          `UPDATE "Episode" SET embedding = $1::vector WHERE id = $2`,
          vectorStr,
          newEpisode.id
        );
        
        console.log(`✨ Vector embeddings have been successfully loaded for the episode ${episodeNumber}.`);
      } catch (embedError) {
        // Wrap this in a separate try-catch block so that if the AI ​​Key expires or a network error occurs,
        // the episode can still be uploaded successfully (without disrupting the system's main workflow).
        console.error("Error during the generation or ingestion of Vector Embeddings:", embedError);
      }
    }

    // ==========================================
    // 🌟 AUTOMATICALLY SEND NOTIFICATIONS TO ANIME FOLLOWERS
    // ==========================================
    try {
      const usersInWatchList = await prisma.watchList.findMany({
        where: { animeId: animeId } 
      });

      if (usersInWatchList.length > 0) {
        const animeInfo = await prisma.anime.findUnique({
          where: { id: animeId },
          select: { title: true }
        });

        const animeTitleStr = animeInfo?.title || "An anime series you follow";

        const notificationsToInsert = usersInWatchList.map((item: any) => ({
          userId: item.userId,
          title: "New Episode is out now! 🎬",
          message: `${animeTitleStr} just updated: Episode ${episodeNumber} - ${newEpisode.title}`,
          linkUrl: `/anime/${animeId}/watch/${newEpisode.id}`, 
          isRead: false
        }));

        await prisma.notification.createMany({
          data: notificationsToInsert
        });
        
        console.log(`✨ Notification has been sent to ${usersInWatchList.length} users following this anime!`);
      }
    } catch (notiError) {
      console.error("Error while sending anime notifications:", notiError);
    }

    res.status(201).json({ 
      message: "New episode uploaded successfully with Vector Space activated!", 
      episode: newEpisode 
    });

  } catch (error) {
    console.error("Error uploading episode:", error);
    res.status(500).json({ message: "Server error when saving the episode." });
  }
});

// 3. API: Retrieve the full list of anime for the admin page
router.get('/api/admin/anime', async (req: Request, res: Response) => {
  try {
    const animes = await prisma.anime.findMany({
      orderBy: { createdAt: 'desc' }, // Newest anime at the top
      include: {
        _count: {
          select: { episodes: true } // Count the number of episodes for easy management by Admin
        }
      }
    });
    res.status(200).json(animes);
  } catch (error) {
    res.status(500).json({ message: "Server error when loading the anime list." });
  }
});

// 4. API: Delete an anime (Will automatically delete its episodes and subtitles due to onDelete: Cascade)
router.delete('/api/admin/anime/:id', async (req: Request, res: Response): Promise<any> => {
  try {
    const id = req.params.id as string;
    await prisma.anime.delete({
      where: { id }
    });
    res.status(200).json({ message: "New anime deleted successfully!" });
  } catch (error) {
    console.error("Error deleting anime:", error);
    res.status(500).json({ message: "Server error when deleting the anime." });
  }
});

// 5. API: Retrieve details of a single anime with its episode list
router.get('/api/admin/anime/:id', async (req: Request, res: Response): Promise<any> => {
  try {
    const animeId = req.params.id as string;
    
    const anime = await prisma.anime.findUnique({
      where: { id: animeId },
      include: {
        episodes: {
          orderBy: { createdAt: 'asc' } // Sort episodes from oldest to newest (Episodes 1, 2, 3...)
        }
      }
    });
    
    if (!anime) return res.status(404).json({ message: "The requested anime series was not found." });
    res.status(200).json(anime);
  } catch (error) {
    res.status(500).json({ message: "Server error while loading anime details." });
  }
});

// 6. API: Edit anime information (Edit Title, Description, Cover Image, Fandom Prefix)
router.put('/api/admin/anime/:id', async (req: Request, res: Response): Promise<any> => {
  try {
    const animeId = req.params.id as string;
    
    // 🌟 ADD fandomPrefix HERE TO CAPTURE DATA
    const { title, description, coverImage, fandomPrefix } = req.body;

    if (!title) return res.status(400).json({ message: "The anime title cannot be empty!" });

    const updatedAnime = await prisma.anime.update({
      where: { id: animeId },
      // 🌟 ADD fandomPrefix HERE TO SAVE TO DATABASE
      data: { 
        title, 
        description, 
        coverImage,
        fandomPrefix 
      }
    });

    res.status(200).json({ message: "Update anime information successfully!", anime: updatedAnime });
  } catch (error) {
    console.error("Error updating anime:", error);
    res.status(500).json({ message: "Server error while updating anime." });
  }
});

// 7. API: Delete an episode
router.delete('/api/admin/episode/:id', async (req: Request, res: Response): Promise<any> => {
  try {
    const episodeId = req.params.id as string;
    await prisma.episode.delete({
      where: { id: episodeId }
    });
    res.status(200).json({ message: "Episode deleted successfully!" });
  } catch (error) {
    console.error("Error deleting episode:", error);
    res.status(500).json({ message: "Server error when deleting the episode." });
  }
});

// 8. API: Retrieve details of a single episode (Used for the Edit page)
router.get('/api/admin/episode-detail/:id', async (req: Request, res: Response): Promise<any> => {
  try {
    const episodeId = req.params.id as string;
    const episode = await prisma.episode.findUnique({
      where: { id: episodeId },
      include: { subtitles: true }
    });
    if (!episode) return res.status(404).json({ message: "Episode not found." });
    res.status(200).json(episode);
  } catch (error) {
    res.status(500).json({ message: "Error loading episode details." });
  }
});

// 9. API: Update an episode (Change name, video, subtitle, Manga Sync or update AI details)
router.put('/api/admin/episode/:id', async (req: Request, res: Response): Promise<any> => {
  try {
    const episodeId = req.params.id as string;
    
    // 1. EXTRACTING DATA FIELDS FROM THE FRONTEND
    const { 
      title, 
      videoUrl, 
      newSubtitles, 
      episodeNumber, 
      mappedChapterIds,
      adaptedFrom,   
      characters,    
      plotSummary    
    } = req.body;

    // 2. UPDATE TEXT DATA INTO PRISMA FIRST
    const updatedEpisode = await prisma.episode.update({
      where: { id: episodeId },
      data: {
        ...(title && { title }), 
        ...(videoUrl && { videoUrl }), 
        ...(episodeNumber !== undefined && { episodeNumber: Number(episodeNumber) }),
        ...(mappedChapterIds && { mappedChapterIds }),
        ...(adaptedFrom !== undefined && { adaptedFrom }),
        ...(characters !== undefined && { characters }), 
        ...(plotSummary !== undefined && { plotSummary })
      }
    });

    // 🌟 3. RECALCULATE VECTOR COORDINATES IF PLOT SUMMARY IS CHANGED
    if (plotSummary !== undefined) {
      if (plotSummary.trim().length > 0) {
        // IF CONTENT EXISTS: Invoke AI to generate a new Vector and overwrite it in the DB
        try {
          const vectorValues = await generateEmbedding(plotSummary);
          const vectorStr = `[${vectorValues.join(',')}]`;
          
          await prisma.$executeRawUnsafe(
            `UPDATE "Episode" SET embedding = $1::vector WHERE id = $2`,
            vectorStr,
            episodeId
          );
          console.log(`✨ Updated Vector 3072 dimensions for episode ID: ${episodeId}`);
        } catch (embedError) {
          console.error("Error loading Vector Embedding when editing:", embedError);
        }
      } else {
        // IF EMPTY: Reset the vector column to NULL for a clean Database
        await prisma.$executeRawUnsafe(
          `UPDATE "Episode" SET embedding = NULL WHERE id = $1`,
          episodeId
        );
      }
    }

    // 4. HANDLE NEW SUBTITLES (IF ANY ARE SENT)
    if (newSubtitles && newSubtitles.length > 0) {
      await prisma.subtitle.deleteMany({ where: { episodeId: episodeId } });
      await prisma.subtitle.createMany({
        data: newSubtitles.map((sub: any) => ({
          label: sub.label,
          url: sub.url,
          episodeId: episodeId
        }))
      });
    }

    res.status(200).json({ message: "Episode updated successfully!", episode: updatedEpisode });
  } catch (error) {
    console.error("Error updating episode:", error);
    res.status(500).json({ message: "Server error when updating episode." });
  }
});

//10. API: Create a new anime series
router.post('/api/admin/anime', async (req: Request, res: Response): Promise<any> => {
  try {
    // 🌟 1. EXTRACT fandomPrefix FROM FRONTEND
    const { title, description, coverImage, fandomPrefix } = req.body;

    if (!title) {
      return res.status(400).json({ message: "The anime name cannot be blank!" });
    }

    // 🌟 2. PASS TO PRISMA TO SAVE TO THE DATABASE
    const newAnime = await prisma.anime.create({
      data: {
        title,
        description: description || "",
        coverImage: coverImage || "",
        fandomPrefix: fandomPrefix || "", 
      }
    });

    res.status(201).json({ message: "New anime series added successfully!", anime: newAnime });
  } catch (error) {
    console.error("Error creating anime:", error);
    res.status(500).json({ message: "Server error when adding anime." });
  }
});

// ==========================================
// ANIME API FOR USERS (PUBLIC)
// ==========================================

// 1. Get a list of all anime (newest first)
router.get('/api/anime', async (req: Request, res: Response) => {
  try {
    const animes = await prisma.anime.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { episodes: true } }
      }
    });
    res.status(200).json(animes);
  } catch (error) {
    res.status(500).json({ message: "Error loading anime list." });
  }
});

// 2. Get details of a single anime with all episodes and subtitles
router.get('/api/anime/:id', async (req: Request, res: Response): Promise<any> => {
  try {
    const animeId = req.params.id as string;
    const anime = await prisma.anime.findUnique({
      where: { id: animeId },
      include: {
        episodes: {
          orderBy: { createdAt: 'asc' }, //order by oldest to newest (Episode 1, 2, 3...)
          include: { subtitles: true }   
        }
      }
    });
    
    if (!anime) return res.status(404).json({ message: "The anime could not be found." });
    res.status(200).json(anime);
  } catch (error) {
    res.status(500).json({ message: "Error loading anime details." });
  }
});

// Reconfigure the S3 Client (Used for uploading translated files to R2)
const s3Client = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT as string,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID as string,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY as string,
  },
  forcePathStyle: true,
});

// Place this Map outside the router (globally within the route file)
const pendingSubTranslations = new Map<string, Promise<any>>();

// API: Automatic subtitle translation using Gemini (with integrated Request Coalescing)
router.post('/api/anime/translate-sub', async (req: Request, res: Response): Promise<any> => {
  try {
    const { episodeId, targetLang } = req.body;

    if (!episodeId || !targetLang) {
      return res.status(400).json({ message: "Missing episode information or target language." });
    }

    const newLabel = `${targetLang} (Auto)`;
    const taskKey = `${episodeId}_${targetLang.toLowerCase()}`;

    // 1. CHECK CACHE: See if this language has been translated before
    const existingSub = await prisma.subtitle.findFirst({
      where: { episodeId, label: newLabel }
    });

    if (existingSub) {
      return res.status(200).json({ message: "Loaded from cache", subtitle: existingSub });
    }

    // 2. CHECK RUNNING PROCESS (REQUEST COALESCING)
    let translationPromise = pendingSubTranslations.get(taskKey);

    if (!translationPromise) {
      translationPromise = (async () => {
        try {
          // 2.1. FIND ORIGINAL FILE (English preferred)
          const episode = await prisma.episode.findUnique({
            where: { id: episodeId },
            include: { subtitles: true }
          });

          if (!episode || episode.subtitles.length === 0) {
            throw { status: 404, message: "The episode does not have any original subtitles to translate." };
          }

          let sourceSub = episode.subtitles.find(sub =>
            sub.label.toLowerCase().includes("english") || sub.label.toLowerCase().includes("full")
          );

          if (!sourceSub) {
            sourceSub = episode.subtitles[0];
          }
          if (!sourceSub) {
            throw { status: 404, message: "No valid source subtitle found." };
          }

          // 2.2. UPLOAD ORIGINAL VTT FILE CONTENT
          const response = await fetch(sourceSub.url);
          if (!response.ok) throw new Error("Unable to download source subtitle");
          const vttContent = await response.text();

          // 2.3. CALL GEMINI TRANSLATION
          const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);
          const model = genAI.getGenerativeModel({ model: "gemini-3.5-flash-lite" });

          const prompt = `
            You are a professional anime subtitle translator. Translate the following WEBVTT subtitle file into ${targetLang}.
            IMPORTANT RULES:
            1. Keep the 'WEBVTT' header exactly as it is.
            2. DO NOT translate, change, or format the timestamps (e.g., 00:00:01.000 --> 00:00:03.000).
            3. DO NOT alter the sequence numbers.
            4. ONLY translate the spoken dialogue text. Keep character names sounding natural.
            5. Return ONLY the translated WEBVTT content, without any markdown formatting like \`\`\`vtt.
            
            Here is the file:
            ${vttContent}
          `;

          const aiResult = await model.generateContent(prompt);
          let translatedVtt = aiResult.response.text();

          translatedVtt = translatedVtt.replace(/```vtt/gi, '').replace(/```/g, '').trim();

          // 2.4. UPLOAD NEW FILE VTT TO CLOUDFLARE R2
          const fileName = `translated-${episodeId}-${Date.now()}.vtt`;

          const command = new PutObjectCommand({
            Bucket: process.env.R2_BUCKET_NAME as string,
            Key: fileName,
            Body: translatedVtt,
            ContentType: "text/vtt",
          });

          await s3Client.send(command);
          const publicUrl = `${process.env.R2_PUBLIC_DOMAIN}/${fileName}`;

          // 2.5. SAVE TO DATABASE
          const newSubtitle = await prisma.subtitle.create({
            data: {
              label: newLabel,
              url: publicUrl,
              episodeId: episodeId
            }
          });

          return newSubtitle;
        } finally {
          // Safely remove from the Map within an async function, without creating redundant Promises that could cause a crash
          pendingSubTranslations.delete(taskKey);
        }
      })();

      // Save Promise is running into Map
      pendingSubTranslations.set(taskKey, translationPromise);
    } else {
      console.log(`⏳ [Translate Sub] Merging request into an existing translation process: ${taskKey}`);
    }

    // 3. All users who click at the same time await the same Promise and receive the result.
    const newSubtitle = await translationPromise;

    return res.status(200).json({ message: "Translated successfully", subtitle: newSubtitle });
  } catch (error: any) {
    console.error("Error translating subtitles:", error);
    if (error?.status) {
      return res.status(error.status).json({ message: error.message });
    }
    return res.status(500).json({ message: "Server error when translating automatically." });
  }
});


// =========================================================================
// HELPER FUNCTION: SPECIALIST FOR EXTRACTING CHAPTER NUMBERS FROM WIKI TEXT STRINGS
// =========================================================================
function extractChapterNumbers(text: string): number[] {
  if (!text || typeof text !== 'string') return [];
  
  // Skip if Fandom states "Not specified," "TBA," or "Unknown."
  if (text.toLowerCase().includes('không rõ') || text.toLowerCase().includes('tba') || text.toLowerCase().includes('unknown')) {
    return [];
  }

  const chapters = new Set<number>();
  
  // 1. Clean up: Remove everything contained within parentheses (e.g., "(p. 4 - 25)")
  const cleanText = text.replace(/\([^)]*\)/g, ' '); 

  // 🌟 2. NEW TACTIC: Capture the entire sequence of numbers following "Chapter"
  //This regex matches the word "Chapter," followed by a list of numbers that may include commas, hyphens, the word "and," etc.
  // For example: Captures sequences such as "1, 2", "1 - 5", "1, 2 and 3", and "#1, #2"
  const blockRegex = /(?:chapter|chap|ch)\w*\.?\s*((?:#?\s*\d+\s*(?:,|&|and|-|–|to)\s*)*#?\s*\d+)/gi;
  let blockMatch;

  while ((blockMatch = blockRegex.exec(cleanText)) !== null) {
    const numberString = blockMatch[1]!; // Extract the text segment containing numbers (e.g., "1, 2" or "1 - 3")
    
    // 3. Split this piece of text based on commas (,), ampersands (&), or the word "and".
    const parts = numberString.split(/\s*(?:,|&|and)\s*/i);
    
    for (const part of parts) {
      // 4a. Check if this element is a range (e.g., "1 - 3" or "#1 to #5")
      const rangeMatch = part.match(/(\d+)\s*(?:-|–|to)\s*#?\s*(\d+)/i);
      
      if (rangeMatch) {
        const start = parseInt(rangeMatch[1]!);
        const end = parseInt(rangeMatch[2]!);
        
        // Iterate through the numbers from start to end and add them to the Set
        if (start && end && start <= end && end - start < 100) { 
          for (let i = start; i <= end; i++) {
            chapters.add(i);
          }
        }
      } else {
        // 4b. If it is not a range, it is a single number (e.g., "1" or "#2").
        const singleMatch = part.match(/(\d+)/);
        if (singleMatch) {
          chapters.add(parseInt(singleMatch[1]!));
        }
      }
    }
  }

  // Return an array sorted in ascending order for tidiness (e.g., [1, 2, 3])
  return Array.from(chapters).sort((a, b) => a - b);
}
// =========================================================================
// AUTOMATED LINKING API (SMART MAP: REGEX FIRST -> AI FALLBACK)
// =========================================================================
router.post('/api/admin/auto-map-chapters', async (req: Request, res: Response): Promise<any> => {
  try {
    const { animeName, episodeNumber, mangaId, adaptedFrom } = req.body;
    let chapterNumbers: number[] = [];
    let mappingSource = "Text Extraction System (Regex)";

    // -------------------------------------------------------------
    // PHASE 1: TESTING THE EXTRACTION OF THE "ADAPTED FROM" FIELD
    // -------------------------------------------------------------
    if (adaptedFrom) {
      chapterNumbers = extractChapterNumbers(adaptedFrom);
    }

    // -------------------------------------------------------------
    // PHASE 2: IF IT FAILS (EMPTY), CALL AI TO SAVE THE DAY
    // -------------------------------------------------------------
    if (chapterNumbers.length === 0) {
      mappingSource = "Artificial Intelligence (Gemini AI)";
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);
      const model = genAI.getGenerativeModel({ 
        model: "gemini-3.5-flash-lite",
        generationConfig: { responseMimeType: "application/json" } 
      });

      const prompt = `
        You are an anime/manga database expert. 
        The anime is "${animeName}". 
        Which manga chapter numbers correspond exactly to episode ${episodeNumber} of this anime?
        Return ONLY a JSON array of integers representing the chapter numbers. 
        For example, if it covers chapters 4 and 5, return: [4, 5]. 
        If it's a filler episode with no manga chapters, return: [].
      `;

      const aiResult = await model.generateContent(prompt);
      chapterNumbers = JSON.parse(aiResult.response.text());
    }

    // -------------------------------------------------------------
    // PHASE 3: SAVING AND MAPPING TO DATABASE
    // -------------------------------------------------------------
    if (chapterNumbers.length === 0) {
      return res.status(200).json({ 
        mappedChapterIds: [], 
        message: `This is a Filler episode (Side Story), no Manga chapters. (Source: ${mappingSource})` 
      });
    }

    const mappedChapterIds: string[] = [];
    for (const chapNum of chapterNumbers) {
      // Find the chapter within that manga series that contains the chapter number.
      const chapterInDb = await prisma.chapter.findFirst({
        where: {
          mangaId: mangaId,
          title: {
            contains: chapNum.toString()
          }
        }
      });

      if (chapterInDb) {
        mappedChapterIds.push(chapterInDb.id);
      }
    }

    res.status(200).json({ 
      mappedChapterIds, 
      foundNumbers: chapterNumbers,
      message: `Successfully found links via: ${mappingSource}!` 
    });

  } catch (error) {
    console.error("Auto-Map Error:", error);
    res.status(500).json({ message: "Server error during automatic linking." });
  }
});


// Auto generate Anime description using Gemini 3.5 Flash lite
router.post('/api/admin/generate-anime-desc', async (req: Request, res: Response): Promise<any> => {
  try {
    const { title } = req.body;

    if (!title) {
      return res.status(400).json({ message: "Please provide the anime title." });
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);
    const model = genAI.getGenerativeModel({ model: "gemini-3.5-flash-lite" });

    // Configure Prompt (Command) for AI
    const prompt = `
      You are an expert anime reviewer (a true anime enthusiast).
      Write an engaging and accurate plot summary for the anime titled "${title}".
      STRICT REQUIREMENTS:
      1. Write in English.
      2. Keep the length around 3-4 sentences (short and concise).
      3. Strictly NO spoilers (do not reveal major plot points).
      4. Return ONLY the summary text, with no extra explanations and no markdown code blocks.
    `;

    const aiResult = await model.generateContent(prompt);
    const description = aiResult.response.text().trim();

    res.status(200).json({ description });

  } catch (error) {
    console.error("AI summarization error:", error);
    res.status(500).json({ message: "Server error when requesting AI to write a summary." });
  }
});





export default router;