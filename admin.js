// Admin Portal JavaScript
let currentUser = null;

// ===== UTILITY FUNCTIONS =====
function $(id) {
    return document.getElementById(id);
}

function formatAdminDate(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function getValidUntilWithColor(validUntil) {
    if (!validUntil) return '<span class="expired">N/A</span>';
    
    const now = new Date();
    const validDate = new Date(validUntil);
    
    if (validDate >= now) {
        return `<span class="valid">${formatAdminDate(validUntil)}</span>`;
    } else {
        return `<span class="expired">${formatAdminDate(validUntil)}</span>`;
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

    const response = await fetch(url, { ...defaultOptions, ...options });
    
    if (!response.ok) {
        let errorMessage = 'Request failed';
        try {
            const errorData = await response.json();
            if (errorData.detail) {
                if (typeof errorData.detail === 'string') {
                    errorMessage = errorData.detail;
                } else if (errorData.detail.message) {
                    errorMessage = errorData.detail.message;
                } else if (errorData.detail.title) {
                    errorMessage = errorData.detail.title;
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
    window.location.href = 'auth.html';
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
    if (tab === 'users') {
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
        
        document.getElementById('totalUsers').textContent = stats.users.total;
        document.getElementById('activeUsers').textContent = stats.users.active;
        document.getElementById('monthlyUsers').textContent = stats.users.monthly_new;
        document.getElementById('totalRevenue').textContent = stats.revenue.total;
        document.getElementById('monthlyRevenue').textContent = stats.revenue.monthly;
        document.getElementById('renewalCount').textContent = stats.purchases.renewals;
    } catch (error) {
        console.error('Failed to load admin stats:', error);
    }
}

// ===== USER MANAGEMENT =====
async function loadAdminUsers() {
    try {
        const data = await portalApiFetch('/admin/users');
        displayAdminUsers(data.users);
    } catch (error) {
        console.error('Failed to load admin users:', error);
        const table = document.getElementById('usersTableBody');
        if (table) {
            table.innerHTML = '<tr><td colspan="6" class="loading">Failed to load users: ' + error.message + '</td></tr>';
        }
    }
}

function displayAdminUsers(users) {
    const tableBody = document.getElementById('usersTableBody');
    if (!tableBody) return;
    
    if (!users || users.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="6" class="loading">No users found</td></tr>';
        return;
    }
    
    const tableHTML = users.map(user => `
        <tr>
            <td>${user.username || 'N/A'}</td>
            <td>${user.email || 'N/A'}</td>
            <td>${user.phone || 'N/A'}</td>
            <td>${formatAdminDate(user.created_at)}</td>
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
    } catch (error) {
        console.error('Failed to delete user:', error);
        alert('Failed to delete user: ' + error.message);
    }
}

// ===== BLOCKLIST MANAGEMENT =====
async function loadBlocklistUsers() {
    try {
        const data = await portalApiFetch('/admin/users?include_deleted=true');
        const deletedUsers = data.users.filter(user => user.is_deleted);
        displayBlocklistUsers(deletedUsers);
    } catch (error) {
        console.error('Failed to load blocklist users:', error);
        const table = document.getElementById('blocklistTableBody');
        if (table) {
            table.innerHTML = '<tr><td colspan="5" class="loading">Failed to load deleted users</td></tr>';
        }
    }
}

function displayBlocklistUsers(users) {
    const tableBody = document.getElementById('blocklistTableBody');
    if (!tableBody) return;
    
    if (!users || users.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="5" class="loading">No deleted users found</td></tr>';
        return;
    }
    
    const tableHTML = users.map(user => `
        <tr>
            <td>${user.username || 'N/A'}</td>
            <td>${user.email || 'N/A'}</td>
            <td>${user.phone || 'N/A'}</td>
            <td>${formatAdminDate(user.deleted_at)}</td>
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
        const data = await portalApiFetch('/admin/purchases');
        displayAdminPurchases(data.purchases);
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
                           purchase.status === 'refunded' ? 'status-refunded' : 'status-pending';
        const statusText = purchase.status === 'Completed' ? '✓ Completed' : 
                          purchase.status === 'refunded' ? '↩ Refunded' : '⏳ Pending';
        
        let actionsHTML = '';
        if (purchase.status === 'Completed') {
            actionsHTML = `
                <button class="btn-refund" onclick="refundPurchase('${purchase.id}')" title="Refund">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"></path>
                        <path d="M21 3v5h-5"></path>
                        <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"></path>
                        <path d="M3 21v-5h5"></path>
                    </svg>
                </button>
                <button class="btn-delete" onclick="deletePurchase('${purchase.id}')" title="Delete">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M3 6h18"></path>
                        <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
                        <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
                    </svg>
                </button>
            `;
        } else {
            actionsHTML = `
                <button class="btn-delete" onclick="deletePurchase('${purchase.id}')" title="Delete">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M3 6h18"></path>
                        <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
                        <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
                    </svg>
                </button>
            `;
        }
        
        return `
            <tr>
                <td>${purchase.user_id}</td>
                <td>${purchase.type}</td>
                <td>$${(purchase.amount / 100).toFixed(2)}</td>
                <td class="${statusClass}">${statusText}</td>
                <td>${formatAdminDate(purchase.purchased_at)}</td>
                <td>
                    <div class="history-actions">
                        ${actionsHTML}
                    </div>
                </td>
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
        loadUserForEdit(userId);
    }
}

function closeEditUserModal() {
    const modal = document.getElementById('editUserModal');
    if (modal) {
        modal.style.display = 'none';
        clearEditForm();
    }
}

function clearEditForm() {
    document.getElementById('editUsername').value = '';
    document.getElementById('editEmail').value = '';
    document.getElementById('editPhone').value = '';
    document.getElementById('editValidUntil').value = '';
    document.getElementById('editGeneralError').style.display = 'none';
}

async function loadUserForEdit(userId) {
    try {
        const data = await portalApiFetch(`/admin/users/${userId}`);
        
        document.getElementById('editUsername').value = data.username || '';
        document.getElementById('editEmail').value = data.email || '';
        document.getElementById('editPhone').value = data.phone || '';
        
        if (data.valid_until) {
            const date = new Date(data.valid_until);
            const localDateTime = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
            document.getElementById('editValidUntil').value = localDateTime.toISOString().slice(0, 16);
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
        phone: document.getElementById('editPhone').value.trim(),
        valid_until: document.getElementById('editValidUntil').value
    };
    
    // 验证必填字段
    if (!formData.username) {
        showEditError('Username is required');
        return;
    }
    
    if (!formData.email) {
        showEditError('Email is required');
        return;
    }
    
    if (!formData.phone) {
        showEditError('Phone is required');
        return;
    }
    
    // 转换valid_until为UTC
    if (formData.valid_until) {
        const localDate = new Date(formData.valid_until);
        const utcDate = new Date(localDate.getTime() + localDate.getTimezoneOffset() * 60000);
        formData.valid_until = utcDate.toISOString();
    }
    
    try {
        const userId = document.getElementById('editUsername').getAttribute('data-user-id') || 
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
    } catch (error) {
        console.error('Failed to save user changes:', error);
        showEditError('Failed to update user: ' + error.message);
    }
}

function showEditError(message) {
    const errorElement = document.getElementById('editGeneralError');
    if (errorElement) {
        errorElement.textContent = message;
        errorElement.style.display = 'block';
    }
}

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
        window.location.href = 'auth.html';
        return;
    }
    
    // 设置事件监听器
    setupEventListeners();
    
    // 加载初始数据
    loadAdminStats();
    loadAdminUsers();
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
}
