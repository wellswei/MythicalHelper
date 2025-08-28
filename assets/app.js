// Common utilities and API wrapper chooser
(function(){
  const cfg = window.MH_CONFIG || {};

  function qs(sel, el) { return (el||document).querySelector(sel); }
  function qsa(sel, el) { return Array.from((el||document).querySelectorAll(sel)); }
  function on(sel, ev, fn) { (typeof sel === 'string' ? qsa(sel) : [sel]).forEach(el => el.addEventListener(ev, fn)); }
  function setBusy(el, busy) { if (!el) return; el.disabled = !!busy; el.classList.toggle('busy', !!busy); }
  
  // 改进的 toast 提示系统
  function toast(msg, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = msg;
    document.body.appendChild(toast);
    
    // 自动显示和隐藏
    setTimeout(() => {
      toast.classList.add('show');
      setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
      }, 3000);
    }, 100);
  }

  function formatPhone(raw) { return String(raw||'').trim(); }

  // 表单验证工具
  function validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  function validatePhone(phone) {
    return /^\+?[\d\s\-\(\)]+$/.test(phone);
  }

  // Real API client (minimal; to be implemented when backend ready)
  function realApi(base){
    async function post(path, body){
      const res = await fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body||{}) });
      if (!res.ok) throw new Error(`API ${path} ${res.status}`);
      return res.json();
    }
    async function get(path){
      const res = await fetch(base + path);
      if (!res.ok) throw new Error(`API ${path} ${res.status}`);
      return res.json();
    }
    return {
      sendEmailOtp: (email, turnstileToken) => post('/auth/email/send-otp', { email, turnstile_token: turnstileToken }),
      verifyEmailOtp: (email, code) => post('/auth/email/verify', { email, code }),
      sendSmsOtp: (phone) => post('/auth/sms/send-otp', { phone }),
      verifySmsOtp: (phone, code) => post('/auth/sms/verify', { phone, code }),
      generateCertificate: (payload) => post('/certificates', payload),
      checkCertificate: (serial) => get('/certificates/' + encodeURIComponent(serial)),
    };
  }

  // Attach chosen API to window for per-page scripts
  async function init(){
    if (cfg.useMockApi) {
      // Load mock api script on demand
      await import('./mockApi.js');
      window.MH_API = window.MH_MOCK_API;
    } else {
      if (!cfg.apiBase) console.warn('apiBase is empty but useMockApi=false');
      window.MH_API = realApi(cfg.apiBase || '');
    }
  }

  // Expose helpers
  window.$mh = { qs, qsa, on, setBusy, toast, cfg, formatPhone, validateEmail, validatePhone };

  // initialize asap
  init();
})();

