import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Sidebar from "@/components/Sidebar";
import TopHeader from "@/components/TopHeader"; // ➕ 1. IMPORT COMPONENT
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
        <Providers>
          {/* Container tổng: Dàn hàng ngang (Row) */}
          <div className="flex h-screen bg-gray-950 text-gray-100 overflow-hidden">
            
            {/* CỘT TRÁI: Thanh điều hướng dọc cố định */}
            <Sidebar />

            {/* CỘT PHẢI: Chứa Header và Nội dung chính */}
            <div className="flex-1 flex flex-col min-w-0">
              
              {/* ➕ 2. NHÚNG TOP HEADER VÀO TRÊN CÙNG CỘT PHẢI */}
              <TopHeader />

              {/* Vùng cuộn nội dung (Chỉ cuộn phần này, Header đứng im) */}
              <main className="flex-1 overflow-y-auto">
                {children}
              </main>

            </div>

          </div>
        </Providers>
      </body>
    </html>
  );
}