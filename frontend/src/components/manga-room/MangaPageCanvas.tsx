"use client";

import React, { useRef } from "react";
import { LaserLine, RemoteCursor } from "@/hooks/useMangaRoom";

interface MangaPageCanvasProps {
  pageIndex: number;
  imageUrl: string;
  mode?: "SINGLE" | "VERTICAL";
  isLaserActive: boolean;
  userColor: string;
  laserWidth: number;
  laserLines: LaserLine[];
  remoteCursors: Record<string, RemoteCursor>;
  onDrawComplete: (pageIndex: number, points: { x: number; y: number }[]) => void;
  onCursorMove: (pageIndex: number, x: number, y: number) => void;
}

export function MangaPageCanvas({
  pageIndex,
  imageUrl,
  mode = "SINGLE",
  isLaserActive,
  userColor,
  laserWidth,
  laserLines,
  remoteCursors,
  onDrawComplete,
  onCursorMove,
}: MangaPageCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isMouseDownRef = useRef(false);
  const strokePointsRef = useRef<{ x: number; y: number }[]>([]);
  const [currentStroke, setCurrentStroke] = React.useState<{ x: number; y: number }[]>([]);

  const calculatePercent = (e: React.MouseEvent) => {
    if (!containerRef.current) return { x: 0, y: 0 };
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
    return { x: Number(x.toFixed(2)), y: Number(y.toFixed(2)) };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const coords = calculatePercent(e);
    onCursorMove(pageIndex, coords.x, coords.y);

    if (isLaserActive && isMouseDownRef.current) {
      strokePointsRef.current.push(coords);
      setCurrentStroke([...strokePointsRef.current]);
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!isLaserActive) return;
    isMouseDownRef.current = true;
    const coords = calculatePercent(e);
    strokePointsRef.current = [coords];
    setCurrentStroke([coords]);
  };

  const handleMouseUp = () => {
    if (isLaserActive && isMouseDownRef.current) {
      isMouseDownRef.current = false;
      if (strokePointsRef.current.length > 1) {
        onDrawComplete(pageIndex, [...strokePointsRef.current]);
      }
      strokePointsRef.current = [];
      setCurrentStroke([]);
    }
  };

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      className={`relative inline-block select-none ${
        mode === "SINGLE" ? "h-[calc(100vh-8.5rem)] w-fit" : "w-full max-w-3xl"
      } ${isLaserActive ? "cursor-crosshair" : "cursor-default"}`}
    >
      <img
        src={imageUrl}
        alt={`Trang ${pageIndex + 1}`}
        className={`block shadow-2xl pointer-events-none ${
          mode === "SINGLE"
            ? "h-[calc(100vh-8.5rem)] w-auto max-w-none object-contain"
            : "w-full h-auto object-contain"
        }`}
        loading="lazy"
      />

      {/* SVG Layer vẽ nét */}
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="absolute inset-0 w-full h-full pointer-events-none z-20"
      >
        {/* Nét đang vẽ của bản thân */}
        {currentStroke.length > 1 && (
          <path
            d={currentStroke.reduce(
              (acc, pt, idx) => `${acc} ${idx === 0 ? "M" : "L"} ${pt.x} ${pt.y}`,
              ""
            )}
            fill="none"
            stroke={userColor}
            strokeWidth={laserWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
            style={{ filter: `drop-shadow(0 0 6px ${userColor})` }}
          />
        )}

        {/* Nét vẽ đã lưu thuộc trang này */}
        {laserLines
          .filter((line) => line.pageIndex === pageIndex)
          .map((line) => {
            if (line.points.length < 2) return null;
            const pathData = line.points.reduce(
              (acc, pt, idx) => `${acc} ${idx === 0 ? "M" : "L"} ${pt.x} ${pt.y}`,
              ""
            );
            return (
              <path
                key={line.id}
                d={pathData}
                fill="none"
                stroke={line.color}
                strokeWidth={line.strokeWidth || 0.8}
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
                style={{ filter: `drop-shadow(0 0 8px ${line.color})` }}
              />
            );
          })}
      </svg>

      {/* Live Cursors của các thành viên đang trỏ vào trang này */}
      {Object.values(remoteCursors)
        .filter((c) => c.pageIndex === pageIndex)
        .map((cursor) => (
          <div
            key={cursor.userId}
            className="absolute pointer-events-none z-30 transition-all duration-75 ease-out"
            style={{ left: `${cursor.xPercent}%`, top: `${cursor.yPercent}%` }}
          >
            <div
              className="w-3 h-3 rounded-full border-2 border-white shadow-md -translate-x-1/2 -translate-y-1/2"
              style={{ backgroundColor: cursor.color }}
            />
            <span
              className="absolute left-3 top-0 px-1.5 py-0.5 rounded text-[10px] text-white font-medium whitespace-nowrap shadow-md -translate-y-1/2"
              style={{ backgroundColor: cursor.color }}
            >
              {cursor.userName}
            </span>
          </div>
        ))}
    </div>
  );
}