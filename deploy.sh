#!/bin/bash

# MythicalHelper 后端部署脚本
# 使用方法: ./deploy.sh [服务器IP] [用户名] [服务器路径]

# 检查参数
if [ $# -ne 3 ]; then
    echo "使用方法: $0 <服务器IP> <用户名> <服务器路径>"
    echo "例如: $0 1.2.3.4 ubuntu /home/ubuntu/mythicalhelper"
    exit 1
fi

SERVER_IP=$1
USERNAME=$2
SERVER_PATH=$3

echo "🚀 开始部署 MythicalHelper 后端到 $USERNAME@$SERVER_IP:$SERVER_PATH"

# 检查服务器连接
echo "📡 检查服务器连接..."
ssh -o ConnectTimeout=10 $USERNAME@$SERVER_IP "echo '服务器连接成功'" || {
    echo "❌ 无法连接到服务器 $USERNAME@$SERVER_IP"
    exit 1
}

# 创建服务器目录（如果不存在）
echo "📁 创建服务器目录..."
ssh $USERNAME@$SERVER_IP "mkdir -p $SERVER_PATH"

# 上传后端代码
echo "📤 上传后端代码..."
scp -r server/* $USERNAME@$SERVER_IP:$SERVER_PATH/

# 在服务器上安装依赖和重启服务
echo "🔧 在服务器上安装依赖和重启服务..."
ssh $USERNAME@$SERVER_IP << EOF
    cd $SERVER_PATH
    
    # 激活虚拟环境（如果存在）
    if [ -d "venv" ]; then
        echo "激活现有虚拟环境..."
        source venv/bin/activate
    else
        echo "创建新的虚拟环境..."
        python3 -m venv venv
        source venv/bin/activate
    fi
    
    # 安装/更新依赖
    echo "安装Python依赖..."
    pip install -r requirements.txt
    
    # 停止现有服务
    echo "停止现有服务..."
    pkill -f "python main.py" 2>/dev/null || true
    pkill -f "uvicorn main:app" 2>/dev/null || true
    
    # 启动服务
    echo "启动新服务..."
    nohup uvicorn main:app --host 0.0.0.0 --port 8000 > server.log 2>&1 &
    
    # 等待服务启动
    sleep 3
    
    # 检查服务状态
    if pgrep -f "uvicorn main:app" > /dev/null; then
        echo "✅ 服务启动成功！"
        echo "📊 服务状态:"
        ps aux | grep uvicorn | grep -v grep
    else
        echo "❌ 服务启动失败，查看日志:"
        tail -20 server.log
        exit 1
    fi
EOF

echo "🎉 部署完成！"
echo "🌐 API地址: http://$SERVER_IP:8000"
echo "📋 查看日志: ssh $USERNAME@$SERVER_IP 'cd $SERVER_PATH && tail -f server.log'"
