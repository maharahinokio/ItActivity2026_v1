import { redirect } from "next/navigation";
import { createClient } from "./supabase/server";
import type { Profile } from "./types";

export interface Session {
  userId: string;
  profile: Profile;
}

/** ดึงผู้ใช้ปัจจุบันพร้อม profile — ถ้ายังไม่ล็อกอิน redirect ไป /login */
export async function requireSession(): Promise<Session> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/login");

  // บัญชีที่ถูกปิดใช้งาน: เพิกถอน session แล้วเด้งออก (ชั้นเสริมนอกเหนือจาก GoTrue ban)
  if (!(profile as Profile).is_active) {
    await supabase.auth.signOut();
    redirect("/login");
  }

  return { userId: user.id, profile: profile as Profile };
}

/** ดึง profile โดยไม่ redirect (สำหรับ middleware/layout ที่ต้องการเช็คเงื่อนไข) */
export async function getProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  return (profile as Profile) ?? null;
}
