# MythicalHelper 部署指南

## 后端部署到AWS服务器

### 方法1: 使用完整部署脚本

```bash
# 使用完整部署脚本（推荐）
./deploy.sh <服务器IP> <用户名> <服务器路径>

# 例如:
./deploy.sh 1.2.3.4 ubuntu /home/ubuntu/mythicalhelper
```

### 方法2: 使用快速部署脚本

1. 编辑 `quick-deploy.sh` 文件，设置正确的服务器信息：
   ```bash
   SERVER_IP="your-actual-server-ip"
   USERNAME="ubuntu"  # 或其他用户名
   SERVER_PATH="/home/ubuntu/mythicalhelper"
   ```

2. 运行部署脚本：
   ```bash
   ./quick-deploy.sh
   ```

### 方法3: 手动部署

```bash
# 1. 上传代码到服务器
scp -r server/* username@server-ip:/path/to/mythicalhelper/

# 2. SSH到服务器
ssh username@server-ip

# 3. 进入项目目录
cd /path/to/mythicalhelper/

# 4. 激活虚拟环境
source venv/bin/activate

# 5. 安装依赖
pip install -r requirements.txt

# 6. 停止现有服务
pkill -f "uvicorn main:app" 2>/dev/null || true

# 7. 启动服务
nohup uvicorn main:app --host 0.0.0.0 --port 8000 > server.log 2>&1 &
```

## 服务器要求

- Python 3.8+
- 虚拟环境已创建
- 端口8000开放
- 环境变量已设置（TURNSTILE_SECRET等）

## 检查部署状态

```bash
# 检查服务是否运行
ssh username@server-ip "ps aux | grep uvicorn"

# 查看日志
ssh username@server-ip "cd /path/to/mythicalhelper && tail -f server.log"

# 测试API
curl http://server-ip:8000/health
```

## 环境变量

确保服务器上设置了以下环境变量：

```bash
export TURNSTILE_SECRET="your-turnstile-secret"
export DATABASE_URL="sqlite:///./mythicalhelper.db"
# 其他必要的环境变量...
```

## 故障排除

1. **服务启动失败**: 检查日志文件 `server.log`
2. **端口被占用**: 使用 `lsof -i :8000` 检查端口使用情况
3. **权限问题**: 确保用户有权限访问项目目录
4. **依赖问题**: 重新安装依赖 `pip install -r requirements.txt`
