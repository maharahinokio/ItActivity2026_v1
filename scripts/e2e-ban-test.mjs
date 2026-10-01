/**
 * E2E regression test: ปิด/เปิดใช้งานบัญชีต้องบังคับใช้ที่ GoTrue จริง
 * 1) แอดมิน login (GoTrue password grant) → สร้าง session cookie แบบเดียวกับ @supabase/ssr
 * 2) สร้างบัญชีชั่วคราวผ่าน API ของแอป (POST /api/admin/users)
 * 3) PATCH is_active=false → เช็ค password grant ต้อง fail ด้วย banned
 * 4) PATCH is_active=true  → เช็ค password grant ต้องสำเร็จ
 * 5) ลบบัญชีชั่วคราวด้วย service-role
 * (ไม่พิมพ์ค่า key ใดๆ ออกทาง stdout)
 */
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
const PROJECT_REF = new URL(SUPA).hostname.split(".")[0];
const ADMIN_EMAIL = "maharahinokio@hotmail.com";
const ADMIN_PASSWORD = "ItActivity2026";
const TEMP_PASSWORD = "E2eTemp2026!";

const b64url = (s) => Buffer.from(s, "utf8").toString("base64url");
const log = (...a) => console.log(...a);

async function passwordGrant(email, password) {
  const res = await fetch(`${SUPA}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  return { status: res.status, json: await res.json().catch(() => ({})) };
}

function sessionCookies(grantJson) {
  const session = { ...grantJson };
  const key = `sb-${PROJECT_REF}-auth-token`;
  const encoded = "base64-" + b64url(JSON.stringify(session));
  if (encoded.length <= 3180) return `${key}=${encoded}`;
  const parts = [];
  for (let i = 0, off = 0; off < encoded.length; i++, off += 3180) {
    parts.push(`${key}.${i}=${encoded.slice(off, off + 3180)}`);
  }
  return parts.join("; ");
}

// ── 1) admin login ───────────────────────────────────────────────
const adminGrant = await passwordGrant(ADMIN_EMAIL, ADMIN_PASSWORD);
if (adminGrant.status !== 200) {
  throw new Error("admin login ล้มเหลว: " + JSON.stringify(adminGrant.json));
}
const adminCookie = sessionCookies(adminGrant.json);
const adminId = adminGrant.json.user.id;
log("1) admin login: OK (user " + adminId.slice(0, 8) + "…)");

// ── 2) สร้างบัญชีชั่วคราวผ่าน API ของแอป ──────────────────────────
const tempEmail = `e2e-ban-${Date.now()}@example.com`;
const createRes = await fetch(`${APP}/api/admin/users`, {
  method: "POST",
  headers: { "Content-Type": "application/json", cookie: adminCookie },
  body: JSON.stringify({
    email: tempEmail,
    full_name: "E2E ทดสอบ Ban",
    role: "staff",
    password: TEMP_PASSWORD,
  }),
});
const created = await createRes.json();
if (createRes.status !== 200 || !created.id) {
  throw new Error("สร้างบัญชีชั่วคราวไม่สำเร็จ: " + createRes.status + " " + JSON.stringify(created));
}
const tempId = created.id;
log(`2) สร้างบัญชีชั่วคราวผ่าน /api/admin/users: OK (${tempEmail}, id ${tempId.slice(0, 8)}…)`);

// ── 3) ปิดใช้งาน → grant ต้องโดน ban ─────────────────────────────
const deactRes = await fetch(`${APP}/api/admin/users/${tempId}`, {
  method: "PATCH",
  headers: { "Content-Type": "application/json", cookie: adminCookie },
  body: JSON.stringify({ is_active: false }),
});
log(`3) PATCH is_active=false: HTTP ${deactRes.status}`, deactRes.status === 200 ? "OK" : await deactRes.text());

const bannedGrant = await passwordGrant(tempEmail, TEMP_PASSWORD);
const bannedOk = bannedGrant.status !== 200;
log(
  `   password grant หลังปิดใช้งาน: HTTP ${bannedGrant.status}` +
    (bannedGrant.json.error_description || bannedGrant.json.msg || ""),
  bannedOk ? "→ ถูกปฏิเสธ ✓" : "→ ยังเข้าได้ ✗✗✗",
);

// เช็คว่า GoTrue บันทึก banned_until จริง
const svcList = await fetch(`${SUPA}/auth/v1/admin/users?page=1&per_page=1`, {
  headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` },
});
const svcJson = await svcList.json().catch(() => null);
const tempUser =
  svcJson?.users?.find((u) => u.email === tempEmail) ??
  (await (async () => {
    const r = await fetch(`${SUPA}/auth/v1/admin/users?page=1&per_page=200`, {
      headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` },
    });
    return (await r.json().catch(() => ({})))?.users?.find((u) => u.email === tempEmail);
  })()) ??
  null;
log(`   banned_until ใน auth.users: ${tempUser?.banned_until ?? "(ไม่พบ user)"}`);

// ── 4) เปิดใช้งานกลับ → grant ต้องผ่าน ────────────────────────────
const reactRes = await fetch(`${APP}/api/admin/users/${tempId}`, {
  method: "PATCH",
  headers: { "Content-Type": "application/json", cookie: adminCookie },
  body: JSON.stringify({ is_active: true }),
});
log(`4) PATCH is_active=true: HTTP ${reactRes.status}`, reactRes.status === 200 ? "OK" : await reactRes.text());

const unbanGrant = await passwordGrant(tempEmail, TEMP_PASSWORD);
const unbanOk = unbanGrant.status === 200;
log(
  `   password grant หลังเปิดใช้งาน: HTTP ${unbanGrant.status}`,
  unbanOk ? "→ เข้าได้ตามปกติ ✓" : "→ ยังถูกปฏิเสธ ✗✗✗ " + JSON.stringify(unbanGrant.json),
);

// ── 5) ลบบัญชีชั่วคราว (service-role) ─────────────────────────────
const delRes = await fetch(`${SUPA}/auth/v1/admin/users/${tempId}`, {
  method: "DELETE",
  headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` },
});
log(`5) ลบบัญชีชั่วคราว: HTTP ${delRes.status}`, delRes.status >= 200 && delRes.status < 300 ? "OK" : "");

const pass = bannedOk && unbanOk;
log(pass ? "\nผลรวม: PASS ✓  (ปิดใช้งานบังคับใช้จริงที่ GoTrue)" : "\nผลรวม: FAIL ✗");
process.exit(pass ? 0 : 1);
