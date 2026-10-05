-- ============================================================
-- IT Activity Log — Supabase Migration
-- รันสคริปต์นี้ครั้งเดียวใน Supabase Dashboard > SQL Editor
-- ============================================================

-- 1) ตาราง profiles (เจ้าหน้าที่) เชื่อมกับ auth.users
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  full_name text not null default '',
  role text not null default 'staff' check (role in ('admin', 'staff')),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- 2) ตาราง categories (หมวดงาน)
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- 3) ตาราง activities (บันทึกกิจกรรม)
create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  activity_date date not null,
  start_time time not null,
  end_time time not null,
  period text not null default 'in_hours' check (period in ('in_hours', 'out_of_hours')),
  category_id uuid references public.categories (id) on delete set null,
  description text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists activities_user_date_idx on public.activities (user_id, activity_date desc);
create index if not exists activities_date_idx on public.activities (activity_date desc);

create index if not exists categories_sort_idx on public.categories (sort_order);

-- 2b) ตาราง holidays (ปฏิทินวันหยุด — admin จัดการเอง)
--     kind='yearly' → วันหยุดที่เกิดทุกปี เก็บ month_day รูปแบบ 'MM-DD'
--     kind='once'   → วันหยุดกำหนดวันเดียว เก็บ date (YYYY-MM-DD)
create table if not exists public.holidays (
  id uuid primary key default gen_random_uuid(),
  name text not null default '',
  kind text not null check (kind in ('yearly', 'once')),
  date date,
  month_day text,
  created_at timestamptz not null default now(),
  constraint holidays_shape_check check (
    (kind = 'once' and date is not null and month_day is null)
    or (kind = 'yearly' and month_day is not null and date is null)
  )
);

create index if not exists holidays_date_idx on public.holidays (date);
create index if not exists holidays_month_day_idx on public.holidays (month_day);

-- ฐานข้อมูลเดิม (สร้างก่อนการแก้ไข): เติม default ให้ user_id เพื่อไม่ให้ client เป็นผู้กำหนดเจ้าของรายการ
alter table public.activities alter column user_id set default auth.uid();

-- 4) ตาราง attachments (ไฟล์แนบ — ไฟล์จริงเก็บใน Storage bucket "attachments")
create table if not exists public.attachments (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.activities (id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  mime_type text not null default '',
  size_bytes bigint,
  created_at timestamptz not null default now()
);

create index if not exists attachments_activity_idx on public.attachments (activity_id);

-- 5) ฟังก์ชันตรวจสอบสิทธิ์แอดมิน (security definer เพื่อใช้ใน RLS)
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and is_active
  );
$$;

-- บัญชีที่ยัง active เท่านั้นที่ใช้สิทธิ์เจ้าของรายการได้ (ใช้คู่กับ user_id = auth.uid()
-- เพื่อให้การปิดใช้งานบัญชีมีผลต่อ data plane ด้วย)
create or replace function public.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and is_active
  );
$$;

-- 6) Trigger: สร้าง profile อัตโนมัติเมื่อมีการสร้างผู้ใช้ใหม่ใน auth
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.email, '')
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 7) Trigger: อัปเดต updated_at ของ activities
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists activities_touch_updated_at on public.activities;
create trigger activities_touch_updated_at
  before update on public.activities
  for each row execute function public.touch_updated_at();

-- ============================================================
-- 8) เปิด RLS และสร้าง Policy
-- ============================================================
alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.holidays enable row level security;
alter table public.activities enable row level security;
alter table public.attachments enable row level security;

-- profiles: เห็นตัวเอง + แอดมินเห็นทุกคน (การแก้ไขทำผ่าน server route เท่านั้น)
drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles
  for select using (id = auth.uid() or public.is_admin());

-- เคลียร์ของที่เคยเพิ่มสำหรับฟีเจอร์ "แก้โปรไฟล์เอง" (ยกเลิกแล้ว): กลับสู่สิทธิ์ปกติ
-- (รันแล้วไม่มีผลอะไรถ้าไม่เคยสร้าง, ถ้าเคยรันเวอร์ชันเก่าจะทำให้ DB กลับสู่ค่าเริ่มต้น)
drop policy if exists "profiles_self_update" on public.profiles;
drop trigger if exists on_auth_user_updated on auth.users;
grant update on table public.profiles to authenticated;

-- categories: ทุกคนที่ล็อกอินอ่านได้, แอดมินเท่านั้นที่เขียนได้
drop policy if exists "categories_select" on public.categories;
create policy "categories_select" on public.categories
  for select using (auth.role() = 'authenticated');

drop policy if exists "categories_insert" on public.categories;
create policy "categories_insert" on public.categories
  for insert with check (public.is_admin());

drop policy if exists "categories_update" on public.categories;
create policy "categories_update" on public.categories
  for update using (public.is_admin()) with check (public.is_admin());

drop policy if exists "categories_delete" on public.categories;
create policy "categories_delete" on public.categories
  for delete using (public.is_admin());

-- holidays: ทุกคนที่ล็อกอินอ่านได้ (ใช้คำนวณ auto period), แอดมินเท่านั้นที่จัดการ
drop policy if exists "holidays_select" on public.holidays;
create policy "holidays_select" on public.holidays
  for select using (auth.role() = 'authenticated');

drop policy if exists "holidays_insert" on public.holidays;
create policy "holidays_insert" on public.holidays
  for insert with check (public.is_admin());

drop policy if exists "holidays_update" on public.holidays;
create policy "holidays_update" on public.holidays
  for update using (public.is_admin()) with check (public.is_admin());

drop policy if exists "holidays_delete" on public.holidays;
create policy "holidays_delete" on public.holidays
  for delete using (public.is_admin());

-- activities: แต่ละคนจัดการของตัวเอง, แอดมินจัดการได้ทุกรายการ
drop policy if exists "activities_select" on public.activities;
create policy "activities_select" on public.activities
  for select using ((user_id = auth.uid() and public.is_active_user()) or public.is_admin());

drop policy if exists "activities_insert" on public.activities;
create policy "activities_insert" on public.activities
  for insert with check ((user_id = auth.uid() and public.is_active_user()) or public.is_admin());

drop policy if exists "activities_update" on public.activities;
create policy "activities_update" on public.activities
  for update using ((user_id = auth.uid() and public.is_active_user()) or public.is_admin())
  with check ((user_id = auth.uid() and public.is_active_user()) or public.is_admin());

drop policy if exists "activities_delete" on public.activities;
create policy "activities_delete" on public.activities
  for delete using ((user_id = auth.uid() and public.is_active_user()) or public.is_admin());

-- attachments: ตามสิทธิ์ของ activity ที่ไฟล์แนบอยู่
drop policy if exists "attachments_select" on public.attachments;
create policy "attachments_select" on public.attachments
  for select using (
    exists (
      select 1 from public.activities a
      where a.id = activity_id
        and ((a.user_id = auth.uid() and public.is_active_user()) or public.is_admin())
    )
  );

drop policy if exists "attachments_insert" on public.attachments;
create policy "attachments_insert" on public.attachments
  for insert with check (
    exists (
      select 1 from public.activities a
      where a.id = activity_id
        and ((a.user_id = auth.uid() and public.is_active_user()) or public.is_admin())
    )
  );

drop policy if exists "attachments_delete" on public.attachments;
create policy "attachments_delete" on public.attachments
  for delete using (
    exists (
      select 1 from public.activities a
      where a.id = activity_id
        and ((a.user_id = auth.uid() and public.is_active_user()) or public.is_admin())
    )
  );

-- ============================================================
-- 9) Storage bucket "attachments" (private) + policies
-- ============================================================
insert into storage.buckets (id, name, public)
values ('attachments', 'attachments', false)
on conflict (id) do nothing;

-- แต่ละคนอ่าน/เขียนไฟล์ในโฟลเดอร์ของตัวเอง: {user_id}/{activity_id}/ชื่อไฟล์
drop policy if exists "attachments_storage_select" on storage.objects;
create policy "attachments_storage_select" on storage.objects
  for select using (
    bucket_id = 'attachments'
    and (public.is_admin() or ((storage.foldername(name))[1] = auth.uid()::text and public.is_active_user()))
  );

drop policy if exists "attachments_storage_insert" on storage.objects;
create policy "attachments_storage_insert" on storage.objects
  for insert with check (
    bucket_id = 'attachments'
    and (public.is_admin() or ((storage.foldername(name))[1] = auth.uid()::text and public.is_active_user()))
  );

drop policy if exists "attachments_storage_delete" on storage.objects;
create policy "attachments_storage_delete" on storage.objects
  for delete using (
    bucket_id = 'attachments'
    and (public.is_admin() or ((storage.foldername(name))[1] = auth.uid()::text and public.is_active_user()))
  );

-- ============================================================
-- 10) ข้อมูลหมวดงานเริ่มต้น
-- ============================================================
insert into public.categories (name, sort_order) values
  ('ระบบเครือข่าย', 1),
  ('ติดตั้งโปรแกรม', 2),
  ('ประชุม', 3),
  ('ซ่อมบำรุงฮาร์ดแวร์', 4),
  ('อบรม/ให้ความรู้', 5),
  ('เอกสาร/รายงาน', 6),
  ('อื่นๆ', 7)
on conflict (name) do nothing;
