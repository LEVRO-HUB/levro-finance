-- ───────────────── Integrity rules that span rows ─────────────────
-- The app checks these first for friendly messages; the database enforces
-- them so two people saving at once can never break a balance. Each trigger
-- locks the parent row before summing.

create or replace function private.check_income() returns trigger
language plpgsql security definer set search_path = '' as $$
declare inv public.invoices; paid numeric;
begin
  if new.invoice_id is null then return new; end if;
  select * into inv from public.invoices where id = new.invoice_id for update;
  if inv.project_id <> new.project_id then raise exception 'That invoice belongs to a different project.' using errcode = '23514'; end if;
  if inv.status = 'Cancelled' then raise exception 'This invoice is cancelled — payments can''t be recorded against it.' using errcode = '23514'; end if;
  select coalesce(sum(amount), 0) into paid from public.income where invoice_id = new.invoice_id and id <> new.id;
  if paid + new.amount > inv.amount + inv.tax_amount - inv.tds_amount + 0.005 then
    raise exception 'Payment exceeds the invoice''s outstanding balance (%).', inv.amount + inv.tax_amount - inv.tds_amount - paid using errcode = '23514';
  end if;
  return new;
end $$;
create trigger check_income before insert or update on public.income
  for each row execute function private.check_income();

create or replace function private.check_invoice() returns trigger
language plpgsql security definer set search_path = '' as $$
declare paid numeric;
begin
  select coalesce(sum(amount), 0) into paid from public.income where invoice_id = new.id;
  if paid > 0 then
    if new.amount + new.tax_amount - new.tds_amount < paid - 0.005 then raise exception '% is already received against this invoice — the total can''t be lower.', paid using errcode = '23514'; end if;
    if new.status <> 'Sent' then raise exception 'This invoice has payments — delete them before marking it Draft or Cancelled.' using errcode = '23514'; end if;
    if new.project_id <> old.project_id then raise exception 'This invoice has payments and can''t be moved to another project.' using errcode = '23514'; end if;
  end if;
  return new;
end $$;
create trigger check_invoice before update on public.invoices
  for each row execute function private.check_invoice();

create or replace function private.check_reimbursement() returns trigger
language plpgsql security definer set search_path = '' as $$
declare e public.expenses; repaid numeric;
begin
  select * into e from public.expenses where id = new.expense_id for update;
  if e.paid_by_member_id is null then raise exception 'That expense was not paid personally.' using errcode = '23514'; end if;
  if new.paid_date < e.date then raise exception 'Repayment date can''t be before the expense it repays.' using errcode = '23514'; end if;
  select coalesce(sum(amount), 0) into repaid from public.reimbursements where expense_id = new.expense_id and id <> new.id;
  if repaid + new.amount > e.amount + 0.005 then
    raise exception 'Repayment exceeds the pending amount (%).', e.amount - repaid using errcode = '23514';
  end if;
  return new;
end $$;
create trigger check_reimbursement before insert or update on public.reimbursements
  for each row execute function private.check_reimbursement();

create or replace function private.check_expense() returns trigger
language plpgsql security definer set search_path = '' as $$
declare repaid numeric;
begin
  select coalesce(sum(amount), 0) into repaid from public.reimbursements where expense_id = new.id;
  if repaid > 0 then
    if new.paid_by_member_id is distinct from old.paid_by_member_id then raise exception 'Reimbursements are already recorded — "Paid by" can''t be changed.' using errcode = '23514'; end if;
    if new.amount < repaid - 0.005 then raise exception '% has already been reimbursed — the amount can''t be lower.', repaid using errcode = '23514'; end if;
  end if;
  return new;
end $$;
create trigger check_expense before update on public.expenses
  for each row execute function private.check_expense();

-- A member can never have returned more than they were given.
create or replace function private.check_advance() returns trigger
language plpgsql security definer set search_path = '' as $$
declare m uuid; net numeric;
begin
  foreach m in array (case tg_op when 'INSERT' then array[new.member_id] when 'DELETE' then array[old.member_id] else array[old.member_id, new.member_id] end) loop
    perform 1 from public.members where id = m for update;
    select coalesce(sum(case direction when 'given' then amount else -amount end), 0) into net from public.member_advances where member_id = m;
    if net < -0.005 then raise exception 'This would leave more returned than was ever given to the member.' using errcode = '23514'; end if;
  end loop;
  return null;
end $$;
create trigger check_advance after insert or update or delete on public.member_advances
  for each row execute function private.check_advance();
