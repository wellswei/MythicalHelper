// scan.js — public badge viewer
const API_BASE = 'https://api.mythicalhelper.org';

function $(s) { return document.querySelector(s); }

// 解析服务器日期：YYYY-MM-DD 视为 UTC 午夜，其它走原生解析
function parseServerDateToDate(input) {
  if (!input) return null;
  if (input instanceof Date) return isNaN(input.getTime()) ? null : input;
  const s = String(input);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (m) {
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const d = Number(m[3]);
    return new Date(Date.UTC(y, mo - 1, d, 0, 0, 0, 0));
  }
  const dt = new Date(s);
  return isNaN(dt.getTime()) ? null : dt;
}

function formatDate(dateLike) {
  if (!dateLike) return 'N/A';
  const date = parseServerDateToDate(dateLike);
  if (!date) return 'N/A';
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

// 随机工作内容生成系统（从index.js移植）
const roleCombinations = {
  north: [
    ['Logistics', 'Reindeer', 'Winter routes'],
    ['Sleigh timing', 'Snow clearance', 'List management'],
    ['Package sorting', 'Route planning', 'Weather monitoring']
  ],
  tooth: [
    ['Tiny treasures', 'Brave smiles', 'Pillow exchanges'],
    ['Memory collection', 'Courage rewards', 'Gentle notes'],
    ['Sparkle placement', 'Smile recognition', 'Childhood magic']
  ],
  bunny: [
    ['Egg trails', 'Garden laughter', 'Spring signs'],
    ['Hope hiding', 'Joy spreading', 'Season heralding'],
    ['Trail creation', 'Laughter sharing', 'Spring awakening']
  ]
};

function getRandomMissions(badgeType) {
  const combinations = roleCombinations[badgeType] || roleCombinations.north;
  const randomIndex = Math.floor(Math.random() * combinations.length);
  return combinations[randomIndex];
}

function renderBadges(badgesObj, username, validUntil) {
  const grid = $('#badgesGrid');
  if (!grid) return;
  grid.innerHTML = '';

  // Update certificate agent name
  const certAgent = document.getElementById('certAgent');
  if (certAgent && username) {
    certAgent.textContent = username;
  }

  // Update certificate date
  const certDate = document.getElementById('certDate');
  if (certDate && validUntil) {
    const enchantedUntil = parseServerDateToDate(validUntil);
    const today = new Date();
    const effectiveDate = enchantedUntil && enchantedUntil < today ? enchantedUntil : today;
    certDate.textContent = effectiveDate.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  }

  const custom = Object.entries(badgesObj || {}).map(([id, b]) => ({
    icon: (b && b.icon) || '🏆',
    title: (b && b.title) || id,
    description: (b && b.description) || 'Custom badge',
    active: (b && typeof b.active === 'boolean') ? b.active : true,
    realm: (b && b.realm) || 'north',
    care_description: (b && b.care_description) || '',
    // 从数据库读取的信息（如果存在）
    agent: (b && b.agent) || null,
    ward: (b && b.ward) || null,
    lastOperation: (b && b.lastOperation) || null,
    missions: (b && b.missions) || null,
  }));

  // 只显示active的badges
  const activeBadges = custom.filter(b => b.active === true);
  
  activeBadges.forEach(b => {
    // 获取realm信息
    const realmNames = {
      'north': 'North Pole',
      'tooth': 'Tooth Fairy', 
      'bunny': 'Spring Bunny'
    };
    
    const realm = realmNames[b.realm] || 'Unknown Realm';
    const agentName = username || 'Agent Not Assigned';
    const wardName = b.care_description || 'Not specified';
    const missions = getRandomMissions(b.realm);
    const enchantedUntil = validUntil ? parseServerDateToDate(validUntil) : null;
    const today = new Date();
    const effectiveDate = enchantedUntil ? (enchantedUntil < today ? enchantedUntil : today) : today;
    
    const el = document.createElement('div');
    el.className = `scan-badge-card ${b.realm}`;
    el.innerHTML = `
      <div class="scan-badge-seal" aria-hidden="true">
        <svg class="stamp stamp-${b.realm}" viewBox="0 0 120 120" width="120" height="120">
          ${b.realm === 'north' ? `
            <defs>
              <radialGradient id="g-north-${Date.now()}" cx="50%" cy="50%" r="60%">
                <stop offset="0%" stop-color="#ffffff" stop-opacity=".2"/>
                <stop offset="100%" stop-color="#7BC4FF" stop-opacity=".25"/>
              </radialGradient>
            </defs>
            <circle cx="60" cy="60" r="52" fill="url(#g-north-${Date.now()})" stroke="#7BC4FF" stroke-width="4" opacity=".2"/>
            <circle cx="60" cy="60" r="42" fill="none" stroke="#7BC4FF" stroke-width="2" stroke-dasharray="4 6" opacity=".15"/>
            <g stroke="#5AAEFF" stroke-width="3" stroke-linecap="round" opacity=".25">
              <line x1="60" y1="32" x2="60" y2="88"/>
              <line x1="32" y1="60" x2="88" y2="60"/>
              <line x1="40" y1="40" x2="80" y2="80"/>
              <line x1="80" y1="40" x2="40" y2="80"/>
            </g>
          ` : b.realm === 'tooth' ? `
            <defs>
              <radialGradient id="g-tooth-${Date.now()}" cx="50%" cy="50%" r="60%">
                <stop offset="0%" stop-color="#ffffff" stop-opacity=".2"/>
                <stop offset="100%" stop-color="#D5B8FF" stop-opacity=".25"/>
              </radialGradient>
            </defs>
            <circle cx="60" cy="60" r="52" fill="url(#g-tooth-${Date.now()})" stroke="#C39BFF" stroke-width="4" opacity=".2"/>
            <circle cx="60" cy="60" r="42" fill="none" stroke="#C39BFF" stroke-width="2" stroke-dasharray="3 5" opacity=".15"/>
            <g fill="#B285FF" opacity=".25">
              <path d="M60 42 l3 6 6 3 -6 3 -3 6 -3-6 -6-3 6-3z"/>
              <path d="M86 58 l2 4 4 2 -4 2 -2 4 -2-4 -4-2 4-2z"/>
              <path d="M34 58 l2 4 4 2 -4 2 -2 4 -2-4 -4-2 4-2z"/>
              <path d="M60 78 l2 4 4 2 -4 2 -2 4 -2-4 -4-2 4-2z"/>
            </g>
          ` : `
            <defs>
              <radialGradient id="g-bunny-${Date.now()}" cx="50%" cy="50%" r="60%">
                <stop offset="0%" stop-color="#ffffff" stop-opacity=".2"/>
                <stop offset="100%" stop-color="#9BE7B0" stop-opacity=".25"/>
              </radialGradient>
            </defs>
            <circle cx="60" cy="60" r="52" fill="url(#g-bunny-${Date.now()})" stroke="#65D08A" stroke-width="4" opacity=".2"/>
            <circle cx="60" cy="60" r="42" fill="none" stroke="#65D08A" stroke-width="2" stroke-dasharray="6 6" opacity=".15"/>
            <g fill="#49C27A" opacity=".25">
              <circle cx="60" cy="66" r="12"/>
              <circle cx="48" cy="50" r="5"/>
              <circle cx="60" cy="46" r="5"/>
              <circle cx="72" cy="50" r="5"/>
            </g>
          `}
        </svg>
      </div>
      <div class="scan-badge-header">
        <h3 class="scan-badge-title ${b.realm}">${realm}</h3>
      </div>
      <div class="scan-badge-content">
        <div class="scan-badge-field single-line">
          <span class="scan-badge-label">Field Agent:</span>
          <span class="scan-badge-value agent-name">${agentName}</span>
        </div>
        <div class="scan-badge-field two-lines">
          <span class="scan-badge-label">Special<br>Operations:</span>
          <span class="scan-badge-value">${missions.join(', ')}</span>
        </div>
        <div class="scan-badge-field two-lines">
          <span class="scan-badge-label">Whom you<br>watch over:</span>
          <span class="scan-badge-value">${wardName}</span>
        </div>
        <div class="scan-badge-field single-line">
          <span class="scan-badge-label">ENCHANTED UNTIL:</span>
          <span class="scan-badge-value">${formatDate(effectiveDate)}</span>
        </div>
      </div>
    `;
    grid.appendChild(el);
  });
}

async function loadScan() {
  const url = new URL(window.location.href);
  const userId = url.searchParams.get('id') || '';
  const setStatus = (msg) => { const el = $('#statusLine'); if (el) el.textContent = msg; };
  const showErr = (msg) => { const e = $('#errorBox'); if (e) { e.style.display = 'block'; e.textContent = msg; } };
  const hideErr = () => { const e = $('#errorBox'); if (e) e.style.display = 'none'; };

  if (!userId) {
    setStatus('Missing id parameter');
    showErr('Invalid link: no user id.');
    return;
  }

  hideErr();

  try {
    const res = await fetch(`${API_BASE}/scan/${encodeURIComponent(userId)}`);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      throw new Error(j.detail?.detail || j.detail || `HTTP ${res.status}`);
    }
    const data = await res.json();

    renderBadges(data.badges || {}, data.username, data.valid_until);
  } catch (e) {
    showErr(e.message || 'Failed to load member');
  }
}

// PDF生成功能
async function generateCertificatePDF() {
  const certificateElement = document.getElementById('guildCertificate');
  if (!certificateElement) {
    console.error('Certificate element not found');
    return;
  }

  try {
    // 启用纯净模式，避免渐变/阴影导致的色带
    document.body.classList.add('print-capture');
    // 等待一帧确保样式生效
    await new Promise(requestAnimationFrame);
    // 显示加载状态
    const button = document.getElementById('downloadPDF');
    const originalText = button.textContent;
    button.textContent = 'Generating PDF...';
    button.disabled = true;

    // 使用html2canvas捕获证书
    const canvas = await html2canvas(certificateElement, {
      scale: 2, // 提高质量
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#f4f1e8', // 与纯净模式一致的底色，避免透明叠加
      width: certificateElement.offsetWidth,
      height: certificateElement.offsetHeight,
      scrollX: 0,
      scrollY: 0
    });

    // 创建PDF
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4'
    });

    // 计算PDF尺寸
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    
    // 计算图片尺寸，保持宽高比
    const imgWidth = canvas.width;
    const imgHeight = canvas.height;
    const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
    const finalWidth = imgWidth * ratio;
    const finalHeight = imgHeight * ratio;
    
    // 居中放置
    const x = (pdfWidth - finalWidth) / 2;
    const y = (pdfHeight - finalHeight) / 2;

    // 添加图片到PDF
    const imgData = canvas.toDataURL('image/png', 1.0);
    pdf.addImage(imgData, 'PNG', x, y, finalWidth, finalHeight);

    // 生成文件名
    const username = document.getElementById('certAgent')?.textContent || 'Agent';
    const fileName = `MythicalHelper_Certificate_${username.replace(/\s+/g, '_')}.pdf`;

    // 下载PDF
    pdf.save(fileName);

    // 恢复按钮状态
    button.textContent = originalText;
    button.disabled = false;

  } catch (error) {
    console.error('Error generating PDF:', error);
    alert('Failed to generate PDF. Please try again.');
    
    // 恢复按钮状态
    const button = document.getElementById('downloadPDF');
    button.textContent = 'Download Certificate PDF';
    button.disabled = false;
  }
  finally {
    // 退出纯净模式
    document.body.classList.remove('print-capture');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  loadScan();
  $('#btnRefresh')?.addEventListener('click', loadScan);
  $('#btnShare')?.addEventListener('click', async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: document.title, url: window.location.href });
      } else {
        await navigator.clipboard.writeText(window.location.href);
        alert('Link copied to clipboard');
      }
    } catch {}
  });
  
  // 添加PDF下载按钮事件
  $('#downloadPDF')?.addEventListener('click', generateCertificatePDF);
});
