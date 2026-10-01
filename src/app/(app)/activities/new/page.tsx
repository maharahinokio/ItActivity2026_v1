import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ActivityForm } from "@/components/ActivityForm";
import type { Category } from "@/lib/types";

export default async function NewActivityPage() {
  const { userId } = await requireSession();
  const supabase = await createClient();
  const { data: categories } = await supabase
    .from("categories")
    .select("*")
    .eq("is_active", true)
    .order("sort_order");

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <h1 className="text-2xl font-bold">บันทึกกิจกรรมใหม่</h1>
      <ActivityForm
        categories={(categories ?? []) as Category[]}
        userId={userId}
      />
    </div>
  );
}
