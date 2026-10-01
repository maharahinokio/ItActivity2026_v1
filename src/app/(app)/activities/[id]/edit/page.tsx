import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ActivityForm } from "@/components/ActivityForm";
import type { Activity, Attachment, Category } from "@/lib/types";

export default async function EditActivityPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireSession();
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: activity }, { data: categories }, { data: attachments }] =
    await Promise.all([
      supabase.from("activities").select("*").eq("id", id).single(),
      supabase
        .from("categories")
        .select("*")
        .order("sort_order"),
      supabase.from("attachments").select("*").eq("activity_id", id),
    ]);

  if (!activity) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <h1 className="text-2xl font-bold">แก้ไขกิจกรรม</h1>
      <ActivityForm
        categories={(categories ?? []) as Category[]}
        userId={activity.user_id}
        activity={
          { ...activity, attachments: attachments ?? [] } as Activity & {
            attachments: Attachment[];
          }
        }
      />
    </div>
  );
}
