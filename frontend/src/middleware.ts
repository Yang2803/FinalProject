import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const path = req.nextUrl.pathname;

    // Nếu người dùng cố vào trang admin nhưng quyền không phải ADMIN
    if (path.startsWith("/admin") && token?.role !== "ADMIN") {
      // Đá về trang chủ
      return NextResponse.redirect(new URL("/", req.url));
    }
  },
  {
    callbacks: {
      // Bắt buộc phải có token (đã đăng nhập) mới qua được chốt chặn này
      authorized: ({ token }) => !!token,
    },
    pages: {
      signIn: "/login",
    },
  }
);

export const config = {
  matcher: [
    "/profile",          
    "/history",          
    "/favorites",        
    "/timeline/submit",
    "/admin/:path*" // Bảo vệ TOÀN BỘ các route con nằm trong thư mục /admin
  ],
};