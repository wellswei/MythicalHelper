#!/bin/bash

# MythicalHelper 一键部署脚本
# 双击运行即可更新所有Python文件到服务器

KEY_PATH="/Users/wei/GitHub/MythicalHelper/server/LightsailDefaultKey-us-east-1.pem"
SERVER_IP="2600:1f18:d0a:c900:c434:e3d:bb8f:cf8"
USERNAME="ubuntu"
SERVER_PATH="/home/ubuntu/mythicalhelper"

echo "🚀 更新 MythicalHelper 到 AWS 服务器..."

echo "🛑 停止当前服务..."
ssh -6 -i "$KEY_PATH" "$USERNAME@$SERVER_IP" "sudo systemctl stop mythicalhelper"

echo "⏳ 等待服务完全停止..."
sleep 3

# 上传所有Python文件
echo "📤 上传 main.py..."
scp -6 -i "$KEY_PATH" server/main.py "$USERNAME@[$SERVER_IP]:$SERVER_PATH/"

echo "📤 上传 models.py..."
scp -6 -i "$KEY_PATH" server/models.py "$USERNAME@[$SERVER_IP]:$SERVER_PATH/"

echo "📤 上传 database.py..."
scp -6 -i "$KEY_PATH" server/database.py "$USERNAME@[$SERVER_IP]:$SERVER_PATH/"

echo "📤 上传 requirements.txt..."
scp -6 -i "$KEY_PATH" server/requirements.txt "$USERNAME@[$SERVER_IP]:$SERVER_PATH/"

echo "📦 安装Python依赖..."
ssh -6 -i "$KEY_PATH" "$USERNAME@$SERVER_IP" "cd $SERVER_PATH && source venv/bin/activate && pip install -r requirements.txt"

echo "🔄 启动新版本服务..."
ssh -6 -i "$KEY_PATH" "$USERNAME@$SERVER_IP" "sudo systemctl start mythicalhelper"

echo "⏳ 等待服务启动..."
sleep 5

echo "✅ 检查服务状态..."
ssh -6 -i "$KEY_PATH" "$USERNAME@$SERVER_IP" "sudo systemctl status mythicalhelper --no-pager"

echo "🎉 后端文件上传完成！"
echo "🌐 API地址: http://[$SERVER_IP]:8000"
echo "📋 服务已重启"