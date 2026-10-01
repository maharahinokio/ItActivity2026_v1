import type { Metadata } from "next";
import { Noto_Sans_Thai } from "next/font/google";
import "./globals.css";

const notoSansThai = Noto_Sans_Thai({
  variable: "--font-noto-thai",
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "บันทึกกิจกรรมเจ้าหน้าที่ไอที",
  description: "ระบบจัดเก็บกิจกรรมการทำงานของเจ้าหน้าที่ไอที รายบุคคล รายชั่วโมง",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="th" className={`${notoSansThai.variable} h-full antialiased`}>
      <body className="min-h-full bg-slate-100 text-slate-900">
        {children}
      </body>
    </html>
  );
}
