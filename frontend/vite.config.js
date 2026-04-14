import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api/test/execute': {
        target: 'http://localhost:8899',
        changeOrigin: true,
        // SSE 长连接不能缓冲，必须禁用代理缓冲
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq, req, res) => {
            // 确保响应不被缓冲
            res.setHeader('X-Accel-Buffering', 'no')
            res.setHeader('Cache-Control', 'no-cache')
            res.setHeader('Connection', 'keep-alive')
          })
        },
      },
      '/api': {
        target: 'http://localhost:8899',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: '../src/main/resources/static',
    emptyOutDir: true,
  },
})
