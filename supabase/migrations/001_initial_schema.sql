create extension if not exists pgcrypto;
create extension if not exists pg_cron;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'user_role') then
    create type user_role as enum ('ADMIN', 'SITE_INCHARGE', 'FOREMAN');
  end if;

  if not exists (select 1 from pg_type where typname = 'attendance_status') then
    create type attendance_status as enum ('DRAFT', 'SENT_TO_SI', 'SENT_TO_ADMIN', 'APPROVED');
  end if;
end $$;

create table if not exists public.sites (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  location text,
  incharge_id uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  auth_id uuid unique references auth.users(id) on delete cascade,
  username text not null unique,
  name text not null,
  role user_role not null,
  phone text,
  site_id uuid,
  parent_id uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.workers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  foreman_id uuid not null,
  site_id uuid not null,
  created_at timestamptz not null default now()
);

create table if not exists public.attendance_sheets (
  id uuid primary key default gen_random_uuid(),
  foreman_id uuid not null,
  site_id uuid not null,
  date date not null,
  in_time time,
  out_time time,
  status attendance_status not null default 'DRAFT',
  created_at timestamptz not null default now(),
  constraint attendance_sheets_foreman_date_key unique (foreman_id, date)
);

create table if not exists public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  sheet_id uuid not null,
  worker_id uuid not null,
  present boolean not null default false,
  x_value integer not null default 0,
  y_value integer not null default 0,
  total_hours numeric generated always as (((x_value * 8) + y_value)::numeric) stored,
  double_check boolean not null default false,
  created_at timestamptz not null default now(),
  constraint attendance_records_sheet_worker_key unique (sheet_id, worker_id),
  constraint attendance_records_x_value_check check (x_value between 0 and 48),
  constraint attendance_records_y_value_check check (y_value between 0 and 7),
  constraint attendance_records_absent_values_check check (
    (present = true and x_value between 0 and 48 and y_value between 0 and 7)
    or
    (present = false and x_value = 0 and y_value = 0)
  )
);

do $$
begin
  if not exists (
    select 1
    from information_schema.table_constraints
    where constraint_name = 'sites_incharge_id_fkey'
      and table_name = 'sites'
      and table_schema = 'public'
  ) then
    alter table public.sites
      add constraint sites_incharge_id_fkey
      foreign key (incharge_id) references public.users(id) on delete set null;
  end if;

  if not exists (
    select 1
    from information_schema.table_constraints
    where constraint_name = 'users_site_id_fkey'
      and table_name = 'users'
      and table_schema = 'public'
  ) then
    alter table public.users
      add constraint users_site_id_fkey
      foreign key (site_id) references public.sites(id) on delete set null;
  end if;

  if not exists (
    select 1
    from information_schema.table_constraints
    where constraint_name = 'users_parent_id_fkey'
      and table_name = 'users'
      and table_schema = 'public'
  ) then
    alter table public.users
      add constraint users_parent_id_fkey
      foreign key (parent_id) references public.users(id) on delete set null;
  end if;

  if not exists (
    select 1
    from information_schema.table_constraints
    where constraint_name = 'workers_foreman_id_fkey'
      and table_name = 'workers'
      and table_schema = 'public'
  ) then
    alter table public.workers
      add constraint workers_foreman_id_fkey
      foreign key (foreman_id) references public.users(id) on delete cascade;
  end if;

  if not exists (
    select 1
    from information_schema.table_constraints
    where constraint_name = 'workers_site_id_fkey'
      and table_name = 'workers'
      and table_schema = 'public'
  ) then
    alter table public.workers
      add constraint workers_site_id_fkey
      foreign key (site_id) references public.sites(id) on delete cascade;
  end if;

  if not exists (
    select 1
    from information_schema.table_constraints
    where constraint_name = 'attendance_sheets_foreman_id_fkey'
      and table_name = 'attendance_sheets'
      and table_schema = 'public'
  ) then
    alter table public.attendance_sheets
      add constraint attendance_sheets_foreman_id_fkey
      foreign key (foreman_id) references public.users(id) on delete cascade;
  end if;

  if not exists (
    select 1
    from information_schema.table_constraints
    where constraint_name = 'attendance_sheets_site_id_fkey'
      and table_name = 'attendance_sheets'
      and table_schema = 'public'
  ) then
    alter table public.attendance_sheets
      add constraint attendance_sheets_site_id_fkey
      foreign key (site_id) references public.sites(id) on delete cascade;
  end if;

  if not exists (
    select 1
    from information_schema.table_constraints
    where constraint_name = 'attendance_records_sheet_id_fkey'
      and table_name = 'attendance_records'
      and table_schema = 'public'
  ) then
    alter table public.attendance_records
      add constraint attendance_records_sheet_id_fkey
      foreign key (sheet_id) references public.attendance_sheets(id) on delete cascade;
  end if;

  if not exists (
    select 1
    from information_schema.table_constraints
    where constraint_name = 'attendance_records_worker_id_fkey'
      and table_name = 'attendance_records'
      and table_schema = 'public'
  ) then
    alter table public.attendance_records
      add constraint attendance_records_worker_id_fkey
      foreign key (worker_id) references public.workers(id) on delete cascade;
  end if;
end $$;

create index if not exists idx_users_role on public.users(role);
create index if not exists idx_users_site_id on public.users(site_id);
create index if not exists idx_users_parent_id on public.users(parent_id);
create index if not exists idx_workers_foreman_id on public.workers(foreman_id);
create index if not exists idx_workers_site_id on public.workers(site_id);
create index if not exists idx_attendance_sheets_foreman_id on public.attendance_sheets(foreman_id);
create index if not exists idx_attendance_sheets_site_id on public.attendance_sheets(site_id);
create index if not exists idx_attendance_sheets_status on public.attendance_sheets(status);
create index if not exists idx_attendance_sheets_date on public.attendance_sheets(date);
create index if not exists idx_attendance_records_sheet_id on public.attendance_records(sheet_id);
create index if not exists idx_attendance_records_worker_id on public.attendance_records(worker_id);

create or replace function public.current_app_user_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select u.id
  from public.users u
  where u.auth_id = auth.uid()
  limit 1;
$$;

create or replace function public.current_app_user_role()
returns user_role
language sql
stable
security definer
set search_path = public
as $$
  select u.role
  from public.users u
  where u.auth_id = auth.uid()
  limit 1;
$$;

create or replace function public.current_app_site_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select u.site_id
  from public.users u
  where u.auth_id = auth.uid()
  limit 1;
$$;

alter table public.sites enable row level security;
alter table public.users enable row level security;
alter table public.workers enable row level security;
alter table public.attendance_sheets enable row level security;
alter table public.attendance_records enable row level security;

drop policy if exists "admins_manage_sites" on public.sites;
create policy "admins_manage_sites" on public.sites
for all
using (public.current_app_user_role() = 'ADMIN')
with check (public.current_app_user_role() = 'ADMIN');

drop policy if exists "site_incharge_view_sites" on public.sites;
create policy "site_incharge_view_sites" on public.sites
for select
using (
  public.current_app_user_role() = 'SITE_INCHARGE'
  and id = public.current_app_site_id()
);

drop policy if exists "foreman_view_own_site" on public.sites;
create policy "foreman_view_own_site" on public.sites
for select
using (
  public.current_app_user_role() = 'FOREMAN'
  and id = public.current_app_site_id()
);

drop policy if exists "admins_manage_users" on public.users;
create policy "admins_manage_users" on public.users
for all
using (public.current_app_user_role() = 'ADMIN')
with check (public.current_app_user_role() = 'ADMIN');

drop policy if exists "users_view_self" on public.users;
create policy "users_view_self" on public.users
for select
using (id = public.current_app_user_id());

drop policy if exists "site_incharge_view_site_users" on public.users;
create policy "site_incharge_view_site_users" on public.users
for select
using (
  public.current_app_user_role() = 'SITE_INCHARGE'
  and site_id = public.current_app_site_id()
);

drop policy if exists "admins_manage_workers" on public.workers;
create policy "admins_manage_workers" on public.workers
for all
using (public.current_app_user_role() = 'ADMIN')
with check (public.current_app_user_role() = 'ADMIN');

drop policy if exists "site_incharge_manage_site_workers" on public.workers;
create policy "site_incharge_manage_site_workers" on public.workers
for all
using (
  public.current_app_user_role() = 'SITE_INCHARGE'
  and site_id = public.current_app_site_id()
)
with check (
  public.current_app_user_role() = 'SITE_INCHARGE'
  and site_id = public.current_app_site_id()
);

drop policy if exists "foreman_view_own_workers" on public.workers;
create policy "foreman_view_own_workers" on public.workers
for select
using (
  public.current_app_user_role() = 'FOREMAN'
  and foreman_id = public.current_app_user_id()
);

drop policy if exists "admins_manage_attendance_sheets" on public.attendance_sheets;
create policy "admins_manage_attendance_sheets" on public.attendance_sheets
for all
using (public.current_app_user_role() = 'ADMIN')
with check (public.current_app_user_role() = 'ADMIN');

drop policy if exists "site_incharge_manage_site_sheets" on public.attendance_sheets;
create policy "site_incharge_manage_site_sheets" on public.attendance_sheets
for all
using (
  public.current_app_user_role() = 'SITE_INCHARGE'
  and site_id = public.current_app_site_id()
)
with check (
  public.current_app_user_role() = 'SITE_INCHARGE'
  and site_id = public.current_app_site_id()
);

drop policy if exists "foreman_manage_own_sheets" on public.attendance_sheets;
create policy "foreman_manage_own_sheets" on public.attendance_sheets
for all
using (
  public.current_app_user_role() = 'FOREMAN'
  and foreman_id = public.current_app_user_id()
)
with check (
  public.current_app_user_role() = 'FOREMAN'
  and foreman_id = public.current_app_user_id()
);

drop policy if exists "admins_manage_attendance_records" on public.attendance_records;
create policy "admins_manage_attendance_records" on public.attendance_records
for all
using (public.current_app_user_role() = 'ADMIN')
with check (public.current_app_user_role() = 'ADMIN');

drop policy if exists "site_incharge_manage_site_records" on public.attendance_records;
create policy "site_incharge_manage_site_records" on public.attendance_records
for all
using (
  public.current_app_user_role() = 'SITE_INCHARGE'
  and exists (
    select 1
    from public.attendance_sheets s
    where s.id = attendance_records.sheet_id
      and s.site_id = public.current_app_site_id()
  )
)
with check (
  public.current_app_user_role() = 'SITE_INCHARGE'
  and exists (
    select 1
    from public.attendance_sheets s
    where s.id = attendance_records.sheet_id
      and s.site_id = public.current_app_site_id()
  )
);

drop policy if exists "foreman_manage_own_records" on public.attendance_records;
create policy "foreman_manage_own_records" on public.attendance_records
for all
using (
  public.current_app_user_role() = 'FOREMAN'
  and exists (
    select 1
    from public.attendance_sheets s
    where s.id = attendance_records.sheet_id
      and s.foreman_id = public.current_app_user_id()
  )
)
with check (
  public.current_app_user_role() = 'FOREMAN'
  and exists (
    select 1
    from public.attendance_sheets s
    where s.id = attendance_records.sheet_id
      and s.foreman_id = public.current_app_user_id()
  )
);

create or replace function public.cleanup_old_attendance()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_count integer := 0;
begin
  with deleted_rows as (
    delete from public.attendance_sheets
    where status = 'APPROVED'
      and date < current_date - interval '90 days'
    returning id
  )
  select count(*) into deleted_count from deleted_rows;

  return deleted_count;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from cron.job
    where jobname = 'cleanup-attendance'
  ) then
    perform cron.schedule(
      'cleanup-attendance',
      '0 2 * * *',
      'select public.cleanup_old_attendance();'
    );
  end if;
exception
  when undefined_table then
    raise notice 'pg_cron metadata table not available; schedule manually in Supabase.';
end $$;
