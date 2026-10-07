# Database integration tests

`tests/supabase.integration.test.js` runs the Supabase data layer against a real
Postgres with the real migrations from `supabase/migrations/` applied.

```bash
createdb finance_test
psql -d finance_test -f tests/support/supabase-stubs.sql
for f in supabase/migrations/*.sql; do psql -v ON_ERROR_STOP=1 -d finance_test -f "$f"; done
PG_TEST_URL=postgres://postgres@127.0.0.1:5432/finance_test npm test
```

Never point `PG_TEST_URL` at the production database: the tests truncate tables.
Without `PG_TEST_URL` these tests are skipped and the rest of the suite still runs.
