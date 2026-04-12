import React, { useState, useEffect, useMemo } from 'react'
import {
  Table, Button, Modal, Form, Input, Select, Space, Tag, Popconfirm, message,
  Descriptions, Drawer, Tooltip
} from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, EyeOutlined, SearchOutlined } from '@ant-design/icons'
import { apiApis } from '../api'

const { TextArea } = Input

const methodColors = {
  GET: '#22c55e', POST: '#6366f1', PUT: '#f59e0b', DELETE: '#ef4444',
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
      // 表单验证失败，Ant Design 会自动显示字段错误提示
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
      render: (v) => <span style={{ color: '#6b7280', fontSize: 13 }}>{v}</span>,
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
      width: 140,
      render: (_, record) => (
        <Space size={4}>
          <Tooltip title="查看">
            <Button type="text" size="small" icon={<EyeOutlined />} onClick={() => openView(record)} />
          </Tooltip>
          <Tooltip title="编辑">
            <Button type="text" size="small" icon={<EditOutlined />} onClick={() => openEdit(record)} />
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

  return (
    <>
      <div className="page-header">
        <div>
          <h2>接口管理</h2>
          <div className="page-subtitle">注册和管理需要测试的 API 接口</div>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
          注册接口
        </Button>
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
    </>
  )
}
