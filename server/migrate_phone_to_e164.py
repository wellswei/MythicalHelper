#!/usr/bin/env python3
"""
数据库迁移脚本：将手机号统一转换为E164格式
"""

from database import get_db
from models import User
import re

def normalize_phone_to_e164(v: str) -> str:
    """将手机号转换为E164格式"""
    if not v:
        return v
    
    # 移除所有空格
    cleaned = re.sub(r"\s+", "", v.strip())
    
    # 如果已经是E164格式，直接返回
    if cleaned.startswith('+'):
        return cleaned
    
    # 如果不是E164格式，添加+号
    # 如果以1开头且长度为11位，添加+号
    if len(cleaned) == 11 and cleaned[0] == '1':
        return '+' + cleaned
    # 如果长度为10位，添加+1前缀
    elif len(cleaned) == 10:
        return '+1' + cleaned
    # 其他情况，直接添加+号
    else:
        return '+' + cleaned

def migrate_phone_numbers():
    """迁移所有用户的手机号到E164格式"""
    with get_db() as db:
        # 获取所有有手机号的用户
        users = db.db.query(User).filter(User.phone.isnot(None)).all()
        
        print(f"找到 {len(users)} 个用户需要迁移手机号格式")
        print("=" * 60)
        
        updated_count = 0
        for user in users:
            old_phone = user.phone
            new_phone = normalize_phone_to_e164(old_phone)
            
            if old_phone != new_phone:
                print(f"用户 {user.id} ({user.username or 'N/A'}):")
                print(f"  旧格式: {old_phone}")
                print(f"  新格式: {new_phone}")
                
                # 更新数据库
                user.phone = new_phone
                updated_count += 1
            else:
                print(f"用户 {user.id} ({user.username or 'N/A'}): 已经是E164格式 - {old_phone}")
        
        # 提交更改
        db.db.commit()
        
        print("=" * 60)
        print(f"迁移完成！更新了 {updated_count} 个用户的手机号格式")

if __name__ == "__main__":
    migrate_phone_numbers()
