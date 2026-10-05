import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { LogoutButton } from "@/components/LogoutButton";
import { NavBar, MobileNav } from "@/components/NavBar";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { profile } = await requireSession();

  const nav = [
    { href: "/", label: "หน้าแรก", show: true },
    { href: "/activities", label: "บันทึกกิจกรรม", show: true },
    { href: "/reports", label: "รายงาน", show: true },
    { href: "/admin/staff", label: "จัดการเจ้าหน้าที่", show: profile.role === "admin" },
    { href: "/admin/categories", label: "จัดการหมวดงาน", show: profile.role === "admin" },
    { href: "/admin/holidays", label: "จัดการวันหยุด", show: profile.role === "admin" },
  ].filter((item) => item.show);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-20 bg-blue-700 text-white shadow-md">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
          {/* มือถือ: ปุ่ม hamburger ซ้ายสุด */}
          <MobileNav items={nav} />

          <Link href="/" className="flex items-center gap-2 text-lg font-bold">
            <span>🖥️</span>
            <span className="hidden sm:inline">บันทึกกิจกรรมไอที</span>
            <span className="sm:hidden">IT Activity</span>
          </Link>

          {/* จอใหญ่: เมนูแนวนอนข้างโลโก้ */}
          <NavBar items={nav} />

          <div className="ml-auto flex min-w-0 items-center gap-3 text-sm">
            {/* คลิกชื่อเพื่อไปหน้าเปลี่ยนรหัสผ่าน */}
            <Link
              href="/profile"
              title="เปลี่ยนรหัสผ่าน"
              className="flex min-w-0 items-center gap-1.5 text-blue-100 transition hover:text-white"
            >
              <span className="max-w-24 truncate md:max-w-none">
                {profile.full_name}
              </span>
              {profile.role === "admin" && (
                <span className="shrink-0 rounded bg-amber-400 px-1.5 py-0.5 text-xs font-semibold text-amber-900">
                  แอดมิน
                </span>
              )}
            </Link>
            <LogoutButton />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        {children}
      </main>

      <footer className="py-4 text-center text-xs text-slate-400">
        ระบบบันทึกกิจกรรมเจ้าหน้าที่ไอที
      </footer>
    </div>
  );
}
