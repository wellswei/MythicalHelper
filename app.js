// Enchanted Helpers Guild — Single Page App (mock-ready)
(function(){
  // Config (consolidated)
  const CFG = {
    apiBaseUrl: 'https://api.mythicalhelper.org',
    mock: true,
    turnstileSiteKey: '1x00000000000000000000AA',
  };

  // Tiny utils
  const $ = (s, r=document)=>r.querySelector(s);
  const $$ = (s, r=document)=>Array.from(r.querySelectorAll(s));
  const formToJSON = (f)=>Object.fromEntries(new FormData(f).entries());
  const sleep = (ms)=>new Promise(r=>setTimeout(r,ms));
  let toastTimer; const toast=(msg,ms=2200)=>{ let el=$('#toast'); if(!el){el=document.createElement('div'); el.id='toast'; document.body.appendChild(el);} el.textContent=msg; el.classList.add('show'); clearTimeout(toastTimer); toastTimer=setTimeout(()=>el.classList.remove('show'),ms)};

  // Session (localStorage for demo)
  const SKEY='mh_session_v1';
  const session=()=>{try{return JSON.parse(localStorage.getItem(SKEY)||'{}')}catch{return{}}};
  const setSession=(p)=>{const v={...session(),...p}; localStorage.setItem(SKEY, JSON.stringify(v)); return v;};
  const clearSession=()=>localStorage.removeItem(SKEY);
  const requireEmail=()=>{const s=session(); if(!s.email||!s.emailVerified) location.hash='#/signup';};
  const requirePhone=()=>{const s=session(); if(!s.email||!s.emailVerified) return location.hash='#/signup'; if(!s.phone||!s.phoneVerified) return location.hash='#/phone';};

  // i18n dictionaries (EN primary)
  const I18N = {
    en: {
      brand_name: 'Mythical Helper',
      nav_home: 'Home', nav_join: 'Join', nav_verify: 'Verify',
      hero_title: 'Official Helper Certificates for Young Dreamers',
      hero_lead: 'Become a certified Helper from the North Pole, the Tooth Fairy Circle, or the Spring Bunny Caravan — keep the wonder alive with a scannable certificate.',
      hero_lead_story: 'Welcome to the Mythical Helper guild — where grown‑ups become certified guardians of childhood wonder.',
      cta_start: 'Begin', cta_verify: 'Verify',
      f_secure: 'Two-Step Safeguard',
      f_secure_desc: 'Email and SMS codes confirm you’re a grown‑up Helper.',
      f_official: 'Official Certificate',
      f_official_desc: 'Unique serial + QR code for on‑site verification.',
      f_privacy: 'Wonder, Not Data',
      f_privacy_desc: 'We collect only what’s needed for the magic.',
      signup_title: 'Join the Guild · Email',
      signup_lore: 'Step 1: The Messenger Owl delivers your email code.',
      label_email: 'Email', label_human: 'Humanity Check', label_human_help: 'Protected by Cloudflare Turnstile.',
      btn_email_send: 'Send Code', label_email_code: 'Verification Code', help_email_sent: 'We’ve sent a code to your email.',
      btn_back: 'Back', btn_continue: 'Verify & Continue',
      phone_title: 'Join the Guild · Phone',
      phone_lore: 'Step 2: The Spring Bunny hops by with your SMS code.',
      label_phone: 'Phone (with country code)', label_phone_help: 'International numbers (via SNS).',
      btn_sms_send: 'Send SMS Code', label_sms_code: 'SMS Code',
      gen_title: 'Create Certificate', label_role: 'Choose a Role', opt_select: 'Please select', opt_santa: 'North Pole Helper', opt_tooth: 'Tooth Fairy Circle', opt_bunny: 'Spring Bunny Caravan', opt_custom: 'Custom', label_custom_role: 'Custom Role Name',
      label_young: 'Young Dreamer name (optional)', label_young_help: 'Shown on the certificate only.', label_policy: 'Display policy', policy_visible: 'Show on certificate', policy_hidden: 'Hide from certificate', btn_generate: 'Generate PDF',
      gen_success: 'Your certificate is ready. A copy is sent via email.', serial: 'Serial:', download: 'Download:', verify_link: 'Verify link:', go_verify: 'Go verify',
      verify_title: 'Verify Certificate', label_serial: 'Enter serial', btn_lookup: 'Lookup',
      gen_lore: 'Step 3: The North Pole Scribes prepare your parchment.',
      gen_roles_note: 'Now hiring more roles: Dream Guardian, Starlight Messenger, Lantern Spirit — the Guild is in talks to welcome them.',
      cert_title: 'Certificate of Mythical Helping', cert_serial: 'Serial:', cert_sign: 'By the Council of Wonder',
      t_sent_email: 'Code sent to email', t_email_verified: 'Email verified', t_sent_sms: 'SMS sent', t_phone_verified: 'Phone verified', t_gen_ok: 'Certificate created', not_found: 'Certificate not found', status_valid: 'Valid', status_expired: 'Expired', status_revoked: 'Revoked',
    },
    zh: {
      brand_name: 'Mythical Helper',
      nav_home: '首页', nav_join: '加入', nav_verify: '验证',
      hero_title: '为小小梦想家颁发“官方助手证书”',
      hero_lead: '成为北境工坊、牙仙之环或春野兔队的认证助手，用可扫码的证书守护仪式与惊喜。',
      hero_lead_story: '欢迎来到 Mythical Helper —— 在这里，成年守护者将被授予守护童真之证。',
      cta_start: '开始', cta_verify: '验证',
      f_secure: '双重校验', f_secure_desc: '邮箱与短信验证码，确认你是成年助手。',
      f_official: '官方证书', f_official_desc: '唯一序列号 + 二维码，线上可查。',
      f_privacy: '守护童真', f_privacy_desc: '只收集完成魔法所需的信息。',
      signup_title: '加入公会 · 邮箱', signup_lore: '第一步：猫头鹰信使将送来你的邮箱验证码。', label_email: '邮箱', label_human: '人机校验', label_human_help: '由 Cloudflare Turnstile 保护。',
      btn_email_send: '发送验证码', label_email_code: '邮箱验证码', help_email_sent: '验证码已发送至你的邮箱。', btn_back: '返回', btn_continue: '验证并继续',
      phone_title: '加入公会 · 手机', phone_lore: '第二步：春野兔会把短信验证码轻轻递到你手心。', label_phone: '手机号（含国家区号）', label_phone_help: '目前支持海外手机号（SNS）。', btn_sms_send: '发送短信验证码', label_sms_code: '短信验证码',
      gen_title: '生成证书', label_role: '选择角色', opt_select: '请选择', opt_santa: '北境工坊助手', opt_tooth: '牙仙之环助手', opt_bunny: '春野兔队助手', opt_custom: '自定义', label_custom_role: '自定义角色名', label_young: '小小梦想家称呼（可选）', label_young_help: '仅用于证书显示。', label_policy: '展示策略', policy_visible: '证书上显示', policy_hidden: '证书上隐藏', btn_generate: '生成 PDF', gen_success: '证书已生成，邮件已发送副本。', serial: '序列号：', download: '下载：', verify_link: '验证链接：', go_verify: '去验证',
      verify_title: '验证证书', label_serial: '输入序列号', btn_lookup: '查询',
      gen_lore: '第三步：北境书记官正在誊抄你的羊皮卷。',
      gen_roles_note: '更多角色招募中：梦境守护者、繁星信使、灯影之灵 —— 公会正在与他们洽谈加入时间。',
      cert_title: 'Mythical Helper 官方助手证书', cert_serial: '序列号：', cert_sign: '童真议会签署',
      t_sent_email: '验证码已发送至邮箱', t_email_verified: '邮箱已验证', t_sent_sms: '短信已发送', t_phone_verified: '手机已验证', t_gen_ok: '证书生成成功', not_found: '未找到该证书', status_valid: '有效', status_expired: '已过期', status_revoked: '已撤销',
    },
    es: {
      brand_name: 'Mythical Helper',
      nav_home: 'Inicio', nav_join: 'Unirse', nav_verify: 'Verificar',
      hero_title: 'Certificados oficiales para pequeños soñadores',
      hero_lead: 'Conviértete en Ayudante del Polo Norte, Círculo del Hada de los Dientes o Caravana del Conejo de Primavera — mantén la magia con un certificado escaneable.',
      hero_lead_story: 'Bienvenido a Mythical Helper: donde los adultos se convierten en guardianes certificados de la maravilla infantil.',
      cta_start: 'Comenzar', cta_verify: 'Verificar',
      f_secure: 'Doble verificación', f_secure_desc: 'Correo y SMS confirman que eres un Ayudante adulto.',
      f_official: 'Certificado oficial', f_official_desc: 'Serie única + código QR para verificación.',
      f_privacy: 'Magia, no datos', f_privacy_desc: 'Solo recopilamos lo necesario para la magia.',
      signup_title: 'Unirse al gremio · Correo', signup_lore: 'Paso 1: El búho mensajero trae tu código de correo.', label_email: 'Correo', label_human: 'Comprobación humana', label_human_help: 'Protegido por Cloudflare Turnstile.', btn_email_send: 'Enviar código', label_email_code: 'Código de verificación', help_email_sent: 'Hemos enviado un código a tu correo.', btn_back: 'Atrás', btn_continue: 'Verificar y continuar',
      phone_title: 'Unirse al gremio · Teléfono', phone_lore: 'Paso 2: El conejo primaveral salta con tu código SMS.', label_phone: 'Teléfono (con código país)', label_phone_help: 'Números internacionales (SNS).', btn_sms_send: 'Enviar código SMS', label_sms_code: 'Código SMS',
      gen_title: 'Crear certificado', label_role: 'Elegir rol', opt_select: 'Seleccionar', opt_santa: 'Ayudante del Polo Norte', opt_tooth: 'Círculo del Hada', opt_bunny: 'Caravana de Primavera', opt_custom: 'Personalizado', label_custom_role: 'Nombre de rol personal', label_young: 'Nombre del pequeño soñador (opcional)', label_young_help: 'Solo se muestra en el certificado.', label_policy: 'Política de visibilidad', policy_visible: 'Mostrar en certificado', policy_hidden: 'Ocultar del certificado', btn_generate: 'Generar PDF', gen_success: 'Tu certificado está listo. Se envió una copia por correo.', serial: 'Serie:', download: 'Descargar:', verify_link: 'Enlace de verificación:', go_verify: 'Ir a verificar',
      verify_title: 'Verificar certificado', label_serial: 'Ingresa la serie', btn_lookup: 'Buscar',
      gen_lore: 'Paso 3: Los escribas del Norte preparan tu pergamino.',
      gen_roles_note: 'Próximamente: Guardián de Sueños, Mensajero de Estrellas, Espíritu Linterna — el gremio está en conversaciones para darles la bienvenida.',
      cert_title: 'Certificado de Ayudante Mítico', cert_serial: 'Serie:', cert_sign: 'Por el Consejo de la Maravilla',
      t_sent_email: 'Código enviado al correo', t_email_verified: 'Correo verificado', t_sent_sms: 'SMS enviado', t_phone_verified: 'Teléfono verificado', t_gen_ok: 'Certificado creado', not_found: 'No se encontró el certificado', status_valid: 'Vigente', status_expired: 'Vencido', status_revoked: 'Revocado',
    }
  };

  const state = { lang: guessLang() };
  function guessLang(){ const l=(navigator.language||'en').slice(0,2); return ['en','zh','es'].includes(l)?l:'en'; }
  function t(key){ return (I18N[state.lang] && I18N[state.lang][key]) || I18N.en[key] || key; }
  function applyI18N(){ $$('[data-i18n]').forEach(el=>{ el.textContent = t(el.getAttribute('data-i18n')); }); document.documentElement.lang = state.lang; $('#lang').value = state.lang; }

  // API (with mock)
  const http = async (path, opts={}) => {
    const r = await fetch(CFG.apiBaseUrl+path, { headers:{'Content-Type':'application/json',...(opts.headers||{})}, ...opts });
    if(!r.ok) throw new Error(`HTTP ${r.status}`); return r.json();
  };
  const readLS=(k,d)=>{try{return JSON.parse(localStorage.getItem(k)||JSON.stringify(d))}catch{return d}};
  const writeLS=(k,v)=>localStorage.setItem(k, JSON.stringify(v));
  const rndCode=()=>String(Math.floor(100000+Math.random()*900000));
  const today=()=>new Date().toISOString().slice(0,10).replace(/-/g,'');
  const mkSerial=()=>`MH-${today()}-${(Math.random()*1e8|0).toString(36).toUpperCase()}`;
  const API = {
    async emailOtp({email, turnstileToken}){
      if(!email) throw new Error('Email required');
      if(!CFG.mock) return http('/auth/email/otp',{method:'POST',body:JSON.stringify({email,turnstile_token:turnstileToken})});
      const map=readLS('mh_email_codes',{}); const code=rndCode(); map[email]={code,ts:Date.now()}; writeLS('mh_email_codes',map); return {ok:true,mock:true,code};
    },
    async emailVerify({email, code}){
      if(!email||!code) throw new Error('Code required');
      if(!CFG.mock) return http('/auth/email/verify',{method:'POST',body:JSON.stringify({email,code})});
      const map=readLS('mh_email_codes',{}); if(!map[email]||map[email].code!==code) throw new Error('Invalid code'); return {ok:true,token:'mock-email'};
    },
    async smsOtp({phone}){
      if(!phone) throw new Error('Phone required');
      if(!CFG.mock) return http('/auth/phone/otp',{method:'POST',body:JSON.stringify({phone})});
      const map=readLS('mh_sms_codes',{}); const code=rndCode(); map[phone]={code,ts:Date.now()}; writeLS('mh_sms_codes',map); return {ok:true,mock:true,code};
    },
    async smsVerify({phone,code}){
      if(!CFG.mock) return http('/auth/phone/verify',{method:'POST',body:JSON.stringify({phone,code})});
      const map=readLS('mh_sms_codes',{}); if(!map[phone]||map[phone].code!==code) throw new Error('Invalid code'); return {ok:true,token:'mock-sms'};
    },
    async generate({role, youngName, displayPolicy}){
      if(!role) throw new Error('Role required');
      if(!CFG.mock) return http('/certificates',{method:'POST',body:JSON.stringify({role, child_name:youngName, display_policy:displayPolicy})});
      const serial=mkSerial(); const now=Date.now(); const expires=now+365*24*3600*1000; const verifyUrl = `${location.origin}${location.pathname}#/verify?s=${encodeURIComponent(serial)}`;
      const db=readLS('mh_certs',{}); db[serial]={serial,role,youngName,displayPolicy,status:'valid',createdAt:now,expiresAt:expires}; writeLS('mh_certs',db);
      const pdfUrl='data:application/pdf;base64,'+btoa('%PDF-1.4\n%mock-pdf\n');
      return {ok:true,serial,download_url:pdfUrl,verify_url:verifyUrl};
    },
    async status({serial}){
      if(!CFG.mock) return http(`/certificates/${encodeURIComponent(serial)}`);
      const db=readLS('mh_certs',{}); const it=db[serial]; if(!it) return {ok:false,status:'not_found'}; const now=Date.now(); let st=it.status; if(now>it.expiresAt) st='expired'; return {ok:true,status:st, ...it};
    }
  };

  // Router
  const views = ['home','signup','phone','generate','verify'];
  function show(view){ views.forEach(v=>{ const el=$(`[data-view="${v}"]`); if(el) el.classList.toggle('hidden', v!==view); });
    $$('.nav a').forEach(a=>a.classList.toggle('active', a.getAttribute('href')===`#/${view==='home'?'':view}`)); }
  async function route(){
    const url = new URL(location.href);
    const hash = (location.hash||'#/').replace(/^#\//,'');
    const [seg] = hash.split('?')[0].split('/');
    const view = seg || 'home';
    if(view==='signup') requireEmail(); // allow direct
    if(view==='phone') requireEmail();
    if(view==='generate') requirePhone();
    show(view);
    if(view==='verify') { const s=new URLSearchParams(url.hash.split('?')[1]||'').get('s'); if(s) { const input=$('#serial'); if(input) input.value=s; await doLookup(s); } }
  }

  // Email step
  function initEmail(){
    const tsEl = $('#cf-turnstile'); if(tsEl) tsEl.setAttribute('data-sitekey', CFG.turnstileSiteKey);
    const emailForm = $('#email-form'); const verifyForm = $('#email-verify-form');
    emailForm?.addEventListener('submit', async (e)=>{
      e.preventDefault(); const { email } = formToJSON(emailForm);
      try{ const token = window.turnstile?.getResponse?.(tsEl) || 'mock-turnstile-token'; const res = await API.emailOtp({email, turnstileToken:token}); if(res.mock&&res.code) toast(`Mock: ${res.code}`); toast(t('t_sent_email')); setSession({email, emailVerified:false}); emailForm.classList.add('hidden'); verifyForm.classList.remove('hidden'); }
      catch(err){ toast(err.message||'Send failed'); }
    });
    $('#back-edit-email')?.addEventListener('click', ()=>{ verifyForm.classList.add('hidden'); emailForm.classList.remove('hidden'); });
    verifyForm?.addEventListener('submit', async (e)=>{
      e.preventDefault(); const { email } = session(); const { code } = formToJSON(verifyForm);
      try{ await API.emailVerify({email, code}); setSession({emailVerified:true}); toast(t('t_email_verified')); await sleep(300); location.hash='#/phone'; }
      catch(err){ toast(err.message||'Verify failed'); }
    });
  }

  // Phone step
  function initPhone(){
    const phoneForm = $('#phone-form'); const verifyForm = $('#phone-verify-form');
    phoneForm?.addEventListener('submit', async (e)=>{
      e.preventDefault(); const { phone } = formToJSON(phoneForm);
      try{ const res = await API.smsOtp({phone}); if(res.mock&&res.code) toast(`Mock: ${res.code}`); setSession({phone, phoneVerified:false}); toast(t('t_sent_sms')); phoneForm.classList.add('hidden'); verifyForm.classList.remove('hidden'); }
      catch(err){ toast(err.message||'Send failed'); }
    });
    $('#back-edit-phone')?.addEventListener('click', ()=>{ verifyForm.classList.add('hidden'); phoneForm.classList.remove('hidden'); });
    verifyForm?.addEventListener('submit', async (e)=>{
      e.preventDefault(); const { phone } = session(); const { code } = formToJSON(verifyForm);
      try{ await API.smsVerify({phone, code}); setSession({phoneVerified:true}); toast(t('t_phone_verified')); await sleep(300); location.hash='#/generate'; }
      catch(err){ toast(err.message||'Verify failed'); }
    });
  }

  // Generate
  function initGenerate(){
    const form = $('#gen-form'); const roleEl = $('#role'); const customField = $('#custom-role-field');
    roleEl?.addEventListener('change', ()=>{ customField.classList.toggle('hidden', roleEl.value!=='custom'); });
    // Live preview
    const roleText=()=>{
      const v=roleEl.value; const opt=roleEl.options[roleEl.selectedIndex];
      return v==='custom' ? ($('#customRole').value||'Custom') : (opt?.textContent||'—');
    };
    const updatePreview=(serial)=>{
      $('#preview-role').textContent = roleText();
      $('#preview-name').textContent = ($('#youngName').value || 'Young Dreamer');
      if (serial) $('#preview-serial').textContent = serial;
    };
    roleEl?.addEventListener('input', ()=>updatePreview());
    $('#customRole')?.addEventListener('input', ()=>updatePreview());
    $('#youngName')?.addEventListener('input', ()=>updatePreview());
    updatePreview();
    form?.addEventListener('submit', async (e)=>{
      e.preventDefault(); let { role, customRole, youngName, displayPolicy } = formToJSON(form); if(role==='custom'){ if(!customRole) return toast('Please enter a custom role'); role = customRole; }
      try{ const res = await API.generate({role, youngName, displayPolicy}); $('#res-serial').textContent=res.serial; const dl=$('#res-download'); dl.href=res.download_url; const v=$('#res-verify'); v.href=res.verify_url; v.textContent=res.verify_url; form.classList.add('hidden'); $('#gen-result').classList.remove('hidden'); toast(t('t_gen_ok')); }
      catch(err){ toast(err.message||'Generate failed'); }
    });
  }

  // Verify
  async function doLookup(serial){ try{ const r = await API.status({serial}); if(!r.ok) throw new Error(r.status||'not_found'); renderStatus(r); } catch(err){ renderNotFound(); } }
  function renderStatus(d){ const box=$('#result'); const created=d.createdAt?new Date(d.createdAt).toLocaleString():''; const expires=d.expiresAt?new Date(d.expiresAt).toLocaleDateString():''; box.classList.remove('hidden'); box.className='panel'; box.innerHTML=`
    <div class="list">
      <div><strong>${t('label_serial')}</strong> ${d.serial}</div>
      ${d.role?`<div><strong>Role:</strong> ${d.role}</div>`:''}
      ${d.youngName?`<div><strong>Young Dreamer:</strong> ${d.youngName}</div>`:''}
      ${d.createdAt?`<div><strong>Created:</strong> ${created}</div>`:''}
      ${d.expiresAt?`<div><strong>Expires:</strong> ${expires}</div>`:''}
      <div><strong>Status:</strong> ${t('status_'+d.status)}</div>
    </div>`; }
  function renderNotFound(){ const box=$('#result'); box.classList.remove('hidden'); box.className='alert danger'; box.textContent=t('not_found'); }
  function initVerify(){ const form=$('#verify-form'); form?.addEventListener('submit', async (e)=>{ e.preventDefault(); const { serial } = formToJSON(form); await doLookup(serial.trim()); }); }

  // Lang switch
  function initLang(){ const sel=$('#lang'); sel.addEventListener('change', ()=>{ state.lang=sel.value; applyI18N(); }); applyI18N(); }

  // Sparkles on brand logo + magic button hover
  function spawnSparks(parent, count=6){ const rect = parent.getBoundingClientRect(); for(let i=0;i<count;i++){ const s=document.createElement('span'); s.className='spark'; const x=Math.random()*parent.clientWidth; const y=parent.clientHeight*0.6 + Math.random()*6; s.style.left = (x-3)+'px'; s.style.top = (y-3)+'px'; parent.appendChild(s); setTimeout(()=>s.remove(), 800); } }
  function initSparkles(){ const logo=$('.brand .logo'); if(logo){ logo.style.cursor='pointer'; logo.addEventListener('click', ()=>spawnSparks(logo,10)); }
    $$('.btn.magic').forEach(btn=>{ btn.addEventListener('mouseenter', ()=>spawnSparks(btn,8)); }); }

  // Init
  window.addEventListener('hashchange', route);
  document.addEventListener('DOMContentLoaded', ()=>{
    initLang(); initEmail(); initPhone(); initGenerate(); initVerify(); initSparkles(); route();
  });
})();
