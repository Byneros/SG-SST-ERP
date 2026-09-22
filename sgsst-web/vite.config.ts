import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // El callback SSO del IdP aterriza en PUBLIC_BASE_URL (la web) con la ruta de la
    // API; el proxy lo reenvia al backend para completar el flujo en desarrollo.
    proxy: {
      '/api/v1/auth/sso/callback': {
        target: 'http://localhost:3002',
        changeOrigin: false,
      },
    },
  },
})
