/**
 * Neon Memory - Premium Emoji Matcher
 */

const EMOJIS = ['🚀', '🛸', '🛰️', '🪐', '🌌', '🌠', '🌑', '👽', '🤖', '👾', '🎮', '🕹️', '🎸', '🎹', '⚡', '🔥', '💎', '🌈', '🍭', '🍕', '🐱', '🐲', '🦄', '🍀', '🏆', '🎭', '🎨', '🎬', '🧩', '🧨', '🧿', '🧬'];

const CONFIG = {
  easy: { grid: 'easy', pairs: 8, moves: 40 },
  medium: { grid: 'medium', pairs: 18, moves: 60 },
  hard: { grid: 'hard', pairs: 32, moves: 80 }
};

class MemoryGame {
  constructor() {
    this.diff = 'medium';
    this.theme = 'neon';
    this.moves = 0;
    this.movesLimit = CONFIG[this.diff].moves;
    this.matchedPairs = 0;
    this.firstCard = null;
    this.secondCard = null;
    this.lockBoard = false;
    this.cards = [];

    this.initElements();
    this.initEvents();
    this.loadStats();
  }

  initElements() {
    this.screens = {
      start: document.getElementById('start-screen'),
      game: document.getElementById('game-screen')
    };
    this.modals = {
      result: document.getElementById('result-modal'),
      difficulty: document.getElementById('difficulty-modal'),
      theme: document.getElementById('theme-modal')
    };
    this.grid = document.getElementById('game-grid');
    this.movesCountEl = document.getElementById('moves-count');
    this.movesLeftEl = document.getElementById('moves-left');
    this.bestMovesEl = document.getElementById('best-moves');
  }

  initEvents() {
    // Buttons
    document.getElementById('start-btn').addEventListener('click', () => this.startGame());
    document.getElementById('difficulty-btn').addEventListener('click', () => this.showModal('difficulty'));
    document.getElementById('theme-btn').addEventListener('click', () => this.showModal('theme'));
    document.getElementById('back-to-snake').addEventListener('click', () => window.location.href = 'index.html');
    document.getElementById('quit-btn').addEventListener('click', () => this.endGame('quit'));
    document.getElementById('play-again-btn').addEventListener('click', () => {
      this.hideModal('result');
      this.startGame();
    });
    document.getElementById('menu-btn').addEventListener('click', () => {
      this.hideModal('result');
      this.showScreen('start');
    });

    // Modal close
    document.querySelectorAll('.modal-close').forEach(btn => {
      btn.addEventListener('click', (e) => this.hideModal(e.target.closest('.modal').id.replace('-modal', '')));
    });

    // Difficulty selection
    document.querySelectorAll('.diff-option').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.diff = e.currentTarget.dataset.diff;
        document.querySelectorAll('.diff-option').forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
        document.getElementById('current-difficulty').textContent = this.diff.toUpperCase();
        this.hideModal('difficulty');
      });
    });

    // Theme selection
    document.querySelectorAll('.theme-option').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.theme = e.currentTarget.dataset.theme;
        document.querySelectorAll('.theme-option').forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
        document.body.className = `theme-${this.theme}`;
        document.getElementById('current-theme').textContent = this.theme.toUpperCase();
        this.hideModal('theme');
      });
    });
  }

  showScreen(name) {
    Object.values(this.screens).forEach(s => s.classList.remove('active'));
    this.screens[name].classList.add('active');
  }

  showModal(name) {
    this.modals[name].classList.add('active');
  }

  hideModal(name) {
    this.modals[name].classList.remove('active');
  }

  loadStats() {
    const best = localStorage.getItem('neonMemory.bestMoves.' + this.diff);
    this.bestMovesEl.textContent = best || '-';
  }

  startGame() {
    this.moves = 0;
    this.matchedPairs = 0;
    this.movesLimit = CONFIG[this.diff].moves;
    this.movesCountEl.textContent = '0';
    this.movesLeftEl.textContent = this.movesLimit;
    this.grid.className = `game-grid ${CONFIG[this.diff].grid}`;
    this.grid.innerHTML = '';

    this.createBoard();
    this.showScreen('game');
  }

  createBoard() {
    const numPairs = CONFIG[this.diff].pairs;
    const selectedEmojis = this.shuffle([...EMOJIS]).slice(0, numPairs);
    const cardValues = this.shuffle([...selectedEmojis, ...selectedEmojis]);

    cardValues.forEach(emoji => {
      const card = document.createElement('div');
      card.className = 'memory-card';
      card.dataset.emoji = emoji;
      card.innerHTML = `
        <div class="card-face card-back"></div>
        <div class="card-face card-front">${emoji}</div>
      `;
      card.addEventListener('click', () => this.flipCard(card));
      this.grid.appendChild(card);
    });
  }

  shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  flipCard(card) {
    if (this.lockBoard || card === this.firstCard || card.classList.contains('matched')) return;

    card.classList.add('flipped');

    if (!this.firstCard) {
      this.firstCard = card;
      return;
    }

    this.secondCard = card;
    this.checkForMatch();
  }

  checkForMatch() {
    this.moves++;
    this.movesCountEl.textContent = this.moves;
    this.movesLeftEl.textContent = this.movesLimit - this.moves;

    let isMatch = this.firstCard.dataset.emoji === this.secondCard.dataset.emoji;
    isMatch ? this.disableCards() : this.unflipCards();

    if (this.moves >= this.movesLimit && this.matchedPairs < CONFIG[this.diff].pairs) {
      setTimeout(() => this.endGame('lose'), 1000);
    }
  }

  disableCards() {
    this.firstCard.classList.add('matched');
    this.secondCard.classList.add('matched');
    this.matchedPairs++;
    this.resetBoard();

    if (this.matchedPairs === CONFIG[this.diff].pairs) {
      setTimeout(() => this.endGame('win'), 800);
    }
  }

  unflipCards() {
    this.lockBoard = true;
    setTimeout(() => {
      this.firstCard.classList.remove('flipped');
      this.secondCard.classList.remove('flipped');
      this.resetBoard();
    }, 1000);
  }

  resetBoard() {
    [this.firstCard, this.secondCard] = [null, null];
    this.lockBoard = false;
  }

  endGame(result) {
    if (result === 'quit') {
      this.showScreen('start');
      return;
    }

    const title = document.getElementById('result-title');
    if (result === 'win') {
      title.textContent = 'YOU HAVE WON!';
      title.style.color = 'var(--primary-color)';
      this.saveBestScore();
    } else {
      title.textContent = 'GAME OVER';
      title.style.color = 'var(--danger-color)';
    }

    document.getElementById('final-moves').textContent = this.moves;
    document.getElementById('final-diff').textContent = this.diff.toUpperCase();
    this.showModal('result');
    this.loadStats();
  }

  saveBestScore() {
    const key = 'neonMemory.bestMoves.' + this.diff;
    const currentBest = localStorage.getItem(key);
    if (!currentBest || this.moves < parseInt(currentBest)) {
      localStorage.setItem(key, this.moves);
    }
  }
}

// Initialize
window.addEventListener('DOMContentLoaded', () => {
  new MemoryGame();
});
