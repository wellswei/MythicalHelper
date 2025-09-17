#!/bin/bash
set -euo pipefail

# ===== 参数解析 =====
REBUILD_VENV=false
REBUILD_DB=false
HELP=false

while [[ $# -gt 0 ]]; do
  case $1 in
    --rebuild-venv)
      REBUILD_VENV=true
      shift
      ;;
    --rebuild-db)
      REBUILD_DB=true
      shift
      ;;
    --rebuild-all)
      REBUILD_VENV=true
      REBUILD_DB=true
      shift
      ;;
    -h|--help)
      HELP=true
      shift
      ;;
    *)
      echo "❌ 未知参数: $1"
      echo "使用 -h 或 --help 查看帮助"
      exit 1
      ;;
  esac
done

# ===== 帮助信息 =====
if [[ "$HELP" == true ]]; then
  echo "🚀 MythicalHelper 部署脚本"
  echo ""
  echo "用法: $0 [选项]"
  echo ""
  echo "选项:"
  echo "  --rebuild-venv    重建虚拟环境"
  echo "  --rebuild-db      重建数据库"
  echo "  --rebuild-all     重建虚拟环境和数据库"
  echo "  -h, --help        显示此帮助信息"
  echo ""
  echo "示例:"
  echo "  $0                    # 普通部署（不重建）"
  echo "  $0 --rebuild-venv     # 重建虚拟环境"
  echo "  $0 --rebuild-db       # 重建数据库"
  echo "  $0 --rebuild-all      # 重建所有"
  exit 0
fi

# ===== 基本配置 =====
SERVER_IP="2600:1f18:d0a:c900:c434:e3d:bb8f:cf8"
USERNAME="ubuntu"
SERVER_PATH="/home/ubuntu/mythicalhelper"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
SERVER_DIR="$ROOT_DIR/server"
KEY_PATH="$SCRIPT_DIR/LightsailDefaultKey-us-east-1.pem"

SSH_HOST="$USERNAME@$SERVER_IP"

# 颜色
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'

[ -f "$KEY_PATH" ]   || { echo "❌ Key 不存在: $KEY_PATH"; exit 1; }
[ -d "$SERVER_DIR" ] || { echo "❌ 目录不存在: $SERVER_DIR"; exit 1; }
chmod 600 "$KEY_PATH"

# 1) 远端目录
echo "🔗 连接服务器..."
ssh -6 -i "$KEY_PATH" -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null \
  -o ConnectTimeout=10 -o ServerAliveInterval=5 -o ServerAliveCountMax=3 \
  "$SSH_HOST" "mkdir -p '$SERVER_PATH' && echo '目录创建成功'"

# 2) 只上传必要的文件（排除 venv 和 .db）
echo "📤 上传文件..."
TEMP_DIR=$(mktemp -d)

# 复制必要文件到临时目录
cp "$SERVER_DIR"/*.py "$TEMP_DIR/" 2>/dev/null || true
cp "$SERVER_DIR"/*.js "$TEMP_DIR/" 2>/dev/null || true
cp "$SERVER_DIR"/*.txt "$TEMP_DIR/" 2>/dev/null || true
cp "$SERVER_DIR"/*.command "$TEMP_DIR/" 2>/dev/null || true

# 上传临时目录内容
scp -6 -i "$KEY_PATH" -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null \
  -o ConnectTimeout=10 -o ServerAliveInterval=5 -o ServerAliveCountMax=3 -r \
  "$TEMP_DIR/"* "ubuntu@[$SERVER_IP]:$SERVER_PATH/"

# 清理临时目录
rm -rf "$TEMP_DIR"
echo "✅ 文件上传完成"

# 3) 虚拟环境处理
if [[ "$REBUILD_VENV" == true ]]; then
  echo -e "${YELLOW}🧹 清理旧虚拟环境...${NC}"
  ssh -6 -i "$KEY_PATH" -o ConnectTimeout=10 -o ServerAliveInterval=5 -o ServerAliveCountMax=3 \
    "$SSH_HOST" "cd '$SERVER_PATH' && rm -rf venv"
  
  echo -e "${YELLOW}🐍 创建新虚拟环境...${NC}"
  ssh -6 -i "$KEY_PATH" -o ConnectTimeout=10 -o ServerAliveInterval=5 -o ServerAliveCountMax=3 \
    "$SSH_HOST" "cd '$SERVER_PATH' && python3 -m venv venv && source venv/bin/activate && pip install --upgrade pip && pip install -r requirements.txt"
else
  echo -e "${BLUE}📦 检查虚拟环境...${NC}"
  ssh -6 -i "$KEY_PATH" -o ConnectTimeout=10 -o ServerAliveInterval=5 -o ServerAliveCountMax=3 \
    "$SSH_HOST" "cd '$SERVER_PATH' && if [ ! -d venv ]; then echo '创建虚拟环境...' && python3 -m venv venv && source venv/bin/activate && pip install --upgrade pip && pip install -r requirements.txt; else echo '虚拟环境已存在，跳过创建'; fi"
fi

# 4) 数据库处理
if [[ "$REBUILD_DB" == true ]]; then
  echo -e "${YELLOW}🗄️ 重建数据库...${NC}"
  ssh -6 -i "$KEY_PATH" -o ConnectTimeout=10 -o ServerAliveInterval=5 -o ServerAliveCountMax=3 \
    "$SSH_HOST" "cd '$SERVER_PATH' && rm -f mythicalhelper.db && echo '数据库已删除，将在服务启动时重新创建'"
else
  echo -e "${BLUE}🗄️ 保留现有数据库...${NC}"
fi

# 5) 清理缓存 & 重启
echo -e "${YELLOW}🔄 重启服务...${NC}"
ssh -6 -i "$KEY_PATH" -o ConnectTimeout=10 -o ServerAliveInterval=5 -o ServerAliveCountMax=3 \
  "$SSH_HOST" "find '$SERVER_PATH' -name '__pycache__' -type d -exec rm -rf {} + 2>/dev/null || true; find '$SERVER_PATH' -name '*.pyc' -type f -delete 2>/dev/null || true; sudo systemctl daemon-reload && sudo systemctl restart mythicalhelper && sleep 3 && systemctl is-active --quiet mythicalhelper || sudo journalctl -u mythicalhelper -n 50 --no-pager"

# 6) 显示部署信息
echo -e "${GREEN}🎉 部署完成！${NC}"
echo -e "${BLUE}📊 部署信息:${NC}"
echo -e "  • 虚拟环境: $([ "$REBUILD_VENV" == true ] && echo "重建" || echo "保留")"
echo -e "  • 数据库: $([ "$REBUILD_DB" == true ] && echo "重建" || echo "保留")"
echo -e "  • 服务状态: 运行中"
echo -e "  • API 地址: https://api.mythicalhelper.org"