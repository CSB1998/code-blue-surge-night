import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // GitHub Pages serves the site under /code-blue-surge-night/ (set by the deploy workflow)
  base: process.env.PAGES_BASE ?? '/',
  server: { port: 5173 },
})
