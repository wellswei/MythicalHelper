// ===== PORTAL JAVASCRIPT =====

// 配置
const API_BASE = 'https://api.mythicalhelper.org';

// 全局状态
let currentUser = null;
const portalState = { emailTxId: '', newEmail: '', emailResendExpiry: 0 };
let isInEmailChangeFlow = false;

// Turnstile状态管理
let portalTurnstileToken = null;
let currentTurnstileOperation = null; // 'email', 'delete'

// ===== UTILITY FUNCTIONS =====
function $(id) {
  return document.getElementById(id);
}

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
    'turnstileStatusEmail'
  ];
  
  statusElements.forEach(statusId => {
    const statusEl = document.getElementById(statusId);
    if (statusEl) {
      const textEl = statusEl.querySelector('span');
      if (textEl) {
        textEl.textContent = text;
        statusEl.style.color = color;
      }
    }
  });
}

// 启用当前操作的按钮
function enableCurrentOperationButtons() {
  if (currentTurnstileOperation === 'email') {
    const btn = document.getElementById('btnSendEmailCode');
    if (btn) btn.disabled = false;
  } else if (currentTurnstileOperation === 'delete') {
    const btn = document.getElementById('btnConfirmDelete');
    if (btn) btn.disabled = false;
  }
}

// 禁用当前操作的按钮
function disableCurrentOperationButtons() {
  if (currentTurnstileOperation === 'email') {
    const btn = document.getElementById('btnSendEmailCode');
    if (btn) btn.disabled = true;
  } else if (currentTurnstileOperation === 'delete') {
    const btn = document.getElementById('btnConfirmDelete');
    if (btn) btn.disabled = true;
  }
}

// 重置Turnstile
function resetPortalTurnstile() {
  console.log('Resetting Portal Turnstile...');
  portalTurnstileToken = null;
  currentTurnstileOperation = null;
  
  // 重置所有Turnstile组件
  const turnstileElements = document.querySelectorAll('.cf-turnstile');
  turnstileElements.forEach(element => {
    if (window.turnstile && window.turnstile.reset) {
      window.turnstile.reset(element);
    }
  });
  
  // 更新状态消息
  updatePortalTurnstileMessage('Security verification required', '#6b7280');
  
  // 禁用所有相关按钮
  disableCurrentOperationButtons();
}

// 等待Turnstile token
function waitForPortalTurnstileToken(timeout = 10000) {
  return new Promise((resolve, reject) => {
    if (portalTurnstileToken) {
      resolve(portalTurnstileToken);
      return;
    }
    
    const startTime = Date.now();
    const checkInterval = setInterval(() => {
      if (portalTurnstileToken) {
        clearInterval(checkInterval);
        resolve(portalTurnstileToken);
      } else if (Date.now() - startTime > timeout) {
        clearInterval(checkInterval);
        reject(new Error('Turnstile verification timeout'));
      }
    }, 100);
  });
}

// 初始化Turnstile
function initPortalTurnstile(operation) {
  console.log('Initializing Portal Turnstile for operation:', operation);
  currentTurnstileOperation = operation;
  resetPortalTurnstile();
}

// ===== 持久化变更流程状态 =====
function savePortalChangeState() {
  try {
    const payload = {
      email: {
        txId: portalState.emailTxId || '',
        newEmail: portalState.newEmail || '',
        resendExpiry: portalState.emailResendExpiry || 0,
      }
    };
    sessionStorage.setItem('portalChangeState', JSON.stringify(payload));
  } catch (e) {
    console.error('Failed to save portal change state:', e);
  }
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
    if (!parsed.email || !parsed.email.resendExpiry) {
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
    if (parsed.email) {
      portalState.emailTxId = parsed.email.txId || '';
      portalState.newEmail = parsed.email.newEmail || '';
      portalState.emailResendExpiry = parsed.email.resendExpiry || 0;
    }
    return !!(portalState.emailTxId || portalState.emailResendExpiry);
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
    
    // 如果没有有效状态，清除整个sessionStorage
    if (!hasValidState) {
      sessionStorage.removeItem('portalChangeState');
    } else {
      sessionStorage.setItem('portalChangeState', JSON.stringify(parsed));
    }
  } catch (e) {
    console.error('Failed to clear expired change state:', e);
    sessionStorage.removeItem('portalChangeState');
  }
}

// ===== 用户信息显示 =====
function updateUserInfo() {
  if (!currentUser) {
    showNotAuthenticatedMessage();
    return;
  }
  
  // 更新用户详情
  const fields = {
    'userName': currentUser.username || 'Unknown',
    'userEmail': currentUser.email || 'Not provided',
    'userRole': currentUser.role || 'user',
    'userCreatedAt': formatDate(currentUser.created_at),
    'userValidUntil': formatPortalDate(currentUser.valid_until)
  };
  
  Object.entries(fields).forEach(([id, value]) => {
    const element = $(id);
    if (element) {
      element.textContent = value;
    }
  });
}

function formatDate(dateString) {
  if (!dateString) return 'Not provided';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

function formatPortalDate(dateString) {
  if (!dateString) return 'Not specified';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

function getValidUntilWithColor(validUntil) {
  if (!validUntil) return 'N/A';
  const now = new Date();
  const validDate = new Date(validUntil);
  if (validDate >= now) {
    return `<span class="valid">${formatPortalDate(validUntil)}</span>`;
  } else {
    return `<span class="expired">${formatPortalDate(validUntil)}</span>`;
  }
}

// ===== 认证相关 =====
function clearAuthToken() {
  sessionStorage.removeItem('authToken');
}

function redirectToAuth() {
  window.location.href = '/auth/auth.html?mode=login';
}

function isAuthenticated() {
  return !!sessionStorage.getItem('authToken');
}

function showNotAuthenticatedMessage() {
  // 更新所有字段显示未认证状态
  const fields = ['userName', 'userEmail', 'userRole', 'userCreatedAt', 'userValidUntil'];
  fields.forEach(id => {
    const element = $(id);
    if (element) {
      element.textContent = 'Please sign in first';
    }
  });
}

// ===== API 调用 =====
async function apiCall(endpoint, options = {}) {
  const authToken = sessionStorage.getItem('authToken');
  if (!authToken) {
    throw new Error('No authentication token found');
  }

  const defaultOptions = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`
    }
  };

  const response = await fetch(`${API_BASE}${endpoint}`, { ...defaultOptions, ...options });
  
  if (!response.ok) {
    let errorMessage = 'Request failed';
    try {
      const errorData = await response.json();
      if (errorData.detail) {
        errorMessage = errorData.detail;
      } else if (errorData.message) {
        errorMessage = errorData.message;
      }
    } catch (e) {
      errorMessage = `HTTP ${response.status}: ${response.statusText}`;
    }
    throw new Error(errorMessage);
  }

  return await response.json();
}

// ===== 用户数据加载 =====
async function loadUserData() {
  try {
    const userData = await apiCall('/users/me');
    currentUser = userData;
    updateUserInfo();
    return userData;
  } catch (error) {
    console.error('Failed to load user data:', error);
    if (error.message.includes('401') || error.message.includes('Unauthorized')) {
      clearAuthToken();
      redirectToAuth();
    } else {
      // 显示错误状态
      const saved = sessionStorage.getItem('userData');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          currentUser = {
            user_id: parsed.userId || 'unknown',
            username: parsed.username || 'Unknown',
            email: 'Not provided',
            role: 'user',
            created_at: null,
            valid_until: null,
            badges: {}
          };
          updateUserInfo();
        } catch (e) {
          showNotAuthenticatedMessage();
        }
      } else {
        showNotAuthenticatedMessage();
      }
    }
  }
}

// ===== 错误处理 =====
function showError(message) {
  alert('Error: ' + message);
}

function showSuccess(message) {
  alert('Success: ' + message);
}

// ===== 登出 =====
function logout() {
  clearAuthToken();
  window.location.href = '/auth/auth.html?mode=login';
}

// ===== 邮箱变更 =====
function openEmailEditor() {
  if (!currentUser) return;
  
  // 清除之前的邮箱修改状态
  clearEmailChangeState();
  resetEmailEditorUI(false);
  
  // 隐藏profile card，显示email change card
  const profileCard = document.getElementById('profileCard');
  const emailChangeCard = document.getElementById('emailChangeCard');
  
  // 记录当前卡片高度，用于稳定切换时的框体高度
  const baseHeight = profileCard ? profileCard.offsetHeight : 0;
  if (profileCard) profileCard.style.display = 'none';
  
  if (emailChangeCard) {
    emailChangeCard.style.display = 'block';
    // 锁定切换后的最小高度，避免框体视觉跳动
    if (baseHeight) emailChangeCard.style.minHeight = `${baseHeight}px`;
    // 显示当前邮箱信息
    const currentEmailDisplay = document.getElementById('currentEmailDisplay');
    if (currentEmailDisplay && currentUser) {
      currentEmailDisplay.textContent = currentUser.email || 'Not provided';
    }
    // 初始化Turnstile组件
    setTimeout(() => {
      initPortalTurnstile('email');
    }, 100);
    // 聚焦到输入框
    setTimeout(() => {
      const el = document.getElementById('newEmailInput');
      if (el) el.focus();
    }, 50);
  }
}

function resetEmailEditorUI(hideSection = true) {
  const label = document.getElementById('emailLabel');
  const input = document.getElementById('newEmailInput');
  const btn = document.getElementById('btnSendEmailCode');
  
  if (input) {
    input.type = 'email';
    input.maxLength = 254;
    input.pattern = '';
    input.inputMode = 'email';
    input.placeholder = 'you@example.com';
    input.value = '';
  }
  if (label) label.textContent = 'New Email';
  if (btn) {
    btn.textContent = 'Send Code';
    btn.disabled = false;
  }
  
  // 重新显示turnstile组件，为下次发送验证码做准备
  const turnstileContainer = document.querySelector('#emailChangeCard .turnstile-container');
  if (turnstileContainer) {
    turnstileContainer.style.display = 'flex';
  }
  
  const err = document.getElementById('errPortalEmail');
  if (err) err.textContent = '';
  
  // 移除状态提示，保持和email一致
  if (hideSection) {
    const profileCard = document.getElementById('profileCard');
    const emailChangeCard = document.getElementById('emailChangeCard');
    
    if (profileCard) profileCard.style.display = 'block';
    if (emailChangeCard) emailChangeCard.style.display = 'none';
  }
}

// Email 主按钮：发送 或 验证
function onEmailPrimaryClick() {
  console.log('onEmailPrimaryClick called, portalState.emailTxId:', portalState.emailTxId);
  if (portalState.emailTxId) {
    console.log('Email ticket exists, calling onVerifyPortalEmail');
    return onVerifyPortalEmail();
  }
  console.log('No email ticket, calling onSendPortalEmail');
  return onSendPortalEmail();
}

async function onSendPortalEmail() {
  console.log('onSendPortalEmail function called!');
  
  const input = document.getElementById('newEmailInput');
  const err = document.getElementById('errPortalEmail');
  const btn = document.getElementById('btnSendEmailCode');
  
  if (!input) return;
  
  const email = input.value.trim();
  if (!email) {
    if (err) err.textContent = 'Please enter an email address';
    return;
  }
  
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    if (err) err.textContent = 'Please enter a valid email address';
    return;
  }
  
  if (err) err.textContent = '';
  
  // 设置当前操作类型
  currentTurnstileOperation = 'email';
  
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
    
    // 与后端 tickets 路由对齐：直接创建变更邮箱的 ticket
    const res = await apiCall('/tickets', {
      method: 'POST',
      body: JSON.stringify({
        channel: 'email',
        destination: email,
        purpose: 'change_email',
        subject_id: currentUser?.user_id
      })
    });
    
    if (res && res.ticket_id) {
      portalState.emailTxId = res.ticket_id;
      portalState.newEmail = email;
      savePortalChangeState();
      // 切换为验证码输入阶段（单输入模式）
      const inputEl = document.getElementById('newEmailInput');
      const label = document.getElementById('emailLabel');
      const primary = document.getElementById('btnSendEmailCode');
      
      console.log('Email transformation elements:', { inputEl, label, primary });
      
      if (inputEl) {
        inputEl.type = 'text';
        inputEl.maxLength = 6;
        inputEl.pattern = '[0-9]*';
        inputEl.inputMode = 'numeric';
        inputEl.placeholder = 'Enter 6-digit code';
        inputEl.value = '';
      }
      if (label) label.textContent = 'Enter 6-digit code';
      if (primary) primary.textContent = 'Verify Code';
      
      // 隐藏turnstile组件，因为验证码验证不需要turnstile
      const turnstileContainer = document.querySelector('#emailChangeCard .turnstile-container');
      if (turnstileContainer) {
        turnstileContainer.style.display = 'none';
      }
      
      console.log('Email transformation completed. New input properties:', {
        type: inputEl?.type,
        maxLength: inputEl?.maxLength,
        pattern: inputEl?.pattern,
        inputMode: inputEl?.inputMode,
        placeholder: inputEl?.placeholder
      });
    }
  } catch (error) {
    console.error('Failed to send email code:', error);
    let errorMessage = 'Failed to send code';
    if (error && error.message) {
      errorMessage = error.message;
    }
    if (err) err.textContent = errorMessage;
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Send Code';
    }
  }
}

async function onVerifyPortalEmail() {
  const err = document.getElementById('errPortalEmail');
  const btn = document.getElementById('btnSendEmailCode');
  
  if (!portalState.emailTxId) { 
    if (err) err.textContent = 'Please send the code first'; 
    return; 
  }
  
  // 单输入读取6位验证码
  let code = '';
  const codeInput = document.getElementById('newEmailInput');
  if (codeInput) code = (codeInput.value || '').replace(/\D/g, '');
  if (code.length !== 6) { 
    if (err) err.textContent = 'Please enter the complete 6-digit code'; 
    return; 
  }
  
  if (btn) btn.textContent = 'Verifying...';
  if (btn) btn.disabled = true;
  
  try {
    console.log('Verifying email code:', code);
    // 第一步：确认验证码
    const confirmRes = await apiCall(`/tickets/${portalState.emailTxId}/confirm`, {
      method: 'POST',
      body: JSON.stringify({ code })
    });
    
    console.log('Email code confirmation response:', confirmRes);
    
    if (confirmRes && confirmRes.proof_token) {
      // 第二步：更新邮箱
      const updateRes = await apiCall('/contacts/email', {
        method: 'PATCH',
        body: JSON.stringify({ proof_token: confirmRes.proof_token })
      });
      
      console.log('Email update response:', updateRes);
      
      if (updateRes) {
        await loadUserData();
        clearEmailChangeState();
        resetEmailEditorUI(true);
      }
    }
  } catch (error) {
    console.error('Failed to verify email code:', error);
    if (err) err.textContent = 'The code is incorrect or expired.';
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = portalState.emailTxId ? 'Verify Code' : 'Send Code';
    }
  }
}

// ===== 事件监听器设置 =====
function setupEventListeners() {
  // 登出按钮
  const logoutBtn = $('#btnLogout');
  if (logoutBtn) logoutBtn.addEventListener('click', logout);
  
  // 邮箱变更
  const changeEmailBtn = $('#btnChangeEmail');
  if (changeEmailBtn) {
    changeEmailBtn.addEventListener('click', openEmailEditor);
  }
  
  // 邮箱变更相关按钮
  const sendEmailBtn = $('#btnSendEmailCode');
  if (sendEmailBtn) sendEmailBtn.addEventListener('click', onEmailPrimaryClick);
  
  const verifyEmailBtn = $('#btnVerifyPortalEmail');
  if (verifyEmailBtn) verifyEmailBtn.addEventListener('click', onVerifyPortalEmail);
  
  const cancelEmailBtn = $('#btnCancelEmailChange');
  if (cancelEmailBtn) cancelEmailBtn.addEventListener('click', () => {
    clearEmailChangeState();
    resetEmailEditorUI(true);
    const profileCard = document.getElementById('profileCard');
    const emailChangeCard = document.getElementById('emailChangeCard');
    if (profileCard) profileCard.style.display = 'block';
    if (emailChangeCard) emailChangeCard.style.display = 'none';
  });
  
  // 全局兜底：若局部监听未绑定成功，使用事件委托捕获按钮点击
  try {
    document.addEventListener('click', (e) => {
      const target = e.target && (e.target.closest ? e.target.closest('#btnChangeEmail') : null);
      if (target) {
        console.log('Change email button clicked via event delegation');
        e.preventDefault();
        openEmailEditor();
      }
      
      const cancelTarget = e.target && (e.target.closest ? e.target.closest('#btnCancelEmailChange') : null);
      if (cancelTarget) {
        console.log('Cancel email change via delegation');
        e.preventDefault();
        clearEmailChangeState();
        resetEmailEditorUI(true);
        const profileCard = document.getElementById('profileCard');
        const emailChangeCard = document.getElementById('emailChangeCard');
        if (profileCard) profileCard.style.display = 'block';
        if (emailChangeCard) emailChangeCard.style.display = 'none';
        return false;
      }
    });
  } catch (e) {
    console.error('Failed to set up global event listeners:', e);
  }
}

// ===== 页面加载完成后初始化 =====
function initializePortal() {
  console.log('Initializing Portal...');
  
  // 检查认证
  if (!isAuthenticated()) {
    console.log('Not authenticated, redirecting to auth...');
    redirectToAuth();
    return;
  }
  
  // 设置事件监听器
  setupEventListeners();
  
  // 加载用户数据
  loadUserData().then(() => {
    console.log('User data loaded successfully');
  }).catch(error => {
    console.error('Failed to load user data:', error);
  });
  
  // 恢复邮箱变更进行中的状态（防止 Live Server 刷新中断）
  clearExpiredChangeState();
  if (loadPortalChangeState()) {
    console.log('Restoring email change state...');
    // Email 恢复
    if (portalState.emailTxId) {
      const profileCard = document.getElementById('profileCard');
      const baseHeight = profileCard ? profileCard.offsetHeight : 0;
      const emailSec = document.getElementById('emailChangeCard'); 
      if (emailSec) { 
        emailSec.style.display = 'block'; 
        if (baseHeight) emailSec.style.minHeight = `${baseHeight}px`; 
      }
      const label = document.getElementById('emailLabel'); 
      if (label) label.textContent = 'Enter 6-digit code';
      const input = document.getElementById('newEmailInput');
      if (input) {
        input.type = 'text';
        input.maxLength = 6;
        input.pattern = '[0-9]*';
        input.inputMode = 'numeric';
        input.placeholder = 'Enter 6-digit code';
        input.value = '';
      }
      const primary = document.getElementById('btnSendEmailCode'); 
      if (primary) primary.textContent = 'Verify Code';
      // 隐藏turnstile组件
      const turnstileContainer = document.querySelector('#emailChangeCard .turnstile-container');
      if (turnstileContainer) {
        turnstileContainer.style.display = 'none';
      }
    }
  }
}

// ===== 页面加载完成后初始化 =====
document.addEventListener('DOMContentLoaded', initializePortal);
