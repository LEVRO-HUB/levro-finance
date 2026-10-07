import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { Install } from './pages/Install.jsx'
import { applyTheme, getTheme } from './lib/theme'

applyTheme(getTheme()) // before the first paint, so there is no flash of the other theme

// Chrome offers the install prompt once, often before the page has drawn — keep it for the Install page.
window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault()
  window.__installPrompt = event
  window.dispatchEvent(new Event('levro:installable'))
})
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => { navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {}) })
}

// Safety net for app updates: if the stylesheet did not apply (a phone can catch
// the site mid-update and keep a bad copy), fetch it fresh and apply it, so
// nobody is ever left looking at an unstyled page.
window.addEventListener('load', async () => {
  const link = [...document.querySelectorAll('link[rel="stylesheet"]')].find((l) => new URL(l.href).origin === window.location.origin)
  const styled = () => getComputedStyle(document.documentElement).getPropertyValue('--color-pure').trim() !== ''
  if (!link || styled()) return
  try {
    const res = await fetch(link.href, { cache: 'reload' }) // also replaces the bad saved copy
    if (!res.ok || !(res.headers.get('content-type') ?? '').includes('text/css')) return
    const style = document.createElement('style')
    style.textContent = await res.text()
    document.head.appendChild(style)
  } catch { /* offline: nothing more to do */ }
})

// /install is public (no sign-in), so it is shown before the app and its login gate.
const path = window.location.pathname.replace(/\/+$/, '')
const isInstallPage = path === `${import.meta.env.BASE_URL.replace(/\/+$/, '')}/install`

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {isInstallPage ? <Install /> : <App />}
  </StrictMode>,
)
