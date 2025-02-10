from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, UniqueConstraint, Boolean
from sqlalchemy.orm import declarative_base, relationship
from datetime import datetime

Base = declarative_base()

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    password = Column(String)
    is_superuser = Column(Boolean, default=False)  # 是否是超级管理员
    status = Column(String, default='pending')  # pending: 待审核, approved: 已通过, rejected: 已拒绝
    created_at = Column(DateTime, default=datetime.utcnow)

class Device(Base):
    __tablename__ = "devices"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    rtsp_url = Column(String)

class Algorithm(Base):
    __tablename__ = "algorithms"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    weight_path = Column(String)

class Task(Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True)
    name = Column(String, unique=True, nullable=False)
    device_id = Column(Integer, ForeignKey("devices.id"))
    algorithm_id = Column(Integer, ForeignKey("algorithms.id"))
    status = Column(String, default="stopped")

    # 添加反向关系
    monitor_task = relationship("MonitorTask", back_populates="task", uselist=False)

class TestTask(Base):
    __tablename__ = "test_tasks"

    id = Column(Integer, primary_key=True)
    name = Column(String, unique=True, nullable=False)
    video_path = Column(String, nullable=False)
    algorithm_id = Column(Integer, ForeignKey("algorithms.id"))
    status = Column(String, default="stopped")

class MonitorTask(Base):
    __tablename__ = "monitor_tasks"
    
    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("tasks.id"), unique=True, nullable=False)
    status = Column(String, default="stopped")  # running/stopped
    created_at = Column(DateTime, default=datetime.utcnow)
    
    task = relationship("Task", back_populates="monitor_task")

    __table_args__ = (
        UniqueConstraint('task_id', name='uq_monitor_task_task_id'),
    ) 