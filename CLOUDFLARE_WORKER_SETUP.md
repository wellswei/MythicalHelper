# Cloudflare Worker 设置指南

## 问题
AWS Lightsail IPv6-only 实例无法直接访问 Stripe API（仅支持 IPv4）

## 解决方案：Cloudflare Worker

### 1. 创建 Cloudflare Worker

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com)
2. 进入 **Workers & Pages**
3. 点击 **Create application**
4. 选择 **Create Worker**
5. 命名为 `stripe-worker`

### 2. 部署 Worker 代码

复制 `portal.js` 末尾注释中的 Worker 代码到 Cloudflare Worker 编辑器

### 3. 配置环境变量

在 Worker 设置中添加：
- `STRIPE_SECRET_KEY`: 你的 Stripe 测试密钥

### 4. 配置 DNS

在 Cloudflare DNS 中添加 CNAME 记录：
- 名称：`stripe-worker`
- 目标：`<worker-subdomain>.workers.dev`

### 5. 部署后端

```bash
git add . && git commit -m "Add Cloudflare Worker integration" && git push origin main
./deploy.command
```

### 6. 测试

访问 `https://mythicalhelper.org/portal.html` 并测试续费功能

## 优势

- ✅ 利用 Cloudflare 的双栈网络
- ✅ 无需重新创建服务器
- ✅ 保持现有架构
- ✅ 更好的性能和可靠性

## 注意事项

- Worker 有执行时间限制（10ms 免费版）
- 已配置 CORS 允许你的域名
- 包含请求验证和错误处理
