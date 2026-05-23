"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Manga {
  id: string;
  title: string;
  author: string;
  status: string;
}

export default function AdminMangaList() {
  const [mangas, setMangas] = useState<Manga[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMangas = async () => {
      try {
        const res = await fetch("http://localhost:5000/api/admin/manga");
        if (res.ok) {
          const data = await res.json();
          setMangas(data);
        }
      } catch (error) {
        console.error("Lỗi fetch manga:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchMangas();
  }, []);

  return (
    <div className="p-8 text-white min-h-screen">
      {/* THANH HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-center mb-6 border-b border-gray-700 pb-4">
        
        {/* Bên trái: Tiêu đề */}
        <h1 className="text-3xl font-bold text-blue-400 mb-4 md:mb-0">Danh sách Manga</h1>
        
        {/* Bên phải: Cụm nút điều hướng */}
        <div className="flex gap-4">
          <Link 
            href="/admin" 
            className="px-6 py-2.5 bg-gray-700 hover:bg-gray-600 rounded-lg font-bold transition text-gray-200 flex items-center justify-center text-sm"
          >
            Về Dashboard
          </Link>

          <Link 
            href="/admin/manga/upload" 
            className="px-6 py-2.5 bg-green-600 hover:bg-green-500 rounded-lg font-bold shadow-lg shadow-green-600/30 transition text-white flex items-center justify-center text-sm"
          >
            + Thêm Truyện Mới
          </Link>
        </div>

      </div>

      {loading ? (
        <p>Đang tải dữ liệu...</p>
      ) : (
        <div className="bg-gray-800 rounded-xl overflow-hidden shadow-lg">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-900 border-b border-gray-700">
                <th className="p-4 font-semibold text-gray-300">Tên Truyện</th>
                <th className="p-4 font-semibold text-gray-300">Tác giả</th>
                <th className="p-4 font-semibold text-gray-300">Trạng thái</th>
                <th className="p-4 font-semibold text-gray-300 text-center">Hành động</th>
              </tr>
            </thead>
            <tbody>
              {mangas.map((manga) => (
                <tr key={manga.id} className="border-b border-gray-700 hover:bg-gray-750">
                  <td className="p-4 font-medium">
                      <Link href={`/admin/manga/${manga.id}`} className="text-blue-400 hover:text-blue-300 hover:underline transition font-semibold">
                        {manga.title}
                      </Link>
                    </td>
                  <td className="p-4 text-gray-400">{manga.author || "Đang cập nhật"}</td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded text-xs font-bold ${manga.status === "ONGOING" ? "bg-blue-900/50 text-blue-400" : "bg-green-900/50 text-green-400"}`}>
                      {manga.status}
                    </span>
                  </td>
                  <td className="p-4 text-center">
                    <Link 
                      href={`/admin/manga/${manga.id}/upload-chapter`}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded text-sm transition"
                    >
                      Tải lên Chương mới
                    </Link>
                  </td>
                </tr>
              ))}
              {mangas.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-gray-500">Chưa có truyện nào trong hệ thống.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}