import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiTarget = env.VITE_DEV_API_TARGET || 'http://127.0.0.1:5000'
  return {
    plugins: [react()],
    base: env.VITE_BASE_PATH || '/',
    server: {
      port: 5173,
      strictPort: true,
      proxy: { '/api': apiTarget, '/__test__': apiTarget },
    },
    preview: { proxy: { '/api': apiTarget, '/__test__': apiTarget } },
  }
})
