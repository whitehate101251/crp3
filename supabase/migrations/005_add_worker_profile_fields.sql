alter table public.workers
add column if not exists father_name text,
add column if not exists phone_number text,
add column if not exists aadhar_card text,
add column if not exists worker_type text;

update public.workers
set father_name = coalesce(father_name, ''),
    phone_number = coalesce(phone_number, '')
where father_name is null or phone_number is null;

alter table public.workers
alter column father_name set not null,
alter column phone_number set not null;
