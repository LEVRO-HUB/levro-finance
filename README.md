# Levro Finance

A premium internal finance tracker for Levrotec — projects, invoices, expenses,
personal contributions & repayments, company pay outs, documents, and a
unified transaction ledger.

## Stack

React 19 + Vite + Tailwind CSS v4 + react-router + lucide-react, Supabase
(Postgres + Auth + Storage). No build backend of its own — the frontend talks
to Supabase directly.

## Setup

1. **Supabase project**: this app is already configured to use the
   `Levro Finance` project (`lsojfyvyjheromealcro.supabase.co`) set up
   earlier in this conversation.
2. **Run `schema.sql`** in that project's SQL Editor (if not already run)
   — creates every table (including the new `members` columns, `recipient`
   on expenses, `clients`) and RLS policies. Safe to re-run.
3. **Storage bucket**: Dashboard → **Storage** → **New bucket** → name it
   `documents`, keep it **private**. Needed for receipts, project documents,
   and invoice files.
4. **Auth**: public sign-up should already be disabled and your team invited
   from the earlier setup. Invite anyone new from **Authentication → Users →
   Add user → Invite**.
5. **Local dev**:
   ```bash
   npm install
   cp .env.example .env   # fill in VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
   npm run dev
   ```

## Data model

See [`schema.sql`](./schema.sql). Key design points:

- `expenses.expense_type` (`project_expense` | `company_expense` |
  `company_purchase`) and `project_id` are linked by a check constraint — a
  project expense must have a project, nothing else may.
- A personally-paid expense (`paid_by_member_id` set) is a **Contribution**:
  it is never itself company cash out. A repayment goes into
  `reimbursement_payments`, capped by trigger at the expense amount, and is
  never a new expense — see `src/lib/finance.js` for the calculation.
- Invoice payment status is always **calculated** (`invoiceStatus()` in
  `src/lib/finance.js`) from `amount` vs. `sum(invoice_payments)` vs.
  `due_date` — never a stored free-choice field.
- `documents` belongs to a project and/or an invoice; files live in the
  `documents` Storage bucket, accessed only via short-lived signed URLs.

## Known gaps (first version)

- Project "Payments" and "Activity" tabs from the original reference design
  aren't separate tabs yet — payments live inside the Invoices tab, and
  there's no audit/activity log yet.
- No charts library — the dashboard uses simple CSS bars instead of a line
  chart for income vs. expenses over time.
- Settings page is a stub (no editable categories/roles yet).
- Expense categories are a fixed list, not yet user-editable.
