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
          proxy.on('proxyRes', (proxyRes, req, res) => {
            // 关键：当响应是 SSE 流时，禁用任何缓冲
            if (proxyRes.headers['content-type']?.includes('text/event-stream')) {
              proxyRes.headers['Cache-Control'] = 'no-cache'
              proxyRes.headers['X-Accel-Buffering'] = 'no'
            }
          })
        },
      },
      '/api/generate/stream': {
        target: 'http://localhost:8899',
        changeOrigin: true,
        // SSE 流式生成：禁用代理缓冲，确保进度实时推送
        configure: (proxy) => {
          proxy.on('proxyRes', (proxyRes, req, res) => {
            if (proxyRes.headers['content-type']?.includes('text/event-stream')) {
              proxyRes.headers['Cache-Control'] = 'no-cache'
              proxyRes.headers['X-Accel-Buffering'] = 'no'
            }
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
