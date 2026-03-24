/*
 * Neon Glass Snake - production-style vanilla JS canvas game
 * Architecture: EventBus, GameEngine, Renderer, SnakeSystem, FoodSystem, ParticleSystem,
 * InputManager, UIManager, AudioManager.
 */

const STORAGE_KEYS = {
  highScore: 'neonSnake.highScore',
  stats: 'neonSnake.stats',
  leaderboard: 'neonSnake.leaderboard',
  ghost: 'neonSnake.ghostPath',
  settings: 'neonSnake.settings',
  progression: 'neonSnake.progression',
  cosmetics: 'neonSnake.cosmetics'
};
const GAME_MODES = {
  classic: { label: 'CLASSIC', wrap: false, timeLimit: 0, speedBoost: 0 },
  timeAttack: { label: 'TIME ATTACK', wrap: false, timeLimit: 90, speedBoost: 8 },
  survival: { label: 'ENDLESS SURVIVAL', wrap: false, timeLimit: 0, speedBoost: -10 },
  noWalls: { label: 'NO WALLS', wrap: true, timeLimit: 0, speedBoost: 0 },
  hardcore: { label: 'HARDCORE', wrap: false, timeLimit: 0, speedBoost: 40 }
};
const SKINS = [
  { key: 'default', name: 'Default', minLevel: 1 },
  { key: 'plasma', name: 'Plasma', minLevel: 3 },
  { key: 'ember', name: 'Ember', minLevel: 5 }
];
const TRAILS = [
  { key: 'neon', name: 'Neon', minLevel: 1 },
  { key: 'stardust', name: 'Stardust', minLevel: 4 }
];

const DIFFICULTIES = {
  easy: { speed: 180, spawnWindow: 8, riskChance: 0.2 },
  medium: { speed: 145, spawnWindow: 7, riskChance: 0.35 },
  hard: { speed: 120, spawnWindow: 5.5, riskChance: 0.45 },
  extreme: { speed: 102, spawnWindow: 4.8, riskChance: 0.6 }
};

const THEMES = {
  cyberpunk: { body: ['#00f7ff', '#26ff91', '#b366ff'], bg: ['#060915', '#13072f', '#000000'] },
  neon: { body: ['#00ffff', '#ff00ff', '#ffff00'], bg: ['#061526', '#21053a', '#010101'] },
  retro: { body: ['#37ff00', '#91ff44', '#56b400'], bg: ['#001100', '#001900', '#000000'] },
  minimal: { body: ['#ffffff', '#d9d9d9', '#a5a5a5'], bg: ['#151515', '#1f1f1f', '#030303'] }
};

const POWERUP_TYPES = ['speed', 'slowmo', 'double', 'invincible'];
const ACHIEVEMENTS = [
  { key: 'score100', text: 'Score 100', test: s => s.score >= 100 },
  { key: 'combo10', text: '10 combo streak', test: s => s.bestCombo >= 10 },
  { key: 'survive60', text: 'Survive 60 seconds', test: s => s.survivalTime >= 60 }
];

const NAVIGATION_BONUS = {
  EDGE_DISTANCE: 28,
  EDGE_SCORE: 0.08,
  DENSE_MIN_SEGMENT: 10,
  DENSE_RADIUS: 38,
  DENSE_COUNT: 3,
  DENSE_SCORE: 0.16,
  PRECISION_TURN_RATE: 8,
  PRECISION_SPEED: 190,
  PRECISION_SCORE: 0.18
};

class EventBus {
  constructor() { this.events = new Map(); }
  on(name, cb) { if (!this.events.has(name)) this.events.set(name, []); this.events.get(name).push(cb); }
  emit(name, payload) { (this.events.get(name) || []).forEach(cb => cb(payload)); }
}

class AudioManager {
  constructor() {
    this.enabled = true;
    this.ctx = null;
    this.master = null;
    this.ambientOsc = null;
    this.ambientGain = null;
  }
  init() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.18;
    this.master.connect(this.ctx.destination);
  }
  tone(freq, duration, type = 'sine', gain = 0.08, sweep = 1) {
    if (!this.enabled || !this.ctx) return;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq * sweep), this.ctx.currentTime + duration);
    g.gain.value = gain;
    g.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);
    osc.connect(g);
    g.connect(this.master);
    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }
  startAmbient() {
    if (!this.enabled || !this.ctx || this.ambientOsc) return;
    this.ambientOsc = this.ctx.createOscillator();
    this.ambientGain = this.ctx.createGain();
    this.ambientOsc.type = 'triangle';
    this.ambientOsc.frequency.value = 90;
    this.ambientGain.gain.value = 0.018;
    this.ambientOsc.connect(this.ambientGain);
    this.ambientGain.connect(this.master);
    this.ambientOsc.start();
  }
  setIntensity(v) {
    if (!this.ctx || !this.ambientOsc) return;
    const clamped = Math.min(1, Math.max(0, v));
    this.ambientOsc.frequency.setTargetAtTime(90 + clamped * 140, this.ctx.currentTime, 0.25);
    this.ambientGain.gain.setTargetAtTime(0.015 + clamped * 0.03, this.ctx.currentTime, 0.25);
  }
  stopAmbient() {
    if (!this.ambientOsc || !this.ctx) return;
    this.ambientGain.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.2);
    setTimeout(() => {
      this.ambientOsc?.stop();
      this.ambientOsc = null;
      this.ambientGain = null;
    }, 260);
  }
  eat(combo) { this.tone(480 + combo * 22, 0.12, 'sine', 0.1, 1.35); }
  combo(combo) { this.tone(680 + combo * 28, 0.15, 'square', 0.08, 1.18); }
  gameOver() { this.tone(320, 0.18, 'sawtooth', 0.16, 0.75); setTimeout(() => this.tone(180, 0.4, 'triangle', 0.12, 0.5), 120); }
  powerup() { this.tone(760, 0.14, 'square', 0.12, 1.4); }
}

class ParticleSystem {
  constructor() {
    this.items = [];
    this.pool = Array.from({ length: 320 }, () => ({ active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, size: 0, color: '#fff' }));
  }
  getParticle() {
    return this.pool.find(p => !p.active);
  }
  emit(x, y, vx, vy, life, size, color) {
    const p = this.getParticle();
    if (!p) return;
    p.active = true;
    p.x = x; p.y = y; p.vx = vx; p.vy = vy; p.life = life; p.size = size; p.color = color;
    this.items.push(p);
  }
  burst(x, y, color, count = 20, spread = 1) {
    for (let i = 0; i < count; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const speed = (40 + Math.random() * 160) * spread;
      this.emit(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, 0.4 + Math.random() * 0.6, 1 + Math.random() * 4, color);
    }
  }
  trail(x, y, color) {
    this.emit(x, y, (Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12, 0.15 + Math.random() * 0.2, 1 + Math.random() * 2.2, color);
  }
  update(dt) {
    this.items = this.items.filter(p => {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.97;
      p.vy *= 0.97;
      if (p.life <= 0) {
        p.active = false;
        return false;
      }
      return true;
    });
  }
  draw(ctx) {
    for (const p of this.items) {
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life));
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}

class InputManager {
  constructor(bus, canvas) {
    this.bus = bus;
    this.canvas = canvas;
    this.buffer = [];
    this.touchStart = null;
    this.debugMode = false;
  }
  init() {
    document.addEventListener('keydown', (e) => {
      const map = {
        ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
        w: 'up', a: 'left', s: 'down', d: 'right', W: 'up', A: 'left', S: 'down', D: 'right'
      };
      if (map[e.key]) this.buffer.push(map[e.key]);
      if (e.key.toLowerCase() === 'p') this.bus.emit('togglePause');
      if (e.key.toLowerCase() === 'm') this.bus.emit('toggleMute');
      if (e.key.toLowerCase() === 'f') {
        this.debugMode = !this.debugMode;
        this.bus.emit('toggleDebug', this.debugMode);
      }
    });

    this.canvas.addEventListener('touchstart', e => {
      const t = e.touches[0];
      this.touchStart = { x: t.clientX, y: t.clientY };
    }, { passive: true });

    this.canvas.addEventListener('touchend', e => {
      if (!this.touchStart) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - this.touchStart.x;
      const dy = t.clientY - this.touchStart.y;
      if (Math.hypot(dx, dy) < 24) return;
      this.buffer.push(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
      this.bus.emit('hapticPulse');
    }, { passive: true });
  }
  consume() { return this.buffer.shift(); }
}

class SnakeSystem {
  constructor() {
    this.segmentDistance = 14;
    this.speed = 140;
    this.turnSpeed = 13;
    this.invincible = 0;
    this.growth = 3;
    this.turnRate = 0;
    this.breathPhase = 0;
    this.wrapMode = false;
    this.reset();
  }
  reset(bounds = { w: 700, h: 700 }) {
    this.bounds = bounds;
    const cx = bounds.w * 0.5;
    const cy = bounds.h * 0.5;
    this.head = { x: cx, y: cy, angle: 0, targetAngle: 0 };
    this.segments = Array.from({ length: 18 }, (_, i) => ({ x: cx - i * this.segmentDistance, y: cy }));
    this.trail = [];
  }
  setDirection(dir) {
    const angles = { up: -Math.PI / 2, down: Math.PI / 2, left: Math.PI, right: 0 };
    if (angles[dir] === undefined) return;
    this.head.targetAngle = angles[dir];
  }
  applyPowerup(type) {
    if (type === 'speed') this.speed = Math.min(270, this.speed + 34);
    if (type === 'slowmo') this.speed = Math.max(95, this.speed - 30);
    if (type === 'invincible') this.invincible = 4;
  }
  update(dt) {
    this.invincible = Math.max(0, this.invincible - dt);
    this.breathPhase += dt * (2.2 + this.speed * 0.002);
    const diff = Math.atan2(Math.sin(this.head.targetAngle - this.head.angle), Math.cos(this.head.targetAngle - this.head.angle));
    this.turnRate = Math.abs(diff) / Math.max(dt, 0.0001);
    this.head.angle += diff * Math.min(1, dt * this.turnSpeed);
    const microWobble = Math.sin(this.breathPhase * 5.5) * 0.03 + (Math.random() - 0.5) * 0.014;
    const driveAngle = this.head.angle + microWobble;
    this.head.x += Math.cos(driveAngle) * this.speed * dt;
    this.head.y += Math.sin(driveAngle) * this.speed * dt;

    if (this.wrapMode) {
      if (this.head.x < 0) this.head.x = this.bounds.w;
      if (this.head.y < 0) this.head.y = this.bounds.h;
      if (this.head.x > this.bounds.w) this.head.x = 0;
      if (this.head.y > this.bounds.h) this.head.y = 0;
    }

    this.segments[0] = { x: this.head.x, y: this.head.y };
    for (let i = 1; i < this.segments.length; i += 1) {
      const prev = this.segments[i - 1];
      const cur = this.segments[i];
      const dx = prev.x - cur.x;
      const dy = prev.y - cur.y;
      const d = Math.hypot(dx, dy) || 1;
      const desired = this.segmentDistance;
      const delay = Math.max(0.17, 0.34 - i * 0.004);
      const pull = (d - desired) * delay;
      cur.x += (dx / d) * pull;
      cur.y += (dy / d) * pull;
    }

    this.trail.push({ x: this.head.x, y: this.head.y, life: 0.7 });
    if (this.trail.length > 180) this.trail.shift();
    this.trail.forEach(t => { t.life -= dt; });
    this.trail = this.trail.filter(t => t.life > 0);

    while (this.growth > 0) {
      const tail = this.segments[this.segments.length - 1];
      this.segments.push({ x: tail.x, y: tail.y });
      this.growth -= 1;
    }
  }
  grow(n = 4) { this.growth += n; }
  collidesWithSelf() {
    const h = this.segments[0];
    return this.segments.slice(9).some(s => Math.hypot(h.x - s.x, h.y - s.y) < this.segmentDistance * 0.68);
  }
  nearMissRisk() {
    const h = this.segments[0];
    return this.segments.slice(8).some(s => {
      const d = Math.hypot(h.x - s.x, h.y - s.y);
      return d > this.segmentDistance * 0.75 && d < this.segmentDistance * 1.2;
    });
  }
  collidesWall() {
    if (this.wrapMode) return false;
    const m = 12;
    return this.head.x < m || this.head.y < m || this.head.x > this.bounds.w - m || this.head.y > this.bounds.h - m;
  }
}

class FoodSystem {
  constructor() {
    this.food = null;
    this.powerup = null;
    this.comboWindow = 2.8;
    this.lastEat = 0;
  }
  randomPoint(bounds, margin = 40) {
    return {
      x: margin + Math.random() * (bounds.w - margin * 2),
      y: margin + Math.random() * (bounds.h - margin * 2)
    };
  }
  spawn(bounds, snakeSegments, danger = false) {
    let p = this.randomPoint(bounds);
    let loops = 0;
    while (snakeSegments.some(s => Math.hypot(s.x - p.x, s.y - p.y) < 52) && loops < 100) {
      p = this.randomPoint(bounds);
      loops += 1;
    }
    this.food = { ...p, radius: danger ? 11 : 9, life: danger ? 6 : 12, danger, bornAt: performance.now() / 1000 };
  }
  spawnPowerup(bounds) {
    this.powerup = { ...this.randomPoint(bounds), type: POWERUP_TYPES[Math.floor(Math.random() * POWERUP_TYPES.length)], life: 8, radius: 12 };
  }
  update(dt) {
    if (this.food) this.food.life -= dt;
    if (this.powerup) this.powerup.life -= dt;
    if (this.food && this.food.life <= 0) this.food = null;
    if (this.powerup && this.powerup.life <= 0) this.powerup = null;
  }
}

class Renderer {
  constructor(canvas, bgCanvas, particles, getTheme) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.bgCanvas = bgCanvas;
    this.bgCtx = bgCanvas.getContext('2d');
    this.particles = particles;
    this.getTheme = getTheme;
    this.layers = Array.from({ length: 44 }, () => ({ x: Math.random(), y: Math.random(), z: 0.2 + Math.random() * 1.8 }));
    this.ambient = Array.from({ length: 70 }, () => ({ x: Math.random(), y: Math.random(), vx: (Math.random() - 0.5) * 0.0003, vy: (Math.random() - 0.5) * 0.0003 }));
    this.zoom = 1;
    this.shake = 0;
    this.tilt = 0;
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }
  resize() {
    const size = Math.max(320, Math.min(window.innerWidth - 24, window.innerHeight - 180, 820));
    this.canvas.width = size;
    this.canvas.height = size;
    this.canvas.style.width = `${size}px`;
    this.canvas.style.height = `${size}px`;
    this.bgCanvas.width = window.innerWidth;
    this.bgCanvas.height = window.innerHeight;
  }
  pulseShake(v = 8) { this.shake = Math.max(this.shake, v); }
  drawBackground(time, score) {
    const ctx = this.bgCtx;
    const w = this.bgCanvas.width;
    const h = this.bgCanvas.height;
    const theme = this.getTheme();
    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, theme.bg[0]);
    grad.addColorStop(0.5, theme.bg[1]);
    grad.addColorStop(1, theme.bg[2]);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    for (const p of this.layers) {
      const px = (p.x * w + time * 0.02 * p.z) % w;
      const py = (p.y * h + Math.sin(time * 0.0006 + p.z) * 45 * p.z) % h;
      ctx.fillStyle = `rgba(150,220,255,${0.08 * p.z})`;
      ctx.beginPath();
      ctx.arc(px, py, p.z * 1.8, 0, Math.PI * 2);
      ctx.fill();
    }

    const vignette = ctx.createRadialGradient(w * 0.5, h * 0.5, h * 0.15, w * 0.5, h * 0.5, h * 0.75);
    vignette.addColorStop(0, 'rgba(120,180,255,0.09)');
    vignette.addColorStop(1, 'rgba(0,0,0,0.65)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, w, h);

    const hue = (time * 0.01 + Math.min(140, score * 0.8)) % 360;
    ctx.fillStyle = `hsla(${hue}, 90%, 55%, 0.06)`;
    ctx.fillRect(0, 0, w, h);

    for (const a of this.ambient) {
      a.x = (a.x + a.vx) % 1;
      a.y = (a.y + a.vy) % 1;
      ctx.fillStyle = 'rgba(180,220,255,0.18)';
      ctx.beginPath();
      ctx.arc(a.x * w, a.y * h, 1.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  drawState(state, debug = false) {
    const ctx = this.ctx;
    const { snake, foodSystem, time, score, timeScale } = state;
    const theme = this.getTheme();
    this.zoom += ((1 + Math.min(0.15, score * 0.0012)) - this.zoom) * 0.08;
    this.tilt += ((Math.sin(snake.head.angle) * 0.008) + Math.min(0.03, snake.turnRate * 0.0004) - this.tilt) * 0.1;
    this.shake *= 0.87;

    ctx.save();
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    const sx = (Math.random() - 0.5) * this.shake;
    const sy = (Math.random() - 0.5) * this.shake;
    ctx.translate(this.canvas.width / 2 + sx, this.canvas.height / 2 + sy);
    ctx.rotate(this.tilt);
    ctx.scale(this.zoom, this.zoom);
    ctx.translate(-this.canvas.width / 2, -this.canvas.height / 2);

    const bg = ctx.createLinearGradient(0, 0, this.canvas.width, this.canvas.height);
    bg.addColorStop(0, 'rgba(10,15,35,0.7)');
    bg.addColorStop(1, 'rgba(3,4,10,0.82)');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    for (const t of snake.trail) {
      ctx.globalAlpha = t.life * 0.35;
      ctx.strokeStyle = theme.body[0];
      ctx.lineWidth = 6 + (1 - t.life) * 8;
      ctx.beginPath();
      ctx.arc(t.x, t.y, 2 + (1 - t.life) * 2, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    if (foodSystem.food) this.drawFood(foodSystem.food, time, snake.segments[0]);
    if (foodSystem.powerup) this.drawPowerup(foodSystem.powerup, time);

    this.drawGhost(state.ghost);

    const grad = ctx.createLinearGradient(0, 0, this.canvas.width, this.canvas.height);
    grad.addColorStop(0, theme.body[0]);
    grad.addColorStop(0.5, theme.body[1]);
    grad.addColorStop(1, theme.body[2]);
    ctx.strokeStyle = grad;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.shadowColor = theme.body[0];
    ctx.shadowBlur = 14 + Math.min(24, snake.speed * 0.09) + Math.min(16, score * 0.04);
    ctx.lineWidth = 14 + Math.sin(snake.breathPhase) * 0.9;
    ctx.beginPath();
    ctx.moveTo(snake.segments[0].x, snake.segments[0].y);
    for (let i = 1; i < snake.segments.length; i += 1) {
      const p = snake.segments[i - 1];
      const c = snake.segments[i];
      const mx = (p.x + c.x) * 0.5;
      const my = (p.y + c.y) * 0.5;
      ctx.quadraticCurveTo(p.x, p.y, mx, my);
    }
    ctx.stroke();

    const h = snake.segments[0];
    const light = ctx.createRadialGradient(h.x, h.y, 0, h.x, h.y, 95);
    light.addColorStop(0, 'rgba(180,255,255,0.17)');
    light.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = light;
    ctx.fillRect(h.x - 95, h.y - 95, 190, 190);
    ctx.fillStyle = '#ffffff';
    ctx.shadowBlur = 18;
    ctx.beginPath();
    ctx.arc(h.x, h.y, 7.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    this.particles.draw(ctx);
    if (timeScale < 1) {
      ctx.fillStyle = `rgba(120,180,255,${(1 - timeScale) * 0.2})`;
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    if (debug) this.drawDebug(state);

    ctx.restore();
  }
  drawFood(food, time, head) {
    const ctx = this.ctx;
    const distance = head ? Math.hypot(head.x - food.x, head.y - food.y) : 240;
    const anticipation = Math.max(0, 1 - distance / 240);
    const pulse = 1 + Math.sin(time * 0.006) * 0.18 + anticipation * 0.2;
    ctx.save();
    ctx.shadowColor = food.danger ? '#ff4577' : '#ff66ff';
    ctx.shadowBlur = food.danger ? 30 : 24;
    const g = ctx.createRadialGradient(food.x - 2, food.y - 2, 1, food.x, food.y, 18);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.45, food.danger ? '#ff5e8d' : '#ff4fff');
    g.addColorStop(1, 'rgba(255,20,130,0.3)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(food.x, food.y, food.radius * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  drawPowerup(p, time) {
    const ctx = this.ctx;
    const colors = { speed: '#00f0ff', slowmo: '#66ffb3', double: '#ffe66e', invincible: '#ff8cff' };
    ctx.save();
    ctx.strokeStyle = colors[p.type];
    ctx.fillStyle = `${colors[p.type]}44`;
    ctx.shadowColor = colors[p.type];
    ctx.shadowBlur = 20;
    const r = p.radius + Math.sin(time * 0.01) * 2;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
  drawGhost(ghost) {
    if (!ghost?.length) return;
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = 0.2;
    ctx.strokeStyle = '#9df4ff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(ghost[0].x, ghost[0].y);
    for (let i = 1; i < ghost.length; i += 4) ctx.lineTo(ghost[i].x, ghost[i].y);
    ctx.stroke();
    ctx.restore();
  }
  drawDebug(state) {
    const { snake } = state;
    const ctx = this.ctx;
    ctx.save();
    ctx.strokeStyle = '#ffdf33';
    ctx.lineWidth = 1;
    for (const s of snake.segments) {
      ctx.strokeRect(s.x - 8, s.y - 8, 16, 16);
    }
    ctx.strokeStyle = '#ff4466';
    ctx.beginPath();
    ctx.moveTo(snake.head.x, snake.head.y);
    ctx.lineTo(snake.head.x + Math.cos(snake.head.angle) * 30, snake.head.y + Math.sin(snake.head.angle) * 30);
    ctx.stroke();
    ctx.restore();
  }
}

class UIManager {
  constructor(bus) {
    this.bus = bus;
    this.score = document.getElementById('score');
    this.high = document.getElementById('high-score');
    this.comboDisplay = document.getElementById('combo-display');
    this.comboValue = document.getElementById('combo-mult');
    this.comboBar = document.getElementById('combo-bar');
    this.pauseIndicator = document.getElementById('pause-indicator');
    this.overlay = document.getElementById('canvas-overlay');
    this.fps = document.getElementById('fps-counter');
    this.fpsValue = document.getElementById('fps-value');
    this.menuLevel = document.getElementById('menu-level');
    this.floatLayer = document.createElement('div');
    this.floatLayer.className = 'ui-floating-layer';
    document.body.appendChild(this.floatLayer);
    this.achievements = document.createElement('div');
    this.achievements.className = 'achievement-stack';
    document.body.appendChild(this.achievements);
  }
  setScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(id)?.classList.add('active');
  }
  updateHUD(s) {
    this.score.textContent = Math.floor(s.displayScore);
    this.high.textContent = s.highScore;
    this.comboValue.textContent = s.combo;
    const active = s.combo > 1;
    this.comboDisplay.classList.toggle('active', active);
    this.comboBar.style.transform = `scaleX(${Math.max(0, s.comboTimer / s.comboWindow)})`;
    this.overlay.style.opacity = String(Math.min(0.45, s.nearMissGlow));
    document.querySelector('.score-display')?.classList.toggle('almost-there', s.almostThere);
    this.score.classList.toggle('pop', s.justScored);
    if (s.justScored) requestAnimationFrame(() => this.score.classList.remove('pop'));
  }
  setPause(isPaused) { this.pauseIndicator.classList.toggle('visible', isPaused); }
  flash(text, x, y, cls = 'floating-points') {
    const el = document.createElement('div');
    el.className = cls;
    el.textContent = text;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    this.floatLayer.appendChild(el);
    setTimeout(() => el.remove(), 1000);
  }
  popupAchievement(text) {
    const card = document.createElement('div');
    card.className = 'achievement-pop';
    card.textContent = `🏆 ${text}`;
    this.achievements.appendChild(card);
    setTimeout(() => card.classList.add('out'), 2000);
    setTimeout(() => card.remove(), 2500);
  }
  setDebug(visible) { this.fps.classList.toggle('visible', visible); }
  setFPS(v) { this.fpsValue.textContent = String(Math.round(v)); }
  gameOver(summary) {
    document.getElementById('final-score').textContent = summary.score;
    document.getElementById('final-high-score').textContent = summary.highScore;
    document.getElementById('food-eaten').textContent = summary.food;
    document.getElementById('snake-length').textContent = summary.length;
    document.getElementById('best-combo').textContent = `x${summary.bestCombo}`;
    document.getElementById('death-reason').textContent = summary.reason;
    document.getElementById('run-xp-summary').textContent = `+${summary.xpEarned} XP earned`;
    document.getElementById('new-record-row').style.display = summary.newRecord ? 'flex' : 'none';
    this.setScreen('game-over-screen');
  }
  setMenuLevel(level, xp) {
    if (this.menuLevel) this.menuLevel.textContent = `${level} · ${xp} XP`;
  }
}

class GameEngine {
  constructor() {
    this.bus = new EventBus();
    this.audio = new AudioManager();
    this.particles = new ParticleSystem();
    this.canvas = document.getElementById('game-canvas');
    this.bgCanvas = document.getElementById('bg-canvas');
    this.settings = this.loadSettings();
    this.theme = this.settings.theme || 'cyberpunk';
    this.mode = this.settings.mode || 'classic';
    this.renderer = new Renderer(this.canvas, this.bgCanvas, this.particles, () => THEMES[this.theme]);
    this.input = new InputManager(this.bus, this.canvas);
    this.ui = new UIManager(this.bus);
    this.snake = new SnakeSystem();
    this.foodSystem = new FoodSystem();
    this.state = 'menu';
    this.paused = false;
    this.debug = false;
    this.score = 0;
    this.displayScore = 0;
    this.combo = 1;
    this.comboTimer = 0;
    this.comboWindow = 2.8;
    this.nearMissGlow = 0;
    this.almostThere = false;
    this.justScored = false;
    this.foodCount = 0;
    this.bestCombo = 1;
    this.survivalTime = 0;
    this.highScore = Number(localStorage.getItem(STORAGE_KEYS.highScore) || 0);
    this.stats = JSON.parse(localStorage.getItem(STORAGE_KEYS.stats) || '{"games":0,"totalScore":0,"bestSurvival":0}');
    this.progression = JSON.parse(localStorage.getItem(STORAGE_KEYS.progression) || '{"xp":0,"level":1}');
    this.cosmetics = JSON.parse(localStorage.getItem(STORAGE_KEYS.cosmetics) || '{"skin":"default","trail":"neon","unlockedSkins":["default"],"unlockedTrails":["neon"]}');
    this.ghostPath = JSON.parse(localStorage.getItem(STORAGE_KEYS.ghost) || '[]');
    this.currentPath = [];
    this.achieved = new Set();
    this.elapsed = 0;
    this.last = 0;
    this.fpsFrame = 0;
    this.fpsTime = 0;
    this.timeScale = 1;
    this.pendingDeath = null;
    this.modeTimeLeft = 0;
    this.lowPerfMode = /Android|iPhone|iPad/i.test(navigator.userAgent);
    this.lastBgDraw = 0;
    this.installUIHandlers();
    this.input.init();
    this.applyTheme(this.theme);
    this.updateMenuStats();
    document.body.classList.add('intro-sequence');
    setTimeout(() => document.body.classList.remove('intro-sequence'), 2200);
    this.tick = this.tick.bind(this);
    requestAnimationFrame(this.tick);
  }

  installUIHandlers() {
    document.getElementById('start-btn').addEventListener('click', () => this.start());
    document.getElementById('restart-btn').addEventListener('click', () => this.start());
    document.getElementById('menu-btn').addEventListener('click', () => this.toMenu());
    document.getElementById('pause-btn').addEventListener('click', () => this.togglePause());
    document.getElementById('difficulty-btn').addEventListener('click', () => this.toggleModal('difficulty-modal', true));
    document.getElementById('theme-btn').addEventListener('click', () => this.toggleModal('theme-modal', true));
    document.getElementById('mode-btn').addEventListener('click', () => this.toggleModal('mode-modal', true));
    document.getElementById('close-difficulty').addEventListener('click', () => this.toggleModal('difficulty-modal', false));
    document.getElementById('close-theme').addEventListener('click', () => this.toggleModal('theme-modal', false));
    document.getElementById('close-mode').addEventListener('click', () => this.toggleModal('mode-modal', false));
    document.querySelectorAll('.difficulty-option').forEach(el => el.addEventListener('click', () => {
      this.settings.difficulty = el.dataset.difficulty;
      document.getElementById('current-difficulty').textContent = el.dataset.difficulty.toUpperCase();
      this.persistSettings();
      this.toggleModal('difficulty-modal', false);
    }));
    document.querySelectorAll('.theme-option').forEach(el => el.addEventListener('click', () => {
      this.applyTheme(el.dataset.theme);
      document.getElementById('current-theme').textContent = el.dataset.theme.toUpperCase();
      this.persistSettings();
      this.toggleModal('theme-modal', false);
    }));
    document.querySelectorAll('.mode-option').forEach(el => el.addEventListener('click', () => {
      this.settings.mode = el.dataset.mode;
      this.mode = el.dataset.mode;
      document.getElementById('current-mode').textContent = this.mode.toUpperCase();
      this.persistSettings();
      this.toggleModal('mode-modal', false);
    }));
    document.getElementById('sound-btn').addEventListener('click', () => {
      this.audio.enabled = !this.audio.enabled;
      document.getElementById('sound-icon').textContent = this.audio.enabled ? '🔊' : '🔇';
    });
    this.bus.on('togglePause', () => this.togglePause());
    this.bus.on('toggleDebug', (v) => { this.debug = v; this.ui.setDebug(v); });
    this.bus.on('toggleMute', () => {
      this.audio.enabled = !this.audio.enabled;
      document.getElementById('sound-icon').textContent = this.audio.enabled ? '🔊' : '🔇';
    });
    this.bus.on('hapticPulse', () => {
      this.canvas.classList.remove('haptic-pulse');
      void this.canvas.offsetWidth;
      this.canvas.classList.add('haptic-pulse');
    });
    document.getElementById('share-btn').addEventListener('click', async () => {
      const msg = `I scored ${Math.floor(this.score)} in Neon Snake (${this.mode.toUpperCase()})`;
      await navigator.clipboard?.writeText(msg);
      this.ui.flash('Copied score!', window.innerWidth * 0.5, window.innerHeight * 0.8, 'floating-points powerup');
    });
    document.querySelectorAll('.game-btn').forEach(btn => btn.addEventListener('click', (e) => {
      this.audio.init();
      btn.style.setProperty('--ripple-x', `${e.offsetX}px`);
      btn.style.setProperty('--ripple-y', `${e.offsetY}px`);
      btn.classList.remove('ripple');
      void btn.offsetWidth;
      btn.classList.add('ripple');
      this.audio.tone(420, 0.05, 'square', 0.035, 1.05);
    }));
  }

  loadSettings() {
    const s = JSON.parse(localStorage.getItem(STORAGE_KEYS.settings) || '{}');
    return { difficulty: s.difficulty || 'medium', theme: s.theme || 'cyberpunk', mode: s.mode || 'classic' };
  }
  persistSettings() { localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(this.settings)); }
  applyTheme(theme) {
    this.theme = theme;
    this.settings.theme = theme;
    document.body.classList.remove('theme-cyberpunk', 'theme-neon', 'theme-retro', 'theme-minimal');
    document.body.classList.add(`theme-${theme}`);
  }
  toggleModal(id, show) { document.getElementById(id).classList.toggle('active', show); }

  start() {
    this.audio.init();
    this.audio.startAmbient();
    this.state = 'playing';
    this.paused = false;
    this.score = 0;
    this.displayScore = 0;
    this.combo = 1;
    this.comboTimer = 0;
    this.nearMissGlow = 0;
    this.almostThere = false;
    this.justScored = false;
    this.foodCount = 0;
    this.bestCombo = 1;
    this.survivalTime = 0;
    this.achieved.clear();
    this.currentPath = [];
    this.pendingDeath = null;
    this.timeScale = 1;
    this.mode = this.settings.mode || 'classic';
    this.modeTimeLeft = GAME_MODES[this.mode]?.timeLimit || 0;

    this.renderer.resize();
    this.snake.speed = 130 + (4 - Object.keys(DIFFICULTIES).indexOf(this.settings.difficulty)) * 4 + (GAME_MODES[this.mode]?.speedBoost || 0);
    this.snake.reset({ w: this.canvas.width, h: this.canvas.height });
    this.snake.wrapMode = Boolean(GAME_MODES[this.mode]?.wrap);
    if (this.mode === 'hardcore') this.snake.turnSpeed = 16;
    this.foodSystem = new FoodSystem();
    this.foodSystem.spawn({ w: this.canvas.width, h: this.canvas.height }, this.snake.segments, false);
    this.ui.setScreen('game-screen');
    document.body.classList.add('cinematic');
    setTimeout(() => document.body.classList.remove('cinematic'), 1100);

    if (!localStorage.getItem('neonSnake.onboarded')) {
      this.ui.flash('Swipe / WASD / Arrows', window.innerWidth * 0.5 - 70, window.innerHeight * 0.7, 'floating-points onboarding');
      localStorage.setItem('neonSnake.onboarded', '1');
    }
  }
  toMenu() {
    this.state = 'menu';
    this.audio.stopAmbient();
    this.ui.setScreen('start-screen');
    this.updateMenuStats();
  }
  togglePause() {
    if (this.state !== 'playing') return;
    this.paused = !this.paused;
    this.ui.setPause(this.paused);
  }

  tick(ts) {
    const dtRaw = Math.min(0.033, (ts - this.last) / 1000 || 0.016);
    this.last = ts;
    this.elapsed += dtRaw;

    if (!this.lowPerfMode || ts - this.lastBgDraw > 33) {
      this.renderer.drawBackground(ts, this.score);
      this.lastBgDraw = ts;
    }
    if (this.state === 'playing' && !this.paused) this.update(dtRaw * this.timeScale);

    this.particles.update(dtRaw);
    this.renderer.drawState({
      snake: this.snake,
      foodSystem: this.foodSystem,
      time: ts,
      score: this.score,
      ghost: this.ghostPath,
      timeScale: this.timeScale
    }, this.debug);

    this.fpsFrame += 1;
    this.fpsTime += dtRaw;
    if (this.fpsTime > 0.35) {
      this.ui.setFPS(this.fpsFrame / this.fpsTime);
      this.fpsFrame = 0;
      this.fpsTime = 0;
    }
    requestAnimationFrame(this.tick);
  }

  update(dt) {
    this.survivalTime += dt;
    if (this.modeTimeLeft > 0) {
      this.modeTimeLeft -= dt;
      if (this.modeTimeLeft <= 0) {
        this.endGame('Time attack complete');
        return;
      }
    }
    const input = this.input.consume();
    if (input) this.snake.setDirection(input);

    const difficulty = DIFFICULTIES[this.settings.difficulty] || DIFFICULTIES.medium;
    const targetSpeed = 130 + Math.min(95, this.survivalTime * 2.5) + this.combo * 2.3;
    this.snake.speed += (targetSpeed - this.snake.speed) * 0.03;

    this.snake.update(dt * (this.activePowerup === 'slowmo' ? 0.6 : 1));
    const head = this.snake.segments[0];
    this.currentPath.push({ x: head.x, y: head.y });
    if (this.currentPath.length > 900) this.currentPath.shift();

    if (this.pendingDeath) {
      this.pendingDeath.t -= dt;
      this.timeScale = 0.35;
      if (this.pendingDeath.t <= 0) {
        const reason = this.pendingDeath.reason;
        this.pendingDeath = null;
        this.timeScale = 1;
        this.endGame(reason);
      }
      return;
    }

    if (this.snake.collidesWall() || (this.snake.collidesWithSelf() && this.snake.invincible <= 0)) {
      this.pendingDeath = { t: 0.52, reason: this.snake.collidesWall() ? 'Hit the wall' : 'Bit your own neon tail' };
      return;
    }

    if (this.snake.nearMissRisk()) {
      this.score += 0.3;
      this.nearMissGlow = 0.3;
      this.particles.trail(head.x, head.y, '#ffe280');
      this.audio.tone(820, 0.05, 'triangle', 0.03, 0.94);
      this.ui.flash('NEAR MISS', head.x + 18, head.y + 18, 'floating-points warning');
    }

    this.nearMissGlow = Math.max(0, this.nearMissGlow - dt * 1.2);

    this.foodSystem.update(dt);
    if (!this.foodSystem.food) {
      const danger = Math.random() < difficulty.riskChance;
      this.foodSystem.spawn({ w: this.canvas.width, h: this.canvas.height }, this.snake.segments, danger);
    }

    if (!this.foodSystem.powerup && Math.random() < dt * 0.12) this.foodSystem.spawnPowerup({ w: this.canvas.width, h: this.canvas.height });

    if (this.foodSystem.food && Math.hypot(head.x - this.foodSystem.food.x, head.y - this.foodSystem.food.y) < 18) this.consumeFood();
    if (this.foodSystem.powerup && Math.hypot(head.x - this.foodSystem.powerup.x, head.y - this.foodSystem.powerup.y) < 20) this.consumePowerup();

    this.comboTimer -= dt;
    if (this.comboTimer <= 0) this.combo = 1;

    this.displayScore += (this.score - this.displayScore) * 0.25;
    this.almostThere = this.combo >= 4 || (this.modeTimeLeft > 0 && this.modeTimeLeft < 12);

    const wallDist = Math.min(head.x, head.y, this.canvas.width - head.x, this.canvas.height - head.y);
    if (wallDist < NAVIGATION_BONUS.EDGE_DISTANCE) this.score += NAVIGATION_BONUS.EDGE_SCORE; // edge riding bonus
    const dense = this.snake.segments.slice(NAVIGATION_BONUS.DENSE_MIN_SEGMENT).filter(s => Math.hypot(head.x - s.x, head.y - s.y) < NAVIGATION_BONUS.DENSE_RADIUS).length;
    if (dense >= NAVIGATION_BONUS.DENSE_COUNT) this.score += NAVIGATION_BONUS.DENSE_SCORE; // tight-space navigation bonus
    if (this.snake.turnRate > NAVIGATION_BONUS.PRECISION_TURN_RATE && this.snake.speed > NAVIGATION_BONUS.PRECISION_SPEED) this.score += NAVIGATION_BONUS.PRECISION_SCORE; // precision turn bonus

    this.ui.updateHUD(this);
    this.audio.setIntensity(Math.min(1, this.score / 300));

    for (const a of ACHIEVEMENTS) {
      if (!this.achieved.has(a.key) && a.test(this)) {
        this.achieved.add(a.key);
        this.ui.popupAchievement(a.text);
      }
    }

    this.justScored = false;
  }

  consumeFood() {
    const food = this.foodSystem.food;
    const bonusCombo = this.comboTimer > 0 ? 1 : 0;
    const perfectChain = this.comboTimer > this.comboWindow * 0.55;
    this.combo += bonusCombo;
    this.comboTimer = this.comboWindow;
    this.bestCombo = Math.max(this.bestCombo, this.combo);
    const base = food.danger ? 18 : 10;
    const expiryPenalty = Math.max(0.5, Math.min(1.2, food.life / (food.danger ? 6 : 12)));
    const chainMult = perfectChain ? 1.35 : 1;
    const scoreAdd = Math.round(base * this.combo * chainMult * expiryPenalty * (this.activePowerup === 'double' ? 2 : 1));
    this.score += scoreAdd;
    this.foodCount += 1;
    this.snake.grow(3 + (food.danger ? 2 : 0));
    this.particles.burst(food.x, food.y, food.danger ? '#ff4888' : '#9effff', food.danger ? 45 : 30, food.danger ? 1.4 : 1);
    this.renderer.pulseShake(food.danger ? 11 : 6);
    this.audio.eat(this.combo);
    if (this.combo >= 3) this.audio.combo(this.combo);
    this.ui.flash(`+${scoreAdd}`, food.x, food.y);
    if (this.combo >= 2) this.ui.flash(`COMBO x${this.combo}`, food.x + 25, food.y + 10, 'floating-points combo');
    if (perfectChain) this.ui.flash('PERFECT CHAIN', food.x - 20, food.y - 12, 'floating-points combo');
    this.foodSystem.food = null;
    this.justScored = true;
  }

  consumePowerup() {
    const p = this.foodSystem.powerup;
    this.activePowerup = p.type;
    this.powerupTimer = p.type === 'invincible' ? 4 : 5;
    this.snake.applyPowerup(p.type);
    this.foodSystem.powerup = null;
    this.audio.powerup();
    this.ui.flash(p.type.toUpperCase(), this.snake.head.x + 18, this.snake.head.y - 10, 'floating-points powerup');
    this.particles.burst(this.snake.head.x, this.snake.head.y, '#ffffff', 22, 1.3);
  }

  endGame(reason) {
    this.state = 'gameOver';
    this.audio.gameOver();
    this.audio.stopAmbient();

    this.particles.burst(this.snake.head.x, this.snake.head.y, '#b8ffff', 80, 1.7);
    const prevHigh = this.highScore;
    this.highScore = Math.max(this.highScore, Math.floor(this.score));
    localStorage.setItem(STORAGE_KEYS.highScore, String(this.highScore));

    this.stats.games += 1;
    this.stats.totalScore += Math.floor(this.score);
    this.stats.bestSurvival = Math.max(this.stats.bestSurvival, this.survivalTime);
    localStorage.setItem(STORAGE_KEYS.stats, JSON.stringify(this.stats));

    if (Math.floor(this.score) >= prevHigh && this.currentPath.length > 50) {
      this.ghostPath = this.currentPath.slice();
      localStorage.setItem(STORAGE_KEYS.ghost, JSON.stringify(this.ghostPath));
    }

    const lb = JSON.parse(localStorage.getItem(STORAGE_KEYS.leaderboard) || '[]');
    lb.push({ score: Math.floor(this.score), date: new Date().toISOString() });
    lb.sort((a, b) => b.score - a.score);
    localStorage.setItem(STORAGE_KEYS.leaderboard, JSON.stringify(lb.slice(0, 7)));

    this.ui.gameOver({
      score: Math.floor(this.score),
      highScore: this.highScore,
      food: this.foodCount,
      length: this.snake.segments.length,
      bestCombo: this.bestCombo,
      reason,
      newRecord: Math.floor(this.score) > prevHigh,
      xpEarned: this.awardProgression()
    });
    document.body.classList.add('cinematic');
    setTimeout(() => document.body.classList.remove('cinematic'), 1800);
    this.canvas.classList.add('haptic-pulse');
    setTimeout(() => this.canvas.classList.remove('haptic-pulse'), 280);

    this.updateMenuStats();
  }

  awardProgression() {
    const xpEarned = Math.floor(this.score * 0.22 + this.survivalTime * 2 + this.bestCombo * 4);
    this.progression.xp += xpEarned;
    const level = 1 + Math.floor(this.progression.xp / 180);
    this.progression.level = level;
    for (const s of SKINS) if (level >= s.minLevel && !this.cosmetics.unlockedSkins.includes(s.key)) this.cosmetics.unlockedSkins.push(s.key);
    for (const t of TRAILS) if (level >= t.minLevel && !this.cosmetics.unlockedTrails.includes(t.key)) this.cosmetics.unlockedTrails.push(t.key);
    localStorage.setItem(STORAGE_KEYS.progression, JSON.stringify(this.progression));
    localStorage.setItem(STORAGE_KEYS.cosmetics, JSON.stringify(this.cosmetics));
    return xpEarned;
  }

  updateMenuStats() {
    document.getElementById('menu-high-score').textContent = String(this.highScore);
    document.getElementById('current-difficulty').textContent = this.settings.difficulty.toUpperCase();
    document.getElementById('current-theme').textContent = this.theme.toUpperCase();
    document.getElementById('current-mode').textContent = this.mode.toUpperCase();
    document.getElementById('high-score').textContent = String(this.highScore);
    this.ui.setMenuLevel(this.progression.level, this.progression.xp);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  // eslint-disable-next-line no-new
  new GameEngine();
});
