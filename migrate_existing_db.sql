-- Adds the Levro Finance columns/tables to the EXISTING Supabase project
-- (which already has tables from the earlier schema). Purely additive -
-- safe to run even if it already has rows. Run once in the SQL Editor.

alter table projects add column if not exists client_name text;
alter table projects add column if not exists project_number text;
alter table projects add column if not exists contract_value numeric(12,2) not null default 0;
alter table projects add column if not exists start_date date;
alter table projects add column if not exists expected_completion date;
alter table projects add column if not exists payment_terms text;
alter table projects add column if not exists description text;
alter table projects add column if not exists notes text;
alter table projects drop constraint if exists projects_status_check;
alter table projects add constraint projects_status_check check (status in ('Active','Completed','Cancelled','On Hold'));
-- carry any existing estimated_cost value over to contract_value, if that column exists
do $$ begin
  if exists (select 1 from information_schema.columns where table_name='projects' and column_name='estimated_cost') then
    execute 'update projects set contract_value = estimated_cost where contract_value = 0';
  end if;
end $$;

alter table expenses add column if not exists title text;
alter table expenses add column if not exists payment_method text;
alter table expenses add column if not exists recipient text;
alter table expenses add column if not exists receipt_path text;
alter table expenses add column if not exists expense_type text not null default 'company_expense';
alter table expenses drop constraint if exists expenses_expense_type_check;
alter table expenses add constraint expenses_expense_type_check check (expense_type in ('project_expense','company_expense','company_purchase'));
alter table expenses add column if not exists project_id uuid references projects(id) on delete set null;
alter table expenses add column if not exists track_as_asset boolean not null default false;
alter table expenses drop constraint if exists expenses_project_link_matches_type;
alter table expenses add constraint expenses_project_link_matches_type check (
  (expense_type = 'project_expense' and project_id is not null)
  or (expense_type <> 'project_expense' and project_id is null)
);

alter table members add column if not exists designation text;
alter table members add column if not exists email text;
alter table members add column if not exists phone text;
alter table members add column if not exists joining_date date;
alter table members add column if not exists notes text;

create table if not exists clients (
  id uuid primary key default gen_random_uuid(), name text not null, created_at timestamptz not null default now()
);

create table if not exists reimbursement_payments (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references expenses(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  paid_date date not null default current_date,
  payment_method text, reference text, notes text,
  created_at timestamptz not null default now()
);

create or replace function check_reimbursement_within_expense()
returns trigger language plpgsql as $$
declare v_expense record; v_total numeric(12,2);
begin
  select amount, paid_by_member_id into v_expense from expenses where id = new.expense_id;
  if v_expense.paid_by_member_id is null then raise exception 'Cannot reimburse expense %: it was not paid personally', new.expense_id; end if;
  select coalesce(sum(amount),0) into v_total from reimbursement_payments
   where expense_id = new.expense_id and id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid);
  if v_total + new.amount > v_expense.amount then
    raise exception 'Reimbursement total (%) would exceed the expense amount (%)', v_total + new.amount, v_expense.amount;
  end if;
  return new;
end; $$;
drop trigger if exists trg_check_reimbursement on reimbursement_payments;
create trigger trg_check_reimbursement before insert or update on reimbursement_payments
  for each row execute function check_reimbursement_within_expense();

create table if not exists invoices (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  invoice_number text not null, invoice_date date not null default current_date, due_date date,
  amount numeric(12,2) not null check (amount > 0), tax_amount numeric(12,2), tds_amount numeric(12,2),
  notes text, file_path text, created_at timestamptz not null default now(),
  unique (project_id, invoice_number)
);

create table if not exists invoice_payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references invoices(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0), paid_date date not null default current_date,
  method text, notes text, created_at timestamptz not null default now()
);

create or replace function check_payment_within_invoice()
returns trigger language plpgsql as $$
declare v_invoice record; v_total numeric(12,2);
begin
  select amount, coalesce(tds_amount,0) as tds into v_invoice from invoices where id = new.invoice_id;
  select coalesce(sum(amount),0) into v_total from invoice_payments
   where invoice_id = new.invoice_id and id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid);
  if v_total + new.amount > v_invoice.amount - v_invoice.tds + 0.01 then
    raise exception 'Payment total (%) would exceed the invoice balance (%)', v_total + new.amount, v_invoice.amount - v_invoice.tds;
  end if;
  return new;
end; $$;
drop trigger if exists trg_check_payment on invoice_payments;
create trigger trg_check_payment before insert or update on invoice_payments
  for each row execute function check_payment_within_invoice();

create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  invoice_id uuid references invoices(id) on delete cascade,
  category text not null default 'other' check (category in ('master_agreement','quotation','proposal','requirements','invoice','other')),
  file_name text not null, storage_path text not null, file_size bigint,
  version int not null default 1, is_current boolean not null default true,
  uploaded_at timestamptz not null default now(),
  constraint documents_at_least_one_owner check (project_id is not null or invoice_id is not null)
);

create index if not exists idx_expenses_project_id on expenses(project_id);
create index if not exists idx_expenses_expense_type on expenses(expense_type);
create index if not exists idx_reimb_expense_id on reimbursement_payments(expense_id);
create index if not exists idx_invoices_project_id on invoices(project_id);
create index if not exists idx_invoice_payments_invoice_id on invoice_payments(invoice_id);
create index if not exists idx_documents_project_id on documents(project_id);
create index if not exists idx_documents_invoice_id on documents(invoice_id);

do $$
declare t text;
begin
  foreach t in array array['members','clients','projects','expenses','reimbursement_payments','invoices','invoice_payments','documents'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "signed_in_users" on %I', t);
    execute format('create policy "signed_in_users" on %I for all to authenticated using (true) with check (true)', t);
  end loop;
end $$;
