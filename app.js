// === 全新的 Mythical Helper JavaScript ===
console.log('Mythical Helper loaded');

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
  // 为每个角色随机选择一个组合
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

// 页面加载时初始化
// === 3×3 备份文案库（正文无破折号；签名保留前缀 "—"） ===
const letterTemplates = {
  north: [
    {
      head: 'North Logistics Office',
      dear: 'Dear Mythical Helper,',
      p1: "Snow prints mark the season's path. We seek steady hands to keep the routes on time and the workshop calm.",
      p2: "Stage gifts in quiet order, mind the lists, and leave each parcel where a morning can find it without a sound.",
      sign: '— Scribes of Winter'
    },
    {
      head: 'Workshop Dispatch',
      dear: 'Dear Mythical Helper,',
      p1: 'By starlight and windowglow, the schedule must hold. Reindeer wait for sure steps and calm directions.',
      p2: 'Check the map twice, place the note once, and let joy arrive as if it had always known the way.',
      sign: '— The North Dispatch'
    },
    {
      head: 'Night Routes · Sleigh Support',
      dear: 'Dear Mythical Helper,',
      p1: 'Some doors stick, some stairs creak. Keep the lantern low and the list exact.',
      p2: 'Stage parcels, tidy traces, and make the morning feel effortless and true.',
      sign: '— Winter Routekeepers'
    }
  ],
  tooth: [
    {
      head: 'Circle of Tiny Exchanges',
      dear: 'Dear Mythical Helper,',
      p1: 'Where courage meets a missing tooth, gratitude follows with a little light.',
      p2: 'Guard the keepsake, place the token, and leave a gentle note that praises bravery without waking the room.',
      sign: '— Council of Tiny Treasures'
    },
    {
      head: 'Moonlight Exchange Ledger',
      dear: 'Dear Mythical Helper,',
      p1: 'Quiet pockets, soft steps. Our work is thanks made visible.',
      p2: 'Secure the tooth, set the coin or keepsake, and let a sparkle of encouragement wait for morning eyes.',
      sign: '— The Pillow Wardens'
    },
    {
      head: 'Under-Pillow Courier Brief',
      dear: 'Dear Mythical Helper,',
      p1: 'Every small gap is a milestone. Every token says, "Well done."',
      p2: 'Record the moment, swap with care, and leave a promise that growing up stays wondrous.',
      sign: '— Night Scribes of the Circle'
    }
  ],
  bunny: [
    {
      head: 'Caravan Map · Garden Routes',
      dear: 'Dear Mythical Helper,',
      p1: 'Spring stirs and asks for helpers who hide hope in plain sight.',
      p2: 'Design easy trails, tuck bright eggs where small hands can find them, and pair each find with a warm note.',
      sign: '— Garden Keepers'
    },
    {
      head: 'Trail of Laughter Briefing',
      dear: 'Dear Mythical Helper,',
      p1: 'Joy should feel like it discovered you first.',
      p2: 'Place tiered clues for all ages, mind the weather and space, and let the morning unfold like a friendly riddle.',
      sign: '— The Spring Wardens'
    },
    {
      head: 'Basket & Clue Staging',
      dear: 'Dear Mythical Helper,',
      p1: 'Paths through hedges, markers by steps. Simple, kind, and safe.',
      p2: 'Hide lightly, mark kindly, and make room for families to add their own traditions to the bloom.',
      sign: '— Caravan Quartermasters'
    }
  ]
};

// 抽取模板并写入到 DOM（仅在加载时运行一次）
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

// 设置右侧默认显示的角色（第一次读取时默认北极）
function initRandomLetterDefault() {
  const letter = document.querySelector('.board-section .letter');
  if (letter) {
    letter.dataset.active = 'north';  // ✅ 默认显示北极角色
  }
}

// 入口：左列chips随机 + 右侧文案一次性随机 + 默认角色随机
document.addEventListener('DOMContentLoaded', () => {
  initApplyBoard();        // 已有：左侧三张卡随机 chips
  populateLettersRandom(); // 新增：每个角色随机一套文案（只运行一次）
  initRandomLetterDefault(); // 新增：默认展示角色随机（只运行一次）
});
