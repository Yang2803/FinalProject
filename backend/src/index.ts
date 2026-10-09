import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import cors from "cors";
import http from 'http';

// 🌟 IMPORT HÀM KHỞI TẠO SOCKET VỪA TÁCH
import { initSocket } from './socket';

// Nhúng các file Router
import authRoutes from './routes/auth.routes';
import mangaRoutes from './routes/manga.routes';
import animeRoutes from './routes/anime.routes';
import userRoutes from './routes/user.routes';
import uploadRoutes from './routes/upload.routes';
import chatRoutes from './routes/chat.routes';
import searchRoutes from './routes/search.routes';
import dubRoutes from './routes/dub.routes';
import adminEpisodeRoutes from './routes/admin-episode.routes';
import adminChapterRoutes from './routes/admin-chapter.routes';
import forumRoutes from './routes/forum.routes';
import communityRoutes from './routes/community.routes';
import notificationRoutes from './routes/notification.routes';
import partyRoutes from './routes/party.routes';
import mangaRoomRoutes from './routes/manga-room.routes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// TẠO HTTP SERVER VÀ NẠP SOCKET
const server = http.createServer(app);
initSocket(server); // 🌟 Khởi tạo toàn bộ Socket.io tại đây chỉ với 1 dòng

// CẤU HÌNH MIDDLEWARE
app.use(cors({ origin: "*", methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"] }));
app.use(express.json());

// ĐĂNG KÝ ROUTES
app.use('/api/auth', authRoutes);
app.use('/', mangaRoutes);
app.use('/', animeRoutes);
app.use('/', userRoutes);
app.use('/', uploadRoutes);
app.use('/', chatRoutes);
app.use('/', searchRoutes);
app.use('/', dubRoutes);
app.use('/', adminEpisodeRoutes);
app.use('/', adminChapterRoutes);
app.use('/', forumRoutes);
app.use('/', communityRoutes);
app.use('/', notificationRoutes);
app.use('/api/party', partyRoutes);
app.use('/api/manga-room', mangaRoomRoutes);

app.get('/', (req: Request, res: Response) => {
  res.send('Smart Anime Platform API is running perfectly! 🚀');
});

server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  console.log('Tất cả các route và Socket.io đã được nạp thành công!');
});