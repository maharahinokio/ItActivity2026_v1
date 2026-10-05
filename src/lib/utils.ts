import type { Period } from "./types";

/** เวลาทำการปกติ (ใช้คำนวณ "ใน/นอกเวลาทำการ" อัตโนมัติ) */
export const WORK_START = "08:30";
export const WORK_END = "16:30";

export const PERIOD_LABEL: Record<Period, string> = {
  in_hours: "ในเวลาทำการ",
  out_of_hours: "นอกเวลาทำการ",
};

/** แปลง "HH:mm" หรือ "HH:mm:ss" เป็นจำนวนนาที */
export function toMinutes(time: string): number {
  const [h = "0", m = "0"] = time.split(":");
  return Number(h) * 60 + Number(m);
}

/** รวมวันหยุดสำหรับคำนวณช่วงเวลา (มาจากตาราง holidays) */
export interface HolidayMap {
  /** วันหยุดกำหนดวันเดียว (YYYY-MM-DD) */
  specificDates: Set<string>;
  /** วันหยุดที่เกิดทุกปี (MM-DD) */
  yearlyDates: Set<string>;
}

/** วันนี้เป็นวันไม่ทำการหรือไม่ (เสาร์/อาทิตย์ หรือตรงกับวันหยุดตามปฏิทิน) */
export function isNonWorkingDay(date: string, holidays?: HolidayMap): boolean {
  const d = new Date(date + "T00:00:00");
  if (isNaN(d.getTime())) return false;
  const dow = d.getDay();
  if (dow === 0 || dow === 6) return true;
  if (!holidays) return false;
  return holidays.specificDates.has(date) || holidays.yearlyDates.has(date.slice(5));
}

/**
 * คำนวณช่วงเวลา (ใน/นอกเวลาทำการ) จากวันที่ + เวลาเริ่ม-สิ้นสุด
 * - เสาร์/อาทิตย์ หรือวันหยุดตามปฏิทิน → นอกเวลาทำการ
 * - วันทำการ: ดูที่ "เวลาเริ่มต้น" เป็นตัวตั้ง — เริ่มในช่วง 08:30–16:30 นับเป็นในเวลา
 *   ทั้งรายการแม้สิ้นสุดเลยเขต (งานที่คร่อมเขตเวลานับตามต้น)
 */
export function computePeriod(
  date: string,
  startTime: string,
  endTime: string,
  holidays?: HolidayMap,
): Period {
  if (isNonWorkingDay(date, holidays)) return "out_of_hours";
  const start = toMinutes(startTime);
  return start >= toMinutes(WORK_START) && start <= toMinutes(WORK_END)
    ? "in_hours"
    : "out_of_hours";
}

/** ระยะเวลาเป็นนาที (ถ้าเวลาสิ้นสุดน้อยกว่าเวลาเริ่ม = ไม่ถูกต้อง) */
export function durationMinutes(startTime: string, endTime: string): number {
  const diff = toMinutes(endTime) - toMinutes(startTime);
  return diff;
}

/** แสดงจำนวนนาทีเป็น "2 ชม. 30 นาที" */
export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} นาที`;
  if (m === 0) return `${h} ชม.`;
  return `${h} ชม. ${m} นาที`;
}

/** แปลงเวลา "HH:mm:ss" เป็น "HH:mm" */
export function shortTime(time: string): string {
  return time?.slice(0, 5) ?? "";
}

/** แปลงวันที่ ISO เป็นรูปแบบไทย เช่น "30 ก.ย. 2568" */
const THAI_MONTHS_SHORT = [
  "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
  "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
];

export function formatThaiDate(isoDate: string): string {
  if (!isoDate) return "";
  const d = new Date(isoDate + "T00:00:00");
  if (isNaN(d.getTime())) return isoDate;
  return `${d.getDate()} ${THAI_MONTHS_SHORT[d.getMonth()]} ${d.getFullYear() + 543}`;
}

/** แปลง "MM-DD" เป็น "13 เม.ย." (สำหรับวันหยุดที่เกิดทุกปี) */
export function formatThaiMonthDay(monthDay: string): string {
  const [m = "0", d = "0"] = monthDay.split("-");
  const month = Number(m);
  const day = Number(d);
  if (month < 1 || month > 12 || day < 1 || day > 31) return monthDay;
  return `${day} ${THAI_MONTHS_SHORT[month - 1]}`;
}

/** วันนี้ในรูปแบบ YYYY-MM-DD (ตามเวลาท้องถิ่น) */
export function todayISO(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/** ต้นเดือนปัจจุบัน YYYY-MM-DD */
export function monthStartISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

/** ขนาดไฟล์ที่อ่านง่าย */
export function formatFileSize(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * แปลงชื่อไฟล์เป็นชื่อที่ Supabase Storage ยอมรับ (ASCII เท่านั้น)
 * — Storage ปฏิเสธ key ที่มีอักขระไทย ("Invalid key") ดังนั้นเก็บไฟล์จริงด้วย
 * ชื่อ ASCII ส่วนชื่อไทยเดิมเก็บแยกในคอลัมน์ attachments.file_name เพื่อแสดงผล
 */
export function safeStorageName(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  const ext = dot > 0 ? fileName.slice(dot).toLowerCase() : "";
  const base = dot > 0 ? fileName.slice(0, dot) : fileName;
  const ascii = base
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `${Date.now()}-${ascii || "file"}${ext}`;
}
