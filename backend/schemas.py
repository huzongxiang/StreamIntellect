from pydantic import BaseModel
from typing import Optional

# 用户相关
class UserCreate(BaseModel):
    username: str
    password: str

class UserResponse(BaseModel):
    id: int
    username: str

    class Config:
        from_attributes = True

# 设备相关
class DeviceCreate(BaseModel):
    name: str
    rtsp_url: str

class DeviceResponse(BaseModel):
    id: int
    name: str
    rtsp_url: str

    class Config:
        from_attributes = True

# 算法相关
class AlgorithmCreate(BaseModel):
    name: str
    weight_path: str

class AlgorithmResponse(BaseModel):
    id: int
    name: str
    weight_path: str

    class Config:
        from_attributes = True

# 任务相关
class TaskCreate(BaseModel):
    name: str
    device_id: int
    algorithm_id: int
    status: str = 'stopped'

class TaskResponse(BaseModel):
    id: int
    name: str
    device_id: int
    algorithm_id: int
    status: str

    class Config:
        from_attributes = True

# 测试任务相关
class TestTaskCreate(BaseModel):
    name: str
    algorithm_id: int
    status: str = 'stopped'

class TestTaskResponse(BaseModel):
    id: int
    name: str
    video_path: str
    algorithm_id: int
    status: str

    class Config:
        from_attributes = True 