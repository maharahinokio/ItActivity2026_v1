# ระบบบันทึกกิจกรรมเจ้าหน้าที่ไอที (IT Activity Log)

ระบบจัดเก็บกิจกรรมการทำงานของเจ้าหน้าที่ไอที รายบุคคล รายชั่วโมง — พัฒนาด้วย **Next.js + TypeScript + TailwindCSS** เก็บข้อมูลบน **Supabase** (ฐานข้อมูล + ระบบ Login + ที่เก็บไฟล์แนบ) และ deploy บน **Vercel**

## ความสามารถของระบบ

- เจ้าหน้าที่แต่ละคนเข้าสู่ระบบด้วยอีเมล/รหัสผ่าน และเห็นได้เฉพาะบันทึกของตัวเอง
- บันทึกกิจกรรม: วันที่, เวลาเริ่มต้น-สิ้นสุด, ช่วงเวลา (ใน/นอกเวลาทำการ — คำนวณอัตโนมัติจากเวลาทำการ 08:30–16:30 น. เลือกแก้เองได้), หมวดงาน, รายละเอียด
- แนบเอกสารหลักฐาน (รูปภาพ/PDF/Word/Excel ไม่เกิน 10 MB ต่อไฟล์) — ใช้กับมือถือถ่ายรูปแนบได้
- หมวดงานจัดการได้โดยแอดมิน (เพิ่ม/แก้ไข/ปิดใช้งาน)
- แอดมินเห็นบันทึกของทุกคน, กรองตามเจ้าหน้าที่, สรุปสถิติแยกตามหมวดงาน/บุคคล
- Export รายงานเป็นไฟล์ Excel (.xlsx)
- รองรับ responsive — ใช้งานได้ทั้งมือถือ แท็บเล็ต และคอมพิวเตอร์

---

## ขั้นตอนติดตั้ง (ครั้งแรก)

### 1. สร้างโปรเจกต์ Supabase

1. ไปที่ [supabase.com](https://supabase.com) สมัคร/เข้าสู่ระบบ แล้วกด **New project**
2. ตั้งชื่อโปรเจกต์ (เช่น `it-activity`) ตั้งรหัสผ่านฐานข้อมูล และเลือก region ใกล้ตัว (เช่น Singapore)
3. รอสร้างโปรเจกต์เสร็จ (~2 นาที)

### 2. รัน SQL สร้างตาราง

1. ใน Supabase Dashboard ไปที่เมนู **SQL Editor** → **New query**
2. เปิดไฟล์ [`supabase/migration.sql`](supabase/migration.sql) ในโปรเจกต์นี้ คัดลอกทั้งหมด วางลง แล้วกด **Run**
3. สคริปต์จะสร้าง: ตาราง `profiles`, `categories`, `activities`, `attachments` + กฎความปลอดภัย (RLS) + Storage bucket `attachments` + หมวดงานเริ่มต้น 7 หมวด

### 3. เอาค่า Key มาใส่ในโปรเจกต์

1. ไปที่ **Project Settings → API**
2. คัดลอกค่าทั้ง 3 ตัว:
   - `Project URL`
   - `anon public` key
   - `service_role` key (ห้ามเปิดเผย)
3. คัดลอกไฟล์ `.env.example` เป็น `.env.local` แล้วใส่ค่า:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

### 4. สร้างบัญชีแอดมินคนแรก

เนื่องจากระบบปิดการสมัครสมาชิกเอง บัญชีแรกต้องสร้างใน Supabase Dashboard:

1. ไปที่เมนู **Authentication → Users → Add user → Create new user**
2. ใส่อีเมล + รหัสผ่าน (เลือก Auto Confirm User) — ระบบจะสร้าง profile ให้อัตโนมัติ
3. ไปที่ **SQL Editor** รันคำสั่งนี้เพื่อยกระดับเป็นแอดมิน (เปลี่ยนอีเมลตามจริง):

```sql
update public.profiles
set role = 'admin', full_name = 'ชื่อ นามสกุล'
where email = 'admin@hospital.go.th';
```

> หลังจากนี้ แอดมินสามารถเพิ่มเจ้าหน้าที่คนอื่นได้เองผ่านหน้าเว็บ (เมนู "จัดการเจ้าหน้าที่")

### 5. รันบนเครื่อง (ถ้าต้องการทดสอบก่อน)

```bash
npm install
npm run dev
```

เปิด http://localhost:3000 แล้วล็อกอินด้วยบัญชีแอดมิน

---

## การ Deploy ขึ้น Vercel

1. Push โค้ดขึ้น GitHub
2. ไปที่ [vercel.com](https://vercel.com) → **Add New → Project** → เลือก repository นี้ (Vercel ตรวจจับ Next.js อัตโนมัติ ไม่ต้องตั้งค่า build เพิ่ม)
3. ก่อนกด Deploy ไปที่ **Environment Variables** แล้วเพิ่มตัวแปร 3 ตัวเดียวกับใน `.env.local` ข้างต้น
4. กด **Deploy** — เสร็จ!

> ⚠️ หลัง deploy สำเร็จ ให้กลับไปที่ Supabase → **Authentication → URL Configuration** แล้วเพิ่มโดเมน Vercel (เช่น `https://your-app.vercel.app`) ลงใน **Redirect URLs** ด้วย

## การอัปเดตโค้ดภายหลัง

แค่ push ขึ้น GitHub แล้ว Vercel จะ deploy ให้เองโดยอัตโนมัติ

---

## โครงสร้างโปรเจกต์

```
src/
├── app/
│   ├── login/                  หน้าเข้าสู่ระบบ
│   ├── (app)/                  ส่วนที่ต้องล็อกอิน
│   │   ├── page.tsx            Dashboard สรุปของตัวเอง
│   │   ├── activities/         รายการ/เพิ่ม/แก้ไขกิจกรรม
│   │   ├── reports/            รายงานสรุป + Export Excel
│   │   └── admin/              จัดการหมวดงาน / เจ้าหน้าที่ (แอดมิน)
│   └── api/admin/users/        API สร้าง-แก้ไขบัญชี (service role)
├── components/                 ฟอร์มบันทึกกิจกรรม, ตารางรายการ, รายงาน
├── lib/
│   ├── supabase/               Supabase clients (browser / server / admin)
│   ├── auth.ts                 helper ดึงผู้ใช้ปัจจุบัน
│   ├── types.ts                TypeScript types
│   └── utils.ts                คำนวณเวลา/ช่วงเวลา/จัดรูปแบบวันที่ไทย
├── proxy.ts                    ตรวจ session ทุก request (Next 16 proxy)
supabase/
└── migration.sql               สคริปต์สร้างตาราง + RLS + storage (รันครั้งเดียว)
```

## การตั้งค่าเวลาทำการ

เวลาทำการที่ใช้คำนวณ "ใน/นอกเวลาทำการ" อยู่ที่ `src/lib/utils.ts`:

```ts
export const WORK_START = "08:30";
export const WORK_END = "16:30";
```

แก้ไขค่านี้ได้ตามเวลาทำการของโรงพยาบาล
