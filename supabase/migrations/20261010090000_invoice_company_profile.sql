-- Company details printed on invoices (address, phone, GSTIN, PAN, bank details,
-- signatory …) live with the other workspace settings, as one optional JSON value.
-- Nothing is required: an empty profile simply prints fewer lines.
alter table public.app_settings add column invoice_profile jsonb not null default '{}'::jsonb;
alter table public.app_settings add constraint app_settings_invoice_profile_is_object check (jsonb_typeof(invoice_profile) = 'object');
