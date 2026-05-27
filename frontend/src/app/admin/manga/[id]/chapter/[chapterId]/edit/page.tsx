"use client";

import { useState, useEffect, use } from "react";
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
// 1. CẤU TRÚC DỮ LIỆU ĐỒNG NHẤT (GỘP CẢ ẢNH CŨ VÀ MỚI)
// ==========================================
interface ImageItem {
  id: string;        // ID unique cho Dnd-kit kéo thả
  url: string;       // Link hiển thị (Link thật từ Cloudinary HOẶC Link ảo của trình duyệt)
  file: File | null; // NẾU LÀ ẢNH MỚI thì chứa File để đem đi upload, ảnh cũ thì null
  isNew: boolean;    // Cờ đánh dấu để lúc Lưu biết cái nào cần up lên Cloudinary
}

// ==========================================
// COMPONENT NHỎ: XỬ LÝ KÉO THẢ CHO TỪNG TẤM ẢNH
// ==========================================
function SortableImageItem(props: { item: ImageItem; index: number; onRemove: (id: string) => void }) {
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
      <img src={item.url} alt={`Page ${index + 1}`} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition" />
      
      {/* Hiển thị nhãn 'MỚI' để admin dễ phân biệt ảnh nào vừa chọn thêm */}
      {item.isNew && (
        <span className="absolute top-1 left-1 bg-green-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded z-10">MỚI</span>
      )}

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
// COMPONENT CHÍNH: TRANG CHỈNH SỬA CHƯƠNG
// ==========================================
export default function EditChapterPage({ params }: { params: Promise<{ id: string; chapterId: string }> }) {
  const resolvedParams = use(params);
  const mangaId = resolvedParams.id;
  const chapterId = resolvedParams.chapterId;
  const router = useRouter();

  const [title, setTitle] = useState("");
  // 2. CHỈ DÙNG 1 STATE DUY NHẤT CHỨA TẤT CẢ ẢNH
  const [imageItems, setImageItems] = useState<ImageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Xóa link ảo khỏi bộ nhớ khi out trang
  useEffect(() => {
    return () => {
      imageItems.forEach(item => {
        if (item.isNew) URL.revokeObjectURL(item.url);
      });
    };
  }, [imageItems]);

  useEffect(() => {
    const fetchChapter = async () => {
      try {
        const res = await fetch(`http://localhost:5000/api/admin/chapter/${chapterId}`);
        if (!res.ok) throw new Error("Chapter information cannot be loaded.");
        const data = await res.json();
        setTitle(data.title);
        
        // 3. Biến link Cloudinary cũ thành format ImageItem
        if (data.images) {
          const existingFormatted: ImageItem[] = data.images.map((url: string) => ({
            id: url, // Dùng luôn url làm ID vì nó unique
            url: url,
            file: null,
            isNew: false
          }));
          setImageItems(existingFormatted);
        }
      } catch (error) {
        alert("Chapter information cannot be loaded.");
      } finally {
        setLoading(false);
      }
    };
    fetchChapter();
  }, [chapterId]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setImageItems((items) => {
      const oldIndex = items.findIndex(item => item.id === active.id);
      const newIndex = items.findIndex(item => item.id === over.id);
      return arrayMove(items, oldIndex, newIndex);
    });
  };

  const handleRemoveImage = (idToRemove: string) => {
    setImageItems(imageItems.filter((item) => item.id !== idToRemove));
  };

  // 4. KHI CHỌN FILE MỚI: Biến thành ImageItem và nhét chung vào mảng
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files);
      const newPreviewItems: ImageItem[] = filesArray.map((file) => ({
        id: Math.random().toString(36).substring(2, 9) + Date.now().toString(36),
        url: URL.createObjectURL(file), // Link ảo
        file: file,
        isNew: true // Đánh dấu là file mới
      }));
      
      setImageItems((prev) => [...prev, ...newPreviewItems]);
      e.target.value = ""; // Reset input
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (imageItems.length === 0) return alert("Chapter must have at least 1 image!");
    setIsSaving(true);

    try {
      const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
      const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;
      if (!cloudName || !uploadPreset) throw new Error("Missing Cloudinary configuration!");

      // 5. TUYỆT KỸ LƯU TRỮ: Duyệt qua mảng đang được sắp xếp
      const finalImagesArray = await Promise.all(
        imageItems.map(async (item) => {
          // 5.1. Nếu là ảnh cũ -> Trả về URL cũ ngay lập tức (không cần up)
          if (!item.isNew) {
            return item.url;
          }
          
          // 5.2. Nếu là ảnh mới -> Up lên Cloudinary rồi lấy link thật trả về
          const formData = new FormData();
          formData.append("file", item.file as File);
          formData.append("upload_preset", uploadPreset);

          const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
            method: "POST",
            body: formData,
          });
          const data = await res.json();
          if (!res.ok) throw new Error("Error uploading new image");
          
          return data.secure_url;
        })
      );
      // Kết quả của finalImagesArray sẽ giữ ĐÚNG THỨ TỰ mà admin đã kéo thả

      // 6. Gửi về Backend API
      const backendRes = await fetch(`http://localhost:5000/api/admin/chapter/${chapterId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, images: finalImagesArray }),
      });

      if (!backendRes.ok) throw new Error("Error saving backend data");
      alert("Chapter updated successfully!");
      router.push(`/admin/manga/${mangaId}`);
    } catch (error) {
      if (error instanceof Error) {
        alert(`Error: ${error.message}`);
      } else {
        alert("An undefined error occurred!");
      }
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-white">Loading data...</div>;

  return (
    <div className="p-8 min-h-screen text-white max-w-4xl mx-auto">
      <div className="bg-gray-800 p-8 rounded-xl shadow-lg">
        <div className="flex justify-between items-center mb-6 border-b border-gray-700 pb-4">
          <h1 className="text-3xl font-bold text-blue-400">Edit Chapter</h1>
          <Link href={`/admin/manga/${mangaId}`} className="text-gray-400 hover:text-white transition">
            &larr; Back
          </Link>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Chapter Name (*)</label>
            <input type="text" required value={title} onChange={(e) => setTitle(e.target.value)} className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500" />
          </div>

          {/* KHU VỰC ẢNH (GỘP CHUNG) */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2 hover:text-blue-400 cursor-default transition">
              Sort and Edit ({imageItems.length} images) - <span className="text-xs text-gray-500 font-normal">Drag the images to change their order.</span>
            </label>

            {imageItems.length === 0 ? (
              <p className="text-sm text-red-400">Chapter is empty. Please add some images!</p>
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-gray-900 rounded-lg border border-gray-700 h-64 overflow-y-auto shadow-inner">
                  <SortableContext items={imageItems.map(i => i.id)} strategy={rectSortingStrategy}>
                    {imageItems.map((item, index) => (
                      <SortableImageItem key={item.id} item={item} index={index} onRemove={handleRemoveImage} />
                    ))}
                  </SortableContext>
                </div>
              </DndContext>
            )}
          </div>

          <div className="border-t border-gray-700 pt-6">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Add New Images
            </label>
            <input
              type="file"
              multiple
              accept="image/*"
              onChange={handleFileChange}
              className="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-green-600 file:text-white hover:file:bg-green-700"
            />
          </div>

          <button type="submit" disabled={isSaving} className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center">
            {isSaving ? "Processing image upload and saving..." : "Save Changes"}
          </button>
        </form>
      </div>
    </div>
  );
}