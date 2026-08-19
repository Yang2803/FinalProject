import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import cors from "cors";

// 🌟 1. IMPORT MODULE HTTP VÀ SOCKET.IO
import http from 'http';
import { Server } from 'socket.io';

// Nhúng các file Router đã được tách từ thư mục routes
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

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// 🌟 2. TẠO SERVER HTTP TỪ APP EXPRESS VÀ GẮN SOCKET VÀO
const server = http.createServer(app);
// Cấu hình Socket.io cho phép Frontend (ví dụ đang chạy ở cổng 3000) được phép kết nối
const io = new Server(server, {
  cors: {
    origin: "*", // Trong thực tế khi deploy, hãy đổi "*" thành domain Frontend của cậu
    methods: ["GET", "POST"]
  }
});

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

//6. Nhóm API Chat với AI (Lưu trữ session, tin nhắn, gọi Gemini...)
app.use('/', chatRoutes);

//7. Nhóm API Tìm kiếm
app.use('/', searchRoutes);

//8. Nhóm API Tạo lồng tiếng
app.use('/', dubRoutes);

//9. Nhóm API Auto-fill thông tin tập phim bằng AI
app.use('/', adminEpisodeRoutes);

//10. Nhóm API Auto-fill thông tin chapter manga bằng AI
app.use('/', adminChapterRoutes);

//11. Nhóm API Forum
app.use('/', forumRoutes);

//12. Nhóm API Community
app.use('/', communityRoutes);

//13. Nhóm API Notification
app.use('/', notificationRoutes);

//14. Nhóm API Watch Party
app.use('/api/party', partyRoutes);

// ============================================
// 🌟 3. TRẠM THU PHÁT TÍN HIỆU SOCKET.IO (WATCH PARTY)
// ============================================
io.on("connection", (socket) => {
  console.log(`🔌 Một thiết bị vừa kết nối Socket: ${socket.id}`);

  // 1. NHẬN LỆNH GIA NHẬP PHÒNG
  socket.on("join_room", (roomId: string, userName: string) => {
    socket.join(roomId); // Đưa user này vào một "kênh" riêng biệt của phòng đó
    console.log(`👤 ${userName} đã tham gia phòng: ${roomId}`);
    
    // Bắn thông báo cho các người khác trong phòng biết có người mới vào (Tùy chọn)
    socket.to(roomId).emit("receive_message", {
      sender: "Hệ thống",
      text: `${userName} vừa tham gia phòng!`,
      isSystemMsg: true
    });
  });

  // ============================================
  // 🌟 ĐÃ THÊM TẠI ĐÂY: HỆ THỐNG DUYỆT THÀNH VIÊN REAL-TIME
  // ============================================

  // Nhận tín hiệu có người gửi yêu cầu xin vào phòng -> Báo cho Trưởng phòng
  socket.on("new_join_request", (data: { roomId: string }) => {
    socket.to(data.roomId).emit("receive_join_request", data);
  });

  // Nhận tín hiệu Trưởng phòng đã duyệt/từ chối -> Báo lại cho người xin vào
  socket.on("send_approve_result", (data: { roomId: string, targetUserId: string, action: string }) => {
    socket.to(data.roomId).emit("receive_approve_result", data);
  });

  // 2. NHẬN VÀ PHÁT TIN NHẮN CHAT REALTIME
  socket.on("send_message", (data: { roomId: string, sender: string, text: string }) => {
    // Gửi tin nhắn này cho TẤT CẢ mọi người trong phòng (Ngoại trừ người vừa gửi)
    socket.to(data.roomId).emit("receive_message", {
      sender: data.sender,
      text: data.text,
      isSystemMsg: false
    });
  });

  // 3. ĐỒNG BỘ ĐIỀU KHIỂN VIDEO (Tín hiệu từ Trưởng phòng)
  // Data sẽ chứa action (play, pause, seek) và mốc thời gian (currentTime)
  socket.on("sync_video", (data: { roomId: string, action: string, currentTime: number }) => {
    // Bắn tín hiệu ép các máy khác trong phòng phải làm theo
    socket.to(data.roomId).emit("receive_video_sync", {
      action: data.action,
      currentTime: data.currentTime
    });
  });

  // 3.5 BÁO HIỆU ĐỔI PHIM
  socket.on("change_video", (roomId: string) => {
    // Bắn lệnh yêu cầu tất cả người trong phòng tải lại trang để load video mới
    socket.to(roomId).emit("receive_video_change");
  });

  // 4. NHẬN LỆNH RỜI PHÒNG
  socket.on("leave_room", (roomId: string, userName: string) => {
    socket.leave(roomId);
    socket.to(roomId).emit("receive_message", {
      sender: "Hệ thống",
      text: `${userName} đã rời phòng.`,
      isSystemMsg: true
    });
  });

  // NHẬN LỆNH GIẢI TÁN PHÒNG TỪ TRƯỞNG PHÒNG
  socket.on("disband_room", (roomId: string) => {
    // Ép tất cả các thành viên đang ở trong phòng này (trừ host) nhận lệnh giải tán
    socket.to(roomId).emit("receive_disband_room");
  });

  // 5. XỬ LÝ KHI NGƯỜI DÙNG TẮT TRÌNH DUYỆT ĐỘT NGỘT
  socket.on("disconnect", () => {
    console.log(`🔌 Thiết bị đã ngắt kết nối: ${socket.id}`);
    // Ở những bước nâng cao hơn, chúng ta có thể check xem socket.id này thuộc user nào 
    // để cập nhật DB trạng thái "Đã out" và nhường quyền Trưởng phòng nếu cần.
  });
});

// ============================================
// ROUTE MẶC ĐỊNH & KHỞI ĐỘNG SERVER
// ============================================

// Một route nhỏ để bạn dễ dàng test trên trình duyệt xem backend đã chạy lên chưa
app.get('/', (req: Request, res: Response) => {
  res.send('Smart Anime Platform API is running perfectly! 🚀');
});

// 🌟 4. THAY ĐỔI CUỐI CÙNG: DÙNG server.listen THAY VÌ app.listen
server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  console.log('Tất cả các route và Socket.io đã được nạp thành công!');
});