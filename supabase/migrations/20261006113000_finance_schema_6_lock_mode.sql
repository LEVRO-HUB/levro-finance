-- Row locks taken by the integrity triggers now use FOR NO KEY UPDATE.
-- It still makes simultaneous payments / repayments / advance returns queue up
-- one behind another, but no longer collides with the key-share lock that a
-- foreign-key check takes on the same parent row (which caused lock waits and
-- deadlock retries when several advance entries for one member arrived together).

create or replace function private.check_income() returns trigger
language plpgsql security definer set search_path = '' as $$
declare inv public.invoices; paid numeric;
begin
  if new.invoice_id is null then return new; end if;
  select * into inv from public.invoices where id = new.invoice_id for no key update;
  if inv.project_id <> new.project_id then raise exception 'That invoice belongs to a different project.' using errcode = '23514'; end if;
  if inv.status = 'Cancelled' then raise exception 'This invoice is cancelled — payments can''t be recorded against it.' using errcode = '23514'; end if;
  select coalesce(sum(amount), 0) into paid from public.income where invoice_id = new.invoice_id and id <> new.id;
  if paid + new.amount > inv.amount + inv.tax_amount - inv.tds_amount + 0.005 then
    raise exception 'Payment exceeds the invoice''s outstanding balance (%).', inv.amount + inv.tax_amount - inv.tds_amount - paid using errcode = '23514';
  end if;
  return new;
end $$;

create or replace function private.check_reimbursement() returns trigger
language plpgsql security definer set search_path = '' as $$
declare e public.expenses; repaid numeric;
begin
  select * into e from public.expenses where id = new.expense_id for no key update;
  if e.paid_by_member_id is null then raise exception 'That expense was not paid personally.' using errcode = '23514'; end if;
  if new.paid_date < e.date then raise exception 'Repayment date can''t be before the expense it repays.' using errcode = '23514'; end if;
  select coalesce(sum(amount), 0) into repaid from public.reimbursements where expense_id = new.expense_id and id <> new.id;
  if repaid + new.amount > e.amount + 0.005 then
    raise exception 'Repayment exceeds the pending amount (%).', e.amount - repaid using errcode = '23514';
  end if;
  return new;
end $$;

create or replace function private.check_advance() returns trigger
language plpgsql security definer set search_path = '' as $$
declare m uuid; net numeric;
begin
  foreach m in array (case tg_op when 'INSERT' then array[new.member_id] when 'DELETE' then array[old.member_id] else array[old.member_id, new.member_id] end) loop
    perform 1 from public.members where id = m for no key update;
    select coalesce(sum(case direction when 'given' then amount else -amount end), 0) into net from public.member_advances where member_id = m;
    if net < -0.005 then raise exception 'This would leave more returned than was ever given to the member.' using errcode = '23514'; end if;
  end loop;
  return null;
end $$;
