const variants = {
  primary: 'sheen bg-linear-to-r from-[#2563eb] to-[#0ea5e9] text-pure shadow-lg shadow-[#2563eb]/40 hover:from-[#3b74f0] hover:to-[#22b3f2]',
  secondary: 'border border-slate-200 bg-slate-100 text-slate-800 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-800',
  danger: 'bg-red-50 text-red-600 hover:bg-red-100 active:bg-red-200',
  ghost: 'bg-transparent text-slate-600 hover:bg-slate-100',
}

export function Button({ variant = 'primary', className = '', children, ...props }) {
  return (
    <button
      className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}
