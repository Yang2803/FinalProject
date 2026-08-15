"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";

interface Notification {
  id: string;
  title: string;
  message: string;
  linkUrl: string;
  isRead: boolean;
  createdAt: string;
}

export default function NotificationsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  // Bảo vệ trang
  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  useEffect(() => {
    const fetchAndMarkAsRead = async () => {
      if (!session?.user?.id) return;
      try {
        // 1. Tải danh sách thông báo
        const res = await fetch(`http://localhost:5000/api/notifications/${session.user.id}`);
        if (res.ok) {
          const data = await res.json();
          setNotifications(data.notifications);
        }

        // 2. Đánh dấu tất cả là đã đọc
        await fetch(`http://localhost:5000/api/notifications/${session.user.id}/read`, {
          method: "PUT"
        });

      } catch (error) {
        console.error("Lỗi tải thông báo:", error);
      } finally {
        setLoading(false);
      }
    };

    if (session?.user?.id) {
      fetchAndMarkAsRead();
    }
  }, [session?.user?.id]);

  if (status === "loading" || loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0f0f11]">
        <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!session?.user) return null;

  return (
    <div className="min-h-screen bg-[#0f0f11] text-white p-8">
      <div className="max-w-4xl mx-auto">
        
        <div className="flex items-center gap-4 mb-8 border-b border-gray-800 pb-6">
          <Link href="/" className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition text-gray-300">
            &larr; Back
          </Link>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <svg className="w-8 h-8 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
            Notifications
          </h1>
        </div>

        {notifications.length === 0 ? (
          <div className="bg-[#1a1d24] rounded-xl p-12 text-center border border-gray-800">
            <p className="text-gray-400 text-lg">Bạn chưa có thông báo nào.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {notifications.map((note) => (
              <Link key={note.id} href={note.linkUrl} className="block group">
                <div className={`p-5 rounded-xl border transition-all ${
                  !note.isRead 
                    ? 'bg-blue-900/20 border-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.1)]' 
                    : 'bg-[#1a1d24] border-gray-800 hover:border-gray-600'
                }`}>
                  <div className="flex justify-between items-start mb-2">
                    <h3 className={`font-bold text-lg group-hover:text-blue-400 transition ${!note.isRead ? 'text-blue-400' : 'text-gray-200'}`}>
                      {note.title}
                    </h3>
                    <span className="text-xs text-gray-500 shrink-0 ml-4">
                      {new Date(note.createdAt).toLocaleString('vi-VN')}
                    </span>
                  </div>
                  <p className="text-gray-400 text-sm">{note.message}</p>
                </div>
              </Link>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}