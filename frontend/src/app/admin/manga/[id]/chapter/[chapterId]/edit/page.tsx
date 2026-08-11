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

interface ImageItem {
  id: string;
  url: string;
  file: File | null;
  isNew: boolean;
}

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

export default function EditChapterPage({ params }: { params: Promise<{ id: string; chapterId: string }> }) {
  const resolvedParams = use(params);
  const mangaId = resolvedParams.id;
  const chapterId = resolvedParams.chapterId;
  const router = useRouter();

  // 🌟 1. BỔ SUNG CÁC STATE MỚI
  const [chapterNumber, setChapterNumber] = useState("");
  const [title, setTitle] = useState("");
  const [characters, setCharacters] = useState("");
  const [plotSummary, setPlotSummary] = useState("");

  const [imageItems, setImageItems] = useState<ImageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isAutoFilling, setIsAutoFilling] = useState(false); // State cho nút AI

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
        
        // 🌟 NẠP DỮ LIỆU CŨ VÀO STATE MỚI
        setTitle(data.title);
        setChapterNumber(data.chapterNumber ? String(data.chapterNumber) : "");
        setCharacters(data.characters ? data.characters.join(", ") : "");
        setPlotSummary(data.plotSummary || "");
        
        if (data.images) {
          const existingFormatted: ImageItem[] = data.images.map((url: string) => ({
            id: url,
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files);
      const newPreviewItems: ImageItem[] = filesArray.map((file) => ({
        id: Math.random().toString(36).substring(2, 9) + Date.now().toString(36),
        url: URL.createObjectURL(file),
        file: file,
        isNew: true
      }));
      
      setImageItems((prev) => [...prev, ...newPreviewItems]);
      e.target.value = ""; 
    }
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
        setTitle(resData.sourceTitle || `Chapter ${chapterNumber}`);
        setCharacters(resData.data.characters.join(", "));
        setPlotSummary(resData.data.plotSummary);
      } else {
        alert(resData.error || "Không tìm thấy dữ liệu trên Wiki!");
      }
    } catch (error) {
      console.error("Lỗi Auto-fill:", error);
      alert("Lỗi kết nối đến Server AI.");
    } finally {
      setIsAutoFilling(false);
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

      const finalImagesArray = await Promise.all(
        imageItems.map(async (item) => {
          if (!item.isNew) {
            return item.url;
          }
          
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

      // 🌟 3. GỬI KÈM DATA MỚI XUỐNG BACKEND
      const backendRes = await fetch(`http://localhost:5000/api/admin/chapter/${chapterId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          title, 
          chapterNumber,
          characters,
          plotSummary,
          images: finalImagesArray 
        }),
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

  if (loading) return <div className="p-8 flex justify-center items-center h-screen"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div></div>;

  return (
    <div className="p-8 min-h-screen text-white bg-[#0f0f11]">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-black text-purple-400">Edit Chapter</h1>
          </div>
          <Link href={`/admin/manga/${mangaId}`} className="text-gray-400 hover:text-white transition text-sm">
            &larr; Back to Manga
          </Link>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          
          {/* 🌟 KHU VỰC THÔNG TIN (ĐƯỢC NÂNG CẤP) */}
          <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-xl space-y-6">
            
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
                      <><div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div> Quét...</>
                    ) : (
                      "🪄 Auto-fill"
                    )}
                  </button>
                </div>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500 text-sm"
                  placeholder="Example: A New Beginning"
                />
              </div>
            </div>

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

          {/* KHU VỰC ẢNH VÀ DRAG-DROP */}
          <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-xl space-y-6">
            <div>
              <label className="block text-sm font-bold text-gray-300 mb-2 hover:text-blue-400 cursor-default transition">
                Sort and Edit ({imageItems.length} images) - <span className="text-xs text-gray-500 font-normal">Drag the images to change their order.</span>
              </label>

              {imageItems.length === 0 ? (
                <p className="text-sm text-red-400 italic">Chapter is empty. Please add some images!</p>
              ) : (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-gray-900 rounded-xl border border-gray-700 h-[350px] overflow-y-auto custom-scrollbar shadow-inner">
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
              <label className="block text-sm font-bold text-gray-300 mb-2">Add New Images</label>
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={handleFileChange}
                className="block w-full text-sm text-gray-400 file:mr-4 file:py-2.5 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-green-600 file:text-white hover:file:bg-green-700 cursor-pointer"
              />
            </div>

            <button
              type="submit"
              disabled={isSaving}
              className="w-full py-4 bg-purple-600 hover:bg-purple-700 text-white font-black text-lg rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center shadow-lg shadow-purple-600/20 mt-6"
            >
              {isSaving ? (
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Processing image upload and saving...
                </div>
              ) : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}