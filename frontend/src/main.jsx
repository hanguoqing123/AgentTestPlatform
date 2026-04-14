import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import App from './App'
import './App.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ConfigProvider locale={zhCN} theme={{
      token: {
        colorPrimary: '#6366f1',
        colorSuccess: '#22c55e',
        colorError: '#ef4444',
        colorWarning: '#f59e0b',
        borderRadius: 10,
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        fontSize: 14,
        controlHeight: 38,
        colorBgContainer: '#ffffff',
        colorBgLayout: '#f5f5f7',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.06)',
      },
      components: {
        Table: {
          headerBg: '#fafafe',
          headerColor: '#6b7280',
          headerSplitColor: 'transparent',
          rowHoverBg: '#f9fafb',
        },
        Card: {
          paddingLG: 20,
        },
        Button: {
          primaryShadow: '0 2px 8px rgba(99, 102, 241, 0.35)',
        },
        Menu: {
          darkItemBg: 'transparent',
          darkItemSelectedBg: 'rgba(99, 102, 241, 0.15)',
          darkItemHoverBg: 'rgba(255, 255, 255, 0.06)',
          darkItemSelectedColor: '#a5b4fc',
        },
      },
    }}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ConfigProvider>
  </React.StrictMode>,
)
