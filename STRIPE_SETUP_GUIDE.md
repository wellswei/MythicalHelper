# Stripe 配置完整指南

## 当前状态 ✅

### 第1步：前端配置 - 已完成
- ✅ 前端使用重定向流程，不需要客户端 Stripe 对象
- ✅ 没有硬编码的 Publishable Key

### 第2步：后端配置 - 已完成
- ✅ 支持环境变量配置
- ✅ 支持固定价格ID和动态价格
- ✅ 正确的结账会话创建

### 第3步：重定向URL - 已完成
- ✅ 成功URL：`{FRONTEND_URL}/portal?session_id={session_id}`
- ✅ 取消URL：`{FRONTEND_URL}/portal?renewal=cancelled` 或 `?donation=cancelled`
- ✅ 前端正确处理支付结果验证

### 第4步：Webhook - 已完成
- ✅ 实现了 `checkout.session.completed` 事件处理
- ✅ 正确的签名验证
- ✅ 自动更新用户有效期

## 环境变量配置

### 测试环境
```bash
export STRIPE_SECRET_KEY="sk_test_..."
export STRIPE_PUBLISHABLE_KEY="pk_test_..."
export STRIPE_WEBHOOK_SECRET="whsec_..."
export FRONTEND_URL="https://mythicalhelper.org"
export RENEWAL_PRICE_ID="price_..."  # 可选，如果设置了会使用固定价格
```

### 生产环境
```bash
export STRIPE_SECRET_KEY="sk_live_..."
export STRIPE_PUBLISHABLE_KEY="pk_live_..."
export STRIPE_WEBHOOK_SECRET="whsec_..."
export FRONTEND_URL="https://mythicalhelper.org"
export RENEWAL_PRICE_ID="price_..."  # 可选，如果设置了会使用固定价格
```

## Stripe Dashboard 配置

### 1. 创建产品和价格（推荐）

#### 测试环境
1. 登录 Stripe Dashboard (测试模式)
2. 进入 Products → 创建新产品
3. 产品名称：`MythicalHelper Guild Membership Renewal`
4. 价格：`$9.99 USD` (一次性支付)
5. 复制价格ID (格式：`price_...`)

#### 生产环境
1. 切换到生产模式
2. 重复上述步骤
3. 复制生产环境的价格ID

### 2. 配置 Webhook

#### 测试环境
1. 进入 Developers → Webhooks
2. 添加端点：`https://api.mythicalhelper.org/api/payment/webhook`
3. 监听事件：`checkout.session.completed`
4. 复制签名密钥 (格式：`whsec_...`)

#### 生产环境
1. 切换到生产模式
2. 重复上述步骤
3. 复制生产环境的签名密钥

## 部署步骤

### 1. 更新环境变量
```bash
# 在服务器上设置环境变量
export STRIPE_SECRET_KEY="sk_live_..."
export STRIPE_PUBLISHABLE_KEY="pk_live_..."
export STRIPE_WEBHOOK_SECRET="whsec_..."
export FRONTEND_URL="https://mythicalhelper.org"
export RENEWAL_PRICE_ID="price_..."  # 可选
```

### 2. 重启服务
```bash
sudo systemctl restart mythicalhelper
```

### 3. 验证配置
```bash
# 检查环境变量
echo $STRIPE_SECRET_KEY
echo $STRIPE_WEBHOOK_SECRET

# 检查服务状态
sudo systemctl status mythicalhelper
```

## 测试清单

### 续费功能测试
- [ ] 点击 "RENEW YOUR ENCHANTMENT" 按钮
- [ ] 跳转到 Stripe Checkout 页面
- [ ] 使用测试卡号完成支付
- [ ] 返回后显示成功消息
- [ ] 用户有效期已延长

### 捐赠功能测试
- [ ] 点击 "SHARE A GIFT OF KINDNESS" 按钮
- [ ] 输入捐赠金额
- [ ] 跳转到 Stripe Checkout 页面
- [ ] 完成支付
- [ ] 返回后显示感谢消息

### 取消流程测试
- [ ] 开始支付流程
- [ ] 在 Stripe 页面点击取消
- [ ] 返回后显示取消消息

### Webhook 测试
- [ ] 完成支付后检查服务器日志
- [ ] 确认 Webhook 事件被正确处理
- [ ] 确认数据库中的购买记录

## 测试卡号

### 成功支付
- `4242 4242 4242 4242`
- 任意未来日期
- 任意CVC

### 失败支付
- `4000 0000 0000 0002` (被拒绝)
- `4000 0000 0000 9995` (余额不足)

## 故障排除

### 常见问题
1. **Webhook 签名验证失败**
   - 检查 `STRIPE_WEBHOOK_SECRET` 是否正确
   - 确认 Webhook 端点URL正确

2. **支付成功但用户有效期未更新**
   - 检查 Webhook 是否正常工作
   - 查看服务器日志中的错误信息

3. **CORS 错误**
   - 确认 `FRONTEND_URL` 设置正确
   - 检查后端 CORS 配置

### 日志检查
```bash
# 查看应用日志
sudo journalctl -u mythicalhelper -f

# 查看特定错误
sudo journalctl -u mythicalhelper | grep -i stripe
sudo journalctl -u mythicalhelper | grep -i webhook
```

## 安全注意事项

1. **永远不要在前端暴露 Secret Key**
2. **定期轮换 Webhook 签名密钥**
3. **使用 HTTPS 进行所有通信**
4. **验证所有 Webhook 事件的签名**
5. **在生产环境中使用强密码和密钥**
