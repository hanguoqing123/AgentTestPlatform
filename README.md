# ⚡ AgentTestPlatform

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
