const { JSDOM } = require('jsdom');
const fs = require('fs');

const dom = new JSDOM(`<!DOCTYPE html>
<html>
<body>
  <div id="final-score"></div>
  <div id="final-high-score"></div>
  <div id="food-eaten"></div>
  <div id="snake-length"></div>
</body>
</html>`);
global.document = dom.window.document;
global.window = dom.window;

// Require the exported classes from script.js
const { UIManager } = require('./script.js');

const uiManager = new UIManager();
// Add dummy properties to avoid errors if UIManager expects them
uiManager.fpsValue = { textContent: '' };

const summary = {
    score: 100,
    highScore: 500,
    food: 10,
    length: 15
};

const ITERATIONS = 100000;

const start = process.hrtime.bigint();
for (let i = 0; i < ITERATIONS; i++) {
    uiManager.gameOver(summary);
}
const end = process.hrtime.bigint();

const durationMs = Number(end - start) / 1000000;
console.log(`Baseline Execution Time for ${ITERATIONS} iterations: ${durationMs.toFixed(2)} ms`);
