import { NextResponse } from "next/server";
import { getProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

/** PATCH /api/admin/users/[id] — แอดมินแก้ไขข้อมูลเจ้าหน้าที่ / รีเซ็ตรหัสผ่าน */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const caller = await getProfile();
  if (!caller || caller.role !== "admin") {
    return NextResponse.json({ error: "ไม่มีสิทธิ์เข้าถึง" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);

  // กันแอดมินล็อกตัวเองออกจากระบบ
  if (id === caller.id && (body?.role !== undefined || body?.is_active === false)) {
    return NextResponse.json(
      { error: "ไม่สามารถเปลี่ยนสิทธิ์หรือปิดใช้งานบัญชีของตัวเองได้" },
      { status: 400 },
    );
  }

  const adminClient = createAdminClient();

  // อัปเดตรหัสผ่าน (ถ้ามีส่งมา)
  if (body?.password) {
    if (body.password.length < 6) {
      return NextResponse.json(
        { error: "รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร" },
        { status: 400 },
      );
    }
    const { error: pwError } = await adminClient.auth.admin.updateUserById(
      id,
      { password: body.password },
    );
    if (pwError) {
      return NextResponse.json({ error: pwError.message }, { status: 400 });
    }
  }

  // อัปเดตข้อมูล profile
  const profileUpdates: Record<string, unknown> = {};
  if (body?.full_name !== undefined) profileUpdates.full_name = String(body.full_name).trim();
  if (body?.role !== undefined) profileUpdates.role = body.role === "admin" ? "admin" : "staff";
  if (body?.is_active !== undefined) profileUpdates.is_active = Boolean(body.is_active);

  if (Object.keys(profileUpdates).length > 0) {
    const { error: updateError } = await adminClient
      .from("profiles")
      .update(profileUpdates)
      .eq("id", id);
    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 });
    }
  }

  return NextResponse.json({ ok: true });
}
