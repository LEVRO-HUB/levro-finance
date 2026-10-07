-- Invoices created from the Levrotec template keep what is printed on them
-- (bill-to lines, billing period, terms, line items, payment details) here.
-- The invoice amount is still the single stored total: it equals the sum of the
-- line items and is what every calculation keeps using.
alter table public.invoices add column details jsonb;
alter table public.invoices add constraint invoices_details_is_object check (details is null or jsonb_typeof(details) = 'object');
