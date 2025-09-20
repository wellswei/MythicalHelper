// ===== PORTAL JAVASCRIPT =====

// portal.js — user portal functionality v20250107-24
console.log('=== PORTAL.JS LOADED v20250107-24 ===');
// 配置
const API_BASE = 'https://api.mythicalhelper.org';

// 全局状态
let currentUser = null;
let isEditMode = false;
let purchaseHistory = [];

// ===== 工具函数 =====
function $(id) {
  const element = document.getElementById(id);
  if (!element) {
    console.warn(`Element with id "${id}" not found in DOM`);
  }
  return element;
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
  window.location.href = '../index.html';
}

// ===== 用户数据管理 =====
async function loadUserData() {
  try {
    console.log('Loading user data...');
    console.log('Auth token:', sessionStorage.getItem('authToken') ? 'Present' : 'Missing');
    
    currentUser = await apiCall('/users/me');
    console.log('User data loaded:', currentUser);
    
    updateUserInfo();
    return currentUser;
  } catch (error) {
    console.error('Failed to load user data:', error);
    if (error.message.includes('401')) {
      console.log('Authentication failed, redirecting to auth...');
      logout();
    } else {
      showError('Failed to load user data');
    }
    throw error;
  }
}

function updateUserInfo() {
  console.log('Updating user info...');
  console.log('Current user:', currentUser);
  
  if (!currentUser) {
    console.log('No current user data, skipping update');
    return;
  }
  
  const fields = {
    userName: currentUser.username || 'Unknown User',
    userEmail: currentUser.email || 'No Email',
    userCreatedAt: formatDate(currentUser.created_at) || 'Unknown',
    userValidUntil: formatDate(currentUser.valid_until) || 'Unknown'
  };
  
  console.log('Fields to update:', fields);
  
  Object.entries(fields).forEach(([id, value]) => {
    const element = $(id);
    console.log(`Updating ${id}:`, element ? 'Found' : 'Not found', 'Value:', value);
    if (element) element.textContent = value;
  });
}

// ===== QR码生成 =====
async function generateQRCode() {
  console.log('=== QR Code Generation Debug ===');
  const container = $('#qrCode');
  console.log('QR container element:', container);
  console.log('Current user:', currentUser);
  
  if (!container) {
    console.error('QR container not found! Looking for #qrCode');
    return;
  }
  
  if (!currentUser) {
    console.error('Current user not available!');
    return;
  }
  
  // 清空容器
  container.innerHTML = '';
  console.log('QR container cleared');
  
  try {
    // 检查QRCode库是否加载
    console.log('QRCode library available:', typeof QRCode !== 'undefined');
    console.log('QRCode object:', window.QRCode);
    
    if (typeof QRCode === 'undefined') {
      throw new Error('QRCode library not loaded');
    }

     // 创建QR码数据
     const qrData = JSON.stringify({
       id: currentUser.user_id,
       userId: currentUser.user_id, // 保持向后兼容
       username: currentUser.username,
       email: currentUser.email,
       timestamp: Date.now()
     });

    console.log('QR data to encode:', qrData);
    console.log('QR data length:', qrData.length);

     // 使用QRCode.js库的构造函数API
     console.log('Creating QRCode with options:', {
       text: qrData,
       width: 200,
       height: 200,
       colorDark: '#000000',
       colorLight: '#ffffff',
       correctLevel: QRCode.CorrectLevel.M
     });
     
     const qr = new QRCode(container, {
       text: qrData,
       width: 200,
       height: 200,
       colorDark: '#000000',
       colorLight: '#ffffff',
       correctLevel: QRCode.CorrectLevel.M
     });
     
     console.log('QRCode instance created:', qr);
     console.log('Container after QR creation:', container.innerHTML.length, 'characters');

    console.log('QR code generated successfully');
  } catch (error) {
    console.error('Failed to generate QR code:', error);
    console.error('Error stack:', error.stack);
    container.innerHTML = `
      <div style="width: 200px; height: 200px; background: #f0f0f0; display: flex; align-items: center; justify-content: center; border: 2px dashed #ccc; text-align: center;">
        QR Code Error<br>
        <small>${error.message}</small>
      </div>
    `;
  }
  console.log('=== QR Code Generation Debug End ===');
}

// ===== 徽章管理 =====
async function loadBadges() {
  console.log('=== Load Badges Debug ===');
  const badgesGrid = $('#badgesGrid');
  const noBadges = $('#noBadges');
  
  console.log('Badges grid element:', badgesGrid);
  console.log('No badges element:', noBadges);
  console.log('Current user badges:', currentUser?.badges);
  console.log('Is edit mode:', isEditMode);
  
  if (!badgesGrid) {
    console.error('Badges grid not found! Looking for #badgesGrid');
    return;
  }
  
  if (!currentUser?.badges) {
    console.log('No current user or badges data available');
    return;
  }
  
  const badges = Object.entries(currentUser.badges);
  console.log('Badges entries:', badges);
  console.log('Number of badges:', badges.length);
  
  if (badges.length === 0) {
    console.log('No badges found, showing no badges message');
    if (noBadges) noBadges.style.display = 'block';
    if (badgesGrid) badgesGrid.innerHTML = '';
    return;
  }
  
  console.log('Displaying badges');
  if (noBadges) noBadges.style.display = 'none';
  
  const badgesHTML = badges.map(([id, badge]) => {
    console.log(`Rendering badge ${id}:`, badge);
    return `
      <div class="badge-item" data-badge-id="${id}">
        <div class="badge-icon">🏆</div>
        <div class="badge-content">
          <h4>${badge.name || 'Unnamed Badge'}</h4>
          <p>${badge.description || 'No description'}</p>
        </div>
        ${isEditMode ? `<button class="btn-delete" onclick="deleteBadge('${id}')">×</button>` : ''}
      </div>
    `;
  }).join('');
  
  console.log('Generated badges HTML length:', badgesHTML.length);
  badgesGrid.innerHTML = badgesHTML;
  console.log('Badges grid updated');
  console.log('=== Load Badges Debug End ===');
}

async function saveBadges() {
  if (!currentUser?.badges) return;
  
  try {
    const response = await apiCall('/users/me', {
      method: 'PATCH',
      body: JSON.stringify({ badges: currentUser.badges })
    });
    
    // 更新本地用户数据
    currentUser = response;
    updateUserInfo();
    showError('Badges saved successfully');
    return true;
  } catch (error) {
    console.error('Failed to save badges:', error);
    showError('Failed to save badges');
    return false;
  }
}

async function deleteBadge(badgeId) {
  if (!currentUser?.badges || !currentUser.badges[badgeId]) return;
  
  try {
    // 创建新的徽章对象，移除指定徽章
    const newBadges = { ...currentUser.badges };
    delete newBadges[badgeId];
    
    const response = await apiCall('/users/me', {
      method: 'PATCH',
      body: JSON.stringify({ badges: newBadges })
    });
    
    // 更新本地用户数据
    currentUser = response;
    await loadBadges(); // 重新加载徽章显示
    showError('Badge deleted successfully');
    return true;
  } catch (error) {
    console.error('Failed to delete badge:', error);
    showError('Failed to delete badge');
    return false;
  }
}

function toggleEditMode() {
  console.log('=== Toggle Edit Mode Debug ===');
  console.log('Current edit mode:', isEditMode);
  
  isEditMode = !isEditMode;
  console.log('New edit mode:', isEditMode);
  
  const editBtn = $('#btnToggleEditMode');
  const editActions = $('#headerEditActions');
  const badgesDisplay = $('#badgesDisplay');
  
  console.log('Edit button element:', editBtn);
  console.log('Edit actions element:', editActions);
  console.log('Badges display element:', badgesDisplay);
  
  if (editBtn) {
    editBtn.textContent = isEditMode ? 'Cancel Edit' : 'Edit Mode';
    console.log('Edit button text updated to:', editBtn.textContent);
  }
  
  if (editActions) {
    editActions.style.display = isEditMode ? 'flex' : 'none';
    console.log('Edit actions display set to:', editActions.style.display);
  }
  
  if (badgesDisplay) {
    badgesDisplay.classList.toggle('edit-mode', isEditMode);
    console.log('Badges display edit-mode class:', badgesDisplay.classList.contains('edit-mode'));
  }
  
  if (isEditMode) {
    console.log('Entering edit mode, loading editable badges');
    loadEditableBadges();
  } else {
    console.log('Exiting edit mode, loading normal badges');
    loadBadges(); // 退出编辑模式时重新加载正常显示
  }
  console.log('=== Toggle Edit Mode Debug End ===');
}

function loadEditableBadges() {
  console.log('=== Load Editable Badges Debug ===');
  const badgesGrid = $('#badgesGrid');
  const noBadges = $('#noBadges');
  
  console.log('Badges grid element:', badgesGrid);
  console.log('No badges element:', noBadges);
  console.log('Current user badges:', currentUser?.badges);
  
  if (!badgesGrid) {
    console.error('Badges grid not found! Looking for #badgesGrid');
    return;
  }
  
  if (!currentUser?.badges) {
    console.log('No current user or badges data available');
    return;
  }
  
  const badges = Object.entries(currentUser.badges);
  console.log('Badges entries:', badges);
  console.log('Number of badges:', badges.length);
  
  if (badges.length === 0) {
    console.log('No badges found, showing no badges message');
    if (noBadges) noBadges.style.display = 'block';
    if (badgesGrid) badgesGrid.innerHTML = '';
    return;
  }
  
  console.log('Displaying editable badges');
  if (noBadges) noBadges.style.display = 'none';
  
  const badgesHTML = badges.map(([id, badge]) => {
    console.log(`Rendering editable badge ${id}:`, badge);
    return `
      <div class="badge-item edit-mode" data-badge-id="${id}">
        <div class="badge-content">
          <h3>${badge.name || 'Unnamed Badge'}</h3>
          <p>${badge.description || 'No description'}</p>
        </div>
        <div class="badge-actions">
          <button class="btn-delete" onclick="deleteBadge('${id}')">Delete</button>
        </div>
      </div>
    `;
  }).join('');
  
  console.log('Generated editable badges HTML length:', badgesHTML.length);
  badgesGrid.innerHTML = badgesHTML;
  console.log('Editable badges grid updated');
  console.log('=== Load Editable Badges Debug End ===');
}

function saveBadges() {
  // 简化版保存徽章
  console.log('Badges saved');
  toggleEditMode();
}

function cancelEdit() {
  toggleEditMode();
}

async function addBadge() {
  const name = prompt('Enter badge name:');
  if (!name) return;
  
  const description = prompt('Enter badge description:') || 'No description';
  
  try {
    // 创建新的徽章ID
    const badgeId = `badge_${Date.now()}`;
    
    // 创建新的徽章对象
    const newBadges = { ...currentUser.badges };
    newBadges[badgeId] = {
      name: name,
      description: description,
      created_at: new Date().toISOString()
    };
    
    const response = await apiCall('/users/me', {
      method: 'PATCH',
      body: JSON.stringify({ badges: newBadges })
    });
    
    // 更新本地用户数据
    currentUser = response;
    await loadBadges(); // 重新加载徽章显示
    showError('Badge added successfully');
  } catch (error) {
    console.error('Failed to add badge:', error);
    showError('Failed to add badge');
  }
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
    console.log('Loading purchase history...');
    const response = await apiCall('/api/payment/history');
    console.log('Purchase history response:', response);
    purchaseHistory = response.history || [];
    console.log('Purchase history data:', purchaseHistory);
    
    if (loading) loading.style.display = 'none';
    
    if (purchaseHistory.length === 0) {
      console.log('No purchase history found');
      if (noHistory) noHistory.style.display = 'block';
    } else {
      console.log('Displaying purchase history');
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
  console.log('=== Portal Initialization Debug ===');
  console.log('Initializing Portal...');
  console.log('Document ready state:', document.readyState);
  console.log('Document body:', document.body);
  console.log('All elements with id qrCode:', document.querySelectorAll('#qrCode'));
  console.log('All elements with id badgesGrid:', document.querySelectorAll('#badgesGrid'));
  
  console.log('DOM elements check:');
  console.log('- #qrCode:', $('#qrCode'));
  console.log('- #badgesGrid:', $('#badgesGrid'));
  console.log('- #badgesDisplay:', $('#badgesDisplay'));
  
  // 如果元素还是找不到，等待更长时间
  if (!$('#qrCode') || !$('#badgesGrid')) {
    console.log('Elements not found, waiting 500ms more...');
    await new Promise(resolve => setTimeout(resolve, 500));
    console.log('After waiting:');
    console.log('- #qrCode:', $('#qrCode'));
    console.log('- #badgesGrid:', $('#badgesGrid'));
    
    // 如果还是找不到，再等待1秒
    if (!$('#qrCode') || !$('#badgesGrid')) {
      console.log('Elements still not found, waiting 1s more...');
      await new Promise(resolve => setTimeout(resolve, 1000));
      console.log('After 1s wait:');
      console.log('- #qrCode:', $('#qrCode'));
      console.log('- #badgesGrid:', $('#badgesGrid'));
    }
  }
  
  if (!isAuthenticated()) {
    console.log('User not authenticated, redirecting to auth');
    redirectToAuth();
    return;
  }
  
  console.log('User is authenticated, proceeding with initialization');
  handlePaymentResult();
  setupEventListeners();
  
  try {
    console.log('Starting parallel loading of QRCode library and user data...');
    
    // 并行等待QRCode库加载和用户数据
    const [qrCodeLoaded, userDataLoaded] = await Promise.allSettled([
      waitForQRCode(),
      loadUserData().then(async () => {
        console.log('User data loaded, now loading badges and purchase history...');
        await Promise.all([
          loadBadges(),
          loadPurchaseHistory()
        ]);
        console.log('Badges and purchase history loading completed');
      })
    ]);

    console.log('QRCode library loading result:', qrCodeLoaded.status);
    console.log('User data loading result:', userDataLoaded.status);
    
    if (qrCodeLoaded.status === 'rejected') {
      console.error('QRCode library loading failed:', qrCodeLoaded.reason);
    }
    
    if (userDataLoaded.status === 'rejected') {
      console.error('User data loading failed:', userDataLoaded.reason);
    }

    // 如果用户数据加载成功且QRCode库也加载成功，生成QR码
    if (currentUser && qrCodeLoaded.status === 'fulfilled') {
      console.log('Generating QR code after successful initialization');
      await generateQRCode();
    } else {
      console.warn('QR code generation skipped:', 
        qrCodeLoaded.status === 'rejected' ? qrCodeLoaded.reason : 'User data not available');
    }
    
    console.log('Portal initialization completed successfully');
  } catch (error) {
    console.error('Initialization failed:', error);
    console.error('Error stack:', error.stack);
    showError('Failed to initialize portal');
  }
  console.log('=== Portal Initialization Debug End ===');
}

// ===== 页面加载 =====
let initializationStarted = false;

function startInitialization() {
  if (initializationStarted) {
    console.log('Initialization already started, skipping');
    return;
  }
  initializationStarted = true;
  console.log('Starting portal initialization');
  initializePortal();
}

// 立即测试DOM元素
console.log('=== Immediate DOM Test ===');
console.log('Document ready state:', document.readyState);
console.log('Document body exists:', !!document.body);
console.log('All divs:', document.querySelectorAll('div').length);
console.log('Elements with id qrCode:', document.querySelectorAll('#qrCode').length);
console.log('Elements with id badgesGrid:', document.querySelectorAll('#badgesGrid').length);
console.log('=== End Immediate DOM Test ===');

// 使用window.onload确保所有资源都加载完成
window.addEventListener('load', function() {
  console.log('Window load event fired - all resources loaded');
  setTimeout(startInitialization, 200);
});

document.addEventListener('DOMContentLoaded', function() {
  console.log('DOM Content Loaded event fired');
  // 添加小延迟确保所有元素都已渲染
  setTimeout(startInitialization, 100);
});

// 备用：如果DOMContentLoaded已经触发，立即执行
if (document.readyState === 'loading') {
  console.log('Document still loading, waiting for DOMContentLoaded');
} else {
  console.log('Document already loaded, initializing immediately');
  setTimeout(startInitialization, 100);
}