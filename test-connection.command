#!/bin/bash

# 测试连接脚本
KEY_PATH="/Users/wei/GitHub/MythicalHelper/server/LightsailDefaultKey-us-east-1.pem"
SERVER_IP="2600:1f18:d0a:c900:c434:e3d:bb8f:cf8"
USERNAME="ubuntu"

echo "🔍 测试连接..."

# 测试1: 基本SSH连接
echo "测试1: SSH连接..."
ssh -6 -i "$KEY_PATH" -o ConnectTimeout=10 "$USERNAME@[$SERVER_IP]" "echo 'SSH连接成功'"

if [ $? -eq 0 ]; then
    echo "✅ SSH连接成功"
else
    echo "❌ SSH连接失败"
    echo "尝试IPv4连接..."
    # 如果有IPv4地址，可以在这里测试
fi

read -p "按任意键退出..."
