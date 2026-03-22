-- Add RLS policy to allow reading users for authentication (bypasses auth requirement)
-- This policy allows the database to read user credentials during login
drop policy if exists "allow_auth_lookup" on public.users;
create policy "allow_auth_lookup" on public.users
for select
using (true);

-- Also ensure other tables have bypass policies for admin operations
drop policy if exists "allow_admin_bypass" on public.sites;
create policy "allow_admin_bypass" on public.sites
for select
using (true);

drop policy if exists "allow_admin_bypass" on public.workers;
create policy "allow_admin_bypass" on public.workers
for select
using (true);
