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

/** คำนวณช่วงเวลา (ใน/นอกเวลาทำการ) จากเวลาเริ่ม-สิ้นสุด */
export function computePeriod(startTime: string, endTime: string): Period {
  return toMinutes(startTime) >= toMinutes(WORK_START) &&
    toMinutes(endTime) <= toMinutes(WORK_END)
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
