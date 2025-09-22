// ===== PORTAL JAVASCRIPT =====

// portal.js — user portal functionality v20250107-24
console.log('=== PORTAL.JS LOADED v20250107-24 ===');
// 配置
// 检测是否为本地开发环境
const isLocalDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const API_BASE = isLocalDev ? 'http://localhost:8000' : 'https://api.mythicalhelper.org';

// 全局状态
let currentUser = null;
let isEditMode = false;
let purchaseHistory = [];
let editingBadges = {};
let originalBadgesSnapshot = {};
let hasUnsavedChanges = false;

// ===== 工具函数 =====
function $(id) {
  // 移除 # 前缀（如果存在）
  const cleanId = id.startsWith('#') ? id.substring(1) : id;
  const element = document.getElementById(cleanId);
  if (!element) {
    console.warn(`Element with id "${cleanId}" not found in DOM`);
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

// 状态栏已移除

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

const REALM_OPTIONS = ['north', 'tooth', 'bunny'];
const REALM_LABELS = {
  north: 'North Pole',
  tooth: 'Tooth Fairy',
  bunny: 'Spring Bunny'
};

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function cloneBadges(source) {
  return JSON.parse(JSON.stringify(source || {}));
}

function formatRealmLabel(realm) {
  return REALM_LABELS[realm] || 'Unknown';
}

function getRealmSeal(realm) {
  const seals = {
    north: `<svg viewBox="0 0 120 120" width="120" height="120">
      <defs>
        <radialGradient id="g-north-portal" cx="50%" cy="50%" r="60%">
          <stop offset="0%" stop-color="#ffffff" stop-opacity=".2"/>
          <stop offset="100%" stop-color="#7BC4FF" stop-opacity=".25"/>
        </radialGradient>
      </defs>
      <circle cx="60" cy="60" r="52" fill="url(#g-north-portal)" stroke="#7BC4FF" stroke-width="4" opacity=".8"/>
      <circle cx="60" cy="60" r="42" fill="none" stroke="#7BC4FF" stroke-width="2" stroke-dasharray="4 6" opacity=".6"/>
      <g stroke="#5AAEFF" stroke-width="3" stroke-linecap="round" opacity=".9">
        <line x1="60" y1="32" x2="60" y2="88"/>
        <line x1="32" y1="60" x2="88" y2="60"/>
        <line x1="40" y1="40" x2="80" y2="80"/>
        <line x1="80" y1="40" x2="40" y2="80"/>
      </g>
    </svg>`,
    tooth: `<svg viewBox="0 0 120 120" width="120" height="120">
      <defs>
        <radialGradient id="g-tooth-portal" cx="50%" cy="50%" r="60%">
          <stop offset="0%" stop-color="#ffffff" stop-opacity=".2"/>
          <stop offset="100%" stop-color="#D5B8FF" stop-opacity=".25"/>
        </radialGradient>
      </defs>
      <circle cx="60" cy="60" r="52" fill="url(#g-tooth-portal)" stroke="#C39BFF" stroke-width="4" opacity=".85"/>
      <circle cx="60" cy="60" r="42" fill="none" stroke="#C39BFF" stroke-width="2" stroke-dasharray="3 5" opacity=".6"/>
      <g fill="#B285FF" opacity=".9">
        <path d="M60 42 l3 6 6 3 -6 3 -3 6 -3-6 -6-3 6-3z"/>
        <path d="M86 58 l2 4 4 2 -4 2 -2 4 -2-4 -4-2 4-2z"/>
        <path d="M34 58 l2 4 4 2 -4 2 -2 4 -2-4 -4-2 4-2z"/>
        <path d="M60 78 l2 4 4 2 -4 2 -2 4 -2-4 -4-2 4-2z"/>
      </g>
    </svg>`,
    bunny: `<svg viewBox="0 0 120 120" width="120" height="120">
      <defs>
        <radialGradient id="g-bunny-portal" cx="50%" cy="50%" r="60%">
          <stop offset="0%" stop-color="#ffffff" stop-opacity=".2"/>
          <stop offset="100%" stop-color="#9BE7B0" stop-opacity=".25"/>
        </radialGradient>
      </defs>
      <circle cx="60" cy="60" r="52" fill="url(#g-bunny-portal)" stroke="#65D08A" stroke-width="4" opacity=".85"/>
      <circle cx="60" cy="60" r="42" fill="none" stroke="#65D08A" stroke-width="2" stroke-dasharray="6 6" opacity=".55"/>
      <g fill="#49C27A" opacity=".9">
        <circle cx="60" cy="66" r="12"/>
        <circle cx="48" cy="50" r="5"/>
        <circle cx="60" cy="46" r="5"/>
        <circle cx="72" cy="50" r="5"/>
      </g>
    </svg>`
  };
  return seals[realm] || '';
}

function updateEditFooterState() {
  const saveBtn = $('#btnSaveBadges');

  if (saveBtn) {
    saveBtn.disabled = !hasUnsavedChanges;
  }
}

function updateRealmPill(badgeElement, realm) {
  const pill = badgeElement?.querySelector('.badge-realm-pill');
  if (pill) {
    pill.dataset.realm = realm;
    pill.textContent = formatRealmLabel(realm);
  }
}

function collectBadgeValues(badgeElement) {
  const badgeId = badgeElement?.dataset.badgeId;
  if (!badgeId) return null;

  const realmSelect = badgeElement.querySelector('select[name^="realm-"]');
  const watchOverInput = badgeElement.querySelector('.watch-over-input');
  const enchantedToggle = badgeElement.querySelector('.enchanted-toggle');

  const realm = realmSelect ? realmSelect.value : (editingBadges[badgeId]?.realm || 'north');
  const watchOver = watchOverInput ? watchOverInput.value.trim() : (editingBadges[badgeId]?.watchOver || '');
  const enchanted = enchantedToggle ? enchantedToggle.checked : (editingBadges[badgeId]?.enchanted || false);

  console.log(`Collecting badge ${badgeId}:`, { realm, watchOver, enchanted });
  return { badgeId, realm, watchOver, enchanted };
}

function collectAllBadgeValues() {
  const snapshot = cloneBadges(editingBadges);

  document.querySelectorAll('.edit-card').forEach(item => {
    const values = collectBadgeValues(item);
    if (!values) return;

    const { badgeId, realm, watchOver, enchanted } = values;
    const existing = snapshot[badgeId] || {};
    snapshot[badgeId] = { ...existing, realm, watchOver, enchanted };
  });

  return snapshot;
}

function computeDirtyBadgeIds() {
  const dirty = new Set();
  const original = originalBadgesSnapshot || {};
  const edited = editingBadges || {};
  const keys = new Set([...Object.keys(original), ...Object.keys(edited)]);

  keys.forEach(id => {
    const originalBadge = original[id];
    const editedBadge = edited[id];

    if (!originalBadge && editedBadge) {
      dirty.add(id);
      return;
    }

    if (originalBadge && !editedBadge) {
      dirty.add(id);
      return;
    }

    if (originalBadge && editedBadge) {
      const originalRealm = originalBadge.realm || 'north';
      const editedRealm = editedBadge.realm || 'north';
      const originalWatch = (originalBadge.watchOver || '').trim();
      const editedWatch = (editedBadge.watchOver || '').trim();
      const originalEnchanted = originalBadge.enchanted || false;
      const editedEnchanted = editedBadge.enchanted || false;

      if (originalRealm !== editedRealm || originalWatch !== editedWatch || originalEnchanted !== editedEnchanted) {
        dirty.add(id);
      }
    }
  });

  return dirty;
}

function updateUnsavedSummary() {
  const dirtyIds = computeDirtyBadgeIds();
  hasUnsavedChanges = dirtyIds.size > 0;
  updateEditFooterState();

  const original = originalBadgesSnapshot || {};
  document.querySelectorAll('.edit-card').forEach(item => {
    const badgeId = item.dataset.badgeId;
    const stateLabel = item.querySelector('[data-badge-state]');

    if (!stateLabel || !badgeId) return;

    if (!Object.prototype.hasOwnProperty.call(original, badgeId)) {
      stateLabel.textContent = 'New';
      return;
    }

    stateLabel.textContent = dirtyIds.has(badgeId) ? 'Unsaved' : 'Saved';
  });
}

function handleRealmChange(event) {
  const select = event.target;
  const badgeElement = select.closest('.edit-card');
  if (!badgeElement) return;

  const { badgeId } = badgeElement.dataset;
  if (!badgeId) return;

  const existing = editingBadges[badgeId] || {};
  editingBadges[badgeId] = { ...existing, realm: select.value };
  
  // 标记有未保存的更改
  hasUnsavedChanges = true;
  updateUnsavedSummary();
}

function handleWatchOverInput(event) {
  const input = event.target;
  const badgeElement = input.closest('.edit-card');
  if (!badgeElement) return;

  const { badgeId } = badgeElement.dataset;
  if (!badgeId) return;

  const existing = editingBadges[badgeId] || {};
  editingBadges[badgeId] = { ...existing, watchOver: input.value };
  
  // 标记有未保存的更改
  hasUnsavedChanges = true;
  updateUnsavedSummary();
}

function handleEnchantedToggle(event) {
  const toggle = event.target;
  const badgeElement = toggle.closest('.edit-card');
  if (!badgeElement) return;

  const { badgeId } = badgeElement.dataset;
  if (!badgeId) return;

  const existing = editingBadges[badgeId] || {};
  editingBadges[badgeId] = { ...existing, enchanted: toggle.checked };
  
  // 标记有未保存的更改
  hasUnsavedChanges = true;
  updateUnsavedSummary();
}

function handleBadgeDelete(event) {
  const button = event.currentTarget;
  const badgeElement = button.closest('.edit-card');
  if (!badgeElement) return;

  const { badgeId } = badgeElement.dataset;
  if (!badgeId) return;

  deleteBadge(badgeId);
  
  // 标记有未保存的更改
  hasUnsavedChanges = true;
  updateUnsavedSummary();
}

function bindBadgeEditEvents() {
  const badgesEditList = $('#badgesEditList');
  if (!badgesEditList) return;

  // 使用覆盖式绑定避免重复监听
  badgesEditList.querySelectorAll('.realm-select').forEach(select => {
    select.onchange = handleRealmChange;
  });

  badgesEditList.querySelectorAll('.enchanted-toggle').forEach(toggle => {
    toggle.onchange = handleEnchantedToggle;
  });

  badgesEditList.querySelectorAll('.watch-over-input').forEach(input => {
    input.oninput = handleWatchOverInput;
  });

  badgesEditList.querySelectorAll('.remove-btn, .badge-delete-btn').forEach(button => {
    button.onclick = handleBadgeDelete;
  });

  // 绑定“新增”卡片（整卡可点击 + 回车/空格）
  const addCard = $('#editNewBadgeCard');
  if (addCard) {
    addCard.onclick = addBadge;
    addCard.onkeydown = (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        addBadge();
      }
    };
    addCard.style.cursor = 'pointer';
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
  window.location.href = '../auth/auth.html?mode=signin';
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
    console.error('loadUserData error details:', {
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
    if (error.message.includes('401')) {
      console.log('Authentication failed, redirecting to auth...');
      console.log('Calling logout() from loadUserData');
      logout();
    } else {
      console.error('Failed to load user data');
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
    if (element) {
      element.textContent = value;
      
      // 特别处理 valid until 字段的状态样式
      if (id === 'userValidUntil') {
        // 移除之前的状态类
        element.classList.remove('valid', 'expired');
        
        if (currentUser.valid_until) {
          const validUntilDate = new Date(currentUser.valid_until);
          const now = new Date();
          
          if (validUntilDate > now) {
            // 有效期内 - 绿色
            element.classList.add('valid');
          } else {
            // 已过期 - 红色
            element.classList.add('expired');
          }
        }
      }
    }
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

     // 创建QR码数据 - 生成指向scan页面的链接
     const baseUrl = window.location.origin;
     const scanUrl = `${baseUrl}/scan/scan.html?id=${encodeURIComponent(currentUser.user_id)}`;
     const qrData = scanUrl;

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
     
     // 更新容器的title属性显示链接
     container.title = qrData;

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
  
  console.log('Badges grid element:', badgesGrid);
  console.log('Current user badges:', currentUser?.badges);
  console.log('Is edit mode:', isEditMode);
  
  if (!badgesGrid) {
    console.error('Badges grid not found! Looking for #badgesGrid');
    return;
  }
  
  if (!currentUser?.badges) {
    console.log('No current user or badges data available');
    // 显示"没有badge"的卡片
            badgesGrid.innerHTML = `
              <div class="display-card display-empty">
                <div class="no-badges-content">
                  <p class="no-badges-text">Your scroll is still blank</p>
                  <p class="no-badges-subtext">Begin your tale — create your very first badge!</p>
                </div>
              </div>
            `;
    return;
  }
  
  const badges = Object.entries(currentUser.badges);
  console.log('Badges entries:', badges);
  console.log('Number of badges:', badges.length);
  
  if (badges.length === 0) {
    console.log('No badges found, showing no badges message');
    // 显示"没有badge"的卡片
            badgesGrid.innerHTML = `
              <div class="display-card display-empty">
                <div class="no-badges-content">
                  <p class="no-badges-text">Your scroll is still blank</p>
                  <p class="no-badges-subtext">Begin your tale — create your very first badge!</p>
                </div>
              </div>
            `;
    return;
  }
  
  console.log('Displaying badges');
  
  const badgesHTML = badges.map(([id, badge]) => {
    console.log(`Rendering badge ${id}:`, badge);
    const realm = badge?.realm || 'north';
    const watchOver = badge?.watchOver || '';
    const isEnchanted = badge?.enchanted || false;
    const realmLabel = formatRealmLabel(realm);
    const realmSeal = getRealmSeal(realm);
    
    return `
      <div class="display-card" data-badge-id="${id}">
        <div class="display-row display-top">
          <div class="display-status">
            <span class="status-badge ${isEnchanted ? 'active' : 'inactive'}">
              ${isEnchanted ? 'Active' : 'Inactive'}
            </span>
          </div>
          <h3 class="display-realm-name">${realmLabel}</h3>
        </div>
        <div class="display-row display-bottom">
          <span class="display-watch-label">Whom you watch over</span>
          <span class="display-watch-value">${escapeHtml(watchOver) || 'Not specified'}</span>
        </div>
        <div class="display-seal">
          ${realmSeal}
        </div>
      </div>
    `;
  }).join('');
  
  console.log('Generated badges HTML length:', badgesHTML.length);
  badgesGrid.innerHTML = badgesHTML;
  console.log('Badges grid updated');
  console.log('=== Load Badges Debug End ===');
}

async function saveBadges() {
  if (!isEditMode) return;

  const saveBtn = $('#btnSaveBadges');
  const previousLabel = saveBtn ? saveBtn.textContent : '';

  try {
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving…';
    }

    editingBadges = collectAllBadgeValues();

    const payload = {};
    Object.entries(editingBadges).forEach(([id, badge]) => {
      payload[id] = {
        ...badge,
        realm: badge?.realm || 'north',
        watchOver: (badge?.watchOver || '').trim(),
        enchanted: badge?.enchanted || false
      };
    });

    console.log('Saving badges payload:', payload);

    const response = await apiCall('/users/me', {
      method: 'PATCH',
      body: JSON.stringify({ badges: payload })
    });

    currentUser = response;
    currentUser.badges = currentUser.badges || payload;

    editingBadges = cloneBadges(currentUser.badges);
    originalBadgesSnapshot = cloneBadges(currentUser.badges);
    hasUnsavedChanges = false;

    updateUserInfo();
    loadBadges();
    loadEditableBadges();
    console.log('Badges saved successfully');
    
    // 保存成功后自动切换到display mode
    isEditMode = false;
    const editBtn = $('#btnToggleEditMode');
    const badgesDisplay = $('#badgesDisplay');
    const badgesEdit = $('#badgesEdit');
    const editActions = $('#editActions');
    
    // 显示Edit Mode按钮，隐藏编辑操作按钮
    if (editBtn) editBtn.style.display = 'block';
    if (editActions) editActions.style.display = 'none';
    if (badgesDisplay) badgesDisplay.style.display = 'block';
    if (badgesEdit) badgesEdit.style.display = 'none';
    
  } catch (error) {
    console.error('Failed to save badges:', error);
    console.error(error.message || 'Failed to save badges');
  } finally {
    if (saveBtn) {
      saveBtn.textContent = previousLabel || 'Save Changes';
      saveBtn.disabled = !hasUnsavedChanges;
    }
    updateUnsavedSummary();
  }
}

async function deleteBadge(badgeId) {
  if (isEditMode) {
    if (!editingBadges || !editingBadges[badgeId]) return;
    delete editingBadges[badgeId];
    loadEditableBadges();
    console.log('Badge removed from draft');
    return true;
  }

  if (!currentUser?.badges || !currentUser.badges[badgeId]) return false;

  try {
    const updatedBadges = { ...currentUser.badges };
    delete updatedBadges[badgeId];

    const response = await apiCall('/users/me', {
      method: 'PATCH',
      body: JSON.stringify({ badges: updatedBadges })
    });

    currentUser = response;
    updateUserInfo();
    await loadBadges();
    console.log('Badge deleted successfully');
    return true;
  } catch (error) {
    console.error('Failed to delete badge:', error);
    console.error('Failed to delete badge');
    return false;
  }
}

function toggleEditMode() {
  if (isEditMode && hasUnsavedChanges) {
    console.log('You still have unsaved changes. Save or discard them first.');
    return;
  }

  isEditMode = !isEditMode;

  const editBtn = $('#btnToggleEditMode');
  const badgesDisplay = $('#badgesDisplay');
  const badgesEdit = $('#badgesEdit');
  const editActions = $('#editActions');

  if (isEditMode) {
    originalBadgesSnapshot = cloneBadges(currentUser?.badges);
    editingBadges = cloneBadges(currentUser?.badges);
    hasUnsavedChanges = false;

    // 隐藏Edit Mode按钮，显示编辑操作按钮
    if (editBtn) editBtn.style.display = 'none';
    if (editActions) editActions.style.display = 'flex';
    if (badgesDisplay) badgesDisplay.style.display = 'none';
    if (badgesEdit) badgesEdit.style.display = 'block';

    updateEditFooterState();
    loadEditableBadges();
  } else {
    // 显示Edit Mode按钮，隐藏编辑操作按钮
    if (editBtn) editBtn.style.display = 'block';
    if (editActions) editActions.style.display = 'none';
    if (badgesDisplay) badgesDisplay.style.display = 'block';
    if (badgesEdit) badgesEdit.style.display = 'none';

    updateEditFooterState();
    loadBadges();
  }
}

function loadEditableBadges() {
  const badgesEditList = $('#badgesEditList');
  if (!badgesEditList) return;

  const entries = Object.entries(editingBadges || {});

  if (entries.length === 0) {
    // 空列表：编辑态"新增"卡片使用按钮化文案
    // 由于没有现有 badge，所以总是显示新增按钮
    badgesEditList.innerHTML = `
      <div class=\"edit-new display-empty\" id=\"editNewBadgeCard\" role=\"button\" tabindex=\"0\" aria-label=\"Add New Badge\">\n        <div class=\"no-badges-content\">\n          <p class=\"no-badges-text\">+ New Badge</p>\n          <p class=\"no-badges-subtext\">Click to create your first badge</p>\n        </div>\n      </div>
    `;
    updateUnsavedSummary();
    bindBadgeEditEvents();
    return;
  }

  // Precompute used realms to restrict options per badge (allow keeping its own)
  const usedRealms = new Set(entries.map(([, b]) => (b?.realm)).filter(Boolean));
  const allRealmsUsed = REALM_OPTIONS.every(realm => usedRealms.has(realm));

  badgesEditList.innerHTML = entries.map(([id, badge], index) => {
    const realm = badge?.realm || 'north';
    const watchOver = escapeHtml(badge?.watchOver || '');
    const isEnchanted = badge?.enchanted || false;

    const allowedRealms = ['north', 'tooth', 'bunny'].filter(r => r === realm || !usedRealms.has(r));
    const optionsHtml = allowedRealms.map(r => {
      const labels = { north: 'North Pole', tooth: 'Tooth Fairy', bunny: 'Spring Bunny' };
      const sel = (r === realm) ? 'selected' : '';
      return `<option value="${r}" ${sel}>${labels[r]}</option>`;
    }).join('');

    return `
      <div class="edit-card" data-badge-id="${id}">
        <div class="edit-row edit-top">
          <div class="cell realm-group">
            <span class="realm-label">Realm alignment</span>
            <select class="realm-select" name="realm-${id}">${optionsHtml}</select>
          </div>
          <div class="cell enchanted-control">
            <label class="switch">
              <input type="checkbox" class="enchanted-toggle" ${isEnchanted ? 'checked' : ''} aria-label="Enchanted">
              <span class="switch-track" aria-hidden="true"></span>
              <span class="switch-text">Enchanted</span>
            </label>
          </div>
          <div class="cell remove-control">
            <button class="remove-btn" type="button">Remove</button>
          </div>
        </div>
        <div class="edit-row edit-bottom">
          <label class="section-label">Whom you watch over</label>
          <input type="text" class="watch-over-input" value="${watchOver}" placeholder="Enter who you watch over...">
        </div>
      </div>
    `;
  }).join('');
  
  // 只有在还有可用 realm 时才添加"新增"卡片
  if (!allRealmsUsed) {
    badgesEditList.innerHTML += `
      <div class=\"edit-new display-empty\" id=\"editNewBadgeCard\" role=\"button\" tabindex=\"0\" aria-label=\"Add New Badge\">\n        <div class=\"no-badges-content\">\n          <p class=\"no-badges-text\">+ New Badge</p>\n          <p class=\"no-badges-subtext\">Click to add another badge</p>\n        </div>\n      </div>
    `;
  }

  bindBadgeEditEvents();
  updateUnsavedSummary();
}

function cancelEdit() {
  editingBadges = cloneBadges(originalBadgesSnapshot);
  hasUnsavedChanges = false;
  updateEditFooterState();

  if (isEditMode) {
    toggleEditMode();
    console.log('Changes discarded');
  }
}

function addBadge() {
  console.log('=== Add Badge Debug ===');
  
  // 检查是否已有所有realm的徽章
  const existingRealms = new Set();
  Object.values(editingBadges || {}).forEach(badge => {
    if (badge?.realm) {
      existingRealms.add(badge.realm);
    }
  });
  
  if (existingRealms.size >= 3) {
    console.log('You already have badges for all three realms. Remove an existing badge first.');
    return;
  }
  
  // 找到第一个可用的realm
  const availableRealms = ['north', 'tooth', 'bunny'].filter(realm => !existingRealms.has(realm));
  const selectedRealm = availableRealms[0] || 'north';
  
  // 创建新的徽章ID
  const badgeId = `badge_${Date.now()}`;
  
  const timestamp = new Date().toISOString();
  editingBadges = {
    ...editingBadges,
    [badgeId]: {
      ...(editingBadges[badgeId] || {}),
      realm: selectedRealm,
      watchOver: '',
      enchanted: false,
      created_at: timestamp,
      updated_at: timestamp
    }
  };

  loadEditableBadges();

  // 标记有未保存的更改
  hasUnsavedChanges = true;
  updateUnsavedSummary();

  requestAnimationFrame(() => {
    const newlyCreated = document.querySelector(`.edit-card[data-badge-id="${badgeId}"] .watch-over-input`);
    newlyCreated?.focus();
  });
  
  console.log('Badge added to edit mode successfully');
  console.log('=== Add Badge Debug End ===');
}


// ===== 支付功能 =====
async function renewMembership() {
  try {
    const response = await apiCall('/api/payment/renewal', {
      method: 'POST',
      body: JSON.stringify({})
    });
    
    if (response.checkout_url) {
      window.location.href = response.checkout_url;
    } else {
      console.error('No checkout URL received from server');
      alert('Failed to start payment process. Please try again.');
    }
  } catch (error) {
    console.error('Renewal failed:', error);
    console.error('Failed to start renewal process');
    alert('Failed to start renewal process. Please try again.');
  }
}

// ===== 捐赠功能 =====
function startDonation() {
  const donationModal = $('#donationModal');
  
  if (donationModal) {
    donationModal.style.display = 'flex';
    
    // 重置状态
    const amountBtns = document.querySelectorAll('.amount-btn');
    const customInput = $('#customAmountInput');
    const confirmBtn = $('#btnConfirmDonation');
    const errorDiv = $('#errDonation');
    
    amountBtns.forEach(btn => btn.classList.remove('selected'));
    if (customInput) customInput.value = '';
    if (confirmBtn) {
      confirmBtn.disabled = true;
      confirmBtn.textContent = 'Donate $0';
    }
    if (errorDiv) errorDiv.textContent = '';
    
    setTimeout(() => {
      if (customInput) customInput.focus();
    }, 100);
  }
}

function selectDonationAmount(amount) {
  const amountBtns = document.querySelectorAll('.amount-btn');
  const customInput = $('#customAmountInput');
  const confirmBtn = $('#btnConfirmDonation');
  
  // 清除所有选中状态
  amountBtns.forEach(btn => btn.classList.remove('selected'));
  
  // 清除自定义输入
  if (customInput) customInput.value = '';
  
  // 更新确认按钮
  if (confirmBtn) {
    confirmBtn.disabled = false;
    confirmBtn.textContent = `Donate $${amount}`;
  }
}

function updateCustomAmount() {
  const customInput = $('#customAmountInput');
  const confirmBtn = $('#btnConfirmDonation');
  const amountBtns = document.querySelectorAll('.amount-btn');
  
  if (!customInput || !confirmBtn) return;
  
  const amount = customInput.value.trim();
  
  // 清除预设金额的选中状态
  amountBtns.forEach(btn => btn.classList.remove('selected'));
  
  if (amount && !isNaN(amount) && parseFloat(amount) > 0) {
    confirmBtn.disabled = false;
    confirmBtn.textContent = `Donate $${parseFloat(amount).toFixed(2)}`;
  } else {
    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Donate $0';
  }
}

async function confirmDonation() {
  const amountBtns = document.querySelectorAll('.amount-btn');
  const customInput = $('#customAmountInput');
  const errorDiv = $('#errDonation');
  const confirmBtn = $('#btnConfirmDonation');
  
  let amount = 0;
  
  // 检查预设金额是否选中
  const selectedBtn = document.querySelector('.amount-btn.selected');
  if (selectedBtn) {
    amount = parseFloat(selectedBtn.dataset.amount);
  } else if (customInput && customInput.value.trim()) {
    amount = parseFloat(customInput.value.trim());
  }
  
  if (amount <= 0) {
    if (errorDiv) {
      errorDiv.textContent = 'Please select or enter a valid donation amount';
    }
    return;
  }
  
  const originalText = confirmBtn.textContent;
  confirmBtn.textContent = 'Processing...';
  confirmBtn.disabled = true;
  
  try {
    const response = await apiCall('/api/payment/donation', {
      method: 'POST',
      body: JSON.stringify({
        amount: Math.round(amount * 100) // Convert to cents
      })
    });
    
    if (response.checkout_url) {
      window.location.href = response.checkout_url;
    } else {
      console.error('No checkout URL received from server');
      if (errorDiv) {
        errorDiv.textContent = 'Failed to start payment process. Please try again.';
      }
    }
  } catch (error) {
    console.error('Donation failed:', error);
    if (errorDiv) {
      errorDiv.textContent = 'Failed to start donation process. Please try again.';
    }
  } finally {
    confirmBtn.textContent = originalText;
    confirmBtn.disabled = false;
  }
}

function cancelDonation() {
  const donationModal = $('#donationModal');
  const errorDiv = $('#errDonation');
  
  if (donationModal) {
    donationModal.style.display = 'none';
    
    if (errorDiv) {
      errorDiv.textContent = '';
    }
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
    
    console.log('Displaying purchase history');
    displayPurchaseHistory();
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
  
  if (purchaseHistory.length === 0) {
    list.innerHTML = '<div class="no-history"><p>No purchase history found</p><p class="muted">Your purchase records will appear here</p></div>';
    return;
  }
  
  list.innerHTML = `
    <div class="history-table">
      <div class="history-header">
        <div>Type</div>
        <div>Date</div>
        <div>Amount</div>
        <div>Status</div>
      </div>
      ${purchaseHistory.map(purchase => `
        <div class="history-item">
          <div class="history-item-type">${purchase.type || 'Purchase'}</div>
          <div class="history-item-date">${formatDate(purchase.date)}</div>
          <div class="history-item-amount">${purchase.amount || '$0.00'}</div>
          <div class="history-item-status">
            <span class="status ${(purchase.status || 'completed').toLowerCase()}">${purchase.status || 'Completed'}</span>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

// ===== 邮箱变更 =====
function startEmailChange() {
  // 显示 change email 模态框
  const emailChangeModal = $('#emailChangeModal');
  
  if (emailChangeModal) {
    emailChangeModal.style.display = 'flex';
    
    // 设置当前邮箱显示
    const currentEmailDisplay = $('#currentEmailDisplay');
    if (currentEmailDisplay && currentUser) {
      currentEmailDisplay.textContent = currentUser.email || 'No email';
    }
    
    // 聚焦到新邮箱输入框
    const newEmailInput = $('#newEmailInput');
    if (newEmailInput) {
      newEmailInput.value = '';
      // 延迟聚焦，确保模态框已完全显示
      setTimeout(() => {
        newEmailInput.focus();
      }, 100);
    }
  }
}

async function sendEmailChangeLink() {
  const newEmailInput = $('#newEmailInput');
  const errorDiv = $('#errPortalEmail');
  const sendBtn = $('#btnSendEmailCode');
  
  if (!newEmailInput || !errorDiv || !sendBtn) return;
  
  const newEmail = newEmailInput.value.trim();
  
  // 验证邮箱格式
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!newEmail) {
    errorDiv.textContent = 'Please enter an email address';
    return;
  }
  
  if (!emailRegex.test(newEmail)) {
    errorDiv.textContent = 'Please enter a valid email address';
    return;
  }
  
  if (newEmail === currentUser?.email) {
    errorDiv.textContent = 'This is already your current email address';
    return;
  }
  
  // 显示加载状态
  const originalText = sendBtn.textContent;
  sendBtn.textContent = 'Sending...';
  sendBtn.disabled = true;
  errorDiv.textContent = '';
  
  try {
    await apiCall('/magic-links', {
      method: 'POST',
      body: JSON.stringify({
        email: newEmail,
        purpose: 'change_email',
        subject_id: currentUser?.user_id
      })
    });
    
    errorDiv.textContent = '';
    errorDiv.style.color = '#10b981';
    errorDiv.textContent = 'Magic link sent! You will be logged out for security. Check your new email address.';
    
    // 清空输入框
    newEmailInput.value = '';
    
    // 3秒后自动logout并关闭模态框
    setTimeout(() => {
      cancelEmailChange();
      logout();
    }, 3000);
    
  } catch (error) {
    console.error('Email change failed:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      authToken: sessionStorage.getItem('authToken') ? 'Present' : 'Missing'
    });
    errorDiv.style.color = '#ef4444';
    errorDiv.textContent = 'Failed to send magic link. Please try again.';
  } finally {
    sendBtn.textContent = originalText;
    sendBtn.disabled = false;
  }
}

function cancelEmailChange() {
  const emailChangeModal = $('#emailChangeModal');
  const errorDiv = $('#errPortalEmail');
  const newEmailInput = $('#newEmailInput');
  
  if (emailChangeModal) {
    emailChangeModal.style.display = 'none';
    
    // 清空错误信息和输入框
    if (errorDiv) {
      errorDiv.textContent = '';
      errorDiv.style.color = '#ef4444';
    }
    
    if (newEmailInput) {
      newEmailInput.value = '';
    }
  }
}

// ===== 支付结果处理 =====
function handlePaymentResult() {
  const urlParams = new URLSearchParams(window.location.search);
  const success = urlParams.get('payment_success');
  const sessionId = urlParams.get('session_id');
  
  if (success === 'true' && sessionId) {
    console.log('Payment successful! Thank you for your support.');
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
    'btnMakeDonation': startDonation,
    'btnChangeEmail': startEmailChange,
    'btnSendEmailCode': sendEmailChangeLink,
    'btnCancelEmailChange': cancelEmailChange,
    'btnCloseEmailModal': cancelEmailChange,
    'btnConfirmDonation': confirmDonation,
    'btnCancelDonation': cancelDonation,
    'btnCloseDonationModal': cancelDonation,
    'btnDeleteAccount': () => console.log('Account deletion not implemented yet'),
    'btnLogout': logout,
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
  
  // 添加模态框背景点击关闭功能
  const emailChangeModal = $('#emailChangeModal');
  if (emailChangeModal) {
    emailChangeModal.addEventListener('click', function(e) {
      // 如果点击的是模态框背景（不是内容区域），则关闭模态框
      if (e.target === emailChangeModal) {
        cancelEmailChange();
      }
    });
  }
  
  // 捐赠模态框事件监听器
  const donationModal = $('#donationModal');
  if (donationModal) {
    donationModal.addEventListener('click', function(e) {
      if (e.target === donationModal) {
        cancelDonation();
      }
    });
  }
  
  // 金额按钮事件监听器
  const amountBtns = document.querySelectorAll('.amount-btn');
  amountBtns.forEach(btn => {
    btn.addEventListener('click', function() {
      const amount = parseFloat(this.dataset.amount);
      selectDonationAmount(amount);
      this.classList.add('selected');
    });
  });
  
  // 自定义金额输入事件监听器
  const customAmountInput = $('#customAmountInput');
  if (customAmountInput) {
    customAmountInput.addEventListener('input', updateCustomAmount);
  }
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
  
  // 检查是否有魔法链接参数需要处理
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token');
  const purpose = params.get('purpose');
  const email = params.get('email');
  
  if (token && purpose && email) {
    console.log('Magic link detected:', { token, purpose, email });
    await handleMagicLinkInPortal(token, purpose, email);
    return; // 处理完魔法链接后返回，不继续初始化
  }
  
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
    console.error('Failed to initialize portal');
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

// ===== 魔法链接处理 =====
async function handleMagicLinkInPortal(token, purpose, email) {
  try {
    console.log('Handling magic link in portal:', { token, purpose, email });
    
    // 验证魔法链接
    const response = await fetch(`${API_BASE}/magic-links/verify?token=${token}&purpose=${purpose}&email=${email}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();

    if (response.ok && data.verified) {
      // 清除URL参数，防止重复处理
      const newUrl = new URL(window.location);
      newUrl.searchParams.delete('token');
      newUrl.searchParams.delete('purpose');
      newUrl.searchParams.delete('email');
      window.history.replaceState({}, '', newUrl);
      
      if (purpose === 'signin') {
        // 登录流程
        await handleSignInFromMagicLink(data);
      } else if (purpose === 'change_email') {
        // 邮箱变更流程
        await handleEmailChangeFromMagicLink(data);
      }
    } else {
      console.error('Magic link verification failed:', data);
      alert('Magic link verification failed. Please try again.');
      // 清除URL参数并重定向到登录页面
      window.location.href = '/auth/auth.html?mode=signin';
    }
  } catch (error) {
    console.error('Magic link handling error:', error);
    alert('An error occurred. Please try again.');
    window.location.href = '/auth/auth.html?mode=signin';
  }
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
      
      // 登录成功，根据角色重定向
      await redirectToRoleHome();
    } else {
      const errorData = await sessionResponse.json();
      console.error('Login failed:', errorData);
      alert(`Login failed: ${errorData.detail?.detail || errorData.detail}`);
      window.location.href = '/auth/auth.html?mode=signin';
    }
  } catch (error) {
    console.error('Sign in error:', error);
    alert('Login error. Please try again.');
    window.location.href = '/auth/auth.html?mode=signin';
  }
}

// 处理邮箱变更
async function handleEmailChangeFromMagicLink(data) {
  try {
    // 邮箱变更需要先创建会话（登录用户）
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
      
      // 现在用户已经登录，可以完成邮箱变更
      const changeEmailResponse = await fetch(`${API_BASE}/contacts/email`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionData.access_token}`
        },
        body: JSON.stringify({
          proof_token: data.proof_token
        })
      });

      if (changeEmailResponse.ok) {
        // 邮箱变更成功，显示成功消息并自动登录
        alert('Email changed successfully! You are now logged in with your new email address.');
        
        // 刷新用户信息以显示新邮箱
        await loadUserData();
        
        // 显示成功消息
        console.log('Email change completed successfully');
        
        // 页面会自动显示portal内容，因为用户已经登录
      } else {
        const errorData = await changeEmailResponse.json();
        console.error('Email change failed:', errorData);
        alert(`Email change failed: ${errorData.detail?.detail || errorData.detail}`);
      }
    } else {
      const errorData = await sessionResponse.json();
      console.error('Session creation failed:', errorData);
      alert(`Login failed: ${errorData.detail?.detail || errorData.detail}`);
    }
  } catch (error) {
    console.error('Email change error:', error);
    alert('Email change error. Please try again.');
  }
}
