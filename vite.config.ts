import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src') // 👈 This enables @ to point to /src
    }
  },
  build: {
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
        viewer: path.resolve(__dirname, 'viewer.html')
      }
    },
    copyPublicDir: true
  },
  publicDir: 'public',
  server: {
    open: true
  },
  css: {
    postcss: './postcss.config.js'
  }
})