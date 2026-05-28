import express, { Request, Response } from 'express';
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const router = express.Router();

// Khởi tạo Client kết nối với Cloudflare R2
const s3Client = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT as string,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID as string,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY as string,
  },
  forcePathStyle: true,
  requestChecksumCalculation: "WHEN_REQUIRED",
  responseChecksumValidation: "WHEN_REQUIRED",
});

// API Cấp link Upload (Presigned URL)
router.post('/api/admin/get-upload-url', async (req: Request, res: Response): Promise<any> => {
  /* ... Paste ruột API Tạo Presigned URL vào đây ... */
  try {
      const { fileName, fileType } = req.body;
      
      // Tạo một tên file unique tránh trùng lặp khi up lên R2
      const uniqueFileName = `${Date.now()}-${fileName.replace(/\s+/g, '-')}`;
  
      const command = new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME as string,
        Key: uniqueFileName,
        //ContentType: fileType, // Khai báo chuẩn loại file (video/mp4, text/vtt...)
      });
  
      // Tạo link upload có thời hạn 15 phút (900 giây)
      const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 900 });
      
      // Link public để lát nữa lưu vào Database
      const publicUrl = `${process.env.R2_PUBLIC_DOMAIN}/${uniqueFileName}`;
  
      res.status(200).json({ uploadUrl, publicUrl });
    } catch (error) {
      console.error("Lỗi tạo Presigned URL:", error);
      res.status(500).json({ message: "Lỗi tạo link upload Cloudflare R2." });
    }
});

export default router;