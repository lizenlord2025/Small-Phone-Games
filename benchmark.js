const fs = require('fs');
const code = fs.readFileSync('arcade/script.js', 'utf8');
// Evaluate the code to get UIManager
const { JSDOM } = require('jsdom');
const dom = new JSDOM(`
  <div id="score">0</div>
  <div id="highscore">0</div>
  <div id="combo-value">1</div>
  <div id="combo-display"></div>
  <div id="combo-bar"></div>
  <div id="overlay"></div>
  <div id="start-btn"></div>
  <div id="mode-btn"></div>
  <div id="settings-btn"></div>
  <div id="sound-btn"></div>
  <div class="score-display"></div>
  <div class="screens">
    <div id="screen-start"></div>
    <div id="screen-game"></div>
    <div id="screen-game-over"></div>
  </div>
`);
global.document = dom.window.document;
global.window = dom.window;

// Mock requestAnimationFrame
global.requestAnimationFrame = (cb) => setTimeout(cb, 0);
global.localStorage = { getItem: () => null, setItem: () => {} };
global.AudioContext = class { createOscillator() { return { connect: () => {}, start: () => {}, stop: () => {}, type: '', frequency: { setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} } } } createGain() { return { connect: () => {}, gain: { setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} } } } };

// Mock canvas
global.HTMLCanvasElement = dom.window.HTMLCanvasElement;

try {
  eval(code);
  const ui = new UIManager();

  const state = {
    displayScore: 100,
    highScore: 200,
    combo: 2,
    comboTimer: 50,
    comboWindow: 100,
    nearMissGlow: 0.1,
    almostThere: true,
    justScored: true
  };

  const start = process.hrtime.bigint();
  for (let i = 0; i < 100000; i++) {
    ui.updateHUD(state);
  }
  const end = process.hrtime.bigint();

  console.log(`Time taken: ${(end - start) / 1000000n} ms`);

} catch(e) {
  console.error(e);
}
