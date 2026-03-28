const { performance } = require('perf_hooks');

const ITERATIONS = 100000;
const POOL_SIZE = 100;

// Mock pools
const bullets = Array.from({length: POOL_SIZE}, (_, i) => ({
    active: i % 2 === 0,
    x: Math.random() * 480,
    y: Math.random() * 720,
    vx: 0,
    vy: -12,
    color: '#00f7ff',
    damage: 10,
    width: 4,
    height: 12
}));

// Mock context
const ctx = {
    fillStyle: '',
    fillRect: function(x, y, w, h) {
        // do nothing
    }
};

function runOriginal() {
    for (let i = 0; i < ITERATIONS; i++) {
        bullets.filter(b => b.active).forEach(b => {
            ctx.fillStyle = b.color;
            ctx.fillRect(b.x - b.width/2, b.y - b.height/2, b.width, b.height);
        });
    }
}

function runOptimized() {
    for (let i = 0; i < ITERATIONS; i++) {
        for (let j = 0; j < bullets.length; j++) {
            const b = bullets[j];
            if (b.active) {
                ctx.fillStyle = b.color;
                ctx.fillRect(b.x - b.width/2, b.y - b.height/2, b.width, b.height);
            }
        }
    }
}

function runForEachOptimized() {
    for (let i = 0; i < ITERATIONS; i++) {
        bullets.forEach(b => {
            if (b.active) {
                ctx.fillStyle = b.color;
                ctx.fillRect(b.x - b.width/2, b.y - b.height/2, b.width, b.height);
            }
        });
    }
}

// Warm up
runOriginal();
runOptimized();
runForEachOptimized();

const startOriginal = performance.now();
runOriginal();
const endOriginal = performance.now();

const startOptimized = performance.now();
runOptimized();
const endOptimized = performance.now();

const startForEachOptimized = performance.now();
runForEachOptimized();
const endForEachOptimized = performance.now();

console.log(`Original Time: ${(endOriginal - startOriginal).toFixed(2)} ms`);
console.log(`Optimized (for) Time: ${(endOptimized - startOptimized).toFixed(2)} ms`);
console.log(`Optimized (forEach) Time: ${(endForEachOptimized - startForEachOptimized).toFixed(2)} ms`);
console.log(`Improvement (for): ${((endOriginal - startOriginal) / (endOptimized - startOptimized)).toFixed(2)}x faster`);
console.log(`Improvement (forEach): ${((endOriginal - startOriginal) / (endForEachOptimized - startForEachOptimized)).toFixed(2)}x faster`);
