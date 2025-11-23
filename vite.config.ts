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
      },
      output: {
        // Ensure viewer.html from root is used, not from public
        assetFileNames: (assetInfo) => {
          if (assetInfo.name === 'viewer.html') {
            return 'viewer.html';
          }
          return 'assets/[name]-[hash][extname]';
        }
      }
    },
    copyPublicDir: true,
    outDir: 'dist',
    manifest: true
  },
  publicDir: 'public',
  server: {
    open: true
  },
  css: {
    postcss: './postcss.config.js'
  }
})