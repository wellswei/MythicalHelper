// auth.js — Mythical Helper (clean)
// Flow: Email → Email Code → Phone → Phone Code (done)

// ===== Config =====
const API_BASE = "https://api.mythicalhelper.org";
const ENDPOINTS = {
  // 新的Ticket-based API
  createTicket: "/tickets",
  confirmTicket: (ticketId) => `/tickets/${ticketId}/confirm`,
  exchangeSession: "/sessions",
  createRegistration: "/registrations",
  attachRegistration: (regId) => `/registrations/${regId}/contacts/attach`,
  patchRegistration: (regId) => `/registrations/${regId}`,
  activateRegistration: (regId) => `/registrations/${regId}/activate`,
};
const RESEND_COOLDOWN = 60; // seconds

// ===== State =====
const state = {
  email: "",
  phone: "",
  emailTicketId: "",
  phoneTicketId: "",
  emailProofToken: "",
  phoneProofToken: "",
  registrationId: "",
  userId: "",
  username: "",
  resendLeft: 0,
  resendTimer: null,
  emailResendLeft: 0,
  emailResendTimer: null,
  iti: null, // intl-tel-input instance
  currentStep: 1, // 当前步骤
  turnstileToken: null, // Cloudflare Turnstile token
};

// Track current auth mode to avoid cross-flow interference
let currentAuthMode = 'login';

// ===== State Persistence =====
function saveState() {
  const stateToSave = {
    email: state.email,
    phone: state.phone,
    emailTicketId: state.emailTicketId,
    phoneTicketId: state.phoneTicketId,
    emailProofToken: state.emailProofToken,
    phoneProofToken: state.phoneProofToken,
    registrationId: state.registrationId,
    userId: state.userId,
    username: state.username,
    currentStep: state.currentStep,
    resendLeft: state.resendLeft,
    emailResendLeft: state.emailResendLeft
  };
  sessionStorage.setItem('authState', JSON.stringify(stateToSave));
}

function loadState() {
  try {
    // 清除可能存在的旧localStorage数据
    localStorage.removeItem('authState');
    
    const saved = sessionStorage.getItem('authState');
    if (saved) {
      const parsed = JSON.parse(saved);
      state.email = parsed.email || "";
      state.phone = parsed.phone || "";
      state.emailTicketId = parsed.emailTicketId || "";
      state.phoneTicketId = parsed.phoneTicketId || "";
      state.emailProofToken = parsed.emailProofToken || "";
      state.phoneProofToken = parsed.phoneProofToken || "";
      state.registrationId = parsed.registrationId || "";
      state.userId = parsed.userId || "";
      state.username = parsed.username || "";
      state.currentStep = parsed.currentStep || 1;
      state.resendLeft = parsed.resendLeft || 0;
      state.emailResendLeft = parsed.emailResendLeft || 0;
      return true;
    }
  } catch (e) {
    console.error('Failed to load state:', e);
  }
  return false;
}

function clearState() {
  sessionStorage.removeItem('authState');
  state.email = "";
  state.phone = "";
  state.emailTicketId = "";
  state.phoneTicketId = "";
  state.emailProofToken = "";
  state.phoneProofToken = "";
  state.registrationId = "";
  state.userId = "";
  state.username = "";
  state.currentStep = 1;
  state.resendLeft = 0;
  if (state.resendTimer) {
    clearInterval(state.resendTimer);
    state.resendTimer = null;
  }
}

// ===== 登录方式（Email / SMS）切换与 SMS 登录实现 =====
function switchLoginMode(mode) {
  document.querySelectorAll('.login-mode-tabs .login-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll(`.login-mode-tabs .login-tab[data-login-mode="${mode}"]`).forEach(t => t.classList.add('active'));
  const loginFlow = $('#loginFlow');
  const loginSmsFlow = $('#loginSmsFlow');
  if (mode === 'email') {
    if (loginFlow) loginFlow.hidden = false;
    if (loginSmsFlow) loginSmsFlow.hidden = true;
  } else {
    if (loginFlow) loginFlow.hidden = true;
    if (loginSmsFlow) loginSmsFlow.hidden = false;
    initLoginPhoneInput();
  }
}

function initLoginPhoneInput() {
  const el = $('#loginPhoneInput');
  if (!el || el.dataset.itiReady) return;
  if (!window.intlTelInput) return;
  try {
    const iti = window.intlTelInput(el, {
      initialCountry: 'us', preferredCountries: ['us','cn','gb','ca','au'],
      separateDialCode: true, nationalMode: true,
      autoPlaceholder: 'aggressive', formatOnDisplay: true,
      utilsScript: 'https://cdnjs.cloudflare.com/ajax/libs/intl-tel-input/17.0.19/js/utils.js'
    });
    el.dataset.itiReady = '1';
    el._iti = iti;
  } catch (e) { console.warn('initLoginPhoneInput failed', e); }
}

function getLoginE164() {
  const el = $('#loginPhoneInput');
  if (!el || !el._iti) return null;
  try {
    if (window.intlTelInputUtils && window.intlTelInputUtils.numberFormat) {
      return el._iti.getNumber(window.intlTelInputUtils.numberFormat.E164);
    }
    return el._iti.getNumber();
  } catch { return null; }
}

async function onSendLoginSms() {
  const phone = getLoginE164();
  const btn = $('#btnSendLoginSms');
  const status = $('#loginPhoneStatus');
  const err = $('#errLoginSms');
  if (!phone) { showError(err, 'Please enter a valid phone number'); return; }
  lockButton(btn, 'Sending...'); hideError(err);
  try {
    // 创建手机号登录ticket
    const data = await postJSON(ENDPOINTS.createTicket, {
      channel: "sms",
      destination: phone,
      purpose: "signin"
    });
    
    loginState.phone = phone; 
    loginState.ticketId = data.ticket_id; 
    loginState.resendLeft = data.cooldown_sec || 0; 
    loginState.mode = 'sms';
    loginState.resendExpiry = loginState.resendLeft > 0 ? Date.now() + loginState.resendLeft * 1000 : 0;
    saveLoginState(); 
    ensureLoginModeInUrl();
    
    // 切到验证码
    $('#loginSmsStep1').hidden = true; 
    $('#loginSmsStep2').hidden = false;
    setStatus(status, 'SMS sent. Check your phone.', 'success');
    // 自动聚焦到第一个验证码输入框
    setTimeout(() => {
      const firstInput = document.querySelector('.login-sms-code-input');
      if (firstInput) firstInput.focus();
    }, 100);
    // 启动SMS发送冷却（如果返回了cooldown）
    if (loginState.resendLeft > 0) startLoginSmsResend();
  } catch (e) {
    showError(err, e.message || 'Failed to send code');
  } finally { unlockButton(btn, 'Get Phone Code'); }
}

async function onVerifyLoginSms() {
  const code = Array.from(document.querySelectorAll('.login-sms-code-input')).map(i=>i.value).join('');
  const btn = $('#btnVerifyLoginSms'); const err = $('#errLoginSms');
  if (code.length !== 6) { showError(err,'Please enter the complete 6-digit code'); return; }
  lockButton(btn, 'Verifying...'); hideError(err);
  try {
    // 确认ticket并获取proof token
    const resp = await postJSON(ENDPOINTS.confirmTicket(loginState.ticketId), {
      code: code
    });
    
    if (!resp.verified || !resp.proof_token) {
      throw new Error('Verification failed');
    }
    
    // 交换会话令牌
    const sessionResponse = await postJSON(ENDPOINTS.exchangeSession, {
      proof_token: resp.proof_token
    });
    
    // 保存token到sessionStorage
    sessionStorage.setItem('authToken', sessionResponse.access_token);
    clearLoginState();
    window.location.href = '/portal.html';
  } catch (e) { showError(err, e.message || 'Invalid code'); }
  finally { unlockButton(btn, 'Verify Code'); }
}
// ===== Utils =====
const $  = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

function showError(element, message) {
  if (!element) return;
  element.textContent = message;
  element.style.display = 'block';
}

function hideError(element) {
  if (!element) return;
  element.style.display = 'none';
}
const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

// 用户名验证（与服务器端保持一致）
const USERNAME_BLACKLIST = ['official', 'admin', 'support', 'help', 'system', 'root', 'guild', 'mythical', 'helper'];
const isValidUsername = (username) => {
  if (!username || username.length < 2 || username.length > 20) return false;
  // Allow letters, numbers, underscore, and spaces
  if (!/^[A-Za-z0-9_ ]+$/.test(username)) return false;
  if (!/[A-Za-z]/.test(username)) return false; // 必须包含至少一个字母
  const lowerUsername = username.toLowerCase();
  return !USERNAME_BLACKLIST.some(blacklisted => lowerUsername.includes(blacklisted));
};

const show = (el) => { if (el) { el.style.display = "block"; el.classList.remove("hidden"); } };
const hide = (el) => { if (el) { el.style.display = "none";  el.classList.add("hidden"); } };

const showErr = (el, msg) => { if (el) { el.textContent = msg; el.style.display = "block"; } };
const hideErr = (el) => { if (el) { el.style.display = "none"; } };
const showOk  = (el, msg) => { 
  if (el) { 
    el.textContent = msg; 
    el.style.display = "block"; 

  } 
};
const hideOk  = (el) => { 
  if (el) { 
    el.style.display = "none"; 

  } 
};

// 统一状态栏管理
const setStatus = (element, message, type = 'default') => {
  if (!element) return;
  
  element.textContent = message;
  element.className = 'status-bar';
  element.style.display = 'block';
  
  if (type === 'success') {
    element.classList.add('success');
  } else if (type === 'error') {
    element.classList.add('error');
  }
};

function updateStep(n) {
  // Only apply step UI updates when in signup flow
  if (currentAuthMode !== 'signup') return;
  $$('.step').forEach(x => x.classList.remove('active'));
  $$('section[id^="step"]').forEach(hide);
  $(`#step${n}tag`)?.classList.add('active');
  show($(`#step${n}`));
  state.currentStep = n;
  saveState();
  
  // 重置Turnstile当切换到需要验证的步骤时
  if (n === 1 || n === 2) {
    resetTurnstile();
  }
}

function setupCodeInputs(container) {
  if (!container) return;
  const inputs = container.querySelectorAll('.email-code-input, .phone-code-input, .login-code-input, .login-sms-code-input');
  inputs.forEach((ipt, idx) => {
    ipt.addEventListener('input', () => {
      ipt.value = ipt.value.replace(/\D/g, '').slice(-1);
      if (ipt.value && idx < inputs.length - 1) inputs[idx + 1].focus();
    });
    ipt.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !ipt.value && idx > 0) inputs[idx - 1].focus();
      if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); }
    });
    ipt.addEventListener('paste', (e) => {
      const t = (e.clipboardData || window.clipboardData).getData('text').replace(/\D/g, '').slice(0, 6);
      if (!t) return;
      e.preventDefault();
      inputs.forEach((x, i) => x.value = t[i] || '');
      (inputs[Math.min(t.length - 1, inputs.length - 1)] || inputs[0]).focus();
    });
  });
}
const getCode = (container) => {
  if (!container) return '';
  return Array.from(
    container.querySelectorAll('.email-code-input, .phone-code-input, .login-code-input, .login-sms-code-input')
  ).map(i => i.value).join('');
};

// ===== Phone (intl-tel-input) =====
function initPhoneInput() {
  const el = $('#phoneInput');
  if (!el || state.iti) return;
  if (!window.intlTelInput) { 
    console.error('intl-tel-input library not loaded'); 
    return; 
  }

  try {
    state.iti = window.intlTelInput(el, {
      initialCountry: "us",
      preferredCountries: ["us", "cn", "gb", "ca", "au", "de", "fr", "jp", "kr"],
      separateDialCode: true,
      nationalMode: true,
      autoPlaceholder: "aggressive",
      formatOnDisplay: true,
      utilsScript: "https://cdnjs.cloudflare.com/ajax/libs/intl-tel-input/17.0.19/js/utils.js"
    });

    // 添加输入事件监听器来实现实时格式化
    el.addEventListener('input', function() {
      if (state.iti && window.intlTelInputUtils) {
        const number = el.value;
        if (number.length > 0) {
          try {
            // 获取当前国家代码
            const countryData = state.iti.getSelectedCountryData();
            if (countryData && countryData.dialCode) {
              // 格式化显示
              const formatted = window.intlTelInputUtils.formatNumber(number, countryData.iso2, window.intlTelInputUtils.numberFormat.NATIONAL);
              if (formatted && formatted !== number) {
                el.value = formatted;
              }
            }
          } catch (e) {
            // 格式化失败时忽略错误
          }
        }
      }
    });
  } catch (error) {
    console.error('Error initializing intl-tel-input:', error);
  }

  const validate = () => {
    const ok = state.iti.isValidNumber();
    if (el.value.trim() === '') { el.classList.remove('tel-invalid'); hideErr($('#err2')); return; }
    if (ok) { el.classList.remove('tel-invalid'); hideErr($('#err2')); }
    else    { el.classList.add('tel-invalid'); showErr($('#err2'), 'Please enter a valid phone number'); }
  };
  el.addEventListener('input', validate);
  el.addEventListener('blur', validate);
  el.addEventListener('countrychange', validate);
}

function getE164() {
  if (!state.iti) return null;
  try {
    const isValid = state.iti.isValidNumber();
    if (isValid) {
      // 获取 E164 格式
      if (window.intlTelInputUtils && window.intlTelInputUtils.numberFormat) {
        return state.iti.getNumber(window.intlTelInputUtils.numberFormat.E164);
      } else {
        // 如果没有 utils 库，使用默认的 getNumber() 方法
        let number = state.iti.getNumber();
        
        // 手动转换为 E164 格式（简单处理）
        if (number && !number.startsWith('+')) {
          const countryData = state.iti.getSelectedCountryData();
          if (countryData && countryData.dialCode) {
            number = '+' + countryData.dialCode + number;
          }
        }
        return number;
      }
    }
  } catch (e) {
    console.error('getE164: error =', e);
  }
  return null;
}

// 获取本地格式的手机号（用于显示）
function getLocalFormat() {
  if (!state.iti) return null;
  try {
    const isValid = state.iti.isValidNumber();
    if (isValid) {
      if (window.intlTelInputUtils && window.intlTelInputUtils.numberFormat) {
        return state.iti.getNumber(window.intlTelInputUtils.numberFormat.NATIONAL);
      } else {
        return state.iti.getNumber();
      }
    }
  } catch (e) {
    console.error('getLocalFormat: error =', e);
  }
  return null;
}

// ===== Resend cooldown =====
function startResend() {
  if (state.resendTimer) { clearInterval(state.resendTimer); state.resendTimer = null; }
  // 使用state中的值，如果没有则使用默认值
  if (state.resendLeft <= 0) state.resendLeft = RESEND_COOLDOWN;
  const btn = $('#btnBackToPhone');
  if (!btn) return;

  const tick = () => {
    if (state.resendLeft > 0) {
      btn.textContent = `Change Phone (${state.resendLeft}s)`;
      btn.disabled = true;
      state.resendLeft--;
    } else {
      clearInterval(state.resendTimer); 
      state.resendTimer = null;
      btn.textContent = 'Change Phone';
      btn.disabled = false;
    }
  };
  tick();
  state.resendTimer = setInterval(tick, 1000);
}

function startEmailResend() {
  if (state.emailResendTimer) { clearInterval(state.emailResendTimer); state.emailResendTimer = null; }
  // 使用state中的值，如果没有则使用默认值
  if (state.emailResendLeft <= 0) state.emailResendLeft = RESEND_COOLDOWN;
  const btn = $('#btnBackToEmailInput');
  if (!btn) return;

  const tick = () => {
    if (state.emailResendLeft > 0) {
      btn.textContent = `Change Email (${state.emailResendLeft}s)`;
      btn.disabled = true;
      state.emailResendLeft--;
    } else {
      clearInterval(state.emailResendTimer); 
      state.emailResendTimer = null;
      btn.textContent = 'Change Email';
      btn.disabled = false;
    }
  };
  tick();
  state.emailResendTimer = setInterval(tick, 1000);
}

// ===== Cloudflare Turnstile =====
function onTurnstileSuccess(token) {
  state.turnstileToken = token;
  console.log('Turnstile success, token received, length:', token.length);
  
  // 更新状态提示（支持多个Turnstile组件）
  updateTurnstileMessage('✓ Security verified', '#10b981');
  
  // 启用当前步骤的发送按钮
  if (state.currentStep === 1) {
    $('#btnSend').disabled = false;
  } else if (state.currentStep === 2) {
    $('#btnSendPhone').disabled = false;
  } else if (state.currentStep === 3) {
    $('#btnSubmitOath').disabled = false;
  }
}

function onTurnstileExpired() {
  state.turnstileToken = null;
  
  // 更新状态提示
  updateTurnstileMessage('⚠ Verification expired - please refresh', '#f59e0b');
  
  // 禁用当前步骤的发送按钮
  if (state.currentStep === 1) {
    $('#btnSend').disabled = true;
  } else if (state.currentStep === 2) {
    $('#btnSendPhone').disabled = true;
  } else if (state.currentStep === 3) {
    $('#btnSubmitOath').disabled = true;
  }
}

function onTurnstileError(error) {
  state.turnstileToken = null;
  
  // 更新状态提示
  updateTurnstileMessage('❌ Verification failed - please try again', '#ef4444');
  
  // 禁用当前步骤的发送按钮
  if (state.currentStep === 1) {
    $('#btnSend').disabled = true;
  } else if (state.currentStep === 2) {
    $('#btnSendPhone').disabled = true;
  } else if (state.currentStep === 3) {
    $('#btnSubmitOath').disabled = true;
  }
}

// 更新Turnstile状态消息的辅助函数
function updateTurnstileMessage(text, color) {
  // 更新Step 1的消息
  const messageEl1 = document.getElementById('turnstileMessage');
  if (messageEl1) {
    messageEl1.textContent = text;
    messageEl1.style.color = color;
  }
  
  // 更新Step 2的消息
  const messageEl2 = document.getElementById('turnstileMessagePhone');
  if (messageEl2) {
    messageEl2.textContent = text;
    messageEl2.style.color = color;
  }
  
  // 更新Step 3的消息
  const messageEl3 = document.getElementById('turnstileMessageOath');
  if (messageEl3) {
    messageEl3.textContent = text;
    messageEl3.style.color = color;
  }
}

// 重置Turnstile
function resetTurnstile() {
  console.log('Resetting Turnstile...');
  if (window.turnstile) {
    const turnstileElements = document.querySelectorAll('.cf-turnstile');
    turnstileElements.forEach(element => {
      window.turnstile.reset(element);
    });
  }
  state.turnstileToken = null;
  console.log('Turnstile token cleared');
  
  // 重置状态提示
  updateTurnstileMessage('Security verification required', 'rgba(255,255,255,0.7)');
}

// 等待Turnstile token就绪
async function waitForTurnstileToken(timeoutMs = 10000) {
  console.log('Waiting for Turnstile token...');
  return new Promise((resolve, reject) => {
    const start = Date.now();
    (function poll() {
      if (state.turnstileToken) {
        console.log('Turnstile token received, length:', state.turnstileToken.length);
        return resolve(state.turnstileToken);
      }
      if (Date.now() - start > timeoutMs) {
        console.log('Turnstile token timeout');
        return reject(new Error("Turnstile token timeout"));
      }
      setTimeout(poll, 100);
    })();
  });
}

// 导出Turnstile回调到window
window.onTurnstileSuccess = onTurnstileSuccess;
window.onTurnstileExpired = onTurnstileExpired;
window.onTurnstileError = onTurnstileError;

// ===== API (no credentials by default; enable if your backend needs cookies) =====
async function postJSON(path, body, method = 'POST') {
  const headers = { 'Content-Type': 'application/json' };
  if (state.turnstileToken) {
    headers['cf-turnstile-response'] = state.turnstileToken;
    console.log('Sending request with Turnstile token:', path, 'Token length:', state.turnstileToken.length);
  } else {
    console.log('Sending request WITHOUT Turnstile token:', path);
  }
  const res = await fetch(`${API_BASE}${path}`, {
    method: method,
    headers,
    // credentials: 'include',
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const j = await res.json().catch(() => ({ detail: 'Request failed' }));
    console.error('Request failed:', path, res.status, j);
    throw new Error(j.detail || 'Request failed');
  }
  return res.json();
}

// ===== 按钮锁定工具函数 =====
function lockButton(btn, text) {
  if (!btn) return;
  btn.dataset._oldText = btn.textContent;
  btn.disabled = true;
  if (text) btn.textContent = text;
}

function unlockButton(btn, restoreText) {
  if (!btn) return;
  btn.disabled = false;
  btn.textContent = restoreText ?? btn.dataset._oldText ?? btn.textContent;
}

// ===== Handlers =====
async function onSendEmail(e) {
  e?.preventDefault(); e?.stopPropagation();

  const emailInput = $('#emailInput');
  const statusBar = $('#emailStatus'), btn = $('#btnSend');

  const email = emailInput.value.trim();
  
  if (!email) {
    setStatus(statusBar, 'Please enter your email address', 'error');
    return;
  }
  if (!isEmail(email)) { 
    setStatus(statusBar, 'Please enter a valid email address', 'error');
    return; 
  }

  lockButton(btn, 'Sending…');
  try {
    // 创建邮箱验证ticket
    const data = await postJSON(ENDPOINTS.createTicket, { 
      channel: "email",
      destination: email,
      purpose: "signup"
    });
    
    state.email = email;
    state.emailTicketId = data.ticket_id;
    saveState();

    setStatus(statusBar, 'Code sent! Check your inbox.', 'success');
    const sec = $('#emailCodeSection');
    show(sec);
    emailInput.disabled = true;
    hide(btn);
    // 隐藏“Already sworn the oath? Enter the Portal”
    const signupSwitch = document.querySelector('#step1 .auth-switch');
    if (signupSwitch) hide(signupSwitch);
    setupCodeInputs(sec);
    // 自动聚焦到第一个验证码输入框
    setTimeout(() => {
      const firstInput = sec.querySelector('input[inputmode="numeric"]');
      if (firstInput) firstInput.focus();
    }, 100);
    
    // 启动email cooldown
    state.emailResendLeft = data.cooldown_sec ?? RESEND_COOLDOWN;
    startEmailResend();
    
    // 重置Turnstile
    resetTurnstile();
  } catch (ex) {
    // 根据错误类型显示不同的消息
    let errorMessage = ex.message || 'Failed to send';
    if (errorMessage.includes('already registered') || errorMessage.includes('exists')) {
      errorMessage = 'Email already registered. Please sign in instead.';
    }
    setStatus(statusBar, errorMessage, 'error');
    // 发送失败时重新启用按钮
    unlockButton(btn, 'Get Email Code');
  }
}

async function onVerifyEmail(e) {
  e?.preventDefault();
  const sec = $('#emailCodeSection'), err = $('#errEmailCode'), btn = $('#btnVerifyEmail');
  hideErr(err);

  const code = getCode(sec);
  if (code.length !== 6) { showErr(err, 'Please enter the complete 6-digit code'); return; }

  lockButton(btn, 'Verifying…');
  try {
    // 确认ticket并获取proof token
    const resp = await postJSON(ENDPOINTS.confirmTicket(state.emailTicketId), {
      code: code
    });
    
    if (resp.verified && resp.proof_token) {
      state.emailProofToken = resp.proof_token;
      saveState();
      updateStep(2); // 进入手机号验证步骤
      initPhoneInput();
      setTimeout(() => $('#phoneInput')?.focus(), 80);
    } else {
      throw new Error('Verification failed');
    }
  } catch (ex) {
    showErr(err, ex.message || 'Verification failed');
  } finally {
    unlockButton(btn, 'Verify Email');
  }
}

function onBackToEmail(e) {
  e?.preventDefault();
  $('#emailInput').disabled = false;
  $('#emailInput').value = '';
  hide($('#emailCodeSection'));
  show($('#btnSend'));
  setStatus($('#emailStatus'), 'We\'ll send a 6-digit code to your email.', 'default');
  // 恢复显示“Already sworn the oath? Enter the Portal”
  const signupSwitch = document.querySelector('#step1 .auth-switch');
  if (signupSwitch) show(signupSwitch);
  // stop email resend cooldown timer if running
  if (state.emailResendTimer) {
    clearInterval(state.emailResendTimer);
    state.emailResendTimer = null;
  }
  state.emailResendLeft = 0;
  // reset persisted email ticket id correctly
  state.email = state.emailTicketId = "";
  saveState();
  updateStep(1);
  setTimeout(() => $('#emailInput')?.focus(), 50);
}

async function onSendPhone(e) {
  e?.preventDefault();
  const statusBar = $('#phoneStatus'), btn = $('#btnSendPhone');

  const phoneInput = $('#phoneInput');
  const phoneValue = phoneInput.value.trim();
  
  if (!phoneValue) {
    setStatus(statusBar, 'Please enter your phone number', 'error');
    return;
  }
  
  const phone = getE164();
  if (!phone) { 
    setStatus(statusBar, 'Please enter a valid phone number', 'error');
    return; 
  }

  lockButton(btn, 'Sending…');
  try {
    // 创建手机号验证ticket
    const data = await postJSON(ENDPOINTS.createTicket, { 
      channel: "sms",
      destination: phone,
      purpose: "signup"
    });
    state.phone = phone; 
    state.phoneTicketId = data.ticket_id;
    saveState();
    setStatus(statusBar, 'SMS code sent.', 'success');
    state.resendLeft = data.cooldown_sec ?? RESEND_COOLDOWN;
    startResend();
    // 显示验证码输入区域
    const sec = $('#phoneCodeSection');
    show(sec);
    const box = $('#phoneCodeBox');
    box.querySelectorAll('input').forEach(i => i.value = '');
    setupCodeInputs(box.parentElement);
    // 自动聚焦到第一个验证码输入框
    setTimeout(() => {
      const firstInput = box.querySelector('input');
      if (firstInput) firstInput.focus();
    }, 100);
    
    // 隐藏发送按钮（与email保持一致）
    hide(btn);
    
    // 重置Turnstile
    resetTurnstile();
  } catch (ex) {
    // 根据错误类型显示不同的消息
    let errorMessage = ex.message || 'Failed to send SMS code';
    if (errorMessage.includes('already registered') || errorMessage.includes('exists')) {
      errorMessage = 'Phone number already registered. Please sign in instead.';
    }
    setStatus(statusBar, errorMessage, 'error');
    // 发送失败时重新启用按钮
    unlockButton(btn, 'Send Phone Code');
  }
}

async function onVerifyPhone(e) {
  e?.preventDefault();
  const err = $('#err3'); hideErr(err);
  const code = getCode($('#phoneCodeBox').parentElement);
  if (code.length !== 6) { showErr(err, 'Please enter the 6-digit code'); return; }

  const btn = $('#btnVerifyPhone'); 
  lockButton(btn, 'Verifying…');
  try {
    // 确认ticket并获取proof token
    const resp = await postJSON(ENDPOINTS.confirmTicket(state.phoneTicketId), {
      code: code
    });
    
    if (resp.verified && resp.proof_token) {
      state.phoneProofToken = resp.proof_token;
      saveState();
      
      // 进入Take Oath步骤
      updateStep(3);
    } else {
      throw new Error('Verification failed');
    }
  } catch (ex) {
    showErr(err, ex.message || 'Verify failed');
  } finally {
    unlockButton(btn, 'Verify Phone');
  }
}

function onBackToPhone(e) { 
  e?.preventDefault(); 
  
  // 清除cooldown定时器
  if (state.resendTimer) {
    clearInterval(state.resendTimer);
    state.resendTimer = null;
  }
  
  $('#phoneInput').disabled = false;
  $('#phoneInput').value = '';
  hide($('#phoneCodeSection'));
  show($('#btnSendPhone')); // 重新显示发送按钮
  setStatus($('#phoneStatus'), 'We\'ll send a 6-digit code to your phone.', 'default');
  
  // 重置按钮状态
  const btn = $('#btnBackToPhone');
  btn.textContent = 'Change Phone';
  btn.disabled = false;
  
  state.phone = state.phoneTicketId = "";
  saveState();
  updateStep(2); 
  setTimeout(() => $('#phoneInput')?.focus(), 50); 
}


// ===== Take Oath =====

function onUsernameInput() {
  const input = $('#usernameInput');
  const feedback = $('#errOath'); // 使用现有的错误显示元素
  const checkbox = $('#chkOath');
  const btn = $('#btnSubmitOath');
  
  if (!input || !feedback) return;
  
  const username = input.value.trim();
  

  
  // 本地验证
  if (!username) {
    feedback.textContent = '';
    feedback.style.display = 'none';
    btn.disabled = true;
    return;
  }
  
  // 1) 本地格式验证
  if (username.length < 2 || username.length > 20) {
    feedback.textContent = 'Use 2–20 letters/numbers/underscore/spaces and include at least one letter.';
    feedback.style.display = 'block';
    btn.disabled = true;
    return;
  }
  
  if (!/^[A-Za-z0-9_ ]+$/.test(username)) {
    feedback.textContent = 'Use 2–20 letters/numbers/underscore/spaces and include at least one letter.';
    feedback.style.display = 'block';
    btn.disabled = true;
    return;
  }
  
  if (!/[A-Za-z]/.test(username)) {
    feedback.textContent = 'Use 2–20 letters/numbers/underscore/spaces and include at least one letter.';
    feedback.style.display = 'block';
    btn.disabled = true;
    return;
  }
  
  // 2) 黑名单检查
  const lowerUsername = username.toLowerCase();
  if (USERNAME_BLACKLIST.some(blacklisted => lowerUsername.includes(blacklisted))) {
    feedback.textContent = 'This name is reserved and cannot be used.';
    feedback.style.display = 'block';
    btn.disabled = true;
    return;
  }
  
  // 3) 本地验证通过，隐藏错误信息
  feedback.style.display = 'none';
  // 只有勾选了Oath才能启用按钮
  btn.disabled = !checkbox.checked;
}

function onOathCheckboxChange() {
  const checkbox = $('#chkOath');
  const btn = $('#btnSubmitOath');
  const feedback = $('#errOath');
  
  if (!checkbox || !btn) return;
  
  // 只有用户名可用且勾选了Oath才能启用按钮
  const canEnable = checkbox.checked && feedback.style.display === 'none';
  btn.disabled = !canEnable;
}

async function onTakeOath(e) {
  e?.preventDefault();
  const username = $('#usernameInput')?.value.trim();
  const btn = $('#btnSubmitOath');
  const err = $('#errOath');
  
  if (!state.emailProofToken || !state.phoneProofToken) {
    showErr(err, 'Please complete verification steps first');
    return;
  }
  
  if (!username || !isValidUsername(username)) {
    showErr(err, 'Please enter a valid username');
    return;
  }
  
  lockButton(btn, 'Taking Oath…');
  try {
    // 确保有新的Turnstile token
    if (!state.turnstileToken) {
      console.log('No Turnstile token, waiting for one...');
      await waitForTurnstileToken();
    }
    
    // 1. 创建注册记录
    const regResponse = await postJSON(ENDPOINTS.createRegistration, {});
    state.registrationId = regResponse.registration_id;
    
    // 重置Turnstile token，为下一个请求准备
    resetTurnstile();
    await waitForTurnstileToken();
    
    // 2. 分别附加邮箱和手机号proof token
    await postJSON(ENDPOINTS.attachRegistration(state.registrationId), {
      proof_token: state.emailProofToken
    });
    
    // 重置Turnstile token，为下一个请求准备
    resetTurnstile();
    await waitForTurnstileToken();
    
    await postJSON(ENDPOINTS.attachRegistration(state.registrationId), {
      proof_token: state.phoneProofToken
    });
    
    // 重置Turnstile token，为下一个请求准备
    resetTurnstile();
    await waitForTurnstileToken();
    
    // 3. 更新注册信息（用户名和宣誓）
    await postJSON(ENDPOINTS.patchRegistration(state.registrationId), {
      username: username,
      oath_accept: true
    }, 'PATCH');
    
    // 重置Turnstile token，为下一个请求准备
    resetTurnstile();
    await waitForTurnstileToken();
    
    // 4. 激活注册
    const activateResponse = await postJSON(ENDPOINTS.activateRegistration(state.registrationId), {});
    
    // 保存到状态中
    state.username = username;
    state.userId = activateResponse.user_id;
    saveState();
    
    // 进入Get Badge步骤（不自动登录）
    updateStep(4);
    $('#badgeName').textContent = state.username;
  } catch (ex) {
    showErr(err, ex.message || 'Failed to take oath');
  } finally {
    unlockButton(btn, 'Confirm');
  }
}

// ===== Back to Home =====
function onBackToHome(e) {
  e?.preventDefault();
  // 跳转到主页
  window.location.href = '/index.html';
}

// ===== Get Badge =====
function onGoToMember() {
  // 跳转到会员页面
  window.location.href = '/portal.html';
}

// ===== 模式选择 =====
function initializeMode() {
  // 1) 显式 URL 参数优先级最高
  const urlParams = new URLSearchParams(window.location.search);
  const modeParam = urlParams.get('mode');
  if (modeParam === 'login') {
    currentAuthMode = 'login';
    // 当用户明确选择登录时，不要被之前的注册状态强制回到注册
    try { sessionStorage.removeItem('authState'); } catch {}
  } else if (modeParam === 'signup') {
    currentAuthMode = 'signup';
  } else {
    // 2) 没有显式参数时，再看持久化的临时状态
    try {
      if (sessionStorage.getItem('loginState')) {
        currentAuthMode = 'login';
      } else if (sessionStorage.getItem('authState')) {
        currentAuthMode = 'signup';
      } else {
        currentAuthMode = null; // 显示模式选择器
      }
    } catch {
      currentAuthMode = null;
    }
  }

  const modeSelector = $('#modeSelector');
  const signupFlow = $('#signupFlow');
  const loginFlow = $('#loginFlow');
  const loginSmsFlow = $('#loginSmsFlow');
  const setHero = (which) => {
    const titleEl = document.getElementById('authHeroTitle');
    const leadEl = document.getElementById('authHeroLead');
    if (!titleEl || !leadEl) return;
    if (which === 'login') {
      titleEl.textContent = 'Welcome Back to the Guild';
      leadEl.textContent = 'Securely access with your email or phone. No password needed.';
      document.title = 'Mythical Helper – Sign In';
    } else {
      titleEl.textContent = 'Become a Mythical Helper';
      leadEl.textContent = 'Bind your enchanted email scroll and crystal phone orb to enter.';
      document.title = 'Mythical Helper – Auth';
    }
  };
  
  if (currentAuthMode === 'signup') {
    // 直接进入注册流程
    if (modeSelector) modeSelector.hidden = true;
    if (signupFlow) signupFlow.hidden = false;
    if (loginFlow) loginFlow.hidden = true;
    if (loginSmsFlow) loginSmsFlow.hidden = true;
    setHero('signup');
  } else if (currentAuthMode === 'login') {
    // 登录模式
    if (modeSelector) modeSelector.hidden = true;
    if (signupFlow) signupFlow.hidden = true;
    if (loginFlow) loginFlow.hidden = false;
    if (loginSmsFlow) loginSmsFlow.hidden = true;
    setHero('login');
  } else {
    // 没有明确指定模式，显示模式选择器
    if (modeSelector) modeSelector.hidden = false;
    if (signupFlow) signupFlow.hidden = true;
    if (loginFlow) loginFlow.hidden = true;
    if (loginSmsFlow) loginSmsFlow.hidden = true;
    // 设置默认的标题
    const titleEl = document.getElementById('authHeroTitle');
    const leadEl = document.getElementById('authHeroLead');
    if (titleEl && leadEl) {
      titleEl.textContent = 'Welcome to Mythical Helper';
      leadEl.textContent = 'Choose your path to join the guild.';
      document.title = 'Mythical Helper – Auth';
    }
  }
}

function showSignupFlow() {
  currentAuthMode = 'signup';
  const modeSelector = $('#modeSelector');
  const signupFlow = $('#signupFlow');
  const loginFlow = $('#loginFlow');
  
  if (modeSelector) modeSelector.hidden = true;
  if (signupFlow) signupFlow.hidden = false;
  if (loginFlow) loginFlow.hidden = true;
  const titleEl = document.getElementById('authHeroTitle');
  const leadEl = document.getElementById('authHeroLead');
  if (titleEl && leadEl) {
    titleEl.textContent = 'Become a Mythical Helper';
    leadEl.textContent = 'Bind your enchanted email scroll and crystal phone orb to enter.';
    document.title = 'Mythical Helper – Auth';
  }
  ensureSignupModeInUrl();
}

function showLoginFlow() {
  currentAuthMode = 'login';
  const modeSelector = $('#modeSelector');
  const signupFlow = $('#signupFlow');
  const loginFlow = $('#loginFlow');
  const loginSmsFlow = $('#loginSmsFlow');
  
  if (modeSelector) modeSelector.hidden = true;
  if (signupFlow) signupFlow.hidden = true;
  if (loginFlow) loginFlow.hidden = false;
  if (loginSmsFlow) loginSmsFlow.hidden = true;
  const titleEl = document.getElementById('authHeroTitle');
  const leadEl = document.getElementById('authHeroLead');
  if (titleEl && leadEl) {
    titleEl.textContent = 'Welcome Back to the Guild';
    leadEl.textContent = 'Securely access with your email or phone. No password needed.';
    document.title = 'Mythical Helper – Sign In';
  }
  // 切换到登录时，清理注册的临时状态，避免再次被强制回到注册
  try { sessionStorage.removeItem('authState'); } catch {}
  // 同步URL
  ensureLoginModeInUrl();
}

function backToModeSelector() {
  // Use URL param to decide, then delegate to flow helpers.
  const urlParams = new URLSearchParams(window.location.search);
  const mode = urlParams.get('mode') || 'login';
  if (mode === 'signup') {
    showSignupFlow();
  } else {
    showLoginFlow();
  }
}

// ===== 登录功能 =====
let loginState = {
  email: '',
  phone: '',
  ticketId: '',
  resendLeft: 0,
  resendExpiry: 0,
  mode: '' // 'email' | 'sms'
};

// ===== Login state persistence (session) =====
function saveLoginState() {
  try {
    const payload = {
      email: loginState.email,
      phone: loginState.phone,
      ticketId: loginState.ticketId,
      resendExpiry: loginState.resendExpiry || 0,
      mode: loginState.mode || ''
    };
    sessionStorage.setItem('loginState', JSON.stringify(payload));
  } catch {}
}

function loadLoginState() {
  try {
    const raw = sessionStorage.getItem('loginState');
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    loginState.email = parsed.email || '';
    loginState.phone = parsed.phone || '';
    loginState.ticketId = parsed.ticketId || '';
    loginState.resendExpiry = parsed.resendExpiry || 0;
    loginState.mode = parsed.mode || '';
    if (loginState.resendExpiry) {
      const left = Math.ceil((loginState.resendExpiry - Date.now()) / 1000);
      loginState.resendLeft = Math.max(0, left);
    }
    if (loginState.mode === 'sms') {
      return !!(loginState.phone && loginState.ticketId);
    }
    // default to email
    return !!(loginState.email && loginState.ticketId);
  } catch {
    return false;
  }
}

function clearLoginState() {
  try { sessionStorage.removeItem('loginState'); } catch {}
  loginState = { email: '', phone: '', ticketId: '', resendLeft: 0, resendExpiry: 0, mode: '' };
}

function ensureLoginModeInUrl() {
  try {
    const url = new URL(window.location.href);
    if (url.searchParams.get('mode') !== 'login') {
      url.searchParams.set('mode', 'login');
      history.replaceState(null, '', url.toString());
    }
  } catch {}
}

function ensureSignupModeInUrl() {
  try {
    const url = new URL(window.location.href);
    if (url.searchParams.get('mode') !== 'signup') {
      url.searchParams.set('mode', 'signup');
      history.replaceState(null, '', url.toString());
    }
  } catch {}
}

async function onSendLoginCode() {
  const email = $('#loginEmailInput')?.value.trim();
  const btn = $('#btnSendLoginCode');
  const status = $('#loginEmailStatus');
  const err = $('#errLoginCode');
  
  if (!email) {
    showError(err, 'Please enter your email address');
    return;
  }
  
  lockButton(btn, 'Sending...');
  hideError(err);
  
  try {
    // 创建邮箱登录ticket
    const data = await postJSON(ENDPOINTS.createTicket, {
      channel: "email",
      destination: email,
      purpose: "signin"
    });
    
    // 保存登录状态
    loginState.email = email;
    loginState.ticketId = data.ticket_id;
    loginState.mode = 'email';
    loginState.resendLeft = data.cooldown_sec || 0;
    loginState.resendExpiry = loginState.resendLeft > 0 ? Date.now() + loginState.resendLeft * 1000 : 0;
    saveLoginState();
    
    // 显示验证码输入框
    setStatus(status, 'Code sent! Check your inbox.', 'success');
    show($('#loginEmailCodeSection'));
    setupCodeInputs($('#loginEmailCodeSection'));
    // 自动聚焦到第一个验证码输入框
    setTimeout(() => {
      const firstInput = $('#loginEmailCodeSection').querySelector('.login-code-input');
      if (firstInput) firstInput.focus();
    }, 100);
    // 强制保持在登录流程
    showLoginFlow();
    // 隐藏发送按钮和注册提示
    hide(btn);
    const switchBlock = document.querySelector('#loginStep1 .auth-switch');
    if (switchBlock) hide(switchBlock);
    
    // 启动重发倒计时
    if (loginState.resendLeft > 0) {
      startLoginResend();
    }
    
  } catch (error) {
    console.error('Send login code error:', error);
    showError(err, error.message || 'Failed to send code');
  } finally {
    unlockButton(btn, 'Get Email Code');
  }
}

async function onVerifyLoginCode() {
  const codeInputs = document.querySelectorAll('.login-code-input');
  const code = Array.from(codeInputs).map(input => input.value).join('');
  const btn = $('#btnVerifyLoginCode');
  const err = $('#errLoginCode');
  
  if (code.length !== 6) {
    showError(err, 'Please enter the complete 6-digit code');
    return;
  }
  
  lockButton(btn, 'Verifying...');
  hideError(err);
  
  try {
    // 确认ticket并获取proof token
    const resp = await postJSON(ENDPOINTS.confirmTicket(loginState.ticketId), {
      code: code
    });
    
    if (!resp.verified || !resp.proof_token) {
      throw new Error('Verification failed');
    }
    
    // 交换会话令牌
    const sessionResponse = await postJSON(ENDPOINTS.exchangeSession, {
      proof_token: resp.proof_token
    });
    
    // 保存token到sessionStorage
    try { sessionStorage.setItem('authToken', sessionResponse.access_token); } catch {}
    // 清理登录临时状态
    clearLoginState();
    
    // 立即导航到会员门户；同时保留一个兜底的延迟导航
    window.location.assign('/portal.html');
    setTimeout(() => {
      if (window.location.pathname.indexOf('portal.html') === -1) {
        window.location.href = '/portal.html';
      }
    }, 300);
    
  } catch (error) {
    console.error('Verify login code error:', error);
    let errorMessage = 'Invalid code';
    if (error.message && error.message !== '[object Object]') {
      errorMessage = error.message;
    } else if (error.detail) {
      errorMessage = typeof error.detail === 'string' ? error.detail : error.detail.detail || 'Invalid code';
    }
    showError(err, errorMessage);
  } finally {
    unlockButton(btn, 'Verify Code');
  }
}

function updateLoginStep(step) {
  // 更新步骤标签
  document.querySelectorAll('#loginStep1tag, #loginStep2tag').forEach(tag => {
    tag.classList.remove('active');
  });
  $(`#loginStep${step}tag`)?.classList.add('active');
  
  // 显示/隐藏步骤
  document.querySelectorAll('#loginStep1, #loginStep2').forEach(section => {
    section.hidden = true;
  });
  $(`#loginStep${step}`).hidden = false;
}

function onBackToLoginEmail() {
  hide($('#loginEmailCodeSection'));
  clearLoginState();
  setStatus($('#loginEmailStatus'), "We'll send a 6-digit code to your email.", 'default');
  const btn = $('#btnSendLoginCode');
  if (btn) show(btn);
  const switchBlock = document.querySelector('#loginStep1 .auth-switch');
  if (switchBlock) show(switchBlock);
}

function startLoginResend() {
  if (loginState.resendLeft <= 0) return;
  
  const btn = $('#btnSendLoginCode');
  if (btn) {
    btn.disabled = true;
    btn.textContent = `Resend in ${loginState.resendLeft}s`;
  }
  
  const timer = setInterval(() => {
    loginState.resendLeft--;
    if (btn) {
      btn.textContent = `Resend in ${loginState.resendLeft}s`;
    }
    
    if (loginState.resendLeft <= 0) {
      clearInterval(timer);
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Get Email Code';
      }
      // 清理持久化的冷却时间
      loginState.resendExpiry = 0;
      saveLoginState();
    }
  }, 1000);
}

function startLoginSmsResend() {
  if (loginState.resendLeft <= 0) return;
  const btn = $('#btnSendLoginSms');
  if (btn) {
    btn.disabled = true;
    btn.textContent = `Resend in ${loginState.resendLeft}s`;
  }
  const timer = setInterval(() => {
    loginState.resendLeft--;
    if (btn) btn.textContent = `Resend in ${loginState.resendLeft}s`;
    if (loginState.resendLeft <= 0) {
      clearInterval(timer);
      if (btn) { btn.disabled = false; btn.textContent = 'Get Phone Code'; }
      loginState.resendExpiry = 0;
      saveLoginState();
    }
  }, 1000);
}

// ===== Init =====
function initializeApp() {
  // 初始化模式选择
  initializeMode();
  
  // 加载保存的状态
  const hasState = loadState();
  const hasLogin = loadLoginState();
  
  // 总是初始化手机输入框（如果存在）
  initPhoneInput();
  
  // 如果存在登录流程状态，优先恢复登录视图
  if (hasLogin) {
    currentAuthMode = 'login';
    ensureLoginModeInUrl();
    if (loginState.mode === 'sms') {
      switchLoginMode('sms');
      initLoginPhoneInput();
      if ($('#loginPhoneInput') && loginState.phone && $('#loginPhoneInput')._iti) {
        try { $('#loginPhoneInput')._iti.setNumber(loginState.phone); } catch {}
      }
      $('#loginSmsStep1').hidden = true;
      $('#loginSmsStep2').hidden = false;
      setStatus($('#loginPhoneStatus'), 'SMS sent. Check your phone.', 'success');
      // 自动聚焦到第一个验证码输入框
      setTimeout(() => {
        const firstInput = document.querySelector('.login-sms-code-input');
        if (firstInput) firstInput.focus();
      }, 100);
      if (loginState.resendLeft > 0) startLoginSmsResend();
    } else {
      showLoginFlow();
      if ($('#loginEmailInput')) {
        $('#loginEmailInput').value = loginState.email;
      }
      setStatus($('#loginEmailStatus'), 'Code sent! Check your inbox.', 'success');
      show($('#loginEmailCodeSection'));
      setupCodeInputs($('#loginEmailCodeSection'));
      // 自动聚焦到第一个验证码输入框
      setTimeout(() => {
        const firstInput = $('#loginEmailCodeSection').querySelector('.login-code-input');
        if (firstInput) firstInput.focus();
      }, 100);
      // 与发送成功后的显示保持一致：隐藏发送按钮与注册提示
      const btn = $('#btnSendLoginCode');
      if (btn) hide(btn);
      const switchBlock = document.querySelector('#loginStep1 .auth-switch');
      if (switchBlock) hide(switchBlock);
      if (loginState.resendLeft > 0) startLoginResend();
    }
  }
  
  if (!hasLogin && hasState && currentAuthMode === 'signup') {
    // 只有在明确指定注册模式且有注册状态时才恢复注册流程
    showSignupFlow();
    ensureSignupModeInUrl();
    // 恢复保存的状态
    if (state.email) {
      $('#emailInput').value = state.email;
      $('#emailInput').disabled = true;
      hide($('#btnSend'));
      show($('#emailCodeSection'));
      setStatus($('#emailStatus'), 'Code sent! Check your inbox.', 'success');
      setupCodeInputs($('#emailCodeSection'));
      // 自动聚焦到第一个验证码输入框
      setTimeout(() => {
        const firstInput = $('#emailCodeSection').querySelector('input[inputmode="numeric"]');
        if (firstInput) firstInput.focus();
      }, 100);
      const signupSwitch = document.querySelector('#step1 .auth-switch');
      if (signupSwitch) hide(signupSwitch);
    }
    if (state.phone && state.iti) {
      state.iti.setNumber(state.phone);
    }
    if (state.phoneTicketId && state.currentStep === 2) {
      // 显示手机验证码区域
      hide($('#btnSendPhone'));
      show($('#phoneCodeSection'));
      setStatus($('#phoneStatus'), 'SMS code sent.', 'success');
      const phoneCodeBox = $('#phoneCodeBox');
      if (phoneCodeBox) {
        setupCodeInputs(phoneCodeBox.parentElement);
        // 自动聚焦到第一个验证码输入框
        setTimeout(() => {
          const firstInput = phoneCodeBox.querySelector('input');
          if (firstInput) firstInput.focus();
        }, 100);
      }
      if (state.resendLeft > 0) startResend();
    }
    if (state.username) {
      $('#usernameInput').value = state.username;
      if (state.currentStep === 4) $('#badgeName').textContent = state.username;
    }
    updateStep(state.currentStep || 1);
  } else if (currentAuthMode === 'signup') {
    // 显式是注册模式但无保存状态
    updateStep(1);
  }
  
  $('#btnSend')?.addEventListener('click', onSendEmail, true);
  $('#btnVerifyEmail')?.addEventListener('click', onVerifyEmail);
  $('#btnBackToEmailInput')?.addEventListener('click', onBackToEmail);

  $('#btnSendPhone')?.addEventListener('click', onSendPhone);
  $('#btnVerifyPhone')?.addEventListener('click', onVerifyPhone);
  $('#btnBackToPhone')?.addEventListener('click', onBackToPhone);

  // Take Oath 步骤的事件监听器
  $('#usernameInput')?.addEventListener('input', onUsernameInput);
  $('#chkOath')?.addEventListener('change', onOathCheckboxChange);
  $('#btnSubmitOath')?.addEventListener('click', onTakeOath);
  $('#btnBackToHome')?.addEventListener('click', onBackToHome);

  // Get Badge 步骤的事件监听器
  $('#btnGoToMember')?.addEventListener('click', onGoToMember);

  // 模式选择事件监听器
  document.querySelectorAll('.mode-btn[data-mode="signup"]').forEach(btn => {
    btn.addEventListener('click', showSignupFlow);
  });
  
  document.querySelectorAll('.mode-btn[data-mode="login"]').forEach(btn => {
    btn.addEventListener('click', showLoginFlow);
  });

  // 登录相关事件监听器
  $('#btnSendLoginCode')?.addEventListener('click', onSendLoginCode);
  $('#btnVerifyLoginCode')?.addEventListener('click', onVerifyLoginCode);
  $('#btnBackToLoginEmail')?.addEventListener('click', onBackToLoginEmail);

  // 登录方式切换与SMS登录
  document.querySelectorAll('.login-tab[data-login-mode]').forEach(btn => {
    btn.addEventListener('click', () => switchLoginMode(btn.dataset.loginMode));
  });
  $('#btnSendLoginSms')?.addEventListener('click', onSendLoginSms);
  $('#btnVerifyLoginSms')?.addEventListener('click', onVerifyLoginSms);
  
  // 认证模式切换链接
  $('#switchToLogin')?.addEventListener('click', (e) => {
    e.preventDefault();
    showLoginFlow();
  });
  $('#switchToSignup')?.addEventListener('click', (e) => {
    e.preventDefault();
    showSignupFlow();
  });
  $('#switchToSignupFromSms')?.addEventListener('click', (e) => {
    e.preventDefault();
    showSignupFlow();
  });
  $('#btnBackToLoginPhone')?.addEventListener('click', () => {
    $('#loginSmsStep1').hidden = false; 
    $('#loginSmsStep2').hidden = true;
    clearLoginState();
    setStatus($('#loginPhoneStatus'), "We'll send a 6-digit code to your phone.", 'default');
  });

  // Header Member 跳转：已登录去 portal，未登录去 login
  const navMember = document.getElementById('navMember');
  if (navMember) {
    navMember.addEventListener('click', (e) => {
      e.preventDefault();
      if (sessionStorage.getItem('authToken')) {
        window.location.href = '/portal.html';
      } else {
        window.location.href = '/auth.html?mode=login';
      }
    });
  }

  setTimeout(() => {
    if (state.currentStep === 1) {
      $('#emailInput')?.focus();
    } else if (state.currentStep === 2) {
      $('#phoneInput')?.focus();
    } else if (state.currentStep === 3) {
      $('#usernameInput')?.focus();
    }
  }, 80);
  
  // 确保登录SMS输入框初始化
  initLoginPhoneInput();
}

document.addEventListener('DOMContentLoaded', () => {
  // 等待 intl-tel-input 库加载完成
  if (window.intlTelInput) {
    initializeApp();
  } else {
    // 如果库还没加载，等待一下再试
    setTimeout(() => {
      if (window.intlTelInput) {
        initializeApp();
      } else {
        console.error('intl-tel-input library failed to load');
        // 即使库没加载也继续初始化其他功能
        initializeApp();
      }
    }, 100);
  }
});

// ===== Debug Helper Functions =====
// 在浏览器控制台中运行这些函数来调试
window.debugPhone = {
  // 测试手机号验证
  testValidation: function(phoneNumber) {
    console.log('=== Testing phone validation ===');
    console.log('Input:', phoneNumber);
    console.log('state.iti exists:', !!state.iti);
    
    if (state.iti) {
      // 设置手机号
      state.iti.setNumber(phoneNumber);
      console.log('Set number to:', phoneNumber);
      
      // 验证
      const isValid = state.iti.isValidNumber();
      console.log('isValidNumber():', isValid);
      
      if (isValid) {
        const number = state.iti.getNumber();
        console.log('getNumber():', number);
        
        // 获取不同格式
        if (window.intlTelInputUtils && window.intlTelInputUtils.numberFormat) {
          const e164Number = state.iti.getNumber(window.intlTelInputUtils.numberFormat.E164);
          const nationalNumber = state.iti.getNumber(window.intlTelInputUtils.numberFormat.NATIONAL);
          const internationalNumber = state.iti.getNumber(window.intlTelInputUtils.numberFormat.INTERNATIONAL);
          
          console.log('E164 format:', e164Number);
          console.log('National format:', nationalNumber);
          console.log('International format:', internationalNumber);
        } else {
          console.log('Utils not available for format conversion');
        }
      }
    } else {
      console.error('intl-tel-input instance not available');
    }
  },
  
  // 检查库状态
  checkLibrary: function() {
    console.log('=== Library Status ===');
    console.log('window.intlTelInput:', !!window.intlTelInput);
    console.log('window.intlTelInputUtils:', !!window.intlTelInputUtils);
    console.log('state.iti:', !!state.iti);
    console.log('Phone input element:', !!$('#phoneInput'));
  },
  
  // 重新初始化
  reinit: function() {
    console.log('=== Reinitializing phone input ===');
    state.iti = null;
    initPhoneInput();
  },
  
  // 测试格式化
  testFormatting: function(phoneNumber) {
    console.log('=== Testing phone formatting ===');
    if (state.iti) {
      state.iti.setNumber(phoneNumber);
      console.log('Input:', phoneNumber);
      console.log('Current display value:', $('#phoneInput').value);
      
      if (window.intlTelInputUtils && window.intlTelInputUtils.numberFormat) {
        console.log('Available formats:');
        console.log('- E164:', state.iti.getNumber(window.intlTelInputUtils.numberFormat.E164));
        console.log('- NATIONAL:', state.iti.getNumber(window.intlTelInputUtils.numberFormat.NATIONAL));
        console.log('- INTERNATIONAL:', state.iti.getNumber(window.intlTelInputUtils.numberFormat.INTERNATIONAL));
      }
    }
  },
  
  // 测试实时格式化
  testLiveFormatting: function() {
    console.log('=== Testing live formatting ===');
    const input = $('#phoneInput');
    if (input) {
      console.log('Simulating typing: 2015550123');
      input.value = '';
      input.focus();
      
      // 模拟逐字符输入
      const number = '2015550123';
      let current = '';
      for (let i = 0; i < number.length; i++) {
        current += number[i];
        input.value = current;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        console.log(`After typing "${current}": "${input.value}"`);
      }
    }
  }
};
