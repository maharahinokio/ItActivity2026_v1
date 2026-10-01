import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ReportsView } from "@/components/ReportsView";
import type { Profile } from "@/lib/types";

export default async function ReportsPage() {
  const { userId, profile } = await requireSession();
  const supabase = await createClient();

  let staff: Pick<Profile, "id" | "full_name">[] = [];
  if (profile.role === "admin") {
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name")
      .eq("is_active", true)
      .order("full_name");
    staff = data ?? [];
  }

  return (
    <ReportsView
      isAdmin={profile.role === "admin"}
      currentUserId={userId}
      staff={staff}
    />
  );
}
