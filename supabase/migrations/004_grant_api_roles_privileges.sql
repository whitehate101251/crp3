-- Grants required when tables are created via raw SQL migrations.
-- Without these grants, PostgREST can return:
--   permission denied for table <table_name>

grant usage on schema public to anon, authenticated, service_role;

grant select on all tables in schema public to anon, authenticated;
grant all privileges on all tables in schema public to service_role;

grant usage, select on all sequences in schema public to anon, authenticated;
grant all privileges on all sequences in schema public to service_role;

grant execute on all functions in schema public to anon, authenticated;
grant all privileges on all functions in schema public to service_role;

alter default privileges in schema public
grant select on tables to anon, authenticated;

alter default privileges in schema public
grant all privileges on tables to service_role;

alter default privileges in schema public
grant usage, select on sequences to anon, authenticated;

alter default privileges in schema public
grant all privileges on sequences to service_role;

alter default privileges in schema public
grant execute on functions to anon, authenticated;

alter default privileges in schema public
grant all privileges on functions to service_role;
