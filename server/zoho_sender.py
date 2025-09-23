#!/usr/bin/env python3
"""
zoho_mail_sender.py
- 用 Zoho Mail REST API 发送邮件（HTTPS 443）
- 自动刷新 OAuth access_token
- 适合部署在 AWS Lightsail/EC2（不会触发 SMTP 端口限制）
- 合并了 zoho_api_email.py 的功能

依赖: requests
"""

import os
import time
import json
import requests
from typing import Optional

# ========= 基本设置 =========
# 检查是否为本地开发环境
import os
if os.getenv('LOCAL_DEV', 'false').lower() == 'true':
    from config_local import get_config
else:
    from config import get_config

# 加载配置
config = get_config()

# 使用 Cloudflare Worker 代理，解决 IPv6 兼容性问题
ACCOUNTS_BASE = config.ZOHO_PROXY_URL
# 注意：Cloudflare Worker 会把以 /mail 开头的路径替换为 /api
# 因此这里的 BASE 只需要以 /mail 开头，后续再拼接具体资源，如 /accounts
# 之前使用 /mail/api 导致 Worker 转换成 /api/api，Zoho 返回 404 URL_RULE_NOT_CONFIGURED
MAIL_API_BASE = f"{config.ZOHO_PROXY_URL}/mail"

# ========= Zoho 配置 =========
CLIENT_ID = config.ZOHO_CLIENT_ID
CLIENT_SECRET = config.ZOHO_CLIENT_SECRET
REFRESH_TOKEN = ""  # 需要从授权码获取
FROM_ADDRESS = config.ZOHO_EMAIL

# 令牌文件路径（使用模块所在目录，避免相对路径因工作目录不同而找不到）
from pathlib import Path
TOKEN_FILE = os.getenv(
    "ZOHO_TOKENS_FILE",
    str(Path(__file__).with_name("zoho_tokens.json"))
)

# 运行期缓存
_ACCESS_TOKEN: Optional[str] = None
_TOKEN_EXPIRY_TS = 0  # epoch seconds

class ZohoAuthError(Exception):
    pass

class ZohoApiError(Exception):
    pass

def _now() -> float:
    return time.time()

def _load_tokens() -> dict:
    """从文件加载令牌"""
    try:
        if os.path.exists(TOKEN_FILE):
            with open(TOKEN_FILE, 'r') as f:
                return json.load(f)
    except Exception as e:
        print(f"[ZOHO] 加载令牌文件失败: {e}")
    return {}

def _save_tokens(tokens: dict):
    """保存令牌到文件"""
    try:
        with open(TOKEN_FILE, 'w') as f:
            json.dump(tokens, f, indent=2)
        try:
            os.chmod(TOKEN_FILE, 0o600)
        except Exception:
            pass
        print(f"[ZOHO] 令牌已保存到 {TOKEN_FILE}")
    except Exception as e:
        print(f"[ZOHO] 保存令牌文件失败: {e}")

def _init_tokens():
    """初始化令牌（从文件加载）"""
    global REFRESH_TOKEN
    tokens = _load_tokens()
    REFRESH_TOKEN = tokens.get('refresh_token', '')
    if REFRESH_TOKEN:
        print(f"[ZOHO] 已加载 refresh_token: {REFRESH_TOKEN[:20]}...")
    else:
        print(f"[ZOHO] 未找到 refresh_token，需要重新授权")

# 模块加载时初始化令牌
_init_tokens()

def get_access_token_from_code(authorization_code: str) -> tuple[str, str]:
    """
    使用授权码获取 access_token 和 refresh_token
    返回 (access_token, refresh_token)
    """
    global _ACCESS_TOKEN, _TOKEN_EXPIRY_TS
    
    url = f"{ACCOUNTS_BASE}/oauth/v2/token"
    data = {
        "grant_type": "authorization_code",
        "client_id": CLIENT_ID,
        "client_secret": CLIENT_SECRET,
        "redirect_uri": "https://api.mythicalhelper.org/auth/callback",
        "code": authorization_code,
    }
    
    print(f"[ZOHO] 使用授权码获取令牌...")
    resp = requests.post(url, data=data, timeout=30)
    
    if resp.status_code != 200:
        raise ZohoAuthError(f"获取令牌失败: {resp.status_code} {resp.text}")
    
    payload = resp.json()
    access_token = payload.get("access_token")
    refresh_token = payload.get("refresh_token")
    
    if not access_token:
        raise ZohoAuthError(f"响应中没有 access_token: {payload}")
    
    # 设置令牌和过期时间
    _ACCESS_TOKEN = access_token
    _TOKEN_EXPIRY_TS = _now() + payload.get("expires_in", 3600) - 60
    
    print(f"[ZOHO] 令牌获取成功，有效期: {payload.get('expires_in', 3600)} 秒")
    return access_token, refresh_token

def refresh_access_token() -> str:
    """
    用 refresh_token 刷新 access_token（有效 ~1小时）
    成功返回新的 access_token
    """
    global _ACCESS_TOKEN, _TOKEN_EXPIRY_TS
    
    if not REFRESH_TOKEN:
        raise ZohoAuthError("没有 refresh_token，需要重新授权")
    
    url = f"{ACCOUNTS_BASE}/oauth/v2/token"
    data = {
        "grant_type": "refresh_token",
        "client_id": CLIENT_ID,
        "client_secret": CLIENT_SECRET,
        "refresh_token": REFRESH_TOKEN,
    }
    
    print(f"[ZOHO] 刷新访问令牌...")
    resp = requests.post(url, data=data, timeout=15)
    
    if resp.status_code != 200:
        raise ZohoAuthError(f"刷新 access_token 失败: {resp.status_code} {resp.text}")
    
    payload = resp.json()
    token = payload.get("access_token")
    if not token:
        raise ZohoAuthError(f"响应中没有 access_token: {payload}")
    
    # 官方常见有效期 ~3600s，这里保守设置 55 分钟后刷新
    _ACCESS_TOKEN = token
    _TOKEN_EXPIRY_TS = _now() + 55 * 60
    print(f"[ZOHO] 令牌刷新成功")
    return token

def get_access_token() -> str:
    """返回有效 access_token，必要时自动刷新"""
    global _ACCESS_TOKEN, _TOKEN_EXPIRY_TS
    
    if _ACCESS_TOKEN and _now() < _TOKEN_EXPIRY_TS - 30:
        return _ACCESS_TOKEN
    
    return refresh_access_token()

def api_request(method: str, path: str, *, data=None, files=None, params=None, json_data=None):
    """轻量封装 Zoho Mail API 请求；401 时自动刷新一次"""
    token = get_access_token()
    # path 必须以 "/" 开头，例如 "/accounts"、"/folders"、"/accounts/{id}/messages"
    url = f"{MAIL_API_BASE}{path}"
    headers = {"Authorization": f"Zoho-oauthtoken {token}"}
    
    # 如果是JSON数据，设置Content-Type
    if json_data:
        headers["Content-Type"] = "application/json"
        resp = requests.request(method, url, headers=headers, data=json_data, files=files, params=params, timeout=20)
    else:
        resp = requests.request(method, url, headers=headers, data=data, files=files, params=params, timeout=20)
    
    if resp.status_code == 401:
        # token 过期，强刷一次
        print(f"[ZOHO] 令牌过期，尝试刷新...")
        refresh_access_token()
        headers["Authorization"] = f"Zoho-oauthtoken {_ACCESS_TOKEN}"
        if json_data:
            resp = requests.request(method, url, headers=headers, data=json_data, files=files, params=params, timeout=20)
        else:
            resp = requests.request(method, url, headers=headers, data=data, files=files, params=params, timeout=20)
    
    if resp.status_code >= 400:
        raise ZohoApiError(f"API {method} {path} 失败: {resp.status_code} {resp.text}")
    
    return resp

def get_account_id_via_api() -> str:
    """用 /api/accounts 查询 accountId（需要 ZohoMail.accounts.READ scope）"""
    resp = api_request("GET", "/accounts")
    j = resp.json()
    
    # 简单取第一个（或匹配 FROM_ADDRESS 的账号）
    accounts = j.get("data", [])
    if not accounts:
        raise ZohoApiError(f"未找到任何 account: {j}")
    
    if FROM_ADDRESS:
        for acc in accounts:
            if acc.get("emailAddress") == FROM_ADDRESS:
                account_id = str(acc.get("accountId"))
                print(f"[ZOHO] 找到匹配的账户: {FROM_ADDRESS} -> {account_id}")
                return account_id
    
    # fallback: 返回第一个
    account_id = str(accounts[0].get("accountId"))
    print(f"[ZOHO] 使用第一个账户: {account_id}")
    return account_id

def send_magic_link_email(to_email: str, token: str, purpose: str) -> bool:
    """发送魔法链接邮件（signin/signup/change_email）"""
    try:
        frontend_url = config.FRONTEND_URL.rstrip('/')
        
        # 根据模式决定处理方式
        if config.EMAIL_MODE == "test":
            # 测试模式：打印magic link到控制台
            if purpose == "signup":
                redirect_path = f"/auth/auth.html?mode=signup&token={token}&purpose={purpose}&email={to_email}"
                magic_link = f"{frontend_url}{redirect_path}"
                print(f"[MAGIC_LINK] SIGNUP Magic Link: {magic_link}")
                print(f"[MAGIC_LINK] Email: {to_email}")
                print(f"[MAGIC_LINK] Token: {token}")
                return True
            elif purpose == "signin":
                redirect_path = f"/portal/portal.html?token={token}&purpose={purpose}&email={to_email}"
                magic_link = f"{frontend_url}{redirect_path}"
                print(f"[MAGIC_LINK] SIGNIN Magic Link: {magic_link}")
                print(f"[MAGIC_LINK] Email: {to_email}")
                print(f"[MAGIC_LINK] Token: {token}")
                return True
            elif purpose == "change_email":
                redirect_path = f"/portal/portal.html?token={token}&purpose={purpose}&email={to_email}"
                magic_link = f"{frontend_url}{redirect_path}"
                print(f"[MAGIC_LINK] CHANGE_EMAIL Magic Link: {magic_link}")
                print(f"[MAGIC_LINK] Email: {to_email}")
                print(f"[MAGIC_LINK] Token: {token}")
                return True
            else:
                print(f"[MAGIC_LINK] ERROR: Unknown magic link purpose: {purpose}")
                return False
        
        elif config.EMAIL_MODE == "production":
            # 生产模式：通过Zoho发送真实邮件
            if purpose == "signup":
                redirect_path = f"/auth/auth.html?mode=signup&token={token}&purpose={purpose}&email={to_email}"
                subject = "Your invitation to the Guild awaits"
                body_html = f"""
                <!DOCTYPE html>
                <html><head><meta charset=\"UTF-8\"><title>Join the Guild</title>
                <style>
                    body {{ 
                        font-family: 'Georgia', serif; 
                        line-height: 1.6; 
                        color: #2c3e50; 
                        margin: 0; 
                        padding: 0; 
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        min-height: 100vh;
                    }}
                    .container {{ 
                        max-width: 480px; 
                        margin: 40px auto; 
                        background: rgba(255,255,255,0.95); 
                        border-radius: 20px; 
                        overflow: hidden;
                        box-shadow: 0 20px 40px rgba(0,0,0,0.1);
                        backdrop-filter: blur(10px);
                    }}
                    .header {{ 
                        text-align: center; 
                        padding: 40px 30px 20px; 
                        background: linear-gradient(45deg, #2c3e50, #34495e);
                        color: white;
                    }}
                    .logo {{ 
                        font-size: 28px; 
                        font-weight: 300; 
                        letter-spacing: 2px;
                        margin-bottom: 8px;
                    }}
                    .motto {{
                        font-size: 12px;
                        opacity: 0.8;
                        letter-spacing: 1px;
                        text-transform: uppercase;
                    }}
                    .content {{ 
                        padding: 40px 30px; 
                        text-align: center;
                    }}
                    .message {{
                        font-size: 16px;
                        margin-bottom: 30px;
                        color: #34495e;
                        line-height: 1.8;
                    }}
                    .button {{ 
                        display: inline-block; 
                        background: linear-gradient(45deg, #667eea, #764ba2); 
                        color: white; 
                        padding: 18px 36px; 
                        text-decoration: none; 
                        border-radius: 50px; 
                        font-weight: 500;
                        letter-spacing: 1px;
                        transition: transform 0.2s ease;
                        box-shadow: 0 8px 20px rgba(102, 126, 234, 0.3);
                    }}
                    .button:hover {{
                        transform: translateY(-2px);
                        box-shadow: 0 12px 25px rgba(102, 126, 234, 0.4);
                    }}
                    .expiry {{
                        margin-top: 30px;
                        font-size: 13px;
                        color: #7f8c8d;
                        font-style: italic;
                    }}
                    .footer {{ 
                        text-align: center; 
                        padding: 20px 30px; 
                        background: #f8f9fa;
                        font-size: 11px; 
                        color: #95a5a6;
                        letter-spacing: 0.5px;
                    }}
                </style>
                </head>
                <body>
                    <div class=\"container\">
                        <div class=\"header\">
                            <div class=\"logo\">MythicalHelper</div>
                            <div class=\"motto\">Only Wonder Endures</div>
                        </div>
                        <div class=\"content\">
                            <div class=\"message\">
                                A scroll bearing your name has arrived at the Guild.<br>
                                Your journey into wonder begins with a single step.
                            </div>
                            <a class=\"button\" href=\"{frontend_url}{redirect_path}\">Enter the Guild</a>
                            <div class=\"expiry\">This invitation expires in 15 minutes</div>
                        </div>
                        <div class=\"footer\">© 2025 MythicalHelper Guild</div>
                    </div>
                </body>
                </html>
                """
            elif purpose == "signin":
                redirect_path = f"/portal/portal.html?token={token}&purpose={purpose}&email={to_email}"
                subject = "The Guild awaits your return"
                body_html = f"""
                <!DOCTYPE html>
                <html><head><meta charset=\"UTF-8\"><title>Return to the Guild</title>
                <style>
                    body {{ 
                        font-family: 'Georgia', serif; 
                        line-height: 1.6; 
                        color: #2c3e50; 
                        margin: 0; 
                        padding: 0; 
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        min-height: 100vh;
                    }}
                    .container {{ 
                        max-width: 480px; 
                        margin: 40px auto; 
                        background: rgba(255,255,255,0.95); 
                        border-radius: 20px; 
                        overflow: hidden;
                        box-shadow: 0 20px 40px rgba(0,0,0,0.1);
                        backdrop-filter: blur(10px);
                    }}
                    .header {{ 
                        text-align: center; 
                        padding: 40px 30px 20px; 
                        background: linear-gradient(45deg, #2c3e50, #34495e);
                        color: white;
                    }}
                    .logo {{ 
                        font-size: 28px; 
                        font-weight: 300; 
                        letter-spacing: 2px;
                        margin-bottom: 8px;
                    }}
                    .motto {{
                        font-size: 12px;
                        opacity: 0.8;
                        letter-spacing: 1px;
                        text-transform: uppercase;
                    }}
                    .content {{ 
                        padding: 40px 30px; 
                        text-align: center;
                    }}
                    .message {{
                        font-size: 16px;
                        margin-bottom: 30px;
                        color: #34495e;
                        line-height: 1.8;
                    }}
                    .button {{ 
                        display: inline-block; 
                        background: linear-gradient(45deg, #667eea, #764ba2); 
                        color: white; 
                        padding: 18px 36px; 
                        text-decoration: none; 
                        border-radius: 50px; 
                        font-weight: 500;
                        letter-spacing: 1px;
                        transition: transform 0.2s ease;
                        box-shadow: 0 8px 20px rgba(102, 126, 234, 0.3);
                    }}
                    .button:hover {{
                        transform: translateY(-2px);
                        box-shadow: 0 12px 25px rgba(102, 126, 234, 0.4);
                    }}
                    .expiry {{
                        margin-top: 30px;
                        font-size: 13px;
                        color: #7f8c8d;
                        font-style: italic;
                    }}
                    .footer {{ 
                        text-align: center; 
                        padding: 20px 30px; 
                        background: #f8f9fa;
                        font-size: 11px; 
                        color: #95a5a6;
                        letter-spacing: 0.5px;
                    }}
                </style>
                </head>
                <body>
                    <div class=\"container\">
                        <div class=\"header\">
                            <div class=\"logo\">MythicalHelper</div>
                            <div class=\"motto\">Only Wonder Endures</div>
                        </div>
                        <div class=\"content\">
                            <div class=\"message\">
                                Your badge glimmers in the twilight.<br>
                                The Guild chambers are open to you once more.
                            </div>
                            <a class=\"button\" href=\"{frontend_url}{redirect_path}\">Return to the Guild</a>
                            <div class=\"expiry\">This passage expires in 15 minutes</div>
                        </div>
                        <div class=\"footer\">© 2025 MythicalHelper Guild</div>
                    </div>
                </body>
                </html>
                """
            elif purpose == "change_email":
                redirect_path = f"/portal/portal.html?token={token}&purpose={purpose}&email={to_email}"
                subject = "A new scroll arrives at the Guild"
                body_html = f"""
                <!DOCTYPE html>
                <html><head><meta charset=\"UTF-8\"><title>Verify New Address</title>
                <style>
                    body {{ 
                        font-family: 'Georgia', serif; 
                        line-height: 1.6; 
                        color: #2c3e50; 
                        margin: 0; 
                        padding: 0; 
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        min-height: 100vh;
                    }}
                    .container {{ 
                        max-width: 480px; 
                        margin: 40px auto; 
                        background: rgba(255,255,255,0.95); 
                        border-radius: 20px; 
                        overflow: hidden;
                        box-shadow: 0 20px 40px rgba(0,0,0,0.1);
                        backdrop-filter: blur(10px);
                    }}
                    .header {{ 
                        text-align: center; 
                        padding: 40px 30px 20px; 
                        background: linear-gradient(45deg, #2c3e50, #34495e);
                        color: white;
                    }}
                    .logo {{ 
                        font-size: 28px; 
                        font-weight: 300; 
                        letter-spacing: 2px;
                        margin-bottom: 8px;
                    }}
                    .motto {{
                        font-size: 12px;
                        opacity: 0.8;
                        letter-spacing: 1px;
                        text-transform: uppercase;
                    }}
                    .content {{ 
                        padding: 40px 30px; 
                        text-align: center;
                    }}
                    .message {{
                        font-size: 16px;
                        margin-bottom: 30px;
                        color: #34495e;
                        line-height: 1.8;
                    }}
                    .button {{ 
                        display: inline-block; 
                        background: linear-gradient(45deg, #667eea, #764ba2); 
                        color: white; 
                        padding: 18px 36px; 
                        text-decoration: none; 
                        border-radius: 50px; 
                        font-weight: 500;
                        letter-spacing: 1px;
                        transition: transform 0.2s ease;
                        box-shadow: 0 8px 20px rgba(102, 126, 234, 0.3);
                    }}
                    .button:hover {{
                        transform: translateY(-2px);
                        box-shadow: 0 12px 25px rgba(102, 126, 234, 0.4);
                    }}
                    .expiry {{
                        margin-top: 30px;
                        font-size: 13px;
                        color: #7f8c8d;
                        font-style: italic;
                    }}
                    .footer {{ 
                        text-align: center; 
                        padding: 20px 30px; 
                        background: #f8f9fa;
                        font-size: 11px; 
                        color: #95a5a6;
                        letter-spacing: 0.5px;
                    }}
                </style>
                </head>
                <body>
                    <div class=\"container\">
                        <div class=\"header\">
                            <div class=\"logo\">MythicalHelper</div>
                            <div class=\"motto\">Only Wonder Endures</div>
                        </div>
                        <div class=\"content\">
                            <div class=\"message\">
                                A new scroll bearing your name<br>
                                has arrived at the Guild chambers.
                            </div>
                            <a class=\"button\" href=\"{frontend_url}{redirect_path}\">Confirm New Address</a>
                            <div class=\"expiry\">This confirmation expires in 15 minutes</div>
                        </div>
                        <div class=\"footer\">© 2025 MythicalHelper Guild</div>
                    </div>
                </body>
                </html>
                """
            else:
                print(f"[ZOHO] ERROR: Unknown magic link purpose: {purpose}")
                return False
            
            # 打印 magic link 到日志（生产环境也打印）
            magic_link = f"{frontend_url}{redirect_path}"
            print(f"[MAGIC_LINK] {purpose.upper()} Magic Link: {magic_link}")
            print(f"[MAGIC_LINK] Email: {to_email}")
            print(f"[MAGIC_LINK] Token: {token}")
            
            # 发送邮件
            account_id = get_account_id_via_api()
            path = f"/accounts/{account_id}/messages"
            data = {
                "fromAddress": f"MythicalHelper <{FROM_ADDRESS}>",
                "toAddress": to_email,
                "subject": subject,
                "content": body_html,
                "mailFormat": "html",
            }
            resp = api_request("POST", path, json_data=json.dumps(data))
            _ = resp.json()
            print("[ZOHO] Magic link email sent")
            return True
        
        else:
            print(f"[ZOHO] ERROR: Unknown email mode: {config.EMAIL_MODE}")
            return False
    except Exception as e:
        print(f"[ZOHO] Magic link send failed: {e}")
        return False

def send_verification_email(to_email: str, verification_code: str) -> bool:
    """
    发送验证邮件
    
    Args:
        to_email: 收件人邮箱
        verification_code: 验证码
        
    Returns:
        bool: 发送是否成功
    """
    try:
        print(f"[ZOHO] 准备发送验证邮件到: {to_email}")
        
        # 获取账户ID
        account_id = get_account_id_via_api()
        
        # 邮件内容
        subject = "MythicalHelper Guild - Email Verification"
        
        html_content = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Email Verification</title>
    <style>
        body {{ 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
            line-height: 1.6; 
            color: #333; 
            margin: 0; 
            padding: 0; 
            background-color: #f4f4f4;
        }}
        .container {{ 
            max-width: 600px; 
            margin: 20px auto; 
            background: white; 
            border-radius: 10px; 
            overflow: hidden;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        }}
        .header {{ 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
            color: white; 
            padding: 30px 20px; 
            text-align: center; 
        }}
        .header h1 {{ 
            margin: 0; 
            font-size: 28px; 
            font-weight: 300;
        }}
        .header p {{ 
            margin: 10px 0 0 0; 
            font-size: 16px; 
            opacity: 0.9;
        }}
        .content {{ 
            padding: 20px 30px; 
        }}
        .code {{ 
            background: #e8f4fd; 
            border: 2px solid #2196F3; 
            padding: 20px; 
            text-align: center; 
            font-size: 32px; 
            font-weight: bold; 
            color: #1976D2; 
            margin: 10px 0; 
            border-radius: 8px; 
            letter-spacing: 3px;
            font-family: 'Courier New', monospace;
        }}
        .footer {{ 
            text-align: center; 
            margin-top: 10px; 
            color: #666; 
            font-size: 14px; 
            padding: 20px;
            background: #f8f9fa;
        }}
        .warning {{
            background: #fff3cd;
            border: 1px solid #ffeaa7;
            color: #856404;
            padding: 15px;
            border-radius: 5px;
            margin: 10px 0;
            text-align: center;
        }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🦉 MythicalHelper Guild</h1>
            <p>Email Verification</p>
        </div>
        <div class="content">
            <div class="code">{verification_code}</div>
            <div class="warning">
                <strong>⏰ Important:</strong> This code will expire in 10 minutes.
            </div>
        </div>
        <div class="footer">
            <p>© 2025 MythicalHelper Guild — Only Wonder Endures</p>
            <p>This is an automated message, please do not reply.</p>
        </div>
    </div>
</body>
</html>
        """.strip()
        
        text_content = f"""
{verification_code}

This code will expire in 10 minutes.
        """.strip()
        
        # 发送邮件
        path = f"/accounts/{account_id}/messages"
        data = {
            "fromAddress": f"MythicalHelper <{FROM_ADDRESS}>",
            "toAddress": to_email,
            "subject": subject,
            "content": html_content,
            "mailFormat": "html",
        }
        
        print(f"[ZOHO] 发送邮件...")
        print(f"[ZOHO] 请求数据: {data}")
        
        # 使用 JSON 格式发送请求
        import json
        resp = api_request("POST", path, json_data=json.dumps(data))
        result = resp.json()
        
        print(f"[ZOHO] 邮件发送成功!")
        print(f"[ZOHO] 消息ID: {result.get('data', {}).get('messageId', 'unknown')}")
        return True
        
    except (ZohoAuthError, ZohoApiError) as e:
        print(f"[ZOHO] 发送邮件失败: {e}")
        return False
    except Exception as e:
        print(f"[ZOHO] 发送邮件错误: {e}")
        return False


def test_connection() -> dict:
    """测试 Zoho 连接"""
    result = {
        'configured': True,
        'api_ready': False,
        'has_access_token': bool(_ACCESS_TOKEN),
        'has_refresh_token': bool(REFRESH_TOKEN),
        'is_valid': False,
        'expires_in_seconds': 0,
        'error': None
    }
    
    try:
        print("[ZOHO] 测试连接...")
        
        # 检查配置
        if not CLIENT_ID or not CLIENT_SECRET:
            result['error'] = "Zoho credentials not configured"
            return result
        
        # 检查令牌状态
        if _ACCESS_TOKEN and _now() < _TOKEN_EXPIRY_TS:
            result['is_valid'] = True
            result['expires_in_seconds'] = int(_TOKEN_EXPIRY_TS - _now())
            print(f"[ZOHO] 令牌有效，剩余 {result['expires_in_seconds']} 秒")
        
        # 测试 API 连接
        if _ACCESS_TOKEN and _now() < _TOKEN_EXPIRY_TS:
            print("[ZOHO] 使用现有令牌测试...")
            account_id = get_account_id_via_api()
            result['api_ready'] = True
            result['account_id'] = account_id
        else:
            result['error'] = "No valid access token, need authorization"
        
    except Exception as e:
        result['error'] = f"Connection test error: {e}"
        print(f"[ZOHO] 连接测试错误: {e}")
    
    return result


# 全局变量用于存储 refresh_token
def set_refresh_token(token: str):
    """设置 refresh_token"""
    global REFRESH_TOKEN
    REFRESH_TOKEN = token
    
    # 保存到文件
    tokens = _load_tokens()
    tokens['refresh_token'] = token
    _save_tokens(tokens)
    
    print(f"[ZOHO] Refresh token 已设置并保存")

def get_refresh_token() -> str:
    """获取 refresh_token"""
    return REFRESH_TOKEN

# 主函数（用于测试）
if __name__ == "__main__":
    print("=== Zoho Mail Sender 测试 ===")
    
    # 测试配置
    config = get_config()
    print(f"Zoho 邮箱: {config.ZOHO_EMAIL}")
    print(f"Client ID: {config.ZOHO_CLIENT_ID[:20]}...")
    print(f"Proxy URL: {config.ZOHO_PROXY_URL}")
    
    # 测试连接
    result = test_connection()
    print(f"\n连接测试结果: {result}")
    
    print("\n=== 测试完成 ===")
