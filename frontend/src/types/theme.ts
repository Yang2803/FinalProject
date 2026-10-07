export interface RoomTheme {
  accent: string;       // Mã màu HEX chính (#3b82f6)
  glow: string;         // Mã màu RGBA cho hiệu ứng phát sáng
  bgUrl?: string;       // Link ảnh nền tùy chọn
}

export const THEME_PRESETS = [
  { name: 'Cyber Neon (Mặc định)', accent: '#3b82f6', glow: 'rgba(59,130,246,0.45)' },
  { name: 'Nguyền Hồn Tím',       accent: '#a855f7', glow: 'rgba(168,85,247,0.45)' },
  { name: 'Hơi Thở Lửa Đỏ',       accent: '#ef4444', glow: 'rgba(239,68,68,0.45)' },
  { name: 'Ngọc Lục Bảo',         accent: '#10b981', glow: 'rgba(168,185,129,0.45)' },
  { name: 'Hồng Cyberpunk',       accent: '#ec4899', glow: 'rgba(236,72,153,0.45)' },
  { name: 'Hoàng Kim Hào Nhoáng', accent: '#f59e0b', glow: 'rgba(245,158,11,0.45)' },
];