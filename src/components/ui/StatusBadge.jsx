const styles = {
  Paid: 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200',
  Pending: 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200',
  'Partially Paid': 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200',
  'Partially Reimbursed': 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200',
  Overdue: 'bg-red-50 text-red-600 ring-1 ring-inset ring-red-200',
  Draft: 'bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200',
  Active: 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200',
  Completed: 'bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200',
  Cancelled: 'bg-red-50 text-red-600 ring-1 ring-inset ring-red-200',
  Reimbursed: 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200',
  'Fully Reimbursed': 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200',
}

export function StatusBadge({ status }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${styles[status] ?? 'bg-slate-100 text-slate-600'}`}>
      {status}
    </span>
  )
}
