/**
 * OmniStudy — All-in-One Student Productivity Suite
 * Full Client-Side Architecture (ES6+), Web Audio API, LocalStorage persistence
 */

// =============================================================================
// 1. STATE & STORAGE MANAGEMENT
// =============================================================================

const STORAGE_KEYS = {
  THEME: 'omnistudy_theme',
  POMO_STATS: 'omnistudy_pomo_stats',
  FLASHCARDS: 'omnistudy_decks_v2',
  ACTIVE_DECK: 'omnistudy_active_deck',
  GPA_DATA: 'omnistudy_gpa_data'
};

const DEFAULT_DECKS = {
  "Computer Science & Tech": [
    { front: "What is the time complexity of Binary Search?", back: "O(log n) — splits search space in half each iteration.", interval: 1, nextReview: 0 },
    { front: "What is Polymorphism in Object-Oriented Programming?", back: "The ability of different classes to respond to the same message/method in their own unique way.", interval: 1, nextReview: 0 },
    { front: "Explain the difference between a Process and a Thread.", back: "A Process has its own independent memory space. Threads share memory within the same process.", interval: 1, nextReview: 0 },
    { front: "What does ACID stand for in Database Systems?", back: "Atomicity, Consistency, Isolation, Durability.", interval: 1, nextReview: 0 },
    { front: "What is an idempotent HTTP method?", back: "An operation that produces the same result no matter how many times it is executed (e.g., GET, PUT, DELETE).", interval: 1, nextReview: 0 }
  ],
  "Biology & Life Sciences": [
    { front: "Mitochondria", back: "The powerhouse of the cell; produces ATP via cellular respiration.", interval: 1, nextReview: 0 },
    { front: "Photosynthesis Formula", back: "6CO2 + 6H2O + Light Energy -> C6H12O6 + 6O2", interval: 1, nextReview: 0 },
    { front: "Central Dogma of Molecular Biology", back: "DNA -> RNA (Transcription) -> Protein (Translation)", interval: 1, nextReview: 0 }
  ]
};

const DEFAULT_GPA_COURSES = [
  { name: "Calculus II", credits: 4, grade: "A" },
  { name: "Computer Systems Architecture", credits: 4, grade: "A-" },
  { name: "Academic Writing & Research", credits: 3, grade: "B+" },
  { name: "Linear Algebra", credits: 4, grade: "A" }
];

const GRADE_POINTS = {
  "A+": 4.0, "A": 4.0, "A-": 3.7,
  "B+": 3.3, "B": 3.0, "B-": 2.7,
  "C+": 2.3, "C": 2.0, "C-": 1.7,
  "D+": 1.3, "D": 1.0, "F": 0.0
};

// Global App State
const state = {
  theme: localStorage.getItem(STORAGE_KEYS.THEME) || 'dark',
  currentTab: 'pomodoro',
  pomo: {
    mode: 'work', // 'work', 'shortBreak', 'longBreak'
    duration: 25 * 60,
    remaining: 25 * 60,
    isRunning: false,
    timerId: null,
    task: '',
    stats: JSON.parse(localStorage.getItem(STORAGE_KEYS.POMO_STATS)) || {
      completed: 0,
      focusMinutes: 0,
      streak: 1,
      lastActiveDate: new Date().toISOString().split('T')[0]
    }
  },
  audio: {
    ctx: null,
    masterGain: null,
    masterVol: 0.7,
    activeSources: {}
  },
  flashcards: {
    decks: JSON.parse(localStorage.getItem(STORAGE_KEYS.FLASHCARDS)) || DEFAULT_DECKS,
    currentDeckName: localStorage.getItem(STORAGE_KEYS.ACTIVE_DECK) || "Computer Science & Tech",
    currentIndex: 0,
    isFlipped: false
  },
  gpa: JSON.parse(localStorage.getItem(STORAGE_KEYS.GPA_DATA)) || {
    priorGpa: 3.40,
    priorCredits: 45,
    courses: DEFAULT_GPA_COURSES
  }
};

// =============================================================================
// 2. INITIALIZATION
// =============================================================================

document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initPomodoro();
  initFlashcards();
  initGpaCalculator();
  initPWA();
  lucide.createIcons();

  // Keyboard Shortcuts (Space to flip card / pause timer)
  window.addEventListener('keydown', handleGlobalKeydown);
});

function handleGlobalKeydown(e) {
  if (['input', 'textarea', 'select'].includes(document.activeElement.tagName.toLowerCase())) {
    return;
  }
  
  if (state.currentTab === 'flashcards') {
    if (e.code === 'Space') {
      e.preventDefault();
      flipCard();
    } else if (['Digit1', 'Digit2', 'Digit3', 'Digit4'].includes(e.code)) {
      const rating = parseInt(e.code.replace('Digit', ''));
      rateSRS(rating);
    }
  } else if (state.currentTab === 'pomodoro') {
    if (e.code === 'Space') {
      e.preventDefault();
      toggleTimer();
    }
  }
}

// =============================================================================
// 3. THEME MANAGEMENT
// =============================================================================

function initTheme() {
  if (state.theme === 'dark') {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
}

function toggleTheme() {
  state.theme = state.theme === 'dark' ? 'light' : 'dark';
  localStorage.setItem(STORAGE_KEYS.THEME, state.theme);
  initTheme();
  lucide.createIcons();
}

// =============================================================================
// 4. TAB NAVIGATION
// =============================================================================

function switchTab(tabId) {
  state.currentTab = tabId;

  // Toggle Tab content visibility
  document.querySelectorAll('.tab-content').forEach(section => {
    section.classList.add('hidden');
  });
  const targetSection = document.getElementById(`tab-${tabId}`);
  if (targetSection) targetSection.classList.remove('hidden');

  // Update Desktop Nav Pill
  document.querySelectorAll('.nav-tab').forEach(btn => {
    if (btn.getAttribute('data-tab') === tabId) {
      btn.classList.add('active', 'bg-brand-600', 'text-white');
      btn.classList.remove('text-slate-600', 'dark:text-slate-400');
    } else {
      btn.classList.remove('active', 'bg-brand-600', 'text-white');
      btn.classList.add('text-slate-600', 'dark:text-slate-400');
    }
  });

  // Update Mobile Nav
  document.querySelectorAll('.mobile-nav-tab').forEach(btn => {
    if (btn.getAttribute('data-tab') === tabId) {
      btn.classList.add('text-brand-600', 'dark:text-brand-400');
      btn.classList.remove('text-slate-500', 'dark:text-slate-400');
    } else {
      btn.classList.remove('text-brand-600', 'dark:text-brand-400');
      btn.classList.add('text-slate-500', 'dark:text-slate-400');
    }
  });

  lucide.createIcons();
}

// =============================================================================
// 5. POMODORO TIMER ENGINE
// =============================================================================

const TIMER_DURATIONS = {
  work: 25 * 60,
  shortBreak: 5 * 60,
  longBreak: 15 * 60
};

function initPomodoro() {
  updateTimerDisplay();
  updatePomoStatsUI();

  const taskInput = document.getElementById('currentTaskInput');
  if (taskInput) {
    taskInput.addEventListener('input', (e) => {
      state.pomo.task = e.target.value;
    });
  }
}

function setTimerMode(mode) {
  if (state.pomo.isRunning) {
    clearInterval(state.pomo.timerId);
    state.pomo.isRunning = false;
    updateTimerPlayBtnUI();
  }

  state.pomo.mode = mode;
  state.pomo.duration = TIMER_DURATIONS[mode];
  state.pomo.remaining = state.pomo.duration;

  // Update UI Pills
  ['work', 'shortBreak', 'longBreak'].forEach(m => {
    const btn = document.getElementById(`mode-${m}`);
    if (btn) {
      if (m === mode) {
        btn.className = 'px-4 py-1.5 rounded-lg text-xs font-bold transition bg-brand-600 text-white shadow-sm';
      } else {
        btn.className = 'px-4 py-1.5 rounded-lg text-xs font-bold transition text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white';
      }
    }
  });

  const label = document.getElementById('timerStatusLabel');
  if (label) {
    label.innerText = mode === 'work' ? 'Deep Work' : (mode === 'shortBreak' ? 'Short Break' : 'Long Recharge');
  }

  updateTimerDisplay();
}

function toggleTimer() {
  // Ensure Web Audio context is started on user gesture
  getAudioContext();

  if (state.pomo.isRunning) {
    clearInterval(state.pomo.timerId);
    state.pomo.isRunning = false;
  } else {
    state.pomo.isRunning = true;
    state.pomo.timerId = setInterval(() => {
      if (state.pomo.remaining > 0) {
        state.pomo.remaining--;
        updateTimerDisplay();
      } else {
        onTimerComplete();
      }
    }, 1000);
  }
  updateTimerPlayBtnUI();
}

function resetTimer() {
  if (state.pomo.isRunning) {
    clearInterval(state.pomo.timerId);
    state.pomo.isRunning = false;
  }
  state.pomo.remaining = state.pomo.duration;
  updateTimerDisplay();
  updateTimerPlayBtnUI();
}

function skipTimer() {
  resetTimer();
  if (state.pomo.mode === 'work') {
    setTimerMode('shortBreak');
  } else {
    setTimerMode('work');
  }
}

function updateTimerDisplay() {
  const mins = Math.floor(state.pomo.remaining / 60);
  const secs = state.pomo.remaining % 60;
  const timeStr = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  
  const display = document.getElementById('timeDisplay');
  if (display) display.innerText = timeStr;

  // Title tag update for browser tab awareness
  document.title = `${timeStr} — OmniStudy`;

  // SVG Progress Ring (circumference = 2 * PI * 102 ≈ 640.88)
  const circle = document.getElementById('timerProgressCircle');
  if (circle) {
    const total = state.pomo.duration;
    const progress = (total - state.pomo.remaining) / total;
    const circumference = 640.88;
    const offset = circumference - (progress * circumference);
    circle.style.strokeDashoffset = offset;
  }
}

function updateTimerPlayBtnUI() {
  const btn = document.getElementById('toggleTimerBtn');
  const text = document.getElementById('timerBtnText');
  const icon = document.getElementById('timerPlayIcon');
  
  if (state.pomo.isRunning) {
    if (text) text.innerText = 'Pause';
    if (btn) btn.className = 'px-8 py-3 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-sm shadow-lg shadow-amber-500/30 transition transform active:scale-95 flex items-center gap-2';
    if (icon) icon.setAttribute('data-lucide', 'pause');
  } else {
    if (text) text.innerText = 'Start Focus';
    if (btn) btn.className = 'px-8 py-3 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-sm shadow-lg shadow-brand-500/30 transition transform active:scale-95 flex items-center gap-2';
    if (icon) icon.setAttribute('data-lucide', 'play');
  }
  lucide.createIcons();
}

function onTimerComplete() {
  clearInterval(state.pomo.timerId);
  state.pomo.isRunning = false;
  updateTimerPlayBtnUI();

  // Play synthesized bell chime
  playBellChime();

  if (state.pomo.mode === 'work') {
    state.pomo.stats.completed++;
    state.pomo.stats.focusMinutes += Math.round(state.pomo.duration / 60);
    savePomoStats();
    updatePomoStatsUI();
    setTimerMode('shortBreak');
    alert('🎉 Awesome focus session completed! Take a well-deserved 5-minute break.');
  } else {
    setTimerMode('work');
    alert('⏰ Break finished! Ready to dive back into deep focus?');
  }
}

function savePomoStats() {
  localStorage.setItem(STORAGE_KEYS.POMO_STATS, JSON.stringify(state.pomo.stats));
}

function updatePomoStatsUI() {
  const completedEl = document.getElementById('statCompletedPomos');
  const focusTimeEl = document.getElementById('statFocusTime');
  const streakEl = document.getElementById('statStreak');

  if (completedEl) completedEl.innerText = state.pomo.stats.completed;
  if (focusTimeEl) focusTimeEl.innerText = `${state.pomo.stats.focusMinutes}m`;
  if (streakEl) streakEl.innerText = `${state.pomo.stats.streak} Day`;
}

// =============================================================================
// 6. PROCEDURAL WEB AUDIO SYNTHESIZER (ZERO EXTERNAL ASSETS)
// =============================================================================

function getAudioContext() {
  if (!state.audio.ctx) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    state.audio.ctx = new AudioContext();
    
    state.audio.masterGain = state.audio.ctx.createGain();
    state.audio.masterGain.gain.setValueAtTime(state.audio.masterVol, state.audio.ctx.currentTime);
    state.audio.masterGain.connect(state.audio.ctx.destination);
  }
  if (state.audio.ctx.state === 'suspended') {
    state.audio.ctx.resume();
  }
  return state.audio.ctx;
}

function setMasterVolume(val) {
  const vol = parseFloat(val);
  state.audio.masterVol = vol;
  if (state.audio.masterGain) {
    state.audio.masterGain.gain.setTargetAtTime(vol, state.audio.ctx.currentTime, 0.05);
  }
  const pct = document.getElementById('volumePercent');
  if (pct) pct.innerText = `${Math.round(vol * 100)}%`;
}

function createWhiteNoiseBuffer(ctx, durationSec = 5) {
  const bufferSize = ctx.sampleRate * durationSec;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  return buffer;
}

function toggleSound(soundType) {
  const ctx = getAudioContext();

  if (state.audio.activeSources[soundType]) {
    // Stop sound
    stopSound(soundType);
  } else {
    // Start sound
    startSound(soundType);
  }
}

function startSound(soundType) {
  const ctx = getAudioContext();
  const gainNode = ctx.createGain();
  gainNode.gain.setValueAtTime(0.5, ctx.currentTime);
  gainNode.connect(state.audio.masterGain);

  let sourceNode = null;

  if (soundType === 'brown') {
    // Synthesize Brown noise via white noise buffer + 2-pole lowpass filter cascade
    const buffer = createWhiteNoiseBuffer(ctx, 4);
    sourceNode = ctx.createBufferSource();
    sourceNode.buffer = buffer;
    sourceNode.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(280, ctx.currentTime);

    sourceNode.connect(filter);
    filter.connect(gainNode);
    sourceNode.start();

  } else if (soundType === 'rain') {
    // Rainfall synthesis: filtered white noise + gentle bandpass modulation
    const buffer = createWhiteNoiseBuffer(ctx, 4);
    sourceNode = ctx.createBufferSource();
    sourceNode.buffer = buffer;
    sourceNode.loop = true;

    const bandpass = ctx.createBiquadFilter();
    bandpass.type = 'bandpass';
    bandpass.frequency.setValueAtTime(1000, ctx.currentTime);
    bandpass.Q.setValueAtTime(0.7, ctx.currentTime);

    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.setValueAtTime(1800, ctx.currentTime);

    sourceNode.connect(bandpass);
    bandpass.connect(lowpass);
    lowpass.connect(gainNode);
    sourceNode.start();

  } else if (soundType === 'pink') {
    // Pink noise approximation
    const buffer = createWhiteNoiseBuffer(ctx, 4);
    sourceNode = ctx.createBufferSource();
    sourceNode.buffer = buffer;
    sourceNode.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(900, ctx.currentTime);

    sourceNode.connect(filter);
    filter.connect(gainNode);
    sourceNode.start();

  } else if (soundType === 'binaural') {
    // 10 Hz Alpha Wave Binaural Beat (Left: 200Hz, Right: 210Hz)
    const merger = ctx.createChannelMerger(2);

    const oscLeft = ctx.createOscillator();
    oscLeft.type = 'sine';
    oscLeft.frequency.setValueAtTime(200, ctx.currentTime);

    const oscRight = ctx.createOscillator();
    oscRight.type = 'sine';
    oscRight.frequency.setValueAtTime(210, ctx.currentTime);

    oscLeft.connect(merger, 0, 0);
    oscRight.connect(merger, 0, 1);
    merger.connect(gainNode);

    oscLeft.start();
    oscRight.start();

    sourceNode = {
      stop: () => {
        oscLeft.stop();
        oscRight.stop();
      }
    };
  }

  state.audio.activeSources[soundType] = { source: sourceNode, gain: gainNode };
  updateSoundCardUI(soundType, true);
}

function stopSound(soundType) {
  if (state.audio.activeSources[soundType]) {
    try {
      state.audio.activeSources[soundType].source.stop();
    } catch (e) {}
    delete state.audio.activeSources[soundType];
    updateSoundCardUI(soundType, false);
  }
}

function stopAllSounds() {
  Object.keys(state.audio.activeSources).forEach(type => {
    stopSound(type);
  });
}

function setSoundVolume(soundType, val) {
  if (state.audio.activeSources[soundType]) {
    const gainNode = state.audio.activeSources[soundType].gain;
    gainNode.gain.setTargetAtTime(parseFloat(val), state.audio.ctx.currentTime, 0.05);
  }
}

function updateSoundCardUI(soundType, isActive) {
  const card = document.getElementById(`sound-card-${soundType}`);
  const btn = card ? card.querySelector('.sound-toggle-btn') : null;
  if (card && btn) {
    if (isActive) {
      card.classList.add('is-active');
      btn.innerHTML = '<i data-lucide="square" class="w-3 h-3"></i>';
    } else {
      card.classList.remove('is-active');
      btn.innerHTML = '<i data-lucide="play" class="w-3 h-3"></i>';
    }
    lucide.createIcons();
  }
}

function playBellChime() {
  const ctx = getAudioContext();
  const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
  notes.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.15);

    gain.gain.setValueAtTime(0.3, ctx.currentTime + i * 0.15);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.15 + 1.2);

    osc.connect(gain);
    gain.connect(state.audio.masterGain);

    osc.start(ctx.currentTime + i * 0.15);
    osc.stop(ctx.currentTime + i * 0.15 + 1.3);
  });
}

// =============================================================================
// 7. MARKDOWN FLASHCARDS & SPACED REPETITION ENGINE (SRS)
// =============================================================================

function initFlashcards() {
  populateDeckSelect();
  renderCurrentCard();
}

function populateDeckSelect() {
  const select = document.getElementById('deckSelect');
  if (!select) return;

  select.innerHTML = '';
  Object.keys(state.flashcards.decks).forEach(name => {
    const opt = document.createElement('option');
    opt.value = name;
    opt.innerText = `${name} (${state.flashcards.decks[name].length} cards)`;
    if (name === state.flashcards.currentDeckName) opt.selected = true;
    select.appendChild(opt);
  });
  updateDeckCounts();
}

function onDeckChange() {
  const select = document.getElementById('deckSelect');
  if (select) {
    state.flashcards.currentDeckName = select.value;
    state.flashcards.currentIndex = 0;
    state.flashcards.isFlipped = false;
    localStorage.setItem(STORAGE_KEYS.ACTIVE_DECK, select.value);
    renderCurrentCard();
    updateDeckCounts();
  }
}

function promptNewDeck() {
  const name = prompt("Enter a name for the new deck (e.g., 'Organic Chemistry Midterm'):");
  if (name && name.trim()) {
    const cleanName = name.trim();
    if (!state.flashcards.decks[cleanName]) {
      state.flashcards.decks[cleanName] = [];
      state.flashcards.currentDeckName = cleanName;
      state.flashcards.currentIndex = 0;
      saveDecks();
      populateDeckSelect();
      renderCurrentCard();
    }
  }
}

function deleteCurrentDeck() {
  const name = state.flashcards.currentDeckName;
  if (confirm(`Are you sure you want to delete the deck "${name}"?`)) {
    delete state.flashcards.decks[name];
    const remainingDecks = Object.keys(state.flashcards.decks);
    if (remainingDecks.length === 0) {
      state.flashcards.decks = DEFAULT_DECKS;
    }
    state.flashcards.currentDeckName = Object.keys(state.flashcards.decks)[0];
    state.flashcards.currentIndex = 0;
    saveDecks();
    populateDeckSelect();
    renderCurrentCard();
  }
}

function loadSampleDeck() {
  state.flashcards.decks = { ...state.flashcards.decks, ...DEFAULT_DECKS };
  saveDecks();
  populateDeckSelect();
  renderCurrentCard();
  alert('Sample decks loaded successfully!');
}

function importMarkdownToDeck() {
  const textarea = document.getElementById('markdownInput');
  if (!textarea || !textarea.value.trim()) {
    alert('Please enter markdown text in Front :: Back or Q: / A: format.');
    return;
  }

  const text = textarea.value.trim();
  const lines = text.split('\n');
  const parsedCards = [];

  let pendingQ = null;

  for (let line of lines) {
    line = line.trim();
    if (!line) continue;

    // Pattern 1: Front :: Back
    if (line.includes('::')) {
      const parts = line.split('::');
      const front = parts[0].trim();
      const back = parts.slice(1).join('::').trim();
      if (front && back) {
        parsedCards.push({ front, back, interval: 1, nextReview: 0 });
      }
    }
    // Pattern 2: Q: ... A: ...
    else if (/^q:\s*/i.test(line)) {
      pendingQ = line.replace(/^q:\s*/i, '').trim();
    } else if (/^a:\s*/i.test(line) && pendingQ) {
      const back = line.replace(/^a:\s*/i, '').trim();
      parsedCards.push({ front: pendingQ, back, interval: 1, nextReview: 0 });
      pendingQ = null;
    }
    // Pattern 3: Table Markdown: | Front | Back |
    else if (line.startsWith('|') && line.endsWith('|')) {
      const parts = line.split('|').map(s => s.trim()).filter(Boolean);
      if (parts.length >= 2 && !parts[0].includes('---')) {
        parsedCards.push({ front: parts[0], back: parts[1], interval: 1, nextReview: 0 });
      }
    }
  }

  if (parsedCards.length === 0) {
    alert('No valid cards found. Ensure each card is written as: "Front :: Back" or "Q: ... A: ..."');
    return;
  }

  const deck = state.flashcards.decks[state.flashcards.currentDeckName] || [];
  state.flashcards.decks[state.flashcards.currentDeckName] = deck.concat(parsedCards);
  saveDecks();
  textarea.value = '';
  populateDeckSelect();
  renderCurrentCard();
  alert(`Added ${parsedCards.length} flashcard(s) to "${state.flashcards.currentDeckName}"!`);
}

function exportDeckMarkdown() {
  const deck = state.flashcards.decks[state.flashcards.currentDeckName] || [];
  if (deck.length === 0) {
    alert('Current deck is empty.');
    return;
  }
  let md = `# Flashcard Deck: ${state.flashcards.currentDeckName}\n\n`;
  deck.forEach(c => {
    md += `Q: ${c.front}\nA: ${c.back}\n\n`;
  });
  navigator.clipboard.writeText(md).then(() => {
    alert('Deck copied to clipboard as Markdown!');
  });
}

function saveDecks() {
  localStorage.setItem(STORAGE_KEYS.FLASHCARDS, JSON.stringify(state.flashcards.decks));
}

function updateDeckCounts() {
  const deck = state.flashcards.decks[state.flashcards.currentDeckName] || [];
  const countEl = document.getElementById('deckCardCount');
  const dueEl = document.getElementById('deckDueCount');
  
  if (countEl) countEl.innerText = `${deck.length} cards in deck`;
  if (dueEl) dueEl.innerText = `${deck.length} ready to study`;
}

function renderCurrentCard() {
  const deck = state.flashcards.decks[state.flashcards.currentDeckName] || [];
  const cardEl = document.getElementById('flashcardElement');
  const frontEl = document.getElementById('cardFrontText');
  const backEl = document.getElementById('cardBackText');
  const progText = document.getElementById('studyProgressText');

  // Reset flip state
  state.flashcards.isFlipped = false;
  if (cardEl) cardEl.classList.remove('is-flipped');

  if (deck.length === 0) {
    if (frontEl) frontEl.innerText = "Deck is empty! Add cards via the Markdown importer.";
    if (backEl) backEl.innerText = "No cards available.";
    if (progText) progText.innerText = "0 / 0";
    return;
  }

  if (state.flashcards.currentIndex >= deck.length) {
    state.flashcards.currentIndex = 0;
  }

  const current = deck[state.flashcards.currentIndex];
  if (frontEl) frontEl.innerText = current.front;
  if (backEl) backEl.innerText = current.back;
  if (progText) progText.innerText = `Card ${state.flashcards.currentIndex + 1} / ${deck.length}`;
}

function flipCard() {
  const cardEl = document.getElementById('flashcardElement');
  state.flashcards.isFlipped = !state.flashcards.isFlipped;
  if (cardEl) {
    if (state.flashcards.isFlipped) {
      cardEl.classList.add('is-flipped');
    } else {
      cardEl.classList.remove('is-flipped');
    }
  }
}

function rateSRS(ratingScore) {
  const deck = state.flashcards.decks[state.flashcards.currentDeckName] || [];
  if (deck.length === 0) return;

  const current = deck[state.flashcards.currentIndex];
  
  // Leitner / Simple Spaced Repetition Multipliers:
  // 1 (Again): interval resets to 1
  // 2 (Hard): interval * 1.2
  // 3 (Good): interval * 2
  // 4 (Easy): interval * 3.5
  if (ratingScore === 1) {
    current.interval = 1;
  } else if (ratingScore === 2) {
    current.interval = Math.max(1, Math.round(current.interval * 1.2));
  } else if (ratingScore === 3) {
    current.interval = Math.max(2, Math.round(current.interval * 2.0));
  } else if (ratingScore === 4) {
    current.interval = Math.max(3, Math.round(current.interval * 3.5));
  }

  current.nextReview = Date.now() + (current.interval * 24 * 60 * 60 * 1000);
  saveDecks();

  // Move to next card with slight delay for smooth visual transition
  state.flashcards.currentIndex = (state.flashcards.currentIndex + 1) % deck.length;
  renderCurrentCard();
}

function shuffleDeck() {
  const deck = state.flashcards.decks[state.flashcards.currentDeckName] || [];
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  state.flashcards.currentIndex = 0;
  saveDecks();
  renderCurrentCard();
}

function resetSRSProgress() {
  const deck = state.flashcards.decks[state.flashcards.currentDeckName] || [];
  deck.forEach(c => {
    c.interval = 1;
    c.nextReview = 0;
  });
  state.flashcards.currentIndex = 0;
  saveDecks();
  renderCurrentCard();
  alert('SRS intervals reset for current deck.');
}

// =============================================================================
// 8. GPA & GRADE TRAJECTORY CALCULATOR
// =============================================================================

function initGpaCalculator() {
  renderGpaCourseTable();
  calculateGpa();
  calculateFinalTarget();
}

function renderGpaCourseTable() {
  const tbody = document.getElementById('gpaCourseTableBody');
  if (!tbody) return;

  tbody.innerHTML = '';
  state.gpa.courses.forEach((course, index) => {
    const tr = document.createElement('tr');
    tr.className = "hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition";
    tr.innerHTML = `
      <td class="py-2 pr-2">
        <input type="text" value="${course.name}" onchange="updateCourseField(${index}, 'name', this.value)" class="w-full px-2 py-1 text-xs rounded bg-transparent border-b border-slate-200 dark:border-slate-700 focus:border-brand-500 outline-none" />
      </td>
      <td class="py-2 pr-2">
        <input type="number" step="0.5" min="0.5" max="10" value="${course.credits}" oninput="updateCourseField(${index}, 'credits', this.value)" class="w-full px-2 py-1 text-xs rounded bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 outline-none" />
      </td>
      <td class="py-2 pr-2">
        <select onchange="updateCourseField(${index}, 'grade', this.value)" class="w-full px-2 py-1 text-xs rounded bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 outline-none">
          ${Object.keys(GRADE_POINTS).map(g => `<option value="${g}" ${g === course.grade ? 'selected' : ''}>${g} (${GRADE_POINTS[g].toFixed(1)})</option>`).join('')}
        </select>
      </td>
      <td class="py-2 text-center">
        <button onclick="removeGpaCourseRow(${index})" class="text-slate-400 hover:text-rose-500 transition p-1">
          <i data-lucide="trash-2" class="w-3.5 h-3.5 inline"></i>
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
  lucide.createIcons();
}

function updateCourseField(index, field, value) {
  if (field === 'credits') {
    state.gpa.courses[index].credits = parseFloat(value) || 0;
  } else {
    state.gpa.courses[index][field] = value;
  }
  saveGpaData();
  calculateGpa();
}

function addGpaCourseRow() {
  state.gpa.courses.push({ name: `Course ${state.gpa.courses.length + 1}`, credits: 3, grade: "A" });
  saveGpaData();
  renderGpaCourseTable();
  calculateGpa();
}

function removeGpaCourseRow(index) {
  if (state.gpa.courses.length <= 1) return;
  state.gpa.courses.splice(index, 1);
  saveGpaData();
  renderGpaCourseTable();
  calculateGpa();
}

function calculateGpa() {
  const priorGpaInput = document.getElementById('priorGpaInput');
  const priorCreditsInput = document.getElementById('priorCreditsInput');
  
  const priorGpa = parseFloat(priorGpaInput.value) || 0;
  const priorCredits = parseFloat(priorCreditsInput.value) || 0;

  state.gpa.priorGpa = priorGpa;
  state.gpa.priorCredits = priorCredits;
  saveGpaData();

  let semesterQualityPoints = 0;
  let semesterCredits = 0;

  state.gpa.courses.forEach(c => {
    const credits = parseFloat(c.credits) || 0;
    const pts = GRADE_POINTS[c.grade] || 0;
    semesterQualityPoints += pts * credits;
    semesterCredits += credits;
  });

  const semesterGpa = semesterCredits > 0 ? (semesterQualityPoints / semesterCredits) : 0;
  const totalCredits = priorCredits + semesterCredits;
  const totalQualityPoints = (priorGpa * priorCredits) + semesterQualityPoints;
  const newCumulativeGpa = totalCredits > 0 ? (totalQualityPoints / totalCredits) : 0;

  // Render to live metric cards
  const semGpaEl = document.getElementById('resultSemesterGpa');
  const semCredEl = document.getElementById('resultSemesterCredits');
  const cumGpaEl = document.getElementById('resultNewCumGpa');
  const totCredEl = document.getElementById('resultTotalCredits');

  if (semGpaEl) semGpaEl.innerText = semesterGpa.toFixed(2);
  if (semCredEl) semCredEl.innerText = `${semesterCredits.toFixed(1)} Credits`;
  if (cumGpaEl) cumGpaEl.innerText = newCumulativeGpa.toFixed(2);
  if (totCredEl) totCredEl.innerText = `${totalCredits.toFixed(1)} Total Credits`;
}

function calculateFinalTarget() {
  const cur = parseFloat(document.getElementById('finalCalcCurrent').value) || 0;
  const des = parseFloat(document.getElementById('finalCalcDesired').value) || 0;
  const wt = parseFloat(document.getElementById('finalCalcWeight').value) || 0;

  const targetEl = document.getElementById('finalCalcRequired');
  if (!targetEl) return;

  if (wt <= 0) {
    targetEl.innerText = "Weight > 0%";
    return;
  }

  // Formula: Required = (Desired - (Current * (1 - Weight/100))) / (Weight/100)
  const currentWeight = 1 - (wt / 100);
  const needed = (des - (cur * currentWeight)) / (wt / 100);

  targetEl.innerText = `${needed.toFixed(1)}%`;
}

function saveGpaData() {
  localStorage.setItem(STORAGE_KEYS.GPA_DATA, JSON.stringify(state.gpa));
}

// =============================================================================
// 9. MODALS & DATA EXPORT / IMPORT
// =============================================================================

function openSupportModal() {
  const modal = document.getElementById('supportModal');
  if (modal) modal.classList.replace('hidden', 'flex');
  lucide.createIcons();
}

function closeSupportModal() {
  const modal = document.getElementById('supportModal');
  if (modal) modal.classList.replace('flex', 'hidden');
}

function openDataModal() {
  const modal = document.getElementById('dataModal');
  if (modal) modal.classList.replace('hidden', 'flex');
  lucide.createIcons();
}

function closeDataModal() {
  const modal = document.getElementById('dataModal');
  if (modal) modal.classList.replace('flex', 'hidden');
}

function exportAllDataJson() {
  const dump = {
    exportedAt: new Date().toISOString(),
    flashcards: state.flashcards.decks,
    pomoStats: state.pomo.stats,
    gpa: state.gpa
  };

  const blob = new Blob([JSON.stringify(dump, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `omnistudy_backup_${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function importDataJson(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      if (data.flashcards) {
        state.flashcards.decks = data.flashcards;
        saveDecks();
      }
      if (data.pomoStats) {
        state.pomo.stats = data.pomoStats;
        savePomoStats();
      }
      if (data.gpa) {
        state.gpa = data.gpa;
        saveGpaData();
      }
      alert('Data restored successfully!');
      location.reload();
    } catch (err) {
      alert('Invalid backup file.');
    }
  };
  reader.readAsText(file);
}

function clearAllUserData() {
  if (confirm("Are you sure you want to reset all data? This cannot be undone.")) {
    localStorage.clear();
    location.reload();
  }
}

// =============================================================================
// 10. PROGRESSIVE WEB APP (PWA) SERVICE WORKER SETUP
// =============================================================================

let deferredPrompt;

function initPWA() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(err => {
        console.log('SW registration skipped in preview:', err);
      });
    });
  }

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    const installBtn = document.getElementById('pwaInstallBtn');
    if (installBtn) {
      installBtn.classList.remove('hidden');
      installBtn.addEventListener('click', () => {
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then(() => {
          deferredPrompt = null;
          installBtn.classList.add('hidden');
        });
      });
    }
  });
}
