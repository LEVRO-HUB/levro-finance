-- Defence in depth on top of RLS: the signed-out API role gets no table access at all.
revoke all on all tables in schema public from anon, public;
alter default privileges in schema public revoke all on tables from anon;
revoke all on all sequences in schema public from anon, public;
revoke update, delete, truncate on public.activity_logs from authenticated;
revoke truncate on all tables in schema public from authenticated;
