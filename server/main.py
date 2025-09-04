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

from models import create_database
from database import DatabaseService, get_db

UTC = timezone.utc

# Create database and tables
create_database()

app = FastAPI(title="Mythical Helper API (SQLAlchemy)")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
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
    return re.sub(r"\s+", "", v.strip())

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

class BillingPurchaseIn(BaseModel):
    plan_id: str

class BillingPurchaseOut(BaseModel):
    checkout_url: str

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
def create_ticket(inb: TicketCreateIn, request: Request = None, authorization: str | None = Header(default=None), _: None = Depends(verify_turnstile)):
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
        if inb.purpose in ("signin", "signup"):
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
def confirm_ticket(ticket_id: str, inb: TicketConfirmIn, _: None = Depends(verify_turnstile)):
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
def exchange_session(inb: SessionsExchangeIn, _: None = Depends(verify_turnstile)):
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
                user = db.get_user_by_phone(proof.destination)
            
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
