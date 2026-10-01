import { useAuth } from '../auth/AuthProvider'

export function Settings() {
  const { user } = useAuth()
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Settings</h1>
        <p className="text-sm text-slate-500">Account and application settings</p>
      </div>
      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="mb-2 text-sm font-semibold text-slate-700">Signed in as</h2>
        <p className="text-sm text-slate-600">{user?.email}</p>
      </section>
      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="mb-2 text-sm font-semibold text-slate-700">Team access</h2>
        <p className="text-sm text-slate-500">
          Invite or remove teammates from the Supabase dashboard — Authentication → Users. Anyone invited there can
          sign in and has full access; there are no separate roles yet.
        </p>
      </section>
      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="mb-2 text-sm font-semibold text-slate-700">Categories</h2>
        <p className="text-sm text-slate-500">
          Expense categories (Rent, Subscription, Office Setup, Utilities, Salary, Travel, Others) are fixed in this
          build. Ask to have this made editable if your team needs different ones.
        </p>
      </section>
    </div>
  )
}
