// Admin Portal JavaScript
let currentUser = null;
const API_BASE = 'https://api.mythicalhelper.org';

const adminState = {
  usersPage: 1,
  blocklistPage: 1,
  purchasesPage: 1,
  pageSize: 20,
  usersTotalPages: undefined,
  blockTotalPages: undefined,
  purchasesTotalPages: undefined
};

// ===== UTILITY FUNCTIONS =====
function $(id) {
    return document.getElementById(id);
}

// ===== 时间处理函数 =====
// 服务器时间都是UTC，前端显示和输入都是本地时间

// 调试函数：测试时间转换
function testTimeConversion() {
    console.log('=== 时间转换测试 ===');
    const testUTC = '2025-09-09T23:41:03.123456'; // 示例UTC时间（无Z后缀）
    console.log('原始UTC时间:', testUTC);
    
    const parsedDate = parseServerDateToDate(testUTC);
    console.log('解析后的Date对象:', parsedDate);
    console.log('本地时间显示:', parsedDate.toLocaleString());
    console.log('UTC时间显示:', parsedDate.toISOString());
    console.log('时区偏移(分钟):', parsedDate.getTimezoneOffset());
    
    console.log('formatAdminDateTime结果:', formatAdminDateTime(testUTC));
    console.log('formatAdminDate结果:', formatAdminDate(testUTC));
    console.log('当前本地时间:', new Date().toLocaleString());
    console.log('当前UTC时间:', new Date().toISOString());
    
    // 测试服务器实际返回的格式
    const serverTime = '2025-09-09T23:36:55.069922';
    console.log('服务器时间:', serverTime);
    console.log('服务器时间转换结果:', formatAdminDateTime(serverTime));
    console.log('==================');
}

// 解析服务器返回时间：
// 服务器返回ISO格式的UTC时间戳，需要强制按UTC解析然后转换为本地时间
function parseServerDateToDate(serverDateString) {
    if (!serverDateString) return null;
    
    // 确保时间字符串有UTC标识符，如果没有则添加
    let utcString = serverDateString;
    if (!utcString.endsWith('Z') && !utcString.includes('+') && !utcString.includes('-', 10)) {
        utcString = utcString + 'Z';
    }
    
    // 解析为UTC时间，然后JavaScript会自动转换为本地时间
    const dt = new Date(utcString);
    if (isNaN(dt.getTime())) return null;
    
    return dt;
}

// 将服务器UTC时间转换为本地时间显示（YYYY-MM-DD格式）
function formatAdminDate(serverDateString) {
    const dt = parseServerDateToDate(serverDateString);
    if (!dt) return 'N/A';
    const year = dt.getFullYear();
    const month = String(dt.getMonth() + 1).padStart(2, '0');
    const day = String(dt.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// 将服务器UTC时间转换为本地时间显示（包含时间，用于更详细的显示）
function formatAdminDateTime(serverDateString) {
    const dt = parseServerDateToDate(serverDateString);
    if (!dt) return 'N/A';
    const year = dt.getFullYear();
    const month = String(dt.getMonth() + 1).padStart(2, '0');
    const day = String(dt.getDate()).padStart(2, '0');
    const hours = String(dt.getHours()).padStart(2, '0');
    const minutes = String(dt.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}`;
}

// 将服务器时间转换为本地时间，用于 datetime-local 输入框（YYYY-MM-DDTHH:MM）
function formatServerToLocalDateTime(serverDateString) {
    const dt = parseServerDateToDate(serverDateString);
    if (!dt) return '';
    const year = dt.getFullYear();
    const month = String(dt.getMonth() + 1).padStart(2, '0');
    const day = String(dt.getDate()).padStart(2, '0');
    const hours = String(dt.getHours()).padStart(2, '0');
    const minutes = String(dt.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
}

// 将本地时间转换为服务器UTC时间，用于上传到后端
function formatLocalToServerDate(localDateString) {
    if (!localDateString) return null;
    
    // 创建本地时间对象
    const localDate = new Date(localDateString);
    if (isNaN(localDate.getTime())) return null;
    
    // 转换为UTC时间并返回ISO字符串
    return localDate.toISOString();
}

function getValidUntilWithColor(validUntil) {
    if (!validUntil) return '<span class="expired">N/A</span>';
    const now = new Date();
    const validDate = parseServerDateToDate(validUntil);
    if (!validDate) return '<span class="expired">N/A</span>';
    if (validDate >= now) {
        return `<span class="valid">${formatAdminDateTime(validUntil)}</span>`;
    } else {
        return `<span class="expired">${formatAdminDateTime(validUntil)}</span>`;
    }
}

// ===== API FUNCTIONS =====
async function portalApiFetch(url, options = {}) {
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

    const response = await fetch(`${API_BASE}${url}`, { ...defaultOptions, ...options });
    
    if (!response.ok) {
        let errorMessage = 'Request failed';
        try {
            const errorData = await response.json();
            
            if (errorData.detail) {
                if (typeof errorData.detail === 'string') {
                    errorMessage = errorData.detail;
                } else if (typeof errorData.detail === 'object') {
                    // 如果detail是对象，尝试获取message、detail或title
                    if (errorData.detail.detail) {
                        // 真正的错误信息通常在detail.detail中
                        errorMessage = errorData.detail.detail;
                    } else if (errorData.detail.message) {
                        errorMessage = errorData.detail.message;
                    } else if (errorData.detail.title) {
                        errorMessage = errorData.detail.title;
                    } else {
                        // 如果都没有，尝试将对象转换为字符串
                        errorMessage = JSON.stringify(errorData.detail);
                    }
                }
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

// ===== AUTHENTICATION =====
function logout() {
    sessionStorage.removeItem('authToken');
    window.location.href = '../auth/auth.html?mode=login';
}

// ===== TAB MANAGEMENT =====
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
    document.getElementById(`${tab}Tab`).classList.add('active');
    
    // 加载对应数据
    if (tab === 'dashboard') {
        // Dashboard不需要加载额外数据，统计数据已经在页面加载时获取
        return;
    } else if (tab === 'users') {
        loadAdminUsers();
    } else if (tab === 'blocklist') {
        loadBlocklistUsers();
    } else if (tab === 'purchases') {
        loadAdminPurchases();
    }
}

// ===== STATS =====
async function loadAdminStats() {
  try {
    const stats = await portalApiFetch('/admin/stats');
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    set('totalUsers', stats?.users?.total ?? '-');
    set('monthlyUsers', stats?.users?.monthly_new ?? '-');
    set('totalRevenue', stats?.revenue?.total ?? '-');
    set('monthlyRevenue', stats?.revenue?.monthly ?? '-');
  } catch (error) {
    console.error('Failed to load admin stats:', error);
  }
}

// ===== USER MANAGEMENT =====
async function loadAdminUsers() {
    try {
        const data = await portalApiFetch(`/admin/users?page=${adminState.usersPage}&limit=${adminState.pageSize}`);
        displayAdminUsers(data.users);
        if (data.pagination && typeof data.pagination.pages === 'number') {
          adminState.usersTotalPages = data.pagination.pages;
        }
        updatePagerState('users');
    } catch (error) {
        console.error('Failed to load admin users:', error);
        const table = document.getElementById('usersTableBody');
        if (table) {
            table.innerHTML = '<tr><td colspan="5" class="loading">Failed to load users: ' + error.message + '</td></tr>';
        }
    }
}

function displayAdminUsers(users) {
    const tableBody = document.getElementById('usersTableBody');
    if (!tableBody) return;
    
    if (!users || users.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="5" class="loading">No users found</td></tr>';
        return;
    }
    
    // 调试：显示第一个用户的时间数据（调试用）
    // if (users.length > 0) {
    //     console.log('=== 服务器返回的时间数据 ===');
    //     console.log('第一个用户的created_at:', users[0].created_at);
    //     console.log('第一个用户的valid_until:', users[0].valid_until);
    //     console.log('created_at类型:', typeof users[0].created_at);
    //     console.log('valid_until类型:', typeof users[0].valid_until);
    //     
    //     // 测试valid_until的转换
    //     if (users[0].valid_until) {
    //         const validDate = parseServerDateToDate(users[0].valid_until);
    //         console.log('valid_until解析结果:', validDate);
    //         console.log('valid_until本地时间:', validDate.toLocaleString());
    //         console.log('formatAdminDateTime结果:', formatAdminDateTime(users[0].valid_until));
    //     }
    //     console.log('==========================');
    // }
    
    const tableHTML = users.map(user => `
        <tr>
            <td>${user.username || 'N/A'}</td>
            <td>${user.email || 'N/A'}</td>
            <td>${formatAdminDateTime(user.created_at)}</td>
            <td>${getValidUntilWithColor(user.valid_until)}</td>
            <td>
                <div class="history-actions">
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
            </td>
        </tr>
    `).join('');
    
    tableBody.innerHTML = tableHTML;
}

async function deleteUser(userId, username) {
    if (!confirm(`Are you sure you want to delete user "${username}"? This will move them to the blocklist.`)) {
        return;
    }
    
    try {
        await portalApiFetch(`/admin/users/${userId}`, {
            method: 'DELETE'
        });
        
        alert('User deleted successfully');
        loadAdminUsers();
        loadAdminStats(); // 刷新统计信息
    } catch (error) {
        console.error('Failed to delete user:', error);
        alert('Failed to delete user: ' + error.message);
    }
}

// ===== BLOCKLIST MANAGEMENT =====
async function loadBlocklistUsers() {
    try {
        const data = await portalApiFetch(`/admin/users?include_deleted=true&page=${adminState.blocklistPage}&limit=${adminState.pageSize}`);
        const deletedUsers = data.users.filter(user => user.is_deleted);
        displayBlocklistUsers(deletedUsers);
        if (data.pagination && typeof data.pagination.pages === 'number') {
          adminState.blockTotalPages = data.pagination.pages;
        }
        updatePagerState('block');
    } catch (error) {
        console.error('Failed to load blocklist users:', error);
        const table = document.getElementById('blocklistTableBody');
        if (table) {
            table.innerHTML = '<tr><td colspan="4" class="loading">Failed to load deleted users</td></tr>';
        }
    }
}

function displayBlocklistUsers(users) {
    const tableBody = document.getElementById('blocklistTableBody');
    if (!tableBody) return;
    
    if (!users || users.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="4" class="loading">No deleted users found</td></tr>';
        return;
    }
    
    const tableHTML = users.map(user => `
        <tr>
            <td>${user.username || 'N/A'}</td>
            <td>${user.email || 'N/A'}</td>
            <td>${formatAdminDateTime(user.deleted_at)}</td>
            <td>
                <div class="history-actions">
                    <button class="btn-restore" onclick="restoreUser('${user.id}', '${user.username || 'Unknown'}')" title="Restore User">
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
            </td>
        </tr>
    `).join('');
    
    tableBody.innerHTML = tableHTML;
}

async function restoreUser(userId, username) {
    if (!confirm(`Are you sure you want to restore user "${username}"?`)) {
        return;
    }
    
    try {
        await portalApiFetch(`/admin/users/${userId}/restore`, {
            method: 'POST'
        });
        
        alert('User restored successfully');
        loadBlocklistUsers();
    } catch (error) {
        console.error('Failed to restore user:', error);
        alert('Failed to restore user: ' + error.message);
    }
}

async function permanentlyDeleteUser(userId, username) {
    if (!confirm(`Are you sure you want to PERMANENTLY DELETE user "${username}"? This action cannot be undone!`)) {
        return;
    }
    
    try {
        await portalApiFetch(`/admin/users/${userId}/permanent`, {
            method: 'DELETE'
        });
        
        alert('User permanently deleted');
        loadBlocklistUsers();
    } catch (error) {
        console.error('Failed to permanently delete user:', error);
        alert('Failed to permanently delete user: ' + error.message);
    }
}

// ===== PURCHASE MANAGEMENT =====
async function loadAdminPurchases() {
    try {
        const data = await portalApiFetch(`/admin/purchases?page=${adminState.purchasesPage}&limit=${adminState.pageSize}`);
        displayAdminPurchases(data.purchases);
        if (data.pagination && typeof data.pagination.pages === 'number') {
          adminState.purchasesTotalPages = data.pagination.pages;
        }
        updatePagerState('purchases');
    } catch (error) {
        console.error('Failed to load admin purchases:', error);
        const table = document.getElementById('purchasesTableBody');
        if (table) {
            table.innerHTML = '<tr><td colspan="6" class="loading">Failed to load purchases</td></tr>';
        }
    }
}

function displayAdminPurchases(purchases) {
  const tableBody = document.getElementById('purchasesTableBody');
  if (!tableBody) return;
  
  if (!purchases || purchases.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="6" class="loading">No purchases found</td></tr>';
        return;
    }
    
    const tableHTML = purchases.map(purchase => {
        const statusClass = purchase.status === 'Completed' ? 'status-completed' : 
                           purchase.status === 'Refunded' ? 'status-refunded' : 'status-pending';
        const statusText = purchase.status === 'Completed' ? '✓ Completed' : 
                          purchase.status === 'Refunded' ? '↩ Refunded' : '⏳ Pending';
        const email = purchase.email || purchase.user?.email || 'N/A';
        const amount = typeof purchase.amount === 'number' ? `$${(purchase.amount / 100).toFixed(2)}` : (purchase.amount || 'N/A');
        const date = purchase.purchased_at || purchase.date;
        const actionsHTML = `
            ${statusText === '✓ Completed' ? `
            <button class=\"btn-refund\" onclick=\"refundPurchase('${purchase.id}')\" title=\"Refund\">
              <svg width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\">
                <path d=\"M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8\"></path>
                <path d=\"M21 3v5h-5\"></path>
                <path d=\"M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16\"></path>
                <path d=\"M3 21v-5h5\"></path>
              </svg>
            </button>` : ''}
            <button class=\"btn-delete\" onclick=\"deletePurchase('${purchase.id}')\" title=\"Delete\">
              <svg width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\">
                <polyline points=\"3,6 5,6 21,6\"></polyline>
                <path d=\"M19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2\"></path>
                <line x1=\"10\" y1=\"11\" x2=\"10\" y2=\"17\"></line>
                <line x1=\"14\" y1=\"11\" x2=\"14\" y2=\"17\"></line>
              </svg>
            </button>
        `;
        return `
            <tr>
                <td>${email}</td>
                <td>${purchase.type}</td>
                <td>${amount}</td>
                <td class="${statusClass}">${statusText}</td>
                <td>${formatAdminDateTime(date)}</td>
                <td><div class="history-actions">${actionsHTML}</div></td>
            </tr>
        `;
    }).join('');
    
    tableBody.innerHTML = tableHTML;
}

async function refundPurchase(purchaseId) {
    if (!confirm('Are you sure you want to refund this purchase? This action cannot be undone.')) {
        return;
    }
    
    try {
        await portalApiFetch(`/admin/purchases/${purchaseId}/refund`, {
            method: 'POST'
        });
        
        alert('Refund processed successfully');
        loadAdminPurchases();
        loadAdminStats(); // 刷新统计信息
    } catch (error) {
        console.error('Failed to refund purchase:', error);
        alert('Failed to process refund: ' + error.message);
    }
}

async function deletePurchase(purchaseId) {
    if (!confirm('Are you sure you want to delete this purchase? This action cannot be undone.')) {
        return;
    }
    
    try {
        await portalApiFetch(`/admin/purchases/${purchaseId}`, {
            method: 'DELETE'
        });
        
        alert('Purchase deleted successfully');
        loadAdminPurchases();
        loadAdminStats(); // 刷新统计信息
    } catch (error) {
        console.error('Failed to delete purchase:', error);
        alert('Failed to delete purchase: ' + error.message);
    }
}

// ===== USER EDIT MODAL =====
function openEditUserModal(userId) {
  const modal = document.getElementById('editUserModal');
  if (modal) {
    modal.style.display = 'flex';
    // 记住当前编辑的用户ID
    modal.dataset.userId = userId;
    const uname = document.getElementById('editUsername');
    if (uname) uname.setAttribute('data-user-id', userId);
    loadUserForEdit(userId);
  }
}

function closeEditUserModal() {
  const modal = document.getElementById('editUserModal');
  if (modal) {
    modal.style.display = 'none';
    delete modal.dataset.userId;
    clearEditForm();
  }
}

function clearEditForm() {
    document.getElementById('editUsername').value = '';
    document.getElementById('editEmail').value = '';
    document.getElementById('editValidUntil').value = '';
    document.getElementById('editGeneralError').style.display = 'none';
}

async function loadUserForEdit(userId) {
    try {
        const data = await portalApiFetch(`/admin/users/${userId}`);
        
        document.getElementById('editUsername').value = data.username || '';
        document.getElementById('editEmail').value = data.email || '';
        
        if (data.valid_until) {
            document.getElementById('editValidUntil').value = formatServerToLocalDateTime(data.valid_until);
        } else {
            document.getElementById('editValidUntil').value = '';
        }
    } catch (error) {
        console.error('Failed to load user for edit:', error);
        alert('Failed to load user data: ' + error.message);
    }
}

async function saveUserChanges() {
    const formData = {
        username: document.getElementById('editUsername').value.trim(),
        email: document.getElementById('editEmail').value.trim(),
        valid_until: document.getElementById('editValidUntil').value
    };
  const modal = document.getElementById('editUserModal');
  
  // 验证必填字段
  if (!formData.username) {
    showEditError('Username is required');
    return;
  }
  
  if (!formData.email) {
    showEditError('Email is required');
    return;
  }
  // 基本邮箱格式检查
  if (!/^\S+@\S+\.\S+$/.test(formData.email)) {
    showEditError('Please enter a valid email');
    return;
  }
  
  // 转换valid_until为UTC
  if (formData.valid_until) {
    formData.valid_until = formatLocalToServerDate(formData.valid_until);
  }
  
    try {
        const userId = modal?.dataset?.userId || document.getElementById('editUsername').getAttribute('data-user-id') || 
                   document.querySelector('[data-user-id]')?.getAttribute('data-user-id');
    
    if (!userId) {
      showEditError('User ID not found');
      return;
    }
        
        await portalApiFetch(`/admin/users/${userId}`, {
            method: 'PUT',
            body: JSON.stringify(formData)
        });
        
        alert('User updated successfully');
        closeEditUserModal();
        loadAdminUsers();
        loadAdminStats(); // 刷新统计信息
    } catch (error) {
        console.error('Failed to save user changes:', error);
        
        // 解析后端返回的具体错误信息
        let errorMessage = 'Failed to update user';
        
        if (error?.message) {
            // 检查是否是重复邮箱错误
            if (error.message.includes('email_exists') || error.message.includes('Email already exists')) {
                errorMessage = 'This email address is already in use by another user';
            }
            // 检查是否是重复用户名错误
            else if (error.message.includes('username_exists') || error.message.includes('Username already exists')) {
                errorMessage = 'This username is already in use by another user';
            }
            // 检查是否是用户名格式错误
            else if (error.message.includes('invalid_username') || error.message.includes('2–20 chars, letters/numbers/underscore/spaces')) {
                errorMessage = 'Username must be 2-20 characters with letters, numbers, underscores, or spaces, and must include at least one letter';
            }
            // 检查是否是用户名被禁用错误
            else if (error.message.includes('username_not_allowed') || error.message.includes('Username not allowed')) {
                errorMessage = 'This username is not allowed (reserved words)';
            }
            // 检查是否是邮箱格式错误
            else if (error.message.includes('invalid_email') || error.message.includes('Invalid email format')) {
                errorMessage = 'Please enter a valid email address';
            }
            // 其他错误直接显示
            else {
                errorMessage = error.message;
            }
        }
        
        showEditError(errorMessage);
    }
}

function showEditError(message) {
  const errorElement = document.getElementById('editGeneralError');
  if (errorElement) {
    errorElement.textContent = message;
    errorElement.style.display = 'block';
  }
}

// 回车提交
document.getElementById('editUserForm')?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    saveUserChanges();
  }
});


// ===== SEARCH FUNCTIONS =====
function handleUserSearch(event) {
    if (event.key === 'Enter') {
        searchUsers();
    }
}

function searchUsers() {
    const query = document.getElementById('userSearch').value;
    // TODO: Implement search functionality
    console.log('Searching users:', query);
}

function handleBlocklistSearch(event) {
    if (event.key === 'Enter') {
        searchBlocklist();
    }
}

function searchBlocklist() {
    const query = document.getElementById('blocklistSearch').value;
    // TODO: Implement search functionality
    console.log('Searching blocklist:', query);
}

function handlePurchaseSearch(event) {
    if (event.key === 'Enter') {
        searchPurchases();
    }
}

function searchPurchases() {
    const query = document.getElementById('purchaseSearch').value;
    // TODO: Implement search functionality
    console.log('Searching purchases:', query);
}

// ===== TABLE SORTING =====
function sortTable(column) {
    // TODO: Implement table sorting
    console.log('Sorting by:', column);
}

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', function() {
    // 检查认证
    const authToken = sessionStorage.getItem('authToken');
    if (!authToken) {
        window.location.href = '../auth/auth.html';
        return;
    }
    
    // 设置事件监听器
    setupEventListeners();
    
    // 加载初始数据
    loadAdminStats();
    loadAdminUsers();

    // 测试时间转换（调试用）
    // testTimeConversion();

    // Render Admin badge next to brand (for consistent UI across pages)
    addAdminBadge();
});

function setupEventListeners() {
    // 标签切换
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.dataset.tab;
            switchTab(tab);
        });
    });
    
    // 编辑用户模态框
    document.getElementById('btnSaveUser')?.addEventListener('click', saveUserChanges);
    document.querySelector('.modal-close')?.addEventListener('click', closeEditUserModal);
    
    // 模态框背景点击关闭
    document.getElementById('editUserModal')?.addEventListener('click', (e) => {
        if (e.target.id === 'editUserModal') {
            closeEditUserModal();
        }
    });

    // Pagination buttons
    document.getElementById('btnUsersPrev')?.addEventListener('click', () => { if (adminState.usersPage > 1) { adminState.usersPage--; loadAdminUsers(); } });
    document.getElementById('btnUsersNext')?.addEventListener('click', () => { adminState.usersPage++; loadAdminUsers(); });
    document.getElementById('btnBlockPrev')?.addEventListener('click', () => { if (adminState.blocklistPage > 1) { adminState.blocklistPage--; loadBlocklistUsers(); } });
    document.getElementById('btnBlockNext')?.addEventListener('click', () => { adminState.blocklistPage++; loadBlocklistUsers(); });
    document.getElementById('btnPurchPrev')?.addEventListener('click', () => { if (adminState.purchasesPage > 1) { adminState.purchasesPage--; loadAdminPurchases(); } });
    document.getElementById('btnPurchNext')?.addEventListener('click', () => { adminState.purchasesPage++; loadAdminPurchases(); });
}

function updatePagerState(which) {
  const map = {
    users: { prev: 'btnUsersPrev', next: 'btnUsersNext', page: adminState.usersPage, label: 'usersPageInfo', total: adminState.usersTotalPages },
    block: { prev: 'btnBlockPrev', next: 'btnBlockNext', page: adminState.blocklistPage, label: 'blockPageInfo', total: adminState.blockTotalPages },
    purchases: { prev: 'btnPurchPrev', next: 'btnPurchNext', page: adminState.purchasesPage, label: 'purchPageInfo', total: adminState.purchasesTotalPages }
  };
  const cfg = map[which];
  if (!cfg) return;
  const prev = document.getElementById(cfg.prev);
  const next = document.getElementById(cfg.next);
  if (prev) prev.disabled = cfg.page <= 1;
  // Update page label
  const label = document.getElementById(cfg.label);
  if (label) {
    if (typeof cfg.total === 'number') {
      label.textContent = `Page ${cfg.page} / ${cfg.total}`;
    } else {
      label.textContent = `Page ${cfg.page}`;
    }
  }
  // Disable next when total known
  if (next) {
    if (typeof cfg.total === 'number') {
      next.disabled = cfg.page >= cfg.total;
    } else {
      next.disabled = false;
    }
  }
}

function addAdminBadge() {
    const brand = document.querySelector('.header .brand');
    if (!brand) return;
    if (brand.querySelector('[data-role-badge="admin"]')) return;
    const badge = document.createElement('span');
    badge.textContent = 'Admin';
    badge.dataset.roleBadge = 'admin';
    badge.setAttribute('aria-label', 'Administrator');
    badge.style.marginLeft = '8px';
    badge.style.padding = '2px 6px';
    badge.style.fontSize = '12px';
    badge.style.borderRadius = '6px';
    badge.style.background = '#ef4444';
    badge.style.color = '#fff';
    badge.style.opacity = '0.9';
    brand.appendChild(badge);
}
