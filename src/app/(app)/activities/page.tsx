import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ActivityBrowser } from "@/components/ActivityBrowser";
import type { Category, Profile } from "@/lib/types";

export default async function ActivitiesPage() {
  const { userId, profile } = await requireSession();
  const supabase = await createClient();

  const { data: categories } = await supabase
    .from("categories")
    .select("*")
    .order("sort_order");

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
    <ActivityBrowser
      categories={(categories ?? []) as Category[]}
      currentUserId={userId}
      isAdmin={profile.role === "admin"}
      staff={staff}
    />
  );
}
