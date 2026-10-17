import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 5173,
    watch: {
      usePolling: true,
      interval: 100,
    },
    allowedHosts: [".ngrok-free.dev", ".ngrok.io", "localhost"], // phones open the app through the ngrok tunnel
    proxy: { "/api": process.env.API_PROXY_TARGET || "http://127.0.0.1:5001" },
  },
})
