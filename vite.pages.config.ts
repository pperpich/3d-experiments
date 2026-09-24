import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Build for the public GitHub Pages site: only pages/ (the Amazing Grace experiment).
export default defineConfig({
  root: 'pages',
  base: '/3d-experiments/',
  plugins: [react()],
  build: { target: 'es2022', outDir: '../dist-pages', emptyOutDir: true },
})
