/**
 * femto-FSRS — Minimal Free Spaced Repetition Scheduler
 * Based on: https://github.com/open-spaced-repetition/fsrs4anki
 *
 * Rating: 1=Again, 2=Hard, 3=Good, 4=Easy
 * State stored in localStorage per topic
 */
const FSRS = (() => {
  // Default parameters (FSRS-4.5)
  const w = [0.4, 0.6, 2.4, 5.8, 4.93, 0.94, 0.86, 0.01, 1.49, 0.14, 0.94, 2.18, 0.05, 0.34, 1.26, 0.29, 2.61];

  const DAY_MS = 86400000;

  function initCard() {
    return {
      stability: 0,
      difficulty: 0,
      elapsedDays: 0,
      scheduledDays: 0,
      reps: 0,
      lapses: 0,
      state: 0, // 0=New, 1=Learning, 2=Review, 3=Relearning
      due: Date.now(),
      lastReview: 0,
    };
  }

  function clamp(val, min, max) { return Math.min(Math.max(val, min), max); }

  function initDifficulty(rating) {
    return clamp(w[4] - (rating - 3) * w[5], 1, 10);
  }

  function initStability(rating) {
    return Math.max(w[rating - 1], 0.1);
  }

  function nextDifficulty(d, rating) {
    const newD = d - w[6] * (rating - 3);
    return clamp(w[7] * initDifficulty(3) + (1 - w[7]) * newD, 1, 10);
  }

  function nextRecallStability(d, s, r, rating) {
    const hardPenalty = rating === 2 ? w[15] : 1;
    const easyBonus = rating === 4 ? w[16] : 1;
    return s * (1 + Math.exp(w[8]) * (11 - d) * Math.pow(s, -w[9]) * (Math.exp((1 - r) * w[10]) - 1) * hardPenalty * easyBonus);
  }

  function nextForgetStability(d, s, r) {
    return w[11] * Math.pow(d, -w[12]) * (Math.pow(s + 1, w[13]) - 1) * Math.exp((1 - r) * w[14]);
  }

  function nextInterval(s) {
    // desired retention = 0.9
    const interval = (s / 9) * (Math.pow(0.9, 1 / -0.5) - 1);
    return Math.max(1, Math.round(Math.min(interval, 365)));
  }

  function retrievability(s, elapsedDays) {
    if (s <= 0) return 0;
    return Math.pow(1 + elapsedDays / (9 * s), -1);
  }

  function review(card, rating) {
    const now = Date.now();
    const c = { ...card };
    const elapsed = c.lastReview ? (now - c.lastReview) / DAY_MS : 0;
    c.elapsedDays = elapsed;
    c.lastReview = now;
    c.reps++;

    if (c.state === 0) {
      // New card
      c.difficulty = initDifficulty(rating);
      c.stability = initStability(rating);
      c.state = rating === 1 ? 1 : 2;
      if (rating === 1) {
        c.scheduledDays = 0;
        c.due = now;
        c.lapses++;
      } else {
        c.scheduledDays = nextInterval(c.stability);
        c.due = now + c.scheduledDays * DAY_MS;
      }
    } else {
      const r = retrievability(c.stability, elapsed);
      c.difficulty = nextDifficulty(c.difficulty, rating);

      if (rating === 1) {
        c.stability = nextForgetStability(c.difficulty, c.stability, r);
        c.state = 3; // Relearning
        c.lapses++;
        c.scheduledDays = 0;
        c.due = now;
      } else {
        c.stability = nextRecallStability(c.difficulty, c.stability, r, rating);
        c.state = 2; // Review
        c.scheduledDays = nextInterval(c.stability);
        c.due = now + c.scheduledDays * DAY_MS;
      }
    }

    return c;
  }

  // Storage helpers
  function getStore(slug) {
    try { return JSON.parse(localStorage.getItem(`lp_${slug}_fsrs`)) || {}; }
    catch { return {}; }
  }

  function saveStore(slug, store) {
    localStorage.setItem(`lp_${slug}_fsrs`, JSON.stringify(store));
  }

  function getCard(slug, cardId) {
    const store = getStore(slug);
    return store[cardId] || initCard();
  }

  function reviewCard(slug, cardId, rating) {
    const store = getStore(slug);
    const card = store[cardId] || initCard();
    store[cardId] = review(card, rating);
    saveStore(slug, store);
    return store[cardId];
  }

  function getDueCards(slug) {
    const store = getStore(slug);
    const now = Date.now();
    return Object.entries(store)
      .filter(([, c]) => c.due <= now)
      .map(([id, c]) => ({ id, ...c }))
      .sort((a, b) => a.due - b.due);
  }

  function getAllCards(slug) {
    return getStore(slug);
  }

  function getStats(slug) {
    const store = getStore(slug);
    const entries = Object.values(store);
    const now = Date.now();
    const due = entries.filter(c => c.due <= now).length;
    const newCards = entries.filter(c => c.state === 0).length;
    const learning = entries.filter(c => c.state === 1 || c.state === 3).length;
    const reviewCards = entries.filter(c => c.state === 2).length;
    const avgRetention = entries.length ?
      entries.reduce((sum, c) => sum + retrievability(c.stability, (now - c.lastReview) / DAY_MS), 0) / entries.length : 0;
    return { total: entries.length, due, newCards, learning, review: reviewCards, avgRetention: Math.round(avgRetention * 100) };
  }

  // Migration: convert old triage data to FSRS
  function migrateFromTriage(slug, triageData) {
    // triageData format: { cardId: 'red'|'yellow'|'green' }
    const store = getStore(slug);
    const ratingMap = { red: 1, yellow: 2, green: 3 };
    Object.entries(triageData).forEach(([id, tier]) => {
      if (!store[id]) {
        const card = initCard();
        const rating = ratingMap[tier] || 3;
        store[id] = review(card, rating);
      }
    });
    saveStore(slug, store);
  }

  return { initCard, review, reviewCard, getCard, getDueCards, getAllCards, getStats, getStore, saveStore, migrateFromTriage, retrievability };
})();
