import React, { useState, useEffect, useMemo, useRef } from 'react'
import {
  Table, Button, Modal, Form, Input, Select, Space, Tag, Popconfirm, message,
  Descriptions, Drawer, Tooltip, Divider, Alert, Card, Upload, Radio, Spin
} from 'antd'
import {
  PlusOutlined, EditOutlined, DeleteOutlined, EyeOutlined, SearchOutlined,
  ImportOutlined, CheckCircleOutlined, ThunderboltOutlined, ShareAltOutlined,
  DownloadOutlined, UploadOutlined, InboxOutlined, WarningOutlined,
  InfoCircleOutlined, CloseCircleOutlined, ApiOutlined, DatabaseOutlined
} from '@ant-design/icons'
import { apiApis, shareApis, datasetApis } from '../api'
import eventBus from '../utils/eventBus'

const { TextArea } = Input
const { Dragger } = Upload

const methodColors = {
  GET: '#22c55e', POST: '#6366f1', PUT: '#f59e0b', DELETE: '#ef4444',
}

const statusLabels = {
  imported: { text: '已导入', color: '#22c55e', icon: <CheckCircleOutlined /> },
  overwritten: { text: '已覆盖', color: '#f59e0b', icon: <WarningOutlined /> },
  renamed: { text: '已重命名导入', color: '#6366f1', icon: <InfoCircleOutlined /> },
  skipped: { text: '已跳过', color: '#9ca3af', icon: <CloseCircleOutlined /> },
}

export default function ApiManagement({ active }) {
  const [apis, setApis] = useState([])
  const [loading, setLoading] = useState(false)
  const [keyword, setKeyword] = useState('')
  const [methodFilter, setMethodFilter] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [viewing, setViewing] = useState(null)
  const [form] = Form.useForm()

  // 导入分享相关状态
  const [importShareOpen, setImportShareOpen] = useState(false)
  const [importFile, setImportFile] = useState(null)
  const [importPreview, setImportPreview] = useState(null)    // SharePackage 预览数据
  const [importPreviewing, setImportPreviewing] = useState(false)
  const [importApiConflict, setImportApiConflict] = useState(false)
  const [importDatasetConflicts, setImportDatasetConflicts] = useState([])
  const [importApiStrategy, setImportApiStrategy] = useState('skip')
  const [importDatasetStrategy, setImportDatasetStrategy] = useState('skip')
  const [importLoading, setImportLoading] = useState(false)
  const [importResult, setImportResult] = useState(null)

  // cURL 导入相关状态
  const [importModalOpen, setImportModalOpen] = useState(false)
  const [curlText, setCurlText] = useState('')
  const [curlParsing, setCurlParsing] = useState(false)
  const [curlPreview, setCurlPreview] = useState(null)
  const [curlName, setCurlName] = useState('')
  const [curlImporting, setCurlImporting] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const { data } = await apiApis.list()
      setApis(data)
    } catch (e) {
      message.error('加载接口列表失败')
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  // 切换到当前 tab 时自动刷新
  useEffect(() => {
    if (active) load()
  }, [active])

  const openCreate = () => {
    setEditing(null)
    form.resetFields()
    form.setFieldsValue({
      method: 'POST',
      responseType: 'json',
      headers: '{"Content-Type": "application/json"}',
      bodySchema: '{}',
    })
    setModalOpen(true)
  }

  const openEdit = (record) => {
    setEditing(record)
    form.setFieldsValue({
      ...record,
      headers: JSON.stringify(record.headers || {}, null, 2),
      bodySchema: JSON.stringify(record.bodySchema || {}, null, 2),
    })
    setModalOpen(true)
  }

  const openView = (record) => {
    setViewing(record)
    setDrawerOpen(true)
  }

  const handleSubmit = async () => {
    let values
    try {
      values = await form.validateFields()
    } catch (e) {
      return
    }

    let headers = {}
    let bodySchema = {}
    try {
      headers = JSON.parse(values.headers || '{}')
    } catch { message.error('Headers JSON 格式错误'); return }
    try {
      bodySchema = JSON.parse(values.bodySchema || '{}')
    } catch { message.error('请求体结构 JSON 格式错误'); return }

    const payload = { ...values, headers, bodySchema }

    try {
      if (editing) {
        await apiApis.update(editing.id, payload)
        message.success('更新成功')
      } else {
        await apiApis.create(payload)
        message.success('创建成功')
        eventBus.emit('apiAdded')
      }
      setModalOpen(false)
      load()
    } catch (e) {
      console.error('保存失败:', e)
      message.error('保存失败: ' + (e.response?.data?.message || e.message || '未知错误'))
    }
  }

  const handleDelete = async (id) => {
    try {
      await apiApis.delete(id)
      message.success('删除成功')
      load()
    } catch {
      message.error('删除失败')
    }
  }

  // ========== 导出分享文件 ==========
  const handleExport = async (record) => {
    try {
      const response = await shareApis.export(record.id)
      // 从 blob 触发下载
      const blob = new Blob([response.data], { type: 'application/json' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${record.name || 'share'}.agenttest.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
      message.success('分享文件已下载')
    } catch (e) {
      message.error('导出失败: ' + (e.response?.data?.message || e.message))
    }
  }

  // ========== 导入分享文件 ==========
  const openImportShare = () => {
    setImportFile(null)
    setImportPreview(null)
    setImportApiConflict(false)
    setImportDatasetConflicts([])
    setImportApiStrategy('skip')
    setImportDatasetStrategy('skip')
    setImportResult(null)
    setImportShareOpen(true)
  }

  const handleFileSelected = async (file) => {
    setImportFile(file)
    setImportPreview(null)
    setImportResult(null)
    setImportPreviewing(true)

    try {
      // 上传预览
      const { data: pkg } = await shareApis.preview(file)
      setImportPreview(pkg)

      // 检测冲突
      try {
        const { data: existingApis } = await apiApis.list()
        const hasApiConflict = existingApis.some(
          a => a.id === pkg.api?.id ||
               (a.url === pkg.api?.url && a.method === pkg.api?.method)
        )
        setImportApiConflict(hasApiConflict)
      } catch { /* 不阻塞 */ }

      if (pkg.datasets?.length > 0) {
        try {
          const { data: existingDatasets } = await datasetApis.list()
          const existingNames = new Set(existingDatasets.map(d => d.name))
          const conflicts = pkg.datasets
            .filter(ds => existingNames.has(ds.meta?.name))
            .map(ds => ds.meta?.name)
          setImportDatasetConflicts(conflicts)
        } catch { /* 不阻塞 */ }
      }
    } catch (e) {
      message.error('文件解析失败，请确认是 .agenttest.json 格式')
      setImportFile(null)
    }
    setImportPreviewing(false)
    return false // 阻止 antd 默认上传
  }

  const handleImportShare = async () => {
    if (!importFile) return
    setImportLoading(true)
    try {
      const { data } = await shareApis.import(importFile, importApiStrategy, importDatasetStrategy)
      setImportResult(data)
      message.success('导入完成')
      load()
      eventBus.emit('apiAdded')
    } catch (e) {
      message.error('导入失败: ' + (e.response?.data?.message || e.message))
    }
    setImportLoading(false)
  }

  // ========== cURL 导入 ==========
  const openImportModal = () => {
    setCurlText('')
    setCurlPreview(null)
    setCurlName('')
    setImportModalOpen(true)
  }

  const handleParseCurl = async () => {
    if (!curlText.trim()) {
      message.warning('请粘贴 cURL 命令')
      return
    }
    setCurlParsing(true)
    try {
      const { data } = await apiApis.parseCurl(curlText)
      setCurlPreview(data)
      setCurlName(data.name || '')
      message.success('解析成功，请确认信息后导入')
    } catch (e) {
      message.error(e.response?.data?.message || 'cURL 解析失败')
      setCurlPreview(null)
    }
    setCurlParsing(false)
  }

  const handleImportCurl = async () => {
    if (!curlText.trim()) {
      message.warning('请先粘贴并解析 cURL 命令')
      return
    }
    setCurlImporting(true)
    try {
      await apiApis.importCurl(curlText, curlName || undefined)
      message.success('接口导入成功')
      setImportModalOpen(false)
      load()
      eventBus.emit('apiAdded')
    } catch (e) {
      message.error(e.response?.data?.message || '导入失败')
    }
    setCurlImporting(false)
  }

  const filteredApis = useMemo(() => {
    return apis.filter(api => {
      const kw = keyword.trim().toLowerCase()
      if (kw) {
        const matchName = api.name?.toLowerCase().includes(kw)
        const matchUrl = api.url?.toLowerCase().includes(kw)
        const matchDesc = api.description?.toLowerCase().includes(kw)
        if (!matchName && !matchUrl && !matchDesc) return false
      }
      if (methodFilter && api.method !== methodFilter) return false
      return true
    })
  }, [apis, keyword, methodFilter])

  const columns = [
    {
      title: '接口名称',
      dataIndex: 'name',
      key: 'name',
      ellipsis: true,
      width: 200,
      render: (v, record) => (
        <a onClick={() => openView(record)} style={{ fontWeight: 500 }}>{v}</a>
      ),
    },
    {
      title: '方法',
      dataIndex: 'method',
      key: 'method',
      width: 90,
      render: (m) => (
        <Tag className="method-tag"
             style={{ background: methodColors[m] + '18', color: methodColors[m] }}>
          {m}
        </Tag>
      ),
    },
    {
      title: 'URL',
      dataIndex: 'url',
      key: 'url',
      ellipsis: true,
      render: (v) => {
        if (!v) return <span style={{ color: '#d1d5db' }}>-</span>
        let protocol = '', host = '', path = ''
        try {
          const u = new URL(v)
          protocol = u.protocol + '//'
          host = u.host
          path = u.pathname + u.search + u.hash
        } catch {
          path = v
        }
        return (
          <span style={{
            fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
            fontSize: 12,
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: 6,
            padding: '2px 8px',
            display: 'inline-block',
            maxWidth: '100%',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            lineHeight: '22px',
          }}>
            {protocol && <span style={{ color: '#a0aec0' }}>{protocol}</span>}
            {host && <span style={{ color: '#718096' }}>{host}</span>}
            <span style={{ color: '#6366f1', fontWeight: 500 }}>{path}</span>
          </span>
        )
      },
    },
    {
      title: '响应类型',
      dataIndex: 'responseType',
      key: 'responseType',
      width: 100,
      render: (t) => (
        <Tag style={{ background: '#f5f3ff', color: '#7c3aed', border: 'none', fontWeight: 500 }}>
          {t?.toUpperCase() || 'JSON'}
        </Tag>
      ),
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      width: 200,
      render: (v) => <span style={{ color: '#9ca3af' }}>{v || '-'}</span>,
    },
    {
      title: '操作',
      key: 'actions',
      width: 170,
      render: (_, record) => (
        <Space size={4}>
          <Tooltip title="查看">
            <Button type="text" size="small" icon={<EyeOutlined />} onClick={() => openView(record)} />
          </Tooltip>
          <Tooltip title="编辑">
            <Button type="text" size="small" icon={<EditOutlined />} onClick={() => openEdit(record)} />
          </Tooltip>
          <Tooltip title="导出分享">
            <Button type="text" size="small" icon={<ShareAltOutlined />} onClick={() => handleExport(record)}
                    style={{ color: '#6366f1' }} />
          </Tooltip>
          <Popconfirm title="确认删除？" onConfirm={() => handleDelete(record.id)} okText="删除" cancelText="取消">
            <Tooltip title="删除">
              <Button type="text" size="small" danger icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  // cURL 预览卡片
  const renderCurlPreview = () => {
    if (!curlPreview) return null
    return (
      <Card
        size="small"
        style={{
          marginTop: 16,
          borderRadius: 10,
          border: '1px solid #c7d2fe',
          background: '#fafafe',
        }}
        title={
          <span style={{ fontSize: 13, color: '#6366f1' }}>
            <CheckCircleOutlined style={{ marginRight: 6 }} />
            解析结果预览
          </span>
        }
      >
        <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: '8px 12px', fontSize: 13 }}>
          <span style={{ color: '#9ca3af', fontWeight: 500 }}>方法</span>
          <Tag style={{ width: 'fit-content', background: methodColors[curlPreview.method] + '18', color: methodColors[curlPreview.method], border: 'none', fontWeight: 600 }}>
            {curlPreview.method}
          </Tag>

          <span style={{ color: '#9ca3af', fontWeight: 500 }}>URL</span>
          <span style={{ color: '#374151', wordBreak: 'break-all', fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>
            {curlPreview.url}
          </span>

          <span style={{ color: '#9ca3af', fontWeight: 500 }}>响应类型</span>
          <Tag style={{ width: 'fit-content', background: '#f5f3ff', color: '#7c3aed', border: 'none' }}>
            {curlPreview.responseType?.toUpperCase()}
          </Tag>

          {curlPreview.headers && Object.keys(curlPreview.headers).length > 0 && (
            <>
              <span style={{ color: '#9ca3af', fontWeight: 500 }}>请求头</span>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: '#6b7280', background: '#f3f4f6', borderRadius: 6, padding: '6px 10px' }}>
                {Object.entries(curlPreview.headers).map(([k, v]) => (
                  <div key={k}>{k}: {v}</div>
                ))}
              </div>
            </>
          )}

          {curlPreview.bodySchema && Object.keys(curlPreview.bodySchema).length > 0 && (
            <>
              <span style={{ color: '#9ca3af', fontWeight: 500 }}>请求体</span>
              <pre style={{
                margin: 0, fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: '#6b7280',
                background: '#f3f4f6', borderRadius: 6, padding: '6px 10px',
                maxHeight: 150, overflow: 'auto', whiteSpace: 'pre-wrap',
              }}>
                {JSON.stringify(curlPreview.bodySchema, null, 2)}
              </pre>
            </>
          )}
        </div>

        <Divider style={{ margin: '12px 0' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, color: '#9ca3af', whiteSpace: 'nowrap' }}>接口名称：</span>
          <Input
            size="small"
            value={curlName}
            onChange={e => setCurlName(e.target.value)}
            placeholder="自动生成或自定义名称"
            style={{ flex: 1 }}
          />
        </div>
      </Card>
    )
  }

  // ========== 导入分享预览内容 ==========
  const renderImportPreview = () => {
    if (importPreviewing) {
      return <div style={{ textAlign: 'center', padding: '40px 0' }}><Spin tip="解析文件中..." /></div>
    }
    if (!importPreview) return null

    const api = importPreview.api
    const datasets = importPreview.datasets || []
    const hasConflicts = importApiConflict || importDatasetConflicts.length > 0

    return (
      <div style={{ marginTop: 16 }}>
        {/* 接口信息 */}
        <Card
          size="small"
          style={{ borderRadius: 10, marginBottom: 12, border: importApiConflict ? '1px solid #fbbf24' : '1px solid #e2e8f0' }}
          title={
            <span style={{ fontSize: 13 }}>
              <ApiOutlined style={{ marginRight: 6, color: '#6366f1' }} />
              接口
              {importApiConflict && <Tag color="warning" style={{ marginLeft: 8 }} icon={<WarningOutlined />}>冲突</Tag>}
            </span>
          }
        >
          <div style={{ display: 'grid', gridTemplateColumns: '70px 1fr', gap: '4px 8px', fontSize: 13 }}>
            <span style={{ color: '#9ca3af' }}>名称</span>
            <span style={{ fontWeight: 500 }}>{api?.name}</span>
            <span style={{ color: '#9ca3af' }}>方法</span>
            <Tag style={{ width: 'fit-content', background: methodColors[api?.method] + '18', color: methodColors[api?.method], border: 'none', fontWeight: 600 }}>
              {api?.method}
            </Tag>
            <span style={{ color: '#9ca3af' }}>URL</span>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, wordBreak: 'break-all' }}>{api?.url}</span>
          </div>
        </Card>

        {/* 数据集列表 */}
        <Card
          size="small"
          style={{ borderRadius: 10, marginBottom: 12, border: importDatasetConflicts.length > 0 ? '1px solid #fbbf24' : '1px solid #e2e8f0' }}
          title={
            <span style={{ fontSize: 13 }}>
              <DatabaseOutlined style={{ marginRight: 6, color: '#6366f1' }} />
              数据集（{datasets.length} 个）
              {importDatasetConflicts.length > 0 && (
                <Tag color="warning" style={{ marginLeft: 8 }} icon={<WarningOutlined />}>
                  {importDatasetConflicts.length} 个冲突
                </Tag>
              )}
            </span>
          }
        >
          {datasets.length === 0 ? (
            <div style={{ color: '#9ca3af', textAlign: 'center', padding: 8 }}>无关联数据集</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {datasets.map(ds => (
                <div key={ds.meta?.name} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, padding: '4px 0' }}>
                  <span style={{ fontWeight: 500 }}>{ds.meta?.name}</span>
                  <Tag style={{ fontSize: 11, border: 'none', background: '#f3f4f6', color: '#6b7280' }}>
                    {ds.meta?.count || ds.data?.length || 0} 条
                  </Tag>
                  {importDatasetConflicts.includes(ds.meta?.name) && (
                    <Tag color="warning" style={{ fontSize: 11 }}>冲突</Tag>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* 冲突策略 */}
        {hasConflicts && (
          <Card
            size="small"
            style={{ borderRadius: 10, marginBottom: 12, background: '#fffbeb', border: '1px solid #fde68a' }}
            title={
              <span style={{ fontSize: 13, color: '#d97706' }}>
                <WarningOutlined style={{ marginRight: 6 }} />
                冲突处理策略
              </span>
            }
          >
            {importApiConflict && (
              <div style={{ marginBottom: importDatasetConflicts.length > 0 ? 12 : 0 }}>
                <div style={{ fontWeight: 500, marginBottom: 6, fontSize: 12 }}>接口冲突：</div>
                <Radio.Group value={importApiStrategy} onChange={e => setImportApiStrategy(e.target.value)} size="small">
                  <Space direction="vertical" size={2}>
                    <Radio value="skip"><span style={{ fontSize: 12 }}>跳过 — 仅导入数据集到已有接口下</span></Radio>
                    <Radio value="rename"><span style={{ fontSize: 12 }}>重命名 — 自动追加后缀创建新接口</span></Radio>
                    <Radio value="overwrite"><span style={{ fontSize: 12, color: '#ef4444' }}>覆盖 — 替换已有接口</span></Radio>
                  </Space>
                </Radio.Group>
              </div>
            )}
            {importDatasetConflicts.length > 0 && (
              <div>
                {importApiConflict && <Divider style={{ margin: '8px 0' }} />}
                <div style={{ fontWeight: 500, marginBottom: 6, fontSize: 12 }}>数据集冲突（{importDatasetConflicts.length} 个）：</div>
                <Radio.Group value={importDatasetStrategy} onChange={e => setImportDatasetStrategy(e.target.value)} size="small">
                  <Space direction="vertical" size={2}>
                    <Radio value="skip"><span style={{ fontSize: 12 }}>跳过 — 不导入已存在的数据集</span></Radio>
                    <Radio value="rename"><span style={{ fontSize: 12 }}>重命名 — 自动追加后缀创建新数据集</span></Radio>
                    <Radio value="overwrite"><span style={{ fontSize: 12, color: '#ef4444' }}>覆盖 — 替换已有数据集</span></Radio>
                  </Space>
                </Radio.Group>
              </div>
            )}
          </Card>
        )}
      </div>
    )
  }

  // ========== 导入结果 ==========
  const renderImportResult = () => {
    if (!importResult) return null
    return (
      <div style={{ marginTop: 16 }}>
        <Alert type="success" showIcon message="导入完成" style={{ marginBottom: 12, borderRadius: 8 }} />
        <div style={{ fontSize: 13, marginBottom: 8 }}>
          <span style={{ fontWeight: 500 }}>接口：</span>
          <span>{importResult.apiName}</span>
          {statusLabels[importResult.apiStatus] && (
            <Tag color={statusLabels[importResult.apiStatus].color}
                 icon={statusLabels[importResult.apiStatus].icon}
                 style={{ marginLeft: 8 }}>
              {statusLabels[importResult.apiStatus].text}
            </Tag>
          )}
          {importResult.apiMessage && (
            <span style={{ color: '#9ca3af', marginLeft: 4, fontSize: 12 }}>({importResult.apiMessage})</span>
          )}
        </div>
        {importResult.datasetResults?.length > 0 && (
          <div>
            <span style={{ fontWeight: 500, fontSize: 13 }}>数据集：</span>
            <div style={{ marginTop: 4 }}>
              {importResult.datasetResults.map(ds => (
                <div key={ds.originalName} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, padding: '2px 0' }}>
                  <span>{ds.originalName}</span>
                  {ds.finalName !== ds.originalName && (
                    <span style={{ color: '#6366f1' }}>→ {ds.finalName}</span>
                  )}
                  {statusLabels[ds.status] && (
                    <Tag color={statusLabels[ds.status].color} icon={statusLabels[ds.status].icon} style={{ fontSize: 11 }}>
                      {statusLabels[ds.status].text}
                    </Tag>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h2>接口管理</h2>
          <div className="page-subtitle">注册和管理需要测试的 API 接口</div>
        </div>
        <Space>
          <Button icon={<UploadOutlined />} onClick={openImportShare}>
            导入分享
          </Button>
          <Button icon={<ImportOutlined />} onClick={openImportModal}>
            cURL 导入
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            注册接口
          </Button>
        </Space>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <Input
          placeholder="搜索接口名称、URL 或描述"
          prefix={<SearchOutlined style={{ color: '#a5b4fc' }} />}
          value={keyword}
          onChange={e => setKeyword(e.target.value)}
          allowClear
          style={{ width: 320 }}
        />
        <Select
          placeholder="HTTP 方法"
          value={methodFilter}
          onChange={v => setMethodFilter(v)}
          allowClear
          style={{ width: 140 }}
          options={[
            { value: 'GET', label: <Tag style={{ background: methodColors.GET + '18', color: methodColors.GET, border: 'none', margin: 0 }}>GET</Tag> },
            { value: 'POST', label: <Tag style={{ background: methodColors.POST + '18', color: methodColors.POST, border: 'none', margin: 0 }}>POST</Tag> },
            { value: 'PUT', label: <Tag style={{ background: methodColors.PUT + '18', color: methodColors.PUT, border: 'none', margin: 0 }}>PUT</Tag> },
            { value: 'DELETE', label: <Tag style={{ background: methodColors.DELETE + '18', color: methodColors.DELETE, border: 'none', margin: 0 }}>DELETE</Tag> },
          ]}
        />
        <span style={{ color: '#9ca3af', fontSize: 13, marginLeft: 'auto' }}>
          共 {filteredApis.length} 个接口{keyword || methodFilter ? `（已筛选，共 ${apis.length} 个）` : ''}
        </span>
      </div>

      <Table
        size="small"
        columns={columns}
        dataSource={filteredApis}
        rowKey="id"
        loading={loading}
        pagination={{
          defaultPageSize: 15,
          showSizeChanger: true,
          pageSizeOptions: ['10', '15', '30', '50'],
          showQuickJumper: true,
          showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 个接口`,
        }}
      />

      {/* 注册/编辑接口 Modal */}
      <Modal
        title={editing ? '编辑接口' : '注册接口'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
        width={680}
        okText="保存"
        cancelText="取消"
        styles={{ body: { maxHeight: '70vh', overflowY: 'auto', paddingRight: 8 } }}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="name" label="接口名称" rules={[{ required: true, message: '请输入接口名称' }]}>
            <Input placeholder="例如：Agent 同步对话" />
          </Form.Item>
          <Space style={{ width: '100%' }} size={16}>
            <Form.Item name="method" label="HTTP 方法" rules={[{ required: true }]} style={{ width: 140 }}>
              <Select options={[
                { value: 'GET' }, { value: 'POST' }, { value: 'PUT' }, { value: 'DELETE' },
              ]} />
            </Form.Item>
            <Form.Item name="url" label="请求 URL" rules={[{ required: true, message: '请输入 URL' }]}
                       style={{ flex: 1, minWidth: 400 }}>
              <Input placeholder="http://localhost:8080/agent/chat-sync" />
            </Form.Item>
          </Space>
          <Form.Item name="responseType" label="响应类型">
            <Select options={[
              { value: 'json', label: 'JSON' },
              { value: 'sse', label: 'SSE (流式)' },
            ]} />
          </Form.Item>
          <Form.Item name="headers" label="请求头 (JSON)">
            <TextArea rows={3} className="json-editor"
                      placeholder='{"Content-Type": "application/json"}' />
          </Form.Item>
          <Form.Item name="bodySchema" label="请求体结构 (JSON Schema)"
                     extra="定义字段名、类型和是否必填">
            <TextArea rows={6} className="json-editor" placeholder="{}" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <TextArea rows={2} placeholder="接口的用途说明" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 接口详情 Drawer */}
      <Drawer
        title="接口详情"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width={560}
      >
        {viewing && (
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="ID">{viewing.id}</Descriptions.Item>
            <Descriptions.Item label="名称">{viewing.name}</Descriptions.Item>
            <Descriptions.Item label="方法">
              <Tag className="method-tag"
                   style={{ background: methodColors[viewing.method] + '18', color: methodColors[viewing.method] }}>
                {viewing.method}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="URL">{viewing.url}</Descriptions.Item>
            <Descriptions.Item label="响应类型">{viewing.responseType?.toUpperCase()}</Descriptions.Item>
            <Descriptions.Item label="描述">{viewing.description || '-'}</Descriptions.Item>
            <Descriptions.Item label="请求头">
              <pre style={{ margin: 0, fontSize: 12, fontFamily: "'JetBrains Mono', monospace" }}>
                {JSON.stringify(viewing.headers, null, 2)}
              </pre>
            </Descriptions.Item>
            <Descriptions.Item label="请求体结构">
              <pre style={{ margin: 0, fontSize: 12, fontFamily: "'JetBrains Mono', monospace" }}>
                {JSON.stringify(viewing.bodySchema, null, 2)}
              </pre>
            </Descriptions.Item>
          </Descriptions>
        )}
      </Drawer>

      {/* cURL 导入 Modal */}
      <Modal
        title={
          <span style={{ fontWeight: 600 }}>
            <ImportOutlined style={{ marginRight: 8, color: '#6366f1' }} />
            从 cURL 导入
          </span>
        }
        open={importModalOpen}
        onCancel={() => setImportModalOpen(false)}
        width={700}
        footer={null}
        destroyOnClose
      >
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16, borderRadius: 8 }}
          message="在浏览器 DevTools → Network 中，右键点击请求 → Copy → Copy as cURL，然后粘贴到下方"
        />
        <TextArea
          rows={8}
          value={curlText}
          onChange={e => { setCurlText(e.target.value); setCurlPreview(null) }}
          placeholder={`curl 'https://api.example.com/v1/chat' \\
  -X POST \\
  -H 'Content-Type: application/json' \\
  -H 'Authorization: Bearer sk-xxx' \\
  --data-raw '{"model":"gpt-4","messages":[{"role":"user","content":"hello"}]}'`}
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 12,
            background: '#1e1e2e',
            color: '#cdd6f4',
            border: '1px solid #313244',
            borderRadius: 10,
          }}
        />

        {renderCurlPreview()}

        <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button
            icon={<ThunderboltOutlined />}
            onClick={handleParseCurl}
            loading={curlParsing}
            disabled={!curlText.trim()}
          >
            解析预览
          </Button>
          <Button
            type="primary"
            icon={<ImportOutlined />}
            onClick={handleImportCurl}
            loading={curlImporting}
            disabled={!curlPreview}
          >
            确认导入
          </Button>
        </div>
      </Modal>

      {/* 导入分享文件 Modal */}
      <Modal
        title={
          <span style={{ fontWeight: 600 }}>
            <UploadOutlined style={{ marginRight: 8, color: '#6366f1' }} />
            导入分享文件
          </span>
        }
        open={importShareOpen}
        onCancel={() => setImportShareOpen(false)}
        width={640}
        footer={importResult ? (
          <Button type="primary" onClick={() => setImportShareOpen(false)}>完成</Button>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={() => setImportShareOpen(false)}>取消</Button>
            <Button
              type="primary"
              icon={<ImportOutlined />}
              loading={importLoading}
              disabled={!importPreview}
              onClick={handleImportShare}
            >
              确认导入
            </Button>
          </div>
        )}
        destroyOnClose
      >
        {!importResult && (
          <>
            <Dragger
              accept=".json"
              showUploadList={false}
              beforeUpload={handleFileSelected}
              style={{ borderRadius: 10 }}
            >
              <p className="ant-upload-drag-icon">
                <InboxOutlined style={{ color: '#6366f1' }} />
              </p>
              <p className="ant-upload-text">
                {importFile ? `已选择: ${importFile.name}` : '点击或拖拽分享文件到此处'}
              </p>
              <p className="ant-upload-hint">
                支持 .agenttest.json 格式的分享文件
              </p>
            </Dragger>
            {renderImportPreview()}
          </>
        )}
        {renderImportResult()}
      </Modal>
    </>
  )
}
