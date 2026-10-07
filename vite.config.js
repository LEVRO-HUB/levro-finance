import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  // Served from the site root (https://finance.levrotec.com/ in production,
  // http://localhost:5173/ in development).
  base: '/',
  plugins: [react(), tailwindcss()],
})
