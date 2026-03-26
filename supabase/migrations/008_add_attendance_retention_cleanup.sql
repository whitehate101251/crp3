create extension if not exists pg_cron;

create or replace function public.purge_old_attendance(p_days integer default 60)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted integer;
begin
  delete from public.attendance_sheets
  where date < (current_date - p_days);

  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

do $$
declare
  v_jobid integer;
begin
  select jobid
  into v_jobid
  from cron.job
  where jobname = 'purge-old-attendance-daily'
  limit 1;

  if v_jobid is not null then
    perform cron.unschedule(v_jobid);
  end if;
end $$;

select cron.schedule(
  'purge-old-attendance-daily',
  '0 0 * * *',
  $$select public.purge_old_attendance(60);$$
);

create or replace function public.get_attendance_retention_job_status()
returns table (
  jobid bigint,
  jobname text,
  schedule text,
  active boolean,
  command text
)
language sql
security definer
set search_path = public
as $$
  select
    j.jobid,
    j.jobname,
    j.schedule,
    j.active,
    j.command
  from cron.job j
  where j.jobname = 'purge-old-attendance-daily';
$$;
