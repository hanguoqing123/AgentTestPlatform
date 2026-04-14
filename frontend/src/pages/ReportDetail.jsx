import React, { useState, useEffect } from 'react'
import {
  Card, Descriptions, Statistic, Table, Tag, Space, Button,
  message, Spin, Row, Col, Typography, Collapse
} from 'antd'
import {
  ArrowLeftOutlined, CheckCircleOutlined, CloseCircleOutlined,
  ClockCircleOutlined, ThunderboltOutlined
} from '@ant-design/icons'
import { useParams, useNavigate } from 'react-router-dom'
import { reportApis } from '../api'
import dayjs from 'dayjs'

const { Text } = Typography

const methodColors = {
  GET: '#22c55e', POST: '#6366f1', PUT: '#f59e0b', DELETE: '#ef4444',
}

export default function ReportDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await reportApis.get(id)
        setReport(data)
      } catch {
        message.error('加载报告失败')
      }
      setLoading(false)
    }
    load()
  }, [id])

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>
  }

  if (!report) {
    return <div style={{ textAlign: 'center', padding: 80, color: '#9ca3af' }}>报告不存在</div>
  }

  const successRate = report.total > 0
    ? ((report.success / report.total) * 100).toFixed(1)
    : 0

  const detailColumns = [
    {
      title: '#',
      dataIndex: 'index',
      key: 'index',
      width: 60,
      render: (v) => <span style={{ color: '#9ca3af', fontFamily: "'JetBrains Mono', monospace" }}>{String(v).padStart(3, '0')}</span>,
    },
    {
      title: '状态',
      dataIndex: 'success',
      key: 'success',
      width: 80,
      render: (v) => v
        ? <Tag icon={<CheckCircleOutlined />} style={{ background: '#f0fdf4', color: '#22c55e', border: 'none' }}>成功</Tag>
        : <Tag icon={<CloseCircleOutlined />} style={{ background: '#fef2f2', color: '#ef4444', border: 'none' }}>失败</Tag>,
    },
    {
      title: '状态码',
      dataIndex: 'statusCode',
      key: 'statusCode',
      width: 80,
      render: (v) => {
        const color = v >= 200 && v < 300 ? '#22c55e' : v >= 400 ? '#ef4444' : '#f59e0b'
        return <Tag style={{ background: color + '18', color, border: 'none', fontWeight: 600 }}>{v || '-'}</Tag>
      },
    },
    {
      title: '响应时间',
      dataIndex: 'responseTimeMs',
      key: 'responseTimeMs',
      width: 120,
      sorter: (a, b) => a.responseTimeMs - b.responseTimeMs,
      render: (v) => {
        const color = v > 3000 ? '#ef4444' : v > 1000 ? '#f59e0b' : '#22c55e'
        return <span style={{ color, fontWeight: 600, fontFamily: "'JetBrains Mono', monospace" }}>{v}ms</span>
      },
    },
    {
      title: '错误信息',
      dataIndex: 'error',
      key: 'error',
      ellipsis: true,
      render: (v) => v ? <Text type="danger" style={{ fontSize: 13 }}>{v}</Text> : <span style={{ color: '#d1d5db' }}>-</span>,
    },
  ]

  const expandedRowRender = (record) => (
    <div style={{ padding: '8px 0' }}>
      <Collapse
        size="small"
        items={[
          {
            key: 'request',
            label: '请求体',
            children: (
              <pre style={{ margin: 0, fontSize: 12, maxHeight: 200, overflow: 'auto',
                           fontFamily: "'JetBrains Mono', monospace", background: '#f8fafc',
                           padding: 12, borderRadius: 8 }}>
                {JSON.stringify(record.requestBody, null, 2)}
              </pre>
            ),
          },
          {
            key: 'response',
            label: '响应内容',
            children: (
              <pre style={{ margin: 0, fontSize: 12, maxHeight: 300, overflow: 'auto',
                           whiteSpace: 'pre-wrap', fontFamily: "'JetBrains Mono', monospace",
                           background: '#f8fafc', padding: 12, borderRadius: 8 }}>
                {record.responseSummary || '(无)'}
              </pre>
            ),
          },
        ]}
      />
    </div>
  )

  return (
    <>
      <div className="page-header">
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/reports')}>返回</Button>
          <h2 style={{ margin: 0 }}>报告详情</h2>
        </Space>
        <Text code style={{ fontSize: 12 }}>{report.id}</Text>
      </div>

      <Descriptions bordered size="small" column={3} style={{ marginBottom: 24 }}>
        <Descriptions.Item label="接口名称">
          <span style={{ fontWeight: 500 }}>{report.apiName || report.apiId}</span>
        </Descriptions.Item>
        <Descriptions.Item label="方法">
          <Tag className="method-tag"
               style={{ background: (methodColors[report.method] || '#999') + '18', color: methodColors[report.method] }}>
            {report.method}
          </Tag>
        </Descriptions.Item>
        <Descriptions.Item label="URL">
          <span style={{ fontSize: 13, color: '#6b7280' }}>{report.url}</span>
        </Descriptions.Item>
        <Descriptions.Item label="数据集">
          <span style={{ fontWeight: 500 }}>{report.datasetName}</span>
        </Descriptions.Item>
        <Descriptions.Item label="开始时间">
          {report.startTime ? dayjs(report.startTime).format('YYYY-MM-DD HH:mm:ss') : '-'}
        </Descriptions.Item>
        <Descriptions.Item label="结束时间">
          {report.endTime ? dayjs(report.endTime).format('YYYY-MM-DD HH:mm:ss') : '-'}
        </Descriptions.Item>
      </Descriptions>

      <div className="stat-cards">
        <Card size="small">
          <Statistic
            title="成功率"
            value={successRate}
            suffix="%"
            valueStyle={{ color: report.failed === 0 ? '#22c55e' : '#f59e0b', fontWeight: 700 }}
            prefix={report.failed === 0 ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
          />
        </Card>
        <Card size="small">
          <Statistic title="总请求" value={report.total}
                     prefix={<ThunderboltOutlined />} valueStyle={{ fontWeight: 700 }} />
        </Card>
        <Card size="small">
          <Statistic title="成功" value={report.success}
                     valueStyle={{ color: '#22c55e', fontWeight: 700 }} />
        </Card>
        <Card size="small">
          <Statistic title="失败" value={report.failed}
                     valueStyle={{ color: report.failed > 0 ? '#ef4444' : '#22c55e', fontWeight: 700 }} />
        </Card>
        <Card size="small">
          <Statistic title="平均响应" value={report.avgResponseTimeMs}
                     suffix="ms" valueStyle={{ fontWeight: 700 }} />
        </Card>
        <Card size="small">
          <Statistic title="P95" value={report.p95ResponseTimeMs} suffix="ms"
                     valueStyle={{ fontWeight: 700 }} />
        </Card>
        <Card size="small">
          <Statistic title="最大响应" value={report.maxResponseTimeMs}
                     suffix="ms"
                     valueStyle={{ fontWeight: 700, color: report.maxResponseTimeMs > 5000 ? '#ef4444' : undefined }} />
        </Card>
      </div>

      <Card title={<span style={{ fontWeight: 600 }}>请求详情</span>}
            size="small" style={{ marginTop: 24, borderRadius: 14 }}>
        <Table
          columns={detailColumns}
          dataSource={report.details || []}
          rowKey="index"
          size="small"
          expandable={{ expandedRowRender }}
          pagination={{ defaultPageSize: 20, showSizeChanger: true, showTotal: (t) => `共 ${t} 条` }}
        />
      </Card>
    </>
  )
}
