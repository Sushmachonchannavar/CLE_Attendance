/* global process */
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react()],
    server: {
      proxy: {
        '/api': {
          // Use VITE_API_URL environment variable when set, otherwise default to localhost:5001
          target: env.VITE_API_URL || 'http://localhost:5001',
          changeOrigin: true,
          secure: false
        }
      }
    }
  };
});