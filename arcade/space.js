class SpaceEngine {
    constructor() {
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.bgCanvas = document.getElementById('bg-canvas');
        this.bgCtx = this.bgCanvas.getContext('2d');

        this.state = 'menu';
        this.score = 0;
        this.highScore = parseInt(localStorage.getItem('neonSpace.highScore') || '0');

        this.settings = {
            difficulty: 'medium'
        };

        this.difficulties = {
            easy: { hp: 100, spawnRate: 0.015, speedMult: 0.8, bossHp: 500 },
            medium: { hp: 50, spawnRate: 0.025, speedMult: 1.0, bossHp: 1000 },
            hard: { hp: 20, spawnRate: 0.04, speedMult: 1.3, bossHp: 2000 }
        };

        this.player = {
            x: 0, y: 0, width: 24, height: 24,
            speed: 5, hp: 100, maxHp: 100,
            weapon: 'single', // single, double, spread
            shootTimer: 0, shootDelay: 12,
            shieldTimer: 0
        };

        this.entities = {
            bullets: [],
            enemies: [],
            enemyBullets: [],
            powerups: [],
            particles: []
        };

        // Object Pooling for performance
        this.pools = {
            bullets: Array.from({length: 100}, () => ({active: false})),
            enemies: Array.from({length: 50}, () => ({active: false})),
            enemyBullets: Array.from({length: 100}, () => ({active: false})),
            particles: Array.from({length: 200}, () => ({active: false}))
        };

        this.boss = null;
        this.levelProgress = 0;
        this.bossThreshold = 1500; // score needed for boss

        this.mousePos = { x: 0, y: 0, active: false };

        this.ui = {
            menuHighScore: document.getElementById('menu-high-score'),
            highScore: document.getElementById('high-score'),
            currentDifficulty: document.getElementById('current-difficulty'),
            score: document.getElementById('score'),
            healthBar: document.getElementById('health-bar'),
            bossHud: document.getElementById('boss-hud'),
            bossHealthBar: document.getElementById('boss-health-bar'),
            finalScore: document.getElementById('final-score'),
            finalHighScore: document.getElementById('final-high-score')
        };

        this.resize();
        window.addEventListener('resize', () => this.resize());
        this.initInput();
        this.initUI();

        this.updateMenuStats();

        this.tick = this.tick.bind(this);
        requestAnimationFrame(this.tick);
    }

    resize() {
        const width = Math.min(window.innerWidth - 20, 480);
        const height = Math.min(window.innerHeight - 150, 720);
        this.canvas.width = width;
        this.canvas.height = height;
        this.canvas.style.width = `${width}px`;
        this.canvas.style.height = `${height}px`;

        this.bgCanvas.width = window.innerWidth;
        this.bgCanvas.height = window.innerHeight;

        if(this.state === 'menu') {
            this.player.x = width / 2;
            this.player.y = height - 60;
        }
    }

    initInput() {
        const setMouse = (x, y, active) => {
            const rect = this.canvas.getBoundingClientRect();
            this.mousePos.x = x - rect.left;
            this.mousePos.y = y - rect.top;
            this.mousePos.active = active;
        };

        this.canvas.addEventListener('mousemove', e => setMouse(e.clientX, e.clientY, true));
        this.canvas.addEventListener('touchmove', e => { e.preventDefault(); setMouse(e.touches[0].clientX, e.touches[0].clientY, true); }, {passive: false});
        this.canvas.addEventListener('mousedown', e => setMouse(e.clientX, e.clientY, true));
        this.canvas.addEventListener('touchstart', e => { e.preventDefault(); setMouse(e.touches[0].clientX, e.touches[0].clientY, true); }, {passive: false});
        this.canvas.addEventListener('mouseup', () => this.mousePos.active = false);
        this.canvas.addEventListener('touchend', () => this.mousePos.active = false);
        this.canvas.addEventListener('mouseleave', () => this.mousePos.active = false);
    }

    initUI() {
        document.getElementById('start-btn').addEventListener('click', () => this.start());
        document.getElementById('restart-btn').addEventListener('click', () => this.start());
        document.getElementById('menu-btn').addEventListener('click', () => this.toMenu());

        document.getElementById('difficulty-btn').addEventListener('click', () => document.getElementById('difficulty-modal').classList.add('active'));
        document.getElementById('close-difficulty').addEventListener('click', () => document.getElementById('difficulty-modal').classList.remove('active'));

        document.querySelectorAll('.difficulty-option').forEach(btn => {
            btn.addEventListener('click', () => {
                this.settings.difficulty = btn.dataset.difficulty;
                this.ui.currentDifficulty.textContent = this.settings.difficulty.toUpperCase();
                document.getElementById('difficulty-modal').classList.remove('active');
            });
        });
    }

    setScreen(id) {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        document.getElementById(id).classList.add('active');
    }

    updateMenuStats() {
        this.ui.menuHighScore.textContent = this.highScore;
        this.ui.highScore.textContent = this.highScore;
        this.ui.currentDifficulty.textContent = this.settings.difficulty.toUpperCase();
    }

    start() {
        this.state = 'playing';
        this.score = 0;
        this.levelProgress = 0;
        this.boss = null;
        this.ui.bossHud.classList.add('hidden');

        const diff = this.difficulties[this.settings.difficulty];
        this.player.maxHp = diff.hp;
        this.player.hp = diff.hp;
        this.player.weapon = 'single';
        this.player.shootDelay = 12;
        this.player.shieldTimer = 0;

        this.player.x = this.canvas.width / 2;
        this.player.y = this.canvas.height - 60;

        // Reset all pools
        Object.values(this.pools).forEach(pool => pool.forEach(item => item.active = false));
        this.entities.powerups = [];

        this.updateHUD();
        this.setScreen('game-screen');
    }

    toMenu() {
        this.state = 'menu';
        this.updateMenuStats();
        this.setScreen('start-screen');
    }

    gameOver() {
        this.state = 'gameover';
        if (this.score > this.highScore) {
            this.highScore = this.score;
            localStorage.setItem('neonSpace.highScore', this.highScore);
        }

        this.ui.finalScore.textContent = this.score;
        this.ui.finalHighScore.textContent = this.highScore;
        this.setScreen('game-over-screen');
        this.createExplosion(this.player.x, this.player.y, 40, '#00f7ff');
    }

    // --- Object Pooling Helpers ---
    spawnEntity(type, props) {
        const pool = this.pools[type];
        if(!pool) return null;
        const item = pool.find(p => !p.active);
        if(!item) return null;

        Object.assign(item, props, {active: true});
        return item;
    }

    createParticle(x, y, vx, vy, color, life = 1, size = 2) {
        this.spawnEntity('particles', {x, y, vx, vy, color, life, size, maxLife: life});
    }

    createExplosion(x, y, count, color) {
        for(let i=0; i<count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 4 + 1;
            this.createParticle(x, y, Math.cos(angle)*speed, Math.sin(angle)*speed, color, Math.random() * 0.5 + 0.5, Math.random() * 3 + 1);
        }
    }

    // --- Game Logic ---
    updateHUD() {
        this.ui.score.textContent = this.score;
        const hpPct = Math.max(0, this.player.hp / this.player.maxHp * 100);
        this.ui.healthBar.style.width = `${hpPct}%`;

        if(hpPct < 30) {
            this.ui.healthBar.classList.add('low');
            this.ui.healthBar.style.backgroundColor = '#ff4f89';
        } else {
            this.ui.healthBar.classList.remove('low');
            if(this.player.shieldTimer > 0) {
                this.ui.healthBar.style.backgroundColor = '#b366ff'; // purple for shield
            } else {
                this.ui.healthBar.style.backgroundColor = '#26ff91'; // green normal
            }
        }

        if(this.boss && this.boss.active) {
            this.ui.bossHud.classList.remove('hidden');
            const diff = this.difficulties[this.settings.difficulty];
            const bossHpPct = Math.max(0, this.boss.hp / diff.bossHp * 100);
            this.ui.bossHealthBar.style.width = `${bossHpPct}%`;
        } else {
            this.ui.bossHud.classList.add('hidden');
        }
    }

    updatePlayer() {
        if(this.mousePos.active) {
            // Smooth movement towards mouse
            this.player.x += (this.mousePos.x - this.player.x) * 0.15;
            this.player.y += (this.mousePos.y - this.player.y) * 0.15;

            // Constrain to bounds
            this.player.x = Math.max(this.player.width/2, Math.min(this.canvas.width - this.player.width/2, this.player.x));
            this.player.y = Math.max(this.player.height/2, Math.min(this.canvas.height - this.player.height/2, this.player.y));

            // Auto shoot
            this.player.shootTimer--;
            if(this.player.shootTimer <= 0) {
                this.shootPlayerWeapon();
                this.player.shootTimer = this.player.shootDelay;
            }
        }
        if(this.player.shieldTimer > 0) this.player.shieldTimer--;
    }

    shootPlayerWeapon() {
        const y = this.player.y - 10;
        const speed = -12;
        const color = '#00f7ff';

        if(this.player.weapon === 'single') {
            this.spawnEntity('bullets', {x: this.player.x, y, vx: 0, vy: speed, color, damage: 10, width: 4, height: 12});
        } else if(this.player.weapon === 'double') {
            this.spawnEntity('bullets', {x: this.player.x - 8, y, vx: 0, vy: speed, color, damage: 10, width: 4, height: 12});
            this.spawnEntity('bullets', {x: this.player.x + 8, y, vx: 0, vy: speed, color, damage: 10, width: 4, height: 12});
        } else if(this.player.weapon === 'spread') {
            this.spawnEntity('bullets', {x: this.player.x, y, vx: 0, vy: speed, color, damage: 10, width: 4, height: 12});
            this.spawnEntity('bullets', {x: this.player.x, y, vx: -3, vy: speed, color, damage: 10, width: 4, height: 12});
            this.spawnEntity('bullets', {x: this.player.x, y, vx: 3, vy: speed, color, damage: 10, width: 4, height: 12});
        }
    }

    spawnEnemies() {
        if(this.boss && this.boss.active) return; // Stop spawning small enemies during boss

        const diff = this.difficulties[this.settings.difficulty];

        if(this.levelProgress >= this.bossThreshold) {
            this.spawnBoss();
            return;
        }

        if(Math.random() < diff.spawnRate) {
            const types = ['basic', 'fast', 'tank'];
            const type = types[Math.floor(Math.random() * types.length)];
            const x = Math.random() * (this.canvas.width - 40) + 20;

            let hp, vy, color, width, height, score;
            if(type === 'basic') { hp = 20; vy = 2; color = '#ff4f89'; width=20; height=20; score=10; }
            else if(type === 'fast') { hp = 10; vy = 4; color = '#ffea00'; width=16; height=16; score=15; }
            else { hp = 60; vy = 1; color = '#b366ff'; width=30; height=30; score=30; }

            vy *= diff.speedMult;

            this.spawnEntity('enemies', {
                type, x, y: -20, vx: 0, vy, hp, color, width, height, score, shootTimer: Math.random()*100
            });
        }
    }

    spawnBoss() {
        const diff = this.difficulties[this.settings.difficulty];
        this.boss = {
            active: true,
            x: this.canvas.width / 2,
            y: -100,
            targetY: 100,
            width: 80, height: 60,
            hp: diff.bossHp,
            color: '#ff0000',
            phase: 0,
            timer: 0
        };
        // Clear screen of other enemies
        this.pools.enemies.forEach(e => e.active = false);
    }

    updateBoss() {
        if(!this.boss || !this.boss.active) return;

        const b = this.boss;
        b.timer++;

        // Entrance
        if(b.y < b.targetY) {
            b.y += 1;
            return;
        }

        // Movement pattern (figure 8)
        b.x = this.canvas.width/2 + Math.sin(b.timer * 0.02) * (this.canvas.width/3);
        b.y = b.targetY + Math.sin(b.timer * 0.04) * 30;

        // Shooting patterns
        if(b.timer % 60 === 0) { // Aimed shot
            const dx = this.player.x - b.x;
            const dy = this.player.y - b.y;
            const dist = Math.sqrt(dx*dx + dy*dy);
            const speed = 5;
            this.spawnEntity('enemyBullets', {
                x: b.x, y: b.y + b.height/2,
                vx: (dx/dist)*speed, vy: (dy/dist)*speed,
                color: '#ffea00', width: 6, height: 6, damage: 20
            });
        }

        if(b.hp < this.difficulties[this.settings.difficulty].bossHp * 0.5 && b.timer % 120 === 0) {
            // Ring attack
            for(let i=0; i<8; i++) {
                const angle = (i/8) * Math.PI * 2;
                this.spawnEntity('enemyBullets', {
                    x: b.x, y: b.y,
                    vx: Math.cos(angle)*3, vy: Math.sin(angle)*3,
                    color: '#ff4f89', width: 8, height: 8, damage: 15
                });
            }
        }
    }

    spawnPowerup(x, y) {
        if(Math.random() < 0.15) { // 15% chance to drop powerup
            const types = ['double', 'spread', 'rapid', 'shield', 'heal'];
            const type = types[Math.floor(Math.random() * types.length)];
            let color = '#fff';
            if(type === 'heal') color = '#37ff00';
            if(type === 'shield') color = '#b366ff';
            if(type === 'rapid') color = '#ffea00';

            this.entities.powerups.push({
                x, y, vy: 1.5, type, color, radius: 10
            });
        }
    }

    checkCollisions() {
        const sqDist = (x1,y1,x2,y2) => (x2-x1)*(x2-x1) + (y2-y1)*(y2-y1);

        // Player Bullets hitting Enemies or Boss
        const bullets = this.pools.bullets;
        const bulletsLen = bullets.length;
        const enemies = this.pools.enemies;
        const enemiesLen = enemies.length;

        for (let i = 0; i < bulletsLen; i++) {
            const bullet = bullets[i];
            if (!bullet.active) continue;

            // Boss collision
            if(this.boss && this.boss.active) {
                if(Math.abs(bullet.x - this.boss.x) < this.boss.width/2 + bullet.width/2 &&
                   Math.abs(bullet.y - this.boss.y) < this.boss.height/2 + bullet.height/2) {
                    bullet.active = false;
                    this.boss.hp -= bullet.damage;
                    this.createParticle(bullet.x, bullet.y - 10, 0, 0, '#fff', 0.2, 3);

                    if(this.boss.hp <= 0) {
                        this.score += 5000;
                        this.createExplosion(this.boss.x, this.boss.y, 100, '#ff0000');
                        this.boss.active = false;
                        this.levelProgress = 0; // Reset for next wave
                        this.bossThreshold *= 2;
                    }
                }
            }

            // Normal Enemies
            for (let j = 0; j < enemiesLen; j++) {
                const enemy = enemies[j];
                if (!enemy.active) continue;

                if(Math.abs(bullet.x - enemy.x) < enemy.width/2 + bullet.width/2 &&
                   Math.abs(bullet.y - enemy.y) < enemy.height/2 + bullet.height/2) {

                    bullet.active = false;
                    enemy.hp -= bullet.damage;
                    this.createParticle(bullet.x, bullet.y, 0, 0, '#fff', 0.2, 2);

                    if(enemy.hp <= 0) {
                        enemy.active = false;
                        this.score += enemy.score;
                        this.levelProgress += enemy.score;
                        this.createExplosion(enemy.x, enemy.y, 15, enemy.color);
                        this.spawnPowerup(enemy.x, enemy.y);
                    }
                }
            }
        }

        // Player hitting Powerups
        for(let i = this.entities.powerups.length - 1; i >= 0; i--) {
            let p = this.entities.powerups[i];
            if(sqDist(p.x, p.y, this.player.x, this.player.y) < (p.radius + this.player.width/2)**2) {
                if(p.type === 'heal') this.player.hp = Math.min(this.player.maxHp, this.player.hp + 30);
                else if(p.type === 'shield') this.player.shieldTimer = 300; // 5 seconds at 60fps
                else if(p.type === 'rapid') this.player.shootDelay = 6;
                else this.player.weapon = p.type;

                this.score += 50;
                this.createExplosion(p.x, p.y, 20, p.color);
                this.entities.powerups.splice(i, 1);
            }
        }

        // Taking Damage Logic
        const takeDamage = (dmg) => {
            if(this.player.shieldTimer > 0) return; // Immune
            this.player.hp -= dmg;
            this.createExplosion(this.player.x, this.player.y, 10, '#00f7ff');
            if(this.player.hp <= 0) this.gameOver();
        };

        // Enemy Bullets hitting Player
        const enemyBullets = this.pools.enemyBullets;
        const enemyBulletsLen = enemyBullets.length;
        for (let i = 0; i < enemyBulletsLen; i++) {
            const bullet = enemyBullets[i];
            if (!bullet.active) continue;
            if(Math.abs(bullet.x - this.player.x) < this.player.width/2 + bullet.width/2 &&
               Math.abs(bullet.y - this.player.y) < this.player.height/2 + bullet.height/2) {
                bullet.active = false;
                takeDamage(bullet.damage);
            }
        }

        // Enemies crashing into Player
        for (let i = 0; i < enemiesLen; i++) {
            const enemy = enemies[i];
            if (!enemy.active) continue;
            if(Math.abs(enemy.x - this.player.x) < this.player.width/2 + enemy.width/2 &&
               Math.abs(enemy.y - this.player.y) < this.player.height/2 + enemy.height/2) {
                enemy.active = false;
                this.createExplosion(enemy.x, enemy.y, 15, enemy.color);
                takeDamage(20);
            }
        }

        // Boss crashing into player (rare but possible)
        if(this.boss && this.boss.active) {
            if(Math.abs(this.boss.x - this.player.x) < this.boss.width/2 + this.player.width/2 &&
               Math.abs(this.boss.y - this.player.y) < this.boss.height/2 + this.player.height/2) {
                takeDamage(5); // Constant damage while overlapping
            }
        }
    }

    updateEntities() {
        const bullets = this.pools.bullets;
        const bulletsLen = bullets.length;
        const enemyBullets = this.pools.enemyBullets;
        const enemyBulletsLen = enemyBullets.length;
        const enemies = this.pools.enemies;
        const enemiesLen = enemies.length;
        const particles = this.pools.particles;
        const particlesLen = particles.length;

        // Player Bullets
        for (let i = 0; i < bulletsLen; i++) {
            const b = bullets[i];
            if (!b.active) continue;
            b.x += b.vx; b.y += b.vy;
            if(b.y < -20 || b.y > this.canvas.height + 20 || b.x < -20 || b.x > this.canvas.width + 20) b.active = false;
        }

        // Enemy Bullets
        for (let i = 0; i < enemyBulletsLen; i++) {
            const b = enemyBullets[i];
            if (!b.active) continue;
            b.x += b.vx; b.y += b.vy;
            if(b.y > this.canvas.height + 20 || b.x < -20 || b.x > this.canvas.width + 20) b.active = false;
        }

        // Enemies
        for (let i = 0; i < enemiesLen; i++) {
            const e = enemies[i];
            if (!e.active) continue;
            e.y += e.vy;
            e.x += Math.sin(e.y * 0.05) * (e.type === 'fast' ? 2 : 0.5); // Wiggle

            if(e.type === 'tank') {
                e.shootTimer--;
                if(e.shootTimer <= 0) {
                    this.spawnEntity('enemyBullets', {
                        x: e.x, y: e.y + e.height/2, vx: 0, vy: 4, color: '#ff4f89', width: 4, height: 10, damage: 10
                    });
                    e.shootTimer = 120;
                }
            }
            if(e.y > this.canvas.height + 50) e.active = false;
        }

        // Powerups
        for(let i = this.entities.powerups.length - 1; i >= 0; i--) {
            let p = this.entities.powerups[i];
            p.y += p.vy;
            if(p.y > this.canvas.height + 20) this.entities.powerups.splice(i, 1);
        }

        // Particles
        for (let i = 0; i < particlesLen; i++) {
            const p = particles[i];
            if (!p.active) continue;
            p.x += p.vx; p.y += p.vy;
            p.life -= 0.02;
            if(p.life <= 0) p.active = false;
        }
    }

    drawBackground(ts) {
        const w = this.bgCanvas.width;
        const h = this.bgCanvas.height;

        if(!this.cachedBgGradient || this.cachedBgWidth !== w || this.cachedBgHeight !== h) {
            this.cachedBgGradient = this.bgCtx.createLinearGradient(0, 0, 0, h);
            this.cachedBgGradient.addColorStop(0, '#060915');
            this.cachedBgGradient.addColorStop(1, '#000000');
            this.cachedBgWidth = w;
            this.cachedBgHeight = h;
        }

        this.bgCtx.fillStyle = this.cachedBgGradient;
        this.bgCtx.fillRect(0, 0, w, h);

        // Scrolling stars effect
        this.bgCtx.fillStyle = 'rgba(255,255,255,0.3)';
        for(let i=0; i<30; i++) {
            const x = (Math.sin(i * 123) * w + w) % w;
            const y = (ts * 0.05 * (i%3 + 1) + i * 45) % h;
            this.bgCtx.fillRect(x, y, i%2 + 1, i%2 + 1);
        }
    }

    draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        const drawRect = (x, y, w, h, color, shadow=true) => {
            if(shadow) {
                this.ctx.shadowBlur = 10;
                this.ctx.shadowColor = color;
            } else {
                this.ctx.shadowBlur = 0;
            }
            this.ctx.fillStyle = color;
            this.ctx.fillRect(x - w/2, y - h/2, w, h);
        };

        // Draw Powerups
        this.entities.powerups.forEach(p => {
            this.ctx.shadowBlur = 15;
            this.ctx.shadowColor = p.color;
            this.ctx.fillStyle = p.color;
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, p.radius, 0, Math.PI*2);
            this.ctx.fill();

            this.ctx.fillStyle = '#000';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.font = '10px Arial';
            this.ctx.fillText(p.type[0].toUpperCase(), p.x, p.y);
        });

        // Draw Player
        if(this.state === 'playing') {
            const pColor = '#00f7ff';
            drawRect(this.player.x, this.player.y, this.player.width, this.player.height, pColor);
            // Cockpit
            drawRect(this.player.x, this.player.y - 4, 8, 8, '#fff', false);

            if(this.player.shieldTimer > 0) {
                this.ctx.shadowBlur = 20;
                this.ctx.shadowColor = '#b366ff';
                this.ctx.strokeStyle = '#b366ff';
                this.ctx.lineWidth = 2;
                this.ctx.beginPath();
                this.ctx.arc(this.player.x, this.player.y, this.player.width, 0, Math.PI*2);
                this.ctx.stroke();
            }
        }

        const enemies = this.pools.enemies;
        const enemiesLen = enemies.length;
        const bullets = this.pools.bullets;
        const bulletsLen = bullets.length;
        const enemyBullets = this.pools.enemyBullets;
        const enemyBulletsLen = enemyBullets.length;
        const particles = this.pools.particles;
        const particlesLen = particles.length;

        // Draw Enemies
        for (let i = 0; i < enemiesLen; i++) {
            const e = enemies[i];
            if (!e.active) continue;
            drawRect(e.x, e.y, e.width, e.height, e.color);
            // Core
            drawRect(e.x, e.y, e.width/2, e.height/2, '#000', false);
        }

        // Draw Boss
        if(this.boss && this.boss.active) {
            drawRect(this.boss.x, this.boss.y, this.boss.width, this.boss.height, this.boss.color);
            drawRect(this.boss.x, this.boss.y, 20, 20, '#fff'); // core
            drawRect(this.boss.x - 30, this.boss.y + 10, 10, 40, '#ff4f89'); // gun left
            drawRect(this.boss.x + 30, this.boss.y + 10, 10, 40, '#ff4f89'); // gun right
        }

        // Draw Bullets
        this.ctx.shadowBlur = 0; // optimized
        for (let i = 0; i < bulletsLen; i++) {
            const b = bullets[i];
            if (!b.active) continue;
            this.ctx.fillStyle = b.color;
            this.ctx.fillRect(b.x - b.width/2, b.y - b.height/2, b.width, b.height);
        }

        for (let i = 0; i < enemyBulletsLen; i++) {
            const b = enemyBullets[i];
            if (!b.active) continue;
            this.ctx.fillStyle = b.color;
            this.ctx.fillRect(b.x - b.width/2, b.y - b.height/2, b.width, b.height);
        }

        // Draw Particles
        this.ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < particlesLen; i++) {
            const p = particles[i];
            if (!p.active) continue;
            this.ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
            this.ctx.fillStyle = p.color;
            this.ctx.fillRect(p.x, p.y, p.size, p.size);
        }
        this.ctx.globalAlpha = 1;
        this.ctx.globalCompositeOperation = 'source-over';
        this.ctx.shadowBlur = 0;
    }

    update() {
        if(this.state !== 'playing') {
            this.updateEntities();
            return;
        }

        this.updatePlayer();
        this.spawnEnemies();
        this.updateBoss();
        this.updateEntities();
        this.checkCollisions();
        this.updateHUD();
    }

    tick(ts) {
        this.drawBackground(ts);
        this.update();
        this.draw();
        requestAnimationFrame(this.tick);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new SpaceEngine();
});