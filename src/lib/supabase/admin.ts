import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Client ฝั่ง server ที่ใช้ Service Role Key (bypass RLS)
 * ใช้เฉพาะใน API routes เพื่อให้แอดมินจัดการบัญชีผู้ใช้
 */
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
