"use client";

import { useState, use, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

// 1. IMPORT DND-KIT (Giống hệt trang Edit)
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
  id: string;       // ID độc nhất cho dnd-kit
  file: File;       // File gốc để lát nữa upload
  previewUrl: string; // Link ảo để hiển thị trên màn hình
}

// ==========================================
// COMPONENT: Item kéo thả (Tương tự trang Edit)
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
        title="Xóa ảnh này"
      >
        X
      </button>

      <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-xs text-center py-1 z-10 pointer-events-none">
        Trang {index + 1}
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

  const [chapterTitle, setChapterTitle] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  
  // 2. STATE MỚI: Lưu mảng các object PreviewItem thay vì File[]
  const [imageItems, setImageItems] = useState<PreviewItem[]>([]);

  // Cleanup bộ nhớ: Xóa các link ảo khi component unmount để tránh tràn RAM
  useEffect(() => {
    return () => {
      imageItems.forEach(item => URL.revokeObjectURL(item.previewUrl));
    };
  }, [imageItems]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // 3. XỬ LÝ KHI CHỌN FILE: Tạo link ảo và cấp ID cho từng file
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files);
      const newPreviewItems: PreviewItem[] = filesArray.map((file) => ({
        id: Math.random().toString(36).substring(2, 9) + Date.now().toString(36), // Tạo ID ngẫu nhiên
        file: file,
        previewUrl: URL.createObjectURL(file), // Tạo link ảo để hiển thị
      }));
      
      // Nối thêm ảnh mới vào danh sách hiện tại (giúp admin có thể chọn file nhiều lần)
      setImageItems((prev) => [...prev, ...newPreviewItems]);
      
      // Reset lại thẻ input để có thể chọn lại cùng 1 file nếu lỡ xóa
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (imageItems.length === 0) return alert("Vui lòng chọn ít nhất 1 ảnh cho chương truyện!");
    setIsUploading(true);

    try {
      const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
      const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;
      if (!cloudName || !uploadPreset) throw new Error("Thiếu cấu hình Cloudinary!");

      // 4. CHỈ LẤY PHẦN 'file' TRONG OBJECT ĐỂ UPLOAD LÊN CLOUDINARY THEO ĐÚNG THỨ TỰ
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
          if (!res.ok) throw new Error(data.error?.message || "Lỗi upload ảnh");
          return data.secure_url;
        })
      );

      const backendRes = await fetch("http://localhost:5000/api/admin/chapter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mangaId, title: chapterTitle, images: imageUrls })
      }); 
      
      const backendData = await backendRes.json();
      if (!backendRes.ok) throw new Error(backendData.message);

      alert("Đăng chương truyện thành công!");
      router.push(`/admin/manga/${mangaId}`);
      
    } catch (error) {
      if (error instanceof Error) {
        alert(`Lỗi: ${error.message}`);
      } else {
        alert("Đã xảy ra lỗi không xác định!");
      }
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="p-8 min-h-screen text-white">
      <div className="max-w-4xl mx-auto bg-gray-800 p-8 rounded-xl shadow-lg">
        <div className="flex justify-between items-center mb-6 border-b border-gray-700 pb-4">
          <h1 className="text-3xl font-bold text-blue-400">Tải lên Chương mới</h1>
          <Link href={`/admin/manga/${mangaId}`} className="text-gray-400 hover:text-white transition">
            &larr; Quay lại
          </Link>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Tên chương (*)</label>
            <input
              type="text"
              required
              value={chapterTitle}
              onChange={(e) => setChapterTitle(e.target.value)}
              className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500"
              placeholder="Ví dụ: Chapter 101"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Chọn ảnh trang truyện (Có thể chọn nhiều lần)</label>
            <input
              type="file"
              multiple
              accept="image/*"
              onChange={handleFileChange}
              className="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-gray-700 file:text-white hover:file:bg-gray-600"
            />
          </div>

          {/* 5. KHU VỰC PREVIEW KÉO THẢ */}
          {imageItems.length > 0 && (
            <div className="border-t border-gray-700 pt-6">
              <label className="block text-sm font-medium text-gray-300 mb-2 hover:text-blue-400 transition cursor-default">
                Xem trước & Sắp xếp ({imageItems.length} ảnh) - <span className="text-xs text-gray-500 font-normal">Kéo để đổi thứ tự</span>
              </label>
              
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-gray-900 rounded-lg border border-gray-700 h-64 overflow-y-auto shadow-inner">
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
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center mt-6"
          >
            {isUploading ? "Đang xử lý tải ảnh lên..." : "Hoàn Tất Tải Lên"}
          </button>
        </form>
      </div>
    </div>
  );
}