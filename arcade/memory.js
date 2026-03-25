document.addEventListener('DOMContentLoaded', () => {
    // Game Elements
    const memoryBoard = document.getElementById('memory-board');
    const movesLeftEl = document.getElementById('moves-left');
    const pairsMatchedEl = document.getElementById('pairs-matched');
    const levelSelect = document.getElementById('level-select');
    const themeSelect = document.getElementById('theme-select');
    const modal = document.getElementById('game-over-modal');
    const modalTitle = document.getElementById('modal-title');
    const modalMessage = document.getElementById('modal-message');
    const finalMovesEl = document.getElementById('final-moves');
    const restartBtn = document.getElementById('restart-btn');
    const body = document.body;

    // Emojis for the cards
    const emojiSet = [
        '🚀', '🛸', '🛰️', '🪐', '👽', '👾', '🤖', '☄️',
        '🌟', '🌠', '🔮', '🎭', '🔥', '⚡', '💧', '🌪️',
        '🌈', '✨', '🎈', '🎉', '🎃', '👻', '💀', '👑'
    ];

    // Level configurations
    const levels = {
        easy: { pairs: 6, maxMoves: 20, columns: 4 },     // 12 cards, 4x3
        medium: { pairs: 8, maxMoves: 24, columns: 4 },   // 16 cards, 4x4
        hard: { pairs: 10, maxMoves: 28, columns: 5 }     // 20 cards, 5x4
    };

    // Game State
    let currentLevel = 'easy';
    let cards = [];
    let firstCard = null;
    let secondCard = null;
    let lockBoard = false;
    let matchedPairs = 0;
    let movesLeft = 0;
    let totalMoves = 0;

    // Initialize Game
    function initGame() {
        // Reset state
        const config = levels[currentLevel];
        matchedPairs = 0;
        totalMoves = 0;
        movesLeft = config.maxMoves;
        firstCard = null;
        secondCard = null;
        lockBoard = false;

        // Update UI
        movesLeftEl.textContent = movesLeft;
        pairsMatchedEl.textContent = `${matchedPairs}/${config.pairs}`;
        modal.classList.add('hidden');
        memoryBoard.innerHTML = '';

        // Set Grid Columns
        memoryBoard.style.gridTemplateColumns = `repeat(${config.columns}, 1fr)`;

        // Prepare Cards
        const selectedEmojis = shuffleArray([...emojiSet]).slice(0, config.pairs);
        const cardValues = shuffleArray([...selectedEmojis, ...selectedEmojis]);

        // Create DOM Elements
        cardValues.forEach((value, index) => {
            const cardElement = document.createElement('div');
            cardElement.classList.add('card');
            cardElement.dataset.value = value;
            cardElement.dataset.index = index;

            const cardFront = document.createElement('div');
            cardFront.classList.add('card-face', 'card-front');

            const cardBack = document.createElement('div');
            cardBack.classList.add('card-face', 'card-back');
            cardBack.textContent = value;

            cardElement.appendChild(cardFront);
            cardElement.appendChild(cardBack);

            cardElement.addEventListener('click', flipCard);
            memoryBoard.appendChild(cardElement);
        });
    }

    // Shuffle Array (Fisher-Yates)
    function shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    // Handle Card Flip
    function flipCard() {
        if (lockBoard) return;
        if (this === firstCard) return; // Prevent double click on same card
        if (this.classList.contains('matched')) return;

        this.classList.add('flipped');

        if (!firstCard) {
            // First click
            firstCard = this;
            return;
        }

        // Second click
        secondCard = this;
        totalMoves++;
        movesLeft--;
        movesLeftEl.textContent = movesLeft;

        checkForMatch();
    }

    // Check for Match
    function checkForMatch() {
        const isMatch = firstCard.dataset.value === secondCard.dataset.value;

        if (isMatch) {
            disableCards();
        } else {
            unflipCards();
        }

        checkGameOver();
    }

    // Match Found
    function disableCards() {
        firstCard.classList.add('matched');
        secondCard.classList.add('matched');

        matchedPairs++;
        pairsMatchedEl.textContent = `${matchedPairs}/${levels[currentLevel].pairs}`;

        resetBoard();
    }

    // Not a Match
    function unflipCards() {
        lockBoard = true;

        setTimeout(() => {
            firstCard.classList.remove('flipped');
            secondCard.classList.remove('flipped');
            resetBoard();
        }, 1000); // 1 second delay
    }

    // Reset interaction state
    function resetBoard() {
        [firstCard, secondCard, lockBoard] = [null, null, false];
    }

    // Check Win/Loss conditions
    function checkGameOver() {
        const config = levels[currentLevel];

        // Small delay to allow final flip animation to finish
        setTimeout(() => {
            if (matchedPairs === config.pairs) {
                // Win
                showModal(true);
            } else if (movesLeft <= 0) {
                // Loss
                showModal(false);
            }
        }, 500);
    }

    // Show Game Over Modal
    function showModal(isWin) {
        modalTitle.textContent = isWin ? 'You Won!' : 'Game Over';
        modalTitle.className = `modal-title ${isWin ? 'win' : 'lose'}`;
        modalMessage.textContent = isWin ? 'Great job finding all pairs!' : 'You ran out of moves.';
        finalMovesEl.textContent = totalMoves;
        modal.classList.remove('hidden');
    }

    // Event Listeners
    levelSelect.addEventListener('change', (e) => {
        currentLevel = e.target.value;
        initGame();
    });

    themeSelect.addEventListener('change', (e) => {
        const selectedTheme = e.target.value;
        body.className = `theme-${selectedTheme}`;

        // Handle Background Canvas visibility if needed (managed by CSS mostly)
    });

    restartBtn.addEventListener('click', initGame);

    // Initial Start
    initGame();

    // --- Background Particles for Neon Theme (Optional Eye Candy) ---
    const canvas = document.getElementById('bg-canvas');
    if (canvas) {
        const ctx = canvas.getContext('2d');
        let width, height;
        let particles = [];

        function resize() {
            width = canvas.width = window.innerWidth;
            height = canvas.height = window.innerHeight;
        }

        window.addEventListener('resize', resize);
        resize();

        class Particle {
            constructor() {
                this.x = Math.random() * width;
                this.y = Math.random() * height;
                this.size = Math.random() * 2 + 0.5;
                this.speedX = (Math.random() - 0.5) * 0.5;
                this.speedY = (Math.random() - 0.5) * 0.5;
                this.color = `rgba(0, 247, 255, ${Math.random() * 0.5 + 0.1})`;
            }
            update() {
                this.x += this.speedX;
                this.y += this.speedY;

                if (this.x > width) this.x = 0;
                else if (this.x < 0) this.x = width;
                if (this.y > height) this.y = 0;
                else if (this.y < 0) this.y = height;
            }
            draw() {
                ctx.fillStyle = this.color;
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        for (let i = 0; i < 50; i++) {
            particles.push(new Particle());
        }

        function animate() {
            // Only draw if neon theme is active (CSS handles visibility, but let's save CPU)
            if (document.body.classList.contains('theme-neon')) {
                ctx.clearRect(0, 0, width, height);
                particles.forEach(p => {
                    p.update();
                    p.draw();
                });
            }
            requestAnimationFrame(animate);
        }
        animate();
    }
});
