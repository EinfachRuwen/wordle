/* ================================================================
   WORDLE – CUSTOM WORD  |  app.js
   ================================================================ */

/* ----------------------------------------------------------------
   STATE
   ---------------------------------------------------------------- */
const S = {
  word:       '',     // Target word (uppercase)
  wordLength: 0,
  maxGuesses: 6,
  currentRow: 0,
  currentCol: 0,
  board:      [],     // board[row][col] = { letter, status }
  letterMap:  {},     // letter -> 'correct' | 'present' | 'absent'
  gameOver:   false,
  won:        false,
  mode:       null,   // 'pass' | 'link'
  animating:  false,
};

/* ----------------------------------------------------------------
   CRYPTO  (AES-GCM via Web Crypto API)
   Key lives ONLY in the URL fragment (#) – never sent to server.
   ---------------------------------------------------------------- */

/** Uint8Array → URL-safe Base64 (no padding) */
const toB64 = a =>
  btoa(String.fromCharCode(...a))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

/** URL-safe Base64 → Uint8Array */
const fromB64 = s => {
  const padded = s.replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(padded), c => c.charCodeAt(0));
};

async function encryptWord(word) {
  const key = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']
  );
  const iv  = crypto.getRandomValues(new Uint8Array(12));
  const ct  = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv }, key,
    new TextEncoder().encode(word)
  );
  const raw = await crypto.subtle.exportKey('raw', key);
  return {
    data: toB64(new Uint8Array(ct)),
    iv:   toB64(iv),
    key:  toB64(new Uint8Array(raw)),
  };
}

async function decryptWord(data, iv, key) {
  try {
    const k   = await crypto.subtle.importKey(
      'raw', fromB64(key), { name: 'AES-GCM' }, false, ['decrypt']
    );
    const pt  = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fromB64(iv) }, k, fromB64(data)
    );
    return new TextDecoder().decode(pt);
  } catch { return null; }
}

async function buildShareURL(word) {
  const { data, iv, key } = await encryptWord(word);
  return `${location.origin}${location.pathname}?g=${data}&iv=${iv}#${key}`;
}

async function getWordFromURL() {
  const p    = new URLSearchParams(location.search);
  const frag = location.hash.slice(1);
  if (!p.has('g') || !p.has('iv') || !frag) return null;
  return decryptWord(p.get('g'), p.get('iv'), frag);
}

/* ----------------------------------------------------------------
   BOARD INIT
   ---------------------------------------------------------------- */
function initBoard() {
  S.board = Array.from({ length: S.maxGuesses }, () =>
    Array.from({ length: S.wordLength }, () => ({ letter: '', status: '' }))
  );
  S.letterMap  = {};
  S.currentRow = 0;
  S.currentCol = 0;
  S.gameOver   = false;
  S.won        = false;
  S.animating  = false;
}

/* ----------------------------------------------------------------
   GUESS LOGIC
   ---------------------------------------------------------------- */
function checkGuess(guess) {
  const result = Array(guess.length).fill('absent');
  const t = [...S.word];
  const g = [...guess];

  // Pass 1 – correct positions
  for (let i = 0; i < g.length; i++) {
    if (g[i] === t[i]) {
      result[i] = 'correct';
      t[i] = null;
      g[i] = null;
    }
  }
  // Pass 2 – present (wrong position)
  for (let i = 0; i < g.length; i++) {
    if (g[i] === null) continue;
    const j = t.indexOf(g[i]);
    if (j !== -1) { result[i] = 'present'; t[j] = null; }
  }
  return result;
}

function updateLetterMap(letters, results) {
  const prio = { correct: 3, present: 2, absent: 1 };
  letters.forEach((l, i) => {
    const cur = S.letterMap[l];
    if (!cur || prio[results[i]] > prio[cur]) S.letterMap[l] = results[i];
  });
}

/* ----------------------------------------------------------------
   KEY HANDLING
   ---------------------------------------------------------------- */
function handleKey(k) {
  if (S.gameOver || S.animating) return;
  if (k === 'ENTER' || k === '↵')          submitGuess();
  else if (k === 'BACKSPACE' || k === '⌫') deleteLetter();
  else if (/^[A-ZÄÖÜ]$/.test(k))           addLetter(k);
}

function getTile(row, col) {
  return document.querySelector(
    `#grid .row:nth-child(${row + 1}) .tile:nth-child(${col + 1})`
  );
}

function addLetter(letter) {
  if (S.currentCol >= S.wordLength) return;
  S.board[S.currentRow][S.currentCol].letter = letter;
  const tile = getTile(S.currentRow, S.currentCol);
  tile.textContent = letter;
  tile.classList.add('filled');
  // Pop animation (remove-reflow-add trick)
  tile.classList.remove('pop');
  tile.offsetWidth; // force reflow
  tile.classList.add('pop');
  tile.addEventListener('animationend', () => tile.classList.remove('pop'), { once: true });
  S.currentCol++;
}

function deleteLetter() {
  if (S.currentCol <= 0) return;
  S.currentCol--;
  S.board[S.currentRow][S.currentCol].letter = '';
  const tile = getTile(S.currentRow, S.currentCol);
  tile.textContent = '';
  tile.classList.remove('filled', 'pop');
}

async function submitGuess() {
  if (S.currentCol < S.wordLength) {
    shakeRow(S.currentRow);
    showToast('Noch nicht genug Buchstaben!');
    return;
  }

  const guess   = S.board[S.currentRow].map(c => c.letter);
  const results = checkGuess(guess);
  updateLetterMap(guess, results);

  S.animating = true;
  await flipRow(S.currentRow, results);
  S.animating = false;

  updateKeyboard();

  const won = results.every(r => r === 'correct');
  if (won) {
    S.won      = true;
    S.gameOver = true;
    await bounceRow(S.currentRow);
    setTimeout(() => showView('result'), 350);
    return;
  }

  S.currentRow++;
  S.currentCol = 0;

  if (S.currentRow >= S.maxGuesses) {
    S.gameOver = true;
    showToast(`Das Wort war: ${S.word}`, 3500);
    setTimeout(() => showView('result'), 1800);
  }
}

/* ----------------------------------------------------------------
   ANIMATIONS
   ---------------------------------------------------------------- */
function shakeRow(row) {
  const rowEl = document.querySelector(`#grid .row:nth-child(${row + 1})`);
  rowEl.classList.remove('shake');
  rowEl.offsetWidth;
  rowEl.classList.add('shake');
  rowEl.addEventListener('animationend', () => rowEl.classList.remove('shake'), { once: true });
}

function flipTile(tile, status) {
  return new Promise(resolve => {
    tile.classList.add('flip-out');
    setTimeout(() => {
      tile.classList.remove('flip-out');
      tile.dataset.status = status;
      tile.classList.add('flip-in');
      setTimeout(() => {
        tile.classList.remove('flip-in');
        resolve();
      }, 220);
    }, 220);
  });
}

async function flipRow(row, results) {
  const tiles = [
    ...document.querySelectorAll(`#grid .row:nth-child(${row + 1}) .tile`)
  ];
  // Staggered flips – start each 100 ms after the previous
  await Promise.all(
    tiles.map((tile, i) =>
      new Promise(resolve =>
        setTimeout(async () => {
          await flipTile(tile, results[i]);
          S.board[row][i].status = results[i];
          resolve();
        }, i * 100)
      )
    )
  );
}

async function bounceRow(row) {
  const tiles = [
    ...document.querySelectorAll(`#grid .row:nth-child(${row + 1}) .tile`)
  ];
  tiles.forEach((tile, i) =>
    setTimeout(() => {
      tile.classList.add('bounce');
      tile.addEventListener('animationend', () => tile.classList.remove('bounce'), { once: true });
    }, i * 70)
  );
  await new Promise(r => setTimeout(r, tiles.length * 70 + 520));
}

/* ----------------------------------------------------------------
   GRID RENDERING
   ---------------------------------------------------------------- */
function computeTileSize() {
  const gridW = Math.min(window.innerWidth * 0.92, 440);
  const gap   = 5;
  const size  = Math.min(70, Math.floor((gridW - (S.wordLength - 1) * gap) / S.wordLength));
  document.documentElement.style.setProperty('--tile-size', `${size}px`);
}

function renderGrid() {
  computeTileSize();
  const grid = document.getElementById('grid');
  grid.innerHTML = '';

  for (let r = 0; r < S.maxGuesses; r++) {
    const row = document.createElement('div');
    row.className = 'row';
    row.setAttribute('role', 'row');
    for (let c = 0; c < S.wordLength; c++) {
      const tile = document.createElement('div');
      tile.className = 'tile';
      tile.setAttribute('role', 'gridcell');
      tile.setAttribute('aria-label', `Zeile ${r + 1}, Spalte ${c + 1}`);
      row.appendChild(tile);
    }
    grid.appendChild(row);
  }
}

/* ----------------------------------------------------------------
   KEYBOARD RENDERING
   ---------------------------------------------------------------- */
const KB_ROWS = [
  ['Q','W','E','R','T','Z','U','I','O','P','Ü'],
  ['A','S','D','F','G','H','J','K','L','Ö','Ä'],
  ['⌫','Y','X','C','V','B','N','M','↵'],
];

function renderKeyboard() {
  const kb = document.getElementById('keyboard');
  kb.innerHTML = '';

  KB_ROWS.forEach(keys => {
    const row = document.createElement('div');
    row.className = 'kb-row';
    keys.forEach(k => {
      const btn = document.createElement('button');
      btn.className = 'kb-key' + (k === '⌫' || k === '↵' ? ' wide' : '');
      btn.textContent = k;
      btn.dataset.key = k;
      btn.setAttribute('aria-label', k === '⌫' ? 'Löschen' : k === '↵' ? 'Eingabe bestätigen' : k);
      btn.addEventListener('click', () => handleKey(k));
      row.appendChild(btn);
    });
    kb.appendChild(row);
  });
}

function updateKeyboard() {
  document.querySelectorAll('.kb-key').forEach(btn => {
    const s = S.letterMap[btn.dataset.key];
    if (s) btn.dataset.status = s;
  });
}

/* ----------------------------------------------------------------
   TOAST
   ---------------------------------------------------------------- */
let toastTimer;
function showToast(msg, ms = 2500) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), ms);
}

/* ----------------------------------------------------------------
   VIEW MANAGEMENT
   ---------------------------------------------------------------- */
function showView(name) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById(`view-${name}`).classList.add('active');
  if (name === 'result') buildResult();
}

/* ----------------------------------------------------------------
   RESULT SCREEN
   ---------------------------------------------------------------- */
const WIN_MSGS = [
  '🤯 Unglaublich!',
  '🎉 Fantastisch!',
  '🌟 Sehr gut!',
  '👏 Gut gemacht!',
  '😊 Gut!',
  '😅 Puh, gerade noch!',
];

function buildResult() {
  const won = S.won;
  document.getElementById('result-icon').textContent = won ? '🎉' : '😔';
  document.getElementById('result-msg').textContent  = won
    ? WIN_MSGS[Math.min(S.currentRow, WIN_MSGS.length - 1)]
    : 'Leider nicht geschafft!';
  document.getElementById('result-word').textContent = S.word;
  document.getElementById('result-tries').textContent = won
    ? `In ${S.currentRow + 1} von ${S.maxGuesses} Versuchen` : '';

  // Emoji grid
  const EM = { correct: '🟩', present: '🟨', absent: '⬛' };
  const rows = [];
  for (let r = 0; r < S.maxGuesses; r++) {
    if (!S.board[r][0].letter) break;
    rows.push(S.board[r].map(c => EM[c.status] || '⬛').join(''));
  }
  document.getElementById('result-emoji').textContent = rows.join('\n');

  if (won) spawnConfetti();
}

/* ----------------------------------------------------------------
   CONFETTI
   ---------------------------------------------------------------- */
function spawnConfetti(count = 110) {
  const el     = document.getElementById('confetti');
  el.innerHTML = '';
  const colors = ['#4ade80','#fbbf24','#a78bfa','#f472b6','#38bdf8','#fb923c','#e879f9'];

  for (let i = 0; i < count; i++) {
    const p    = document.createElement('div');
    const size = 6 + Math.random() * 9;
    p.className = 'confetti-piece';
    p.style.cssText = [
      `left:${Math.random() * 100}%`,
      `background:${colors[Math.floor(Math.random() * colors.length)]}`,
      `width:${size}px`,
      `height:${size}px`,
      `border-radius:${Math.random() > 0.5 ? '50%' : '3px'}`,
      `animation-duration:${2.4 + Math.random() * 2}s`,
      `animation-delay:${Math.random() * 0.9}s`,
    ].join(';');
    el.appendChild(p);
  }
  setTimeout(() => { el.innerHTML = ''; }, 5500);
}

/* ----------------------------------------------------------------
   HOME SETUP
   ---------------------------------------------------------------- */
function setupHome() {
  const input   = document.getElementById('word-input');
  const count   = document.getElementById('char-count');
  const btnPass = document.getElementById('btn-pass');
  const btnLink = document.getElementById('btn-link');
  const linkBox = document.getElementById('link-box');
  const linkUrl = document.getElementById('link-url');
  const btnCopy = document.getElementById('btn-copy-link');

  function validate() {
    const len = input.value.length;
    count.textContent    = `${len}/10`;
    const ok             = len >= 2;
    btnPass.disabled     = !ok;
    btnLink.disabled     = !ok;
    if (!ok) linkBox.classList.add('hidden');
  }

  // Filter to letters + umlauts only, uppercase
  input.addEventListener('input', () => {
    input.value = input.value
      .replace(/[^a-zA-ZäöüÄÖÜ]/g, '')
      .slice(0, 10)
      .toUpperCase();
    validate();
  });

  // Enter key → same device mode
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !btnPass.disabled) btnPass.click();
  });

  // ---- Same device ----
  btnPass.addEventListener('click', () => {
    const w = input.value;
    if (w.length < 2) return;
    S.word       = w;
    S.wordLength = w.length;
    S.mode       = 'pass';
    input.value  = '';
    count.textContent = '0/10';
    linkBox.classList.add('hidden');
    btnPass.disabled = true;
    btnLink.disabled = true;
    showView('pass');
  });

  // ---- Create link ----
  btnLink.addEventListener('click', async () => {
    const w = input.value;
    if (w.length < 2) return;

    // Loading state
    const origHTML    = btnLink.innerHTML;
    btnLink.disabled  = true;
    btnLink.innerHTML =
      '<span class="mc-icon">⏳</span>' +
      '<span class="mc-title">Verschlüssle…</span>' +
      '<span class="mc-desc">&nbsp;</span>';

    const url = await buildShareURL(w);

    btnLink.innerHTML = origHTML;
    btnLink.disabled  = input.value.length < 2;

    linkUrl.value = url;
    linkBox.classList.remove('hidden');
  });

  // ---- Copy link ----
  btnCopy.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(linkUrl.value);
      const orig = btnCopy.textContent;
      btnCopy.textContent     = '✓ Kopiert!';
      btnCopy.style.background = 'var(--green-bg)';
      btnCopy.style.color      = 'var(--green)';
      setTimeout(() => {
        btnCopy.textContent     = orig;
        btnCopy.style.background = '';
        btnCopy.style.color      = '';
      }, 2500);
    } catch {
      linkUrl.select();
      showToast('Bitte manuell kopieren (Strg+C)');
    }
  });

  linkUrl.addEventListener('click', () => linkUrl.select());
}

/* ----------------------------------------------------------------
   PASS SCREEN SETUP
   ---------------------------------------------------------------- */
function setupPass() {
  document.getElementById('btn-ready').addEventListener('click', () => {
    initBoard();
    renderGrid();
    renderKeyboard();
    showView('game');
  });
}

/* ----------------------------------------------------------------
   GAME SETUP
   ---------------------------------------------------------------- */
function setupGame() {
  document.getElementById('btn-back').addEventListener('click', () => {
    if (!S.gameOver && !confirm('Spiel wirklich abbrechen?')) return;
    if (S.mode === 'link') history.replaceState(null, '', location.pathname);
    S.word  = '';
    S.mode  = null;
    showView('home');
  });

  window.addEventListener('resize', () => {
    if (S.wordLength) computeTileSize();
  });
}

/* ----------------------------------------------------------------
   RESULT SETUP
   ---------------------------------------------------------------- */
function setupResult() {
  document.getElementById('btn-share').addEventListener('click', async () => {
    const emoji = document.getElementById('result-emoji').textContent;
    const score = S.won ? `${S.currentRow + 1}/${S.maxGuesses}` : 'X/6';
    const text  = `Wordle Custom ${score}\n\n${emoji}\n\n${location.origin}${location.pathname}`;
    try {
      await navigator.clipboard.writeText(text);
      showToast('Ergebnis kopiert! 📋');
    } catch {
      showToast('Kopieren nicht möglich');
    }
  });

  document.getElementById('btn-new-game').addEventListener('click', () => {
    if (S.mode === 'link') history.replaceState(null, '', location.pathname);
    S.word = '';
    S.mode = null;
    document.getElementById('confetti').innerHTML = '';
    showView('home');
  });
}

/* ----------------------------------------------------------------
   PHYSICAL KEYBOARD
   ---------------------------------------------------------------- */
document.addEventListener('keydown', e => {
  // Only active in game view
  if (!document.getElementById('view-game').classList.contains('active')) return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;

  if      (e.key === 'Backspace') handleKey('BACKSPACE');
  else if (e.key === 'Enter')     handleKey('ENTER');
  else if (e.key.length === 1)    handleKey(e.key.toUpperCase());
});

/* ----------------------------------------------------------------
   INIT  –  Bootstrap the app on page load
   ---------------------------------------------------------------- */
async function init() {
  setupHome();
  setupPass();
  setupGame();
  setupResult();

  // Check if URL contains an encrypted word
  const word = await getWordFromURL();

  if (word && /^[A-ZÄÖÜ]{2,10}$/.test(word)) {
    // Valid encrypted game link
    S.word       = word;
    S.wordLength = word.length;
    S.mode       = 'link';
    initBoard();
    renderGrid();
    renderKeyboard();
    // Remove the key from the URL fragment (security: key never stays visible)
    history.replaceState(null, '', location.pathname + location.search);
    showView('game');
  } else {
    // Clean up invalid params from URL
    if (location.search || location.hash) {
      history.replaceState(null, '', location.pathname);
      showToast('⚠️ Ungültiger oder abgelaufener Link!', 4000);
    }
    showView('home');
  }
}

init();
