import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import {
  Table, Button, Modal, Form, Input, Select, Space, Tag, Popconfirm,
  message, Drawer, Typography, Empty, Segmented, InputNumber, Alert, Spin,
  Tooltip, Divider, Progress
} from 'antd'
import {
  PlusOutlined, DeleteOutlined,
  RobotOutlined, EditOutlined, ThunderboltOutlined, SearchOutlined,
  SaveOutlined, PlusCircleOutlined, UndoOutlined, LoadingOutlined,
  CheckCircleOutlined
} from '@ant-design/icons'
import { datasetApis, apiApis, generateApis } from '../api'
import JsonEditor from '../components/JsonEditor'
import AiChatPanel from '../components/AiChatPanel'
import dayjs from 'dayjs'

const { TextArea } = Input
const { Text } = Typography

const methodColors = {
  GET: '#22c55e', POST: '#6366f1', PUT: '#f59e0b', DELETE: '#ef4444',
}

export default function DatasetManagement({ active }) {
  const [datasets, setDatasets] = useState([])
  const [allDatasetNames, setAllDatasetNames] = useState(new Set())
  const [apis, setApis] = useState([])
  const [loading, setLoading] = useState(false)
  const [selectedApiId, setSelectedApiId] = useState(null)
  const [keyword, setKeyword] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [viewingData, setViewingData] = useState(null)
  const [viewingMeta, setViewingMeta] = useState(null)
  const [inputMode, setInputMode] = useState('ai')       // 'ai' | 'manual'
  const [generating, setGenerating] = useState(false)
  const [llmConfigured, setLlmConfigured] = useState(false)
  const [form] = Form.useForm()

  // ===== 创建 Modal 中的 JSON 编辑器内容 =====
  const [createJsonText, setCreateJsonText] = useState('[\n  \n]')

  // ===== 编辑相关状态 =====
  const [editing, setEditing] = useState(false)
  const [editDescription, setEditDescription] = useState('')
  const [editDataText, setEditDataText] = useState('')
  const [saving, setSaving] = useState(false)
  const [appendMode, setAppendMode] = useState('manual')   // 'manual' | 'ai'
  const [appendModalOpen, setAppendModalOpen] = useState(false)
  const [appendText, setAppendText] = useState('[\n  \n]')
  const [appendScenario, setAppendScenario] = useState('')
  const [appendCount, setAppendCount] = useState(5)
  const [appendGenerating, setAppendGenerating] = useState(false)

  // ===== AI 生成进度状态（创建 & 追加共用结构） =====
  const [generateProgress, setGenerateProgress] = useState(null)      // 创建时的进度
  const [appendProgress, setAppendProgress] = useState(null)          // 追加时的进度
  const abortRef = useRef(null)          // 创建时的 abort 函数
  const appendAbortRef = useRef(null)    // 追加时的 abort 函数

  const loadApis = async () => {
    try {
      const { data } = await apiApis.list()
      setApis(data)
      return data
    } catch {
      message.error('加载接口列表失败')
      return []
    }
  }

  const loadDatasets = async (apiId) => {
    setLoading(true)
    try {
      const { data } = await datasetApis.list(apiId || undefined)
      setDatasets(data)
      // 如果是全量加载，同步更新全量名称集合
      if (!apiId) {
        setAllDatasetNames(new Set(data.map(d => d.name)))
      }
    } catch {
      message.error('加载数据集失败')
    }
    setLoading(false)
  }

  // 加载全部数据集名称（用于重名校验）
  const loadAllDatasetNames = async () => {
    try {
      const { data } = await datasetApis.list()
      setAllDatasetNames(new Set(data.map(d => d.name)))
    } catch {
      // ignore
    }
  }

  const checkLlmStatus = async () => {
    try {
      const { data } = await generateApis.status()
      setLlmConfigured(data.configured)
    } catch {
      setLlmConfigured(false)
    }
  }

  useEffect(() => {
    loadApis()
    loadDatasets()
    checkLlmStatus()
  }, [])

  // 切换到当前 tab 时自动刷新
  useEffect(() => {
    if (active) {
      loadApis()
      loadDatasets(selectedApiId)
    }
  }, [active])

  const handleApiFilter = (apiId) => {
    setSelectedApiId(apiId)
    loadDatasets(apiId)
  }

  const openCreate = async () => {
    // 打开前先刷新全量名称，确保校验数据最新
    await loadAllDatasetNames()
    form.resetFields()
    if (selectedApiId) {
      form.setFieldsValue({ apiId: selectedApiId })
    }
    form.setFieldsValue({ count: 10 })
    setCreateJsonText('[\n  \n]')
    setInputMode(llmConfigured ? 'ai' : 'manual')
    setGenerateProgress(null)
    setModalOpen(true)
  }

  const openView = async (record) => {
    try {
      const { data } = await datasetApis.get(record.name)
      setViewingMeta(data.meta)
      setViewingData(data.data)
      setEditing(false)
      setDrawerOpen(true)
    } catch {
      message.error('加载数据集详情失败')
    }
  }

  // ===== 进入编辑模式 =====
  const enterEdit = () => {
    setEditDescription(viewingMeta?.description || '')
    setEditDataText(JSON.stringify(viewingData || [], null, 2))
    setEditing(true)
  }

  // ===== 取消编辑 =====
  const cancelEdit = () => {
    setEditing(false)
  }

  // ===== 保存编辑 =====
  const handleSaveEdit = async () => {
    let parsedData
    try {
      parsedData = JSON.parse(editDataText)
      if (!Array.isArray(parsedData)) {
        message.error('数据必须是 JSON 数组')
        return
      }
    } catch {
      message.error('JSON 格式错误，请检查后重试')
      return
    }

    setSaving(true)
    try {
      await datasetApis.update(viewingMeta.name, {
        description: editDescription,
        data: parsedData,
        append: false,
      })
      message.success('保存成功')
      // 刷新详情和列表
      const { data } = await datasetApis.get(viewingMeta.name)
      setViewingMeta(data.meta)
      setViewingData(data.data)
      setEditing(false)
      loadDatasets(selectedApiId)
    } catch (e) {
      message.error('保存失败：' + (e.response?.data?.message || e.message))
    } finally {
      setSaving(false)
    }
  }

  // ===== 追加数据 =====
  const openAppendModal = () => {
    setAppendText('[\n  \n]')
    setAppendScenario('')
    setAppendCount(5)
    setAppendMode(llmConfigured ? 'ai' : 'manual')
    setAppendProgress(null)
    setAppendModalOpen(true)
  }

  /**
   * 根据后端推送的 progress 事件计算更真实的进度百分比。
   * phase: "preparing" → 5-10%, "streaming" → 10-85%, "parsing" → 85-95%, "done" → 95%
   * 多批模式下，每批占比 = 90% / totalBatches
   */
  const calcStreamingPercent = (p) => {
    if (p.totalBatches > 1) {
      // 多批：每批占一段区间
      const batchSpan = 90 / p.totalBatches
      const batchBase = 5 + (p.currentBatch - 1) * batchSpan
      if (p.phase === 'preparing') return Math.round(batchBase)
      if (p.phase === 'streaming') {
        // streaming 阶段：用 receivedChars 做对数曲线映射（0→10%, ∞→80% 在批内）
        const charProgress = Math.min(0.8, Math.log(1 + p.receivedChars / 100) / 5)
        return Math.round(batchBase + batchSpan * (0.1 + charProgress))
      }
      if (p.phase === 'parsing') return Math.round(batchBase + batchSpan * 0.9)
      if (p.phase === 'done') return Math.round(batchBase + batchSpan)
      return Math.round(batchBase + batchSpan * 0.5)
    }
    // 单批
    if (p.phase === 'preparing') return 5
    if (p.phase === 'streaming') {
      // 对数曲线：字符越多进度越慢增长，5% → 85%
      const charProgress = Math.min(0.95, Math.log(1 + p.receivedChars / 100) / 5)
      return Math.round(5 + 80 * charProgress)
    }
    if (p.phase === 'parsing') return 88
    if (p.phase === 'done') return 95
    return 50
  }

  // 追加 AI 生成 — 使用 SSE 流式接口
  const handleAppendAiGenerate = () => {
    if (!viewingMeta?.apiId) {
      message.warning('该数据集未关联接口，无法使用 AI 生成')
      return
    }

    setAppendGenerating(true)
    setAppendProgress({ message: '正在连接 AI 服务...', percent: 0 })

    const startTime = Date.now()
    const abort = generateApis.generateStream(
      { apiId: viewingMeta.apiId, scenario: appendScenario, count: appendCount },
      {
        onStart: (info) => {
          setAppendProgress({
            message: info.message,
            percent: 5,
            totalBatches: info.totalBatches,
            targetCount: info.targetCount,
          })
        },
        onProgress: (p) => {
          const percent = calcStreamingPercent(p)
          const elapsed = ((Date.now() - startTime) / 1000).toFixed(0)
          setAppendProgress({
            message: p.message,
            percent,
            currentBatch: p.currentBatch,
            totalBatches: p.totalBatches,
            generatedCount: p.generatedCount,
            targetCount: p.targetCount,
            receivedChars: p.receivedChars,
            phase: p.phase,
            elapsed,
          })
        },
        onComplete: (result) => {
          const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
          setAppendText(JSON.stringify(result.data, null, 2))
          setAppendProgress({
            message: `生成完成！共 ${result.count} 条数据，耗时 ${elapsed}s`,
            percent: 100,
            done: true,
          })
          message.success(`成功生成 ${result.count} 条数据，请确认后追加`)
          setAppendGenerating(false)
          setTimeout(() => setAppendProgress(null), 3000)
        },
        onError: (errMsg) => {
          message.error(errMsg || 'AI 生成失败')
          setAppendProgress(null)
          setAppendGenerating(false)
        },
      }
    )
    appendAbortRef.current = abort
  }

  // 取消追加时的生成
  const handleCancelAppendGenerate = () => {
    appendAbortRef.current?.()
    setAppendGenerating(false)
    setAppendProgress(null)
    message.info('已取消生成')
  }

  const handleAppendSubmit = async () => {
    let parsedData
    try {
      parsedData = JSON.parse(appendText)
      if (!Array.isArray(parsedData)) {
        message.error('数据必须是 JSON 数组')
        return
      }
      if (parsedData.length === 0) {
        message.error('追加数据不能为空')
        return
      }
    } catch {
      message.error('JSON 格式错误')
      return
    }

    setSaving(true)
    try {
      await datasetApis.update(viewingMeta.name, {
        data: parsedData,
        append: true,
      })
      message.success(`成功追加 ${parsedData.length} 条数据`)
      setAppendModalOpen(false)
      // 刷新详情
      const { data } = await datasetApis.get(viewingMeta.name)
      setViewingMeta(data.meta)
      setViewingData(data.data)
      // 如果在编辑模式下，同步更新编辑框
      if (editing) {
        setEditDataText(JSON.stringify(data.data, null, 2))
      }
      loadDatasets(selectedApiId)
    } catch (e) {
      message.error('追加失败：' + (e.response?.data?.message || e.message))
    } finally {
      setSaving(false)
    }
  }

  // AI 生成测试数据（创建时） — 使用 SSE 流式接口
  const handleGenerate = () => {
    const apiId = form.getFieldValue('apiId')
    const scenario = form.getFieldValue('scenario')
    const count = form.getFieldValue('count') || 10

    if (!apiId) {
      message.warning('请先选择所属接口')
      return
    }

    setGenerating(true)
    setGenerateProgress({ message: '正在连接 AI 服务...', percent: 0 })

    const startTime = Date.now()
    const abort = generateApis.generateStream(
      { apiId, scenario, count },
      {
        onStart: (info) => {
          setGenerateProgress({
            message: info.message,
            percent: 5,
            totalBatches: info.totalBatches,
            targetCount: info.targetCount,
          })
        },
        onProgress: (p) => {
          const percent = calcStreamingPercent(p)
          const elapsed = ((Date.now() - startTime) / 1000).toFixed(0)
          setGenerateProgress({
            message: p.message,
            percent,
            currentBatch: p.currentBatch,
            totalBatches: p.totalBatches,
            generatedCount: p.generatedCount,
            targetCount: p.targetCount,
            receivedChars: p.receivedChars,
            phase: p.phase,
            elapsed,
          })
        },
        onComplete: (result) => {
          const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
          setCreateJsonText(JSON.stringify(result.data, null, 2))
          setGenerateProgress({
            message: `生成完成！共 ${result.count} 条数据，耗时 ${elapsed}s`,
            percent: 100,
            done: true,
          })
          message.success(`成功生成 ${result.count} 条测试数据，请检查后保存`)
          setGenerating(false)
          setTimeout(() => setGenerateProgress(null), 3000)
        },
        onError: (errMsg) => {
          message.error(errMsg || 'AI 生成失败')
          setGenerateProgress(null)
          setGenerating(false)
        },
      }
    )
    abortRef.current = abort
  }

  // 取消创建时的生成
  const handleCancelGenerate = () => {
    abortRef.current?.()
    setGenerating(false)
    setGenerateProgress(null)
    message.info('已取消生成')
  }

  const handleSubmit = async () => {
    let values
    try {
      values = await form.validateFields()
    } catch {
      return // 表单验证失败
    }

    let parsedData
    try {
      parsedData = JSON.parse(createJsonText)
      if (!Array.isArray(parsedData)) {
        message.error('数据必须是 JSON 数组')
        return
      }
      if (parsedData.length === 0) {
        message.error('数据不能为空')
        return
      }
    } catch {
      message.error('JSON 格式错误')
      return
    }

    try {
      await datasetApis.create({
        name: values.name,
        apiId: values.apiId,
        description: values.description,
        data: parsedData,
      })
      message.success('创建成功')
      setModalOpen(false)
      loadDatasets(selectedApiId)
    } catch (e) {
      message.error(e.response?.data?.message || '创建失败：' + (e.message || '未知错误'))
    }
  }

  const handleDelete = async (name) => {
    try {
      await datasetApis.delete(name)
      message.success('删除成功')
      loadDatasets(selectedApiId)
    } catch {
      message.error('删除失败')
    }
  }

  const apiMap = {}
  apis.forEach(a => { apiMap[a.id] = a })

  // 前端关键词筛选
  const filteredDatasets = useMemo(() => {
    if (!keyword.trim()) return datasets
    const kw = keyword.trim().toLowerCase()
    return datasets.filter(d =>
      (d.name || '').toLowerCase().includes(kw) ||
      (d.description || '').toLowerCase().includes(kw)
    )
  }, [datasets, keyword])

  const columns = [
    {
      title: '数据集名称',
      dataIndex: 'name',
      key: 'name',
      ellipsis: true,
      render: (v, record) => (
        <a onClick={() => openView(record)} style={{ fontWeight: 500, fontSize: 13 }}>{v}</a>
      ),
    },
    {
      title: '所属接口',
      dataIndex: 'apiId',
      key: 'apiId',
      width: 220,
      render: (v) => {
        const api = apiMap[v]
        if (!api) return <span style={{ color: '#d1d5db' }}>-</span>
        return (
          <Space size={4}>
            <Tag className="method-tag"
                 style={{ background: methodColors[api.method] + '18', color: methodColors[api.method] }}>
              {api.method}
            </Tag>
            <span style={{ fontSize: 13 }}>{api.name}</span>
          </Space>
        )
      },
    },
    {
      title: '数据条数',
      dataIndex: 'count',
      key: 'count',
      width: 100,
      render: (v) => (
        <Tag style={{ background: '#ede9fe', color: '#7c3aed', border: 'none', fontWeight: 600 }}>
          {v} 条
        </Tag>
      ),
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      render: (v) => <span style={{ color: '#9ca3af' }}>{v || '-'}</span>,
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 170,
      render: (v) => (
        <span style={{ color: '#9ca3af', fontSize: 13 }}>
          {v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '-'}
        </span>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 120,
      render: (_, record) => (
        <Space size={4}>
          <Tooltip title="查看 / 编辑">
            <Button type="text" size="small" icon={<EditOutlined />} onClick={() => openView(record)} />
          </Tooltip>
          <Popconfirm title="确认删除此数据集？" onConfirm={() => handleDelete(record.name)}
                      okText="删除" cancelText="取消">
            <Button type="text" size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <>
      <div className="page-header">
        <div>
          <h2>数据集管理</h2>
          <div className="page-subtitle">管理各接口的测试数据集</div>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
          创建数据集
        </Button>
      </div>

      <div className="filter-bar">
        <Input
          placeholder="搜索数据集名称 / 描述"
          allowClear
          value={keyword}
          onChange={e => setKeyword(e.target.value)}
          style={{ width: 220 }}
          prefix={<SearchOutlined style={{ color: '#a5b4fc' }} />}
        />
        <Select
          allowClear
          placeholder="全部接口"
          value={selectedApiId}
          onChange={handleApiFilter}
          style={{ minWidth: 260 }}
          options={apis.map(a => ({
            value: a.id,
            label: `${a.name}  (${a.method} ${a.url})`,
          }))}
        />
        {(selectedApiId || keyword) && (
          <Tag style={{ marginLeft: 'auto', background: '#f0fdf4', color: '#16a34a', border: 'none' }}>
            筛选出 {filteredDatasets.length} 个数据集
          </Tag>
        )}
      </div>

      <Table
        size="small"
        columns={columns}
        dataSource={filteredDatasets}
        rowKey="name"
        loading={loading}
        pagination={{
          defaultPageSize: 10,
          showTotal: (t, range) => `第 ${range[0]}-${range[1]} 条，共 ${t} 个数据集`,
          showSizeChanger: true,
          pageSizeOptions: ['10', '20', '50'],
          showQuickJumper: true,
        }}
      />

      {/* ========== 创建数据集 Modal ========== */}
      <Modal
        title="创建数据集"
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => { abortRef.current?.(); setGenerating(false); setGenerateProgress(null); setModalOpen(false) }}
        width={1100}
        okText="保存数据集"
        cancelText="取消"
        destroyOnClose
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="apiId" label="所属接口" rules={[{ required: true, message: '请选择所属接口' }]}>
            <Select
              placeholder="选择该数据集所属的接口"
              showSearch
              optionFilterProp="label"
              options={apis.map(a => ({
                value: a.id,
                label: `${a.name}  (${a.method} ${a.url})`,
              }))}
            />
          </Form.Item>
          <Form.Item name="name" label="数据集名称"
            validateTrigger={['onChange', 'onBlur']}
            rules={[
              { required: true, message: '请输入数据集名称' },
              { pattern: /^[a-zA-Z0-9\u4e00-\u9fa5_-]+$/, message: '仅支持中英文、数字、下划线、横线' },
              {
                validator: (_, value) => {
                  if (value && allDatasetNames.has(value)) {
                    return Promise.reject('该名称已存在，请换一个')
                  }
                  return Promise.resolve()
                },
              },
            ]}
            extra="唯一标识，例如：正常场景测试、边界值测试">
            <Input placeholder="例如：正常场景测试" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input placeholder="数据集用途描述" />
          </Form.Item>

          {/* 数据输入方式切换 */}
          <div style={{ marginBottom: 16 }}>
            <Segmented
              value={inputMode}
              onChange={setInputMode}
              options={[
                {
                  value: 'ai',
                  icon: <RobotOutlined />,
                  label: 'AI 生成',
                },
                {
                  value: 'manual',
                  icon: <EditOutlined />,
                  label: '手动输入',
                },
              ]}
              style={{ marginBottom: 16 }}
            />

            {inputMode === 'ai' && (
              <div style={{
                padding: 20,
                background: 'linear-gradient(135deg, #fafafe 0%, #f5f3ff 100%)',
                borderRadius: 12,
                border: '1px solid #ede9fe',
                marginBottom: 16,
              }}>
                {!llmConfigured && (
                  <Alert
                    type="warning"
                    message="大模型 API 未配置"
                    description="请在 application.yml 中配置 app.llm.api-key 和 app.llm.api-url 后重启服务"
                    showIcon
                    style={{ marginBottom: 16, borderRadius: 8 }}
                  />
                )}
                <Form.Item name="scenario" label="场景描述"
                  extra="描述你想要模拟的测试场景，AI 会据此生成贴合业务的数据">
                  <TextArea rows={2}
                    placeholder="例如：模拟用户整理收藏夹，包含不同类型的笔记分类请求"
                    disabled={!llmConfigured} />
                </Form.Item>
                <Space>
                  <Form.Item name="count" label="生成数量" style={{ marginBottom: 0 }}>
                    <InputNumber min={1} max={100} disabled={!llmConfigured || generating} style={{ width: 120 }} />
                  </Form.Item>
                  <Form.Item label=" " style={{ marginBottom: 0 }}>
                    {!generating ? (
                      <Button
                        type="primary"
                        icon={<ThunderboltOutlined />}
                        onClick={handleGenerate}
                        disabled={!llmConfigured}
                        style={{
                          background: llmConfigured ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : undefined,
                          border: 'none',
                          fontWeight: 600,
                        }}
                      >
                        AI 生成数据
                      </Button>
                    ) : (
                      <Button danger onClick={handleCancelGenerate}>
                        取消生成
                      </Button>
                    )}
                  </Form.Item>
                </Space>

                {/* 生成进度提示 */}
                {generateProgress && (
                  <div style={{
                    marginTop: 16,
                    padding: '12px 16px',
                    background: generateProgress.done ? '#f0fdf4' : '#f0f9ff',
                    borderRadius: 10,
                    border: `1px solid ${generateProgress.done ? '#bbf7d0' : '#bae6fd'}`,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      {generateProgress.done
                        ? <CheckCircleOutlined style={{ color: '#16a34a', fontSize: 14 }} />
                        : <LoadingOutlined style={{ color: '#6366f1', fontSize: 14 }} />
                      }
                      <span style={{
                        fontSize: 13,
                        color: generateProgress.done ? '#16a34a' : '#374151',
                        fontWeight: 500,
                      }}>
                        {generateProgress.message}
                      </span>
                      {generateProgress.elapsed && !generateProgress.done && (
                        <span style={{ fontSize: 12, color: '#9ca3af', marginLeft: 'auto' }}>
                          已耗时 {generateProgress.elapsed}s
                        </span>
                      )}
                    </div>
                    <Progress
                      percent={generateProgress.percent}
                      size="small"
                      showInfo={false}
                      strokeColor={generateProgress.done
                        ? '#16a34a'
                        : { from: '#6366f1', to: '#8b5cf6' }
                      }
                      trailColor={generateProgress.done ? '#dcfce7' : '#e8e0ff'}
                    />
                    {!generateProgress.done && (
                      <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 4, display: 'flex', justifyContent: 'space-between' }}>
                        <span>
                          {generateProgress.totalBatches > 1 && (
                            <>已完成 {generateProgress.generatedCount || 0} / {generateProgress.targetCount} 条
                              {generateProgress.currentBatch && (
                                <span style={{ marginLeft: 8 }}>
                                  (第 {generateProgress.currentBatch}/{generateProgress.totalBatches} 批)
                                </span>
                              )}
                            </>
                          )}
                        </span>
                        {generateProgress.phase === 'streaming' && generateProgress.receivedChars > 0 && (
                          <span style={{ color: '#a5b4fc' }}>
                            已接收 {generateProgress.receivedChars >= 1000
                              ? (generateProgress.receivedChars / 1000).toFixed(1) + 'k'
                              : generateProgress.receivedChars} 字符
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <div>
            <div style={{ marginBottom: 8 }}>
              <Space>
                <span style={{ fontWeight: 500 }}>测试数据 (JSON 数组)</span>
                {inputMode === 'ai' && (
                  <Tag style={{ background: '#ede9fe', color: '#7c3aed', border: 'none', fontSize: 11 }}>
                    AI 生成后可在此编辑调整，或通过右侧 AI 助手对话修改
                  </Tag>
                )}
              </Space>
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <JsonEditor
                  value={createJsonText}
                  onChange={setCreateJsonText}
                  height={320}
                />
              </div>
              <div style={{ width: 300, flexShrink: 0 }}>
                <AiChatPanel
                  getCurrentData={() => createJsonText}
                  onApplyData={(newText) => setCreateJsonText(newText)}
                  disabled={!llmConfigured}
                />
              </div>
            </div>
          </div>
        </Form>
      </Modal>

      {/* ========== 详情 / 编辑 Drawer ========== */}
      <Drawer
        title={
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
            <span>{editing ? '编辑数据集' : '数据集详情'}</span>
            {editing && (
              <Tag style={{ background: '#fef3c7', color: '#d97706', border: 'none', fontWeight: 500 }}>
                编辑中
              </Tag>
            )}
          </div>
        }
        open={drawerOpen}
        onClose={() => { setDrawerOpen(false); setEditing(false) }}
        width={editing ? 1060 : 720}
        destroyOnClose
        extra={
          <Space>
            {!editing ? (
              <>
                <Button icon={<PlusCircleOutlined />} onClick={openAppendModal}>
                  追加数据
                </Button>
                <Button type="primary" icon={<EditOutlined />} onClick={enterEdit}>
                  编辑
                </Button>
              </>
            ) : (
              <>
                <Button icon={<UndoOutlined />} onClick={cancelEdit}>
                  取消
                </Button>
                <Button type="primary" icon={<SaveOutlined />} onClick={handleSaveEdit} loading={saving}>
                  保存
                </Button>
              </>
            )}
          </Space>
        }
      >
        {viewingMeta && (
          <>
            {/* 元信息区域 */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                <div style={{ fontSize: 16, fontWeight: 600 }}>{viewingMeta.name}</div>
                <Tag style={{ background: '#ede9fe', color: '#7c3aed', border: 'none', fontWeight: 600 }}>
                  {viewingMeta.count} 条数据
                </Tag>
                {viewingMeta.apiId && apiMap[viewingMeta.apiId] && (
                  <Tag style={{ background: '#eef2ff', color: '#6366f1', border: 'none' }}>
                    {apiMap[viewingMeta.apiId]?.name}
                  </Tag>
                )}
              </div>

              {!editing ? (
                // 查看模式：展示描述
                viewingMeta.description && (
                  <p style={{ margin: 0, color: '#6b7280', fontSize: 13 }}>{viewingMeta.description}</p>
                )
              ) : (
                // 编辑模式：可编辑描述
                <div style={{ marginTop: 8 }}>
                  <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 4 }}>描述</div>
                  <Input
                    value={editDescription}
                    onChange={e => setEditDescription(e.target.value)}
                    placeholder="数据集用途描述"
                  />
                </div>
              )}

              {viewingMeta.updatedAt && (
                <div style={{ marginTop: 8, fontSize: 12, color: '#b0b8c4' }}>
                  最后更新: {dayjs(viewingMeta.updatedAt).format('YYYY-MM-DD HH:mm:ss')}
                </div>
              )}
            </div>

            <Divider style={{ margin: '0 0 16px' }} />

            {/* 数据区域 */}
            {!editing ? (
              // ===== 查看模式：只读 Monaco =====
              viewingData && viewingData.length > 0 ? (
                <JsonEditor
                  value={JSON.stringify(viewingData, null, 2)}
                  readOnly
                  height="calc(100vh - 320px)"
                  minimap={viewingData.length > 20}
                />
              ) : (
                <Empty description="暂无数据" />
              )
            ) : (
              // ===== 编辑模式 =====
              <div>
                <div style={{ marginBottom: 8 }}>
                  <Space>
                    <span style={{ fontSize: 13, color: '#6b7280', fontWeight: 500 }}>
                      测试数据 (JSON 数组)
                    </span>
                    <Tag style={{ background: '#ede9fe', color: '#7c3aed', border: 'none', fontSize: 11 }}>
                      可通过右侧 AI 助手对话修改数据
                    </Tag>
                  </Space>
                </div>
                <div style={{ display: 'flex', gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <JsonEditor
                      value={editDataText}
                      onChange={setEditDataText}
                      height="calc(100vh - 360px)"
                      minimap={true}
                    />
                  </div>
                  <div style={{ width: 300, flexShrink: 0 }}>
                    <AiChatPanel
                      getCurrentData={() => editDataText}
                      onApplyData={(newText) => setEditDataText(newText)}
                      disabled={!llmConfigured}
                    />
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </Drawer>

      {/* ========== 追加数据 Modal ========== */}
      <Modal
        title={
          <Space>
            <PlusCircleOutlined style={{ color: '#6366f1' }} />
            <span>追加数据到「{viewingMeta?.name}」</span>
          </Space>
        }
        open={appendModalOpen}
        onCancel={() => { appendAbortRef.current?.(); setAppendGenerating(false); setAppendProgress(null); setAppendModalOpen(false) }}
        onOk={handleAppendSubmit}
        confirmLoading={saving}
        width={700}
        okText="确认追加"
        cancelText="取消"
        destroyOnClose
      >
        <div style={{ marginTop: 16 }}>
          <div style={{ marginBottom: 12 }}>
            <Tag style={{ background: '#eef2ff', color: '#6366f1', border: 'none' }}>
              当前已有 {viewingMeta?.count || 0} 条数据
            </Tag>
          </div>

          <Segmented
            value={appendMode}
            onChange={setAppendMode}
            options={[
              { value: 'ai', icon: <RobotOutlined />, label: 'AI 生成' },
              { value: 'manual', icon: <EditOutlined />, label: '手动输入' },
            ]}
            style={{ marginBottom: 16 }}
          />

          {appendMode === 'ai' && (
            <div style={{
              padding: 20,
              background: 'linear-gradient(135deg, #fafafe 0%, #f5f3ff 100%)',
              borderRadius: 12,
              border: '1px solid #ede9fe',
              marginBottom: 16,
            }}>
              {!llmConfigured && (
                <Alert
                  type="warning"
                  message="大模型 API 未配置"
                  showIcon
                  style={{ marginBottom: 16, borderRadius: 8 }}
                />
              )}
              {!viewingMeta?.apiId && (
                <Alert
                  type="info"
                  message="该数据集未关联接口，无法使用 AI 生成"
                  showIcon
                  style={{ marginBottom: 16, borderRadius: 8 }}
                />
              )}
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 4 }}>场景描述</div>
                <TextArea
                  rows={2}
                  value={appendScenario}
                  onChange={e => setAppendScenario(e.target.value)}
                  placeholder="描述想追加的测试场景，例如：边界值场景、异常输入"
                  disabled={!llmConfigured || !viewingMeta?.apiId}
                />
              </div>
              <Space>
                <div>
                  <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 4 }}>生成数量</div>
                  <InputNumber
                    min={1} max={100}
                    value={appendCount}
                    onChange={setAppendCount}
                    disabled={!llmConfigured || !viewingMeta?.apiId || appendGenerating}
                    style={{ width: 120 }}
                  />
                </div>
                <div style={{ paddingTop: 22 }}>
                  {!appendGenerating ? (
                    <Button
                      type="primary"
                      icon={<ThunderboltOutlined />}
                      onClick={handleAppendAiGenerate}
                      disabled={!llmConfigured || !viewingMeta?.apiId}
                      style={{
                        background: (llmConfigured && viewingMeta?.apiId) ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : undefined,
                        border: 'none',
                        fontWeight: 600,
                      }}
                    >
                      AI 生成
                    </Button>
                  ) : (
                    <Button danger onClick={handleCancelAppendGenerate}>
                      取消生成
                    </Button>
                  )}
                </div>
              </Space>

              {/* 追加生成进度提示 */}
              {appendProgress && (
                <div style={{
                  marginTop: 16,
                  padding: '12px 16px',
                  background: appendProgress.done ? '#f0fdf4' : '#f0f9ff',
                  borderRadius: 10,
                  border: `1px solid ${appendProgress.done ? '#bbf7d0' : '#bae6fd'}`,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    {appendProgress.done
                      ? <CheckCircleOutlined style={{ color: '#16a34a', fontSize: 14 }} />
                      : <LoadingOutlined style={{ color: '#6366f1', fontSize: 14 }} />
                    }
                    <span style={{
                      fontSize: 13,
                      color: appendProgress.done ? '#16a34a' : '#374151',
                      fontWeight: 500,
                    }}>
                      {appendProgress.message}
                    </span>
                    {appendProgress.elapsed && !appendProgress.done && (
                      <span style={{ fontSize: 12, color: '#9ca3af', marginLeft: 'auto' }}>
                        已耗时 {appendProgress.elapsed}s
                      </span>
                    )}
                  </div>
                  <Progress
                    percent={appendProgress.percent}
                    size="small"
                    showInfo={false}
                    strokeColor={appendProgress.done
                      ? '#16a34a'
                      : { from: '#6366f1', to: '#8b5cf6' }
                    }
                    trailColor={appendProgress.done ? '#dcfce7' : '#e8e0ff'}
                  />
                  {!appendProgress.done && (
                    <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 4, display: 'flex', justifyContent: 'space-between' }}>
                      <span>
                        {appendProgress.totalBatches > 1 && (
                          <>已完成 {appendProgress.generatedCount || 0} / {appendProgress.targetCount} 条
                            {appendProgress.currentBatch && (
                              <span style={{ marginLeft: 8 }}>
                                (第 {appendProgress.currentBatch}/{appendProgress.totalBatches} 批)
                              </span>
                            )}
                          </>
                        )}
                      </span>
                      {appendProgress.phase === 'streaming' && appendProgress.receivedChars > 0 && (
                        <span style={{ color: '#a5b4fc' }}>
                          已接收 {appendProgress.receivedChars >= 1000
                            ? (appendProgress.receivedChars / 1000).toFixed(1) + 'k'
                            : appendProgress.receivedChars} 字符
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 13, color: '#6b7280' }}>
                追加数据 (JSON 数组)
                {appendMode === 'ai' && (
                  <Tag style={{ background: '#ede9fe', color: '#7c3aed', border: 'none', fontSize: 11, marginLeft: 8 }}>
                    AI 生成后可编辑调整
                  </Tag>
                )}
              </span>
            </div>
            <JsonEditor
              value={appendText}
              onChange={setAppendText}
              height={280}
            />
          </div>
        </div>
      </Modal>
    </>
  )
}
