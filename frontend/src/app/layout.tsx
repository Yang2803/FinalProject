import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Sidebar from "@/components/Sidebar";
import TopHeader from "@/components/TopHeader";
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

export const metadata: Metadata = {
  title: "Smart Anime Platform",
  description: "AI-Powered Anime Streaming & Manga Reading Platform",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-gray-950 text-gray-100`}
      >
        <Providers>
          {/* Container tổng: Dùng h-dvh để tương thích hoàn hảo với trình duyệt điện thoại */}
          <div className="flex h-dvh bg-gray-950 text-gray-100 overflow-hidden">
            
            {/* CỘT TRÁI: Sidebar trên Desktop & Bottom Nav/Drawer trên Mobile */}
            <Sidebar />

            {/* CỘT PHẢI: Chứa Header và Nội dung chính */}
            <div className="flex-1 flex flex-col min-w-0">
              
              {/* TOP HEADER */}
              <TopHeader />

              {/* Vùng cuộn nội dung: Thêm pb-16 trên mobile để không bị Bottom Bar che */}
              <main className="flex-1 overflow-y-auto pb-16 md:pb-0">
                {children}
              </main>

            </div>

          </div>
        </Providers>
      </body>
    </html>
  );
}