"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { ActivityJoined, Profile } from "@/lib/types";
import {
  PERIOD_LABEL,
  durationMinutes,
  formatDuration,
  formatThaiDate,
  monthStartISO,
  shortTime,
  todayISO,
} from "@/lib/utils";

interface Props {
  isAdmin: boolean;
  currentUserId: string;
  staff: Pick<Profile, "id" | "full_name">[];
}

interface ExportRow {
  วันที่: string;
  เวลาเริ่มต้น: string;
  เวลาสิ้นสุด: string;
  ระยะเวลา: string;
  ช่วงเวลา: string;
  เจ้าหน้าที่: string;
  หมวดงาน: string;
  รายละเอียดงาน: string;
}

export function ReportsView({ isAdmin, currentUserId, staff }: Props) {
  const [from, setFrom] = useState(monthStartISO());
  const [to, setTo] = useState(todayISO());
  const [selectedUser, setSelectedUser] = useState(isAdmin ? "" : currentUserId);

  const [items, setItems] = useState<ActivityJoined[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    const supabase = createClient();

    let query = supabase
      .from("activities")
      .select("*, profiles(id, full_name), categories(id, name)")
      .order("activity_date")
      .order("start_time");

    if (selectedUser) query = query.eq("user_id", selectedUser);
    if (from) query = query.gte("activity_date", from);
    if (to) query = query.lte("activity_date", to);

    const { data, error: fetchError } = await query;
    if (fetchError) setError(fetchError.message);
    setItems((data ?? []) as unknown as ActivityJoined[]);
    setLoading(false);
  }, [selectedUser, from, to]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- setLoading เกิดตอนเปลี่ยนตัวกรอง จำเป็นต้องรีเซ็ตสถานะโหลด
    fetchData();
  }, [fetchData]);

  const stats = useMemo(() => {
    let inMinutes = 0;
    let outMinutes = 0;
    const byCategory = new Map<string, number>();
    const byUser = new Map<string, number>();

    for (const a of items) {
      const minutes = Math.max(0, durationMinutes(a.start_time, a.end_time));
      if (a.period === "in_hours") inMinutes += minutes;
      else outMinutes += minutes;

      const catName = a.categories?.name ?? "ไม่ระบุหมวดงาน";
      byCategory.set(catName, (byCategory.get(catName) ?? 0) + minutes);

      const userName = a.profiles?.full_name ?? "-";
      byUser.set(userName, (byUser.get(userName) ?? 0) + minutes);
    }

    return {
      totalMinutes: inMinutes + outMinutes,
      inMinutes,
      outMinutes,
      categories: [...byCategory.entries()].sort((a, b) => b[1] - a[1]),
      users: [...byUser.entries()].sort((a, b) => b[1] - a[1]),
    };
  }, [items]);

  async function handleExportExcel() {
    setExporting(true);
    try {
      const ExcelJS = (await import("exceljs")).default;
      const workbook = new ExcelJS.Workbook();
      workbook.creator = "ระบบบันทึกกิจกรรมเจ้าหน้าที่ไอที";
      workbook.created = new Date();

      const label = selectedUser
        ? staff.find((p) => p.id === selectedUser)?.full_name ?? "ทุกคน"
        : "ทุกคน";

      // ---- ชีตสรุป ----
      const summarySheet = workbook.addWorksheet("สรุป");
      summarySheet.columns = [
        { header: "รายการ", key: "label", width: 28 },
        { header: "ค่า", key: "value", width: 24 },
      ];
      summarySheet.getRow(1).font = { bold: true };
      summarySheet.addRows([
        { label: "ช่วงวันที่", value: `${formatThaiDate(from)} ถึง ${formatThaiDate(to)}` },
        { label: "เจ้าหน้าที่", value: label },
        { label: "จำนวนกิจกรรม", value: `${items.length} รายการ` },
        { label: "รวมเวลาทำงาน", value: formatDuration(stats.totalMinutes) },
        { label: "ในเวลาทำการ", value: formatDuration(stats.inMinutes) },
        { label: "นอกเวลาทำการ", value: formatDuration(stats.outMinutes) },
        { label: "", value: "" },
        { label: "แยกตามหมวดงาน", value: "" },
        ...stats.categories.map(([name, minutes]) => ({
          label: `  ${name}`,
          value: formatDuration(minutes),
        })),
        { label: "", value: "" },
        { label: "แยกตามเจ้าหน้าที่", value: "" },
        ...stats.users.map(([name, minutes]) => ({
          label: `  ${name}`,
          value: formatDuration(minutes),
        })),
      ]);

      // ---- ชีตรายการ ----
      const detailSheet = workbook.addWorksheet("รายการกิจกรรม");
      detailSheet.columns = [
        { header: "วันที่", key: "วันที่", width: 16 },
        { header: "เวลาเริ่มต้น", key: "เวลาเริ่มต้น", width: 12 },
        { header: "เวลาสิ้นสุด", key: "เวลาสิ้นสุด", width: 12 },
        { header: "ระยะเวลา", key: "ระยะเวลา", width: 14 },
        { header: "ช่วงเวลา", key: "ช่วงเวลา", width: 16 },
        { header: "เจ้าหน้าที่", key: "เจ้าหน้าที่", width: 22 },
        { header: "หมวดงาน", key: "หมวดงาน", width: 20 },
        { header: "รายละเอียดงาน", key: "รายละเอียดงาน", width: 60 },
      ];
      detailSheet.getRow(1).font = { bold: true };
      detailSheet.getRow(1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFDBEAFE" },
      };

      const rows: ExportRow[] = items.map((a) => ({
        วันที่: formatThaiDate(a.activity_date),
        เวลาเริ่มต้น: shortTime(a.start_time),
        เวลาสิ้นสุด: shortTime(a.end_time),
        ระยะเวลา: formatDuration(
          Math.max(0, durationMinutes(a.start_time, a.end_time)),
        ),
        ช่วงเวลา: PERIOD_LABEL[a.period],
        เจ้าหน้าที่: a.profiles?.full_name ?? "-",
        หมวดงาน: a.categories?.name ?? "-",
        รายละเอียดงาน: a.description,
      }));
      detailSheet.addRows(rows);

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `รายงานกิจกรรมไอที_${from}_ถึง_${to}.xlsx`;
      link.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">รายงานสรุป</h1>
        <button
          onClick={handleExportExcel}
          disabled={exporting || items.length === 0}
          className="rounded-lg bg-green-600 px-4 py-2.5 text-sm font-semibold text-white shadow transition hover:bg-green-700 disabled:opacity-60"
        >
          {exporting ? "กำลังสร้างไฟล์..." : "⬇ Export Excel"}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 rounded-xl bg-white p-4 shadow sm:grid-cols-4">
        <div className="min-w-0">
          <label className="mb-1 block text-xs font-medium text-slate-500">
            จากวันที่
          </label>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="w-full min-w-0 rounded-lg border border-slate-300 px-2.5 py-2 text-sm"
          />
        </div>
        <div className="min-w-0">
          <label className="mb-1 block text-xs font-medium text-slate-500">
            ถึงวันที่
          </label>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="w-full min-w-0 rounded-lg border border-slate-300 px-2.5 py-2 text-sm"
          />
        </div>
        {isAdmin && (
          <div className="col-span-2 min-w-0 sm:col-span-2">
            <label className="mb-1 block text-xs font-medium text-slate-500">
              เจ้าหน้าที่
            </label>
            <select
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm"
            >
              <option value="">ทุกคน</option>
              {staff.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </p>
      )}

      {loading ? (
        <p className="py-12 text-center text-sm text-slate-400">
          กำลังโหลดข้อมูล...
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="จำนวนกิจกรรม" value={`${items.length} รายการ`} />
            <StatCard label="รวมเวลาทำงาน" value={formatDuration(stats.totalMinutes)} />
            <StatCard label="ในเวลาทำการ" value={formatDuration(stats.inMinutes)} />
            <StatCard label="นอกเวลาทำการ" value={formatDuration(stats.outMinutes)} />
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <section className="rounded-xl bg-white p-5 shadow">
              <h2 className="mb-4 font-semibold">แยกตามหมวดงาน</h2>
              {stats.categories.length === 0 ? (
                <p className="py-6 text-center text-sm text-slate-400">
                  ไม่มีข้อมูลในช่วงวันที่ที่เลือก
                </p>
              ) : (
                <ProportionChart data={stats.categories} />
              )}
            </section>

            <section className="rounded-xl bg-white p-5 shadow">
              <h2 className="mb-4 font-semibold">แยกตามเจ้าหน้าที่</h2>
              {stats.users.length === 0 ? (
                <p className="py-6 text-center text-sm text-slate-400">
                  ไม่มีข้อมูลในช่วงวันที่ที่เลือก
                </p>
              ) : (
                <ProportionChart data={stats.users} />
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}

/** สีของแท่งกราฟ — ต้องเป็นชื่อ class คงที่เพื่อให้ Tailwind สร้าง CSS ครบ */
const BAR_COLORS = [
  "bg-blue-500",
  "bg-indigo-500",
  "bg-green-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-teal-500",
  "bg-purple-500",
  "bg-slate-400",
];

/** กราฟแท่งแนวนอนแสดงสัดส่วน: แท่งรวมด้านบน + รายแถวพร้อมเวลาและเปอร์เซ็นต์ */
function ProportionChart({ data }: { data: [string, number][] }) {
  const total = data.reduce((sum, [, minutes]) => sum + minutes, 0) || 1;

  return (
    <div>
      {/* แท่งสรุปสัดส่วนรวมทุกรายการ */}
      <div
        role="img"
        aria-label="แท่งสรุปสัดส่วนรวม"
        className="flex h-3 w-full overflow-hidden rounded-full bg-slate-100"
      >
        {data.map(([name, minutes], i) => (
          <div
            key={name}
            className={BAR_COLORS[i % BAR_COLORS.length]}
            style={{ width: `${(minutes / total) * 100}%` }}
            title={`${name} ${Math.round((minutes / total) * 100)}%`}
          />
        ))}
      </div>

      <ul className="mt-5 space-y-4">
        {data.map(([name, minutes], i) => {
          const pct = Math.round((minutes / total) * 100);
          return (
            <li key={name}>
              <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
                <span className="flex min-w-0 items-center gap-2">
                  <span
                    className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                      BAR_COLORS[i % BAR_COLORS.length]
                    }`}
                    aria-hidden
                  />
                  <span className="truncate">{name}</span>
                </span>
                <span className="shrink-0 text-slate-500">
                  {formatDuration(minutes)} · {pct}%
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-slate-100">
                <div
                  className={`h-2 rounded-full ${BAR_COLORS[i % BAR_COLORS.length]}`}
                  style={{ width: `${Math.max(2, pct)}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white p-5 shadow">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-bold text-slate-900">{value}</p>
    </div>
  );
}
