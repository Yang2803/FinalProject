import express, { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import nodemailer from "nodemailer";
import crypto from "crypto";
import prisma from '../config/db'; // Nhúng DB dùng chung vào đây

const router = express.Router();

// Cấu hình gửi mail
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "giangnnqgcs230038@fpt.edu.vn",
    pass: "fqge zcxp tykg ztkj",
  },
});

// Chú ý: Vì lát nữa ở index.ts ta sẽ gán tiền tố '/api/auth' cho file này
// Nên ở đây ta chỉ cần viết '/register' thay vì '/api/auth/register'
router.post('/register', async (req: Request, res: Response): Promise<any> => {
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
  
      res.status(201).json({ message: 'Registration successful!', user: { id: newUser.id, email: newUser.email, name: newUser.name } });
    } catch (error) {
      res.status(500).json({ message: 'Server error', error });
    }
});

router.post('/login', async (req: Request, res: Response): Promise<any> => {
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

router.post('/oauth', async (req: Request, res: Response): Promise<any> => {
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

router.post("/forgot-password", async (req: Request, res: Response): Promise<any> => {
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
        from: '"Smart Anime Platform" <giangnnqgcs230038@fpt.edu.vn>',
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

router.post("/reset-password", async (req: Request, res: Response): Promise<any> => {
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
  
      res.status(200).json({ message: "Password reset successfully! You can log in now." });
    } catch (error) {
      console.error("Lỗi Reset Password:", error);
      res.status(500).json({ message: "Server error while resetting password." });
    }
});

export default router;