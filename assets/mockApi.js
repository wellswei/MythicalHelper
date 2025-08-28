// Very light mock API for local flow testing
(function(){
  const STORE_KEY = 'mh_mock';
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const nowIso = () => new Date().toISOString();

  function load(){ try { return JSON.parse(localStorage.getItem(STORE_KEY)||'{}'); } catch { return {}; } }
  function save(data){ localStorage.setItem(STORE_KEY, JSON.stringify(data)); }
  function getDb(){ const db = load(); db.users ||= {}; db.certs ||= {}; return db; }

  function serial(){ const r = Math.random().toString(16).slice(2,6).toUpperCase(); return `MH-${Date.now()}-${r}`; }
  function futureDays(days){ const d = new Date(); d.setDate(d.getDate()+days); return d.toISOString(); }
  function qrUrl(data){
    const url = new URL(location.origin + '/check.html');
    url.searchParams.set('serial', data);
    // Simple remote QR image (placeholder). Replace later with backend QR.
    return `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(url.toString())}`;
  }

  async function sendEmailOtp(email){
    await sleep(500);
    
    // 模拟邮箱格式验证
    if (!email.includes('@') || !email.includes('.')) {
      throw new Error('邮箱格式不正确');
    }
    
    // 模拟网络错误（10% 概率）
    if (Math.random() < 0.1) {
      throw new Error('网络连接失败，请稍后重试');
    }
    
    const db = getDb();
    const code = ('' + Math.floor(100000 + Math.random()*900000)).slice(-6);
    db.users[email] ||= { email, email_verified: false, phone_verified: false };
    db.users[email].email_code = code;
    db.users[email].email_code_at = nowIso();
    save(db);
    console.info('[mock] Email OTP for', email, 'is', code);
    return { ok: true };
  }

  async function verifyEmailOtp(email, code){
    await sleep(400);
    const db = getDb();
    const u = db.users[email];
    if (!u || u.email_code !== code) throw new Error('验证码不正确');
    u.email_verified = true; u.email_verified_at = nowIso();
    save(db);
    sessionStorage.setItem('mh_session', JSON.stringify({ email }));
    return { ok: true };
  }

  async function sendSmsOtp(phone){
    await sleep(500);
    
    // 模拟手机号格式验证
    if (!phone || phone.length < 8) {
      throw new Error('手机号格式不正确');
    }
    
    // 模拟网络错误（5% 概率）
    if (Math.random() < 0.05) {
      throw new Error('短信服务暂时不可用，请稍后重试');
    }
    
    const db = getDb();
    const sess = JSON.parse(sessionStorage.getItem('mh_session')||'{}');
    if (!sess.email) throw new Error('需要先完成邮箱验证');
    const code = ('' + Math.floor(100000 + Math.random()*900000)).slice(-6);
    db.users[sess.email].phone ||= phone;
    db.users[sess.email].sms_code = code;
    db.users[sess.email].sms_code_at = nowIso();
    save(db);
    console.info('[mock] SMS OTP for', phone, 'is', code);
    return { ok: true };
  }

  async function verifySmsOtp(phone, code){
    await sleep(400);
    const db = getDb();
    const sess = JSON.parse(sessionStorage.getItem('mh_session')||'{}');
    if (!sess.email) throw new Error('需要先完成邮箱验证');
    const u = db.users[sess.email];
    if (!u || u.sms_code !== code) throw new Error('短信验证码不正确');
    u.phone_verified = true; u.phone_verified_at = nowIso(); u.phone = phone;
    save(db);
    return { ok: true };
  }

  async function generateCertificate(payload){
    await sleep(600);
    const { role, child_name, display_policy } = payload || {};
    const db = getDb();
    const sess = JSON.parse(sessionStorage.getItem('mh_session')||'{}');
    if (!sess.email) throw new Error('需要先完成邮箱验证');
    const u = db.users[sess.email];
    if (!u || !u.phone_verified) throw new Error('需要先完成手机验证');
    const s = serial();
    const rec = {
      serial: s,
      role,
      child_name: child_name||'',
      display_policy: display_policy||'hidden',
      status: 'valid',
      issued_to: sess.email,
      issued_at: nowIso(),
      expires_at: futureDays(365),
      qr_url: qrUrl(s),
      pdf_url: '#', // Placeholder; real backend will provide
    };
    db.certs[s] = rec; save(db);
    return rec;
  }

  async function checkCertificate(s){
    await sleep(200);
    const db = getDb();
    const rec = db.certs[s];
    if (!rec) throw new Error('未找到该序列号');
    // Optionally simulate expiration
    return rec;
  }

  window.MH_MOCK_API = {
    sendEmailOtp: (email, _token) => sendEmailOtp(email),
    verifyEmailOtp,
    sendSmsOtp,
    verifySmsOtp,
    generateCertificate,
    checkCertificate,
  };
})();

