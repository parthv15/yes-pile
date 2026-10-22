import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Served from https://parthv15.github.io/yes-pile/ on GitHub Pages.
export default defineConfig({
  base: '/yes-pile/',
  plugins: [react(), tailwindcss()],
})
