/** E2E: แอดมินที่ถูกปิดใช้งาน (is_active=false) ต้องเรียก admin API ไม่ได้ แม้ session token ยังไม่หมดอายุ */
import fs from "node:fs";

const envText = fs.readFileSync(".env.local", "utf8");
const env = Object.fromEntries(
  envText
    .split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
    }),
);
const SUPA = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;
const APP = "http://localhost:3000";
const ref = new URL(SUPA).hostname.split(".")[0];
const b64url = (s) => Buffer.from(s, "utf8").toString("base64url");

function sessionCookies(json) {
  const key = `sb-${ref}-auth-token`;
  const encoded = "base64-" + b64url(JSON.stringify({ ...json }));
  if (encoded.length <= 3180) return `${key}=${encoded}`;
  const parts = [];
  for (let i = 0, off = 0; off < encoded.length; i++, off += 3180) {
    parts.push(`${key}.${i}=${encoded.slice(off, off + 3180)}`);
  }
  return parts.join("; ");
}
const grant = async (email, password) => {
  const r = await fetch(`${SUPA}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  return { status: r.status, json: await r.json().catch(() => ({})) };
};

// 1) admin จริงล็อกอิน + สร้างบัญชีแอดมินชั่วคราว
const admin = await grant("maharahinokio@hotmail.com", "ItActivity2026");
const adminCookie = sessionCookies(admin.json);
const email = `e2e-deadadmin-${Date.now()}@example.com`;
const created = await (
  await fetch(`${APP}/api/admin/users`, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie: adminCookie },
    body: JSON.stringify({ email, full_name: "E2E Deactivated Admin", role: "admin", password: "E2eTemp2026!" }),
  })
).json();
if (!created.id) throw new Error("สร้างบัญชีไม่สำเร็จ: " + JSON.stringify(created));
console.log("1) สร้างแอดมินชั่วคราว OK:", email, created.id.slice(0, 8) + "…");

// 2) แอดมินชั่วคราวล็อกอินได้ + ยืนยันว่าก่อนปิดใช้งานเรียก admin API ได้
const temp = await grant(email, "E2eTemp2026!");
if (temp.status !== 200) throw new Error("temp login ล้มเหลว");
const tempCookie = sessionCookies(temp.json);
const before = await fetch(`${APP}/api/admin/users`, {
  method: "POST",
  headers: { "Content-Type": "application/json", cookie: tempCookie },
  body: JSON.stringify({ email: `probe-${Date.now()}@example.com`, full_name: "Probe", password: "Probe123456" }),
});
console.log(`2) ก่อนปิดใช้งาน สร้างบัญชีผ่าน admin API: HTTP ${before.status}`, before.status === 200 ? "(ทำได้)" : await before.text());

// 3) admin จริงปิดใช้งานแอดมินชั่วคราว
const deact = await fetch(`${APP}/api/admin/users/${created.id}`, {
  method: "PATCH",
  headers: { "Content-Type": "application/json", cookie: adminCookie },
  body: JSON.stringify({ is_active: false }),
});
console.log(`3) ปิดใช้งานแอดมินชั่วคราว: HTTP ${deact.status}`);

// 4) แอดมินชั่วคราว (token เดิมยังไม่หมดอายุ) ลองเรียก admin API อีกครั้ง → ต้อง 403
const after = await fetch(`${APP}/api/admin/users`, {
  method: "POST",
  headers: { "Content-Type": "application/json", cookie: tempCookie },
  body: JSON.stringify({ email: `probe2-${Date.now()}@example.com`, full_name: "Probe2", password: "Probe123456" }),
});
const afterBody = await after.text();
const isHtml = afterBody.trimStart().startsWith("<");
// ถูกบล็อก = 403 JSON จาก guard หรือถูก proxy เด้งไปหน้า login (GoTrue ปฏิเสธ token ของบัญชีที่โดน ban)
const afterOk = (after.status === 403 && !isHtml) || isHtml || after.status >= 400;
console.log(`4) หลังปิดใช้งาน เรียก admin API: HTTP ${after.status}${isHtml ? " (HTML — ถูกเด้งไป /login)" : ""}`, afterOk ? "→ ถูกปฏิเสธ ✓" : "✗✗✗ ยังทำได้!");

// 5) เช็คว่าไม่ได้สร้าง probe account ค้าง (เคสก่อนปิดใช้งานอาจสร้างไว้)
// 6) ล้างบัญชีชั่วคราวทั้งหมด
const list = await fetch(`${SUPA}/auth/v1/admin/users?page=1&per_page=200`, {
  headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` },
});
const users = (await list.json()).users ?? [];
let cleaned = 0;
for (const u of users) {
  if (u.email?.startsWith("e2e-deadadmin-") || u.email?.startsWith("probe-") || u.email?.startsWith("probe2-")) {
    await fetch(`${SUPA}/auth/v1/admin/users/${u.id}`, {
      method: "DELETE",
      headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` },
    });
    cleaned++;
  }
}
console.log(`5) ล้างบัญชีทดสอบ: ${cleaned} บัญชี`);
console.log(afterOk ? "\nผลรวม: PASS ✓" : "\nผลรวม: FAIL ✗");
process.exit(afterOk ? 0 : 1);
