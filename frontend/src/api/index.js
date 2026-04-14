import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
})

// SSE 长连接在开发环境直连后端，避免 Vite 代理缓冲导致连接中断
const SSE_BASE = import.meta.env.DEV ? 'http://localhost:8899' : ''

// ========== 接口管理 ==========
export const apiApis = {
  list: () => api.get('/apis'),
  get: (id) => api.get(`/apis/${id}`),
  create: (data) => api.post('/apis', data),
  update: (id, data) => api.put(`/apis/${id}`, data),
  delete: (id) => api.delete(`/apis/${id}`),
  parseCurl: (curl) => api.post('/apis/parse-curl', { curl }),
  importCurl: (curl, name) => api.post('/apis/import-curl', { curl, name }),
}

// ========== 数据集管理 ==========
export const datasetApis = {
  list: (apiId) => api.get('/datasets', { params: apiId ? { apiId } : {} }),
  get: (name) => api.get(`/datasets/${name}`),
  create: (data) => api.post('/datasets', data),
  update: (name, data) => api.put(`/datasets/${encodeURIComponent(name)}`, data),
  delete: (name) => api.delete(`/datasets/${name}`),
}

// ========== AI 数据生成 ==========
export const generateApis = {
  status: () => api.get('/generate/status'),
  generate: (data) => api.post('/generate', data, { timeout: 120000 }),
  refine: (data) => api.post('/generate/refine', data, { timeout: 120000 }),

  /**
   * SSE 流式生成：实时推送生成进度
   * @param {Object} data - { apiId, scenario, count }
   * @param {Object} callbacks - { onStart, onProgress, onComplete, onError }
   * @returns {Function} abort 函数，可调用取消生成
   */
  generateStream: (data, { onStart, onProgress, onComplete, onError }) => {
    const abortController = new AbortController()

    fetch(`/api/generate/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
      },
      body: JSON.stringify(data),
      signal: abortController.signal,
    })
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`)
        }
        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        // 跨 chunk 持久化状态 —— event:/data: 可能被拆到不同 chunk
        let currentEvent = null
        let dataLines = []   // 收集多行 data: 内容（SSE 标准允许多行 data）

        function dispatchEvent(eventName, fullData) {
          try {
            const payload = JSON.parse(fullData)
            switch (eventName) {
              case 'start':   onStart?.(payload);   break
              case 'progress': onProgress?.(payload); break
              case 'complete': onComplete?.(payload); break
              case 'error':   onError?.(payload.message || '生成失败'); break
            }
          } catch (e) {
            console.warn('[SSE] JSON parse error for event', eventName, ':', fullData, e)
          }
        }

        function processChunk() {
          reader.read().then(({ done, value }) => {
            if (done) {
              // 流结束时，如果还有未发送的事件，尝试发送
              if (currentEvent && dataLines.length > 0) {
                dispatchEvent(currentEvent, dataLines.join('\n'))
              }
              return
            }

            buffer += decoder.decode(value, { stream: true })
            const lines = buffer.split('\n')
            buffer = lines.pop() || ''

            for (const line of lines) {
              if (line.startsWith('event:')) {
                // 新事件开始，先发送之前累积的事件
                if (currentEvent && dataLines.length > 0) {
                  dispatchEvent(currentEvent, dataLines.join('\n'))
                  dataLines = []
                }
                currentEvent = line.slice(6).trim()
              } else if (line.startsWith('data:')) {
                // 累积 data 行内容（支持多行 data）
                dataLines.push(line.slice(5).trim())
              } else if (line.trim() === '') {
                // 空行 = SSE 事件结束分隔符，触发派发
                if (currentEvent && dataLines.length > 0) {
                  dispatchEvent(currentEvent, dataLines.join('\n'))
                }
                currentEvent = null
                dataLines = []
              }
            }

            processChunk()
          }).catch(err => {
            if (err.name !== 'AbortError') {
              console.error('[SSE] Stream read error:', err)
              onError?.(err.message || '连接中断')
            }
          })
        }

        processChunk()
      })
      .catch(err => {
        if (err.name !== 'AbortError') {
          console.error('[SSE] Fetch error:', err)
          onError?.(err.message || '请求失败')
        }
      })

    return () => abortController.abort()
  },
}

// ========== 测试执行 ==========
export const testApis = {
  execute: (data) =>
    fetch(`${SSE_BASE}/api/test/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
      },
      body: JSON.stringify(data),
    }),
}

// ========== 分享（导出/导入文件） ==========
export const shareApis = {
  // 导出：下载分享文件
  export: (apiId) => api.post('/share/export', { apiId }, { responseType: 'blob' }),
  // 预览：上传文件获取内容预览
  preview: (file) => {
    const form = new FormData()
    form.append('file', file)
    return api.post('/share/preview', form, { headers: { 'Content-Type': 'multipart/form-data' } })
  },
  // 导入：上传文件并执行导入
  import: (file, apiStrategy, datasetStrategy) => {
    const form = new FormData()
    form.append('file', file)
    form.append('apiStrategy', apiStrategy)
    form.append('datasetStrategy', datasetStrategy)
    return api.post('/share/import', form, { headers: { 'Content-Type': 'multipart/form-data' } })
  },
}

// ========== 报告管理 ==========
export const reportApis = {
  list: () => api.get('/reports'),
  get: (id) => api.get(`/reports/${id}`),
  delete: (id) => api.delete(`/reports/${id}`),
}

export default api
