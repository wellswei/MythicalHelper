// === Mythical Helper – index.js (Home page only) ===
console.log('index.js loaded, current path:', window.location.pathname);

// 随机组合系统
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

function initApplyBoard() {
  Object.keys(roleCombinations).forEach(role => {
    const combinations = roleCombinations[role];
    const randomIndex = Math.floor(Math.random() * combinations.length);
    const selectedCombination = combinations[randomIndex];
    const choice = document.querySelector(`[data-role="${role}"]`);
    if (choice) {
      const descContainer = choice.querySelector('.choice-desc');
      if (descContainer) {
        descContainer.innerHTML = selectedCombination.map(item => 
          `<span class="chip-item">• ${item}</span>`
        ).join('');
      }
    }
  });
}

// 主页信件模板
const letterTemplates = {
  north: [
    { head: 'North Logistics Office', dear: 'Dear Mythical Helper,', p1: "Snow prints mark the season's path. We seek steady hands to keep the routes on time and the workshop calm.", p2: 'Stage gifts in quiet order, mind the lists, and leave each parcel where a morning can find it without a sound.', sign: '— Scribes of Winter' },
    { head: 'Workshop Dispatch', dear: 'Dear Mythical Helper,', p1: 'By starlight and windowglow, the schedule must hold. Reindeer wait for sure steps and calm directions.', p2: 'Check the map twice, place the note once, and let joy arrive as if it had always known the way.', sign: '— The North Dispatch' },
    { head: 'Night Routes · Sleigh Support', dear: 'Dear Mythical Helper,', p1: 'Some doors stick, some stairs creak. Keep the lantern low and the list exact.', p2: 'Stage parcels, tidy traces, and make the morning feel effortless and true.', sign: '— Winter Routekeepers' }
  ],
  tooth: [
    { head: 'Circle of Tiny Exchanges', dear: 'Dear Mythical Helper,', p1: 'Where courage meets a missing tooth, gratitude follows with a little light.', p2: 'Guard the keepsake, place the token, and leave a gentle note that praises bravery without waking the room.', sign: '— Council of Tiny Treasures' },
    { head: 'Moonlight Exchange Ledger', dear: 'Dear Mythical Helper,', p1: 'Quiet pockets, soft steps. Our work is thanks made visible.', p2: 'Secure the tooth, set the coin or keepsake, and let a sparkle of encouragement wait for morning eyes.', sign: '— The Pillow Wardens' },
    { head: 'Under-Pillow Courier Brief', dear: 'Dear Mythical Helper,', p1: 'Every small gap is a milestone. Every token says, "Well done."', p2: 'Record the moment, swap with care, and leave a promise that growing up stays wondrous.', sign: '— Night Scribes of the Circle' }
  ],
  bunny: [
    { head: 'Caravan Map · Garden Routes', dear: 'Dear Mythical Helper,', p1: 'Spring stirs and asks for helpers who hide hope in plain sight.', p2: 'Design easy trails, tuck bright eggs where small hands can find them, and pair each find with a warm note.', sign: '— Garden Keepers' },
    { head: 'Trail of Laughter Briefing', dear: 'Dear Mythical Helper,', p1: 'Joy should feel like it discovered you first.', p2: 'Place tiered clues for all ages, mind the weather and space, and let the morning unfold like a friendly riddle.', sign: '— The Spring Wardens' },
    { head: 'Basket & Clue Staging', dear: 'Dear Mythical Helper,', p1: 'Paths through hedges, markers by steps. Simple, kind, and safe.', p2: 'Hide lightly, mark kindly, and make room for families to add their own traditions to the bloom.', sign: '— Caravan Quartermasters' }
  ]
};

function populateLettersRandom() {
  ['north', 'tooth', 'bunny'].forEach(role => {
    const variants = letterTemplates[role];
    const chosen = variants[Math.floor(Math.random() * variants.length)];
    const pane = document.querySelector(`.letter .role-${role}`);
    if (!pane) return;
    const headEl = pane.querySelector('.letter-head');
    const dearEl = pane.querySelector('p.dear');
    const paras = pane.querySelectorAll('p:not(.dear):not(.sign)');
    const signEl = pane.querySelector('p.sign');
    if (headEl) headEl.textContent = chosen.head;
    if (dearEl) dearEl.textContent = chosen.dear;
    if (paras && paras.length >= 2) {
      paras[0].textContent = chosen.p1;
      paras[1].textContent = chosen.p2;
    }
    if (signEl) signEl.textContent = chosen.sign;
  });
}

function initRandomLetterDefault() {
  const letter = document.querySelector('.board-section .letter');
  if (letter) letter.dataset.active = 'north';
}

function initButtonHandlers() {
  const acceptButtons = document.querySelectorAll('a.btn.primary[href="#"]');
  acceptButtons.forEach(button => {
    button.addEventListener('click', (e) => {
      e.preventDefault();
      // 跳转到模式选择页面，而不是直接进入注册流程
      window.location.href = 'auth.html';
    });
  });
  // 移除这个部分，因为returning member是链接，不是按钮，由wireReturningMember处理
  // const returningButton = document.querySelector('button.btn[type="button"]');
  // if (returningButton) {
  //   returningButton.addEventListener('click', () => {
  //     window.location.href = 'auth.html';
  //   });
  // }
}

function isLoggedIn() {
  return !!sessionStorage.getItem('authToken');
}

function wireNavMember() {
  const navMember = document.getElementById('navMember');
  if (!navMember) return;
  navMember.addEventListener('click', (e) => {
    e.preventDefault();
    if (isLoggedIn()) {
      window.location.href = '/portal.html';
    } else {
      window.location.href = '/auth.html?mode=login';
    }
  });
}

function wireReturningMember() {
  const returningLinks = document.querySelectorAll('a.btn[href*="mode=login"]');
  returningLinks.forEach((a) => {
    a.addEventListener('click', (e) => {
      if (isLoggedIn()) {
        e.preventDefault();
        window.location.href = '/portal.html';
      }
    });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  // 如果是 auth 页面，直接跳过
  const isAuthPage = document.title.includes('Auth') || 
                     document.querySelector('.auth-section') || 
                     document.querySelector('#emailInput');
  if (isAuthPage) {
    console.log('Skipping index.js on auth page');
    return;
  }
  console.log('Running index.js on main page');
  initApplyBoard();
  populateLettersRandom();
  initRandomLetterDefault();
  initButtonHandlers();
  wireNavMember();
  wireReturningMember();
});
