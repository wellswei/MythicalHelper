#!/bin/bash
set -euo pipefail

# MythicalHelper 一键部署脚本
# 双击运行即可更新所有Python文件到服务器

KEY_PATH="/Users/wei/GitHub/MythicalHelper/server/LightsailDefaultKey-us-east-1.pem"
SERVER_IP="2600:1f18:d0a:c900:c434:e3d:bb8f:cf8"
USERNAME="ubuntu"
SERVER_PATH="/home/ubuntu/mythicalhelper"

echo "🚀 Deploying MythicalHelper..."

# 1) 检查连通
echo "📡 检查服务器连接..."
ssh -6 -i "$KEY_PATH" -o ConnectTimeout=10 "$USERNAME@[$SERVER_IP]" "echo connected"

# 2) 同步代码（保留目录结构）
echo "📤 同步Python文件..."
rsync -6av --delete -e "ssh -i $KEY_PATH" \
    server/*.py server/requirements.txt \
    "$USERNAME@[$SERVER_IP]:$SERVER_PATH/server/"

# 3) 远端安装依赖并重启服务
echo "🔄 安装依赖并重启服务..."
ssh -6 -i "$KEY_PATH" "$USERNAME@[$SERVER_IP]" bash -lc "
cd '$SERVER_PATH'
if [ -d venv ]; then source venv/bin/activate; fi
if [ -f server/requirements.txt ]; then pip install -r server/requirements.txt; fi
sudo systemctl restart mythicalhelper
sleep 2
sudo systemctl --no-pager --full status mythicalhelper || true
sudo journalctl -u mythicalhelper -n 50 --no-pager
"

echo "🎉 Done."
echo "🌐 API地址: http://[$SERVER_IP]:8000"
echo "📋 查看日志: ssh -6 -i \"$KEY_PATH\" \"$USERNAME@[$SERVER_IP]\" 'sudo journalctl -u mythicalhelper -f'"

read -p "按任意键退出..."
