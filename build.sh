#!/bin/bash
# AgentTestPlatform 一键构建 & 打包脚本
# 输出: dist/AgentTestPlatform.zip（可直接发给别人使用）

set -e

DIST_DIR="dist/AgentTestPlatform"

echo "=========================================="
echo "  AgentTestPlatform 构建打包"
echo "=========================================="

echo ""
echo "[1/4] 构建前端..."
cd frontend
npm install --registry=https://registry.npmmirror.com
npm run build
cd ..

echo ""
echo "[2/4] 复制前端产物到 Spring Boot 静态资源..."
rm -rf src/main/resources/static/*
cp -r frontend/dist/* src/main/resources/static/

echo ""
echo "[3/4] 构建后端 JAR..."
mvn clean package -DskipTests -q

echo ""
echo "[4/4] 打包分发包..."
rm -rf dist
mkdir -p "$DIST_DIR"

# 复制 JAR
cp target/AgentTestPlatform-1.0.0.jar "$DIST_DIR/AgentTestPlatform.jar"

# 复制启动脚本
cp start.sh "$DIST_DIR/"
chmod +x "$DIST_DIR/start.sh"

# 创建默认配置文件
cat > "$DIST_DIR/application.yml" << 'EOF'
server:
  port: 8899

spring:
  jackson:
    serialization:
      indent-output: true
    default-property-inclusion: non_null

app:
  data-dir: ./data

  # 大模型配置（按需修改）
  llm:
    api-url: ${LLM_API_URL:https://maas.devops.xiaohongshu.com/v1/chat/completions}
    api-key: ${LLM_API_KEY:请替换为你的API Key}
    model: ${LLM_MODEL:qwen3-vl-235b-a22b-instruct}
    max-tokens: 16384
    temperature: 0.9
EOF

# 创建空的 data 目录
mkdir -p "$DIST_DIR/data/apis"
mkdir -p "$DIST_DIR/data/datasets"
mkdir -p "$DIST_DIR/data/reports"

# 创建说明文件
cat > "$DIST_DIR/README.txt" << 'EOF'
===================================
  AgentTestPlatform - 使用说明
===================================

【环境要求】
  - Java 11 或以上（输入 java -version 检查）

【快速启动】
  1. 解压本压缩包
  2. 进入 AgentTestPlatform 目录
  3. 运行启动脚本：
     Mac/Linux:  ./start.sh
  4. 打开浏览器访问：http://localhost:8899

【配置修改】
  - 修改 application.yml 可调整端口、LLM API Key 等配置
  - 数据存储在 data/ 目录下

【停止服务】
  - 按 Ctrl+C 即可停止

===================================
EOF

# 打 zip 包
cd dist
zip -r AgentTestPlatform.zip AgentTestPlatform/
cd ..

echo ""
echo "=========================================="
echo "  构建完成！"
echo "  分发包: dist/AgentTestPlatform.zip"
echo "  大小: $(du -h dist/AgentTestPlatform.zip | cut -f1)"
echo "=========================================="
