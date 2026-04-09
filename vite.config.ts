import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    // Don't fail build on TS errors in dev
    rollupOptions: {}
  },
  esbuild: {
    // Skip TS type checking — handled by tsc separately
    logOverride: { 'this-is-undefined-in-esm': 'silent' }
  }
})
