const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

canvas.width = 640;
canvas.height = 480;

// =========================
// ESTADO GLOBAL
// =========================
let keys = {};
let touchActive = false;
let touchX = 0;
let touchY = 0;
let lastTouchX = 0;
let lastTouchY = 0;



let player, bullets, enemies, particles, explosions, score, hp, running;
let stars = [];
let farStars = [];
let nebulas = [];
let lastTime = 0;
let shootTimer = 0;
let screenShake = 0;
let flashTimer = 0;
let highScore = Number(localStorage.getItem("neonImpactHighScore") || 0);

let enemyBullets = [];
let currentWaveEnemyIds = [];
let waveClearPending = false;
let bossDefeated = false;

// =========================
// SISTEMA DE FASES / ONDAS
// =========================
let stage = 1;
let wave = 0;
let waveTimer = 0;
let inWave = false;
let enemiesToSpawn = 0;
let enemiesSpawned = 0;
let bossActive = false;
let waveTransitionTimer = 0;
let waveIntroText = "";
let gameWon = false;

const stages = [
    {
        name: "Setor Orbital",
        waves: [
            { type: "basic", count: 18, delay: 0.7, label: "Onda 1 - Patrulha" },
            { type: "zigzag", count: 22, delay: 0.6, label: "Onda 2 - Interceptadores" },
            { type: "fast", count: 26, delay: 0.45, label: "Onda 3 - Ataque Rápido" },
            { type: "mixed", count: 30, delay: 0.4, label: "Onda 4 - Caos Total" },
            { type: "boss1", label: "BOSS - Couraçado Orbital" }
        ]
    },
    {
        name: "Zona Vermelha",
        waves: [
            { type: "charger", count: 20, delay: 0.65, label: "Onda 1 - Investida" },
            { type: "sniper", count: 16, delay: 0.9, label: "Onda 2 - Snipers" },
            { type: "elite", count: 18, delay: 0.75, label: "Onda 3 - Elite de Combate" },
            { type: "chaos2", count: 28, delay: 0.4, label: "Onda 4 - Cerco Total" },
            { type: "boss2", label: "BOSS - Núcleo Devastador" }
        ]
    }
];

// =========================
// INPUT
// =========================

window.addEventListener("keydown", e => keys[e.key.toLowerCase()] = true);
window.addEventListener("keyup", e => keys[e.key.toLowerCase()] = false);

canvas.addEventListener("touchstart", (e) => {
    e.preventDefault();

    const rect = canvas.getBoundingClientRect();
    touchActive = true;

    touchX = e.touches[0].clientX - rect.left;
    touchY = e.touches[0].clientY - rect.top;

    lastTouchX = touchX;
    lastTouchY = touchY;
}, { passive: false });

canvas.addEventListener("touchmove", (e) => {
    e.preventDefault();

    const rect = canvas.getBoundingClientRect();
    touchX = e.touches[0].clientX - rect.left;
    touchY = e.touches[0].clientY - rect.top;
}, { passive: false });

canvas.addEventListener("touchend", (e) => {
    e.preventDefault();
    touchActive = false;
}, { passive: false });


// =========================
// INÍCIO
// =========================
function startGame() {
    player = {
        x: 60,
        y: canvas.height / 2 - 12,
        w: 34,
        h: 24,
        speed: 4.2,
        hitFlash: 0,
        invincible: 0
    };

    enemyBullets = [];
    bullets = [];
    enemies = [];
    particles = [];
    explosions = [];
    score = 0;
    hp = 100;
    running = true;
    shootTimer = 0;
    screenShake = 0;
    flashTimer = 0;
    gameWon = false;

    stage = 1;
    wave = -1;
    bossActive = false;
    inWave = false;
    enemiesToSpawn = 0;
    enemiesSpawned = 0;
    waveTimer = 0;
    waveTransitionTimer = 0;
    waveIntroText = "";

    currentWaveEnemyIds = [];
    waveClearPending = false;
    bossDefeated = false;

    document.getElementById("menu").classList.add("hidden");
    document.getElementById("gameOver").classList.add("hidden");

    createBackground();
    updateHUD();
    startNextWave();
    lastTime = 0;
    requestAnimationFrame(loop);
}

// =========================
// BACKGROUND
// =========================
function createBackground() {
    stars = [];
    farStars = [];
    nebulas = [];

    const isStage2 = stage >= 2;

    for (let i = 0; i < 100; i++) {
        farStars.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            size: Math.random() * 1.3 + 0.2,
            speed: Math.random() * 0.3 + 0.15,
            alpha: Math.random() * 0.35 + 0.1
        });
    }

    for (let i = 0; i < 55; i++) {
        stars.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            size: Math.random() * 2.2 + 0.7,
            speed: Math.random() * 1.3 + 0.7,
            alpha: Math.random() * 0.6 + 0.25
        });
    }

    for (let i = 0; i < 6; i++) {
        nebulas.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            radius: Math.random() * 140 + 90,
            color: isStage2
                ? (i % 2 === 0 ? "255,70,120" : "180,60,255")
                : (i % 2 === 0 ? "0,255,255" : "120,90,255"),
            alpha: Math.random() * 0.08 + 0.03,
            speed: Math.random() * 0.12 + 0.03
        });
    }
}

// =========================
// SISTEMA DE FASES / ONDAS
// =========================
function startNextWave() {
    const currentStage = stages[stage - 1];

    if (!currentStage) {
        winGame();
        return;
    }

    wave++;

    if (wave >= currentStage.waves.length) {
        stage++;
        wave = -1;
        createBackground();
        startNextWave();
        return;
    }

    const waveData = currentStage.waves[wave];

    enemiesSpawned = 0;
    enemiesToSpawn = waveData.count || 1;
    waveTimer = 0;
    inWave = true;
    bossActive = false;
    bossDefeated = false;
    waveClearPending = false;
    currentWaveEnemyIds = [];

    waveIntroText = waveData.label || `Onda ${wave + 1}`;
    waveTransitionTimer = 2.2;

    if (waveData.type === "boss1" || waveData.type === "boss2") {
        spawnBoss(waveData.type);
        bossActive = true;
    }

    updateHUD();
}

function checkWaveEnd() {
    if (!inWave || waveClearPending) return;

    const currentStage = stages[stage - 1];
    const waveData = currentStage.waves[wave];

    if (waveData.type === "boss1" || waveData.type === "boss2") {
        const bossExists = enemies.some(e => e.isBoss);

        if (!bossExists && bossDefeated) {
            waveClearPending = true;
            inWave = false;
            bossActive = false;

            setTimeout(() => {
                if (running) startNextWave();
            }, 1500);
        }

        return;
    }

    const aliveWaveEnemies = enemies.filter(e => currentWaveEnemyIds.includes(e.id));

    if (enemiesSpawned >= enemiesToSpawn && aliveWaveEnemies.length === 0) {
        waveClearPending = true;
        inWave = false;

        setTimeout(() => {
            if (running) startNextWave();
        }, 1200);
    }
}

function winGame() {
    running = false;
    gameWon = true;

    if (score > highScore) {
        highScore = score;
        localStorage.setItem("neonImpactHighScore", highScore);
    }

    const gameOver = document.getElementById("gameOver");
    gameOver.classList.remove("hidden");
    gameOver.querySelector("h2").innerText = "MISSÃO COMPLETA";
    gameOver.querySelector("p").innerText = "Você derrotou todos os chefes.";
    gameOver.querySelector("button").innerText = "JOGAR NOVAMENTE";
}

// =========================
// UPDATE
// =========================
function update(delta) {
    updateEnemyBullets();
    updatePlayer(delta);
    updateBullets(delta);
    updateEnemies(delta);
    updateParticles(delta);
    updateExplosions(delta);
    updateBackground();

    if (player.hitFlash > 0) player.hitFlash -= delta;
    if (player.invincible > 0) player.invincible -= delta;
    if (screenShake > 0) screenShake -= delta;
    if (flashTimer > 0) flashTimer -= delta;
    if (waveTransitionTimer > 0) waveTransitionTimer -= delta;

    if (hp <= 0) {
        hp = 0;
        running = false;

        if (score > highScore) {
            highScore = score;
            localStorage.setItem("neonImpactHighScore", highScore);
        }

        updateHUD();
        document.getElementById("gameOver").classList.remove("hidden");
    }
}

function updatePlayer(delta) {
    if (keys["w"] || keys["arrowup"]) player.y -= player.speed;
    if (keys["s"] || keys["arrowdown"]) player.y += player.speed;
    if (keys["a"] || keys["arrowleft"]) player.x -= player.speed;
    if (keys["d"] || keys["arrowright"]) player.x += player.speed;

    if (touchActive) {
    const sensitivity = 1.0;

    const deltaX = touchX - lastTouchX;
    const deltaY = touchY - lastTouchY;

    player.x += deltaX * sensitivity;
    player.y += deltaY * sensitivity;

    lastTouchX = touchX;
    lastTouchY = touchY;
}


    player.x = Math.max(12, Math.min(canvas.width - player.w - 12, player.x));
    player.y = Math.max(12, Math.min(canvas.height - player.h - 12, player.y));

    shootTimer += delta;
    if (shootTimer >= 0.18) {
        shootTimer = 0;
        fireBullet();
    }

    createEngineTrail();
}

function updateBullets(delta) {
    for (let i = bullets.length - 1; i >= 0; i--) {
        bullets[i].x += bullets[i].speed;
        if (bullets[i].x > canvas.width + 40) bullets.splice(i, 1);
    }
}

function updateEnemyBullets() {
    for (let i = enemyBullets.length - 1; i >= 0; i--) {
        const b = enemyBullets[i];

        b.x += b.vx;
        b.y += b.vy;

        if (b.x < -20 || b.y < -20 || b.y > canvas.height + 20) {
            enemyBullets.splice(i, 1);
            continue;
        }

        if (hit(player, { x: b.x - b.size, y: b.y - b.size, w: b.size * 2, h: b.size * 2 })) {
            enemyBullets.splice(i, 1);
            damagePlayer(10);
        }
    }
}

function updateEnemies(delta) {
    if (inWave) {
        const currentStage = stages[stage - 1];
        const waveData = currentStage.waves[wave];

        if (waveData.type !== "boss1" && waveData.type !== "boss2") {
            waveTimer += delta;
            if (waveTimer >= waveData.delay && enemiesSpawned < enemiesToSpawn) {
                waveTimer = 0;
                spawnWaveEnemy(waveData.type);
                enemiesSpawned++;
            }
        }
    }

    for (let i = enemies.length - 1; i >= 0; i--) {
        const e = enemies[i];

        if (e.isBoss) {
            updateBoss(e, delta);
        } else {
            e.x -= e.speed;

            if (e.behavior === "zigzag") {
                e.y += Math.sin(Date.now() * 0.01 + e.waveOffset) * 1.8;
            }

            if (e.behavior === "fast") {
                e.y += Math.sin(Date.now() * 0.02 + e.waveOffset) * 0.8;
            }

            if (e.behavior === "mixed") {
                e.y += Math.sin(Date.now() * 0.012 + e.waveOffset) * 1.4;
            }

            if (e.behavior === "sniper") {
                e.y += Math.sin(Date.now() * 0.006 + e.waveOffset) * 0.7;
            }

            if (e.behavior === "elite") {
                e.y += Math.sin(Date.now() * 0.009 + e.waveOffset) * 1.1;
            }
        }

        if (!e.isBoss && e.x + e.w < 0) {
            enemies.splice(i, 1);
            continue;
        }

        if (hit(player, e)) {
            if (e.isBoss) {
                damagePlayer(16);
            } else {
                createExplosion(e.x + e.w / 2, e.y + e.h / 2, "#ff5a7a");
                enemies.splice(i, 1);
                damagePlayer(12);
            }
            continue;
        }

        for (let j = bullets.length - 1; j >= 0; j--) {
            if (hit(bullets[j], e)) {
                bullets.splice(j, 1);

                if (e.isBoss) {
                    e.hp -= 4;
                    createHitBurst(e.x + e.w / 2, e.y + e.h / 2, "255,90,122");
                    createExplosion(e.x + e.w / 2, e.y + e.h / 2, "#ff5a7a");
                    flashTimer = 0.03;
                    screenShake = 0.08;

                    if (e.hp <= 0) {
                        createExplosion(e.x + e.w / 2, e.y + e.h / 2, "#ff5a7a");
                        createExplosion(e.x + e.w / 2, e.y + e.h / 2, "#ffffff");
                        score += 250;
                        bossDefeated = true;
                        enemies.splice(i, 1);
                        updateHUD();
                    }
                } else {
                    e.hp = (e.hp || 1) - 1;

                    createExplosion(e.x + e.w / 2, e.y + e.h / 2, "#ff5a7a");
                    createHitBurst(e.x + e.w / 2, e.y + e.h / 2, "255,90,122");
                    flashTimer = 0.04;
                    screenShake = 0.12;

                    if (e.hp <= 0) {
                        score += 10;
                        enemies.splice(i, 1);
                        updateHUD();
                    }
                }

                break;
            }
        }
    }

    checkWaveEnd();
}

function updateBoss(boss, delta) {
    const targetX = boss.bossType === "boss2" ? canvas.width - 190 : canvas.width - 170;

    if (boss.x > targetX) {
        boss.x -= boss.speed;
    }

    boss.moveTimer += delta;

    if (boss.bossType === "boss1") {
        boss.y += Math.sin(Date.now() * 0.004 + boss.waveOffset) * 1.5;
    }

    if (boss.bossType === "boss2") {
        boss.y += Math.sin(Date.now() * 0.006 + boss.waveOffset) * 2.8;
    }

    boss.y = Math.max(30, Math.min(canvas.height - boss.h - 30, boss.y));

    boss.shootTimer = (boss.shootTimer || 0) + delta;

    if (boss.bossType === "boss1") {
        if (boss.shootTimer >= 1.2) {
            boss.shootTimer = 0;

            enemyBullets.push({
                x: boss.x,
                y: boss.y + boss.h / 2,
                vx: -4,
                vy: 0,
                size: 6
            });

            enemyBullets.push({
                x: boss.x,
                y: boss.y + 20,
                vx: -3,
                vy: -1.2,
                size: 5
            });

            enemyBullets.push({
                x: boss.x,
                y: boss.y + boss.h - 20,
                vx: -3,
                vy: 1.2,
                size: 5
            });
        }
    }

    if (boss.bossType === "boss2") {
        if (boss.shootTimer >= 0.8) {
            boss.shootTimer = 0;

            const angles = [-2.2, -1.2, 0, 1.2, 2.2];

            angles.forEach(angle => {
                enemyBullets.push({
                    x: boss.x,
                    y: boss.y + boss.h / 2,
                    vx: -4,
                    vy: angle,
                    size: 6
                });
            });
        }
    }
}

// =========================
// SPAWN
// =========================
function spawnWaveEnemy(type) {
    const enemyId = `wave-${stage}-${wave}-${enemiesSpawned}-${Math.random()}`;

    let enemy = {
        id: enemyId,
        x: canvas.width + 40,
        y: Math.random() * (canvas.height - 80) + 40,
        w: 30,
        h: 24,
        speed: 2,
        behavior: type,
        waveOffset: Math.random() * Math.PI * 2,
        hp: 1
    };

    if (type === "basic") {
        enemy.speed = 2.1;
        enemy.w = 28;
        enemy.h = 22;
    }

    if (type === "zigzag") {
        enemy.speed = 2.4;
        enemy.w = 30;
        enemy.h = 24;
    }

    if (type === "fast") {
        enemy.speed = 4.1;
        enemy.w = 24;
        enemy.h = 18;
    }

    if (type === "mixed") {
        enemy.speed = 2.8 + Math.random() * 1.8;
        enemy.w = Math.random() > 0.5 ? 26 : 34;
        enemy.h = Math.random() > 0.5 ? 20 : 26;
    }

    if (type === "charger") {
        enemy.speed = 5.5;
        enemy.w = 26;
        enemy.h = 18;
    }

    if (type === "sniper") {
        enemy.speed = 1.6;
        enemy.w = 34;
        enemy.h = 24;
        enemy.hp = 2;
    }

    if (type === "elite") {
        enemy.speed = 2.6;
        enemy.w = 36;
        enemy.h = 28;
        enemy.hp = 3;
    }

    if (type === "chaos2") {
        const options = ["charger", "sniper", "elite"];
        const chosen = options[Math.floor(Math.random() * options.length)];
        return spawnWaveEnemy(chosen);
    }

    enemies.push(enemy);
    currentWaveEnemyIds.push(enemyId);
}

function spawnBoss(type) {
    if (type === "boss1") {
        enemies.push({
            id: `boss-${stage}-${wave}`,
            x: canvas.width + 120,
            y: canvas.height / 2 - 60,
            w: 110,
            h: 90,
            hp: 600,
            maxHp: 600,
            isBoss: true,
            bossType: "boss1",
            speed: 1.6,
            moveTimer: 0,
            waveOffset: Math.random() * Math.PI * 2
        });
    }

    if (type === "boss2") {
        enemies.push({
            id: `boss-${stage}-${wave}`,
            x: canvas.width + 140,
            y: canvas.height / 2 - 70,
            w: 130,
            h: 110,
            hp: 900,
            maxHp: 900,
            isBoss: true,
            bossType: "boss2",
            speed: 2.0,
            moveTimer: 0,
            waveOffset: Math.random() * Math.PI * 2
        });
    }
}

// =========================
// PARTÍCULAS / EFEITOS
// =========================
function updateParticles(delta) {
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life -= delta;
        p.size *= 0.985;

        if (p.life <= 0 || p.size <= 0.3) {
            particles.splice(i, 1);
        }
    }
}

function updateExplosions(delta) {
    for (let i = explosions.length - 1; i >= 0; i--) {
        explosions[i].life -= delta;
        explosions[i].radius += explosions[i].grow;

        if (explosions[i].life <= 0) {
            explosions.splice(i, 1);
        }
    }
}

function updateBackground() {
    farStars.forEach(s => {
        s.x -= s.speed;
        if (s.x < -5) {
            s.x = canvas.width + 5;
            s.y = Math.random() * canvas.height;
        }
    });

    stars.forEach(s => {
        s.x -= s.speed;
        if (s.x < -5) {
            s.x = canvas.width + 5;
            s.y = Math.random() * canvas.height;
        }
    });

    nebulas.forEach(n => {
        n.x -= n.speed;
        if (n.x < -n.radius * 2) {
            n.x = canvas.width + n.radius;
            n.y = Math.random() * canvas.height;
        }
    });
}

function fireBullet() {
    bullets.push({
        x: player.x + player.w - 2,
        y: player.y + player.h / 2 - 2,
        w: 16,
        h: 4,
        speed: 9
    });

    particles.push({
        x: player.x + player.w + 4,
        y: player.y + player.h / 2,
        vx: Math.random() * 1.5 + 0.5,
        vy: (Math.random() - 0.5) * 0.8,
        life: 0.2,
        maxLife: 0.2,
        size: 4,
        color: "0,255,255"
    });
}

function createEngineTrail() {
    particles.push({
        x: player.x + 2,
        y: player.y + player.h / 2 + (Math.random() - 0.5) * 5,
        vx: -Math.random() * 2.5 - 1,
        vy: (Math.random() - 0.5) * 0.6,
        life: 0.35,
        maxLife: 0.35,
        size: Math.random() * 4 + 2,
        color: Math.random() > 0.5 ? "0,255,255" : "100,180,255"
    });
}

function createExplosion(x, y, color = "#ffffff") {
    explosions.push({
        x,
        y,
        radius: 4,
        grow: 2.2,
        life: 0.22,
        maxLife: 0.22,
        color
    });

    for (let i = 0; i < 14; i++) {
        particles.push({
            x,
            y,
            vx: (Math.random() - 0.5) * 5,
            vy: (Math.random() - 0.5) * 5,
            life: Math.random() * 0.4 + 0.2,
            maxLife: Math.random() * 0.4 + 0.2,
            size: Math.random() * 5 + 2,
            color: color === "#ff5a7a" ? "255,90,122" : "0,255,255"
        });
    }
}

function createHitBurst(x, y, color = "255,255,255") {
    for (let i = 0; i < 10; i++) {
        particles.push({
            x,
            y,
            vx: (Math.random() - 0.5) * 4,
            vy: (Math.random() - 0.5) * 4,
            life: Math.random() * 0.2 + 0.1,
            maxLife: Math.random() * 0.2 + 0.1,
            size: Math.random() * 3 + 1.5,
            color
        });
    }
}

function damagePlayer(amount) {
    if (player.invincible > 0) return;

    hp -= amount;
    player.hitFlash = 0.18;
    player.invincible = 0.7;
    screenShake = 0.22;
    flashTimer = 0.08;

    createExplosion(player.x + player.w / 2, player.y + player.h / 2, "#00e5ff");
    createHitBurst(player.x + 6, player.y + player.h / 2, "0,255,255");
    updateHUD();
}

// =========================
// DRAW
// =========================
function draw() {
    ctx.save();

    const shakeX = screenShake > 0 ? (Math.random() - 0.5) * 8 : 0;
    const shakeY = screenShake > 0 ? (Math.random() - 0.5) * 8 : 0;
    ctx.translate(shakeX, shakeY);

    drawBackground();
    drawPlayer();
    drawBullets();
    drawEnemies();
    drawEnemyBullets();
    drawParticles();
    drawExplosions();
    drawBossHealthBar();
    drawWaveIntro();

    ctx.restore();

    if (flashTimer > 0) {
        ctx.fillStyle = "rgba(255,255,255,0.06)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
}

function drawBackground() {
    const isStage2 = stage >= 2;

    const bg = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    if (isStage2) {
        bg.addColorStop(0, "#12040c");
        bg.addColorStop(0.45, "#1a0714");
        bg.addColorStop(1, "#07020a");
    } else {
        bg.addColorStop(0, "#040712");
        bg.addColorStop(0.45, "#08101d");
        bg.addColorStop(1, "#02040a");
    }

    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    nebulas.forEach(n => {
        const g = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.radius);
        g.addColorStop(0, `rgba(${n.color}, ${n.alpha})`);
        g.addColorStop(1, `rgba(${n.color}, 0)`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.radius, 0, Math.PI * 2);
        ctx.fill();
    });

    ctx.strokeStyle = isStage2 ? "rgba(255,80,130,0.035)" : "rgba(0,255,255,0.03)";
    ctx.lineWidth = 1;
    const gridSize = 40;

    for (let x = 0; x < canvas.width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
    }

    for (let y = 0; y < canvas.height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
    }

    farStars.forEach(s => {
        ctx.fillStyle = `rgba(180,220,255,${s.alpha})`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
        ctx.fill();
    });

    stars.forEach(s => {
        ctx.shadowBlur = 10;
        ctx.shadowColor = isStage2 ? "rgba(255,100,180,0.7)" : "rgba(100,220,255,0.8)";
        ctx.fillStyle = `rgba(240,250,255,${s.alpha})`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
        ctx.fill();
    });

    ctx.shadowBlur = 0;
}

function drawPlayer() {
    ctx.save();
    ctx.translate(player.x, player.y);

    if (player.invincible > 0 && Math.floor(player.invincible * 10) % 2 === 0) {
        ctx.globalAlpha = 0.45;
    }

    ctx.shadowBlur = 24;
    ctx.shadowColor = player.hitFlash > 0 ? "#ffffff" : "#00e5ff";

    ctx.fillStyle = player.hitFlash > 0 ? "#ffffff" : "#4fc3ff";
    ctx.beginPath();
    ctx.moveTo(8, 3);
    ctx.lineTo(0, 0);
    ctx.lineTo(8, 10);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(8, player.h - 3);
    ctx.lineTo(0, player.h);
    ctx.lineTo(8, player.h - 10);
    ctx.closePath();
    ctx.fill();

    const shipGrad = ctx.createLinearGradient(0, 0, player.w, 0);
    shipGrad.addColorStop(0, player.hitFlash > 0 ? "#ffffff" : "#69f2ff");
    shipGrad.addColorStop(1, player.hitFlash > 0 ? "#d9ffff" : "#00d8ff");
    ctx.fillStyle = shipGrad;

    ctx.beginPath();
    ctx.moveTo(4, player.h / 2);
    ctx.lineTo(14, 2);
    ctx.lineTo(player.w, player.h / 2);
    ctx.lineTo(14, player.h - 2);
    ctx.closePath();
    ctx.fill();

    ctx.shadowBlur = 16;
    ctx.shadowColor = "#ffffff";
    ctx.fillStyle = "#e9fdff";
    ctx.beginPath();
    ctx.ellipse(17, player.h / 2, 5, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.fillStyle = "#0b1f3a";
    ctx.fillRect(10, 8, 6, 2);
    ctx.fillRect(10, 14, 6, 2);

    ctx.shadowBlur = 22;
    ctx.shadowColor = "#00ffff";
    const flameLen = 10 + Math.random() * 8;
    const flameGrad = ctx.createLinearGradient(-flameLen, 0, 0, 0);
    flameGrad.addColorStop(0, "rgba(0,255,255,0)");
    flameGrad.addColorStop(0.3, "rgba(0,255,255,0.4)");
    flameGrad.addColorStop(1, "rgba(255,255,255,0.95)");
    ctx.fillStyle = flameGrad;

    ctx.beginPath();
    ctx.moveTo(2, player.h / 2);
    ctx.lineTo(-flameLen, player.h / 2 - 5);
    ctx.lineTo(-flameLen + 3, player.h / 2 + 5);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
}

function drawBullets() {
    bullets.forEach(b => {
        ctx.shadowBlur = 16;
        ctx.shadowColor = "#00ffff";

        const bulletGrad = ctx.createLinearGradient(b.x - 12, b.y, b.x + b.w, b.y);
        bulletGrad.addColorStop(0, "rgba(0,255,255,0)");
        bulletGrad.addColorStop(0.5, "#8ffcff");
        bulletGrad.addColorStop(1, "#ffffff");
        ctx.fillStyle = bulletGrad;

        ctx.fillRect(b.x - 10, b.y, b.w + 10, b.h);

        ctx.beginPath();
        ctx.arc(b.x + b.w, b.y + b.h / 2, 3, 0, Math.PI * 2);
        ctx.fill();
    });

    ctx.shadowBlur = 0;
}

function drawEnemyBullets() {
    enemyBullets.forEach(b => {
        ctx.shadowBlur = 14;
        ctx.shadowColor = "#ff4a70";
        ctx.fillStyle = "#ff6b88";

        ctx.beginPath();
        ctx.arc(b.x, b.y, b.size, 0, Math.PI * 2);
        ctx.fill();
    });

    ctx.shadowBlur = 0;
}

function drawEnemies() {
    enemies.forEach(e => {
        if (e.isBoss) {
            drawBoss(e);
            return;
        }

        ctx.save();
        ctx.translate(e.x, e.y);

        ctx.shadowBlur = 18;
        ctx.shadowColor = "#ff5a7a";

        ctx.fillStyle = "#ff5a7a";
        ctx.beginPath();
        ctx.moveTo(8, 2);
        ctx.lineTo(e.w - 4, 0);
        ctx.lineTo(e.w - 12, 10);
        ctx.closePath();
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(8, e.h - 2);
        ctx.lineTo(e.w - 4, e.h);
        ctx.lineTo(e.w - 12, e.h - 10);
        ctx.closePath();
        ctx.fill();

        const enemyGrad = ctx.createLinearGradient(0, 0, e.w, 0);
        enemyGrad.addColorStop(0, "#ff8ba0");
        enemyGrad.addColorStop(1, "#ff355d");
        ctx.fillStyle = enemyGrad;

        ctx.beginPath();
        ctx.moveTo(e.w, e.h / 2);
        ctx.lineTo(e.w - 10, 2);
        ctx.lineTo(0, e.h / 2);
        ctx.lineTo(e.w - 10, e.h - 2);
        ctx.closePath();
        ctx.fill();

        ctx.shadowBlur = 12;
        ctx.shadowColor = "#ffffff";
        ctx.fillStyle = "#ffeaf0";
        ctx.beginPath();
        ctx.ellipse(e.w - 13, e.h / 2, 4, 3, 0, 0, Math.PI * 2);
        ctx.fill();

        if (e.hp > 1) {
            ctx.fillStyle = "rgba(255,255,255,0.15)";
            ctx.fillRect(2, -8, e.w - 4, 4);

            ctx.fillStyle = "#ff9db0";
            ctx.fillRect(2, -8, (e.w - 4) * (e.hp / 3), 4);
        }

        ctx.restore();
    });

    ctx.shadowBlur = 0;
}

function drawBoss(boss) {
    ctx.save();
    ctx.translate(boss.x, boss.y);

    ctx.shadowBlur = 26;
    ctx.shadowColor = boss.bossType === "boss2" ? "#ff2d88" : "#ff4068";

    const wingGrad = ctx.createLinearGradient(0, 0, boss.w, 0);
    wingGrad.addColorStop(0, boss.bossType === "boss2" ? "#ff73d0" : "#ff8ea6");
    wingGrad.addColorStop(1, boss.bossType === "boss2" ? "#d82cff" : "#ff365f");
    ctx.fillStyle = wingGrad;

    ctx.beginPath();
    ctx.moveTo(26, 8);
    ctx.lineTo(boss.w - 10, 0);
    ctx.lineTo(boss.w - 24, 26);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(26, boss.h - 8);
    ctx.lineTo(boss.w - 10, boss.h);
    ctx.lineTo(boss.w - 24, boss.h - 26);
    ctx.closePath();
    ctx.fill();

    const bodyGrad = ctx.createLinearGradient(0, 0, boss.w, 0);
    bodyGrad.addColorStop(0, boss.bossType === "boss2" ? "#ff8fe0" : "#ff9bb0");
    bodyGrad.addColorStop(1, boss.bossType === "boss2" ? "#b61dff" : "#ff2956");
    ctx.fillStyle = bodyGrad;

    ctx.beginPath();
    ctx.moveTo(boss.w, boss.h / 2);
    ctx.lineTo(boss.w - 30, 10);
    ctx.lineTo(10, boss.h / 2);
    ctx.lineTo(boss.w - 30, boss.h - 10);
    ctx.closePath();
    ctx.fill();

    ctx.shadowBlur = 18;
    ctx.shadowColor = "#ffffff";
    ctx.fillStyle = "#fff0f4";
    ctx.beginPath();
    ctx.ellipse(boss.w - 34, boss.h / 2, 10, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#111827";
    ctx.fillRect(42, 24, 16, 4);
    ctx.fillRect(42, 62, 16, 4);

    ctx.restore();
}

function drawParticles() {
    particles.forEach(p => {
        const alpha = Math.max(0, p.life / p.maxLife);
        ctx.shadowBlur = 12;
        ctx.shadowColor = `rgba(${p.color}, ${alpha})`;
        ctx.fillStyle = `rgba(${p.color}, ${alpha})`;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
    });

    ctx.shadowBlur = 0;
}

function drawExplosions() {
    explosions.forEach(ex => {
        const alpha = ex.life / ex.maxLife;

        ctx.shadowBlur = 22;
        ctx.shadowColor = ex.color;
        ctx.strokeStyle = hexToRgba(ex.color, alpha);
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(ex.x, ex.y, ex.radius, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = hexToRgba(ex.color, alpha * 0.18);
        ctx.beginPath();
        ctx.arc(ex.x, ex.y, ex.radius * 0.65, 0, Math.PI * 2);
        ctx.fill();
    });

    ctx.shadowBlur = 0;
}

function drawBossHealthBar() {
    const boss = enemies.find(e => e.isBoss);
    if (!boss) return;

    const barW = 260;
    const barH = 12;
    const x = canvas.width / 2 - barW / 2;
    const y = 18;
    const pct = Math.max(0, boss.hp / boss.maxHp);

    ctx.fillStyle = "rgba(255,255,255,0.08)";
    roundRect(ctx, x, y, barW, barH, 8, true, false);

    ctx.fillStyle = boss.bossType === "boss2" ? "#d82cff" : "#ff4a70";
    roundRect(ctx, x, y, barW * pct, barH, 8, true, false);

    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.font = "bold 12px Arial";
    ctx.textAlign = "center";
    ctx.fillText(boss.bossType === "boss2" ? "BOSS 2" : "BOSS", canvas.width / 2, y - 6);
}

function drawWaveIntro() {
    if (waveTransitionTimer <= 0) return;

    const alpha = Math.min(1, waveTransitionTimer / 1.2);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.textAlign = "center";

    ctx.shadowBlur = 20;
    ctx.shadowColor = stage >= 2 ? "#ff55aa" : "#00ffff";
    ctx.fillStyle = "#eaffff";
    ctx.font = "bold 28px Arial";
    ctx.fillText(`FASE ${stage}`, canvas.width / 2, canvas.height / 2 - 20);

    ctx.shadowBlur = 14;
    ctx.fillStyle = "rgba(220,245,255,0.92)";
    ctx.font = "18px Arial";
    ctx.fillText(waveIntroText, canvas.width / 2, canvas.height / 2 + 18);

    ctx.restore();
}

// =========================
// HUD / UTIL
// =========================
function updateHUD() {
    document.getElementById("score").innerText = score;
    document.getElementById("hp").innerText = hp;
    document.getElementById("stage").innerText = stage;
    document.getElementById("wave").innerText = Math.max(1, wave + 1);
}

function hit(a, b) {
    return a.x < b.x + b.w &&
           a.x + a.w > b.x &&
           a.y < b.y + b.h &&
           a.y + a.h > b.y;
}

function hexToRgba(hex, alpha) {
    const c = hex.replace("#", "");
    const bigint = parseInt(c, 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    return `rgba(${r},${g},${b},${alpha})`;
}

function roundRect(ctx, x, y, width, height, radius, fill, stroke) {
    if (width <= 0) return;
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();

    if (fill) ctx.fill();
    if (stroke) ctx.stroke();
}

// =========================
// LOOP
// =========================
function loop(timestamp) {
    if (!running) return;

    const delta = Math.min((timestamp - lastTime) / 1000 || 0.016, 0.033);
    lastTime = timestamp;

    update(delta);
    draw();
    requestAnimationFrame(loop);
}