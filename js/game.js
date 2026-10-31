import { Fighter, MAX_POWER } from './fighter.js';
import { AI } from './ai.js';
import { Sfx } from './audio.js';
import { clamp, damp, lerp, rand, easeOutCubic, easeOutQuint, TAU } from './utils.js';

const PAPER = '#f4f1e8';
const RED = '#ff3b30';
const RIVAL = '#b9b4a8';
const FONT = '"IBM Plex Mono", ui-monospace, monospace';

export class Game {
  constructor(canvas, ui) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.ui = ui;
    this.sfx = new Sfx();
    this.world = { w: 1280, h: 720, ground: 590, aspect: 1.78 };
    this.player = new Fighter({ player: true, name: 'YOU' });
    this.enemy = new Fighter({ player: false, name: 'RIVAL' });
    this.ai = new AI(this.enemy);
    this.state = 'title';
    this.round = 1;
    this.scores = { you: 0, rival: 0 };
    this.particles = [];
    this.rings = [];
    this.texts = [];
    this.shakeAmt = 0;
    this.flashAmt = 0;
    this.flashColor = PAPER;
    this.hitstopT = 0;
    this.slowT = 0;
    this.koT = 0;
    this.introT = 0;
    this.fightShown = false;
    this.matchTime = 0;
    this.stats = this.blankStats();
    this.playerControl = this.player.emptyControl();
    this.resize();
    this.placeTitleFighters();
  }

  blankStats() {
    return { hits: 0, parries: 0, damage: 0, maxCombo: 0, time: 0 };
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(1, rect.width);
    const height = Math.max(1, rect.height);
    const aspect = width / height;
    const w = aspect < 0.9 ? 580 : aspect < 1.35 ? 1000 : 1280;
    const h = w / aspect;
    const old = this.world;
    const ground = h * (aspect < 0.9 ? 0.67 : aspect < 1.35 ? 0.78 : 0.82);

    this.world = { w, h, ground, aspect };
    this.canvas.width = Math.round(width * dpr);
    this.canvas.height = Math.round(height * dpr);
    this.dpr = dpr;

    for (const f of [this.player, this.enemy]) {
      if (!f) continue;
      const ratio = old.w > 0 ? f.x / old.w : 0.5;
      f.ground = ground;
      if (this.state === 'title' || this.state === 'matchover') continue;
      f.x = clamp(ratio * w, 58, w - 58);
      if (f.onGround) f.y = ground;
      else f.y += ground - old.ground;
    }
    if (this.state === 'title' || this.state === 'matchover') this.placeTitleFighters();
  }

  placeTitleFighters() {
    const { w, ground } = this.world;
    const gap = Math.min(260, w * 0.22);
    this.player.resetRound(w / 2 - gap, ground, 1);
    this.enemy.resetRound(w / 2 + gap, ground, -1);
    this.player.hp = 100;
    this.enemy.hp = 100;
  }

  startMatch() {
    this.sfx.unlock();
    this.scores = { you: 0, rival: 0 };
    this.round = 1;
    this.stats = this.blankStats();
    this.startRound();
  }

  startRound() {
    const { w, ground } = this.world;
    const gap = Math.min(310, w * 0.255);
    this.player.resetRound(w / 2 - gap, ground, 1);
    this.enemy.resetRound(w / 2 + gap, ground, -1);
    this.ai.reset();
    this.playerControl = this.player.emptyControl();
    this.player.control = this.playerControl;
    this.enemy.control = this.enemy.emptyControl();
    this.particles.length = 0;
    this.rings.length = 0;
    this.texts.length = 0;
    this.shakeAmt = 0;
    this.flashAmt = 0;
    this.hitstopT = 0;
    this.slowT = 0;
    this.koT = 0;
    this.introT = 0;
    this.fightShown = false;
    this.state = 'intro';
    this.ui.banner(`ROUND ${this.round}`, this.round === 3 ? 'DECIDER' : 'FIRST TO TWO', 1.15, 'round');
  }

  update(rawDt) {
    const dt = Math.min(rawDt, 0.033);
    this.updateEffects(dt);
    this.shakeAmt = damp(this.shakeAmt, 0, 9, dt);
    this.flashAmt = Math.max(0, this.flashAmt - dt * 3.2);

    if (this.state === 'title' || this.state === 'matchover') {
      this.player.update(dt, this, this.enemy);
      this.enemy.update(dt, this, this.player);
      this.faceOff();
      return;
    }

    if (this.state === 'intro') {
      this.introT += dt;
      if (!this.fightShown && this.introT >= 0.82) {
        this.fightShown = true;
        this.ui.banner('FIGHT', '', 0.7, 'fight');
        this.sfx.ui();
        this.flashAmt = 0.08;
        this.flashColor = PAPER;
      }
      if (this.introT >= 1.42) {
        this.state = 'fight';
        this.matchTime = 0;
      }
      this.player.update(dt, this, this.enemy);
      this.enemy.update(dt, this, this.player);
      this.faceOff();
      return;
    }

    if (this.state === 'fight') {
      if (this.hitstopT > 0) {
        this.hitstopT = Math.max(0, this.hitstopT - dt);
        return;
      }
      this.matchTime += dt;
      this.stats.time += dt;
      this.player.control = this.playerControl;
      this.enemy.control = this.ai.update(dt, this.player, this);
      this.player.update(dt, this, this.enemy);
      if (this.state === 'fight') this.enemy.update(dt, this, this.player);
      this.resolveBodyCollision();
      if (this.state === 'fight' && (this.player.hp <= 0 || this.enemy.hp <= 0)) this.beginKO();
      return;
    }

    if (this.state === 'ko') {
      this.koT += dt;
      const simDt = dt * (this.slowT > 0 ? 0.34 : 1);
      this.slowT = Math.max(0, this.slowT - dt);
      if (this.hitstopT > 0) {
        this.hitstopT = Math.max(0, this.hitstopT - dt);
        return;
      }
      this.player.update(simDt, this, this.enemy);
      this.enemy.update(simDt, this, this.player);
      this.resolveBodyCollision();
      if (this.koT > 2.35) this.finishRound();
    }
  }

  faceOff() {
    if (!this.player.attack) this.player.facing = this.enemy.x >= this.player.x ? 1 : -1;
    if (!this.enemy.attack) this.enemy.facing = this.player.x >= this.enemy.x ? 1 : -1;
  }

  resolveBodyCollision() {
    const a = this.player;
    const b = this.enemy;
    if (a.hp <= 0 || b.hp <= 0) return;
    const dx = b.x - a.x;
    const min = 54;
    if (Math.abs(dx) < min && Math.abs(a.y - b.y) < 110) {
      const s = dx >= 0 ? 1 : -1;
      const push = (min - Math.abs(dx)) / 2;
      a.x = clamp(a.x - push * s, 58, this.world.w - 58);
      b.x = clamp(b.x + push * s, 58, this.world.w - 58);
      if (a.attack && a.attack.hasHit) a.x -= s * 2;
      if (b.attack && b.attack.hasHit) b.x += s * 2;
    }
  }

  resolveHit(attacker, target) {
    if (this.state !== 'fight' || !attacker.attack || attacker.attack.hasHit) return false;
    const a = attacker.attack;
    const d = a.def;
    const dx = (target.x - attacker.x) * attacker.facing;
    if (dx < -26 || dx > d.range + 36) return false;
    const strikeY = attacker.y - 106;
    const bodyY = target.y - 92;
    if (Math.abs(strikeY - bodyY) > 108) return false;
    if (target.invuln > 0) return false;

    a.hasHit = true;
    const chainScale = [1, 0.78, 0.6][Math.min(a.chain, 2)];
    const powerScale = attacker.inPower ? 1.42 : 1;
    const dir = attacker.facing;

    // A parry is a guard pressed just before impact.
    if (target.blocking && target.facing === -dir && target.onGround) {
      if (target.blockTime <= 0.195) {
        attacker.attack = null;
        attacker.stun = 0.82;
        attacker.hitstun = 0;
        attacker.vx = -dir * 190;
        attacker.blocking = false;
        target.power = clamp(target.power + 34, 0, MAX_POWER);
        target.invuln = 0.14;
        if (target.player) {
          this.stats.parries += 1;
        }
        this.sfx.parry();
        this.hitstopT = 0.12;
        this.shake(9);
        this.flash(PAPER, 0.2);
        this.spawnParry(target.x + dir * 26, target.y - 120);
        this.floatText(target.x + dir * 22, target.y - 212, 'PARRY', RED, 22, 0.85);
        return true;
      }

      const chip = Math.round(d.chip * powerScale);
      target.hp = Math.max(0, target.hp - chip);
      target.power = clamp(target.power + 3, 0, MAX_POWER);
      attacker.power = clamp(attacker.power + 2, 0, MAX_POWER);
      target.vx = dir * 120;
      attacker.vx = -dir * 60;
      this.sfx.block();
      this.hitstopT = 0.035;
      this.shake(2.5);
      this.spawnBlock(target.x + dir * 24, target.y - 118);
      if (target.hp <= 0) this.beginKO();
      return true;
    }

    const dmg = Math.round(d.dmg * chainScale * powerScale);
    target.hp = Math.max(0, target.hp - dmg);
    target.hitstun = d.stun;
    target.stun = 0;
    target.attack = null;
    target.blocking = false;
    target.combo = 0;
    target.comboTimer = 0;
    target.vx = dir * d.kb;
    if (d.lift) {
      target.vy = d.lift;
      target.onGround = false;
    }
    target.hitFlash = 1;

    attacker.power = clamp(attacker.power + d.meter * (attacker.inPower ? 0.35 : 1), 0, MAX_POWER);
    target.power = clamp(target.power + dmg * 0.5, 0, MAX_POWER);
    attacker.combo += 1;
    attacker.comboTimer = 1.15;

    if (attacker.player) {
      this.stats.hits += 1;
      this.stats.damage += dmg;
      this.stats.maxCombo = Math.max(this.stats.maxCombo, attacker.combo);
    }

    this.sfx.hit(clamp(0.7 + dmg / 30, 0.7, 1.5));
    this.hitstopT = Math.min(0.13, 0.045 + dmg * 0.0022);
    this.shake(5 + dmg * 0.16);
    this.flash(attacker.inPower ? RED : PAPER, attacker.inPower ? 0.12 : 0.055);
    this.spawnHit(target.x, target.y - 104, attacker.inPower ? RED : PAPER, clamp(dmg / 14, 0.8, 1.8));
    if (attacker.combo >= 2 && attacker.player) {
      this.floatText(target.x, target.y - 208, `${attacker.combo} HIT`, attacker.inPower ? RED : PAPER, 18, 0.55);
    }
    if (target.hp <= 0) this.beginKO();
    return true;
  }

  beginKO() {
    if (this.state !== 'fight') return;
    const playerDown = this.player.hp <= 0;
    const enemyDown = this.enemy.hp <= 0;
    if (!playerDown && !enemyDown) return;

    this.state = 'ko';
    this.koT = 0;
    this.slowT = 0.9;
    this.hitstopT = 0.12;
    this.shake(18);
    this.flash(PAPER, 0.32);
    this.sfx.ko();

    const playerWins = enemyDown && !playerDown;
    if (playerWins) {
      this.scores.you += 1;
      this.player.victory = true;
    } else {
      this.scores.rival += 1;
      this.enemy.victory = true;
    }

    const loser = playerDown ? this.player : this.enemy;
    this.spawnHit(loser.x, loser.y - 100, RED, 2.6);
    for (let i = 0; i < 26; i++) {
      this.particles.push({
        x: loser.x + rand(-20, 20),
        y: loser.y - rand(30, 180),
        vx: rand(-260, 260),
        vy: rand(-520, -120),
        life: rand(0.5, 1.3),
        maxLife: 1.3,
        size: rand(1.5, 3.5),
        color: i % 3 === 0 ? RED : PAPER,
        gravity: 1200,
        drag: 0.4,
        type: 'spark',
      });
    }

    this.ui.banner('K.O.', playerWins ? 'YOU WIN THE ROUND' : 'RIVAL TAKES THE ROUND', 2.2, 'ko');
    this.ui.syncScore?.(this.scores);
  }

  finishRound() {
    if (this.scores.you >= 2 || this.scores.rival >= 2) {
      this.state = 'matchover';
      const win = this.scores.you >= 2;
      this.ui.result({
        win,
        scores: this.scores,
        stats: this.stats,
        rounds: this.round,
      });
      return;
    }
    this.round += 1;
    this.startRound();
  }

  shake(amount) {
    this.shakeAmt = Math.max(this.shakeAmt, amount);
  }

  flash(color, amount) {
    this.flashColor = color;
    this.flashAmt = Math.max(this.flashAmt, amount);
  }

  hitstop(seconds) {
    this.hitstopT = Math.max(this.hitstopT, seconds);
  }

  floatText(x, y, text, color = PAPER, size = 18, life = 0.7) {
    this.texts.push({ x, y, text, color, size, life, maxLife: life, vy: -34 });
  }

  spawnDust(x, y, count, dir) {
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: x + rand(-10, 10),
        y: y - rand(0, 4),
        vx: rand(-70, 70) + dir * rand(20, 90),
        vy: rand(-110, -20),
        life: rand(0.28, 0.62),
        maxLife: 0.62,
        size: rand(1.5, 4.5),
        color: 'rgba(208,202,188,0.55)',
        gravity: 240,
        drag: 2.2,
        type: 'dust',
      });
    }
  }

  spawnHit(x, y, color, power = 1) {
    this.rings.push({
      x,
      y,
      r0: 4,
      r1: 26 + 22 * power,
      life: 0.28,
      maxLife: 0.28,
      color,
      width: 2,
    });
    for (let i = 0; i < 8 + power * 7; i++) {
      const a = rand(0, TAU);
      const speed = rand(140, 720) * power;
      this.particles.push({
        x: x + rand(-6, 6),
        y: y + rand(-10, 10),
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed * 0.7 - 80,
        life: rand(0.18, 0.52),
        maxLife: 0.52,
        size: rand(1, 2.8),
        color: i % 4 === 0 ? RED : color,
        gravity: 1300,
        drag: 0.9,
        type: 'spark',
      });
    }
    for (let i = 0; i < 3; i++) {
      this.particles.push({
        x: x + rand(-16, 16),
        y: y + rand(-16, 16),
        vx: rand(-40, 40),
        vy: rand(-60, -10),
        life: rand(0.2, 0.5),
        maxLife: 0.5,
        size: rand(4, 9),
        color: 'rgba(244,241,232,0.16)',
        gravity: -30,
        drag: 1.2,
        type: 'dust',
      });
    }
  }

  spawnBlock(x, y) {
    this.rings.push({ x, y, r0: 6, r1: 38, life: 0.2, maxLife: 0.2, color: PAPER, width: 1.5 });
    for (let i = 0; i < 8; i++) {
      const a = rand(-1.2, 1.2);
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * rand(90, 300),
        vy: Math.sin(a) * rand(90, 300) - 50,
        life: rand(0.15, 0.35),
        maxLife: 0.35,
        size: rand(1, 2),
        color: PAPER,
        gravity: 800,
        drag: 1,
        type: 'spark',
      });
    }
  }

  spawnParry(x, y) {
    for (let i = 0; i < 2; i++) {
      this.rings.push({
        x,
        y,
        r0: 8,
        r1: 70 + i * 38,
        life: 0.38 + i * 0.1,
        maxLife: 0.38 + i * 0.1,
        color: i === 0 ? PAPER : RED,
        width: 2.5 - i * 0.8,
      });
    }
    for (let i = 0; i < 22; i++) {
      const a = rand(0, TAU);
      const speed = rand(160, 720);
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed - 120,
        life: rand(0.25, 0.65),
        maxLife: 0.65,
        size: rand(1, 2.6),
        color: i % 3 === 0 ? RED : PAPER,
        gravity: 1000,
        drag: 0.8,
        type: 'spark',
      });
    }
  }

  spawnPowerBurst(f) {
    const x = f.x;
    const y = f.y - 100;
    this.rings.push({ x, y, r0: 16, r1: 240, life: 0.5, maxLife: 0.5, color: RED, width: 3 });
    this.rings.push({ x, y, r0: 6, r1: 150, life: 0.36, maxLife: 0.36, color: PAPER, width: 1.5 });
    for (let i = 0; i < 34; i++) {
      const a = rand(0, TAU);
      const speed = rand(80, 420);
      this.particles.push({
        x: x + rand(-30, 30),
        y: y + rand(-90, 90),
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed - rand(40, 180),
        life: rand(0.4, 1.1),
        maxLife: 1.1,
        size: rand(1, 3.2),
        color: i % 2 ? RED : '#ff8a7f',
        gravity: -60,
        drag: 0.7,
        type: 'ember',
      });
    }
  }

  updateEffects(dt) {
    for (const p of this.particles) {
      p.life -= dt;
      p.vy += p.gravity * dt;
      p.vx *= Math.exp(-p.drag * dt);
      p.vy *= Math.exp(-p.drag * 0.25 * dt);
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
    for (const r of this.rings) r.life -= dt;
    this.rings = this.rings.filter((r) => r.life > 0);
    for (const t of this.texts) {
      t.life -= dt;
      t.y += t.vy * dt;
    }
    this.texts = this.texts.filter((t) => t.life > 0);
  }

  render() {
    const { ctx } = this;
    const { w, h, ground } = this.world;
    ctx.setTransform(this.canvas.width / w, 0, 0, this.canvas.height / h, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const shake = this.shakeAmt;
    if (shake > 0.2) ctx.translate(rand(-shake, shake), rand(-shake, shake));

    this.drawBackground();

    // Shadows.
    this.drawShadow(this.player);
    this.drawShadow(this.enemy);

    // Power afterimages, oldest first.
    for (const f of [this.enemy, this.player]) {
      for (const t of f.trail) {
        const alpha = (t.life / t.maxLife) * (t.dash ? 0.16 : 0.22);
        this.drawFighterAt(f, t.x, t.y, t.facing, t.pose, alpha, true);
      }
    }

    this.drawFighter(this.enemy);
    this.drawFighter(this.player);

    this.drawRings();
    this.drawParticles();
    this.drawTexts();

    if (this.player.inPower || this.enemy.inPower) {
      const g = ctx.createRadialGradient(w / 2, ground - 110, h * 0.12, w / 2, ground - 110, h * 0.8);
      g.addColorStop(0, 'rgba(255,59,48,0)');
      g.addColorStop(1, 'rgba(255,59,48,0.13)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }

    if (this.flashAmt > 0.001) {
      ctx.globalAlpha = clamp(this.flashAmt, 0, 0.6);
      ctx.fillStyle = this.flashColor;
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 1;
    }
  }

  drawBackground() {
    const { ctx } = this;
    const { w, h, ground } = this.world;
    const inPower = this.player.inPower || this.enemy.inPower;

    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#0a0a0d');
    g.addColorStop(0.62, '#0d0d11');
    g.addColorStop(1, '#070709');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    // Huge ghost wordmark.
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `${Math.round(w * 0.33)}px Anton, Impact, sans-serif`;
    ctx.fillStyle = inPower ? 'rgba(255,59,48,0.045)' : 'rgba(244,241,232,0.033)';
    ctx.fillText('POWER', w / 2, ground - h * 0.185);
    ctx.restore();

    // Thin geometry.
    ctx.save();
    ctx.strokeStyle = inPower ? 'rgba(255,59,48,0.12)' : 'rgba(244,241,232,0.055)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(w / 2, ground - h * 0.23, w * 0.185, 0, TAU);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(w / 2, h * 0.07);
    ctx.lineTo(w / 2, ground);
    ctx.stroke();
    ctx.restore();

    // Horizon.
    const line = ctx.createLinearGradient(0, 0, w, 0);
    line.addColorStop(0, 'rgba(244,241,232,0)');
    line.addColorStop(0.2, 'rgba(244,241,232,0.22)');
    line.addColorStop(0.5, 'rgba(244,241,232,0.7)');
    line.addColorStop(0.8, 'rgba(244,241,232,0.22)');
    line.addColorStop(1, 'rgba(244,241,232,0)');
    ctx.strokeStyle = line;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(0, ground + 0.5);
    ctx.lineTo(w, ground + 0.5);
    ctx.stroke();

    ctx.fillStyle = '#060608';
    ctx.fillRect(0, ground + 1, w, h - ground);
    ctx.strokeStyle = 'rgba(244,241,232,0.06)';
    ctx.lineWidth = 1;
    for (let i = 1; i <= 4; i++) {
      const y = ground + i * Math.max(18, h * 0.035);
      ctx.globalAlpha = 0.5 - i * 0.09;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // Ground ticks.
    ctx.strokeStyle = 'rgba(244,241,232,0.14)';
    ctx.lineWidth = 1;
    const ticks = 19;
    for (let i = 0; i < ticks; i++) {
      const x = (w / (ticks - 1)) * i;
      const tall = i % 5 === 0 ? 8 : 4;
      ctx.beginPath();
      ctx.moveTo(x, ground + 3);
      ctx.lineTo(x, ground + 3 + tall);
      ctx.stroke();
    }

  }

  drawShadow(f) {
    const { ctx } = this;
    const height = f.ground - f.y;
    const k = clamp(1 - height / 380, 0.35, 1);
    ctx.save();
    ctx.globalAlpha = 0.32 * k;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(f.x + f.lunge * 0.4, f.ground + 5, 34 * k, 7 * k, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  skeleton(f) {
    const facing = f.facing;
    const p = f.pose;
    const hip = { x: 0, y: -88 + p.crouch };
    const torso = 58;
    const neck = {
      x: hip.x + Math.sin(p.lean) * torso * facing,
      y: hip.y - Math.cos(p.lean) * torso,
    };
    const shoulder = { x: neck.x - Math.sin(p.lean) * 4 * facing, y: neck.y + 6 };
    const head = {
      x: neck.x + Math.sin(p.lean + p.head) * 21 * facing,
      y: neck.y - Math.cos(p.lean + p.head) * 21,
    };

    const limb = (start, a1, a2, l1, l2) => {
      const elbow = {
        x: start.x + Math.sin(a1) * l1 * facing,
        y: start.y + Math.cos(a1) * l1,
      };
      const hand = {
        x: elbow.x + Math.sin(a1 + a2) * l2 * facing,
        y: elbow.y + Math.cos(a1 + a2) * l2,
      };
      return [elbow, hand];
    };

    const [elbowB, handB] = limb(shoulder, p.armB[0], p.armB[1], 34, 32);
    const [elbowF, handF] = limb(shoulder, p.armF[0], p.armF[1], 34, 32);
    const [kneeB, footB] = limb(hip, p.legB[0], p.legB[1], 45, 44);
    const [kneeF, footF] = limb(hip, p.legF[0], p.legF[1], 45, 44);

    return { hip, neck, shoulder, head, elbowB, handB, elbowF, handF, kneeB, footB, kneeF, footF };
  }

  drawFighter(f) {
    this.drawFighterAt(f, f.x + f.lunge, f.y, f.facing, f.pose, 1, false);
  }

  drawFighterAt(f, x, y, facing, pose, alpha, ghost) {
    const { ctx } = this;
    const original = f.pose;
    const originalFacing = f.facing;
    f.pose = pose;
    f.facing = facing;
    const s = this.skeleton(f);
    f.pose = original;
    f.facing = originalFacing;

    const base = f.player ? PAPER : RIVAL;
    const back = f.player ? 'rgba(244,241,232,0.5)' : 'rgba(185,180,168,0.42)';
    const inPower = f.inPower && !ghost;

    ctx.save();
    ctx.translate(x, y);
    if (f.hp <= 0 && !ghost) {
      const t = easeOutCubic(clamp(f.koT / 0.72, 0, 1));
      ctx.rotate(-f.facing * t * Math.PI * 0.47);
      ctx.translate(0, -2);
    }
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalAlpha = alpha;

    if (inPower) {
      const aura = ctx.createRadialGradient(0, -105, 10, 0, -105, 150);
      aura.addColorStop(0, 'rgba(255,59,48,0.16)');
      aura.addColorStop(1, 'rgba(255,59,48,0)');
      ctx.fillStyle = aura;
      ctx.fillRect(-160, -270, 320, 290);
      ctx.save();
      ctx.strokeStyle = 'rgba(255,59,48,0.28)';
      ctx.lineWidth = 13;
      this.strokeSkeleton(s, facing, 13, 'rgba(255,59,48,0.25)');
      ctx.restore();
    }

    // Back leg, back arm.
    this.strokeLimb(s.hip, s.kneeB, s.footB, back, 7);
    this.strokeLimb(s.shoulder, s.elbowB, s.handB, back, 6.4);

    // Torso and neck.
    this.strokeLimb(s.hip, s.neck, null, base, 8);
    // Front leg.
    this.strokeLimb(s.hip, s.kneeF, s.footF, base, 7.4);

    // Head.
    ctx.strokeStyle = base;
    ctx.lineWidth = 5.4;
    ctx.beginPath();
    ctx.arc(s.head.x, s.head.y, 15.5, 0, TAU);
    ctx.stroke();

    // Player's red headband.
    if (f.player && !ghost) {
      const a = -(pose.lean + pose.head);
      const r = 15.5;
      const p1 = { x: s.head.x + Math.cos(a) * r, y: s.head.y + Math.sin(a) * r };
      const p2 = { x: s.head.x - Math.cos(a) * r, y: s.head.y - Math.sin(a) * r };
      ctx.strokeStyle = RED;
      ctx.lineWidth = 4.2;
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
      const bx = s.head.x - facing * 13;
      const by = s.head.y - 2;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(bx, by);
      for (let i = 1; i <= 2; i++) {
        ctx.lineTo(bx - facing * (5 + i * 5), by + Math.sin(f.animTime * 9 + i) * 3 + i * 1.5);
      }
      ctx.stroke();
    }

    // Front arm and fist.
    this.strokeLimb(s.shoulder, s.elbowF, s.handF, base, 6.8);
    ctx.fillStyle = base;
    ctx.beginPath();
    ctx.arc(s.handF.x, s.handF.y, 3.6, 0, TAU);
    ctx.fill();

    // Impact flash on the body.
    if (!ghost && f.hitFlash > 0.02) {
      ctx.globalAlpha = alpha * f.hitFlash * 0.45;
      this.strokeSkeleton(s, facing, 10, RED);
      ctx.strokeStyle = RED;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(s.head.x, s.head.y, 15.5, 0, TAU);
      ctx.stroke();
      ctx.globalAlpha = alpha;
    }

    // Attack trail.
    if (!ghost && f.attack) {
      const a = f.attack;
      const def = a.def;
      if (a.t >= def.startup - 0.015 && a.t <= def.startup + def.active + 0.06) {
        const k = clamp((a.t - def.startup) / def.active, 0, 1);
        const reach = def.type === 'heavy' || def.name === 'heavy' ? 82 : 66;
        ctx.save();
        ctx.globalAlpha = alpha * (0.35 + (1 - k) * 0.5);
        ctx.strokeStyle = inPower ? RED : PAPER;
        ctx.lineWidth = def.name === 'heavy' ? 4 : 2.2;
        const base = facing === 1 ? 0 : Math.PI;
        const start = base - 0.9 + k * 1.5;
        ctx.beginPath();
        ctx.arc(s.shoulder.x, s.shoulder.y, reach, start - 0.5, start + 0.55);
        ctx.stroke();
        ctx.globalAlpha = alpha * 0.5;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.arc(s.shoulder.x, s.shoulder.y, reach - 12, start - 0.75, start + 0.35);
        ctx.stroke();
        ctx.restore();
      }
    }

    ctx.restore();
  }

  strokeLimb(a, b, c, color, width) {
    const { ctx } = this;
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    if (c) ctx.lineTo(c.x, c.y);
    ctx.stroke();
  }

  strokeSkeleton(s, facing, width, color) {
    const { ctx } = this;
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(s.hip.x, s.hip.y);
    ctx.lineTo(s.neck.x, s.neck.y);
    ctx.moveTo(s.shoulder.x, s.shoulder.y);
    ctx.lineTo(s.elbowB.x, s.elbowB.y);
    ctx.lineTo(s.handB.x, s.handB.y);
    ctx.moveTo(s.shoulder.x, s.shoulder.y);
    ctx.lineTo(s.elbowF.x, s.elbowF.y);
    ctx.lineTo(s.handF.x, s.handF.y);
    ctx.moveTo(s.hip.x, s.hip.y);
    ctx.lineTo(s.kneeB.x, s.kneeB.y);
    ctx.lineTo(s.footB.x, s.footB.y);
    ctx.moveTo(s.hip.x, s.hip.y);
    ctx.lineTo(s.kneeF.x, s.kneeF.y);
    ctx.lineTo(s.footF.x, s.footF.y);
    ctx.stroke();
  }

  drawParticles() {
    const { ctx } = this;
    for (const p of this.particles) {
      const a = clamp(p.life / p.maxLife, 0, 1);
      ctx.globalAlpha = a;
      if (p.type === 'spark') {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = p.size;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * 0.016, p.y - p.vy * 0.016);
        ctx.stroke();
      } else {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (p.type === 'dust' ? 0.7 + (1 - a) * 0.8 : 1), 0, TAU);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  drawRings() {
    const { ctx } = this;
    for (const r of this.rings) {
      const k = 1 - r.life / r.maxLife;
      const radius = lerp(r.r0, r.r1, easeOutQuint(k));
      ctx.globalAlpha = (1 - k) * 0.9;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = r.width;
      ctx.beginPath();
      ctx.arc(r.x, r.y, radius, 0, TAU);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  drawTexts() {
    const { ctx } = this;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const t of this.texts) {
      const k = clamp(t.life / t.maxLife, 0, 1);
      ctx.globalAlpha = Math.min(1, k * 2);
      ctx.fillStyle = t.color;
      ctx.font = `600 ${t.size}px ${FONT}`;
      ctx.fillText(t.text, t.x, t.y);
    }
    ctx.globalAlpha = 1;
  }
}
