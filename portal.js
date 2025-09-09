// ===== PORTAL JAVASCRIPT =====

// 配置
const API_BASE = 'https://api.mythicalhelper.org';  // 使用你的实际API地址
// 临时本地测试配置 - 如果有CORS问题，可以尝试使用代理
// const API_BASE = 'https://cors-anywhere.herokuapp.com/https://api.mythicalhelper.org';

// ===== Stripe 配置 =====
// 注意：我们使用 Stripe Checkout 重定向流程，不需要客户端 Stripe 对象
// const stripe = Stripe('pk_test_51S4XMwArEWZmSCjIvRXSikHETRrfWw6URqH6cIKTMqsDEUfhSZJWAGFde1YLTbE5paltdUQR7Bi9Zy5taJZLJLRS00dJ9Hhdfu');

// 全局状态
let currentUser = null;
const portalState = { phoneTxId: '', newPhone: '', phoneResendExpiry: 0, emailTxId: '', newEmail: '', emailResendExpiry: 0 };
let isInEmailChangeFlow = false; // 添加邮箱修改流程状态

// Turnstile状态管理
let portalTurnstileToken = null;
let currentTurnstileOperation = null; // 'email', 'phone', 'delete'

// ===== Turnstile 处理函数 =====
function onPortalTurnstileSuccess(token) {
  portalTurnstileToken = token;
  console.log('Portal Turnstile success, token received, length:', token.length);
  console.log('Current operation:', currentTurnstileOperation);
  
  // 更新状态提示
  updatePortalTurnstileMessage('✓ Security verified', '#10b981');
  
  // 启用当前操作的按钮
  enableCurrentOperationButtons();
}

function onPortalTurnstileExpired() {
  console.log('Portal Turnstile token expired, clearing token...');
  portalTurnstileToken = null;
  
  // 更新状态提示
  updatePortalTurnstileMessage('⚠ Verification expired - please refresh', '#f59e0b');
  
  // 禁用当前操作的按钮
  disableCurrentOperationButtons();
}

function onPortalTurnstileError(error) {
  console.log('Portal Turnstile error:', error);
  portalTurnstileToken = null;
  
  // 更新状态提示
  updatePortalTurnstileMessage('❌ Verification failed - please try again', '#ef4444');
  
  // 禁用当前操作的按钮
  disableCurrentOperationButtons();
}

// 更新Turnstile状态消息
function updatePortalTurnstileMessage(text, color) {
  const statusElements = [
    'turnstileStatusEmail',
    'turnstileStatusPhone'
  ];
  
  statusElements.forEach(statusId => {
    const statusEl = document.getElementById(statusId);
    if (statusEl) {
      const textEl = statusEl.querySelector('span');
      
      if (textEl) textEl.textContent = text;
      
      // 根据颜色确定状态类
      let statusClass = 'default';
      
      if (color === '#10b981') {
        statusClass = 'success';
      } else if (color === '#3b82f6') {
        statusClass = 'verifying';
      } else if (color === '#f59e0b') {
        statusClass = 'warning';
      } else if (color === '#ef4444') {
        statusClass = 'error';
      }
      
      // 更新状态类
      statusEl.className = `turnstile-status ${statusClass}`;
    }
  });
}

// 启用当前操作的按钮
function enableCurrentOperationButtons() {
  if (currentTurnstileOperation === 'email') {
    const btn = document.getElementById('btnSendEmailCode');
    if (btn) btn.disabled = false;
  } else if (currentTurnstileOperation === 'phone') {
    const btn = document.getElementById('btnSendPhoneCode');
    if (btn) btn.disabled = false;
  }
}

// 禁用当前操作的按钮
function disableCurrentOperationButtons() {
  if (currentTurnstileOperation === 'email') {
    const btn = document.getElementById('btnSendEmailCode');
    if (btn) btn.disabled = true;
  } else if (currentTurnstileOperation === 'phone') {
    const btn = document.getElementById('btnSendPhoneCode');
    if (btn) btn.disabled = true;
  }
}

// 重置Turnstile
function resetPortalTurnstile() {
  console.log('Resetting Portal Turnstile...');
  portalTurnstileToken = null;
  
  // 重置Turnstile组件
  if (window.turnstile) {
    const turnstileElements = document.querySelectorAll('.cf-turnstile');
    turnstileElements.forEach(element => {
      try {
        window.turnstile.reset(element);
        console.log('Portal Turnstile element reset successfully');
      } catch (e) {
        console.error('Failed to reset Portal Turnstile element:', e);
      }
    });
  }
  
  // 重置状态提示
  updatePortalTurnstileMessage('Security verification required', 'rgba(255,255,255,0.7)');
  
  // 禁用当前操作的按钮
  disableCurrentOperationButtons();
}

// 等待Turnstile token
async function waitForPortalTurnstileToken(timeoutMs = 10000) {
  console.log('Waiting for Portal Turnstile token...');
  return new Promise((resolve, reject) => {
    const start = Date.now();
    (function poll() {
      if (portalTurnstileToken && portalTurnstileToken.length > 0) {
        console.log('Portal Turnstile token received, length:', portalTurnstileToken.length);
        return resolve(portalTurnstileToken);
      }
      
      if (Date.now() - start > timeoutMs) {
        console.log('Portal Turnstile token timeout after', timeoutMs, 'ms');
        return reject(new Error('Turnstile token timeout'));
      }
      
      setTimeout(poll, 100);
    })();
  });
}

// 带Turnstile的API请求
async function portalApiFetch(path, options = {}) {
  const headers = { 
    'Content-Type': 'application/json',
    'User-Agent': 'Mozilla/5.0 (compatible; MythicalHelper/1.0)',
    'Referer': window.location.origin,
    'Origin': window.location.origin
  };
  const hadTurnstileToken = !!portalTurnstileToken;
  
  // 添加认证头
  const token = getAuthToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  if (portalTurnstileToken) {
    headers['cf-turnstile-response'] = portalTurnstileToken;
    console.log('Sending portal request with Turnstile token:', path, 'Token length:', portalTurnstileToken.length);
  } else {
    console.log('Sending portal request WITHOUT Turnstile token:', path);
  }
  
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: { ...headers, ...(options.headers || {}) },
    });
    
    // 无论请求成功还是失败，只要使用了Turnstile token就清除它
    if (hadTurnstileToken) {
      console.log('Portal request completed, clearing Turnstile token to prevent reuse');
      portalTurnstileToken = null;
      resetPortalTurnstile();
    }
    
    if (!res.ok) {
      const j = await res.json().catch(() => ({ detail: 'Request failed' }));
      console.error('Portal request failed:', path, res.status, j);
      
      // 提取错误信息，优先使用detail字段
      let errorMessage = 'Request failed';
      if (j && typeof j === 'object') {
        // 如果detail是对象，尝试提取其中的detail字段
        if (j.detail && typeof j.detail === 'object') {
          errorMessage = j.detail.detail || j.detail.message || j.detail.title || JSON.stringify(j.detail);
        } else {
          errorMessage = j.detail || j.message || j.title || `Request failed with status ${res.status}`;
        }
      } else if (j) {
        errorMessage = String(j);
      }
      
      // 特殊处理：显示更详细的错误信息
      if (errorMessage === 'Failed to update user' && j && j.detail && typeof j.detail === 'object') {
        const detail = j.detail;
        // 构建详细的错误信息
        let detailedMessage = 'Update failed';
        if (detail.title) {
          detailedMessage += `: ${detail.title}`;
        }
        if (detail.status) {
          detailedMessage += ` (Status: ${detail.status})`;
        }
        if (detail.detail && detail.detail !== 'Failed to update user') {
          detailedMessage += ` - ${detail.detail}`;
        }
        errorMessage = detailedMessage;
      }
      
      // 确保errorMessage是字符串
      if (typeof errorMessage !== 'string') {
        errorMessage = String(errorMessage);
      }
      throw new Error(errorMessage);
    }
    
    return res.json();
  } catch (error) {
    // 即使发生网络错误，也要清除Turnstile token
    if (hadTurnstileToken) {
      console.log('Portal request failed, clearing Turnstile token to prevent reuse');
      portalTurnstileToken = null;
      resetPortalTurnstile();
    }
    throw error;
  }
}

// 初始化Turnstile组件
function initPortalTurnstile(operation) {
  console.log('Initializing Turnstile for operation:', operation);
  currentTurnstileOperation = operation;
  
  // 重置Turnstile状态
  portalTurnstileToken = null;
  
  // 等待Turnstile脚本加载
  if (window.turnstile) {
    console.log('Turnstile script loaded, initializing components');
    const turnstileElements = document.querySelectorAll('.cf-turnstile');
    turnstileElements.forEach(element => {
      try {
        window.turnstile.reset(element);
        console.log('Turnstile element reset for operation:', operation);
      } catch (e) {
        console.error('Failed to reset Turnstile element:', e);
      }
    });
  } else {
    console.log('Turnstile script not loaded yet, waiting...');
    // 等待Turnstile脚本加载
    const checkTurnstile = setInterval(() => {
      if (window.turnstile) {
        clearInterval(checkTurnstile);
        initPortalTurnstile(operation);
      }
    }, 100);
  }
}

// 导出Turnstile回调到window
window.onPortalTurnstileSuccess = onPortalTurnstileSuccess;
window.onPortalTurnstileExpired = onPortalTurnstileExpired;
window.onPortalTurnstileError = onPortalTurnstileError;

function resetEmailEditorUI(hideSection = true) {
  // 恢复输入为邮箱模式 + 文案
  const input = document.getElementById('newEmailInput');
  const label = document.getElementById('emailLabel');
  const btn = document.getElementById('btnSendPortalEmail') || document.getElementById('btnVerifyPortalEmail');
  if (input) {
    input.type = 'email';
    input.removeAttribute('maxLength');
    input.removeAttribute('pattern');
    input.removeAttribute('inputMode');
    input.placeholder = 'you@example.com';
    input.value = '';
  }
  if (label) label.textContent = 'New Email';
  if (btn) {
    btn.textContent = 'Send Code';
    if (btn.id !== 'btnSendPortalEmail') btn.id = 'btnSendPortalEmail';
    btn.disabled = false;
  }
  const codeSec = document.getElementById('portalEmailCodeSection');
  if (codeSec) codeSec.style.display = 'none';
  
  // 重新显示turnstile组件
  const turnstileContainer = document.querySelector('#emailChangeCard .turnstile-container');
  if (turnstileContainer) {
    turnstileContainer.style.display = 'flex';
  }
  
  if (hideSection) {
    // 显示profile card，隐藏change cards
    const profileCard = document.getElementById('profileCard');
    const emailChangeCard = document.getElementById('emailChangeCard');
    const phoneChangeCard = document.getElementById('phoneChangeCard');
    
    if (profileCard) profileCard.style.display = 'block';
    if (emailChangeCard) emailChangeCard.style.display = 'none';
    if (phoneChangeCard) phoneChangeCard.style.display = 'none';
  }
  const err = document.getElementById('errPortalEmail'); if (err) err.textContent = '';
}

// ===== 持久化变更流程状态（应对 Live Server 自动刷新） =====
function savePortalChangeState() {
  try {
    const payload = {
      phone: {
        txId: portalState.phoneTxId || '',
        newPhone: portalState.newPhone || '',
        resendExpiry: portalState.phoneResendExpiry || 0,
      },
      email: {
        txId: portalState.emailTxId || '',
        newEmail: portalState.newEmail || '',
        resendExpiry: portalState.emailResendExpiry || 0,
      }
    };
    sessionStorage.setItem('portalChangeState', JSON.stringify(payload));
  } catch {}
}

function clearEmailChangeState() {
  portalState.emailTxId = '';
  portalState.newEmail = '';
  portalState.emailResendExpiry = 0;
  try {
    const raw = sessionStorage.getItem('portalChangeState');
    if (!raw) return;
    const parsed = JSON.parse(raw);
    parsed.email = { txId: '', newEmail: '', resendExpiry: 0 };
    if (!parsed.phone || (!parsed.phone.txId && !parsed.phone.resendExpiry)) {
      sessionStorage.removeItem('portalChangeState');
    } else {
      sessionStorage.setItem('portalChangeState', JSON.stringify(parsed));
    }
  } catch {}
}

function clearPhoneChangeState() {
  portalState.phoneTxId = '';
  portalState.newPhone = '';
  portalState.phoneResendExpiry = 0;
  try {
    const raw = sessionStorage.getItem('portalChangeState');
    if (!raw) return;
    const parsed = JSON.parse(raw);
    parsed.phone = { txId: '', newPhone: '', resendExpiry: 0 };
    if (!parsed.email || (!parsed.email.txId && !parsed.email.resendExpiry)) {
      sessionStorage.removeItem('portalChangeState');
    } else {
      sessionStorage.setItem('portalChangeState', JSON.stringify(parsed));
    }
  } catch {}
}

function loadPortalChangeState() {
  try {
    const raw = sessionStorage.getItem('portalChangeState');
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    if (parsed.phone) {
      portalState.phoneTxId = parsed.phone.txId || '';
      portalState.newPhone = parsed.phone.newPhone || '';
      portalState.phoneResendExpiry = parsed.phone.resendExpiry || 0;
    }
    if (parsed.email) {
      portalState.emailTxId = parsed.email.txId || '';
      portalState.newEmail = parsed.email.newEmail || '';
      portalState.emailResendExpiry = parsed.email.resendExpiry || 0;
    }
    return !!(portalState.phoneTxId || portalState.emailTxId || portalState.phoneResendExpiry || portalState.emailResendExpiry);
  } catch {
    return false;
  }
}

function clearExpiredChangeState() {
  try {
    const raw = sessionStorage.getItem('portalChangeState');
    if (!raw) return;
    const parsed = JSON.parse(raw);
    const now = Date.now();
    let hasValidState = false;
    
    // 检查email状态是否过期（超过24小时）
    if (parsed.email && parsed.email.resendExpiry) {
      if (parsed.email.resendExpiry > now) {
        hasValidState = true;
      } else {
        parsed.email = { txId: '', newEmail: '', resendExpiry: 0 };
      }
    }
    
    // 检查phone状态是否过期（超过24小时）
    if (parsed.phone && parsed.phone.resendExpiry) {
      if (parsed.phone.resendExpiry > now) {
        hasValidState = true;
      } else {
        parsed.phone = { txId: '', newPhone: '', resendExpiry: 0 };
      }
    }
    
    // 如果没有有效状态，清除整个sessionStorage
    if (!hasValidState) {
      sessionStorage.removeItem('portalChangeState');
      console.log('Cleared expired portal change state');
    } else {
      sessionStorage.setItem('portalChangeState', JSON.stringify(parsed));
    }
  } catch (error) {
    console.error('Error clearing expired change state:', error);
    // 如果解析失败，直接清除
    sessionStorage.removeItem('portalChangeState');
  }
}

// 邮箱编辑器函数
function openEmailEditor() {

  isInEmailChangeFlow = true; // 设置邮箱修改流程状态
  
  // 隐藏profile card，显示email change card
  const profileCard = document.getElementById('profileCard');
  const emailChangeCard = document.getElementById('emailChangeCard');
  const phoneChangeCard = document.getElementById('phoneChangeCard');
  

  

  
  if (profileCard) profileCard.style.display = 'none';
  if (phoneChangeCard) phoneChangeCard.style.display = 'none';
  
  if (emailChangeCard) {
    emailChangeCard.style.display = 'block';
    // 显示当前邮箱信息
    const currentEmailDisplay = document.getElementById('currentEmailDisplay');
    if (currentEmailDisplay && currentUser) {
      currentEmailDisplay.textContent = currentUser.email || 'Not provided';
    }
    // 初始化Turnstile组件
    setTimeout(() => {
      initPortalTurnstile('email');
    }, 100);
  }
  
  // 清空错误信息
  const err = document.getElementById('errPortalEmail');
  if (err) err.textContent = '';
  
  // 聚焦到输入框
  const input = document.getElementById('newEmailInput');
  if (input) input.focus();
}

// DOM元素
const $ = (id) => {
  // 如果传入的是CSS选择器（以#开头），去掉#号
  if (typeof id === 'string' && id.startsWith('#')) {
    id = id.substring(1);
  }
  return document.getElementById(id);
};

// ===== 工具函数 =====
function formatDate(dateString) {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

function formatDateShort(dateString) {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDateTime(dateString) {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function formatPhoneNumber(phoneString) {
  if (!phoneString || phoneString === 'Not provided') return 'Not provided';
  
  // 移除所有非数字字符
  const cleaned = phoneString.replace(/\D/g, '');
  
  // 如果是美国号码（10位数字），格式化为 +1 (XXX) XXX-XXXX
  if (cleaned.length === 10) {
    return `+1 (${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  
  // 如果已经有国家代码（11位数字，以1开头），格式化为 +1 (XXX) XXX-XXXX
  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
  }
  
  // 其他格式保持原样
  return phoneString;
}

// 已移除头像首字母逻辑

function showError(message) {
  // 简单的错误提示，可以后续改进
  alert('Error: ' + message);
}

function showSuccess(message) {
  // 简单的成功提示，可以后续改进
  alert('Success: ' + message);
}

function showLoading(message) {
  // 简单的加载提示，可以后续改进
  console.log('Loading: ' + message);
  // 可以在这里添加更美观的加载提示UI
}

// 确保函数在全局作用域中可用
window.showLoading = showLoading;

function setupCodeInputs(container) {
  if (!container) return;
  const inputs = container.querySelectorAll('input[maxlength="1"][inputmode="numeric"]');
  inputs.forEach((ipt, idx) => {
    ipt.addEventListener('input', () => {
      ipt.value = ipt.value.replace(/\D/g, '').slice(0, 1);
      if (ipt.value && idx < inputs.length - 1) inputs[idx + 1].focus();
    });
    ipt.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !ipt.value && idx > 0) inputs[idx - 1].focus();
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

// ===== 认证相关 =====
function getAuthToken() {
  return sessionStorage.getItem('authToken');
}

function setAuthToken(token) {
  sessionStorage.setItem('authToken', token);
}

function clearAuthToken() {
  sessionStorage.removeItem('authToken');
}

function isAuthenticated() {
  return !!getAuthToken();
}

function redirectToAuth() {
  window.location.href = '/auth.html?mode=login';
}

function showNotAuthenticatedMessage() {
  // 更新所有字段显示未认证状态
  const fields = ['userName', 'userEmail', 'userPhone', 'userRole', 'userCreatedAt', 'userValidUntil'];
  fields.forEach(id => {
    const element = $(id);
    if (element) {
      element.textContent = 'Please sign in first';
    }
  });
}

// ===== API调用 =====
async function apiCall(endpoint, options = {}) {
  const token = getAuthToken();
  if (!token) {
    // 在邮箱修改流程中不跳转
    if (!isInEmailChangeFlow) {
      redirectToAuth();
    }
    return null;
  }

  const defaultOptions = {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  };

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...defaultOptions,
    ...options,
    headers: {
      ...defaultOptions.headers,
      ...options.headers,
    },
  });

  if (response.status === 401) {
    clearAuthToken();
    // 在邮箱修改流程中不跳转
    if (!isInEmailChangeFlow) {
      redirectToAuth();
    }
    return null;
  }

  if (!response.ok) {
    let msg = `HTTP ${response.status}`;
    try {
      const j = await response.json();
      // FastAPI problem+json style packs info under `detail`
      if (j && typeof j === 'object') {
        if (typeof j.detail === 'string') msg = j.detail;
        else if (j.detail && typeof j.detail === 'object') {
          msg = j.detail.detail || j.detail.title || msg;
        }
      }
    } catch {}
    throw new Error(msg);
  }

  return response.json();
}

// ===== 用户数据加载 =====
async function loadUserData() {
  try {
    const token = getAuthToken();
    
    currentUser = await apiCall('/users/me');

    
    if (!currentUser) {

      redirectToAuth();
      return;
    }



    // 更新用户信息（Profile Section）
    updateUserInfo();
    // 徽章区
    updateBadges();
    // 历史记录
    console.log('About to call loadPurchaseHistory...');
    
    // 测试DOM元素是否存在
    const testHistoryList = document.getElementById('historyList');
    const testHistoryLoading = document.getElementById('historyLoading');
    const testNoHistory = document.getElementById('noHistory');
    console.log('DOM elements test:', {
      historyList: !!testHistoryList,
      historyLoading: !!testHistoryLoading,
      noHistory: !!testNoHistory
    });
    
    loadPurchaseHistory();
    const editor = $('#badgesEditor');
    if (editor) {
      try { editor.value = JSON.stringify(currentUser.badges || {}, null, 2); } catch {}
    }
    // 生成 QR 码（延迟确保库加载完成）
    setTimeout(() => {
      generateQRCode(currentUser.user_id);
    }, 100);
    
    // 根据用户角色显示不同的内容
    if (currentUser.role === 'admin') {
      showAdminInterface();
    }
    
  } catch (error) {
    console.error('Failed to load user data:', error);
    // 如果是401或403错误，自动跳转到登录页
    if (error.message && (error.message.includes('401') || error.message.includes('403'))) {

      redirectToAuth();
      return;
    }
    // 回退：尝试使用注册阶段缓存的用户名/用户ID（如果有）
    try {
      const saved = sessionStorage.getItem('authState');
      if (saved) {
        const parsed = JSON.parse(saved);
        currentUser = {
          user_id: parsed.userId || 'unknown',
          username: parsed.username || 'Unknown',
          email: 'Not provided',
          phone: '',
          role: 'user',
          created_at: null,
          valid_until: null,
          badges: {}
        };
        updateUserInfo();
        updateBadges();
        const editor = $('#badgesEditor');
        if (editor) editor.value = JSON.stringify({}, null, 2);
        setTimeout(() => {
          generateQRCode(currentUser.user_id);
        }, 100);
        return;
      }
    } catch {}
    showError('Failed to load user data: ' + error.message);
  }
}

// 目前导航不显示用户名，无需动态更新

function updateUserInfo() {
  if (!currentUser) {
  
    return;
  }



  // 更新用户详情
  const fields = {
    'userName': currentUser.username || 'Unknown',
    'userEmail': currentUser.email || 'Not provided',
    'userPhone': formatPhoneNumber(currentUser.phone) || 'Not provided',
    'userRole': currentUser.role || 'user',
    'userCreatedAt': formatDate(currentUser.created_at),
    'userValidUntil': formatDateShort(currentUser.valid_until)
  };



  Object.entries(fields).forEach(([id, value]) => {
    const element = $(id);
    if (element) {
      element.textContent = value;
      
      // 为Valid Until添加颜色判断
      if (id === 'userValidUntil' && currentUser.valid_until) {
        const validUntilDate = new Date(currentUser.valid_until);
        const today = new Date();
        today.setHours(0, 0, 0, 0); // 重置时间到当天开始
        validUntilDate.setHours(0, 0, 0, 0); // 重置时间到当天开始
        
        // 移除之前的颜色类
        element.classList.remove('valid', 'expired');
        
        if (validUntilDate >= today) {
          element.classList.add('valid');
        } else {
          element.classList.add('expired');
        }
      }
      
    }
  });

  // Validity chip已移除
}

function updateValidityChip() {
  if (!currentUser || !currentUser.valid_until) return;
  
  const validChip = $('#daysLeftChip');
  if (!validChip) return;
  
  const now = new Date();
  const validUntil = new Date(currentUser.valid_until);
  const diffTime = validUntil - now;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays > 0) {
    validChip.textContent = `${diffDays} days left`;
    validChip.style.color = '#7af2a1';
    validChip.style.background = 'rgba(122,242,161,.12)';
    validChip.style.borderColor = 'rgba(122,242,161,.35)';
  } else if (diffDays === 0) {
    validChip.textContent = 'Expires today';
    validChip.style.color = '#ffa726';
    validChip.style.background = 'rgba(255,167,38,.12)';
    validChip.style.borderColor = 'rgba(255,167,38,.35)';
  } else {
    validChip.textContent = 'Expired';
    validChip.style.color = '#f44336';
    validChip.style.background = 'rgba(244,67,54,.12)';
    validChip.style.borderColor = 'rgba(244,67,54,.35)';
  }
}

function updateBadges() {
  if (!currentUser) return;

  const badgesGrid = $('#badgesGrid');
  const noBadges = $('#noBadges');
  if (!badgesGrid || !noBadges) return;

  // 清空现有徽章
  badgesGrid.innerHTML = '';

  // 获取用户徽章
  const userBadges = currentUser.badges || {};
  const badgeEntries = Object.entries(userBadges);

  if (badgeEntries.length === 0) {
    // 没有徽章时显示提示
    badgesGrid.style.display = 'none';
    noBadges.style.display = 'block';
  } else {
    // 有徽章时显示徽章列表 - 改为block布局，每个badge占一行
    badgesGrid.style.display = 'block';
    noBadges.style.display = 'none';

    badgeEntries.forEach(([id, badge]) => {
      const realmNames = {
        'north': 'North Pole',
        'tooth': 'Tooth Fairy',
        'bunny': 'Spring Bunny'
      };
      
      const badgeElement = document.createElement('div');
      badgeElement.className = `badge-item realm-${badge.realm} ${badge.active ? 'active' : 'inactive'}`;
      badgeElement.style.marginBottom = '10px';
      badgeElement.innerHTML = `
        <div class="badge-header">
          <div class="badge-status ${badge.active ? 'active' : 'inactive'}">
            ${badge.active ? 'Active' : 'Inactive'}
          </div>
          <h3 class="badge-title realm-${badge.realm}">${realmNames[badge.realm] || 'Unknown Realm'}</h3>
        </div>
        <div class="badge-content">
          <div class="badge-field">
            <span class="badge-label">Agent Name:</span>
            <span class="badge-value">${currentUser.username || 'Unknown'}</span>
          </div>
          <div class="badge-field">
            <span class="badge-label">Whom you watch over:</span>
            <span class="badge-value">${badge.care_description || 'Not specified'}</span>
          </div>
          <div class="badge-field">
            <span class="badge-label">Enchanted Until:</span>
            <span class="badge-value">${getEnchantedUntil(currentUser.valid_until)}</span>
          </div>
        </div>
        <div class="badge-seal" aria-hidden="true">
          ${getBadgeSeal(badge.realm)}
        </div>
      `;
      badgesGrid.appendChild(badgeElement);
    });
  }

  // 同时更新编辑模式的列表
  updateBadgesEditList();
}

function updateBadgesEditList() {
  if (!currentUser) return;

  const badgesEditList = $('#badgesEditList');
  if (!badgesEditList) return;

  // 清空现有编辑列表
  badgesEditList.innerHTML = '';

  // 获取用户徽章
  const userBadges = currentUser.badges || {};
  const badgeEntries = Object.entries(userBadges);

  // 获取所有已存在的realm（除了当前正在编辑的badge）
  const allRealms = [
    { value: 'north', label: 'North Pole' },
    { value: 'tooth', label: 'Tooth Fairy' },
    { value: 'bunny', label: 'Spring Bunny' }
  ];

  badgeEntries.forEach(([id, badge]) => {
    // 获取其他badge已使用的realm
    const otherBadgeRealms = Object.entries(userBadges)
      .filter(([otherId, otherBadge]) => otherId !== id && otherBadge.realm)
      .map(([otherId, otherBadge]) => otherBadge.realm);

    // 生成可用的realm选项
    const availableRealms = allRealms.filter(realm => 
      !otherBadgeRealms.includes(realm.value) || realm.value === badge.realm
    );

    const realmOptions = availableRealms.map(realm => 
      `<option value="${realm.value}" ${badge.realm === realm.value ? 'selected' : ''}>${realm.label}</option>`
    ).join('');

    const badgeEditElement = document.createElement('div');
    badgeEditElement.className = 'badge-edit-item';
    badgeEditElement.innerHTML = `
      <div class="form-row realm-active-row">
        <div class="realm-group">
          <label class="form-label">Realm of Service:</label>
          <select class="form-select badge-realm-select" data-badge-id="${id}">
            ${badge.realm ? '' : '<option value="">Select a realm...</option>'}
            ${realmOptions}
          </select>
        </div>
        <div class="active-group">
          <label class="form-label">Still Enchanted?</label>
          <div class="toggle-switch">
            <input type="checkbox" class="toggle-input badge-active-checkbox" data-badge-id="${id}" ${badge.active ? 'checked' : ''} id="toggle-${id}">
            <label class="toggle-label" for="toggle-${id}"></label>
          </div>
        </div>
        <div class="remove-group">
          <button type="button" class="remove-badge" data-badge-id="${id}">Remove Badge</button>
        </div>
      </div>
      <div class="form-row badge-description-row">
        <label class="form-label">Whom You Watch Over:</label>
        <input type="text" class="form-input badge-description-input" data-badge-id="${id}" value="${badge.care_description || ''}" placeholder="e.g., Caring for Emma and Lucas, Watching over little dreamers">
      </div>
    `;
    badgesEditList.appendChild(badgeEditElement);
  });

  // 添加事件监听器
  addBadgeEditEventListeners();
}

function addBadgeEditEventListeners() {
  // 为每个badge的编辑控件添加事件监听器
  const realmSelects = document.querySelectorAll('.badge-realm-select');
  const descriptionInputs = document.querySelectorAll('.badge-description-input');
  const activeCheckboxes = document.querySelectorAll('.badge-active-checkbox');
  const removeButtons = document.querySelectorAll('.remove-badge');

  realmSelects.forEach(select => {
    select.addEventListener('change', (e) => {
      const badgeId = e.target.dataset.badgeId;
      updateBadgeField(badgeId, 'realm', e.target.value);
      // 当realm改变时，重新生成所有下拉框以确保选项正确
      updateBadgesEditList();
    });
  });

  descriptionInputs.forEach(input => {
    input.addEventListener('input', (e) => {
      const badgeId = e.target.dataset.badgeId;
      updateBadgeField(badgeId, 'care_description', e.target.value);
    });
  });

  activeCheckboxes.forEach(checkbox => {
    checkbox.addEventListener('change', (e) => {
      const badgeId = e.target.dataset.badgeId;
      updateBadgeField(badgeId, 'active', e.target.checked);
    });
  });

  removeButtons.forEach(button => {
    button.addEventListener('click', (e) => {
      const badgeId = e.target.dataset.badgeId;
      removeBadge(badgeId);
    });
  });
}

function updateBadgeField(badgeId, field, value) {
  if (!currentUser || !currentUser.badges) return;
  
  if (!currentUser.badges[badgeId]) {
    currentUser.badges[badgeId] = {};
  }
  
  currentUser.badges[badgeId][field] = value;
}

function removeBadge(badgeId) {
  if (!currentUser || !currentUser.badges) return;
  
  delete currentUser.badges[badgeId];
  updateBadgesEditList();
  updateAddBadgeButtonVisibility();
}

function addNewBadge() {
  if (!currentUser) return;
  
  if (!currentUser.badges) {
    currentUser.badges = {};
  }
  
  // 获取所有已存在的realm
  const existingRealms = Object.values(currentUser.badges).map(badge => badge.realm);
  
  // 定义所有可用的realm
  const allRealms = ['north', 'tooth', 'bunny'];
  
  // 检查是否所有realm都已存在
  if (existingRealms.length >= allRealms.length) {
    showError('All realms have been added. You cannot add more badges.');
    return;
  }
  
  // 找到第一个可用的realm
  const availableRealms = allRealms.filter(realm => !existingRealms.includes(realm));
  const firstAvailableRealm = availableRealms[0];
  
  const badgeId = 'badge_' + Date.now();
  currentUser.badges[badgeId] = {
    realm: firstAvailableRealm, // 自动选择第一个可用的realm
    care_description: '',
    active: true
  };
  
  updateBadgesEditList();
  updateAddBadgeButtonVisibility();
}

function updateAddBadgeButtonVisibility() {
  if (!currentUser) return;
  
  const addBadgeBtn = $('#btnAddBadge');
  if (!addBadgeBtn) return;
  
  // 获取所有已存在的realm
  const existingRealms = Object.values(currentUser.badges || {}).map(badge => badge.realm);
  
  // 定义所有可用的realm
  const allRealms = ['north', 'tooth', 'bunny'];
  
  // 检查是否所有realm都已被创建
  const allRealmsCreated = allRealms.every(realm => existingRealms.includes(realm));
  
  if (allRealmsCreated) {
    // 所有realm都已创建，隐藏Add New Badge按钮
    addBadgeBtn.style.display = 'none';
  } else {
    // 还有realm可以创建，显示Add New Badge按钮
    addBadgeBtn.style.display = 'inline-block';
  }
}

function toggleEditMode() {
  const editModeBtn = $('#btnToggleEditMode');
  const headerEditActions = $('#headerEditActions');
  const badgesDisplay = $('#badgesDisplay');
  const badgesEdit = $('#badgesEdit');
  const addBadgeBtn = $('#btnAddBadge');
  
  if (!editModeBtn || !headerEditActions || !badgesDisplay || !badgesEdit) return;
  
  const isEditMode = editModeBtn.style.display === 'none';
  
  if (isEditMode) {
    // 退出编辑模式
    editModeBtn.style.display = 'inline-block';
    headerEditActions.style.display = 'none';
    badgesDisplay.style.display = 'block';
    badgesEdit.style.display = 'none';
  } else {
    // 进入编辑模式
    editModeBtn.style.display = 'none';
    headerEditActions.style.display = 'flex';
    badgesDisplay.style.display = 'none';
    badgesEdit.style.display = 'block';
    
    // 检查是否所有realm都已被创建
    updateAddBadgeButtonVisibility();
  }
}

async function saveBadges() {
  if (!currentUser) return;
  
  try {
    // 调用API保存badges
    const updatedUser = await apiCall('/users/me', {
      method: 'PATCH',
      body: JSON.stringify({
        badges: currentUser.badges
      })
    });
    
    if (updatedUser) {
      currentUser = updatedUser;
      updateBadges();
      toggleEditMode(); // 退出编辑模式
    }
  } catch (error) {
    console.error('Failed to save badges:', error);
    showError('Failed to save badges');
  }
}

function cancelEdit() {
  // 重新加载用户数据，丢弃未保存的更改
  loadUserData();
  toggleEditMode(); // 退出编辑模式
}

// ===== QR码功能 =====
function generateQRCode(userId) {
  console.log('Generating QR code for user:', userId);
  
  const qrContainer = $('#qrCode');
  if (!qrContainer) {
    console.error('QR container not found');
    return;
  }

  // Point QR to the public scan page instead of raw API JSON
  const origin = (typeof window !== 'undefined' && window.location && window.location.origin) ? window.location.origin : '';
  const qrUrl = `${origin}/scan.html?id=${userId}`;
  console.log('QR URL:', qrUrl);
  
  // 使用 qrcode.js 库生成真正的 QR 码
  if (window.QRCode) {
    console.log('QRCode library available, generating QR code...');
    
    try {
      // 清空容器
      qrContainer.innerHTML = '';
      
      // 创建 QR 码
      const qr = new QRCode(qrContainer, {
        text: qrUrl,
        width: 220,
        height: 220,
        colorDark: '#000000',
        colorLight: '#ffffff',
        correctLevel: QRCode.CorrectLevel.M
      });
      
      // 确保QR码在容器中居中
      const qrImg = qrContainer.querySelector('img');
      if (qrImg) {
        qrImg.style.display = 'block';
        qrImg.style.margin = 'auto';
      }
      
      console.log('QR code generated successfully');
    } catch (error) {
      console.error('Error generating QR code:', error);
      // 如果生成失败，显示占位符
      qrContainer.innerHTML = `
        <div class="qr-placeholder">
          <div class="qr-icon">❌</div>
          <p>QR Generation Failed</p>
          <div style="font-size: 10px; color: #999; margin-top: 8px; word-break: break-all;">
            ${qrUrl}
          </div>
        </div>
      `;
    }
  } else {
    console.error('QRCode library not available, showing placeholder');
    // 如果 QRCode 库未加载，显示占位符
    qrContainer.innerHTML = `
      <div class="qr-placeholder">
        <div class="qr-icon">📱</div>
        <p>QR Code</p>
        <div style="font-size: 10px; color: #999; margin-top: 8px; word-break: break-all;">
          ${qrUrl}
        </div>
      </div>
    `;
  }
}

function showQRModal() {
  if (!currentUser) return;
  
  setTimeout(() => {
    generateQRCode(currentUser.user_id);
  }, 100);
  
  const modal = $('#qrModal');
  if (modal) {
    modal.hidden = false;
  }
}

function hideQRModal() {
  const modal = $('#qrModal');
  if (modal) {
    modal.hidden = true;
  }
}

// ===== 设置功能 =====
function showSettingsModal() {
  if (!currentUser) return;
  
  // 填充表单数据
  const settingsEmail = $('#settingsEmail');
  const settingsPhone = $('#settingsPhone');
  
  if (settingsEmail) settingsEmail.value = currentUser.email;
  if (settingsPhone) settingsPhone.value = currentUser.phone || '';
  
  const modal = $('#settingsModal');
  if (modal) {
    modal.hidden = false;
  }
}

function hideSettingsModal() {
  const modal = $('#settingsModal');
  if (modal) {
    modal.hidden = true;
  }
}

async function saveSettings(event) {
  event.preventDefault();
  
  if (!currentUser) return;
  
  const settingsPhone = $('#settingsPhone');
  if (!settingsPhone) return;
  
  const newPhone = settingsPhone.value.trim();
  
  try {
    // 调用API更新用户信息
    const updatedUser = await apiCall('/users/me', {
      method: 'PATCH',
      body: JSON.stringify({
        phone: newPhone
      })
    });
    
    if (updatedUser) {
      currentUser = updatedUser;
      updateUserInfo();
      hideSettingsModal();
      showSuccess('Settings updated successfully');
    }
  } catch (error) {
    console.error('Failed to update settings:', error);
    showError('Failed to update settings');
  }
}

// ===== 登出功能 =====
function logout(event) {
  try { event && event.preventDefault && event.preventDefault(); } catch {}
  // 清理所有可能的认证相关缓存
  try { clearAuthToken(); } catch {}
  try { sessionStorage.removeItem('loginState'); } catch {}
  try { sessionStorage.removeItem('authState'); } catch {}
  try { sessionStorage.removeItem('authToken'); } catch {}
  
  // 更可靠的跳转（不保留历史）到主页
  try { window.location.replace('/index.html'); } catch {}
  // 兜底：如果 replace 被阻止，再尝试一次
  setTimeout(() => {
    if (typeof window !== 'undefined' && window.location.pathname.indexOf('index.html') === -1) {
      window.location.href = '/index.html';
    }
  }, 200);
}

// ===== 事件监听器 =====
function setupEventListeners() {
  // QR 全屏查看（打开新窗口至公开扫二维码地址）
  // QR 码按钮已移除

  // 修改邮箱（占位）
  const changeEmailBtn = $('#btnChangeEmail');
  
  // 注意：直接绑定可能在某些情况下失败，所以我们主要依赖全局事件委托
  if (changeEmailBtn) {
    changeEmailBtn.addEventListener('click', openEmailEditor);
  }

  // 内联修改手机号
  const startPhoneBtn = $('#btnStartPhoneChange');
  if (startPhoneBtn) startPhoneBtn.addEventListener('click', () => {
    // 清除之前的手机号修改状态
    clearPhoneChangeState();
    resetPhoneEditorUI(false);
    
    // 隐藏profile card，显示phone change card
    const profileCard = document.getElementById('profileCard');
    const phoneChangeCard = document.getElementById('phoneChangeCard');
    const emailChangeCard = document.getElementById('emailChangeCard');
    
    if (profileCard) profileCard.style.display = 'none';
    if (emailChangeCard) emailChangeCard.style.display = 'none';
    
    if (phoneChangeCard) {
      phoneChangeCard.style.display = 'block';
      // 显示当前手机号信息
      const currentPhoneDisplay = document.getElementById('currentPhoneDisplay');
      if (currentPhoneDisplay && currentUser) {
        currentPhoneDisplay.textContent = formatPhoneNumber(currentUser.phone) || 'Not provided';
      }
      // 初始化Turnstile组件
      setTimeout(() => {
        initPortalTurnstile('phone');
      }, 100);
      // 初始化带区号选择与格式化的输入
      initPortalPhoneInput();
      setTimeout(() => {
        const el = document.getElementById('newPhoneInput');
        if (el) el.focus();
      }, 50);
    }
  });
  const cancelPhoneBtn = $('#btnCancelPhoneChange');
  if (cancelPhoneBtn) cancelPhoneBtn.addEventListener('click', () => {
    clearPhoneChangeState();
    resetPhoneEditorUI(true);
    // 显示profile card，隐藏change cards
    const profileCard = document.getElementById('profileCard');
    const emailChangeCard = document.getElementById('emailChangeCard');
    const phoneChangeCard = document.getElementById('phoneChangeCard');
    
    if (profileCard) profileCard.style.display = 'block';
    if (emailChangeCard) emailChangeCard.style.display = 'none';
    if (phoneChangeCard) phoneChangeCard.style.display = 'none';
  });
  const sendPhoneBtn = $('#btnSendPhoneCode');
  if (sendPhoneBtn) sendPhoneBtn.addEventListener('click', onPhonePrimaryClick);
  const verifyPhoneBtn = $('#btnVerifyPortalPhone');
  if (verifyPhoneBtn) verifyPhoneBtn.addEventListener('click', onVerifyPortalPhone);
  const backPhoneBtn = $('#btnBackPortalPhone');
  if (backPhoneBtn) backPhoneBtn.addEventListener('click', () => { /* 移除对旧验证码区域的引用 */ });

  // 邮箱变更
  const sendEmailBtn = $('#btnSendEmailCode');
  if (sendEmailBtn) sendEmailBtn.addEventListener('click', onEmailPrimaryClick);
  const verifyEmailBtn = $('#btnVerifyPortalEmail');
  if (verifyEmailBtn) verifyEmailBtn.addEventListener('click', onVerifyPortalEmail);
  const backEmailBtn = $('#btnBackPortalEmail');
  if (backEmailBtn) backEmailBtn.addEventListener('click', () => { const cs = $('#portalEmailCodeSection'); if (cs) cs.style.display = 'none'; });
  const cancelEmailBtn = $('#btnCancelEmailChange');
  if (cancelEmailBtn) cancelEmailBtn.addEventListener('click', () => {
    console.log('Cancel email change clicked');
    isInEmailChangeFlow = false; // 重置邮箱修改流程状态
    clearEmailChangeState();
    resetEmailEditorUI(true);
    // 显示profile card，隐藏change cards
    const profileCard = document.getElementById('profileCard');
    const emailChangeCard = document.getElementById('emailChangeCard');
    const phoneChangeCard = document.getElementById('phoneChangeCard');
    
    if (profileCard) profileCard.style.display = 'block';
    if (emailChangeCard) emailChangeCard.style.display = 'none';
    if (phoneChangeCard) phoneChangeCard.style.display = 'none';
  });

  // Badges 管理
  const toggleEditModeBtn = $('#btnToggleEditMode');
  if (toggleEditModeBtn) toggleEditModeBtn.addEventListener('click', toggleEditMode);
  
  const addBadgeBtn = $('#btnAddBadge');
  if (addBadgeBtn) addBadgeBtn.addEventListener('click', addNewBadge);
  
  const saveBadgesBtn = $('#btnSaveBadges');
  if (saveBadgesBtn) saveBadgesBtn.addEventListener('click', saveBadges);
  
  const cancelEditBtn = $('#btnCancelEdit');
  if (cancelEditBtn) cancelEditBtn.addEventListener('click', cancelEdit);

  // 续费相关按钮
  const renewMembershipBtn = $('#btnRenewMembership');
  if (renewMembershipBtn) {
    console.log('Renewal button found, adding event listener');
    renewMembershipBtn.addEventListener('click', showRenewalModal);
  } else {
    console.error('Renewal button not found!');
  }
  
  const makeDonationBtn = $('#btnMakeDonation');
  if (makeDonationBtn) makeDonationBtn.addEventListener('click', showDonationModal);

  // 全局兜底：若局部监听未绑定成功，使用事件委托捕获按钮点击
  try {
    document.addEventListener('click', (e) => {
      // Start phone change (delegation)
      const phoneBtn = e.target && (e.target.closest ? e.target.closest('#btnStartPhoneChange') : null);
      if (phoneBtn) {
        e.preventDefault();
        // 清除之前的手机号修改状态
        clearPhoneChangeState();
        resetPhoneEditorUI(false);
        
        // 隐藏profile card，显示phone change card
        const profileCard = document.getElementById('profileCard');
        const phoneChangeCard = document.getElementById('phoneChangeCard');
        const emailChangeCard = document.getElementById('emailChangeCard');
        
        if (profileCard) profileCard.style.display = 'none';
        if (emailChangeCard) emailChangeCard.style.display = 'none';
        
        if (phoneChangeCard) {
          phoneChangeCard.style.display = 'block';
          // 显示当前手机号信息
          const currentPhoneDisplay = document.getElementById('currentPhoneDisplay');
          if (currentPhoneDisplay && currentUser) {
            currentPhoneDisplay.textContent = formatPhoneNumber(currentUser.phone) || 'Not provided';
          }
          // 初始化Turnstile组件
          setTimeout(() => {
            initPortalTurnstile('phone');
          }, 100);
          initPortalPhoneInput();
          setTimeout(() => { const el = document.getElementById('newPhoneInput'); if (el) el.focus(); }, 50);
        }
      }
      const target = e.target && (e.target.closest ? e.target.closest('#btnChangeEmail') : null);
      if (target) {
        console.log('Change email button clicked via event delegation');
        e.preventDefault();
        openEmailEditor();
      }
      
      // 添加Cancel按钮的事件委托
      const cancelTarget = e.target && (e.target.closest ? e.target.closest('#btnCancelEmailChange') : null);
      if (cancelTarget) {
        console.log('Cancel email button clicked via event delegation');
        e.preventDefault();
        isInEmailChangeFlow = false;
        clearEmailChangeState();
        resetEmailEditorUI(true);
        // 显示profile card，隐藏change cards
        const profileCard = document.getElementById('profileCard');
        const emailChangeCard = document.getElementById('emailChangeCard');
        const phoneChangeCard = document.getElementById('phoneChangeCard');
        
        if (profileCard) profileCard.style.display = 'block';
        if (emailChangeCard) emailChangeCard.style.display = 'none';
        if (phoneChangeCard) phoneChangeCard.style.display = 'none';
      }
      
      // 添加Send Code按钮的事件委托
      const sendCodeTarget = e.target && (e.target.closest ? e.target.closest('#btnSendEmailCode') : null);
      if (sendCodeTarget) {
        console.log('Send Code button clicked via event delegation');
        e.preventDefault();
        e.stopPropagation(); // 阻止事件冒泡
        e.stopImmediatePropagation(); // 阻止其他事件处理器
        console.log('Preventing default behavior and propagation');
        
        // 延迟执行，确保事件完全处理完毕
        setTimeout(() => {
          console.log('Executing onEmailPrimaryClick after delay');
          onEmailPrimaryClick();
        }, 10);
        
        return false; // 确保不执行默认行为
      }
      
      // 添加Verify按钮的事件委托
      const verifyTarget = e.target && (e.target.closest ? e.target.closest('#btnVerifyPortalEmail') : null);
      if (verifyTarget) {
        console.log('Verify button clicked via event delegation');
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        console.log('Preventing default behavior and propagation for verify');
        
        setTimeout(() => {
          console.log('Executing onVerifyPortalEmail after delay');
          onVerifyPortalEmail();
        }, 10);
        
        return false;
      }

      // Phone: Send Code 按钮事件委托
      const phoneSend = e.target && (e.target.closest ? e.target.closest('#btnSendPhoneCode') : null);
      if (phoneSend) {
        console.log('Phone Send Code via delegation');
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        setTimeout(() => { onPhonePrimaryClick(); }, 10);
        return false;
      }

      // Phone: Cancel 按钮事件委托
      const phoneCancel = e.target && (e.target.closest ? e.target.closest('#btnCancelPhoneChange') : null);
      if (phoneCancel) {
        console.log('Phone Cancel via delegation');
        e.preventDefault();
        clearPhoneChangeState();
        resetPhoneEditorUI(true);
        // 显示profile card，隐藏change cards
        const profileCard = document.getElementById('profileCard');
        const emailChangeCard = document.getElementById('emailChangeCard');
        const phoneChangeCard = document.getElementById('phoneChangeCard');
        
        if (profileCard) profileCard.style.display = 'block';
        if (emailChangeCard) emailChangeCard.style.display = 'none';
        if (phoneChangeCard) phoneChangeCard.style.display = 'none';
        return false;
      }

      // Renewal 按钮事件委托
      const renewalBtn = e.target && (e.target.closest ? e.target.closest('#btnRenewMembership') : null);
      if (renewalBtn) {
        console.log('Renewal button clicked via delegation');
        e.preventDefault();
        e.stopPropagation();
        showRenewalModal();
        return false;
      }
    }, { capture: true });
  } catch {}


  
  // 登出
  const btnLogout = $('#btnLogout');
  if (btnLogout) {
    btnLogout.addEventListener('click', logout);
  }

  // 删除账号
  const del = $('#btnDeleteAccount');
  if (del) del.addEventListener('click', onDeleteAccount);

  // 删除账号事件（已简化为直接确认，无需模态框）

  // 兜底委托：确保删除按钮在任何情况下都可触发
  try {
    document.addEventListener('click', (e) => {
      const delTarget = e.target && (e.target.closest ? e.target.closest('#btnDeleteAccount') : null);
      if (delTarget) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        onDeleteAccount();
        return false;
      }
    }, { capture: true });
  } catch {}
}

async function onSendPortalPhone() {
  console.log('onSendPortalPhone function called!');
  
  // 使用原生DOM方法查找元素
  const input = document.getElementById('newPhoneInput');
  const err = document.getElementById('errPortalPhone');
  const btn = document.getElementById('btnSendPhoneCode');
  
  console.log('Phone elements found:', { input, err, btn });
  
  if (!input) return;
  // 使用 intl-tel-input 校验并取 E164
  initPortalPhoneInput();
  const e164 = getPortalE164();
  console.log('Phone E164 result:', e164);
  
  if (!e164) {
    console.error('Failed to get E164 phone number. Input element:', input);
    console.error('Input _iti property:', input._iti);
    console.error('Window intlTelInput:', window.intlTelInput);
    if (err) err.textContent = 'Please enter a valid phone number';
    return;
  }
  
  if (err) err.textContent = '';
  
  // 设置当前操作类型
  currentTurnstileOperation = 'phone';
  
  // 禁用按钮直到Turnstile验证完成
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Verifying...';
  }
  
  try {
    // 等待Turnstile验证
    updatePortalTurnstileMessage('Verifying security...', '#3b82f6');
    const turnstileToken = await waitForPortalTurnstileToken(10000);
    if (!turnstileToken) {
      throw new Error('Security verification required');
    }
    
    // 恢复按钮状态
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Send Code';
    }
    
    // 与后端 tickets 路由对齐：直接创建变更手机号的 ticket
    const res = await portalApiFetch('/tickets', {
      method: 'POST',
      body: JSON.stringify({
        channel: 'sms',
        destination: e164,
        purpose: 'change_phone',
        subject_id: currentUser?.user_id
      })
    });
    
    if (res && res.ticket_id) {
      portalState.phoneTxId = res.ticket_id;
      portalState.newPhone = e164;
      savePortalChangeState();
      // 切换为验证码输入阶段（单输入模式，参照 Email）
      const inputEl = document.getElementById('newPhoneInput');
      const label = document.getElementById('phoneLabel');
      const primary = document.getElementById('btnSendPhoneCode');
      
      console.log('Phone transformation elements:', { inputEl, label, primary });
      
      if (inputEl && inputEl._iti) { try { inputEl._iti.destroy(); } catch {} delete inputEl._iti; delete inputEl.dataset.itiReady; }
      if (label) label.textContent = 'Enter 6-digit code';
      if (inputEl) {
        inputEl.type = 'text';
        inputEl.maxLength = 6;
        inputEl.pattern = '[0-9]*';
        inputEl.inputMode = 'numeric';
        inputEl.placeholder = 'Enter 6-digit code';
        inputEl.value = '';
        inputEl.classList.remove('tel-invalid');
        inputEl.focus();
      }
      if (primary) {
        primary.textContent = 'Verify Code';
        // 不改变按钮ID，保持和email一致
      }
      
      // 隐藏turnstile组件，因为验证码验证不需要turnstile
      const turnstileContainer = document.querySelector('#phoneChangeCard .turnstile-container');
      if (turnstileContainer) {
        turnstileContainer.style.display = 'none';
      }
      
      console.log('Phone transformation completed. New input properties:', {
        type: inputEl?.type,
        maxLength: inputEl?.maxLength,
        placeholder: inputEl?.placeholder,
        value: inputEl?.value
      });
      console.log('New label text:', label?.textContent);
      console.log('New button text and id:', primary?.textContent, primary?.id);
      
      // 移除状态提示，保持和email一致
    }
  } catch (error) {
    console.error('Failed to send phone code:', error);
    // 确保错误信息是字符串格式
    let errorMessage = 'Failed to send code';
    if (error && typeof error === 'object') {
      errorMessage = error.message || error.detail || error.title || JSON.stringify(error);
    } else if (error) {
      errorMessage = error.toString();
    }
    if (err) err.textContent = errorMessage;
  }
}

async function onSendPortalEmail() {
  console.log('onSendPortalEmail function called!');
  
  // 防止在邮箱修改流程中的任何跳转
  if (isInEmailChangeFlow) {
    console.log('In email change flow, preventing any redirects');
  }
  
  // 使用多种方式查找元素
  const input = document.getElementById('newEmailInput') || document.querySelector('#newEmailInput');
  const err = document.getElementById('errPortalEmail') || document.querySelector('#errPortalEmail');
  const btn = document.getElementById('btnSendEmailCode') || document.querySelector('#btnSendEmailCode');
  
  console.log('Found elements:', { input, err, btn });
  
  // 检查整个文档中是否有这些元素
  console.log('All elements with newEmailInput:', document.querySelectorAll('[id*="newEmail"]'));
  console.log('All elements with btnSendEmailCode:', document.querySelectorAll('[id*="btnSend"]'));
  
  if (!input) {
    console.error('Input element not found!');
    // 尝试延迟查找
    setTimeout(() => {
      const delayedInput = document.getElementById('newEmailInput');
      console.log('Delayed input search:', delayedInput);
    }, 100);
    return;
  }
  const email = input.value.trim();
  console.log('Email value:', email);
  
  if (!email) {
    if (err) err.textContent = 'Please enter your new email address';
    console.log('No email entered');
    return;
  }
  if (!isValidEmail(email)) {
    if (err) err.textContent = 'Please enter a valid email address';
    console.log('Invalid email format');
    return;
  }
  if (err) err.textContent = '';
  console.log('Sending email code to:', email);
  
  // 设置当前操作类型
  currentTurnstileOperation = 'email';
  console.log('Set currentTurnstileOperation to:', currentTurnstileOperation);
  
  // 禁用按钮直到Turnstile验证完成
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Verifying...';
  }
  
  // 检查Turnstile组件是否存在
  const turnstileElement = document.querySelector('#emailChangeCard .cf-turnstile');
  console.log('Turnstile element found:', !!turnstileElement);
  console.log('Current portalTurnstileToken:', portalTurnstileToken);
  
  try {
    // 等待Turnstile验证
    updatePortalTurnstileMessage('Verifying security...', '#3b82f6');
    const turnstileToken = await waitForPortalTurnstileToken(10000);
    console.log('Turnstile token received:', !!turnstileToken, 'Length:', turnstileToken?.length);
    if (!turnstileToken) {
      throw new Error('Security verification required');
    }
    
    // 恢复按钮状态
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Send Code';
    }
    
    const res = await portalApiFetch('/tickets', {
      method: 'POST',
      body: JSON.stringify({
        channel: 'email',
        destination: email,
        purpose: 'change_email',
        subject_id: currentUser?.user_id
      })
    });
    console.log('API response:', res);
    
    if (res && res.ticket_id) {
      portalState.emailTxId = res.ticket_id;
      portalState.newEmail = email;
      portalState.emailResendExpiry = res.cooldown_sec ? (Date.now() + res.cooldown_sec * 1000) : 0;
      savePortalChangeState();
      
      // 转换输入框为验证码输入
      // 转换输入框为验证码输入
      const input = document.getElementById('newEmailInput');
      const label = document.getElementById('emailLabel');
      const sendBtn = document.getElementById('btnSendEmailCode');
      
      console.log('Found elements for transformation:', { input, label, sendBtn });
      
      if (input && label && sendBtn) {
        console.log('Transforming input field to code input...');
        // 保存原始邮箱值
        input.dataset.originalEmail = email;
        
        // 转换输入框为验证码输入
        input.type = 'text';
        input.maxLength = 6;
        input.pattern = '[0-9]*';
        input.inputMode = 'numeric';
        input.placeholder = 'Enter 6-digit code';
        input.value = '';
        
        // 更新标签和按钮
        label.textContent = 'Enter 6-digit code';
        sendBtn.textContent = 'Verify Code';
        
        // 隐藏turnstile组件，因为验证码验证不需要turnstile
        const turnstileContainer = document.querySelector('#emailChangeCard .turnstile-container');
        if (turnstileContainer) {
          turnstileContainer.style.display = 'none';
        }
        
        console.log('Transformation completed. New input properties:', {
          type: input.type,
          maxLength: input.maxLength,
          placeholder: input.placeholder,
          value: input.value
        });
        console.log('New label text:', label.textContent);
        console.log('New button text and id:', sendBtn.textContent, sendBtn.id);
        
        // 聚焦到输入框
        input.focus();
      } else {
        console.error('Some elements not found for transformation:', { input, label, sendBtn });
      }
      
      // 不启用60秒重发倒计时（按你的新设计）
    }
  } catch (error) {
    console.error('Failed to send email code:', error);
    // 确保错误信息是字符串格式
    let errorMessage = 'Failed to send code';
    if (error && typeof error === 'object') {
      errorMessage = error.message || error.detail || error.title || JSON.stringify(error);
    } else if (error) {
      errorMessage = error.toString();
    }
    if (err) err.textContent = errorMessage;
  }
}

// 主按钮根据阶段切换：发送 或 验证
function onEmailPrimaryClick() {
  if (portalState.emailTxId) {
    return onVerifyPortalEmail();
  }
  return onSendPortalEmail();
}

// Phone 主按钮：发送 或 验证
function onPhonePrimaryClick() {
  console.log('onPhonePrimaryClick called, portalState.phoneTxId:', portalState.phoneTxId);
  if (portalState.phoneTxId) {
    console.log('Phone ticket exists, calling onVerifyPortalPhone');
    return onVerifyPortalPhone();
  }
  console.log('No phone ticket, calling onSendPortalPhone');
  return onSendPortalPhone();
}

async function onVerifyPortalPhone() {
  // 使用原生DOM方法查找元素
  const err = document.getElementById('errPortalPhone');
  const btn = document.getElementById('btnSendPhoneCode'); // 只查找原始按钮ID，保持和email一致
  
  if (!portalState.phoneTxId) { 
    if (err) err.textContent = 'Please send the code first'; 
    return; 
  }
  
  // 单输入读取6位验证码
  let code = '';
  const codeInput = document.getElementById('newPhoneInput');
  if (codeInput) code = (codeInput.value || '').replace(/\D/g, '');
  if (code.length !== 6) { 
    if (err) err.textContent = 'Please enter the complete 6-digit code'; 
    return; 
  }
  
  if (btn) btn.textContent = 'Verifying...';
  if (btn) btn.disabled = true;
  
  try {
    console.log('Verifying phone code:', code);
    // 第一步：确认验证码 (无需Turnstile，验证码本身就是安全机制)
    const confirmRes = await apiCall(`/tickets/${portalState.phoneTxId}/confirm`, {
      method: 'POST',
      body: JSON.stringify({ code })
    });
    
    console.log('Phone code confirmation response:', confirmRes);
    
    if (confirmRes && confirmRes.proof_token) {
      // 第二步：更新手机号
      const updateRes = await apiCall('/contacts/phone', {
        method: 'PATCH',
        body: JSON.stringify({ proof_token: confirmRes.proof_token })
      });
      
      console.log('Phone update response:', updateRes);
      
      if (updateRes) {
        await loadUserData();
        clearPhoneChangeState();
        resetPhoneEditorUI(true);
      }
    }
  } catch (error) {
    console.error('Failed to verify phone code:', error);
    if (err) err.textContent = 'The code is incorrect or expired.';
  } finally {
    if (btn) {
      btn.textContent = 'Verify Code';
      btn.disabled = false;
    }
  }
}

async function onVerifyPortalEmail() {
  const err = $('#errPortalEmail');
  const btn = document.getElementById('btnSendEmailCode');
  if (!portalState.emailTxId) { if (err) err.textContent = 'Please send the code first'; return; }
  // 从单个输入框读取验证码
  const input = document.getElementById('newEmailInput');
  const code = input ? (input.value || '').replace(/\D/g, '') : '';
  if (code.length !== 6) { if (err) err.textContent = 'Please enter the complete 6-digit code'; return; }
  if (btn) { btn.textContent = 'Verifying...'; btn.disabled = true; }
  try {
    // 1) confirm ticket (无需Turnstile，验证码本身就是安全机制)
    const confirmRes = await apiCall(`/tickets/${portalState.emailTxId}/confirm`, {
      method: 'POST',
      body: JSON.stringify({ code })
    });
    if (confirmRes && confirmRes.proof_token) {
      // 2) patch contact email
      const updateRes = await apiCall('/contacts/email', {
        method: 'PATCH',
        body: JSON.stringify({ proof_token: confirmRes.proof_token })
      });
      if (updateRes) {
        await loadUserData();
        // reset UI + 清持久化
        clearEmailChangeState();
        resetEmailEditorUI(true);
        if (err) err.textContent = '';
        // Success toast removed; profile reflects change after reload above
      }
    }
  } catch (error) {
    console.error('Failed to verify email code:', error);
    if (err) err.textContent = 'The code is incorrect or expired.';
  } finally {
    if (btn) { btn.textContent = 'Verify Code'; btn.disabled = false; }
  }
}

async function onDeleteAccount() {
  // 直接确认删除，不需要Turnstile验证
  const ok = confirm('Delete your account? This action is permanent.');
  if (!ok) return;
  await performDeleteAccount();
}

async function performDeleteAccount() {
  // 按钮禁用/文案切换，避免重复点击
  const btn = document.getElementById('btnConfirmDelete') || document.getElementById('btnDeleteAccount');
  const oldText = btn ? btn.textContent : '';
  
  if (btn) { 
    btn.disabled = true; 
    btn.textContent = 'Deleting...'; 
  }
  
  try { 
    // 直接删除账户，不需要Turnstile验证
    await apiCall('/users/me', { method: 'DELETE' }); 
    // 删除成功后清理并跳转
    clearAuthToken(); 
    try { sessionStorage.removeItem('authState'); } catch {}
    try { sessionStorage.removeItem('loginState'); } catch {}
    try { sessionStorage.removeItem('authToken'); } catch {}
    redirectToAuth();
  } catch (error) {
    console.error('Failed to delete account:', error);
    alert(error?.message || 'Failed to delete account');
    if (btn) { 
      btn.disabled = false; 
      btn.textContent = oldText || 'Delete Account'; 
    }
  }
}

// ===== 辅助函数 =====
function isValidPhone(phone) {
  // 简单的手机号验证，可以根据需要调整
  const cleaned = phone.replace(/\D/g, '');
  return cleaned.length >= 10 && cleaned.length <= 15;
}

// ===== Portal Phone (intl-tel-input) =====
function resetPhoneEditorUI(hideSection = true) {
  const label = document.getElementById('phoneLabel');
  const input = document.getElementById('newPhoneInput');
  const btn = document.getElementById('btnSendPhoneCode'); // 只查找原始按钮ID，保持和email一致
  if (input && input._iti) {
    try { input._iti.destroy(); } catch {}
    delete input._iti;
    delete input.dataset.itiReady;
  }
  if (input) {
    input.type = 'tel';
    input.value = '';
    input.classList.remove('tel-invalid');
  }
  if (label) label.textContent = 'New Phone';
  if (btn) {
    btn.textContent = 'Send Code';
    // 不改变按钮ID，保持和email一致
    btn.disabled = false;
  }
  
  // 重新显示turnstile组件，为下次发送验证码做准备
  const turnstileContainer = document.querySelector('#phoneChangeCard .turnstile-container');
  if (turnstileContainer) {
    turnstileContainer.style.display = 'flex';
  }
  
  // 在设置完其他属性后，重新初始化 phone input 并设置 placeholder
  if (input) {
    // 先销毁现有的 intl-tel-input 实例
    if (input._iti) {
      try { input._iti.destroy(); } catch {}
      delete input._iti;
      delete input.dataset.itiReady;
    }
    // 设置 placeholder
    input.placeholder = 'Enter your new phone';
    // 重新初始化 intl-tel-input
    initPortalPhoneInput();
  }
  
  const err = document.getElementById('errPortalPhone'); if (err) err.textContent = '';
  // 移除状态提示，保持和email一致
  if (hideSection) {
    // 显示profile card，隐藏change cards
    const profileCard = document.getElementById('profileCard');
    const emailChangeCard = document.getElementById('emailChangeCard');
    const phoneChangeCard = document.getElementById('phoneChangeCard');
    
    if (profileCard) profileCard.style.display = 'block';
    if (emailChangeCard) emailChangeCard.style.display = 'none';
    if (phoneChangeCard) phoneChangeCard.style.display = 'none';
  }
}
function initPortalPhoneInput() {
  const el = document.getElementById('newPhoneInput');
  if (!el || el.dataset.itiReady) return;
  if (!window.intlTelInput) {
    console.warn('intl-tel-input not loaded for portal phone');
    return;
  }
  try {
    const iti = window.intlTelInput(el, {
      initialCountry: 'us',
      preferredCountries: ['us','cn','gb','ca','au'],
      separateDialCode: true,
      nationalMode: true,
      autoPlaceholder: 'aggressive',
      formatOnDisplay: true,
      utilsScript: 'https://cdnjs.cloudflare.com/ajax/libs/intl-tel-input/17.0.19/js/utils.js'
    });
    el.dataset.itiReady = '1';
    el._iti = iti;

    // 实时格式化与校验
    const validate = () => {
      if (!el._iti) return;
      try {
        const ok = el._iti.isValidNumber();
        if (el.value.trim() === '') { el.classList.remove('tel-invalid'); return; }
        if (ok) el.classList.remove('tel-invalid');
        else el.classList.add('tel-invalid');
      } catch {}
    };
    el.addEventListener('input', () => {
      try {
        if (window.intlTelInputUtils && el._iti) {
          const number = el.value;
          if (number) {
            const data = el._iti.getSelectedCountryData();
            if (data && data.iso2) {
              const formatted = window.intlTelInputUtils.formatNumber(number, data.iso2, window.intlTelInputUtils.numberFormat.NATIONAL);
              if (formatted && formatted !== number) el.value = formatted;
            }
          }
        }
      } catch {}
      validate();
    });
    el.addEventListener('blur', validate);
    el.addEventListener('countrychange', validate);
  } catch (e) {
    console.error('initPortalPhoneInput failed', e);
  }
}

function getPortalE164() {
  const el = document.getElementById('newPhoneInput');
  if (!el || !el._iti) return null;
  try {
    if (window.intlTelInputUtils && window.intlTelInputUtils.numberFormat) {
      return el._iti.getNumber(window.intlTelInputUtils.numberFormat.E164);
    }
    return el._iti.getNumber();
  } catch { return null; }
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function startResendTimer(btn, cooldownSec) {
  if (!btn) return;
  
  let remaining = cooldownSec;
  btn.disabled = true;
  
  const timer = setInterval(() => {
    remaining--;
    if (remaining <= 0) {
      // 根据按钮ID决定恢复的文本
      if (btn.id === 'btnSendEmailCode') {
        btn.textContent = 'Send Code';
      } else if (btn.id === 'btnSendPhoneCode') {
        btn.textContent = 'Send Code';
      } else {
        btn.textContent = 'Send Code';
      }
      btn.disabled = false;
      clearInterval(timer);
    } else {
      btn.textContent = `Resend in ${remaining}s`;
    }
  }, 1000);
}

// 上方已定义了 clearAuthToken / redirectToAuth / isAuthenticated / showNotAuthenticatedMessage

// ===== 徽章保存 =====
async function onSaveBadges() {
  if (!currentUser) return;
  const editor = $('#badgesEditor');
  if (!editor) return;
  let parsed;
  try {
    parsed = JSON.parse(editor.value || '{}');
    if (typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Badges must be a JSON object');
  } catch (e) {
    showError('Invalid JSON: ' + (e.message || 'Parse error'));
    return;
  }
  try {
    const updated = await apiCall('/users/me', {
      method: 'PATCH',
      body: JSON.stringify({ badges: parsed })
    });
    if (updated) {
      currentUser = updated;
      updateBadges();
      showSuccess('Badges saved');
    }
  } catch (e) {
    showError(e.message || 'Failed to save badges');
  }
}

// ===== 初始化 =====
async function initializePortal() {
  
  // 处理支付结果
  handlePaymentResult();
  
  // 检查认证状态，添加重试机制
  let token = getAuthToken();
  
  // 如果token不存在，等待一小段时间后重试（处理注册后的时序问题）
  if (!token) {
    console.log('No token found, waiting 200ms and retrying...');
    await new Promise(resolve => setTimeout(resolve, 200));
    token = getAuthToken();
  }
  
  if (!isAuthenticated()) {
    console.log('Not authenticated, redirecting to login');
    console.log('SessionStorage contents:', {
      authToken: sessionStorage.getItem('authToken'),
      authState: sessionStorage.getItem('authState'),
      loginState: sessionStorage.getItem('loginState')
    });
    // 自动跳转到登录页
    redirectToAuth();
    return;
  }
  
  console.log('User is authenticated, proceeding to load user data...');
  
  // 加载用户数据
  await loadUserData();
  
  // 设置事件监听器（在用户数据加载完成后）
  // 添加一个小延迟确保DOM完全加载
  setTimeout(() => {
    setupEventListeners();
    // 确保电话输入启用国际区号控件（如果用户直接点击了 Change Phone）
    initPortalPhoneInput();
    // 恢复邮箱/手机号变更进行中的状态（防止 Live Server 刷新中断）
    // 首先清除可能过期的状态
    clearExpiredChangeState();
    if (loadPortalChangeState()) {
      // Email 恢复（新的单输入模式）
      if (portalState.emailTxId) {
        const emailSec = document.getElementById('emailChangeCard'); if (emailSec) emailSec.style.display = 'block';
        const phoneSec = document.getElementById('phoneChangeCard'); if (phoneSec) phoneSec.style.display = 'none';
        const label = document.getElementById('emailLabel'); if (label) label.textContent = 'Enter 6-digit code';
        const input = document.getElementById('newEmailInput');
        if (input) {
          input.type = 'text';
          input.maxLength = 6;
          input.pattern = '[0-9]*';
          input.inputMode = 'numeric';
          input.placeholder = 'Enter 6-digit code';
          input.value = '';
        }
        const primary = document.getElementById('btnSendEmailCode'); if (primary) primary.textContent = 'Verify Code';
        const codeSec = document.getElementById('portalEmailCodeSection'); if (codeSec) codeSec.style.display = 'none';
      }
      // Phone 恢复
      if (portalState.phoneTxId) {
        const phoneSec = document.getElementById('phoneChangeCard'); if (phoneSec) phoneSec.style.display = 'block';
        const emailSec = document.getElementById('emailChangeCard'); if (emailSec) emailSec.style.display = 'none';
        // 恢复到验证码阶段（单输入模式）
        const label = document.getElementById('phoneLabel'); if (label) label.textContent = 'Enter 6-digit code';
        const input = document.getElementById('newPhoneInput');
        if (input) {
          if (input._iti) { try { input._iti.destroy(); } catch {} delete input._iti; delete input.dataset.itiReady; }
          input.type = 'text';
          input.maxLength = 6;
          input.pattern = '[0-9]*';
          input.inputMode = 'numeric';
          input.placeholder = 'Enter 6-digit code';
          input.value = '';
        }
        const primary = document.getElementById('btnSendPhoneCode'); if (primary) primary.textContent = 'Verify Code';
        // 移除对旧验证码区域的引用
      }
    }
  }, 100);
  
  // 全局兜底：确保登出按钮点击事件一定能捕获
  try {
    document.addEventListener('click', (e) => {
      const target = e.target && (e.target.closest ? e.target.closest('#btnLogout') : null);
      if (target) {
        logout(e);
      }
    }, { capture: true });
  } catch {}
  
  // Header Member 跳转：已登录去 portal，未登录去 login（与其他页面一致）
  const navMember = document.getElementById('navMember');
  if (navMember) {
    navMember.addEventListener('click', (e) => {
      e.preventDefault();
      if (isAuthenticated()) {
        window.location.href = '/portal.html';
      } else {
        window.location.href = '/auth.html?mode=login';
      }
    });
  }
}

// ===== 页面加载完成后初始化 =====
document.addEventListener('DOMContentLoaded', initializePortal);

// 额外的兜底事件绑定 - 确保续费按钮能工作
window.addEventListener('load', function() {
  const renewalBtn = document.getElementById('btnRenewMembership');
  if (renewalBtn) {
    console.log('Renewal button found on window load, adding event listener');
    renewalBtn.addEventListener('click', function(e) {
      console.log('Renewal button clicked via window load event');
      e.preventDefault();
      showRenewalModal();
    });
  } else {
    console.error('Renewal button not found on window load!');
  }
});

// ===== Badge 工具函数 =====
function getEnchantedUntil(validUntil) {
  if (!validUntil) return 'Not specified';
  
  const today = new Date();
  const validDate = new Date(validUntil);
  
  // 返回今天和valid_until中较早的日期
  const earlierDate = today < validDate ? today : validDate;
  
  return formatDateShort(earlierDate);
}

// ===== Valid Until 颜色工具函数 =====
function getValidUntilWithColor(validUntil) {
  if (!validUntil) return 'N/A';
  
  const today = new Date();
  const validDate = new Date(validUntil);
  today.setHours(0, 0, 0, 0);
  validDate.setHours(0, 0, 0, 0);
  
  const formattedDate = formatDateShort(validDate);
  
  if (validDate >= today) {
    return `<span class="valid">${formattedDate}</span>`;
  } else {
    return `<span class="expired">${formattedDate}</span>`;
  }
}

// ===== Badge Seal 生成函数 =====
function getBadgeSeal(realm) {
  const seals = {
    'north': `
      <svg class="stamp stamp-north" viewBox="0 0 120 120" width="100" height="100">
        <defs>
          <radialGradient id="g-north-badge" cx="50%" cy="50%" r="60%">
            <stop offset="0%" stop-color="#ffffff" stop-opacity=".2"/>
            <stop offset="100%" stop-color="#7BC4FF" stop-opacity=".25"/>
          </radialGradient>
        </defs>
        <circle cx="60" cy="60" r="52" fill="url(#g-north-badge)" stroke="#7BC4FF" stroke-width="4" opacity=".8"/>
        <circle cx="60" cy="60" r="42" fill="none" stroke="#7BC4FF" stroke-width="2" stroke-dasharray="4 6" opacity=".6"/>
        <g stroke="#5AAEFF" stroke-width="3" stroke-linecap="round" opacity=".9">
          <line x1="60" y1="32" x2="60" y2="88"/>
          <line x1="32" y1="60" x2="88" y2="60"/>
          <line x1="40" y1="40" x2="80" y2="80"/>
          <line x1="80" y1="40" x2="40" y2="80"/>
        </g>
      </svg>
    `,
    'tooth': `
      <svg class="stamp stamp-tooth" viewBox="0 0 120 120" width="100" height="100">
        <defs>
          <radialGradient id="g-tooth-badge" cx="50%" cy="50%" r="60%">
            <stop offset="0%" stop-color="#ffffff" stop-opacity=".2"/>
            <stop offset="100%" stop-color="#D5B8FF" stop-opacity=".25"/>
          </radialGradient>
        </defs>
        <circle cx="60" cy="60" r="52" fill="url(#g-tooth-badge)" stroke="#C39BFF" stroke-width="4" opacity=".85"/>
        <circle cx="60" cy="60" r="42" fill="none" stroke="#C39BFF" stroke-width="2" stroke-dasharray="3 5" opacity=".6"/>
        <g fill="#B285FF" opacity=".9">
          <path d="M60 42 l3 6 6 3 -6 3 -3 6 -3-6 -6-3 6-3z"/>
          <path d="M86 58 l2 4 4 2 -4 2 -2 4 -2-4 -4-2 4-2z"/>
          <path d="M34 58 l2 4 4 2 -4 2 -2 4 -2-4 -4-2 4-2z"/>
          <path d="M60 78 l2 4 4 2 -4 2 -2 4 -2-4 -4-2 4-2z"/>
        </g>
      </svg>
    `,
    'bunny': `
      <svg class="stamp stamp-bunny" viewBox="0 0 120 120" width="100" height="100">
        <defs>
          <radialGradient id="g-bunny-badge" cx="50%" cy="50%" r="60%">
            <stop offset="0%" stop-color="#ffffff" stop-opacity=".2"/>
            <stop offset="100%" stop-color="#9BE7B0" stop-opacity=".25"/>
          </radialGradient>
        </defs>
        <circle cx="60" cy="60" r="52" fill="url(#g-bunny-badge)" stroke="#65D08A" stroke-width="4" opacity=".85"/>
        <circle cx="60" cy="60" r="42" fill="none" stroke="#65D08A" stroke-width="2" stroke-dasharray="6 6" opacity=".55"/>
        <g fill="#49C27A" opacity=".9">
          <circle cx="60" cy="66" r="12"/>
          <circle cx="48" cy="50" r="5"/>
          <circle cx="60" cy="46" r="5"/>
          <circle cx="72" cy="50" r="5"/>
        </g>
      </svg>
    `
  };
  
  return seals[realm] || seals['north'];
}

// ===== 续费功能 =====
function updateRenewalInfo() {
  if (!currentUser) return;

  const validUntilElement = $('#renewalValidUntil');
  const statusElement = $('#renewalStatus');

  if (validUntilElement) {
    validUntilElement.textContent = formatDateShort(currentUser.valid_until) || 'Not specified';
  }

  if (statusElement) {
    if (currentUser.valid_until) {
      const validUntilDate = new Date(currentUser.valid_until);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      validUntilDate.setHours(0, 0, 0, 0);
      
      if (validUntilDate >= today) {
        statusElement.textContent = 'Active';
        statusElement.className = 'validity-status active';
      } else {
        statusElement.textContent = 'Expired';
        statusElement.className = 'validity-status expired';
      }
    } else {
      statusElement.textContent = 'No membership';
      statusElement.className = 'validity-status inactive';
    }
  }
}

async function loadPurchaseHistory() {
  console.log('Current user:', currentUser);
  
  if (!currentUser) {
    console.log('No current user, skipping purchase history load');
    return;
  }

  const historyLoading = $('#historyLoading');
  const noHistory = $('#noHistory');
  const historyList = $('#historyList');

  console.log('History elements found:', {
    historyLoading: !!historyLoading,
    noHistory: !!noHistory,
    historyList: !!historyList
  });

  if (historyLoading) historyLoading.style.display = 'block';
  if (noHistory) noHistory.style.display = 'none';

  try {
    console.log('Loading purchase history from API...');
    
    // 调用API获取购买历史
    const response = await portalApiFetch('/api/payment/history', {
      method: 'GET'
    });
    
    console.log('Purchase history API response:', response);
    
    if (historyLoading) historyLoading.style.display = 'none';
    
    if (response.history && response.history.length > 0) {
      console.log('Displaying purchase history with', response.history.length, 'items');
      displayPurchaseHistory(response.history);
    } else {
      console.log('No purchase history found, showing no history message');
      if (noHistory) noHistory.style.display = 'block';
    }
  } catch (error) {
    console.error('Failed to load purchase history:', error);
    if (historyLoading) historyLoading.style.display = 'none';
    if (noHistory) noHistory.style.display = 'block';
  }
}

function displayPurchaseHistory(history) {
  console.log('History data:', history);
  
  const historyList = $('#historyList');
  if (!historyList) {
    console.error('History list element not found!');
    return;
  }

  console.log('History list element found, clearing content');
  // 清空现有内容
  historyList.innerHTML = '';

  // 创建表格结构
  const table = document.createElement('div');
  table.className = 'history-table';
  
  // 表头
  const header = document.createElement('div');
  header.className = 'history-header';
  header.innerHTML = `
    <div class="history-header-date">Date</div>
    <div class="history-header-type">Type</div>
    <div class="history-header-amount">Amount</div>
    <div class="history-header-status">Status</div>
  `;
  table.appendChild(header);

  console.log('Creating history items for', history.length, 'transactions');
  history.forEach((transaction, index) => {
    console.log(`Creating item ${index + 1}:`, transaction);
    const historyItem = document.createElement('div');
    historyItem.className = 'history-item';
    
    // 状态样式
    const statusClass = transaction.status === 'Completed' ? 'status-completed' : 'status-pending';
    const statusText = transaction.status === 'Completed' ? '✓ Completed' : '⏳ Pending';
    
    historyItem.innerHTML = `
      <div class="history-item-date">${formatDate(transaction.date)}</div>
      <div class="history-item-type">${transaction.type}</div>
      <div class="history-item-amount">${transaction.amount}</div>
      <div class="history-item-status ${statusClass}">${statusText}</div>
    `;
    table.appendChild(historyItem);
  });
  
  historyList.appendChild(table);
  console.log('History table created and appended to DOM');
}

async function showRenewalModal() {
  console.log('Current user:', currentUser);
  console.log('Auth token exists:', !!getAuthToken());
  
  const renewBtn = document.getElementById('btnRenewMembership');
  
  try {
    // 设置加载状态 - 立即提供视觉反馈
    if (renewBtn) {
      renewBtn.disabled = true;
      renewBtn.classList.add('processing');
      
      // 创建loading动画
      const originalText = renewBtn.textContent;
      renewBtn.innerHTML = `
        <span class="loading-spinner"></span>
        <span class="loading-text">Creating Payment Session...</span>
      `;
      
      // 存储原始文本以便恢复
      renewBtn.dataset.originalText = originalText;
    }
    
    console.log('Calling /api/payment/renewal...');
    
    // 创建带超时的请求
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15秒超时
    
    const data = await portalApiFetch('/api/payment/renewal', {
      method: 'POST',
      body: JSON.stringify({}),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    console.log('Renewal API response:', data);
    
    if (data?.checkout_url) {
      console.log('Redirecting to Stripe:', data.checkout_url);
      
      // 更新按钮状态为即将跳转
      if (renewBtn) {
        renewBtn.innerHTML = `
          <span class="loading-spinner"></span>
          <span class="loading-text">Redirecting to Payment...</span>
        `;
      }
      
      // 短暂延迟让用户看到状态变化
      setTimeout(() => {
        window.location.href = data.checkout_url;
      }, 500);
    } else {
      throw new Error('Invalid response from payment service');
    }
  } catch (error) {
    console.error('Renewal error:', error);
    
    // 根据错误类型显示不同的消息
    let errorMessage = 'Failed to start renewal: ';
    if (error.name === 'AbortError') {
      errorMessage += 'Request timed out. Please try again.';
    } else if (error.message.includes('timeout')) {
      errorMessage += 'Request timed out. Please try again.';
    } else {
      errorMessage += error.message;
    }
    
    showError(errorMessage);
    
    // 恢复按钮状态
    if (renewBtn) {
      renewBtn.disabled = false;
      renewBtn.classList.remove('processing');
      renewBtn.textContent = renewBtn.dataset.originalText || 'RENEW YOUR ENCHANTMENT';
    }
  }
}

function showDonationModal() {
  // 显示捐赠金额输入模态框
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-content donation-modal">
      <div class="modal-header">
        <h3>Share a Gift of Kindness</h3>
        <button class="modal-close" type="button">&times;</button>
      </div>
      <div class="modal-body">
        <p>Any amount you give will help our guild shine brighter.</p>
        <div class="donation-amount-section">
          <label for="donationAmount">Donation Amount (USD)</label>
          <div class="donation-input-group">
            <span class="currency-symbol">$</span>
            <input type="number" id="donationAmount" min="1" step="0.01" placeholder="10.00" value="10.00">
          </div>
          <div class="donation-presets">
            <button class="preset-btn" data-amount="5">$5</button>
            <button class="preset-btn" data-amount="10">$10</button>
            <button class="preset-btn" data-amount="25">$25</button>
            <button class="preset-btn" data-amount="50">$50</button>
            <button class="preset-btn" data-amount="100">$100</button>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn secondary" id="cancelDonation" type="button">Cancel</button>
        <button class="btn primary" id="confirmDonation" type="button">Continue to Payment</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // 绑定事件
  const amountInput = modal.querySelector('#donationAmount');
  const presetBtns = modal.querySelectorAll('.preset-btn');
  const cancelBtn = modal.querySelector('#cancelDonation');
  const confirmBtn = modal.querySelector('#confirmDonation');
  const closeBtn = modal.querySelector('.modal-close');
  
  // 预设金额按钮
  presetBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      presetBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      amountInput.value = btn.dataset.amount;
    });
  });
  
  // 取消按钮
  cancelBtn.addEventListener('click', () => {
    document.body.removeChild(modal);
  });
  
  closeBtn.addEventListener('click', () => {
    document.body.removeChild(modal);
  });
  
  // 确认按钮
  confirmBtn.addEventListener('click', async () => {
    const amount = parseFloat(amountInput.value);
    if (!amount || amount < 1) {
      showError('Please enter a valid amount (minimum $1)');
      return;
    }
    
    try {
      showLoading('Creating donation session...');
      document.body.removeChild(modal);
      
      const data = await portalApiFetch('/api/payment/donation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: Math.round(amount * 100) // 转换为美分
        })
      });
      
      if (data.checkout_url) {
        // 重定向到Stripe Checkout
        window.location.href = data.checkout_url;
      } else {
        showError('Failed to create donation session');
      }
    } catch (error) {
      console.error('Donation error:', error);
      showError('Failed to start donation process');
    }
  });
  
  // 默认选中$10
  modal.querySelector('[data-amount="10"]').click();
}

// 处理支付结果
async function handlePaymentResult() {
  const urlParams = new URLSearchParams(window.location.search);
  const sessionId = urlParams.get('session_id');
  const renewal = urlParams.get('renewal');
  const donation = urlParams.get('donation');
  
  // 优先使用 session_id 进行验证（更安全）
  if (sessionId) {
    try {
      console.log('Verifying payment session:', sessionId);
      // 验证会话状态
      const result = await apiCall(`/api/payment/verify-session/${sessionId}`);
      console.log('Payment verification result:', result);
      
      if (result.status === 'complete') {
        showSuccess('Payment successful! Your membership has been extended.');
        // 延迟刷新用户数据，避免在支付验证过程中出现问题
        setTimeout(() => {
          loadUserData();
        }, 1000);
      } else if (result.status === 'cancelled') {
        showError('Payment was cancelled.');
      } else {
        showError('Payment verification failed.');
      }
    } catch (error) {
      console.error('Payment verification error:', error);
      showError('Payment verification failed: ' + error.message);
      // 支付验证失败时不要刷新用户数据，避免触发重定向
    }
    // 清除URL参数
    window.history.replaceState({}, document.title, window.location.pathname);
  }
  // 保留旧的URL参数处理作为后备
  else if (renewal === 'success') {
    showSuccess('Renewal successful! Your membership has been extended.');
    window.history.replaceState({}, document.title, window.location.pathname);
    loadUserData();
  } else if (renewal === 'cancelled') {
    showError('Renewal was cancelled.');
    window.history.replaceState({}, document.title, window.location.pathname);
  } else if (donation === 'success') {
    showSuccess('Thank you for your generous donation!');
    window.history.replaceState({}, document.title, window.location.pathname);
  } else if (donation === 'cancelled') {
    showError('Donation was cancelled.');
    window.history.replaceState({}, document.title, window.location.pathname);
  }
}

// ===== 管理员界面 =====
function showAdminInterface() {
  
  // 隐藏普通用户界面 - 隐藏所有section
  const infoSection = document.getElementById('infoSection');
  const badgesSection = document.getElementById('badgesSection');
  const renewalSection = document.getElementById('renewalSection');
  
  if (infoSection) infoSection.style.display = 'none';
  if (badgesSection) badgesSection.style.display = 'none';
  if (renewalSection) renewalSection.style.display = 'none';
  
  // 创建管理员界面
  createAdminInterface();
}

function createAdminInterface() {
  const mainContent = document.querySelector('main');
  if (!mainContent) return;
  
  // 清空现有内容
  mainContent.innerHTML = '';
  
  // 创建管理员界面HTML
  mainContent.innerHTML = `
    <div class="admin-interface">
      <div class="admin-header">
        <div class="admin-header-content">
          <div class="admin-title">
            <h1>Admin Dashboard</h1>
            <p>Manage users and transactions</p>
          </div>
          <button class="admin-logout-btn" onclick="logout()">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
              <polyline points="16,17 21,12 16,7"></polyline>
              <line x1="21" y1="12" x2="9" y2="12"></line>
            </svg>
            Logout
          </button>
        </div>
      </div>
      
      <div class="admin-stats">
        <div class="stat-card">
          <h3>Total Users</h3>
          <div class="stat-value" id="totalUsers">-</div>
        </div>
        <div class="stat-card">
          <h3>Active Users</h3>
          <div class="stat-value" id="activeUsers">-</div>
        </div>
        <div class="stat-card">
          <h3>Total Revenue</h3>
          <div class="stat-value" id="totalRevenue">-</div>
        </div>
        <div class="stat-card">
          <h3>Monthly Revenue</h3>
          <div class="stat-value" id="monthlyRevenue">-</div>
        </div>
      </div>
      
      <div class="admin-tabs">
        <button class="tab-btn active" data-tab="users">Users</button>
        <button class="tab-btn" data-tab="blocklist">Blocklist</button>
        <button class="tab-btn" data-tab="purchases">Transactions</button>
      </div>
      
      <div class="admin-content">
        <div class="tab-content active" id="users-tab">
          <div class="admin-search">
            <input type="text" id="userSearch" placeholder="Search users...">
            <button id="searchUsers">Search</button>
          </div>
          <div class="admin-table" id="usersTable">
            <div class="table-loading">Loading users...</div>
          </div>
        </div>
        
        <div class="tab-content" id="blocklist-tab">
          <div class="admin-search">
            <input type="text" id="blocklistSearch" placeholder="Search deleted users...">
            <button id="searchBlocklist">Search</button>
          </div>
          <div class="admin-table" id="blocklistTable">
            <div class="table-loading">Loading deleted users...</div>
          </div>
        </div>
        
        <div class="tab-content" id="purchases-tab">
          <div class="admin-search">
            <input type="text" id="purchaseSearch" placeholder="Search transactions...">
            <button id="searchPurchases">Search</button>
          </div>
          <div class="admin-table" id="purchasesTable">
            <div class="table-loading">Loading transactions...</div>
          </div>
        </div>
      </div>
    </div>
  `;
  
  // 绑定事件
  setupAdminEventListeners();
  
  // 加载数据
  loadAdminStats();
  loadAdminUsers();
}

function setupAdminEventListeners() {
  // 标签切换
  const tabBtns = document.querySelectorAll('.tab-btn');
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      switchTab(tab);
    });
  });
  
  // 搜索功能
  const userSearchBtn = document.getElementById('searchUsers');
  const blocklistSearchBtn = document.getElementById('searchBlocklist');
  const purchaseSearchBtn = document.getElementById('searchPurchases');
  
  if (userSearchBtn) {
    userSearchBtn.addEventListener('click', () => {
      const query = document.getElementById('userSearch').value;
      loadAdminUsers(1, 20, query, false);
    });
  }
  
  if (blocklistSearchBtn) {
    blocklistSearchBtn.addEventListener('click', () => {
      const query = document.getElementById('blocklistSearch').value;
      loadBlocklistUsers(1, 20, query);
    });
  }
  
  if (purchaseSearchBtn) {
    purchaseSearchBtn.addEventListener('click', () => {
      const query = document.getElementById('purchaseSearch').value;
      loadAdminPurchases(1, 20, query);
    });
  }
  
}

function switchTab(tab) {
  // 更新标签按钮状态
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  document.querySelector(`[data-tab="${tab}"]`).classList.add('active');
  
  // 更新内容显示
  document.querySelectorAll('.tab-content').forEach(content => {
    content.classList.remove('active');
  });
  document.getElementById(`${tab}-tab`).classList.add('active');
  
  // 加载对应数据
  if (tab === 'users') {
    loadAdminUsers(1, 20, '', false);
  } else if (tab === 'blocklist') {
    loadBlocklistUsers();
  } else if (tab === 'purchases') {
    loadAdminPurchases();
  }
}

async function loadAdminStats() {
  try {
    const stats = await portalApiFetch('/admin/stats');
    
    document.getElementById('totalUsers').textContent = stats.users.total;
    document.getElementById('activeUsers').textContent = stats.users.active;
    document.getElementById('totalRevenue').textContent = stats.revenue.total;
    document.getElementById('monthlyRevenue').textContent = stats.revenue.monthly;
  } catch (error) {
    console.error('Failed to load admin stats:', error);
  }
}

async function loadAdminUsers(page = 1, limit = 20, search = '', includeDeleted = false) {
  try {
    console.log('Loading admin users...', { page, limit, search, includeDeleted });
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString()
    });
    if (search) params.append('search', search);
    if (includeDeleted) params.append('include_deleted', 'true');
    
    const data = await portalApiFetch(`/admin/users?${params}`);
    console.log('Admin users data received:', data);
    displayAdminUsers(data.users);
  } catch (error) {
    console.error('Failed to load admin users:', error);
    const usersTable = document.getElementById('usersTable');
    if (usersTable) {
      usersTable.innerHTML = '<div class="table-error">Failed to load users: ' + error.message + '</div>';
    } else {
      console.error('usersTable element not found!');
    }
  }
}

async function loadBlocklistUsers(page = 1, limit = 20, search = '') {
  try {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
      include_deleted: 'true'
    });
    if (search) params.append('search', search);
    
    const data = await portalApiFetch(`/admin/users?${params}`);
    // 只显示已删除的用户
    const deletedUsers = data.users.filter(user => user.is_deleted);
    displayBlocklistUsers(deletedUsers);
  } catch (error) {
    console.error('Failed to load blocklist users:', error);
    document.getElementById('blocklistTable').innerHTML = '<div class="table-error">Failed to load deleted users</div>';
  }
}

async function loadAdminPurchases(page = 1, limit = 20, search = '') {
  try {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString()
    });
    if (search) params.append('search', search);
    
    const data = await portalApiFetch(`/admin/purchases?${params}`);
    displayAdminPurchases(data.purchases, data.pagination, page, search);
  } catch (error) {
    console.error('Failed to load admin purchases:', error);
    document.getElementById('purchasesTable').innerHTML = '<div class="table-error">Failed to load transactions</div>';
  }
}

function displayAdminUsers(users) {
  console.log('Displaying admin users:', users);
  const table = document.getElementById('usersTable');
  if (!table) {
    console.error('usersTable element not found!');
    return;
  }
  
  if (!users || users.length === 0) {
    console.log('No users to display');
    table.innerHTML = '<div class="table-empty">No users found</div>';
    return;
  }
  
  const tableHTML = `
    <div class="table-header">
      <div class="table-cell sortable" data-sort="username">
        Username
        <span class="sort-icon">↕</span>
      </div>
      <div class="table-cell sortable" data-sort="email">
        Email
        <span class="sort-icon">↕</span>
      </div>
      <div class="table-cell sortable" data-sort="phone">
        Phone
        <span class="sort-icon">↕</span>
      </div>
      <div class="table-cell sortable" data-sort="created_at">
        Created
        <span class="sort-icon">↕</span>
      </div>
      <div class="table-cell sortable" data-sort="valid_until">
        Valid Until
        <span class="sort-icon">↕</span>
      </div>
      <div class="table-cell">Operations</div>
    </div>
    ${users.map(user => `
      <div class="table-row">
        <div class="table-cell">
          ${user.username || 'N/A'}
        </div>
        <div class="table-cell">${user.email || 'N/A'}</div>
        <div class="table-cell">${user.phone || 'N/A'}</div>
        <div class="table-cell">${user.created_at}</div>
        <div class="table-cell">${getValidUntilWithColor(user.valid_until)}</div>
        <div class="table-cell">
          <div class="admin-actions">
            <button class="btn-edit" onclick="openEditUserModal('${user.id}')" title="Edit User">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
              </svg>
            </button>
            <button class="btn-delete" onclick="deleteUser('${user.id}', '${user.username || 'User'}')" title="Delete User">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3,6 5,6 21,6"></polyline>
                <path d="M19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2"></path>
                <line x1="10" y1="11" x2="10" y2="17"></line>
                <line x1="14" y1="11" x2="14" y2="17"></line>
              </svg>
            </button>
          </div>
        </div>
      </div>
    `).join('')}
  `;
  
  table.innerHTML = tableHTML;
  
  // 添加排序功能
  addSortingToTable();
}

function displayBlocklistUsers(users) {
  const table = document.getElementById('blocklistTable');
  if (!table) return;
  
  if (users.length === 0) {
    table.innerHTML = '<div class="table-empty">No deleted users found</div>';
    return;
  }
  
  const tableHTML = `
    <div class="table-header">
      <div class="table-cell sortable" data-sort="username">
        Username
        <span class="sort-icon">↕</span>
      </div>
      <div class="table-cell sortable" data-sort="email">
        Email
        <span class="sort-icon">↕</span>
      </div>
      <div class="table-cell sortable" data-sort="phone">
        Phone
        <span class="sort-icon">↕</span>
      </div>
      <div class="table-cell sortable" data-sort="created_at">
        Created
        <span class="sort-icon">↕</span>
      </div>
      <div class="table-cell sortable" data-sort="deleted_at">
        Deleted At
        <span class="sort-icon">↕</span>
      </div>
      <div class="table-cell">Operations</div>
    </div>
    ${users.map(user => `
      <div class="table-row deleted-row">
        <div class="table-cell">
          ${user.username || 'N/A'}
        </div>
        <div class="table-cell">${user.email || 'N/A'}</div>
        <div class="table-cell">${user.phone || 'N/A'}</div>
        <div class="table-cell">${user.created_at}</div>
        <div class="table-cell">${user.deleted_at || 'N/A'}</div>
        <div class="table-cell">
          <div class="admin-actions">
            <button class="btn-edit" onclick="restoreUser('${user.id}', '${user.username || 'Unknown'}')" title="Restore User">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"></path>
                <path d="M21 3v5h-5"></path>
                <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"></path>
                <path d="M3 21v-5h5"></path>
              </svg>
            </button>
            <button class="btn-delete" onclick="permanentlyDeleteUser('${user.id}', '${user.username || 'Unknown'}')" title="Permanently Delete User">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3,6 5,6 21,6"></polyline>
                <path d="M19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2"></path>
                <line x1="10" y1="11" x2="10" y2="17"></line>
                <line x1="14" y1="11" x2="14" y2="17"></line>
              </svg>
            </button>
          </div>
        </div>
      </div>
    `).join('')}
  `;
  
  table.innerHTML = tableHTML;
  addSortingToTable();
}

// 添加排序功能到表格
function addSortingToTable() {
  const sortableHeaders = document.querySelectorAll('.table-header .sortable');
  let currentSort = { field: null, direction: 'asc' };
  
  sortableHeaders.forEach(header => {
    header.addEventListener('click', () => {
      const field = header.dataset.sort;
      const icon = header.querySelector('.sort-icon');
      
      // 确定排序方向
      if (currentSort.field === field) {
        currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
      } else {
        currentSort.direction = 'asc';
      }
      currentSort.field = field;
      
      // 更新所有排序图标
      sortableHeaders.forEach(h => {
        const i = h.querySelector('.sort-icon');
        i.textContent = '↕';
        i.className = 'sort-icon';
      });
      
      // 更新当前排序图标
      icon.textContent = currentSort.direction === 'asc' ? '↑' : '↓';
      icon.className = `sort-icon ${currentSort.direction}`;
      
      // 执行排序
      sortUsersTable(field, currentSort.direction);
    });
  });
}

// 排序用户表格
function sortUsersTable(field, direction) {
  const table = document.getElementById('usersTable');
  const header = table.querySelector('.table-header');
  const rows = Array.from(table.querySelectorAll('.table-row'));
  
  // 创建临时容器来存储排序后的行
  const tempContainer = document.createElement('div');
  
  rows.sort((a, b) => {
    let aValue, bValue;
    
    switch(field) {
      case 'username':
        aValue = a.querySelector('.table-cell').textContent.trim();
        bValue = b.querySelector('.table-cell').textContent.trim();
        break;
      case 'email':
        aValue = a.querySelectorAll('.table-cell')[1].textContent.trim();
        bValue = b.querySelectorAll('.table-cell')[1].textContent.trim();
        break;
      case 'phone':
        aValue = a.querySelectorAll('.table-cell')[2].textContent.trim();
        bValue = b.querySelectorAll('.table-cell')[2].textContent.trim();
        break;
      case 'created_at':
        aValue = a.querySelectorAll('.table-cell')[3].textContent.trim();
        bValue = b.querySelectorAll('.table-cell')[3].textContent.trim();
        break;
      case 'valid_until':
        aValue = a.querySelectorAll('.table-cell')[4].textContent.trim();
        bValue = b.querySelectorAll('.table-cell')[4].textContent.trim();
        break;
      case 'deleted_at':
        aValue = a.querySelectorAll('.table-cell')[4].textContent.trim();
        bValue = b.querySelectorAll('.table-cell')[4].textContent.trim();
        break;
      default:
        return 0;
    }
    
    // 处理N/A值
    if (aValue === 'N/A') aValue = '';
    if (bValue === 'N/A') bValue = '';
    
    // 字符串比较
    if (aValue < bValue) return direction === 'asc' ? -1 : 1;
    if (aValue > bValue) return direction === 'asc' ? 1 : -1;
    return 0;
  });
  
  // 将排序后的行添加到临时容器
  rows.forEach(row => tempContainer.appendChild(row));
  
  // 清空表格内容（保留header）
  while (table.children.length > 1) {
    table.removeChild(table.lastChild);
  }
  
  // 将排序后的行添加回表格
  while (tempContainer.firstChild) {
    table.appendChild(tempContainer.firstChild);
  }
}

// 编辑用户
function editUser(userId, isDeleted = false) {
  if (isDeleted) {
    // 如果是已删除用户，询问是否恢复
    if (confirm('This user has been deleted. Do you want to restore them?')) {
      restoreUser(userId);
    }
  } else {
    // 正常编辑用户
    console.log('Edit user:', userId);
    // TODO: 实现编辑用户功能
    alert('Edit user functionality coming soon!');
  }
}

// 恢复用户
async function restoreUser(userId) {
  try {
    const response = await fetch(`${API_BASE}/admin/users/${userId}/restore`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${getAuthToken()}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (response.ok) {
      alert('User restored successfully!');
      // 刷新整个页面以显示最新状态
      window.location.reload();
    } else {
      const error = await response.json();
      alert(`Failed to restore user: ${error.detail || 'Unknown error'}`);
    }
  } catch (error) {
    console.error('Restore user error:', error);
    alert('Failed to restore user. Please try again.');
  }
}

// 删除用户（软删除）
async function deleteUser(userId, username) {
  if (!confirm(`Are you sure you want to delete user "${username}"? This will move the user to blocklist.`)) {
    return;
  }
  
  try {
    const response = await fetch(`${API_BASE}/admin/users/${userId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${getAuthToken()}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (response.ok) {
      alert('User deleted successfully!');
      // 刷新整个页面以显示最新状态
      window.location.reload();
    } else {
      const error = await response.json();
      alert(`Failed to delete user: ${error.detail || 'Unknown error'}`);
    }
  } catch (error) {
    console.error('Delete user error:', error);
    alert('Failed to delete user. Please try again.');
  }
}

// 永久删除用户
async function permanentlyDeleteUser(userId, username) {
  if (!confirm(`Are you sure you want to PERMANENTLY delete user "${username}"? This action cannot be undone and will remove all user data.`)) {
    return;
  }
  
  try {
    const response = await fetch(`${API_BASE}/admin/users/${userId}/permanent`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${getAuthToken()}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (response.ok) {
      alert('User permanently deleted!');
      // 刷新整个页面以显示最新状态
      window.location.reload();
    } else {
      const error = await response.json();
      alert(`Failed to permanently delete user: ${error.detail || 'Unknown error'}`);
    }
  } catch (error) {
    console.error('Permanent delete user error:', error);
    alert('Failed to permanently delete user. Please try again.');
  }
}

function displayAdminPurchases(purchases, pagination, currentPage, search) {
  const table = document.getElementById('purchasesTable');
  if (!table) return;
  
  if (purchases.length === 0) {
    table.innerHTML = '<div class="table-empty">No transactions found</div>';
    return;
  }
  
  const tableHTML = `
    <div class="table-header">
      <div class="table-cell">User</div>
      <div class="table-cell">Type</div>
      <div class="table-cell">Amount</div>
      <div class="table-cell">Status</div>
      <div class="table-cell">Date</div>
      <div class="table-cell">Actions</div>
    </div>
    ${purchases.map(purchase => `
      <div class="table-row">
        <div class="table-cell">${purchase.username}</div>
        <div class="table-cell">${purchase.type}</div>
        <div class="table-cell">${purchase.amount}</div>
        <div class="table-cell">
          <span class="status-badge ${purchase.status.toLowerCase()}">
            ${purchase.status}
          </span>
        </div>
        <div class="table-cell">${purchase.purchased_at}</div>
        <div class="table-cell">
          <div class="admin-actions">
            ${purchase.status === 'Completed' ? `
              <button class="btn-refund" onclick="refundPurchase('${purchase.id}')" title="Refund Purchase">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"></path>
                  <path d="M21 3v5h-5"></path>
                  <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"></path>
                  <path d="M3 21v-5h5"></path>
                </svg>
              </button>
            ` : ''}
          </div>
        </div>
      </div>
    `).join('')}
    <div class="table-pagination">
      <div class="pagination-info">
        Showing ${((currentPage - 1) * 20) + 1} to ${Math.min(currentPage * 20, pagination.total)} of ${pagination.total} transactions
      </div>
      <div class="pagination-controls">
        <button class="btn btn-pagination" onclick="loadAdminPurchases(${currentPage - 1}, 20, '${search}')" ${currentPage <= 1 ? 'disabled' : ''}>
          Previous
        </button>
        <span class="pagination-page">Page ${currentPage} of ${pagination.pages}</span>
        <button class="btn btn-pagination" onclick="loadAdminPurchases(${currentPage + 1}, 20, '${search}')" ${currentPage >= pagination.pages ? 'disabled' : ''}>
          Next
        </button>
      </div>
    </div>
  `;
  
  table.innerHTML = tableHTML;
}

// ===== USER EDIT FUNCTIONALITY =====
let currentEditUserId = null;

function openEditUserModal(userId) {
  currentEditUserId = userId;
  
  // 获取用户信息并填充表单
  loadUserForEdit(userId);
  
  // 显示模态框
  document.getElementById('editUserModal').style.display = 'flex';
}

function closeEditUserModal() {
  currentEditUserId = null;
  document.getElementById('editUserModal').style.display = 'none';
  
  // 清除表单和错误信息
  clearEditForm();
}

function clearEditForm() {
  document.getElementById('editUserForm').reset();
  document.querySelectorAll('.error-message').forEach(el => {
    el.classList.remove('show');
    el.textContent = '';
  });
}

async function loadUserForEdit(userId) {
  try {
    const data = await portalApiFetch(`/admin/users/${userId}`);
    
    // 填充表单
    document.getElementById('editUsername').value = data.username || '';
    document.getElementById('editEmail').value = data.email || '';
    document.getElementById('editPhone').value = data.phone || '';
    
    // 处理valid_until日期 - 转换为本地时间显示
    if (data.valid_until) {
      const date = new Date(data.valid_until);
      // 直接使用toISOString()然后截取到分钟，这样会显示本地时间
      const localDateTime = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
      document.getElementById('editValidUntil').value = localDateTime.toISOString().slice(0, 16);
    } else {
      document.getElementById('editValidUntil').value = '';
    }
    
  } catch (error) {
    console.error('Failed to load user for edit:', error);
    alert('Failed to load user information');
  }
}

async function saveUserChanges() {
  if (!currentEditUserId) {
    console.error('No currentEditUserId, cannot save');
    return;
  }
  
  // 只清除错误信息，不清空表单
  document.querySelectorAll('.error-message').forEach(el => {
    el.classList.remove('show');
    el.textContent = '';
  });
  
  // 获取表单数据
  const formData = {
    username: document.getElementById('editUsername').value.trim(),
    email: document.getElementById('editEmail').value.trim(),
    phone: document.getElementById('editPhone').value.trim(),
    valid_until: document.getElementById('editValidUntil').value
  };
  
  // 处理valid_until时区转换 - 将本地时间转换为UTC
  if (formData.valid_until) {
    const localDate = new Date(formData.valid_until);
    // 转换为UTC时间
    const utcDate = new Date(localDate.getTime() + localDate.getTimezoneOffset() * 60000);
    formData.valid_until = utcDate.toISOString();
  }
  
  // 验证必填字段
  if (!formData.username) {
    showEditError('editUsernameError', 'Username is required');
    return;
  }
  
  if (!formData.email) {
    showEditError('editEmailError', 'Email is required');
    return;
  }
  
  if (!formData.phone) {
    showEditError('editPhoneError', 'Phone is required');
    return;
  }
  
  // 验证email格式
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(formData.email)) {
    showEditError('editEmailError', 'Please enter a valid email address');
    return;
  }
  
  // 验证phone格式（E164）
  const phoneRegex = /^\+[1-9]\d{1,14}$/;
  if (!phoneRegex.test(formData.phone)) {
    showEditError('editPhoneError', 'Please enter a valid phone number in E164 format (+1234567890)');
    return;
  }
  
  try {
    console.log('Sending update request:', {
      userId: currentEditUserId,
      formData: formData
    });
    
    // 发送更新请求
    const response = await portalApiFetch(`/admin/users/${currentEditUserId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(formData)
    });
    
    console.log('Update response:', response);
    
    // 成功，刷新页面
    window.location.reload();
    
  } catch (error) {
    console.error('Failed to update user:', error);
    
    // 处理特定错误
    if (error.message.includes('email_exists') || error.message.includes('Email already exists')) {
      showEditError('editEmailError', 'Email already exists');
      showEditError('editGeneralError', 'Email already exists');
    } else if (error.message.includes('phone_exists') || error.message.includes('Phone number already exists')) {
      showEditError('editPhoneError', 'Phone number already exists');
      showEditError('editGeneralError', 'Phone number already exists');
    } else if (error.message.includes('username_exists') || error.message.includes('Username already exists')) {
      showEditError('editUsernameError', 'Username already exists');
      showEditError('editGeneralError', 'Username already exists');
    } else {
      // 显示错误信息
      showEditError('editGeneralError', error.message);
    }
  }
}

function showEditError(elementId, message) {
  const errorElement = document.getElementById(elementId);
  if (errorElement) {
    errorElement.textContent = message;
    errorElement.classList.add('show');
    errorElement.style.display = 'block';
  }
}

// ===== REFUND FUNCTIONALITY =====
async function refundPurchase(purchaseId) {
  if (!confirm('Are you sure you want to refund this purchase? This action cannot be undone.')) {
    return;
  }
  
  try {
    await portalApiFetch(`/admin/purchases/${purchaseId}/refund`, {
      method: 'POST'
    });
    
    alert('Refund processed successfully');
    window.location.reload();
    
  } catch (error) {
    console.error('Failed to refund purchase:', error);
    alert('Failed to process refund: ' + error.message);
  }
}

// ===== EVENT LISTENERS =====
document.addEventListener('DOMContentLoaded', function() {
  // 用户编辑模态框事件监听器
  document.getElementById('btnSaveUser')?.addEventListener('click', saveUserChanges);
  
  // 点击模态框外部关闭
  document.getElementById('editUserModal')?.addEventListener('click', function(e) {
    if (e.target === this) {
      closeEditUserModal();
    }
  });
  
  // 关闭按钮事件
  document.querySelector('#editUserModal .modal-close')?.addEventListener('click', closeEditUserModal);
});

// ===== Cloudflare Stripe Proxy 说明 =====
// 由于 AWS Lightsail IPv6-only 实例无法直接访问 Stripe API，
// 需要使用 Cloudflare Worker 作为通用代理。
// 
// Worker 代码位于: stripe-proxy.js
// 部署指南位于: CLOUDFLARE_WORKER_SETUP.md
