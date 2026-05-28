import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import cors from "cors";

// Nhúng các file Router đã được tách từ thư mục routes
import authRoutes from './routes/auth.routes';
import mangaRoutes from './routes/manga.routes';
import animeRoutes from './routes/anime.routes';
import userRoutes from './routes/user.routes';
import uploadRoutes from './routes/upload.routes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// ============================================
// CẤU HÌNH MIDDLEWARE
// ============================================
app.use(cors({ origin: "*", methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"] }));
app.use(express.json());

// ============================================
// ĐĂNG KÝ CÁC ĐƯỜNG DẪN ROUTER (ROUTES)
// ============================================

// 1. Nhóm API Xác thực (Auth)
// Vì ta dùng '/api/auth' ở đây, các API bên trong file auth.routes chỉ cần viết '/login', '/register'...
app.use('/api/auth', authRoutes);

// 2. Nhóm API Manga & Chapter (Admin + Public)
// Các file này giữ nguyên đường dẫn đầy đủ từ file cũ nên ta truyền gốc là '/'
app.use('/', mangaRoutes);

// 3. Nhóm API Anime & Episode (Admin + Public)
app.use('/', animeRoutes);

// 4. Nhóm API Tương tác Người dùng (Rating, Comment, History, Watch/Read list)
app.use('/', userRoutes);

// 5. Nhóm API Upload File (Cloudflare R2)
app.use('/', uploadRoutes);

// ============================================
// ROUTE MẶC ĐỊNH & KHỞI ĐỘNG SERVER
// ============================================

// Một route nhỏ để bạn dễ dàng test trên trình duyệt xem backend đã chạy lên chưa
app.get('/', (req: Request, res: Response) => {
  res.send('Smart Anime Platform API is running perfectly! 🚀');
});

// Lắng nghe cổng
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  console.log('Tất cả các route đã được tách file và nạp thành công!');
});