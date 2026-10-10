-- Security check: run in the Supabase SQL Editor (read-only).
-- Expected for every table: rls_enabled = true, policies = 0, and all four anon/authenticated columns false.
select
  c.relname                                                   as table_name,
  c.relrowsecurity                                            as rls_enabled,
  (select count(*) from pg_policies p
    where p.schemaname = 'public' and p.tablename = c.relname) as policies,
  has_table_privilege('anon', c.oid, 'select')                as anon_can_read,
  has_table_privilege('anon', c.oid, 'insert')                as anon_can_write,
  has_table_privilege('authenticated', c.oid, 'select')       as authenticated_can_read,
  has_table_privilege('authenticated', c.oid, 'insert')       as authenticated_can_write
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r'
order by c.relname;

-- Expected: one row, public = false, 2 MB limit, images only.
select id, public, file_size_limit, allowed_mime_types
from storage.buckets
where id = 'evidence';
