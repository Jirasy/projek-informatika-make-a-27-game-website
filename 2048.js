// ======== CONFIG & SDK ========
const defaultConfig = {
  game_title: '2048 Unlimited',
  subtitle_text: 'Join the tiles, get to infinity!',
  background_color: '#0f0f1a',
  surface_color: '#1a1a2e',
  text_color: '#ffffff',
  primary_action_color: '#8b5cf6',
  secondary_action_color: '#6366f1',
  font_family: 'Outfit',
  font_size: 16
};

function applyConfig(cfg) {
  const t = document.getElementById('titleText');
  const s = document.getElementById('subtitleText');
  if (t) t.textContent = cfg.game_title || defaultConfig.game_title;
  if (s) s.textContent = cfg.subtitle_text || defaultConfig.subtitle_text;

  const ff = cfg.font_family || defaultConfig.font_family;
  document.body.style.fontFamily = `${ff}, Outfit, sans-serif`;

  document.documentElement.style.setProperty('--bg', cfg.background_color || defaultConfig.background_color);
  document.documentElement.style.setProperty('--primary', cfg.primary_action_color || defaultConfig.primary_action_color);
}

if (window.elementSdk) {
  window.elementSdk.init({
    defaultConfig,
    onConfigChange: async (cfg) => applyConfig(cfg),
    mapToCapabilities: (cfg) => ({
      recolorables: [
        { get: () => cfg.background_color || defaultConfig.background_color, set: (v) => { cfg.background_color = v; window.elementSdk.setConfig({ background_color: v }); } },
        { get: () => cfg.surface_color || defaultConfig.surface_color, set: (v) => { cfg.surface_color = v; window.elementSdk.setConfig({ surface_color: v }); } },
        { get: () => cfg.text_color || defaultConfig.text_color, set: (v) => { cfg.text_color = v; window.elementSdk.setConfig({ text_color: v }); } },
        { get: () => cfg.primary_action_color || defaultConfig.primary_action_color, set: (v) => { cfg.primary_action_color = v; window.elementSdk.setConfig({ primary_action_color: v }); } },
        { get: () => cfg.secondary_action_color || defaultConfig.secondary_action_color, set: (v) => { cfg.secondary_action_color = v; window.elementSdk.setConfig({ secondary_action_color: v }); } }
      ],
      borderables: [],
      fontEditable: {
        get: () => cfg.font_family || defaultConfig.font_family,
        set: (v) => { cfg.font_family = v; window.elementSdk.setConfig({ font_family: v }); }
      },
      fontSizeable: {
        get: () => cfg.font_size || defaultConfig.font_size,
        set: (v) => { cfg.font_size = v; window.elementSdk.setConfig({ font_size: v }); }
      }
    }),
    mapToEditPanelValues: (cfg) => new Map([
      ['game_title', cfg.game_title || defaultConfig.game_title],
      ['subtitle_text', cfg.subtitle_text || defaultConfig.subtitle_text]
    ])
  });
}

// ======== STARS BACKGROUND ========
(function createStars() {
  const c = document.getElementById('stars');
  for (let i = 0; i < 60; i++) {
    const s = document.createElement('div');
    s.className = 'star';
    s.style.left = Math.random() * 100 + '%';
    s.style.top = Math.random() * 100 + '%';
    s.style.animationDelay = Math.random() * 3 + 's';
    s.style.width = s.style.height = (Math.random() * 2 + 1) + 'px';
    c.appendChild(s);
  }
})();

// ======== GAME STATE ========
let gridSize = 4;
let board = [];
let score = 0;
let bestScore = 0;
let prevState = null;
let options = { undo: true, darkTiles: false, sound: false };
let gameActive = false;
let tileIdCounter = 0;
let tileElements = {};

// ======== TILE COLORS ========
function getTileColor(val) {
  if (options.darkTiles) {
    const hue = (Math.log2(val) * 35) % 360;
    return { bg: `hsl(${hue}, 50%, 18%)`, text: `hsl(${hue}, 80%, 75%)` };
  }
  const colors = {
    2: { bg: '#6366f1', text: '#fff' },
    4: { bg: '#8b5cf6', text: '#fff' },
    8: { bg: '#a78bfa', text: '#fff' },
    16: { bg: '#c084fc', text: '#fff' },
    32: { bg: '#e879f9', text: '#fff' },
    64: { bg: '#f472b6', text: '#fff' },
    128: { bg: '#fb923c', text: '#fff' },
    256: { bg: '#fbbf24', text: '#1a1a2e' },
    512: { bg: '#a3e635', text: '#1a1a2e' },
    1024: { bg: '#34d399', text: '#1a1a2e' },
    2048: { bg: '#22d3ee', text: '#1a1a2e' },
  };
  if (colors[val]) return colors[val];
  const hue = (Math.log2(val) * 30) % 360;
  const light = val > 256 ? '65%' : '55%';
  return { bg: `hsl(${hue}, 75%, ${light})`, text: val > 256 ? '#1a1a2e' : '#fff' };
}

function formatNumber(n) {
  if (n >= 1e12) return (n / 1e12).toFixed(1) + 'T';
  if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e4) return (n / 1e4).toFixed(1) + 'K';
  return n.toString();
}

// ======== MENU ========
function selectSize(size) {
  gridSize = size;
  document.querySelectorAll('.size-option').forEach(el => {
    el.classList.toggle('selected', parseInt(el.dataset.size) === size);
  });
}

function toggleOption(key) {
  options[key] = !options[key];
  const el = document.getElementById(key === 'undo' ? 'toggleUndo' : key === 'darkTiles' ? 'toggleDarkTiles' : 'toggleSound');
  el.classList.toggle('active', options[key]);
}

// ======== BOARD RENDERING ========
function calcBoardSize() {
  const screenW = window.innerWidth;
  const screenH = window.innerHeight;
  const maxW = Math.min(screenW - 24, 500);
  const maxH = screenH - 160;
  return Math.min(maxW, maxH, 500);
}

function buildBoard() {
  const bSize = calcBoardSize();
  const gap = Math.max(4, Math.round(bSize * 0.02));
  const pad = gap;
  const cellSize = (bSize - pad * 2 - gap * (gridSize - 1)) / gridSize;

  const wrapper = document.getElementById('boardWrapper');
  wrapper.style.width = bSize + 'px';
  wrapper.style.height = bSize + 'px';
  wrapper.style.padding = pad + 'px';

  const grid = document.getElementById('boardGrid');
  grid.innerHTML = '';
  grid.style.display = 'grid';
  grid.style.gridTemplateColumns = `repeat(${gridSize}, ${cellSize}px)`;
  grid.style.gridTemplateRows = `repeat(${gridSize}, ${cellSize}px)`;
  grid.style.gap = gap + 'px';

  for (let i = 0; i < gridSize * gridSize; i++) {
    const cell = document.createElement('div');
    cell.className = 'grid-cell';
    cell.style.width = cellSize + 'px';
    cell.style.height = cellSize + 'px';
    grid.appendChild(cell);
  }

  return { cellSize, gap, pad };
}

function renderTiles(animateNew, mergedPositions) {
  const bSize = calcBoardSize();
  const gap = Math.max(4, Math.round(bSize * 0.02));
  const pad = gap;
  const cellSize = (bSize - pad * 2 - gap * (gridSize - 1)) / gridSize;
  const layer = document.getElementById('tileLayer');

  const activeIds = new Set();

  for (let r = 0; r < gridSize; r++) {
    for (let c = 0; c < gridSize; c++) {
      const cell = board[r][c];
      if (!cell) continue;

      activeIds.add(cell.id);
      const x = pad + c * (cellSize + gap);
      const y = pad + r * (cellSize + gap);
      const colors = getTileColor(cell.value);

      let fontSize;
      const digits = cell.value.toString().length;
      if (digits <= 2) fontSize = cellSize * 0.4;
      else if (digits <= 3) fontSize = cellSize * 0.32;
      else if (digits <= 4) fontSize = cellSize * 0.26;
      else fontSize = cellSize * 0.2;

      let el = tileElements[cell.id];
      if (!el) {
        el = document.createElement('div');
        el.className = 'tile' + (animateNew ? ' tile-new' : '');
        layer.appendChild(el);
        tileElements[cell.id] = el;
      } else {
        el.classList.remove('tile-new', 'tile-merged');
        if (mergedPositions && mergedPositions.has(`${r},${c}`)) {
          void el.offsetWidth;
          el.classList.add('tile-merged');
        }
      }

      el.style.width = cellSize + 'px';
      el.style.height = cellSize + 'px';
      el.style.left = x + 'px';
      el.style.top = y + 'px';
      el.style.background = colors.bg;
      el.style.color = colors.text;
      el.style.fontSize = fontSize + 'px';
      el.textContent = formatNumber(cell.value);
    }
  }

  // Remove dead tiles
  Object.keys(tileElements).forEach(id => {
    if (!activeIds.has(parseInt(id))) {
      tileElements[id].remove();
      delete tileElements[id];
    }
  });
}

function updateScoreDisplay() {
  const el = document.getElementById('scoreDisplay');
  el.textContent = formatNumber(score);
  el.classList.remove('score-pulse');
  void el.offsetWidth;
  el.classList.add('score-pulse');

  if (score > bestScore) {
    bestScore = score;
    document.getElementById('bestDisplay').textContent = formatNumber(bestScore);
  }

  let highest = 0;
  for (let r = 0; r < gridSize; r++)
    for (let c = 0; c < gridSize; c++)
      if (board[r][c]) highest = Math.max(highest, board[r][c].value);
  document.getElementById('highestTileLabel').textContent = `Highest: ${formatNumber(highest)}`;
}

// ======== GAME LOGIC ========
function initBoard() {
  board = Array.from({ length: gridSize }, () => Array(gridSize).fill(null));
  score = 0;
  prevState = null;
  tileIdCounter = 0;
  tileElements = {};
  document.getElementById('tileLayer').innerHTML = '';
  document.getElementById('undoBtn').disabled = true;
  addRandomTile();
  addRandomTile();
}

function addRandomTile() {
  const empty = [];
  for (let r = 0; r < gridSize; r++)
    for (let c = 0; c < gridSize; c++)
      if (!board[r][c]) empty.push({ r, c });
  if (!empty.length) return false;
  const pos = empty[Math.floor(Math.random() * empty.length)];
  board[pos.r][pos.c] = { value: Math.random() < 0.9 ? 2 : 4, id: ++tileIdCounter };
  return true;
}

function cloneBoard() {
  return board.map(row => row.map(cell => cell ? { ...cell } : null));
}

function saveState() {
  if (!options.undo) return;
  prevState = { board: cloneBoard(), score };
  document.getElementById('undoBtn').disabled = false;
}

function undoMove() {
  if (!prevState || !options.undo) return;
  board = prevState.board;
  score = prevState.score;
  prevState = null;
  document.getElementById('undoBtn').disabled = true;
  tileElements = {};
  document.getElementById('tileLayer').innerHTML = '';
  renderTiles(false);
  updateScoreDisplay();
}

function slide(row) {
  let arr = row.filter(c => c !== null);
  const merged = [];
  for (let i = 0; i < arr.length - 1; i++) {
    if (arr[i].value === arr[i + 1].value) {
      const newVal = arr[i].value * 2;
      arr[i] = { value: newVal, id: ++tileIdCounter };
      score += newVal;
      arr.splice(i + 1, 1);
      merged.push(i);
    }
  }
  while (arr.length < gridSize) arr.push(null);
  return { result: arr, merged };
}

function move(dir) {
  if (!gameActive) return;
  saveState();
  let moved = false;
  const mergedPositions = new Set();

  if (dir === 'left' || dir === 'right') {
    for (let r = 0; r < gridSize; r++) {
      let row = [...board[r]];
      if (dir === 'right') row.reverse();
      const { result, merged } = slide(row);
      if (dir === 'right') {
        result.reverse();
        merged.forEach(i => mergedPositions.add(`${r},${gridSize - 1 - i}`));
      } else {
        merged.forEach(i => mergedPositions.add(`${r},${i}`));
      }
      for (let c = 0; c < gridSize; c++) {
        if (board[r][c]?.id !== result[c]?.id || board[r][c]?.value !== result[c]?.value) moved = true;
        board[r][c] = result[c];
      }
    }
  } else {
    for (let c = 0; c < gridSize; c++) {
      let col = [];
      for (let r = 0; r < gridSize; r++) col.push(board[r][c]);
      if (dir === 'down') col.reverse();
      const { result, merged } = slide(col);
      if (dir === 'down') {
        result.reverse();
        merged.forEach(i => mergedPositions.add(`${gridSize - 1 - i},${c}`));
      } else {
        merged.forEach(i => mergedPositions.add(`${i},${c}`));
      }
      for (let r = 0; r < gridSize; r++) {
        if (board[r][c]?.id !== result[r]?.id || board[r][c]?.value !== result[r]?.value) moved = true;
        board[r][c] = result[r];
      }
    }
  }

  if (moved) {
    addRandomTile();
    renderTiles(true, mergedPositions);
    updateScoreDisplay();
    if (isGameOver()) {
      gameActive = false;
      setTimeout(showGameOver, 400);
    }
  } else {
    prevState = null;
    if (!options.undo) document.getElementById('undoBtn').disabled = true;
  }
}

function isGameOver() {
  for (let r = 0; r < gridSize; r++)
    for (let c = 0; c < gridSize; c++) {
      if (!board[r][c]) return false;
      const v = board[r][c].value;
      if (c < gridSize - 1 && board[r][c + 1]?.value === v) return false;
      if (r < gridSize - 1 && board[r + 1]?.[c]?.value === v) return false;
    }
  return true;
}

function showGameOver() {
  document.getElementById('finalScore').textContent = formatNumber(score);
  const overlay = document.getElementById('gameOverOverlay');
  overlay.classList.remove('hidden');
  overlay.style.display = 'flex';
  lucide.createIcons();
}

// ======== SCREENS ========
function startGame() {
  document.getElementById('menuScreen').style.display = 'none';
  const gs = document.getElementById('gameScreen');
  gs.classList.remove('hidden');
  gs.style.display = 'flex';
  buildBoard();
  initBoard();
  renderTiles(true);
  updateScoreDisplay();
  gameActive = true;
  lucide.createIcons();
}

function restartGame() {
  const overlay = document.getElementById('gameOverOverlay');
  overlay.classList.add('hidden');
  overlay.style.display = 'none';
  tileElements = {};
  document.getElementById('tileLayer').innerHTML = '';
  buildBoard();
  initBoard();
  renderTiles(true);
  updateScoreDisplay();
  gameActive = true;
}

function backToMenu() {
  const overlay = document.getElementById('gameOverOverlay');
  overlay.classList.add('hidden');
  overlay.style.display = 'none';
  document.getElementById('gameScreen').style.display = 'none';
  document.getElementById('menuScreen').style.display = 'flex';
  gameActive = false;
  lucide.createIcons();
}

// ======== INPUT HANDLING ========
document.addEventListener('keydown', e => {
  const map = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' };
  if (map[e.key]) { e.preventDefault(); move(map[e.key]); }
});

// Touch / pointer
let touchStartX = 0, touchStartY = 0, touching = false;
const wrapper = document.getElementById('boardWrapper');

wrapper.addEventListener('pointerdown', e => {
  touchStartX = e.clientX; touchStartY = e.clientY; touching = true;
  e.preventDefault();
});
wrapper.addEventListener('pointermove', e => { if (touching) e.preventDefault(); });
wrapper.addEventListener('pointerup', e => {
  if (!touching) return;
  touching = false;
  const dx = e.clientX - touchStartX;
  const dy = e.clientY - touchStartY;
  const min = 20;
  if (Math.abs(dx) < min && Math.abs(dy) < min) return;
  if (Math.abs(dx) > Math.abs(dy)) move(dx > 0 ? 'right' : 'left');
  else move(dy > 0 ? 'down' : 'up');
});
wrapper.addEventListener('pointercancel', () => { touching = false; });

// Resize
window.addEventListener('resize', () => {
  if (!gameActive) return;
  buildBoard();
  tileElements = {};
  document.getElementById('tileLayer').innerHTML = '';
  renderTiles(false);
});

// Init icons
lucide.createIcons();
applyConfig(defaultConfig);
