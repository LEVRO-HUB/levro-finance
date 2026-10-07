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

// /install is public (no sign-in), so it is shown before the app and its login gate.
const path = window.location.pathname.replace(/\/+$/, '')
const isInstallPage = path === `${import.meta.env.BASE_URL.replace(/\/+$/, '')}/install`

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {isInstallPage ? <Install /> : <App />}
  </StrictMode>,
)
