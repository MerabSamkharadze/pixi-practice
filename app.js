import * as PIXI from 'https://cdn.jsdelivr.net/npm/pixi.js@7.4.3/dist/pixi.min.mjs';

// --- ძირითადი ცვლადები ---
let app;
let asteroid;
let racket;
let bullets = [];
let asteroidHits = 0;
const HITS_TO_DESTROY = 3;

// --- პროგრესის და მდგომარეობის ცვლადები ---
let destroyedCount = 0;
const TOTAL_ASTEROIDS_TO_WIN = 7;
let healthBar;
let scoreText;
let isGameOver = false;
let isStarted = false;
let endMessage;
let restartButton;
let startOverlay;

// --- აუდიო ფაილები ---
let victorySfx;
let looseSfx;
let bgMusic = new Audio('./assets/music.mp3');
bgMusic.loop = true;
bgMusic.volume = 0.5;
let isMusicPlaying = false;

// --- თამაშის ინიციალიზაცია ---
async function start() {
    await init();
    addBackground();
    addRandomStars(150);
    addRacket();
    addScoreText();
    addHealthBar();

    resetGameSession();
    setupInteractions();
    animate();
    showStartOverlay();
}

function init() {
    app = new PIXI.Application({
        width: 1000,
        height: 600,
        backgroundColor: 0x000000,
        antialias: true,
    });
    document.body.appendChild(app.view);
    app.stage.sortableChildren = true;
}

// --- ვიზუალური ელემენტების დამატება ---
function addBackground() {
    const texture = PIXI.Texture.from('./assets/purple.png');
    const bg = new PIXI.TilingSprite(texture, app.screen.width, app.screen.height);
    app.stage.addChildAt(bg, 0);
}

function addRandomStars(count) {
    for (let i = 0; i < count; i++) {
        const star = PIXI.Sprite.from('./assets/star1.png');
        star.anchor.set(0.5);
        star.scale.set(Math.random() * 0.2 + 0.25);
        star.x = Math.random() * app.screen.width;
        star.y = Math.random() * app.screen.height;
        star.alpha = Math.random();
        app.stage.addChild(star);
    }
}

function addAsteroid() {
    if (!asteroid) {
        asteroid = PIXI.Sprite.from('./assets/asteroid.png');
        asteroid.anchor.set(0.5);
        asteroid.scale.set(0.3);
        app.stage.addChild(asteroid);
    }
    asteroid.x = Math.random() * (app.screen.width - 100) + 50;
    asteroid.y = -50;
    asteroid.visible = true;
}

function addHealthBar() {
    healthBar = new PIXI.Container();
    const bg = new PIXI.Graphics();
    bg.beginFill(0xff0000);
    bg.drawRect(-25, 0, 50, 5);
    bg.endFill();

    const bar = new PIXI.Graphics();
    bar.beginFill(0x00ff00);
    bar.drawRect(-25, 0, 50, 5);
    bar.endFill();
    bar.name = "health";

    healthBar.addChild(bg);
    healthBar.addChild(bar);
    app.stage.addChild(healthBar);
    healthBar.zIndex = 10;
    healthBar.visible = false;
}

function addScoreText() {
    const style = new PIXI.TextStyle({ fill: "#ffffff", fontSize: 24, fontWeight: "bold" });
    scoreText = new PIXI.Text("", style);
    scoreText.x = 20;
    scoreText.y = 20;
    scoreText.zIndex = 100;
    app.stage.addChild(scoreText);
}

function addRacket() {
    racket = PIXI.Sprite.from('./assets/racket.png');
    racket.anchor.set(0.5);
    racket.scale.set(0.7);
    racket.y = app.screen.height - 70;
    app.stage.addChild(racket);
}

// --- ინტერაქცია და სროლა ---
function setupInteractions() {
    app.stage.eventMode = 'static';
    app.stage.hitArea = app.screen;
    app.stage.on('pointermove', (event) => {
        if (racket && !isGameOver && isStarted) {
            racket.x = event.global.x;
        }
    });

    window.addEventListener('mousedown', () => {
        if (isStarted && !isGameOver) {
            fireBullet();
        }
    });
}

function fireBullet() {
    const shotSfx = new Audio('./assets/laser_shooting_sfx.wav');
    shotSfx.volume = 0.3;
    shotSfx.play();

    const bullet = PIXI.Sprite.from('./assets/laser-bullete.png');
    bullet.anchor.set(0.5);
    bullet.scale.set(0.5);
    bullet.x = racket.x;
    bullet.y = racket.y - 30;
    app.stage.addChild(bullet);
    bullets.push(bullet);
}

// --- ეფექტები ---
function showDamageEffect(x, y) {
    const damage = PIXI.Sprite.from('./assets/damage-asteroid.png');
    damage.anchor.set(0.5);
    damage.scale.set(0.7);
    damage.x = x;
    damage.y = y;
    app.stage.addChild(damage);
    setTimeout(() => app.stage.removeChild(damage), 100);
}

// --- აუდიო helpers ---
function stopAllEndSfx() {
    if (victorySfx) {
        victorySfx.pause();
        victorySfx.currentTime = 0;
        victorySfx = null;
    }
    if (looseSfx) {
        looseSfx.pause();
        looseSfx.currentTime = 0;
        looseSfx = null;
    }
}

// --- თამაშის ლოგიკა ---
function resetGameSession() {
    isGameOver = false;
    destroyedCount = 0;
    asteroidHits = 0;

    stopAllEndSfx();

    if (endMessage) {
        app.stage.removeChild(endMessage);
        endMessage.destroy();
        endMessage = null;
    }
    if (restartButton) {
        app.stage.removeChild(restartButton);
        restartButton.destroy({ children: true });
        restartButton = null;
    }

    racket.visible = true;
    racket.x = app.screen.width / 2;
    scoreText.text = `Asteroids: 0 / ${TOTAL_ASTEROIDS_TO_WIN}`;

    addAsteroid();
    resetHealthBar();
    healthBar.visible = true;

    if (isMusicPlaying) {
        bgMusic.currentTime = 0;
        bgMusic.play().catch(() => {});
    }
}

function animate() {
    app.ticker.add(() => {
        if (!isStarted || isGameOver) return;

        if (asteroid && asteroid.visible) {
            asteroid.rotation += 0.02;
            asteroid.y += 1.5;

            healthBar.x = asteroid.x;
            healthBar.y = asteroid.y - 40;

            if (checkCollision(racket, asteroid, 60)) {
                endGame("GAME OVER!");
            }

            if (asteroid.y > app.screen.height + 50) {
                resetAsteroid();
                resetHealthBar();
            }
        }

        for (let i = bullets.length - 1; i >= 0; i--) {
            let b = bullets[i];
            b.y -= 10;

            if (asteroid && asteroid.visible && checkCollision(b, asteroid, 50)) {
                showDamageEffect(asteroid.x, asteroid.y);
                app.stage.removeChild(b);
                bullets.splice(i, 1);
                asteroidHits++;

                const bar = healthBar.getChildByName("health");
                bar.scale.x = (HITS_TO_DESTROY - asteroidHits) / HITS_TO_DESTROY;

                if (asteroidHits >= HITS_TO_DESTROY) {
                    destroyedCount++;
                    scoreText.text = `Asteroids: ${destroyedCount} / ${TOTAL_ASTEROIDS_TO_WIN}`;
                    if (destroyedCount >= TOTAL_ASTEROIDS_TO_WIN) {
                        endGame("MISSION ACCOMPLISHED!");
                    } else {
                        resetAsteroid();
                        resetHealthBar();
                    }
                }
                continue;
            }
            if (b.y < -50) {
                app.stage.removeChild(b);
                bullets.splice(i, 1);
            }
        }
    });
}

function checkCollision(obj1, obj2, limit) {
    const dx = obj1.x - obj2.x;
    const dy = obj1.y - obj2.y;
    return Math.sqrt(dx * dx + dy * dy) < limit;
}

function resetAsteroid() {
    asteroid.y = -50;
    asteroid.x = Math.random() * (app.screen.width - 100) + 50;
    asteroid.visible = true;
}

function resetHealthBar() {
    asteroidHits = 0;
    const bar = healthBar.getChildByName("health");
    bar.scale.x = 1;
}

// --- დასასრული ---
function endGame(text) {
    isGameOver = true;
    bgMusic.pause();
    stopAllEndSfx();

    if (text === "MISSION ACCOMPLISHED!") {
        victorySfx = new Audio('./assets/killvictory1.mp3');
        victorySfx.volume = 0.8;
        victorySfx.play().catch(() => {});
    }
    if (text === "GAME OVER!") {
        looseSfx = new Audio('./assets/loose.mp3');
        looseSfx.volume = 0.8;
        looseSfx.play().catch(() => {});
    }

    asteroid.visible = false;
    racket.visible = false;
    healthBar.visible = false;

    bullets.forEach(b => app.stage.removeChild(b));
    bullets = [];

    const style = new PIXI.TextStyle({ fill: "#ffffff", fontSize: 48, fontWeight: "bold" });
    endMessage = new PIXI.Text(text, style);
    endMessage.anchor.set(0.5);
    endMessage.x = app.screen.width / 2;
    endMessage.y = app.screen.height / 2 - 50;
    endMessage.zIndex = 1000;
    app.stage.addChild(endMessage);

    addRestartButton();
}

function addRestartButton() {
    restartButton = new PIXI.Container();

    const btnBg = new PIXI.Graphics();
    btnBg.beginFill(0x22aa22);
    btnBg.drawRoundedRect(-75, -25, 150, 50, 10);
    btnBg.endFill();

    const btnText = new PIXI.Text("RESTART", { fill: "#ffffff", fontSize: 24, fontWeight: "bold" });
    btnText.anchor.set(0.5);

    restartButton.addChild(btnBg);
    restartButton.addChild(btnText);

    restartButton.x = app.screen.width / 2;
    restartButton.y = app.screen.height / 2 + 50;
    restartButton.zIndex = 1001;

    restartButton.eventMode = 'static';
    restartButton.cursor = 'pointer';

    restartButton.on('pointerdown', () => {
        resetGameSession();
    });

    app.stage.addChild(restartButton);
}

// --- START overlay ---
function showStartOverlay() {
    if (startOverlay) return;
    startOverlay = new PIXI.Container();
    startOverlay.zIndex = 2000;

    const dim = new PIXI.Graphics();
    dim.beginFill(0x000000, 0.7);
    dim.drawRect(0, 0, app.screen.width, app.screen.height);
    dim.endFill();
    startOverlay.addChild(dim);

    const panel = new PIXI.Container();
    panel.x = app.screen.width / 2;
    panel.y = app.screen.height / 2;
    startOverlay.addChild(panel);

    const panelW = 520, panelH = 340;

    const pg = new PIXI.Graphics();
    pg.lineStyle(3, 0x00ffff, 0.85);
    pg.beginFill(0x141428, 0.94);
    pg.drawRoundedRect(-panelW / 2, -panelH / 2, panelW, panelH, 16);
    pg.endFill();
    panel.addChild(pg);

    const accent = new PIXI.Graphics();
    accent.lineStyle(2, 0xff00ff, 0.4);
    accent.drawRoundedRect(-panelW / 2 + 10, -panelH / 2 + 10, panelW - 20, panelH - 20, 12);
    panel.addChild(accent);

    const title = new PIXI.Text('ASTEROID SHOOTER', new PIXI.TextStyle({
        fill: '#00ffff',
        fontSize: 30,
        fontWeight: '900',
        fontFamily: 'Courier New',
        letterSpacing: 5,
        dropShadow: true,
        dropShadowColor: '#00ffff',
        dropShadowDistance: 0,
        dropShadowBlur: 14,
    }));
    title.anchor.set(0.5);
    title.y = -panelH / 2 + 55;
    panel.addChild(title);

    const sub = new PIXI.Text(
        'MOUSE = AIM\nCLICK = SHOOT\nDESTROY 7 ASTEROIDS',
        new PIXI.TextStyle({
            fill: '#a0a4b8',
            fontSize: 14,
            fontWeight: 'bold',
            fontFamily: 'Courier New',
            letterSpacing: 2,
            align: 'center',
            lineHeight: 22,
        })
    );
    sub.anchor.set(0.5);
    sub.y = -10;
    panel.addChild(sub);

    const btn = new PIXI.Container();
    btn.y = panelH / 2 - 55;
    btn.eventMode = 'static';
    btn.cursor = 'pointer';

    const w = 180, h = 50;
    const btnBg = new PIXI.Graphics();
    const drawBtn = (alpha) => {
        btnBg.clear();
        btnBg.lineStyle(2, 0x00ffff, 1);
        btnBg.beginFill(0x00ffff, alpha);
        btnBg.drawRoundedRect(-w / 2, -h / 2, w, h, 12);
        btnBg.endFill();
    };
    drawBtn(0.2);
    btn.addChild(btnBg);

    const btnText = new PIXI.Text('START', new PIXI.TextStyle({
        fill: '#ffffff',
        fontSize: 22,
        fontWeight: '900',
        fontFamily: 'Courier New',
        letterSpacing: 4,
    }));
    btnText.anchor.set(0.5);
    btn.addChild(btnText);

    btn.on('pointerover', () => { drawBtn(0.45); btn.scale.set(1.06); });
    btn.on('pointerout',  () => { drawBtn(0.2);  btn.scale.set(1); });
    btn.on('pointerdown', () => {
        btn.scale.set(0.96);
        setTimeout(() => startGame(), 60);
    });

    panel.addChild(btn);
    app.stage.addChild(startOverlay);
}

function hideStartOverlay() {
    if (!startOverlay) return;
    app.stage.removeChild(startOverlay);
    startOverlay.destroy({ children: true });
    startOverlay = null;
}

function startGame() {
    if (isStarted) return;
    hideStartOverlay();
    isStarted = true;
    if (!isMusicPlaying) {
        bgMusic.play().catch(() => {});
        isMusicPlaying = true;
    } else {
        bgMusic.currentTime = 0;
        bgMusic.play().catch(() => {});
    }
}

start();
