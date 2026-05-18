import "next-auth";

declare module "next-auth" {
  // Bổ sung thêm id và role vào object User mặc định
  interface User {
    id: string;
    role: string;
  }

  // Bổ sung thêm id và role vào object Session mặc định
  interface Session {
    user: User & {
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}