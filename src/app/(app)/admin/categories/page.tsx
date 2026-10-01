"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Category } from "@/lib/types";

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const fetchCategories = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from("categories")
      .select("*")
      .order("sort_order");
    setCategories((data ?? []) as Category[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- setLoading ตอนเริ่มโหลดข้อมูลจาก Supabase
    fetchCategories();
  }, [fetchCategories]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setError(null);
    const supabase = createClient();
    const { error: insertError } = await supabase.from("categories").insert({
      name: newName.trim(),
      sort_order: categories.length + 1,
    });
    if (insertError) {
      setError(
        insertError.message.includes("duplicate")
          ? "มีหมวดงานชื่อนี้อยู่แล้ว"
          : `เพิ่มไม่สำเร็จ: ${insertError.message}`,
      );
      return;
    }
    setNewName("");
    fetchCategories();
  }

  async function handleRename(id: string) {
    if (!editingName.trim()) return;
    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("categories")
      .update({ name: editingName.trim() })
      .eq("id", id);
    if (updateError) {
      alert(`แก้ไขไม่สำเร็จ: ${updateError.message}`);
      return;
    }
    setEditingId(null);
    fetchCategories();
  }

  async function handleToggleActive(cat: Category) {
    const supabase = createClient();
    await supabase
      .from("categories")
      .update({ is_active: !cat.is_active })
      .eq("id", cat.id);
    fetchCategories();
  }

  async function handleDelete(cat: Category) {
    if (
      !confirm(
        `ยืนยันการลบหมวดงาน "${cat.name}"? กิจกรรมที่ใช้หมวดงานนี้จะกลายเป็น "ไม่ระบุ"`,
      )
    )
      return;
    const supabase = createClient();
    const { error: deleteError } = await supabase
      .from("categories")
      .delete()
      .eq("id", cat.id);
    if (deleteError) {
      alert(`ลบไม่สำเร็จ: ${deleteError.message}`);
      return;
    }
    fetchCategories();
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <h1 className="text-2xl font-bold">จัดการหมวดงาน</h1>

      <form
        onSubmit={handleAdd}
        className="flex flex-col gap-3 rounded-xl bg-white p-4 shadow sm:flex-row"
      >
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="ชื่อหมวดงานใหม่ เช่น พัฒนาระบบสารสนเทศ"
          className="flex-1 rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        />
        <button
          type="submit"
          className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
        >
          + เพิ่มหมวดงาน
        </button>
      </form>

      {error && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </p>
      )}

      <div className="rounded-xl bg-white shadow">
        {loading ? (
          <p className="py-12 text-center text-sm text-slate-400">
            กำลังโหลด...
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {categories.map((cat) => (
              <li
                key={cat.id}
                className="flex flex-wrap items-center gap-3 px-4 py-3"
              >
                {editingId === cat.id ? (
                  <>
                    <input
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      className="flex-1 rounded-lg border border-blue-400 px-3 py-1.5 text-sm"
                      autoFocus
                    />
                    <button
                      onClick={() => handleRename(cat.id)}
                      className="text-sm font-medium text-blue-600 hover:underline"
                    >
                      บันทึก
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="text-sm text-slate-500 hover:underline"
                    >
                      ยกเลิก
                    </button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 text-sm">
                      {cat.name}
                      {!cat.is_active && (
                        <span className="ml-2 rounded bg-slate-200 px-1.5 py-0.5 text-xs text-slate-500">
                          ปิดใช้งาน
                        </span>
                      )}
                    </span>
                    <button
                      onClick={() => handleToggleActive(cat)}
                      className="text-sm text-slate-500 hover:underline"
                    >
                      {cat.is_active ? "ปิดใช้งาน" : "เปิดใช้งาน"}
                    </button>
                    <button
                      onClick={() => {
                        setEditingId(cat.id);
                        setEditingName(cat.name);
                      }}
                      className="text-sm font-medium text-blue-600 hover:underline"
                    >
                      แก้ไข
                    </button>
                    <button
                      onClick={() => handleDelete(cat)}
                      className="text-sm font-medium text-red-600 hover:underline"
                    >
                      ลบ
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="text-xs text-slate-400">
        หมายเหตุ: การ &quot;ปิดใช้งาน&quot; จะทำให้หมวดงานนั้นไม่แสดงในฟอร์มบันทึกกิจกรรมใหม่
        แต่ยังคงอยู่ในรายการเดิม
      </p>
    </div>
  );
}
