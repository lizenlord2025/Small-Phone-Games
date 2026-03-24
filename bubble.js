class BubbleEngine {
    constructor() {
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.bgCanvas = document.getElementById('bg-canvas');
        this.bgCtx = this.bgCanvas.getContext('2d');

        this.state = 'menu';
        this.score = 0;
        this.highScore = parseInt(localStorage.getItem('neonBubble.highScore') || '0');

        this.colors = ['#ff00ff', '#00f7ff', '#37ff00', '#ffea00', '#ff4f89'];

        this.radius = 16;
        this.diameter = this.radius * 2;
        this.hexRadius = this.radius * Math.sqrt(3) / 2;

        this.grid = [];
        this.cols = 10;
        this.rows = 12; // visible area
        this.gridOffset = 0; // for dropping

        this.shooter = {
            x: 0,
            y: 0,
            angle: -Math.PI / 2,
            bubble: null,
            nextBubble: null
        };

        this.movingBubble = null;
        this.particles = [];

        this.mousePos = { x: 0, y: 0 };
        this.shotsFired = 0;

        this.resize();
        window.addEventListener('resize', () => this.resize());
        this.initInput();
        this.initUI();

        this.updateMenuStats();

        this.tick = this.tick.bind(this);
        requestAnimationFrame(this.tick);
    }

    resize() {
        const width = Math.min(window.innerWidth - 20, 360);
        const height = Math.min(window.innerHeight - 200, 540);
        this.canvas.width = width;
        this.canvas.height = height;
        this.canvas.style.width = `${width}px`;
        this.canvas.style.height = `${height}px`;

        this.bgCanvas.width = window.innerWidth;
        this.bgCanvas.height = window.innerHeight;

        this.shooter.x = width / 2;
        this.shooter.y = height - 30;

        // Recalculate based on width to fit columns exactly
        this.radius = Math.min(16, (width / (this.cols + 0.5)) / 2);
        this.diameter = this.radius * 2;
        this.hexRadius = this.radius * Math.sqrt(3) / 2;
    }

    initInput() {
        const moveHandler = (e) => {
            if (this.state !== 'playing') return;
            const rect = this.canvas.getBoundingClientRect();
            let clientX, clientY;

            if(e.touches) {
                clientX = e.touches[0].clientX;
                clientY = e.touches[0].clientY;
            } else {
                clientX = e.clientX;
                clientY = e.clientY;
            }

            this.mousePos.x = clientX - rect.left;
            this.mousePos.y = clientY - rect.top;

            let dx = this.mousePos.x - this.shooter.x;
            let dy = this.mousePos.y - this.shooter.y;
            this.shooter.angle = Math.atan2(dy, dx);

            // Limit angle to point upwards
            if(this.shooter.angle > -0.1) this.shooter.angle = -0.1;
            if(this.shooter.angle < -Math.PI + 0.1) this.shooter.angle = -Math.PI + 0.1;
        };

        const shootHandler = (e) => {
            e.preventDefault();
            if (this.state !== 'playing' || this.movingBubble) return;
            moveHandler(e); // Update angle just before shooting

            this.movingBubble = {
                x: this.shooter.x,
                y: this.shooter.y,
                color: this.shooter.bubble,
                vx: Math.cos(this.shooter.angle) * 12,
                vy: Math.sin(this.shooter.angle) * 12
            };

            this.shooter.bubble = this.shooter.nextBubble;
            this.shooter.nextBubble = this.getRandomColor();
            this.shotsFired++;
        };

        this.canvas.addEventListener('mousemove', moveHandler);
        this.canvas.addEventListener('touchmove', moveHandler, {passive: false});
        this.canvas.addEventListener('mousedown', shootHandler);
        this.canvas.addEventListener('touchstart', shootHandler, {passive: false});
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

    getRandomColor() {
        return this.colors[Math.floor(Math.random() * this.colors.length)];
    }

    start() {
        this.state = 'playing';
        this.score = 0;
        this.gridOffset = 0;
        this.shotsFired = 0;
        this.particles = [];
        this.movingBubble = null;

        this.shooter.bubble = this.getRandomColor();
        this.shooter.nextBubble = this.getRandomColor();

        // Initialize grid
        this.grid = [];
        for(let r=0; r<5; r++) {
            this.grid[r] = [];
            const isOffset = r % 2 !== 0;
            const cols = isOffset ? this.cols - 1 : this.cols;
            for(let c=0; c<cols; c++) {
                this.grid[r][c] = this.getRandomColor();
            }
        }

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
            localStorage.setItem('neonBubble.highScore', this.highScore);
        }

        document.getElementById('final-score').textContent = this.score;
        document.getElementById('final-high-score').textContent = this.highScore;
        this.setScreen('game-over-screen');
    }

    getGridPos(r, c) {
        const isOffset = (r + this.gridOffset) % 2 !== 0;
        const x = isOffset ? (c * this.diameter) + this.diameter : (c * this.diameter) + this.radius;
        const y = (r * this.hexRadius * 2) + this.radius;
        return {x, y};
    }

    getGridCoord(x, y) {
        let r = Math.round((y - this.radius) / (this.hexRadius * 2));
        const isOffset = (r + this.gridOffset) % 2 !== 0;
        let c = isOffset
            ? Math.round((x - this.diameter) / this.diameter)
            : Math.round((x - this.radius) / this.diameter);

        // Bounds check
        if(r < 0) r = 0;
        const maxCols = isOffset ? this.cols - 1 : this.cols;
        if(c < 0) c = 0;
        if(c >= maxCols) c = maxCols - 1;

        return {r, c};
    }

    createExplosion(x, y, color) {
        for(let i=0; i<8; i++) {
            this.particles.push({
                x: x,
                y: y,
                vx: (Math.random() - 0.5) * 6,
                vy: (Math.random() - 0.5) * 6,
                life: 1,
                color: color
            });
        }
    }

    findMatches(r, c, color, matchSet = new Set()) {
        const key = `${r},${c}`;
        if(matchSet.has(key)) return matchSet;
        if(!this.grid[r] || this.grid[r][c] !== color) return matchSet;

        matchSet.add(key);

        const isOffset = (r + this.gridOffset) % 2 !== 0;
        const neighbors = isOffset ? [
            [0, -1], [0, 1], [-1, 0], [-1, 1], [1, 0], [1, 1]
        ] : [
            [0, -1], [0, 1], [-1, -1], [-1, 0], [1, -1], [1, 0]
        ];

        for(let n of neighbors) {
            this.findMatches(r + n[0], c + n[1], color, matchSet);
        }
        return matchSet;
    }

    removeFloating() {
        const connected = new Set();

        const floodFill = (r, c) => {
            const key = `${r},${c}`;
            if(connected.has(key)) return;
            if(!this.grid[r] || !this.grid[r][c]) return;

            connected.add(key);

            const isOffset = (r + this.gridOffset) % 2 !== 0;
            const neighbors = isOffset ? [
                [0, -1], [0, 1], [-1, 0], [-1, 1], [1, 0], [1, 1]
            ] : [
                [0, -1], [0, 1], [-1, -1], [-1, 0], [1, -1], [1, 0]
            ];

            for(let n of neighbors) {
                floodFill(r + n[0], c + n[1]);
            }
        };

        // Start from top row
        if(this.grid[0]) {
            for(let c=0; c<this.grid[0].length; c++) {
                if(this.grid[0][c]) floodFill(0, c);
            }
        }

        let dropped = 0;
        for(let r=0; r<this.grid.length; r++) {
            if(!this.grid[r]) continue;
            for(let c=0; c<this.grid[r].length; c++) {
                if(this.grid[r][c] && !connected.has(`${r},${c}`)) {
                    const pos = this.getGridPos(r, c);
                    this.createExplosion(pos.x, pos.y, this.grid[r][c]);
                    this.grid[r][c] = null;
                    dropped++;
                }
            }
        }
        return dropped;
    }

    snapBubble() {
        const coord = this.getGridCoord(this.movingBubble.x, this.movingBubble.y);

        // Find empty spot
        while(this.grid[coord.r] && this.grid[coord.r][coord.c]) {
            coord.r++; // Push down if occupied
        }

        if(!this.grid[coord.r]) this.grid[coord.r] = [];
        this.grid[coord.r][coord.c] = this.movingBubble.color;

        const pos = this.getGridPos(coord.r, coord.c);

        // Check for matches
        const matches = this.findMatches(coord.r, coord.c, this.movingBubble.color);
        if(matches.size >= 3) {
            matches.forEach(key => {
                const [r, c] = key.split(',').map(Number);
                const p = this.getGridPos(r, c);
                this.createExplosion(p.x, p.y, this.grid[r][c]);
                this.grid[r][c] = null;
            });

            const scoreAdd = matches.size * 10;
            this.score += scoreAdd;

            const floatingDropped = this.removeFloating();
            this.score += floatingDropped * 20;

            document.getElementById('score').textContent = this.score;
        }

        this.movingBubble = null;

        // Check drop
        if(this.shotsFired % 6 === 0) {
            this.gridOffset++;
            this.grid.unshift([]);
            const isOffset = (this.gridOffset) % 2 !== 0;
            const cols = isOffset ? this.cols - 1 : this.cols;
            for(let c=0; c<cols; c++) {
                this.grid[0][c] = this.getRandomColor();
            }
        }

        // Game Over check
        for(let c=0; c<this.cols; c++) {
            if(this.grid[11] && this.grid[11][c]) { // Reached bottom
                this.gameOver();
                break;
            }
        }
    }

    update() {
        if (this.state !== 'playing') {
            this.updateParticles();
            return;
        }

        if (this.movingBubble) {
            this.movingBubble.x += this.movingBubble.vx;
            this.movingBubble.y += this.movingBubble.vy;

            // Bounce off walls
            if (this.movingBubble.x - this.radius < 0 || this.movingBubble.x + this.radius > this.canvas.width) {
                this.movingBubble.vx *= -1;
                this.movingBubble.x = Math.max(this.radius, Math.min(this.canvas.width - this.radius, this.movingBubble.x));
            }

            // Hit ceiling
            if (this.movingBubble.y - this.radius < 0) {
                this.movingBubble.y = this.radius;
                this.snapBubble();
                return;
            }

            // Hit other bubbles
            let collision = false;
            for(let r=0; r<this.grid.length; r++) {
                if(!this.grid[r]) continue;
                for(let c=0; c<this.grid[r].length; c++) {
                    if(this.grid[r][c]) {
                        const pos = this.getGridPos(r, c);
                        const dx = this.movingBubble.x - pos.x;
                        const dy = this.movingBubble.y - pos.y;
                        if(dx*dx + dy*dy < (this.radius * 1.8) * (this.radius * 1.8)) {
                            collision = true;
                            break;
                        }
                    }
                }
                if(collision) break;
            }

            if(collision) {
                this.snapBubble();
            }
        }

        this.updateParticles();
    }

    updateParticles() {
        for(let i = this.particles.length - 1; i >= 0; i--) {
            let p = this.particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.life -= 0.05;
            if(p.life <= 0) this.particles.splice(i, 1);
        }
    }

    drawBackground() {
        const w = this.bgCanvas.width;
        const h = this.bgCanvas.height;
        this.bgCtx.clearRect(0, 0, w, h);

        const grad = this.bgCtx.createLinearGradient(0, 0, 0, h);
        grad.addColorStop(0, '#120012');
        grad.addColorStop(1, '#000000');
        this.bgCtx.fillStyle = grad;
        this.bgCtx.fillRect(0, 0, w, h);
    }

    drawBubble(x, y, color, scale = 1) {
        this.ctx.shadowBlur = 15 * scale;
        this.ctx.shadowColor = color;

        const g = this.ctx.createRadialGradient(x - this.radius*0.3*scale, y - this.radius*0.3*scale, this.radius*0.1*scale, x, y, this.radius*scale);
        g.addColorStop(0, '#ffffff');
        g.addColorStop(0.3, color);
        g.addColorStop(1, '#000000');

        this.ctx.fillStyle = g;
        this.ctx.beginPath();
        this.ctx.arc(x, y, this.radius * 0.9 * scale, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.shadowBlur = 0;
    }

    draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw Grid
        for(let r=0; r<this.grid.length; r++) {
            if(!this.grid[r]) continue;
            for(let c=0; c<this.grid[r].length; c++) {
                if(this.grid[r][c]) {
                    const pos = this.getGridPos(r, c);
                    this.drawBubble(pos.x, pos.y, this.grid[r][c]);
                }
            }
        }

        // Draw Moving Bubble
        if (this.movingBubble) {
            this.drawBubble(this.movingBubble.x, this.movingBubble.y, this.movingBubble.color);
        }

        // Draw Shooter
        if (this.state === 'playing') {
            // Trajectory
            this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
            this.ctx.setLineDash([5, 5]);
            this.ctx.beginPath();
            this.ctx.moveTo(this.shooter.x, this.shooter.y);
            this.ctx.lineTo(this.shooter.x + Math.cos(this.shooter.angle) * 100, this.shooter.y + Math.sin(this.shooter.angle) * 100);
            this.ctx.stroke();
            this.ctx.setLineDash([]);

            // Loaded Bubble
            if(!this.movingBubble) {
                this.drawBubble(this.shooter.x, this.shooter.y, this.shooter.bubble);
            }
            // Next Bubble Preview
            this.drawBubble(this.shooter.x - 40, this.shooter.y + 10, this.shooter.nextBubble, 0.6);
        }

        // Draw Particles
        for(let p of this.particles) {
            this.ctx.fillStyle = p.color;
            this.ctx.shadowBlur = 10;
            this.ctx.shadowColor = p.color;
            this.ctx.globalAlpha = Math.max(0, p.life);
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, 4, 0, Math.PI*2);
            this.ctx.fill();
        }
        this.ctx.globalAlpha = 1;
        this.ctx.shadowBlur = 0;

        // Draw Danger Line
        this.ctx.strokeStyle = 'rgba(255, 0, 0, 0.3)';
        this.ctx.beginPath();
        this.ctx.moveTo(0, 11 * this.hexRadius * 2);
        this.ctx.lineTo(this.canvas.width, 11 * this.hexRadius * 2);
        this.ctx.stroke();
    }

    tick() {
        this.drawBackground();
        this.update();
        this.draw();
        requestAnimationFrame(this.tick);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new BubbleEngine();
});