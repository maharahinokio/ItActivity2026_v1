"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Holiday, HolidayKind } from "@/lib/types";
import { formatThaiDate, formatThaiMonthDay } from "@/lib/utils";

const THAI_MONTHS = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];

function holidayDisplay(h: Holiday): string {
  return h.kind === "yearly"
    ? `ทุกปี · ${formatThaiMonthDay(h.month_day ?? "")}`
    : `วันเดียว · ${formatThaiDate(h.date ?? "")}`;
}

function sortHolidays(a: Holiday, b: Holiday): number {
  // วันหยุดครั้งเดียวเรียงตามวันที่, วันหยุดทุกปีเรียงตามวัน/เดือน
  if (a.kind !== b.kind) return a.kind === "once" ? -1 : 1;
  const keyA = a.kind === "once" ? a.date ?? "" : a.month_day ?? "";
  const keyB = b.kind === "once" ? b.date ?? "" : b.month_day ?? "";
  return keyA.localeCompare(keyB);
}

/** แปลงค่าฟอร์มเป็นคอลัมน์สำหรับ insert/update ตามประเภทวันหยุด */
function holidayColumns(
  kind: HolidayKind,
  dateStr: string,
  day: string,
  month: string,
): Pick<Holiday, "kind" | "date" | "month_day"> {
  return kind === "once"
    ? { kind, date: dateStr || null, month_day: null }
    : {
        kind,
        date: null,
        month_day: `${String(Number(month)).padStart(2, "0")}-${String(Number(day)).padStart(2, "0")}`,
      };
}

interface HolidayFormFieldsProps {
  kind: HolidayKind;
  setKind: (k: HolidayKind) => void;
  dateStr: string;
  setDateStr: (v: string) => void;
  day: string;
  setDay: (v: string) => void;
  month: string;
  setMonth: (v: string) => void;
}

/** ส่วนเลือกวันที่ของฟอร์มเพิ่ม/แก้ไขวันหยุด */
function HolidayDateFields({
  kind,
  setKind,
  dateStr,
  setDateStr,
  day,
  setDay,
  month,
  setMonth,
}: HolidayFormFieldsProps) {
  return (
    <>
      <div className="flex flex-wrap items-center gap-4 text-sm">
        <label className="flex items-center gap-2">
          <input type="radio" checked={kind === "yearly"} onChange={() => setKind("yearly")} />
          หยุดทุกปี
        </label>
        <label className="flex items-center gap-2">
          <input type="radio" checked={kind === "once"} onChange={() => setKind("once")} />
          หยุดวันเดียว (กำหนดวันที่)
        </label>
      </div>
      {kind === "yearly" ? (
        <div className="flex gap-3">
          <select
            value={day}
            onChange={(e) => setDay(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm"
            aria-label="วันที่"
          >
            {Array.from({ length: 31 }, (_, i) => (
              <option key={i + 1} value={i + 1}>
                วันที่ {i + 1}
              </option>
            ))}
          </select>
          <select
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm"
            aria-label="เดือน"
          >
            {THAI_MONTHS.map((m, i) => (
              <option key={m} value={i + 1}>
                เดือน{m}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <input
          type="date"
          value={dateStr}
          onChange={(e) => setDateStr(e.target.value)}
          className="w-full min-w-0 rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        />
      )}
    </>
  );
}

export default function AdminHolidaysPage() {
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<HolidayKind>("yearly");
  const [dateStr, setDateStr] = useState("");
  const [day, setDay] = useState("1");
  const [month, setMonth] = useState("1");
  const [error, setError] = useState<string | null>(null);

  // สถานะแก้ไขแบบ inline
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editKind, setEditKind] = useState<HolidayKind>("yearly");
  const [editDateStr, setEditDateStr] = useState("");
  const [editDay, setEditDay] = useState("1");
  const [editMonth, setEditMonth] = useState("1");

  const fetchHolidays = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase.from("holidays").select("*");
    setHolidays((data ?? []).sort(sortHolidays));
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- setLoading ตอนเริ่มโหลดข้อมูลจาก Supabase
    fetchHolidays();
  }, [fetchHolidays]);

  function startEditing(h: Holiday) {
    setEditingId(h.id);
    setEditName(h.name);
    setEditKind(h.kind);
    if (h.kind === "once") {
      setEditDateStr(h.date ?? "");
    } else {
      const [m = "1", d = "1"] = (h.month_day ?? "").split("-");
      setEditMonth(String(Number(m)));
      setEditDay(String(Number(d)));
    }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError("กรุณาตั้งชื่อวันหยุด");
      return;
    }
    const values = holidayColumns(kind, dateStr, day, month);
    if (kind === "once" && !values.date) {
      setError("กรุณาเลือกวันที่");
      return;
    }

    const supabase = createClient();
    const { error: insertError } = await supabase
      .from("holidays")
      .insert({ name: name.trim(), ...values });
    if (insertError) {
      setError(`เพิ่มไม่สำเร็จ: ${insertError.message}`);
      return;
    }
    setName("");
    setDateStr("");
    fetchHolidays();
  }

  async function handleUpdate(h: Holiday) {
    if (!editName.trim()) {
      alert("กรุณาตั้งชื่อวันหยุด");
      return;
    }
    const values = holidayColumns(editKind, editDateStr, editDay, editMonth);
    if (editKind === "once" && !values.date) {
      alert("กรุณาเลือกวันที่");
      return;
    }

    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("holidays")
      .update({ name: editName.trim(), ...values })
      .eq("id", h.id);
    if (updateError) {
      alert(`แก้ไขไม่สำเร็จ: ${updateError.message}`);
      return;
    }
    setEditingId(null);
    fetchHolidays();
  }

  async function handleDelete(h: Holiday) {
    if (!confirm(`ยืนยันการลบวันหยุด "${h.name}"?`)) return;
    const supabase = createClient();
    const { error: deleteError } = await supabase
      .from("holidays")
      .delete()
      .eq("id", h.id);
    if (deleteError) {
      alert(`ลบไม่สำเร็จ: ${deleteError.message}`);
      return;
    }
    fetchHolidays();
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <h1 className="text-2xl font-bold">จัดการวันหยุด</h1>

      <p className="text-sm text-slate-500">
        กิจกรรมที่บันทึกในวันเสาร์-อาทิตย์ หรือวันที่ตรงตามรายการด้านล่าง
        จะถูกตั้งค่าเริ่มต้นเป็น &quot;นอกเวลาทำการ&quot; อัตโนมัติ
      </p>

      <form onSubmit={handleAdd} className="space-y-3 rounded-xl bg-white p-4 shadow">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="ชื่อวันหยุด เช่น วันขึ้นปีใหม่"
          className="w-full min-w-0 rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        />
        <HolidayDateFields
          kind={kind}
          setKind={setKind}
          dateStr={dateStr}
          setDateStr={setDateStr}
          day={day}
          setDay={setDay}
          month={month}
          setMonth={setMonth}
        />
        {error && (
          <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>
        )}
        <button
          type="submit"
          className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
        >
          + เพิ่มวันหยุด
        </button>
      </form>

      <div className="rounded-xl bg-white shadow">
        {loading ? (
          <p className="py-12 text-center text-sm text-slate-400">กำลังโหลด...</p>
        ) : holidays.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-400">
            ยังไม่มีวันหยุดในรายการ (นับเฉพาะเสาร์-อาทิตย์)
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {holidays.map((h) => (
              <li key={h.id} className="px-4 py-3">
                {editingId === h.id ? (
                  <div className="space-y-3">
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full min-w-0 rounded-lg border border-blue-400 px-3 py-2 text-sm"
                      autoFocus
                    />
                    <HolidayDateFields
                      kind={editKind}
                      setKind={setEditKind}
                      dateStr={editDateStr}
                      setDateStr={setEditDateStr}
                      day={editDay}
                      setDay={setEditDay}
                      month={editMonth}
                      setMonth={setEditMonth}
                    />
                    <div className="flex gap-3">
                      <button
                        onClick={() => handleUpdate(h)}
                        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
                      >
                        บันทึก
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="rounded-lg px-4 py-2 text-sm text-slate-500 hover:underline"
                      >
                        ยกเลิก
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <span className="min-w-0 flex-1 truncate text-sm">
                      {h.name}
                      <span className="ml-2 text-xs text-slate-400">
                        {holidayDisplay(h)}
                      </span>
                    </span>
                    <button
                      onClick={() => startEditing(h)}
                      className="shrink-0 text-sm font-medium text-blue-600 hover:underline"
                    >
                      แก้ไข
                    </button>
                    <button
                      onClick={() => handleDelete(h)}
                      className="shrink-0 text-sm font-medium text-red-600 hover:underline"
                    >
                      ลบ
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
