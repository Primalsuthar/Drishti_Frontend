import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Intercepts any request starting with "/api"
      '/api': {
        target: 'https://avowedly-nontaxonomical-elouise.ngrok-free.dev',
        changeOrigin: true,
        secure: false, // Prevents SSL verification issues common with ngrok tunnels
        rewrite: (path) => path.replace(/^\/api/, ''),
        configure: (proxy, options) => {
          proxy.on('proxyReq', (proxyReq, req, res) => {
            // CRITICAL: Tells ngrok to bypass its initial HTML interstitial warning landing screen
            proxyReq.setHeader('ngrok-skip-browser-warning', 'true');
          });
        },
      },
    },
  },
})