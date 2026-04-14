import React, { useState, useEffect, useMemo } from 'react'
import { Table, Button, Tag, Space, Popconfirm, message, Typography, Input, Select, DatePicker } from 'antd'
import { EyeOutlined, DeleteOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { reportApis } from '../api'
import dayjs from 'dayjs'

const { Text } = Typography
const { RangePicker } = DatePicker

const methodColors = {
  GET: '#22c55e', POST: '#6366f1', PUT: '#f59e0b', DELETE: '#ef4444',
}

const resultOptions = [
  { value: 'all', label: '全部结果' },
  { value: 'pass', label: '✅ 全部通过' },
  { value: 'partial', label: '⚠️ 部分失败' },
  { value: 'fail', label: '❌ 大量失败' },
]

export default function ReportList({ active }) {
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  // 搜索筛选
  const [keyword, setKeyword] = useState('')
  const [resultFilter, setResultFilter] = useState('all')
  const [dateRange, setDateRange] = useState(null)

  const load = async () => {
    setLoading(true)
    try {
      const { data } = await reportApis.list()
      setReports(data)
    } catch {
      message.error('加载报告列表失败')
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  useEffect(() => {
    if (active) load()
  }, [active])

  const handleDelete = async (id) => {
    try {
      await reportApis.delete(id)
      message.success('删除成功')
      load()
    } catch {
      message.error('删除失败')
    }
  }

  // 前端筛选
  const filteredReports = useMemo(() => {
    let list = [...reports]

    // 关键词搜索（匹配 报告ID、接口名、数据集名）
    if (keyword.trim()) {
      const kw = keyword.trim().toLowerCase()
      list = list.filter(r =>
        (r.id || '').toLowerCase().includes(kw) ||
        (r.apiName || '').toLowerCase().includes(kw) ||
        (r.datasetName || '').toLowerCase().includes(kw) ||
        (r.url || '').toLowerCase().includes(kw)
      )
    }

    // 结果筛选
    if (resultFilter !== 'all') {
      list = list.filter(r => {
        const rate = r.total > 0 ? (r.success / r.total) * 100 : 0
        if (resultFilter === 'pass') return r.failed === 0
        if (resultFilter === 'partial') return r.failed > 0 && rate >= 50
        if (resultFilter === 'fail') return rate < 50
        return true
      })
    }

    // 日期范围
    if (dateRange && dateRange[0] && dateRange[1]) {
      const start = dateRange[0].startOf('day')
      const end = dateRange[1].endOf('day')
      list = list.filter(r => {
        if (!r.startTime) return false
        const t = dayjs(r.startTime)
        return t.isAfter(start) && t.isBefore(end)
      })
    }

    return list
  }, [reports, keyword, resultFilter, dateRange])

  const columns = [
    {
      title: '报告 ID',
      dataIndex: 'id',
      key: 'id',
      width: 200,
      render: (v) => (
        <a onClick={() => navigate(`/reports/${v}`)} style={{ fontSize: 12, fontFamily: "'JetBrains Mono', monospace" }}>
          {v}
        </a>
      ),
    },
    {
      title: '接口',
      key: 'api',
      width: 220,
      render: (_, r) => (
        <Space size={4}>
          <Tag className="method-tag"
               style={{ background: (methodColors[r.method] || '#999') + '18', color: methodColors[r.method] }}>
            {r.method}
          </Tag>
          <span style={{ fontWeight: 500 }}>{r.apiName || r.apiId}</span>
        </Space>
      ),
    },
    {
      title: '数据集',
      dataIndex: 'datasetName',
      key: 'datasetName',
      width: 180,
      render: (v) => <span style={{ fontWeight: 500, fontSize: 13 }}>{v}</span>,
    },
    {
      title: '结果',
      key: 'result',
      width: 160,
      sorter: (a, b) => {
        const rateA = a.total > 0 ? a.success / a.total : 0
        const rateB = b.total > 0 ? b.success / b.total : 0
        return rateA - rateB
      },
      render: (_, r) => {
        const rate = r.total > 0 ? ((r.success / r.total) * 100).toFixed(0) : 0
        const color = r.failed === 0 ? '#22c55e' : rate >= 80 ? '#f59e0b' : '#ef4444'
        return (
          <Space>
            <Tag style={{ background: color + '18', color, border: 'none', fontWeight: 700 }}>
              {rate}%
            </Tag>
            <span style={{ fontSize: 12, color: '#9ca3af' }}>
              {r.success}/{r.total}
            </span>
          </Space>
        )
      },
    },
    {
      title: '平均响应',
      dataIndex: 'avgResponseTimeMs',
      key: 'avg',
      width: 110,
      sorter: (a, b) => (a.avgResponseTimeMs || 0) - (b.avgResponseTimeMs || 0),
      render: (v) => <span style={{ fontWeight: 500 }}>{v}ms</span>,
    },
    {
      title: '执行时间',
      dataIndex: 'startTime',
      key: 'startTime',
      width: 170,
      sorter: (a, b) => dayjs(a.startTime || 0).unix() - dayjs(b.startTime || 0).unix(),
      defaultSortOrder: 'descend',
      render: (v) => (
        <span style={{ color: '#9ca3af', fontSize: 13 }}>
          {v ? dayjs(v).format('YYYY-MM-DD HH:mm:ss') : '-'}
        </span>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 100,
      render: (_, record) => (
        <Space size={4}>
          <Button type="text" size="small" icon={<EyeOutlined />}
                  onClick={() => navigate(`/reports/${record.id}`)} />
          <Popconfirm title="确认删除？" onConfirm={() => handleDelete(record.id)}
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
          <h2>测试报告</h2>
          <div className="page-subtitle">查看历史测试执行结果</div>
        </div>
        <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>刷新</Button>
      </div>

      <div className="filter-bar">
        <Input
          placeholder="搜索报告ID / 接口名 / 数据集名"
          allowClear
          value={keyword}
          onChange={e => setKeyword(e.target.value)}
          style={{ width: 260 }}
          prefix={<SearchOutlined style={{ color: '#a5b4fc' }} />}
        />
        <Select
          value={resultFilter}
          onChange={setResultFilter}
          options={resultOptions}
          style={{ width: 140 }}
        />
        <RangePicker
          value={dateRange}
          onChange={setDateRange}
          placeholder={['开始日期', '结束日期']}
          style={{ width: 240 }}
          allowClear
        />
        {(keyword || resultFilter !== 'all' || dateRange) && (
          <Tag style={{ marginLeft: 'auto', background: '#f0fdf4', color: '#16a34a', border: 'none' }}>
            筛选出 {filteredReports.length} 份报告
          </Tag>
        )}
      </div>

      <Table
        size="small"
        columns={columns}
        dataSource={filteredReports}
        rowKey="id"
        loading={loading}
        pagination={{
          defaultPageSize: 10,
          showTotal: (t, range) => `第 ${range[0]}-${range[1]} 条，共 ${t} 份报告`,
          showSizeChanger: true,
          pageSizeOptions: ['10', '20', '50'],
          showQuickJumper: true,
        }}
      />
    </>
  )
}
