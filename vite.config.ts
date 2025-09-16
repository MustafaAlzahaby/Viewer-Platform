import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        main: 'index.html',
        viewer: 'public/viewer.html'
      }
    }
  },
  server: {
    open: true
  },
  css: {
    postcss: './postcss.config.js'
  }
})