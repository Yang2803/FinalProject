import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import nodemailer from "nodemailer";
import crypto from "crypto";
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import cors from "cors";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";



dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(cors({ origin: "*", methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"] }));
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



// ================= API UPDLOAD MANGA =================
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

// 1. API: Lấy chi tiết 1 Manga và tất cả các Chapter của nó
app.get('/api/admin/manga/:id', async (req: Request, res: Response): Promise<any> => {
  try {
    const id = req.params.id as string;
    const manga = await prisma.manga.findUnique({
      where: { id },
      include: {
        chapters: {
          orderBy: { createdAt: 'desc' } // Chương mới lên đầu
        }
      }
    });

    if (!manga) return res.status(404).json({ message: "Không tìm thấy bộ truyện này!" });
    res.status(200).json(manga);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Lỗi server khi tải chi tiết truyện." });
  }
});

// 2. API: Cập nhật thông tin truyện (SỬA)
app.put('/api/admin/manga/:id', async (req: Request, res: Response): Promise<any> => {
  try {
    const id = req.params.id as string;
    const { title, author, coverImage, status, description } = req.body;

    const updatedManga = await prisma.manga.update({
      where: { id },
      data: { title, author, coverImage, status, description }
    });

    res.status(200).json({ message: "Cập nhật thông tin truyện thành công!", manga: updatedManga });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Lỗi server khi cập nhật truyện." });
  }
});

// 3. API: Xóa truyện (XÓA)
app.delete('/api/admin/manga/:id', async (req: Request, res: Response): Promise<any> => {
  try {
    const id = req.params.id as string;

    // Vì schema đã cấu hình onDelete: Cascade nên khi xóa Manga, toàn bộ Chapter thuộc về nó sẽ tự động bị xóa sạch trong DB
    await prisma.manga.delete({ where: { id } });

    res.status(200).json({ message: "Đã xóa bộ truyện và toàn bộ chương liên quan thành công!" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Lỗi server khi xóa truyện." });
  }
});



// ==========================================
// API QUẢN LÝ CHƯƠNG TRUYỆN (CHAPTER)
// ==========================================
// API: Lấy chi tiết 1 Chapter (Dành cho Admin)
app.get('/api/admin/chapter/:id', async (req: Request, res: Response): Promise<any> => {
  try {
    const id = req.params.id as string;
    const chapter = await prisma.chapter.findUnique({ where: { id } });
    if (!chapter) return res.status(404).json({ message: "Không tìm thấy chương truyện này!" });
    res.status(200).json(chapter);
  } catch (error) {
    res.status(500).json({ message: "Lỗi server khi tải thông tin chương." });
  }
});
// 1. API: sửa chương truyện (SỬA)
app.put('/api/admin/chapter/:id', async (req: Request, res: Response): Promise<any> => {
  try {
    const id = req.params.id as string;
    const { title, images } = req.body; // Nhận thêm biến images từ Frontend

    if (!title) {
      return res.status(400).json({ message: "Tên chương không được để trống!" });
    }

    const updatedChapter = await prisma.chapter.update({
      where: { id },
      data: { 
        title,
        ...(images && { images }) // Nếu frontend có gửi mảng ảnh mới thì cập nhật, không thì thôi
      }
    });

    res.status(200).json({ message: "Cập nhật chương truyện thành công!", chapter: updatedChapter });
  } catch (error) {
    console.error("Lỗi khi sửa chương:", error);
    res.status(500).json({ message: "Lỗi server khi cập nhật chương." });
  }
});

// 2. API: Xóa chương truyện (XÓA)
app.delete('/api/admin/chapter/:id', async (req: Request, res: Response): Promise<any> => {
  try {
    const id = req.params.id as string;
    
    await prisma.chapter.delete({
      where: { id }
    });

    res.status(200).json({ message: "Đã xóa chương truyện thành công!" });
  } catch (error) {
    console.error("Lỗi khi xóa chương:", error);
    res.status(500).json({ message: "Lỗi server khi xóa chương." });
  }
});


// ==========================================
// API PUBLIC (DÀNH CHO NGƯỜI DÙNG)
// ==========================================

// 1. Lấy danh sách toàn bộ Manga (Hiển thị trang chủ / trang danh sách)
app.get('/api/manga', async (req: Request, res: Response) => {
  try {
    const mangas = await prisma.manga.findMany({
      orderBy: { createdAt: 'desc' } // Mới nhất lên đầu
    });
    res.status(200).json(mangas);
  } catch (error) {
    res.status(500).json({ message: "Lỗi server khi tải danh sách truyện." });
  }
});

// 2. Lấy chi tiết 1 Manga kèm danh sách Chapter
app.get('/api/manga/:id', async (req: Request, res: Response): Promise<any> => {
  try {
    const id = req.params.id as string;
    const manga = await prisma.manga.findUnique({
      where: { id },
      include: {
        chapters: {
          orderBy: { createdAt: 'desc' } // Chương mới nhất lên đầu để user dễ theo dõi
        }
      }
    });

    if (!manga) return res.status(404).json({ message: "Không tìm thấy bộ truyện!" });
    res.status(200).json(manga);
  } catch (error) {
    res.status(500).json({ message: "Lỗi server khi tải chi tiết truyện." });
  }
});

// 3. Lấy chi tiết nội dung 1 Chapter (Dành cho Trang đọc truyện)
app.get('/api/chapter/:chapterId', async (req: Request, res: Response): Promise<any> => {
  try {
    const chapterId = req.params.chapterId as string;
    
    // Tìm chương truyện, lấy kèm theo thông tin của Manga chứa nó (để hiển thị tên truyện lên thanh Navbar)
    const chapter = await prisma.chapter.findUnique({
      where: { id: chapterId },
      include: {
        manga: {
          select: { title: true } // Chỉ lấy tên truyện cho nhẹ
        }
      }
    });

    if (!chapter) return res.status(404).json({ message: "Không tìm thấy chương truyện này!" });
    
    res.status(200).json(chapter);
  } catch (error) {
    res.status(500).json({ message: "Lỗi server khi tải nội dung chương truyện." });
  }
});

// ==========================================
// API TƯƠNG TÁC: RATING VÀ COMMENT
// ==========================================

// 1. Gửi hoặc Cập nhật Rating
app.post('/api/rating', async (req: Request, res: Response): Promise<any> => {
  try {
    const { userId, mangaId, score } = req.body;
    if (!userId || !mangaId || !score) return res.status(400).json({ message: "Thiếu dữ liệu!" });

    // Dùng upsert: Nếu user đã rate rồi thì update điểm mới, chưa thì tạo mới
    const rating = await prisma.rating.upsert({
      where: { userId_mangaId: { userId, mangaId } },
      update: { score },
      create: { userId, mangaId, score }
    });

    res.status(200).json({ message: "Cảm ơn bạn đã đánh giá!", rating });
  } catch (error) {
    res.status(500).json({ message: "Lỗi server khi đánh giá." });
  }
});

// Lấy thông tin Rating của 1 truyện (Bao gồm Trung bình, Tổng số, và Điểm của User)
app.get('/api/rating/:mangaId', async (req: Request, res: Response): Promise<any> => {
  try {
    const mangaId = req.params.mangaId as string;
    const { userId } = req.query; // Nhận userId từ Frontend (nếu user đã đăng nhập)

    // 1. Nhờ DB tính điểm trung bình (_avg) và tổng số lượt đánh giá (_count)
    const aggregations = await prisma.rating.aggregate({
      _avg: { score: true },
      _count: { score: true },
      where: { mangaId }
    });

    // Làm tròn 1 chữ số thập phân (VD: 4.5). Nếu chưa ai đánh giá thì mặc định là 0.
    const average = aggregations._avg.score ? Number(aggregations._avg.score.toFixed(1)) : 0;
    const count = aggregations._count.score;

    // 2. Phục hồi điểm của User hiện tại (Để tô vàng lại ngôi sao)
    let userScore = 0;
    if (userId) {
      const userRating = await prisma.rating.findUnique({
        where: { userId_mangaId: { userId: String(userId), mangaId } }
      });
      if (userRating) userScore = userRating.score;
    }

    res.status(200).json({ average, count, userScore });
  } catch (error) {
    console.error("Lỗi tải thống kê rating:", error);
    res.status(500).json({ message: "Lỗi server khi tải rating." });
  }
});

// ==========================================
// API BÌNH LUẬN DÙNG CHUNG (MANGA, CHAPTER, ANIME, EPISODE)
// ==========================================

// 1. LẤY DANH SÁCH BÌNH LUẬN
app.get('/api/comments', async (req: Request, res: Response) => {
  try {
    const { mangaId, chapterId, animeId, episodeId } = req.query;

    // Tự động xây dựng bộ lọc dựa trên URL Frontend gửi lên
    const whereClause: any = {};
    if (mangaId) whereClause.mangaId = mangaId as string;
    if (chapterId) whereClause.chapterId = chapterId as string;
    if (animeId) whereClause.animeId = animeId as string;
    if (episodeId) whereClause.episodeId = episodeId as string;

    const comments = await prisma.comment.findMany({
      where: whereClause,
      include: { user: { select: { name: true, email: true } } },
      orderBy: { createdAt: 'desc' }
    });
    res.status(200).json(comments);
  } catch (error) {
    res.status(500).json({ message: "Lỗi tải bình luận" });
  }
});

// 2. GỬI BÌNH LUẬN MỚI
app.post('/api/comments', async (req: Request, res: Response): Promise<any> => {
  try {
    // Nhận tất cả các loại ID có thể có
    const { userId, content, mangaId, chapterId, animeId, episodeId } = req.body;

    // Kiểm tra: Phải có ít nhất 1 trong 4 loại ID này thì mới hợp lệ
    if (!userId || !content || (!mangaId && !chapterId && !animeId && !episodeId)) {
      return res.status(400).json({ message: "Thiếu dữ liệu bắt buộc" });
    }

    const newComment = await prisma.comment.create({
      data: {
        userId,
        content,
        mangaId,
        chapterId,
        animeId,
        episodeId
      },
      include: { user: { select: { name: true, email: true } } }
    });

    res.status(201).json(newComment);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Lỗi đăng bình luận" });
  }
});


// ==========================================
// API QUẢN LÝ DANH SÁCH ĐỌC (READING LIST)
// ==========================================

// 1. API: Kiểm tra xem truyện đã nằm trong danh sách đọc của User chưa
app.get('/api/reading-list/status', async (req: Request, res: Response): Promise<any> => {
  try {
    const userId = req.query.userId as string;
    const mangaId = req.query.mangaId as string;

    if (!userId || !mangaId) {
      return res.status(450).json({ isInList: false });
    }

    const item = await prisma.readingList.findUnique({
      where: {
        userId_mangaId: { userId, mangaId }
      }
    });

    res.status(200).json({ isInList: !!item }); // Trả về true nếu item tồn tại, ngược lại trả về false
  } catch (error) {
    res.status(500).json({ message: "Lỗi kiểm tra danh sách đọc." });
  }
});

// 2. API: Toggle trạng thái (Bấm lần 1: Thêm vào danh sách, Bấm lần 2: Xóa khỏi danh sách)
app.post('/api/reading-list/toggle', async (req: Request, res: Response): Promise<any> => {
  try {
    const { userId, mangaId } = req.body;

    if (!userId || !mangaId) {
      return res.status(400).json({ message: "Thiếu thông tin User ID hoặc Manga ID!" });
    }

    // Kiểm tra xem truyện đã được lưu chưa
    const existingItem = await prisma.readingList.findUnique({
      where: {
        userId_mangaId: { userId, mangaId }
      }
    });

    if (existingItem) {
      // Nếu đã có -> Tiến hành XÓA
      await prisma.readingList.delete({
        where: {
          userId_mangaId: { userId, mangaId }
        }
      });
      return res.status(200).json({ isInList: false, message: "Đã xóa khỏi danh sách đọc!" });
    } else {
      // Nếu chưa có -> Tiến hành THÊM
      await prisma.readingList.create({
        data: { userId, mangaId }
      });
      return res.status(201).json({ isInList: true, message: "Đã thêm vào danh sách đọc!" });
    }
  } catch (error) {
    console.error("Lỗi toggle reading list:", error);
    res.status(500).json({ message: "Lỗi server khi cập nhật danh sách đọc." });
  }
});

// 3. API: Lấy toàn bộ danh sách truyện trong Reading List của một User
app.get('/api/reading-list/:userId', async (req: Request, res: Response): Promise<any> => {
  try {
    const userId = req.params.userId as string;

    const readingList = await prisma.readingList.findMany({
      where: { userId },
      include: {
        manga: true // Lấy kèm luôn toàn bộ thông tin của bộ Manga đó
      },
      orderBy: { createdAt: 'desc' } // Truyện nào vừa thêm vào thì xếp lên đầu
    });

    // Mảng readingList lúc này chứa các object có dạng { id, userId, mangaId, manga: {...} }
    // Ta dùng .map() để bóc lấy mỗi cái lõi 'manga' trả về cho Frontend dễ dùng
    const mangas = readingList.map(item => item.manga);

    res.status(200).json(mangas);
  } catch (error) {
    console.error("Lỗi tải Reading List:", error);
    res.status(500).json({ message: "Lỗi server khi tải danh sách đọc." });
  }
});


// ==========================================
// API LỊCH SỬ HOẠT ĐỘNG (HISTORY)
// ==========================================

// 1. Ghi nhận lịch sử đọc Manga (Gọi ngầm khi user vào đọc 1 chương)
app.post('/api/history/manga', async (req: Request, res: Response): Promise<any> => {
  try {
    const { userId, mangaId, chapterId } = req.body;
    if (!userId || !mangaId || !chapterId) return res.status(400).json({ message: "Thiếu dữ liệu" });

    // Dùng upsert: Đã có lịch sử bộ này thì update chap mới và thời gian, chưa có thì tạo mới
    await prisma.mangaHistory.upsert({
      where: { userId_mangaId: { userId, mangaId } },
      update: { chapterId, updatedAt: new Date() },
      create: { userId, mangaId, chapterId }
    });

    res.status(200).json({ message: "Đã lưu lịch sử đọc" });
  } catch (error) {
    console.error("Lỗi lưu lịch sử:", error);
    res.status(500).json({ message: "Lỗi server" });
  }
});

// 2. Lấy danh sách Lịch sử của User (Hiển thị ở Profile)
app.get('/api/history/:userId', async (req: Request, res: Response): Promise<any> => {
  try {
    const userId = req.params.userId as string;

    // Lấy lịch sử Manga kèm theo thông tin truyện và chương
    const mangaHistory = await prisma.mangaHistory.findMany({
      where: { userId },
      include: {
        manga: { select: { id: true, title: true, coverImage: true } },
        chapter: { select: { id: true, title: true } }
      },
      orderBy: { updatedAt: 'desc' }, // Mới đọc xếp lên đầu
      take: 5 // Chỉ lấy 5 hoạt động gần nhất cho gọn Profile
    });

    const animeHistory = await prisma.animeHistory.findMany({
      where: { userId },
      include: {
        anime: { select: { id: true, title: true, coverImage: true } },
        episode: { select: { id: true, title: true } }
      },
      orderBy: { updatedAt: 'desc' },
      take: 5 
    });

    // Sau này làm Anime, bạn có thể gọi thêm animeHistory và gộp 2 mảng lại tại đây
    res.status(200).json({ mangaHistory, animeHistory });
  } catch (error) {
    console.error("Lỗi lấy lịch sử:", error);
    res.status(500).json({ message: "Lỗi server" });
  }
});


// ==========================================
// API QUẢN LÝ ANIME & EPISODE (ADMIN)
// ==========================================

// 1. Lấy danh sách rút gọn của Anime để đưa vào ô chọn (Dropdown Select)
app.get('/api/admin/anime/list-select', async (req: Request, res: Response) => {
  try {
    const animes = await prisma.anime.findMany({
      select: { id: true, title: true },
      orderBy: { title: 'asc' }
    });
    res.status(200).json(animes);
  } catch (error) {
    res.status(500).json({ message: "Lỗi tải danh sách phim." });
  }
});

// 2. API: Tạo tập phim mới kèm theo mảng phụ đề tương ứng
app.post('/api/admin/episode', async (req: Request, res: Response): Promise<any> => {
  try {
    const { animeId, title, videoUrl, subtitles } = req.body;

    if (!animeId || !title || !videoUrl) {
      return res.status(400).json({ message: "Vui lòng điền đủ thông tin bắt buộc!" });
    }

    // Tiến hành lưu thông tin tập phim và các phụ đề vào DB bằng cơ chế lồng dữ liệu (create Many)
    const newEpisode = await prisma.episode.create({
      data: {
        animeId,
        title,
        videoUrl,
        subtitles: {
          create: subtitles // Mảng object chứa { label, url } gửi từ Frontend lên
        }
      },
      include: { subtitles: true }
    });

    res.status(201).json({ message: "Đăng tập phim mới thành công!", episode: newEpisode });
  } catch (error) {
    console.error("Lỗi đăng tập phim:", error);
    res.status(500).json({ message: "Lỗi server khi lưu tập phim." });
  }
});

// API: Đăng bộ Anime mới
app.post('/api/admin/anime', async (req: Request, res: Response): Promise<any> => {
  try {
    const { title, description, coverImage, author, status } = req.body;

    if (!title) {
      return res.status(400).json({ message: "Tên phim không được để trống!" });
    }

    const newAnime = await prisma.anime.create({
      data: {
        title,
        description,
        coverImage,
        // Nếu bạn đã thêm author và status vào schema.prisma thì bổ sung vào đây
        // author, 
        // status 
      }
    });

    res.status(201).json({ message: "Thêm bộ Anime mới thành công!", anime: newAnime });
  } catch (error) {
    console.error("Lỗi khi thêm Anime:", error);
    res.status(500).json({ message: "Lỗi server khi thêm phim mới." });
  }
});

// 3. API: Lấy danh sách toàn bộ Anime cho trang Quản trị
app.get('/api/admin/anime', async (req: Request, res: Response) => {
  try {
    const animes = await prisma.anime.findMany({
      orderBy: { createdAt: 'desc' }, // Phim mới thêm lên đầu
      include: {
        _count: {
          select: { episodes: true } // Đếm số lượng tập phim để hiển thị cho Admin dễ quản lý
        }
      }
    });
    res.status(200).json(animes);
  } catch (error) {
    res.status(500).json({ message: "Lỗi server khi tải danh sách Anime." });
  }
});

// 4. API: Xóa bộ Anime (Sẽ tự động xóa luôn các Episode và Subtitle bên trong nhờ onDelete: Cascade)
app.delete('/api/admin/anime/:id', async (req: Request, res: Response): Promise<any> => {
  try {
    const id = req.params.id as string;
    await prisma.anime.delete({
      where: { id }
    });
    res.status(200).json({ message: "Đã xóa bộ phim thành công!" });
  } catch (error) {
    console.error("Lỗi xóa Anime:", error);
    res.status(500).json({ message: "Lỗi server khi xóa phim." });
  }
});


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
app.post('/api/admin/get-upload-url', async (req: Request, res: Response): Promise<any> => {
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

// 1. [NÂNG CẤP] API: Lấy chi tiết 1 bộ Anime kèm danh sách tập phim đã đăng
app.get('/api/admin/anime/:id', async (req: Request, res: Response): Promise<any> => {
  try {
    const animeId = req.params.id as string;
    
    const anime = await prisma.anime.findUnique({
      where: { id: animeId },
      include: {
        episodes: {
          orderBy: { createdAt: 'asc' } // Sắp xếp tập phim từ cũ đến mới (Tập 1, 2, 3...)
        }
      }
    });
    
    if (!anime) return res.status(404).json({ message: "Không tìm thấy bộ Anime yêu cầu" });
    res.status(200).json(anime);
  } catch (error) {
    res.status(500).json({ message: "Lỗi tải thông tin phim." });
  }
});

// 2. [THÊM MỚI] API: Chỉnh sửa thông tin phim (Sửa Tên, Mô tả, Ảnh bìa)
app.put('/api/admin/anime/:id', async (req: Request, res: Response): Promise<any> => {
  try {
    const animeId = req.params.id as string;
    const { title, description, coverImage } = req.body;

    if (!title) return res.status(400).json({ message: "Tên phim không được để trống!" });

    const updatedAnime = await prisma.anime.update({
      where: { id: animeId },
      data: { title, description, coverImage }
    });

    res.status(200).json({ message: "Cập nhật bộ Anime thành công!", anime: updatedAnime });
  } catch (error) {
    console.error("Lỗi cập nhật Anime:", error);
    res.status(500).json({ message: "Lỗi server khi cập nhật phim." });
  }
});

// 1. API: Xóa tập phim
app.delete('/api/admin/episode/:id', async (req: Request, res: Response): Promise<any> => {
  try {
    const episodeId = req.params.id as string;
    await prisma.episode.delete({
      where: { id: episodeId }
    });
    res.status(200).json({ message: "Xóa tập phim thành công!" });
  } catch (error) {
    console.error("Lỗi xóa tập phim:", error);
    res.status(500).json({ message: "Lỗi server khi xóa tập phim." });
  }
});

// 2. API: Lấy chi tiết 1 tập phim (Dùng cho trang Edit)
app.get('/api/admin/episode-detail/:id', async (req: Request, res: Response): Promise<any> => {
  try {
    const episodeId = req.params.id as string;
    const episode = await prisma.episode.findUnique({
      where: { id: episodeId },
      include: { subtitles: true }
    });
    if (!episode) return res.status(404).json({ message: "Không tìm thấy tập phim" });
    res.status(200).json(episode);
  } catch (error) {
    res.status(500).json({ message: "Lỗi tải thông tin tập phim." });
  }
});

// 3. API: Cập nhật tập phim (Đổi tên hoặc Đổi link video)
app.put('/api/admin/episode/:id', async (req: Request, res: Response): Promise<any> => {
  try {
    const episodeId = req.params.id as string;
    const { title, videoUrl, newSubtitles } = req.body;

    const updatedEpisode = await prisma.episode.update({
      where: { id: episodeId },
      data: {
        title,
        ...(videoUrl && { videoUrl }) // Nếu có videoUrl mới gửi lên thì mới update trường này
      }
    });

    // 2. Xử lý phụ đề: Nếu Frontend có gửi mảng phụ đề mới lên -> Thay thế toàn bộ
    if (newSubtitles && newSubtitles.length > 0) {
      // Xóa sạch phụ đề cũ của tập này
      await prisma.subtitle.deleteMany({
        where: { episodeId: episodeId }
      });
      // Tạo các phụ đề mới
      await prisma.subtitle.createMany({
        data: newSubtitles.map((sub: any) => ({
          label: sub.label,
          url: sub.url,
          episodeId: episodeId
        }))
      });
    }

    res.status(200).json({ message: "Cập nhật tập phim thành công!", episode: updatedEpisode });
  } catch (error) {
    console.error("Lỗi cập nhật tập phim:", error);
    res.status(500).json({ message: "Lỗi server khi cập nhật tập phim." });
  }
});


// ==========================================
// API AINME DÀNH CHO USER (PUBLIC)
// ==========================================

// 1. Lấy danh sách tất cả Anime (Mới nhất lên đầu)
app.get('/api/anime', async (req: Request, res: Response) => {
  try {
    const animes = await prisma.anime.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { episodes: true } }
      }
    });
    res.status(200).json(animes);
  } catch (error) {
    res.status(500).json({ message: "Lỗi tải danh sách phim." });
  }
});

// 2. Lấy chi tiết 1 bộ Anime kèm toàn bộ Tập phim và Phụ đề
app.get('/api/anime/:id', async (req: Request, res: Response): Promise<any> => {
  try {
    const animeId = req.params.id as string;
    const anime = await prisma.anime.findUnique({
      where: { id: animeId },
      include: {
        episodes: {
          orderBy: { createdAt: 'asc' }, // Sắp xếp Tập 1, Tập 2...
          include: { subtitles: true }   // Lấy luôn phụ đề để xem
        }
      }
    });
    
    if (!anime) return res.status(404).json({ message: "Không tìm thấy bộ phim" });
    res.status(200).json(anime);
  } catch (error) {
    res.status(500).json({ message: "Lỗi tải thông tin phim." });
  }
});

// ==========================================
// API ANIME RATING & COMMENT
// ==========================================

// ==========================================
// API RATING ANIME (ĐÁNH GIÁ SAO)
// ==========================================

// 1. POST: Gửi hoặc Cập nhật đánh giá (Upsert)
app.post('/api/rating/anime', async (req: Request, res: Response): Promise<any> => {
  try {
    const { userId, animeId, score } = req.body;
    if (!userId || !animeId || !score) return res.status(400).json({ message: "Thiếu dữ liệu" });

    // Dùng lệnh upsert: Có rồi thì update điểm mới, chưa có thì tạo mới
    const rating = await prisma.animeRating.upsert({
      where: {
        userId_animeId: { userId, animeId } // Nhờ có @@unique trong schema mới dùng được dòng này
      },
      update: { score },
      create: { userId, animeId, score }
    });

    res.status(200).json({ message: "Đánh giá thành công", rating });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Lỗi lưu đánh giá" });
  }
});

// 2. GET: Lấy điểm trung bình và điểm của User hiện tại
app.get('/api/rating/anime/:id', async (req: Request, res: Response) => {
  try {
    const animeId = req.params.id as string;
    const userId = req.query.userId as string | undefined;

    // Tính toán điểm trung bình và tổng số lượt đánh giá tự động bằng Prisma
    const aggregations = await prisma.animeRating.aggregate({
      _avg: { score: true },
      _count: { score: true },
      where: { animeId }
    });

    let userScore = 0;
    // Nếu Frontend có gửi kèm userId, tìm xem user này đã chấm mấy điểm để tô màu vàng
    if (userId) {
      const userRating = await prisma.animeRating.findUnique({
        where: { userId_animeId: { userId, animeId } }
      });
      if (userRating) userScore = userRating.score;
    }

    res.status(200).json({
      average: aggregations._avg.score ? Number(aggregations._avg.score.toFixed(1)) : 0,
      count: aggregations._count.score,
      userScore
    });
  } catch (error) {
    res.status(500).json({ message: "Lỗi tải thông tin đánh giá" });
  }
});

// ==========================================
// API WATCHLIST (DANH SÁCH XEM ANIME)
// ==========================================

// 1. POST: Bật/Tắt danh sách xem (Toggle)
app.post('/api/watchlist/toggle', async (req: Request, res: Response): Promise<any> => {
  try {
    const { userId, animeId } = req.body;
    if (!userId || !animeId) return res.status(400).json({ message: "Thiếu dữ liệu" });

    // Kiểm tra xem phim đã có trong danh sách của user này chưa
    const existingItem = await prisma.watchList.findUnique({
      where: { userId_animeId: { userId, animeId } }
    });

    if (existingItem) {
      // Nếu có rồi -> Bấm là Xóa
      await prisma.watchList.delete({ where: { id: existingItem.id } });
      res.status(200).json({ isInList: false, message: "Đã xóa khỏi danh sách xem" });
    } else {
      // Nếu chưa có -> Bấm là Thêm
      await prisma.watchList.create({ data: { userId, animeId } });
      res.status(200).json({ isInList: true, message: "Đã thêm vào danh sách xem" });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Lỗi thao tác danh sách xem" });
  }
});

// 2. GET: Kiểm tra trạng thái hiện tại (Đã thêm hay chưa)
app.get('/api/watchlist/status', async (req: Request, res: Response): Promise<any> => {
  try {
    const userId = req.query.userId as string;
    const animeId = req.query.animeId as string;

    if (!userId || !animeId) return res.status(400).json({ message: "Thiếu dữ liệu" });

    const existingItem = await prisma.watchList.findUnique({
      where: { userId_animeId: { userId, animeId } }
    });

    // Trả về true nếu tìm thấy, false nếu không tìm thấy
    res.status(200).json({ isInList: !!existingItem });
  } catch (error) {
    res.status(500).json({ message: "Lỗi kiểm tra trạng thái" });
  }
});

// 3. GET: Lấy toàn bộ danh sách xem của 1 User
app.get('/api/watchlist/:userId', async (req: Request, res: Response): Promise<any> => {
  try {
    const userId = req.params.userId as string;
    if (!userId) return res.status(400).json({ message: "Thiếu ID người dùng" });

    const watchlists = await prisma.watchList.findMany({
      where: { userId: userId },
      include: {
        anime: {
          include: {
            _count: { select: { episodes: true } } // Lấy luôn tổng số tập phim để hiển thị
          }
        }
      },
      orderBy: { createdAt: 'desc' } // Phim lưu mới nhất sẽ lên đầu
    });

    res.status(200).json(watchlists);
  } catch (error) {
    console.error("Lỗi lấy danh sách xem:", error);
    res.status(500).json({ message: "Lỗi máy chủ khi tải danh sách" });
  }
});

// API Lấy lịch sử Anime


// 4. POST: Lưu hoặc cập nhật lịch sử xem Anime
app.post('/api/history/anime', async (req: Request, res: Response): Promise<any> => {
  try {
    const { userId, animeId, episodeId } = req.body;

    if (!userId || !animeId || !episodeId) {
      return res.status(400).json({ message: "Thiếu thông tin (userId, animeId, episodeId)" });
    }

    const savedHistory = await prisma.animeHistory.upsert({
      where: {
        // Tìm lịch sử dựa trên cặp userId và animeId
        userId_animeId: {
          userId: userId,
          animeId: animeId,
        }
      },
      update: {
        // Đã xem phim này rồi -> Cập nhật lại tập phim mới nhất đang xem
        episodeId: episodeId
        // (Trường updatedAt sẽ được Prisma tự động cập nhật thời gian mới nhất)
      },
      create: {
        // Chưa xem phim này bao giờ -> Tạo dòng lịch sử mới
        userId,
        animeId,
        episodeId
      }
    });

    res.status(200).json({ message: "Đã lưu lịch sử xem", history: savedHistory });
  } catch (error) {
    console.error("Lỗi lưu lịch sử Anime:", error);
    res.status(500).json({ message: "Lỗi máy chủ khi lưu lịch sử" });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});