/* global process */
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react()],
    server: {
      allowedHosts: true,
      proxy: {
        '/api': {
          // Strip trailing /api so proxy doesn't duplicate to /api/api
          target: (env.VITE_API_URL || 'http://localhost:5001').replace(/\/api\/?$/, ''),
          changeOrigin: true,
          secure: false
        }
      }
    }
  };
});