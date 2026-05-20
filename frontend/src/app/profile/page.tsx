"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function ProfilePage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  // (Tuỳ chọn) Nếu component đã render mà chưa có session, đẩy về trang login
  // Tuy nhiên, việc này sẽ được xử lý triệt để hơn ở phần Middleware phía dưới.
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  if (status === "loading") {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // Nếu không có session, không render gì cả (tránh chớp giao diện trước khi redirect)
  if (!session?.user) return null;

  return (
    <div className="max-w-4xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-8 text-white">Hồ sơ cá nhân</h1>

      <div className="bg-gray-800 rounded-2xl shadow-xl border border-gray-700 overflow-hidden">
        {/* Header Banner */}
<div className="h-32 bg-gradient-to-r from-blue-600 to-purple-600"></div>

{/* Avatar & Info */}
<div className="px-8 pb-8">
  {/* Chuyển sang dùng Flexbox và margin âm (-mt-12) kéo avatar lên thay vì absolute */}
  <div className="flex flex-col sm:flex-row items-center sm:items-end -mt-12 space-y-4 sm:space-y-0 sm:space-x-6 relative z-10">
    <img
      src={session.user.image || "https://www.svgrepo.com/show/507442/user-circle.svg"}
      alt="Avatar"
      className="w-24 h-24 rounded-full object-cover border-4 border-gray-800 bg-gray-900 shadow-lg"
    />
    
    {/* Bỏ mt-16 cũ, thêm margin-bottom nhẹ để chữ thẳng hàng với avatar ở giao diện desktop */}
    <div className="text-center sm:text-left mb-2">
      <h2 className="text-2xl font-bold text-white">
        {session.user.name || "Người dùng ẩn danh"}
      </h2>
      <p className="text-gray-400 mt-1">{session.user.email}</p>
    </div>
  </div>

  {/* Các section thông tin khác */}
  <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
    <div className="bg-gray-900/50 p-6 rounded-xl border border-gray-700">
      <h3 className="text-lg font-semibold text-gray-200 mb-4">Thông tin tài khoản</h3>
      <ul className="space-y-3 text-sm text-gray-400">
        <li className="flex justify-between">
          <span>Trạng thái:</span>
          <span className="text-green-400 font-medium">Đang hoạt động</span>
        </li>
        <li className="flex justify-between">
          <span>Vai trò:</span>
          <span className="text-blue-400 font-medium">Thành viên (USER)</span>
        </li>
      </ul>
    </div>

    <div className="bg-gray-900/50 p-6 rounded-xl border border-gray-700">
      <h3 className="text-lg font-semibold text-gray-200 mb-4">Hoạt động gần đây</h3>
      <p className="text-sm text-gray-500 italic">
        Chưa có dữ liệu lịch sử xem Anime hay đọc Manga.
      </p>
    </div>
  </div>
</div>
        </div>
        </div>
    );
}