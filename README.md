# Levro Finance

A premium internal finance tracker for Levrotec — projects, invoices, expenses,
personal contributions & repayments, company pay outs, documents, and a
unified transaction ledger.

## Stack

React 19 + Vite + Tailwind CSS v4 + react-router + lucide-react, Supabase
(Postgres + Auth + Storage). No build backend of its own — the frontend talks
to Supabase directly.

## How it runs

**Shared mode (Supabase).** With `VITE_SUPABASE_URL` and
`VITE_SUPABASE_PUBLISHABLE_KEY` set (copy `.env.example` to `.env.local`), the
app requires sign-in and reads/writes the Levrotec Finance Tracker database.
Only the public URL and publishable key ever go in the frontend; the
service-role key is never used here.

**Local demo mode.** With those variables empty, the app runs entirely in the
browser with demo data and no sign-in.

```bash
npm install
npm run dev      # http://localhost:5173/
npm test         # calculation + scenario tests (database tests need PG_TEST_URL, see tests/support/README.md)
npm run build
```

## Architecture

```
pages / panels / forms
   -> src/services/api.js            business rules + validation (one service API)
   -> adapter                        local: src/services/localAdapter.js
                                     shared: src/services/supabase/adapter.js (row-level writes, paged reads)
   -> src/services/supabase/gateway.js   the only file that calls Supabase for finance data
   -> Postgres (constraints, triggers, RLS) + private Storage bucket `documents`
```

- `src/calculations/finance.js` - single source of truth for every number; nothing calculated is stored.
- `supabase/migrations/` - the schema exactly as applied to the project.
- `supabase/functions/invite-user/` - admin-only invite (holds the service-role key server-side).
- `src/auth/` - email + password sign-in, invite/reset password, inactive-account gate.
- Roles: `admin` (everything) and `member` (view, create, edit; no deletes, settings, lists or user access). Enforced by RLS.
- Unused leftovers from the first version: `src/hooks/useSupabaseTable.js`, `src/lib/finance.js`, `schema.sql`, `migrate_existing_db.sql`.
