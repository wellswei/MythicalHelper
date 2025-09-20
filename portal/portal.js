// ===== PORTAL JAVASCRIPT =====

// 配置
const API_BASE = 'https://api.mythicalhelper.org';

// 全局状态
let currentUser = null;
let isEditMode = false;
let purchaseHistory = [];

// ===== 工具函数 =====
function $(id) {
  return document.getElementById(id);
}

// 格式化货币
const formatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD'
});

function formatCurrency(cents) {
  return formatter.format(cents / 100);
}

function showError(message) {
  const toast = $('#errorToast');
  const messageEl = toast?.querySelector('.error-message');
  
  if (toast && messageEl) {
    messageEl.textContent = message;
    toast.style.display = 'flex';
    // 3秒后自动隐藏
    const timer = setTimeout(() => hideError(), 3000);
    // 存储timer id以便在手动关闭时清除
    toast.dataset.timerId = timer;
  } else {
    alert(message);
  }
}

function hideError() {
  const toast = $('#errorToast');
  if (toast) {
    // 清除可能存在的计时器
    const timerId = toast.dataset.timerId;
    if (timerId) clearTimeout(Number(timerId));
    // 隐藏toast
    toast.style.display = 'none';
  }
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  try {
    return new Date(dateStr).toLocaleDateString(undefined, { 
      year: 'numeric', month: 'long', day: 'numeric'
    });
  } catch (e) {
    return dateStr;
  }
}

// ===== API调用 =====
async function apiCall(endpoint, options = {}) {
  const authToken = sessionStorage.getItem('authToken');
  if (!authToken) throw new Error('No authentication token found');

  const response = await fetch(`${API_BASE}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`
    },
    ...options
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || errorData.message || `HTTP ${response.status}`);
  }

  return await response.json();
}

// ===== 认证检查 =====
function isAuthenticated() {
  return !!sessionStorage.getItem('authToken');
}

function redirectToAuth() {
  window.location.href = '../auth/auth.html';
}

function logout() {
  sessionStorage.clear();
  redirectToAuth();
}

// ===== 用户数据管理 =====
async function loadUserData() {
  try {
    currentUser = await apiCall('/users/me');
    updateUserInfo();
    return currentUser;
  } catch (error) {
    console.error('Failed to load user data:', error);
    if (error.message.includes('401')) {
      logout();
    } else {
      showError('Failed to load user data');
    }
    throw error;
  }
}

function updateUserInfo() {
  if (!currentUser) return;
  
  const fields = {
    userName: currentUser.username || 'Unknown User',
    userEmail: currentUser.email || 'No Email',
    userCreatedAt: formatDate(currentUser.created_at) || 'Unknown',
    userValidUntil: formatDate(currentUser.valid_until) || 'Unknown'
  };
  
  Object.entries(fields).forEach(([id, value]) => {
    const element = $(id);
    if (element) element.textContent = value;
  });
}

// ===== QR码生成 =====
function generateQRCode() {
  const container = $('#qrCode');
  if (!container || !currentUser) return;
  
  container.innerHTML = '';
  
  if (typeof QRCode !== 'undefined') {
    try {
      new QRCode(container, {
        text: JSON.stringify({
          userId: currentUser.user_id,
          username: currentUser.username,
          timestamp: Date.now()
        }),
        width: 200,
        height: 200,
        colorDark: '#000000',
        colorLight: '#ffffff',
        correctLevel: QRCode.CorrectLevel.M
      });
    } catch (error) {
      console.error('QR Code generation failed:', error);
      container.innerHTML = '<div style="width: 200px; height: 200px; background: #f0f0f0; display: flex; align-items: center; justify-content: center; border: 2px dashed #ccc;">QR Code Error</div>';
    }
  } else {
    container.innerHTML = '<div style="width: 200px; height: 200px; background: #f0f0f0; display: flex; align-items: center; justify-content: center; border: 2px dashed #ccc;">QR Code</div>';
  }
}

// ===== 徽章管理 =====
async function loadBadges() {
  const badgesGrid = $('#badgesGrid');
  const noBadges = $('#noBadges');
  
  if (!badgesGrid || !currentUser?.badges) return;
  
  const badges = Object.entries(currentUser.badges);
  
  if (badges.length === 0) {
    if (noBadges) noBadges.style.display = 'block';
    if (badgesGrid) badgesGrid.innerHTML = '';
    return;
  }
  
  if (noBadges) noBadges.style.display = 'none';
  badgesGrid.innerHTML = badges.map(([id, badge]) => `
    <div class="badge-item" data-badge-id="${id}">
      <div class="badge-icon">🏆</div>
      <div class="badge-content">
        <h4>${badge.name || 'Unnamed Badge'}</h4>
        <p>${badge.description || 'No description'}</p>
      </div>
    </div>
  `).join('');
}

async function saveBadge(badgeId, data) {
  try {
    await apiCall(`/api/badges/${badgeId}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
    return true;
  } catch (error) {
    showError('Failed to save badge');
    return false;
  }
}

async function deleteBadgeFromServer(badgeId) {
  try {
    await apiCall(`/api/badges/${badgeId}`, {
      method: 'DELETE'
    });
    return true;
  } catch (error) {
    showError('Failed to delete badge');
    return false;
  }
}

function toggleEditMode() {
  isEditMode = !isEditMode;
  const editBtn = $('#btnToggleEditMode');
  const editActions = $('#headerEditActions');
  const badgesDisplay = $('#badgesDisplay');
  
  if (editBtn) editBtn.textContent = isEditMode ? 'Cancel Edit' : 'Edit Mode';
  if (editActions) editActions.style.display = isEditMode ? 'flex' : 'none';
  if (badgesDisplay) badgesDisplay.classList.toggle('edit-mode', isEditMode);
}

function saveBadges() {
  // 简化版保存徽章
  console.log('Badges saved');
  toggleEditMode();
}

function cancelEdit() {
  toggleEditMode();
}

function addBadge() {
  // 简化版添加徽章
  console.log('Add badge');
}

function deleteBadge(badgeId) {
  // 简化版删除徽章
  console.log('Delete badge:', badgeId);
}

// ===== 支付功能 =====
async function renewMembership() {
  try {
    const response = await apiCall('/api/payment/renewal', {
      method: 'POST',
      body: JSON.stringify({})
    });
    
    if (response.url) {
      window.location.href = response.url;
    }
  } catch (error) {
    console.error('Renewal failed:', error);
    showError('Failed to start renewal process');
  }
}

async function makeDonation() {
  const amount = prompt('Enter donation amount (USD):');
  if (!amount || isNaN(amount) || amount <= 0) {
    showError('Please enter a valid donation amount');
    return;
  }
  
  try {
    const response = await apiCall('/api/payment/donation', {
      method: 'POST',
      body: JSON.stringify({ amount: Math.round(parseFloat(amount) * 100) })
    });
    
    if (response.url) {
      window.location.href = response.url;
    }
  } catch (error) {
    console.error('Donation failed:', error);
    showError('Failed to start donation process');
  }
}

// ===== 购买历史 =====
async function loadPurchaseHistory() {
  const loading = $('#historyLoading');
  const list = $('#historyList');
  const noHistory = $('#noHistory');
  
  if (loading) loading.style.display = 'block';
  if (noHistory) noHistory.style.display = 'none';
  
  try {
    const response = await apiCall('/api/payment/history');
    purchaseHistory = response.history || [];
    
    if (loading) loading.style.display = 'none';
    
    if (purchaseHistory.length === 0) {
      if (noHistory) noHistory.style.display = 'block';
    } else {
      displayPurchaseHistory();
    }
  } catch (error) {
    console.error('Failed to load purchase history:', error);
    if (loading) loading.style.display = 'none';
    if (noHistory) {
      noHistory.innerHTML = '<p>Failed to load purchase history</p>';
      noHistory.style.display = 'block';
    }
  }
}

function displayPurchaseHistory() {
  const list = $('#historyList');
  if (!list) return;
  
  list.innerHTML = purchaseHistory.map(purchase => `
    <div class="history-item">
      <div class="history-info">
        <h4>${purchase.type || 'Purchase'}</h4>
        <p>${formatDate(purchase.date)}</p>
      </div>
      <div class="history-amount">
        <span class="amount">${purchase.amount || '$0.00'}</span>
        <span class="status ${(purchase.status || 'completed').toLowerCase()}">${purchase.status || 'Completed'}</span>
      </div>
    </div>
  `).join('');
}

// ===== 邮箱变更 =====
async function startEmailChange() {
  const newEmail = prompt('Enter new email address:');
  if (!newEmail) return;
  
  try {
    await apiCall('/magic-links', {
      method: 'POST',
      body: JSON.stringify({
        email: newEmail,
        purpose: 'change_email'
      })
    });
    
    showError('Magic link sent to your new email address');
  } catch (error) {
    console.error('Email change failed:', error);
    showError('Failed to send magic link');
  }
}

// ===== 支付结果处理 =====
function handlePaymentResult() {
  const urlParams = new URLSearchParams(window.location.search);
  const success = urlParams.get('payment_success');
  const sessionId = urlParams.get('session_id');
  
  if (success === 'true' && sessionId) {
    showError('Payment successful! Thank you for your support.');
    // 清理URL参数
    window.history.replaceState({}, document.title, window.location.pathname);
  }
}

// ===== 事件监听器 =====
function setupEventListeners() {
  const events = {
    'btnToggleEditMode': toggleEditMode,
    'btnSaveBadges': saveBadges,
    'btnCancelEdit': cancelEdit,
    'btnAddBadge': addBadge,
    'btnRenewMembership': renewMembership,
    'btnMakeDonation': makeDonation,
    'btnChangeEmail': startEmailChange,
    'btnDeleteAccount': () => showError('Account deletion not implemented yet'),
    'btnLogout': logout,
    'btnCloseError': hideError
  };
  
  Object.entries(events).forEach(([id, handler]) => {
    const element = $(id);
    if (element) {
      // 移除可能存在的旧事件监听器
      const newHandler = handler.bind(null);
      element.removeEventListener('click', newHandler);
      element.addEventListener('click', newHandler);
    }
  });
}

// ===== 初始化 =====
async function waitForQRCode(timeout = 5000) {
  return new Promise((resolve, reject) => {
    if (typeof QRCode !== 'undefined') {
      resolve();
      return;
    }

    const startTime = Date.now();
    const checkInterval = 100; // 每100ms检查一次

    const check = () => {
      if (typeof QRCode !== 'undefined') {
        resolve();
      } else if (Date.now() - startTime >= timeout) {
        reject(new Error('QRCode library failed to load'));
      } else {
        setTimeout(check, checkInterval);
      }
    };

    check();
  });
}

async function initializePortal() {
  console.log('Initializing Portal...');
  
  if (!isAuthenticated()) {
    redirectToAuth();
    return;
  }
  
  handlePaymentResult();
  setupEventListeners();
  
  try {
    await loadUserData();
    await loadBadges();
    await loadPurchaseHistory();
    
    // 等待QRCode库加载
    try {
      await waitForQRCode();
      generateQRCode();
    } catch (error) {
      console.error('QRCode initialization failed:', error);
      // 继续执行其他功能，QR码显示为占位符
    }
  } catch (error) {
    console.error('Initialization failed:', error);
    showError('Failed to initialize portal');
  }
}

// ===== 页面加载 =====
document.addEventListener('DOMContentLoaded', initializePortal);