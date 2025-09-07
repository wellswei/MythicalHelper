# Cloudflare Stripe Proxy 设置指南

## 问题
AWS Lightsail IPv6-only 实例无法直接访问 Stripe API（仅支持 IPv4）

## 解决方案：Cloudflare Worker 代理

### 1. 创建 Cloudflare Worker

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com)
2. 进入 **Workers & Pages**
3. 点击 **Create application**
4. 选择 **Create Worker**
5. 命名为 `stripe-proxy`

### 2. 部署 Worker 代码

复制 `stripe-proxy.js` 文件的内容到 Cloudflare Worker 编辑器

### 3. 配置环境变量

在 Worker 设置中添加：
- `STRIPE_SECRET`: 你的 Stripe 测试密钥
- `ALLOWED_ORIGIN`: `https://mythicalhelper.org` (可选)
- `INBOUND_TOKEN`: 你的认证令牌 (可选)

### 4. 配置 DNS

在 Cloudflare DNS 中添加 CNAME 记录：
- 名称：`stripe-proxy`
- 目标：`<worker-subdomain>.workers.dev`

### 5. 部署后端

```bash
git add . && git commit -m "Add Stripe proxy integration" && git push origin main
./deploy.command
```

### 6. 测试

访问 `https://mythicalhelper.org/portal.html` 并测试续费功能

## 优势

- ✅ 利用 Cloudflare 的双栈网络
- ✅ 通用代理，支持所有 Stripe API 调用
- ✅ 无需重新创建服务器
- ✅ 更好的性能和可靠性
- ✅ 支持 CORS 和认证

## 工作原理

1. 后端调用 `https://stripe-proxy.mythicalhelper.org/v1/checkout/sessions`
2. Worker 代理请求到 `https://api.stripe.com/v1/checkout/sessions`
3. 自动添加 Stripe 认证头
4. 返回 Stripe 响应给后端

## 注意事项

- Worker 有执行时间限制（10ms 免费版）
- 已配置 CORS 允许你的域名
- 包含请求验证和错误处理
- 支持所有 Stripe API 端点
