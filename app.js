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

  // === 新增：会话 & 权限辅助 ===
  const isAuthed = () => {
    const s = session();
    return !!(s.emailVerified && s.phoneVerified);
  };
  const hasMembership = () => {
    const s = session();
    return !!s.membershipActive;
  };
  function updateNav() {
    const show = (sel, on) => {
      const el = document.querySelector(sel);
      if (!el) return;
      el.classList.toggle('hidden', !on);
    };
    show('[data-nav="login"]', !isAuthed());
    show('[data-nav="account"]', isAuthed());
    show('[data-nav="billing"]', isAuthed());
  }

  // i18n dictionaries (EN primary)
  const I18N = {
    en: {
      brand_name: 'Enchanted Helpers Guild',
      nav_home: 'Home', nav_join: 'Join', nav_verify: 'Verify',
      hero_title: 'Official Helper Certificates for Young Dreamers',
      hero_lead: 'Become a certified Helper from the North Pole, the Tooth Fairy Circle, or the Spring Bunny Caravan — keep the wonder alive with a scannable certificate.',
      cta_start: 'Begin', cta_verify: 'Verify',
      f_secure: 'Two-Step Safeguard',
      f_secure_desc: 'Email and SMS codes confirm you\'re a grown‑up Helper.',
      f_official: 'Official Certificate',
      f_official_desc: 'Unique serial + QR code for on‑site verification.',
      f_privacy: 'Wonder, Not Data',
      f_privacy_desc: 'We collect only what\'s needed for the magic.',
      how_title: 'How It Works',
      how_lead: 'A friendly, grown-up hiring flow — quick, safe, and a little magical.',
      how_1_t: 'Messenger Owl',
      how_1_d: 'We send a code to your email to greet you at the gate.',
      how_2_t: 'Spring Bunny',
      how_2_d: 'A quick SMS confirms you\'re a grown-up Helper.',
      how_3_t: 'Scribes of the North',
      how_3_d: 'Your parchment is stamped with a unique serial and QR.',
      apply_title: 'Apply for the Job',
      apply_intro: 'Adults are vetted and hired to help Santa, the Tooth Fairy, and the Spring Bunny keep wonder alive.',
      apply_more: 'More roles on the horizon — the Guild is in talks to welcome new friends.',
      opt_santa: 'North Pole Helper',
      opt_santa_desc: 'Assist Santa with gift delivery logistics and reindeer management.',
      opt_tooth: 'Tooth Fairy Circle',
      opt_tooth_desc: 'Help collect teeth and leave coins under pillows worldwide.',
      opt_bunny: 'Spring Bunny Caravan',
      opt_bunny_desc: 'Distribute eggs and spread spring joy across the land.',
      signup_title: 'Join the Guild · Email',
      label_email: 'Email', label_human: 'Humanity Check', label_human_help: 'Protected by Cloudflare Turnstile.',
      btn_email_send: 'Send Code', label_email_code: 'Verification Code', help_email_sent: 'We\'ve sent a code to your email.',
      btn_back: 'Back', btn_continue: 'Verify & Continue',
      phone_title: 'Join the Guild · Phone', label_phone: 'Phone (with country code)', label_phone_help: 'International numbers (via SNS).',
      btn_sms_send: 'Send SMS Code', label_sms_code: 'SMS Code',
      gen_title: 'Create Certificate', label_role: 'Choose a Role', opt_select: 'Please select', opt_custom: 'Custom', label_custom_role: 'Custom Role Name',
      label_young: 'Young Dreamer name (optional)', label_young_help: 'Shown on the certificate only.', label_policy: 'Display policy', policy_visible: 'Show on certificate', policy_hidden: 'Hide from certificate', btn_generate: 'Generate PDF',
      gen_success: 'Your certificate is ready. A copy is sent via email.', serial: 'Serial:', download: 'Download:', verify_link: 'Verify link:', go_verify: 'Go verify',
      verify_title: 'Verify Certificate', label_serial: 'Enter serial', btn_lookup: 'Lookup',
      login_title: 'Login',
      login_intro: 'Use your email and SMS codes to sign in. If you\'re new, you\'ll create your account along the way.',
      account_title: 'Your Account',
      account_certs: 'Your Certificates',
      billing_title: 'Membership',
      plan_helper: 'Helper Guild Membership',
      plan_b1: 'Create unlimited certificates',
      plan_b2: 'Download printable badges',
      plan_b3: 'Priority support',
      subscribe_now: 'Subscribe (mock)',
      billing_note: 'Payments are processed by Stripe (coming soon). For now, this is a demo switch to activate membership.',
      t_sent_email: 'Code sent to email', t_email_verified: 'Email verified', t_sent_sms: 'SMS sent', t_phone_verified: 'Phone verified', t_gen_ok: 'Certificate created', not_found: 'Certificate not found', status_valid: 'Valid', status_expired: 'Expired', status_revoked: 'Revoked',
    },
    zh: {
      brand_name: '魔法助手公会',
      nav_home: '首页', nav_join: '加入', nav_verify: '验证',
      hero_title: '为小小梦想家颁发"官方助手证书"',
      hero_lead: '成为北境工坊、牙仙之环或春野兔队的认证助手，用可扫码的证书守护仪式与惊喜。',
      cta_start: '开始', cta_verify: '验证',
      f_secure: '双重校验', f_secure_desc: '邮箱与短信验证码，确认你是成年助手。',
      f_official: '官方证书', f_official_desc: '唯一序列号 + 二维码，线上可查。',
      f_privacy: '守护童真', f_privacy_desc: '只收集完成魔法所需的信息。',
      how_title: '如何加入',
      how_lead: '友好的成年人招聘流程 — 快速、安全，还带点魔法。',
      how_1_t: '信使猫头鹰',
      how_1_d: '我们向你的邮箱发送验证码，在门口迎接你。',
      how_2_t: '春野兔',
      how_2_d: '快速短信确认你是成年助手。',
      how_3_t: '北境文书官',
      how_3_d: '你的羊皮纸会盖上独特的序列号和二维码。',
      apply_title: '申请职位',
      apply_intro: '我们聘请成年人协助圣诞老人、牙仙和春野兔守护童真。',
      apply_more: '更多角色即将到来 — 公会正在洽谈欢迎新朋友。',
      opt_santa: '北境工坊助手',
      opt_santa_desc: '协助圣诞老人处理礼物配送和驯鹿管理。',
      opt_tooth: '牙仙之环助手',
      opt_tooth_desc: '帮助收集牙齿，在枕头下留下硬币。',
      opt_bunny: '春野兔队助手',
      opt_bunny_desc: '分发彩蛋，在各地传播春天的欢乐。',
      signup_title: '加入公会 · 邮箱', label_email: '邮箱', label_human: '人机校验', label_human_help: '由 Cloudflare Turnstile 保护。',
      btn_email_send: '发送验证码', label_email_code: '邮箱验证码', help_email_sent: '验证码已发送至你的邮箱。', btn_back: '返回', btn_continue: '验证并继续',
      phone_title: '加入公会 · 手机', label_phone: '手机号（含国家区号）', label_phone_help: '目前支持海外手机号（SNS）。', btn_sms_send: '发送短信验证码', label_sms_code: '短信验证码',
      gen_title: '生成证书', label_role: '选择角色', opt_select: '请选择', opt_custom: '自定义', label_custom_role: '自定义角色名', label_young: '小小梦想家称呼（可选）', label_young_help: '仅用于证书显示。', label_policy: '展示策略', policy_visible: '证书上显示', policy_hidden: '证书上隐藏', btn_generate: '生成 PDF', gen_success: '证书已生成，邮件已发送副本。', serial: '序列号：', download: '下载：', verify_link: '验证链接：', go_verify: '去验证',
      verify_title: '验证证书', label_serial: '输入序列号', btn_lookup: '查询', login_title: '登录', login_intro: '使用你的邮箱和短信验证码登录。如果你是新人，会在过程中创建账户。', account_title: '你的账户', account_certs: '你的证书', billing_title: '会员订阅', plan_helper: '助手公会会员', plan_b1: '创建无限证书', plan_b2: '下载可打印徽章', plan_b3: '优先支持', subscribe_now: '订阅（演示）', billing_note: '支付由 Stripe 处理（即将推出）。目前这是一个激活会员的演示开关。', t_sent_email: '验证码已发送至邮箱', t_email_verified: '邮箱已验证', t_sent_sms: '短信已发送', t_phone_verified: '手机已验证', t_gen_ok: '证书生成成功', not_found: '未找到该证书', status_valid: '有效', status_expired: '已过期', status_revoked: '已撤销',
    },
    es: {
      brand_name: 'Gremio de Ayudantes Encantados',
      nav_home: 'Inicio', nav_join: 'Unirse', nav_verify: 'Verificar',
      hero_title: 'Certificados oficiales para pequeños soñadores',
      hero_lead: 'Conviértete en Ayudante del Polo Norte, Círculo del Hada de los Dientes o Caravana del Conejo de Primavera — mantén la magia con un certificado escaneable.',
      cta_start: 'Comenzar', cta_verify: 'Verificar',
      f_secure: 'Doble verificación', f_secure_desc: 'Correo y SMS confirman que eres un Ayudante adulto.',
      f_official: 'Certificado oficial', f_official_desc: 'Serie única + código QR para verificación.',
      f_privacy: 'Magia, no datos', f_privacy_desc: 'Solo recopilamos lo necesario para la magia.',
      how_title: 'Cómo funciona',
      how_lead: 'Un flujo de contratación amigable para adultos — rápido, seguro y un poco mágico.',
      how_1_t: 'Búho Mensajero',
      how_1_d: 'Enviamos un código a tu correo para saludarte en la puerta.',
      how_2_t: 'Conejo de Primavera',
      how_2_d: 'Un SMS rápido confirma que eres un Ayudante adulto.',
      how_3_t: 'Escribas del Norte',
      how_3_d: 'Tu pergamino se sella con una serie única y QR.',
      apply_title: 'Solicita el Trabajo',
      apply_intro: 'Los adultos son evaluados y contratados para ayudar a Santa, el Hada de los Dientes y el Conejo de Primavera a mantener la magia.',
      apply_more: 'Más roles en el horizonte — el Gremio está en conversaciones para dar la bienvenida a nuevos amigos.',
      opt_santa: 'Ayudante del Polo Norte',
      opt_santa_desc: 'Ayuda a Santa con la logística de entrega de regalos y gestión de renos.',
      opt_tooth: 'Círculo del Hada',
      opt_tooth_desc: 'Ayuda a recolectar dientes y dejar monedas bajo las almohadas.',
      opt_bunny: 'Caravana de Primavera',
      opt_bunny_desc: 'Distribuye huevos y esparce la alegría de la primavera.',
      signup_title: 'Unirse al gremio · Correo', label_email: 'Correo', label_human: 'Comprobación humana', label_human_help: 'Protegido por Cloudflare Turnstile.', btn_email_send: 'Enviar código', label_email_code: 'Código de verificación', help_email_sent: 'Hemos enviado un código a tu correo.', btn_back: 'Atrás', btn_continue: 'Verificar y continuar',
      phone_title: 'Unirse al gremio · Teléfono', label_phone: 'Teléfono (con código país)', label_phone_help: 'Números internacionales (SNS).', btn_sms_send: 'Enviar código SMS', label_sms_code: 'Código SMS',
      gen_title: 'Crear certificado', label_role: 'Elegir rol', opt_select: 'Seleccionar', opt_custom: 'Personalizado', label_custom_role: 'Nombre de rol personal', label_young: 'Nombre del pequeño soñador (opcional)', label_young_help: 'Solo se muestra en el certificado.', label_policy: 'Política de visibilidad', policy_visible: 'Mostrar en certificado', policy_hidden: 'Ocultar del certificado', btn_generate: 'Generar PDF', gen_success: 'Tu certificado está listo. Se envió una copia por correo.', serial: 'Serie:', download: 'Descargar:', verify_link: 'Enlace de verificación:', go_verify: 'Ir a verificar',
      verify_title: 'Verificar certificado', label_serial: 'Ingresa la serie', btn_lookup: 'Buscar', login_title: 'Iniciar sesión', login_intro: 'Usa tus códigos de correo y SMS para iniciar sesión. Si eres nuevo, crearás tu cuenta en el camino.', account_title: 'Tu cuenta', account_certs: 'Tus certificados', billing_title: 'Membresía', plan_helper: 'Membresía del Gremio de Ayudantes', plan_b1: 'Crear certificados ilimitados', plan_b2: 'Descargar insignias imprimibles', plan_b3: 'Soporte prioritario', subscribe_now: 'Suscribirse (demo)', billing_note: 'Los pagos son procesados por Stripe (próximamente). Por ahora, este es un interruptor de demostración para activar la membresía.', t_sent_email: 'Código enviado al correo', t_email_verified: 'Correo verificado', t_sent_sms: 'SMS enviado', t_phone_verified: 'Teléfono verificado', t_gen_ok: 'Certificado creado', not_found: 'No se encontró el certificado', status_valid: 'Vigente', status_expired: 'Vencido', status_revoked: 'Revocado',
    }
  };

  const state = { lang: guessLang() };
  function guessLang(){ const l=(navigator.language||'en').slice(0,2); return ['en','zh','es'].includes(l)?l:'en'; }
  function t(key){ return (I18N[state.lang] && I18N[state.lang][key]) || I18N.en[key] || key; }
  function applyI18N(){
    $$('[data-i18n]').forEach(el=>{ 
      el.textContent = t(el.getAttribute('data-i18n')); 
    }); 
    document.documentElement.lang = state.lang;
    const langSelect = $('#lang');
    if (langSelect) {
      langSelect.value = state.lang; 
    }
  }

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
      await sleep(1000);
      const code = rndCode();
      writeLS('email_otp', {email, code, time: Date.now()});
      console.log('Mock: Email OTP sent:', code);
      return {success: true, message: 'Code sent'};
    },
    async emailVerify({email, code}){
      if(!email||!code) throw new Error('Email and code required');
      if(!CFG.mock) return http('/auth/email/verify',{method:'POST',body:JSON.stringify({email,code})});
      const stored = readLS('email_otp', {});
      if(stored.email !== email || stored.code !== code) throw new Error('Invalid code');
      if(Date.now() - stored.time > 10*60*1000) throw new Error('Code expired');
      localStorage.removeItem('email_otp');
      return {success: true, message: 'Email verified'};
    },
    async smsOtp({phone}){
      if(!phone) throw new Error('Phone required');
      if(!CFG.mock) return http('/auth/sms/otp',{method:'POST',body:JSON.stringify({phone})});
      await sleep(1000);
      const code = rndCode();
      writeLS('sms_otp', {phone, code, time: Date.now()});
      console.log('Mock: SMS OTP sent:', code);
      return {success: true, message: 'Code sent'};
    },
    async smsVerify({phone, code}){
      if(!phone||!code) throw new Error('Phone and code required');
      if(!CFG.mock) return http('/auth/sms/verify',{method:'POST',body:JSON.stringify({phone,code})});
      const stored = readLS('sms_otp', {});
      if(stored.phone !== phone || stored.code !== code) throw new Error('Invalid code');
      if(Date.now() - stored.time > 10*60*1000) throw new Error('Code expired');
      localStorage.removeItem('sms_otp');
      return {success: true, message: 'Phone verified'};
    },
    async createCert({role, youngName, displayPolicy}){
      if(!role) throw new Error('Role required');
      if(!CFG.mock) return http('/certificates',{method:'POST',body:JSON.stringify({role,youngName,displayPolicy})});
      await sleep(1500);
      const serial = mkSerial();
      const cert = {
        id: Date.now(),
        serial,
        role: role === 'custom' ? (youngName || 'Custom Helper') : role,
        youngName: displayPolicy === 'visible' ? youngName : undefined,
        displayPolicy,
        createdAt: new Date().toISOString(),
        status: 'valid',
        download_url: `#/cert/${serial}`,
        verify_url: `#/verify?s=${serial}`
      };
      const db = readLS('mh_certs', {});
      db[serial] = cert;
      writeLS('mh_certs', db);
      return cert;
    },
    async verifyCert(serial){
      if(!serial) throw new Error('Serial required');
      if(!CFG.mock) return http(`/certificates/${serial}`);
      await sleep(800);
      const db = readLS('mh_certs', {});
      const cert = db[serial];
      if(!cert) return {status: 'not_found'};
      return {status: cert.status, ...cert};
    }
  };

  // --- Apply board (left choices -> right letter preview) ---
  let __applyBoardInit = false;
  function initApplyBoard(){
    const container = document.querySelector('.band-help .apply-grid');
    if (__applyBoardInit) { 
      return; 
    }
    const letterBox = document.getElementById('letter-box');
    const letterContent = document.getElementById('letter-content');
    const choiceButtons = document.querySelectorAll('.band-help .choices .choice');
    if (!container || !letterBox || !letterContent || !choiceButtons.length) return;
    __applyBoardInit = true;

    // Role -> letter copy (random selection)
    const LETTERS = {
      north_pole: [
        { head: 'North Logistics Office',
          body: `Dear Helper,\nFamilies everywhere await parcels of hope. Your duty is to stage small surprises by room, confirm paths are clear and quiet, time the delivery for after lights-out, and leave a simple note where morning eyes will find it. If questions arise, keep the wonder line: "The dispatch was tight, but everything arrived on time."`,
          css: 'role-north', 
          sign: '— Scribes of Winter',
          chip: 'Night Routes · Gift Delivery · Silent Drop' },
        { head: 'Workshop Night Ops',
          body: `Briefing: prepare packages discreetly; choose safe, quiet routes; place the "first find" where little feet might land; leave a seal or short message to mark completion. Window: after bedtime, before dawn chatter.`,
          css: 'role-north', 
          sign: '— Route Captain, NP-7',
          chip: 'Dispatch Window · First Find · Sleigh Mark' },
        { head: 'The Snowbell Desk',
          body: `A calm hand carries the night. Arrange the gift where wonder blooms, tuck a kind line beside it, and move softly so the house keeps dreaming. If early eyes awake, smile and say, "You were on the list, and the night kept its promise."`,
          css: 'role-north', 
          sign: '— The Snowbell Clerk',
          chip: 'Gift Staging · Note Placement · Morning Surprise' }
      ],
      tooth_fairy: [
        { head: 'Tooth Fairy Circle · Exchange Office',
          body: `Appointment: prepare a clean keepsake spot. After bedtime, exchange the milestone (tooth or token) for a small treasure or note. Leave a tiny sparkle trail and a courage line: "Brave step, brave heart." Exit before first light, without waking anyone.`,
          css: 'role-tooth', 
          sign: '— Night Shift, TF-3',
          chip: 'Exchange Duty · Courage Note · Sparkle Trail' },
        { head: 'The Gentle Wing',
          body: `Dear Helper,\nNot every home keeps the same custom, yet every child faces change. Your task is to honor that moment: place a modest reward, set a handwritten note within reach, and keep the keepsake safe. If asked, whisper, "The Circle visited while the moon was working."`,
          css: 'role-tooth', 
          sign: '— Registrar of the Wing',
          chip: 'Tooth Safekeeping · Token Swap · Moon Visit' },
        { head: 'Tiny Treasures Desk',
          body: `Steps: (1) Confirm a quiet approach to the pillow. (2) Swap milestone → coin/message/other token. (3) Leave two or three subtle hints, no noise. (4) Depart silently. Optional: stamp the parchment for morning verification.`,
          css: 'role-tooth', 
          sign: '— Clerk of Glitter',
          chip: 'Pillow Route · Glitter Clues · Dawn Check' }
      ],
      spring_bunny: [
        { head: 'Caravan Trail Office',
          body: `Dear Helper,\nDawn needs a trail map. Color or prepare small tokens of renewal, hide them at eye-level spots, and set a gentle path from door to garden or room to room. Final touch: a paw-mark note by the last find. Begin joyful recovery at the first squeals.`,
          css: 'role-bunny', 
          sign: '— Trailmaster SB-2',
          chip: 'Egg Hiding · Path Design · Pawprint Mark' },
        { head: 'The Hopping Desk',
          body: `Lace laughter through the home. Tuck bright surprises where curiosity grows, leave a warm line—"Spring found you here."—and be ready with a basket for proud returns. Adapt placements to each family's space and tradition.`,
          css: 'role-bunny', 
          sign: '— Keeper of Baskets',
          chip: 'Laughter Trail · Warm Note · Basket Return' },
        { head: 'Bunny Ops · Dawn Unit',
          body: `Checklist: hide tokens (low → mid height), place two "nearly there" clues, set the final piece near a window or well-lit spot. Keep the certificate visible for post-quest cheers. Debrief over breakfast.`,
          css: 'role-bunny', 
          sign: '— Dawn Unit Lead',
          chip: 'Tiered Hiding · Clue Markers · Sunrise Celebration' }
      ]
    };

    // 为每个角色预先随机选择一次信件内容
    const selectedLetters = {};
    Object.keys(LETTERS).forEach(role => {
      const pool = LETTERS[role];
      if (pool && pool.length) {
        selectedLetters[role] = pool[Math.floor(Math.random() * pool.length)];
      }
    });

    const setActive = (role) => {
      console.log('setActive called with role:', role); // 调试信息
      
      // 左侧高亮
      choiceButtons.forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-role') === role);
      });
      
      // 右侧内容：使用预选的信件内容
      const data = selectedLetters[role];
      if (!data) {
        console.log('No data found for role:', role); // 调试信息
        return;
      }
      
      console.log('Updating letter content for:', role, data); // 调试信息
      
      // 更新右侧信件内容
      letterBox.classList.remove('role-north','role-tooth','role-bunny');
      letterBox.classList.add(data.css);
      letterContent.innerHTML = `
        <div class="letter-head">${data.head}</div>
        <p>Dear Helper,</p>
        <p>${data.body.replace(/\n/g,'</p><p>')}</p>
        <p class="letter-sign">${data.sign}</p>
      `;
      
      // 同步更新左侧卡片的小副标题
      const activeBtn = document.querySelector(`.choice[data-role="${role}"] .choice-desc`);
      if (activeBtn && data.chip) {
        // 将横线分隔的格式改成列表格式
        const items = data.chip.split(' · ');
        activeBtn.innerHTML = items.map(item => `- ${item}`).join('<br>');
      }
      
      console.log('Letter content updated successfully'); // 调试信息
    };

    // 悬停 / 聚焦 / 点击（兼容鼠标、键盘、触屏）
    choiceButtons.forEach(btn => {
      const role = btn.getAttribute('data-role');
      btn.addEventListener('mouseenter', () => setActive(role));
      btn.addEventListener('focus', () => setActive(role));
      btn.addEventListener('click', () => setActive(role));
      btn.addEventListener('touchstart', () => setActive(role), { passive: true });
    });

    // 默认选中
    const defaultRole = (document.querySelector('.band-help .choice.active')?.getAttribute('data-role')) || 'north_pole';
    setActive(defaultRole);
  }

  // === 路由：增加 login / account / billing & 守卫 ===
  const views = ['home','signup','phone','generate','verify','login','account','billing'];
  function show(view){
    views.forEach(v=>{
      const el = document.querySelector(`[data-view="${v}"]`);
      if (el) el.classList.toggle('hidden', v !== view);
    });
    document.querySelectorAll('.nav a').forEach(a=>{
      const want = a.getAttribute('href') === `#/${view==='home'?'':view}`;
      a.classList.toggle('active', want);
    });
    updateNav();
  }

  async function route(){
    const url = new URL(location.href);
    const hash = (location.hash||'#/').replace(/^#\//,'');
    const [seg] = hash.split('?')[0].split('/');
    const view = seg || 'home';

    // 视图守卫
    if (view === 'generate') {
      if (!isAuthed()) return location.hash = '#/login';
      if (!hasMembership()) return location.hash = '#/billing';
    }
    if (view === 'phone') {
      if (!session().emailVerified) return location.hash = '#/signup';
    }
    if (view === 'account' || view === 'billing') {
      if (!isAuthed()) return location.hash = '#/login';
    }

    show(view);

    if (view === 'verify') {
      const s=new URLSearchParams(url.hash.split('?')[1]||'').get('s');
      if (s) { const input=document.querySelector('#serial'); if(input) input.value=s; await doLookup(s); }
    }
    if (view === 'home') { 
      // Add a small delay to ensure DOM is ready
      setTimeout(() => initApplyBoard(), 50); 
    }
    if (view === 'account') initAccount();
    if (view === 'billing') initBilling();
    if (view === 'login') updateNav();
  }

  // === 会员（缴费）页：mock 订阅 ===
  function initBilling(){
    const btn = document.querySelector('#btn-subscribe');
    if (!btn) return;
    btn.onclick = () => {
      setSession({ membershipActive: true, membershipSince: Date.now() });
      toast('Membership activated (demo)');
      updateNav();
      setTimeout(()=> location.hash = '#/generate', 300);
    };
  }

  // === 账号页：展示资料 + 证书列表 + Badge 导出 ===
  function initAccount(){
    const box = document.querySelector('#acct-summary');
    const list = document.querySelector('#acct-certs');
    if (!box || !list) return;

    const s = session();
    const status = [
      `<div><strong>Email:</strong> ${s.email||'-'} ${s.emailVerified? '✓':''}</div>`,
      `<div><strong>Phone:</strong> ${s.phone||'-'} ${s.phoneVerified? '✓':''}</div>`,
      `<div><strong>Membership:</strong> ${hasMembership()? 'Active':'Inactive'}</div>`,
    ].join('');
    box.innerHTML = status;

    // 证书列表（localStorage mock）
    const db = (()=>{
      try { return JSON.parse(localStorage.getItem('mh_certs')||'{}'); } catch { return {}; }
    })();
    const rows = Object.values(db);
    if (!rows.length) {
      list.innerHTML = `<div class="note">No certificates yet. <a href="#/generate">Create one</a>.</div>`;
      return;
    }

    list.innerHTML = '';
    rows.forEach(it=>{
      const card = document.createElement('article');
      card.className = 'card';
      card.innerHTML = `
        <h3>${it.role || 'Helper'}</h3>
        <p class="mt-2"><strong>Serial:</strong> ${it.serial}</p>
        <div class="mt-3">
          <a class="btn" href="${it.download_url||'#'}" ${it.download_url?'target="_blank"':''}>PDF</a>
          <button class="btn" data-badge="${it.serial}">Badge</button>
          <a class="btn" href="#/verify?s=${encodeURIComponent(it.serial)}">Verify</a>
        </div>
      `;
      list.appendChild(card);
    });

    // Badge 按钮：导出 PNG（前端生成）
    list.querySelectorAll('button[data-badge]').forEach(btn=>{
      btn.addEventListener('click', async ()=>{
        const serial = btn.getAttribute('data-badge');
        const rec = rows.find(r=>r.serial===serial);
        const url = await makeBadgePNG({
          title: 'Mythical Helper',
          role: rec?.role || 'Helper',
          serial
        });
        const a = document.createElement('a');
        a.href = url; a.download = `${serial}-badge.png`; a.click();
      });
    });
  }

  // === Badge 生成（Canvas） ===
  async function makeBadgePNG({title, role, serial}){
    const size = 512;
    const c = document.createElement('canvas');
    c.width = size; c.height = size;
    const ctx = c.getContext('2d');

    // 背景渐变
    const g = ctx.createLinearGradient(0,0,size,size);
    g.addColorStop(0,'#a8d0ff');
    g.addColorStop(1,'#ffe08a');
    ctx.fillStyle = g; ctx.fillRect(0,0,size,size);

    // 圆形徽章
    ctx.beginPath(); ctx.arc(size/2,size/2,size/2-12,0,Math.PI*2); ctx.fillStyle='rgba(255,255,255,.85)'; ctx.fill();
    ctx.strokeStyle='rgba(77,141,255,.5)'; ctx.lineWidth=6; ctx.stroke();

    // 文案
    ctx.fillStyle='#1d2a4a'; ctx.textAlign='center';
    ctx.font='700 28px "Inter", system-ui'; ctx.fillText(title, size/2, size*0.32);
    ctx.font='700 24px Inter, system-ui'; ctx.fillText(role, size/2, size*0.50);
    ctx.font='500 18px Inter, system-ui'; ctx.fillText(serial, size/2, size*0.66);

    // 小星星点缀
    for(let i=0;i<18;i++){
      const x = Math.random()*size, y=Math.random()*size; const r = Math.random()*2+0.8;
      ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fillStyle='rgba(77,141,255,.35)'; ctx.fill();
    }
    return c.toDataURL('image/png');
  }

  // === 在现有 init 钩子里调用 updateNav ===
  window.addEventListener('hashchange', route);
  document.addEventListener('DOMContentLoaded', ()=>{
    initLang(); initEmail(); initPhone(); initGenerate(); initVerify(); initSparkles();
    initQuickApply(); initTestAccount();
    updateNav(); route();
    initFloatingApply();
    initVerifyMini();
    // initApplyBoard(); // Only call this one, remove other apply-related calls
  });

  // === 悬浮Apply按钮 ===
  function initFloatingApply() {
    const floatingBtn = document.getElementById('floating-apply');
    if (!floatingBtn) return;
    
    // 只在首页显示
    const showFloating = () => {
      const isHome = location.hash === '#/' || location.hash === '';
      floatingBtn.style.display = isHome ? 'block' : 'none';
    };
    
    window.addEventListener('hashchange', showFloating);
    showFloating();
  }

  // === Verify mini form ===
  function initVerifyMini() {
    const form = document.getElementById('verify-mini-form');
    if (!form) return;
    
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const input = form.querySelector('input[name="serial"]');
      const serial = input.value.trim();
      
      if (!serial) return;
      
      // 跳转到verify页面并自动查询
      location.hash = `#/verify?s=${encodeURIComponent(serial)}`;
    });
  }

  // === I18N：新增一些键（可选，最少把英文加上就行） ===
  Object.assign(I18N.en, {
    how_lead: 'A friendly, grown-up hiring flow — quick, safe, and a little magical.',
    login_title: 'Login',
    login_intro: 'Use your email and SMS codes to sign in. If you\'re new, you\'ll create your account along the way.',
    account_title: 'Your Account',
    account_certs: 'Your Certificates',
    billing_title: 'Membership',
    plan_helper: 'Helper Guild Membership',
    plan_b1: 'Create unlimited certificates',
    plan_b2: 'Download printable badges',
    plan_b3: 'Priority support',
    subscribe_now: 'Subscribe (mock)',
    apply_title: 'Apply for the Job',
    apply_intro: 'Adults are vetted and hired to help Santa, the Tooth Fairy, and the Spring Bunny keep wonder alive.',
    apply_more: 'More roles on the horizon — the Guild is in talks to welcome new friends.'
  });

  // === 登录完成时，标记已认证 ===
  // 在你现有的手机验证成功后，添加：
  /*
    setSession({ phoneVerified:true, authenticated:true });
    updateNav();
  */

  // === 现有功能保持不变 ===
  function initLang(){
    const langSelect = $('#lang');
    if (langSelect) {
      langSelect.onchange = (e) => {
        state.lang = e.target.value;
        applyI18N();
      };
    }
    applyI18N();
  }

  function initEmail(){
    const form = $('#email-form');
    const verifyForm = $('#email-verify-form');
    const email = $('#email');
    const code = $('#email-code');
    const backBtn = $('#back-edit-email');

    form.onsubmit = async (e) => {
      e.preventDefault();
      const data = formToJSON(form);
      try {
        await API.emailOtp(data);
        toast(t('t_sent_email'));
        form.classList.add('hidden');
        verifyForm.classList.remove('hidden');
      } catch (err) {
        toast(err.message, 4000);
      }
    };

    verifyForm.onsubmit = async (e) => {
      e.preventDefault();
      const data = formToJSON(verifyForm);
      try {
        await API.emailVerify(data);
        setSession({ email: email.value, emailVerified: true });
        toast(t('t_email_verified'));
        location.hash = '#/phone';
      } catch (err) {
        toast(err.message, 4000);
      }
    };

    backBtn.onclick = () => {
      verifyForm.classList.add('hidden');
      form.classList.remove('hidden');
    };
  }

  function initQuickApply(){
    const form = document.getElementById('quick-apply-form');
    const input = document.getElementById('quick-email');
    if (!form || !input) return;
    form.addEventListener('submit', (e)=>{
      e.preventDefault();
      const v = input.value.trim(); if (!v) return;
      setSession({ email: v, emailVerified: false });
      location.hash = '#/signup';
    });
  }

  function initPhone(){
    const form = $('#phone-form');
    const verifyForm = $('#phone-verify-form');
    const phone = $('#phone');
    const code = $('#sms-code');
    const backBtn = $('#back-edit-phone');

    form.onsubmit = async (e) => {
      e.preventDefault();
      const data = formToJSON(form);
      try {
        await API.smsOtp(data);
        toast(t('t_sent_sms'));
        form.classList.add('hidden');
        verifyForm.classList.remove('hidden');
      } catch (err) {
        toast(err.message, 4000);
      }
    };

    verifyForm.onsubmit = async (e) => {
      e.preventDefault();
      const data = formToJSON(verifyForm);
      try {
        await API.smsVerify(data);
        setSession({ phone: phone.value, phoneVerified: true, authenticated: true });
        toast(t('t_phone_verified'));
        updateNav();
        location.hash = '#/generate';
      } catch (err) {
        toast(err.message, 4000);
      }
    };

    backBtn.onclick = () => {
      verifyForm.classList.add('hidden');
      form.classList.remove('hidden');
    };
  }

  function initGenerate(){
    const form = $('#gen-form');
    const role = $('#role');
    const customField = $('#custom-role-field');
    const result = $('#gen-result');

    role.onchange = () => {
      customField.classList.toggle('hidden', role.value !== 'custom');
    };

    form.onsubmit = async (e) => {
      e.preventDefault();
      const data = formToJSON(form);
      try {
        const cert = await API.createCert(data);
        toast(t('t_gen_ok'));
        $('#res-serial').textContent = cert.serial;
        $('#res-download').href = cert.download_url;
        $('#res-verify').href = cert.verify_url;
        $('#res-verify').textContent = cert.verify_url;
        result.classList.remove('hidden');
        form.classList.add('hidden');
      } catch (err) {
        toast(err.message, 4000);
      }
    };
  }

  function initVerify(){
    const form = $('#verify-form');
    const result = $('#result');

    form.onsubmit = async (e) => {
      e.preventDefault();
      const data = formToJSON(form);
      await doLookup(data.serial);
    };
  }

  async function doLookup(serial){
    const result = $('#result');
    try {
      const cert = await API.verifyCert(serial);
      if (cert.status === 'not_found') {
        result.innerHTML = `<div class="alert danger">${t('not_found')}</div>`;
      } else {
        const status = cert.status === 'valid' ? 'success' : 'danger';
        result.innerHTML = `<div class="alert ${status}">Status: ${t(`status_${cert.status}`)}</div>`;
      }
      result.classList.remove('hidden');
    } catch (err) {
      result.innerHTML = `<div class="alert danger">${err.message}</div>`;
      result.classList.remove('hidden');
    }
  }

  function initSparkles(){
    // 简单的星星动画效果
    const hero = document.querySelector('.hero');
    if (!hero) return;
    
    for (let i = 0; i < 20; i++) {
      const sparkle = document.createElement('div');
      sparkle.className = 'sparkle';
      sparkle.style.cssText = `
        position: absolute;
        width: 4px;
        height: 4px;
        background: var(--accent);
        border-radius: 50%;
        left: ${Math.random() * 100}%;
        top: ${Math.random() * 100}%;
        animation: twinkle ${2 + Math.random() * 3}s infinite;
        opacity: 0;
      `;
      hero.appendChild(sparkle);
    }
  }

  function initTestAccount(){
    const btn = document.getElementById('use-test');
    if (!btn) return;
    btn.addEventListener('click', () => {
      setSession({ email: 'test@mythicalhelper.org', emailVerified: true, phone: '+10000000000', phoneVerified: true, authenticated: true });
      toast('Signed in as test');
      location.hash = '#/generate';
    });
  }

})();
