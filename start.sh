#!/bin/bash
# AgentTestPlatform 一键启动脚本

set -e

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo ""
echo "  ⚡ AgentTestPlatform - Agent 接口自动化测试平台"
echo "  ================================================"
echo ""

# 检查 Java 环境
if ! command -v java &> /dev/null; then
    echo -e "${RED}[错误] 未检测到 Java 环境${NC}"
    echo "请先安装 Java 11 或以上版本"
    echo "  Mac:   brew install openjdk@11"
    echo "  Linux: sudo apt install openjdk-11-jdk"
    exit 1
fi

JAVA_VER=$(java -version 2>&1 | head -1 | cut -d'"' -f2 | cut -d'.' -f1)
if [ "$JAVA_VER" -lt 11 ] 2>/dev/null; then
    echo -e "${YELLOW}[警告] Java 版本为 $JAVA_VER，建议使用 Java 11 或以上${NC}"
fi

# 获取脚本所在目录
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

JAR_FILE="AgentTestPlatform.jar"

if [ ! -f "$JAR_FILE" ]; then
    echo -e "${RED}[错误] 未找到 $JAR_FILE${NC}"
    echo "请确保在正确的目录下运行此脚本"
    exit 1
fi

# 创建数据目录
mkdir -p data/apis data/datasets data/reports

# 检查配置文件
CONFIG_ARGS=""
if [ -f "application.yml" ]; then
    CONFIG_ARGS="--spring.config.location=file:./application.yml"
    echo -e "${GREEN}[配置]${NC} 使用外部配置文件 application.yml"
fi

# 获取端口号
PORT=$(grep 'port:' application.yml 2>/dev/null | head -1 | awk '{print $2}' || echo "8899")

echo -e "${GREEN}[启动]${NC} 正在启动服务..."
echo -e "${GREEN}[地址]${NC} http://localhost:${PORT}"
echo -e "${YELLOW}[提示]${NC} 按 Ctrl+C 停止服务"
echo ""

java -jar "$JAR_FILE" $CONFIG_ARGS
