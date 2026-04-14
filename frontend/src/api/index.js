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
