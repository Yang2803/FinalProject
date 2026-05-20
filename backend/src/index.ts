import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import nodemailer from "nodemailer";
import crypto from "crypto";
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// ================= API AUTH =================

// 1. API Đăng ký (Sign Up)
app.post('/api/auth/register', async (req: Request, res: Response): Promise<any> => {
  try {
    const { email, password, name } = req.body;

    // Kiểm tra user tồn tại
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ message: 'Email đã được sử dụng!' });
    }

    // Mã hóa mật khẩu
    const hashedPassword = await bcrypt.hash(password, 10);

    // Tạo user mới
    const newUser = await prisma.user.create({
      data: {
        email,
        name,
        password: hashedPassword,
      },
    });

    res.status(201).json({ message: 'Đăng ký thành công!', user: { id: newUser.id, email: newUser.email, name: newUser.name } });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error });
  }
});

// 2. API Đăng nhập (Sign In)
app.post('/api/auth/login', async (req: Request, res: Response): Promise<any> => {
  try {
    const { email, password } = req.body;

    // Tìm user theo email
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.password) {
      return res.status(401).json({ message: 'Email hoặc mật khẩu không đúng!' });
    }

    // So sánh mật khẩu
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Email hoặc mật khẩu không đúng!' });
    }

    // Trả về thông tin user (Không trả về password)
    res.status(200).json({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error });
  }
});

// ============================================

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

// 3. API xử lý đăng nhập bằng Google/Facebook (OAuth)
app.post('/api/auth/oauth', async (req: Request, res: Response): Promise<any> => {
  try {
    const { email, name, avatar, provider } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'Không lấy được email từ provider' });
    }

    // Kiểm tra xem user đã tồn tại chưa
    let user = await prisma.user.findUnique({ where: { email } });

    // Nếu chưa có, tiến hành tạo mới tự động
    if (!user) {
      user = await prisma.user.create({
        data: {
          email,
          name: name || "User Ẩn Danh",
          // Bạn có thể thêm trường avatar vào DB để hứng ảnh: avatar: avatar
          // Không lưu password vì đăng nhập qua mạng xã hội
        },
      });
    }

    // Trả về user để Frontend gán vào token
    res.status(200).json({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    });
  } catch (error) {
    console.error("Lỗi OAuth:", error);
    res.status(500).json({ message: 'Lỗi server khi xử lý OAuth', error });
  }
});

// 1. Cấu hình cấu trúc gửi thư qua Gmail
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "giangnnqgcs230038@fpt.edu.vn", // Điền Gmail của bạn ở đây
    pass: "fqge zcxp tykg ztkj",     // Điền Mật khẩu ứng dụng 16 ký tự vừa lấy vào đây
  },
});

// 2. API 1: Yêu cầu đặt lại mật khẩu (Gửi email chứa Token)
app.post("/api/auth/forgot-password", async (req: Request, res: Response): Promise<any> => {
  try {
    const { email } = req.body;

    // Kiểm tra user có tồn tại không
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(404).json({ message: "Email này không tồn tại trong hệ thống!" });
    }

    // Tạo một chuỗi Token ngẫu nhiên và đặt thời gian hết hạn là 15 phút
    const token = crypto.randomBytes(32).toString("hex");
    const expiry = new Date(Date.now() + 15 * 60 * 1000); 

    // Lưu Token vào database
    await prisma.user.update({
      where: { email },
      data: {
        resetToken: token,
        resetTokenExpiry: expiry,
      },
    });

    // Đường link dẫn đến trang đặt lại mật khẩu ở Frontend kèm theo mã token
    const resetUrl = `http://localhost:3000/reset-password?token=${token}`;

    // Nội dung Email gửi cho người dùng
    const mailOptions = {
      from: '"Smart Anime Platform" <gmail_cua_ban@gmail.com>',
      to: user.email,
      subject: "Yêu cầu đặt lại mật khẩu hệ thống",
      html: `
        <div style="font-family: sans-serif; padding: 20px; color: #333;">
          <h2>Xin chào ${user.name || "bạn"},</h2>
          <p>Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn.</p>
          <p>Vui lòng click vào nút bên dưới để tiến hành đổi mật khẩu mới (Đường link có hiệu lực trong 15 phút):</p>
          <a href="${resetUrl}" style="display: inline-block; padding: 10px 20px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 5px; margin: 15px 0;">Đặt lại mật khẩu</a>
          <p>Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email này.</p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    res.status(200).json({ message: "Liên kết đặt lại mật khẩu đã được gửi vào Email của bạn!" });
  } catch (error) {
    console.error("Lỗi Forgot Password:", error);
    res.status(500).json({ message: "Lỗi server khi xử lý yêu cầu." });
  }
});

// 3. API 2: Thực hiện đặt lại mật khẩu mới
app.post("/api/auth/reset-password", async (req: Request, res: Response): Promise<any> => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ message: "Thiếu thông tin xác thực!" });
    }

    // Tìm user sở hữu token này và kiểm tra xem token còn hạn không
    const user = await prisma.user.findFirst({
      where: {
        resetToken: token,
        resetTokenExpiry: { gt: new Date() }, // Phải lớn hơn thời gian hiện tại
      },
    });

    if (!user) {
      return res.status(400).json({ message: "Mã xác nhận không hợp lệ hoặc đã hết hạn!" });
    }

    // Mã hóa mật khẩu mới
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Cập nhật mật khẩu mới và xóa bỏ Token cũ trong DB
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetToken: null,
        resetTokenExpiry: null,
      },
    });

    res.status(200).json({ message: "Đặt lại mật khẩu thành công! Bạn có thể đăng nhập ngay bây giờ." });
  } catch (error) {
    console.error("Lỗi Reset Password:", error);
    res.status(500).json({ message: "Lỗi server khi đặt lại mật khẩu." });
  }
});




// API: Thêm Manga mới (Chỉ dành cho ADMIN)
app.post('/api/admin/manga', async (req: Request, res: Response): Promise<any> => {
  try {
    // 1. Nhận dữ liệu từ Frontend gửi lên, bao gồm cả userId để check quyền
    const { title, description, author, coverImage, status, userId } = req.body;

    if (!title || !userId) {
      return res.status(400).json({ message: "Thiếu thông tin bắt buộc (Tiêu đề hoặc ID người dùng)!" });
    }

    // 2. Kiểm tra bảo mật: User này có tồn tại không và có phải ADMIN không?
    const user = await prisma.user.findUnique({ where: { id: userId } });
    
    if (!user || user.role !== "ADMIN") {
      return res.status(403).json({ message: "Từ chối truy cập! Chỉ Admin mới có quyền thực hiện hành động này." });
    }

    // 3. Nếu là ADMIN, tiến hành lưu Manga vào Database
    const newManga = await prisma.manga.create({
      data: {
        title,
        description,
        author,
        coverImage,
        status,
      },
    });

    res.status(201).json({ message: "Thêm Manga thành công!", manga: newManga });
  } catch (error) {
    console.error("Lỗi khi thêm Manga:", error);
    res.status(500).json({ message: "Lỗi server khi thêm Manga." });
  }
});

// API: Lấy danh sách toàn bộ Manga (Dành cho Admin)
app.get('/api/admin/manga', async (req: Request, res: Response) => {
  try {
    const mangas = await prisma.manga.findMany({
      orderBy: { createdAt: 'desc' } // Sắp xếp truyện mới nhất lên đầu
    });
    res.status(200).json(mangas);
  } catch (error) {
    console.error("Lỗi khi tải danh sách Manga:", error);
    res.status(500).json({ message: "Lỗi server khi tải danh sách Manga" });
  }
});

// API: Xử lý Upload Chapter mới kèm ảnh từ Frontend
app.post('/api/manga', async (req: Request, res: Response): Promise<any> => {
  try {
    const { mangaTitle, chapterTitle, images } = req.body;

    if (!mangaTitle || !chapterTitle || !images || images.length === 0) {
      return res.status(400).json({ message: "Thiếu thông tin hoặc chưa có ảnh!" });
    }

    // 1. Tìm truyện trong DB xem đã có chưa
    let manga = await prisma.manga.findUnique({
      where: { title: mangaTitle }
    });

    // 2. Nếu truyện chưa tồn tại, tự động tạo truyện mới
    if (!manga) {
      manga = await prisma.manga.create({
        data: {
          title: mangaTitle,
          description: "Đang cập nhật...", // Thông tin phụ có thể sửa ở trang Admin sau
        }
      });
    }

    // 3. Tạo Chương mới và nhét toàn bộ link ảnh Cloudinary vào
    const newChapter = await prisma.chapter.create({
      data: {
        title: chapterTitle,
        images: images, // Prisma tự động hiểu và lưu mảng URL này
        mangaId: manga.id
      }
    });

    res.status(201).json({ 
      message: "Lưu chương truyện thành công!", 
      chapter: newChapter 
    });

  } catch (error) {
    console.error("Lỗi khi lưu Chapter vào Database:", error);
    res.status(500).json({ message: "Lỗi server khi lưu dữ liệu." });
  }
});

// API: Thêm Chapter mới cho một Manga cụ thể
app.post('/api/admin/chapter', async (req: Request, res: Response): Promise<any> => {
  try {
    const { mangaId, title, images } = req.body;

    if (!mangaId || !title || !images || images.length === 0) {
      return res.status(400).json({ message: "Thiếu thông tin hoặc chưa có ảnh!" });
    }

    const newChapter = await prisma.chapter.create({
      data: {
        title: title,
        images: images,
        mangaId: mangaId // Nối chương này vào đúng Manga đã chọn
      }
    });

    res.status(201).json({ message: "Đăng chương mới thành công!", chapter: newChapter });
  } catch (error) {
    console.error("Lỗi khi thêm Chapter:", error);
    res.status(500).json({ message: "Lỗi server khi lưu chương truyện." });
  }
});
