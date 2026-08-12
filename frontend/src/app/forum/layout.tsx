import Link from "next/link";

export default function ForumLayout({ children }: { children: React.ReactNode }) {
  return (
    // Giả sử component bọc ngoài cùng đã chứa Navbar cố định bên trái (w-64)
    // Phần này là không gian bên phải Navbar
    <div className="flex justify-center min-h-screen bg-[#0f0f11] text-white">
      
      {/* CỘT GIỮA: FEED CHÍNH (Chiếm diện tích lớn nhất) */}
      <main className="w-full max-w-3xl border-l border-r border-gray-800">
        
       
       

        {/* Nơi chứa Form đăng bài và List bài viết */}
        <div className="p-6">
          {children}
        </div>
      </main>

      {/* CỘT PHẢI: WIDGETS CỘNG ĐỒNG (Ẩn trên mobile) */}
      <aside className="hidden lg:block w-80 p-6 space-y-6 sticky top-0 h-screen overflow-y-auto">
        
        {/* Nút tạo Community */}
        <button className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl shadow-lg transition">
          + Create Community
        </button>

        {/* Trending Tags */}
        <div className="bg-[#1a1d24] rounded-xl border border-gray-800 p-4">
          <h3 className="font-bold text-gray-200 mb-3">Trending Tags</h3>
          <div className="flex flex-wrap gap-2">
            <span className="bg-gray-800 text-xs px-3 py-1 rounded-full text-blue-400 cursor-pointer hover:bg-gray-700">#JujutsuKaisen</span>
            <span className="bg-gray-800 text-xs px-3 py-1 rounded-full text-blue-400 cursor-pointer hover:bg-gray-700">#ReviewPhim</span>
            <span className="bg-gray-800 text-xs px-3 py-1 rounded-full text-blue-400 cursor-pointer hover:bg-gray-700">#MangaSpoiler</span>
          </div>
        </div>

      </aside>
    </div>
  );
}