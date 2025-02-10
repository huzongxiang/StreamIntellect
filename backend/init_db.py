import asyncio
import logging
import bcrypt
from sqlalchemy import select
from database import async_session, init_db
from models import User
from tenacity import retry, stop_after_attempt, wait_fixed

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@retry(stop=stop_after_attempt(3), wait=wait_fixed(2))
async def create_admin_user():
    """创建管理员用户"""
    try:
        async with async_session() as session:
            # 检查管理员用户是否已存在
            result = await session.execute(
                select(User).where(User.username == "admin123")
            )
            if result.scalar_one_or_none():
                logger.info("Admin user already exists")
                return

            # 创建管理员用户
            hashed_password = bcrypt.hashpw("admin123".encode('utf-8'), bcrypt.gensalt())
            admin_user = User(
                username="admin123",
                password=hashed_password.decode('utf-8'),
                is_superuser=True,  # 设置为超级管理员
                status="approved"  # 设置状态为已通过
            )
            session.add(admin_user)
            await session.commit()
            logger.info("Admin user created successfully")
    except Exception as e:
        logger.error(f"Error creating admin user: {str(e)}")
        raise

async def init_database():
    """初始化数据库"""
    try:
        # 先创建数据库表
        logger.info("Creating database tables...")
        await init_db()
        logger.info("Database tables created successfully")

        # 然后创建管理员用户
        logger.info("Creating admin user...")
        await create_admin_user()
        logger.info("Database initialization completed")
    except Exception as e:
        logger.error(f"Database initialization failed: {str(e)}")
        raise

def main():
    """主函数"""
    try:
        asyncio.run(init_database())
        logger.info("Database setup completed successfully")
    except Exception as e:
        logger.error(f"Database setup failed: {str(e)}")
        raise

if __name__ == "__main__":
    main() 