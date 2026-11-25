import express, { Request, Response } from 'express';
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const router = express.Router();

// Initialize the client to connect with Cloudflare R2.
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

// API to generate a presigned URL for uploading files to Cloudflare R2.
router.post('/api/admin/get-upload-url', async (req: Request, res: Response): Promise<any> => {
  try {
      const { fileName, fileType } = req.body;
      
      // Create a unique filename to avoid duplication when uploading to R2.
      const uniqueFileName = `${Date.now()}-${fileName.replace(/\s+/g, '-')}`;
  
      const command = new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME as string,
        Key: uniqueFileName,
        //ContentType: fileType, // Declare the file type (video/mp4, text/vtt, etc.)
      });
  
      // Create an upload link with a 15-minute (900-second) time limit.
      const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 900 });
      
      // This is a public link to save to the database later.
      const publicUrl = `${process.env.R2_PUBLIC_DOMAIN}/${uniqueFileName}`;
  
      res.status(200).json({ uploadUrl, publicUrl });
    } catch (error) {
      console.error("Error creating Presigned URL:", error);
      res.status(500).json({ message: "Error creating upload link for Cloudflare R2." });
    }
});

export default router;