// auth.js — Mythical Helper (Magic Link Version - No Turnstile)
// Flow: Email → Magic Link → Take Oath → Get Badge

// ===== Config =====
const API_BASE = "https://api.mythicalhelper.org";
const ENDPOINTS = {
  // Magic Link API
  createMagicLink: "/magic-links",
  verifyMagicLink: "/magic-links/verify",
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
  emailProofToken: "",
  registrationId: "",
  userId: "",
  username: "",
  emailResendLeft: 0,
  emailResendTimer: null,
  currentStep: 1, // 当前步骤
  signupSessionToken: "", // 注册会话token，用于第三步自动登录
};

// Track current auth mode to avoid cross-flow interference
let currentAuthMode = 'login';

// ===== State Persistence =====
function saveState() {
  const stateToSave = {
    email: state.email,
    emailProofToken: state.emailProofToken,
    registrationId: state.registrationId,
    userId: state.userId,
    username: state.username,
    currentStep: state.currentStep,
    emailResendLeft: state.emailResendLeft,
    signupSessionToken: state.signupSessionToken
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
      state.emailProofToken = parsed.emailProofToken || "";
      state.registrationId = parsed.registrationId || "";
      state.userId = parsed.userId || "";
      state.username = parsed.username || "";
      state.currentStep = parsed.currentStep || 1;
      state.emailResendLeft = parsed.emailResendLeft || 0;
      state.signupSessionToken = parsed.signupSessionToken || "";
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
  state.emailProofToken = "";
  state.registrationId = "";
  state.userId = "";
  state.username = "";
  state.currentStep = 1;
  state.signupSessionToken = "";
  state.emailResendLeft = 0;
  if (state.emailResendTimer) {
    clearInterval(state.emailResendTimer);
    state.emailResendTimer = null;
  }
}

// ===== 登录功能（只支持邮箱） =====
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

function setStatus(element, message, type = 'info') {
  if (!element) return;
  element.textContent = message;
  element.className = `hint ${type}`;
}

function show(element) {
  if (element) {
    if (element.id === 'verificationModal') {
      element.style.display = 'flex';
    } else {
      element.style.display = 'block';
    }
  }
}

function hide(element) {
  if (element) element.style.display = 'none';
}

// ===== Resend cooldown =====
function startEmailResend() {
  if (state.emailResendTimer) {
    clearInterval(state.emailResendTimer);
  }
  
  state.emailResendLeft = RESEND_COOLDOWN;
  const btn = $('#btnSend');
  
  // 按钮状态已经在调用前设置，这里只需要启动倒计时
  state.emailResendTimer = setInterval(() => {
    state.emailResendLeft--;
    if (btn) {
      btn.textContent = `Resend in ${state.emailResendLeft}s`;
    }
    
    if (state.emailResendLeft <= 0) {
      clearInterval(state.emailResendTimer);
      state.emailResendTimer = null;
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Send Magic Link';
      }
    }
  }, 1000);
}

// ===== Login Resend cooldown =====
function startLoginEmailResend() {
  if (state.emailResendTimer) {
    clearInterval(state.emailResendTimer);
  }
  
  state.emailResendLeft = RESEND_COOLDOWN;
  const btn = $('#btnSendLoginCode');
  
  // 按钮状态已经在调用前设置，这里只需要启动倒计时
  state.emailResendTimer = setInterval(() => {
    state.emailResendLeft--;
    if (btn) {
      btn.textContent = `Resend in ${state.emailResendLeft}s`;
    }
    
    if (state.emailResendLeft <= 0) {
      clearInterval(state.emailResendTimer);
      state.emailResendTimer = null;
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Send Magic Link';
      }
      // 重新显示切换选项
      show($('#loginAuthSwitch'));
    }
  }, 1000);
}

// ===== Post-login redirect helper (route admins to admin portal) =====
async function redirectToRoleHome() {
  try {
    const token = sessionStorage.getItem('authToken');
    if (!token) { 
      window.location.href = '/portal/portal.html'; 
      return; 
    }
    
    const res = await fetch(`${API_BASE}/users/me`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (!res.ok) { 
      window.location.href = '/portal/portal.html'; 
      return; 
    }
    
    const me = await res.json();
    if (me && (me.role === 'admin' || me.role === 'administrator')) {
      window.location.href = '/admin/admin.html';
    } else {
      window.location.href = '/portal/portal.html';
    }
  } catch {
    window.location.href = '/portal/portal.html';
  }
}

// ===== API (no credentials by default; enable if your backend needs cookies) =====
async function postJSON(path, body, method = 'POST') {
  const headers = { 'Content-Type': 'application/json' };
  const res = await fetch(`${API_BASE}${path}`, {
    method: method,
    headers,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const j = await res.json().catch(() => ({ detail: 'Request failed' }));
    console.error('Request failed:', path, res.status, j);
    const errorMessage = typeof j.detail === 'string' ? j.detail :
                        (j.detail && j.detail.detail) ? j.detail.detail :
                        'Request failed';
    throw new Error(errorMessage);
  }
  return res.json();
}

async function getJSON(path) {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) {
    const j = await res.json().catch(() => ({ detail: 'Request failed' }));
    console.error('Request failed:', path, res.status, j);
    const errorMessage = typeof j.detail === 'string' ? j.detail :
                        (j.detail && j.detail.detail) ? j.detail.detail :
                        'Request failed';
    throw new Error(errorMessage);
  }
  return res.json();
}

// ===== 按钮锁定工具函数 =====
function lockButton(button, text = 'Processing...') {
  if (!button) return;
  button.disabled = true;
  button.dataset.originalText = button.textContent;
  button.textContent = text;
}

function unlockButton(button) {
  if (!button) return;
  button.disabled = false;
  if (button.dataset.originalText) {
    button.textContent = button.dataset.originalText;
    delete button.dataset.originalText;
  }
}

// ===== Handlers =====
async function onSendEmail() {
  const email = $('#emailInput').value.trim();
  if (!email) {
    setStatus($('#emailStatus'), 'Please enter your email address', 'error');
    return;
  }

  // 检查是否在倒计时期间
  if (state.emailResendLeft > 0) {
    setStatus($('#emailStatus'), `Please wait ${state.emailResendLeft} seconds before resending`, 'error');
    return;
  }

  const btn = $('#btnSend');
  lockButton(btn, 'Sending Magic Link...');

  try {
    await postJSON(ENDPOINTS.createMagicLink, {
      email: email,
      purpose: 'signup'
    });

    // 只有在API调用成功后才更新状态
    state.email = email;
    // proof_token 将在 /verify 页面验证后写入 sessionStorage
    // 保持在第1步，但显示"已发送魔法链接"状态
    
    // 立即更新UI状态，避免卡顿
    setStatus($('#emailStatus'), 'Magic link sent! Check your inbox and click the link to continue.', 'success');
    // 保持显示切换选项，让用户可以随时切换
    
    // 确保第1步保持激活状态
    $('#step1tag')?.classList.add('active');
    $('#step2tag')?.classList.remove('active');
    $('#step3tag')?.classList.remove('active');
    
    // 立即更新按钮状态为Resend
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Resend in 60s';
    }
    
    // 开始重发倒计时
    startEmailResend();
    
    saveState();
    // 不调用updateStep()，保持在第1步显示
    
  } catch (error) {
    console.error('Send magic link error:', error);
    setStatus($('#emailStatus'), error.message || 'Failed to send magic link', 'error');
    // 失败时不更新步骤，保持在当前步骤
    unlockButton(btn);
    return; // 提前返回，不执行finally块
  }
  
  // 成功时不需要unlockButton，因为startEmailResend已经处理了按钮状态
}

function onBackToEmail() {
  // 清除重发倒计时
  if (state.emailResendTimer) {
    clearInterval(state.emailResendTimer);
    state.emailResendTimer = null;
  }
  
  // 重置倒计时状态
  state.emailResendLeft = 0;
  
  // 重置按钮状态
  const btn = $('#btnSend');
  if (btn) {
    btn.disabled = false;
    btn.textContent = 'Send Magic Link';
  }
  
  // 显示切换选项
  show($('#authSwitch'));
  setStatus($('#emailStatus'), 'We\'ll send a magic link to your email.', 'info');
  $('#emailInput').value = state.email;
}

// ===== Take Oath =====
function onUsernameInput() {
  const username = $('#usernameInput').value.trim();
  state.username = username;
  
  // 更新徽章预览
  const badgeName = $('#badgeName');
  if (badgeName) {
    badgeName.textContent = username || 'Your Name';
  }
  
  saveState();
}

function onOathCheckboxChange() {
  const checkbox = $('#chkOath');
  const btn = $('#btnSubmitOath');
  
  if (checkbox && btn) {
    btn.disabled = !checkbox.checked;
  }
}

async function onTakeOath() {
  const username = $('#usernameInput').value.trim();
  const checkbox = $('#chkOath');
  
  if (!username) {
    showError($('#errOath'), 'Please enter your username');
    return;
  }
  
  if (!checkbox || !checkbox.checked) {
    showError($('#errOath'), 'Please check the oath agreement');
    return;
  }

  const btn = $('#btnSubmitOath');
  lockButton(btn, 'Creating Account...');
  
  // 清除之前的错误信息
  hideError($('#errOath'));

  try {
    console.log('Starting registration process...');

    // 1. 创建注册记录（无需传入 proof）
    const regResponse = await postJSON(ENDPOINTS.createRegistration, {});
    state.registrationId = regResponse.registration_id;

    // 2. 附加邮箱 proof token（来自 /verify 页面写入的 sessionStorage）
    await postJSON(ENDPOINTS.attachRegistration(state.registrationId), {
      proof_token: state.emailProofToken
    });

    // 3. 更新注册信息（用户名 + 宣誓）
    await postJSON(ENDPOINTS.patchRegistration(state.registrationId), {
      username: username,
      oath_accept: true
    }, 'PATCH');

    // 4. 激活注册
    const activateResponse = await postJSON(ENDPOINTS.activateRegistration(state.registrationId), {});
    state.userId = activateResponse.user_id;
    state.signupSessionToken = activateResponse.signup_session_token;

    // 5. 自动登录（使用 signup_session_token）
    const sessionResponse = await postJSON(ENDPOINTS.exchangeSession, {
      signup_session_token: state.signupSessionToken
    });
    
    sessionStorage.setItem('authToken', sessionResponse.access_token);
    
    // 跳转到徽章选择
    state.currentStep = 3;
    saveState();
    updateStep();
    
  } catch (error) {
    console.error('Registration error:', error);
    showError($('#errOath'), error.message || 'Registration failed');
  } finally {
    unlockButton(btn);
  }
}

// ===== Back to Home =====
function onGoToMember() {
  window.location.href = '/portal/portal.html';
}

// ===== Get Badge =====
async function onGetBadge() {
  const badge = $('#badgeSelect').value;
  if (!badge) {
    setStatus($('#badgeStatus'), 'Please select a badge', 'error');
    return;
  }

  const btn = $('#btnGetBadge');
  lockButton(btn, 'Setting Badge...');

  try {
    // 这里可以添加设置徽章的API调用
    // await postJSON(`/users/${state.userId}/badge`, { badge: badge });
    
    // 跳转到用户门户
    await redirectToRoleHome();
    
  } catch (error) {
    console.error('Badge setting error:', error);
    setStatus($('#badgeStatus'), error.message || 'Failed to set badge', 'error');
  } finally {
    unlockButton(btn);
  }
}

// ===== 模式选择 =====
function initializeMode() {
  const urlParams = new URLSearchParams(window.location.search);
  const mode = urlParams.get('mode');
  
  if (mode === 'login') {
    currentAuthMode = 'login';
    showLoginFlow();
  } else if (mode === 'signup') {
    currentAuthMode = 'signup';
    showSignupFlow();
  } else {
    // 默认显示模式选择
    showModeSelector();
  }
}

function showModeSelector() {
  hide($('#signupFlow'));
  hide($('#loginFlow'));
  show($('#modeSelector'));
}

function showSignupFlow() {
  hide($('#modeSelector'));
  hide($('#loginFlow'));
  show($('#signupFlow'));
  updateStep();
}

function showLoginFlow() {
  hide($('#modeSelector'));
  hide($('#signupFlow'));
  show($('#loginFlow'));
  
  // 重置登录步骤显示（装饰性）
  $('#loginStep1tag')?.classList.add('active');
  $('#loginStep2tag')?.classList.remove('active');
}

function backToModeSelector() {
  clearState();
  showModeSelector();
}

// ===== 登录功能 =====
async function onSendLoginCode() {
  const email = $('#loginEmailInput').value.trim();
  if (!email) {
    setStatus($('#loginEmailStatus'), 'Please enter your email address', 'error');
    return;
  }

  const btn = $('#btnSendLoginCode');
  lockButton(btn, 'Sending Magic Link...');

  try {
    const response = await postJSON(ENDPOINTS.createMagicLink, {
      email: email,
      purpose: 'signin'
    });

    // 保持在第1步，显示简化状态
    setStatus($('#loginEmailStatus'), 'Magic link sent! Check your inbox and click the link to sign in.', 'success');
    
    // 开始重发倒计时（按钮会变成Resend）
    startLoginEmailResend();
    
    // 确保第1步保持激活状态
    $('#loginStep1tag')?.classList.add('active');
    $('#loginStep2tag')?.classList.remove('active');
    
  } catch (error) {
    console.error('Send login magic link error:', error);
    setStatus($('#loginEmailStatus'), error.message || 'Failed to send magic link', 'error');
  } finally {
    unlockButton(btn);
  }
}

function onBackToLoginEmail() {
  // 清除重发倒计时
  if (state.emailResendTimer) {
    clearInterval(state.emailResendTimer);
    state.emailResendTimer = null;
  }
  
  // 重置倒计时状态
  state.emailResendLeft = 0;
  
  // 重置按钮状态
  const btn = $('#btnSendLoginCode');
  if (btn) {
    btn.disabled = false;
    btn.textContent = 'Send Magic Link';
  }
  
  // 显示切换选项
  show($('#loginAuthSwitch'));
  setStatus($('#loginEmailStatus'), 'We\'ll send a magic link to your email.', 'info');
  $('#loginEmailInput').value = state.email || '';
}

// ===== 步骤更新 =====
function updateStep(step = null) {
  if (step !== null) {
    state.currentStep = step;
  }
  
  // 更新步骤指示器
  const steps = $$('.step');
  steps.forEach((stepEl, index) => {
    if (index + 1 <= state.currentStep) {
      stepEl.classList.add('active');
    } else {
      stepEl.classList.remove('active');
    }
  });
  
  // 确保当前步骤的指示器是激活的
  for (let i = 1; i <= 3; i++) {
    const stepTag = $(`#step${i}tag`);
    if (stepTag) {
      if (i <= state.currentStep) {
        stepTag.classList.add('active');
      } else {
        stepTag.classList.remove('active');
      }
    }
  }
  
  // 显示/隐藏相应的步骤内容
  if (currentAuthMode === 'signup') {
    // 注册流程：3个步骤
    for (let i = 1; i <= 3; i++) {
      const stepEl = $(`#step${i}`);
      if (stepEl) {
        if (i === state.currentStep) {
          show(stepEl);
        } else {
          hide(stepEl);
        }
      }
    }
  } else if (currentAuthMode === 'login') {
    // 登录流程：2个步骤
    for (let i = 1; i <= 2; i++) {
      const stepEl = $(`#loginStep${i}`);
      if (stepEl) {
        if (i === state.currentStep) {
          show(stepEl);
        } else {
          hide(stepEl);
        }
      }
    }
  }
}

// ===== 初始化 =====
function initializeApp() {
  // 初始化模式选择
  initializeMode();
  
  // 检查是否从magic link直接跳转过来
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token');
  const purpose = params.get('purpose');
  const email = params.get('email');
  const verifiedFlag = params.get('verified');
  
  // 如果有magic link参数，先验证
  if (token && purpose && email) {
    handleMagicLinkVerification(token, purpose, email);
    return; // 验证完成后会重新加载页面
  }
  
  // 若从 /verify 返回并带 verified=true，不要清空会话状态
  if (verifiedFlag !== 'true') {
    sessionStorage.removeItem('authState');
    clearState();
  }
  
  // 加载保存的状态
  const hasState = loadState();
  
  if (hasState && currentAuthMode === 'signup') {
    // 恢复注册流程
    showSignupFlow();
    
    // 如果是从verify页面返回（verified=true），直接跳转到对应步骤
    if (verifiedFlag === 'true') {
      // 从verify页面返回，直接跳转到当前步骤
      updateStep(state.currentStep);
    } else if (state.email) {
      // 普通恢复，显示第1步的"Magic Link Sent"状态
      $('#emailInput').value = state.email;
      $('#emailInput').disabled = true;
      hide($('#btnSend'));
      show($('#emailSentSection'));
      $('#emailDisplay').textContent = state.email;
      setStatus($('#emailStatus'), 'Magic link sent! Check your inbox.', 'success');
      hide($('#authSwitch'));
      updateStep(state.currentStep);
    } else {
      updateStep(state.currentStep);
    }
    
    if (state.username) {
      $('#usernameInput').value = state.username;
      if (state.currentStep === 3) {
        $('#badgeName').textContent = state.username;
      }
    }
  } else if (currentAuthMode === 'signup') {
    // 显式是注册模式但无保存状态
    updateStep(1);
  }
  
  // 绑定事件监听器
  $('#btnSend')?.addEventListener('click', onSendEmail);
  $('#btnBackToEmailInput')?.addEventListener('click', onBackToEmail);
  $('#btnSubmitOath')?.addEventListener('click', onTakeOath);
  $('#btnGetBadge')?.addEventListener('click', onGetBadge);
  $('#btnGoToMember')?.addEventListener('click', onGoToMember);
  $('#btnSendLoginCode')?.addEventListener('click', onSendLoginCode);
  $('#btnBackToLoginEmail')?.addEventListener('click', onBackToLoginEmail);
  $('#usernameInput')?.addEventListener('input', onUsernameInput);
  $('#chkOath')?.addEventListener('change', onOathCheckboxChange);
  
  // 模式切换
  $('#switchToLogin')?.addEventListener('click', (e) => {
    e.preventDefault();
    currentAuthMode = 'login';
    showLoginFlow();
  });
  
  $('#switchToSignup')?.addEventListener('click', (e) => {
    e.preventDefault();
    currentAuthMode = 'signup';
    showSignupFlow();
  });
}

// ===== Magic Link 验证 =====
async function handleMagicLinkVerification(token, purpose, email) {
  try {
    // 显示模态框
    showVerificationModal(purpose);
    
    // 验证magic link
    const response = await fetch(`${API_BASE}/magic-links/verify?token=${token}&purpose=${purpose}&email=${email}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();

    if (response.ok && data.verified) {
      if (purpose === 'signin') {
        // 登录流程
        await handleSignInFromMagicLink(data);
      } else if (purpose === 'signup') {
        // 注册流程
        await handleSignUpFromMagicLink(data, email);
      } else if (purpose === 'change_email') {
        // 邮箱变更流程
        await handleEmailChangeFromMagicLink(data);
      }
    } else {
      const errorMessage = data.detail?.detail || data.detail || 'Verification failed';
      showVerificationError(`Verification failed: ${errorMessage}`);
    }
  } catch (error) {
    console.error('Magic link verification error:', error);
    showVerificationError('Network error. Please try again.');
  }
}

// 处理登录
async function handleSignInFromMagicLink(data) {
  try {
    const sessionResponse = await fetch(`${API_BASE}/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        proof_token: data.proof_token
      })
    });

    if (sessionResponse.ok) {
      const sessionData = await sessionResponse.json();
      sessionStorage.setItem('authToken', sessionData.access_token);
      
      showVerificationSuccess('Login successful! Redirecting...');
      setTimeout(() => {
        hideVerificationModal();
        redirectToRoleHome();
      }, 1500);
    } else {
      const errorData = await sessionResponse.json();
      showVerificationError(`Login failed: ${errorData.detail?.detail || errorData.detail}`);
    }
  } catch (error) {
    console.error('Sign in error:', error);
    showVerificationError('Login error. Please try again.');
  }
}

// 处理注册
async function handleSignUpFromMagicLink(data, email) {
  try {
    // 保存状态并跳转到第2步
    const saved = {
      email: email,
      emailProofToken: data.proof_token,
      registrationId: data.subject_id || '',
      currentStep: 2
    };
    sessionStorage.setItem('authState', JSON.stringify(saved));
    
    showVerificationSuccess('Email verified! Redirecting to registration...');
    setTimeout(() => {
      hideVerificationModal();
      window.location.href = '/auth/auth.html?mode=signup&verified=true';
    }, 1500);
  } catch (error) {
    console.error('Sign up error:', error);
    showVerificationError('Registration error. Please try again.');
  }
}

// 处理邮箱变更
async function handleEmailChangeFromMagicLink(data) {
  showVerificationSuccess('Email changed successfully! Redirecting...');
  setTimeout(() => {
    hideVerificationModal();
    window.location.href = '/portal/portal.html';
  }, 1500);
}

// ===== 验证模态框控制 =====
function showVerificationModal(purpose) {
  const modal = $('#verificationModal');
  const title = $('#verificationTitle');
  const message = $('#verificationMessage');
  const error = $('#verificationError');
  
  // 根据用途设置不同的标题和消息
  if (purpose === 'signin') {
    title.textContent = 'Signing In...';
    message.textContent = 'Please wait while we verify your credentials and sign you in.';
  } else if (purpose === 'signup') {
    title.textContent = 'Verifying Email...';
    message.textContent = 'Please wait while we verify your email and prepare your registration.';
  } else if (purpose === 'change_email') {
    title.textContent = 'Updating Email...';
    message.textContent = 'Please wait while we update your email address.';
  } else {
    title.textContent = 'Verifying Magic Link';
    message.textContent = 'Please wait while we verify your credentials...';
  }
  
  // 隐藏错误信息，显示加载动画
  hide(error);
  show(modal);
}

function showVerificationSuccess(message) {
  const modal = $('#verificationModal');
  const title = $('#verificationTitle');
  const messageEl = $('#verificationMessage');
  const error = $('#verificationError');
  const spinner = modal.querySelector('.loading-spinner');
  
  title.textContent = 'Success!';
  messageEl.textContent = message;
  hide(error);
  hide(spinner);
  show(modal);
}

function showVerificationError(errorMessage) {
  const modal = $('#verificationModal');
  const title = $('#verificationTitle');
  const message = $('#verificationMessage');
  const error = $('#verificationError');
  const spinner = modal.querySelector('.loading-spinner');
  
  title.textContent = 'Verification Failed';
  message.textContent = 'Something went wrong during verification.';
  error.textContent = errorMessage;
  
  hide(spinner);
  show(error);
  show(modal);
  
  // 3秒后自动关闭模态框
  setTimeout(() => {
    hideVerificationModal();
  }, 3000);
}

function hideVerificationModal() {
  hide($('#verificationModal'));
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', initializeApp);
