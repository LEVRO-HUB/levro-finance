// Levrotec's own products: stages and the "is it still moving?" rule.
export const PRODUCT_STAGES = ['Idea', 'Planning', 'In Development', 'Testing', 'Launched', 'On Hold']
export const STALLED_AFTER_DAYS = 14

export function daysSince(iso, today) {
  if (!iso) return 0
  const a = Date.UTC(...String(iso).slice(0, 10).split('-').map((n, i) => (i === 1 ? Number(n) - 1 : Number(n))))
  const b = Date.UTC(...String(today).slice(0, 10).split('-').map((n, i) => (i === 1 ? Number(n) - 1 : Number(n))))
  return Math.max(0, Math.round((b - a) / 86400000))
}

// → { label, tone } for the badge on a product card
export function productActivity(product, today) {
  if (product.stage === 'Launched') return { label: 'Launched', tone: 'green' }
  if (product.stage === 'On Hold' || product.status === 'On Hold') return { label: 'On hold', tone: 'grey' }
  const days = daysSince(product.stage_updated_at ?? product.created_at, today)
  if (days <= STALLED_AFTER_DAYS) return { label: days === 0 ? 'Moving · updated today' : `Moving · updated ${days} day${days === 1 ? '' : 's'} ago`, tone: 'green' }
  return { label: `No update for ${days} days`, tone: days > 30 ? 'red' : 'amber' }
}
