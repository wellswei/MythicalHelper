# Enchanted Helpers Guild (mythicalhelper.org)

A whimsical, storybook‑style platform for issuing Official Helper Certificates to keep wonder alive for young dreamers. Frontend is a single‑page app (EN first; 中文/ES supported). Mock API included.

## ✨ Features

- **Two‑step safeguard**: Email + SMS OTP for grown‑up Helpers
- **Official certificate**: Unique serial + QR for verification
- **Privacy‑friendly**: Only what’s needed for the magic
- **PDF delivery**: Email attachment + download link

## 🧭 Flow (mocked)

1. Email OTP (with Cloudflare Turnstile)
2. Phone OTP (international SMS)
3. Choose a role and generate a certificate (serial + QR)
4. Verify by serial or link

## 🛠️ Stack

- Static HTML/CSS/JS (no build step)
- Cloudflare Pages hosting
- Cloudflare Turnstile (bot protection)

## 📱 App structure

- `index.html`: Single‑page app with hash routing (`#/`, `#/signup`, `#/phone`, `#/generate`, `#/verify`)
- `styles.css`: Minimal, responsive dark theme
- `app.js`: All logic (i18n, mock API, session, router, views)

## 🎨 设计特色

- **深色主题**: 现代化的深色UI设计
- **渐变效果**: 精美的背景和按钮渐变
- **毛玻璃效果**: 现代化的毛玻璃导航栏
- **响应式布局**: 适配各种屏幕尺寸
- **动画交互**: 平滑的悬停和点击效果

## 🔧 Run locally

Open `index.html` directly or serve the folder with any static server.

Config lives in `app.js` → `CFG`:

- `apiBaseUrl`: real FastAPI endpoint later
- `mock`: set `false` to call backend
- `turnstileSiteKey`: replace with your real site key

## 📁 Files

```
MythicalHelper/
├── app.js
├── styles.css
├── index.html
└── README.md
```

## 🎯 Next

- [ ] Swap mock → real FastAPI
- [ ] Turnstile real site key
- [ ] Add visual certificate preview
- [ ] QR rendering client‑side

## 🤝 贡献

欢迎提交Issue和Pull Request！

## 📄 许可证

MIT License

## 📞 联系方式

如有问题或建议，请通过以下方式联系：
- 提交GitHub Issue
- 发送邮件至: [your-email@example.com]

---

**Enchanted Helpers Guild** — keep the wonder alive ✨
