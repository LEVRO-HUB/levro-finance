-- Levrotec Finance Tracker — PROPOSED schema for the NEW Supabase project.
-- Applied to the new project as migration 'finance_schema'.
--
-- Design rules
--   * No calculated money is stored. Outstanding, net result, member balances,
--     reserve, invoice Paid/Partially Paid/Overdue are all derived in
--     src/calculations/finance.js from the rows below.
--   * There is no "transactions" table: the ledger is a read-only union of
--     income + expenses + reimbursements + member_advances.
--   * Deletes that would destroy financial history are blocked by foreign keys
--     (ON DELETE RESTRICT); caps (overpayment, over-reimbursement) by triggers.

create schema if not exists private;

-- ───────────────────────── Access control ─────────────────────────

-- One row per person allowed to sign in. Created inactive by the trigger
-- below; an admin activates it. So even if public sign-up were switched on
-- by mistake, a stranger's account could read nothing.
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null,
  full_name   text not null default '',
  role        text not null default 'member' check (role in ('admin', 'member')),
  is_active   boolean not null default false,
  created_at  timestamptz not null default now()
);

create or replace function private.is_active_user() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_active)
$$;

create or replace function private.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_active and p.role = 'admin')
$$;

create or replace function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, coalesce(new.email, ''), coalesce(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.handle_new_user();

-- A user may edit their own name, but never their own role / active flag.
create or replace function private.protect_profile() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  -- auth.uid() is null only for the SQL editor / service role (used once to appoint the first admin)
  if (select auth.uid()) is not null and not private.is_admin() and (new.role <> old.role or new.is_active <> old.is_active or new.id <> old.id) then
    raise exception 'Only an admin can change roles or access.' using errcode = '42501';
  end if;
  if old.is_active and old.role = 'admin' and not (new.is_active and new.role = 'admin')
     and not exists (select 1 from public.profiles p where p.id <> old.id and p.is_active and p.role = 'admin') then
    raise exception 'At least one active admin is required.' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger protect_profile before update on public.profiles
  for each row execute function private.protect_profile();

-- ───────────────────────── Shared helpers ─────────────────────────

create or replace function private.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end $$;

create sequence public.income_code_seq;
create sequence public.expense_code_seq;
create sequence public.reimbursement_code_seq;
create sequence public.advance_code_seq;

-- ───────────────────────── Reference lists ─────────────────────────

create table public.categories (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (length(btrim(name)) between 1 and 40),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (name)
);
create unique index categories_name_ci on public.categories (lower(name));

create table public.payment_methods (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (length(btrim(name)) between 1 and 40),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (name)
);
create unique index payment_methods_name_ci on public.payment_methods (lower(name));

-- Single-row settings. Only the OPENING reserve is stored; the current
-- reserve is always calculated.
create table public.app_settings (
  id               boolean primary key default true check (id),
  company_name     text not null default 'Levrotec',
  opening_reserve  numeric(14,2) not null default 0 check (opening_reserve >= 0),
  reserve_as_of    date,
  updated_at       timestamptz not null default now()
);

-- ───────────────────────── Core entities ─────────────────────────

create table public.members (
  id            uuid primary key default gen_random_uuid(),
  name          text not null check (length(btrim(name)) > 0),
  designation   text not null default '',
  email         text not null default '',
  phone         text not null default '',
  joining_date  date,
  is_active     boolean not null default true,
  notes         text not null default '',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create unique index members_name_ci on public.members (lower(name));

create table public.projects (
  id              uuid primary key default gen_random_uuid(),
  slug            text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name            text not null check (length(btrim(name)) between 1 and 120),
  project_number  text not null default '',
  client_name     text not null default '',
  description     text not null default '',
  status          text not null default 'Active' check (status in ('Active', 'On Hold', 'Completed', 'Cancelled')),
  start_date      date,
  end_date        date,
  contract_value  numeric(14,2) not null default 0 check (contract_value >= 0),
  payment_terms   text not null default '',
  notes           text not null default '',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  check (end_date is null or start_date is null or end_date >= start_date)
);
create unique index projects_name_ci on public.projects (lower(name));
create unique index projects_number_ci on public.projects (lower(project_number)) where project_number <> '';

create table public.invoices (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid not null references public.projects(id) on delete restrict,
  invoice_number  text not null check (length(btrim(invoice_number)) > 0),
  invoice_date    date not null,
  due_date        date,
  amount          numeric(14,2) not null check (amount > 0),
  tax_amount      numeric(14,2) not null default 0 check (tax_amount >= 0),
  tds_amount      numeric(14,2) not null default 0 check (tds_amount >= 0),
  -- stored intent only; Paid / Partially Paid / Overdue are calculated
  status          text not null default 'Sent' check (status in ('Draft', 'Sent', 'Cancelled')),
  notes           text not null default '',
  created_by      uuid default auth.uid() references auth.users(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  check (due_date is null or due_date >= invoice_date),
  check (tds_amount <= amount + tax_amount)
);
create unique index invoices_number_ci on public.invoices (lower(invoice_number));
create index invoices_project_idx on public.invoices (project_id);

-- Money in. A payment against an invoice is an income row with invoice_id set,
-- so there is one list of payments, never two.
create table public.income (
  id              uuid primary key default gen_random_uuid(),
  code            text not null unique default ('INC-' || lpad(nextval('public.income_code_seq')::text, 4, '0')),
  date            date not null,
  type            text not null check (type in ('client_payment', 'project_payment', 'other_income', 'refund')),
  amount          numeric(14,2) not null check (amount > 0),
  project_id      uuid references public.projects(id) on delete restrict,
  invoice_id      uuid references public.invoices(id) on delete restrict,
  payment_method  text not null references public.payment_methods(name) on update cascade on delete restrict,
  reference       text not null default '',
  description     text not null default '',
  notes           text not null default '',
  created_by      uuid default auth.uid() references auth.users(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  check (type not in ('client_payment', 'project_payment') or project_id is not null),
  check (invoice_id is null or project_id is not null)
);
create index income_project_idx on public.income (project_id);
create index income_invoice_idx on public.income (invoice_id);
create index income_date_idx on public.income (date desc);

-- Money out, as incurred. paid_by_member_id set = paid from personal money
-- (reimbursable). expense_type 'company_purchase' rows ARE the purchases /
-- assets register — there is no separate assets table to drift out of sync.
create table public.expenses (
  id                      uuid primary key default gen_random_uuid(),
  code                    text not null unique default ('EXP-' || lpad(nextval('public.expense_code_seq')::text, 4, '0')),
  date                    date not null,
  title                   text not null check (length(btrim(title)) > 0),
  category                text not null references public.categories(name) on update cascade on delete restrict,
  amount                  numeric(14,2) not null check (amount > 0),
  expense_type            text not null check (expense_type in ('project_expense', 'company_expense', 'company_purchase')),
  project_id              uuid references public.projects(id) on delete restrict,
  paid_by_member_id       uuid references public.members(id) on delete restrict,
  purchased_by_member_id  uuid references public.members(id) on delete restrict,
  is_asset                boolean not null default false,
  payment_method          text not null references public.payment_methods(name) on update cascade on delete restrict,
  recipient               text not null default '',
  reference               text not null default '',
  description             text not null default '',
  created_by              uuid default auth.uid() references auth.users(id) on delete set null,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  check (expense_type <> 'project_expense' or project_id is not null),
  check (expense_type <> 'company_expense' or project_id is null),
  check (not is_asset or expense_type = 'company_purchase')
);
create index expenses_project_idx on public.expenses (project_id);
create index expenses_paid_by_idx on public.expenses (paid_by_member_id);
create index expenses_purchased_by_idx on public.expenses (purchased_by_member_id);
create index expenses_date_idx on public.expenses (date desc);
create index expenses_type_idx on public.expenses (expense_type);
create index expenses_category_idx on public.expenses (category);

-- Repayments to a member for a personally-paid expense. The member is the
-- expense's paid_by_member_id — not stored again here.
create table public.reimbursements (
  id              uuid primary key default gen_random_uuid(),
  code            text not null unique default ('RMB-' || lpad(nextval('public.reimbursement_code_seq')::text, 4, '0')),
  expense_id      uuid not null references public.expenses(id) on delete restrict,
  amount          numeric(14,2) not null check (amount > 0),
  paid_date       date not null,
  payment_method  text not null references public.payment_methods(name) on update cascade on delete restrict,
  reference       text not null default '',
  notes           text not null default '',
  created_by      uuid default auth.uid() references auth.users(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index reimbursements_expense_idx on public.reimbursements (expense_id);

-- Company money a member is holding ("member owes Levrotec").
create table public.member_advances (
  id              uuid primary key default gen_random_uuid(),
  code            text not null unique default ('ADV-' || lpad(nextval('public.advance_code_seq')::text, 4, '0')),
  member_id       uuid not null references public.members(id) on delete restrict,
  date            date not null,
  direction       text not null check (direction in ('given', 'returned')),
  amount          numeric(14,2) not null check (amount > 0),
  payment_method  text not null references public.payment_methods(name) on update cascade on delete restrict,
  reference       text not null default '',
  notes           text not null default '',
  created_by      uuid default auth.uid() references auth.users(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index member_advances_member_idx on public.member_advances (member_id);

-- ───────────────────────── Documents ─────────────────────────

-- A document belongs to a project and/or one invoice or expense. An expense's
-- receipt and an invoice's attachment are found through these links, so the
-- expense/invoice rows carry no second pointer back.
create table public.documents (
  id           uuid primary key default gen_random_uuid(),
  name         text not null check (length(btrim(name)) > 0),
  category     text not null default 'other' check (category in ('master_agreement', 'quotation', 'proposal', 'requirements', 'design', 'invoice', 'receipt', 'other')),
  project_id   uuid references public.projects(id) on delete cascade,
  invoice_id   uuid references public.invoices(id) on delete cascade,
  expense_id   uuid references public.expenses(id) on delete cascade,
  description  text not null default '',
  created_by   uuid default auth.uid() references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  check (invoice_id is null or expense_id is null)
);
create index documents_project_idx on public.documents (project_id);
create unique index documents_one_receipt_per_expense on public.documents (expense_id) where expense_id is not null;
create unique index documents_one_attachment_per_invoice on public.documents (invoice_id) where invoice_id is not null;

-- Every upload is a new immutable version; "replace" never overwrites a file.
create table public.document_versions (
  id            uuid primary key default gen_random_uuid(),
  document_id   uuid not null references public.documents(id) on delete cascade,
  version       integer not null check (version >= 1),
  file_name     text not null,
  file_size     bigint not null check (file_size > 0 and file_size <= 5242880),
  mime_type     text not null default 'application/octet-stream',
  storage_path  text not null unique,          -- object path in the 'documents' bucket
  uploaded_by   uuid default auth.uid() references auth.users(id) on delete set null,
  uploaded_at   timestamptz not null default now(),
  unique (document_id, version)
);

-- Append-only audit trail.
create table public.activity_logs (
  id          uuid primary key default gen_random_uuid(),
  at          timestamptz not null default now(),
  actor_id    uuid default auth.uid() references auth.users(id) on delete set null,
  actor_name  text not null default '',
  action      text not null check (action in ('created', 'updated', 'deleted', 'uploaded')),
  entity      text not null,
  entity_id   uuid,
  summary     text not null,
  project_id  uuid references public.projects(id) on delete set null
);
create index activity_logs_project_idx on public.activity_logs (project_id, at desc);
create index activity_logs_at_idx on public.activity_logs (at desc);

create or replace function private.stamp_activity_log() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.at := now();
  new.actor_id := (select auth.uid());
  new.actor_name := coalesce((select nullif(p.full_name, '') from public.profiles p where p.id = new.actor_id),
                             (select p.email from public.profiles p where p.id = new.actor_id), 'System');
  return new;
end $$;
create trigger stamp_activity_log before insert on public.activity_logs
  for each row execute function private.stamp_activity_log();

-- updated_at maintenance
do $$
declare t text;
begin
  foreach t in array array['categories','payment_methods','app_settings','members','projects','invoices','income','expenses','reimbursements','member_advances','documents'] loop
    execute format('create trigger touch_updated_at before update on public.%I for each row execute function private.touch_updated_at()', t);
  end loop;
end $$;
