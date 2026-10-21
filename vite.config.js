import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Fail loudly rather than quietly moving to another port.
    strictPort: true,
    // The Express middleman holds the Groq key; the browser never sees it.
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
})
