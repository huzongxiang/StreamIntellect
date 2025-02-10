from fastapi import FastAPI, HTTPException, Depends, status, Request, WebSocket, WebSocketDisconnect
from fastapi import UploadFile, File, Form
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.responses import Response, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import List, Optional, Dict
import jwt
import bcrypt
from datetime import datetime, timedelta
from settings import settings
import cv2
import numpy as np
import asyncio
import json
import logging
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from database import get_session, init_db, async_session
from models import User, Device, Algorithm, Task, TestTask, MonitorTask
from contextlib import asynccontextmanager
from schemas import UserCreate, DeviceResponse, DeviceCreate, AlgorithmResponse, AlgorithmCreate, TaskResponse, TaskCreate, TestTaskCreate, TestTaskResponse
import os
import shutil
from asyncio import Queue, create_task
from pathlib import Path
from multiprocessing import Process, Queue
from queue import Empty, Full
import time
from asyncio import Queue as AsyncQueue
from functools import partial
from multiprocessing import Event

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# 定义 lifespan
@asynccontextmanager
async def lifespan(app: FastAPI):
    # 启动时执行
    try:
        logger.info("Starting application...")
        yield
    finally:
        # 关闭时执行
        logger.info("Shutting down...")
        # 清理资源
        for process in process_dict.values():
            process.terminate()
            process.join()
        process_dict.clear()
        queue_dict.clear()

# 创建 FastAPI 实例
app = FastAPI(lifespan=lifespan)

# 存储 WebSocket 连接
ws_connections: Dict[str, WebSocket] = {}

# 存储进程
process_dict: Dict[int, Process] = {}
# 存储进程间通信的队列
queue_dict: Dict[int, Queue] = {}

# 添加 CORS 中间件
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

# 模拟数据库
users_db = []
devices_db = []
algorithms_db = []
tasks_db = []

# JWT配置
SECRET_KEY = settings.SECRET_KEY
ALGORITHM = settings.ALGORITHM
ACCESS_TOKEN_EXPIRE_MINUTES = settings.ACCESS_TOKEN_EXPIRE_MINUTES

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/token")

# 确保权重文件目录存在
WEIGHTS_DIR = "weights"
VIDEOS_DIR = "videos"
RESULTS_DIR = "results"
for dir_path in [WEIGHTS_DIR, VIDEOS_DIR, RESULTS_DIR]:
    os.makedirs(dir_path, exist_ok=True)
    # 确保目录有写入权限
    os.chmod(dir_path, 0o755)

# 挂载静态文件目录
app.mount("/videos", StaticFiles(directory=VIDEOS_DIR), name="videos")
app.mount("/results", StaticFiles(
    directory=RESULTS_DIR,
    html=True,
    check_dir=False
), name="results")

# 用户认证相关函数
def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(token: str = Depends(oauth2_scheme)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Could not validate credentials",
            )
        return username
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
        )

# 路由
@app.post("/register")
async def register(
    user: UserCreate,
    db: AsyncSession = Depends(get_session)
):
    try:
        logger.info(f"Registration attempt for user: {user.username}")
        
        # 检查用户名和密码是否为空
        if not user.username or not user.password:
            logger.warning("Empty username or password in registration attempt")
            raise HTTPException(status_code=400, detail="用户名和密码不能为空")

        # 检查用户是否已存在
        result = await db.execute(
            select(User).where(User.username == user.username)
        )
        if result.scalar_one_or_none():
            logger.warning(f"Username already exists: {user.username}")
            raise HTTPException(status_code=400, detail="用户名已存在")
    
        # 创建新用户
        hashed_password = bcrypt.hashpw(user.password.encode('utf-8'), bcrypt.gensalt())
        db_user = User(
            username=user.username, 
            password=hashed_password.decode('utf-8')
        )
        db.add(db_user)
        await db.commit()
        logger.info(f"User registered successfully: {user.username}")
        return {"message": "注册成功"}
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        logger.error(f"Registration error for {user.username}: {str(e)}")
        raise HTTPException(status_code=500, detail="注册失败，请稍后重试")

@app.post("/token")
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_session)
):
    try:
        result = await db.execute(
            select(User).where(User.username == form_data.username)
        )
        user = result.scalar_one_or_none()
        
        if not user or not bcrypt.checkpw(
            form_data.password.encode('utf-8'),
            user.password.encode('utf-8')
        ):
            raise HTTPException(status_code=401, detail="用户名或密码错误")
        
        # 检查用户状态
        if user.status != 'approved' and not user.is_superuser:
            if user.status == 'pending':
                raise HTTPException(status_code=401, detail="账号正在审核中")
            else:
                raise HTTPException(status_code=401, detail="账号已被拒绝")
        
        access_token = create_access_token(data={"sub": user.username})
        return {"access_token": access_token, "token_type": "bearer"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail="登录失败")

# 设备相关路由
@app.post("/devices", response_model=DeviceResponse)
async def create_device(
    device: DeviceCreate,
    db: AsyncSession = Depends(get_session)
):
    try:
        # 检查设备名称是否已存在
        result = await db.execute(
            select(Device).where(Device.name == device.name)
        )
        if result.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="设备名称已存在")
        
        # 创建新设备
        db_device = Device(
            name=device.name,
            rtsp_url=device.rtsp_url
        )
        db.add(db_device)
        await db.commit()
        await db.refresh(db_device)
        return db_device
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        logger.error(f"Error creating device: {str(e)}")
        raise HTTPException(status_code=500, detail="创建设备失败")

@app.get("/devices", response_model=list[DeviceResponse])
async def get_devices(
    db: AsyncSession = Depends(get_session)
):
    try:
        stmt = select(Device)
        result = await db.execute(stmt)
        devices = result.scalars().all()
        return devices
    except Exception as e:
        logger.error(f"Error getting devices: {str(e)}")
        raise HTTPException(status_code=500, detail="获取设备列表失败")

@app.delete("/devices/{device_id}")
async def delete_device(
    device_id: int,
    db: AsyncSession = Depends(get_session)
):
    try:
        # 检查是否有任务在使用此设备
        result = await db.execute(
            select(Task).where(Task.device_id == device_id)
        )
        if result.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="该设备正在被任务使用，无法删除")
        
        # 获取设备信息
        result = await db.execute(
            select(Device).where(Device.id == device_id)
        )
        device = result.scalar_one_or_none()
        if not device:
            raise HTTPException(status_code=404, detail="设备不存在")
        
        # 删除设备记录
        await db.delete(device)
        await db.commit()
        return {"message": "设备删除成功"}
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        logger.error(f"Error deleting device: {str(e)}")
        raise HTTPException(status_code=500, detail="删除设备失败")

# 算法相关路由
@app.post("/algorithms", response_model=AlgorithmResponse)
async def create_algorithm(
    algorithm: str = Form(...),
    weight_file: UploadFile = File(...),
    db: AsyncSession = Depends(get_session)
):
    file_path = None
    try:
        # 解析算法数据
        algorithm_data = json.loads(algorithm)
        
        # 检查算法名称是否已存在
        result = await db.execute(
            select(Algorithm).where(Algorithm.name == algorithm_data["name"])
        )
        if result.scalar_one_or_none():
            raise HTTPException(
                status_code=400,
                detail=f"算法名称 '{algorithm_data['name']}' 已存在"
            )
        
        # 保存权重文件
        file_path = os.path.join(WEIGHTS_DIR, weight_file.filename)
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(weight_file.file, buffer)
        
        # 创建算法记录
        db_algorithm = Algorithm(
            name=algorithm_data["name"],
            weight_path=file_path
        )
        db.add(db_algorithm)
        await db.commit()
        await db.refresh(db_algorithm)
        return db_algorithm
    except HTTPException:
        raise
    except Exception as e:
        # 如果出错，删除已上传的文件
        if file_path and os.path.exists(file_path):
            os.remove(file_path)
        await db.rollback()
        logger.error(f"Error creating algorithm: {str(e)}")
        raise HTTPException(status_code=500, detail="创建算法失败")

@app.get("/algorithms", response_model=list[AlgorithmResponse])
async def get_algorithms(
    db: AsyncSession = Depends(get_session)
):
    result = await db.execute(select(Algorithm))
    algorithms = result.scalars().all()
    return algorithms

@app.delete("/algorithms/{algorithm_id}")
async def delete_algorithm(
    algorithm_id: int,
    db: AsyncSession = Depends(get_session)
):
    try:
        # 检查算法是否存在
        result = await db.execute(
            select(Algorithm).where(Algorithm.id == algorithm_id)
        )
        algorithm = result.scalar_one_or_none()
        if not algorithm:
            raise HTTPException(status_code=404, detail="算法不存在")
        
        # 检查普通任务
        tasks_result = await db.execute(
            select(Task).where(Task.algorithm_id == algorithm_id)
        )
        # 检查测试任务
        test_tasks_result = await db.execute(
            select(TestTask).where(TestTask.algorithm_id == algorithm_id)
        )
        
        if tasks_result.first() or test_tasks_result.first():
            raise HTTPException(
                status_code=400, 
                detail="该算法正在被任务使用，无法删除"
            )
        
        # 删除算法文件
        if algorithm.weight_path:
            file_path = os.path.join(WEIGHTS_DIR, algorithm.weight_path)
            if os.path.exists(file_path):
                os.remove(file_path)
        
        # 删除算法记录
        await db.delete(algorithm)
        await db.commit()
        
        return {"message": "算法删除成功"}
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        logger.error(f"Error deleting algorithm: {str(e)}")
        raise HTTPException(status_code=500, detail="删除算法失败")

# 任务相关路由
@app.post("/tasks", response_model=TaskResponse)
async def create_task(
    task: TaskCreate,
    db: AsyncSession = Depends(get_session)
):
    try:
        # 检查是否已存在相同的设备和算法组合的任务
        result = await db.execute(
            select(Task).where(
                Task.device_id == task.device_id,
                Task.algorithm_id == task.algorithm_id
            )
        )
        if result.scalar_one_or_none():
            # 获取设备和算法名称以提供更友好的错误消息
            device_result = await db.execute(
                select(Device).where(Device.id == task.device_id)
            )
            algorithm_result = await db.execute(
                select(Algorithm).where(Algorithm.id == task.algorithm_id)
            )
            device = device_result.scalar_one()
            algorithm = algorithm_result.scalar_one()
            raise HTTPException(
                status_code=400, 
                detail=f"设备 '{device.name}' 和算法 '{algorithm.name}' 的组合任务已存在"
            )
        
        # 创建新任务
        db_task = Task(**task.model_dump())
        db.add(db_task)
        await db.commit()
        await db.refresh(db_task)
        return db_task
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        logger.error(f"Error creating task: {str(e)}")
        raise HTTPException(status_code=500, detail="创建任务失败")

@app.get("/tasks")
async def get_tasks(db: AsyncSession = Depends(get_session)):
    try:
        result = await db.execute(
            select(Task, Device, Algorithm)
            .join(Device, Task.device_id == Device.id)
            .join(Algorithm, Task.algorithm_id == Algorithm.id)
            .order_by(Task.id.desc())
        )
        tasks = result.all()
        
        return [
            {
                "id": task.id,
                "name": task.name,
                "status": task.status,
                "device": {
                    "id": device.id,
                    "name": device.name
                },
                "algorithm": {
                    "id": algorithm.id,
                    "name": algorithm.name
                }
            }
            for task, device, algorithm in tasks
        ]
    except Exception as e:
        raise HTTPException(status_code=500, detail="获取任务列表失败")

@app.delete("/tasks/{task_id}")
async def delete_task(
    task_id: int,
    db: AsyncSession = Depends(get_session)
):
    try:
        result = await db.execute(
            select(Task).where(Task.id == task_id)
        )
        task = result.scalar_one_or_none()
        if not task:
            raise HTTPException(status_code=404, detail="任务不存在")
        
        if task.status == "running":
            raise HTTPException(status_code=400, detail="请先停止任务再删除")
        
        await db.delete(task)
        await db.commit()
        return {"message": "任务删除成功"}
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        logger.error(f"Error deleting task: {str(e)}")
        raise HTTPException(status_code=500, detail="删除任务失败")

@app.post("/tasks/{task_id}/start")
async def start_task(
    task_id: int,
    db: AsyncSession = Depends(get_session)
):
    try:
        logger.info(f"Starting task {task_id}")
        # 获取任务、设备和算法信息
        result = await db.execute(
            select(Task, Device, Algorithm)
            .join(Device)
            .join(Algorithm)
            .where(Task.id == task_id)
        )
        task_info = result.first()
        
        if not task_info:
            logger.error(f"Task {task_id} not found")
            raise HTTPException(status_code=404, detail="任务不存在")
        
        task, device, algorithm = task_info
        logger.info(f"Found task {task_id} with device {device.name}")
        
        # 创建任务日志目录
        result_dir = os.path.join(RESULTS_DIR, f"task_{task.id}")
        os.makedirs(result_dir, exist_ok=True)
        
        # 创建日志文件
        log_file = os.path.join(result_dir, "process.log")
        with open(log_file, "w") as f:
            f.write(f"开始处理任务 {task.id}...\n")
            f.write(f"设备: {device.name}\n")
            f.write(f"RTSP地址: {device.rtsp_url}\n")
            f.write(f"算法: {algorithm.name}\n")
            f.write(f"权重文件: {algorithm.weight_path}\n")
        
        # 验证RTSP流是否可以打开
        cap = cv2.VideoCapture(device.rtsp_url)
        if not cap.isOpened():
            logger.error(f"Failed to open RTSP stream for device {device.name}")
            with open(log_file, "a") as f:
                f.write(f"错误: 无法连接到视频流 {device.rtsp_url}\n")
            raise HTTPException(status_code=400, detail=f"无法连接到视频流，请检查RTSP地址 '{device.name}' 的视频流，请检查RTSP地址")
        
        # 释放摄像头资源
        cap.release()
        
        # 更新任务状态
        task.status = "running"
        await db.commit()
        logger.info(f"Task {task_id} started successfully")
        with open(log_file, "a") as f:
            f.write("任务启动成功\n")
        
        # 创建监控任务
        monitor_task = MonitorTask(
            task_id=task_id,
            status="stopped"  # 初始状态为停止
        )
        db.add(monitor_task)
        await db.commit()
        await db.refresh(monitor_task)
        
        return {"message": "任务已启动，监控已创建"}
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        logger.error(f"Error starting task: {str(e)}")
        raise HTTPException(status_code=500, detail=f"启动任务 {task_id} 失败，请稍后重试")

@app.post("/tasks/{task_id}/stop")
async def stop_task(
    task_id: int,
    db: AsyncSession = Depends(get_session)
):
    try:
        result = await db.execute(
            select(Task).where(Task.id == task_id)
        )
        task = result.scalar_one_or_none()
        if not task:
            raise HTTPException(status_code=404, detail="任务不存在")
        
        task.status = "stopped"
        await db.commit()
        
        # 查找并删除关联的监控任务
        result = await db.execute(
            select(MonitorTask).where(MonitorTask.task_id == task_id)
        )
        monitor_task = result.scalar_one_or_none()
        if monitor_task:
            if monitor_task.status == "running":
                raise HTTPException(status_code=400, detail="请先停止监控任务")
            await db.delete(monitor_task)
            await db.commit()
        
        return {"message": "任务已停止，监控已删除"}
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        logger.error(f"Error stopping task: {str(e)}")
        raise HTTPException(status_code=500, detail=f"停止任务 {task_id} 失败，请稍后重试")

@app.options("/{path:path}")
async def options_handler(request: Request):
    return Response(status_code=200)

def process_video_task(
    task_id: int,
    task_name: str,
    video_path: str,
    algorithm_path: str,
    results_dir: str
):
    try:
        # 初始化处理器
        processor = VideoProcessor(algorithm_path)
        
        # 创建结果目录和日志文件
        result_dir = os.path.join(results_dir, task_name)
        os.makedirs(result_dir, exist_ok=True)
        log_file = os.path.join(result_dir, "process.log")
        
        # 打开视频文件
        cap = cv2.VideoCapture(video_path)
        frame_count = 0
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        
        # 创建视频写入器
        fps = int(cap.get(cv2.CAP_PROP_FPS))
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        output_path = os.path.join(result_dir, "output.mp4")
        fourcc = cv2.VideoWriter_fourcc(*'avc1')
        out = cv2.VideoWriter(output_path, fourcc, fps, (width, height))
        
        # 初始化日志
        with open(log_file, "w") as f:
            f.write("开始处理视频...\n")
        
        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break
            
            # 处理帧
            results = processor.process_frame(frame)
            if not results['success']:
                raise Exception(results['error'])
            
            # 记录日志
            processor.log_results(results, log_file, frame_count, total_frames)
            
            # 保存处理后的帧
            out.write(results['frame'])
            
            # 每30帧保存一个关键帧
            if frame_count % 30 == 0:
                result_path = os.path.join(result_dir, f"frame_{frame_count}.jpg")
                cv2.imwrite(result_path, results['frame'])
            
            frame_count += 1
        
        cap.release()
        out.release()
        return True
        
    except Exception as e:
        logger.error(f"Error processing video: {str(e)}", exc_info=True)
        error_file = os.path.join(result_dir, "error.txt")
        with open(error_file, "w") as f:
            import traceback
            f.write(f"Error: {str(e)}\n\nTraceback:\n{traceback.format_exc()}")
        return False

# 存储进程
process_dict: Dict[int, Process] = {}
# 存储进程间通信的队列
queue_dict: Dict[int, Queue] = {}

async def get_task_info(task_id: int):
    """获取任务信息"""
    try:
        async with async_session() as session:
            result = await session.execute(
                select(Task, Device, Algorithm)
                .join(Device)
                .join(Algorithm)
                .where(Task.id == task_id)
            )
            task_info = result.first()
            if not task_info:
                raise HTTPException(status_code=404, detail="任务不存在")
            return task_info
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting task info: {str(e)}")
        raise HTTPException(status_code=500, detail="获取任务信息失败")

async def update_task_status(task_id: int, status: str):
    """更新任务状态"""
    try:
        async with async_session() as session:
            result = await session.execute(
                select(Task).where(Task.id == task_id)
            )
            task = result.scalar_one_or_none()
            if task:
                task.status = status
                await session.commit()
    except Exception as e:
        logger.error(f"Error updating task status: {str(e)}")
        raise HTTPException(status_code=500, detail="更新任务状态失败")

@app.get("/verify")
async def verify_token(current_user: User = Depends(get_current_user)):
    return {"status": "ok"}

# 测试任务相关路由
@app.post("/test-tasks", response_model=TestTaskResponse)
async def create_test_task(
    task_data: str = Form(...),
    video_file: UploadFile = File(...),
    db: AsyncSession = Depends(get_session)
):
    video_path = None
    try:
        logger.info(f"Received test task data: {task_data}")
        logger.info(f"Received video file: {video_file.filename}")
        # 解析任务数据
        task = TestTaskCreate(**json.loads(task_data))

        # 检查名称是否已存在
        result = await db.execute(
            select(TestTask).where(TestTask.name == task.name)
        )
        if result.scalar_one_or_none():
            logger.warning(f"Test task name already exists: {task.name}")
            raise HTTPException(
                status_code=400, 
                detail=f"测试任务名称 '{task.name}' 已存在"
            )
        
        # 检查算法是否存在
        result = await db.execute(
            select(Algorithm).where(Algorithm.id == task.algorithm_id)
        )
        if not result.scalar_one_or_none():
            raise HTTPException(status_code=404, detail="算法不存在")
        
        # 保存视频文件
        video_filename = f"{task.name}_{video_file.filename}"
        video_path = os.path.join(VIDEOS_DIR, video_filename)
        try:
            with open(video_path, "wb") as buffer:
                shutil.copyfileobj(video_file.file, buffer)
            # 确保文件已经保存
            if not os.path.exists(video_path):
                raise HTTPException(status_code=500, detail="视频文件保存失败")
        except Exception as e:
            logger.error(f"Failed to save video file: {str(e)}")
            raise HTTPException(status_code=500, detail="视频文件保存失败")
        
        # 创建结果目录
        result_dir = os.path.join(RESULTS_DIR, task.name)
        os.makedirs(result_dir, exist_ok=True)

        # 创建测试任务
        db_task = TestTask(
            name=task.name,
            video_path=video_path,
            algorithm_id=task.algorithm_id,
            status='stopped'
        )
        db.add(db_task)
        await db.commit()
        await db.refresh(db_task)
        return db_task
    except HTTPException:
        raise
    except Exception as e:
        # 如果出错，清理已上传的文件
        if video_path and os.path.exists(video_path):
            os.remove(video_path)
        await db.rollback()
        logger.error(f"Error creating test task: {str(e)}")
        raise HTTPException(status_code=500, detail="创建测试任务失败")

@app.get("/test-tasks", response_model=list[TestTaskResponse])
async def get_test_tasks(db: AsyncSession = Depends(get_session)):
    try:
        result = await db.execute(select(TestTask))
        return result.scalars().all()
    except Exception as e:
        logger.error(f"Error getting test tasks: {str(e)}")
        raise HTTPException(status_code=500, detail="获取测试任务列表失败")

class VideoProcessor:
    def __init__(self, model_path: str):
        """初始化视频处理器"""
        from ultralytics import YOLO
        self.model = YOLO(model_path)
        logger.info(f"YOLO model loaded from {model_path}")

    def process_frame(self, frame):
        """处理单帧图像"""
        try:
            results = self.model(frame)
            boxes = results[0].boxes
            processed_frame = results[0].plot()
            return {
                'success': True,
                'frame': processed_frame,
                'boxes': boxes,
                'num_objects': len(boxes)
            }
        except Exception as e:
            logger.error(f"Error processing frame: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }

    def log_results(self, results, log_file, frame_count=None, total_frames=None):
        """记录处理结果到日志"""
        if not results['success']:
                    return
                
        with open(log_file, "a") as f:
            frame_info = f"\n帧 {frame_count}/{total_frames}:" if frame_count is not None else "\n当前帧:"
            f.write(frame_info + "\n")
            f.write(f"检测到 {results['num_objects']} 个目标\n")
            for box in results['boxes']:
                cls = int(box.cls)
                conf = float(box.conf)
                f.write(f"  类别 {cls}, 置信度 {conf:.2f}\n")

# 存储进程
process_dict: Dict[int, Process] = {}

@app.post("/test-tasks/{task_id}/start")
async def start_test_task(task_id: int, db: AsyncSession = Depends(get_session)):
    try:
        result = await db.execute(
            select(TestTask, Algorithm)
            .join(Algorithm)
            .where(TestTask.id == task_id)
        )
        task_info = result.first()
        if not task_info:
            raise HTTPException(status_code=404, detail="测试任务不存在")
        
        task, algorithm = task_info
        
        # 检查视频文件是否存在
        if not os.path.exists(task.video_path):
            raise HTTPException(status_code=400, detail="视频文件不存在")
        
        # 更新任务状态
        task.status = "running"
        await db.commit()
        
        # 启动新进程处理视频
        process = Process(target=process_video_task, args=(
            task_id,
            task.name,
            task.video_path,
            algorithm.weight_path,
            RESULTS_DIR
        ))
        process.start()
        process_dict[task_id] = process
        
        # 启动状态监控
        async def monitor_process():
            while True:
                if not process.is_alive():
                    async with async_session() as session:
                        result = await session.execute(
                            select(TestTask).where(TestTask.id == task_id)
                        )
                        task = result.scalar_one()
                        # 检查结果目录中是否有error.txt来判断是否成功
                        error_file = os.path.join(RESULTS_DIR, task.name, "error.txt")
                        task.status = "error" if os.path.exists(error_file) else "completed"
                        await session.commit()
                    del process_dict[task_id]
                    break
                await asyncio.sleep(1)
        
        asyncio.create_task(monitor_process())
        
        return {"message": f"测试任务 {task_id} 已启动"}
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        logger.error(f"Error starting test task: {str(e)}")
        raise HTTPException(status_code=500, detail=f"启动测试任务 {task_id} 失败")

@app.post("/test-tasks/{task_id}/stop")
async def stop_test_task(task_id: int, db: AsyncSession = Depends(get_session)):
    try:
        result = await db.execute(
            select(TestTask).where(TestTask.id == task_id)
        )
        task = result.scalar_one_or_none()
        if not task:
            raise HTTPException(status_code=404, detail="测试任务不存在")
        
        task.status = "stopped"
        await db.commit()
        return {"message": f"测试任务 {task_id} 已停止"}
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        logger.error(f"Error stopping test task: {str(e)}")
        raise HTTPException(status_code=500, detail=f"停止测试任务 {task_id} 失败")

@app.delete("/test-tasks/{task_id}")
async def delete_test_task(task_id: int, db: AsyncSession = Depends(get_session)):
    try:
        result = await db.execute(
            select(TestTask).where(TestTask.id == task_id)
        )
        task = result.scalar_one_or_none()
        if not task:
            raise HTTPException(status_code=404, detail="测试任务不存在")
        
        if task.status == "running":
            raise HTTPException(status_code=400, detail="请先停止测试任务再删除")
        
        # 删除视频文件
        if os.path.exists(task.video_path):
            os.remove(task.video_path)
        
        # 删除结果目录
        result_dir = os.path.join(RESULTS_DIR, task.name)
        if os.path.exists(result_dir):
            shutil.rmtree(result_dir)
        
        await db.delete(task)
        await db.commit()
        return {"message": "测试任务删除成功"}
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        logger.error(f"Error deleting test task: {str(e)}")
        raise HTTPException(status_code=500, detail="删除测试任务失败")

@app.get("/results/{task_name}/frames")
async def get_test_results(task_name: str):
    try:
        result_dir = os.path.join(RESULTS_DIR, task_name)
        if not os.path.exists(result_dir):
            return {"frames": []}
        
        # 获取所有jpg文件并按帧号排序
        frames = [f for f in os.listdir(result_dir) if f.endswith('.jpg')]
        frames.sort(key=lambda x: int(x.split('_')[1].split('.')[0]))
        
        return {"frames": frames}
    except Exception as e:
        logger.error(f"Error getting test results: {str(e)}")
        raise HTTPException(status_code=500, detail="获取测试结果失败")

@app.get("/results/{task_name}/check-video")
async def check_video_file(task_name: str):
    video_path = os.path.join(RESULTS_DIR, task_name, "output.mp4")
    logger.info(f"Checking video file: {video_path}")
    if os.path.exists(video_path):
        size = os.path.getsize(video_path)
        return {
            "exists": True,
            "path": video_path,
            "size": size,
            "size_mb": size / (1024 * 1024)
        }
    else:
        logger.info(f"Video file does not exist: {video_path}")
        return {"exists": False, "path": video_path}

@app.get("/tasks/{task_id}/log")
async def get_task_log(task_id: int):
    try:
        log_file = os.path.join(RESULTS_DIR, f"task_{task_id}", "process.log")
        if not os.path.exists(log_file):
            return {"log": ""}
        
        with open(log_file, "r") as f:
            log = f.read()
        return {"log": log}
    except Exception as e:
        logger.error(f"Error getting task log: {str(e)}")
        raise HTTPException(status_code=500, detail="获取任务日志失败")

def process_stream_task(
    task_id: int,
    device_url: str,
    algorithm_path: str,
    frame_queue: Queue
):
    try:
        logger.info(f"Stream process started for task {task_id}")
        # 初始化处理器
        processor = VideoProcessor(algorithm_path)
        
        # 创建结果目录和日志文件
        result_dir = os.path.join(RESULTS_DIR, f"task_{task_id}")
        os.makedirs(result_dir, exist_ok=True)
        log_file = os.path.join(result_dir, "monitor_algorithm.log")
        
        # 初始化日志
        with open(log_file, "w") as f:
            f.write(f"开始处理实时视频流...\n")
            f.write(f"设备URL: {device_url}\n")
            f.write(f"算法路径: {algorithm_path}\n")
        
        # 打开视频流
        cap = cv2.VideoCapture(device_url)
        if not cap.isOpened():
            raise Exception(f"无法打开视频流: {device_url}")
        
        frame_count = 0
        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                with open(log_file, "a") as f:
                    f.write("视频流中断，尝试重新连接...\n")
                cap.release()
                time.sleep(1)  # 等待一秒后重试
                cap = cv2.VideoCapture(device_url)
                continue
            
            # 处理帧
            results = processor.process_frame(frame)
            if not results['success']:
                with open(log_file, "a") as f:
                    f.write(f"处理帧失败: {results['error']}\n")
                continue
            
            # 记录日志（每100帧记录一次）
            if frame_count % 100 == 0:
                processor.log_results(results, log_file)
            
            # 将处理后的帧放入队列
            _, buffer = cv2.imencode('.jpg', results['frame'])
            try:
                frame_queue.put(buffer.tobytes(), timeout=0.1)
            except:
                logger.debug(f"Queue full for task {task_id}")
                continue
            
            frame_count += 1
            
    except Exception as e:
        logger.error(f"Error in stream processing: {str(e)}")
        with open(log_file, "a") as f:
            f.write(f"处理错误: {str(e)}\n")
    finally:
        if cap:
            cap.release()
        logger.info(f"Stream process stopped for task {task_id}")

def process_device_preview(
    device_id: int,
    device_url: str,
    frame_queue: Queue
):
    try:
        logger.info(f"Device preview process started for device {device_id}")
        
        # 打开视频流
        cap = cv2.VideoCapture(device_url)
        if not cap.isOpened():
            error_msg = f"无法连接到设备，请检查RTSP地址是否正确"
            frame_queue.put(json.dumps({"error": error_msg}).encode())
            return
        
        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                logger.warning(f"Failed to read frame from device {device_id}, stopping preview")
                error_msg = "视频流读取失败，请检查设备状态"
                frame_queue.put(json.dumps({"error": error_msg}).encode())
                break
                continue
            
            # 压缩并发送帧
            _, buffer = cv2.imencode('.jpg', frame)
            try:
                frame_queue.put(buffer.tobytes(), timeout=0.1)
            except:
                continue
            
    except Exception as e:
        logger.error(f"Error in device preview: {str(e)}")
    finally:
        if cap:
            cap.release()
        logger.info(f"Device preview process stopped for device {device_id}")

@app.websocket("/ws/device-preview/{device_id}")
async def device_preview(websocket: WebSocket, device_id: int):
    try:
        await websocket.accept()
        logger.info(f"WebSocket connection established for device preview {device_id}")
        
        # 验证 token
        auth_data = await websocket.receive_json()
        token = auth_data.get("token", "")
        
        try:
            # 获取设备 RTSP URL
            rtsp_url = await get_device_rtsp_url(device_id)
        except HTTPException:
            await websocket.close(code=4004)
            return
        
        # 创建新的队列
        queue_dict[device_id] = Queue(maxsize=30)
        
        # 启动预览进程
        process = Process(target=process_device_preview, args=(
            device_id,
            rtsp_url,
            queue_dict[device_id]
        ))
        process.start()
        process_dict[device_id] = process
        
        # 接收和发送帧
        while True:
            try:
                if device_id not in queue_dict:
                    await websocket.close(code=4004)
                    break
                # 使用异步执行器从队列中获取数据
                frame_data = await asyncio.get_event_loop().run_in_executor(
                    None,
                    lambda: queue_dict[device_id].get(timeout=0.1)
                )
                await websocket.send_bytes(frame_data)
            except Empty:
                await asyncio.sleep(0.01)
                continue
            except Exception as e:
                logger.error(f"Error sending frame for device {device_id}: {str(e)}")
                break
                
    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected for device preview {device_id}")
    except Exception as e:
        logger.error(f"Error in device preview: {str(e)}")
    finally:
        # 清理资源
        if device_id in process_dict:
            process = process_dict[device_id]
            process.terminate()
            await asyncio.get_event_loop().run_in_executor(None, process.join)
            del process_dict[device_id]
        if device_id in queue_dict:
            del queue_dict[device_id]

async def get_device_rtsp_url(device_id: int) -> str:
    """获取设备的RTSP URL"""
    async with async_session() as session:
        result = await session.execute(
            select(Device).where(Device.id == device_id)
        )
        device = result.scalar_one_or_none()
        if not device:
            raise HTTPException(status_code=404, detail="设备不存在")
        return device.rtsp_url

class MonitorTaskCreate(BaseModel):
    task_id: int

@app.post("/monitor-tasks")
async def create_monitor_task(
    task: MonitorTaskCreate,
    db: AsyncSession = Depends(get_session)
):
    try:
        # 检查任务是否存在
        task_result = await db.execute(
            select(Task).where(Task.id == task.task_id)
        )
        task_obj = task_result.scalar_one_or_none()
        if not task_obj:
            raise HTTPException(status_code=404, detail="任务不存在")
        
        # 检查是否已存在该任务的监控
        monitor_result = await db.execute(
            select(MonitorTask).where(MonitorTask.task_id == task.task_id)
        )
        if monitor_result.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="该任务的监控已存在")
        
        # 创建监控任务
        monitor_task = MonitorTask(task_id=task.task_id, status="stopped")
        db.add(monitor_task)
        await db.commit()
        await db.refresh(monitor_task)
        
        return monitor_task
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail="创建监控任务失败")

@app.post("/monitor-tasks/{monitor_id}/start")
async def start_monitor_task(monitor_id: int, db: AsyncSession = Depends(get_session)):
    try:
        # 获取监控任务信息
        result = await db.execute(
            select(MonitorTask, Task, Device, Algorithm)
            .join(Task, MonitorTask.task_id == Task.id)
            .join(Device, Task.device_id == Device.id)
            .join(Algorithm, Task.algorithm_id == Algorithm.id)
            .where(MonitorTask.id == monitor_id)
        )
        monitor_info = result.first()
        if not monitor_info:
            raise HTTPException(status_code=404, detail="监控任务不存在")
        
        monitor, task, device, algorithm = monitor_info
        
        # 检查任务是否在运行
        if task.status != "running":
            raise HTTPException(status_code=400, detail="请先启动对应的任务")
        
        # 更新状态
        monitor.status = "running"
        await db.commit()
        
        # 创建新的队列
        queue_key = f"monitor_{monitor_id}"
        queue_dict[queue_key] = Queue(maxsize=30)
        
        # 启动处理进程
        process = Process(target=process_stream_task, args=(
            task.id,
            device.rtsp_url,
            algorithm.weight_path,
            queue_dict[queue_key]
        ))
        process.start()
        process_dict[queue_key] = process
        
        return {"message": "监控任务已启动"}
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        # 清理资源
        queue_key = f"monitor_{monitor_id}"
        if queue_key in process_dict:
            process_dict[queue_key].terminate()
            process_dict[queue_key].join()
            del process_dict[queue_key]
        if queue_key in queue_dict:
            del queue_dict[queue_key]
        raise HTTPException(status_code=500, detail="启动监控任务失败")

@app.websocket("/ws/monitor-tasks/{monitor_id}")
async def monitor_task_ws(websocket: WebSocket, monitor_id: int):
    queue_key = f"monitor_{monitor_id}"
    try:
        await websocket.accept()
        
        # 检查监控任务是否存在且正在运行
        async with async_session() as session:
            result = await session.execute(
                select(MonitorTask).where(
                    MonitorTask.id == monitor_id,
                    MonitorTask.status == "running"
                )
            )
            if not result.scalar_one_or_none():
                await websocket.close(code=4004)
                return
        
        # 接收和发送帧
        while True:
            try:
                if queue_key not in queue_dict:
                    await websocket.close(code=4004)
                    break
                frame_data = await asyncio.get_event_loop().run_in_executor(
                    None,
                    lambda: queue_dict[queue_key].get(timeout=0.1)
                )
                await websocket.send_bytes(frame_data)
            except Empty:
                await asyncio.sleep(0.01)
                continue
            except Exception as e:
                logger.error(f"Error sending frame for monitor {monitor_id}: {str(e)}")
                break
                
    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected for monitor {monitor_id}")
    except Exception as e:
        logger.error(f"Error in monitor task WebSocket: {str(e)}")
    finally:
        # 异步清理资源
        pass
        # if queue_key in process_dict:
        #     process = process_dict[queue_key]
        #     process.terminate()
        #     await asyncio.get_event_loop().run_in_executor(
        #         None,
        #         lambda: process.join(timeout=1)
        #     )
        #     del process_dict[queue_key]
        # if queue_key in queue_dict:
        #     del queue_dict[queue_key]

@app.post("/monitor-tasks/{monitor_id}/stop")
async def stop_monitor_task(
    monitor_id: int,
    db: AsyncSession = Depends(get_session)
):
    try:
        result = await db.execute(
            select(MonitorTask).where(MonitorTask.id == monitor_id)
        )
        monitor = result.scalar_one_or_none()
        if not monitor:
            raise HTTPException(status_code=404, detail="监控任务不存在")
        
        monitor.status = "stopped"
        await db.commit()
        
        # 清理资源
        queue_key = f"monitor_{monitor_id}"
        if queue_key in process_dict:
            process_dict[queue_key].terminate()
            process_dict[queue_key].join()
            del process_dict[queue_key]
        if queue_key in queue_dict:
            del queue_dict[queue_key]
        
        return {"message": "监控任务已停止"}
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail="停止监控任务失败")

@app.delete("/monitor-tasks/{monitor_id}")
async def delete_monitor_task(
    monitor_id: int,
    db: AsyncSession = Depends(get_session)
):
    try:
        result = await db.execute(
            select(MonitorTask).where(MonitorTask.id == monitor_id)
        )
        monitor = result.scalar_one_or_none()
        if not monitor:
            raise HTTPException(status_code=404, detail="监控任务不存在")
        
        if monitor.status == "running":
            raise HTTPException(status_code=400, detail="请先停止监控任务再删除")
        
        await db.delete(monitor)
        await db.commit()
        
        return {"message": "监控任务已删除"}
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail="删除监控任务失败")

@app.get("/monitor-tasks")
async def get_monitor_tasks(db: AsyncSession = Depends(get_session)):
    try:
        result = await db.execute(
            select(MonitorTask, Task)
            .join(Task, MonitorTask.task_id == Task.id)
            .order_by(MonitorTask.id.desc())
        )
        monitors = result.all()
        
        return [
            {
                "id": monitor.id,
                "task_id": monitor.task_id,
                "status": monitor.status,
                "task_name": task.name,
                "created_at": monitor.created_at
            }
            for monitor, task in monitors
        ]
    except Exception as e:
        raise HTTPException(status_code=500, detail="获取监控任务列表失败")

# 获取当前用户信息
@app.get("/users/me")
async def get_current_user_info(
    current_user: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_session)
):
    try:
        result = await db.execute(
            select(User).where(User.username == current_user)
        )
        user = result.scalar_one_or_none()
        if not user:
            raise HTTPException(status_code=404, detail="用户不存在")
        
        return {
            "username": user.username,
            "is_superuser": user.is_superuser
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail="获取用户信息失败")

# 获取用户列表（仅超级管理员可访问）
@app.get("/users")
async def get_users(
    current_user: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_session)
):
    try:
        # 检查是否是超级管理员
        result = await db.execute(
            select(User).where(User.username == current_user)
        )
        user = result.scalar_one_or_none()
        if not user or not user.is_superuser:
            raise HTTPException(status_code=403, detail="没有权限访问")
        
        # 获取所有用户
        result = await db.execute(select(User))
        users = result.scalars().all()
        
        return [
            {
                "id": user.id,
                "username": user.username,
                "status": user.status,
                "created_at": user.created_at,
                "is_superuser": user.is_superuser
            }
            for user in users
        ]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail="获取用户列表失败")

# 更新用户状态（仅超级管理员可访问）
@app.put("/users/{user_id}/status")
async def update_user_status(
    user_id: int,
    status: dict,
    current_user: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_session)
):
    try:
        # 检查是否是超级管理员
        admin_result = await db.execute(
            select(User).where(User.username == current_user)
        )
        admin = admin_result.scalar_one_or_none()
        if not admin or not admin.is_superuser:
            raise HTTPException(status_code=403, detail="没有权限访问")
        
        # 更新用户状态
        result = await db.execute(
            select(User).where(User.id == user_id)
        )
        user = result.scalar_one_or_none()
        if not user:
            raise HTTPException(status_code=404, detail="用户不存在")
        
        if user.is_superuser:
            raise HTTPException(status_code=400, detail="不能修改超级管理员状态")
        
        user.status = status["status"]
        await db.commit()
        
        return {"message": "更新状态成功"}
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail="更新状态失败")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host=settings.HOST, 
        port=settings.PORT,
        reload=True
    )
