class DragonEngine {
    constructor() {
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.bgCanvas = document.getElementById('bg-canvas');
        this.bgCtx = this.bgCanvas.getContext('2d');

        this.state = 'menu'; // menu, playing, gameover
        this.score = 0;
        this.highScore = parseInt(localStorage.getItem('flappyDragon.highScore') || '0');

        this.dragon = { x: 80, y: 0, velocity: 0, size: 14, gravity: 0.25, jump: -6, angle: 0 };
        this.pipes = [];
        this.pipeWidth = 60;
        this.pipeGap = 160;
        this.pipeSpeed = 3;
        this.frameCount = 0;
        this.particles = [];
        this.particlePool = Array.from({ length: 150 }, () => ({ active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, color: '#000' }));

        this.resize();
        window.addEventListener('resize', () => this.resize());
        this.initInput();
        this.initUI();

        this.updateMenuStats();

        this.tick = this.tick.bind(this);
        requestAnimationFrame(this.tick);
    }

    resize() {
        const width = Math.min(window.innerWidth - 20, 400);
        const height = Math.min(window.innerHeight - 200, 600);
        this.canvas.width = width;
        this.canvas.height = height;
        this.canvas.style.width = `${width}px`;
        this.canvas.style.height = `${height}px`;

        this.bgCanvas.width = window.innerWidth;
        this.bgCanvas.height = window.innerHeight;
    }

    initInput() {
        const jumpHandler = (e) => {
            if (e.type === 'keydown' && e.code !== 'Space') return;
            e.preventDefault();
            if (this.state === 'playing') {
                this.dragon.velocity = this.dragon.jump;
                this.createJumpParticles();
            } else if (this.state === 'menu' || this.state === 'gameover') {
                // If we want to start on spacebar
            }
        };

        window.addEventListener('keydown', jumpHandler);
        this.canvas.addEventListener('touchstart', jumpHandler, {passive: false});
        this.canvas.addEventListener('mousedown', jumpHandler);
    }

    initUI() {
        document.getElementById('start-btn').addEventListener('click', () => this.start());
        document.getElementById('restart-btn').addEventListener('click', () => this.start());
        document.getElementById('menu-btn').addEventListener('click', () => this.toMenu());
    }

    setScreen(id) {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        document.getElementById(id).classList.add('active');
    }

    updateMenuStats() {
        document.getElementById('menu-high-score').textContent = this.highScore;
        document.getElementById('high-score').textContent = this.highScore;
    }

    start() {
        this.state = 'playing';
        this.score = 0;
        this.dragon.y = this.canvas.height / 2;
        this.dragon.velocity = 0;
        this.pipes = [];
        this.particlePool.forEach(p => p.active = false);
        this.particles = [];
        this.frameCount = 0;
        this.pipeSpeed = 3;

        document.getElementById('score').textContent = this.score;
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
            localStorage.setItem('flappyDragon.highScore', this.highScore);
        }

        document.getElementById('final-score').textContent = this.score;
        document.getElementById('final-high-score').textContent = this.highScore;
        this.setScreen('game-over-screen');
        this.createExplosion(this.dragon.x, this.dragon.y);
    }

    getParticle() {
        return this.particlePool.find(p => !p.active);
    }

    emitParticle(x, y, vx, vy, life, color) {
        const p = this.getParticle();
        if(!p) return;
        p.active = true;
        p.x = x; p.y = y; p.vx = vx; p.vy = vy; p.life = life; p.color = color;
        this.particles.push(p);
    }

    createJumpParticles() {
        for(let i=0; i<5; i++) {
            this.emitParticle(
                this.dragon.x - 10,
                this.dragon.y + 10,
                (Math.random() - 1) * 2,
                (Math.random() * 2),
                1,
                '#37ff00'
            );
        }
    }

    createExplosion(x, y) {
        for(let i=0; i<30; i++) {
            this.emitParticle(
                x,
                y,
                (Math.random() - 0.5) * 10,
                (Math.random() - 0.5) * 10,
                1,
                ['#37ff00', '#9cff5c', '#ff4f89'][Math.floor(Math.random()*3)]
            );
        }
    }

    update() {
        if (this.state !== 'playing') {
            this.updateParticles();
            return;
        }

        // Dragon Physics
        this.dragon.velocity += this.dragon.gravity;
        this.dragon.y += this.dragon.velocity;

        // Rotation based on velocity
        this.dragon.angle = Math.min(Math.PI / 4, Math.max(-Math.PI / 4, (this.dragon.velocity * 0.1)));

        // Bounds
        if (this.dragon.y + this.dragon.size > this.canvas.height || this.dragon.y - this.dragon.size < 0) {
            this.gameOver();
        }

        // Pipes
        if (this.frameCount % 100 === 0) {
            const minPipeHeight = 50;
            const maxPipeHeight = this.canvas.height - this.pipeGap - minPipeHeight;
            const topHeight = Math.max(minPipeHeight, Math.random() * maxPipeHeight);

            this.pipes.push({
                x: this.canvas.width,
                top: topHeight,
                bottom: topHeight + this.pipeGap,
                passed: false
            });
        }

        for (let i = this.pipes.length - 1; i >= 0; i--) {
            let p = this.pipes[i];
            p.x -= this.pipeSpeed;

            // Collision
            if (
                this.dragon.x + this.dragon.size > p.x &&
                this.dragon.x - this.dragon.size < p.x + this.pipeWidth
            ) {
                if (
                    this.dragon.y - this.dragon.size < p.top ||
                    this.dragon.y + this.dragon.size > p.bottom
                ) {
                    this.gameOver();
                }
            }

            // Score
            if (p.x + this.pipeWidth < this.dragon.x && !p.passed) {
                this.score++;
                p.passed = true;
                document.getElementById('score').textContent = this.score;
                if(this.score % 5 === 0) this.pipeSpeed += 0.2; // increase difficulty
            }

            // Remove off-screen pipes
            if (p.x + this.pipeWidth < 0) {
                this.pipes.splice(i, 1);
            }
        }

        this.updateParticles();
        this.frameCount++;
    }

    updateParticles() {
        this.particles = this.particles.filter(p => {
            p.x += p.vx;
            p.y += p.vy;
            p.life -= 0.02;
            if (p.life <= 0) {
                p.active = false;
                return false;
            }
            return true;
        });
    }

    drawBackground() {
        const w = this.bgCanvas.width;
        const h = this.bgCanvas.height;

        if (!this.cachedBgGradient || this.cachedBgWidth !== w || this.cachedBgHeight !== h) {
            this.cachedBgGradient = this.bgCtx.createLinearGradient(0, 0, 0, h);
            this.cachedBgGradient.addColorStop(0, '#001500');
            this.cachedBgGradient.addColorStop(1, '#000000');
            this.cachedBgWidth = w;
            this.cachedBgHeight = h;
        }

        this.bgCtx.fillStyle = this.cachedBgGradient;
        this.bgCtx.fillRect(0, 0, w, h);
    }

    draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw Pipes
        this.ctx.shadowBlur = 15;
        this.ctx.shadowColor = '#37ff00';
        this.ctx.fillStyle = 'rgba(55, 255, 0, 0.2)';
        this.ctx.strokeStyle = '#37ff00';
        this.ctx.lineWidth = 2;

        for (let p of this.pipes) {
            // Top pipe
            this.ctx.fillRect(p.x, 0, this.pipeWidth, p.top);
            this.ctx.strokeRect(p.x, 0, this.pipeWidth, p.top);
            // Cap
            this.ctx.fillRect(p.x - 5, p.top - 20, this.pipeWidth + 10, 20);
            this.ctx.strokeRect(p.x - 5, p.top - 20, this.pipeWidth + 10, 20);

            // Bottom pipe
            this.ctx.fillRect(p.x, p.bottom, this.pipeWidth, this.canvas.height - p.bottom);
            this.ctx.strokeRect(p.x, p.bottom, this.pipeWidth, this.canvas.height - p.bottom);
            // Cap
            this.ctx.fillRect(p.x - 5, p.bottom, this.pipeWidth + 10, 20);
            this.ctx.strokeRect(p.x - 5, p.bottom, this.pipeWidth + 10, 20);
        }

        // Draw Particles
        this.ctx.shadowBlur = 10;
        for(let p of this.particles) {
            this.ctx.shadowColor = p.color;
            this.ctx.fillStyle = p.color;
            this.ctx.globalAlpha = Math.max(0, p.life);
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, 3, 0, Math.PI*2);
            this.ctx.fill();
        }
        this.ctx.globalAlpha = 1;
        this.ctx.shadowBlur = 0;

        // Draw Dragon
        if (this.state === 'playing' || this.state === 'menu') {
            this.ctx.save();
            this.ctx.translate(this.dragon.x, this.dragon.y);
            this.ctx.rotate(this.dragon.angle);

            this.ctx.shadowBlur = 20;
            this.ctx.shadowColor = '#67f266';
            this.ctx.fillStyle = '#37ff00';

            // Stylized Dragon body (simple geometric shape)
            this.ctx.beginPath();
            this.ctx.moveTo(this.dragon.size, 0); // nose
            this.ctx.lineTo(-this.dragon.size, -this.dragon.size); // top tail
            this.ctx.lineTo(-this.dragon.size/2, 0); // inner tail
            this.ctx.lineTo(-this.dragon.size, this.dragon.size); // bottom tail
            this.ctx.closePath();
            this.ctx.fill();

            // Eye
            this.ctx.fillStyle = '#fff';
            this.ctx.shadowBlur = 0;
            this.ctx.beginPath();
            this.ctx.arc(this.dragon.size/2, -this.dragon.size/4, 2, 0, Math.PI*2);
            this.ctx.fill();

            this.ctx.restore();
        }
    }

    tick() {
        this.drawBackground();
        this.update();
        this.draw();
        requestAnimationFrame(this.tick);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new DragonEngine();
});