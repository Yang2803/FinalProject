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
          {/* Main container: Use h-dvh for perfect compatibility with mobile browsers. */}
          <div className="flex h-dvh bg-gray-950 text-gray-100 overflow-hidden">
            
            {/* LEFT COLUMN: Sidebar on Desktop & Bottom Nav/Drawer on Mobile */}
            <Sidebar />

            {/* RIGHT COLUMN: Contains Header and Main Content */}
            <div className="flex-1 flex flex-col min-w-0">
              
              {/* TOP HEADER */}
              <TopHeader />

              {/* Content scrolling area: Add pb-16 on mobile to prevent the bottom bar from obscuring it. */}
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