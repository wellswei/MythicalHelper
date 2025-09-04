#!/bin/bash

# 快速部署脚本 - 需要手动配置服务器信息
# 请修改下面的服务器信息

# 服务器配置 - 请根据实际情况修改
SERVER_IP="your-server-ip"
USERNAME="ubuntu"  # 或其他用户名
SERVER_PATH="/home/ubuntu/mythicalhelper"

echo "🚀 快速部署 MythicalHelper 后端"
echo "服务器: $USERNAME@$SERVER_IP:$SERVER_PATH"
echo ""

# 检查配置
if [ "$SERVER_IP" = "your-server-ip" ]; then
    echo "❌ 请先修改脚本中的服务器信息！"
    echo "编辑 quick-deploy.sh 文件，设置正确的 SERVER_IP"
    exit 1
fi

# 上传代码
echo "📤 上传后端代码..."
scp -r server/* $USERNAME@$SERVER_IP:$SERVER_PATH/

# 重启服务
echo "🔄 重启服务..."
ssh $USERNAME@$SERVER_IP << EOF
    cd $SERVER_PATH
    source venv/bin/activate
    pkill -f "uvicorn main:app" 2>/dev/null || true
    nohup uvicorn main:app --host 0.0.0.0 --port 8000 > server.log 2>&1 &
    echo "✅ 服务已重启"
EOF

echo "🎉 部署完成！"
