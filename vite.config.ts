import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages project site: set VITE_BASE=/repo-name/ in CI (see .github/workflows/deploy.yml)
const base = process.env.VITE_BASE ?? '/'

// https://vite.dev/config/
export default defineConfig({
  base,
  plugins: [react()],
})
