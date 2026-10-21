import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The Express middleman holds the Groq key; the browser never sees it.
const apiTarget = process.env.VILLAGE_API_TARGET || 'http://localhost:3001'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Fail loudly rather than quietly moving to another port.
    strictPort: true,
    proxy: {
      '/api': apiTarget,
    },
  },
})
