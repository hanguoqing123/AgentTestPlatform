# ⚡ AgentTestPlatform

**Agent 接口自动化测试平台**  一个轻量级的 API 测试工具，专为 Agent 类接口设计。

支持接口注册、测试数据管理、AI 智能生成测试数据、批量执行测试、实时查看进度、自动生成测试报告。
目前数据存储在 `data/` 目录下，未使用数据库。

## 功能特性

### 📡 接口管理
- 注册和管理需要测试的 API 接口
- 支持 GET / POST / PUT / DELETE 方法
- 自定义请求头和请求体结构

### 📦 数据集管理
- 为每个接口创建多组测试数据集
- **AI 智能生成**：基于接口结构和场景描述，一键生成贴合业务的测试数据
- 手动输入：直接编辑 JSON 数组格式的测试数据
- 数据集与接口绑定，方便管理

### 🚀 测试执行
- 选择接口 + 数据集，一键批量执行
- **实时进度**：逐条请求实时展示执行状态
- 支持 JSON 响应和 SSE 流式响应的自动解析
- 执行完成后自动生成测试报告

### 📊 测试报告
- 成功率、平均响应时间、P95、最大响应时间等统计指标
- 每条请求的详细结果：状态码、响应时间、请求体、响应内容
- 支持按关键词搜索、按结果筛选、按日期范围查询
- 所有列表支持排序和分页

## 技术栈

| 层级 | 技术 |
|------|------|
| 后端 | Spring Boot 2.7 / Java 11 |
| 前端 | React 18 + Ant Design 5 + Vite 5 |
| 数据存储 | JSON 文件（无需数据库） |
| AI 生成 | OpenAI 兼容 API（默认接入小红书 DirectLLM） |
| 实时通信 | SSE（Server-Sent Events） |

## 快速开始

### 环境要求

- **Java 11** 或以上
- **Maven**（或使用 IDEA 内置 Maven）

### 启动步骤

```bash
# 1. 克隆项目
git clone https://github.com/hanguoqing123/AgentTestPlatform.git
cd AgentTestPlatform

# 2. 启动
mvn spring-boot:run

# 3. 打开浏览器
# http://localhost:8899
```

或者用 IntelliJ IDEA 打开项目，直接运行 `TestPlatformApplication` 启动类。

### 配置 AI 数据生成（可选）

如需使用 AI 智能生成测试数据，创建 `src/main/resources/application-local.yml`：

```yaml
app:
  llm:
    api-url: https://your-llm-api-url/v1/chat/completions
    api-key: your-api-key
```

支持任何 OpenAI 兼容的 API（如 OpenAI、Azure OpenAI、小红书 DirectLLM 等）。

## 项目结构

```
AgentTestPlatform/
├── src/main/java/com/example/testplatform/
│   ├── config/          # 配置类（CORS、LLM）
│   ├── controller/      # REST 接口
│   ├── model/           # 数据模型
│   ├── service/         # 业务逻辑
│   └── TestPlatformApplication.java
├── src/main/resources/
│   ├── static/          # 前端构建产物
│   ├── application.yml  # 主配置
│   └── application-local.yml  # 本地敏感配置（不提交）
└── data/                # 运行时数据存储（不提交）
    ├── apis/            # 接口定义
    ├── datasets/        # 测试数据集
    └── reports/         # 测试报告
```

## 使用流程

1. **注册接口** → 在「接口管理」页面添加要测试的 API
2. **创建数据集** → 在「数据集管理」页面手动输入或 AI 生成测试数据
3. **执行测试** → 在「执行测试」页面选择接口和数据集，点击执行
4. **查看报告** → 在「测试报告」页面查看执行结果和统计数据

## 端口

默认端口 `8899`，可在 `application.yml` 中修改：

```yaml
server:
  port: 8899
```
