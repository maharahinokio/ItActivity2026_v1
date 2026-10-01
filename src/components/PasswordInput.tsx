"use client";

import { useState } from "react";

type Props = React.InputHTMLAttributes<HTMLInputElement>;

/** ช่องกรอกรหัสผ่าน พร้อมปุ่มกดดู/ซ่อนรหัสผ่าน */
export function PasswordInput({ className = "", ...props }: Props) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <input
        {...props}
        type={visible ? "text" : "password"}
        className={`w-full rounded-lg border border-slate-300 px-3 py-2.5 pr-11 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 ${className}`}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
        title={visible ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
        className="absolute right-1 top-1/2 -translate-y-1/2 rounded-md px-2 py-1.5 text-base text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
      >
        {visible ? "🙈" : "👁"}
      </button>
    </div>
  );
}
