alter table if exists public.attendance_sheets
  add column if not exists approved_at timestamptz;

update public.attendance_sheets
set approved_at = created_at
where status = 'APPROVED'
  and approved_at is null;