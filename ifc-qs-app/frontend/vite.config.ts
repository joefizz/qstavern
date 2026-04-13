import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://backend:8000',
      '/health': 'http://backend:8000',
    },
    watch: {
      usePolling: true,
      interval: 500,
    },
    // HMR must use the host-side port (9090), not the internal container port (5173).
    // Without this, the browser tries ws://localhost:5173 which isn't exposed,
    // creating a storm of CLOSE_WAIT connections that eventually makes the port unresponsive.
    hmr: {
      clientPort: 3000,
    },
  },
})
