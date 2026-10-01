import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  // Served from https://levro-hub.github.io/levro-finance/ by default.
  base: '/levro-finance/',
  plugins: [react(), tailwindcss()],
})
