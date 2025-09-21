#!/usr/bin/env python3
"""
MythicalHelper 统一配置文件
所有密钥和配置信息都硬编码在这里
"""

class Config:
    """统一配置管理类 - 硬编码版本"""
    
    def __init__(self):
        # ========= 基础配置 =========
        self.FRONTEND_URL = "https://mythicalhelper.org"
        self.API_URL = "https://api.mythicalhelper.org"
        self.DATABASE_URL = "sqlite:///mythicalhelper.db"
        
        # ========= 邮件模式配置 =========
        self.EMAIL_MODE = "production"  # "test" 或 "production"
        # test: 打印magic link到控制台，不发送邮件
        # production: 通过Zoho发送真实邮件
        
        # 快速切换方法：
        # self.set_test_mode()   # 切换到测试模式
        # self.set_production_mode()  # 切换到生产模式
        
        # ========= 安全密钥 =========
        self.JWT_SECRET_KEY = "mythical-helper-jwt-secret-key-2024-production"
        self.ENCRYPTION_KEY = "mythical-helper-encryption-key-2024-production"
        # Turnstile 已移除 - 魔法链接提供足够的安全保护
        
        # ========= Stripe 配置 =========
        self.STRIPE_SECRET_KEY = "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"
        self.STRIPE_PUBLISHABLE_KEY = "pk_live_51S4XMwArEWZmSCjIvRXSikHETRrfWw6URqH6cIKTMqsDEUfhSZJWAGFde1YLTbE5paltdUQR7Bi9Zy5taJZLJLRS00dJ9Hhdfu"
        self.STRIPE_WEBHOOK_SECRET = "whsec_Jjnz17IhJYwbOSMqeat8USOG02I2mLJz"
        
        # Stripe 价格配置
        self.RENEWAL_PRICE_ID = None  # 使用动态价格
        self.RENEWAL_AMOUNT_CENTS = 999  # $9.99
        self.DONATION_AMOUNT_CENTS = 1000  # $10.00
        
        # ========= Zoho 邮件服务配置 =========
        self.ZOHO_EMAIL = "official@mythicalhelper.org"
        self.ZOHO_CLIENT_ID = "1000.HZ1AUWZR1PGSKKEZ1MMCG9FZQ0LM5G"
        self.ZOHO_CLIENT_SECRET = "054603ee6d0af41acc7f44866d9551223f2ea114e1"
        self.ZOHO_REDIRECT_URI = "https://api.mythicalhelper.org/auth/callback"
        self.ZOHO_SCOPE = "ZohoMail.accounts.READ,ZohoMail.messages.CREATE"
        self.ZOHO_PROXY_URL = "https://zoho.mythicalhelper.org"  # Cloudflare Worker Proxy
        
        # ========= 管理员配置 =========
        self.ADMIN_USERNAME = "Admin"
        self.ADMIN_EMAIL = "admin@mythicalhelper.org"
        
        # ========= 业务配置 =========
        self.GUILD_NAME = "MythicalHelper Guild"
        self.GUILD_MOTTO = "Only Wonder Endures"
        self.SUPPORT_EMAIL = "support@mythicalhelper.org"
        
        # ========= 功能开关 =========
        self.ENABLE_EMAIL_VERIFICATION = True
        self.ENABLE_STRIPE_PAYMENTS = True
        self.ENABLE_ADMIN_PANEL = True
        
        # ========= 服务器配置 =========
        self.SERVER_HOST = "0.0.0.0"
        self.SERVER_PORT = 8000
        self.SERVER_WORKERS = 1
        
        # ========= 数据库配置 =========
        self.DB_ECHO = False  # 是否打印SQL语句
        self.DB_POOL_SIZE = 5
        self.DB_MAX_OVERFLOW = 10
        
        # ========= 日志配置 =========
        self.LOG_LEVEL = "INFO"
        self.LOG_FORMAT = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
        
        # ========= 缓存配置 =========
        self.CACHE_TTL = 300  # 5分钟
        self.SESSION_TIMEOUT = 3600  # 1小时
        
        # ========= 安全配置 =========
        self.MAX_LOGIN_ATTEMPTS = 5
        self.LOCKOUT_DURATION = 900  # 15分钟
        self.PASSWORD_MIN_LENGTH = 8
        
        # ========= 邮件配置 =========
        self.EMAIL_RETRY_ATTEMPTS = 3
        self.EMAIL_RETRY_DELAY = 5  # 秒
        self.EMAIL_TIMEOUT = 30  # 秒
        
        # ========= 支付配置 =========
        self.PAYMENT_TIMEOUT = 1800  # 30分钟
        self.REFUND_GRACE_PERIOD = 86400  # 24小时
        
        # ========= 文件上传配置 =========
        self.MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
        self.ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.pdf']
        
        # ========= 监控配置 =========
        self.HEALTH_CHECK_INTERVAL = 60  # 秒
        self.METRICS_ENABLED = True
        self.PERFORMANCE_MONITORING = True
        
        # ========= 开发配置 =========
        self.DEBUG = False
        self.RELOAD = False
        self.TESTING = False
        
        # ========= 部署配置 =========
        self.DEPLOYMENT_ENV = "production"
        self.VERSION = "1.0.0"
        self.BUILD_DATE = "2024-01-01"
        
        # ========= 第三方服务配置 =========
        self.CLOUDFLARE_WORKER_URL = "https://zoho.mythicalhelper.org"
        self.STRIPE_WEBHOOK_URL = "https://api.mythicalhelper.org/webhook/stripe"
        
        # ========= 备份配置 =========
        self.BACKUP_ENABLED = True
        self.BACKUP_INTERVAL = 86400  # 24小时
        self.BACKUP_RETENTION_DAYS = 30
        
        # ========= 通知配置 =========
        self.NOTIFICATION_EMAIL = "notifications@mythicalhelper.org"
        self.ALERT_EMAIL = "alerts@mythicalhelper.org"
        
        # ========= 统计配置 =========
        self.ANALYTICS_ENABLED = True
        self.USER_TRACKING = True
        self.PERFORMANCE_METRICS = True
        
        # ========= 维护配置 =========
        self.MAINTENANCE_MODE = False
        self.MAINTENANCE_MESSAGE = "系统维护中，请稍后再试"
        self.MAINTENANCE_END_TIME = None
        
        # ========= 限流配置 =========
        self.RATE_LIMIT_ENABLED = True
        self.RATE_LIMIT_REQUESTS = 100  # 每分钟请求数
        self.RATE_LIMIT_WINDOW = 60  # 时间窗口（秒）
        
        # ========= 安全头配置 =========
        self.SECURITY_HEADERS = {
            "X-Content-Type-Options": "nosniff",
            "X-Frame-Options": "DENY",
            "X-XSS-Protection": "1; mode=block",
            "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
            "Referrer-Policy": "strict-origin-when-cross-origin"
        }
        
        # ========= CORS 配置 =========
        self.CORS_ORIGINS = [
            "https://mythicalhelper.org",
            "https://www.mythicalhelper.org",
            "https://admin.mythicalhelper.org"
        ]
        
        # ========= 数据库连接池配置 =========
        self.DB_POOL_RECYCLE = 3600  # 1小时
        self.DB_POOL_PRE_PING = True
        self.DB_POOL_TIMEOUT = 30
        
        # ========= 缓存配置 =========
        self.REDIS_URL = None  # 如果使用Redis
        self.MEMCACHED_URL = None  # 如果使用Memcached
        
        # ========= 文件存储配置 =========
        self.UPLOAD_DIR = "uploads"
        self.STATIC_DIR = "static"
        self.MEDIA_DIR = "media"
        
        # ========= 邮件模板配置 =========
        self.EMAIL_TEMPLATES = {
            "verification": "verification_email.html",
            "welcome": "welcome_email.html",
            "password_reset": "password_reset_email.html",
            "notification": "notification_email.html"
        }
        
        # ========= 支付回调配置 =========
        self.PAYMENT_CALLBACK_URL = "https://api.mythicalhelper.org/payment/callback"
        self.PAYMENT_SUCCESS_URL = "https://mythicalhelper.org/portal/portal.html"
        self.PAYMENT_CANCEL_URL = "https://mythicalhelper.org/portal/portal.html"
        
        # ========= 错误处理配置 =========
        self.ERROR_REPORTING = True
        self.ERROR_EMAIL = "errors@mythicalhelper.org"
        self.ERROR_SLACK_WEBHOOK = None  # 如果使用Slack
        
        # ========= 性能配置 =========
        self.GZIP_COMPRESSION = True
        self.STATIC_CACHE_MAX_AGE = 31536000  # 1年
        self.DYNAMIC_CACHE_MAX_AGE = 3600  # 1小时
        
        # ========= 安全配置 =========
        self.SSL_REDIRECT = True
        self.HSTS_MAX_AGE = 31536000  # 1年
        self.CSP_POLICY = "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'"
        
        # ========= 监控配置 =========
        self.HEALTH_CHECK_ENDPOINTS = [
            "/health",
            "/health/db",
            "/health/email",
            "/health/stripe"
        ]
        
        # ========= 日志轮转配置 =========
        self.LOG_ROTATION = True
        self.LOG_MAX_SIZE = 10 * 1024 * 1024  # 10MB
        self.LOG_BACKUP_COUNT = 5
        
        # ========= 数据库迁移配置 =========
        self.DB_MIGRATION_ENABLED = True
        self.DB_MIGRATION_DIR = "migrations"
        self.DB_MIGRATION_AUTO_UPGRADE = True
        
        # ========= 测试配置 =========
        self.TEST_DATABASE_URL = "sqlite:///test_mythicalhelper.db"
        self.TEST_EMAIL = "test@mythicalhelper.org"
        
        # ========= 开发工具配置 =========
        self.PROFILER_ENABLED = False
        self.DEBUG_TOOLBAR = False
        self.SQL_DEBUG = False
        
        # ========= 国际化配置 =========
        self.DEFAULT_LANGUAGE = "en"
        self.SUPPORTED_LANGUAGES = ["en", "zh", "es", "fr"]
        self.TIMEZONE = "UTC"
        
        # ========= 文件处理配置 =========
        self.IMAGE_PROCESSING = True
        self.IMAGE_QUALITY = 85
        self.IMAGE_MAX_WIDTH = 1920
        self.IMAGE_MAX_HEIGHT = 1080
        
        # ========= 搜索配置 =========
        self.SEARCH_ENABLED = True
        self.SEARCH_INDEX_DIR = "search_index"
        self.SEARCH_BATCH_SIZE = 100
        
        # ========= 任务队列配置 =========
        self.TASK_QUEUE_ENABLED = False
        self.TASK_QUEUE_URL = None
        self.TASK_QUEUE_NAME = "mythicalhelper_tasks"
        
        # ========= 消息队列配置 =========
        self.MESSAGE_QUEUE_ENABLED = False
        self.MESSAGE_QUEUE_URL = None
        self.MESSAGE_QUEUE_TOPIC = "mythicalhelper_messages"
        
        # ========= 分布式配置 =========
        self.CLUSTER_MODE = False
        self.NODE_ID = "node-1"
        self.CLUSTER_NODES = []
        
        # ========= 负载均衡配置 =========
        self.LOAD_BALANCER_ENABLED = False
        self.LOAD_BALANCER_ALGORITHM = "round_robin"
        self.LOAD_BALANCER_HEALTH_CHECK = True
        
        # ========= 服务发现配置 =========
        self.SERVICE_DISCOVERY_ENABLED = False
        self.SERVICE_REGISTRY_URL = None
        self.SERVICE_NAME = "mythicalhelper-api"
        
        # ========= 配置验证 =========
        self._validate_config()
    
    def _validate_config(self):
        """验证配置的有效性"""
        errors = []
        warnings = []
        
        # 检查必需配置
        if not self.STRIPE_SECRET_KEY:
            errors.append("Stripe secret key is required")
        
        if not self.ZOHO_CLIENT_ID:
            errors.append("Zoho client ID is required")
        
        if not self.JWT_SECRET_KEY or self.JWT_SECRET_KEY == "your-secret-key":
            errors.append("JWT secret key must be changed from default")
        
        if not self.ENCRYPTION_KEY or self.ENCRYPTION_KEY == "your-encryption-key":
            errors.append("Encryption key must be changed from default")
        
        # 检查配置合理性
        if self.RENEWAL_AMOUNT_CENTS < 100:
            warnings.append("Renewal amount seems too low")
        
        if self.DONATION_AMOUNT_CENTS < 100:
            warnings.append("Donation amount seems too low")
        
        if self.PASSWORD_MIN_LENGTH < 8:
            warnings.append("Password minimum length should be at least 8")
        
        # 检查URL格式
        if not self.FRONTEND_URL.startswith("https://"):
            warnings.append("Frontend URL should use HTTPS")
        
        if not self.API_URL.startswith("https://"):
            warnings.append("API URL should use HTTPS")
        
        # 如果有错误，抛出异常
        if errors:
            raise ValueError(f"Configuration errors: {', '.join(errors)}")
        
        # 如果有警告，打印出来
        if warnings:
            print(f"Configuration warnings: {', '.join(warnings)}")
    
    def get_stripe_config(self):
        """获取 Stripe 配置"""
        return {
            "secret_key": self.STRIPE_SECRET_KEY,
            "publishable_key": self.STRIPE_PUBLISHABLE_KEY,
            "webhook_secret": self.STRIPE_WEBHOOK_SECRET,
            "renewal_amount_cents": self.RENEWAL_AMOUNT_CENTS,
            "donation_amount_cents": self.DONATION_AMOUNT_CENTS,
        }
    
    def get_zoho_config(self):
        """获取 Zoho 配置"""
        return {
            "email": self.ZOHO_EMAIL,
            "client_id": self.ZOHO_CLIENT_ID,
            "client_secret": self.ZOHO_CLIENT_SECRET,
            "redirect_uri": self.ZOHO_REDIRECT_URI,
            "scope": self.ZOHO_SCOPE,
            "proxy_url": self.ZOHO_PROXY_URL,
        }
    
    def get_admin_config(self):
        """获取管理员配置"""
        return {
            "username": self.ADMIN_USERNAME,
            "email": self.ADMIN_EMAIL,
        }
    
    def get_business_config(self):
        """获取业务配置"""
        return {
            "guild_name": self.GUILD_NAME,
            "guild_motto": self.GUILD_MOTTO,
            "support_email": self.SUPPORT_EMAIL,
        }
    
    def get_feature_flags(self):
        """获取功能开关"""
        return {
            "email_verification": self.ENABLE_EMAIL_VERIFICATION,
            "stripe_payments": self.ENABLE_STRIPE_PAYMENTS,
            "admin_panel": self.ENABLE_ADMIN_PANEL,
        }
    
    def get_security_config(self):
        """获取安全配置"""
        return {
            "jwt_secret": self.JWT_SECRET_KEY,
            "encryption_key": self.ENCRYPTION_KEY,
            "max_login_attempts": self.MAX_LOGIN_ATTEMPTS,
            "lockout_duration": self.LOCKOUT_DURATION,
            "password_min_length": self.PASSWORD_MIN_LENGTH,
            "security_headers": self.SECURITY_HEADERS,
        }
    
    def get_database_config(self):
        """获取数据库配置"""
        return {
            "url": self.DATABASE_URL,
            "echo": self.DB_ECHO,
            "pool_size": self.DB_POOL_SIZE,
            "max_overflow": self.DB_MAX_OVERFLOW,
            "pool_recycle": self.DB_POOL_RECYCLE,
            "pool_pre_ping": self.DB_POOL_PRE_PING,
            "pool_timeout": self.DB_POOL_TIMEOUT,
        }
    
    def get_server_config(self):
        """获取服务器配置"""
        return {
            "host": self.SERVER_HOST,
            "port": self.SERVER_PORT,
            "workers": self.SERVER_WORKERS,
            "debug": self.DEBUG,
            "reload": self.RELOAD,
        }
    
    def get_logging_config(self):
        """获取日志配置"""
        return {
            "level": self.LOG_LEVEL,
            "format": self.LOG_FORMAT,
            "rotation": self.LOG_ROTATION,
            "max_size": self.LOG_MAX_SIZE,
            "backup_count": self.LOG_BACKUP_COUNT,
        }
    
    def get_cors_config(self):
        """获取CORS配置"""
        return {
            "origins": self.CORS_ORIGINS,
            "allow_credentials": True,
            "allow_methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
            "allow_headers": ["*"],
        }
    
    def get_cache_config(self):
        """获取缓存配置"""
        return {
            "ttl": self.CACHE_TTL,
            "session_timeout": self.SESSION_TIMEOUT,
            "redis_url": self.REDIS_URL,
            "memcached_url": self.MEMCACHED_URL,
        }
    
    def get_monitoring_config(self):
        """获取监控配置"""
        return {
            "health_check_interval": self.HEALTH_CHECK_INTERVAL,
            "metrics_enabled": self.METRICS_ENABLED,
            "performance_monitoring": self.PERFORMANCE_MONITORING,
            "health_check_endpoints": self.HEALTH_CHECK_ENDPOINTS,
        }
    
    def get_file_config(self):
        """获取文件配置"""
        return {
            "upload_dir": self.UPLOAD_DIR,
            "static_dir": self.STATIC_DIR,
            "media_dir": self.MEDIA_DIR,
            "max_file_size": self.MAX_FILE_SIZE,
            "allowed_extensions": self.ALLOWED_EXTENSIONS,
        }
    
    def get_email_config(self):
        """获取邮件配置"""
        return {
            "zoho": self.get_zoho_config(),
            "retry_attempts": self.EMAIL_RETRY_ATTEMPTS,
            "retry_delay": self.EMAIL_RETRY_DELAY,
            "timeout": self.EMAIL_TIMEOUT,
            "templates": self.EMAIL_TEMPLATES,
        }
    
    def get_payment_config(self):
        """获取支付配置"""
        return {
            "stripe": self.get_stripe_config(),
            "timeout": self.PAYMENT_TIMEOUT,
            "refund_grace_period": self.REFUND_GRACE_PERIOD,
            "callback_url": self.PAYMENT_CALLBACK_URL,
            "success_url": self.PAYMENT_SUCCESS_URL,
            "cancel_url": self.PAYMENT_CANCEL_URL,
        }
    
    def get_rate_limit_config(self):
        """获取限流配置"""
        return {
            "enabled": self.RATE_LIMIT_ENABLED,
            "requests": self.RATE_LIMIT_REQUESTS,
            "window": self.RATE_LIMIT_WINDOW,
        }
    
    def get_development_config(self):
        """获取开发配置"""
        return {
            "debug": self.DEBUG,
            "reload": self.RELOAD,
            "testing": self.TESTING,
            "profiler_enabled": self.PROFILER_ENABLED,
            "debug_toolbar": self.DEBUG_TOOLBAR,
            "sql_debug": self.SQL_DEBUG,
        }
    
    def get_deployment_config(self):
        """获取部署配置"""
        return {
            "environment": self.DEPLOYMENT_ENV,
            "version": self.VERSION,
            "build_date": self.BUILD_DATE,
            "email_mode": self.EMAIL_MODE,
            "maintenance_mode": self.MAINTENANCE_MODE,
            "maintenance_message": self.MAINTENANCE_MESSAGE,
            "maintenance_end_time": self.MAINTENANCE_END_TIME,
        }
    
    def print_config_summary(self):
        """打印配置摘要"""
        print("=== MythicalHelper 配置摘要 ===")
        print(f"前端地址: {self.FRONTEND_URL}")
        print(f"API 地址: {self.API_URL}")
        print(f"数据库: {self.DATABASE_URL}")
        print(f"Stripe: {'已配置' if self.STRIPE_SECRET_KEY else '未配置'}")
        print(f"Zoho: {'已配置' if self.ZOHO_CLIENT_ID else '未配置'}")
        print(f"功能开关: {self.get_feature_flags()}")
        print(f"部署环境: {self.DEPLOYMENT_ENV}")
        print(f"版本: {self.VERSION}")
        print(f"构建日期: {self.BUILD_DATE}")
        
        # 验证配置
        try:
            self._validate_config()
            print("✅ 配置验证通过")
        except ValueError as e:
            print(f"❌ 配置验证失败: {e}")
    
    def set_test_mode(self):
        """切换到测试模式"""
        self.EMAIL_MODE = "test"
        print("[CONFIG] 切换到测试模式 - magic link将打印到控制台")
    
    def set_production_mode(self):
        """切换到生产模式"""
        self.EMAIL_MODE = "production"
        print("[CONFIG] 切换到生产模式 - magic link将通过Zoho发送邮件")
    
    def to_dict(self):
        """转换为字典格式"""
        return {
            "frontend_url": self.FRONTEND_URL,
            "api_url": self.API_URL,
            "database_url": self.DATABASE_URL,
            "jwt_secret_key": self.JWT_SECRET_KEY,
            "encryption_key": self.ENCRYPTION_KEY,
            "stripe": self.get_stripe_config(),
            "zoho": self.get_zoho_config(),
            "admin": self.get_admin_config(),
            "business": self.get_business_config(),
            "features": self.get_feature_flags(),
            "security": self.get_security_config(),
            "database": self.get_database_config(),
            "server": self.get_server_config(),
            "logging": self.get_logging_config(),
            "cors": self.get_cors_config(),
            "cache": self.get_cache_config(),
            "monitoring": self.get_monitoring_config(),
            "file": self.get_file_config(),
            "email": self.get_email_config(),
            "payment": self.get_payment_config(),
            "rate_limit": self.get_rate_limit_config(),
            "development": self.get_development_config(),
            "deployment": self.get_deployment_config(),
        }

# 全局配置实例
_config_instance = None

def get_config():
    """获取配置实例（单例模式）"""
    global _config_instance
    if _config_instance is None:
        _config_instance = Config()
    return _config_instance

# 便捷函数
def get_stripe_config():
    """获取 Stripe 配置"""
    return get_config().get_stripe_config()

def get_zoho_config():
    """获取 Zoho 配置"""
    return get_config().get_zoho_config()

def get_admin_config():
    """获取管理员配置"""
    return get_config().get_admin_config()

def get_business_config():
    """获取业务配置"""
    return get_config().get_business_config()

def get_feature_flags():
    """获取功能开关"""
    return get_config().get_feature_flags()

def get_security_config():
    """获取安全配置"""
    return get_config().get_security_config()

def get_database_config():
    """获取数据库配置"""
    return get_config().get_database_config()

def get_server_config():
    """获取服务器配置"""
    return get_config().get_server_config()

def get_logging_config():
    """获取日志配置"""
    return get_config().get_logging_config()

def get_cors_config():
    """获取CORS配置"""
    return get_config().get_cors_config()

def get_cache_config():
    """获取缓存配置"""
    return get_config().get_cache_config()

def get_monitoring_config():
    """获取监控配置"""
    return get_config().get_monitoring_config()

def get_file_config():
    """获取文件配置"""
    return get_config().get_file_config()

def get_email_config():
    """获取邮件配置"""
    return get_config().get_email_config()

def get_payment_config():
    """获取支付配置"""
    return get_config().get_payment_config()

def get_rate_limit_config():
    """获取限流配置"""
    return get_config().get_rate_limit_config()

def get_development_config():
    """获取开发配置"""
    return get_config().get_development_config()

def get_deployment_config():
    """获取部署配置"""
    return get_config().get_deployment_config()

# 主函数（用于测试）
if __name__ == "__main__":
    config = get_config()
    config.print_config_summary()
    
    # 测试配置获取
    print("\n=== 测试配置获取 ===")
    print(f"Stripe 配置: {get_stripe_config()}")
    print(f"Zoho 配置: {get_zoho_config()}")
    print(f"管理员配置: {get_admin_config()}")
    print(f"业务配置: {get_business_config()}")
    print(f"功能开关: {get_feature_flags()}")
    print(f"安全配置: {get_security_config()}")
    print(f"数据库配置: {get_database_config()}")
    print(f"服务器配置: {get_server_config()}")
    print(f"日志配置: {get_logging_config()}")
    print(f"CORS 配置: {get_cors_config()}")
    print(f"缓存配置: {get_cache_config()}")
    print(f"监控配置: {get_monitoring_config()}")
    print(f"文件配置: {get_file_config()}")
    print(f"邮件配置: {get_email_config()}")
    print(f"支付配置: {get_payment_config()}")
    print(f"限流配置: {get_rate_limit_config()}")
    print(f"开发配置: {get_development_config()}")
    print(f"部署配置: {get_deployment_config()}")
    
    # 测试字典转换
    print("\n=== 测试字典转换 ===")
    config_dict = config.to_dict()
    print(f"配置字典键数量: {len(config_dict)}")
    print(f"配置字典键: {list(config_dict.keys())}")
    
    print("\n=== 配置测试完成 ===")
