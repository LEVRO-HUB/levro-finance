const green = 'bg-emerald-50 text-emerald-700 ring-emerald-200'
const amber = 'bg-amber-50 text-amber-700 ring-amber-200'
const red = 'bg-red-50 text-red-600 ring-red-200'
const grey = 'bg-slate-100 text-slate-600 ring-slate-200'
const blue = 'bg-blue-50 text-blue-700 ring-blue-200'

const styles = {
  Paid: green, Reimbursed: green, Active: green, 'Money In': green,
  Pending: amber, Unpaid: amber, 'Partially Paid': amber, 'Partially Reimbursed': amber, 'On Hold': amber,
  Overdue: red, Cancelled: red, Inactive: red, 'Money Out': red,
  Draft: grey, Completed: grey, 'Not Applicable': grey, Company: grey,
  Sent: blue, Personal: blue,
}

export function StatusBadge({ status, className = '' }) {
  if (!status) return null
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${styles[status] ?? grey} ${className}`}>
      {status}
    </span>
  )
}
