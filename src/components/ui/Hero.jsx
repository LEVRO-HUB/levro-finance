import { useEffect, useRef, useState } from 'react'
import { ArrowDownLeft, ArrowUpRight, Scale } from 'lucide-react'
import { formatCurrency } from '../../lib/format'

// Rolls a number up to its new value. The real figure is always in the
// accessible label, so screen readers never hear the in-between numbers.
export function CountUp({ value, duration = 800, className = '' }) {
  const [shown, setShown] = useState(value)
  const from = useRef(value)
  useEffect(() => {
    const start = from.current
    const still = typeof window === 'undefined' || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (still || start === value) { from.current = value; setShown(value); return }
    let frame
    const t0 = performance.now()
    const tick = (t) => {
      const k = Math.min((t - t0) / duration, 1)
      const eased = 1 - Math.pow(1 - k, 3)
      setShown(start + (value - start) * eased)
      if (k < 1) frame = requestAnimationFrame(tick)
      else from.current = value
    }
    frame = requestAnimationFrame(tick)
    return () => { cancelAnimationFrame(frame); from.current = value }
  }, [value, duration])
  return <span className={className} aria-label={formatCurrency(value)}><span aria-hidden="true">{formatCurrency(Math.round(shown))}</span></span>
}

// The headline of the dashboard: how much Levrotec has, and how the chosen period went.
export function HeroBanner({ balance, moneyIn, moneyOut, net, periodLabel, companyName = 'Levrotec', trend = [] }) {
  const max = Math.max(1, ...trend.map((m) => Math.max(m.income, m.expenses)))
  const chips = [
    { label: 'Came in', value: moneyIn, icon: ArrowDownLeft, tint: 'text-[#a7f3d0]' },
    { label: 'Went out', value: moneyOut, icon: ArrowUpRight, tint: 'text-[#fecdd3]' },
    { label: 'Difference', value: net, icon: Scale, tint: net < 0 ? 'text-[#fecdd3]' : 'text-[#e0f2fe]' },
  ]
  return (
    <section aria-label="Company balance" className="hero relative overflow-hidden rounded-3xl p-5 text-pure sm:p-7">
      <img src={`${import.meta.env.BASE_URL}icon-192.png`} alt="" aria-hidden="true" className="pointer-events-none absolute -right-6 -top-8 h-56 w-56 rotate-6 opacity-[0.13] mix-blend-screen" />
      <div className="relative flex flex-wrap items-end justify-between gap-6">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#e0f2fe]/80">{companyName} · Company balance</p>
          <p className="glow-text mt-2 text-4xl font-extrabold tracking-tight tabular-nums sm:text-5xl"><CountUp value={balance} /></p>
          <p className="mt-2 text-sm text-[#e0f2fe]/80">Cash position right now, after every payment in and out</p>
        </div>
        {trend.length > 0 && (
          <div className="hidden h-16 items-end gap-1.5 md:flex" aria-hidden="true">
            {trend.map((m, i) => (
              <span key={m.key} className="flex h-full items-end gap-0.5">
                <span className="bar-grow w-1.5 rounded-t bg-[#6ee7b7]" style={{ height: `${Math.max((m.income / max) * 100, 4)}%`, animationDelay: `${i * 60}ms` }} />
                <span className="bar-grow w-1.5 rounded-t bg-pure/45" style={{ height: `${Math.max((m.expenses / max) * 100, 4)}%`, animationDelay: `${i * 60 + 30}ms` }} />
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="relative mt-5 grid gap-2.5 sm:grid-cols-3">
        {chips.map(({ label, value, icon: Icon, tint }) => (
          <div key={label} className="hero-chip flex items-center gap-3 rounded-2xl px-3.5 py-3">
            <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-pure/15"><Icon size={17} /></span>
            <div className="min-w-0">
              <p className="text-[11px] font-medium text-[#e0f2fe]/80">{label} · {periodLabel}</p>
              <p className={`truncate text-lg font-bold tabular-nums ${tint}`}><CountUp value={value} /></p>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
