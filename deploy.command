#!/bin/bash

# MythicalHelper 一键部署脚本
# 双击运行即可更新所有Python文件到服务器

KEY_PATH="/Users/wei/GitHub/MythicalHelper/server/LightsailDefaultKey-us-east-1.pem"
SERVER_IP="2600:1f18:d0a:c900:c434:e3d:bb8f:cf8"
USERNAME="ubuntu"
SERVER_PATH="/home/ubuntu/mythicalhelper"

echo "🚀 更新 MythicalHelper 到 AWS 服务器..."

# 上传所有Python文件
echo "📤 上传 main.py..."
scp -6 -i "$KEY_PATH" server/main.py "$USERNAME@[$SERVER_IP]:$SERVER_PATH/"

echo "📤 上传 models.py..."
scp -6 -i "$KEY_PATH" server/models.py "$USERNAME@[$SERVER_IP]:$SERVER_PATH/"

echo "📤 上传 database.py..."
scp -6 -i "$KEY_PATH" server/database.py "$USERNAME@[$SERVER_IP]:$SERVER_PATH/"

echo "📤 上传 requirements.txt..."
scp -6 -i "$KEY_PATH" server/requirements.txt "$USERNAME@[$SERVER_IP]:$SERVER_PATH/"

echo "🎉 文件上传完成！"
echo "🌐 API地址: http://[$SERVER_IP]:8000"
echo "📋 服务器应该会自动重启服务"

read -p "按任意键退出..."
