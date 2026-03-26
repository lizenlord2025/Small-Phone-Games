const { performance } = require('perf_hooks');

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

const DENSE_MIN_SEGMENT = NAVIGATION_BONUS.DENSE_MIN_SEGMENT;
const denseRadSq = NAVIGATION_BONUS.DENSE_RADIUS ** 2;

// Mock snake segments
const NUM_SEGMENTS = 50;
const segments = [];
for (let i = 0; i < NUM_SEGMENTS; i++) {
  segments.push({ x: 100 + Math.random() * 200, y: 100 + Math.random() * 200 });
}
const head = { x: 200, y: 200 };

const ITERATIONS = 1000000; // 1 million

function runOriginal() {
  let score = 0;
  for (let i = 0; i < ITERATIONS; i++) {
    const dense = segments.slice(DENSE_MIN_SEGMENT).filter(s => ((head.x - s.x)**2 + (head.y - s.y)**2) < denseRadSq).length;
    if (dense >= NAVIGATION_BONUS.DENSE_COUNT) score += NAVIGATION_BONUS.DENSE_SCORE;
  }
  return score;
}

function runOptimized() {
  let score = 0;
  for (let i = 0; i < ITERATIONS; i++) {
    let dense = 0;
    const hx = head.x;
    const hy = head.y;
    for (let j = DENSE_MIN_SEGMENT; j < segments.length; j++) {
      const s = segments[j];
      const dx = hx - s.x;
      const dy = hy - s.y;
      if (dx * dx + dy * dy < denseRadSq) {
        dense++;
      }
    }
    if (dense >= NAVIGATION_BONUS.DENSE_COUNT) score += NAVIGATION_BONUS.DENSE_SCORE;
  }
  return score;
}

// Warm up
runOriginal();
runOptimized();

const startOriginal = performance.now();
const res1 = runOriginal();
const endOriginal = performance.now();

const startOptimized = performance.now();
const res2 = runOptimized();
const endOptimized = performance.now();

console.log(`Original Time: ${(endOriginal - startOriginal).toFixed(2)} ms`);
console.log(`Optimized Time: ${(endOptimized - startOptimized).toFixed(2)} ms`);
console.log(`Improvement: ${((endOriginal - startOriginal) / (endOptimized - startOptimized)).toFixed(2)}x faster`);
console.log(`Outputs match: ${res1.toFixed(2) === res2.toFixed(2)} (${res1.toFixed(2)} vs ${res2.toFixed(2)})`);
