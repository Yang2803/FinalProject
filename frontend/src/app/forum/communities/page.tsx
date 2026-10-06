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
    {/* Nút quay lại Forum với hiệu ứng hover mượt mà */}
    <Link 
      href="/forum" 
      className="inline-flex items-center gap-2 text-gray-400 hover:text-cyan-400 transition-all mb-8 font-bold text-sm bg-gray-900/40 hover:bg-gray-800/80 px-4 py-2 rounded-full border border-gray-800 hover:border-cyan-500/30 backdrop-blur-md shadow-sm w-fit"
    >
      <svg className="w-4 h-4 transition-transform group-hover:-translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
      </svg>
      Back to Forum
    </Link>

    {/* HEADER TÌM KIẾM & NÚT TẠO */}
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10 pb-8 border-b border-gray-800/80 relative">
      <div className="absolute -bottom-[1px] left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-cyan-500/40 to-transparent pointer-events-none"></div>

      <div>
        <h1 className="text-3xl md:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-gray-200 to-cyan-300 mb-2 tracking-tight">
          Explore Communities
        </h1>
        <p className="text-gray-400 text-sm md:text-base font-medium">
          Join your favorite communities to discuss deeply about the world of Anime/Manga.
        </p>
      </div>
      
      <button 
        onClick={() => setIsModalOpen(true)}
        className="bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-extrabold px-6 py-3.5 rounded-2xl transition-all duration-300 shadow-[0_0_20px_rgba(59,130,246,0.3)] hover:shadow-[0_0_30px_rgba(59,130,246,0.6)] active:scale-95 border border-cyan-400/20 whitespace-nowrap flex items-center justify-center gap-2"
      >
        <span className="text-xl leading-none">+</span> Create Community
      </button>
    </div>

    {/* THANH TÌM KIẾM & NÚT LỌC */}
    <div className="mb-10 flex flex-col sm:flex-row gap-4">
      {/* Ô Tìm kiếm */}
      <div className="relative flex-1 group">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-500 group-focus-within:text-cyan-400 transition-colors">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <input 
          type="text" 
          placeholder="Tìm kiếm cộng đồng theo tên hoặc chủ đề..." 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-[#13151a]/90 border border-gray-800/80 rounded-2xl pl-12 pr-4 py-3.5 text-gray-200 outline-none focus:border-cyan-500/60 focus:bg-[#161922] transition-all shadow-inner placeholder-gray-500 text-sm font-medium"
        />
      </div>

      {/* Nút Lọc Nhóm Đã Tham Gia */}
      {session?.user && (
        <button
          onClick={() => setShowJoinedOnly(!showJoinedOnly)}
          className={`px-6 py-3.5 rounded-2xl font-bold text-sm transition-all duration-300 flex items-center justify-center gap-2 shrink-0 border shadow-md active:scale-95 ${
            showJoinedOnly 
              ? 'bg-gradient-to-r from-blue-600 to-cyan-600 border-cyan-400/40 text-white shadow-[0_0_15px_rgba(59,130,246,0.3)]' 
              : 'bg-[#13151a]/80 border-gray-800 text-gray-400 hover:text-gray-200 hover:border-gray-700'
          }`}
        >
          <svg className={`w-5 h-5 ${showJoinedOnly ? 'text-white' : 'text-cyan-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {showJoinedOnly ? "Filter: Joined" : "Joined Communities"}
        </button>
      )}
    </div>

    {/* LƯỚI DANH SÁCH COMMUNITY */}
    {loading ? (
      <div className="flex flex-col items-center justify-center py-24 space-y-4">
        <div className="w-12 h-12 border-4 border-cyan-500/20 border-t-cyan-400 rounded-full animate-spin shadow-[0_0_20px_rgba(34,211,238,0.4)]"></div>
        <p className="text-cyan-400 text-sm font-bold animate-pulse">Locating the Universes...</p>
      </div>
    ) : filteredCommunities.length === 0 ? (
      <div className="text-center py-24 bg-[#12141a]/60 rounded-3xl border border-gray-800/80 backdrop-blur-sm p-8">
        <span className="text-6xl mb-4 block">🪐</span>
        {searchQuery ? (
          <p className="text-gray-400 text-base mb-2 font-medium">Không tìm thấy cộng đồng nào phù hợp với <span className="text-cyan-400 font-bold">{searchQuery}</span></p>
        ) : (
          <>
            <p className="text-gray-400 text-base mb-4 font-medium">Chưa có cộng đồng nào được khởi tạo.</p>
            <button 
              onClick={() => setIsModalOpen(true)} 
              className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400 hover:drop-shadow-[0_0_8px_rgba(56,189,248,0.8)] font-black text-sm uppercase tracking-wider transition-all"
            >
              Khai mở cộng đồng đầu tiên ngay →
            </button>
          </>
        )}
      </div>
    ) : (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredCommunities.map((community) => (
          <Link href={`/forum/communities/${community.id}`} key={community.id} className="group h-full">
            <div className="relative bg-[#13151a]/80 backdrop-blur-sm rounded-3xl border border-gray-800/80 overflow-hidden hover:border-cyan-500/40 hover:shadow-[0_12px_35px_-10px_rgba(34,211,238,0.2)] hover:-translate-y-1.5 transition-all duration-500 flex flex-col h-full z-0">
              
              {/* Vệt sáng chìm góc card */}
              <div className="absolute -top-12 -right-12 w-28 h-28 bg-cyan-500/10 blur-[40px] rounded-full pointer-events-none group-hover:bg-cyan-500/20 transition-all duration-700"></div>

              {/* Ảnh bìa */}
              <div className="h-36 bg-gray-900 relative overflow-hidden shrink-0">
                {community.coverImage ? (
                  <img 
                    src={community.coverImage} 
                    alt={community.name} 
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" 
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-blue-900/60 via-purple-900/40 to-slate-900 flex items-center justify-center">
                    <span className="text-3xl opacity-30">✨</span>
                  </div>
                )}
                {/* Lớp gradient phủ tối từ chân ảnh */}
                <div className="absolute inset-0 bg-gradient-to-t from-[#13151a] via-[#13151a]/30 to-transparent"></div>
              </div>

              {/* Thông tin cộng đồng */}
              <div className="p-6 flex-1 flex flex-col -mt-4 relative z-10">
                <h3 className="text-base font-extrabold text-gray-100 mb-2 group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-blue-400 group-hover:to-cyan-300 transition-all duration-300 line-clamp-1">
                  c/{community.name}
                </h3>
                <p className="text-xs md:text-sm text-gray-400 mb-6 line-clamp-2 flex-1 leading-relaxed font-normal">
                  {community.description}
                </p>
                
                {/* Thống kê dưới đáy Card */}
                <div className="flex items-center justify-between text-xs font-bold text-gray-400 mt-auto pt-4 border-t border-gray-800/60">
                  <div className="flex items-center gap-1.5 bg-gray-900/60 px-3 py-1.5 rounded-lg border border-gray-800">
                    <svg className="w-3.5 h-3.5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    <span>{community._count.members} TV</span>
                  </div>

                  <div className="flex items-center gap-1.5 bg-gray-900/60 px-3 py-1.5 rounded-lg border border-gray-800">
                    <svg className="w-3.5 h-3.5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                    <span>{community._count.posts} bài</span>
                  </div>
                </div>
              </div>

            </div>
          </Link>
        ))}
      </div>
    )}

    {/* POPUP TẠO CỘNG ĐỒNG (MODAL) */}
    {isModalOpen && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
        <div className="bg-[#13151a] w-full max-w-lg rounded-3xl border border-gray-700/50 shadow-[0_0_50px_rgba(0,0,0,0.8)] flex flex-col relative overflow-hidden">
          
          {/* Vạch sáng trên đỉnh Modal */}
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-cyan-400"></div>

          <div className="flex justify-between items-center p-6 border-b border-gray-800/80">
            <h2 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-300">
              Create New Community
            </h2>
            <button 
              onClick={resetForm} 
              className="text-gray-400 hover:text-red-400 hover:rotate-90 transition-all duration-300 bg-gray-800/40 hover:bg-red-950/30 w-9 h-9 rounded-full flex items-center justify-center border border-gray-700/50"
            >
              ✕
            </button>
          </div>

          <div className="p-6 space-y-5">
            <div>
              <label className="block text-xs font-extrabold uppercase tracking-wider text-gray-400 mb-2">
                Community Name <span className="text-red-400">*</span>
              </label>
              <input 
                type="text" 
                placeholder="E.g.: Gojo Satoru Fan Club..." 
                value={name} 
                onChange={e => setName(e.target.value)}
                className="w-full bg-gray-900/60 border border-gray-700/60 rounded-xl px-4 py-3 outline-none text-white focus:border-cyan-500 focus:bg-gray-900 transition-all text-sm font-medium shadow-inner placeholder-gray-600"
              />
            </div>
            
            <div>
              <label className="block text-xs font-extrabold uppercase tracking-wider text-gray-400 mb-2">
                Community Description <span className="text-red-400">*</span>
              </label>
              <textarea 
                placeholder="Clearly state the topic and direction of the community..." 
                value={description} 
                onChange={e => setDescription(e.target.value)}
                className="w-full bg-gray-900/60 border border-gray-700/60 rounded-xl px-4 py-3 outline-none text-white focus:border-cyan-500 focus:bg-gray-900 transition-all text-sm font-medium resize-none h-28 custom-scrollbar shadow-inner placeholder-gray-600 leading-relaxed"
              />
            </div>

            <div>
              <label className="block text-xs font-extrabold uppercase tracking-wider text-gray-400 mb-2">
                Community Banner Image (Optional)
              </label>
              <input type="file" accept="image/*" hidden ref={fileInputRef} onChange={handleFileChange} />
              
              {coverPreview ? (
                <div className="relative h-32 rounded-xl overflow-hidden border border-cyan-500/30 group/preview shadow-md">
                  <img src={coverPreview} alt="Cover Preview" className="w-full h-full object-cover" />
                  <button 
                    onClick={() => { setCoverFile(null); setCoverPreview(null); }} 
                    className="absolute top-2 right-2 bg-red-600/90 text-white rounded-full w-7 h-7 flex items-center justify-center text-xs hover:bg-red-500 transition shadow-lg"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <div 
                  onClick={() => fileInputRef.current?.click()} 
                  className="h-28 border-2 border-dashed border-gray-700/70 hover:border-cyan-500/60 bg-gray-900/30 hover:bg-cyan-950/10 rounded-2xl flex flex-col items-center justify-center text-gray-400 hover:text-cyan-300 transition-all cursor-pointer group"
                >
                  <svg className="w-7 h-7 mb-1.5 text-gray-500 group-hover:text-cyan-400 group-hover:scale-110 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span className="text-xs font-bold">Click or drag and drop the banner image here</span>
                </div>
              )}
            </div>
          </div>

          <div className="p-6 border-t border-gray-800/80 flex justify-end gap-3 bg-[#171a21]/60 rounded-b-3xl">
            <button 
              onClick={resetForm} 
              className="px-5 py-2.5 rounded-xl text-xs font-bold text-gray-400 hover:text-white transition"
            >
              Cancel
            </button>
            <button 
              onClick={handleCreateCommunity} 
              disabled={isCreating} 
              className="bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white px-6 py-2.5 rounded-xl text-xs font-black transition-all shadow-[0_0_15px_rgba(59,130,246,0.3)] hover:shadow-[0_0_20px_rgba(59,130,246,0.5)] disabled:opacity-50"
            >
              {isCreating ? "Creating..." : "Confirm Creation"}
            </button>
          </div>
          
        </div>
      </div>
    )}
  </div>
)};