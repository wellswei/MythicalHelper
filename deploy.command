#!/bin/bash

# MythicalHelper 一键部署脚本
# 双击运行即可更新服务器文件

echo "🚀 开始部署 MythicalHelper 到 AWS 服务器..."

# 设置变量
KEY_PATH="/Users/wei/GitHub/MythicalHelper/server/LightsailDefaultKey-us-east-1.pem"
SERVER_IP="2600:1f18:d0a:c900:c434:e3d:bb8f:cf8"
USERNAME="ubuntu"
SERVER_PATH="/home/ubuntu/mythicalhelper"

# 检查密钥文件是否存在
if [ ! -f "$KEY_PATH" ]; then
    echo "❌ 错误: 找不到密钥文件 $KEY_PATH"
    echo "请确保密钥文件路径正确"
    read -p "按任意键退出..."
    exit 1
fi

# 检查服务器连接
echo "📡 检查服务器连接..."
ssh -6 -i "$KEY_PATH" -o ConnectTimeout=10 $USERNAME@$SERVER_IP "echo '服务器连接成功'" || {
    echo "❌ 无法连接到服务器"
    read -p "按任意键退出..."
    exit 1
}

# 上传所有后端文件
echo "📤 上传后端文件..."
scp -6 -i "$KEY_PATH" main.py $USERNAME@$SERVER_IP:$SERVER_PATH/
scp -6 -i "$KEY_PATH" models.py $USERNAME@$SERVER_IP:$SERVER_PATH/
scp -6 -i "$KEY_PATH" database.py $USERNAME@$SERVER_IP:$SERVER_PATH/
scp -6 -i "$KEY_PATH" requirements.txt $USERNAME@$SERVER_IP:$SERVER_PATH/

# 在服务器上重启服务
echo "🔄 重启服务器..."
ssh -6 -i "$KEY_PATH" $USERNAME@$SERVER_IP << 'EOF'
    cd /home/ubuntu/mythicalhelper
    
    # 激活虚拟环境
    source venv/bin/activate
    
    # 停止现有服务
    echo "停止现有服务..."
    pkill -f "uvicorn main:app" 2>/dev/null || true
    sleep 2
    
    # 启动新服务
    echo "启动新服务..."
    nohup uvicorn main:app --host 0.0.0.0 --port 8000 > server.log 2>&1 &
    
    # 等待服务启动
    sleep 3
    
    # 检查服务状态
    if pgrep -f "uvicorn main:app" > /dev/null; then
        echo "✅ 服务启动成功！"
        echo "📊 服务进程:"
        ps aux | grep uvicorn | grep -v grep
    else
        echo "❌ 服务启动失败，查看日志:"
        tail -20 server.log
        exit 1
    fi
EOF

if [ $? -eq 0 ]; then
    echo ""
    echo "🎉 部署完成！"
    echo "🌐 API地址: http://[$SERVER_IP]:8000"
    echo "📋 查看日志: ssh -6 -i \"$KEY_PATH\" $USERNAME@$SERVER_IP 'cd $SERVER_PATH && tail -f server.log'"
else
    echo "❌ 部署失败，请检查错误信息"
fi

echo ""
read -p "按任意键退出..."
