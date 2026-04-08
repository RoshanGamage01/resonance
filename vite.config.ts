import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Production base: CI sets VITE_BASE (root `/` for custom domain; `/repo/` only for github.io project URLs).
const base = process.env.VITE_BASE ?? '/'

// https://vite.dev/config/
export default defineConfig({
  base,
  plugins: [react()],
})
