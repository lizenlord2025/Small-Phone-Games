/**
 * Neon Snake Game
 * A modern, visually aesthetic snake game with smooth animations and neon effects
 */

// ============================================
// CONFIGURATION & CONSTANTS
// ============================================
const CONFIG = {
    GRID_SIZE: 20,
    INITIAL_SPEED: 150,
    MIN_SPEED: 60,
    SPEED_DECREMENT: 3,
    POINTS_PER_FOOD: 10,
    COLORS: {
        SNAKE_HEAD: '#00ff88',
        SNAKE_BODY: '#00cc6a',
        SNAKE_GLOW: 'rgba(0, 255, 136, 0.6)',
        FOOD: '#ff0088',
        FOOD_GLOW: 'rgba(255, 0, 136, 0.8)',
        GRID: 'rgba(255, 255, 255, 0.03)'
    }
};

// Global game instance
let game = null;

// ============================================
// AUDIO SYSTEM (Web Audio API)
// ============================================
class AudioController {
    constructor() {
        this.audioContext = null;
        this.enabled = true;
    }

    init() {
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
    }

    playTone(frequency, duration, type = 'sine', volume = 0.1) {
        if (!this.enabled || !this.audioContext) return;

        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);

        oscillator.frequency.value = frequency;
        oscillator.type = type;

        gainNode.gain.setValueAtTime(volume, this.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration);

        oscillator.start(this.audioContext.currentTime);
        oscillator.stop(this.audioContext.currentTime + duration);
    }

    playEatSound() {
        this.playTone(600, 0.1, 'sine', 0.15);
        setTimeout(() => this.playTone(800, 0.1, 'sine', 0.1), 50);
    }

    playGameOverSound() {
        this.playTone(400, 0.2, 'sawtooth', 0.2);
        setTimeout(() => this.playTone(300, 0.2, 'sawtooth', 0.2), 150);
        setTimeout(() => this.playTone(200, 0.4, 'sawtooth', 0.2), 300);
    }

    playStartSound() {
        this.playTone(400, 0.1, 'sine', 0.1);
        setTimeout(() => this.playTone(600, 0.1, 'sine', 0.1), 100);
        setTimeout(() => this.playTone(800, 0.2, 'sine', 0.1), 200);
    }
}

// ============================================
// GAME STATE MANAGEMENT
// ============================================
class GameState {
    constructor() {
        this.snake = [];
        this.direction = { x: 1, y: 0 };
        this.nextDirection = { x: 1, y: 0 };
        this.food = { x: 0, y: 0 };
        this.score = 0;
        this.highScore = parseInt(localStorage.getItem('snakeHighScore')) || 0;
        this.gameSpeed = CONFIG.INITIAL_SPEED;
        this.isRunning = false;
        this.isPaused = false;
        this.lastRender = 0;
        this.foodPulsePhase = 0;
    }

    reset(gridWidth, gridHeight) {
        const startX = Math.floor(gridWidth / 2);
        const startY = Math.floor(gridHeight / 2);
        this.snake = [
            { x: startX, y: startY },
            { x: startX - 1, y: startY },
            { x: startX - 2, y: startY }
        ];
        this.direction = { x: 1, y: 0 };
        this.nextDirection = { x: 1, y: 0 };
        this.score = 0;
        this.gameSpeed = CONFIG.INITIAL_SPEED;
        this.spawnFood(gridWidth, gridHeight);
    }

    spawnFood(gridWidth, gridHeight) {
        let validPosition = false;
        while (!validPosition) {
            this.food = {
                x: Math.floor(Math.random() * gridWidth),
                y: Math.floor(Math.random() * gridHeight)
            };
            // Ensure food doesn't spawn on snake
            validPosition = !this.snake.some(segment => 
                segment.x === this.food.x && segment.y === this.food.y
            );
        }
    }

    setDirection(x, y) {
        // Prevent 180-degree turns
        if (this.direction.x !== -x || this.direction.y !== -y) {
            this.nextDirection = { x, y };
        }
    }
}

// ============================================
// RENDERER (Canvas Drawing)
// ============================================
class GameRenderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.resize();
        window.addEventListener('resize', () => this.resize());
    }

    resize() {
        const maxSize = Math.min(window.innerWidth - 40, window.innerHeight - 200, 600);
        const size = Math.floor(maxSize / CONFIG.GRID_SIZE) * CONFIG.GRID_SIZE;
        
        this.canvas.width = size;
        this.canvas.height = size;
        this.canvas.style.width = `${size}px`;
        this.canvas.style.height = `${size}px`;
    }

    clear() {
        // Create gradient background
        const gradient = this.ctx.createLinearGradient(0, 0, this.canvas.width, this.canvas.height);
        gradient.addColorStop(0, 'rgba(10, 14, 39, 0.95)');
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0.95)');
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    drawGrid() {
        this.ctx.strokeStyle = CONFIG.COLORS.GRID;
        this.ctx.lineWidth = 1;

        for (let x = 0; x <= this.canvas.width; x += CONFIG.GRID_SIZE) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, this.canvas.height);
            this.ctx.stroke();
        }

        for (let y = 0; y <= this.canvas.height; y += CONFIG.GRID_SIZE) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(this.canvas.width, y);
            this.ctx.stroke();
        }
    }

    drawSnake(snake, time) {
        snake.forEach((segment, index) => {
            const isHead = index === 0;
            const x = segment.x * CONFIG.GRID_SIZE;
            const y = segment.y * CONFIG.GRID_SIZE;
            const size = CONFIG.GRID_SIZE - 2;

            // Calculate color interpolation from head to tail
            const ratio = index / snake.length;
            const r = Math.round(0 + ratio * (0 - 0));
            const g = Math.round(255 - ratio * (255 - 100));
            const b = Math.round(136 - ratio * (136 - 168));
            const color = `rgb(${r}, ${g}, ${b})`;

            // Draw segment with rounded corners
            this.ctx.fillStyle = color;
            this.ctx.shadowColor = CONFIG.COLORS.SNAKE_GLOW;
            this.ctx.shadowBlur = isHead ? 20 : 10;

            // Add subtle animation to head
            const pulse = isHead ? Math.sin(time * 0.01) * 2 : 0;
            const segmentSize = size + pulse;
            const offset = (CONFIG.GRID_SIZE - segmentSize) / 2;

            this.ctx.beginPath();
            this.ctx.roundRect(
                x + offset,
                y + offset,
                segmentSize,
                segmentSize,
                isHead ? 8 : 6
            );
            this.ctx.fill();

            // Draw eyes on head
            if (isHead) {
                this.drawEyes(x, y, segmentSize);
            }

            // Reset shadow
            this.ctx.shadowBlur = 0;
        });
    }

    drawEyes(x, y, size) {
        this.ctx.fillStyle = '#ffffff';
        this.ctx.shadowColor = '#ffffff';
        this.ctx.shadowBlur = 5;

        const eyeSize = 4;
        const eyeOffset = size * 0.25;
        
        // Position eyes based on direction
        const dirX = game.direction.x;
        const dirY = game.direction.y;

        let eye1X, eye1Y, eye2X, eye2Y;

        if (dirX !== 0) {
            // Moving horizontally
            eye1X = x + size * 0.7;
            eye1Y = y + eyeOffset;
            eye2X = x + size * 0.7;
            eye2Y = y + size - eyeOffset - eyeSize;
        } else {
            // Moving vertically
            eye1X = x + eyeOffset;
            eye1Y = y + size * 0.7;
            eye2X = x + size - eyeOffset - eyeSize;
            eye2Y = y + size * 0.7;
        }

        this.ctx.beginPath();
        this.ctx.arc(eye1X + eyeSize/2, eye1Y + eyeSize/2, eyeSize/2, 0, Math.PI * 2);
        this.ctx.arc(eye2X + eyeSize/2, eye2Y + eyeSize/2, eyeSize/2, 0, Math.PI * 2);
        this.ctx.fill();

        this.ctx.shadowBlur = 0;
    }

    drawFood(food, time) {
        const x = food.x * CONFIG.GRID_SIZE + CONFIG.GRID_SIZE / 2;
        const y = food.y * CONFIG.GRID_SIZE + CONFIG.GRID_SIZE / 2;
        
        // Pulsing animation
        const pulse = Math.sin(time * 0.005 + game.foodPulsePhase) * 3;
        const baseRadius = CONFIG.GRID_SIZE / 2 - 4;
        const radius = baseRadius + pulse;

        // Glow effect
        this.ctx.shadowColor = CONFIG.COLORS.FOOD_GLOW;
        this.ctx.shadowBlur = 20 + pulse * 2;

        // Draw food with gradient
        const gradient = this.ctx.createRadialGradient(x, y, 0, x, y, radius);
        gradient.addColorStop(0, '#ff66aa');
        gradient.addColorStop(0.5, CONFIG.COLORS.FOOD);
        gradient.addColorStop(1, '#ff0044');

        this.ctx.fillStyle = gradient;
        this.ctx.beginPath();
        this.ctx.arc(x, y, radius, 0, Math.PI * 2);
        this.ctx.fill();

        // Inner glow
        this.ctx.shadowBlur = 10;
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        this.ctx.beginPath();
        this.ctx.arc(x - 2, y - 2, radius * 0.3, 0, Math.PI * 2);
        this.ctx.fill();

        this.ctx.shadowBlur = 0;
    }

    render(state, time) {
        this.clear();
        this.drawGrid();
        this.drawFood(state.food, time);
        this.drawSnake(state.snake, time);
    }
}

// ============================================
// MAIN GAME CLASS
// ============================================
class SnakeGame {
    constructor() {
        this.canvas = document.getElementById('game-canvas');
        this.renderer = new GameRenderer(this.canvas);
        this.state = new GameState();
        this.audio = new AudioController();
        
        this.animationId = null;
        this.lastUpdate = 0;

        this.setupEventListeners();
        this.updateScoreDisplay();
    }

    setupEventListeners() {
        // Keyboard controls
        document.addEventListener('keydown', (e) => this.handleKeyPress(e));

        // Button controls
        document.getElementById('start-btn').addEventListener('click', () => this.startGame());
        document.getElementById('restart-btn').addEventListener('click', () => this.restartGame());
        document.getElementById('menu-btn').addEventListener('click', () => this.showMenu());

        // Touch controls for mobile
        this.setupTouchControls();
    }

    setupTouchControls() {
        let touchStartX = 0;
        let touchStartY = 0;

        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            touchStartX = e.touches[0].clientX;
            touchStartY = e.touches[0].clientY;
        }, { passive: false });

        this.canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
        }, { passive: false });

        this.canvas.addEventListener('touchend', (e) => {
            e.preventDefault();
            const touchEndX = e.changedTouches[0].clientX;
            const touchEndY = e.changedTouches[0].clientY;

            const dx = touchEndX - touchStartX;
            const dy = touchEndY - touchStartY;

            if (Math.abs(dx) > Math.abs(dy)) {
                // Horizontal swipe
                if (dx > 0) {
                    this.state.setDirection(1, 0);
                } else {
                    this.state.setDirection(-1, 0);
                }
            } else {
                // Vertical swipe
                if (dy > 0) {
                    this.state.setDirection(0, 1);
                } else {
                    this.state.setDirection(0, -1);
                }
            }
        }, { passive: false });
    }

    handleKeyPress(e) {
        if (!this.state.isRunning) return;

        switch(e.key) {
            case 'ArrowUp':
            case 'w':
            case 'W':
                this.state.setDirection(0, -1);
                break;
            case 'ArrowDown':
            case 's':
            case 'S':
                this.state.setDirection(0, 1);
                break;
            case 'ArrowLeft':
            case 'a':
            case 'A':
                this.state.setDirection(-1, 0);
                break;
            case 'ArrowRight':
            case 'd':
            case 'D':
                this.state.setDirection(1, 0);
                break;
        }
    }

    startGame() {
        this.audio.init();
        this.audio.playStartSound();
        
        this.switchScreen('game-screen');
        
        // Calculate grid dimensions based on canvas size
        const gridWidth = Math.floor(this.canvas.width / CONFIG.GRID_SIZE);
        const gridHeight = Math.floor(this.canvas.height / CONFIG.GRID_SIZE);
        
        this.state.reset(gridWidth, gridHeight);
        this.state.isRunning = true;
        this.updateScoreDisplay();
        
        this.lastUpdate = performance.now();
        this.gameLoop(performance.now());
    }

    restartGame() {
        this.audio.playStartSound();
        
        // Calculate grid dimensions based on canvas size
        const gridWidth = Math.floor(this.canvas.width / CONFIG.GRID_SIZE);
        const gridHeight = Math.floor(this.canvas.height / CONFIG.GRID_SIZE);
        
        this.state.reset(gridWidth, gridHeight);
        this.state.isRunning = true;
        this.updateScoreDisplay();
        
        this.lastUpdate = performance.now();
        this.gameLoop(performance.now());
    }

    showMenu() {
        this.switchScreen('start-screen');
    }

    switchScreen(screenId) {
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });
        document.getElementById(screenId).classList.add('active');
    }

    gameLoop(currentTime) {
        if (!this.state.isRunning) return;

        this.animationId = requestAnimationFrame((time) => this.gameLoop(time));

        // Update game state based on speed
        if (currentTime - this.lastUpdate >= this.state.gameSpeed) {
            this.update();
            this.lastUpdate = currentTime;
        }

        // Render at full frame rate for smooth animations
        this.renderer.render(this.state, currentTime);
    }

    update() {
        // Apply next direction
        this.state.direction = { ...this.state.nextDirection };

        // Calculate new head position
        const head = this.state.snake[0];
        const newHead = {
            x: head.x + this.state.direction.x,
            y: head.y + this.state.direction.y
        };

        // Check wall collision
        const gridWidth = this.canvas.width / CONFIG.GRID_SIZE;
        const gridHeight = this.canvas.height / CONFIG.GRID_SIZE;

        if (newHead.x < 0 || newHead.x >= gridWidth || 
            newHead.y < 0 || newHead.y >= gridHeight) {
            this.gameOver();
            return;
        }

        // Check self collision
        if (this.state.snake.some(segment => 
            segment.x === newHead.x && segment.y === newHead.y)) {
            this.gameOver();
            return;
        }

        // Move snake
        this.state.snake.unshift(newHead);

        // Check food collision
        if (newHead.x === this.state.food.x && newHead.y === this.state.food.y) {
            this.eatFood();
        } else {
            this.state.snake.pop();
        }
    }

    eatFood() {
        this.audio.playEatSound();
        this.state.score += CONFIG.POINTS_PER_FOOD;
        
        // Increase speed gradually
        if (this.state.gameSpeed > CONFIG.MIN_SPEED) {
            this.state.gameSpeed -= CONFIG.SPEED_DECREMENT;
        }

        this.updateScoreDisplay();
        
        // Calculate grid dimensions for food spawn
        const gridWidth = Math.floor(this.canvas.width / CONFIG.GRID_SIZE);
        const gridHeight = Math.floor(this.canvas.height / CONFIG.GRID_SIZE);
        this.state.spawnFood(gridWidth, gridHeight);
        
        // Randomize food pulse phase for variety
        this.state.foodPulsePhase = Math.random() * Math.PI * 2;
    }

    gameOver() {
        this.state.isRunning = false;
        cancelAnimationFrame(this.animationId);
        
        this.audio.playGameOverSound();

        // Update high score
        if (this.state.score > this.state.highScore) {
            this.state.highScore = this.state.score;
            localStorage.setItem('snakeHighScore', this.state.highScore.toString());
        }

        // Show game over screen
        document.getElementById('final-score').textContent = this.state.score;
        this.switchScreen('game-over-screen');
    }

    updateScoreDisplay() {
        const scoreElement = document.getElementById('score');
        const highScoreElement = document.getElementById('high-score');
        
        if (scoreElement) scoreElement.textContent = this.state.score;
        if (highScoreElement) highScoreElement.textContent = this.state.highScore;

        // Animate score change
        if (scoreElement) {
            scoreElement.classList.remove('pop');
            void scoreElement.offsetWidth; // Trigger reflow
            scoreElement.classList.add('pop');
        }
    }
}

// ============================================
// INITIALIZATION
// ============================================

window.addEventListener('DOMContentLoaded', () => {
    game = new SnakeGame();
});
