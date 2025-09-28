import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: ['@mysten/sui.js']
  },
  build: {
    commonjsOptions: {
      include: [/node_modules/, /@mysten\/sui.js/],
    },
    rollupOptions: {
      external: ['@mysten/sui.js']
    }
  },
  resolve: {
    dedupe: ['@mysten/sui.js']
  }
})
