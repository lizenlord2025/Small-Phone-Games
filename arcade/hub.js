class HubRenderer {
    constructor() {
        this.canvas = document.getElementById('hub-bg-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.particles = Array.from({ length: 60 }, () => ({
            x: Math.random(),
            y: Math.random(),
            vx: (Math.random() - 0.5) * 0.0005,
            vy: (Math.random() - 0.5) * 0.0005,
            size: Math.random() * 2 + 1,
            color: ['#00f7ff', '#37ff00', '#ff00ff'][Math.floor(Math.random() * 3)]
        }));

        this.resize();
        window.addEventListener('resize', () => this.resize());
        this.tick = this.tick.bind(this);
        requestAnimationFrame(this.tick);
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    tick(ts) {
        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;

        // Dynamic background gradient
        if (!this.cachedGrad || this.cachedWidth !== w || this.cachedHeight !== h) {
            this.cachedGrad = ctx.createLinearGradient(0, 0, w, h);
            this.cachedGrad.addColorStop(0, '#060915');
            this.cachedGrad.addColorStop(0.5, '#13072f');
            this.cachedGrad.addColorStop(1, '#000000');
            this.cachedWidth = w;
            this.cachedHeight = h;
        }
        ctx.fillStyle = this.cachedGrad;
        ctx.fillRect(0, 0, w, h);

        // Grid lines
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
        ctx.lineWidth = 1;
        const gridOffset = (ts * 0.02) % 40;

        ctx.beginPath();
        for(let i = 0; i < w; i += 40) {
            ctx.moveTo(i, 0);
            ctx.lineTo(i, h);
        }
        for(let i = -gridOffset; i < h; i += 40) {
            ctx.moveTo(0, i);
            ctx.lineTo(w, i);
        }
        ctx.stroke();

        // Particles
        for (const p of this.particles) {
            p.x = (p.x + p.vx) % 1;
            if(p.x < 0) p.x += 1;
            p.y = (p.y + p.vy) % 1;
            if(p.y < 0) p.y += 1;

            ctx.fillStyle = p.color;
            ctx.globalAlpha = 0.4 + Math.sin(ts * 0.001 + p.x * 10) * 0.3;
            ctx.beginPath();
            ctx.arc(p.x * w, p.y * h, p.size, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;

        requestAnimationFrame(this.tick);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new HubRenderer();
});
