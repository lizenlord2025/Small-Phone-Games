// Initialize Matter.js aliases
const Engine = Matter.Engine,
      Render = Matter.Render,
      Runner = Matter.Runner,
      Bodies = Matter.Bodies,
      Composite = Matter.Composite,
      Events = Matter.Events,
      Vector = Matter.Vector,
      Body = Matter.Body;

// Game State
const state = {
    level: 1,
    isDragging: false,
    dragStart: { x: 0, y: 0 },
    dragCurrent: { x: 0, y: 0 },
    theme: 'neon',
    isTransitioning: false
};

// DOM Elements
const canvas = document.getElementById('game-canvas');
const uiCanvas = document.getElementById('ui-canvas');
const ctx = canvas.getContext('2d');
const uiCtx = uiCanvas.getContext('2d');
const levelDisplay = document.getElementById('level-display');
const modal = document.getElementById('game-modal');
const modalTitle = document.getElementById('modal-title');
const nextLevelBtn = document.getElementById('next-level-btn');
const hubReturnBtn = document.getElementById('hub-return-btn');
const resetBtn = document.getElementById('reset-btn');
const themeSelect = document.getElementById('theme-select');
const tutorialText = document.getElementById('tutorial-text');

// Set up engine
const engine = Engine.create();
engine.world.gravity.y = 0; // Disable global gravity
engine.world.gravity.x = 0;

// Render loop handles physics running, but we'll draw manually
const runner = Runner.create();
Runner.run(runner, engine);

// Physics Entities
let ball = null;
let hole = null;
let planets = [];
let boundaries = [];
let ballStartPos = { x: 0, y: 0 };

const ENTITY_COLLISION_CATEGORY = {
    BALL: 0x0001,
    HOLE: 0x0002,
    PLANET: 0x0004,
    BOUNDARY: 0x0008
};

function createBall(x, y) {
    if (ball) {
        Composite.remove(engine.world, ball);
    }
    ballStartPos = { x, y };
    ball = Bodies.circle(x, y, 12, {
        label: 'ball',
        restitution: 0.8, // Bouncy
        friction: 0.05,
        frictionAir: 0.01,
        density: 0.04,
        collisionFilter: {
            category: ENTITY_COLLISION_CATEGORY.BALL,
            // Ball collides with boundary and hole, but passes through planet gravity fields (handled manually) and planet bodies
            mask: ENTITY_COLLISION_CATEGORY.BOUNDARY | ENTITY_COLLISION_CATEGORY.HOLE | ENTITY_COLLISION_CATEGORY.PLANET
        },
        render: { fillStyle: 'white' }
    });
    Composite.add(engine.world, ball);
}

function createHole(x, y, radius = 25) {
    if (hole) {
        Composite.remove(engine.world, hole);
    }
    hole = Bodies.circle(x, y, radius, {
        isStatic: true,
        isSensor: true,
        label: 'hole',
        collisionFilter: {
            category: ENTITY_COLLISION_CATEGORY.HOLE,
            mask: ENTITY_COLLISION_CATEGORY.BALL
        }
    });
    Composite.add(engine.world, hole);
}

function createPlanet(x, y, radius, gravityRadius, pullStrength, color) {
    const planetBody = Bodies.circle(x, y, radius, {
        isStatic: true,
        label: 'planet',
        collisionFilter: {
            category: ENTITY_COLLISION_CATEGORY.PLANET,
            mask: ENTITY_COLLISION_CATEGORY.BALL
        }
    });

    // Attach custom properties for gravity logic
    planetBody.customProps = {
        gravityRadius: gravityRadius,
        pullStrength: pullStrength,
        color: color
    };

    planets.push(planetBody);
    Composite.add(engine.world, planetBody);
}

function clearEntities() {
    if (ball) Composite.remove(engine.world, ball);
    if (hole) Composite.remove(engine.world, hole);
    if (planets.length > 0) Composite.remove(engine.world, planets);

    ball = null;
    hole = null;
    planets = [];
}

// Gravity Physics
Events.on(engine, 'beforeUpdate', function() {
    if (!ball || planets.length === 0) return;

    for (let i = 0; i < planets.length; i++) {
        const planet = planets[i];
        const props = planet.customProps;

        const dx = planet.position.x - ball.position.x;
        const dy = planet.position.y - ball.position.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // Check if ball is inside gravity radius but outside physical planet body
        if (distance < props.gravityRadius && distance > planet.circleRadius) {
            // Normalize direction
            const nx = dx / distance;
            const ny = dy / distance;

            // Calculate inverse-square force
            // Limit the minimum distance in calculation to prevent infinite forces
            const minDistance = Math.max(distance, planet.circleRadius + 5);
            let forceMagnitude = (props.pullStrength * ball.mass) / (minDistance * minDistance);

            // Clamp maximum force
            const maxForce = 0.05; // Tunable max force
            if (forceMagnitude > maxForce) {
                forceMagnitude = maxForce;
            }

            Body.applyForce(ball, ball.position, {
                x: nx * forceMagnitude,
                y: ny * forceMagnitude
            });
        }
    }
});

// Input Handling
function handlePointerDown(e) {
    if (!ball || state.isTransitioning) return;

    // Only allow firing if the ball is mostly stationary
    if (ball.speed > 0.5) return;

    state.isDragging = true;

    let clientX = e.clientX;
    let clientY = e.clientY;
    if (e.touches && e.touches.length > 0) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
    }

    state.dragStart = { x: clientX, y: clientY };
    state.dragCurrent = { x: clientX, y: clientY };

    // Hide tutorial
    if (!tutorialText.classList.contains('hidden')) {
        tutorialText.classList.add('hidden');
    }
}

function handlePointerMove(e) {
    if (!state.isDragging) return;

    let clientX = e.clientX;
    let clientY = e.clientY;
    if (e.touches && e.touches.length > 0) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
    }

    state.dragCurrent = { x: clientX, y: clientY };
}

function handlePointerUp(e) {
    if (!state.isDragging) return;
    state.isDragging = false;

    // Calculate drag vector
    const dx = state.dragCurrent.x - state.dragStart.x;
    const dy = state.dragCurrent.y - state.dragStart.y;

    // Ignore tiny drags
    if (Math.abs(dx) < 5 && Math.abs(dy) < 5) return;

    // Apply force opposite to drag direction
    const powerMultiplier = 0.00008; // Tune this to feel good

    // Cap maximum drag distance for calculation
    const maxDrag = 300;
    let dragDist = Math.sqrt(dx*dx + dy*dy);
    if (dragDist > maxDrag) {
        dragDist = maxDrag;
    }

    // Normalize and scale
    const nx = dx / Math.sqrt(dx*dx + dy*dy);
    const ny = dy / Math.sqrt(dx*dx + dy*dy);

    const forceX = -nx * dragDist * powerMultiplier * ball.mass;
    const forceY = -ny * dragDist * powerMultiplier * ball.mass;

    Body.applyForce(ball, ball.position, { x: forceX, y: forceY });
}

// Level Definitions
const LEVELS = [
    {
        id: 1,
        setup: (w, h) => {
            createBall(w * 0.2, h * 0.5);
            createHole(w * 0.8, h * 0.5);
        }
    },
    {
        id: 2,
        setup: (w, h) => {
            createBall(w * 0.15, h * 0.8);
            createHole(w * 0.85, h * 0.2);
            // x, y, radius, gravityRadius, pullStrength, color
            createPlanet(w * 0.5, h * 0.5, 40, 200, 1.5, 'planet-1');
        }
    },
    {
        id: 3,
        setup: (w, h) => {
            createBall(w * 0.1, h * 0.9);
            createHole(w * 0.9, h * 0.1);
            createPlanet(w * 0.35, h * 0.6, 35, 180, 1.2, 'planet-2');
            createPlanet(w * 0.65, h * 0.4, 45, 220, -0.8, 'planet-1'); // Anti-gravity planet!
        }
    }
];

function loadLevel(levelNum) {
    if (levelNum > LEVELS.length) {
        showGameComplete();
        return;
    }

    state.level = levelNum;
    state.isTransitioning = false;
    state.isDragging = false;
    levelDisplay.textContent = levelNum;

    clearEntities();

    // Slight delay to ensure resize/bounds are ready
    setTimeout(() => {
        const config = LEVELS[levelNum - 1];
        config.setup(window.innerWidth, window.innerHeight);

        // Ensure tutorial shows only on level 1
        if (levelNum === 1) {
            tutorialText.classList.remove('hidden');
        } else {
            tutorialText.classList.add('hidden');
        }
    }, 50);
}

function resetCurrentLevel() {
    if (state.isTransitioning) return;
    state.isDragging = false;

    if (ball) {
        Body.setPosition(ball, ballStartPos);
        Body.setVelocity(ball, { x: 0, y: 0 });
        Body.setAngularVelocity(ball, 0);
    }
}

// Collisions & Win Condition
Events.on(engine, 'collisionStart', function(event) {
    const pairs = event.pairs;

    for (let i = 0; i < pairs.length; i++) {
        const bodyA = pairs[i].bodyA;
        const bodyB = pairs[i].bodyB;

        const isHoleCollision = (bodyA.label === 'ball' && bodyB.label === 'hole') ||
                                (bodyA.label === 'hole' && bodyB.label === 'ball');

        const isBoundaryCollision = (bodyA.label === 'ball' && bodyB.label === 'boundary') ||
                                    (bodyA.label === 'boundary' && bodyB.label === 'ball');

        if (isHoleCollision && !state.isTransitioning) {
            // Check ball speed - must be slow enough to "fall in"
            if (ball.speed < 8.0) { // Tune speed threshold
                handleLevelComplete();
            } else {
                // Too fast! Bounce off or pass over?
                // Since it's a sensor, it passes over visually. We just ignore the win.
                console.log("Too fast to hole in!", ball.speed);
            }
        }

        if (isBoundaryCollision) {
            resetCurrentLevel();
        }
    }
});

// UI & Modal Handling
function handleLevelComplete() {
    state.isTransitioning = true;

    // Stop ball visually
    Body.setVelocity(ball, {x:0, y:0});
    Body.setPosition(ball, hole.position);

    setTimeout(() => {
        modalTitle.textContent = "LEVEL COMPLETE";
        modalTitle.setAttribute('data-text', "LEVEL COMPLETE");
        nextLevelBtn.classList.remove('hidden');
        hubReturnBtn.classList.add('hidden');
        modal.classList.remove('hidden');
    }, 500);
}

function showGameComplete() {
    state.isTransitioning = true;
    modalTitle.textContent = "GAME COMPLETE!";
    modalTitle.setAttribute('data-text', "GAME COMPLETE!");
    document.getElementById('modal-message').textContent = "You mastered the galaxy!";

    nextLevelBtn.classList.add('hidden');
    hubReturnBtn.classList.remove('hidden');
    modal.classList.remove('hidden');
}

nextLevelBtn.addEventListener('click', () => {
    modal.classList.add('hidden');
    loadLevel(state.level + 1);
});

resetBtn.addEventListener('click', () => {
    resetCurrentLevel();
});

// Attach Input Listeners
uiCanvas.addEventListener('mousedown', handlePointerDown);
uiCanvas.addEventListener('mousemove', handlePointerMove);
window.addEventListener('mouseup', handlePointerUp); // Window level to catch release outside canvas

uiCanvas.addEventListener('touchstart', handlePointerDown, { passive: false });
uiCanvas.addEventListener('touchmove', function(e) { e.preventDefault(); handlePointerMove(e); }, { passive: false });
window.addEventListener('touchend', handlePointerUp);

// Init level system and interaction handlers
function init() {
    console.log("Gravity Golf Initialized");
    createBoundaries();
    loadLevel(1);
    requestAnimationFrame(renderLoop);
}

function createBoundaries() {
    const thickness = 100;
    const width = window.innerWidth;
    const height = window.innerHeight;

    // Remove old boundaries
    if (boundaries.length > 0) {
        Composite.remove(engine.world, boundaries);
    }

    // Create 4 walls slightly outside the view
    boundaries = [
        Bodies.rectangle(width / 2, -thickness / 2, width + thickness * 2, thickness, { isStatic: true, label: 'boundary' }),
        Bodies.rectangle(width / 2, height + thickness / 2, width + thickness * 2, thickness, { isStatic: true, label: 'boundary' }),
        Bodies.rectangle(-thickness / 2, height / 2, thickness, height + thickness * 2, { isStatic: true, label: 'boundary' }),
        Bodies.rectangle(width + thickness / 2, height / 2, thickness, height + thickness * 2, { isStatic: true, label: 'boundary' })
    ];

    Composite.add(engine.world, boundaries);
}

// Resize handling
function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    uiCanvas.width = window.innerWidth;
    uiCanvas.height = window.innerHeight;
    createBoundaries();
}
window.addEventListener('resize', resize);
resize();

// Theme Handling
themeSelect.addEventListener('change', (e) => {
    state.theme = e.target.value;
    document.body.className = state.theme === 'neon' ? 'neon-theme' : 'minimal-theme';
});

// Helper for CSS Variables
function getVar(name) {
    return getComputedStyle(document.body).getPropertyValue(name).trim();
}

function renderLoop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    uiCtx.clearRect(0, 0, uiCanvas.width, uiCanvas.height);

    // 1. Draw Planets and Gravity Rings
    if (planets.length > 0) {
        for (let planet of planets) {
            const pos = planet.position;
            const isNeon = state.theme === 'neon';

            // Draw gravity ring
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, planet.customProps.gravityRadius, 0, 2 * Math.PI);
            ctx.fillStyle = isNeon ? getVar('--neon-ring') : getVar('--min-ring');
            ctx.fill();

            if (isNeon) {
                ctx.strokeStyle = planet.customProps.pullStrength < 0 ? 'rgba(255,0,0,0.3)' : 'rgba(0,255,255,0.3)';
                ctx.lineWidth = 1;
                ctx.stroke();
            }

            // Draw planet body
            const colorVar = state.theme === 'neon' ? `--neon-${planet.customProps.color}` : `--min-${planet.customProps.color}`;
            const pColor = getVar(colorVar);

            ctx.beginPath();
            ctx.arc(pos.x, pos.y, planet.circleRadius, 0, 2 * Math.PI);
            ctx.fillStyle = pColor;
            if (isNeon) {
                ctx.shadowBlur = 20;
                ctx.shadowColor = pColor;
            } else {
                ctx.shadowBlur = 0;
            }
            ctx.fill();
            ctx.shadowBlur = 0; // Reset
        }
    }

    // 2. Draw Hole
    if (hole) {
        const hPos = hole.position;
        const isNeon = state.theme === 'neon';
        const hColor = isNeon ? getVar('--neon-hole') : getVar('--min-hole');

        ctx.beginPath();
        ctx.arc(hPos.x, hPos.y, hole.circleRadius, 0, 2 * Math.PI);
        ctx.strokeStyle = hColor;
        ctx.lineWidth = 3;

        if (isNeon) {
            ctx.shadowBlur = 15;
            ctx.shadowColor = hColor;
        } else {
            ctx.shadowBlur = 0;
            ctx.fillStyle = hColor;
            ctx.fill();
        }
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Inner pulse
        const pulse = Math.sin(Date.now() / 300) * 5;
        ctx.beginPath();
        ctx.arc(hPos.x, hPos.y, Math.max(0, hole.circleRadius - 10 + pulse), 0, 2 * Math.PI);
        ctx.fillStyle = hColor;
        ctx.globalAlpha = 0.5;
        ctx.fill();
        ctx.globalAlpha = 1.0;
    }

    // 3. Draw Ball
    if (ball && !state.isTransitioning) {
        const bPos = ball.position;
        const isNeon = state.theme === 'neon';
        const bColor = isNeon ? getVar('--neon-ball') : getVar('--min-ball');

        ctx.beginPath();
        ctx.arc(bPos.x, bPos.y, ball.circleRadius, 0, 2 * Math.PI);
        ctx.fillStyle = bColor;
        if (isNeon) {
            ctx.shadowBlur = 10;
            ctx.shadowColor = bColor;
        }
        ctx.fill();
        ctx.shadowBlur = 0;
    }

    // 4. Draw UI Drag Line
    if (state.isDragging && ball) {
        const isNeon = state.theme === 'neon';
        const dx = state.dragCurrent.x - state.dragStart.x;
        const dy = state.dragCurrent.y - state.dragStart.y;

        // Calculate clamped drag distance
        const maxDrag = 300;
        let dragDist = Math.sqrt(dx*dx + dy*dy);
        if (dragDist > maxDrag) dragDist = maxDrag;

        // Vector pointing opposite
        let nx = 0, ny = 0;
        if (dragDist > 0) {
            nx = dx / Math.sqrt(dx*dx + dy*dy);
            ny = dy / Math.sqrt(dx*dx + dy*dy);
        }

        const visualLineLength = dragDist * 1.5; // Scale visual line

        const targetX = ball.position.x - nx * visualLineLength;
        const targetY = ball.position.y - ny * visualLineLength;

        uiCtx.beginPath();
        uiCtx.moveTo(ball.position.x, ball.position.y);
        uiCtx.lineTo(targetX, targetY);
        uiCtx.setLineDash([10, 10]);
        uiCtx.lineWidth = 3;
        uiCtx.strokeStyle = isNeon ? getVar('--neon-trajectory') : getVar('--min-trajectory');
        uiCtx.stroke();
        uiCtx.setLineDash([]); // Reset
    }

    requestAnimationFrame(renderLoop);
}

// Start game
init();