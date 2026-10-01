import { NextResponse } from "next/server";
import { getProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

/** POST /api/admin/users — แอดมินสร้างบัญชีเจ้าหน้าที่ใหม่ */
export async function POST(request: Request) {
  const caller = await getProfile();
  if (!caller || caller.role !== "admin") {
    return NextResponse.json({ error: "ไม่มีสิทธิ์เข้าถึง" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const email = body?.email?.trim()?.toLowerCase();
  const fullName = body?.full_name?.trim();
  const password = body?.password;
  const role = body?.role === "admin" ? "admin" : "staff";

  if (!email || !fullName || !password || password.length < 6) {
    return NextResponse.json(
      { error: "กรุณากรอกอีเมล ชื่อ-สกุล และรหัสผ่านอย่างน้อย 6 ตัวอักษร" },
      { status: 400 },
    );
  }

  const adminClient = createAdminClient();
  const { data, error } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });

  if (error) {
    const message = error.message.includes("already")
      ? "อีเมลนี้ถูกใช้แล้ว"
      : error.message;
    return NextResponse.json({ error: message }, { status: 400 });
  }

  // กำหนด role (trigger สร้าง profile เป็น staff ไว้ก่อนแล้ว)
  if (role !== "staff" && data.user) {
    await adminClient
      .from("profiles")
      .update({ role })
      .eq("id", data.user.id);
  }

  return NextResponse.json({
    id: data.user?.id,
    email,
    full_name: fullName,
    role,
  });
}
