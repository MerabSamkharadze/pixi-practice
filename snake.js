const { GlowFilter } = PIXI.filters;

// ============================================================
// CONFIG
// ============================================================
const CFG = {
    COLS: 30,
    ROWS: 20,
    CELL: 30,
    HUD_H: 120,
    START_SPEED: 140,
    MIN_SPEED: 60,
    SPEEDUP_EVERY: 5,
    SPEEDUP_STEP: 8,
};
const W = CFG.COLS * CFG.CELL;
const H = CFG.ROWS * CFG.CELL + CFG.HUD_H;
const GRID_TOP = CFG.HUD_H;

const COLORS = {
    bg: 0x0a0a1a,
    grid: 0x1a1a2e,
    snakeBody: 0x00ffff,
    snakeHead: 0x7fffff,
    food: 0xff00ff,
    foodRing: 0xff66ff,
    accent: 0xffff00,
    danger: 0xff0040,
    gold: 0xffd700,
    panel: 0x141428,
    panelStroke: 0x00ffff,
    text: 0xffffff,
};

// ============================================================
// STATE
// ============================================================
let app;
let layers = {};
let snake = [];
let food = null;
let dir = { x: 1, y: 0 };
let queuedDir = { x: 1, y: 0 };
let score = 0;
let highScore = 0;
let isGameOver = false;
let isPaused = false;
let tickMs = CFG.START_SPEED;
let tickAccumulator = 0;
let snakeContainer = null;
let segmentSprites = [];
let foodSprite = null;
let bgStars = [];
let scanLine = null;
let hud = {};
let popup = null;
let pauseOverlay = null;
let startOverlay = null;
let isStarted = false;
let highScoreBeaten = false;
let newHighShown = false;
let activeTweens = [];
let liveParticles = [];
let bgTime = 0;
const sfx = { eat: null, loose: null, victory: null };
let audioUnlocked = false;
let bgMusic = null;

// ============================================================
// BOOTSTRAP
// ============================================================
async function start() {
    initApp();
    buildLayers();
    loadHighScore();
    loadAudio();
    drawBackground();
    drawGrid();
    spawnBgStars(80);
    buildScanLine();
    buildHUD();
    setupInput();
    resetGame();
    showStartOverlay();

    app.ticker.add(onFrame);
}

function initApp() {
    app = new PIXI.Application({
        width: W,
        height: H,
        backgroundColor: COLORS.bg,
        antialias: true,
    });
    document.body.appendChild(app.view);
    app.stage.sortableChildren = true;
}

function buildLayers() {
    const order = ['bg', 'grid', 'stars', 'gameplay', 'particles', 'ui', 'popup'];
    order.forEach((name, i) => {
        const c = new PIXI.Container();
        c.zIndex = i * 10;
        c.sortableChildren = true;
        app.stage.addChild(c);
        layers[name] = c;
    });
}

// ============================================================
// AUDIO
// ============================================================
//   bgMusic   — lazy-loaded on first user gesture (autoplay policy).
//   sfx.*     — preloaded once at startup, reused via currentTime=0.
function loadAudio() {
    sfx.eat = new Audio('./assets/laser_shooting_sfx.wav');
    sfx.eat.volume = 0.35;
    sfx.eat.preload = 'auto';

    sfx.loose = new Audio('./assets/loose.mp3');
    sfx.loose.volume = 0.6;
    sfx.loose.preload = 'auto';

    sfx.victory = new Audio('./assets/killvictory1.mp3');
    sfx.victory.volume = 0.55;
    sfx.victory.preload = 'auto';
}

function playSfx(audio) {
    if (!audioUnlocked || !audio) return;
    try { audio.currentTime = 0; } catch (_) {}
    audio.play().catch(() => {});
}

function unlockAudioOnFirstInput() {
    if (audioUnlocked) return;
    audioUnlocked = true;
    if (!bgMusic) {
        bgMusic = new Audio('./assets/music.mp3');
        bgMusic.loop = true;
        bgMusic.volume = 0.35;
    }
}

function pauseMusic() {
    if (bgMusic && !bgMusic.paused) bgMusic.pause();
}

function resumeMusic() {
    if (bgMusic && audioUnlocked && bgMusic.paused) bgMusic.play().catch(() => {});
}

function restartMusic() {
    if (!bgMusic || !audioUnlocked) return;
    bgMusic.pause();
    try { bgMusic.currentTime = 0; } catch (_) {}
    bgMusic.play().catch(() => {});
}

function stopAllSfx() {
    for (const k in sfx) {
        const s = sfx[k];
        if (s && !s.paused) {
            s.pause();
            try { s.currentTime = 0; } catch (_) {}
        }
    }
}

// ============================================================
// HIGH SCORE
// ============================================================
function loadHighScore() {
    const v = parseInt(localStorage.getItem('snake_high_score'), 10);
    highScore = isNaN(v) ? 0 : v;
}

function saveHighScore() {
    localStorage.setItem('snake_high_score', String(highScore));
}

// ============================================================
// BACKGROUND
// ============================================================
function drawBackground() {
    const bg = new PIXI.Graphics();
    bg.beginFill(COLORS.bg);
    bg.drawRect(0, 0, W, H);
    bg.endFill();

    // gradient overlay (radial-ish via concentric alphas)
    for (let i = 0; i < 5; i++) {
        const o = new PIXI.Graphics();
        o.beginFill(0x1f0040, 0.06);
        o.drawCircle(W / 2, H / 2 + 80, 200 + i * 90);
        o.endFill();
        bg.addChild(o);
    }
    layers.bg.addChild(bg);
}

function drawGrid() {
    const g = new PIXI.Graphics();
    g.lineStyle(1, COLORS.grid, 0.35);
    for (let c = 0; c <= CFG.COLS; c++) {
        const x = c * CFG.CELL;
        g.moveTo(x, GRID_TOP);
        g.lineTo(x, H);
    }
    for (let r = 0; r <= CFG.ROWS; r++) {
        const y = GRID_TOP + r * CFG.CELL;
        g.moveTo(0, y);
        g.lineTo(W, y);
    }
    // Outer frame (neon)
    g.lineStyle(2, COLORS.snakeBody, 0.6);
    g.drawRect(1, GRID_TOP + 1, W - 2, H - GRID_TOP - 2);
    layers.grid.addChild(g);
}

function spawnBgStars(n) {
    for (let i = 0; i < n; i++) {
        const s = new PIXI.Graphics();
        const palette = [0x00ffff, 0xff00ff, 0xffff00, 0xffffff];
        const color = palette[Math.floor(Math.random() * palette.length)];
        const r = Math.random() * 1.5 + 0.5;
        s.beginFill(color, Math.random() * 0.5 + 0.3);
        s.drawCircle(0, 0, r);
        s.endFill();
        s.x = Math.random() * W;
        s.y = GRID_TOP + Math.random() * (H - GRID_TOP);
        s.vy = Math.random() * 0.3 + 0.05;
        s.twinkle = Math.random() * Math.PI * 2;
        layers.stars.addChild(s);
        bgStars.push(s);
    }
}

function buildScanLine() {
    scanLine = new PIXI.Graphics();
    scanLine.beginFill(COLORS.snakeBody, 0.08);
    scanLine.drawRect(0, 0, W, 4);
    scanLine.endFill();
    scanLine.y = GRID_TOP;
    layers.stars.addChild(scanLine);
}

// ============================================================
// HUD
// ============================================================
function buildHUD() {
    const panel = new PIXI.Graphics();
    panel.beginFill(0x0d0d20, 0.85);
    panel.drawRect(0, 0, W, CFG.HUD_H);
    panel.endFill();
    panel.lineStyle(2, COLORS.snakeBody, 0.6);
    panel.moveTo(0, CFG.HUD_H);
    panel.lineTo(W, CFG.HUD_H);
    layers.ui.addChild(panel);

    // Title
    const title = new PIXI.Text('NEON SNAKE', new PIXI.TextStyle({
        fill: [COLORS.snakeBody, COLORS.food],
        fontSize: 38,
        fontWeight: '900',
        fontFamily: 'Courier New',
        letterSpacing: 6,
    }));
    title.x = 24;
    title.y = 18;
    title.filters = [new GlowFilter({ distance: 14, outerStrength: 2, innerStrength: 0.5, color: COLORS.snakeBody })];
    layers.ui.addChild(title);

    const subStyle = (color) => new PIXI.TextStyle({
        fill: color,
        fontSize: 14,
        fontWeight: 'bold',
        fontFamily: 'Courier New',
        letterSpacing: 2,
    });
    const valStyle = (color) => new PIXI.TextStyle({
        fill: color,
        fontSize: 26,
        fontWeight: '900',
        fontFamily: 'Courier New',
    });

    const stats = [
        { key: 'score', label: 'SCORE',  color: COLORS.snakeBody, x: 360 },
        { key: 'high',  label: 'HIGH',   color: COLORS.gold,      x: 510 },
        { key: 'len',   label: 'LENGTH', color: COLORS.food,      x: 660 },
        { key: 'speed', label: 'SPEED',  color: COLORS.accent,    x: 810 },
    ];
    stats.forEach(s => {
        const lbl = new PIXI.Text(s.label, subStyle(s.color));
        lbl.x = s.x;
        lbl.y = 22;
        layers.ui.addChild(lbl);

        const val = new PIXI.Text('0', valStyle(s.color));
        val.x = s.x;
        val.y = 44;
        val.filters = [new GlowFilter({ distance: 10, outerStrength: 1.4, innerStrength: 0.3, color: s.color })];
        layers.ui.addChild(val);
        hud[s.key] = val;
    });

    // Hint
    const hint = new PIXI.Text(
        'ARROWS / WASD  ·  SPACE = PAUSE  ·  ENTER = RESTART',
        new PIXI.TextStyle({ fill: 0x6b7080, fontSize: 12, fontFamily: 'Courier New', letterSpacing: 2 })
    );
    hint.x = 24;
    hint.y = 80;
    layers.ui.addChild(hint);

    refreshHUD();
}

function refreshHUD() {
    hud.score.text = String(score);
    hud.high.text = String(highScore);
    hud.len.text = String(snake.length);
    const pct = Math.round(((CFG.START_SPEED - tickMs) / (CFG.START_SPEED - CFG.MIN_SPEED)) * 100);
    hud.speed.text = `${Math.max(0, pct)}%`;
}

// ============================================================
// GAME STATE
// ============================================================
function resetGame() {
    stopAllSfx();
    isGameOver = false;
    isPaused = false;
    isStarted = false;
    score = 0;
    tickMs = CFG.START_SPEED;
    tickAccumulator = 0;
    dir = { x: 1, y: 0 };
    queuedDir = { x: 1, y: 0 };
    highScoreBeaten = false;
    newHighShown = false;

    // Snake container with ONE shared GlowFilter (perf: avoid per-segment filter)
    if (snakeContainer) {
        layers.gameplay.removeChild(snakeContainer);
        snakeContainer.destroy({ children: true });
    }
    snakeContainer = new PIXI.Container();
    snakeContainer.filters = [new GlowFilter({
        distance: 16,
        outerStrength: 1.8,
        innerStrength: 0.5,
        color: COLORS.snakeBody,
    })];
    layers.gameplay.addChild(snakeContainer);
    segmentSprites = [];

    if (foodSprite) {
        layers.gameplay.removeChild(foodSprite);
        foodSprite.destroy({ children: true });
        foodSprite = null;
    }

    layers.particles.removeChildren();
    liveParticles.length = 0;
    activeTweens = [];

    if (popup) {
        layers.popup.removeChild(popup);
        popup.destroy({ children: true });
        popup = null;
    }
    if (pauseOverlay) {
        layers.popup.removeChild(pauseOverlay);
        pauseOverlay.destroy({ children: true });
        pauseOverlay = null;
    }
    if (startOverlay) {
        layers.popup.removeChild(startOverlay);
        startOverlay.destroy({ children: true });
        startOverlay = null;
    }

    const cy = Math.floor(CFG.ROWS / 2);
    const cx = Math.floor(CFG.COLS / 2);
    snake = [
        { x: cx,     y: cy },
        { x: cx - 1, y: cy },
        { x: cx - 2, y: cy },
    ];

    spawnFood();
    renderSnakeFull();
    refreshHUD();
}

function spawnFood() {
    const occupied = new Set(snake.map(s => `${s.x},${s.y}`));
    let x, y;
    do {
        x = Math.floor(Math.random() * CFG.COLS);
        y = Math.floor(Math.random() * CFG.ROWS);
    } while (occupied.has(`${x},${y}`));

    if (foodSprite) {
        layers.gameplay.removeChild(foodSprite);
        foodSprite.destroy({ children: true });
    }
    food = { x, y };

    foodSprite = new PIXI.Container();
    foodSprite.x = cellCenterX(x);
    foodSprite.y = cellCenterY(y);

    const ring = new PIXI.Graphics();
    ring.lineStyle(2, COLORS.foodRing, 0.6);
    ring.drawCircle(0, 0, 16);
    foodSprite.addChild(ring);
    foodSprite.ring = ring;

    const diamond = new PIXI.Graphics();
    diamond.beginFill(COLORS.food);
    diamond.moveTo(0, -10);
    diamond.lineTo(10, 0);
    diamond.lineTo(0, 10);
    diamond.lineTo(-10, 0);
    diamond.closePath();
    diamond.endFill();
    diamond.filters = [new GlowFilter({ distance: 22, outerStrength: 3, innerStrength: 0.8, color: COLORS.food })];
    foodSprite.addChild(diamond);
    foodSprite.diamond = diamond;

    layers.gameplay.addChild(foodSprite);
}

// ============================================================
// COORDINATE HELPERS
// ============================================================
function cellTopLeftX(cx) { return cx * CFG.CELL; }
function cellTopLeftY(cy) { return GRID_TOP + cy * CFG.CELL; }
function cellCenterX(cx) { return cellTopLeftX(cx) + CFG.CELL / 2; }
function cellCenterY(cy) { return cellTopLeftY(cy) + CFG.CELL / 2; }

// ============================================================
// SNAKE RENDERING
// ============================================================
function renderSnakeFull() {
    segmentSprites.forEach(s => {
        if (s.parent) s.parent.removeChild(s);
        s.destroy({ children: true });
    });
    segmentSprites = [];
    snake.forEach((seg, i) => segmentSprites.push(buildSegmentSprite(seg, i)));
}

function buildSegmentSprite(seg, index) {
    const isHead = index === 0;
    const c = new PIXI.Container();
    c.x = cellCenterX(seg.x);
    c.y = cellCenterY(seg.y);

    const size = isHead ? 28 : 26;
    const color = isHead ? COLORS.snakeHead : COLORS.snakeBody;
    const fade = 1 - Math.min(0.3, index / Math.max(snake.length, 12) * 0.4);

    const g = new PIXI.Graphics();
    g.beginFill(color, fade);
    g.drawRoundedRect(-size / 2, -size / 2, size, size, 7);
    g.endFill();
    c.addChild(g);
    c.body = g;

    if (isHead) {
        const eyes = new PIXI.Graphics();
        eyes.beginFill(0x041018);
        eyes.drawCircle(-5, -4, 2.4);
        eyes.drawCircle(5, -4, 2.4);
        eyes.endFill();
        c.addChild(eyes);
        c.eyes = eyes;
    }

    snakeContainer.addChild(c);
    return c;
}

function repositionSnakeSprites() {
    if (segmentSprites.length !== snake.length) {
        renderSnakeFull();
        return;
    }
    snake.forEach((seg, i) => {
        const s = segmentSprites[i];
        s.x = cellCenterX(seg.x);
        s.y = cellCenterY(seg.y);
    });
    if (segmentSprites[0] && segmentSprites[0].eyes) {
        const e = segmentSprites[0].eyes;
        e.clear();
        e.beginFill(0x041018);
        const ox = dir.x * 3;
        const oy = dir.y * 3;
        e.drawCircle(-5 + ox, -4 + oy, 2.4);
        e.drawCircle(5 + ox, -4 + oy, 2.4);
        e.endFill();
    }
}

// ============================================================
// FRAME LOOP
// ============================================================
function onFrame(deltaFrames) {
    const dt = deltaFrames * (1000 / 60);
    bgTime += dt;

    // Drift stars
    for (const s of bgStars) {
        s.y += s.vy;
        if (s.y > H) {
            s.y = GRID_TOP;
            s.x = Math.random() * W;
        }
        s.twinkle += 0.05;
        s.alpha = 0.5 + Math.sin(s.twinkle) * 0.4;
    }

    // Scan line
    if (scanLine) {
        scanLine.y += 0.6;
        if (scanLine.y > H) scanLine.y = GRID_TOP;
    }

    // Food pulse
    if (foodSprite) {
        foodSprite.diamond.rotation += 0.04;
        const s = 1 + Math.sin(bgTime * 0.006) * 0.18;
        foodSprite.diamond.scale.set(s);

        const rs = 1 + (Math.sin(bgTime * 0.004) * 0.5 + 0.5) * 0.5;
        foodSprite.ring.scale.set(rs);
        foodSprite.ring.alpha = 0.7 - (rs - 1) * 0.8;
    }

    // Particles (single shared loop)
    if (liveParticles.length) updateParticles(deltaFrames);

    // Run tweens
    runTweens(dt);

    // Game tick (movement) — paused until user clicks START
    if (isStarted && !isGameOver && !isPaused) {
        tickAccumulator += dt;
        while (tickAccumulator >= tickMs) {
            tickAccumulator -= tickMs;
            tick();
        }
    }
}

function tick() {
    // Apply queued direction (180° guard already applied at queue time)
    dir = queuedDir;

    const head = snake[0];
    const newHead = { x: head.x + dir.x, y: head.y + dir.y };

    // Wall collision
    if (newHead.x < 0 || newHead.x >= CFG.COLS || newHead.y < 0 || newHead.y >= CFG.ROWS) {
        return die();
    }
    // Self collision (skip last tail because it will move)
    for (let i = 0; i < snake.length - 1; i++) {
        if (snake[i].x === newHead.x && snake[i].y === newHead.y) {
            return die();
        }
    }

    snake.unshift(newHead);

    if (food && newHead.x === food.x && newHead.y === food.y) {
        eatFood();
    } else {
        snake.pop();
    }

    repositionSnakeSprites();
}

// ============================================================
// EAT
// ============================================================
function eatFood() {
    score += 10;
    const fx = cellCenterX(food.x);
    const fy = cellCenterY(food.y);

    // Particles
    spawnParticles(fx, fy, 14, [COLORS.food, COLORS.foodRing, COLORS.snakeBody, COLORS.accent]);
    floatScoreText(fx, fy, '+10');
    screenShake(4, 220);
    flashSnake();

    // Speed up every N eats
    if (score % (CFG.SPEEDUP_EVERY * 10) === 0) {
        tickMs = Math.max(CFG.MIN_SPEED, tickMs - CFG.SPEEDUP_STEP);
    }

    // Grow new segment sprite at the tail position (head was already pushed)
    const newIdx = snake.length - 1;
    const seg = snake[newIdx];
    const sprite = buildSegmentSprite(seg, newIdx);
    segmentSprites.push(sprite);

    // High score breach
    if (score > highScore) {
        if (!highScoreBeaten) {
            highScoreBeaten = true;
        }
        highScore = score;
        if (!newHighShown && score >= 50) {
            newHighShown = true;
            showNewHighScoreBanner();
        }
    }

    spawnFood();
    refreshHUD();
    playSfx(sfx.eat);
}

function flashSnake() {
    if (!snakeContainer || !snakeContainer.filters) return;
    const f = snakeContainer.filters[0];
    if (!f) return;
    f.outerStrength = 4;
    setTimeout(() => {
        if (snakeContainer && !snakeContainer.destroyed && f) f.outerStrength = 1.8;
    }, 140);
}

// ============================================================
// PARTICLES & EFFECTS
// ============================================================
function spawnParticles(x, y, count, palette) {
    for (let i = 0; i < count; i++) {
        const p = new PIXI.Graphics();
        const color = palette[i % palette.length];
        const r = Math.random() * 2 + 1.5;
        p.beginFill(color);
        p.drawCircle(0, 0, r);
        p.endFill();
        p.x = x;
        p.y = y;
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 4 + 2;
        p.vx = Math.cos(angle) * speed;
        p.vy = Math.sin(angle) * speed;
        p.life = 1;
        p.decay = Math.random() * 0.02 + 0.018;
        p.gravity = 0.05;
        layers.particles.addChild(p);
        liveParticles.push(p);
    }
}

// Single ticker iterates all live particles — much cheaper than one closure per particle.
function updateParticles(delta) {
    for (let i = liveParticles.length - 1; i >= 0; i--) {
        const p = liveParticles[i];
        p.x += p.vx * delta;
        p.y += p.vy * delta;
        p.vy += p.gravity * delta;
        p.vx *= 0.97;
        p.life -= p.decay * delta;
        p.alpha = Math.max(0, p.life);
        const sc = Math.max(0.2, p.life);
        p.scale.set(sc);
        if (p.life <= 0) {
            if (p.parent) p.parent.removeChild(p);
            p.destroy();
            liveParticles.splice(i, 1);
        }
    }
}

function floatScoreText(x, y, text) {
    const t = new PIXI.Text(text, new PIXI.TextStyle({
        fill: COLORS.accent,
        fontSize: 22,
        fontWeight: '900',
        fontFamily: 'Courier New',
    }));
    t.anchor.set(0.5);
    t.x = x;
    t.y = y;
    t.filters = [new GlowFilter({ distance: 10, outerStrength: 2, innerStrength: 0.5, color: COLORS.accent })];
    layers.particles.addChild(t);

    let life = 1;
    const fn = (delta) => {
        t.y -= 0.9 * delta;
        life -= 0.022 * delta;
        t.alpha = Math.max(0, life);
        t.scale.set(1 + (1 - life) * 0.4);
        if (life <= 0) {
            app.ticker.remove(fn);
            if (t.parent) t.parent.removeChild(t);
            t.destroy();
        }
    };
    app.ticker.add(fn);
}

function screenShake(magnitude, duration) {
    let elapsed = 0;
    const fn = (delta) => {
        const dt = delta * (1000 / 60);
        elapsed += dt;
        const f = 1 - elapsed / duration;
        if (f <= 0) {
            app.stage.x = 0;
            app.stage.y = 0;
            app.ticker.remove(fn);
            return;
        }
        app.stage.x = (Math.random() - 0.5) * 2 * magnitude * f;
        app.stage.y = (Math.random() - 0.5) * 2 * magnitude * f;
    };
    app.ticker.add(fn);
}

// ============================================================
// TWEEN SYSTEM
// ============================================================
const easings = {
    linear: t => t,
    easeOutQuad: t => 1 - (1 - t) * (1 - t),
    easeInQuad: t => t * t,
    easeOutBack: t => {
        const c1 = 1.70158;
        const c3 = c1 + 1;
        return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
    },
    easeOutElastic: t => {
        const c4 = (2 * Math.PI) / 3;
        return t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
    },
    easeOutCubic: t => 1 - Math.pow(1 - t, 3),
};

function tween({ target, props, duration, ease = 'easeOutQuad', delay = 0, onComplete }) {
    const tw = {
        target,
        props,
        duration,
        ease: easings[ease] || easings.linear,
        elapsed: -delay,
        onComplete,
        starts: null,
    };
    activeTweens.push(tw);
    return tw;
}

function runTweens(dt) {
    for (let i = activeTweens.length - 1; i >= 0; i--) {
        const tw = activeTweens[i];
        tw.elapsed += dt;
        if (tw.elapsed < 0) continue;
        if (!tw.starts) {
            tw.starts = {};
            for (const k in tw.props) tw.starts[k] = readProp(tw.target, k);
        }
        const t = Math.min(1, tw.elapsed / tw.duration);
        const e = tw.ease(t);
        for (const k in tw.props) {
            const from = tw.starts[k];
            const to = tw.props[k];
            writeProp(tw.target, k, from + (to - from) * e);
        }
        if (t >= 1) {
            activeTweens.splice(i, 1);
            tw.onComplete && tw.onComplete();
        }
    }
}

function readProp(o, k) {
    if (k.includes('.')) {
        const [a, b] = k.split('.');
        return o[a][b];
    }
    return o[k];
}
function writeProp(o, k, v) {
    if (k.includes('.')) {
        const [a, b] = k.split('.');
        o[a][b] = v;
    } else {
        o[k] = v;
    }
}

// ============================================================
// DEATH SEQUENCE
// ============================================================
function die() {
    if (isGameOver) return;
    isGameOver = true;
    pauseMusic();
    stopAllSfx();

    if (score >= highScore) {
        highScore = score;
        saveHighScore();
    }
    refreshHUD();

    const dyingSprites = segmentSprites.slice();
    const dyingContainer = snakeContainer;

    let flashes = 0;
    const totalFlashes = 6;
    const flashTimer = setInterval(() => {
        if (!isGameOver || !dyingContainer || dyingContainer.destroyed) {
            clearInterval(flashTimer);
            return;
        }
        const on = flashes % 2 === 0;
        const f = dyingContainer.filters && dyingContainer.filters[0];
        if (f) {
            f.color = on ? COLORS.danger : COLORS.snakeBody;
            f.outerStrength = on ? 4 : 1.8;
        }
        dyingSprites.forEach(s => {
            if (!s.body || s.destroyed) return;
            s.body.tint = on ? 0xff5577 : 0xffffff;
        });
        flashes++;
        if (flashes >= totalFlashes) {
            clearInterval(flashTimer);
            if (isGameOver) shatterSnake(dyingSprites);
        }
    }, 110);

    playSfx(sfx.loose);
}

function shatterSnake(sprites) {
    const arr = sprites || segmentSprites.slice();
    arr.forEach((s, i) => {
        setTimeout(() => {
            if (!isGameOver || s.destroyed) return;
            spawnParticles(s.x, s.y, 8, [COLORS.danger, 0xff8866, COLORS.snakeBody, COLORS.text]);
            if (s.parent) s.parent.removeChild(s);
        }, i * 35);
    });

    // White flash
    const flash = new PIXI.Graphics();
    flash.beginFill(0xffffff);
    flash.drawRect(0, 0, W, H);
    flash.endFill();
    flash.alpha = 0;
    layers.popup.addChild(flash);
    tween({ target: flash, props: { alpha: 0.7 }, duration: 80, ease: 'easeOutQuad', onComplete: () => {
        tween({ target: flash, props: { alpha: 0 }, duration: 350, ease: 'easeOutQuad', onComplete: () => {
            layers.popup.removeChild(flash);
            flash.destroy();
        }});
    }});

    setTimeout(() => showGameOverPopup(), 800 + arr.length * 35);
}

// ============================================================
// GAME OVER POPUP
// ============================================================
function showGameOverPopup() {
    if (!isGameOver) return; // user restarted before timer fired
    popup = new PIXI.Container();
    layers.popup.addChild(popup);

    // Dim overlay
    const dim = new PIXI.Graphics();
    dim.beginFill(0x000000);
    dim.drawRect(0, 0, W, H);
    dim.endFill();
    dim.alpha = 0;
    popup.addChild(dim);
    tween({ target: dim, props: { alpha: 0.78 }, duration: 320, ease: 'easeOutQuad' });

    // Panel
    const panelW = 600, panelH = 460;
    const panel = new PIXI.Container();
    panel.x = W / 2;
    panel.y = H / 2;
    panel.scale.set(0);
    popup.addChild(panel);

    const pg = new PIXI.Graphics();
    pg.lineStyle(3, COLORS.panelStroke, 0.9);
    pg.beginFill(COLORS.panel, 0.92);
    pg.drawRoundedRect(-panelW / 2, -panelH / 2, panelW, panelH, 18);
    pg.endFill();
    pg.filters = [new GlowFilter({ distance: 30, outerStrength: 2, innerStrength: 0.4, color: COLORS.panelStroke })];
    panel.addChild(pg);

    // Inner accent line
    const accent = new PIXI.Graphics();
    accent.lineStyle(2, COLORS.food, 0.5);
    accent.drawRoundedRect(-panelW / 2 + 12, -panelH / 2 + 12, panelW - 24, panelH - 24, 14);
    panel.addChild(accent);

    tween({ target: panel.scale, props: { x: 1, y: 1 }, duration: 520, ease: 'easeOutBack', delay: 200 });

    // GAME OVER text
    const goStyle = new PIXI.TextStyle({
        fill: [COLORS.danger, 0xff66aa],
        fontSize: 64,
        fontWeight: '900',
        fontFamily: 'Courier New',
        letterSpacing: 8,
        dropShadow: true,
        dropShadowColor: COLORS.danger,
        dropShadowDistance: 0,
        dropShadowBlur: 12,
    });
    const goText = new PIXI.Text('GAME OVER', goStyle);
    goText.anchor.set(0.5);
    goText.y = -panelH / 2 + 80;
    goText.scale.set(0);
    goText.filters = [new GlowFilter({ distance: 32, outerStrength: 2.5, innerStrength: 0.6, color: COLORS.danger })];
    panel.addChild(goText);
    tween({ target: goText.scale, props: { x: 1, y: 1 }, duration: 800, ease: 'easeOutElastic', delay: 400 });

    // Stats
    const isNew = highScoreBeaten;
    const stats = [
        { label: 'FINAL SCORE',  value: score,         color: COLORS.snakeBody },
        { label: 'SNAKE LENGTH', value: snake.length,  color: COLORS.food },
        { label: 'HIGH SCORE',   value: highScore,     color: COLORS.gold },
    ];
    stats.forEach((s, i) => {
        const row = new PIXI.Container();
        row.y = -50 + i * 44;
        row.alpha = 0;
        panel.addChild(row);

        const lbl = new PIXI.Text(s.label, new PIXI.TextStyle({
            fill: 0xa0a4b8, fontSize: 16, fontWeight: 'bold', fontFamily: 'Courier New', letterSpacing: 3,
        }));
        lbl.anchor.set(1, 0.5);
        lbl.x = -10;
        row.addChild(lbl);

        const val = new PIXI.Text(String(s.value), new PIXI.TextStyle({
            fill: s.color, fontSize: 28, fontWeight: '900', fontFamily: 'Courier New',
        }));
        val.anchor.set(0, 0.5);
        val.x = 10;
        val.filters = [new GlowFilter({ distance: 12, outerStrength: 1.6, innerStrength: 0.4, color: s.color })];
        row.addChild(val);

        tween({ target: row, props: { alpha: 1 }, duration: 320, ease: 'easeOutQuad', delay: 600 + i * 100 });
    });

    // New high score celebration
    if (isNew && score > 0) {
        const cel = new PIXI.Container();
        cel.y = 100;
        cel.alpha = 0;
        cel.scale.set(0.5);
        panel.addChild(cel);

        const star1 = new PIXI.Text('★', new PIXI.TextStyle({ fill: COLORS.gold, fontSize: 28, fontWeight: 'bold' }));
        star1.anchor.set(0.5);
        star1.x = -130;
        cel.addChild(star1);

        const star2 = new PIXI.Text('★', new PIXI.TextStyle({ fill: COLORS.gold, fontSize: 28, fontWeight: 'bold' }));
        star2.anchor.set(0.5);
        star2.x = 130;
        cel.addChild(star2);

        const celText = new PIXI.Text('NEW HIGH SCORE!', new PIXI.TextStyle({
            fill: COLORS.gold, fontSize: 26, fontWeight: '900', fontFamily: 'Courier New', letterSpacing: 4,
        }));
        celText.anchor.set(0.5);
        celText.filters = [new GlowFilter({ distance: 18, outerStrength: 2.2, innerStrength: 0.6, color: COLORS.gold })];
        cel.addChild(celText);

        tween({ target: cel, props: { alpha: 1 }, duration: 400, ease: 'easeOutQuad', delay: 950 });
        tween({ target: cel.scale, props: { x: 1, y: 1 }, duration: 700, ease: 'easeOutElastic', delay: 950 });

        // Sparkle stars rotate
        let t = 0;
        const sparkleFn = (delta) => {
            t += delta;
            star1.rotation += 0.05 * delta;
            star2.rotation -= 0.05 * delta;
            star1.scale.set(1 + Math.sin(t * 0.1) * 0.2);
            star2.scale.set(1 + Math.cos(t * 0.1) * 0.2);
            if (!popup) app.ticker.remove(sparkleFn);
        };
        app.ticker.add(sparkleFn);

        setTimeout(() => { stopAllSfx(); playSfx(sfx.victory); }, 950);
    }

    // Buttons
    const btn1 = buildButton('PLAY AGAIN', -120, panelH / 2 - 60, COLORS.snakeBody, () => {
        if (popup) {
            layers.popup.removeChild(popup);
            popup.destroy({ children: true });
            popup = null;
        }
        resetGame();
        startGame();
    });
    const btn2 = buildButton('RESET HIGH', 120, panelH / 2 - 60, COLORS.food, () => {
        highScore = 0;
        saveHighScore();
        refreshHUD();
        const sub = btn2.getChildByName('label');
        if (sub) sub.text = 'CLEARED';
    });
    btn1.alpha = 0;
    btn2.alpha = 0;
    btn1.y += 30;
    btn2.y += 30;
    panel.addChild(btn1);
    panel.addChild(btn2);
    tween({ target: btn1, props: { alpha: 1, y: panelH / 2 - 60 }, duration: 380, ease: 'easeOutBack', delay: 1100 });
    tween({ target: btn2, props: { alpha: 1, y: panelH / 2 - 60 }, duration: 380, ease: 'easeOutBack', delay: 1200 });
}

// ============================================================
// NEW HIGH SCORE BANNER (mid-game)
// ============================================================
function showNewHighScoreBanner() {
    const banner = new PIXI.Container();
    banner.x = W / 2;
    banner.y = H / 2;
    banner.alpha = 0;
    banner.scale.set(0.4);
    layers.popup.addChild(banner);

    const bg = new PIXI.Graphics();
    bg.lineStyle(2, COLORS.gold, 0.9);
    bg.beginFill(0x141428, 0.85);
    bg.drawRoundedRect(-220, -40, 440, 80, 14);
    bg.endFill();
    bg.filters = [new GlowFilter({ distance: 24, outerStrength: 2, innerStrength: 0.5, color: COLORS.gold })];
    banner.addChild(bg);

    const txt = new PIXI.Text('★  NEW HIGH SCORE  ★', new PIXI.TextStyle({
        fill: COLORS.gold, fontSize: 26, fontWeight: '900', fontFamily: 'Courier New', letterSpacing: 4,
    }));
    txt.anchor.set(0.5);
    txt.filters = [new GlowFilter({ distance: 14, outerStrength: 2, innerStrength: 0.5, color: COLORS.gold })];
    banner.addChild(txt);

    tween({ target: banner, props: { alpha: 1 }, duration: 300, ease: 'easeOutQuad' });
    tween({ target: banner.scale, props: { x: 1, y: 1 }, duration: 600, ease: 'easeOutElastic' });

    // Sparkle particles
    for (let i = 0; i < 30; i++) {
        setTimeout(() => spawnParticles(W / 2 + (Math.random() - 0.5) * 400, H / 2, 1, [COLORS.gold, COLORS.accent]), i * 30);
    }

    setTimeout(() => {
        tween({ target: banner, props: { alpha: 0 }, duration: 400, ease: 'easeInQuad', onComplete: () => {
            layers.popup.removeChild(banner);
            banner.destroy({ children: true });
        }});
    }, 1600);

    playSfx(sfx.victory);
}

// ============================================================
// BUTTON FACTORY
// ============================================================
function buildButton(label, x, y, color, onClick) {
    const c = new PIXI.Container();
    c.x = x;
    c.y = y;
    c.eventMode = 'static';
    c.cursor = 'pointer';

    const w = 180, h = 50;
    const bg = new PIXI.Graphics();
    const draw = (alpha) => {
        bg.clear();
        bg.lineStyle(2, color, 1);
        bg.beginFill(color, alpha);
        bg.drawRoundedRect(-w / 2, -h / 2, w, h, 12);
        bg.endFill();
    };
    draw(0.15);
    bg.filters = [new GlowFilter({ distance: 18, outerStrength: 1.8, innerStrength: 0.4, color })];
    c.addChild(bg);

    const t = new PIXI.Text(label, new PIXI.TextStyle({
        fill: 0xffffff, fontSize: 18, fontWeight: '900', fontFamily: 'Courier New', letterSpacing: 3,
    }));
    t.anchor.set(0.5);
    t.name = 'label';
    c.addChild(t);

    c.on('pointerover', () => {
        draw(0.4);
        c.scale.set(1.06);
    });
    c.on('pointerout', () => {
        draw(0.15);
        c.scale.set(1);
    });
    c.on('pointerdown', () => {
        c.scale.set(0.96);
        setTimeout(() => onClick && onClick(), 60);
    });
    return c;
}

// ============================================================
// INPUT
// ============================================================
function setupInput() {
    window.addEventListener('keydown', (e) => {
        const k = e.key.toLowerCase();
        if (k === 'arrowup' || k === 'w')    safeDirChange(0, -1);
        else if (k === 'arrowdown' || k === 's')  safeDirChange(0, 1);
        else if (k === 'arrowleft' || k === 'a')  safeDirChange(-1, 0);
        else if (k === 'arrowright' || k === 'd') safeDirChange(1, 0);
        else if (e.code === 'Space') {
            e.preventDefault();
            if (isStarted) togglePause();
        }
        else if (k === 'enter') {
            if (isGameOver) {
                if (popup) {
                    layers.popup.removeChild(popup);
                    popup.destroy({ children: true });
                    popup = null;
                }
                resetGame();
                startGame();
            } else if (!isStarted && startOverlay) {
                startGame();
            }
        }
    });

    // Pause when tab/window loses focus during active gameplay
    document.addEventListener('visibilitychange', () => {
        if (document.hidden && isStarted && !isGameOver && !isPaused) {
            togglePause();
        }
    });
}

function safeDirChange(x, y) {
    if (isGameOver || isPaused) return;
    if (dir.x + x === 0 && dir.y + y === 0) return; // 180° guard
    queuedDir = { x, y };
}

function togglePause() {
    if (isGameOver) return;
    isPaused = !isPaused;
    if (isPaused) {
        showPauseOverlay();
        pauseMusic();
    } else {
        hidePauseOverlay();
        resumeMusic();
    }
}

function showPauseOverlay() {
    if (pauseOverlay) return;
    pauseOverlay = new PIXI.Container();
    layers.popup.addChild(pauseOverlay);

    const dim = new PIXI.Graphics();
    dim.beginFill(0x000000, 0.55);
    dim.drawRect(0, 0, W, H);
    dim.endFill();
    pauseOverlay.addChild(dim);

    const t = new PIXI.Text('PAUSED', new PIXI.TextStyle({
        fill: COLORS.snakeBody, fontSize: 72, fontWeight: '900', fontFamily: 'Courier New', letterSpacing: 12,
    }));
    t.anchor.set(0.5);
    t.x = W / 2;
    t.y = H / 2;
    t.filters = [new GlowFilter({ distance: 26, outerStrength: 2.4, innerStrength: 0.5, color: COLORS.snakeBody })];
    pauseOverlay.addChild(t);

    const hint = new PIXI.Text('PRESS SPACE TO RESUME', new PIXI.TextStyle({
        fill: 0xa0a4b8, fontSize: 16, fontWeight: 'bold', fontFamily: 'Courier New', letterSpacing: 3,
    }));
    hint.anchor.set(0.5);
    hint.x = W / 2;
    hint.y = H / 2 + 60;
    pauseOverlay.addChild(hint);
}

function hidePauseOverlay() {
    if (!pauseOverlay) return;
    layers.popup.removeChild(pauseOverlay);
    pauseOverlay.destroy({ children: true });
    pauseOverlay = null;
}

// ============================================================
// START OVERLAY
// ============================================================
function showStartOverlay() {
    if (startOverlay) return;
    startOverlay = new PIXI.Container();
    layers.popup.addChild(startOverlay);

    const dim = new PIXI.Graphics();
    dim.beginFill(0x000000, 0.6);
    dim.drawRect(0, 0, W, H);
    dim.endFill();
    startOverlay.addChild(dim);

    const panel = new PIXI.Container();
    panel.x = W / 2;
    panel.y = H / 2;
    panel.scale.set(0);
    startOverlay.addChild(panel);

    const panelW = 540, panelH = 380;

    const pg = new PIXI.Graphics();
    pg.lineStyle(3, COLORS.snakeBody, 0.9);
    pg.beginFill(COLORS.panel, 0.94);
    pg.drawRoundedRect(-panelW / 2, -panelH / 2, panelW, panelH, 18);
    pg.endFill();
    pg.filters = [new GlowFilter({ distance: 28, outerStrength: 2, innerStrength: 0.4, color: COLORS.snakeBody })];
    panel.addChild(pg);

    const accent = new PIXI.Graphics();
    accent.lineStyle(2, COLORS.food, 0.45);
    accent.drawRoundedRect(-panelW / 2 + 12, -panelH / 2 + 12, panelW - 24, panelH - 24, 14);
    panel.addChild(accent);

    const title = new PIXI.Text('NEON SNAKE', new PIXI.TextStyle({
        fill: [COLORS.snakeBody, COLORS.food],
        fontSize: 48,
        fontWeight: '900',
        fontFamily: 'Courier New',
        letterSpacing: 8,
        dropShadow: true,
        dropShadowColor: COLORS.snakeBody,
        dropShadowDistance: 0,
        dropShadowBlur: 14,
    }));
    title.anchor.set(0.5);
    title.y = -panelH / 2 + 70;
    title.filters = [new GlowFilter({ distance: 24, outerStrength: 2.2, innerStrength: 0.5, color: COLORS.snakeBody })];
    panel.addChild(title);

    const sub = new PIXI.Text('ARROWS / WASD\nSPACE = PAUSE', new PIXI.TextStyle({
        fill: 0xa0a4b8,
        fontSize: 14,
        fontWeight: 'bold',
        fontFamily: 'Courier New',
        letterSpacing: 3,
        align: 'center',
        lineHeight: 22,
    }));
    sub.anchor.set(0.5);
    sub.y = -10;
    panel.addChild(sub);

    if (highScore > 0) {
        const hi = new PIXI.Text(`★ HIGH SCORE  ${highScore}`, new PIXI.TextStyle({
            fill: COLORS.gold,
            fontSize: 16,
            fontWeight: '900',
            fontFamily: 'Courier New',
            letterSpacing: 3,
        }));
        hi.anchor.set(0.5);
        hi.y = 50;
        hi.filters = [new GlowFilter({ distance: 12, outerStrength: 1.6, innerStrength: 0.4, color: COLORS.gold })];
        panel.addChild(hi);
    }

    const btn = buildButton('START', 0, panelH / 2 - 55, COLORS.snakeBody, () => {
        startGame();
    });
    panel.addChild(btn);

    tween({ target: panel.scale, props: { x: 1, y: 1 }, duration: 460, ease: 'easeOutBack' });
}

function hideStartOverlay() {
    if (!startOverlay) return;
    layers.popup.removeChild(startOverlay);
    startOverlay.destroy({ children: true });
    startOverlay = null;
}

function startGame() {
    if (isStarted) return;
    hideStartOverlay();
    isStarted = true;
    unlockAudioOnFirstInput();
    restartMusic();
}

// ============================================================
// GO
// ============================================================
start();
