# 智能视频分析平台后端系统

![Python](https://img.shields.io/badge/Python-3.9%2B-blue)
![FastAPI](https://img.shields.io/badge/FastAPI-0.95%2B-green)
![OpenCV](https://img.shields.io/badge/OpenCV-4.7%2B-orange)

## 项目概述

本系统是基于FastAPI构建的智能视频分析平台后端，提供视频流处理、设备管理、算法部署和实时监控等功能。支持与多种视频源（RTSP流、本地视频文件）集成，并可通过WebSocket实现实时视频流传输。

## 主要功能

### 核心模块
- 🛡️ 用户认证与权限管理
  - JWT令牌认证（/token端点）
  - 多级用户权限（普通用户/超级管理员）
  - 用户注册审核机制（待审核/通过/拒绝状态）

- 📷 视频设备管理（RTSP流接入）
  - 设备增删改查接口
  - RTSP流连通性检测
  - WebSocket实时预览（/ws/device-preview/{device_id}）

- 🧠 算法模型管理
  - 支持YOLOv8模型上传与管理
  - 权重文件版本控制
  - 算法-任务依赖关系检查

- 🚦 任务调度与监控
  - 两种任务类型：
    - 实时监控任务（持续处理RTSP流）
    - 测试任务（处理上传视频文件）
  - 任务状态机管理（stopped/running/error）
  - 进程级资源隔离

- 🔌 实时视频处理
  - 多进程架构（Process + Queue）
  - 帧级处理流水线：
    1. OpenCV帧捕获
    2. YOLO目标检测
    3. 结果可视化渲染
    4. WebSocket实时推送

### 特色功能
- 智能资源管理
  - 自动重连机制（RTSP流中断恢复）
  - 进程池管理（process_dict/queue_dict）
  - 队列溢出保护（maxsize=30）

- 可视化支持
  - 实时检测框渲染
  - 关键帧保存（每30帧存储JPEG）
  - 处理日志追踪（/tasks/{id}/log）

- 安全机制
  - WebSocket令牌验证
  - 敏感操作审计（用户状态变更记录）
  - 文件沙箱存储（隔离weights/videos/results目录）

- 诊断工具
  - 视频文件校验接口（/results/{task_name}/check-video）
  - 处理进度查询（通过日志文件）
  - 错误追踪（自动生成error.txt）

## 平台展示

##
<div align="center">
  <img src="https://github.com/huzongxiang/StreamIntellect/blob/resources/fig1.png" alt="speed" style="width: 80%;">
</div>

##
<div align="center">
  <img src="https://github.com/huzongxiang/StreamIntellect/blob/resources/fig2.png" alt="speed" style="width: 80%;">
</div>

##
<div align="center">
  <img src="https://github.com/huzongxiang/StreamIntellect/blob/resources/fig3.png" alt="speed" style="width: 80%;">
</div>

##
<div align="center">
  <img src="https://github.com/huzongxiang/StreamIntellect/blob/resources/fig4.png" alt="speed" style="width: 80%;">
</div>

##
<div align="center">
  <img src="https://github.com/huzongxiang/StreamIntellect/blob/resources/fig5.png" alt="speed" style="width: 80%;">
</div>

## 技术栈

### 后端框架
- FastAPI
- SQLAlchemy (异步)
- Pydantic
- JWT认证

### 视频处理
- OpenCV
- YOLOv8
- 多进程处理

### 基础设施
- PostgreSQL
- Redis（可选）
- Docker

## 快速开始

### 环境要求
- Python 3.9+
- PostgreSQL 12+
- OpenCV 4.7+
- FFmpeg

### 安装步骤

1. 克隆仓库
```bash
git clone https://github.com/your-repo/stream-intellect-backend.git
cd stream-intellect-backend
```

2. 安装依赖
```bash
pip install -r requirements.txt
```

3. 配置环境变量
创建 `.env` 文件：
```ini
DATABASE_URL=postgresql+asyncpg://user:password@localhost/dbname
SECRET_KEY=your-secret-key
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
```

4. 初始化数据库
```bash
python -m database.init_db
```

5. 启动服务
```bash
uvicorn backend.main:app --reload
```

## API文档

访问 `http://localhost:8000/docs` 查看交互式API文档，包含：
- 用户认证接口
- 设备管理接口
- 算法管理接口
- 任务调度接口
- WebSocket实时流接口

## 系统架构

```mermaid
graph TD
    A[客户端] --> B{NGINX}
    B --> C[认证服务]
    B --> D[视频流服务]
    C --> E[FastAPI应用]
    D --> F[视频处理集群]
    E --> G[(数据库)]
    F --> H[存储服务]
```

## 开发指南

### 代码结构
```
backend/
├── main.py            # 主入口
├── database/          # 数据库模块
├── models/           # 数据模型
├── schemas/          # Pydantic模型
├── routes/           # API路由
└── utils/            # 工具类
```

### 贡献流程
1. Fork项目仓库
2. 创建特性分支 (`git checkout -b feature/your-feature`)
3. 提交修改 (`git commit -m 'Add some feature'`)
4. 推送到分支 (`git push origin feature/your-feature`)
5. 创建Pull Request

## 许可证

[MIT License](LICENSE)

---

**提示**：生产环境部署建议使用Docker容器化部署，并配置Nginx反向代理和SSL证书。
