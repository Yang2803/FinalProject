"use client";

import { useState, use, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// ==========================================
// CẤU TRÚC DỮ LIỆU CHỨA ẢNH PREVIEW
// ==========================================
interface PreviewItem {
  id: string;
  file: File;
  previewUrl: string;
}

// ==========================================
// COMPONENT: Item kéo thả 
// ==========================================
function SortablePreviewItem(props: { item: PreviewItem; index: number; onRemove: (id: string) => void }) {
  const { item, index, onRemove } = props;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`relative group rounded-md overflow-hidden bg-gray-800 h-32 border border-gray-600 cursor-grab ${
        isDragging ? "border-blue-500 shadow-2xl ring-2 ring-blue-500" : ""
      }`}
    >
      <img src={item.previewUrl} alt={`Preview ${index + 1}`} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition" />
      
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onRemove(item.id);
        }}
        className="absolute top-1 right-1 bg-red-600 hover:bg-red-700 text-white w-6 h-6 rounded-full flex justify-center items-center font-bold text-xs shadow-md transition z-20 cursor-pointer"
        title="Delete this image"
      >
        X
      </button>

      <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-xs text-center py-1 z-10 pointer-events-none">
        Page {index + 1}
      </div>
    </div>
  );
}

// ==========================================
// COMPONENT CHÍNH: TRANG UPLOAD CHAPTER
// ==========================================
export default function UploadChapterPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const mangaId = resolvedParams.id;
  const router = useRouter();

  // 🌟 1. BỔ SUNG CÁC STATE MỚI ĐỂ HỨNG DATA AUTO-FILL
  const [chapterNumber, setChapterNumber] = useState("");
  const [chapterTitle, setChapterTitle] = useState("");
  const [characters, setCharacters] = useState("");
  const [plotSummary, setPlotSummary] = useState("");
  
  const [isUploading, setIsUploading] = useState(false);
  const [isAutoFilling, setIsAutoFilling] = useState(false); // State cho nút AI
  
  const [imageItems, setImageItems] = useState<PreviewItem[]>([]);

  useEffect(() => {
    return () => {
      imageItems.forEach(item => URL.revokeObjectURL(item.previewUrl));
    };
  }, [imageItems]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files);
      const newPreviewItems: PreviewItem[] = filesArray.map((file) => ({
        id: Math.random().toString(36).substring(2, 9) + Date.now().toString(36),
        file: file,
        previewUrl: URL.createObjectURL(file),
      }));
      setImageItems((prev) => [...prev, ...newPreviewItems]);
      e.target.value = ""; 
    }
  };

  const handleRemoveItem = (idToRemove: string) => {
    setImageItems((prev) => prev.filter(item => item.id !== idToRemove));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setImageItems((items) => {
      const oldIndex = items.findIndex((item) => item.id === active.id);
      const newIndex = items.findIndex((item) => item.id === over.id);
      return arrayMove(items, oldIndex, newIndex);
    });
  };

  // 🌟 2. HÀM GỌI API AUTO-FILL MANGA CHAPTER
  const handleAutoFill = async () => {
    if (!chapterNumber) {
      alert("Vui lòng nhập Số Chapter (Chapter Number) trước khi dùng Auto-fill!");
      return;
    }
    
    setIsAutoFilling(true);
    try {
      const res = await fetch("http://localhost:5000/api/admin/chapter/auto-fill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mangaId, chapterNumber: Number(chapterNumber) })
      });
      
      const resData = await res.json();
      
      if (res.ok && resData.success) {
        setChapterTitle(resData.sourceTitle || `Chapter ${chapterNumber}`);
        setCharacters(resData.data.characters.join(", "));
        setPlotSummary(resData.data.plotSummary);
      } else {
        alert(resData.error || "Không tìm thấy dữ liệu trên Wiki!");
      }
    } catch (error) {
      alert("Lỗi kết nối đến Server AI.");
    } finally {
      setIsAutoFilling(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (imageItems.length === 0) return alert("Please select at least 1 image for the chapter!");
    setIsUploading(true);

    try {
      const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
      const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;
      if (!cloudName || !uploadPreset) throw new Error("Cloudinary configuration is missing!");

      const imageUrls = await Promise.all(
        imageItems.map(async (item) => {
          const formData = new FormData();
          formData.append("file", item.file);
          formData.append("upload_preset", uploadPreset);

          const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
            method: "POST",
            body: formData,
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error?.message || "Error uploading image");
          return data.secure_url;
        })
      );

      // 🌟 3. ĐẨY TOÀN BỘ DATA MỚI XUỐNG BACKEND
      const backendRes = await fetch("http://localhost:5000/api/admin/chapter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          mangaId, 
          title: chapterTitle,
          chapterNumber,
          characters,
          plotSummary, 
          images: imageUrls 
        })
      }); 
      
      const backendData = await backendRes.json();
      if (!backendRes.ok) throw new Error(backendData.message);

      alert("Chapter uploaded successfully!");
      router.push(`/admin/manga/${mangaId}`);
      
    } catch (error) {
      if (error instanceof Error) {
        alert(`Error: ${error.message}`);
      } else {
        alert("An undefined error occurred!");
      }
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="p-8 min-h-screen text-white bg-[#0f0f11]">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-black text-purple-400">Upload New Chapter</h1>
          </div>
          <Link href={`/admin/manga/${mangaId}`} className="text-gray-400 hover:text-white transition text-sm">
            &larr; Back to Manga
          </Link>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          
          <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-xl space-y-6">
            
            {/* 🌟 CHIA GRID 2 CỘT CHO NUMBER VÀ TITLE */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-1">
                <label className="block text-xs font-bold text-gray-300 mb-2">Chap Number (*)</label>
                <input
                  type="number"
                  step="any"
                  required
                  value={chapterNumber}
                  onChange={(e) => setChapterNumber(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500 text-sm"
                  placeholder="Ex: 1"
                />
              </div>

              <div className="md:col-span-3">
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-xs font-bold text-gray-300">Chapter Title (*)</label>
                  <button
                    type="button"
                    onClick={handleAutoFill}
                    disabled={isAutoFilling || !chapterNumber}
                    className="bg-purple-600 hover:bg-purple-500 disabled:bg-gray-600 text-white text-xs font-bold px-3 py-1 rounded transition flex items-center gap-1"
                  >
                    {isAutoFilling ? (
                      <><div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div> Đang quét...</>
                    ) : (
                      "🪄 Auto-fill"
                    )}
                  </button>
                </div>
                <input
                  type="text"
                  required
                  value={chapterTitle}
                  onChange={(e) => setChapterTitle(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500 text-sm"
                  placeholder="Example: A New Beginning"
                />
              </div>
            </div>

            {/* 🌟 KHU VỰC CHARACTERS & PLOT */}
            <div className="space-y-6 border-t border-gray-700 pt-6">
              <div>
                <label className="block text-xs font-bold text-gray-300 mb-2">Characters (Phân cách bằng dấu phẩy)</label>
                <input
                  type="text"
                  value={characters}
                  onChange={(e) => setCharacters(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500 text-sm"
                  placeholder="Yuji Itadori, Megumi Fushiguro..."
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-300 mb-2">Plot Details (Cốt truyện chi tiết)</label>
                <textarea
                  rows={4}
                  value={plotSummary}
                  onChange={(e) => setPlotSummary(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500 text-sm resize-none"
                  placeholder="Nhập tóm tắt nội dung chương truyện..."
                />
              </div>
            </div>
          </div>

          <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-xl space-y-6">
            <div>
              <label className="block text-sm font-bold text-gray-300 mb-2">Select Chapter Pages (*)</label>
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={handleFileChange}
                className="block w-full text-sm text-gray-400 file:mr-4 file:py-2.5 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700 cursor-pointer"
              />
            </div>

            {imageItems.length > 0 && (
              <div className="border-t border-gray-700 pt-6">
                <label className="block text-sm font-bold text-gray-300 mb-2">
                  Preview & Arrange ({imageItems.length} images) - <span className="text-xs text-gray-500 font-normal">Drag to reorder</span>
                </label>
                
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-gray-900 rounded-xl border border-gray-700 h-[350px] overflow-y-auto custom-scrollbar">
                    <SortableContext items={imageItems.map(i => i.id)} strategy={rectSortingStrategy}>
                      {imageItems.map((item, index) => (
                        <SortablePreviewItem
                          key={item.id}
                          item={item}
                          index={index}
                          onRemove={handleRemoveItem}
                        />
                      ))}
                    </SortableContext>
                  </div>
                </DndContext>
              </div>
            )}

            <button
              type="submit"
              disabled={isUploading}
              className="w-full py-4 bg-purple-600 hover:bg-purple-700 text-white font-black text-lg rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center shadow-lg shadow-purple-600/20"
            >
              {isUploading ? (
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Processing image upload...
                </div>
              ) : "Complete Upload"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}