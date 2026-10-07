-- Levrotec's own products (not client work) are tracked as projects of kind
-- 'product', so their costs and any later income use everything that already
-- exists. A product also carries a stage, a progress percentage and the time
-- of its last progress update, so it is obvious whether it is still moving.
alter table public.projects
  add column kind text not null default 'client' check (kind in ('client', 'product')),
  add column stage text,
  add column progress integer check (progress is null or progress between 0 and 100),
  add column stage_note text not null default '',
  add column stage_updated_at timestamptz;
