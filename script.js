const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

const sidebar = $("#sidebar");
const searchInput = $("#search-input");
const dialog = $("#game-dialog");
const settingsDialog = $("#settings-dialog");
const canvas = $("#game-canvas");
const ctx = canvas.getContext("2d");
const overlay = $("#game-overlay");
const startButton = $("#start-game");
const pauseButton = $("#pause-button");
const scoreDisplay = $("#score-display");
const particleLayer = $("#particle-layer");

$("#year").textContent = new Date().getFullYear();

const defaults = { theme: "light", sound: true, music: true, vfx: true, reduceMotion: false };
let prefs = { ...defaults };
try { prefs = { ...defaults, ...JSON.parse(localStorage.getItem("capyPrefs") || "{}") }; } catch {}
let favorites = new Set();
try { favorites = new Set(JSON.parse(localStorage.getItem("capyFavorites") || "[]")); } catch {}
let currentView = "All";
let currentGame = "";
let isRunning = false;
let isPaused = false;
let animationId = 0;
let previousTime = 0;
let score = 0;
let bestScores = { "Capy Pong": 0, "Mud Bricks": 0, "Capy Blaster": 0, "Bee Swarm": 0, "Pond Snake": 0, "Capy Hop": 0, "Neon Dodge": 0, "Cube Canyon": 0, "Pocket Garden": 0, "Snack Catch": 0 };
try { bestScores = { ...bestScores, ...JSON.parse(localStorage.getItem("capyBest") || "{}") }; } catch {}
let audioContext = null;
let toastTimer = null;
let user = null, stageBest = {};
const keys = new Set();

const GAME_INFO = {
  "Capy Hop": { description: "Jump between platforms, collect golden coins, and reach the flag.", controls: "Move: A / D or ← / →    Jump: W / ↑ / Space" },
  "Neon Dodge": { description: "Avoid the falling blocks and survive for as long as you can.", controls: "Move: A / D only" },
  "Pocket Garden": { description: "Match the garden pairs in 3 stages. Fewer mistakes, cozier vibes.", controls: "Click or tap cards to flip them. P pauses." },
  "Snack Catch": { description: "Catch fruit, dodge rocks, and keep all 3 hearts. Speeds up every 8 fruit.", controls: "Move: A / D only" },
  "Capy Blaster": { description: "Blast the invading space bugs across 10 waves. Survive with 5 hearts.", controls: "Move: W A S D    Shoot: Space (hold)" },
  "Bee Swarm": { description: "Collect pollen from flowers, make honey at your hive, hatch more bees and unlock new zones! Your bees gather pollen for you.", controls: "WASD move · E hive/shop · Arrows or drag = camera · tool auto-collects" },
  "Pond Snake": { description: "Glide through the pond and eat clovers. Don't hit the wall or yourself. 10 speed stages.", controls: "Steer: W A S D" },
  "Capy Pong": { description: "Beat the AI in 10 stages of faster and faster rallies. You have 3 lives.", controls: "Move paddle: W / S" },
  "Mud Bricks": { description: "Smash the mud bricks across 10 levels. Space launches the ball.", controls: "Move: A / D    Launch: Space" },
  "Cube Canyon": { description: "Run into a low-poly canyon, dodge obstacles, and collect glowing shards.", controls: "Move: A / D or ← / →    Jump: W / ↑ / Space" }
};

const state = {
  player: { x: 65, y: 280, w: 30, h: 34, vx: 0, vy: 0, grounded: false },
  platforms: [], coins: [], goal: { x: 745, y: 285, w: 18, h: 80 },
  obstacles: [], shards: [], elapsed: 0, spawnTimer: 0, hit: false, won: false,
  lane: 0, laneTarget: 0, jump: 0, jumpV: 0, world: 0, level: 0, face: -1, stage: 1, lives: 3, items: [], cards: [], flipped: [], lock: 0, moves: 0, goal2: 0
};

function savePrefs() {
  try { localStorage.setItem("capyPrefs", JSON.stringify(prefs)); } catch {}
  saveProgress();
}
function saveFavorites() {
  try { localStorage.setItem("capyFavorites", JSON.stringify([...favorites])); } catch {}
  saveProgress();
}
function applyTheme() {
  let theme = prefs.theme;
  if (theme === "system") theme = matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  document.documentElement.dataset.theme = theme;
  $$("[data-theme-choice]").forEach(b => {
    const active = b.dataset.themeChoice === prefs.theme;
    b.classList.toggle("active", active);
    b.setAttribute("aria-pressed", String(active));
  });
  const meta = $('meta[name="theme-color"]');
  if (meta) meta.content = theme === "dark" ? "#111611" : "#f5f7f2";
}
function syncSettings() {
  $("#sound-toggle").setAttribute("aria-checked", String(prefs.sound));
  $("#vfx-toggle").setAttribute("aria-checked", String(prefs.vfx));
  $("#music-toggle").setAttribute("aria-checked", String(prefs.music));
  $("#motion-toggle").setAttribute("aria-checked", String(prefs.reduceMotion));
  document.documentElement.classList.toggle("reduce-motion", prefs.reduceMotion);
  applyTheme();
  savePrefs();
}
let master = null;
function audio() {
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
  if (!audioContext) { audioContext = new AC(); master = audioContext.createDynamicsCompressor(); const g = audioContext.createGain(); g.gain.value = .9; master.connect(g); g.connect(audioContext.destination); }
  if (audioContext.state === "suspended") audioContext.resume(); return audioContext;
}
function tone(f, d, type = "sine", vol = .06, to = 0, delay = 0) {
  const c = audio(), t = c.currentTime + delay, o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t); if (to) o.frequency.exponentialRampToValueAtTime(to, t + d);
  g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + .01); g.gain.exponentialRampToValueAtTime(.0001, t + d);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + d + .02);
}
function noise(d, vol = .1, freq = 1200, delay = 0) {
  const c = audio(), t = c.currentTime + delay, n = Math.floor(c.sampleRate * d), buf = c.createBuffer(1, n, c.sampleRate), data = buf.getChannelData(0);
  for (let i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(); s.buffer = buf; f.type = "lowpass"; f.frequency.value = freq; g.gain.value = vol;
  s.connect(f); f.connect(g); g.connect(master); s.start(t);
}
let musicTimer = null;
const MEL = [[0,2,4,7,4,2,4,7,9,7,4,2,0,2,4,2],[0,3,7,10,7,3,5,8,12,8,5,3,0,3,5,7],[0,0,7,7,9,9,7,5,5,4,4,2,2,0,0,-5],[12,9,7,9,12,9,7,4,9,7,4,2,7,4,2,0]];
function stopMusic() { clearInterval(musicTimer); musicTimer = null; if (ambient) { ambient(); ambient = null; } }
function startAmbient() { try { const c = audio(), n = c.sampleRate * 2, b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0); let l = 0; for (let i = 0; i < n; i++) { l = l * .98 + (Math.random() * 2 - 1) * .1; d[i] = l * 4; }
  const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(), o = c.createOscillator(), og = c.createGain(); s.buffer = b; s.loop = true; f.type = "lowpass"; f.frequency.value = 500; g.gain.value = .05; o.frequency.value = .12; og.gain.value = .03; o.connect(og); og.connect(g.gain); s.connect(f); f.connect(g); g.connect(master); s.start(); o.start(); ambient = () => { try { s.stop(); o.stop(); } catch {} }; } catch {} }
function startMusic(name) {
  stopMusic(); if (!prefs.sound || !prefs.music) return;
  let h = 0; for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const mel = MEL[h % 4], root = [196, 220, 246, 262, 174][h % 5], step = 60 / [108, 124, 96, 136][(h >> 3) % 4] / 2, wave = ["triangle", "square", "sine", "triangle"][(h >> 5) % 4]; let i = 0;
  musicTimer = setInterval(() => { try { audio(); const s = i++ % 16; tone(root * Math.pow(2, mel[s] / 12), step * .9, wave, wave === "square" ? .012 : .02); if (s % 4 === 0) tone(root / 2 * Math.pow(2, [0, 5, 7, 3][s / 4] / 12), step * 3.6, "sine", .03); } catch {} }, step * 1000);
}
function sound(type = "click") {
  if (!prefs.sound) return;
  try {
    if (!audio()) return;
    const S = {
      click: () => { tone(660, .05, "sine", .05); tone(990, .05, "sine", .03, 0, .03); },
      coin: () => { tone(988, .07, "square", .035); tone(1319, .16, "square", .035, 0, .07); },
      jump: () => tone(250, .15, "triangle", .07, 560),
      hit: () => { shake = 9; noise(.28, .16, 900); tone(150, .3, "sawtooth", .07, 40); },
      win: () => [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, .22, "triangle", .06, 0, i * .1)),
      start: () => { tone(440, .1, "sine", .05, 660); tone(880, .12, "sine", .03, 0, .08); },
      stage: () => [659, 784, 988].forEach((f, i) => { tone(f, .2, "triangle", .06, 0, i * .08); tone(f * 2, .3, "sine", .02, 0, i * .08 + .05); }),
      flip: () => { tone(650 + Math.random() * 250, .04, "sine", .04); noise(.03, .04, 4000); },
      slash: () => { noise(.14, .12, 3500); tone(420, .12, "sawtooth", .03, 140); }, whoosh: () => { noise(.35, .12, 2000); tone(200, .35, "sine", .06, 900); }, dash: () => { noise(.18, .14, 5000); tone(300, .18, "triangle", .05, 1200); },
      boom: () => { noise(.6, .22, 500); tone(90, .6, "sine", .16, 30); }, level: () => [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => { tone(f, .3, "triangle", .06, 0, i * .07); tone(f / 2, .3, "sine", .03, 0, i * .07); }),
      quest: () => { tone(392, .12, "square", .03); tone(523, .12, "square", .03, 0, .1); tone(659, .25, "square", .03, 0, .2); }, step: () => noise(.04, .03, 900), splash: () => noise(.15, .06, 1800), cash: () => { tone(1568, .08, "square", .03); tone(2093, .2, "square", .03, 0, .07); }, tick: () => tone(900 + Math.random() * 300, .03, "square", .02), reveal: () => [784, 988, 1175].forEach((f, i) => tone(f, .25, "triangle", .06, 0, i * .09)), clang: () => { tone(1200, .15, "square", .04, 700); noise(.08, .08, 6000); }, gulp: () => { tone(300, .08, "sine", .07, 150); tone(260, .1, "sine", .07, 130, .1); }, talk: () => { for (let i = 0; i < 4; i++) tone(260 + Math.random() * 180, .05, "square", .02, 0, i * .06); }
    };
    (S[type] || S.click)();
  } catch {}
}
function toast(message) {
  const el = $("#toast");
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 2400);
}
function burst(x, y, amount = 12) {
  if (!prefs.vfx || prefs.reduceMotion) return;
  for (let i = 0; i < amount; i++) {
    const p = document.createElement("span");
    p.className = "particle";
    p.style.left = `${x}px`; p.style.top = `${y}px`;
    p.style.setProperty("--dx", `${(Math.random() - .5) * 130}px`);
    p.style.setProperty("--dy", `${(Math.random() - .7) * 120}px`);
    p.style.background = ["#70b982", "#e8c56b", "#91c9ae", "#d7e8c7"][i % 4];
    particleLayer.appendChild(p);
    setTimeout(() => p.remove(), 800);
  }
}
let shake = 0; const fx = [];
function spark(x, y, n, hue) {
  if (!prefs.vfx || prefs.reduceMotion) return;
  for (let i = 0; i < n * 2; i++) { const a = Math.random() * 7, v = 60 + Math.random() * 260; fx.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 80, life: .5 + Math.random() * .4, max: .9, s: 2 + Math.random() * 3, h: hue ?? [45, 140, 170, 20][i % 4] }); }
  if (fx.length > 400) fx.splice(0, fx.length - 400);
}
function renderFrame(dt) {
  ctx.save();
  if (shake > 0 && prefs.vfx && !prefs.reduceMotion) ctx.translate((Math.random() - .5) * shake, (Math.random() - .5) * shake);
  shake = Math.max(0, shake - dt * 45); drawGame();
  
  for (let i = fx.length - 1; i >= 0; i--) { const p = fx[i]; p.life -= dt; if (p.life <= 0) { fx.splice(i, 1); continue; } p.vy += 520 * dt; p.x += p.vx * dt; p.y += p.vy * dt; ctx.globalAlpha = p.life / p.max; ctx.fillStyle = `hsl(${p.h},90%,60%)`; ctx.fillRect(p.x - p.s / 2, p.y - p.s / 2, p.s, p.s); }
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over"; ctx.restore();
}
function canvasBurst(x, y, n) { spark(x, y, n); const r = canvas.getBoundingClientRect(); burst(r.left + x / canvas.width * r.width, r.top + y / canvas.height * r.height, n); }
function updateGames() {
  const query = searchInput.value.trim().toLowerCase();
  let count = 0;
  $$(".game-card").forEach(card => {
    const name = card.dataset.name, category = card.dataset.category, status = card.dataset.status;
    let matchesView = currentView === "All" ||
      (currentView === "My Games" && status === "ready") ||
      (currentView === "Favorites" && favorites.has(name)) || category === currentView;
    const visible = name.toLowerCase().includes(query) && matchesView;
    card.hidden = !visible;
    if (visible) count++;
  });
  $("#game-count").textContent = `${String(count).padStart(2, "0")} GAMES`;
  $("#empty-message").hidden = count !== 0;
  $("#favorite-count").textContent = favorites.size;
  $$("[data-favorite]").forEach(button => {
    const active = favorites.has(button.dataset.favorite);
    button.classList.toggle("is-favorite", active);
    button.textContent = active ? "♥" : "♡";
    button.setAttribute("aria-pressed", String(active));
  });
}
function setView(view, button) {
  currentView = view;
  const labels = { All: "Home", Adventure: "Adventure", Arcade: "Arcade", Puzzle: "Puzzle", "3D": "3D worlds", Favorites: "Favorites", "My Games": "My games" };
  $("#breadcrumb-current").textContent = labels[view] || view;
  $("#library-title").textContent = view === "All" ? "Explore all games" : labels[view];
  $$(".nav-link").forEach(b => {
    const active = b === button;
    b.classList.toggle("active", active);
    active ? b.setAttribute("aria-current", "page") : b.removeAttribute("aria-current");
  });
  updateGames();
  sidebar.classList.remove("open");
  if (view !== "All") $("#library").scrollIntoView({ behavior: prefs.reduceMotion ? "auto" : "smooth", block: "start" });
  sound();
}
$$(".nav-link").forEach(button => button.addEventListener("click", () => setView(button.dataset.view, button)));
searchInput.addEventListener("input", updateGames);
document.addEventListener("keydown", event => {
  if (event.key === "/" && !dialog.open && !settingsDialog.open && !["INPUT", "TEXTAREA"].includes(document.activeElement.tagName)) {
    event.preventDefault(); searchInput.focus();
  }
  if (dialog.open && ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(event.key)) event.preventDefault();
  if (event.key === "Escape" && sidebar.classList.contains("open")) sidebar.classList.remove("open");
});
$("#browse-button").addEventListener("click", () => { sound(); $("#library").scrollIntoView({ behavior: prefs.reduceMotion ? "auto" : "smooth" }); });
$("#mobile-menu").addEventListener("click", () => { sidebar.classList.toggle("open"); sound(); });
document.addEventListener("click", event => {
  if (sidebar.classList.contains("open") && !sidebar.contains(event.target) && !$("#mobile-menu").contains(event.target)) sidebar.classList.remove("open");
});
$$("[data-favorite]").forEach(button => button.addEventListener("click", (event) => {
  const name = button.dataset.favorite;
  favorites.has(name) ? favorites.delete(name) : favorites.add(name);
  saveFavorites(); updateGames(); sound("coin");
  if (favorites.has(name)) burst(event.clientX || innerWidth / 2, event.clientY || innerHeight / 2, 8);
}));
$$("[data-open-game], .launch-button").forEach(button => button.addEventListener("click", () => openGame(button.dataset.openGame || button.dataset.game)));
$("#surprise-button").addEventListener("click", () => {
  const choices = Object.keys(GAME_INFO);
  openGame(choices[Math.floor(Math.random() * choices.length)]);
  burst(innerWidth * .18, innerHeight * .8, 16);
});
$("#settings-open").addEventListener("click", () => { settingsDialog.showModal(); sound(); });
$("#settings-close").addEventListener("click", () => settingsDialog.close());
$("#settings-done").addEventListener("click", () => { settingsDialog.close(); sound(); });
settingsDialog.addEventListener("click", event => { if (event.target === settingsDialog) settingsDialog.close(); });
$$("[data-theme-choice]").forEach(button => button.addEventListener("click", (event) => {
  prefs.theme = button.dataset.themeChoice; syncSettings(); sound(); burst(event.clientX, event.clientY, 9);
}));
$("#sound-toggle").addEventListener("click", () => { prefs.sound = !prefs.sound; syncSettings(); sound("click"); });
$("#music-toggle").addEventListener("click", () => { prefs.music = !prefs.music; syncSettings(); if (!prefs.music) stopMusic(); else if (isRunning && !isPaused) startMusic(currentGame); });
$("#vfx-toggle").addEventListener("click", () => { prefs.vfx = !prefs.vfx; syncSettings(); sound(); toast(prefs.vfx ? "Visual effects enabled ✨" : "Visual effects disabled"); });
$("#motion-toggle").addEventListener("click", () => { prefs.reduceMotion = !prefs.reduceMotion; syncSettings(); sound(); toast(prefs.reduceMotion ? "Reduced motion enabled" : "Motion effects enabled"); });
matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", () => { if (prefs.theme === "system") applyTheme(); });
syncSettings();

const LEVELS = [
  { platforms: [[0,365,190,85],[240,325,120,125],[410,285,110,165],[565,330,105,120],[700,365,100,85],[120,265,75,13],[325,205,80,13],[490,175,80,13]], coins: [[145,225],[277,285],[360,165],[450,245],[520,135],[615,290],[730,325]] },
  { platforms: [[0,365,120,85],[170,330,70,13],[290,290,70,13],[410,250,70,13],[530,300,70,13],[650,260,70,13],[720,365,80,85]], coins: [[205,290],[325,250],[445,210],[565,260],[685,220],[760,325]] },
  { platforms: [[0,365,90,85],[140,320,60,13],[250,270,60,13],[370,220,60,13],[490,270,60,13],[600,320,60,13],[700,365,100,85]], coins: [[170,280],[280,230],[400,180],[520,230],[630,280],[740,325]] }
];
function loadLevel() {
  const L = LEVELS[state.level];
  state.platforms = L.platforms.map(([x,y,w,h]) => ({ x, y, w, h }));
  state.coins = L.coins.map(([x,y]) => ({ x, y, taken: false }));
  state.player = { x: 30, y: 280, w: 30, h: 34, vx: 0, vy: 0, grounded: false };
}
function genLevel(n) {
  let s = n * 9301 + 49297; const r = () => (s = (s * 9301 + 49297) % 233280) / 233280;
  const pl = [[0, 365, 90, 85]], coins = []; let x = 90, y = 365; const w = Math.max(45, 74 - n * 3);
  while (x < 620) {
    x += 35 + r() * (5 + n * 9); y = Math.max(170, Math.min(365, y + (r() - .5) * 120)); y = Math.min(y, pl[pl.length - 1][1] + 60);
    if (pl[pl.length - 1][1] - y > 70) y = pl[pl.length - 1][1] - 70;
    pl.push([Math.round(x), Math.round(y), w, 13]); coins.push([Math.round(x + w / 2), Math.round(y - 40)]); x += w;
  }
  pl.push([700, 365, 100, 85]); coins.push([740, 325]); return { platforms: pl, coins };
}
for (let n = 3; n < 10; n++) LEVELS.push(genLevel(n));
const GARDEN = [[2,2],[4,2],[4,3],[4,4],[5,4],[6,4],[6,4],[6,4],[6,4],[6,4]], FRUITS = ["🌱","🌷","🍄","🐞","🍓","🌻","🦋","🍀","🍉","🐝","🌵","🍒"];
function loadGarden() {
  const [c, r] = GARDEN[state.level], n = c * r / 2, deck = [];
  for (let i = 0; i < n; i++) deck.push(FRUITS[i], FRUITS[i]);
  for (let i = deck.length - 1; i > 0; i--) { const k = Math.floor(Math.random() * (i + 1)); [deck[i], deck[k]] = [deck[k], deck[i]]; }
  const g = 10, cw = Math.min(110, Math.floor((720 - (c - 1) * g) / c)), ch = r > 3 ? 66 : 74, ox = (800 - (c * cw + (c - 1) * g)) / 2, oy = 255 - (r * ch + (r - 1) * g) / 2;
  state.cards = deck.map((s, i) => ({ s, x: ox + (i % c) * (cw + g), y: oy + Math.floor(i / c) * (ch + g), w: cw, h: ch, up: false, done: false }));
  state.flipped = []; state.lock = 0;
}
function advanceStage() {
  if (currentGame === "Capy Hop" && state.won && state.level < LEVELS.length - 1) {
    state.level++; noteStage(state.level + 1); state.won = false; loadLevel(); sound("stage"); toast(`Stage ${state.level + 1} of ${LEVELS.length}`);
  }
  if (currentGame === "Pocket Garden" && !state.won && state.cards.every(c => c.done)) {
    if (state.level < GARDEN.length - 1) { state.level++; noteStage(state.level + 1); loadGarden(); sound("stage"); toast(`Stage ${state.level + 1} of ${GARDEN.length}`); } else state.won = true;
  }
}
function stageCheck(n) { if (n !== state.stage) { state.stage = n; noteStage(n); if (n > 10) { state.won = true; return; } sound("stage"); toast(`Stage ${n}!`); } }
function openGame(name) {
  if (!GAME_INFO[name]) return;
  stopGame(); currentGame = name; dialog.showModal();
  $("#touch-controls").hidden = name === "Pocket Garden";
    $("#bee-hud").hidden = name !== "Bee Swarm"; $$(".bee-only").forEach(b => b.hidden = name !== "Bee Swarm"); glc.style.touchAction = name === "Bee Swarm" ? "none" : "pan-y";
  const use3d = (name === "Cube Canyon" || name === "Bee Swarm") && initGL(); glc.hidden = !use3d; canvas.hidden = use3d;
  $("#dialog-title").textContent = name;
  $("#controls-text").textContent = GAME_INFO[name].controls;
  $("#overlay-title").textContent = name;
  $("#overlay-description").textContent = GAME_INFO[name].description + (stageBest[name] > 1 ? ` Furthest stage: ${stageBest[name]}.` : "");
  startButton.textContent = "Start game →";
  overlay.hidden = false; isPaused = false; pauseButton.textContent = "Pause";
  resetGame(); drawGame(); sound("start");
}
function resetGame() {
  score = 0; scoreDisplay.textContent = "SCORE 0";
  state.elapsed = 0; state.spawnTimer = 0; state.hit = false; state.won = false;
  state.obstacles = []; state.shards = []; state.world = 0; state.lane = 0; state.laneTarget = 0; state.jump = 0; state.jumpV = 0;
  fx.length = 0; shake = 0; state.level = 0; state.face = -1; state.stage = 1; state.lives = 3; state.items = []; state.moves = 0;
  loadLevel();
  if (currentGame === "Pocket Garden") loadGarden();
  initNewGames();
  if (currentGame === "Snack Catch") state.player = { x: 368, y: 380, w: 64, h: 40, vx: 0, vy: 0, grounded: true };
  keys.clear();
}
function stopGame() {
  stopMusic(); clearLabels(); if (currentGame === "Bee Swarm" && X.bee) saveBee();
  isRunning = false; isPaused = false; cancelAnimationFrame(animationId); animationId = 0; keys.clear(); pauseButton.textContent = "Pause";
}
function startOrResume() {
  if (!currentGame) return;
  if (state.hit || state.won) resetGame();
  isPaused = false; isRunning = true; overlay.hidden = true; startMusic(currentGame); pauseButton.textContent = "Pause";
  previousTime = performance.now(); cancelAnimationFrame(animationId); animationId = requestAnimationFrame(gameLoop); sound("start");
}
startButton.addEventListener("click", startOrResume);
pauseButton.addEventListener("click", () => {
  if (!isRunning) return;
  if (isPaused) startOrResume();
  else {
    isPaused = true; cancelAnimationFrame(animationId); stopMusic();
    $("#overlay-title").textContent = "Paused"; $("#overlay-description").textContent = "Take a breather. Your game is waiting.";
    startButton.textContent = "Resume game →"; overlay.hidden = false; pauseButton.textContent = "Resume"; sound();
  }
});
$("#close-dialog").addEventListener("click", () => { stopGame(); dialog.close(); });
dialog.addEventListener("click", event => { if (event.target === dialog) { stopGame(); dialog.close(); } });
dialog.addEventListener("close", stopGame);
$("#fullscreen-button").addEventListener("click", async () => {
  try {
    const target = $("#canvas-wrap");
    if (!document.fullscreenElement) await target.requestFullscreen();
    else await document.exitFullscreen();
  } catch { toast("Fullscreen isn't available in this browser."); }
});
function keyName(key) { return key.length === 1 ? key.toLowerCase() : key; }
document.addEventListener("keydown", event => {
  const key = keyName(event.key);
  if (dialog.open && ["ArrowLeft", "ArrowRight", "ArrowUp", " "].includes(key)) event.preventDefault();
  keys.add(key);
});
document.addEventListener("keyup", event => keys.delete(keyName(event.key)));
window.addEventListener("blur", () => keys.clear());
canvas.addEventListener("pointermove", event => {
  if (!isRunning || isPaused) return;
  const r = canvas.getBoundingClientRect(), x = (event.clientX-r.left)/r.width*canvas.width;
});
canvas.addEventListener("pointerdown", event => {
  if (currentGame === "Cube Canyon" && isRunning && !isPaused) { if (state.jump <= 0) { state.jumpV = 6.8; sound("jump"); } }
});
canvas.addEventListener("pointerdown", event => {
  if (currentGame !== "Pocket Garden" || !isRunning || isPaused || state.lock > 0) return;
  const r = canvas.getBoundingClientRect(), x = (event.clientX - r.left) / r.width * 800, y = (event.clientY - r.top) / r.height * 450;
  const c = state.cards.find(c => !c.up && !c.done && x > c.x && x < c.x + c.w && y > c.y && y < c.y + c.h);
  if (!c) return;
  c.up = true; state.flipped.push(c); sound("flip");
  if (state.flipped.length === 2) {
    state.moves++;
    const [a, b] = state.flipped;
    if (a.s === b.s) { a.done = b.done = true; state.flipped = []; score++; sound("coin"); canvasBurst(a.x + a.w / 2, a.y + 37, 8); canvasBurst(b.x + b.w / 2, b.y + 37, 8); }
    else state.lock = .7;
  }
  scoreDisplay.textContent = `PAIRS ${score} · MOVES ${state.moves}`;
});
document.querySelectorAll("[data-key]").forEach(b => {
  const k = b.dataset.key, down = e => { e.preventDefault(); keys.add(k); }, up = () => keys.delete(k);
  b.addEventListener("pointerdown", down); b.addEventListener("pointerup", up); b.addEventListener("pointerleave", up); b.addEventListener("pointercancel", up);
});
document.addEventListener("visibilitychange", () => { if (document.hidden && isRunning && !isPaused) pauseButton.click(); });
document.addEventListener("keydown", e => { if (e.key.toLowerCase() === "p" && dialog.open && !e.repeat) pauseButton.click(); });
function gameLoop(now) {
  if (!isRunning || isPaused) return;
  const dt = Math.min((now-previousTime)/1000,.033); previousTime = now;
  if (currentGame === "Capy Hop") updateCapyHop(dt);
  if (currentGame === "Neon Dodge") updateNeonDodge(dt);
  if (currentGame === "Cube Canyon") updateCubeCanyon(dt);
  if (currentGame === "Pocket Garden") updateGarden(dt);
  if (currentGame === "Snack Catch") updateSnack(dt);
  if (currentGame === "Capy Blaster") updateBlaster(dt);
  if (currentGame === "Bee Swarm") updateBee(dt);
  if (currentGame === "Pond Snake") updateSnake(dt);
  if (currentGame === "Capy Pong") updatePong(dt);
  if (currentGame === "Mud Bricks") updateBricks(dt);
  advanceStage();
  renderFrame(dt);
  if (state.hit || state.won) { finishGame(); return; }
  animationId = requestAnimationFrame(gameLoop);
}
function finishGame() {
  stopMusic(); isRunning = false; cancelAnimationFrame(animationId);
  const isBest = score > (bestScores[currentGame] || 0);
  bestScores[currentGame] = Math.max(bestScores[currentGame] || 0, score);
  try { localStorage.setItem("capyBest", JSON.stringify(bestScores)); } catch {}
  saveProgress();
  sound(state.won ? "win" : "hit");
  $("#overlay-title").textContent = state.won ? "You made it!" : "Game over";
  $("#overlay-description").textContent = state.won ? (currentGame === "Pocket Garden" ? `Garden complete! ${state.moves} moves.` : (currentGame === "Capy Hop" ? `All ${LEVELS.length} stages complete! You collected ${score} coins.` : `You cleared all 10 stages! Score: ${score}.`)) : `${currentGame === "Capy Hop" ? "You collected" : "Your score:"} ${score}. ${isBest ? "New best! " : ""}Best: ${bestScores[currentGame]}.`;
  startButton.textContent = state.won ? "Play again →" : "Try again →"; overlay.hidden = false; pauseButton.textContent = "Pause";
  if (state.won) { burst(innerWidth/2, innerHeight/2, 28); spark(400, 225, 60); } else { spark(400, 225, 30, 5); }
}
function updateCapyHop(dt) {
  const p=state.player, oldBottom=p.y+p.h;
  p.vx=0;
  if(keys.has("ArrowLeft")||keys.has("a"))p.vx=-245;
  if(keys.has("ArrowRight")||keys.has("d"))p.vx=245;
  if((keys.has(" ")||keys.has("ArrowUp")||keys.has("w"))&&p.grounded){p.vy=-485;p.grounded=false;sound("jump");}
  if(p.vx)state.face=p.vx>0?-1:1;p.x=Math.max(0,Math.min(canvas.width-p.w,p.x+p.vx*dt));p.vy+=1100*dt;p.y+=p.vy*dt;p.grounded=false;
  for(const plat of state.platforms){if(p.x+p.w>plat.x&&p.x<plat.x+plat.w&&p.vy>=0&&oldBottom<=plat.y+3&&p.y+p.h>=plat.y){p.y=plat.y-p.h;p.vy=0;p.grounded=true;}}
  for(const coin of state.coins){if(!coin.taken&&Math.hypot(p.x+p.w/2-coin.x,p.y+p.h/2-coin.y)<24){coin.taken=true;score++;scoreDisplay.textContent=`COINS ${score}`;sound("coin");canvasBurst(coin.x,coin.y,7);}}
  if(p.x+p.w>state.goal.x&&p.y+p.h>state.goal.y)state.won=true;
  if(p.y>canvas.height+60)state.hit=true;
}
function updateNeonDodge(dt) {
  const p=state.player;state.elapsed+=dt;state.spawnTimer+=dt;stageCheck(1+Math.floor(state.elapsed/15));
  if(keys.has("a"))p.x-=310*dt;if(keys.has("d"))p.x+=310*dt;p.x=Math.max(8,Math.min(canvas.width-p.w-8,p.x));
  if(state.spawnTimer>=Math.max(.28,.8-state.elapsed*.008)){state.spawnTimer=0;const size=18+Math.random()*25;state.obstacles.push({x:Math.random()*(canvas.width-size),y:-size,w:size,h:size,speed:150+Math.random()*100+state.elapsed*3+(state.stage-1)*25});}
  for(const o of state.obstacles){o.y+=o.speed*dt;if(p.x<o.x+o.w&&p.x+p.w>o.x&&p.y<o.y+o.h&&p.y+p.h>o.y)state.hit=true;}
  state.obstacles=state.obstacles.filter(o=>o.y<canvas.height+40);score=Math.floor(state.elapsed*10);scoreDisplay.textContent=`SCORE ${score} · STAGE ${state.stage}`;
}
function updateCubeCanyon(dt) {
  state.elapsed+=dt;state.world+=dt*7;state.spawnTimer+=dt;stageCheck(1+Math.floor(state.elapsed/20));
  if(keys.has("ArrowLeft")||keys.has("a"))state.laneTarget=Math.max(-1,state.laneTarget-2.5*dt);
  if(keys.has("ArrowRight")||keys.has("d"))state.laneTarget=Math.min(1,state.laneTarget+2.5*dt);
  state.lane+=(state.laneTarget-state.lane)*Math.min(1,dt*9);
  if((keys.has(" ")||keys.has("ArrowUp")||keys.has("w"))&&state.jump<=0){state.jumpV=6.8;sound("jump");}
  state.jumpV-=18*dt;state.jump+=state.jumpV*dt;if(state.jump<0){state.jump=0;state.jumpV=0;}
  if(state.spawnTimer>.65){state.spawnTimer=0;const lane=Math.floor(Math.random()*3)-1;state.obstacles.push({lane,z:1,size:.11+Math.random()*.07});}
  for(const o of state.obstacles){o.z-=dt*(.38+state.elapsed*.004);if(o.z<.17&&o.z>.07&&Math.abs(o.lane-state.lane)<.42&&state.jump<.65)state.hit=true;}
  state.obstacles=state.obstacles.filter(o=>o.z>0);
  score=Math.floor(state.elapsed*10);scoreDisplay.textContent=`DIST ${score} m · STAGE ${state.stage}`;
}
function roundRect(x,y,w,h,r,fill){ctx.fillStyle=fill;ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fill();}
function drawCapy() {
  const p = state.player, t = performance.now() / 1000, mv = p.vx !== 0 && p.grounded, sc = p.w > 40 ? 1.5 : 1;
  const step = mv ? Math.sin(t * 16) * 3 : 0, bob = mv ? -Math.abs(Math.sin(t * 16)) * 1.5 : Math.sin(t * 2) * .6;
  ctx.save(); ctx.translate(p.x + p.w / 2, p.y + 17 + bob); ctx.scale(sc * (state.face || 1), sc);
  if (!p.grounded) ctx.rotate(Math.max(-.25, Math.min(.25, p.vy * .0004)));
  const E = (x, y, rx, ry, c) => { ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, 7); ctx.fill(); };
  roundRect(-9 + step, 10, 7, 7, 2, "#6f4a30"); roundRect(7 - step, 10, 7, 7, 2, "#6f4a30");
  E(1, 4, 17, 13, "#a9764e"); E(1, 9, 11, 5, "#c39166");
  E(-9, -4, 12, 11, "#ba895e"); E(-18, -1, 7, 5.5, "#d5a67b"); E(-22, -3, 2, 1.6, "#5a3a26"); E(-5, -13, 3.5, 4.5, "#8a5d3c");
  if (t % 3.2 < .12) { ctx.strokeStyle = "#1f231c"; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(-13, -6); ctx.lineTo(-9, -6); ctx.stroke(); }
  else { E(-11, -6, 1.9, 2.2, "#1f231c"); E(-10.4, -6.8, .6, .6, "#fff"); }
  E(-14, 0, 2.6, 1.8, "#f0907866"); E(-2, -1, 5, 3, "#e76f51");
  E(-6, -16, 4.8, 4.5, "#f2a23a"); E(-4, -20, 2.6, 1.2, "#4f9a52");
  ctx.restore();
}
function drawCapyHop() {
  const sky=ctx.createLinearGradient(0,0,0,450);sky.addColorStop(0,"#dcefe3");sky.addColorStop(1,"#f5eed7");ctx.fillStyle=sky;ctx.fillRect(0,0,800,450);
  const T=performance.now()/1000;ctx.fillStyle="#f3c978";ctx.beginPath();ctx.arc(675,82,36,0,Math.PI*2);ctx.fill();ctx.fillStyle="#fffc";for(let i=0;i<4;i++){const cx=((i*230+T*12*(1+i%2))%1000)-100,cy=70+i*28;ctx.beginPath();ctx.ellipse(cx,cy,48,14,0,0,7);ctx.ellipse(cx+26,cy-8,28,12,0,0,7);ctx.fill();}
  ctx.fillStyle="#bdd8b8";ctx.beginPath();ctx.moveTo(0,310);ctx.lineTo(150,150);ctx.lineTo(280,280);ctx.lineTo(460,125);ctx.lineTo(650,305);ctx.lineTo(800,190);ctx.lineTo(800,450);ctx.lineTo(0,450);ctx.closePath();ctx.fill();
  ctx.fillStyle="#8bb58f";ctx.fillRect(0,375,800,75);
  for(const p of state.platforms){roundRect(p.x,p.y,p.w,p.h,5,"#427b58");roundRect(p.x,p.y,p.w,7,4,"#7dbb7b");}
  for(const c of state.coins){if(c.taken)continue;ctx.fillStyle="#e7b64c";ctx.beginPath();ctx.ellipse(c.x,c.y+Math.sin(T*3+c.x)*2,Math.max(2,Math.abs(Math.cos(T*3+c.x))*9),9,0,0,7);ctx.fill();ctx.strokeStyle="#fff0a7";ctx.lineWidth=3;ctx.stroke();ctx.fillStyle="#fff4c6";ctx.fillRect(c.x-1,c.y-5,2,10);}
  const g=state.goal;ctx.fillStyle="#426e51";ctx.fillRect(g.x,g.y,4,g.h);ctx.fillStyle="#f2ca75";ctx.beginPath();ctx.moveTo(g.x+4,g.y);ctx.lineTo(g.x+43,g.y+14);ctx.lineTo(g.x+4,g.y+28);ctx.closePath();ctx.fill();
  drawCapy();ctx.fillStyle="#345f45";ctx.font="bold 17px system-ui";ctx.fillText("CAPY HOP",24,35);ctx.font="12px system-ui";ctx.fillText(`Stage ${state.level+1}/${LEVELS.length} · Collect coins, reach the flag`,24,55);ctx.textAlign="right";ctx.fillText(`COINS ${score}`,770,35);ctx.textAlign="left";
}
function drawNeonDodge() {
  ctx.fillStyle="#20223c";ctx.fillRect(0,0,800,450);ctx.strokeStyle="#363955";ctx.lineWidth=1;
  for(let x=0;x<=800;x+=40){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,450);ctx.stroke();}
  for(let y=0;y<=450;y+=40){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(800,y);ctx.stroke();}
  ctx.fillStyle="#e3dcff";ctx.font="bold 17px system-ui";ctx.fillText("NEON DODGE",24,35);ctx.fillStyle="#b6b6d4";ctx.font="12px system-ui";ctx.fillText(`Stage ${state.stage} · Don't get hit`,24,55);
  for(const o of state.obstacles){ctx.shadowBlur=prefs.vfx?12:0;ctx.shadowColor="#ff85b2";roundRect(o.x,o.y,o.w,o.h,4,"#ff85b2");}ctx.shadowBlur=0;
  const p=state.player;ctx.shadowBlur=prefs.vfx?18:0;ctx.shadowColor="#80f1e2";ctx.fillStyle="#80f1e2";ctx.beginPath();ctx.moveTo(p.x+p.w/2,p.y);ctx.lineTo(p.x+p.w,p.y+p.h);ctx.lineTo(p.x,p.y+p.h);ctx.closePath();ctx.fill();ctx.shadowBlur=0;
}
// Canvas-based perspective renderer: 3D-style low-poly runner, no libraries or downloads.
function project(x,y,z){const depth=Math.max(.08,z);const scale=1/depth;return{x:400+x*scale*230,y:210+y*scale*170+scale*25,w:scale};}
function drawCube(x,y,z,size,color) {
  const p=project(x,y,z), s=size*p.w*95;
  const top=[p.x,p.y-s,p.x+s,p.y-s*.72,p.x,p.y-s*.45,p.x-s,p.y-s*.72];
  ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(top[0],top[1]);ctx.lineTo(top[2],top[3]);ctx.lineTo(top[4],top[5]);ctx.lineTo(top[6],top[7]);ctx.closePath();ctx.fill();
  ctx.fillStyle="#243f3b";ctx.beginPath();ctx.moveTo(p.x-s,p.y-s*.72);ctx.lineTo(p.x,p.y-s*.45);ctx.lineTo(p.x,p.y+s*.35);ctx.lineTo(p.x-s,p.y+s*.08);ctx.closePath();ctx.fill();
  ctx.fillStyle="#3c7160";ctx.beginPath();ctx.moveTo(p.x,p.y-s*.45);ctx.lineTo(p.x+s,p.y-s*.72);ctx.lineTo(p.x+s,p.y+s*.08);ctx.lineTo(p.x,p.y+s*.35);ctx.closePath();ctx.fill();
}
function drawCubeCanyon() {
  const sky=ctx.createLinearGradient(0,0,0,450);sky.addColorStop(0,"#d8e8ee");sky.addColorStop(.62,"#f1dfbd");sky.addColorStop(1,"#7a9e98");ctx.fillStyle=sky;ctx.fillRect(0,0,800,450);
  ctx.fillStyle="#f5ca77";ctx.beginPath();ctx.arc(645,65,30,0,Math.PI*2);ctx.fill();
  ctx.fillStyle="#b0c7c8";ctx.beginPath();ctx.moveTo(0,205);ctx.lineTo(120,95);ctx.lineTo(215,190);ctx.lineTo(355,75);ctx.lineTo(485,195);ctx.lineTo(610,100);ctx.lineTo(800,205);ctx.lineTo(800,450);ctx.lineTo(0,450);ctx.closePath();ctx.fill();
  ctx.fillStyle="#6e9690";ctx.beginPath();ctx.moveTo(0,235);ctx.lineTo(220,190);ctx.lineTo(310,450);ctx.lineTo(0,450);ctx.closePath();ctx.fill();
  ctx.beginPath();ctx.moveTo(800,235);ctx.lineTo(580,190);ctx.lineTo(490,450);ctx.lineTo(800,450);ctx.closePath();ctx.fill();
  // Road widens toward the viewer, creating perspective depth.
  ctx.fillStyle="#c9d4c3";ctx.beginPath();ctx.moveTo(380,165);ctx.lineTo(420,165);ctx.lineTo(690,450);ctx.lineTo(110,450);ctx.closePath();ctx.fill();
  ctx.strokeStyle="#fff6d9";ctx.lineWidth=3;ctx.setLineDash([14,18]);ctx.beginPath();ctx.moveTo(400,170);ctx.lineTo(400,450);ctx.stroke();ctx.setLineDash([]);
  for(let i=0;i<9;i++){const z=((i/9+state.world*.11)%1);const y=170+z*z*280;const spread=20+z*270;ctx.strokeStyle=`rgba(80,112,103,${.08+z*.22})`;ctx.lineWidth=1+z*2;ctx.beginPath();ctx.moveTo(400-spread,y);ctx.lineTo(400+spread,y);ctx.stroke();}
  for(const o of [...state.obstacles].sort((a,b)=>a.z-b.z))drawCube(o.lane*.72,0,o.z,o.size,o.lane===0?"#e7a16d":"#5f9b8b");
  // A small low-poly runner centered in the road, raised when jumping.
  const z=.45,jump=state.jump*55;
  ctx.fillStyle="#2c4b40";ctx.beginPath();ctx.ellipse(400+state.lane*95,365-jump,24,8,0,0,Math.PI*2);ctx.fill();
  ctx.save();ctx.translate(400+state.lane*95,335-jump);ctx.fillStyle="#b88155";ctx.beginPath();ctx.moveTo(-19,-10);ctx.lineTo(-12,-35);ctx.lineTo(10,-35);ctx.lineTo(20,-13);ctx.lineTo(14,5);ctx.lineTo(-16,5);ctx.closePath();ctx.fill();
  ctx.fillStyle="#d7a477";ctx.beginPath();ctx.moveTo(-12,-35);ctx.lineTo(-7,-49);ctx.lineTo(7,-49);ctx.lineTo(13,-34);ctx.closePath();ctx.fill();
  ctx.fillStyle="#9c6b48";ctx.beginPath();ctx.moveTo(-7,-47);ctx.lineTo(-12,-57);ctx.lineTo(-1,-51);ctx.fill();
  ctx.fillStyle="#20271f";ctx.fillRect(3,-41,3,3);ctx.restore();
  ctx.fillStyle="#304c46";ctx.font="bold 17px system-ui";ctx.fillText("CUBE CANYON",24,35);ctx.fillStyle="#526f6b";ctx.font="12px system-ui";ctx.fillText("Dodge the canyon blocks",24,55);
}
function updateGarden(dt) {
  if (state.lock > 0) { state.lock -= dt; if (state.lock <= 0) { state.flipped.forEach(c => c.up = false); state.flipped = []; } }
}
function updateSnack(dt) {
  const p = state.player; state.elapsed += dt; state.spawnTimer += dt;
  const dir = (keys.has("d") ? 1 : 0) - (keys.has("a") ? 1 : 0);
  p.vx = dir; if (dir) { p.x += dir * 380 * dt; state.face = dir > 0 ? -1 : 1; } p.x = Math.max(0, Math.min(800 - p.w, p.x));
  stageCheck(1 + Math.floor(score / 8));
  if (state.spawnTimer >= Math.max(.35, .95 - state.stage * .1)) { state.spawnTimer = 0; state.items.push({ x: 20 + Math.random() * 760, y: -20, rock: Math.random() < .22 + state.stage * .02, e: ["🍉","🍊","🍓","🍋"][Math.floor(Math.random() * 4)], v: 150 + state.stage * 25 + Math.random() * 60 }); }
  for (const it of state.items) {
    it.y += it.v * dt;
    if (!it.gone && it.y > p.y && it.y < p.y + 30 && it.x > p.x - 6 && it.x < p.x + p.w + 6) {
      it.gone = true;
      if (it.rock) { state.lives--; sound("hit"); } else { score++; sound("coin"); canvasBurst(it.x, it.y, 6); }
    } else if (!it.gone && it.y > 450) { it.gone = true; if (!it.rock) { state.lives--; sound("hit"); } }
  }
  state.items = state.items.filter(i => !i.gone);
  scoreDisplay.textContent = `FRUIT ${score} · ${"♥".repeat(Math.max(0, state.lives))}`;
  if (state.lives <= 0) state.hit = true;
}
function drawGarden() {
  const g = ctx.createLinearGradient(0, 0, 0, 450); g.addColorStop(0, "#f6ecd9"); g.addColorStop(1, "#cfe3c3"); ctx.fillStyle = g; ctx.fillRect(0, 0, 800, 450);
  ctx.fillStyle = "#345f45"; ctx.font = "bold 17px system-ui"; ctx.fillText("POCKET GARDEN", 24, 35); ctx.font = "12px system-ui"; ctx.fillText(`Stage ${state.level + 1}/${GARDEN.length} · Find the pairs`, 24, 55);
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  for (const c of state.cards) {
    roundRect(c.x, c.y + 4, c.w, c.h, 12, "#0002"); roundRect(c.x, c.y, c.w, c.h, 12, c.done ? "#d9efd2" : c.up ? "#fffaf0" : "#3f8a60");
    ctx.fillStyle = "#e8f5e0"; ctx.font = "bold 24px system-ui"; ctx.globalAlpha = c.done ? .6 : 1;
    if (c.up || c.done) { ctx.font = "34px system-ui"; ctx.fillText(c.s, c.x + c.w / 2, c.y + c.h / 2 + 2); } else ctx.fillText("c.", c.x + c.w / 2, c.y + c.h / 2);
    ctx.globalAlpha = 1;
  }
  ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
}
function drawSnackCatch() {
  const g = ctx.createLinearGradient(0, 0, 0, 450); g.addColorStop(0, "#d6eef5"); g.addColorStop(1, "#f6ecc9"); ctx.fillStyle = g; ctx.fillRect(0, 0, 800, 450);
  ctx.fillStyle = "#f3c978"; ctx.beginPath(); ctx.arc(690, 80, 34, 0, 7); ctx.fill();
  ctx.fillStyle = "#8fc49a"; ctx.fillRect(0, 410, 800, 40); ctx.fillStyle = "#5c9b77"; ctx.fillRect(0, 424, 800, 26);
  ctx.fillStyle = "#345f45"; ctx.font = "bold 17px system-ui"; ctx.fillText("SNACK CATCH", 24, 35); ctx.font = "12px system-ui"; ctx.fillText(`Stage ${state.stage} · Catch fruit, dodge rocks`, 24, 55);
  ctx.font = "26px system-ui"; ctx.textAlign = "center";
  for (const it of state.items) ctx.fillText(it.rock ? "🪨" : it.e, it.x, it.y);
  ctx.textAlign = "left"; drawCapy(); const p = state.player; roundRect(p.x + 8, p.y + 14, p.w - 16, 22, 6, "#c98f4a"); roundRect(p.x + 8, p.y + 14, p.w - 16, 5, 3, "#e0b068");
}
// ===== Real 3D: raw WebGL (no libraries). Lit cubes, perspective camera, depth buffer. =====
const glc = $("#gl-canvas"); let gl = null, U = {};
function initGL() {
  if (gl) return true;
  gl = glc.getContext("webgl", { antialias: true }); if (!gl) return false;
  const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); return o; };
  const pr = gl.createProgram();
  gl.attachShader(pr, sh(gl.VERTEX_SHADER, "attribute vec3 p,n;uniform mat4 vp;uniform vec3 pos,sc;uniform float yw;varying vec3 vn;varying float fd;void main(){vec3 q=p*sc;float c=cos(yw),s=sin(yw);q=vec3(c*q.x+s*q.z,q.y,-s*q.x+c*q.z);gl_Position=vp*vec4(q+pos,1.);vn=vec3(c*n.x+s*n.z,n.y,-s*n.x+c*n.z);fd=gl_Position.w;}"));
  gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, "precision mediump float;uniform vec3 col,sky;varying vec3 vn;varying float fd;void main(){float l=.52+.48*floor(max(dot(normalize(vn),normalize(vec3(.5,1.,.7))),0.)*3.+.5)/3.;gl_FragColor=vec4(mix(col*l,sky,clamp(fd/110.,0.,1.)),1.);}"));
  gl.linkProgram(pr); gl.useProgram(pr);
  const v = [], F = [[[0,0,1],[1,0,0],[0,1,0]],[[0,0,-1],[-1,0,0],[0,1,0]],[[1,0,0],[0,0,-1],[0,1,0]],[[-1,0,0],[0,0,1],[0,1,0]],[[0,1,0],[1,0,0],[0,0,-1]],[[0,-1,0],[1,0,0],[0,0,1]]];
  for (const [n, a, b] of F) for (const [s, t] of [[-1,-1],[1,-1],[1,1],[-1,-1],[1,1],[-1,1]]) v.push(...[0,1,2].map(i => n[i] * .5 + a[i] * s * .5 + b[i] * t * .5), ...n);
  MESH[0] = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, MESH[0]); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(v), gl.STATIC_DRAW);
  for (const [k, o] of [["p", 0], ["n", 12]]) { const l = gl.getAttribLocation(pr, k); gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, 3, gl.FLOAT, false, 24, o); AL.push([l, o]); }
  { const sv = [], LA = 10, LO = 14, pt = (a, b) => { const th = a / LA * Math.PI, ph = b / LO * 6.2832, x = Math.sin(th) * Math.cos(ph), y = Math.cos(th), z = Math.sin(th) * Math.sin(ph); return [x * .5, y * .5, z * .5, x, y, z]; };
    for (let i = 0; i < LA; i++) for (let k = 0; k < LO; k++) { const A = pt(i, k), B = pt(i + 1, k), C = pt(i + 1, k + 1), D = pt(i, k + 1); sv.push(...A, ...C, ...B, ...A, ...D, ...C); }
    SPHN = sv.length / 6; MESH[1] = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, MESH[1]); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(sv), gl.STATIC_DRAW); gl.bindBuffer(gl.ARRAY_BUFFER, MESH[0]); }
  for (const k of ["vp", "pos", "sc", "col", "sky", "yw"]) U[k] = gl.getUniformLocation(pr, k);
  gl.enable(gl.DEPTH_TEST); gl.enable(gl.CULL_FACE);
  camLook([0, 5, 7], [0, 1.2, -14]); return true;
}
function camLook(e, c) {
  const f = 1 / Math.tan(.55), a = 16 / 9, n = .1, fa = 260, P = [f / a,0,0,0, 0,f,0,0, 0,0,(fa+n)/(n-fa),-1, 0,0,2*fa*n/(n-fa),0];
  const sub = (x, y) => x.map((q, i) => q - y[i]), nm = x => x.map(q => q / Math.hypot(...x));
  const cr = (x, y) => [x[1]*y[2]-x[2]*y[1], x[2]*y[0]-x[0]*y[2], x[0]*y[1]-x[1]*y[0]], dt = (x, y) => x[0]*y[0]+x[1]*y[1]+x[2]*y[2];
  const z = nm(sub(e, c)), x = nm(cr([0,1,0], z)), y = cr(z, x), V = [x[0],y[0],z[0],0, x[1],y[1],z[1],0, x[2],y[2],z[2],0, -dt(x,e),-dt(y,e),-dt(z,e),1];
  const VP = []; for (let i = 0; i < 4; i++) for (let r = 0; r < 4; r++) { let s = 0; for (let k = 0; k < 4; k++) s += P[k*4+r] * V[i*4+k]; VP[i*4+r] = s; }
  VPM = VP; gl.uniformMatrix4fv(U.vp, false, VP);
}
const MESH = [], AL = []; let OUT = false, CUR = 0, SPHN = 0, HS = 0, ambient = null, GY = 0, VPM = null;
function bindMesh(i) { gl.bindBuffer(gl.ARRAY_BUFFER, MESH[i]); for (const [l, o] of AL) gl.vertexAttribPointer(l, 3, gl.FLOAT, false, 24, o); CUR = i; }
function ball(x, y, z, sx, sy, sz, c) { if (CUR !== 1) { bindMesh(1); gl.disable(gl.CULL_FACE); } gl.uniform1f(U.yw, GY); gl.uniform3f(U.pos, x, y, z); gl.uniform3f(U.sc, sx, sy, sz); if (OUT) { gl.enable(gl.CULL_FACE); gl.cullFace(gl.FRONT); gl.uniform3f(U.sc, sx * 1.08 + .07, sy * 1.08 + .07, sz * 1.08 + .07); gl.uniform3f(U.col, .05, .04, .08); gl.drawArrays(gl.TRIANGLES, 0, SPHN); gl.cullFace(gl.BACK); gl.disable(gl.CULL_FACE); gl.uniform3f(U.sc, sx, sy, sz); } gl.uniform3f(U.col, ...c); gl.drawArrays(gl.TRIANGLES, 0, SPHN); }
function box(x, y, z, sx, sy, sz, c) { if (CUR !== 0) { bindMesh(0); gl.enable(gl.CULL_FACE); } gl.uniform1f(U.yw, GY); if (OUT) { gl.cullFace(gl.FRONT); gl.uniform3f(U.pos, x, y, z); gl.uniform3f(U.sc, sx * 1.08 + .07, sy * 1.08 + .07, sz * 1.08 + .07); gl.uniform3f(U.col, .05, .04, .08); gl.drawArrays(gl.TRIANGLES, 0, 36); gl.cullFace(gl.BACK); } gl.uniform3f(U.pos, x, y, z); gl.uniform3f(U.sc, sx, sy, sz); gl.uniform3f(U.col, ...c); gl.drawArrays(gl.TRIANGLES, 0, 36); }
function drawGL() {
  const sky = [.85, .91, .93]; camLook([0, 5, 7], [0, 1.2, -14]); GY = 0; gl.viewport(0, 0, glc.width, glc.height); gl.clearColor(...sky, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); gl.uniform3f(U.sky, ...sky);
  const sc = (state.world * 5) % 8; box(0, -.5, -50, 11, 1, 130, [.62, .72, .62]);
  for (let i = 0; i < 16; i++) { const z = 8 - i * 8 + sc, h = 5 + 4 * Math.abs(Math.sin(i + Math.floor(state.world * 5 / 8))); box(-8.5, h / 2, z, 4, h, 6, [.45, .6, .58]); box(8.5, h / 2, z, 4, h, 6, [.5, .62, .6]); box(0, .02, z, .25, .05, 3, [1, .96, .85]); }
  for (const o of state.obstacles) { const s = o.size * 14, z = -(o.z - .12) * 70; box(o.lane * 3, s / 2, z, s, s, s, o.lane === 0 ? [.91, .63, .43] : [.37, .61, .55]); }
  const t = performance.now() / 1000, X = state.lane * 3, Y = state.jump * 1.8, w = Math.sin(t * 14) * .18;
  box(X, Y + .75, 0, 1.2, .8, 1.8, [.66, .46, .3]); box(X, Y + 1.15, -1.1, .85, .75, .85, [.73, .53, .37]); box(X, Y + 1, -1.65, .5, .35, .3, [.84, .65, .48]);
  box(X - .3, Y + 1.6, -.95, .2, .25, .15, [.55, .37, .24]); box(X + .3, Y + 1.6, -.95, .2, .25, .15, [.55, .37, .24]); box(X, Y + 1.7, -1.1, .3, .3, .3, [.95, .64, .2]);
  box(X - .45, Y + .2 + (state.jump ? 0 : w), -.6, .3, .4, .3, [.42, .29, .19]); box(X + .45, Y + .2 - (state.jump ? 0 : w), -.6, .3, .4, .3, [.42, .29, .19]);
  box(X - .45, Y + .2 - (state.jump ? 0 : w), .6, .3, .4, .3, [.42, .29, .19]); box(X + .45, Y + .2 + (state.jump ? 0 : w), .6, .3, .4, .3, [.42, .29, .19]);
  box(X, .02, 0, 1.6, .03, 2.2, [.36, .5, .42]);
}
glc.addEventListener("pointermove", e => { if (e.buttons && currentGame === "Bee Swarm") { CAM.yaw -= e.movementX * .006; CAM.pitch = clamp(CAM.pitch + e.movementY * .004, .25, 1.3); } });
glc.addEventListener("wheel", e => { if (currentGame === "Bee Swarm") { e.preventDefault(); CAM.dist = clamp(CAM.dist + e.deltaY * .012, 8, 32); } }, { passive: false });
glc.addEventListener("pointerdown", () => canvas.dispatchEvent(new PointerEvent("pointerdown")));

// ================= Capy Blaster (shooter), Pond Snake =================
const X = {}, clamp = (v, a, b) => Math.max(a, Math.min(b, v)), dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const axis = () => [(keys.has("d") ? 1 : 0) - (keys.has("a") ? 1 : 0), (keys.has("s") ? 1 : 0) - (keys.has("w") ? 1 : 0)];
function initNewGames() {
  X.b = { x: 400, y: 400, bul: [], en: [], eb: [], hp: 5, cd: 0, kills: 0, inv: 0, t: 0, spawn: 1, stars: Array.from({ length: 60 }, () => [Math.random() * 800, Math.random() * 450, .3 + Math.random()]) };
  initBee();
  X.p = { y: 185, ay: 185, bx: 400, by: 225, vx: -300, vy: 120, pts: 0, l: 3, t: 0 };
  X.m = { x: 355, w: 90, bx: 400, by: 408, vx: 0, vy: 0, live: false, l: 3, bricks: [] }; if (currentGame === "Mud Bricks") buildBricks();
  X.s = { body: [[20, 11], [19, 11], [18, 11]], dir: [1, 0], t: 0, food: null, eaten: 0 };
  if (currentGame === "Pond Snake") placeFood();
}
function hurtBlaster() { const b = X.b; if (b.inv > 0) return; b.hp--; b.inv = 1.1; sound("hit"); if (b.hp <= 0) state.hit = true; }
function updateBlaster(dt) {
  const b = X.b, st = state.stage; b.t += dt; b.cd -= dt; b.inv -= dt; b.spawn -= dt;
  const [dx, dy] = axis(); b.x = clamp(b.x + dx * 330 * dt, 20, 780); b.y = clamp(b.y + dy * 330 * dt, 200, 430);
  if (keys.has(" ") && b.cd <= 0) { b.bul.push({ x: b.x, y: b.y - 20 }); b.cd = .17; sound("flip"); }
  if (b.spawn <= 0) { b.spawn = Math.max(.3, 1.1 - st * .08); b.en.push({ x: 40 + Math.random() * 720, y: -20, ph: Math.random() * 6, v: 80 + st * 12, hp: st > 6 ? 2 : 1, f: 1 + Math.random() * 2 }); }
  for (const e of b.en) {
    e.y += e.v * dt; e.x = clamp(e.x + Math.sin(b.t * 2 + e.ph) * 70 * dt, 15, 785); e.f -= dt;
    if (st >= 3 && e.f <= 0 && e.y > 0 && e.y < 300) { e.f = 2.4; const d = Math.hypot(b.x - e.x, b.y - e.y) || 1; b.eb.push({ x: e.x, y: e.y + 14, vx: (b.x - e.x) / d * (150 + st * 10), vy: (b.y - e.y) / d * (150 + st * 10) }); }
    if (dist(e, b) < 24) { e.hp = 0; hurtBlaster(); }
  }
  for (const u of b.bul) { u.y -= 620 * dt; for (const e of b.en) if (e.hp > 0 && Math.abs(e.x - u.x) < 18 && Math.abs(e.y - u.y) < 16) { e.hp--; u.y = -99; if (e.hp <= 0) { b.kills++; score = b.kills * 10; sound("coin"); canvasBurst(e.x, e.y, 6); } } }
  for (const e of b.eb) { e.x += e.vx * dt; e.y += e.vy * dt; if (dist(e, b) < 14) { e.y = 999; hurtBlaster(); } }
  b.bul = b.bul.filter(u => u.y > -20); b.en = b.en.filter(e => e.hp > 0 && e.y < 470); b.eb = b.eb.filter(e => e.y < 470 && e.x > -10 && e.x < 810 && e.y > -10);
  stageCheck(1 + Math.floor(b.kills / 10)); scoreDisplay.textContent = `SCORE ${score} · ${"♥".repeat(Math.max(0, b.hp))} · WAVE ${state.stage}`;
}
function drawBlaster() {
  const b = X.b; const g = ctx.createLinearGradient(0, 0, 0, 450); g.addColorStop(0, "#0d1030"); g.addColorStop(1, "#2a1f55"); ctx.fillStyle = g; ctx.fillRect(0, 0, 800, 450);
  ctx.fillStyle = "#fff"; for (const s of b.stars) { s[1] = (s[1] + s[2] * .8) % 450; ctx.globalAlpha = .4 + s[2] * .4; ctx.fillRect(s[0], s[1], 1.6, 1.6 + s[2]); } ctx.globalAlpha = 1;
  ctx.fillStyle = "#e3dcff"; ctx.font = "bold 17px system-ui"; ctx.fillText("CAPY BLASTER", 24, 35); ctx.font = "12px system-ui"; ctx.fillStyle = "#b6b6d4"; ctx.fillText(`Wave ${state.stage}/10`, 24, 55);
  ctx.textAlign = "center"; ctx.font = "26px system-ui"; for (const e of b.en) ctx.fillText(e.hp > 1 ? "👹" : "👾", e.x, e.y + 9);
  ctx.textAlign = "left"; ctx.shadowBlur = prefs.vfx ? 14 : 0; ctx.shadowColor = "#7ef0df"; ctx.fillStyle = "#9ffcf0"; for (const u of b.bul) roundRect(u.x - 2, u.y - 8, 4, 16, 2, "#9ffcf0");
  ctx.shadowColor = "#ff6fa5"; ctx.fillStyle = "#ff6fa5"; for (const e of b.eb) { ctx.beginPath(); ctx.arc(e.x, e.y, 5, 0, 7); ctx.fill(); } ctx.shadowBlur = 0;
  if (b.inv > 0 && Math.floor(b.t * 14) % 2) return;
  ctx.save(); ctx.translate(b.x, b.y); ctx.shadowBlur = prefs.vfx ? 18 : 0; ctx.shadowColor = "#7ef0df"; ctx.fillStyle = "#4fd1c0"; ctx.beginPath(); ctx.moveTo(0, -24); ctx.lineTo(20, 16); ctx.lineTo(0, 8); ctx.lineTo(-20, 16); ctx.closePath(); ctx.fill(); ctx.shadowBlur = 0;
  ctx.fillStyle = "#ba895e"; ctx.beginPath(); ctx.ellipse(0, -2, 9, 8, 0, 0, 7); ctx.fill(); ctx.fillStyle = "#d5a67b"; ctx.beginPath(); ctx.ellipse(0, 2, 6, 4, 0, 0, 7); ctx.fill(); ctx.fillStyle = "#222"; ctx.fillRect(-4, -5, 2, 3); ctx.fillRect(2, -5, 2, 3);
  ctx.fillStyle = "#ffb347"; ctx.fillRect(-2, 18, 4, 5 + Math.random() * 6); ctx.restore();
}
// ---- Bee Swarm: 3D honey-farming game (WebGL) ----
let beeSave = null; try { beeSave = JSON.parse(localStorage.getItem("capyBee") || "null"); } catch {}
const CAM = { yaw: 0, pitch: .7, dist: 20, x: 0, z: 14 }, COL = { w: [1, 1, .95], r: [.95, .27, .27], b: [.3, .52, .95] }, css = c => `rgb(${c.map(v => v * 255 | 0)})`;
const ZONES = [{ n: "Starting Area", need: 0, zmin: -30 }, { n: "5-Bee Zone", need: 5, zmin: -72 }, { n: "10-Bee Zone", need: 10, zmin: -135 }];
const FIELDS = [["Sunflower Field", "w", 24, -10, 3], ["Dandelion Field", "w", -24, -10, 3], ["Mushroom Field", "r", -26, -52, 4], ["Blue Flower Field", "b", 26, -52, 4], ["Strawberry Field", "r", -26, -98, 5], ["Bamboo Field", "b", 26, -98, 5], ["Pine Tree Forest", "w", 0, -114, 6]].map(([n, col, x, z, rich]) => ({ n, col, x, z, rich }));
const BAG = [200, 500, 1200, 3000], BAGN = ["Pouch", "Jar", "Backpack", "Giant Bag"], BAGP = [0, 400, 1500, 5000], TOOL = [{ n: "Scooper", r: 3.2, a: 1 }, { n: "Rake", r: 4, a: 2 }, { n: "Clippers", r: 5, a: 3 }, { n: "Magnet Staff", r: 6.5, a: 5 }], TOOLP = [0, 300, 1200, 4000];
const eggPrice = s => 150 + 120 * Math.max(0, s.bees.length - 3), bagUsed = s => s.bag.w + s.bag.r + s.bag.b, mixc = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
function rig(x, y, z, yaw) { const c = Math.cos(yaw), n = Math.sin(yaw), mk = f => (ox, oy, oz, sx, sy, sz, col, ya = 0) => { GY = yaw + ya; f(x + c * ox + n * oz, y + oy, z - n * ox + c * oz, sx, sy, sz, col); }, P = mk(box); P.b = mk(ball); return P; }
function proj(x, y, z) { const c = VPM, w = c[3] * x + c[7] * y + c[11] * z + c[15]; return [(c[0] * x + c[4] * y + c[8] * z + c[12]) / w, (c[1] * x + c[5] * y + c[9] * z + c[13]) / w, w]; }
function popText(x, y, z, txt, col) { if (!VPM) return; const [sx, sy, w] = proj(x, y, z); if (w <= 0) return; const p = document.createElement("span"); p.className = "pop"; p.textContent = txt; p.style.color = col; p.style.left = (sx + 1) * 50 + "%"; p.style.top = (1 - sy) * 50 + "%"; $("#canvas-wrap").appendChild(p); setTimeout(() => p.remove(), 900); }
const LAB = new Map();
function label(id, txt, x, y, z) { let e = LAB.get(id); if (!e) { e = document.createElement("span"); e.className = "nametag"; $("#canvas-wrap").appendChild(e); LAB.set(id, e); } const [sx, sy, w] = proj(x, y, z); if (w <= 0 || w > 90 || Math.abs(sx) > 1.2) { e.style.display = "none"; return; } e.style.display = ""; e.textContent = txt; e.style.left = (sx + 1) * 50 + "%"; e.style.top = (1 - sy) * 50 + "%"; }
function clearLabels() { LAB.forEach(e => e.remove()); LAB.clear(); }
function spark(x, y, z, n, col, up = 5) { const s = X.bee; if (!s || !prefs.vfx || prefs.reduceMotion) return; for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, v = 2 + Math.random() * 3; s.parts.push({ x, y, z, vx: Math.cos(a) * v, vy: up * (.4 + Math.random()), vz: Math.sin(a) * v, life: .5 + Math.random() * .4, col, sz: .15 + Math.random() * .2 }); } if (s.parts.length > 160) s.parts.splice(0, s.parts.length - 160); }
function initBee() {
  const sv = beeSave || {}, fl = [];
  FIELDS.forEach((F, fi) => { for (let i = 0; i < 6; i++) for (let k = 0; k < 6; k++) fl.push({ x: F.x + (i - 2.5) * 2.6 + Math.sin(i * 7 + k * 3 + fi) * .5, z: F.z + (k - 2.5) * 2.6 + Math.cos(i * 5 + k * 11 + fi) * .5, col: F.col, p: F.rich, max: F.rich, rg: 0, ph: i + k }); });
  const bees = (sv.bees || ["w", "r", "b"]).map((t, i) => ({ t, x: i * 2, y: 3, z: 12, yaw: 0, tgt: null, tm: 0, ct: 0 }));
  X.bee = { x: 0, z: 14, yaw: Math.PI, honey: sv.honey || 0, total: sv.total || 0, bag: { w: 0, r: 0, b: 0 }, bagLv: sv.bagLv || 0, toolLv: sv.toolLv || 0, fl, bees, conv: false, t: 0, cd: 0, swing: 0, mv: false, parts: [], gate: [0, 0], eH: false, shop: false, tk: 0 };
  Object.assign(CAM, { yaw: 0, pitch: .7, dist: 20, x: 0, z: 14 }); $("#shop").hidden = true;
}
function saveBee() { const s = X.bee; if (!s) return; beeSave = { honey: Math.floor(s.honey), total: Math.floor(s.total), bees: s.bees.map(b => b.t), bagLv: s.bagLv, toolLv: s.toolLv }; try { localStorage.setItem("capyBee", JSON.stringify(beeSave)); } catch {} saveProgress(); }
function hatch(s) { const r = Math.random(), t = r < .5 ? "w" : r < .75 ? "r" : "b", n = s.bees.length; s.bees.push({ t, x: s.x, y: 3, z: s.z, yaw: 0, tgt: null, tm: 0, ct: 0 }); sound("reveal"); toast(`You hatched a ${t === "w" ? "White" : t === "r" ? "Red" : "Blue"} Bee! 🐝`); spark(s.x, 3, s.z, 24, COL[t], 8);
  if (n + 1 === 5 || n + 1 === 10) setTimeout(() => { sound("level"); toast(`🔓 ${ZONES[n + 1 === 5 ? 1 : 2].n} unlocked!`); }, 1200); }
function openBeeShop() { X.bee.shop = true; renderBeeShop(); $("#shop").hidden = false; sound("click"); }
function closeBeeShop() { if (X.bee) X.bee.shop = false; $("#shop").hidden = true; }
function renderBeeShop() {
  const s = X.bee, nb = s.bagLv + 1, nt = s.toolLv + 1, row = (ic, t, sm, act, p, dis) => `<div class="shop-row"><i style="background:${ic}"></i><span><b>${t}</b><small>${sm}</small></span>${act ? `<button data-act="${act}" ${dis ? "disabled" : ""}>🍯${p}</button>` : "<em>MAX</em>"}</div>`;
  $("#shop-title").textContent = "🛒 Bee Shop"; $("#shop-beli").textContent = "🍯 " + Math.floor(s.honey);
  $("#shop-body").innerHTML = row("#f6e6b8", "Basic Egg", `Hatches a random bee · hive ${s.bees.length}/50 · price rises each egg`, "egg", eggPrice(s), s.honey < eggPrice(s) || s.bees.length >= 50) + row("#c9a46a", nb < BAG.length ? `${BAGN[nb]}` : `${BAGN[s.bagLv]}`, nb < BAG.length ? `Backpack: ${BAG[s.bagLv]} → ${BAG[nb]} pollen` : "Best backpack owned", nb < BAG.length ? "bag" : "", BAGP[nb], s.honey < BAGP[nb]) + row("#9aa7b5", nt < TOOL.length ? TOOL[nt].n : TOOL[s.toolLv].n, nt < TOOL.length ? `Tool: ${TOOL[s.toolLv].n} → bigger reach & more pollen per swing` : "Best tool owned", nt < TOOL.length ? "tool" : "", TOOLP[nt], s.honey < TOOLP[nt]);
}
$("#shop-close").addEventListener("click", closeBeeShop);
$("#bee-shop-btn").addEventListener("click", () => { if (X.bee && !X.bee.shop) openBeeShop(); });
$("#shop-body").addEventListener("click", e => { const a = e.target.closest("button")?.dataset.act, s = X.bee; if (!a || !s) return;
  if (a === "egg" && s.honey >= eggPrice(s) && s.bees.length < 50) { s.honey -= eggPrice(s); hatch(s); } else if (a === "bag" && s.honey >= BAGP[s.bagLv + 1]) { s.honey -= BAGP[s.bagLv + 1]; s.bagLv++; sound("cash"); } else if (a === "tool" && s.honey >= TOOLP[s.toolLv + 1]) { s.honey -= TOOLP[s.toolLv + 1]; s.toolLv++; sound("cash"); }
  saveBee(); renderBeeShop(); });
function updateBee(dt) {
  const s = X.bee, e = keys.has("e");
  if (s.shop) { if (e && !s.eH) closeBeeShop(); s.eH = e; return; }
  s.t += dt; s.cd -= dt; s.swing -= dt;
  CAM.yaw += ((keys.has("ArrowLeft") ? 1 : 0) - (keys.has("ArrowRight") ? 1 : 0)) * 1.9 * dt; CAM.pitch = clamp(CAM.pitch + ((keys.has("ArrowDown") ? 1 : 0) - (keys.has("ArrowUp") ? 1 : 0)) * 1.1 * dt, .25, 1.3);
  const fw = (keys.has("w") ? 1 : 0) - (keys.has("s") ? 1 : 0), rt = (keys.has("d") ? 1 : 0) - (keys.has("a") ? 1 : 0), sy = Math.sin(CAM.yaw), cy = Math.cos(CAM.yaw), mx = -sy * fw + cy * rt, mz = -cy * fw - sy * rt, ml = Math.hypot(mx, mz), zi = s.bees.length >= 10 ? 2 : s.bees.length >= 5 ? 1 : 0;
  s.mv = ml > 0; if (s.mv) { s.x = clamp(s.x + mx / ml * 11 * dt, -62, 62); s.z = clamp(s.z + mz / ml * 11 * dt, ZONES[zi].zmin, 26); s.yaw = Math.atan2(-mx, -mz); } else s.z = Math.max(s.z, ZONES[zi].zmin);
  const T = TOOL[s.toolLv], cap = BAG[s.bagLv];
  if (s.cd <= 0) { s.cd = .4; let n = 0; for (const f of s.fl) { if (n >= 3 || bagUsed(s) >= cap) break; if (f.p <= 0 || Math.hypot(f.x - s.x, f.z - s.z) > T.r) continue; const g = Math.min(T.a, f.p, cap - bagUsed(s)); f.p -= g; s.bag[f.col] += g; n++; popText(f.x, 2, f.z, "+" + g, css(COL[f.col])); spark(f.x, 1.2, f.z, 5, COL[f.col]); } if (n) { s.swing = .3; sound("flip"); } }
  s.bees.forEach((b, i) => {
    if (b.tgt && (b.tgt.p <= 0 || bagUsed(s) >= cap)) { b.tgt.claim = null; b.tgt = null; }
    if (!b.tgt && (b.tm -= dt) <= 0) { b.tm = .5; if (bagUsed(s) < cap) { let best = null, bd = 1e9; for (const f of s.fl) if (f.p > 0 && !f.claim && Math.hypot(f.x - s.x, f.z - s.z) < 24) { const d = Math.hypot(f.x - b.x, f.z - b.z) - (f.col === b.t ? 8 : 0); if (d < bd) { bd = d; best = f; } } if (best) { b.tgt = best; best.claim = b; } } }
    let tx, ty, tz; if (b.tgt) { tx = b.tgt.x; ty = 2.4; tz = b.tgt.z; } else { const a = s.t * .9 + i * 2.1; tx = s.x + Math.cos(a) * 3.2; ty = 3.3 + Math.sin(s.t * 2 + i) * .5; tz = s.z + Math.sin(a) * 3.2; }
    const k = 1 - Math.pow(.015, dt); b.yaw = Math.atan2(-(tx - b.x), -(tz - b.z)) || b.yaw; b.x += (tx - b.x) * k; b.y += (ty - b.y) * k; b.z += (tz - b.z) * k;
    if (b.tgt && Math.hypot(b.tgt.x - b.x, b.tgt.z - b.z) < 1.4) { b.ct += dt; if (b.ct > .55) { b.ct = 0; const f = b.tgt, g = Math.min(cap - bagUsed(s), (f.col === b.t ? 2 : 1)); f.p -= 1; s.bag[f.col] += g; popText(f.x, 2.6, f.z, "+" + g, css(COL[f.col])); spark(f.x, 1.5, f.z, 4, COL[f.col]); } }
  });
  for (const f of s.fl) if (f.p < f.max && (f.rg += dt) > 4) { f.p++; f.rg = 0; }
  const pad = Math.hypot(s.x + 8, s.z - 8) < 5, shop = Math.hypot(s.x - 8, s.z - 8) < 5;
  if (e && !s.eH) { if (shop) openBeeShop(); else if (pad && bagUsed(s) > 0) { s.conv = !s.conv; if (s.conv) sound("quest"); } } s.eH = e;
  if (s.conv) { if (!pad || bagUsed(s) <= 0) { s.conv = false; saveBee(); } else { const u = bagUsed(s), amt = Math.min(u, 10 * s.bees.length * dt); for (const c of "wrb") s.bag[c] = Math.max(0, s.bag[c] - amt * s.bag[c] / u); s.honey += amt; s.total += amt; score = Math.floor(s.total); if ((s.tk += dt) > .22) { s.tk = 0; sound("tick"); spark(s.x, 2.6, s.z, 2, [1, .8, .2], 3); } } }
  for (const p of s.parts) { p.life -= dt; p.vy -= 12 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; } s.parts = s.parts.filter(p => p.life > 0 && p.y > -.3);
  ZONES.slice(1).forEach((Z, i) => { s.gate[i] += ((s.bees.length >= Z.need ? 1 : 0) - s.gate[i]) * Math.min(1, dt * 3); });
  hudBee(s, pad, shop);
}
function hudBee(s, pad, shop) {
  const g = id => document.getElementById(id), cap = BAG[s.bagLv], u = bagUsed(s);
  g("bh-honey").textContent = "🍯 " + Math.floor(s.honey); g("bh-bees").textContent = `🐝 ${s.bees.length}/50`; g("bh-zone").textContent = s.z > -30 ? ZONES[0].n : s.z > -72 ? ZONES[1].n : ZONES[2].n;
  for (const c of "wrb") g("bg-" + c).style.width = s.bag[c] / cap * 100 + "%"; g("bh-bagt").textContent = `${Math.floor(u)} / ${cap}`;
  const pr = g("bh-prompt"); pr.hidden = false; pr.textContent = s.conv ? "🍯 Making honey… (E to stop)" : shop ? "E — Open the Bee Shop" : pad ? (u > 0 ? "E — Make Honey" : "Collect pollen first!") : u >= cap ? "Bag full! Return to the hive pad" : ""; if (!pr.textContent) pr.hidden = true;
  scoreDisplay.textContent = `HONEY ${Math.floor(s.honey)} · BEES ${s.bees.length}`;
}
function drawBee() {
  const s = X.bee, t = performance.now() / 1000, sky = [.6, .82, .97]; GY = 0; OUT = false;
  gl.viewport(0, 0, glc.width, glc.height); gl.clearColor(...sky, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); gl.uniform3f(U.sky, ...sky);
  const cp = Math.cos(CAM.pitch); CAM.x += (s.x - CAM.x) * .12; CAM.z += (s.z - CAM.z) * .12;
  camLook([CAM.x + Math.sin(CAM.yaw) * cp * CAM.dist, 2 + Math.sin(CAM.pitch) * CAM.dist, CAM.z + Math.cos(CAM.yaw) * cp * CAM.dist], [CAM.x, 2, CAM.z]);
  box(0, -.6, -50, 400, 1, 500, [.45, .75, .4]); box(0, -.5, -51, 130, 1, 42, [.38, .68, .36]); box(0, -.5, -103.5, 130, 1, 63, [.5, .46, .7]); box(0, -.45, 12, 44, 1, 36, [.9, .8, .55]);
  box(0, 6, 25, 36, 12, 3, [.62, .42, .2]); box(0, 12.6, 25, 40, 1.6, 6, [.5, .25, .15]);
  for (let i = 0; i < 50; i++) { const own = i < s.bees.length, c = own ? mixc(COL[s.bees[i].t], [1, .8, .2], .5) : [.42, .28, .14]; ball(-13.5 + (i % 10) * 3, 2.2 + Math.floor(i / 10) * 2, 23.3, 2.3, 2.3, .8, c); }
  box(-8, .25, 8, 6, .3, 6, [1, .8, .2 + .15 * Math.sin(t * 4)]); box(-8, 2.5, 11, 2, 5, 2, [.9, .72, .15]); ball(-8, 5.4, 11, 2.4, 1.6, 2.4, [1, .85, .3]);
  box(8, 1.1, 8, 4, 2.2, 3, [.6, .35, .2]); ball(8, 3.8 + Math.sin(t * 2) * .2, 8, 2.4, 3, 2.4, [.96, .92, .82]);
  ZONES.slice(1).forEach((Z, i) => { const g = s.gate[i], z0 = ZONES[i].zmin; box(0, 3 * (1 - g) + .2, z0, 124, 6 * (1 - g) + .4, 1.5, g > .9 ? [.5, .85, .5] : [.85, .3, .3]); box(-62, 5, z0, 3, 10, 3, [.45, .3, .2]); box(62, 5, z0, 3, 10, 3, [.45, .3, .2]); });
  for (let i = 0; i < 16; i++) { const x = (i % 2 ? 1 : -1) * (36 + (i * 7) % 20), z = 20 - i * 9.5; box(x, 2, z, .9, 4, .9, [.45, .3, .18]); ball(x, 5, z, 4.5, 4, 4.5, [.3, .6, .3]); }
  for (let i = 0; i < 8; i++) box(CAM.x + ((i * 61 + t * 1.5) % 220) - 110, 45, CAM.z - 70 + i * 9, 18, 2.5, 8, [1, 1, 1]);
  FIELDS.forEach(F => box(F.x, 0, F.z, 17, .16, 17, mixc(COL[F.col], [.4, .7, .35], .75)));
  for (const f of s.fl) { if (Math.abs(f.z - CAM.z) > 60 || Math.abs(f.x - CAM.x) > 60) continue; const k = f.p > 0 ? .5 + .5 * f.p / f.max : .3, sw = Math.sin(t * 2 + f.ph) * .06; box(f.x, .55 * k + .05, f.z, .14, 1.1 * k, .14, [.25, .6, .25]); ball(f.x + sw, 1.1 * k + .25, f.z, .9 * k + .2, .5 * k + .15, .9 * k + .2, f.p > 0 ? COL[f.col] : [.5, .55, .45]); if (f.p > 0) ball(f.x + sw, 1.1 * k + .4, f.z, .35, .25, .35, [1, .85, .2]); }
  const P = rig(s.x, 0, s.z, s.yaw); OUT = true; const u = bagUsed(s), fill = Math.min(1, u / BAG[s.bagLv]), dom = s.bag.r > s.bag.b && s.bag.r > s.bag.w ? COL.r : s.bag.b > s.bag.w ? COL.b : COL.w, sw = s.swing > 0 ? Math.sin((1 - s.swing / .3) * 3.14) * 1.1 : 0, ya = sw * .7;
  P.b(0, 1.5 + (s.mv ? Math.abs(Math.sin(t * 12)) * .12 : 0), 0, 1.7, 2.8, 1.7, [.25, .5, .95]); P.b(-.35, 2.3, -.7, .4, .45, .3, [1, 1, 1]); P.b(.35, 2.3, -.7, .4, .45, .3, [1, 1, 1]); P.b(-.35, 2.3, -.88, .2, .25, .16, [.1, .1, .1]); P.b(.35, 2.3, -.88, .2, .25, .16, [.1, .1, .1]);
  P(0, 1.6, .95, 1.3, 1.5, .6, [.85, .82, .75]); if (fill > 0) P(0, .9 + .7 * fill, 1.02, 1.1, 1.4 * fill, .5, dom);
  P(1.1, 1.3, -1, .16, .16, 2.2, [.6, .4, .25], ya); P.b(1.1 - Math.sin(ya) * 1.1, 1.3, -1 - Math.cos(ya) * 1.1, .9, .4, .9, [.8, .82, .88]);
  s.bees.forEach((b, i) => { const B = rig(b.x, b.y, b.z, b.yaw || 0), fl = Math.sin(t * 40 + i) * .3; B.b(0, 0, 0, .9, .8, 1.2, [1, .82, .15]); B.b(0, 0, .25, .95, .82, .35, [.15, .12, .1]); B.b(0, 0, -.65, .6, .6, .6, [.15, .12, .1]); B.b(0, .5, 0, .5, .3, .5, COL[b.t]); B.b(-.55, .5 + fl, 0, .9, .08, .5, [.9, .97, 1]); B.b(.55, .5 - fl, 0, .9, .08, .5, [.9, .97, 1]); });
  OUT = false; GY = 0;
  for (const p of s.parts) { const k = Math.max(.15, p.life * 2); ball(p.x, p.y, p.z, p.sz * k, p.sz * k, p.sz * k, p.col); }
  FIELDS.forEach((F, i) => label("f" + i, F.n, F.x, 5, F.z)); ZONES.slice(1).forEach((Z, i) => label("g" + i, s.bees.length >= Z.need ? `✅ ${Z.n}` : `🔒 ${Z.n}: needs ${Z.need} bees (${s.bees.length}/${Z.need})`, 0, 9, ZONES[i].zmin));
  label("hv", "🐝 Your Hive", 0, 15, 25); label("pd", "🍯 Make Honey", -8, 7.5, 8); label("sh", "🛒 Bee Shop", 8, 6.5, 8);
}
// ---- Pond Snake ----
function placeFood() { const s = X.s; do { s.food = [Math.floor(Math.random() * 40), Math.floor(Math.random() * 22)]; } while (s.body.some(b => b[0] === s.food[0] && b[1] === s.food[1])); }
function updateSnake(dt) {
  const s = X.s; const d = s.dir;
  if (keys.has("w") && d[1] === 0) s.next = [0, -1]; else if (keys.has("s") && d[1] === 0) s.next = [0, 1]; else if (keys.has("a") && d[0] === 0) s.next = [-1, 0]; else if (keys.has("d") && d[0] === 0) s.next = [1, 0];
  s.t += dt; const step = Math.max(.055, .17 - state.stage * .011);
  if (s.t < step) return; s.t = 0; if (s.next) s.dir = s.next;
  const h = [s.body[0][0] + s.dir[0], s.body[0][1] + s.dir[1]];
  if (h[0] < 0 || h[1] < 0 || h[0] >= 40 || h[1] >= 22 || s.body.some(b => b[0] === h[0] && b[1] === h[1])) { state.hit = true; return; }
  s.body.unshift(h);
  if (h[0] === s.food[0] && h[1] === s.food[1]) { s.eaten++; score = s.eaten; sound("coin"); canvasBurst(h[0] * 20 + 10, h[1] * 20 + 15, 6); placeFood(); stageCheck(1 + Math.floor(s.eaten / 5)); } else s.body.pop();
  scoreDisplay.textContent = `CLOVERS ${score} · STAGE ${state.stage}`;
}
function drawSnake() {
  const s = X.s; for (let y = 0; y < 22; y++) for (let x = 0; x < 40; x++) { ctx.fillStyle = (x + y) % 2 ? "#9fd0b4" : "#94c8aa"; ctx.fillRect(x * 20, y * 20 + 5, 20, 20); }
  ctx.fillStyle = "#1d4d38"; ctx.font = "bold 15px system-ui"; ctx.fillText(`POND SNAKE · Stage ${state.stage}/10`, 12, 18);
  ctx.font = "18px system-ui"; ctx.fillText("🍀", s.food[0] * 20 + 1, s.food[1] * 20 + 20);
  s.body.forEach((b, i) => roundRect(b[0] * 20 + 1, b[1] * 20 + 6, 18, 18, i ? 6 : 8, `hsl(${150 - Math.min(i, 30)},50%,${30 + Math.min(i, 24) * .6}%)`));
  const h = s.body[0], ex = s.dir[1] ? 5 : 0, ey = s.dir[0] ? 5 : 0; ctx.fillStyle = "#fff"; ctx.fillRect(h[0] * 20 + 5 + s.dir[0] * 3 - ex * .4, h[1] * 20 + 10 + s.dir[1] * 3 - ey * .4, 4, 4); ctx.fillRect(h[0] * 20 + 11 + s.dir[0] * 3 + ex * .4, h[1] * 20 + 10 + s.dir[1] * 3 + ey * .4, 4, 4);
}

// ---- Capy Pong ----
function serve(dir) { const p = X.p, sp = 280 + state.stage * 24; p.bx = 400; p.by = 225; p.vx = dir * sp; p.vy = (Math.random() - .5) * 220; }
function updatePong(dt) {
  const p = X.p, st = state.stage; p.t += dt; p.y = clamp(p.y + ((keys.has("s") ? 1 : 0) - (keys.has("w") ? 1 : 0)) * 400 * dt, 8, 362);
  const tgt = p.by - 40, sp = Math.min(380, 130 + st * 28); p.ay += clamp(tgt - p.ay, -sp * dt, sp * dt); p.ay = clamp(p.ay, 8, 362);
  p.bx += p.vx * dt; p.by += p.vy * dt; if (p.by < 10 || p.by > 440) { p.vy = -p.vy; p.by = clamp(p.by, 10, 440); sound("flip"); }
  if (p.vx < 0 && p.bx < 50 && p.bx > 26 && p.by > p.y - 6 && p.by < p.y + 86) { p.vx = Math.abs(p.vx) * 1.04; p.vy += (p.by - p.y - 40) * 7; sound("jump"); spark(p.bx, p.by, 5, 170); }
  if (p.vx > 0 && p.bx > 750 && p.bx < 774 && p.by > p.ay - 6 && p.by < p.ay + 86) { p.vx = -Math.abs(p.vx) * 1.02; p.vy += (p.by - p.ay - 40) * 6; sound("flip"); spark(p.bx, p.by, 4, 330); }
  if (p.bx < -10) { p.l--; sound("hit"); if (p.l <= 0) state.hit = true; else serve(-1); }
  if (p.bx > 810) { p.pts++; score = p.pts; sound("coin"); spark(780, p.by, 10); serve(1); stageCheck(1 + Math.floor(p.pts / 2)); }
  scoreDisplay.textContent = `POINTS ${p.pts} · ${"♥".repeat(Math.max(0, p.l))} · STAGE ${state.stage}`;
}
function drawPong() {
  const p = X.p, g = ctx.createLinearGradient(0, 0, 0, 450); g.addColorStop(0, "#0f2a2e"); g.addColorStop(1, "#16423f"); ctx.fillStyle = g; ctx.fillRect(0, 0, 800, 450);
  ctx.strokeStyle = "#ffffff30"; ctx.lineWidth = 3; ctx.setLineDash([12, 14]); ctx.beginPath(); ctx.moveTo(400, 0); ctx.lineTo(400, 450); ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle = "#b9e8d5"; ctx.font = "bold 17px system-ui"; ctx.fillText(`CAPY PONG · Stage ${state.stage}/10`, 24, 32);
  ctx.shadowBlur = prefs.vfx ? 16 : 0; ctx.shadowColor = "#7ef0df"; roundRect(30, p.y, 14, 80, 7, "#7ef0df"); ctx.shadowColor = "#ff85b2"; roundRect(756, p.ay, 14, 80, 7, "#ff85b2");
  ctx.shadowColor = "#ffe08a"; ctx.fillStyle = "#ffe08a"; ctx.beginPath(); ctx.arc(p.bx, p.by, 9, 0, 7); ctx.fill(); ctx.shadowBlur = 0;
  ctx.font = "20px system-ui"; ctx.fillText("🐹", 14, p.y + 46);
}
// ---- Mud Bricks ----
function buildBricks() {
  const m = X.m, rows = Math.min(8, 2 + state.stage); m.bricks = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < 10; c++) if (!(state.stage > 3 && (c + r) % 7 === 0)) m.bricks.push({ x: 36 + c * 73, y: 70 + r * 26, w: 67, h: 20, h2: 20 + r * 38 });
  m.live = false; m.vx = m.vy = 0;
}
function updateBricks(dt) {
  const m = X.m; m.x = clamp(m.x + ((keys.has("d") ? 1 : 0) - (keys.has("a") ? 1 : 0)) * 520 * dt, 0, 800 - m.w);
  if (!m.live) { m.bx = m.x + m.w / 2; m.by = 408; if (keys.has(" ")) { m.live = true; const sp = 280 + state.stage * 22; m.vx = sp * .5; m.vy = -sp; sound("start"); } }
  else {
    m.bx += m.vx * dt; m.by += m.vy * dt;
    if (m.bx < 8 || m.bx > 792) { m.vx = -m.vx; m.bx = clamp(m.bx, 8, 792); sound("flip"); } if (m.by < 8) { m.vy = Math.abs(m.vy); sound("flip"); }
    if (m.vy > 0 && m.by > 400 && m.by < 422 && m.bx > m.x - 6 && m.bx < m.x + m.w + 6) { const k = (m.bx - m.x) / m.w - .5, sp = Math.hypot(m.vx, m.vy); m.vx = k * sp * 1.6; m.vy = -Math.sqrt(Math.max(1, sp * sp - m.vx * m.vx)); sound("jump"); }
    for (const b of m.bricks) if (!b.dead && m.bx > b.x - 8 && m.bx < b.x + b.w + 8 && m.by > b.y - 8 && m.by < b.y + b.h + 8) { b.dead = true; m.vy = -m.vy; score++; sound("coin"); spark(b.x + b.w / 2, b.y + b.h / 2, 6, b.h2); break; }
    m.bricks = m.bricks.filter(b => !b.dead);
    if (m.by > 460) { m.l--; sound("hit"); m.live = false; if (m.l <= 0) state.hit = true; }
    if (!m.bricks.length) { stageCheck(state.stage + 1); if (!state.won) buildBricks(); }
  }
  scoreDisplay.textContent = `BRICKS ${score} · ${"♥".repeat(Math.max(0, m.l))} · LEVEL ${Math.min(10, state.stage)}`;
}
function drawBricks() {
  const m = X.m, g = ctx.createLinearGradient(0, 0, 0, 450); g.addColorStop(0, "#f6e7cf"); g.addColorStop(1, "#d9bf94"); ctx.fillStyle = g; ctx.fillRect(0, 0, 800, 450);
  ctx.fillStyle = "#6b4a2e"; ctx.font = "bold 17px system-ui"; ctx.fillText(`MUD BRICKS · Level ${Math.min(10, state.stage)}/10`, 24, 32);
  for (const b of m.bricks) { roundRect(b.x, b.y + 3, b.w, b.h, 5, "#0002"); roundRect(b.x, b.y, b.w, b.h, 5, `hsl(${b.h2 % 360},45%,52%)`); roundRect(b.x + 3, b.y + 3, b.w - 6, 4, 2, "#fff4"); }
  ctx.shadowBlur = prefs.vfx ? 14 : 0; ctx.shadowColor = "#2f7d52"; roundRect(m.x, 410, m.w, 14, 7, "#3f8a60"); ctx.shadowBlur = 0; ctx.font = "16px system-ui"; ctx.fillText("🐹", m.x + m.w / 2 - 9, 406);
  ctx.fillStyle = "#c0392b"; ctx.beginPath(); ctx.arc(m.bx, m.by, 8, 0, 7); ctx.fill(); if (!m.live) { ctx.fillStyle = "#6b4a2e"; ctx.font = "12px system-ui"; ctx.fillText("Press Space to launch", 330, 440); }
}
function drawGame(){if(currentGame==="Capy Hop")drawCapyHop();else if(currentGame==="Neon Dodge")drawNeonDodge();else if(currentGame==="Cube Canyon"){if(!glc.hidden)drawGL();else drawCubeCanyon();}else if(currentGame==="Pocket Garden")drawGarden();else if(currentGame==="Snack Catch")drawSnackCatch();else if(currentGame==="Capy Blaster")drawBlaster();else if(currentGame==="Bee Swarm")drawBee();else if(currentGame==="Pond Snake")drawSnake();else if(currentGame==="Capy Pong")drawPong();else if(currentGame==="Mud Bricks")drawBricks();}
updateGames();

// ---------- Accounts (stored in this browser only) ----------
const ACC = "capyAccounts", SES = "capySession", authDialog = $("#auth-dialog");
let authMode = "login";
const enc = s => new TextEncoder().encode(s), hex = b => [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, "0")).join("");
const accounts = () => { try { return JSON.parse(localStorage.getItem(ACC) || "{}"); } catch { return {}; } };
async function hashPw(pw, salt) {
  const k = await crypto.subtle.importKey("raw", enc(pw), "PBKDF2", false, ["deriveBits"]);
  return hex(await crypto.subtle.deriveBits({ name: "PBKDF2", salt: enc(salt), iterations: 150000, hash: "SHA-256" }, k, 256));
}
function noteStage(n) { if (n > (stageBest[currentGame] || 0)) { stageBest[currentGame] = n; saveProgress(); } }
function saveProgress() {
  if (!user) return;
  try { const all = accounts(); if (!all[user]) return; all[user].data = { favorites: [...favorites], best: bestScores, stage: stageBest, prefs, bee: beeSave }; localStorage.setItem(ACC, JSON.stringify(all)); } catch {}
}
function renderUser() {
  $("#profile-name").textContent = user || "Guest"; $(".profile-avatar").textContent = (user || "G")[0].toUpperCase();
  $("#auth-button").textContent = user ? "Log out" : "Log in";
}
function loginAs(name, isNew) {
  user = name; try { localStorage.setItem(SES, name); } catch {}
  if (isNew) saveProgress();
  else { const d = accounts()[name].data || {}; favorites = new Set(d.favorites || []); bestScores = { ...bestScores, ...(d.best || {}) }; stageBest = d.stage || {}; if (d.bee) beeSave = d.bee; prefs = { ...defaults, ...(d.prefs || {}) }; }
  renderUser(); updateGames(); syncSettings();
  if (authDialog.open) authDialog.close();
  toast(isNew ? `Welcome, ${name}! Progress saves to your account.` : `Welcome back, ${name}!`);
}
function setAuthMode(m) { authMode = m; $$("[data-auth-tab]").forEach(b => b.classList.toggle("active", b.dataset.authTab === m)); $("#auth-submit").textContent = m === "login" ? "Log in" : "Create account"; $("#auth-error").textContent = ""; }
$$("[data-auth-tab]").forEach(b => b.addEventListener("click", () => setAuthMode(b.dataset.authTab)));
$("#auth-form").addEventListener("submit", async e => {
  e.preventDefault(); const name = $("#auth-user").value.trim().toLowerCase(), pw = $("#auth-pass").value, err = $("#auth-error");
  if (!/^[a-z0-9_]{3,20}$/.test(name)) { err.textContent = "Username: 3–20 letters, numbers or _."; return; }
  if (pw.length < 6) { err.textContent = "Password needs at least 6 characters."; return; }
  if (!window.crypto?.subtle) { err.textContent = "Accounts need https:// or localhost."; return; }
  const all = accounts();
  if (authMode === "register") {
    if (all[name]) { err.textContent = "That username is taken."; return; }
    const salt = hex(crypto.getRandomValues(new Uint8Array(16)));
    all[name] = { salt, hash: await hashPw(pw, salt), data: {} };
    try { localStorage.setItem(ACC, JSON.stringify(all)); } catch { err.textContent = "Couldn't save the account in this browser."; return; }
    loginAs(name, true);
  } else {
    const a = all[name];
    if (!a || await hashPw(pw, a.salt) !== a.hash) { err.textContent = "Wrong username or password."; return; }
    loginAs(name, false);
  }
  e.target.reset();
});
$("#auth-guest").addEventListener("click", () => authDialog.close());
$("#auth-button").addEventListener("click", () => { if (user) { try { localStorage.removeItem(SES); } catch {} location.reload(); } else authDialog.showModal(); });
{ let s = null; try { s = localStorage.getItem(SES); } catch {} if (s && accounts()[s]) loginAs(s, false); else { renderUser(); authDialog.showModal(); } }

// ---------- Capy Buddy (assistant) ----------
// Local helper. To plug in a real AI, set BUDDY.endpoint to YOUR OWN backend that accepts {message} and returns {reply}.
const BUDDY = { endpoint: "" };
function buddyReply(q) {
  q = q.toLowerCase(); const names = Object.keys(GAME_INFO), g = names.find(n => q.includes(n.toLowerCase()));
  if (g) return `${g}: ${GAME_INFO[g].description} Controls: ${GAME_INFO[g].controls.replace(/\s{2,}/g, " · ")}`;
  if (/^(hi|hey|hello|yo)\b/.test(q)) return "Hi! I'm Capy Buddy 🐹 Ask me about a game, its controls, or what to play next!";
  if (/shoot|blast|space/.test(q)) return "Try Capy Blaster! Move with WASD and hold Space to fire.";
  if (/3d|bee|honey|pollen|flower/.test(q)) return "Bee Swarm is a 3D honey-farming game, and Cube Canyon is a 3D runner. Want the controls for either?";
  if (/relax|cozy|chill|calm/.test(q)) return "For chill vibes: Pocket Garden (memory match) or Pond Snake.";
  if (/puzzle|brain|memory/.test(q)) return "Pocket Garden and Mud Bricks are my puzzle picks.";
  if (/recommend|suggest|what should|bored|random|play/.test(q)) return `How about ${names[Math.floor(Math.random() * names.length)]}? Ask me about it for controls.`;
  if (/list|all games|what games|what do you have/.test(q)) return `We have ${names.length} games: ${names.join(", ")}.`;
  if (/control|wasd|keys|move|mobile|touch|phone/.test(q)) return "Most games use WASD + Space. On phones, on-screen buttons appear inside the game window. P pauses.";
  if (/account|login|log in|register|save|progress/.test(q)) return "Register from the Log in button. Your favorites, best scores and furthest stages save to your account in this browser.";
  if (/music|sound|song|volume|mute/.test(q)) return "Open Settings (⚙) to switch sound effects and theme music on or off.";
  if (/stage|level|10/.test(q)) return "Most games have 10 stages. Your furthest stage is saved when you're logged in.";
  return "I'm not sure about that one! Try asking about a game by name, controls, or 'recommend something'.";
}
function buddyAdd(text, who) { const m = document.createElement("div"); m.className = "buddy-msg " + who; m.textContent = text; $("#buddy-log").appendChild(m); $("#buddy-log").scrollTop = 1e6; }
$("#buddy-button").addEventListener("click", () => { const p = $("#buddy-panel"); p.hidden = !p.hidden; if (!p.hidden) { if (!$("#buddy-log").children.length) buddyAdd("Hi! I'm Capy Buddy 🐹 Ask me about any game!", "bot"); $("#buddy-input").focus(); } sound(); });
$("#buddy-close").addEventListener("click", () => { $("#buddy-panel").hidden = true; });
$("#buddy-form").addEventListener("submit", async e => {
  e.preventDefault(); const inp = $("#buddy-input"), q = inp.value.trim(); if (!q) return; inp.value = ""; buddyAdd(q, "me"); let r = "";
  if (BUDDY.endpoint) { try { const res = await fetch(BUDDY.endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: q }) }); r = (await res.json()).reply || ""; } catch {} }
  setTimeout(() => buddyAdd(r || buddyReply(q), "bot"), 300);
});


