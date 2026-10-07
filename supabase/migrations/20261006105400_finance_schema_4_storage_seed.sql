-- ───────────────────────── Storage ─────────────────────────
-- One PRIVATE bucket. Files are only ever reached through short-lived signed
-- URLs requested by a signed-in, active user.
insert into storage.buckets (id, name, public, file_size_limit)
values ('documents', 'documents', false, 5242880)
on conflict (id) do update set public = false, file_size_limit = 5242880;

create policy documents_read   on storage.objects for select to authenticated using (bucket_id = 'documents' and private.is_active_user());
create policy documents_upload on storage.objects for insert to authenticated with check (bucket_id = 'documents' and private.is_active_user());
create policy documents_remove on storage.objects for delete to authenticated using (bucket_id = 'documents' and private.is_admin());
-- no UPDATE policy: an uploaded file can never be overwritten in place

-- ───────────────────────── Seed (reference data only) ─────────────────────────
insert into public.app_settings (id) values (true) on conflict do nothing;
insert into public.categories (name) values
  ('Hosting'), ('Software'), ('Subscription'), ('Office'), ('Equipment'), ('Furniture'), ('Rent'), ('Utilities'),
  ('Salary'), ('Travel'), ('Marketing'), ('Vendor Payment'), ('Others') on conflict do nothing;
insert into public.payment_methods (name) values
  ('Bank Transfer'), ('UPI'), ('Cash'), ('Credit Card'), ('Debit Card'), ('Cheque') on conflict do nothing;

-- After the first person signs up / is invited, make them the admin once:
--   update public.profiles set role = 'admin', is_active = true where email = 'you@levrotec.com';
