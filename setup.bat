@echo off
echo Checking system requirements...

:: 检查 Python
python --version 2>NUL
if errorlevel 1 (
    echo Python not found! Please install Python 3.8 or later from:
    echo https://www.python.org/downloads/
    pause
    exit /b 1
)

:: 检查 Node.js
node --version 2>NUL
if errorlevel 1 (
    echo Node.js not found! Please install Node.js 16 or later from:
    echo https://nodejs.org/
    pause
    exit /b 1
)

:: 检查 npm
npm --version 2>NUL
if errorlevel 1 (
    echo npm not found! Please install Node.js which includes npm
    pause
    exit /b 1
)

echo All system requirements met!
echo Please run install.bat next to set up the project.
pause 