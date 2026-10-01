"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { PasswordInput } from "@/components/PasswordInput";
import type { Profile } from "@/lib/types";

export default function AdminStaffPage() {
  const [staff, setStaff] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ฟอร์มสร้างบัญชีใหม่
  const [showCreate, setShowCreate] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newFullName, setNewFullName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<"staff" | "admin">("staff");
  const [creating, setCreating] = useState(false);
  const [createdInfo, setCreatedInfo] = useState<string | null>(null);

  // แถวที่กำลังแก้ไข
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFullName, setEditFullName] = useState("");
  const [editRole, setEditRole] = useState<"staff" | "admin">("staff");
  const [resetPasswordId, setResetPasswordId] = useState<string | null>(null);
  const [resetPassword, setResetPassword] = useState("");

  const fetchStaff = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .order("full_name");
    setStaff((data ?? []) as Profile[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- setLoading ตอนเริ่มโหลดข้อมูลจาก Supabase
    fetchStaff();
  }, [fetchStaff]);

  function randomPassword(): string {
    const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
    let out = "";
    for (let i = 0; i < 8; i++) {
      out += chars[Math.floor(Math.random() * chars.length)];
    }
    return out;
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCreatedInfo(null);
    setCreating(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: newEmail,
          full_name: newFullName,
          password: newPassword,
          role: newRole,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "สร้างบัญชีไม่สำเร็จ");
        return;
      }
      setCreatedInfo(
        `สร้างบัญชีสำเร็จ: ${data.full_name} (${data.email}) — รหัสผ่าน: ${newPassword}`,
      );
      setNewEmail("");
      setNewFullName("");
      setNewPassword(randomPassword());
      setShowCreate(false);
      fetchStaff();
    } finally {
      setCreating(false);
    }
  }

  async function handleUpdate(id: string, updates: Record<string, unknown>) {
    setError(null);
    const res = await fetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "บันทึกไม่สำเร็จ");
      return false;
    }
    fetchStaff();
    return true;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">จัดการเจ้าหน้าที่</h1>
        <button
          onClick={() => {
            setShowCreate((v) => !v);
            setNewPassword(randomPassword());
            setCreatedInfo(null);
          }}
          className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow transition hover:bg-blue-700"
        >
          {showCreate ? "ปิดฟอร์ม" : "+ เพิ่มเจ้าหน้าที่ใหม่"}
        </button>
      </div>

      {createdInfo && (
        <p className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">
          {createdInfo} — กรุณาจดและแจ้งรหัสผ่านให้เจ้าหน้าที่ทราบ
        </p>
      )}

      {showCreate && (
        <form
          onSubmit={handleCreate}
          className="grid grid-cols-1 gap-3 rounded-xl bg-white p-4 shadow sm:grid-cols-2"
        >
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">
              ชื่อ - สกุล <span className="text-red-500">*</span>
            </label>
            <input
              required
              value={newFullName}
              onChange={(e) => setNewFullName(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">
              อีเมล (ใช้เข้าสู่ระบบ) <span className="text-red-500">*</span>
            </label>
            <input
              required
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">
              รหัสผ่านเริ่มต้น <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-2">
              <PasswordInput
                required
                minLength={6}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setNewPassword(randomPassword())}
                className="whitespace-nowrap rounded-lg border border-slate-300 px-3 text-sm text-slate-600 hover:bg-slate-50"
              >
                สุ่มรหัส
              </button>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">
              สิทธิ์
            </label>
            <select
              value={newRole}
              onChange={(e) => setNewRole(e.target.value as "staff" | "admin")}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              <option value="staff">เจ้าหน้าที่</option>
              <option value="admin">แอดมิน</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={creating}
              className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
            >
              {creating ? "กำลังสร้าง..." : "สร้างบัญชี"}
            </button>
          </div>
        </form>
      )}

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
            {staff.map((person) => (
              <li key={person.id} className="px-4 py-3">
                {editingId === person.id ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      value={editFullName}
                      onChange={(e) => setEditFullName(e.target.value)}
                      className="flex-1 rounded-lg border border-blue-400 px-3 py-1.5 text-sm"
                    />
                    <select
                      value={editRole}
                      onChange={(e) =>
                        setEditRole(e.target.value as "staff" | "admin")
                      }
                      className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm"
                    >
                      <option value="staff">เจ้าหน้าที่</option>
                      <option value="admin">แอดมิน</option>
                    </select>
                    <button
                      onClick={async () => {
                        const ok = await handleUpdate(person.id, {
                          full_name: editFullName,
                          role: editRole,
                        });
                        if (ok) setEditingId(null);
                      }}
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
                  </div>
                ) : resetPasswordId === person.id ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm text-slate-600">
                      รหัสผ่านใหม่ของ {person.full_name}:
                    </span>
                    <PasswordInput
                      value={resetPassword}
                      onChange={(e) => setResetPassword(e.target.value)}
                      minLength={6}
                      placeholder="อย่างน้อย 6 ตัวอักษร"
                    />
                    <button
                      onClick={async () => {
                        const ok = await handleUpdate(person.id, {
                          password: resetPassword,
                        });
                        if (ok) {
                          setResetPasswordId(null);
                          setResetPassword("");
                        }
                      }}
                      className="text-sm font-medium text-blue-600 hover:underline"
                    >
                      บันทึก
                    </button>
                    <button
                      onClick={() => setResetPasswordId(null)}
                      className="text-sm text-slate-500 hover:underline"
                    >
                      ยกเลิก
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="flex-1 text-sm">
                      <span className="font-medium">{person.full_name}</span>
                      <span className="ml-2 text-xs text-slate-400">
                        {person.email}
                      </span>
                      {person.role === "admin" && (
                        <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-semibold text-amber-700">
                          แอดมิน
                        </span>
                      )}
                      {!person.is_active && (
                        <span className="ml-2 rounded bg-slate-200 px-1.5 py-0.5 text-xs text-slate-500">
                          ปิดใช้งาน
                        </span>
                      )}
                    </span>
                    <button
                      onClick={() => {
                        setEditingId(person.id);
                        setEditFullName(person.full_name);
                        setEditRole(person.role);
                      }}
                      className="text-sm font-medium text-blue-600 hover:underline"
                    >
                      แก้ไข
                    </button>
                    <button
                      onClick={() => {
                        setResetPasswordId(person.id);
                        setResetPassword("");
                      }}
                      className="text-sm text-slate-600 hover:underline"
                    >
                      รีเซ็ตรหัสผ่าน
                    </button>
                    <button
                      onClick={() =>
                        handleUpdate(person.id, {
                          is_active: !person.is_active,
                        })
                      }
                      className="text-sm text-slate-600 hover:underline"
                    >
                      {person.is_active ? "ปิดใช้งาน" : "เปิดใช้งาน"}
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="text-xs text-slate-400">
        หมายเหตุ: การ &quot;ปิดใช้งาน&quot; จะทำให้เจ้าหน้าที่นั้นเข้าสู่ระบบไม่ได้
        แต่บันทึกกิจกรรมเดิมยังคงอยู่
      </p>
    </div>
  );
}
