export type Role = "admin" | "staff";
export type Period = "in_hours" | "out_of_hours";

export interface Profile {
  id: string;
  email: string | null;
  full_name: string;
  role: Role;
  is_active: boolean;
  created_at: string;
}

export interface Category {
  id: string;
  name: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

export type HolidayKind = "yearly" | "once";

export interface Holiday {
  id: string;
  name: string;
  kind: HolidayKind;
  /** วันหยุดกำหนดวันเดียว (YYYY-MM-DD) — ใช้เมื่อ kind = "once" */
  date: string | null;
  /** วันหยุดทุกปี (MM-DD) — ใช้เมื่อ kind = "yearly" */
  month_day: string | null;
  created_at: string;
}

export interface Activity {
  id: string;
  user_id: string;
  activity_date: string; // YYYY-MM-DD
  start_time: string; // HH:mm:ss
  end_time: string; // HH:mm:ss
  period: Period;
  category_id: string | null;
  description: string;
  created_at: string;
  updated_at: string;
}

export type ActivityJoined = Activity & {
  profiles: Pick<Profile, "id" | "full_name"> | null;
  categories: Pick<Category, "id" | "name"> | null;
};

export interface Attachment {
  id: string;
  activity_id: string;
  storage_path: string;
  file_name: string;
  mime_type: string;
  size_bytes: number | null;
  created_at: string;
}

export interface ActivityFilters {
  from?: string;
  to?: string;
  categoryId?: string;
  period?: Period | "";
  userId?: string;
}
