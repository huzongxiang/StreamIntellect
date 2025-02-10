@echo off
setlocal

echo Setting up AI Video Analysis Platform...

:: 创建虚拟环境
if not exist "venv" (
    echo Creating Python virtual environment...
    python -m venv venv
)

:: 激活虚拟环境并安装后端依赖
echo Installing backend dependencies...
call venv\Scripts\activate
pip install fastapi==0.104.1
pip install uvicorn==0.24.0
pip install sqlalchemy==2.0.23
pip install python-multipart==0.0.6
pip install "python-jose[cryptography]==3.3.0"
pip install "passlib[bcrypt]==1.7.4"
pip install aiosqlite==0.19.0
pip install opencv-python==4.8.1.78
pip install numpy==1.26.2
pip install ultralytics==8.0.208

:: 创建必要的目录
echo Creating required directories...
if not exist "backend\weights" mkdir backend\weights
if not exist "backend\videos" mkdir backend\videos
if not exist "backend\results" mkdir backend\results

:: 初始化数据库
echo Initializing database...
cd backend
python -c "from database import init_db; import asyncio; asyncio.run(init_db())"
cd ..

:: 安装前端依赖
echo Installing frontend dependencies...
cd front
call npm install
cd ..

echo Installation completed!
echo Please run start.bat to start the application.
pause 