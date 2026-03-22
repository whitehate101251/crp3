-- Add password_hash column to users table
alter table public.users 
add column if not exists password_hash text;

-- Create a function to hash passwords using pgcrypto (if available)
-- Note: In production, consider using a dedicated auth solution
create or replace function public.hash_password(password text)
returns text as $$
begin
  return crypt(password, gen_salt('bf'));
end;
$$ language plpgsql security definer;

-- Verify function works
grant execute on function public.hash_password(text) to anon, authenticated;
