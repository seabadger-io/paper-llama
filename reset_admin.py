import asyncio
import sys
import getpass
import os

from sqlalchemy.future import select
from backend.app.db.session import AsyncSessionLocal, init_engine, DATABASE_URL
from backend.app.db.models import AdminUser
from backend.app.core.security import get_password_hash

async def reset_password():
    print("Paper Llama Admin Password Reset")
    print("-------------------------------------")
    print(f"Database: {DATABASE_URL}")
    await init_engine()

    username = input("Enter the admin username to reset (or create): ").strip()
    if not username:
        print("Username cannot be empty.")
        sys.exit(1)

    password = getpass.getpass("Enter new password: ").strip()
    if not password:
        print("Password cannot be empty.")
        sys.exit(1)
        
    confirm_password = getpass.getpass("Confirm new password: ").strip()
    if password != confirm_password:
        print("Passwords do not match.")
        sys.exit(1)

    async with AsyncSessionLocal() as session:
        query = select(AdminUser).where(AdminUser.username == username)
        result = await session.execute(query)
        user = result.scalar_one_or_none()

        if user:
            print(f"User '{username}' found. Updating password...")
            user.hashed_password = get_password_hash(password)
        else:
            print(f"User '{username}' not found. Creating new admin user...")
            new_user = AdminUser(
                username=username,
                hashed_password=get_password_hash(password)
            )
            session.add(new_user)
            
        await session.commit()
        print("Success! Password has been updated.")

if __name__ == "__main__":
    asyncio.run(reset_password())
