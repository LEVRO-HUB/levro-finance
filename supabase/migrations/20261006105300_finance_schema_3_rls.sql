-- ───────────────────────── Row Level Security ─────────────────────────
-- Nothing is readable or writable without an ACTIVE profile.
--   member: read everything, create and edit records
--   admin : also delete, manage settings / lists / team access

alter table public.profiles enable row level security;
create policy profiles_select on public.profiles for select to authenticated using (id = (select auth.uid()) or private.is_active_user());
create policy profiles_update on public.profiles for update to authenticated using (id = (select auth.uid()) or private.is_admin()) with check (id = (select auth.uid()) or private.is_admin());
create policy profiles_delete on public.profiles for delete to authenticated using (private.is_admin());

do $$
declare t text;
begin
  -- financial records: active users read / insert / update; admins delete
  foreach t in array array['projects','invoices','income','expenses','reimbursements','member_advances','documents','document_versions'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for select to authenticated using (private.is_active_user())', t || '_select', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (private.is_active_user())', t || '_insert', t);
    -- file versions are immutable: document_versions gets no update policy
    if t <> 'document_versions' then
      execute format('create policy %I on public.%I for update to authenticated using (private.is_active_user()) with check (private.is_active_user())', t || '_update', t);
    end if;
    execute format('create policy %I on public.%I for delete to authenticated using (private.is_admin())', t || '_delete', t);
  end loop;
  -- team members + configuration: active users read; admins write
  foreach t in array array['members','categories','payment_methods','app_settings'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for select to authenticated using (private.is_active_user())', t || '_select', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (private.is_admin())', t || '_admin_insert', t);
    execute format('create policy %I on public.%I for update to authenticated using (private.is_admin()) with check (private.is_admin())', t || '_admin_update', t);
    execute format('create policy %I on public.%I for delete to authenticated using (private.is_admin())', t || '_admin_delete', t);
  end loop;
end $$;

-- audit log: read + append only (no update / delete policy exists)
alter table public.activity_logs enable row level security;
create policy activity_logs_select on public.activity_logs for select to authenticated using (private.is_active_user());
create policy activity_logs_insert on public.activity_logs for insert to authenticated with check (private.is_active_user());

grant usage on schema private to authenticated;
grant usage on all sequences in schema public to authenticated;
