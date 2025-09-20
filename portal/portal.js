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

function showError(message) {
  const toast = $('#errorToast');
  const messageEl = toast?.querySelector('.error-message');
  
  if (toast && messageEl) {
    messageEl.textContent = message;
    toast.style.display = 'flex';
    setTimeout(() => toast.style.display = 'none', 3000);
  } else {
    alert(message);
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
function loadBadges() {
  // 简化版徽章加载 - 可以根据需要扩展
  console.log('Badges loaded');
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
    const response = await apiCall('/api/payment/create-checkout-session', {
      method: 'POST',
      body: JSON.stringify({ type: 'renewal' })
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
  try {
    const response = await apiCall('/api/payment/create-checkout-session', {
      method: 'POST',
      body: JSON.stringify({ type: 'donation' })
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
        <h4>${purchase.description || 'Purchase'}</h4>
        <p>${formatDate(purchase.created_at)}</p>
      </div>
      <div class="history-amount">
        $${(purchase.amount / 100).toFixed(2)}
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
    'btnLogout': logout
  };
  
  Object.entries(events).forEach(([id, handler]) => {
    const element = $(id);
    if (element) {
      element.addEventListener('click', handler);
    }
  });
}

// ===== 初始化 =====
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
    loadBadges();
    loadPurchaseHistory();
    
    // 等待QRCode库加载
    if (typeof QRCode !== 'undefined') {
      generateQRCode();
    } else {
      setTimeout(() => {
        if (typeof QRCode !== 'undefined') generateQRCode();
      }, 2000);
    }
  } catch (error) {
    console.error('Initialization failed:', error);
    showError('Failed to initialize portal');
  }
}

// ===== 页面加载 =====
document.addEventListener('DOMContentLoaded', initializePortal);