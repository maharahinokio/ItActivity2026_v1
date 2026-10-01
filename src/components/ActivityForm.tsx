"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { Activity, Attachment, Category, Period } from "@/lib/types";
import {
  PERIOD_LABEL,
  computePeriod,
  durationMinutes,
  formatDuration,
  formatFileSize,
} from "@/lib/utils";

interface Props {
  categories: Category[];
  userId: string;
  activity?: Activity & { attachments: Attachment[] };
}

interface NewFile {
  file: File;
  previewUrl?: string;
}

export function ActivityForm({ categories, userId, activity }: Props) {
  const router = useRouter();
  const isEdit = Boolean(activity);

  const [activityDate, setActivityDate] = useState(
    activity?.activity_date ?? new Date().toISOString().slice(0, 10),
  );
  const [startTime, setStartTime] = useState(activity?.start_time?.slice(0, 5) ?? "");
  const [endTime, setEndTime] = useState(activity?.end_time?.slice(0, 5) ?? "");
  const [periodChoice, setPeriodChoice] = useState<"auto" | Period>(
    activity?.period ?? "auto",
  );
  const [categoryId, setCategoryId] = useState(activity?.category_id ?? "");
  const [description, setDescription] = useState(activity?.description ?? "");

  const [existingAttachments] = useState<Attachment[]>(
    activity?.attachments ?? [],
  );
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set());
  const [newFiles, setNewFiles] = useState<NewFile[]>([]);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeExisting = existingAttachments.filter(
    (a) => !removedIds.has(a.id),
  );

  // สร้าง signed URL สำหรับแสดงรูปไฟล์แนบเดิม
  useEffect(() => {
    if (activeExisting.length === 0) return;
    const supabase = createClient();
    let cancelled = false;
    (async () => {
      const urls: Record<string, string> = {};
      for (const att of activeExisting) {
        if (signedUrls[att.id]) continue;
        const { data } = await supabase.storage
          .from("attachments")
          .createSignedUrl(att.storage_path, 3600);
        if (data) urls[att.id] = data.signedUrl;
      }
      if (!cancelled && Object.keys(urls).length > 0) {
        setSignedUrls((prev) => ({ ...prev, ...urls }));
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existingAttachments, removedIds]);

  const computedPeriod = useMemo(() => {
    if (!startTime || !endTime) return null;
    return computePeriod(startTime, endTime);
  }, [startTime, endTime]);

  const effectivePeriod: Period | null =
    periodChoice === "auto" ? computedPeriod : periodChoice;

  const totalNewMinutes =
    startTime && endTime && durationMinutes(startTime, endTime) > 0
      ? durationMinutes(startTime, endTime)
      : null;

  function handleFilesSelected(files: FileList | null) {
    if (!files) return;
    const items: NewFile[] = [];
    for (const file of Array.from(files)) {
      if (file.size > 10 * 1024 * 1024) {
        setError(`ไฟล์ "${file.name}" มีขนาดเกิน 10 MB`);
        continue;
      }
      items.push({
        file,
        previewUrl: file.type.startsWith("image/")
          ? URL.createObjectURL(file)
          : undefined,
      });
    }
    setNewFiles((prev) => [...prev, ...items]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removeNewFile(index: number) {
    setNewFiles((prev) => {
      const copy = [...prev];
      const [item] = copy.splice(index, 1);
      if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
      return copy;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!startTime || !endTime) {
      setError("กรุณาระบุเวลาเริ่มต้นและเวลาสิ้นสุด");
      return;
    }
    if (durationMinutes(startTime, endTime) <= 0) {
      setError("เวลาสิ้นสุดต้องมาหลังเวลาเริ่มต้น (บันทึกในวันเดียวกัน)");
      return;
    }
    if (!effectivePeriod) {
      setError("กรุณาระบุช่วงเวลา (ใน/นอกเวลาทำการ)");
      return;
    }

    setSaving(true);
    try {
      const supabase = createClient();

      const payload = {
        activity_date: activityDate,
        start_time: startTime,
        end_time: endTime,
        period: effectivePeriod,
        category_id: categoryId || null,
        description: description.trim(),
      };

      let activityId = activity?.id;

      if (isEdit && activityId) {
        const { error: updateError } = await supabase
          .from("activities")
          .update(payload)
          .eq("id", activityId);
        if (updateError) throw updateError;
      } else {
        const { data, error: insertError } = await supabase
          .from("activities")
          .insert(payload)
          .select("id")
          .single();
        if (insertError) throw insertError;
        activityId = data.id;
      }

      // ลบไฟล์แนบที่ผู้ใช้เอาออก
      if (removedIds.size > 0) {
        const removed = existingAttachments.filter((a) => removedIds.has(a.id));
        for (const att of removed) {
          await supabase.storage.from("attachments").remove([att.storage_path]);
        }
        await supabase
          .from("attachments")
          .delete()
          .in("id", [...removedIds]);
      }

      // อัปโหลดไฟล์ใหม่
      for (const item of newFiles) {
        const safeName = item.file.name.replace(/[^\w.\-\u0E00-\u0E7F]+/g, "_");
        const path = `${userId}/${activityId}/${Date.now()}-${safeName}`;
        const { error: uploadError } = await supabase.storage
          .from("attachments")
          .upload(path, item.file);
        if (uploadError) throw uploadError;

        const { error: attError } = await supabase
          .from("attachments")
          .insert({
            activity_id: activityId,
            storage_path: path,
            file_name: item.file.name,
            mime_type: item.file.type,
            size_bytes: item.file.size,
          });
        if (attError) throw attError;
      }

      router.push("/activities");
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "บันทึกไม่สำเร็จ กรุณาลองอีกครั้ง",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="rounded-xl bg-white p-5 shadow sm:p-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="min-w-0">
            <label className="mb-1 block text-sm font-medium text-slate-700">
              วันที่ <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              required
              value={activityDate}
              onChange={(e) => setActivityDate(e.target.value)}
              className="w-full min-w-0 rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <div className="grid min-w-0 grid-cols-2 gap-4">
            <div className="min-w-0">
              <label className="mb-1 block text-sm font-medium text-slate-700">
                เวลาเริ่มต้น <span className="text-red-500">*</span>
              </label>
              <input
                type="time"
                required
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full min-w-0 rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>
            <div className="min-w-0">
              <label className="mb-1 block text-sm font-medium text-slate-700">
                เวลาสิ้นสุด <span className="text-red-500">*</span>
              </label>
              <input
                type="time"
                required
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full min-w-0 rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>
          </div>
        </div>

        {totalNewMinutes !== null && (
          <p className="mt-2 text-sm text-slate-500">
            ระยะเวลา: <span className="font-medium">{formatDuration(totalNewMinutes)}</span>
          </p>
        )}

        <div className="mt-4">
          <label className="mb-1 block text-sm font-medium text-slate-700">
            ช่วงเวลา
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setPeriodChoice("auto")}
              className={`rounded-lg border px-3 py-1.5 text-sm transition ${
                periodChoice === "auto"
                  ? "border-blue-500 bg-blue-50 text-blue-700"
                  : "border-slate-300 text-slate-600 hover:bg-slate-50"
              }`}
            >
              อัตโนมัติ
            </button>
            <button
              type="button"
              onClick={() => setPeriodChoice("in_hours")}
              className={`rounded-lg border px-3 py-1.5 text-sm transition ${
                periodChoice === "in_hours"
                  ? "border-blue-500 bg-blue-50 text-blue-700"
                  : "border-slate-300 text-slate-600 hover:bg-slate-50"
              }`}
            >
              ในเวลาทำการ
            </button>
            <button
              type="button"
              onClick={() => setPeriodChoice("out_of_hours")}
              className={`rounded-lg border px-3 py-1.5 text-sm transition ${
                periodChoice === "out_of_hours"
                  ? "border-blue-500 bg-blue-50 text-blue-700"
                  : "border-slate-300 text-slate-600 hover:bg-slate-50"
              }`}
            >
              นอกเวลาทำการ
            </button>
            {effectivePeriod && (
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  effectivePeriod === "in_hours"
                    ? "bg-green-100 text-green-700"
                    : "bg-indigo-100 text-indigo-700"
                }`}
              >
                {PERIOD_LABEL[effectivePeriod]}
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-slate-400">
            ระบบคำนวณจากเวลาทำการ 08:30–16:30 น. โดยอัตโนมัติ สามารถเลือกเองได้
          </p>
        </div>

        <div className="mt-4">
          <label className="mb-1 block text-sm font-medium text-slate-700">
            หมวดงาน
          </label>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          >
            <option value="">— ไม่ระบุ —</option>
            {categories
              .filter((c) => c.is_active || c.id === categoryId)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </select>
        </div>

        <div className="mt-4">
          <label className="mb-1 block text-sm font-medium text-slate-700">
            รายละเอียดงาน <span className="text-red-500">*</span>
          </label>
          <textarea
            required
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="อธิบายงานที่ทำ เช่น แก้ไขปัญหาเครือข่ายที่หอผู้ป่วยใน ชั้น 3..."
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
        </div>
      </div>

      {/* ไฟล์แนบ */}
      <div className="rounded-xl bg-white p-5 shadow sm:p-6">
        <h2 className="mb-3 font-semibold">เอกสารหลักฐาน (แนบรูป/ไฟล์ได้)</h2>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx"
          onChange={(e) => handleFilesSelected(e.target.files)}
          className="block w-full text-sm text-slate-500 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-blue-700 hover:file:bg-blue-100"
        />
        <p className="mt-1 text-xs text-slate-400">
          รองรับรูปภาพ, PDF, Word, Excel — ไฟล์ไม่เกิน 10 MB ต่อไฟล์
        </p>

        {(activeExisting.length > 0 || newFiles.length > 0) && (
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {activeExisting.map((att) => (
              <div
                key={att.id}
                className="group relative overflow-hidden rounded-lg border border-slate-200"
              >
                {att.mime_type.startsWith("image/") && signedUrls[att.id] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={signedUrls[att.id]}
                    alt={att.file_name}
                    className="h-28 w-full object-cover"
                  />
                ) : (
                  <div className="flex h-28 flex-col items-center justify-center gap-1 bg-slate-50 text-center">
                    <span className="text-2xl">
                      {att.mime_type.includes("pdf") ? "📕" : "📄"}
                    </span>
                    <span className="max-w-full truncate px-1 text-xs text-slate-500">
                      {att.file_name}
                    </span>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() =>
                    setRemovedIds((prev) => new Set(prev).add(att.id))
                  }
                  className="absolute right-1 top-1 rounded-full bg-red-600 px-2 py-0.5 text-xs text-white shadow hover:bg-red-700"
                >
                  ลบ
                </button>
              </div>
            ))}

            {newFiles.map((item, index) => (
              <div
                key={`${item.file.name}-${index}`}
                className="relative overflow-hidden rounded-lg border border-blue-300"
              >
                {item.previewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.previewUrl}
                    alt={item.file.name}
                    className="h-28 w-full object-cover"
                  />
                ) : (
                  <div className="flex h-28 flex-col items-center justify-center gap-1 bg-blue-50 text-center">
                    <span className="text-2xl">
                      {item.file.type.includes("pdf") ? "📕" : "📄"}
                    </span>
                    <span className="max-w-full truncate px-1 text-xs text-slate-500">
                      {item.file.name}
                    </span>
                    <span className="text-xs text-slate-400">
                      {formatFileSize(item.file.size)}
                    </span>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => removeNewFile(index)}
                  className="absolute right-1 top-1 rounded-full bg-red-600 px-2 py-0.5 text-xs text-white shadow hover:bg-red-700"
                >
                  ลบ
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white shadow transition hover:bg-blue-700 disabled:opacity-60"
        >
          {saving ? "กำลังบันทึก..." : isEdit ? "บันทึกการแก้ไข" : "บันทึกกิจกรรม"}
        </button>
        <Link
          href="/activities"
          className="rounded-lg border border-slate-300 px-6 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
        >
          ยกเลิก
        </Link>
      </div>
    </form>
  );
}
