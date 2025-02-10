class Settings:
    # 服务器配置
    HOST = "0.0.0.0"
    PORT = 8000
    
    # JWT配置
    SECRET_KEY = "your-secret-key-please-change-in-production"
    ALGORITHM = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES = 30
    
    # RTSP流配置
    RTSP_TIMEOUT = 30
    
settings = Settings() 