@echo off
setlocal

:: 检查安装
if not exist "venv" (
    echo Environment not found! Please run setup.bat and install.bat first.
    pause
    exit /b 1
)

if not exist "front\node_modules" (
    echo Frontend dependencies not found! Please run install.bat first.
    pause
    exit /b 1
)

:: 激活虚拟环境
call venv\Scripts\activate

:: 启动后端服务
echo Starting backend server...
start cmd /k "cd backend && python main.py"

:: 等待后端启动
echo Waiting for backend to start...
timeout /t 5

:: 启动前端服务
echo Starting frontend server...
cd front
npm run dev

endlocal 