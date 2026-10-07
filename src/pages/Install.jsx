import { useEffect, useState } from 'react'
import { CheckCircle2, Download, MoreVertical, PlusSquare, Share } from 'lucide-react'
import { Button } from '../components/ui/Button'

// Public page (no sign-in needed) that team members open from a shared link:
//   https://finance.levrotec.com/install
// Android / desktop Chrome: one "Install app" button. iPhone: Apple does not
// allow a website to install itself, so the two taps are shown instead.
const home = import.meta.env.BASE_URL
const isStandalone = () => window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

const Step = ({ n, children }) => (
  <li className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-left text-sm text-slate-700">
    <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-linear-to-br from-[#2563eb] to-[#0ea5e9] text-xs font-bold text-pure">{n}</span>
    <span className="min-w-0">{children}</span>
  </li>
)

export function Install() {
  const [prompt, setPrompt] = useState(() => window.__installPrompt ?? null)
  const [installed, setInstalled] = useState(isStandalone)
  const [busy, setBusy] = useState(false)
  const ios = isIOS()

  useEffect(() => {
    const ready = () => setPrompt(window.__installPrompt ?? null)
    const done = () => { setInstalled(true); setPrompt(null) }
    window.addEventListener('levro:installable', ready)
    window.addEventListener('appinstalled', done)
    return () => { window.removeEventListener('levro:installable', ready); window.removeEventListener('appinstalled', done) }
  }, [])

  async function install() {
    if (!prompt) return
    setBusy(true)
    try {
      prompt.prompt()
      const choice = await prompt.userChoice
      if (choice?.outcome === 'accepted') setInstalled(true)
      window.__installPrompt = null
      setPrompt(null)
    } finally { setBusy(false) }
  }

  return (
    <div className="brand-sidebar flex min-h-svh items-center justify-center px-4 py-8">
      <main className="surface w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-6 text-center">
        <img src={`${home}icon-192.png`} alt="" width="84" height="84" className="mx-auto h-[84px] w-[84px] rounded-3xl shadow-xl shadow-[#2563eb]/40 ring-1 ring-pure/10" />
        <h1 className="mt-4 text-xl font-bold tracking-tight text-slate-900">Levrotec Finance Tracker</h1>
        <p className="mt-1 text-sm text-slate-500">Install the app on your phone or computer, then sign in with the email and password you were given.</p>

        <div className="mt-5 space-y-3">
          {installed ? (
            <>
              <p className="flex items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm font-medium text-emerald-700"><CheckCircle2 size={18} /> Installed. Open it from your home screen.</p>
              <a href={home} className="block"><Button className="w-full">Open the app</Button></a>
            </>
          ) : prompt ? (
            <Button className="h-12 w-full text-base" onClick={install} disabled={busy}><Download size={18} /> {busy ? 'Installing…' : 'Install app'}</Button>
          ) : ios ? (
            <>
              <p className="text-sm font-semibold text-slate-800">On iPhone, install it in two taps (use Safari):</p>
              <ol className="space-y-2">
                <Step n={1}>Tap the <Share size={15} className="mx-0.5 inline align-text-bottom" aria-hidden="true" /> <strong>Share</strong> button at the bottom of Safari.</Step>
                <Step n={2}>Choose <PlusSquare size={15} className="mx-0.5 inline align-text-bottom" aria-hidden="true" /> <strong>Add to Home Screen</strong>, then <strong>Add</strong>.</Step>
              </ol>
            </>
          ) : (
            <>
              <p className="text-sm font-semibold text-slate-800">Install it from your browser menu:</p>
              <ol className="space-y-2">
                <Step n={1}>Open this page in <strong>Chrome</strong> (not an in-app browser such as WhatsApp's).</Step>
                <Step n={2}>Tap the <MoreVertical size={15} className="mx-0.5 inline align-text-bottom" aria-hidden="true" /> menu at the top right.</Step>
                <Step n={3}>Choose <strong>Add to Home screen</strong>, then <strong>Install</strong>.</Step>
              </ol>
            </>
          )}
          {!installed && <a href={home} className="block text-xs font-medium text-blue-600 hover:underline">Continue in the browser instead</a>}
        </div>
      </main>
    </div>
  )
}
