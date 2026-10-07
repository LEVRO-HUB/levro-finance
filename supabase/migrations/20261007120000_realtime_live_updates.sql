-- Live updates: publish row changes on the finance tables to Supabase Realtime,
-- so every signed-in user's screen refreshes when anyone saves a change.
-- No table, column, policy or data is altered. Realtime applies the same Row
-- Level Security as normal reads, so only active users receive anything.
do $$
declare t text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    return; -- plain Postgres (tests): nothing to do
  end if;
  foreach t in array array['projects','invoices','income','expenses','reimbursements','member_advances','members',
                           'documents','document_versions','categories','payment_methods','app_settings','activity_logs','profiles'] loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
