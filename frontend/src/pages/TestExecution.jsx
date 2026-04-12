import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  Card, Form, Select, InputNumber, Input, Button, Progress, Space,
  Statistic, message, Alert, Divider, Row, Col, Empty, Tag, notification, Result
} from 'antd'
import {
  PlayCircleOutlined, ThunderboltOutlined, CheckCircleOutlined,
  CloseCircleOutlined, ClockCircleOutlined, DatabaseOutlined
} from '@ant-design/icons'
import { apiApis, datasetApis, testApis } from '../api'

const methodColors = {
  GET: '#22c55e', POST: '#6366f1', PUT: '#f59e0b', DELETE: '#ef4444',
}

export default function TestExecution() {
  const [apis, setApis] = useState([])
  const [datasets, setDatasets] = useState([])
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState(null)
  const [details, setDetails] = useState([])
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [form] = Form.useForm()
  const logRef = useRef(null)
  const selectedApiId = Form.useWatch('apiId', form)

  useEffect(() => {
    const loadApis = async () => {
      try {
        const { data } = await apiApis.list()
        setApis(data)
      } catch {
        message.error('加载接口列表失败')
      }
    }
    loadApis()
  }, [])

  // 选接口后自动加载对应数据集
  useEffect(() => {
    if (selectedApiId) {
      form.setFieldValue('datasetName', undefined)
      const loadDatasets = async () => {
        try {
          const { data } = await datasetApis.list(selectedApiId)
          setDatasets(data)
        } catch {
          setDatasets([])
        }
      }
      loadDatasets()
    } else {
      setDatasets([])
    }
  }, [selectedApiId])

  const scrollToBottom = () => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight
    }
  }

  const processEvent = useCallback((eventName, data) => {
    try {
      const event = JSON.parse(data)
      const type = eventName || event.type

      if (type === 'progress') {
        setProgress({ ...event })
      } else if (type === 'detail') {
        setDetails(prev => [...prev, event])
        setTimeout(scrollToBottom, 50)
      } else if (type === 'complete') {
        setResult(event)
        setRunning(false)
        const successRate = event.total > 0 ? ((event.success / event.total) * 100).toFixed(1) : 0
        const allPassed = event.failed === 0
        notification[allPassed ? 'success' : 'warning']({
          message: allPassed ? '测试全部通过!' : '测试完成（存在失败）',
          description: `共 ${event.total} 条，成功 ${event.success}，失败 ${event.failed}，成功率 ${successRate}%，平均耗时 ${event.avgResponseTimeMs}ms`,
          duration: 6,
        })
      } else if (type === 'error') {
        setError(event.message || '未知错误')
        setRunning(false)
      }
    } catch {
      // skip invalid JSON
    }
  }, [])

  const handleExecute = async () => {
    let values
    try {
      values = await form.validateFields()
    } catch { return }

    setRunning(true)
    setProgress(null)
    setDetails([])
    setResult(null)
    setError(null)

    try {
      const response = await testApis.execute({
        apiId: values.apiId,
        datasetName: values.datasetName,
        concurrency: values.concurrency || 1,
        timeout: values.timeout || 30,
        retries: values.retries ?? 3,
        retryInterval: values.retryInterval || 1,
        token: values.token || null,
      })

      if (!response.ok) {
        const text = await response.text()
        setError(`请求失败: ${response.status} - ${text}`)
        setRunning(false)
        return
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      // 解析一个 SSE 事件块，提取 event name 和拼接所有 data: 行
      const parseBlock = (block) => {
        let eventName = null
        const dataParts = []
        for (const line of block.split('\n')) {
          if (line.startsWith('event:')) {
            eventName = line.substring(6).trim()
          } else if (line.startsWith('data:')) {
            dataParts.push(line.substring(5))
          }
        }
        if (dataParts.length > 0) {
          // SSE 规范：多行 data 拼接后用换行连接
          const fullData = dataParts.join('\n').trim()
          if (fullData) {
            processEvent(eventName, fullData)
          }
        }
      }

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })

        // 按双换行分割 SSE 事件块（SSE 规范：事件之间用空行分隔）
        const blocks = buffer.split('\n\n')
        buffer = blocks.pop() || ''

        for (const block of blocks) {
          if (!block.trim()) continue
          parseBlock(block)
        }
      }

      // 流结束后，处理 buffer 中可能残留的最后一个事件
      if (buffer.trim()) {
        parseBlock(buffer)
      }

      setRunning(false)
    } catch (e) {
      console.error('执行失败:', e)
      setError(e.message || '执行失败')
      setRunning(false)
    }
  }

  const progressPercent = progress
    ? Math.round((progress.current / progress.total) * 100)
    : 0

  return (
    <>
      <div className="page-header">
        <div>
          <h2>执行测试</h2>
          <div className="page-subtitle">选择接口和数据集，一键执行批量测试</div>
        </div>
      </div>

      <Row gutter={24}>
        <Col span={10}>
          <Card title={<span style={{ fontWeight: 600 }}>测试配置</span>}
                size="small" style={{ borderRadius: 14 }}>
            <Form form={form} layout="vertical" initialValues={{
              concurrency: 1, timeout: 30, retries: 3, retryInterval: 1,
            }}>
              <Form.Item name="apiId" label="选择接口" rules={[{ required: true, message: '请选择接口' }]}>
                <Select
                  placeholder="选择要测试的接口"
                  showSearch
                  optionFilterProp="label"
                  options={apis.map(a => ({
                    value: a.id,
                    label: `${a.name}  (${a.method} ${a.url})`,
                  }))}
                />
              </Form.Item>
              <Form.Item name="datasetName" label="选择数据集" rules={[{ required: true, message: '请选择数据集' }]}>
                <Select
                  placeholder={selectedApiId ? '选择该接口的数据集' : '请先选择接口'}
                  disabled={!selectedApiId}
                  showSearch
                  optionFilterProp="label"
                  notFoundContent={
                    selectedApiId
                      ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="该接口暂无数据集" />
                      : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="请先选择接口" />
                  }
                  options={datasets.map(d => ({
                    value: d.name,
                    label: `${d.name}  (${d.count} 条)`,
                  }))}
                />
              </Form.Item>

              <Divider style={{ margin: '12px 0' }}>
                <span style={{ fontSize: 12, color: '#9ca3af' }}>高级选项</span>
              </Divider>

              <Row gutter={12}>
                <Col span={12}>
                  <Form.Item name="concurrency" label="并发数">
                    <InputNumber min={1} max={50} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="timeout" label="超时(秒)">
                    <InputNumber min={1} max={600} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={12}>
                <Col span={12}>
                  <Form.Item name="retries" label="重试次数">
                    <InputNumber min={0} max={10} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="retryInterval" label="重试间隔(秒)">
                    <InputNumber min={0} max={30} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
              </Row>
              <Form.Item name="token" label="认证 Token">
                <Input.Password placeholder="可选，自动添加 Bearer 前缀" />
              </Form.Item>

              <Button
                type="primary"
                icon={running ? <ThunderboltOutlined /> : <PlayCircleOutlined />}
                onClick={handleExecute}
                loading={running}
                block
                size="large"
                style={{ marginTop: 8, height: 48, borderRadius: 12, fontWeight: 600 }}
              >
                {running ? '测试执行中...' : '开始测试'}
              </Button>
            </Form>
          </Card>
        </Col>

        <Col span={14}>
          {error && (
            <Alert
              type="error"
              message="执行错误"
              description={error}
              showIcon
              closable
              style={{ marginBottom: 16, borderRadius: 12 }}
            />
          )}

          {(progress || running) && (
            <div className="progress-container">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <span style={{ fontWeight: 700, fontSize: 15 }}>
                  {result ? '✅ 测试完成' : '🚀 测试执行中...'}
                </span>
                {progress && (
                  <Tag style={{ background: '#ede9fe', color: '#7c3aed', border: 'none', fontWeight: 600 }}>
                    {progress.current} / {progress.total}
                  </Tag>
                )}
              </div>
              <Progress
                percent={result ? 100 : progressPercent}
                status={result ? 'success' : 'active'}
                strokeColor={result ? '#22c55e' : { '0%': '#6366f1', '100%': '#8b5cf6' }}
                trailColor="#e5e7eb"
                strokeWidth={10}
                style={{ borderRadius: 6 }}
              />
              {progress && (
                <div className="progress-stats">
                  <div className="progress-stat-item">
                    <div className="progress-stat-value" style={{ color: '#22c55e' }}>
                      {progress.success}
                    </div>
                    <div className="progress-stat-label">成功</div>
                  </div>
                  <div className="progress-stat-item">
                    <div className="progress-stat-value" style={{ color: '#ef4444' }}>
                      {progress.failed}
                    </div>
                    <div className="progress-stat-label">失败</div>
                  </div>
                  <div className="progress-stat-item">
                    <div className="progress-stat-value" style={{ color: '#6366f1' }}>
                      {(progress.elapsedMs / 1000).toFixed(1)}s
                    </div>
                    <div className="progress-stat-label">耗时</div>
                  </div>
                </div>
              )}
            </div>
          )}

          {result && (
            <div className="stat-cards" style={{ marginTop: 16 }}>
              <Card size="small" style={{ borderRadius: 12 }}>
                <Statistic title="成功率"
                  value={result.total > 0 ? ((result.success / result.total) * 100).toFixed(1) : 0}
                  suffix="%" valueStyle={{ color: result.failed === 0 ? '#22c55e' : '#f59e0b', fontWeight: 700 }}
                  prefix={result.failed === 0 ? <CheckCircleOutlined /> : <CloseCircleOutlined />} />
              </Card>
              <Card size="small" style={{ borderRadius: 12 }}>
                <Statistic title="平均响应" value={result.avgResponseTimeMs}
                  suffix="ms" prefix={<ClockCircleOutlined />}
                  valueStyle={{ fontWeight: 700 }} />
              </Card>
              <Card size="small" style={{ borderRadius: 12 }}>
                <Statistic title="P95" value={result.p95ResponseTimeMs} suffix="ms"
                  valueStyle={{ fontWeight: 700 }} />
              </Card>
              <Card size="small" style={{ borderRadius: 12 }}>
                <Statistic title="最大响应" value={result.maxResponseTimeMs} suffix="ms"
                  valueStyle={{ fontWeight: 700 }} />
              </Card>
            </div>
          )}

          {details.length > 0 && (
            <div className="detail-log" ref={logRef}>
              {details.map((d, i) => (
                <div key={i} className={`detail-log-item ${d.success ? 'success' : 'error'}`}>
                  <span>{d.success ? '✓' : '✗'} </span>
                  <span style={{ color: '#64748b' }}>#{String(d.index).padStart(3, '0')} </span>
                  <span style={{ color: d.success ? '#34d399' : '#fca5a5' }}>
                    [{d.statusCode || 'ERR'}]
                  </span>
                  <span style={{ color: '#94a3b8' }}> {d.responseTimeMs}ms</span>
                  {d.error && <span style={{ color: '#f87171' }}> ← {d.error}</span>}
                </div>
              ))}
            </div>
          )}

          {!progress && !running && !result && (
            <div className="empty-state">
              <PlayCircleOutlined />
              <p>选择接口和数据集，点击「开始测试」</p>
            </div>
          )}
        </Col>
      </Row>
    </>
  )
}
