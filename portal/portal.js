// ===== PORTAL JAVASCRIPT =====

// 配置
const API_BASE = 'https://api.mythicalhelper.org';

// 全局状态
let currentUser = null;
const portalState = { emailTxId: '', newEmail: '', emailResendExpiry: 0 };
let isInEmailChangeFlow = false;

// 编辑模式状态
let isEditMode = false;
let editedBadges = [];

// 购买历史状态
let purchaseHistory = [];

// ===== UTILITY FUNCTIONS =====
function $(id) {
  return document.getElementById(id);
}

// ===== QR码生成 =====
function generateQRCode() {
  const qrContainer = document.getElementById('qrCode');
  if (!qrContainer || !currentUser) return;
  
  // 生成QR码数据（用户ID和用户名）
  const qrData = JSON.stringify({
    userId: currentUser.user_id,
    username: currentUser.username,
    timestamp: Date.now()
  });
  
  // 清空容器
  qrContainer.innerHTML = '';
  
  // 使用QRCode.js生成QR码
  if (typeof QRCode !== 'undefined') {
    new QRCode(qrContainer, {
      text: qrData,
      width: 200,
      height: 200,
      colorDark: '#000000',
      colorLight: '#ffffff',
      correctLevel: QRCode.CorrectLevel.M
    });
  } else {
    // 如果QRCode.js未加载，显示占位符
    qrContainer.innerHTML = '<div style="width: 200px; height: 200px; background: #f0f0f0; display: flex; align-items: center; justify-content: center; border: 2px dashed #ccc;">QR Code</div>';
  }
}

// ===== 编辑模式功能 =====
function toggleEditMode() {
  isEditMode = !isEditMode;
  
  const editModeBtn = document.getElementById('btnToggleEditMode');
  const headerEditActions = document.getElementById('headerEditActions');
  const badgesDisplay = document.getElementById('badgesDisplay');
  const badgesEdit = document.getElementById('badgesEdit');
  
  if (isEditMode) {
    // 进入编辑模式
    if (editModeBtn) editModeBtn.textContent = 'Exit Edit';
    if (headerEditActions) headerEditActions.style.display = 'flex';
    if (badgesDisplay) badgesDisplay.style.display = 'none';
    if (badgesEdit) badgesEdit.style.display = 'block';
    
    // 加载可编辑的badges
    loadEditableBadges();
  } else {
    // 退出编辑模式
    if (editModeBtn) editModeBtn.textContent = 'Edit Mode';
    if (headerEditActions) headerEditActions.style.display = 'none';
    if (badgesDisplay) badgesDisplay.style.display = 'block';
    if (badgesEdit) badgesEdit.style.display = 'none';
    
    // 重置编辑状态
    editedBadges = [];
  }
}

function loadEditableBadges() {
  const badgesEditList = document.getElementById('badgesEditList');
  if (!badgesEditList) return;
  
  // 模拟badges数据
  const badges = currentUser?.badges || {};
  const badgesArray = Object.entries(badges).map(([id, badge]) => ({
    id,
    ...badge
  }));
  
  if (badgesArray.length === 0) {
    badgesEditList.innerHTML = '<p class="no-badges">No badges to edit</p>';
    return;
  }
  
  badgesEditList.innerHTML = badgesArray.map(badge => `
    <div class="badge-edit-item" data-badge-id="${badge.id}">
      <div class="badge-edit-content">
        <input type="text" value="${badge.name || ''}" placeholder="Badge name" class="badge-name-input">
        <textarea placeholder="Badge description" class="badge-desc-input">${badge.description || ''}</textarea>
      </div>
      <div class="badge-edit-actions">
        <button class="btn small" onclick="deleteBadge('${badge.id}')">Delete</button>
      </div>
    </div>
  `).join('');
}

function saveBadges() {
  // 收集编辑后的badges数据
  const badgeItems = document.querySelectorAll('.badge-edit-item');
  const updatedBadges = {};
  
  badgeItems.forEach(item => {
    const badgeId = item.dataset.badgeId;
    const nameInput = item.querySelector('.badge-name-input');
    const descInput = item.querySelector('.badge-desc-input');
    
    if (nameInput && nameInput.value.trim()) {
      updatedBadges[badgeId] = {
        name: nameInput.value.trim(),
        description: descInput?.value.trim() || ''
      };
    }
  });
  
  // 这里应该调用API保存badges
  console.log('Saving badges:', updatedBadges);
  
  // 更新当前用户数据
  if (currentUser) {
    currentUser.badges = updatedBadges;
  }
  
  // 退出编辑模式
  toggleEditMode();
  
  // 重新加载badges显示
  loadBadges();
}

function cancelEdit() {
  toggleEditMode();
}

function deleteBadge(badgeId) {
  if (confirm('Are you sure you want to delete this badge?')) {
    const badgeItem = document.querySelector(`[data-badge-id="${badgeId}"]`);
    if (badgeItem) {
      badgeItem.remove();
    }
  }
}

function addBadge() {
  const badgesEditList = document.getElementById('badgesEditList');
  if (!badgesEditList) return;
  
  const newBadgeId = 'badge_' + Date.now();
  const newBadgeHtml = `
    <div class="badge-edit-item" data-badge-id="${newBadgeId}">
      <div class="badge-edit-content">
        <input type="text" value="" placeholder="Badge name" class="badge-name-input">
        <textarea placeholder="Badge description" class="badge-desc-input"></textarea>
      </div>
      <div class="badge-edit-actions">
        <button class="btn small" onclick="deleteBadge('${newBadgeId}')">Delete</button>
      </div>
    </div>
  `;
  
  badgesEditList.insertAdjacentHTML('beforeend', newBadgeHtml);
}

// ===== 支付功能 =====
async function renewMembership() {
  console.log('Starting membership renewal...');
  
  const btn = document.getElementById('btnRenewMembership');
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Processing...';
  }
  
  try {
    // 调用后端API创建Stripe checkout session
    const response = await apiCall('/api/payment/renewal', {
      method: 'POST',
      body: JSON.stringify({})
    });
    
    if (response && response.checkout_url) {
      // 重定向到Stripe checkout页面
      window.location.href = response.checkout_url;
    } else {
      throw new Error('Invalid response from payment server');
    }
  } catch (error) {
    console.error('Failed to create renewal session:', error);
    showError('Failed to start payment process. Please try again.');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'RENEW YOUR ENCHANTMENT';
    }
  }
}

async function makeDonation() {
  console.log('Starting donation process...');
  
  // 获取捐赠金额
  const amount = prompt('Enter donation amount (minimum $1.00):');
  if (!amount) return;
  
  const amountCents = Math.round(parseFloat(amount) * 100);
  if (amountCents < 100) {
    showError('Minimum donation amount is $1.00');
    return;
  }
  
  const btn = document.getElementById('btnMakeDonation');
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Processing...';
  }
  
  try {
    // 调用后端API创建Stripe checkout session
    const response = await apiCall('/api/payment/donation', {
      method: 'POST',
      body: JSON.stringify({
        amount: amountCents
      })
    });
    
    if (response && response.checkout_url) {
      // 重定向到Stripe checkout页面
      window.location.href = response.checkout_url;
    } else {
      throw new Error('Invalid response from payment server');
    }
  } catch (error) {
    console.error('Failed to create donation session:', error);
    showError('Failed to start donation process. Please try again.');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'SHARE A GIFT OF KINDNESS';
    }
  }
}

// ===== 购买历史加载 =====
async function loadPurchaseHistory() {
  const historyLoading = document.getElementById('historyLoading');
  const historyList = document.getElementById('historyList');
  const noHistory = document.getElementById('noHistory');
  
  if (historyLoading) historyLoading.style.display = 'block';
  if (noHistory) noHistory.style.display = 'none';
  
  try {
    // 调用API获取购买历史
    const history = await apiCall('/api/payment/history');
    purchaseHistory = history || [];
    
    if (historyLoading) historyLoading.style.display = 'none';
    
    if (purchaseHistory.length === 0) {
      if (noHistory) noHistory.style.display = 'block';
    } else {
      displayPurchaseHistory();
    }
  } catch (error) {
    console.error('Failed to load purchase history:', error);
    if (historyLoading) historyLoading.style.display = 'none';
    if (noHistory) {
      noHistory.innerHTML = '<p>Failed to load purchase history</p>';
      noHistory.style.display = 'block';
    }
  }
}

function displayPurchaseHistory() {
  const historyList = document.getElementById('historyList');
  if (!historyList) return;
  
  const historyHtml = purchaseHistory.map(purchase => `
    <div class="history-item">
      <div class="history-info">
        <h4>${purchase.type || 'Purchase'}</h4>
        <p class="history-date">${formatDate(purchase.created_at)}</p>
      </div>
      <div class="history-amount">
        <span class="amount">$${purchase.amount || '0.00'}</span>
        <span class="status ${purchase.status || 'completed'}">${purchase.status || 'Completed'}</span>
      </div>
    </div>
  `).join('');
  
  historyList.innerHTML = historyHtml;
}

// ===== Badges显示 =====
function loadBadges() {
  const badgesGrid = document.getElementById('badgesGrid');
  const noBadges = document.getElementById('noBadges');
  
  if (!badgesGrid) return;
  
  const badges = currentUser?.badges || {};
  const badgesArray = Object.entries(badges).map(([id, badge]) => ({
    id,
    ...badge
  }));
  
  if (badgesArray.length === 0) {
    if (noBadges) noBadges.style.display = 'block';
    badgesGrid.innerHTML = '';
  } else {
    if (noBadges) noBadges.style.display = 'none';
    badgesGrid.innerHTML = badgesArray.map(badge => `
      <div class="badge-item" data-badge-id="${badge.id}">
        <div class="badge-icon">🏆</div>
        <div class="badge-content">
          <h4>${badge.name || 'Unnamed Badge'}</h4>
          <p>${badge.description || 'No description'}</p>
        </div>
      </div>
    `).join('');
  }
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

// ===== 邮箱变更 (Magic Link) =====
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
    btn.textContent = 'Send Magic Link';
    btn.disabled = false;
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

// Email 主按钮：发送 Magic Link
function onEmailPrimaryClick() {
  console.log('onEmailPrimaryClick called');
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
  
  // 禁用按钮
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Sending...';
  }
  
  try {
    // 发送 Magic Link 到新邮箱
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
      
      // 更新UI显示Magic Link已发送
      const label = document.getElementById('emailLabel');
      const inputEl = document.getElementById('newEmailInput');
      const primary = document.getElementById('btnSendEmailCode');
      
      if (label) label.textContent = 'Magic Link Sent!';
      if (inputEl) {
        inputEl.value = 'Check your email and click the magic link';
        inputEl.disabled = true;
      }
      if (primary) {
        primary.textContent = 'Magic Link Sent';
        primary.disabled = true;
      }
      
      showSuccess('Magic link sent! Check your email and click the link to confirm the change.');
    }
  } catch (error) {
    console.error('Failed to send magic link:', error);
    let errorMessage = 'Failed to send magic link';
    if (error && error.message) {
      errorMessage = error.message;
    }
    if (err) err.textContent = errorMessage;
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Send Magic Link';
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
  
  const cancelEmailBtn = $('#btnCancelEmailChange');
  if (cancelEmailBtn) cancelEmailBtn.addEventListener('click', () => {
    clearEmailChangeState();
    resetEmailEditorUI(true);
    const profileCard = document.getElementById('profileCard');
    const emailChangeCard = document.getElementById('emailChangeCard');
    if (profileCard) profileCard.style.display = 'block';
    if (emailChangeCard) emailChangeCard.style.display = 'none';
  });
  
  // 编辑模式按钮
  const editModeBtn = $('#btnToggleEditMode');
  if (editModeBtn) editModeBtn.addEventListener('click', toggleEditMode);
  
  // 编辑模式相关按钮
  const saveBadgesBtn = $('#btnSaveBadges');
  if (saveBadgesBtn) saveBadgesBtn.addEventListener('click', saveBadges);
  
  const cancelEditBtn = $('#btnCancelEdit');
  if (cancelEditBtn) cancelEditBtn.addEventListener('click', cancelEdit);
  
  const addBadgeBtn = $('#btnAddBadge');
  if (addBadgeBtn) addBadgeBtn.addEventListener('click', addBadge);
  
  // 支付按钮
  const renewMembershipBtn = $('#btnRenewMembership');
  if (renewMembershipBtn) renewMembershipBtn.addEventListener('click', renewMembership);
  
  const makeDonationBtn = $('#btnMakeDonation');
  if (makeDonationBtn) makeDonationBtn.addEventListener('click', makeDonation);
  
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

// ===== 支付结果处理 =====
function handlePaymentResult() {
  const urlParams = new URLSearchParams(window.location.search);
  const renewal = urlParams.get('renewal');
  const donation = urlParams.get('donation');
  
  if (renewal === 'success') {
    showSuccess('Payment successful! Your membership has been renewed for another year.');
    // 重新加载用户数据以更新有效期
    loadUserData();
    // 清除URL参数
    window.history.replaceState({}, document.title, window.location.pathname);
  } else if (renewal === 'cancelled') {
    showError('Payment was cancelled. You can try again anytime.');
    // 清除URL参数
    window.history.replaceState({}, document.title, window.location.pathname);
  }
  
  if (donation === 'success') {
    showSuccess('Thank you for your donation! Your generosity helps our guild shine brighter.');
    // 重新加载购买历史
    loadPurchaseHistory();
    // 清除URL参数
    window.history.replaceState({}, document.title, window.location.pathname);
  } else if (donation === 'cancelled') {
    showError('Donation was cancelled. You can try again anytime.');
    // 清除URL参数
    window.history.replaceState({}, document.title, window.location.pathname);
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
  
  // 处理支付结果
  handlePaymentResult();
  
  // 设置事件监听器
  setupEventListeners();
  
  // 加载用户数据
  loadUserData().then(() => {
    console.log('User data loaded successfully');
    
    // 用户数据加载完成后，初始化其他功能
    generateQRCode();
    loadBadges();
    loadPurchaseHistory();
  }).catch(error => {
    console.error('Failed to load user data:', error);
  });
  
  // 恢复邮箱变更进行中的状态（防止 Live Server 刷新中断）
  clearExpiredChangeState();
  if (loadPortalChangeState()) {
    console.log('Restoring email change state...');
    // Email 恢复 - 现在使用Magic Link
    if (portalState.emailTxId) {
      const profileCard = document.getElementById('profileCard');
      const baseHeight = profileCard ? profileCard.offsetHeight : 0;
      const emailSec = document.getElementById('emailChangeCard'); 
      if (emailSec) { 
        emailSec.style.display = 'block'; 
        if (baseHeight) emailSec.style.minHeight = `${baseHeight}px`; 
      }
      const label = document.getElementById('emailLabel'); 
      if (label) label.textContent = 'Magic Link Sent!';
      const input = document.getElementById('newEmailInput');
      if (input) {
        input.value = 'Check your email and click the magic link';
        input.disabled = true;
      }
      const primary = document.getElementById('btnSendEmailCode'); 
      if (primary) {
        primary.textContent = 'Magic Link Sent';
        primary.disabled = true;
      }
    }
  }
}

// ===== 页面加载完成后初始化 =====
document.addEventListener('DOMContentLoaded', initializePortal);
