import express from 'express';

// 1. Thêm dòng "bùa chú" này để TS bỏ qua lỗi thiếu type của node-webvtt
// @ts-ignore
import { parse } from 'node-webvtt';

// 2. Import thư viện chuẩn xịn của Microsoft Edge TTS
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

router.post('/api/anime/generate-dub', async (req, res) => {
  const { episodeId, subtitleUrl, targetLang } = req.body; 
  
  try {
    // 1. Tải và parse file VTT
    const vttResponse = await axios.get(subtitleUrl);
    const parsedVtt = parse(vttResponse.data); 
    
    // 2. Chọn giọng đọc (Voice)
   // =================================================================
    // BỘ TỪ ĐIỂN ÁNH XẠ ĐỒNG BỘ 100% VỚI SUPPORTED_LANGUAGES Ở FRONTEND
    // =================================================================
    const voiceMappings: Record<string, string> = {
      "Vietnamese": "vi-VN-HoaiMyNeural",
      "Japanese": "ja-JP-NanamiNeural",
      "Korean": "ko-KR-SunHiNeural",
      "Chinese (Simplified)": "zh-CN-XiaoxiaoNeural",
      "Chinese (Traditional)": "zh-TW-HsiaoChenNeural",
      "Thai": "th-TH-PremwadeeNeural",
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
      "Swedish": "sv-SE-SofieNeural"
    };

    // Mặc định an toàn: Nếu có lỗi rớt mạng hoặc truyền sai, dùng Tiếng Anh
    let voiceName = 'en-US-AriaNeural'; 

    // Thuật toán quét: Kiểm tra xem targetLang (VD: "Vietnamese (Auto)") 
    // có chứa cái tên gốc (VD: "Vietnamese") hay không.
    for (const [langCode, voiceId] of Object.entries(voiceMappings)) {
      if (targetLang.includes(langCode)) {
        voiceName = voiceId;
        break; // Tìm thấy phát là chốt đơn, thoát vòng lặp ngay!
      }
    }
    // =================================================================

    // 3. Khởi tạo đối tượng TTS với định dạng MP3 chất lượng cao
    const tts = new MsEdgeTTS();
    await tts.setMetadata(voiceName, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);

    // 4. Vòng lặp: Đọc từng câu và up thẳng lên Cloudflare R2
    for (let index = 0; index < parsedVtt.cues.length; index++) {
      const cue = parsedVtt.cues[index];
      const cleanText = cue.text.replace(/<[^>]+>/g, ''); 
      
      if (!cleanText.trim()) continue;

      try {
       // Sinh âm thanh dưới dạng Stream. BÓC TÁCH lấy đúng audioStream
        const { audioStream } = tts.toStream(cleanText);
        
        // Đóng gói Stream thành Buffer (Khối dữ liệu) để up lên R2
        const chunks: any[] = [];
        for await (const chunk of audioStream) { // Thay đổi ở đây
          chunks.push(chunk);
        }
        const audioBuffer = Buffer.concat(chunks);

        // Upload lên R2
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

    // 5. Cập nhật Database
    await prisma.episode.update({
      where: { id: episodeId },
      data: {
        dubbedLanguages: {
          push: targetLang,
        }
      }
    });

    res.status(200).json({ message: "Tạo lồng tiếng thành công!" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Lỗi hệ thống" });
  }
});

export default router;