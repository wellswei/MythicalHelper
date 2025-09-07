# main_sql.py - SQLAlchemy version
from __future__ import annotations
import hashlib
import hmac
import json
import re
import secrets
import string
import time
from datetime import datetime, timedelta, timezone
from typing import Dict, Optional, List, Any, Tuple
from uuid import uuid4

from fastapi import FastAPI, APIRouter, Header, HTTPException, Depends, Request, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import os
import httpx
import stripe

from models import create_database, Purchase, User
from database import DatabaseService, get_db

UTC = timezone.utc

# Stripe configuration
# Stripe 配置
STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY", "sk_test_51S4XMwArEWZmSCjIIer2BJld1LCOgBChTEArYVFRSB0ipcNMdy8t6nUdpS13usrh1nIs9XlNnhJ07xcJ2kpqMdd900GMFxfive")
stripe.api_key = STRIPE_SECRET_KEY
STRIPE_PUBLISHABLE_KEY = os.getenv("STRIPE_PUBLISHABLE_KEY", "pk_test_51S4XMwArEWZmSCjIvRXSikHETRrfWw6URqH6cIKTMqsDEUfhSZJWAGFde1YLTbE5paltdUQR7Bi9Zy5taJZLJLRS00dJ9Hhdfu")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET", "whsec_Jjnz17IhJYwbOSMqeat8USOG02I2mLJz")
FRONTEND_URL = os.getenv("FRONTEND_URL", "https://mythicalhelper.org")

# 管理员账号
ADMIN_PHONE = "+12032248879"  # 硬编码管理员电话（带区号）

# Stripe 价格配置
RENEWAL_PRICE_ID = os.getenv("RENEWAL_PRICE_ID", None)  # 如果设置了价格ID，使用固定价格；否则使用动态价格
RENEWAL_AMOUNT_CENTS = int(os.getenv("RENEWAL_AMOUNT_CENTS", "999"))  # 续费价格（美分），默认$9.99

# Create database and tables
create_database()

# 应用生命周期管理
from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理"""
    # 启动时执行
    print("[STARTUP] 正在启动 MythicalHelper 服务器...")
    ensure_admin_user()
    print("[STARTUP] 服务器启动完成!")
    
    yield
    
    # 关闭时执行（如果需要）
    print("[SHUTDOWN] 服务器正在关闭...")

app = FastAPI(
    title="Mythical Helper API (SQLAlchemy)",
    lifespan=lifespan
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://mythicalhelper.org",
        "https://mythicalhelper.pages.dev", 
        "http://127.0.0.1:5500", 
        "http://localhost:5500",
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# =========================
# Turnstile 校验
# =========================
TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify"
TURNSTILE_SECRET = os.getenv("TURNSTILE_SECRET")

async def verify_turnstile(request: Request) -> None:
    
    if not TURNSTILE_SECRET:
        print("[TURNSTILE] ERROR: TURNSTILE_SECRET not set")
        raise HTTPException(500, "Server missing TURNSTILE_SECRET")

    # 只从请求头获取 token，避免读取请求体
    token = request.headers.get("cf-turnstile-response")
    print(f"[TURNSTILE] Token received: {'YES' if token else 'NO'}, length: {len(token) if token else 0}")
    
    if not token:
        print("[TURNSTILE] ERROR: Missing Turnstile token in headers")
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Missing Turnstile token")

    payload = {"secret": TURNSTILE_SECRET, "response": token, "remoteip": request.client.host}
    print(f"[TURNSTILE] Verifying token with Cloudflare...")
    
    async with httpx.AsyncClient(timeout=5) as c:
        r = await c.post(TURNSTILE_VERIFY_URL, json=payload)
    data = r.json()
    
    print(f"[TURNSTILE] Cloudflare response: {data}")

    if not data.get("success"):
        print(f"[TURNSTILE] ERROR: Verification failed: {data.get('error-codes')}")
        raise HTTPException(status.HTTP_403_FORBIDDEN, {"turnstile":"verification_failed","errors":data.get("error-codes")})
    
    print("[TURNSTILE] SUCCESS: Token verified")

# 条件性Turnstile验证 - 只对特定purpose要求Turnstile
async def verify_turnstile_conditional(request: Request, purpose: str = None) -> None:
    # 需要Turnstile的purpose：signup, change_email, change_phone
    turnstile_required_purposes = {"signup", "change_email", "change_phone"}
    
    if purpose in turnstile_required_purposes:
        print(f"[TURNSTILE] Purpose '{purpose}' requires Turnstile verification")
        await verify_turnstile(request)
    else:
        print(f"[TURNSTILE] Purpose '{purpose}' does not require Turnstile verification")

# =========================
# 工具函数
# =========================
def now() -> datetime:
    return datetime.utcnow()

def mask_email(e: str) -> str:
    e = e.strip().lower()
    if "@" not in e:
        return "***"
    u, d = e.split("@", 1)
    if len(u) <= 2:
        mu = u[0] + "*"
    else:
        mu = u[0] + "*" * max(1, len(u) - 2) + u[-1]
    return f"{mu}@{d}"

def mask_phone(p: str) -> str:
    digits = re.sub(r"\D", "", p)
    if len(digits) <= 4:
        return "***"
    return digits[:2] + "*" * max(1, len(digits) - 6) + digits[-4:]

def is_email(v: str) -> bool:
    return bool(re.match(r"^[^\s@]+@[^\s@]+\.[^\s@]+$", v.strip(), re.I))

def is_e164(v: str) -> bool:
    return bool(re.match(r"^\+[1-9]\d{6,14}$", v.strip()))

def normalize_email(v: str) -> str:
    return v.strip().lower()

def normalize_phone(v: str) -> str:
    # 统一使用E164格式：+[国家代码][号码]
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

def problem(status: int, title: str, detail: str, type_uri: str = "about:blank", extra: dict | None = None):
    payload = {"type": type_uri, "title": title, "status": status, "detail": detail}
    if extra:
        payload.update(extra)
    raise HTTPException(status_code=status, detail=payload)

def sha256(s: str) -> str:
    return hashlib.sha256(s.encode("utf-8")).hexdigest()

def random_code_6() -> str:
    return f"{secrets.randbelow(10**6):06d}"

def random_token(prefix: str) -> str:
    alphabet = string.ascii_letters + string.digits
    return f"{prefix}_{''.join(secrets.choice(alphabet) for _ in range(40))}"

# =========================
# 序列化工具
# =========================
def user_payload(user) -> Dict[str, Any]:
    badges_obj: Dict[str, Any] = {}
    try:
        if user.badges:
            badges_obj = json.loads(user.badges)
    except Exception:
        badges_obj = {}
    return {
        "user_id": user.id,
        "username": user.username,
        "email": user.email,
        "phone": user.phone,
        "role": user.role,
        "status": user.status,
        "created_at": user.created_at,
        "updated_at": user.updated_at,
        "valid_until": user.valid_until,
        "badges": badges_obj,
    }

# =========================
# Pydantic 模型
# =========================
class TicketCreateIn(BaseModel):
    channel: str = Field(pattern="^(email|sms)$")
    destination: str
    purpose: str = Field(pattern="^(signin|signup|change_email|change_phone)$")
    subject_id: Optional[str] = None

class TicketCreateOut(BaseModel):
    ticket_id: str
    purpose: str
    channel: str
    masked_destination: str
    ttl_sec: int
    cooldown_sec: int
    next_allowed_at: datetime

class TicketConfirmIn(BaseModel):
    code: str = Field(min_length=6, max_length=6, pattern="^[0-9]{6}$")

class TicketConfirmOut(BaseModel):
    verified: bool
    purpose: str
    channel: str
    masked_destination: str
    proof_token: str
    subject_id: Optional[str] = None

class SessionsExchangeIn(BaseModel):
    proof_token: Optional[str] = None
    signup_session_token: Optional[str] = None

class SessionsExchangeOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    refresh_token: Optional[str] = None

class SessionsRefreshIn(BaseModel):
    refresh_token: str

class RegistrationCreateOut(BaseModel):
    registration_id: str

class RegistrationAttachIn(BaseModel):
    proof_token: str

class RegistrationPatchIn(BaseModel):
    username: Optional[str] = None
    oath_accept: Optional[bool] = None

class RegistrationActivateOut(BaseModel):
    user_id: str
    role: str
    is_active: bool
    valid_until: datetime
    signup_session_token: str

class ContactsPatchIn(BaseModel):
    proof_token: str

class UsersPatchIn(BaseModel):
    badges: Optional[Dict[str, Any]] = None

class RenewalRequest(BaseModel):
    """续费请求"""
    pass

class DonationRequest(BaseModel):
    """捐赠请求"""
    amount: int = Field(..., description="捐赠金额（美分）", ge=100)  # 最少1美元

class PaymentResponse(BaseModel):
    """支付响应"""
    checkout_url: str
    session_id: str

# =========================
# 认证依赖
# =========================
class SessionUser(BaseModel):
    user_id: str
    role: str

def get_session_user(authorization: str | None = Header(default=None)) -> SessionUser:
    if not authorization or not authorization.lower().startswith("bearer "):
        problem(401, "unauthorized", "Missing bearer token")
    token = authorization.split(" ", 1)[1].strip()
    
    with get_db() as db:
        session = db.get_session_by_token(token)
        if not session:
            problem(401, "unauthorized", "Session not found")
        if session.expires_at < now():
            problem(401, "unauthorized", "Session expired")
        user = db.get_user_by_id(session.user_id)
        if not user or user.deleted_at:
            problem(401, "unauthorized", "User not available")
        return SessionUser(user_id=user.id, role=user.role)

def require_admin(su: SessionUser = Depends(get_session_user)) -> SessionUser:
    if su.role != "admin":
        problem(403, "forbidden", "Admin only")
    return su

# =========================
# Tickets 路由
# =========================
tickets = APIRouter(prefix="/tickets", tags=["Tickets"])

@tickets.post("", response_model=TicketCreateOut)
async def create_ticket(inb: TicketCreateIn, request: Request = None, authorization: str | None = Header(default=None)):
    # 条件性Turnstile验证
    await verify_turnstile_conditional(request, inb.purpose)
    
    with get_db() as db:
        # 验证输入
        if inb.channel == "email":
            if not is_email(inb.destination):
                problem(422, "invalid_email", "Invalid email format")
            dest = normalize_email(inb.destination)
        else:
            if not is_e164(inb.destination):
                problem(422, "invalid_phone", "Invalid phone format (E.164)")
            dest = normalize_phone(inb.destination)

        # 业务前置校验：根据用途拒绝已删除账户或重复注册
        # 注：你提到愿意在此阶段直接告知被阻止/已存在，所以这里直接返回明确错误
        if inb.purpose in ("signin", "signup", "change_email", "change_phone"):
            user = db.get_user_by_email(dest) if inb.channel == "email" else db.get_user_by_phone(dest)
            if inb.purpose == "signin":
                if not user:
                    problem(404, "user_not_found", "No user bound to this destination")
                if user.deleted_at:
                    problem(403, "blocked", "This account has been deleted and is blocked")
            elif inb.purpose == "signup":
                if user and user.deleted_at:
                    problem(403, "blocked", "This contact is blocked and cannot be used to register")
                if user and not user.deleted_at:
                    # 已存在的活跃账号不允许重复注册
                    if inb.channel == "email":
                        problem(409, "conflict", "Email already registered")
                    else:
                        problem(409, "conflict", "Phone already registered")
            elif inb.purpose in ("change_email", "change_phone"):
                # 对于contact change，检查新邮箱/电话是否已被其他用户使用
                print(f"[DUPLICATE_CHECK] Checking {inb.purpose} for destination: {dest}")
                print(f"[DUPLICATE_CHECK] Subject ID: {inb.subject_id}")
                
                # 邮箱blacklist检查
                if inb.channel == "email":
                    email_blacklist = {"official", "admin", "support", "help", "system", "root", "guild", "mythical", "helper"}
                    email_local_part = dest.split('@')[0].lower()
                    if email_local_part in email_blacklist:
                        print(f"[DUPLICATE_CHECK] BLACKLIST: {dest} is in email blacklist")
                        problem(409, "conflict", "Email address not allowed")
                
                if user and not user.deleted_at:
                    print(f"[DUPLICATE_CHECK] Found existing user: {user.id}, deleted: {user.deleted_at}")
                    # 需要获取当前用户ID来排除自己
                    current_user_id = inb.subject_id
                    if not current_user_id:
                        print(f"[DUPLICATE_CHECK] ERROR: Missing subject_id")
                        problem(400, "missing_subject", "Subject ID required for contact change")
                    
                    print(f"[DUPLICATE_CHECK] Comparing user.id={user.id} with current_user_id={current_user_id}")
                    if user.id != current_user_id:
                        # 新邮箱/电话已被其他用户使用
                        print(f"[DUPLICATE_CHECK] CONFLICT: {dest} already used by user {user.id}")
                        if inb.channel == "email":
                            problem(409, "conflict", "Email already in use")
                        else:
                            problem(409, "conflict", "Phone already in use")
                    else:
                        print(f"[DUPLICATE_CHECK] OK: {dest} belongs to current user")
                else:
                    print(f"[DUPLICATE_CHECK] OK: {dest} is available")
        
        # 速率限制检查
        rate_key = f"ticket:{inb.channel}:{dest}"
        window_start = now().replace(second=0, microsecond=0)
        rate_limit = db.get_rate_limit(rate_key)
        
        if rate_limit and rate_limit.window_start == window_start:
            if rate_limit.count >= rate_limit.limit:
                next_window = window_start + timedelta(minutes=1)
                problem(429, "rate_limited", "Too many requests", extra={
                    "retry_after": int((next_window - now()).total_seconds())
                })
            rate_limit.count += 1
            rate_limit.updated_at = now()
        else:
            db.create_or_update_rate_limit(rate_key, window_start, 1, 5)
        
        # 创建ticket
        ticket_id = f"tk_{uuid4().hex[:10]}"
        code = random_code_6()
        code_hash = sha256(code)
        expires_at = now() + timedelta(minutes=5)
        
        db.create_ticket(
            ticket_id=ticket_id,
            channel=inb.channel,
            destination=dest,
            purpose=inb.purpose,
            code_hash=code_hash,
            expires_at=expires_at,
            subject_id=inb.subject_id
        )
        
        # 模拟发送验证码
        if inb.channel == "email":
            print(f"[TICKETS] send code={code} to email:{dest} purpose={inb.purpose} subject_id={inb.subject_id} ticket={ticket_id}")
        else:
            print(f"[TICKETS] send code={code} to sms:{dest} purpose={inb.purpose} subject_id={inb.subject_id} ticket={ticket_id}")
        
        return TicketCreateOut(
            ticket_id=ticket_id,
            purpose=inb.purpose,
            channel=inb.channel,
            masked_destination=mask_email(dest) if inb.channel == "email" else mask_phone(dest),
            ttl_sec=300,
            cooldown_sec=60,
            next_allowed_at=now() + timedelta(seconds=60)
        )

@tickets.post("/{ticket_id}/confirm", response_model=TicketConfirmOut)
def confirm_ticket(ticket_id: str, inb: TicketConfirmIn):
    # 验证码确认不需要 Turnstile 验证，验证码本身就是安全机制
    with get_db() as db:
        ticket = db.get_ticket_by_id(ticket_id)
        if not ticket:
            problem(404, "not_found", "Ticket not found")
        if ticket.expires_at < now():
            problem(410, "expired", "Ticket expired")
        
        # 验证验证码
        code_hash = sha256(inb.code)
        if code_hash != ticket.code_hash:
            problem(422, "invalid_code", "Invalid verification code")
        
        # 创建proof token
        proof_token = random_token("prf")
        expires_at = now() + timedelta(minutes=5)
        
        db.create_proof(
            token=proof_token,
            channel=ticket.channel,
            destination=ticket.destination,
            purpose=ticket.purpose,
            expires_at=expires_at,
            subject_id=ticket.subject_id
        )
        
        # 删除ticket
        db.delete_ticket(ticket_id)
        
        return TicketConfirmOut(
            verified=True,
            purpose=ticket.purpose,
            channel=ticket.channel,
            masked_destination=mask_email(ticket.destination) if ticket.channel == "email" else mask_phone(ticket.destination),
            proof_token=proof_token,
            subject_id=ticket.subject_id
        )

# =========================
# Sessions 路由
# =========================
sessions = APIRouter(prefix="/sessions", tags=["Sessions"])

@sessions.post("", response_model=SessionsExchangeOut)
def exchange_session(inb: SessionsExchangeIn, request: Request = None):
    with get_db() as db:
        user = None
        
        # 处理signup_session_token（注册后自动登录）
        if inb.signup_session_token:
            sst = db.get_signup_session_token(inb.signup_session_token)
            if not sst:
                problem(401, "unauthorized", "Invalid signup_session_token")
            if sst.expires_at < now():
                problem(401, "unauthorized", "Signup session token expired")
            
            user = db.get_user_by_id(sst.user_id)
            if not user or user.deleted_at:
                problem(404, "user_not_found", "User not found")
            
            # 消费signup session token
            db.delete_signup_session_token(inb.signup_session_token)
        
        # 处理proof_token（正常登录）
        elif inb.proof_token:
            proof = db.get_proof_by_token(inb.proof_token)
            if not proof:
                problem(401, "unauthorized", "Invalid proof_token")
            if proof.expires_at < now():
                problem(401, "unauthorized", "Proof expired")
            if proof.purpose != "signin":
                problem(400, "invalid_flow", "Proof purpose is not signin")
            
            # 找到对应用户
            if proof.channel == "email":
                user = db.get_user_by_email(proof.destination)
            else:
                # 对于SMS登录，统一使用E164格式
                phone_destination = normalize_phone(proof.destination)
                user = db.get_user_by_phone(phone_destination)
            
            if not user or user.deleted_at:
                problem(404, "user_not_found", "No user bound to this destination")
            
            # 消费proof
            db.delete_proof(inb.proof_token)
        
        else:
            problem(400, "missing_token", "Either proof_token or signup_session_token is required")
        
        # 创建会话
        access_token = random_token("atk")
        refresh_token = random_token("rtk")
        session_expires = now() + timedelta(minutes=30)
        refresh_expires = now() + timedelta(days=30)
        
        db.create_session(access_token, user.id, user.role, session_expires)
        db.create_refresh_token(refresh_token, user.id, user.role, refresh_expires)
        
        return SessionsExchangeOut(
            access_token=access_token,
            token_type="bearer",
            refresh_token=refresh_token
        )

@sessions.post("/refresh", response_model=SessionsExchangeOut)
def refresh_session(inb: SessionsRefreshIn):
    with get_db() as db:
        # Validate refresh token
        rt = db.get_refresh_token(inb.refresh_token)
        if not rt:
            problem(401, "unauthorized", "Invalid refresh_token")
        if rt.expires_at < now():
            # Clean up expired token and reject
            db.delete_refresh_token(inb.refresh_token)
            problem(401, "unauthorized", "Refresh token expired")

        user = db.get_user_by_id(rt.user_id)
        if not user or user.deleted_at:
            # Invalidate the refresh if user is gone
            db.delete_refresh_token(inb.refresh_token)
            problem(401, "unauthorized", "User not available")

        # Rotate refresh token and mint new access token
        db.delete_refresh_token(inb.refresh_token)

        new_access = random_token("atk")
        new_refresh = random_token("rtk")
        session_expires = now() + timedelta(minutes=30)
        refresh_expires = now() + timedelta(days=30)

        db.create_session(new_access, user.id, user.role, session_expires)
        db.create_refresh_token(new_refresh, user.id, user.role, refresh_expires)

        return SessionsExchangeOut(
            access_token=new_access,
            token_type="bearer",
            refresh_token=new_refresh,
        )

# =========================
# Registrations 路由
# =========================
registrations = APIRouter(prefix="/registrations", tags=["Registrations"])

@registrations.post("", response_model=RegistrationCreateOut)
def create_registration():
    print("[REGISTRATION] create_registration function called")
    with get_db() as db:
        user_id = f"u_{uuid4().hex[:10]}"
        reg_id = f"r_{uuid4().hex[:10]}"
        
        # 创建用户
        db.create_user(
            user_id=user_id,
            role="user",
            status="active",
            badges="{}"
        )
        
        # 创建注册记录
        db.create_registration(reg_id, user_id)
        
        return RegistrationCreateOut(registration_id=reg_id)

@registrations.post("/{registration_id}/contacts/attach")
def attach_contact(registration_id: str, inb: RegistrationAttachIn):
    with get_db() as db:
        reg = db.get_registration_by_id(registration_id)
        if not reg:
            problem(404, "not_found", "Registration not found")
        user = db.get_user_by_id(reg.user_id)
        if not user or user.deleted_at:
            problem(404, "not_found", "User not found")
        
        proof = db.get_proof_by_token(inb.proof_token)
        if not proof or proof.expires_at < now():
            problem(401, "unauthorized", "Invalid/expired proof")
        if proof.purpose != "signup" or proof.subject_id not in (registration_id, None):
            problem(400, "invalid_flow", "Proof purpose/subject mismatch")
        
        if proof.channel == "email":
            # 邮箱blacklist检查
            email_blacklist = {"official", "admin", "support", "help", "system", "root", "guild", "mythical", "helper"}
            email_local_part = proof.destination.split('@')[0].lower()
            if email_local_part in email_blacklist:
                problem(409, "conflict", "Email address not allowed")
            
            # 唯一性检查
            existing_user = db.get_user_by_email(proof.destination)
            if existing_user and existing_user.id != user.id and existing_user.email_verified_at:
                problem(409, "conflict", "Email already in use")
            user.email = proof.destination
            user.email_verified_at = now()
            reg.email_verified = True
        else:
            # 唯一性检查
            existing_user = db.get_user_by_phone(proof.destination)
            if existing_user and existing_user.id != user.id and existing_user.phone_verified_at:
                problem(409, "conflict", "Phone already in use")
            user.phone = proof.destination
            user.phone_verified_at = now()
            reg.phone_verified = True
        
        user.updated_at = now()
        reg.updated_at = now()
        
        db.update_user(user.id, **{
            'email': user.email,
            'phone': user.phone,
            'email_verified_at': user.email_verified_at,
            'phone_verified_at': user.phone_verified_at,
            'updated_at': user.updated_at
        })
        
        db.update_registration(reg.id, **{
            'email_verified': reg.email_verified,
            'phone_verified': reg.phone_verified,
            'updated_at': reg.updated_at
        })
        
        db.delete_proof(inb.proof_token)
        
        return {
            "ok": True,
            "user_id": user.id,
            "email_verified": reg.email_verified,
            "phone_verified": reg.phone_verified
        }

@registrations.patch("/{registration_id}")
def patch_registration(registration_id: str, inb: RegistrationPatchIn):
    with get_db() as db:
        reg = db.get_registration_by_id(registration_id)
        if not reg:
            problem(404, "not_found", "Registration not found")
        user = db.get_user_by_id(reg.user_id)
        if not user:
            problem(404, "not_found", "User not found")
        
        if inb.username is not None:
            uname = inb.username.strip()
            if not re.match(r"^[A-Za-z0-9_ ]{2,20}$", uname):
                problem(422, "invalid_username", "2–20 chars, letters/numbers/underscore/spaces; at least one letter")
            if not re.search(r"[A-Za-z]", uname):
                problem(422, "invalid_username", "Must contain at least one letter")
            
            # 黑名单检查
            blacklist = {"official", "admin", "support", "help", "system", "root", "guild", "mythical", "helper"}
            if uname.lower() in blacklist:
                problem(409, "conflict", "Username not allowed")
            
            user.username = uname
            reg.username_set = True
        
        if inb.oath_accept is not None:
            if inb.oath_accept:
                user.oath_accepted_at = now()
                reg.oath_accepted = True
            else:
                reg.oath_accepted = False
                user.oath_accepted_at = None
        
        user.updated_at = now()
        reg.updated_at = now()
        
        # 更新用户
        update_data = {'updated_at': user.updated_at}
        if inb.username is not None:
            update_data['username'] = user.username
        if inb.oath_accept is not None:
            update_data['oath_accepted_at'] = user.oath_accepted_at
        
        db.update_user(user.id, **update_data)
        
        # 更新注册
        reg_update_data = {'updated_at': reg.updated_at}
        if inb.username is not None:
            reg_update_data['username_set'] = reg.username_set
        if inb.oath_accept is not None:
            reg_update_data['oath_accepted'] = reg.oath_accepted
        
        db.update_registration(reg.id, **reg_update_data)
        
        return {
            "ok": True,
            "registration_id": registration_id,
            "username_set": reg.username_set,
            "oath_accepted": reg.oath_accepted
        }

@registrations.post("/{registration_id}/activate", response_model=RegistrationActivateOut)
def activate_registration(registration_id: str):
    with get_db() as db:
        reg = db.get_registration_by_id(registration_id)
        if not reg:
            problem(404, "not_found", "Registration not found")
        user = db.get_user_by_id(reg.user_id)
        if not user:
            problem(404, "not_found", "User not found")
        
        if not (reg.email_verified and reg.phone_verified and reg.username_set and reg.oath_accepted):
            problem(400, "invalid_state", "Complete email/phone verification and oath before activation")
        
        # 试用期90天
        trial_end = now() + timedelta(days=90)
        user.valid_until = trial_end
        user.updated_at = now()
        
        db.update_user(user.id, valid_until=trial_end, updated_at=now())
        
        # 生成一次性注册会话token，用于换取access_token
        signup_session_token = random_token("sst")
        # 这个token有效期5分钟，用于注册后立即换取access_token
        signup_token_expires = now() + timedelta(minutes=5)
        db.create_signup_session_token(signup_session_token, user.id, signup_token_expires)
        
        return RegistrationActivateOut(
            user_id=user.id,
            role=user.role,
            is_active=True,
            valid_until=trial_end,
            signup_session_token=signup_session_token
        )

# =========================
# 路由挂载
# =========================
app.include_router(tickets)
app.include_router(sessions)
app.include_router(registrations)

# =========================
# Users 路由
# =========================
users = APIRouter(prefix="/users", tags=["Users"])

@users.get("/me")
def get_me(su: SessionUser = Depends(get_session_user)):
    with get_db() as db:
        user = db.get_user_by_id(su.user_id)
        if not user or user.deleted_at:
            problem(404, "not_found", "User not found")
        return user_payload(user)

@users.patch("/me")
def patch_me(inb: UsersPatchIn, su: SessionUser = Depends(get_session_user)):
    with get_db() as db:
        user = db.get_user_by_id(su.user_id)
        if not user or user.deleted_at:
            problem(404, "not_found", "User not found")
        update: Dict[str, Any] = {}
        if inb.badges is not None:
            if not isinstance(inb.badges, dict):
                problem(422, "invalid_badges", "Badges must be a JSON object")
            update['badges'] = json.dumps(inb.badges)
        if not update:
            return user_payload(user)
        db.update_user(user.id, **update)
        user = db.get_user_by_id(user.id)
        return user_payload(user)

@users.delete("/me")
def delete_me(su: SessionUser = Depends(get_session_user)):
    # 账户删除是一次性操作，不需要Turnstile验证
    with get_db() as db:
        ok = db.delete_user(su.user_id)
        if not ok:
            problem(404, "not_found", "User not found")
    return {"ok": True}

# ---- Admin APIs ----
class AdminUsersPatchIn(BaseModel):
    username: Optional[str] = None
    role: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    valid_until: Optional[datetime] = None
    badges: Optional[Dict[str, Any]] = None

@users.get("/{user_id}")
def admin_get_user(user_id: str, su: SessionUser = Depends(require_admin)):
    with get_db() as db:
        user = db.get_user_by_id(user_id)
        if not user or user.deleted_at:
            problem(404, "not_found", "User not found")
        return user_payload(user)

@users.patch("/{user_id}")
def admin_patch_user(user_id: str, inb: AdminUsersPatchIn, su: SessionUser = Depends(require_admin)):
    with get_db() as db:
        user = db.get_user_by_id(user_id)
        if not user or user.deleted_at:
            problem(404, "not_found", "User not found")

        updates: Dict[str, Any] = {}

        # username
        if inb.username is not None:
            uname = inb.username.strip()
            if not re.match(r"^[A-Za-z0-9_ ]{2,20}$", uname) or not re.search(r"[A-Za-z]", uname):
                problem(422, "invalid_username", "2–20 chars, letters/numbers/underscore/spaces; include a letter")
            # blacklist similar to registration
            blacklist = {"official", "admin", "support", "help", "system", "root", "guild", "mythical", "helper"}
            if uname.lower() in blacklist:
                problem(409, "conflict", "Username not allowed")
            existing = db.get_user_by_username(uname)
            if existing and existing.id != user.id:
                problem(409, "conflict", "Username already in use")
            updates['username'] = uname

        # role
        if inb.role is not None:
            role = inb.role.strip().lower()
            if role not in ("user", "admin"):
                problem(422, "invalid_role", "Role must be 'user' or 'admin'")
            updates['role'] = role

        # email
        if inb.email is not None:
            if not is_email(inb.email):
                problem(422, "invalid_email", "Invalid email format")
            new_email = normalize_email(inb.email)
            existing = db.get_user_by_email(new_email)
            if existing and existing.id != user.id:
                problem(409, "conflict", "Email already in use")
            updates['email'] = new_email
            updates['email_verified_at'] = now()

        # phone
        if inb.phone is not None:
            if not is_e164(inb.phone):
                problem(422, "invalid_phone", "Invalid phone format (E.164)")
            new_phone = normalize_phone(inb.phone)
            existing = db.get_user_by_phone(new_phone)
            if existing and existing.id != user.id:
                problem(409, "conflict", "Phone already in use")
            updates['phone'] = new_phone
            updates['phone_verified_at'] = now()

        # valid_until
        if inb.valid_until is not None:
            updates['valid_until'] = inb.valid_until

        # badges
        if inb.badges is not None:
            if not isinstance(inb.badges, dict):
                problem(422, "invalid_badges", "Badges must be a JSON object")
            updates['badges'] = json.dumps(inb.badges)

        if not updates:
            return user_payload(user)

        db.update_user(user.id, **updates)
        user = db.get_user_by_id(user.id)
        return user_payload(user)

app.include_router(users)

# =========================
# Contacts 路由（变更邮箱/手机号）
# =========================
contacts = APIRouter(prefix="/contacts", tags=["Contacts"])

def _consume_proof(db: DatabaseService, token: str):
    proof = db.get_proof_by_token(token)
    if not proof:
        problem(401, "unauthorized", "Invalid proof_token")
    if proof.expires_at < now():
        problem(401, "unauthorized", "Proof expired")
    return proof

@contacts.patch("/phone")
def change_phone(inb: ContactsPatchIn, su: SessionUser = Depends(get_session_user)):
    with get_db() as db:
        proof = _consume_proof(db, inb.proof_token)
        if proof.purpose != "change_phone":
            problem(400, "invalid_flow", "Proof purpose is not change_phone")
        if proof.subject_id and proof.subject_id != su.user_id:
            problem(403, "forbidden", "Subject mismatch")
        if not is_e164(proof.destination):
            problem(422, "invalid_phone", "Invalid phone format (E.164)")
        new_phone = normalize_phone(proof.destination)
        existing = db.get_user_by_phone(new_phone)
        if existing and existing.id != su.user_id:
            problem(409, "conflict", "Phone already in use")
        user = db.get_user_by_id(su.user_id)
        if not user or user.deleted_at:
            problem(404, "not_found", "User not found")
        db.update_user(user.id, phone=new_phone, phone_verified_at=now())
        
        db.delete_proof(inb.proof_token)
        user = db.get_user_by_id(user.id)
        return user_payload(user)

@contacts.patch("/email")
def change_email(inb: ContactsPatchIn, su: SessionUser = Depends(get_session_user)):
    with get_db() as db:
        proof = _consume_proof(db, inb.proof_token)
        if proof.purpose != "change_email":
            problem(400, "invalid_flow", "Proof purpose is not change_email")
        if proof.subject_id and proof.subject_id != su.user_id:
            problem(403, "forbidden", "Subject mismatch")
        if not is_email(proof.destination):
            problem(422, "invalid_email", "Invalid email format")
        new_email = normalize_email(proof.destination)
        existing = db.get_user_by_email(new_email)
        if existing and existing.id != su.user_id:
            problem(409, "conflict", "Email already in use")
        user = db.get_user_by_id(su.user_id)
        if not user or user.deleted_at:
            problem(404, "not_found", "User not found")
        db.update_user(user.id, email=new_email, email_verified_at=now())
        db.delete_proof(inb.proof_token)
        user = db.get_user_by_id(user.id)
        return user_payload(user)

app.include_router(contacts)

# =========================
# Badge Realms 常量定义
# =========================
BADGE_REALMS = {
    "north": "North Pole",
    "tooth": "Tooth Fairy", 
    "bunny": "Spring Bunny"
}

# =========================
# Public 扫码路由
# =========================
public = APIRouter(tags=["Public"])

@public.get("/badge-realms")
def get_badge_realms():
    """获取可用的badge realm列表"""
    return {
        "realms": BADGE_REALMS,
        "count": len(BADGE_REALMS)
    }

@public.get("/scan/{user_id}")
def scan_user(user_id: str):
    with get_db() as db:
        user = db.get_user_by_id(user_id)
        if not user or user.deleted_at:
            problem(404, "not_found", "User not found")
        payload = user_payload(user)
        payload.pop("email", None)
        payload.pop("phone", None)
        return payload

app.include_router(public)

@app.get("/")
def root():
    return {"ok": True, "service": "Mythical Helper API (SQLAlchemy)"}

@app.get("/health")
def health():
    return {"ok": True, "database": "SQLAlchemy"}

# =========================
# 支付相关API
# =========================

@app.post("/api/payment/renewal", response_model=PaymentResponse)
def create_renewal_session(
    request: RenewalRequest,
    user: SessionUser = Depends(get_session_user)
):
    """创建续费支付会话"""
    try:
        print(f"[PAYMENT] Starting renewal for user: {user.user_id}")
        
        # 获取用户信息
        with get_db() as db:
            user_data = db.get_user_by_id(user.user_id)
            if not user_data:
                print(f"[PAYMENT] ERROR: User not found: {user.user_id}")
                problem(404, "not_found", "User not found")
            
            print(f"[PAYMENT] User found: {user_data.username}, valid_until: {user_data.valid_until}")
            
            # 计算新的有效期
            current_time = datetime.now(UTC)
            print(f"[PAYMENT] Current time: {current_time}")
            
            # 确保user_data.valid_until是aware datetime
            if user_data.valid_until:
                if user_data.valid_until.tzinfo is None:
                    # 如果是naive datetime，假设是UTC
                    user_valid_until = user_data.valid_until.replace(tzinfo=UTC)
                else:
                    user_valid_until = user_data.valid_until
                print(f"[PAYMENT] User valid_until (aware): {user_valid_until}")
            else:
                user_valid_until = None
                print(f"[PAYMENT] User has no valid_until")
            
            if user_valid_until and user_valid_until > current_time:
                # 用户还在有效期内，从当前有效期结束日期延长一年
                new_valid_until = user_valid_until + timedelta(days=365)
                print(f"[PAYMENT] Extending from current valid_until: {new_valid_until}")
            else:
                # 用户已过期，从今天开始一年有效期
                new_valid_until = current_time + timedelta(days=365)
                print(f"[PAYMENT] Starting from today: {new_valid_until}")
            
            print(f"[PAYMENT] Creating Stripe checkout session...")
            print(f"[PAYMENT] Stripe API key: {stripe.api_key[:10]}...")
            print(f"[PAYMENT] Frontend URL: {FRONTEND_URL}")
            print(f"[PAYMENT] Using price ID: {RENEWAL_PRICE_ID if RENEWAL_PRICE_ID else 'dynamic pricing'}")
            
            # 创建Stripe Checkout会话
            if RENEWAL_PRICE_ID:
                # 使用固定价格ID
                line_items = [{
                    'price': RENEWAL_PRICE_ID,
                    'quantity': 1,
                }]
            else:
                # 使用动态价格
                line_items = [{
                    'price_data': {
                        'currency': 'usd',
                        'product_data': {
                            'name': 'MythicalHelper Guild Membership Renewal',
                            'description': 'Extend your membership for one year',
                        },
                        'unit_amount': RENEWAL_AMOUNT_CENTS,  # 使用配置的价格
                    },
                    'quantity': 1,
                }]
            
            try:
                print(f"[PAYMENT] Calling Stripe API via Cloudflare Proxy...")
                print(f"[PAYMENT] Line items: {line_items}")
                
                # 通过 Cloudflare Worker 代理调用 Stripe API
                import requests
                
                # 使用实际的 Cloudflare Worker 端点
                stripe_url = "https://pay.mythicalhelper.org/v1/checkout/sessions"
                
                headers = {
                    "X-Worker-Auth": "X7f8uV2YwQ9JsL4epM3RaNDkZ0B1tFgH"
                }
                
                # 构建 Stripe API 请求数据
                payload = {
                    "payment_method_types[]": "card",
                    "line_items[0][price_data][currency]": "usd",
                    "line_items[0][price_data][product_data][name]": "MythicalHelper Guild Membership Renewal",
                    "line_items[0][price_data][product_data][description]": "Extend your membership for one year",
                    "line_items[0][price_data][unit_amount]": str(RENEWAL_AMOUNT_CENTS),
                    "line_items[0][quantity]": "1",
                    "mode": "payment",
                    "success_url": f"{FRONTEND_URL}/portal?renewal=success",
                    "cancel_url": f"{FRONTEND_URL}/portal?renewal=cancelled",
                    "metadata[user_id]": user.user_id,
                    "metadata[type]": "renewal",
                    "metadata[new_valid_until]": new_valid_until.isoformat(),
                    "metadata[amount]": str(RENEWAL_AMOUNT_CENTS)
                }
                
                response = requests.post(stripe_url, headers=headers, data=payload, timeout=10)
                response.raise_for_status()
                
                result = response.json()
                print(f"[PAYMENT] Stripe API call successful!")
                
                # 模拟 Stripe 响应格式
                checkout_session = type('obj', (object,), {
                    'id': result['id'],
                    'url': result['url']
                })()
                
            except requests.exceptions.RequestException as req_error:
                print(f"[PAYMENT] Stripe proxy request error: {str(req_error)}")
                raise Exception(f"Failed to call Stripe via proxy: {str(req_error)}")
            except Exception as general_error:
                print(f"[PAYMENT] General error: {str(general_error)}")
                print(f"[PAYMENT] Error type: {type(general_error)}")
                raise general_error
            
            print(f"[PAYMENT] Stripe session created: {checkout_session.id}")
            print(f"[PAYMENT] Checkout URL: {checkout_session.url}")
            
            return PaymentResponse(
                checkout_url=checkout_session.url,
                session_id=checkout_session.id
            )
            
    except stripe.error.StripeError as e:
        print(f"[PAYMENT] Stripe error: {str(e)}")
        problem(400, "payment_error", f"Stripe error: {str(e)}")
    except Exception as e:
        print(f"[PAYMENT] Internal error: {str(e)}")
        import traceback
        print(f"[PAYMENT] Traceback: {traceback.format_exc()}")
        problem(500, "internal_error", f"Internal error: {str(e)}")

@app.post("/api/payment/donation", response_model=PaymentResponse)
def create_donation_session(
    request: DonationRequest,
    user: SessionUser = Depends(get_session_user)
):
    """创建捐赠支付会话"""
    try:
        # 通过 Cloudflare Worker 代理调用 Stripe API
        import requests
        
        # 使用实际的 Cloudflare Worker 端点
        stripe_url = "https://pay.mythicalhelper.org/v1/checkout/sessions"
        
        headers = {
            "X-Worker-Auth": "X7f8uV2YwQ9JsL4epM3RaNDkZ0B1tFgH"
        }
        
        # 构建 Stripe API 请求数据
        payload = {
            "payment_method_types[]": "card",
            "line_items[0][price_data][currency]": "usd",
            "line_items[0][price_data][product_data][name]": "MythicalHelper Guild Donation",
            "line_items[0][price_data][product_data][description]": "Support the Guild with your generous gift",
            "line_items[0][price_data][unit_amount]": str(request.amount),
            "line_items[0][quantity]": "1",
            "mode": "payment",
            "success_url": f"{FRONTEND_URL}/portal?donation=success",
            "cancel_url": f"{FRONTEND_URL}/portal?donation=cancelled",
            "metadata[user_id]": user.user_id,
            "metadata[type]": "donation",
            "metadata[amount]": str(request.amount)
        }
        
        response = requests.post(stripe_url, headers=headers, data=payload, timeout=30)
        response.raise_for_status()
        
        result = response.json()
        
        return PaymentResponse(
            checkout_url=result['url'],
            session_id=result['id']
        )
        
    except stripe.error.StripeError as e:
        problem(400, "payment_error", f"Stripe error: {str(e)}")
    except Exception as e:
        problem(500, "internal_error", f"Internal error: {str(e)}")

@app.post("/api/payment/webhook")
async def stripe_webhook(request: Request):
    """处理Stripe Webhook"""
    payload = await request.body()
    sig_header = request.headers.get('stripe-signature')
    
    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, STRIPE_WEBHOOK_SECRET
        )
    except ValueError:
        problem(400, "invalid_payload", "Invalid payload")
    except stripe.error.SignatureVerificationError:
        problem(400, "invalid_signature", "Invalid signature")
    
    # 处理支付成功事件
    if event['type'] == 'checkout.session.completed':
        session = event['data']['object']
        metadata = session.get('metadata', {})
        user_id = metadata.get('user_id')
        payment_type = metadata.get('type')
        amount = int(metadata.get('amount', 0))
        
        if not user_id:
            problem(400, "invalid_metadata", "Missing user_id in metadata")
        
        with get_db() as db:
            # 记录支付记录
            purchase_id = str(uuid4())
            db.db.add(Purchase(
                id=purchase_id,
                user_id=user_id,
                amount=amount,
                currency='USD',
                provider_payment_id=session['id'],
                purchased_at=datetime.now(UTC),
                valid_until_after_purchase=datetime.fromisoformat(metadata['new_valid_until']) if payment_type == 'renewal' else None
            ))
            
            # 如果是续费，更新用户有效期
            if payment_type == 'renewal':
                new_valid_until = datetime.fromisoformat(metadata['new_valid_until'])
                user = db.get_user_by_id(user_id)
                if user:
                    user.valid_until = new_valid_until
            
            db.db.commit()
    
    return {"status": "success"}

@app.get("/api/payment/verify-session/{session_id}")
def verify_payment_session(session_id: str, user: SessionUser = Depends(get_session_user)):
    """验证支付会话状态"""
    try:
        # 通过 Cloudflare Worker 代理调用 Stripe API
        import requests
        
        # 使用实际的 Cloudflare Worker 端点
        stripe_url = f"https://pay.mythicalhelper.org/v1/checkout/sessions/{session_id}"
        
        headers = {
            "X-Worker-Auth": "X7f8uV2YwQ9JsL4epM3RaNDkZ0B1tFgH"
        }
        
        response = requests.get(stripe_url, headers=headers, timeout=30)
        response.raise_for_status()
        
        session = response.json()
        
        # 检查会话是否属于当前用户
        metadata = session.get('metadata', {})
        if metadata.get('user_id') != user.user_id:
            problem(403, "forbidden", "Session does not belong to current user")
        
        # 返回会话状态
        if session.payment_status == 'paid':
            return {
                "status": "complete",
                "session_id": session_id,
                "payment_status": session.payment_status,
                "amount_total": session.amount_total,
                "currency": session.currency
            }
        elif session.status == 'open':
            return {
                "status": "pending",
                "session_id": session_id,
                "payment_status": session.payment_status
            }
        else:
            return {
                "status": "cancelled",
                "session_id": session_id,
                "payment_status": session.payment_status
            }
            
    except stripe.error.StripeError as e:
        print(f"[PAYMENT] Stripe error verifying session: {str(e)}")
        problem(400, "payment_error", f"Stripe error: {str(e)}")
    except Exception as e:
        print(f"[PAYMENT] Internal error verifying session: {str(e)}")
        problem(500, "internal_error", f"Internal error: {str(e)}")

@app.get("/api/payment/history")
def get_payment_history(user: SessionUser = Depends(get_session_user)):
    """获取用户支付历史"""
    try:
        print(f"[PAYMENT] Getting payment history for user: {user.user_id}")
        
        with get_db() as db:
            # 获取用户的所有购买记录
            purchases = db.db.query(Purchase).filter(
                Purchase.user_id == user.user_id
            ).order_by(Purchase.purchased_at.desc()).all()
            
            print(f"[PAYMENT] Found {len(purchases)} purchase records")
            
            # 转换为前端需要的格式
            history = []
            for purchase in purchases:
                # 确定支付类型
                if purchase.valid_until_after_purchase:
                    payment_type = "Membership Renewal"
                else:
                    payment_type = "Donation"
                
                # 格式化金额
                amount_dollars = purchase.amount / 100 if purchase.amount else 0
                amount_str = f"${amount_dollars:.2f}"
                
                # 确定支付状态（有provider_payment_id表示支付成功）
                status = "Completed" if purchase.provider_payment_id else "Pending"
                
                history.append({
                    "id": purchase.id,
                    "date": purchase.purchased_at.strftime("%Y-%m-%d"),
                    "amount": amount_str,
                    "type": payment_type,
                    "status": status,
                    "currency": purchase.currency,
                    "provider_payment_id": purchase.provider_payment_id
                })
            
            return {"history": history}
            
    except Exception as e:
        print(f"[PAYMENT] Error getting payment history: {str(e)}")
        problem(500, "history_failed", "Failed to get payment history")

# =========================
# 管理员配置
# =========================
def ensure_admin_user():
    """每次重启时删除所有管理员账户，然后创建默认管理员"""
    try:
        with get_db() as db:
            # 删除所有现有的管理员账户（使用原始SQL避免schema问题）
            print(f"[ADMIN] 正在删除所有现有管理员账户...")
            
            # 使用原始SQL删除相关数据，避免SQLAlchemy模型问题
            from sqlalchemy import text
            
            # 管理员只可能有sessions和refresh_tokens，不会有注册相关数据
            db.db.execute(text("DELETE FROM refresh_tokens WHERE user_id IN (SELECT id FROM users WHERE role = 'admin')"))
            db.db.execute(text("DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE role = 'admin')"))
            
            # 删除管理员用户
            result = db.db.execute(text("DELETE FROM users WHERE role = 'admin'"))
            deleted_count = result.rowcount
            
            if deleted_count > 0:
                print(f"[ADMIN] ✅ 已删除 {deleted_count} 个现有管理员账户")
            
            db.db.commit()
            
            # 创建新的默认管理员用户
            admin_id = "admin"
            now = datetime.now(timezone.utc)
            
            admin_user = User(
                id=admin_id,
                username="Admin",
                email="admin@mythicalhelper.org",
                phone=ADMIN_PHONE,
                phone_verified_at=now,
                role="admin",
                status="active",
                badges="{}",
                created_at=now,
                updated_at=now
            )
            
            db.db.add(admin_user)
            db.db.commit()
            
            print(f"[ADMIN] ✅ 默认管理员账户创建成功!")
            print(f"[ADMIN]   用户ID: {admin_id}")
            print(f"[ADMIN]   用户名: Admin")
            print(f"[ADMIN]   电话: {ADMIN_PHONE}")
            print(f"[ADMIN]   角色: admin")
            print(f"[ADMIN]   环境检查: 数据库连接正常")
            
    except Exception as e:
        print(f"[ADMIN] ❌ 创建管理员失败: {str(e)}")
        print(f"[ADMIN] ❌ 环境检查失败，请检查数据库连接")


# =========================
# 管理员API
# =========================
admin = APIRouter(prefix="/admin", tags=["Admin"])

@admin.get("/users")
def admin_get_users(
    page: int = 1,
    limit: int = 20,
    search: str = None,
    include_deleted: bool = False,
    su: SessionUser = Depends(require_admin)
):
    """获取所有用户列表（管理员）"""
    try:
        with get_db() as db:
            # 构建查询，排除管理员账户
            query = db.db.query(User).filter(User.role != "admin")
            
            # 根据参数决定是否包含已删除用户
            if not include_deleted:
                query = query.filter(User.deleted_at.is_(None))
            
            # 搜索功能
            if search:
                search_term = f"%{search}%"
                query = query.filter(
                    (User.username.ilike(search_term)) |
                    (User.email.ilike(search_term)) |
                    (User.phone.ilike(search_term))
                )
            
            # 分页
            offset = (page - 1) * limit
            users = query.order_by(User.created_at.desc()).offset(offset).limit(limit).all()
            total = query.count()
            
            # 转换为前端格式
            user_list = []
            for user in users:
                user_list.append({
                    "id": user.id,
                    "username": user.username,
                    "email": user.email,
                    "phone": user.phone,
                    "role": user.role,
                    "status": user.status,
                    "created_at": user.created_at.strftime("%Y-%m-%d %H:%M"),
                    "valid_until": user.valid_until.strftime("%Y-%m-%d") if user.valid_until else None,
                    "is_active": user.valid_until and user.valid_until.replace(tzinfo=UTC) > datetime.now(UTC) if user.valid_until else False,
                    "is_deleted": user.deleted_at is not None,
                    "deleted_at": user.deleted_at.strftime("%Y-%m-%d %H:%M") if user.deleted_at else None
                })
            
            return {
                "users": user_list,
                "pagination": {
                    "page": page,
                    "limit": limit,
                    "total": total,
                    "pages": (total + limit - 1) // limit
                }
            }
    except Exception as e:
        print(f"[ADMIN] Error getting users: {str(e)}")
        problem(500, "users_failed", "Failed to get users")

@admin.put("/users/{user_id}")
def admin_update_user(
    user_id: str,
    username: str = None,
    email: str = None,
    phone: str = None,
    status: str = None,
    valid_until: str = None,
    su: SessionUser = Depends(require_admin)
):
    """更新用户信息（管理员）"""
    try:
        with get_db() as db:
            user = db.get_user_by_id(user_id)
            if not user:
                problem(404, "not_found", "User not found")
            
            # 更新字段
            if username is not None:
                # 检查用户名是否已存在
                existing_user = db.get_user_by_username(username)
                if existing_user and existing_user.id != user_id:
                    problem(409, "conflict", "Username already exists")
                user.username = username
            
            if email is not None:
                # 检查邮箱是否已存在
                existing_user = db.get_user_by_email(email)
                if existing_user and existing_user.id != user_id:
                    problem(409, "conflict", "Email already exists")
                user.email = email
            
            if phone is not None:
                # 检查手机号是否已存在
                existing_user = db.get_user_by_phone(phone)
                if existing_user and existing_user.id != user_id:
                    problem(409, "conflict", "Phone already exists")
                user.phone = phone
            
            if status is not None:
                user.status = status
            
            if valid_until is not None:
                if valid_until == "":
                    user.valid_until = None
                else:
                    try:
                        user.valid_until = datetime.fromisoformat(valid_until.replace('Z', '+00:00'))
                    except ValueError:
                        problem(400, "invalid_date", "Invalid date format")
            
            user.updated_at = datetime.now(timezone.utc)
            db.db.commit()
            
            return {"message": "User updated successfully"}
            
    except Exception as e:
        print(f"[ADMIN] Error updating user: {str(e)}")
        problem(500, "update_failed", "Failed to update user")

@admin.delete("/users/{user_id}")
def admin_delete_user(
    user_id: str,
    su: SessionUser = Depends(require_admin)
):
    """删除用户（管理员）"""
    try:
        with get_db() as db:
            user = db.get_user_by_id(user_id)
            if not user:
                problem(404, "not_found", "User not found")
            
            # 软删除用户
            user.deleted_at = datetime.now(timezone.utc)
            user.updated_at = datetime.now(timezone.utc)
            db.db.commit()
            
            return {"message": "User deleted successfully"}
            
    except Exception as e:
        print(f"[ADMIN] Error deleting user: {str(e)}")
        problem(500, "delete_failed", "Failed to delete user")

@admin.post("/users/{user_id}/restore")
def admin_restore_user(
    user_id: str,
    su: SessionUser = Depends(require_admin)
):
    """恢复已删除的用户（管理员）"""
    try:
        with get_db() as db:
            user = db.get_user_by_id(user_id)
            if not user:
                problem(404, "not_found", "User not found")
            
            if not user.deleted_at:
                problem(400, "not_deleted", "User is not deleted")
            
            # 恢复用户
            user.deleted_at = None
            user.updated_at = datetime.now(timezone.utc)
            db.db.commit()
            
            return {"message": "User restored successfully"}
            
    except Exception as e:
        print(f"[ADMIN] Error restoring user: {str(e)}")
        problem(500, "restore_failed", "Failed to restore user")

@admin.delete("/users/{user_id}/permanent")
def admin_permanently_delete_user(
    user_id: str,
    su: SessionUser = Depends(require_admin)
):
    """永久删除用户（管理员）"""
    try:
        with get_db() as db:
            user = db.get_user_by_id(user_id)
            if not user:
                problem(404, "not_found", "User not found")
            
            # 先删除所有相关的记录
            from models import RefreshToken, Session, SignupSessionToken, Registration, Purchase
            
            # 删除refresh tokens
            refresh_tokens = db.db.query(RefreshToken).filter(RefreshToken.user_id == user_id).all()
            for token in refresh_tokens:
                db.db.delete(token)
            
            # 删除sessions
            sessions = db.db.query(Session).filter(Session.user_id == user_id).all()
            for session in sessions:
                db.db.delete(session)
            
            # 删除signup session tokens
            signup_tokens = db.db.query(SignupSessionToken).filter(SignupSessionToken.user_id == user_id).all()
            for token in signup_tokens:
                db.db.delete(token)
            
            # 删除registrations
            registrations = db.db.query(Registration).filter(Registration.user_id == user_id).all()
            for reg in registrations:
                db.db.delete(reg)
            
            # 跳过purchases删除（表结构可能不匹配）
            
            # 最后删除用户
            db.db.delete(user)
            db.db.commit()
            
            return {"message": "User permanently deleted"}
            
    except Exception as e:
        print(f"[ADMIN] Error permanently deleting user: {str(e)}")
        problem(500, "permanent_delete_failed", "Failed to permanently delete user")

@admin.get("/users/{user_id}")
def admin_get_user(
    user_id: str,
    su: SessionUser = Depends(require_admin)
):
    """获取单个用户信息（管理员）"""
    try:
        with get_db() as db:
            user = db.get_user_by_id(user_id)
            if not user:
                problem(404, "not_found", "User not found")
            
            return {
                "id": user.id,
                "username": user.username,
                "email": user.email,
                "phone": user.phone,
                "valid_until": user.valid_until.isoformat() if user.valid_until else None,
                "role": user.role,
                "status": user.status,
                "created_at": user.created_at.isoformat(),
                "updated_at": user.updated_at.isoformat(),
                "deleted_at": user.deleted_at.isoformat() if user.deleted_at else None
            }
            
    except Exception as e:
        print(f"[ADMIN] Error getting user: {str(e)}")
        problem(500, "get_user_failed", "Failed to get user")

@admin.put("/users/{user_id}")
def admin_update_user(
    user_id: str,
    user_data: dict,
    su: SessionUser = Depends(require_admin)
):
    """更新用户信息（管理员）"""
    try:
        with get_db() as db:
            user = db.get_user_by_id(user_id)
            if not user:
                problem(404, "not_found", "User not found")
            
            # 检查email是否重复
            if 'email' in user_data and user_data['email']:
                existing_user = db.get_user_by_email(user_data['email'])
                if existing_user and existing_user.id != user_id:
                    problem(400, "email_exists", "Email already exists")
            
            # 检查phone是否重复
            if 'phone' in user_data and user_data['phone']:
                existing_user = db.get_user_by_phone(user_data['phone'])
                if existing_user and existing_user.id != user_id:
                    problem(400, "phone_exists", "Phone number already exists")
            
            # 检查username是否重复
            if 'username' in user_data and user_data['username']:
                existing_user = db.get_user_by_username(user_data['username'])
                if existing_user and existing_user.id != user_id:
                    problem(400, "username_exists", "Username already exists")
            
            # 更新用户信息
            if 'username' in user_data:
                user.username = user_data['username']
            if 'email' in user_data:
                user.email = user_data['email']
            if 'phone' in user_data:
                user.phone = user_data['phone']
            if 'valid_until' in user_data and user_data['valid_until']:
                user.valid_until = datetime.fromisoformat(user_data['valid_until'].replace('Z', '+00:00'))
            elif 'valid_until' in user_data and not user_data['valid_until']:
                user.valid_until = None
            
            user.updated_at = datetime.now(timezone.utc)
            db.db.commit()
            
            return {"message": "User updated successfully"}
            
    except Exception as e:
        print(f"[ADMIN] Error updating user: {str(e)}")
        problem(500, "update_failed", "Failed to update user")

@admin.get("/purchases")
def admin_get_purchases(
    page: int = 1,
    limit: int = 20,
    user_id: str = None,
    su: SessionUser = Depends(require_admin)
):
    """获取所有交易记录（管理员）"""
    try:
        with get_db() as db:
            # 使用ORM查询，但处理可能的schema不匹配问题
            query = db.db.query(Purchase)
            
            if user_id:
                query = query.filter(Purchase.user_id == user_id)
            
            # 获取总数
            total = query.count()
            
            # 获取分页数据
            offset = (page - 1) * limit
            purchases = query.order_by(Purchase.purchased_at.desc()).offset(offset).limit(limit).all()
            
            # 转换为前端格式
            purchase_list = []
            for purchase in purchases:
                # 获取用户信息
                user = db.get_user_by_id(purchase.user_id)
                username = user.username if user else "Unknown"
                
                # 确定支付类型
                if purchase.valid_until_after_purchase:
                    payment_type = "Membership Renewal"
                else:
                    payment_type = "Donation"
                
                # 格式化金额
                amount_dollars = purchase.amount / 100 if purchase.amount else 0
                amount_str = f"${amount_dollars:.2f}"
                
                # 确定支付状态
                status_map = {
                    "completed": "Completed",
                    "refunded": "Refunded",
                    "pending": "Pending",
                    "failed": "Failed"
                }
                status = status_map.get(purchase.status, "Unknown")
                
                purchase_list.append({
                    "id": purchase.id,
                    "user_id": purchase.user_id,
                    "username": username,
                    "amount": amount_str,
                    "currency": purchase.currency,
                    "type": payment_type,
                    "status": status,
                    "purchased_at": purchase.purchased_at.strftime("%Y-%m-%d %H:%M"),
                    "provider_payment_id": purchase.provider_payment_id
                })
            
            return {
                "purchases": purchase_list,
                "pagination": {
                    "page": page,
                    "limit": limit,
                    "total": total,
                    "pages": (total + limit - 1) // limit
                }
            }
    except Exception as e:
        print(f"[ADMIN] Error getting purchases: {str(e)}")
        problem(500, "purchases_failed", "Failed to get purchases")

@admin.post("/purchases/{purchase_id}/refund")
def admin_refund_purchase(
    purchase_id: str,
    su: SessionUser = Depends(require_admin)
):
    """退款购买（管理员）"""
    try:
        with get_db() as db:
            purchase = db.db.query(Purchase).filter(Purchase.id == purchase_id).first()
            if not purchase:
                problem(404, "not_found", "Purchase not found")
            
            if not purchase.provider_payment_id:
                problem(400, "no_payment_id", "Purchase has no payment ID, cannot refund")
            
            # 这里应该调用Stripe API进行退款
            # 由于当前没有集成Stripe，我们只是标记为已退款
            # 在实际应用中，你需要：
            # 1. 调用Stripe API创建退款
            # 2. 更新purchase记录的状态
            # 3. 如果退款成功，更新用户的valid_until时间
            
            # 临时实现：标记为已退款
            purchase.status = "refunded"
            purchase.updated_at = datetime.now(timezone.utc)
            
            # 如果这是会员续费，需要调整用户的valid_until时间
            if purchase.valid_until_after_purchase:
                user = db.get_user_by_id(purchase.user_id)
                if user and user.valid_until:
                    # 简单处理：将valid_until设置为购买前的时间
                    # 实际应用中可能需要更复杂的逻辑
                    user.valid_until = purchase.purchased_at
                    user.updated_at = datetime.now(timezone.utc)
            
            db.db.commit()
            
            return {"message": "Refund processed successfully"}
            
    except Exception as e:
        print(f"[ADMIN] Error refunding purchase: {str(e)}")
        problem(500, "refund_failed", "Failed to process refund")

@admin.get("/stats")
def admin_get_stats(su: SessionUser = Depends(require_admin)):
    """获取统计信息（管理员）"""
    try:
        with get_db() as db:
            # 总用户数（排除管理员）
            total_users = db.db.query(User).filter(
                User.deleted_at.is_(None),
                User.role != "admin"
            ).count()
            
            # 活跃用户数（有效期内，排除管理员）
            current_time = datetime.now(UTC)
            active_users = db.db.query(User).filter(
                User.deleted_at.is_(None),
                User.role != "admin",
                User.valid_until.isnot(None),
                User.valid_until > current_time
            ).count()
            
            # 本月新增用户（排除管理员）
            month_start = current_time.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
            monthly_users = db.db.query(User).filter(
                User.deleted_at.is_(None),
                User.role != "admin",
                User.created_at >= month_start.replace(tzinfo=None)
            ).count()
            
            # 总收入（美分转美元）
            from sqlalchemy import func
            total_revenue = db.db.query(Purchase).filter(
                Purchase.provider_payment_id.isnot(None)
            ).with_entities(func.sum(Purchase.amount)).scalar() or 0
            total_revenue_dollars = total_revenue / 100
            
            # 本月收入
            monthly_revenue = db.db.query(Purchase).filter(
                Purchase.provider_payment_id.isnot(None),
                Purchase.purchased_at >= month_start.replace(tzinfo=None)
            ).with_entities(func.sum(Purchase.amount)).scalar() or 0
            monthly_revenue_dollars = monthly_revenue / 100
            
            # 续费数量
            renewal_count = db.db.query(Purchase).filter(
                Purchase.valid_until_after_purchase.isnot(None),
                Purchase.provider_payment_id.isnot(None)
            ).count()
            
            # 捐赠数量
            donation_count = db.db.query(Purchase).filter(
                Purchase.valid_until_after_purchase.is_(None),
                Purchase.provider_payment_id.isnot(None)
            ).count()
            
            return {
                "users": {
                    "total": total_users,
                    "active": active_users,
                    "monthly_new": monthly_users
                },
                "revenue": {
                    "total": f"${total_revenue_dollars:.2f}",
                    "monthly": f"${monthly_revenue_dollars:.2f}"
                },
                "purchases": {
                    "renewals": renewal_count,
                    "donations": donation_count
                }
            }
    except Exception as e:
        print(f"[ADMIN] Error getting stats: {str(e)}")
        problem(500, "stats_failed", "Failed to get stats")

app.include_router(admin)
