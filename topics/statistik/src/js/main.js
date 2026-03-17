// =============================================================
//  Learning Platform — Shared main.js
//  Vanilla JS, no modules, no external deps (canvas-confetti optional)
//  HTML-callable globals: toggleDD, checkQuiz
//  Everything else lives in LP namespace
// =============================================================

// ── 1. HTML-CALLABLE GLOBALS ─────────────────────────────────

function toggleDD(id) {
  document.getElementById(id).classList.toggle('open');
}

function checkQuiz(id, btn, ok) {
  const q = document.getElementById(id);
  const opts = q.querySelectorAll('.quiz-option');
  const fc = q.querySelector('.correct-fb');
  const fw = q.querySelector('.wrong-fb');
  opts.forEach(o => { o.disabled = true; o.classList.remove('correct', 'wrong'); });
  if (ok) {
    btn.classList.add('correct');
    fc?.classList.add('show');
    fw?.classList.remove('show');
    LP.reward.onCorrect();
  } else {
    btn.classList.add('wrong');
    fw?.classList.add('show');
    fc?.classList.remove('show');
    opts.forEach(o => { if (o.dataset.correct === 'true') o.classList.add('correct'); });
    LP.reward.onWrong();
  }
}

// ── 2. LP NAMESPACE ───────────────────────────────────────────

const LP = (() => {
  // --- State / Preferences ---
  const STATE_KEY = 'lp_global_state';
  const defaults = {
    darkMode: false,
    bionic: false,
    sound: true,
    noise: false,
    noiseVol: 0.15,
    haptic: true,
    timerMin: 15,
    focusMode: false,
  };

  function loadState() {
    try { return { ...defaults, ...JSON.parse(localStorage.getItem(STATE_KEY)) }; }
    catch { return { ...defaults }; }
  }
  function saveState() { localStorage.setItem(STATE_KEY, JSON.stringify(state)); }
  const state = loadState();

  // --- Scroll-spy / nav / progress (core) ---
  const secs = document.querySelectorAll('section[id]');
  const navLinks = document.querySelectorAll('nav a');
  function upNav() {
    const y = window.scrollY + 100;
    secs.forEach(s => {
      if (y >= s.offsetTop && y < s.offsetTop + s.offsetHeight)
        navLinks.forEach(l => l.classList.toggle('active', l.getAttribute('href') === '#' + s.id));
    });
  }
  function upProg() {
    const bar = document.getElementById('progressBar');
    if (bar) bar.style.width = (window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100 + '%';
  }
  function upTop() {
    document.getElementById('topBtn')?.classList.toggle('visible', window.scrollY > 500);
  }
  window.addEventListener('scroll', () => { upNav(); upProg(); upTop(); });
  upNav();
  navLinks.forEach(l => l.addEventListener('click', e => {
    e.preventDefault();
    document.querySelector(l.getAttribute('href'))?.scrollIntoView({ behavior: 'smooth' });
  }));

  // ── 3. DARK MODE ────────────────────────────────────────────
  const darkMode = {
    isDark() {
      const attr = document.documentElement.getAttribute('data-theme');
      if (attr) return attr === 'dark';
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    },
    init() {
      const saved = localStorage.getItem('lp_global_theme');
      if (saved) document.documentElement.setAttribute('data-theme', saved);
    },
    toggle() {
      const next = this.isDark() ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('lp_global_theme', next);
      state.darkMode = next === 'dark';
      saveState();
      settingsPanel.refresh();
    },
  };
  darkMode.init();

  // ── 4. AUDIO ────────────────────────────────────────────────
  let audioCtx = null;
  function getAudioCtx() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    return audioCtx;
  }
  function beep(freq, dur = 0.12, type = 'sine') {
    if (!state.sound) return;
    try {
      const ctx = getAudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = type; osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      osc.start(); osc.stop(ctx.currentTime + dur);
    } catch {}
  }

  // ── 5. BROWN NOISE ──────────────────────────────────────────
  const brownNoise = {
    node: null, gainNode: null,
    start() {
      try {
        const ctx = getAudioCtx();
        const bufSize = 2 * ctx.sampleRate;
        const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
        const data = buf.getChannelData(0);
        let last = 0;
        for (let i = 0; i < bufSize; i++) {
          const w = (Math.random() * 2 - 1) * 0.02;
          data[i] = last = (last + w) / 1.02;
        }
        this.node = ctx.createBufferSource();
        this.node.buffer = buf; this.node.loop = true;
        this.gainNode = ctx.createGain();
        this.gainNode.gain.value = state.noiseVol;
        this.node.connect(this.gainNode); this.gainNode.connect(ctx.destination);
        this.node.start();
      } catch {}
    },
    stop() { try { this.node?.stop(); this.node = null; } catch {} },
    setVol(v) { state.noiseVol = v; saveState(); if (this.gainNode) this.gainNode.gain.value = v; },
    toggle() {
      state.noise = !state.noise; saveState();
      state.noise ? this.start() : this.stop();
      if (state.noise && state.focusMode) achievements.recordZen();
      settingsPanel.refresh();
    },
  };

  // ── 6. REWARD SYSTEM ────────────────────────────────────────
  let streak = 0;
  const reward = {
    onCorrect() {
      streak++;
      achievements.recordQuizStreak(streak);
      beep(440); // 440 Hz = correct
      if (state.haptic) navigator.vibrate?.([50]);
      if (streak >= 5) this.confetti();
      if (streak > 0 && streak % 10 === 0) this.glitchReward();
      tamagotchi.addXP(2);
    },
    onWrong() {
      streak = 0;
      beep(220, 0.18, 'sawtooth'); // 220 Hz = wrong
      if (state.haptic) navigator.vibrate?.([80, 40, 80]);
    },
    confetti() {
      if (typeof confetti === 'function') confetti({ particleCount: 80, spread: 60, origin: { y: 0.6 } });
    },
    sectionDone() { beep(528, 0.2); this.confetti(); tamagotchi.addXP(5); },
    pomoDone() { beep(660, 0.25); this.confetti(); tamagotchi.addXP(10); achievements.recordPomo(); },
    glitchReward() {
      // Variable-interval glitch effect on random elements for dopamine hit
      const els = document.querySelectorAll('section > h2, .def-box .label');
      const pick = els[Math.floor(Math.random() * els.length)];
      if (pick) { pick.dataset.text = pick.textContent; pick.classList.add('lp-glitch'); setTimeout(() => pick.classList.remove('lp-glitch'), 1200); }
    },
  };

  // Section-completion observer (fires once per section)
  const sectionObs = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting && e.intersectionRatio > 0.85) {
        reward.sectionDone();
        sectionObs.unobserve(e.target);
      }
    });
  }, { threshold: 0.85 });
  secs.forEach(s => sectionObs.observe(s));

  // ── 7. FADE-IN SCROLL ANIMATIONS ────────────────────────────
  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const fadeObs = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('lp-visible'); fadeObs.unobserve(e.target); } });
    }, { threshold: 0.1 });
    document.querySelectorAll('section, .box, .quiz, .deep-dive').forEach(el => {
      el.classList.add('lp-fade');
      fadeObs.observe(el);
    });
    const style = document.createElement('style');
    style.textContent = `.lp-fade{opacity:0;transform:translateY(18px);transition:opacity .45s ease,transform .45s ease}.lp-visible{opacity:1!important;transform:none!important}`;
    document.head.appendChild(style);
  }

  // ── 8. POMODORO TIMER ───────────────────────────────────────
  const pomo = {
    running: false, breakMode: false,
    total: 0, elapsed: 0, blocks: 0, interval: null,
    get workSec() { return state.timerMin * 60; },
    get breakSec() { return state.timerMin <= 15 ? 180 : state.timerMin <= 20 ? 240 : 300; },
    ui: null,
    init() {
      this.ui = document.getElementById('lp-pomo');
      document.getElementById('lp-pomo-toggle')?.addEventListener('click', () => this.toggle());
      document.getElementById('lp-pomo-reset')?.addEventListener('click', () => this.reset());
    },
    toggle() {
      this.running ? this.pause() : this.start();
    },
    start() {
      this.running = true;
      if (!this.total) this.total = this.workSec;
      this.interval = setInterval(() => this.tick(), 1000);
      this.render();
      if (state.focusMode) focus.activate();
    },
    pause() {
      this.running = false;
      clearInterval(this.interval);
      this.render();
    },
    reset() {
      this.pause(); this.elapsed = 0; this.total = 0; this.breakMode = false;
      this.render();
    },
    tick() {
      this.elapsed++;
      if (this.elapsed >= this.total) {
        if (!this.breakMode) {
          this.blocks++;
          beep(660, 0.3);
          reward.pomoDone();
          this.breakMode = true; this.elapsed = 0; this.total = this.breakSec;
          this.showBreakOverlay();
        } else {
          beep(440, 0.2);
          this.breakMode = false; this.elapsed = 0; this.total = this.workSec;
          this.hideBreakOverlay();
        }
      }
      this.render();
    },
    render() {
      if (!this.ui) return;
      const rem = Math.max(0, (this.total || this.workSec) - this.elapsed);
      const m = String(Math.floor(rem / 60)).padStart(2, '0');
      const s = String(rem % 60).padStart(2, '0');
      const label = this.breakMode ? 'Pause' : `Block ${this.blocks + 1}`;
      this.ui.querySelector('#lp-pomo-time').textContent = `${m}:${s}`;
      this.ui.querySelector('#lp-pomo-label').textContent = label;
      this.ui.querySelector('#lp-pomo-toggle').textContent = this.running ? '⏸' : '▶';
    },
    showBreakOverlay() {
      let ov = document.getElementById('lp-break-overlay');
      if (!ov) {
        ov = document.createElement('div'); ov.id = 'lp-break-overlay';
        ov.innerHTML = `<div class="lp-break-box"><h2>Pause! 🧘</h2><p>Tief einatmen — 4 Sek. halten — ausatmen.</p><p class="lp-breath-ani">🫁</p><button onclick="LP.pomo.hideBreakOverlay()">Weiter lernen</button></div>`;
        document.body.appendChild(ov);
      }
      ov.style.display = 'flex';
    },
    hideBreakOverlay() {
      document.getElementById('lp-break-overlay')?.style && (document.getElementById('lp-break-overlay').style.display = 'none');
    },
  };

  // ── 9. OVERWHELM-KILLER (Panik-Button) ──────────────────────
  const panic = {
    active: false, chunks: [], idx: 0,
    toggle() { this.active ? this.exit() : this.enter(); },
    enter() {
      this.active = true;
      this.chunks = Array.from(document.querySelectorAll('section p, section .box, section .quiz')).filter(el => el.offsetParent);
      if (!this.chunks.length) return;
      // Find chunk closest to viewport center
      const cy = window.scrollY + window.innerHeight / 2;
      let best = 0, bestDist = Infinity;
      this.chunks.forEach((el, i) => {
        const d = Math.abs(el.getBoundingClientRect().top + window.scrollY - cy);
        if (d < bestDist) { bestDist = d; best = i; }
      });
      this.idx = best;
      document.body.classList.add('lp-panic-mode');
      this.chunks.forEach(el => el.classList.add('lp-panic-hidden'));
      this.show();
    },
    show() {
      this.chunks.forEach(el => el.classList.remove('lp-panic-current'));
      const el = this.chunks[this.idx];
      if (!el) return;
      el.classList.remove('lp-panic-hidden');
      el.classList.add('lp-panic-current');
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      document.getElementById('lp-panic-next')?.style && (document.getElementById('lp-panic-next').style.display = this.idx < this.chunks.length - 1 ? 'inline-block' : 'none');
    },
    next() { if (this.idx < this.chunks.length - 1) { this.idx++; this.show(); } },
    exit() {
      this.active = false;
      document.body.classList.remove('lp-panic-mode');
      this.chunks.forEach(el => { el.classList.remove('lp-panic-hidden', 'lp-panic-current'); });
    },
  };

  // ── 10. BIONIC READING ──────────────────────────────────────
  const bionic = {
    on: false,
    originals: new Map(),
    apply(el) {
      if (this.originals.has(el)) return;
      this.originals.set(el, el.innerHTML);
      el.innerHTML = el.textContent.replace(/\b(\w{1,2})(\w+)/g, '<b>$1</b>$2');
    },
    revert(el) {
      if (this.originals.has(el)) { el.innerHTML = this.originals.get(el); this.originals.delete(el); }
    },
    toggle() {
      this.on = !this.on;
      localStorage.setItem('lp_global_bionic', this.on);
      state.bionic = this.on; saveState();
      if (this.on) achievements.recordBionic();
      document.querySelectorAll('section p:not(.section-subtitle)').forEach(el => this.on ? this.apply(el) : this.revert(el));
      settingsPanel.refresh();
    },
    init() {
      if (localStorage.getItem('lp_global_bionic') === 'true') this.toggle();
    },
  };

  // ── AUTO-CLOZE GENERATOR ──────────────────────────────────────
  const cloze = {
    active: false,
    originals: new Map(),
    toggle() {
      this.active = !this.active;
      if (this.active) {
        document.querySelectorAll('section strong, section .def-box .label + p strong').forEach(el => {
          if (this.originals.has(el)) return;
          this.originals.set(el, el.outerHTML);
          const text = el.textContent;
          const input = document.createElement('input');
          input.type = 'text';
          input.className = 'lp-cloze-input';
          input.placeholder = '???';
          input.dataset.answer = text;
          input.style.cssText = 'font:inherit;border:1.5px dashed var(--accent3);border-radius:3px;padding:2px 6px;width:' + Math.max(text.length * 0.7, 4) + 'ch;background:var(--highlight);text-align:center;';
          input.addEventListener('input', function () {
            const correct = this.value.trim().toLowerCase() === this.dataset.answer.trim().toLowerCase();
            this.style.borderColor = this.value ? (correct ? 'var(--accent2)' : 'var(--accent)') : 'var(--accent3)';
            if (correct) this.style.background = '#d5f5e3';
          });
          el.replaceWith(input);
        });
      } else {
        document.querySelectorAll('.lp-cloze-input').forEach(input => {
          const span = document.createElement('strong');
          span.textContent = input.dataset.answer;
          input.replaceWith(span);
        });
        this.originals.clear();
      }
    },
  };

  // ── ACHIEVEMENTS ──────────────────────────────────────────────
  const achievements = {
    defs: [
      // Mastery badges (Kompetenz)
      { id: 'first_card', icon: '🎴', name: 'Erste Karte', desc: 'Erste Lernkarte bewertet', check: () => { for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k.match(/^lp_.*_fsrs$/)){const d=JSON.parse(localStorage.getItem(k));if(Object.keys(d).length>0)return true;}} return false; }},
      { id: 'ten_cards', icon: '🔟', name: 'Zehn geschafft', desc: '10 Karten bewertet', check: () => { let t=0; for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k.match(/^lp_.*_fsrs$/)){t+=Object.keys(JSON.parse(localStorage.getItem(k)||'{}')).length;}} return t>=10; }},
      { id: 'fifty_cards', icon: '🏅', name: 'Halbzeit', desc: '50 Karten bewertet', check: () => { let t=0; for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k.match(/^lp_.*_fsrs$/)){t+=Object.keys(JSON.parse(localStorage.getItem(k)||'{}')).length;}} return t>=50; }},
      { id: 'hundred_cards', icon: '💯', name: 'Centurion', desc: '100 Karten bewertet', check: () => { let t=0; for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k.match(/^lp_.*_fsrs$/)){t+=Object.keys(JSON.parse(localStorage.getItem(k)||'{}')).length;}} return t>=100; }},
      // Consistency badges (Autonomie)
      { id: 'streak_3', icon: '🔥', name: '3-Tage-Streak', desc: '3 Tage hintereinander gelernt', check: () => achievements.getStreak() >= 3 },
      { id: 'streak_7', icon: '🔥🔥', name: 'Wochenkrieger', desc: '7 Tage hintereinander gelernt', check: () => achievements.getStreak() >= 7 },
      { id: 'streak_30', icon: '🏆', name: 'Monatsmeister', desc: '30 Tage hintereinander gelernt', check: () => achievements.getStreak() >= 30 },
      { id: 'early_bird', icon: '🌅', name: 'Frühlernerrin', desc: '5x vor 9 Uhr gelernt', check: () => (achievements.getData().earlyCount || 0) >= 5 },
      // Challenge badges (Meisterschaft)
      { id: 'quiz_streak_5', icon: '⚡', name: '5er-Streak', desc: '5 Quiz-Fragen richtig am Stück', check: () => (achievements.getData().maxStreak || 0) >= 5 },
      { id: 'quiz_streak_10', icon: '⚡⚡', name: 'Blitzmerker', desc: '10 Quiz-Fragen richtig am Stück', check: () => (achievements.getData().maxStreak || 0) >= 10 },
      { id: 'quiz_streak_20', icon: '💎', name: 'Speed-Demon', desc: '20er Quiz-Streak', check: () => (achievements.getData().maxStreak || 0) >= 20 },
      { id: 'pomo_first', icon: '🍅', name: 'Erster Pomodoro', desc: 'Ersten Pomodoro-Block abgeschlossen', check: () => (achievements.getData().pomoBlocks || 0) >= 1 },
      { id: 'pomo_ten', icon: '🍅🍅', name: 'Pomodoro-Pro', desc: '10 Pomodoro-Blöcke abgeschlossen', check: () => (achievements.getData().pomoBlocks || 0) >= 10 },
      { id: 'dark_scholar', icon: '🌙', name: 'Nachtgelehrte', desc: 'Dark Mode aktiviert', check: () => document.documentElement.getAttribute('data-theme') === 'dark' || localStorage.getItem('lp_global_theme') === 'dark' },
      { id: 'bionic_user', icon: '👁️', name: 'Bionic Reader', desc: 'Bionic Reading ausprobiert', check: () => (achievements.getData().bionicUsed || false) },
      { id: 'noise_zen', icon: '🧘', name: 'Zen-Modus', desc: 'Brown Noise + Focus Mode gleichzeitig', check: () => (achievements.getData().zenUsed || false) },
    ],

    getData() {
      try { return JSON.parse(localStorage.getItem('lp_global_achievements') || '{}'); } catch { return {}; }
    },
    saveData(d) { localStorage.setItem('lp_global_achievements', JSON.stringify(d)); },

    getStreak() {
      const d = this.getData();
      return d.currentStreak || 0;
    },

    recordSession() {
      const d = this.getData();
      const today = new Date().toISOString().slice(0, 10);
      if (d.lastDate === today) return; // Already recorded today

      const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      d.currentStreak = (d.lastDate === yesterday) ? (d.currentStreak || 0) + 1 : 1;
      d.longestStreak = Math.max(d.longestStreak || 0, d.currentStreak);
      d.lastDate = today;
      d.totalDays = (d.totalDays || 0) + 1;

      // Early bird check
      if (new Date().getHours() < 9) d.earlyCount = (d.earlyCount || 0) + 1;

      this.saveData(d);
    },

    recordQuizStreak(s) {
      const d = this.getData();
      d.maxStreak = Math.max(d.maxStreak || 0, s);
      this.saveData(d);
    },

    recordPomo() {
      const d = this.getData();
      d.pomoBlocks = (d.pomoBlocks || 0) + 1;
      this.saveData(d);
    },

    recordBionic() {
      const d = this.getData();
      d.bionicUsed = true;
      this.saveData(d);
    },

    recordZen() {
      const d = this.getData();
      d.zenUsed = true;
      this.saveData(d);
    },

    getUnlocked() {
      const unlocked = [];
      const d = this.getData();
      const unlockedIds = d.unlocked || [];
      this.defs.forEach(badge => {
        if (unlockedIds.includes(badge.id)) {
          unlocked.push({ ...badge, unlocked: true });
        } else if (badge.check()) {
          unlocked.push({ ...badge, unlocked: true, justUnlocked: true });
          unlockedIds.push(badge.id);
        } else {
          unlocked.push({ ...badge, unlocked: false });
        }
      });
      if (unlockedIds.length !== (d.unlocked || []).length) {
        d.unlocked = unlockedIds;
        this.saveData(d);
      }
      return unlocked;
    },

    checkAndNotify() {
      const badges = this.getUnlocked();
      const newOnes = badges.filter(b => b.justUnlocked);
      newOnes.forEach(b => {
        // Show toast notification
        const toast = document.createElement('div');
        toast.style.cssText = 'position:fixed;top:80px;left:50%;transform:translateX(-50%);z-index:10000;background:var(--accent2,#2c6e49);color:#fff;padding:12px 24px;border-radius:12px;font-size:.9rem;box-shadow:0 4px 20px rgba(0,0,0,.2);animation:lpSlideDown .4s ease-out;display:flex;align-items:center;gap:8px';
        toast.innerHTML = `<span style="font-size:1.5rem">${b.icon}</span><div><strong>${b.name}</strong><br><small>${b.desc}</small></div>`;
        document.body.appendChild(toast);
        if (typeof confetti === 'function') confetti({ particleCount: 60, spread: 50, origin: { y: 0.3 } });
        setTimeout(() => toast.remove(), 4000);
      });
    },
  };

  // ── ACTIVE RECALL TOOLTIPS ────────────────────────────────────
  const recall = {
    active: false,
    toggle() {
      this.active = !this.active;
      document.querySelectorAll('.def-box p strong, .merksatz strong, .green strong').forEach(el => {
        if (this.active) {
          el.classList.add('lp-recall-blur');
          el.addEventListener('click', recall.reveal);
        } else {
          el.classList.remove('lp-recall-blur', 'lp-recall-revealed');
          el.removeEventListener('click', recall.reveal);
        }
      });
    },
    reveal(e) {
      e.target.classList.remove('lp-recall-blur');
      e.target.classList.add('lp-recall-revealed');
    },
  };

  // ── LOOT BAG ────────────────────────────────────────────────
  const lootBag = {
    items: [],
    init() {
      // Load saved items
      try { this.items = JSON.parse(localStorage.getItem('lp_global_loot') || '[]'); } catch { this.items = []; }
      this.updateBadge();

      // Make paragraphs and key boxes clickable for collection
      document.querySelectorAll('section p, .def-box, .merksatz, .example').forEach(el => {
        el.addEventListener('dblclick', (e) => {
          e.preventDefault();
          const text = el.innerText.trim().slice(0, 300);
          if (text && !this.items.includes(text)) {
            this.items.push(text);
            this.save();
            el.style.outline = '2px solid var(--accent2)';
            el.style.outlineOffset = '2px';
            setTimeout(() => { el.style.outline = ''; el.style.outlineOffset = ''; }, 800);
            if (state.haptic) navigator.vibrate?.([30]);
          }
        });
      });
    },
    save() {
      localStorage.setItem('lp_global_loot', JSON.stringify(this.items));
      this.updateBadge();
    },
    updateBadge() {
      const badge = document.getElementById('lp-loot-count');
      if (badge) badge.textContent = this.items.length || '';
    },
    exportSheet() {
      if (!this.items.length) return;
      const html = `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"><title>Cheat Sheet</title><style>body{font-family:sans-serif;font-size:11px;max-width:800px;margin:0 auto;padding:1rem;columns:2;column-gap:1.5rem}p{margin:0 0 .5rem;padding:4px;border-bottom:1px solid #eee;break-inside:avoid}h1{font-size:14px;column-span:all;text-align:center;margin-bottom:1rem}@media print{body{font-size:9px}}</style></head><body><h1>Mein Cheat Sheet</h1>${this.items.map(t => '<p>' + t + '</p>').join('')}</body></html>`;
      const blob = new Blob([html], { type: 'text/html' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'cheat-sheet.html';
      a.click();
    },
    clear() {
      this.items = [];
      this.save();
    },
  };

  // ── TTS (Text-to-Speech) ────────────────────────────────────
  const tts = {
    synth: window.speechSynthesis,
    utt: null,
    playing: false,
    rate: 1,
    currentEl: null,
    speak(el) {
      if (!this.synth) return;
      this.stop();
      const text = el.innerText || el.textContent;
      this.utt = new SpeechSynthesisUtterance(text);
      this.utt.lang = 'de-DE';
      this.utt.rate = this.rate;
      this.utt.onboundary = (e) => {
        if (e.name === 'word' && this.currentEl) {
          // Highlight current word range
          this.currentEl.classList.add('lp-tts-active');
        }
      };
      this.utt.onend = () => { this.playing = false; this.currentEl?.classList.remove('lp-tts-active'); this.updateUI(); };
      this.currentEl = el;
      el.classList.add('lp-tts-active');
      this.synth.speak(this.utt);
      this.playing = true;
      this.updateUI();
    },
    speakSection(sectionEl) {
      const paragraphs = sectionEl.querySelectorAll('p, .def-box, .merksatz, .example, .achtung');
      const text = Array.from(paragraphs).map(p => p.innerText).join('. ');
      if (!text) return;
      this.stop();
      this.utt = new SpeechSynthesisUtterance(text);
      this.utt.lang = 'de-DE';
      this.utt.rate = this.rate;
      this.utt.onend = () => { this.playing = false; this.updateUI(); };
      this.synth.speak(this.utt);
      this.playing = true;
      this.currentEl = sectionEl;
      this.updateUI();
    },
    pause() {
      if (this.synth.speaking) { this.synth.pause(); this.playing = false; this.updateUI(); }
    },
    resume() {
      if (this.synth.paused) { this.synth.resume(); this.playing = true; this.updateUI(); }
    },
    stop() {
      this.synth.cancel();
      this.playing = false;
      this.currentEl?.classList.remove('lp-tts-active');
      this.currentEl = null;
      this.updateUI();
    },
    togglePlayPause() {
      if (this.playing) this.pause();
      else if (this.synth.paused) this.resume();
    },
    setRate(r) { this.rate = r; },
    updateUI() {
      const btn = document.getElementById('lp-tts-play');
      if (btn) btn.textContent = this.playing ? '⏸' : '▶';
    },
  };

  // ── FOCUS TAMAGOTCHI ──────────────────────────────────────────
  const tamagotchi = {
    el: null,
    state: 'idle', // idle, happy, sleeping, leveling
    xp: 0,
    level: 1,
    init() {
      const saved = localStorage.getItem('lp_global_tamagotchi');
      if (saved) { try { const d = JSON.parse(saved); this.xp = d.xp || 0; this.level = d.level || 1; } catch {} }
      this.el = document.getElementById('lp-tamagotchi');
      if (!this.el) return;
      this.render();
      // Page Visibility API
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) { this.state = 'sleeping'; this.render(); }
        else { this.state = 'happy'; this.addXP(1); this.render(); setTimeout(() => { this.state = 'idle'; this.render(); }, 2000); }
      });
      // Gain XP on scroll activity (debounced)
      let scrollTimer;
      window.addEventListener('scroll', () => {
        clearTimeout(scrollTimer);
        scrollTimer = setTimeout(() => this.addXP(0.5), 3000);
      });
    },
    addXP(amount) {
      this.xp += amount;
      const needed = this.level * 20;
      if (this.xp >= needed) {
        this.xp -= needed;
        this.level++;
        this.state = 'leveling';
        beep(660, 0.3);
        reward.confetti();
        setTimeout(() => { this.state = 'idle'; this.render(); }, 2500);
      }
      this.save();
      this.render();
    },
    save() { localStorage.setItem('lp_global_tamagotchi', JSON.stringify({ xp: this.xp, level: this.level })); },
    render() {
      if (!this.el) return;
      const faces = { idle: '🦉', happy: '🦉✨', sleeping: '😴', leveling: '🎉🦉🎉' };
      const pct = Math.min(100, (this.xp / (this.level * 20)) * 100);
      this.el.innerHTML = `<span class="lp-tama-face">${faces[this.state]}</span><span class="lp-tama-info">Lv.${this.level}</span><div class="lp-tama-bar"><div style="width:${pct}%"></div></div>`;
    },
  };

  // ── 11. FOCUS MODE ──────────────────────────────────────────
  const focus = {
    activate() {
      document.body.classList.add('focus-mode');
      state.focusMode = true; saveState();
      if (state.noise) achievements.recordZen();
      settingsPanel.refresh();
    },
    deactivate() {
      document.body.classList.remove('focus-mode');
      state.focusMode = false; saveState();
      settingsPanel.refresh();
    },
    toggle() { state.focusMode ? this.deactivate() : this.activate(); },
  };

  // ── 12. DECISION ROULETTE ───────────────────────────────────
  const roulette = {
    spin() {
      const targets = Array.from(document.querySelectorAll('section[id], .quiz[id]'));
      if (!targets.length) return;
      const pick = targets[Math.floor(Math.random() * targets.length)];
      let spins = 0;
      const max = 12;
      const tick = setInterval(() => {
        spins++;
        const t = targets[Math.floor(Math.random() * targets.length)];
        t.style.outline = '3px solid var(--accent,#c0392b)';
        setTimeout(() => { t.style.outline = ''; }, 120);
        if (spins >= max) {
          clearInterval(tick);
          pick.scrollIntoView({ behavior: 'smooth', block: 'center' });
          pick.style.outline = '3px solid var(--accent,#c0392b)';
          setTimeout(() => { pick.style.outline = ''; }, 1800);
        }
      }, 80 + spins * 12);
    },
  };

  // ── STUDY BUDDY ──────────────────────────────────────────────
  const studyBuddy = {
    generateChallenge() {
      // Create a challenge URL with quiz config in the hash
      const sectionIds = Array.from(document.querySelectorAll('section[id]')).map(s => s.id);
      const randomSections = sectionIds.sort(() => Math.random() - 0.5).slice(0, 3);
      const config = { sections: randomSections, count: 10, time: 300 };
      const hash = btoa(JSON.stringify(config));
      const testUrl = window.location.href.replace(/[^/]*$/, 'test.html') + '#challenge=' + hash;

      // Copy to clipboard
      navigator.clipboard?.writeText(testUrl).then(() => {
        const toast = document.createElement('div');
        toast.style.cssText = 'position:fixed;top:80px;left:50%;transform:translateX(-50%);z-index:10000;background:var(--accent3);color:#fff;padding:12px 24px;border-radius:12px;font-size:.9rem;box-shadow:0 4px 20px rgba(0,0,0,.2);';
        toast.textContent = '🔗 Challenge-Link kopiert! Schick ihn deiner Lerngruppe.';
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3500);
      });

      return testUrl;
    },
  };

  // ── 13. SETTINGS PANEL ──────────────────────────────────────
  const settingsPanel = {
    el: null,
    open: false,
    refresh() {
      if (!this.el) return;
      this.el.querySelector('#lp-s-dark').checked = darkMode.isDark();
      this.el.querySelector('#lp-s-bionic').checked = bionic.on;
      this.el.querySelector('#lp-s-sound').checked = state.sound;
      this.el.querySelector('#lp-s-noise').checked = state.noise;
      this.el.querySelector('#lp-s-noiseVol').value = state.noiseVol;
      this.el.querySelector('#lp-s-haptic').checked = state.haptic;
      this.el.querySelector('#lp-s-focus').checked = state.focusMode;
      this.el.querySelector('#lp-s-timerMin').value = state.timerMin;
    },
    toggle() {
      this.open = !this.open;
      this.el?.classList.toggle('lp-panel-open', this.open);
    },
  };

  // ── 14. DOM INJECTION ────────────────────────────────────────
  function injectStyles() {
    const s = document.createElement('style');
    s.textContent = `
      /* Floating UI base */
      .lp-fab{position:fixed;z-index:9000;border:none;border-radius:50%;width:44px;height:44px;font-size:1.2rem;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.25);background:var(--bg-card,#fff);color:var(--text,#333);display:flex;align-items:center;justify-content:center;transition:transform .15s}
      .lp-fab:hover{transform:scale(1.1)}
      /* Settings panel */
      #lp-settings-panel{position:fixed;bottom:60px;left:12px;z-index:9001;background:var(--bg-card,#fff);border:1px solid var(--border,#ddd);border-radius:12px;padding:16px;width:240px;max-height:calc(100vh - 120px);overflow-y:auto;box-shadow:0 4px 20px rgba(0,0,0,.15);transform:translateX(-280px);transition:transform .3s;font-size:.9rem}
      #lp-settings-panel.lp-panel-open{transform:translateX(0)}
      .lp-setting-row{display:flex;justify-content:space-between;align-items:center;margin:.5rem 0}
      .lp-setting-row label{flex:1}
      /* Pomodoro */
      #lp-pomo{position:fixed;top:70px;right:12px;z-index:9000;background:var(--bg-card,#fff);border:1px solid var(--border,#ddd);border-radius:10px;padding:8px 12px;font-size:.85rem;box-shadow:0 2px 8px rgba(0,0,0,.15);display:flex;align-items:center;gap:8px;min-width:130px}
      #lp-pomo-time{font-weight:700;font-size:1.1rem;font-variant-numeric:tabular-nums}
      #lp-pomo button{background:none;border:none;cursor:pointer;font-size:1rem;padding:2px}
      /* Break overlay */
      #lp-break-overlay{display:none;position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.75);align-items:center;justify-content:center}
      .lp-break-box{background:var(--bg-card,#fff);border-radius:16px;padding:32px;text-align:center;max-width:320px}
      .lp-breath-ani{font-size:2.5rem;animation:lpBreath 4s ease-in-out infinite}
      @keyframes lpBreath{0%,100%{transform:scale(1)}50%{transform:scale(1.35)}}
      .lp-break-box button{margin-top:16px;padding:8px 20px;border-radius:8px;border:none;background:var(--accent,#c0392b);color:#fff;cursor:pointer;font-size:1rem}
      /* Panic mode */
      .lp-panic-hidden{display:none!important}
      .lp-panic-current{outline:2px dashed var(--accent,#c0392b);outline-offset:4px}
      #lp-panic-controls{position:fixed;bottom:50px;right:50px;z-index:9002;display:flex;gap:8px;flex-direction:column;align-items:flex-end;min-width:44px;min-height:44px}
      /* Focus mode */
      body.focus-mode footer,body.focus-mode .page-subtitle,body.focus-mode nav{opacity:.08;pointer-events:none;transition:opacity .3s}
      body.focus-mode{font-size:calc(1em + 2px)}
      body.focus-mode::after{content:'';position:fixed;inset:0;pointer-events:none;box-shadow:inset 0 0 80px rgba(0,0,0,.18);z-index:8000}
      /* Toggles */
      input[type=checkbox]{cursor:pointer;width:1.1rem;height:1.1rem}
      /* Section numbers (accent) */
      .lp-settings-title{font-weight:700;margin-bottom:.75rem;font-size:.95rem;border-bottom:1px solid var(--border,#eee);padding-bottom:.4rem}
      /* Active recall */
      .lp-recall-blur{filter:blur(4px);cursor:pointer;transition:filter .3s}
      .lp-recall-blur:hover{filter:blur(2px)}
      .lp-recall-revealed{filter:none!important;background:var(--highlight);padding:0 2px;border-radius:2px}
      /* TTS */
      .lp-tts-active{background:var(--highlight);border-radius:3px;transition:background .2s}
      #lp-tts-bar{position:fixed;bottom:64px;left:50%;transform:translateX(-50%);z-index:9001;background:var(--bg-card,#fff);border:1px solid var(--border,#ddd);border-radius:24px;padding:6px 16px;display:flex;align-items:center;gap:10px;box-shadow:0 2px 12px rgba(0,0,0,.15);font-size:.85rem}
      #lp-tts-bar button{background:none;border:none;cursor:pointer;font-size:1rem;min-width:32px;min-height:32px}
      #lp-tts-bar select{border:1px solid var(--border);border-radius:4px;padding:2px;font-size:.8rem;background:var(--bg-card)}
      /* Tamagotchi */
      #lp-tamagotchi{position:fixed;top:70px;left:12px;z-index:9000;background:var(--bg-card,#fff);border:1px solid var(--border,#ddd);border-radius:10px;padding:6px 10px;font-size:.8rem;box-shadow:0 2px 6px rgba(0,0,0,.1);display:flex;align-items:center;gap:6px;min-width:80px}
      .lp-tama-face{font-size:1.2rem}
      .lp-tama-info{font-weight:700;font-size:.75rem}
      .lp-tama-bar{width:40px;height:4px;background:var(--border);border-radius:2px;overflow:hidden}
      .lp-tama-bar div{height:100%;background:var(--accent2);border-radius:2px;transition:width .3s}
      /* Glitch reward */
      @keyframes lpGlitch{0%{clip-path:inset(40% 0 61% 0)}20%{clip-path:inset(92% 0 1% 0)}40%{clip-path:inset(43% 0 1% 0)}60%{clip-path:inset(25% 0 58% 0)}80%{clip-path:inset(54% 0 7% 0)}100%{clip-path:inset(58% 0 43% 0)}}
      .lp-glitch{animation:lpGlitch .3s linear 3;position:relative}
      .lp-glitch::before{content:attr(data-text);position:absolute;left:-2px;text-shadow:2px 0 var(--accent);top:0;clip-path:inset(0);animation:lpGlitch .3s linear 3 reverse}
      /* Pulse/Shake for quiz */
      @keyframes lpPulse{0%{box-shadow:0 0 0 0 rgba(44,110,73,.4)}70%{box-shadow:0 0 0 12px rgba(44,110,73,0)}100%{box-shadow:0 0 0 0 rgba(44,110,73,0)}}
      @keyframes lpShake{0%,100%{transform:translateX(0)}10%,30%,50%,70%,90%{transform:translateX(-4px)}20%,40%,60%,80%{transform:translateX(4px)}}
      .quiz-option.correct{animation:lpPulse .6s ease-out}
      .quiz-option.wrong{animation:lpShake .4s ease-out}
      /* Reduced motion */
      @media(prefers-reduced-motion:reduce){.lp-fade,.lp-glitch,.quiz-option.correct,.quiz-option.wrong,.lp-breath-ani{animation:none!important;transition:none!important;transform:none!important}}
      @keyframes lpSlideDown{from{opacity:0;transform:translate(-50%,-20px)}to{opacity:1;transform:translate(-50%,0)}}
    `;
    document.head.appendChild(s);
  }

  function injectUI() {
    // Settings gear button
    const gearBtn = document.createElement('button');
    gearBtn.className = 'lp-fab'; gearBtn.id = 'lp-gear-btn'; gearBtn.title = 'Einstellungen';
    gearBtn.style.cssText = 'bottom:12px;left:12px;'; gearBtn.textContent = '⚙️';
    gearBtn.addEventListener('click', () => settingsPanel.toggle());
    document.body.appendChild(gearBtn);

    // Settings panel
    const panel = document.createElement('div');
    panel.id = 'lp-settings-panel';
    panel.innerHTML = `
      <div class="lp-settings-title">⚙️ Einstellungen</div>
      <div class="lp-setting-row"><label>🌙 Dark Mode</label><input type="checkbox" id="lp-s-dark"></div>
      <div class="lp-setting-row"><label>🔠 Bionic Reading</label><input type="checkbox" id="lp-s-bionic"></div>
      <div class="lp-setting-row"><label>🔔 Sound</label><input type="checkbox" id="lp-s-sound"></div>
      <div class="lp-setting-row"><label>📳 Haptik</label><input type="checkbox" id="lp-s-haptic"></div>
      <div class="lp-setting-row"><label>🌊 Brown Noise</label><input type="checkbox" id="lp-s-noise"></div>
      <div class="lp-setting-row"><label style="flex:.6">Lautstärke</label><input type="range" id="lp-s-noiseVol" min="0" max="0.5" step="0.01" style="flex:1"></div>
      <div class="lp-setting-row"><label>🎯 Fokus-Modus</label><input type="checkbox" id="lp-s-focus"></div>
      <div class="lp-setting-row"><label>⏱ Timer (Min)</label><select id="lp-s-timerMin" style="border-radius:4px;padding:2px 4px"><option>15</option><option>20</option><option>25</option></select></div>
      <div class="lp-setting-row"><label>📝 Lückentext</label><input type="checkbox" id="lp-s-cloze"></div>
      <div class="lp-setting-row"><label>🔍 Active Recall</label><input type="checkbox" id="lp-s-recall"></div>
      <div class="lp-setting-row"><button id="lp-s-challenge" style="width:100%;padding:6px;border-radius:6px;border:1px solid var(--accent3);background:transparent;color:var(--accent3);cursor:pointer;font-weight:600;font-size:.82rem;">🤝 Challenge generieren</button></div>
    `;
    document.body.appendChild(panel);
    settingsPanel.el = panel;

    // Wire settings events
    panel.querySelector('#lp-s-dark').addEventListener('change', () => darkMode.toggle());
    panel.querySelector('#lp-s-bionic').addEventListener('change', () => bionic.toggle());
    panel.querySelector('#lp-s-sound').addEventListener('change', e => { state.sound = e.target.checked; saveState(); });
    panel.querySelector('#lp-s-haptic').addEventListener('change', e => { state.haptic = e.target.checked; saveState(); });
    panel.querySelector('#lp-s-noise').addEventListener('change', () => brownNoise.toggle());
    panel.querySelector('#lp-s-noiseVol').addEventListener('input', e => brownNoise.setVol(+e.target.value));
    panel.querySelector('#lp-s-focus').addEventListener('change', () => focus.toggle());
    panel.querySelector('#lp-s-timerMin').addEventListener('change', e => { state.timerMin = +e.target.value; saveState(); pomo.reset(); });
    panel.querySelector('#lp-s-cloze').addEventListener('change', () => cloze.toggle());
    panel.querySelector('#lp-s-recall').addEventListener('change', () => recall.toggle());
    panel.querySelector('#lp-s-challenge').addEventListener('click', () => studyBuddy.generateChallenge());

    settingsPanel.refresh();

    // Pomodoro timer
    const pomoEl = document.createElement('div');
    pomoEl.id = 'lp-pomo';
    pomoEl.innerHTML = `<span id="lp-pomo-label" style="font-size:.75rem;opacity:.7">Block 1</span><span id="lp-pomo-time">${String(state.timerMin).padStart(2,'0')}:00</span><button id="lp-pomo-toggle" title="Start/Pause">▶</button><button id="lp-pomo-reset" title="Reset">↺</button>`;
    document.body.appendChild(pomoEl);
    pomo.init();

    // Panic button
    const panicBtn = document.createElement('div');
    panicBtn.id = 'lp-panic-controls';
    panicBtn.innerHTML = `<button id="lp-panic-btn" title="Panik-Modus: Zeig nur einen Chunk" style="background:#e74c3c;color:#fff;border:none;border-radius:50%;width:44px;height:44px;font-size:1.2rem;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.25);display:flex;align-items:center;justify-content:center">😵</button>`;
    document.body.appendChild(panicBtn);
    document.getElementById('lp-panic-btn').addEventListener('click', () => {
      if (panic.active) {
        panic.exit();
        document.getElementById('lp-panic-next')?.remove();
      } else {
        panic.enter();
        const nextBtn = document.createElement('button');
        nextBtn.id = 'lp-panic-next';
        nextBtn.style.cssText = 'background:#2c6e49;color:#fff;border:none;border-radius:8px;padding:8px 16px;font-size:.85rem;cursor:pointer;min-height:44px;box-shadow:0 2px 8px rgba(0,0,0,.25)';
        nextBtn.textContent = 'Weiter →';
        nextBtn.addEventListener('click', () => panic.next());
        const exitBtn = document.createElement('button');
        exitBtn.style.cssText = 'background:#555;color:#fff;border:none;border-radius:8px;padding:8px 16px;font-size:.85rem;cursor:pointer;min-height:44px;box-shadow:0 2px 8px rgba(0,0,0,.25)';
        exitBtn.textContent = 'Alles zeigen';
        exitBtn.addEventListener('click', () => { panic.exit(); panicBtn.querySelectorAll('button:not(#lp-panic-btn)').forEach(b => b.remove()); });
        panicBtn.appendChild(nextBtn); panicBtn.appendChild(exitBtn);
      }
    });

    // Decision Roulette button
    const rouletteBtn = document.createElement('button');
    rouletteBtn.className = 'lp-fab'; rouletteBtn.title = 'Was soll ich tun?';
    rouletteBtn.style.cssText = 'bottom:5.5rem;right:1.2rem;font-size:1rem;';
    rouletteBtn.textContent = '🎲';
    rouletteBtn.addEventListener('click', () => roulette.spin());
    document.body.appendChild(rouletteBtn);

    // Loot bag button
    const lootBtn = document.createElement('button');
    lootBtn.className = 'lp-fab loot-bag-btn';
    lootBtn.title = 'Loot Bag (Doppelklick zum Sammeln)';
    lootBtn.style.cssText = 'position:fixed;bottom:9rem;right:1.2rem;';
    lootBtn.innerHTML = '🎒<span id="lp-loot-count" style="position:absolute;top:-4px;right:-4px;background:var(--accent);color:#fff;font-size:.6rem;min-width:16px;height:16px;border-radius:50%;display:flex;align-items:center;justify-content:center;"></span>';
    lootBtn.addEventListener('click', () => {
      if (lootBag.items.length) {
        if (confirm(`${lootBag.items.length} Sätze gesammelt. Als Cheat Sheet herunterladen?`)) lootBag.exportSheet();
      } else {
        const toast = document.createElement('div');
        toast.style.cssText = 'position:fixed;top:80px;left:50%;transform:translateX(-50%);z-index:10000;background:var(--accent3);color:#fff;padding:12px 24px;border-radius:12px;font-size:.85rem;box-shadow:0 4px 20px rgba(0,0,0,.2);';
        toast.textContent = '💡 Doppelklick auf Sätze zum Sammeln!';
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
      }
    });
    document.body.appendChild(lootBtn);

    // TTS floating bar
    if (window.speechSynthesis) {
      const ttsBar = document.createElement('div');
      ttsBar.id = 'lp-tts-bar';
      ttsBar.style.display = 'none';
      ttsBar.innerHTML = `<button id="lp-tts-play" title="Play/Pause">▶</button><button id="lp-tts-stop" title="Stop">⏹</button><select id="lp-tts-rate"><option value="0.8">0.8x</option><option value="1" selected>1x</option><option value="1.2">1.2x</option><option value="1.5">1.5x</option></select><button id="lp-tts-close" title="Schließen">✕</button>`;
      document.body.appendChild(ttsBar);
      ttsBar.querySelector('#lp-tts-play').addEventListener('click', () => tts.togglePlayPause());
      ttsBar.querySelector('#lp-tts-stop').addEventListener('click', () => { tts.stop(); ttsBar.style.display = 'none'; });
      ttsBar.querySelector('#lp-tts-rate').addEventListener('change', e => tts.setRate(+e.target.value));
      ttsBar.querySelector('#lp-tts-close').addEventListener('click', () => { tts.stop(); ttsBar.style.display = 'none'; });

      // Add "Vorlesen" buttons to each section
      document.querySelectorAll('section[id]').forEach(sec => {
        const btn = document.createElement('button');
        btn.textContent = '🔊 Vorlesen';
        btn.style.cssText = 'background:var(--accent3);color:#fff;border:none;border-radius:4px;padding:4px 12px;font-size:.78rem;cursor:pointer;margin:0.5rem 0;';
        btn.addEventListener('click', () => {
          ttsBar.style.display = 'flex';
          tts.speakSection(sec);
        });
        sec.querySelector('h2')?.after(btn);
      });
    }

    // Tamagotchi
    const tamaEl = document.createElement('div');
    tamaEl.id = 'lp-tamagotchi';
    document.body.appendChild(tamaEl);
    tamagotchi.init();
  }

  // ── INIT ─────────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', () => {
    // Migrate old localStorage keys
    (function migrateStorage() {
      const migrations = {
        'epv3_state': 'lp_experimentelle-psychologie_state',
        'stat1v3_state': 'lp_statistik_state',
      };
      Object.entries(migrations).forEach(([oldKey, newKey]) => {
        const val = localStorage.getItem(oldKey);
        if (val && !localStorage.getItem(newKey)) {
          localStorage.setItem(newKey, val);
          localStorage.removeItem(oldKey);
        }
      });
    })();

    injectStyles();
    injectUI();
    bionic.init();
    lootBag.init();
    if (state.noise) brownNoise.start();
    if (state.focusMode) focus.activate();
    achievements.recordSession();
    setTimeout(() => achievements.checkAndNotify(), 2000);
  });

  // Public API
  return { pomo, panic, bionic, focus, darkMode, roulette, brownNoise, reward, settingsPanel, cloze, recall, lootBag, tts, tamagotchi, achievements, studyBuddy };
})();
