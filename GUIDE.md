# PixiJS — საფუძვლების გზამკვლევი (`app.js`-ის ანალიზი)

გამარჯობა! მე შენი მენტორი ვარ და ამ ფაილში გასწავლი **PixiJS**-ის საფუძვლებს იმ კოდის მაგალითზე, რომელიც შენ უკვე დაწერე — პატარა თამაში სადაც რაკეტა ისვრის ლაზერებს და ანადგურებს ასტეროიდებს.

ვცდილობ აგიხსნა არა მხოლოდ "რას აკეთებს" კოდი, არამედ **რატომ** მუშაობს ეს ასე. როცა საფუძველს გაიგებ, ნებისმიერ ახალ პიქსის ფიჩას მარტივად აითვისებ.

---

## 1. რა არის საერთოდ PixiJS?

PixiJS არის ბიბლიოთეკა, რომელიც ეხმარება ბრაუზერში სწრაფად დახატო **2D გრაფიკა** — სურათები, ფიგურები, ტექსტი, ანიმაციები. იგი იყენებს **WebGL**-ს (ხოლო თუ მხარდაჭერა არ არის — Canvas-ს), რაც ძალიან სწრაფად მუშაობს, რადგან გამოთვლები ვიდეოკარტაზე ხდება.

წარმოიდგინე ის, როგორც **ციფრული თეატრი**:
- გაქვს **სცენა** (`stage`) — ის ადგილი, სადაც ყველაფერი ხდება.
- სცენაზე გამოდიან **მსახიობები** (`Sprite`, `Graphics`, `Text`).
- **რეჟისორი** (`ticker`) ყოველ წამში ~60-ჯერ ეუბნება მსახიობებს რა გააკეთონ.
- ყოველი ეს "გამეორება" არის **frame** (კადრი) — ანიმაცია არის ბევრი კადრის სწრაფი მონაცვლეობა.

---

## 2. პროექტის სტრუქტურა

```
pixi-practice/
├── index.html          ← HTML გვერდი, რომელიც ჩატვირთავს app.js-ს
├── app.js              ← მთელი თამაშის ლოგიკა (PixiJS კოდი)
├── assets/             ← სურათები და ხმოვანი ფაილები
│   ├── racket.png
│   ├── asteroid.png
│   ├── star1.png
│   ├── purple.png
│   ├── laser-bullete.png
│   ├── damage-asteroid.png
│   ├── music.mp3
│   ├── laser_shooting_sfx.wav
│   ├── killvictory1.mp3
│   └── loose.mp3
└── GUIDE.md            ← ეს ფაილი
```

---

## 3. PixiJS-ის ჩატვირთვა

```js
import * as PIXI from 'https://cdn.jsdelivr.net/npm/pixi.js@7.4.3/dist/pixi.min.mjs';
```

აქ ჩვენ ვწერთ `import`-ს პირდაპირ CDN-დან — ეს ნიშნავს, რომ npm-ის გარეშე, ბრაუზერი თვითონ ჩამოტვირთავს ფაილს. ეს მარტივი მეთოდია სასწავლო პროექტებისთვის. სერიოზულ პროექტში ჩვეულებრივ გამოიყენებ `npm install pixi.js`-ს.

> 💡 **შენიშვნა:** ვერსიას `@7.4.3` დააქცევ ყურადღებას — PixiJS v8-ში ბევრი API შეიცვალა. ჩვენ ვიყენებთ v7-ს, ამიტომ მაგალითად `app.stage.addChildAt(...)` და `Graphics.beginFill()` ჯერ კიდევ მუშაობს.

---

## 4. გლობალური ცვლადები

```js
let app;            // PIXI.Application — მთავარი თამაშის ობიექტი
let asteroid;       // ასტეროიდის Sprite
let racket;         // რაკეტის Sprite
let bullets = [];   // აქტიური ლაზერების მასივი
let asteroidHits = 0;          // რამდენჯერ მოხვდა ლაზერი ერთ ასტეროიდს
const HITS_TO_DESTROY = 3;     // 3 დარტყმა ანადგურებს ასტეროიდს

let destroyedCount = 0;                // ჯამში რამდენი ასტეროიდია გაანადგურებული
const TOTAL_ASTEROIDS_TO_WIN = 7;      // მოგების პირობა
let healthBar;                          // ასტეროიდის HP ზოლი (Container)
let scoreText;                          // ქულების ტექსტი
let isGameOver = false;
let endMessage;                         // "MISSION ACCOMPLISHED" / "GAME OVER"
let restartButton;
```

ეს არის თამაშის **მდგომარეობა (state)**. რადგან ცვლადები გლობალურია, ნებისმიერ ფუნქციას შეუძლია მათი წაკითხვა და ცვლილება. (პატარა პროექტებში ეს კარგია, დიდ პროექტში გამოიყენე კლასი ან მოდული.)

---

## 5. აპლიკაციის ინიციალიზაცია — `init()`

```js
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
```

### რა ხდება აქ:

**`new PIXI.Application(...)`** — ქმნის ახალ პიქსის აპლიკაციას. ეს ერთი ობიექტი შემოიტანს თან:
- `app.view` — ეს არის **`<canvas>` HTML ელემენტი**, რომელზეც პიქსი ხატავს ყველაფერს.
- `app.stage` — **მთავარი კონტეინერი** (სცენა), სადაც ყველა ობიექტს ვამატებთ.
- `app.ticker` — **გულისცემა** (60 FPS ციკლი), რომელიც ყოველ კადრში გაუშვებს ჩვენს ფუნქციებს.
- `app.screen` — სცენის ზომების ობიექტი (`width`, `height`).

**`document.body.appendChild(app.view)`** — `<canvas>`-ი HTML გვერდზე ჩანდეს, ამიტომ ვამატებთ DOM-ში.

**`sortableChildren = true`** — ანიჭებს უფლებას სცენას სორტირება ბავშვებისა `zIndex`-ის მიხედვით (ვისი ვინ ფარავს). თუ ეს `false`-ია, ობიექტი ხატვის რიგი დამატების მიხედვით განისაზღვრება.

> 🎯 **საფუძვლობრივი აზრი:** PixiJS აპი = canvas + stage + ticker. ყველა დანარჩენი ამის თავზე აიგება.

---

## 6. ხის სტრუქტურა (Scene Graph)

ეს არის **ყველაზე მნიშვნელოვანი კონცეფცია PixiJS-ში**.

```
app.stage  (Container)
├── bg                  (TilingSprite — ფონი)
├── star × 150          (Sprite — ვარსკვლავები)
├── asteroid            (Sprite)
├── racket              (Sprite)
├── healthBar           (Container)
│   ├── bg              (Graphics — წითელი)
│   └── bar             (Graphics — მწვანე)
├── scoreText           (Text)
├── bullets[]           (Sprite × N)
├── endMessage          (Text)
└── restartButton       (Container)
    ├── btnBg           (Graphics)
    └── btnText         (Text)
```

ყოველი `Container` შეიძლება შეიცავდეს სხვა ობიექტებს. როცა მშობელ კონტეინერს გადააადგილებ, ბავშვებიც მასთან ერთად მიჰყვებიან. ეს არის "სცენის გრაფი" (scene graph) — ხის მსგავსი იერარქია.

---

## 7. ფონი — `addBackground()`

```js
function addBackground() {
    const texture = PIXI.Texture.from('./assets/purple.png');
    const bg = new PIXI.TilingSprite(texture, app.screen.width, app.screen.height);
    app.stage.addChildAt(bg, 0);
}
```

- **`PIXI.Texture.from(...)`** — სურათიდან ქმნის ტექსტურას (GPU-სთვის გასაგები ფორმატით). ერთი ტექსტურა შეიძლება გამოვიყენოთ ბევრ Sprite-ში.
- **`PIXI.TilingSprite`** — სპეციალური Sprite, რომელიც **იმეორებს** ერთ პატარა სურათს და ფარავს დიდ ფართობს. ეს იდეალურია ფონისთვის (გათისს ხელით ნაცვლად).
- **`addChildAt(bg, 0)`** — ფონი ემატება **პოზიცია 0-ზე** ანუ ყველაზე ქვემოთ, რათა ყველაფერი ფონის თავზე ჩანდეს.

---

## 8. ვარსკვლავები — `addRandomStars(count)`

```js
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
```

### რა ვისწავლეთ აქ — Sprite-ის ანატომია:

| თვისება | რას აკეთებს |
|---------|-------------|
| `PIXI.Sprite.from(path)` | ქმნის Sprite-ს ფაილიდან (მალსახმობი, რომელიც თვითონ შექმნის ტექსტურას). |
| `.anchor.set(0.5)` | Sprite-ის "ცენტრის წერტილი". `0` = მარცხენა-ზედა კუთხე, `0.5` = ცენტრი, `1` = მარჯვენა-ქვედა. **ანქორი ცენტრში ჩავაყენოთ რომ Sprite-ის ბრუნვა და პოზიცია ცენტრზე ხდებოდეს.** |
| `.scale.set(0.3)` | ზომის შეცვლა (1 = ორიგინალი, 0.5 = ნახევარი). |
| `.x`, `.y` | პოზიცია სცენაზე (პიქსელებში, დასაწყისი — მარცხენა-ზედა კუთხე). |
| `.alpha` | გამჭვირვალობა (0 = უხილავი, 1 = სრული). |
| `.rotation` | ბრუნვა რადიანებში (`Math.PI` = 180°). |
| `.visible` | ჩანს თუ არა ეკრანზე. |

> 🎯 **საფუძვლობრივი აზრი:** Sprite არის "გრძნობადი სურათი" — შეგიძლია გადააადგილო, ააბრუნო, ააწიო/დააკლო ზომა, შეცვალო გამჭვირვალობა.

---

## 9. რაკეტა — `addRacket()`

```js
function addRacket() {
    racket = PIXI.Sprite.from('./assets/racket.png');
    racket.anchor.set(0.5);
    racket.scale.set(0.7);
    racket.y = app.screen.height - 70;
    app.stage.addChild(racket);
}
```

რაკეტა იქმნება **ერთხელ** და უკვე გამოიყენება მთელი თამაშის განმავლობაში. მისი `x` მოგვიანებით თაგვის მიხედვით განისაზღვრება, ხოლო `y` ფიქსირდება ეკრანის ბოლოში.

---

## 10. ასტეროიდი — `addAsteroid()`

```js
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
```

### საინტერესო სვედი — **ობიექტის ხელახალი გამოყენება (recycling)**:

ნაცვლად იმისა, რომ ყოველ ჯერზე ახალი Sprite შევქმნათ და ძველი წავშალოთ (რაც მეხსიერებას ხარჯავს), ჩვენ:
1. **ერთხელ** ვქმნით ასტეროიდს (`if (!asteroid)`).
2. შემდგომ უბრალოდ ვცვლით მის `x`, `y` და `visible`-ს.

ეს არის **object pooling**-ის მარტივი ფორმა. დიდი თამაშებისთვის ეს ძალიან მნიშვნელოვანი ოპტიმიზაციაა.

`y = -50` — ასტეროიდი ეკრანის **ზემოთ** იწყებს გამოჩენას (გარე ფართობი), რომ შემდგომ "ჩამოვარდეს".

---

## 11. ჯანმრთელობის ზოლი — `addHealthBar()`

```js
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
```

### ახალი ცნებები:

#### `PIXI.Container`
**კონტეინერი = ჩანთა, რომელიც ბევრ ობიექტს ერთ მიმდინარეობს.** მისი გადატანისას, ყველა ბავშვი მასთან ერთად გადადის. აქ ჩვენ შევქმენით კონტეინერი, რომელიც შეიცავს ორ Graphics-ს — წითელ ფონს და მწვანე ბარს.

#### `PIXI.Graphics`
სპრაიტებისგან განსხვავებით, რომლებიც სურათებიდან არის, **Graphics არის ვექტორული ფიგურები**, რომლებსაც კოდით ხატავ:

```js
g.beginFill(0xff0000);         // დაიწყე ფერით (HEX 16-სისტემაში)
g.drawRect(x, y, width, height); // დახაზე მართკუთხედი
g.endFill();                    // დაასრულე
```

შეგიძლია დახაზო წრე (`drawCircle`), ხაზი (`lineTo`), რკალი (`arc`), მრავალკუთხედი (`drawPolygon`) და სხვ.

#### `bar.name = "health"`
სახელი გვეხმარება მოგვიანებით ვიპოვოთ ეს ბავშვი კონტეინერში: `healthBar.getChildByName("health")`. ეს ალტერნატივაა ცვლადში შენახვისა.

#### `zIndex = 10`
რადგან `app.stage.sortableChildren = true` არის, ეს მნიშვნელობა განსაზღვრავს რიგს. რაც უფრო მაღალია `zIndex`, მით უფრო თავზე ჩანს.

---

## 12. ქულების ტექსტი — `addScoreText()`

```js
function addScoreText() {
    const style = new PIXI.TextStyle({ fill: "#ffffff", fontSize: 24, fontWeight: "bold" });
    scoreText = new PIXI.Text("", style);
    scoreText.x = 20;
    scoreText.y = 20;
    scoreText.zIndex = 100;
    app.stage.addChild(scoreText);
}
```

- **`PIXI.TextStyle`** — განსაზღვრავს როგორ გამოიყურება ტექსტი (ფერი, ზომა, შრიფტი, ჩრდილი და ა.შ.).
- **`PIXI.Text`** — ქმნის ტექსტის ობიექტს, რომელიც სცენაზე იხატება (PixiJS-ში ტექსტი ფაქტობრივად სურათად გარდაიქმნება GPU-ზე).
- **მნიშვნელოვანი:** `text` თვისების ცვლილება (`scoreText.text = "..."`) ქმნის ახალ ტექსტურას, რაც ცოტა ძვირია. ხშირი ცვლილებებისთვის შეგიძლია გამოიყენო `BitmapText`.

---

## 13. ინტერაქცია — `setupInteractions()`

```js
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
```

### PixiJS Events — ყურადღება:

#### `eventMode = 'static'`
PixiJS v7-ში ობიექტმა რომ "გაიგოს" თაგვი/თითი, მას უნდა ჰქონდეს `eventMode`. ვარიანტები:
- `'none'` — არანაირი ღონისძიება (ნაგულისხმევი მსახიობებისთვის).
- `'passive'` — მხოლოდ ბავშვები არეაგირებენ.
- `'static'` — ობიექტი თვითონ რეაგირებს, მაგრამ არ მოძრაობს ხშირად.
- `'dynamic'` — როცა ობიექტი მუდმივად მოძრაობს.

> ⚠️ ძველ კოდებში ნახავ `interactive = true`-ს — ეს v6 სინტაქსია, v7-ში ჩაანაცვლა `eventMode`-მ.

#### `hitArea = app.screen`
განსაზღვრავს, **სად** რეაგირებს stage-ი. ჩვენ ვამბობთ "მთელი ეკრანი".

#### `pointermove` ღონისძიება
`event.global.x` — თაგვის **გლობალური** კოორდინატი (მთელი ეკრანის ფარგლებში). არსებობს ასევე `event.data.getLocalPosition(...)` — ლოკალური კოორდინატი კონკრეტულ კონტეინერში.

#### `mousedown` window-ზე
სროლისთვის გამოვიყენეთ ჩვეულებრივი DOM event (`window.addEventListener`), რადგან ისეთი მოქმედებაა, რომელიც სცენის ნებისმიერ ნაწილში უნდა იმუშაოს. ეს ერთად მუშაობს PixiJS-ის ღონისძიებებთან.

---

## 14. ლაზერის სროლა — `fireBullet()`

```js
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
```

ყოველ კლიკზე:
1. იქმნება **ახალი** Audio ობიექტი (რათა რამდენიმე გასროლა პარალელურად შესაძლებელი იყოს).
2. იქმნება ახალი ლაზერის Sprite რაკეტის ცოტა ზემოთ.
3. ემატება სცენაზე **და** მასივში `bullets`-ში.

მასივი გვჭირდება, რადგან ანიმაციის ციკლში თითოეული ლაზერი უნდა გადავაადგილოთ.

---

## 15. დაზიანების ეფექტი — `showDamageEffect(x, y)`

```js
function showDamageEffect(x, y) {
    const damage = PIXI.Sprite.from('./assets/damage-asteroid.png');
    damage.anchor.set(0.5);
    damage.scale.set(0.7);
    damage.x = x;
    damage.y = y;
    app.stage.addChild(damage);
    setTimeout(() => app.stage.removeChild(damage), 100);
}
```

დროებითი ვიზუალური ეფექტი — დარტყმის ადგილზე ჩნდება სურათი და 100 მს-ის შემდეგ ქრება. **`setTimeout`** ცოტა "ბრძოლსკი" გამოსავალია — უკეთესი ვარიანტი იქნება ანიმაცია `app.ticker`-ში.

---

## 16. ანიმაციის ციკლი — `animate()`

ეს არის **თამაშის გული**.

```js
function animate() {
    app.ticker.add(() => {
        if (isGameOver) return;
        // ... მთელი ლოგიკა ...
    });
}
```

### რა არის Ticker?

`app.ticker` არის **მუდმივი ციკლი**, რომელიც ეშვება დაახლოებით 60-ჯერ წამში (ანუ ~16.6 მს-ში ერთხელ). ჩვენ ვამბობთ "ყოველ კადრში გაუშვი ეს ფუნქცია".

ეს არის ანიმაციის სტანდარტული პატერნი:
1. შეცვალე ობიექტების მდგომარეობა (პოზიცია, ბრუნვა, გამჭვირვალობა).
2. შემოამოწმე შეჯახებები.
3. წაშალე უსარგებლო ობიექტები.
4. პიქსი თვითონ დახატავს ყველაფერს.

### ნაბიჯ-ნაბიჯ ლოგიკა:

```js
if (asteroid && asteroid.visible) {
    asteroid.rotation += 0.02;     // ნელი ბრუნვა
    asteroid.y += 1.5;              // ჩამოვარდნა

    healthBar.x = asteroid.x;       // HP ზოლი ასტეროიდს მისდევს
    healthBar.y = asteroid.y - 40;
```

`rotation`-ის ცვლილება ყოველ კადრში ქმნის "ბრუნვის ანიმაციას". `+= 1.5` `y`-ს ნიშნავს "ჩამოდი 1.5 პიქსელი/კადრი" = ~90 პიქსელი/წამი.

```js
    if (checkCollision(racket, asteroid, 60)) {
        endGame("GAME OVER!");
    }
```

თუ ასტეროიდი დაეჯახა რაკეტას — თამაში დასრულდა.

```js
    if (asteroid.y > app.screen.height + 50) {
        resetAsteroid();
        resetHealthBar();
    }
}
```

თუ ასტეროიდი ეკრანის ქვემოთ გავიდა — დავაბრუნოთ ზემოდან (ხელახალი გამოყენება).

#### ლაზერების მართვა — **შებრუნებული ციკლი**:

```js
for (let i = bullets.length - 1; i >= 0; i--) {
    let b = bullets[i];
    b.y -= 10;
    // ...
}
```

> 🎯 **მნიშვნელოვანი ხრიკი:** როცა ციკლის შიგნით **შლი ელემენტებს მასივიდან**, უნდა იარო **ბოლოდან-დასაწყისისაკენ**. წინააღმდეგ შემთხვევაში, `splice`-ის შემდეგ ინდექსები ერევა და გამოტოვებ ზოგ ელემენტს.

```js
if (asteroid && asteroid.visible && checkCollision(b, asteroid, 50)) {
    showDamageEffect(asteroid.x, asteroid.y);
    app.stage.removeChild(b);    // სცენიდან წაშლა
    bullets.splice(i, 1);         // მასივიდან წაშლა
    asteroidHits++;

    const bar = healthBar.getChildByName("health");
    bar.scale.x = (HITS_TO_DESTROY - asteroidHits) / HITS_TO_DESTROY;
    // ...
}
```

`bar.scale.x` ცვლილება "ანცმავს" HP ზოლს — `1` = სრული, `0.66` = 2/3, `0.33` = 1/3, `0` = ცარიელი.

---

## 17. შეჯახების შემოწმება — `checkCollision()`

```js
function checkCollision(obj1, obj2, limit) {
    const dx = obj1.x - obj2.x;
    const dy = obj1.y - obj2.y;
    return Math.sqrt(dx * dx + dy * dy) < limit;
}
```

ეს არის **წრიული შეჯახების** ალგორითმი — ვითვლით ორ ობიექტს შორის მანძილს პითაგორას თეორემით:

```
მანძილი = √((x₁-x₂)² + (y₁-y₂)²)
```

თუ ეს მანძილი ნაკლებია გარკვეული ზღურბლზე (`limit`), მაშინ ისინი "შეეხნენ".

> 💡 **ალტერნატივები:**
> - **AABB (Axis-Aligned Bounding Box):** მართკუთხედების შემოწმება — უფრო სწრაფი მაგრამ ნაკლებად ზუსტი.
> - **PixiJS-ის `getBounds()`:** ყოველი Sprite-ის რეალური საზღვრების მიღება.
> - **ბიბლიოთეკები:** დიდი თამაშებისთვის — Matter.js, p2.js (ფიზიკის ძრავები).

---

## 18. თამაშის დასრულება — `endGame(text)`

```js
function endGame(text) {
    isGameOver = true;
    bgMusic.pause();
    // ... ხმის დაკვრა ...

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
```

`isGameOver = true` — ფლაგი, რომელიც ანიმაციის ციკლში ხელს უშლის ყველაფერ მოძრაობას.

ყურადღება: `bullets` ცარიელი მასივით ვცვლით (`bullets = []`) — ეს უფრო სწრაფია, ვიდრე `bullets.length = 0`-იც.

---

## 19. გამეორების ღილაკი — `addRestartButton()`

```js
function addRestartButton() {
    restartButton = new PIXI.Container();

    const btnBg = new PIXI.Graphics();
    btnBg.beginFill(0x22aa22);
    btnBg.drawRoundedRect(-75, -25, 150, 50, 10);  // x, y, w, h, radius
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
```

### კარგი მაგალითი — როგორ ავაგოთ ღილაკი PixiJS-ში:

1. **Container** ერთი ერთეულის სახით შევფუთოთ ფონი + ტექსტი.
2. **Graphics** დახაზოს მართკუთხედი მომრგვალებული კუთხეებით.
3. **Text** წარწერისთვის.
4. **`eventMode = 'static'`** — ღილაკი რეაგირებდეს კლიკზე.
5. **`cursor = 'pointer'`** — თაგვი ფარდის სახით გადაიქცეს გადატანისას.
6. **`on('pointerdown', ...)`** — ფუნქცია, რომელიც გაეშვება დაჭერისას.

> 💡 **ნაცადი ფაქტი:** `pointerdown` უფრო უნივერსალურია ვიდრე `mousedown` — იგი მუშაობს თაგვზე, თითზე და სხვა შეყვანის მოწყობილობაზე.

---

## 20. სესიის გადატვირთვა — `resetGameSession()`

ეს ფუნქცია აბრუნებს თამაშის ყველა მდგომარეობას საწყისზე:
- ფლაგები (`isGameOver`, ქულები, დარტყმები) ნულდება.
- ხმოვანი ეფექტები ჩერდება.
- `endMessage` და `restartButton` სცენიდან იშლება.
- რაკეტა ცენტრში ბრუნდება.
- ახალი ასტეროიდი ემატება.
- HP ზოლი მთლიანდება.
- ფონური მუსიკა თავიდან ეშვება.

ეს არის "სუფთა მონაცემთა გადატვირთვა" — ერთი ფუნქცია ერთჯერად აღადგენს თამაშს.

---

## 21. PixiJS-ის "გონებრივი მოდელი" — შემაჯამებელი

თუ ერთხელ გაიგებ ამ პრინციპებს, ნებისმიერ PixiJS პროექტს მიხვდები:

### 🎬 1. სცენის გრაფი (Scene Graph)
ყველაფერი ეკრანზე არის ხის სტრუქტურის ბავშვი `app.stage`-ის ქვეშ. მშობელი მართავს ბავშვებს.

### 🎨 2. ხატვის ობიექტები (Display Objects)
- **Sprite** — სურათი
- **Graphics** — ვექტორული ფიგურები
- **Text / BitmapText** — ტექსტი
- **TilingSprite** — განმეორებითი ფონი
- **Container** — ერთი ერთეულის ჯგუფი

### ⏱ 3. Ticker (კადრების ციკლი)
ყოველი ანიმაცია = ცვლილება ობიექტის თვისებაში ყოველ კადრში.

### 🖱 4. Events (ღონისძიებები)
`eventMode = 'static'` + `on('pointerdown', ...)` = ინტერაქციული ობიექტი.

### 📦 5. ტექსტურები და ასეტები
სურათი → ტექსტურა → Sprite. ერთი ტექსტურა = ბევრი Sprite (მეხსიერება ეკონომდება).

### 🔄 6. ცხოვრების ციკლი
- **შექმნა** (`new PIXI.Sprite`)
- **დამატება** (`addChild`)
- **მართვა** (პოზიცია, ბრუნვა და ა.შ. ticker-ში)
- **წაშლა** (`removeChild`) — სცენიდან მოშორება, რომ მეხსიერება გათავისუფლდეს

---

## 22. რა შეგიძლია ისწავლო შემდეგ?

ეს თამაში არის შენი **საბაზო ლაბორატორია**. შემდეგი ნაბიჯები:

1. **AssetLoader** (`PIXI.Assets`) — ასეტების წინასწარი ჩატვირთვა, რომ თამაში დაუყოვნებლად დაიწყოს.
2. **Sprite Sheets** — ერთ სურათში ბევრი ფრეიმი (კადრიდან კადრში ანიმაცია).
3. **AnimatedSprite** — მაგ., აფეთქების ანიმაცია 8 კადრით.
4. **Filters** — ბუნდოვანი (Blur), ცრემლი, ფერების შეცვლა და ა.შ.
5. **Particles** — ნაწილაკების სისტემა (ცეცხლი, კვამლი).
6. **Tweening (gsap, tween.js)** — გლუვი ანიმაციები შესვლა-გასვლისთვის.
7. **სხვადასხვა "სცენების" მართვა** (მენიუ, თამაში, ფინალი) — ე.წ. State Machine.

---

## 23. სასარგებლო რესურსები

- 📚 **ოფიციალური დოკუმენტაცია:** https://pixijs.download/release/docs/index.html
- 🎓 **მაგალითები:** https://pixijs.com/examples
- 💬 **დისკორდი:** https://discord.gg/QrnxmQUPGV

---

## დასკვნა

შენი თამაში არის შესანიშნავი **მინი-პროექტი ყველა ძირითადი PixiJS კონცეფციით**:
- ✅ აპლიკაციის შექმნა
- ✅ Sprite-ები და ტექსტურები
- ✅ Container-ები და სცენის გრაფი
- ✅ Graphics-ით ხატვა
- ✅ ტექსტის ჩვენება
- ✅ Ticker-ით ანიმაცია
- ✅ ინტერაქცია (pointer events)
- ✅ შეჯახების ლოგიკა
- ✅ ხმოვანი ეფექტები
- ✅ თამაშის მდგომარეობის მართვა

გილოცავ! 🎮 თუ ამ კოდს ხაზ-ხაზ ხვდები, **PixiJS-ის საფუძველს უკვე ფლობ**.
