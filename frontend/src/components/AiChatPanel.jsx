import React, { useState, useRef, useEffect } from 'react'
import { Input, Button, message, Spin, Typography, Tag } from 'antd'
import { SendOutlined, RobotOutlined, UserOutlined, ClearOutlined } from '@ant-design/icons'
import { generateApis } from '../api'

const { Text } = Typography

/**
 * AI 对话面板 — 用户可以发送指令让 AI 修改当前数据集
 *
 * Props:
 *  - getCurrentData: () => string    获取当前 JSON 编辑器中的数据文本
 *  - onApplyData: (newJsonText) => void  将 AI 返回的修改数据应用到编辑器
 *  - disabled: boolean               是否禁用（LLM 未配置时）
 */
export default function AiChatPanel({ getCurrentData, onApplyData, disabled = false }) {
  const [messages, setMessages] = useState([])
  const [inputValue, setInputValue] = useState('')
  const [loading, setLoading] = useState(false)
  const listRef = useRef(null)
  const composingRef = useRef(false) // 标记是否正在进行 IME 组合输入

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight
    }
  }, [messages])

  const handleSend = async () => {
    const instruction = inputValue.trim()
    if (!instruction) return

    // 获取当前编辑器数据
    const currentText = getCurrentData()
    let currentData
    try {
      currentData = JSON.parse(currentText)
      if (!Array.isArray(currentData)) {
        message.error('当前数据不是有效的 JSON 数组，请先修正数据格式')
        return
      }
      if (currentData.length === 0) {
        message.error('当前数据集为空，请先通过 AI 生成或手动输入一些数据')
        return
      }
    } catch {
      message.error('当前数据 JSON 格式错误，请先修正')
      return
    }

    // 添加用户消息
    const userMsg = { role: 'user', content: instruction, time: new Date() }
    setMessages(prev => [...prev, userMsg])
    setInputValue('')
    setLoading(true)

    try {
      // 数据量大时提示用户可能需要等待
      if (currentData.length > 30) {
        const batchCount = Math.ceil(currentData.length / 20)
        setMessages(prev => [...prev, {
          role: 'ai',
          content: `数据量较大（${currentData.length} 条），将分 ${batchCount} 批处理，请耐心等待...`,
          time: new Date(),
          info: true,
        }])
      }

      // 使用同步接口
      const { data: result } = await generateApis.refine({
        data: currentData,
        instruction,
      })

      const refinedData = result.data
      const totalBatches = result.totalBatches
      const isBatched = result.batched

      if (refinedData) {
        // 构建 AI 回复消息
        let replyText = `已完成修改，共 ${refinedData.length} 条数据`
        if (isBatched) {
          replyText += `（分 ${totalBatches} 批处理）`
        }

        const aiMsg = {
          role: 'ai',
          content: replyText,
          time: new Date(),
        }
        setMessages(prev => [...prev, aiMsg])

        // 应用到编辑器
        onApplyData(JSON.stringify(refinedData, null, 2))
        message.success(replyText)
      }
    } catch (e) {
      const errMsg = e.response?.data?.error || e.message || 'AI 修改失败'
      const aiMsg = {
        role: 'ai',
        content: `操作失败: ${errMsg}`,
        time: new Date(),
        error: true,
      }
      setMessages(prev => [...prev, aiMsg])
      message.error(errMsg)
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e) => {
    // IME 组合输入中（如中文拼音），回车是确认拼音，不发送消息
    if (e.key === 'Enter' && !e.shiftKey && !composingRef.current) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleClear = () => {
    setMessages([])
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      border: '1px solid #ede9fe',
      borderRadius: 12,
      background: 'linear-gradient(180deg, #fafafe 0%, #f5f3ff 100%)',
      overflow: 'hidden',
    }}>
      {/* 标题栏 */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 14px',
        borderBottom: '1px solid #ede9fe',
        background: 'rgba(255,255,255,0.8)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <RobotOutlined style={{ color: '#6366f1', fontSize: 16 }} />
          <span style={{ fontWeight: 600, fontSize: 13, color: '#374151' }}>AI 助手</span>
        </div>
        {messages.length > 0 && (
          <Button
            type="text"
            size="small"
            icon={<ClearOutlined />}
            onClick={handleClear}
            style={{ color: '#9ca3af', fontSize: 12 }}
          >
            清空
          </Button>
        )}
      </div>

      {/* 消息列表 */}
      <div
        ref={listRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '12px 14px',
          minHeight: 0,
        }}
      >
        {messages.length === 0 ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            color: '#b0b8c4',
            gap: 8,
            padding: '20px 0',
          }}>
            <RobotOutlined style={{ fontSize: 28, opacity: 0.3 }} />
            <span style={{ fontSize: 12, textAlign: 'center', lineHeight: 1.6 }}>
              告诉 AI 你想如何修改数据<br />
              例如："把所有 title 改成英文"<br />
              "再增加3条异常数据"
            </span>
          </div>
        ) : (
          messages.map((msg, idx) => (
            <div
              key={idx}
              style={{
                display: 'flex',
                gap: 8,
                marginBottom: 12,
                flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
              }}
            >
              <div style={{
                width: 28,
                height: 28,
                borderRadius: 14,
                background: msg.role === 'user' ? '#6366f1' : (msg.error ? '#fee2e2' : '#ede9fe'),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}>
                {msg.role === 'user'
                  ? <UserOutlined style={{ color: '#fff', fontSize: 13 }} />
                  : <RobotOutlined style={{ color: msg.error ? '#ef4444' : '#6366f1', fontSize: 13 }} />
                }
              </div>
              <div style={{
                maxWidth: '80%',
                padding: '8px 12px',
                borderRadius: msg.role === 'user' ? '12px 4px 12px 12px' : '4px 12px 12px 12px',
                background: msg.role === 'user' ? '#6366f1' : (msg.info ? '#f0f9ff' : '#fff'),
                color: msg.role === 'user' ? '#fff' : (msg.error ? '#ef4444' : (msg.info ? '#0284c7' : '#374151')),
                fontSize: 13,
                lineHeight: 1.5,
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                wordBreak: 'break-word',
                border: msg.info ? '1px solid #bae6fd' : 'none',
              }}>
                {msg.content}
              </div>
            </div>
          ))
        )}
        {loading && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <div style={{
              width: 28, height: 28, borderRadius: 14,
              background: '#ede9fe',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <RobotOutlined style={{ color: '#6366f1', fontSize: 13 }} />
            </div>
            <div style={{
              padding: '8px 16px',
              borderRadius: '4px 12px 12px 12px',
              background: '#fff',
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
            }}>
              <Spin size="small" />
              <span style={{ marginLeft: 8, color: '#9ca3af', fontSize: 13 }}>AI 正在修改数据...</span>
            </div>
          </div>
        )}
      </div>

      {/* 输入框 */}
      <div style={{
        padding: '10px 12px',
        borderTop: '1px solid #ede9fe',
        background: 'rgba(255,255,255,0.8)',
        display: 'flex',
        gap: 8,
      }}>
        <Input.TextArea
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          onCompositionStart={() => { composingRef.current = true }}
          onCompositionEnd={() => { composingRef.current = false }}
          onKeyDown={handleKeyDown}
          placeholder={disabled ? 'LLM 未配置' : '告诉 AI 如何修改数据... (Enter 发送)'}
          disabled={disabled || loading}
          autoSize={{ minRows: 1, maxRows: 3 }}
          style={{
            borderRadius: 10,
            resize: 'none',
            fontSize: 13,
          }}
        />
        <Button
          type="primary"
          icon={<SendOutlined />}
          onClick={handleSend}
          disabled={disabled || loading || !inputValue.trim()}
          style={{
            borderRadius: 10,
            height: 'auto',
            minHeight: 36,
            background: (!disabled && inputValue.trim()) ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : undefined,
            border: 'none',
          }}
        />
      </div>
    </div>
  )
}
