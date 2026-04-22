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
let endMessage;
let restartButton;

// --- აუდიო ფაილები ---
let victorySfx; // აქ შევინახავთ მოგების ხმას
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

    resetGameSession(); // თამაშის საწყისი მდგომარეობის დაყენება
    setupInteractions();
    animate();
}

function init() {
    app = new PIXI.Application({
        width: 1000,
        height: 600,
        backgroundColor: 0x000000,
        antialias: true,
    });
    document.body.appendChild(app.view);
    app.stage.sortableChildren = true; // საშუალებას გვაძლევს გამოვიყენოთ zIndex
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
    healthBar.zIndex = 10; // ასტეროიდზე მაღლა
    healthBar.visible = false;
}

function addScoreText() {
    const style = new PIXI.TextStyle({ fill: "#ffffff", fontSize: 24, fontWeight: "bold" });
    scoreText = new PIXI.Text("", style);
    scoreText.x = 20;
    scoreText.y = 20;
    scoreText.zIndex = 100; // ყველაზე მაღლა
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
        if (racket && !isGameOver) {
            racket.x = event.global.x;
        }
    });

    window.addEventListener('mousedown', () => {
        if (!isGameOver) {
            fireBullet();
            if (!isMusicPlaying) {
                bgMusic.play().catch(e => console.log("Music play blocked"));
                isMusicPlaying = true;
            }
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

// --- თამაშის ლოგიკა ---
function resetGameSession() {
    isGameOver = false;
    destroyedCount = 0;
    asteroidHits = 0;

    // თუ მოგების ხმა არსებობს, გავაჩეროთ და წავშალოთ
    if (victorySfx) {
        victorySfx.pause();
        victorySfx.currentTime = 0;
        victorySfx = null; // ვასუფთავებთ ცვლადს
    }
    if(looseSfx) {
        looseSfx.pause();
        looseSfx.currentTime = 0;
        looseSfx = null;
    }

    if (endMessage) app.stage.removeChild(endMessage);
    if (restartButton) app.stage.removeChild(restartButton);

    racket.visible = true;
    racket.x = app.screen.width / 2;
    scoreText.text = `Asteroids: 0 / ${TOTAL_ASTEROIDS_TO_WIN}`;

    addAsteroid();
    resetHealthBar();
    healthBar.visible = true;

    if (isMusicPlaying) {
        bgMusic.currentTime = 0;
        bgMusic.play();
    }
}

function animate() {
    app.ticker.add(() => {
        if (isGameOver) return;

        if (asteroid && asteroid.visible) {
            asteroid.rotation += 0.02;
            asteroid.y += 1.5;

            healthBar.x = asteroid.x;
            healthBar.y = asteroid.y - 40;

            // შეჯახება რაკეტასთან (GAME OVER)
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

    // მოგების მუსიკა
    if (text === "MISSION ACCOMPLISHED!") {
        victorySfx = new Audio('./assets/killvictory1.mp3');
        victorySfx.volume = 0.8;
        victorySfx.play().catch(e => console.log("Victory sound blocked"));
    }
    if (text === "GAME OVER!") {
        looseSfx = new Audio('./assets/loose.mp3');
        looseSfx.volume = 0.8;
        looseSfx.play().catch(e => console.log("Loose sound blocked"));
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

start();