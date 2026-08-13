import type { Metadata } from "next";
import { GOOGLE_FONTS_HREF } from "@/lib/fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: "LUXSTICKER AI",
  description: "สร้างสติ๊กเกอร์จากรูปคนจริง ตัดพื้นหลัง จัดองค์ประกอบ พร้อมใช้ทันที",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th" className="h-full antialiased">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="stylesheet" href={GOOGLE_FONTS_HREF} />
      </head>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
