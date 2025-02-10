#!/bin/bash

# 获取脚本所在目录的绝对路径
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# 颜色定义
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}开始安装AI视频分析平台...${NC}"

# 创建必要的目录
echo -e "${GREEN}创建必要的目录...${NC}"
mkdir -p "$SCRIPT_DIR/static" "$SCRIPT_DIR/weights"

# 后端安装
echo -e "${GREEN}安装后端依赖...${NC}"
if [ ! -d "backend/venv" ]; then
    python3 -m venv backend/venv
fi
source backend/venv/bin/activate
pip install -r backend/requirements.txt
deactivate

# 前端安装
echo -e "${GREEN}安装前端依赖...${NC}"
cd front
if [ ! -d "node_modules" ]; then
    npm install
fi
cd ..

echo -e "${BLUE}安装完成!${NC}" 