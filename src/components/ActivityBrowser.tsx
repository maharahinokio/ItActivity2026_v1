"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { ActivityJoined, Category, Period, Profile } from "@/lib/types";
import {
  PERIOD_LABEL,
  durationMinutes,
  formatDuration,
  formatThaiDate,
  monthStartISO,
  shortTime,
  todayISO,
} from "@/lib/utils";

interface Props {
  categories: Category[];
  currentUserId: string;
  isAdmin: boolean;
  staff: Pick<Profile, "id" | "full_name">[];
}

export function ActivityBrowser({
  categories,
  currentUserId,
  isAdmin,
  staff,
}: Props) {
  const [from, setFrom] = useState(monthStartISO());
  const [to, setTo] = useState(todayISO());
  const [categoryId, setCategoryId] = useState("");
  const [period, setPeriod] = useState<Period | "">("");
  const [selectedUser, setSelectedUser] = useState(isAdmin ? "" : currentUserId);

  const [items, setItems] = useState<ActivityJoined[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // ไฟล์แนบของรายการที่โหลด — ใช้แสดงตรา 📎 และเปิดดูไฟล์
  const [attachMap, setAttachMap] = useState<
    Record<string, { file_name: string; mime_type: string }[]>
  >({});

  const fetchActivities = useCallback(async () => {
    setLoading(true);
    setError(null);
    const supabase = createClient();

    let query = supabase
      .from("activities")
      .select("*, profiles(id, full_name), categories(id, name)")
      .order("activity_date", { ascending: false })
      .order("start_time", { ascending: false });

    if (selectedUser) query = query.eq("user_id", selectedUser);
    if (from) query = query.gte("activity_date", from);
    if (to) query = query.lte("activity_date", to);
    if (categoryId) query = query.eq("category_id", categoryId);
    if (period) query = query.eq("period", period);

    const { data, error: fetchError } = await query;
    if (fetchError) setError(fetchError.message);
    const rows = (data ?? []) as unknown as ActivityJoined[];
    setItems(rows);

    // ดึงไฟล์แนบของรายการทั้งหมดเพื่อแสดงตรา 📎
    const ids = rows.map((a) => a.id);
    if (ids.length > 0) {
      const { data: atts } = await supabase
        .from("attachments")
        .select("activity_id, file_name, mime_type")
        .in("activity_id", ids);
      const map: Record<string, { file_name: string; mime_type: string }[]> = {};
      for (const at of atts ?? []) {
        (map[at.activity_id] ??= []).push({
          file_name: at.file_name,
          mime_type: at.mime_type,
        });
      }
      setAttachMap(map);
    } else {
      setAttachMap({});
    }
    setLoading(false);
  }, [selectedUser, from, to, categoryId, period]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- setLoading เกิดตอนเปลี่ยนตัวกรอง จำเป็นต้องรีเซ็ตสถานะโหลด
    fetchActivities();
  }, [fetchActivities]);

  async function handleDelete(id: string) {
    if (!confirm("ยืนยันการลบกิจกรรมนี้? ไฟล์แนบที่เกี่ยวข้องจะถูกลบด้วย")) return;

    const supabase = createClient();
    // ลบไฟล์ใน storage ก่อน
    const { data: attachments } = await supabase
      .from("attachments")
      .select("storage_path")
      .eq("activity_id", id);
    if (attachments && attachments.length > 0) {
      await supabase.storage
        .from("attachments")
        .remove(attachments.map((a) => a.storage_path));
    }
    const { error: deleteError } = await supabase
      .from("activities")
      .delete()
      .eq("id", id);
    if (deleteError) {
      alert(`ลบไม่สำเร็จ: ${deleteError.message}`);
      return;
    }
    setItems((prev) => prev.filter((a) => a.id !== id));
  }

  const totalMinutes = items.reduce(
    (sum, a) => sum + Math.max(0, durationMinutes(a.start_time, a.end_time)),
    0,
  );

  /** เปิดดูไฟล์แนบแรกของรายการ (signed URL 1 ชม.) */
  async function openFirstAttachment(activityId: string) {
    const supabase = createClient();
    const { data: att } = await supabase
      .from("attachments")
      .select("storage_path")
      .eq("activity_id", activityId)
      .limit(1)
      .single();
    if (!att) return;
    const { data } = await supabase.storage
      .from("attachments")
      .createSignedUrl(att.storage_path, 3600);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank", "noopener");
  }

  /** ตรา 📎 แสดงว่ารายการนี้มีไฟล์แนบ (กดเพื่อเปิดดูไฟล์แรก) */
  function attachmentBadge(activityId: string) {
    const files = attachMap[activityId];
    if (!files || files.length === 0) return null;
    return (
      <button
        type="button"
        onClick={() => openFirstAttachment(activityId)}
        title={`ไฟล์แนบ (${files.length}): ${files.map((f) => f.file_name).join(", ")}`}
        className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 transition hover:bg-slate-200"
      >
        📎 {files.length}
      </button>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">บันทึกกิจกรรม</h1>
        <Link
          href="/activities/new"
          className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow transition hover:bg-blue-700"
        >
          + บันทึกกิจกรรมใหม่
        </Link>
      </div>

      {/* ตัวกรอง */}
      <div className="grid grid-cols-2 gap-3 rounded-xl bg-white p-4 shadow sm:grid-cols-3 lg:grid-cols-5">
        <div className="min-w-0">
          <label className="mb-1 block text-xs font-medium text-slate-500">
            จากวันที่
          </label>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="w-full min-w-0 rounded-lg border border-slate-300 px-2.5 py-2 text-sm"
          />
        </div>
        <div className="min-w-0">
          <label className="mb-1 block text-xs font-medium text-slate-500">
            ถึงวันที่
          </label>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="w-full min-w-0 rounded-lg border border-slate-300 px-2.5 py-2 text-sm"
          />
        </div>
        <div className="min-w-0">
          <label className="mb-1 block text-xs font-medium text-slate-500">
            หมวดงาน
          </label>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm"
          >
            <option value="">ทั้งหมด</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-0">
          <label className="mb-1 block text-xs font-medium text-slate-500">
            ช่วงเวลา
          </label>
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as Period | "")}
            className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm"
          >
            <option value="">ทั้งหมด</option>
            <option value="in_hours">ในเวลาทำการ</option>
            <option value="out_of_hours">นอกเวลาทำการ</option>
          </select>
        </div>
        {isAdmin ? (
          <div className="min-w-0">
            <label className="mb-1 block text-xs font-medium text-slate-500">
              เจ้าหน้าที่
            </label>
            <select
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm"
            >
              <option value="">ทุกคน</option>
              {staff.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className="flex items-end text-sm text-slate-500">
            รวม {items.length} รายการ · {formatDuration(totalMinutes)}
          </div>
        )}
      </div>

      {isAdmin && items.length > 0 && (
        <p className="text-sm text-slate-500">
          พบ {items.length} รายการ · รวม {formatDuration(totalMinutes)}
        </p>
      )}

      {error && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </p>
      )}

      {loading ? (
        <p className="py-12 text-center text-sm text-slate-400">
          กำลังโหลดข้อมูล...
        </p>
      ) : items.length === 0 ? (
        <div className="rounded-xl bg-white py-16 text-center shadow">
          <p className="text-slate-400">ไม่พบกิจกรรมตามเงื่อนไขที่เลือก</p>
          <Link
            href="/activities/new"
            className="mt-3 inline-block text-sm font-medium text-blue-600 hover:underline"
          >
            + บันทึกกิจกรรมใหม่
          </Link>
        </div>
      ) : (
        <>
          {/* ตาราง — จอใหญ่ */}
          <div className="hidden overflow-x-auto rounded-xl bg-white shadow md:block">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs text-slate-500">
                  <th className="px-4 py-3">วันที่</th>
                  <th className="px-4 py-3">เวลา</th>
                  <th className="px-4 py-3">ระยะเวลา</th>
                  <th className="px-4 py-3">ช่วงเวลา</th>
                  {isAdmin && <th className="px-4 py-3">เจ้าหน้าที่</th>}
                  <th className="px-4 py-3">หมวดงาน</th>
                  <th className="px-4 py-3">รายละเอียด</th>
                  <th className="px-4 py-3 text-right">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((a) => (
                  <tr key={a.id} className="hover:bg-slate-50">
                    <td className="whitespace-nowrap px-4 py-3">
                      {formatThaiDate(a.activity_date)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      {shortTime(a.start_time)}–{shortTime(a.end_time)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-500">
                      {formatDuration(
                        Math.max(0, durationMinutes(a.start_time, a.end_time)),
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          a.period === "in_hours"
                            ? "bg-green-100 text-green-700"
                            : "bg-indigo-100 text-indigo-700"
                        }`}
                      >
                        {PERIOD_LABEL[a.period]}
                      </span>
                    </td>
                    {isAdmin && (
                      <td className="px-4 py-3">{a.profiles?.full_name ?? "-"}</td>
                    )}
                    <td className="px-4 py-3">{a.categories?.name ?? "-"}</td>
                    <td className="max-w-xs px-4 py-3">
                      <p className="flex items-center gap-2">
                        <span className="truncate" title={a.description}>
                          {a.description}
                        </span>
                        {attachmentBadge(a.id)}
                      </p>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <Link
                        href={`/activities/${a.id}/edit`}
                        className="font-medium text-blue-600 hover:underline"
                      >
                        แก้ไข
                      </Link>
                      <button
                        onClick={() => handleDelete(a.id)}
                        className="ml-3 font-medium text-red-600 hover:underline"
                      >
                        ลบ
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* การ์ด — มือถือ */}
          <div className="space-y-3 md:hidden">
            {items.map((a) => (
              <div key={a.id} className="rounded-xl bg-white p-4 shadow">
                <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded bg-slate-100 px-2 py-0.5 font-medium text-slate-600">
                    {formatThaiDate(a.activity_date)}
                  </span>
                  <span className="rounded bg-slate-100 px-2 py-0.5 text-slate-600">
                    {shortTime(a.start_time)}–{shortTime(a.end_time)}
                  </span>
                  <span className="text-slate-400">
                    {formatDuration(
                      Math.max(0, durationMinutes(a.start_time, a.end_time)),
                    )}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 font-medium ${
                      a.period === "in_hours"
                        ? "bg-green-100 text-green-700"
                        : "bg-indigo-100 text-indigo-700"
                    }`}
                  >
                    {PERIOD_LABEL[a.period]}
                  </span>
                  {attachmentBadge(a.id)}
                </div>
                <p className="text-sm">{a.description}</p>
                <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
                  <span>
                    {a.categories?.name ?? "ไม่ระบุหมวดงาน"}
                    {isAdmin && a.profiles?.full_name
                      ? ` · ${a.profiles.full_name}`
                      : ""}
                  </span>
                  <span>
                    <Link
                      href={`/activities/${a.id}/edit`}
                      className="font-medium text-blue-600"
                    >
                      แก้ไข
                    </Link>
                    <button
                      onClick={() => handleDelete(a.id)}
                      className="ml-3 font-medium text-red-600"
                    >
                      ลบ
                    </button>
                  </span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
