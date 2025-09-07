# Cloudflare Tunnel 设置指南

## 问题
AWS Lightsail IPv6-only 实例无法直接访问 Stripe API（仅支持 IPv4）

## 解决方案：Cloudflare Tunnel

### 1. 安装 cloudflared
```bash
# 在服务器上安装 cloudflared
wget https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i cloudflared-linux-amd64.deb
```

### 2. 登录 Cloudflare
```bash
cloudflared tunnel login
```

### 3. 创建隧道
```bash
cloudflared tunnel create mythicalhelper-tunnel
```

### 4. 配置隧道
创建配置文件 `/home/ubuntu/.cloudflared/config.yml`：
```yaml
tunnel: <tunnel-id>
credentials-file: /home/ubuntu/.cloudflared/<tunnel-id>.json

ingress:
  - hostname: api.mythicalhelper.org
    service: http://localhost:8000
  - service: http_status:404
```

### 5. 运行隧道
```bash
cloudflared tunnel run mythicalhelper-tunnel
```

### 6. 更新 DNS
在 Cloudflare DNS 中添加 CNAME 记录：
- 名称：`api`
- 目标：`<tunnel-id>.cfargotunnel.com`

## 替代方案：重新创建 Dual-Stack 实例

如果不想使用代理，可以：

1. 在 Lightsail 控制台创建新实例
2. 选择 **Dual-Stack** 网络模式（IPv4 + IPv6）
3. 迁移现有代码和数据
4. 更新域名解析

## 验证
```bash
# 测试 IPv4 连接
curl -4 https://api.stripe.com/v1/charges

# 测试 IPv6 连接
curl -6 https://api.stripe.com/v1/charges
```
