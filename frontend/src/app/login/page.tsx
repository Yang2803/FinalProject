"use client";

import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Gọi NextAuth để xử lý đăng nhập
    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    if (res?.error) {
      setError("Email hoặc mật khẩu không chính xác!");
    } else {
      router.push("/"); // Đăng nhập thành công, chuyển về trang chủ
      router.refresh();
    }
  };

  return (
    <div className="flex h-screen items-center justify-center bg-gray-900">
      <div className="w-full max-w-md p-8 space-y-6 bg-gray-800 rounded-xl shadow-lg text-white">
        <h2 className="text-3xl font-bold text-center">Sign In</h2>
        {error && <p className="text-red-500 text-center">{error}</p>}
        
        {/* Form đăng nhập bằng Email/Password */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-3 py-2 mt-1 bg-gray-700 text-white rounded-md focus:outline-none focus:ring focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium">Password</label>
            
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-3 py-2 mt-1 bg-gray-700 text-white rounded-md focus:outline-none focus:ring focus:ring-blue-500"
            />
          </div>
          <button type="submit" className="w-full py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700 transition">
            Sign In
          </button>
          <Link href="/forgot-password" className="text-xs text-blue-400 hover:underline">Forgot Password?</Link>
        </form>

        <div className="relative flex py-4 items-center">
          <div className="flex-grow border-t border-gray-600"></div>
          <span className="flex-shrink-0 mx-4 text-gray-400 text-sm">Or sign in with</span>
          <div className="flex-grow border-t border-gray-600"></div>
        </div>

        {/* Nút đăng nhập Google */}
        <div className="flex flex-col space-y-3">
          <button
            onClick={() => signIn("google", { callbackUrl: "/" })}
            className="w-full py-2 flex items-center justify-center space-x-2 bg-white text-gray-900 font-medium rounded-md hover:bg-gray-200 transition"
          >
            <img src="https://www.svgrepo.com/show/475656/google-color.svg" alt="Google" className="w-5 h-5" />
            <span>Continue with Google</span>
          </button>
        </div>

        <p className="text-sm text-center text-gray-400">
          Do not have an account? <Link href="/register" className="text-blue-400 hover:underline">Register now</Link>
        </p>
      </div>
    </div>
  );
}