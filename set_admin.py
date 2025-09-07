#!/usr/bin/env python3
"""
设置管理员用户的脚本
使用方法: python set_admin.py <user_id>
"""

import sys
import os
from datetime import datetime, timezone

# 添加项目根目录到Python路径
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from server.database import DatabaseService

def set_admin(user_id):
    """将指定用户设置为管理员"""
    try:
        with DatabaseService() as db:
            # 检查用户是否存在
            user = db.get_user_by_id(user_id)
            if not user:
                print(f"错误: 用户 {user_id} 不存在")
                return False
            
            # 更新用户角色为admin
            db.update_user(user_id, role='admin', updated_at=datetime.now(timezone.utc))
            
            print(f"成功: 用户 {user_id} 已设置为管理员")
            print(f"用户名: {user.username}")
            print(f"邮箱: {user.email}")
            return True
            
    except Exception as e:
        print(f"错误: 设置管理员失败 - {str(e)}")
        return False

def list_users():
    """列出所有用户"""
    try:
        with DatabaseService() as db:
            users = db.db.query(db.User).filter(db.User.deleted_at.is_(None)).all()
            
            print("所有用户列表:")
            print("-" * 80)
            print(f"{'用户ID':<15} {'用户名':<20} {'邮箱':<30} {'角色':<10}")
            print("-" * 80)
            
            for user in users:
                print(f"{user.id:<15} {user.username or 'N/A':<20} {user.email or 'N/A':<30} {user.role:<10}")
            
            return True
            
    except Exception as e:
        print(f"错误: 获取用户列表失败 - {str(e)}")
        return False

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("使用方法:")
        print("  python set_admin.py <user_id>  # 设置指定用户为管理员")
        print("  python set_admin.py list       # 列出所有用户")
        sys.exit(1)
    
    command = sys.argv[1]
    
    if command == "list":
        list_users()
    else:
        user_id = command
        set_admin(user_id)
