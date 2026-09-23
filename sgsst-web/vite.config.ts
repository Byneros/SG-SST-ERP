import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // El callback SSO del IdP aterriza en PUBLIC_BASE_URL (la web) con la ruta de la
    // API; el proxy lo reenvia al backend para completar el flujo en desarrollo.
    // Cubre el callback OIDC y los endpoints SAML (metadata/authorize/ACS).
    proxy: {
      '/api/v1/auth/sso/callback': {
        target: 'http://localhost:3002',
        changeOrigin: false,
      },
      // SAML: metadata SP, authorize y ACS (el ACS llega por POST del IdP).
      '/api/v1/auth/sso/saml': {
        target: 'http://localhost:3002',
        changeOrigin: false,
      },
    },
  },
})
