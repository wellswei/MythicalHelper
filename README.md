# MythicalHelper

一个为家长提供魔法角色徽章服务的 Web 应用，帮助维护童年的魔法。

## 项目结构

```
MythicalHelper/
├── admin/                 # 管理后台
├── auth/                  # 认证页面
├── portal/                # 用户门户
├── scan/                  # 徽章扫描页面
├── server/                # 后端服务器
│   ├── config.py          # 统一配置文件（所有密钥和配置）
│   ├── main.py            # 主应用
│   ├── database.py        # 数据库服务
│   ├── models.py          # 数据模型
│   ├── zoho_mail_sender.py # Zoho 邮件服务
│   ├── zoho_api_email.py  # Zoho API 邮件服务
│   ├── deploy.command     # 部署脚本
│   ├── stripe-proxy.js    # Stripe Cloudflare Worker 备份
│   └── zoho-proxy.js      # Zoho Cloudflare Worker 备份
├── index.html             # 首页
├── index.css              # 首页样式
├── index.js               # 首页脚本
└── logo.png               # 项目 Logo
```

## 配置管理

所有配置都集中在 `server/config.py` 文件中，包括：

- **基础配置**: 前端地址、API 地址、数据库连接
- **安全密钥**: JWT 密钥、加密密钥
- **Stripe 配置**: 支付密钥、价格设置
- **Zoho 配置**: 邮件服务配置
- **管理员配置**: 管理员信息
- **业务配置**: 公会名称、格言等
- **功能开关**: 各种功能的启用/禁用
- **服务器配置**: 端口、工作进程数等
- **安全配置**: 登录限制、安全头等
- **监控配置**: 健康检查、性能监控等

## 部署

### 1. 配置服务器信息

编辑 `server/deploy.command` 文件，更新以下信息：

```bash
SERVER_IP="你的服务器IPv6地址"
USERNAME="ubuntu"
SERVER_PATH="/home/ubuntu/mythicalhelper"
KEY_PATH="~/.ssh/你的私钥.pem"
```

### 2. 运行部署脚本

```bash
cd server
./deploy.command
```

部署脚本会自动：
- 上传整个 `server` 文件夹到服务器
- 安装 Python 依赖
- 重启服务
- 检查服务状态
- 测试 API 连接

## 服务管理

在服务器上可以使用以下命令管理服务：

```bash
# 查看服务状态
sudo systemctl status mythicalhelper

# 查看服务日志
sudo journalctl -u mythicalhelper -f

# 重启服务
sudo systemctl restart mythicalhelper

# 停止服务
sudo systemctl stop mythicalhelper

# 启动服务
sudo systemctl start mythicalhelper
```

## 配置测试

在本地测试配置：

```bash
cd server
python3 config.py
```

## 功能特性

- **用户认证**: 手机号/邮箱注册和登录
- **徽章管理**: 创建和管理魔法角色徽章
- **支付集成**: Stripe 支付处理
- **邮件服务**: Zoho 邮件发送
- **管理后台**: 用户和订单管理
- **响应式设计**: 支持移动端和桌面端
- **PDF 生成**: 证书 PDF 下载

## 技术栈

- **前端**: HTML5, CSS3, JavaScript
- **后端**: Python, FastAPI, SQLAlchemy
- **数据库**: SQLite
- **支付**: Stripe
- **邮件**: Zoho Mail API
- **部署**: AWS Lightsail, Cloudflare Pages
- **代理**: Cloudflare Workers

## 开发

### 本地开发

1. 克隆项目
2. 进入 `server` 目录
3. 创建虚拟环境：`python3 -m venv venv`
4. 激活虚拟环境：`source venv/bin/activate`
5. 安装依赖：`pip install -r requirements.txt`
6. 运行服务：`python main.py`

### 配置修改

所有配置都在 `server/config.py` 文件中，修改后需要重新部署：

```bash
cd server
./deploy.command
```

## 许可证

MIT License
