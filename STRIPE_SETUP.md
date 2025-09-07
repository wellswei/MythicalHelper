# Stripe 支付集成配置说明

## 环境变量配置

在服务器上需要设置以下环境变量：

```bash
# Stripe 配置
STRIPE_SECRET_KEY=sk_test_...  # 测试环境密钥（从API Keys页面获取）
STRIPE_WEBHOOK_SECRET=whsec_...  # Webhook 密钥（从Webhook设置页面获取）

# 前端URL（用于支付成功/失败重定向）
FRONTEND_URL=https://your-domain.com  # 替换为你的实际域名
```

### 设置方法

**方法1：在服务器上直接设置**
```bash
# 登录到服务器
ssh your-username@your-server-ip

# 编辑环境变量文件
nano ~/.bashrc

# 添加以下内容到文件末尾
export STRIPE_SECRET_KEY="sk_test_你的secret_key"
export STRIPE_WEBHOOK_SECRET="whsec_你的webhook_secret"
export FRONTEND_URL="https://your-domain.com"

# 重新加载环境变量
source ~/.bashrc
```

**方法2：在Python代码中设置**
在 `server/main.py` 文件开头添加：
```python
import os
os.environ['STRIPE_SECRET_KEY'] = 'sk_test_你的secret_key'
os.environ['STRIPE_WEBHOOK_SECRET'] = 'whsec_你的webhook_secret'
os.environ['FRONTEND_URL'] = 'https://your-domain.com'
```

## 前端配置

前端已经配置了Stripe Publishable Key：
- **Publishable Key**: `pk_test_51S4XMwArEWZmSCjIvRXSikHETRrfWw6URqH6cIKTMqsDEUfhSZJWAGFde1YLTbE5paltdUQR7Bi9Zy5taJZLJLRS00dJ9Hhdfu`
- **位置**: `portal.js` 文件中的 `stripe` 常量
- **Stripe.js**: 已通过CDN引入

## Stripe 设置步骤

### 1. 创建 Stripe 账户
- 访问 https://stripe.com
- 注册账户并完成验证

### 2. 获取 API 密钥
- 登录 Stripe Dashboard
- 进入 "Developers" > "API keys"
- 复制 "Secret key" 和 "Publishable key"

### 3. 设置 Webhook
- 在 Stripe Dashboard 中进入 "Developers" > "Webhooks"
- 点击 "Add endpoint"
- 设置 URL: `https://your-api-domain.com/api/payment/webhook`
- 选择事件: `checkout.session.completed`
- 复制 "Signing secret"

### 4. 测试支付
- 使用 Stripe 测试卡号: `4242 4242 4242 4242`
- 任意未来日期和CVC
- 任意邮箱地址

## 支付流程

### 续费流程
1. 用户点击 "RENEW YOUR ENCHANTMENT"
2. 系统检查用户当前有效期
3. 如果有效期内：从当前有效期结束日期延长一年
4. 如果已过期：从今天开始一年有效期
5. 创建 Stripe Checkout 会话
6. 用户完成支付后，Webhook 更新用户有效期

### 捐赠流程
1. 用户点击 "SHARE A GIFT OF KINDNESS"
2. 弹出捐赠金额输入模态框
3. 用户选择或输入金额（最少 $1）
4. 创建 Stripe Checkout 会话
5. 用户完成支付后，Webhook 记录捐赠记录

## 部署注意事项

1. 确保所有环境变量都已正确设置
2. Webhook URL 必须是 HTTPS
3. 生产环境使用 live 密钥（sk_live_... 和 pk_live_...）
4. 测试环境使用 test 密钥（sk_test_... 和 pk_test_...）

## 安全考虑

- 永远不要在客户端代码中暴露 Secret Key
- 使用 HTTPS 传输所有支付数据
- 验证 Webhook 签名确保请求来自 Stripe
- 定期轮换 API 密钥
