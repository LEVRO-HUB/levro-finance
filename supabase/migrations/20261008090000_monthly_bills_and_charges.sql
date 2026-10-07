-- Monthly Bills (rent, subscriptions, salaries…) and per-project Monthly Charges
-- (maintenance fees). One definition row per bill / charge. Whether a month is
-- paid / collected is NEVER stored: it is derived from the ordinary expense or
-- income row recorded for that month (linked by recurring_id + recurring_month).

create table public.recurring_items (
  id           uuid primary key default gen_random_uuid(),
  kind         text not null check (kind in ('bill', 'maintenance')),
  name         text not null check (length(btrim(name)) > 0),
  project_id   uuid references public.projects(id) on delete cascade,
  amount       numeric(14,2) not null check (amount > 0),
  due_day      integer not null default 5 check (due_day between 1 and 28),
  start_month  date not null check (extract(day from start_month) = 1),
  end_month    date check (end_month is null or (extract(day from end_month) = 1 and end_month >= start_month)),
  category     text references public.categories(name) on update cascade on delete restrict,
  recipient    text not null default '',
  notes        text not null default '',
  created_by   uuid default auth.uid() references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  check (kind <> 'maintenance' or project_id is not null),
  check (kind <> 'bill' or category is not null)
);
create index recurring_items_project_idx on public.recurring_items (project_id);
create trigger touch_updated_at before update on public.recurring_items
  for each row execute function private.touch_updated_at();

alter table public.income   add column recurring_id uuid references public.recurring_items(id) on delete set null,
                            add column recurring_month date;
alter table public.expenses add column recurring_id uuid references public.recurring_items(id) on delete set null,
                            add column recurring_month date;
-- one payment per bill / charge per month
create unique index income_recurring_month_uq   on public.income   (recurring_id, recurring_month) where recurring_id is not null;
create unique index expenses_recurring_month_uq on public.expenses (recurring_id, recurring_month) where recurring_id is not null;

-- same access as other financial records: active users read / add / edit, admins delete
alter table public.recurring_items enable row level security;
create policy recurring_items_select on public.recurring_items for select to authenticated using (private.is_active_user());
create policy recurring_items_insert on public.recurring_items for insert to authenticated with check (private.is_active_user());
create policy recurring_items_update on public.recurring_items for update to authenticated using (private.is_active_user()) with check (private.is_active_user());
create policy recurring_items_delete on public.recurring_items for delete to authenticated using (private.is_admin());
revoke all on public.recurring_items from anon, public;
grant select, insert, update, delete on public.recurring_items to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'recurring_items') then
    alter publication supabase_realtime add table public.recurring_items;
  end if;
end $$;
