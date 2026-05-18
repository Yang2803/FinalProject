import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Sidebar from "@/components/Sidebar";
import "./globals.css";
import { Providers } from "@/components/Providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi">
      <body className="antialiased">
        {/* Khởi tạo Providers chứa SessionProvider để sử dụng được useSession */}
        <Providers>
          <div className="flex min-h-screen bg-gray-950 text-gray-100">
            
            {/* Thanh điều hướng dọc cố định bên trái */}
            <Sidebar />

            {/* Vùng không gian hiển thị nội dung chính của từng trang con */}
            <main className="flex-1 min-h-screen overflow-y-auto">
              {children}
            </main>

          </div>
        </Providers>
      </body>
    </html>
  );
}
