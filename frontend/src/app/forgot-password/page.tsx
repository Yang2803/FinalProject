"use client";

import { useState } from "react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");
    setError("");
    setLoading(true);

    try {
      const res = await fetch("http://localhost:5000/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();

      if (res.ok) {
        setMessage(data.message);
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError("Không thể kết nối đến server backend!");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen items-center justify-center bg-gray-900 text-white">
      <div className="w-full max-w-md p-8 space-y-6 bg-gray-800 rounded-xl shadow-lg">
        <h2 className="text-2xl font-bold text-center">Forgot password</h2>
        <p className="text-sm text-gray-400 text-center">Enter your email to receive a link to reset your password.</p>
        
        {message && <p className="text-green-500 text-center text-sm">{message}</p>}
        {error && <p className="text-red-500 text-center text-sm">{error}</p>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-3 py-2 mt-1 bg-gray-700 rounded-md focus:outline-none focus:ring focus:ring-blue-500"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 bg-blue-600 rounded-md hover:bg-blue-700 transition disabled:bg-gray-600"
          >
            {loading ? "Processing..." : "Send Request"}
          </button>
        </form>

        <div className="text-center">
          <Link href="/login" className="text-sm text-blue-400 hover:underline">Back to Login</Link>
        </div>
      </div>
    </div>
  );
}