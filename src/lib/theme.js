// Dark is the Levrotec default. Each person's choice is remembered on their own device.
const KEY = 'levro-finance:theme'

export function getTheme() {
  try { return window.localStorage.getItem(KEY) === 'light' ? 'light' : 'dark' } catch { return 'dark' }
}

export function applyTheme(theme) {
  const root = document.documentElement
  if (theme === 'light') root.setAttribute('data-theme', 'light')
  else root.removeAttribute('data-theme')
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'light' ? '#ffffff' : '#000000')
}

export function setTheme(theme) {
  try { window.localStorage.setItem(KEY, theme) } catch { /* private mode: still applies for this visit */ }
  applyTheme(theme)
}
