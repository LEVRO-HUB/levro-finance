import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Makes the site installable on phones ("Add to Home screen" opens it full-screen
// with the Levrotec icon). The tags are added to index.html at build time.
const meta = (name, content) => ({ tag: 'meta', attrs: { name, content }, injectTo: 'head' })
const installable = {
  name: 'installable-app',
  transformIndexHtml: () => [
    { tag: 'link', attrs: { rel: 'manifest', href: '/manifest.webmanifest' }, injectTo: 'head' },
    { tag: 'link', attrs: { rel: 'icon', type: 'image/png', href: '/favicon.png' }, injectTo: 'head' },
    { tag: 'link', attrs: { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' }, injectTo: 'head' },
    meta('theme-color', '#000000'),
    meta('mobile-web-app-capable', 'yes'),
    meta('apple-mobile-web-app-capable', 'yes'),
    meta('apple-mobile-web-app-title', 'Levro Finance'),
    meta('apple-mobile-web-app-status-bar-style', 'black-translucent'),
  ],
}

export default defineConfig({
  // Served from the site root (https://finance.levrotec.com/ in production,
  // http://localhost:5173/ in development).
  base: '/',
  plugins: [react(), tailwindcss(), installable],
})
