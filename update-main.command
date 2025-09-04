#!/bin/bash

# 快速更新 main.py 文件
# 双击运行即可更新服务器上的 main.py

echo "🚀 更新 main.py 文件..."

# 设置变量
KEY_PATH="/Users/wei/GitHub/MythicalHelper/server/LightsailDefaultKey-us-east-1.pem"
SERVER_IP="2600:1f18:d0a:c900:c434:e3d:bb8f:cf8"
USERNAME="ubuntu"
SERVER_PATH="/home/ubuntu/mythicalhelper"

# 检查文件是否存在
if [ ! -f "main.py" ]; then
    echo "❌ 错误: 找不到 main.py 文件"
    echo "请确保在正确的目录中运行此脚本"
    read -p "按任意键退出..."
    exit 1
fi

# 上传文件
echo "📤 上传 main.py..."
scp -6 -i "$KEY_PATH" main.py $USERNAME@$SERVER_IP:$SERVER_PATH/

# 重启服务
echo "🔄 重启服务..."
ssh -6 -i "$KEY_PATH" $USERNAME@$SERVER_IP << 'EOF'
    cd /home/ubuntu/mythicalhelper
    source venv/bin/activate
    pkill -f "uvicorn main:app" 2>/dev/null || true
    sleep 2
    nohup uvicorn main:app --host 0.0.0.0 --port 8000 > server.log 2>&1 &
    echo "✅ 服务已重启"
EOF

echo "🎉 更新完成！"
read -p "按任意键退出..."
