do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'si_attendance_status'
      and n.nspname = 'public'
  ) then
    create type public.si_attendance_status as enum ('PRESENT', 'ABSENT');
  end if;
end $$;

create table if not exists public.si_attendance_entries (
  id uuid primary key default gen_random_uuid(),
  si_user_id uuid not null references public.users(id) on delete cascade,
  site_id uuid references public.sites(id) on delete set null,
  date date not null,
  name text not null,
  father_name text,
  phone_number text,
  status public.si_attendance_status not null,
  source_sheet_id uuid references public.attendance_sheets(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint si_attendance_entries_user_date_key unique (si_user_id, date)
);

create index if not exists idx_si_attendance_entries_date on public.si_attendance_entries(date);
create index if not exists idx_si_attendance_entries_site_id on public.si_attendance_entries(site_id);
create index if not exists idx_si_attendance_entries_si_user_id on public.si_attendance_entries(si_user_id);

grant select on public.si_attendance_entries to anon, authenticated;
grant all privileges on public.si_attendance_entries to service_role;
