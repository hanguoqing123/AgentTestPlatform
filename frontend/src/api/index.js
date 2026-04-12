import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
})

// ========== 接口管理 ==========
export const apiApis = {
  list: () => api.get('/apis'),
  get: (id) => api.get(`/apis/${id}`),
  create: (data) => api.post('/apis', data),
  update: (id, data) => api.put(`/apis/${id}`, data),
  delete: (id) => api.delete(`/apis/${id}`),
}

// ========== 数据集管理 ==========
export const datasetApis = {
  list: (apiId) => api.get('/datasets', { params: apiId ? { apiId } : {} }),
  get: (name) => api.get(`/datasets/${name}`),
  create: (data) => api.post('/datasets', data),
  delete: (name) => api.delete(`/datasets/${name}`),
}

// ========== AI 数据生成 ==========
export const generateApis = {
  status: () => api.get('/generate/status'),
  generate: (data) => api.post('/generate', data, { timeout: 120000 }),
}

// ========== 测试执行 ==========
// SSE 长连接在开发环境直连后端，避免 Vite 代理缓冲导致连接中断
const SSE_BASE = import.meta.env.DEV ? 'http://localhost:8899' : ''

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

// ========== 报告管理 ==========
export const reportApis = {
  list: () => api.get('/reports'),
  get: (id) => api.get(`/reports/${id}`),
  delete: (id) => api.delete(`/reports/${id}`),
}

export default api
