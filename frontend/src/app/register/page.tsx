"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    try {
      // Bắn API thẳng qua Express Backend để tạo tài khoản
      const res = await fetch("http://localhost:5000/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message || "Có lỗi xảy ra");
        return;
      }

      setSuccess("Đăng ký thành công! Đang chuyển hướng...");
      setTimeout(() => router.push("/login"), 2000);
    } catch (err) {
      setError("Lỗi kết nối đến máy chủ.");
    }
  };

  return (
    <div className="flex h-screen items-center justify-center bg-gray-900">
      <div className="w-full max-w-md p-8 space-y-6 bg-gray-800 rounded-xl shadow-lg text-white">
        <h2 className="text-3xl font-bold text-center">Đăng ký</h2>
        {error && <p className="text-red-500 text-center">{error}</p>}
        {success && <p className="text-green-500 text-center">{success}</p>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium">Tên hiển thị</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-3 py-2 mt-1 bg-gray-700 rounded-md focus:outline-none focus:ring focus:ring-green-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-3 py-2 mt-1 bg-gray-700 rounded-md focus:outline-none focus:ring focus:ring-green-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium">Mật khẩu</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-3 py-2 mt-1 bg-gray-700 rounded-md focus:outline-none focus:ring focus:ring-green-500"
            />
          </div>
          <button
            type="submit"
            className="w-full py-2 text-white bg-green-600 rounded-md hover:bg-green-700 transition"
          >
            Tạo tài khoản
          </button>
        </form>
        <p className="text-sm text-center text-gray-400">
          Đã có tài khoản? <Link href="/login" className="text-green-400 hover:underline">Đăng nhập ngay</Link>
        </p>
      </div>
    </div>
  );
}