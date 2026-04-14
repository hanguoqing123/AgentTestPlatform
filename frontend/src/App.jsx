import React, { useState } from 'react'
import { useNavigate, useLocation, Routes, Route } from 'react-router-dom'
import { Layout, Menu } from 'antd'
import {
  ApiOutlined,
  DatabaseOutlined,
  PlayCircleOutlined,
  BarChartOutlined,
} from '@ant-design/icons'
import ApiManagement from './pages/ApiManagement'
import DatasetManagement from './pages/DatasetManagement'
import TestExecution from './pages/TestExecution'
import ReportList from './pages/ReportList'
import ReportDetail from './pages/ReportDetail'

const { Sider, Content } = Layout

const menuItems = [
  { key: '/apis', icon: <ApiOutlined />, label: '接口管理' },
  { key: '/datasets', icon: <DatabaseOutlined />, label: '数据集' },
  { key: '/test', icon: <PlayCircleOutlined />, label: '执行测试' },
  { key: '/reports', icon: <BarChartOutlined />, label: '测试报告' },
]

// 需要 keep-alive 的主页面
const keepAlivePages = [
  { key: '/apis', Component: ApiManagement },
  { key: '/datasets', Component: DatasetManagement },
  { key: '/test', Component: TestExecution },
  { key: '/reports', Component: ReportList },
]

export default function App() {
  const [collapsed, setCollapsed] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()

  const selectedKey = '/' + (location.pathname.split('/')[1] || 'apis')

  // 报告详情页是动态路由，不做 keep-alive
  const isReportDetail = location.pathname.startsWith('/reports/')

  return (
    <Layout className="app-layout">
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        className="app-sider"
        width={220}
      >
        <div className={`app-logo ${collapsed ? 'app-logo-collapsed' : ''}`}>
          {collapsed
            ? <span className="app-logo-short">AT</span>
            : <span className="app-logo-text">Agent<span className="app-logo-highlight">Test</span></span>
          }
        </div>
        <Menu
          selectedKeys={[selectedKey]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
          className="app-menu"
        />
      </Sider>
      <Layout style={{ background: '#f5f5f7' }}>
        <Content className="app-content">
          {/* Keep-alive 页面：始终挂载，用 display 控制显隐 */}
          {keepAlivePages.map(({ key, Component }) => {
            const active = !isReportDetail && selectedKey === key
            return (
              <div key={key} style={{ display: active ? 'block' : 'none' }}>
                <Component active={active} />
              </div>
            )
          })}

          {/* 报告详情页：动态路由，不需要 keep-alive */}
          {isReportDetail && (
            <Routes>
              <Route path="/reports/:id" element={<ReportDetail />} />
            </Routes>
          )}
        </Content>
      </Layout>
    </Layout>
  )
}
