import "next-auth";
import { JWT } from "next-auth/jwt";

declare module "next-auth" {
  // Bổ sung thêm id và role vào object User mặc định khi lấy từ Database
  interface User {
    id: string;
    role: string;
  }

  // Bổ sung định dạng cho object Session để Client Component (như Sidebar, Profile) nhận được type chính xác
  interface Session {
    user: User & {
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}

// QUAN TRỌNG: Bổ sung khai báo này để bảo vệ mã nguồn không bị lỗi ép kiểu khi dùng Token
declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: string; // Giúp token.role và token?.role trong middleware hợp lệ
  }
}