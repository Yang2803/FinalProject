import express, { Request, Response } from 'express';
// @ts-ignore
import { parse } from 'node-webvtt';
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import axios from 'axios';
import prisma from '../config/db';

const router = express.Router();

// Configuring an S3 Client for Cloudflare R2
const s3Client = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT!,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

// 🌟 MAP FOR TRACKING ACTIVE VOICE-OVER PROCESSES (REQUEST COALESCING)
const pendingDubs = new Map<string, Promise<void>>();

// =================================================================
// 🌟 SUBTITLE CLEANUP FUNCTION WITH AUTOMATIC TIMING ERROR CORRECTION
// =================================================================
function sanitizeVtt(vttString: string): string {
  if (!vttString) return "";

  return vttString
    // 1. Fix the issue of using a comma (,) instead of a period (.) for the milliseconds portion
    .replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2')

    // 2. Fix the issue of missing timezone (only has minutes:seconds.milliseconds) -> Add 00:
    .replace(/(^|\n|\s)(\d{2}:\d{2}\.\d{3})/g, '$100:$2')

    // 3. Fix the issue of hours having only one digit (e.g., 1:05:10 -> 01:05:10)
    .replace(/(^|\n|\s)(\d):(\d{2}:\d{2}\.\d{3})/g, '$10$2:$3');
}

router.post('/api/anime/generate-dub', async (req: Request, res: Response): Promise<any> => {
  const { episodeId, subtitleUrl, targetLang } = req.body;

  if (!episodeId || !subtitleUrl || !targetLang) {
    return res.status(400).json({ error: "Missing episode information, subtitles, or language." });
  }

  const taskKey = `${episodeId}_${targetLang.toLowerCase()}`;

  try {
    // 1. CHECK CACHE IN DATABASE FIRST
    const episode = await prisma.episode.findUnique({
      where: { id: episodeId },
      select: { dubbedLanguages: true },
    });

    if (!episode) {
      return res.status(404).json({ error: "Episode not found." });
    }

    if (episode.dubbedLanguages.includes(targetLang)) {
      return res.status(200).json({ message: "Dubbed version is already available (Loaded from cache)!" });
    }

    // 2. CHECK ACTIVE VOICE-OVER PROCESSES (REQUEST COALESCING)
    let dubPromise = pendingDubs.get(taskKey);

    if (!dubPromise) {
      dubPromise = (async () => {
        try {
          // 2.1. Load file VTT
          const vttResponse = await axios.get(subtitleUrl);
          let vttContent = vttResponse.data;

          // Apply a cleanup function before parsing
          vttContent = sanitizeVtt(vttContent);

          // Ignore small formatting errors
          const parsedVtt = parse(vttContent, { strict: false });

          // 2.2. Choose voice based on the target language
          const voiceMappings: Record<string, string> = {
            "Vietnamese": "vi-VN-HoaiMyNeural",
            "Japanese": "ja-JP-NanamiNeural",
            "Korean": "ko-KR-SunHiNeural",
            "Chinese (Simplified)": "zh-CN-XiaoxiaoNeural",
            "Chinese (Traditional)": "zh-TW-HsiaoChenNeural",
            "Thai": "th-TH-AcharaNeural",
            "Indonesian": "id-ID-GadisNeural",
            "Hindi": "hi-IN-SwaraNeural",
            "Arabic": "ar-SA-ZariyahNeural",
            "English": "en-US-AriaNeural",
            "French": "fr-FR-DeniseNeural",
            "Spanish": "es-ES-ElviraNeural",
            "German": "de-DE-KatjaNeural",
            "Russian": "ru-RU-SvetlanaNeural",
            "Portuguese": "pt-BR-FranciscaNeural",
            "Italian": "it-IT-ElsaNeural",
            "Dutch": "nl-NL-ColetteNeural",
            "Polish": "pl-PL-AgnieszkaNeural",
            "Turkish": "tr-TR-EmelNeural",
            "Swedish": "sv-SE-SofieNeural",
            "Malay": "ms-MY-YasminNeural",
            "Lao": "lo-LA-KeomanyNeural",
            "Ukrainian": "uk-UA-PolinaNeural",
            "Czech": "cs-CZ-VlastaNeural",
            "Greek": "el-GR-AthinaNeural",
            "Hungarian": "hu-HU-NoemiNeural",
            "Romanian": "ro-RO-AlinaNeural",
            "Danish": "da-DK-ChristelNeural",
            "Finnish": "fi-FI-NooraNeural",
            "Norwegian": "nb-NO-PernilleNeural"
          };

          let voiceName = 'en-US-AriaNeural';
          for (const [langCode, voiceId] of Object.entries(voiceMappings)) {
            if (targetLang.includes(langCode)) {
              voiceName = voiceId;
              break;
            }
          }

          // 2.3. Initialize a TTS object with high-quality MP3 format
          const tts = new MsEdgeTTS();
          await tts.setMetadata(voiceName, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);

          // 2.4. Loop: Speak each sentence and upload it directly to Cloudflare R2
          for (let index = 0; index < parsedVtt.cues.length; index++) {
            const cue = parsedVtt.cues[index];
            const cleanText = cue.text.replace(/<[^>]+>/g, '');

            if (!cleanText.trim()) continue;

            try {
              const { audioStream } = tts.toStream(cleanText);

              const chunks: any[] = [];
              for await (const chunk of audioStream) {
                chunks.push(chunk);
              }
              const audioBuffer = Buffer.concat(chunks);

              const uploadParams = {
                Bucket: process.env.R2_BUCKET_NAME,
                Key: `dubs/${episodeId}/${targetLang}/${index}.mp3`,
                Body: audioBuffer,
                ContentType: 'audio/mpeg',
              };
              await s3Client.send(new PutObjectCommand(uploadParams));

              // Nghỉ ngơi 300ms tránh bị Rate Limit
              await new Promise(resolve => setTimeout(resolve, 300));
            } catch (err) {
              console.error(`Index reading error ${index}:`, err);
            }
          }

          // 2.5. Update Database
          await prisma.episode.update({
            where: { id: episodeId },
            data: {
              dubbedLanguages: {
                push: targetLang,
              },
            },
          });
        } finally {
          // Safely remove from a Map inside an async function, without creating redundant Promises
          pendingDubs.delete(taskKey);
        }
      })();

      // Save Promise to Map
      pendingDubs.set(taskKey, dubPromise);
    } else {
      console.log(`⏳ [Generate Dub]Merging the request into the ongoing dubing process: ${taskKey}`);
    }

    // 3. Users who click at the same time all end up waiting on this same Promise.
    await dubPromise;

    return res.status(200).json({ message: "Successfully create a voiceover!" });
  } catch (error) {
    console.error("Error while parsing the file or generating the voiceover:", error);
    return res.status(500).json({ error: "System error during voiceover generation" });
  }
});

export default router;