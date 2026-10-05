"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { PasswordInput } from "@/components/PasswordInput";

type Status = { kind: "success" | "error"; message: string } | null;

/** หน้าเปลี่ยนรหัสผ่านของตัวเอง (เข้าถึงโดยคลิกชื่อที่แถบด้านบน) */
export default function ProfilePage() {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<Status>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setStatus(null);

    if (newPassword.length < 6) {
      setStatus({ kind: "error", message: "รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร" });
      return;
    }
    if (newPassword !== confirmPassword) {
      setStatus({ kind: "error", message: "รหัสผ่านใหม่กับยืนยันรหัสผ่านไม่ตรงกัน" });
      return;
    }

    setBusy(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.email) {
      setBusy(false);
      setStatus({ kind: "error", message: "ไม่พบข้อมูลผู้ใช้ กรุณาล็อกอินใหม่" });
      return;
    }

    // ตรวจรหัสผ่านปัจจุบันก่อน (re-auth) — กันคนอื่นเปลี่ยนรหัสผ่านบนเครื่องที่ลืมปิด
    const { error: verifyError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    });
    if (verifyError) {
      setBusy(false);
      setStatus({ kind: "error", message: "รหัสผ่านปัจจุบันไม่ถูกต้อง" });
      return;
    }

    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setBusy(false);

    setStatus(
      error
        ? { kind: "error", message: `เปลี่ยนรหัสผ่านไม่สำเร็จ: ${error.message}` }
        : { kind: "success", message: "เปลี่ยนรหัสผ่านเรียบร้อยแล้ว (ครั้งหน้าให้ใช้รหัสผ่านใหม่)" },
    );
    if (!error) {
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-5">
      <h1 className="text-2xl font-bold">เปลี่ยนรหัสผ่าน</h1>

      <form
        onSubmit={handleChangePassword}
        className="space-y-4 rounded-xl bg-white p-5 shadow sm:p-6"
      >
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            รหัสผ่านปัจจุบัน <span className="text-red-500">*</span>
          </label>
          <PasswordInput
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            รหัสผ่านใหม่ <span className="text-red-500">*</span>
          </label>
          <PasswordInput
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            ยืนยันรหัสผ่านใหม่ <span className="text-red-500">*</span>
          </label>
          <PasswordInput
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />
        </div>
        {status && (
          <p
            className={`rounded-lg px-4 py-3 text-sm ${
              status.kind === "success"
                ? "bg-green-50 text-green-700"
                : "bg-red-50 text-red-600"
            }`}
          >
            {status.message}
          </p>
        )}
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow transition hover:bg-blue-700 disabled:opacity-60"
        >
          {busy ? "กำลังเปลี่ยนรหัสผ่าน..." : "เปลี่ยนรหัสผ่าน"}
        </button>
      </form>
    </div>
  );
}
