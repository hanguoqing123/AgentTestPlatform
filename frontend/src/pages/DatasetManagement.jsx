import React, { useState, useEffect, useMemo } from 'react'
import {
  Table, Button, Modal, Form, Input, Select, Space, Tag, Popconfirm,
  message, Drawer, Typography, Empty, Segmented, InputNumber, Alert, Spin
} from 'antd'
import {
  PlusOutlined, DeleteOutlined, EyeOutlined, ApiOutlined,
  RobotOutlined, EditOutlined, ThunderboltOutlined, SearchOutlined
} from '@ant-design/icons'
import { datasetApis, apiApis, generateApis } from '../api'
import dayjs from 'dayjs'

const { TextArea } = Input
const { Text } = Typography

const methodColors = {
  GET: '#22c55e', POST: '#6366f1', PUT: '#f59e0b', DELETE: '#ef4444',
}

export default function DatasetManagement({ active }) {
  const [datasets, setDatasets] = useState([])
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
    } catch {
      message.error('加载数据集失败')
    }
    setLoading(false)
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

  const openCreate = () => {
    form.resetFields()
    if (selectedApiId) {
      form.setFieldsValue({ apiId: selectedApiId })
    }
    form.setFieldsValue({ data: '[\n  \n]', count: 10 })
    setInputMode(llmConfigured ? 'ai' : 'manual')
    setModalOpen(true)
  }

  const openView = async (record) => {
    try {
      const { data } = await datasetApis.get(record.name)
      setViewingMeta(data.meta)
      setViewingData(data.data)
      setDrawerOpen(true)
    } catch {
      message.error('加载数据集详情失败')
    }
  }

  // AI 生成测试数据
  const handleGenerate = async () => {
    try {
      const apiId = form.getFieldValue('apiId')
      const scenario = form.getFieldValue('scenario')
      const count = form.getFieldValue('count') || 10

      if (!apiId) {
        message.warning('请先选择所属接口')
        return
      }

      setGenerating(true)
      const { data } = await generateApis.generate({ apiId, scenario, count })

      // 将生成的数据填入编辑框
      form.setFieldsValue({
        data: JSON.stringify(data.data, null, 2),
      })
      message.success(`成功生成 ${data.count} 条测试数据，请检查后保存`)
    } catch (e) {
      const errMsg = e.response?.data?.error || e.message || '生成失败'
      message.error(errMsg)
    } finally {
      setGenerating(false)
    }
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      let parsedData
      try {
        parsedData = JSON.parse(values.data)
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

      await datasetApis.create({
        name: values.name,
        apiId: values.apiId,
        description: values.description,
        data: parsedData,
      })
      message.success('创建成功')
      setModalOpen(false)
      loadDatasets(selectedApiId)
    } catch {
      // validation error
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
      width: 100,
      render: (_, record) => (
        <Space size={4}>
          <Button type="text" size="small" icon={<EyeOutlined />} onClick={() => openView(record)} />
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
        onCancel={() => setModalOpen(false)}
        width={760}
        okText="保存数据集"
        cancelText="取消"
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
          <Form.Item name="name" label="数据集名称" rules={[
            { required: true, message: '请输入数据集名称' },
            { pattern: /^[a-zA-Z0-9\u4e00-\u9fa5_-]+$/, message: '仅支持中英文、数字、下划线、横线' },
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
                    <InputNumber min={1} max={100} disabled={!llmConfigured} style={{ width: 120 }} />
                  </Form.Item>
                  <Form.Item label=" " style={{ marginBottom: 0 }}>
                    <Button
                      type="primary"
                      icon={generating ? <Spin size="small" /> : <ThunderboltOutlined />}
                      onClick={handleGenerate}
                      loading={generating}
                      disabled={!llmConfigured}
                      style={{
                        background: llmConfigured ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : undefined,
                        border: 'none',
                        fontWeight: 600,
                      }}
                    >
                      {generating ? '生成中...' : 'AI 生成数据'}
                    </Button>
                  </Form.Item>
                </Space>
              </div>
            )}
          </div>

          <Form.Item name="data" label={
            <Space>
              <span>测试数据 (JSON 数组)</span>
              {inputMode === 'ai' && (
                <Tag style={{ background: '#ede9fe', color: '#7c3aed', border: 'none', fontSize: 11 }}>
                  AI 生成后可在此编辑调整
                </Tag>
              )}
            </Space>
          } rules={[{ required: true, message: '请输入或生成测试数据' }]}>
            <TextArea rows={14} className="json-editor"
                      placeholder={'[\n  {"content": "你好", "user_id": "test001"},\n  {"content": "帮我整理收藏", "user_id": "test002"}\n]'} />
          </Form.Item>
        </Form>
      </Modal>

      {/* ========== 详情 Drawer ========== */}
      <Drawer
        title="数据集详情"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width={640}
      >
        {viewingMeta && (
          <>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>{viewingMeta.name}</div>
              <Space wrap>
                <Tag style={{ background: '#ede9fe', color: '#7c3aed', border: 'none', fontWeight: 600 }}>
                  {viewingMeta.count} 条数据
                </Tag>
                {viewingMeta.apiId && apiMap[viewingMeta.apiId] && (
                  <Tag style={{ background: '#eef2ff', color: '#6366f1', border: 'none' }}>
                    {apiMap[viewingMeta.apiId]?.name}
                  </Tag>
                )}
              </Space>
              {viewingMeta.description && (
                <p style={{ marginTop: 8, color: '#6b7280', fontSize: 13 }}>{viewingMeta.description}</p>
              )}
            </div>
            {viewingData && viewingData.length > 0 ? (
              <pre style={{
                background: '#0f172a',
                color: '#e2e8f0',
                padding: 20,
                borderRadius: 12,
                fontSize: 12.5,
                maxHeight: 'calc(100vh - 260px)',
                overflow: 'auto',
                fontFamily: "'JetBrains Mono', monospace",
                lineHeight: 1.7,
              }}>
                {JSON.stringify(viewingData, null, 2)}
              </pre>
            ) : (
              <Empty description="暂无数据" />
            )}
          </>
        )}
      </Drawer>
    </>
  )
}
