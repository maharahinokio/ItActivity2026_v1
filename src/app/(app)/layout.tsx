import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { LogoutButton } from "@/components/LogoutButton";

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
  ].filter((item) => item.show);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-20 bg-blue-700 text-white shadow-md">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Link href="/" className="flex items-center gap-2 text-lg font-bold">
            <span>🖥️</span>
            <span className="hidden sm:inline">บันทึกกิจกรรมไอที</span>
            <span className="sm:hidden">IT Activity</span>
          </Link>

          <nav className="order-3 -mx-4 w-full overflow-x-auto sm:order-none sm:mx-0 sm:w-auto">
            <ul className="flex gap-1 px-4 text-sm sm:px-0">
              {nav.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="block whitespace-nowrap rounded-lg px-3 py-1.5 transition hover:bg-blue-600"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className="ml-auto flex items-center gap-3 text-sm">
            <span className="hidden text-blue-100 md:inline">
              {profile.full_name}
              {profile.role === "admin" && (
                <span className="ml-1.5 rounded bg-amber-400 px-1.5 py-0.5 text-xs font-semibold text-amber-900">
                  แอดมิน
                </span>
              )}
            </span>
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
