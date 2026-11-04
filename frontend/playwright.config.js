import { defineConfig } from '@playwright/test'

const previewBase = process.env.PLAYWRIGHT_PREVIEW_BASE
const port = previewBase ? 5174 : 5173
const baseURL = `http://127.0.0.1:${port}${previewBase || '/'}`

export default defineConfig({
  testDir: './browser-tests',
  fullyParallel: false,
  timeout: 120000,
  use: {
    baseURL,
    channel: process.platform === 'win32' ? 'msedge' : undefined,
    trace: 'retain-on-failure',
    actionTimeout: 15000,
  },
  webServer: [{
    command: process.platform === 'win32' ? '..\\backend\\.venv\\Scripts\\python.exe ..\\backend\\tests\\browser_server.py' : 'python ../backend/tests/browser_server.py',
    url: 'http://127.0.0.1:5001/api/health',
    reuseExistingServer: false,
  }, {
    command: `${process.platform === 'win32' ? 'npm.cmd' : 'npm'} run ${previewBase ? 'preview' : 'dev'} -- --host 127.0.0.1 --port ${port}`,
    url: baseURL,
    env: { VITE_DEV_API_TARGET: 'http://127.0.0.1:5001', ...(previewBase ? { VITE_BASE_PATH: previewBase } : {}) },
    reuseExistingServer: !process.env.CI && !previewBase,
  }],
})
