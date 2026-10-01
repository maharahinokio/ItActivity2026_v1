import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  PERIOD_LABEL,
  durationMinutes,
  formatDuration,
  formatThaiDate,
  monthStartISO,
  shortTime,
  todayISO,
} from "@/lib/utils";
import type { ActivityJoined } from "@/lib/types";

export default async function DashboardPage() {
  const { userId, profile } = await requireSession();
  const supabase = await createClient();

  const today = todayISO();
  const monthStart = monthStartISO();

  const [{ data: todayActivities }, { data: monthActivities }] =
    await Promise.all([
      supabase
        .from("activities")
        .select("*, categories(id, name)")
        .eq("user_id", userId)
        .eq("activity_date", today)
        .order("start_time"),
      supabase
        .from("activities")
        .select("*, categories(id, name)")
        .eq("user_id", userId)
        .gte("activity_date", monthStart)
        .lte("activity_date", today)
        .order("activity_date", { ascending: false })
        .order("start_time"),
    ]);

  const todayList = (todayActivities ?? []) as unknown as ActivityJoined[];
  const monthList = (monthActivities ?? []) as unknown as ActivityJoined[];

  const todayMinutes = todayList.reduce(
    (sum, a) => sum + Math.max(0, durationMinutes(a.start_time, a.end_time)),
    0,
  );

  const monthInHours = monthList
    .filter((a) => a.period === "in_hours")
    .reduce(
      (sum, a) => sum + Math.max(0, durationMinutes(a.start_time, a.end_time)),
      0,
    );
  const monthOutHours = monthList
    .filter((a) => a.period === "out_of_hours")
    .reduce(
      (sum, a) => sum + Math.max(0, durationMinutes(a.start_time, a.end_time)),
      0,
    );

  // ชั่วโมงแยกตามหมวดงาน (เดือนนี้)
  const byCategory = new Map<string, number>();
  for (const a of monthList) {
    const name = a.categories?.name ?? "ไม่ระบุหมวดงาน";
    byCategory.set(name, (byCategory.get(name) ?? 0) + Math.max(0, durationMinutes(a.start_time, a.end_time)));
  }
  const categoryRows = [...byCategory.entries()].sort((a, b) => b[1] - a[1]);
  const maxCategoryMinutes = Math.max(1, ...categoryRows.map(([, m]) => m));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">สวัสดี, {profile.full_name}</h1>
          <p className="text-sm text-slate-500">
            ภาพรวมกิจกรรมการทำงานของคุณ
          </p>
        </div>
        <Link
          href="/activities/new"
          className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow transition hover:bg-blue-700"
        >
          + บันทึกกิจกรรมใหม่
        </Link>
      </div>

      {/* การ์ดสรุป */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="ชั่วโมงวันนี้"
          value={formatDuration(todayMinutes)}
          sub={`${todayList.length} กิจกรรม`}
          icon="⏱️"
        />
        <StatCard
          label="ในเวลาทำการ (เดือนนี้)"
          value={formatDuration(monthInHours)}
          icon="💼"
        />
        <StatCard
          label="นอกเวลาทำการ (เดือนนี้)"
          value={formatDuration(monthOutHours)}
          icon="🌙"
        />
        <StatCard
          label="กิจกรรมทั้งหมด (เดือนนี้)"
          value={`${monthList.length} รายการ`}
          icon="📋"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* กิจกรรมวันนี้ */}
        <section className="rounded-xl bg-white p-5 shadow">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold">กิจกรรมวันนี้ ({formatThaiDate(today)})</h2>
            <Link href="/activities" className="text-sm text-blue-600 hover:underline">
              ดูทั้งหมด
            </Link>
          </div>
          {todayList.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">
              ยังไม่มีกิจกรรมวันนี้ — เริ่มบันทึกกิจกรรมแรกของคุณได้เลย
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {todayList.map((a) => (
                <li key={a.id} className="flex items-start gap-3 py-2.5">
                  <span className="mt-0.5 shrink-0 rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                    {shortTime(a.start_time)}–{shortTime(a.end_time)}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm">{a.description}</p>
                    <p className="text-xs text-slate-400">
                      {a.categories?.name ?? "ไม่ระบุหมวดงาน"} ·{" "}
                      {PERIOD_LABEL[a.period]}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* สัดส่วนตามหมวดงาน (เดือนนี้) */}
        <section className="rounded-xl bg-white p-5 shadow">
          <h2 className="mb-4 font-semibold">ชั่วโมงแยกตามหมวดงาน (เดือนนี้)</h2>
          {categoryRows.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">
              ยังไม่มีข้อมูลในเดือนนี้
            </p>
          ) : (
            <ul className="space-y-3">
              {categoryRows.map(([name, minutes]) => (
                <li key={name}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span>{name}</span>
                    <span className="text-slate-500">{formatDuration(minutes)}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-blue-500"
                      style={{ width: `${(minutes / maxCategoryMinutes) * 100}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  icon,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: string;
}) {
  return (
    <div className="rounded-xl bg-white p-5 shadow">
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <span>{icon}</span>
        <span>{label}</span>
      </div>
      <p className="mt-2 text-xl font-bold text-slate-900">{value}</p>
      {sub && <p className="text-xs text-slate-400">{sub}</p>}
    </div>
  );
}
