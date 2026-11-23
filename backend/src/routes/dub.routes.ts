import express, { Request, Response } from 'express';
// @ts-ignore
import { parse } from 'node-webvtt';
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import axios from 'axios';
import prisma from '../config/db';

const router = express.Router();

// Cấu hình S3 Client cho Cloudflare R2
const s3Client = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT!,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

// 🌟 MAP LƯU CÁC TIẾN TRÌNH LỒNG TIẾNG ĐANG CHẠY (REQUEST COALESCING)
const pendingDubs = new Map<string, Promise<void>>();

// =================================================================
// 🌟 HÀM DỌN DẸP PHỤ ĐỀ, TỰ ĐỘNG SỬA LỖI THỜI GIAN
// =================================================================
function sanitizeVtt(vttString: string): string {
  if (!vttString) return "";

  return vttString
    // 1. Sửa lỗi dùng dấu phẩy (,) thay vì dấu chấm (.) ở phần mili-giây
    .replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2')

    // 2. Sửa lỗi thiếu múi Giờ (chỉ có Phút:Giây.MiliGiây) -> Thêm 00:
    .replace(/(^|\n|\s)(\d{2}:\d{2}\.\d{3})/g, '$100:$2')

    // 3. Sửa lỗi giờ chỉ có 1 chữ số (vd: 1:05:10 -> 01:05:10)
    .replace(/(^|\n|\s)(\d):(\d{2}:\d{2}\.\d{3})/g, '$10$2:$3');
}

router.post('/api/anime/generate-dub', async (req: Request, res: Response): Promise<any> => {
  const { episodeId, subtitleUrl, targetLang } = req.body;

  if (!episodeId || !subtitleUrl || !targetLang) {
    return res.status(400).json({ error: "Thiếu thông tin tập phim, phụ đề hoặc ngôn ngữ." });
  }

  const taskKey = `${episodeId}_${targetLang.toLowerCase()}`;

  try {
    // 1. KIỂM TRA CACHE TRONG DATABASE TRƯỚC
    const episode = await prisma.episode.findUnique({
      where: { id: episodeId },
      select: { dubbedLanguages: true },
    });

    if (!episode) {
      return res.status(404).json({ error: "Không tìm thấy tập phim." });
    }

    if (episode.dubbedLanguages.includes(targetLang)) {
      return res.status(200).json({ message: "Bản lồng tiếng đã có sẵn (Loaded from cache)!" });
    }

    // 2. KIỂM TRA TIẾN TRÌNH ĐANG CHẠY (REQUEST COALESCING)
    let dubPromise = pendingDubs.get(taskKey);

    if (!dubPromise) {
      dubPromise = (async () => {
        // 2.1. Tải file VTT
        const vttResponse = await axios.get(subtitleUrl);
        let vttContent = vttResponse.data;

        // Áp dụng hàm dọn dẹp trước khi parse
        vttContent = sanitizeVtt(vttContent);

        // Bỏ qua các lỗi định dạng lặt vặt
        const parsedVtt = parse(vttContent, { strict: false });

        // 2.2. Chọn giọng đọc (Voice)
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

        // 2.3. Khởi tạo đối tượng TTS với định dạng MP3 chất lượng cao
        const tts = new MsEdgeTTS();
        await tts.setMetadata(voiceName, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);

        // 2.4. Vòng lặp: Đọc từng câu và up thẳng lên Cloudflare R2
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
            console.error(`Lỗi đọc câu index ${index}:`, err);
          }
        }

        // 2.5. Cập nhật Database
        await prisma.episode.update({
          where: { id: episodeId },
          data: {
            dubbedLanguages: {
              push: targetLang,
            },
          },
        });
      })();

      // Lưu Promise vào Map
      pendingDubs.set(taskKey, dubPromise);

      // Xóa khỏi Map khi chạy xong (thành công hoặc lỗi)
      dubPromise.finally(() => {
        pendingDubs.delete(taskKey);
      });
    } else {
      console.log(`⏳ [Generate Dub] Đang gộp yêu cầu vào tiến trình lồng tiếng sẵn có: ${taskKey}`);
    }

    // 3. Các user bấm cùng lúc đều chờ chung 1 Promise này
    await dubPromise;

    return res.status(200).json({ message: "Tạo lồng tiếng thành công!" });
  } catch (error) {
    console.error("Lỗi khi parse file hoặc tạo lồng tiếng:", error);
    return res.status(500).json({ error: "Lỗi hệ thống khi tạo lồng tiếng" });
  }
});

export default router;