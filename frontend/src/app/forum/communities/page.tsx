"use client";

import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";

interface CommunityItem {
  id: string;
  name: string;
  description: string;
  coverImage: string | null;
  _count: {
    members: number;
    posts: number;
  };
  members: { id: string }[];
}

export default function CommunitiesPage() {
  const { data: session } = useSession();
  
  // States quản lý danh sách
  const [communities, setCommunities] = useState<CommunityItem[]>([]);
  const [loading, setLoading] = useState(true);

  // States quản lý Form tạo mới
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // State cho thanh tìm kiếm
  const [searchQuery, setSearchQuery] = useState("");

  // 🌟 THÊM STATE CHO TÍNH NĂNG LỌC NHÓM ĐÃ THAM GIA
  const [showJoinedOnly, setShowJoinedOnly] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // 1. TẢI DANH SÁCH COMMUNITY
  useEffect(() => {
    let isMounted = true;
    const fetchCommunities = async () => {
      try {
        const res = await fetch("http://localhost:5000/api/communities", {
          cache: "no-store",
        });
        if (res.ok) {
          const data = await res.json();
          if (isMounted) setCommunities(data);
        }
      } catch (error) {
        console.error("Lỗi khi tải danh sách cộng đồng:", error);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchCommunities();
    return () => { isMounted = false; };
  }, []);

  // 2. XỬ LÝ CHỌN ẢNH BÌA
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setCoverFile(file);
      setCoverPreview(URL.createObjectURL(file));
    }
  };

  const resetForm = () => {
    setIsModalOpen(false);
    setName("");
    setDescription("");
    setCoverFile(null);
    setCoverPreview(null);
  };

  // 3. XỬ LÝ TẠO CỘNG ĐỒNG (UPLOAD ẢNH & POST DATA)
  const handleCreateCommunity = async () => {
    if (!name.trim() || !description.trim()) return alert("Vui lòng nhập đủ Tên và Mô tả!");
    if (!session?.user?.id) return alert("Vui lòng đăng nhập!");

    setIsCreating(true);

    try {
      let finalCoverUrl = null;

      // Upload ảnh lên Cloudinary nếu có
      if (coverFile) {
        const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
        const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;
        
        if (!cloudName || !uploadPreset) {
          alert("Chưa cấu hình Cloudinary!");
          setIsCreating(false);
          return;
        }

        const formData = new FormData();
        formData.append("file", coverFile);
        formData.append("upload_preset", uploadPreset);

        const cloudRes = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
          method: "POST",
          body: formData
        });
        
        const cloudData = await cloudRes.json();
        if (!cloudRes.ok) throw new Error("Lỗi upload ảnh bìa");
        finalCoverUrl = cloudData.secure_url;
      }

      // Gọi API tạo Community
      const res = await fetch("http://localhost:5000/api/communities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          name: name.trim(), 
          description: description.trim(), 
          coverImage: finalCoverUrl, 
          creatorId: session.user.id 
        })
      });

      if (res.ok) {
        const newCommunity = await res.json();
        alert("Tạo cộng đồng thành công!");
        
        // Thêm vào danh sách hiện tại với số count mặc định
        const newCommunityWithCount: CommunityItem = {
          ...newCommunity,
          _count: { members: 1, posts: 0 } // Người tạo tự động là 1 member
        };
        
        setCommunities([newCommunityWithCount, ...communities]);
        resetForm();
      } else {
        const data = await res.json();
        alert(data.error || "Lỗi khi tạo cộng đồng");
      }
    } catch (error) {
      console.error(error);
      alert("Đã xảy ra lỗi kết nối.");
    } finally {
      setIsCreating(false);
    }
  };

  // 🌟 NÂNG CẤP THUẬT TOÁN LỌC KÉP: Lọc theo Từ khóa + Lọc theo Trạng thái tham gia
  const filteredCommunities = communities.filter(c => {
    // 1. Kiểm tra khớp từ khóa tìm kiếm
    const matchesSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          c.description.toLowerCase().includes(searchQuery.toLowerCase());
    
    // 2. Kiểm tra user đã tham gia chưa (nếu nút lọc đang bật)
    const isJoined = c.members?.some(m => m.id === session?.user?.id);
    const matchesJoined = showJoinedOnly ? isJoined : true;

    // Trả về true nếu thỏa mãn cả 2 điều kiện
    return matchesSearch && matchesJoined;
  });

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
        
        <Link href="/forum" className="inline-flex items-center gap-2 text-gray-400 hover:text-blue-400 transition mb-6 font-bold text-sm">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
        Back to Forum
      </Link>

      {/* HEADER TÌM KIẾM & NÚT TẠO */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Khám phá Cộng đồng</h1>
          <p className="text-gray-400">Tham gia các hội nhóm để thảo luận chuyên sâu về Anime/Manga bạn yêu thích.</p>
        </div>
        
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-6 py-3 rounded-xl transition shadow-lg shadow-blue-600/20 whitespace-nowrap"
        >
          + Tạo Cộng Đồng Mới
        </button>
      </div>

      {/* ======================================================== */}
      {/* 🌟 THANH TÌM KIẾM & NÚT LỌC "ĐÃ THAM GIA" */}
      {/* ======================================================== */}
      <div className="mb-8 flex flex-col sm:flex-row gap-4">
        
        {/* Ô Tìm kiếm */}
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          </div>
          <input 
            type="text" 
            placeholder="Tìm kiếm cộng đồng theo tên hoặc chủ đề..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#1a1d24] border border-gray-800 rounded-xl pl-12 pr-4 py-3.5 text-gray-200 outline-none focus:border-blue-500 transition shadow-sm"
          />
        </div>

        {/* Nút Lọc (Chỉ hiện khi đã đăng nhập) */}
        {session?.user && (
          <button
            onClick={() => setShowJoinedOnly(!showJoinedOnly)}
            className={`px-5 py-3.5 rounded-xl font-bold text-sm transition flex items-center justify-center gap-2 shrink-0 border ${
              showJoinedOnly 
                ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-500/20' 
                : 'bg-[#1a1d24] border-gray-800 text-gray-400 hover:text-gray-200 hover:border-gray-700'
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {showJoinedOnly ? "Đang lọc: Đã tham gia" : "Nhóm đã tham gia"}
          </button>
        )}
        
      </div>

      {/* LƯỚI DANH SÁCH COMMUNITY */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : filteredCommunities.length === 0 ? (
        <div className="text-center py-20 bg-[#1a1d24] rounded-2xl border border-gray-800">
          {searchQuery ? (
            <p className="text-gray-400 mb-4">Không tìm thấy cộng đồng nào phù hợp với {searchQuery}</p>
          ) : (
            <>
              <p className="text-gray-400 mb-4">Chưa có cộng đồng nào được tạo.</p>
              <button onClick={() => setIsModalOpen(true)} className="text-blue-500 hover:underline font-bold">Hãy là người đầu tiên tạo nhé!</button>
            </>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCommunities.map((community) => (
            <Link href={`/forum/communities/${community.id}`} key={community.id}>
              <div className="bg-[#1a1d24] rounded-2xl border border-gray-800 overflow-hidden hover:border-blue-500/50 hover:shadow-lg hover:shadow-blue-900/20 transition group cursor-pointer flex flex-col h-full">
                
                {/* Ảnh bìa */}
                <div className="h-32 bg-gray-800 relative overflow-hidden">
                  {community.coverImage ? (
                    <img src={community.coverImage} alt={community.name} className="w-full h-full object-cover group-hover:scale-105 transition duration-500" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-blue-900 to-purple-900 opacity-50"></div>
                  )}
                  <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition"></div>
                </div>

                {/* Thông tin */}
                <div className="p-5 flex-1 flex flex-col">
                  <h3 className="text-xl font-bold text-white mb-2 group-hover:text-blue-400 transition line-clamp-1">{community.name}</h3>
                  <p className="text-sm text-gray-400 mb-4 line-clamp-2 flex-1">{community.description}</p>
                  
                  <div className="flex items-center gap-4 text-xs font-bold text-gray-500 mt-auto pt-4 border-t border-gray-800/50">
                    <div className="flex items-center gap-1.5">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                      {community._count.members} Thành viên
                    </div>
                    <div className="flex items-center gap-1.5">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                      {community._count.posts} Bài viết
                    </div>
                  </div>
                </div>

              </div>
            </Link>
          ))}
        </div>
      )}

      {/* POPUP TẠO CỘNG ĐỒNG */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#1a1d24] w-full max-w-lg rounded-2xl border border-gray-800 shadow-2xl flex flex-col">
            
            <div className="flex justify-between items-center p-5 border-b border-gray-800">
              <h2 className="text-xl font-bold text-gray-100">Tạo Cộng Đồng Mới</h2>
              <button onClick={resetForm} className="text-gray-400 hover:text-white transition w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-800">✕</button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-400 mb-1.5">Tên cộng đồng <span className="text-red-500">*</span></label>
                <input 
                  type="text" placeholder="VD: Hội những người yêu thích Gojo..." value={name} onChange={e => setName(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2.5 outline-none text-white focus:border-blue-500 transition"
                />
              </div>
              
              <div>
                <label className="block text-sm font-bold text-gray-400 mb-1.5">Mô tả chi tiết <span className="text-red-500">*</span></label>
                <textarea 
                  placeholder="Cộng đồng này dành cho..." value={description} onChange={e => setDescription(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2.5 outline-none text-white focus:border-blue-500 transition resize-none h-24 custom-scrollbar"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-400 mb-1.5">Ảnh bìa (Tùy chọn)</label>
                <input type="file" accept="image/*" hidden ref={fileInputRef} onChange={handleFileChange} />
                
                {coverPreview ? (
                  <div className="relative h-32 rounded-lg overflow-hidden border border-gray-700">
                    <img src={coverPreview} alt="Cover Preview" className="w-full h-full object-cover" />
                    <button onClick={() => { setCoverFile(null); setCoverPreview(null); }} className="absolute top-2 right-2 bg-black/60 text-white rounded-full p-1.5 hover:bg-red-500">✕</button>
                  </div>
                ) : (
                  <div onClick={() => fileInputRef.current?.click()} className="h-24 border-2 border-dashed border-gray-700 rounded-lg flex flex-col items-center justify-center text-gray-500 hover:border-blue-500 hover:text-blue-400 hover:bg-blue-900/10 transition cursor-pointer">
                    <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    <span className="text-sm font-bold">Nhấn để tải ảnh lên</span>
                  </div>
                )}
              </div>
            </div>

            <div className="p-5 border-t border-gray-800 flex justify-end gap-3 bg-gray-900/50 rounded-b-2xl">
              <button onClick={resetForm} className="px-5 py-2.5 rounded-lg text-sm font-bold text-gray-400 hover:text-white transition">Hủy</button>
              <button onClick={handleCreateCommunity} disabled={isCreating} className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2.5 rounded-lg text-sm font-bold transition disabled:opacity-50">
                {isCreating ? "Đang tạo..." : "Tạo Cộng Đồng"}
              </button>
            </div>
            
          </div>
        </div>
      )}
    </div>
  );
}