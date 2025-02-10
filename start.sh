#!/bin/bash

# 默认不清理数据库
CLEAN_DB=false

# 关闭所有后台进程
pkill -f "uvicorn"
pkill -f "next"

# 解析命令行参数
while [[ "$#" -gt 0 ]]; do
    case $1 in
        --clean-db) CLEAN_DB=true ;;
        *) echo "未知参数: $1"; exit 1 ;;
    esac
    shift
done

# 关闭可能存在的旧进程
kill_port() {
    local port=$1
    local pid=$(lsof -t -i:$port)
    if [ ! -z "$pid" ]; then
        echo "Killing process on port $port (PID: $pid)"
        kill -9 $pid
    fi
}

# 关闭已存在的进程
kill_port 8000
kill_port 3000

echo "启动后端服务..."
cd backend
source venv/bin/activate

# 如果需要清理数据库
if [ "$CLEAN_DB" = true ]; then
    echo "清理数据库..."
    # 停止所有可能使用数据库的进程
    pkill -f "uvicorn"
    
    # 删除所有数据库文件
    rm -f ai_platform.db
    rm -f *.db
    rm -f backend/*.db
    
    # 删除 migrations 目录以重新初始化
    rm -rf migrations
    rm -rf backend/migrations
    
    # 删除 alembic 版本文件
    rm -f alembic.ini
    rm -f backend/alembic.ini
    
    echo "数据库和相关文件已清理完成"
fi

# 安装/更新依赖
pip install -r requirements.txt

# 如果 alembic.ini 不存在，则创建它
if [ ! -f alembic.ini ]; then
    alembic init migrations

    # 修改 alembic.ini 中的数据库 URL
    echo "修改 alembic.ini 中的数据库 URL"
    sed -i '' "s|sqlalchemy.url = driver://user:pass@localhost/dbname|sqlalchemy.url = sqlite:///./ai_platform.db|" alembic.ini
fi

# 如果是首次运行，创建数据库表
if [ ! -d migrations/versions ] || [ -z "$(ls -A migrations/versions)" ]; then
    alembic revision --autogenerate -m "Initial migration"
    alembic upgrade head
fi

# 运行数据库迁移
alembic upgrade head

# 初始化数据库和创建管理员用户
echo "初始化数据库..."
if ! python init_db.py; then
    echo "数据库初始化失败"
    exit 1
fi

# 启动后端
echo "启动后端服务..."
uvicorn main:app --reload --host 0.0.0.0 --port 8000 &

# 等待后端启动
sleep 2

echo "启动前端服务..."
cd ../front
npm install
npm run dev &

echo "服务已启动:"
echo "前端: http://localhost:3000"
echo "后端: http://localhost:8000"
echo "默认管理员账户: admin/admin123"

echo "按任意键关闭服务..."
read -n 1

# 关闭所有后台进程
pkill -f "uvicorn"
pkill -f "next"

exit 0 