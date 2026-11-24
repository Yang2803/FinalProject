import 'dotenv/config';
import express, { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import nodemailer from "nodemailer";
import crypto from "crypto";
import prisma from '../config/db'; 


const router = express.Router();

// Configuring Email using environment variables (.env)
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

router.post('/register', async (req: Request, res: Response): Promise<any> => {
  try {
      const { email, password, name } = req.body;
  
      // Check if user exists
      const existingUser = await prisma.user.findUnique({ where: { email } });
      if (existingUser) {
        return res.status(400).json({ message: 'Email has already been used!' });
      }
  
      // Password encryption
      const hashedPassword = await bcrypt.hash(password, 10);
  
      // Create a new user
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
  
      // Find user by email
      const user = await prisma.user.findUnique({ where: { email } });
      if (!user || !user.password) {
        return res.status(401).json({ message: 'Email or password is incorrect!' });
      }
  
      // Compare passwords
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        return res.status(401).json({ message: 'Email or password is incorrect!' });
      }
  
      // Returns user information (does not return the password)
      res.status(200).json({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        image: user.image, 
      });
    } catch (error) {
      res.status(500).json({ message: 'Server error', error });
    }
});

// ==========================================
// 🌟 OAuth (Google) handling
// ==========================================
router.post('/oauth', async (req: Request, res: Response): Promise<any> => {
  try {
    const { email, name, image, provider } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'Unable to retrieve email from the provider' });
    }

    // Use UPSERT: Update if it already exists, or create a new entry if it does not.
    const user = await prisma.user.upsert({
      where: { email },
      update: {
        name: name || undefined,
        image: image || undefined,
      },
      create: {
        email,
        name: name || "User Ẩn Danh",
        image: image || null,
      },
    });

    res.status(200).json({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      image: user.image,
    });
  } catch (error) {
    console.error("OAuth Error:", error);
    res.status(500).json({ message: 'Server error during OAuth processing', error });
  }
});

router.post("/forgot-password", async (req: Request, res: Response): Promise<any> => {
  try {
      const { email } = req.body;
  
      // Check if the user exists
      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        return res.status(404).json({ message: "This email does not exist in the system!" });
      }
  
      // Generate a random token string and set an expiration time of 15 minutes.
      const token = crypto.randomBytes(32).toString("hex");
      const expiry = new Date(Date.now() + 15 * 60 * 1000); 
  
      // Save Token to database
      await prisma.user.update({
        where: { email },
        data: {
          resetToken: token,
          resetTokenExpiry: expiry,
        },
      });
  
      // Retrieve the Frontend URL from an environment variable (automatically removing any trailing "/" if present)
      const frontendUrl = (process.env.FRONTEND_URL || "http://localhost:3000").replace(/\/$/, "");
      const resetUrl = `${frontendUrl}/reset-password?token=${token}`;
  
      // Email content to be sent to the user
      const mailOptions = {
        from: `"Smart Anime Platform" <${process.env.EMAIL_USER}>`,
        to: user.email,
        subject: "System password reset request",
        html: `
          <div style="font-family: sans-serif; padding: 20px; color: #333;">
            <h2>Hi ${user.name || "you"},</h2>
            <p>We have received a request to reset the password for your account.</p>
            <p>Please click the button below to proceed with resetting your password (The link will expire in 15 minutes):</p>
            <a href="${resetUrl}" style="display: inline-block; padding: 10px 20px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 5px; margin: 15px 0;">Reset Password</a>
            <p>If you did not initiate this request, please ignore this email.</p>
          </div>
        `,
      };
  
      await transporter.sendMail(mailOptions);
      res.status(200).json({ message: "A password reset link has been sent to your email!" });
    } catch (error) {
      console.error("Forgot Password error:", error);
      res.status(500).json({ message: "Server error while processing the request." });
    }
});

router.post("/reset-password", async (req: Request, res: Response): Promise<any> => {
  try {
      const { token, newPassword } = req.body;
  
      if (!token || !newPassword) {
        return res.status(400).json({ message: "Missing authentication information!" });
      }
  
      // Find the user who owns this token and check if the token is still valid
      const user = await prisma.user.findFirst({
        where: {
          resetToken: token,
          resetTokenExpiry: { gt: new Date() },
        },
      });
  
      if (!user) {
        return res.status(400).json({ message: "Invalid or expired reset token!" });
      }
  
      // Hash the new password
      const hashedPassword = await bcrypt.hash(newPassword, 10);
  
      // Update the user's password and remove the old reset token from the DB
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
      console.error("Reset Password Error:", error);
      res.status(500).json({ message: "Server error while resetting password." });
    }
});

export default router;