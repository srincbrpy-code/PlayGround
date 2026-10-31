import { clamp, damp, lerp, easeOutCubic, easeInOutCubic, easeOutQuint } from './utils.js';

export const GRAVITY = 2500;
export const MAX_HP = 100;
export const MAX_POWER = 100;
export const POWER_TIME = 7;

export const ATTACKS = {
  light: {
    name: 'light',
    startup: 0.085,
    active: 0.07,
    recover: 0.19,
    range: 128,
    dmg: 9,
    chip: 2,
    kb: 235,
    stun: 0.24,
    meter: 7,
    lunge: 10,
    lift: 0,
  },
  heavy: {
    name: 'heavy',
    startup: 0.25,
    active: 0.095,
    recover: 0.4,
    range: 174,
    dmg: 22,
    chip: 9,
    kb: 560,
    stun: 0.48,
    meter: 13,
    lunge: 20,
    lift: -150,
  },
  air: {
    name: 'air',
    startup: 0.09,
    active: 0.13,
    recover: 0.18,
    range: 142,
    dmg: 11,
    chip: 2,
    kb: 300,
    stun: 0.3,
    meter: 8,
    lunge: 8,
    lift: -80,
  },
};

const BASE = {
  lean: 0.03,
  head: 0,
  crouch: 2,
  armF: [0.24, 0.22],
  armB: [-0.2, 0.1],
  legF: [0.17, -0.05],
  legB: [-0.19, -0.07],
};

export function clonePose(p) {
  return {
    lean: p.lean,
    head: p.head,
    crouch: p.crouch,
    armF: [p.armF[0], p.armF[1]],
    armB: [p.armB[0], p.armB[1]],
    legF: [p.legF[0], p.legF[1]],
    legB: [p.legB[0], p.legB[1]],
  };
}

function pose(p) {
  return clonePose({ ...BASE, ...p });
}

export function lerpPose(a, b, t) {
  return {
    lean: lerp(a.lean, b.lean, t),
    head: lerp(a.head, b.head, t),
    crouch: lerp(a.crouch, b.crouch, t),
    armF: [lerp(a.armF[0], b.armF[0], t), lerp(a.armF[1], b.armF[1], t)],
    armB: [lerp(a.armB[0], b.armB[0], t), lerp(a.armB[1], b.armB[1], t)],
    legF: [lerp(a.legF[0], b.legF[0], t), lerp(a.legF[1], b.legF[1], t)],
    legB: [lerp(a.legB[0], b.legB[0], t), lerp(a.legB[1], b.legB[1], t)],
  };
}

const P = {
  idle: pose({}),
  run: pose({
    lean: 0.16,
    crouch: 4,
    armF: [0.7, 0.55],
    armB: [-0.7, 0.5],
    legF: [0.55, -0.25],
    legB: [-0.55, -0.8],
  }),
  block: pose({
    lean: -0.07,
    head: -0.05,
    crouch: 8,
    armF: [1.2, -2.0],
    armB: [0.82, -1.72],
    legF: [0.38, -0.16],
    legB: [-0.42, -0.26],
  }),
  jump: pose({
    lean: 0.05,
    crouch: 0,
    armF: [2.35, -0.45],
    armB: [-2.25, 0.4],
    legF: [0.62, -0.9],
    legB: [-0.4, -1.25],
  }),
  fall: pose({
    lean: 0.1,
    crouch: 0,
    armF: [1.9, 0.15],
    armB: [-1.8, -0.1],
    legF: [0.32, -0.3],
    legB: [-0.38, -0.45],
  }),
  hit: pose({
    lean: -0.34,
    head: -0.22,
    crouch: 7,
    armF: [1.55, 0.7],
    armB: [-1.45, 0.62],
    legF: [0.3, -0.22],
    legB: [-0.44, -0.45],
  }),
  stagger: pose({
    lean: -0.22,
    head: -0.14,
    crouch: 10,
    armF: [1.9, 0.25],
    armB: [-1.9, -0.2],
    legF: [0.42, -0.3],
    legB: [-0.5, -0.42],
  }),
  victory: pose({
    lean: 0.02,
    head: -0.04,
    crouch: 1,
    armF: [2.65, -0.35],
    armB: [-2.6, 0.35],
    legF: [0.24, -0.1],
    legB: [-0.26, -0.12],
  }),
  ko: pose({
    lean: 0.05,
    head: 0.1,
    crouch: 4,
    armF: [2.75, 0.25],
    armB: [-2.7, -0.25],
    legF: [0.38, -0.35],
    legB: [-0.5, -0.25],
  }),
  lightWind: pose({
    lean: -0.12,
    head: -0.05,
    crouch: 4,
    armF: [0.62, -2.32],
    armB: [-0.88, 0.62],
    legF: [0.24, -0.1],
    legB: [-0.4, -0.28],
  }),
  lightHit: pose({
    lean: 0.3,
    head: 0.06,
    crouch: 1,
    armF: [1.58, 0.02],
    armB: [-1.25, 0.85],
    legF: [0.56, -0.12],
    legB: [-0.62, -0.22],
  }),
  heavyWind: pose({
    lean: -0.24,
    head: -0.1,
    crouch: 10,
    armF: [0.42, -2.7],
    armB: [-1.3, 0.92],
    legF: [0.32, -0.22],
    legB: [-0.58, -0.42],
  }),
  heavyHit: pose({
    lean: 0.44,
    head: 0.12,
    crouch: 0,
    armF: [1.72, -0.06],
    armB: [-1.92, 1.2],
    legF: [0.78, -0.16],
    legB: [-0.78, -0.16],
  }),
  airHit: pose({
    lean: 0.22,
    head: 0.05,
    crouch: 0,
    armF: [1.5, 0.1],
    armB: [-1.6, 0.4],
    legF: [1.28, -0.2],
    legB: [-0.4, -1.0],
  }),
};

export class Fighter {
  constructor({ player = false, name = 'FIGHTER' } = {}) {
    this.player = player;
    this.name = name;
    this.maxHp = MAX_HP;
    this.pose = clonePose(P.idle);
    this.trail = [];
    this.control = this.emptyControl();
    this.resetRound(0, 0, 1);
    this.stats = { hits: 0, parries: 0, damage: 0, maxCombo: 0 };
  }

  emptyControl() {
    return { move: 0, guard: false, jump: false, strike: false, heavy: false, power: false, dash: 0 };
  }

  resetRound(x, ground, facing) {
    this.x = x;
    this.y = ground;
    this.ground = ground;
    this.vx = 0;
    this.vy = 0;
    this.onGround = true;
    this.facing = facing;
    this.hp = this.maxHp;
    this.power = 0;
    this.powerTime = 0;
    this.attack = null;
    this.hitstun = 0;
    this.stun = 0;
    this.invuln = 0;
    this.blocking = false;
    this.blockTime = 0;
    this.dashTime = 0;
    this.dashCd = 0;
    this.dashDir = 1;
    this.buf = { strike: 0, heavy: 0, jump: 0, power: 0, dash: 0 };
    this.combo = 0;
    this.comboTimer = 0;
    this.animTime = Math.random() * 5;
    this.runPhase = Math.random() * 6;
    this.stepTimer = 0;
    this.koT = 0;
    this.victory = false;
    this.lunge = 0;
    this.hitFlash = 0;
    this.powerFlash = 0;
    this.trail = [];
    this.trailTimer = 0;
    this.pose = clonePose(P.idle);
    this.control = this.emptyControl();
  }

  get alive() {
    return this.hp > 0;
  }

  get canAct() {
    return this.alive && this.hitstun <= 0 && this.stun <= 0;
  }

  get inPower() {
    return this.powerTime > 0;
  }

  update(dt, game, foe) {
    this.animTime += dt;
    this.hitFlash = Math.max(0, this.hitFlash - dt * 6);
    this.powerFlash = Math.max(0, this.powerFlash - dt * 3);
    this.comboTimer = Math.max(0, this.comboTimer - dt);
    if (this.comboTimer <= 0) this.combo = 0;

    if (this.powerTime > 0) {
      this.powerTime = Math.max(0, this.powerTime - dt);
      if (this.powerTime === 0) this.powerFlash = 0.4;
    }

    this.invuln = Math.max(0, this.invuln - dt);
    this.dashCd = Math.max(0, this.dashCd - dt);
    this.hitstun = Math.max(0, this.hitstun - dt);
    this.stun = Math.max(0, this.stun - dt);
    if (!this.attack) this.lunge = damp(this.lunge, 0, 18, dt);
    for (const key of Object.keys(this.buf)) this.buf[key] = Math.max(0, this.buf[key] - dt);

    if (this.hp <= 0) {
      this.koT += dt;
      this.blocking = false;
      this.attack = null;
      this.applyPhysics(dt, game);
      this.updatePose(dt, game, foe, true);
      this.updateTrail(dt);
      return;
    }

    const active = game.state === 'fight';

    if (this.victory) {
      this.blocking = false;
      this.attack = null;
      this.vx = damp(this.vx, 0, 8, dt);
      this.applyPhysics(dt, game);
      this.updatePose(dt, game, foe, false);
      this.updateTrail(dt);
      return;
    }

    if (!active) {
      this.blocking = false;
      this.attack = null;
      this.vx = damp(this.vx, 0, 9, dt);
      this.applyPhysics(dt, game);
      this.updatePose(dt, game, foe, false);
      this.updateTrail(dt);
      return;
    }

    const c = this.control;
    if (c.jump) this.buf.jump = 0.14;
    if (c.strike) this.buf.strike = 0.17;
    if (c.heavy) this.buf.heavy = 0.17;
    if (c.power) this.buf.power = 0.2;
    if (c.dash) {
      this.buf.dash = 0.16;
      this.dashDir = c.dash;
    }

    // Face the rival whenever we are free to do so.
    if (this.canAct && !this.attack && this.dashTime <= 0) {
      this.facing = foe.x >= this.x ? 1 : -1;
    }

    if (!this.canAct) {
      this.blocking = false;
      this.attack = null;
      this.vx = damp(this.vx, 0, 2.6, dt);
      this.applyPhysics(dt, game);
      this.updatePose(dt, game, foe, false);
      this.updateTrail(dt);
      return;
    }

    if (this.attack) {
      this.updateAttack(dt, game, foe);
    }

    if (!this.attack) {
      if (this.buf.power > 0 && this.power >= MAX_POWER && !this.inPower) {
        this.buf.power = 0;
        this.activatePower(game, foe);
      } else if (this.buf.jump > 0 && this.onGround) {
        this.buf.jump = 0;
        this.vy = -835;
        this.onGround = false;
        this.blocking = false;
        this.spawnDust(game, 5, -this.facing);
        game.sfx.jump();
      } else if (this.buf.dash > 0 && this.dashCd <= 0) {
        this.buf.dash = 0;
        this.dashTime = 0.15;
        this.dashCd = 0.52;
        this.blocking = false;
        game.sfx.whoosh(false);
      } else if (this.buf.strike > 0) {
        this.buf.strike = 0;
        this.startAttack('light', game);
      } else if (this.buf.heavy > 0) {
        this.buf.heavy = 0;
        this.startAttack('heavy', game);
      }
    } else if (
      this.attack.hasHit &&
      this.attack.type === 'light' &&
      this.attack.chain < 2 &&
      this.attack.t > this.attack.def.startup + this.attack.def.active &&
      this.buf.strike > 0
    ) {
      this.buf.strike = 0;
      const nextChain = this.attack.chain + 1;
      this.attack = null;
      this.startAttack('light', game, nextChain);
    }

    this.blocking = !!(c.guard && this.onGround && !this.attack && this.hitstun <= 0 && this.stun <= 0);
    if (this.blocking) {
      this.blockTime += dt;
    } else {
      this.blockTime = 0;
    }

    if (this.dashTime > 0) {
      this.dashTime = Math.max(0, this.dashTime - dt);
      this.vx = this.dashDir * (this.inPower ? 1080 : 920);
      if (this.dashTime === 0) this.vx *= 0.35;
    } else {
      const dir = this.blocking ? 0 : c.move;
      const speedBase = this.inPower ? 388 : 330;
      const speed = speedBase * (this.blocking ? 0.34 : 1) * (this.onGround ? 1 : 0.72);
      const target = dir * speed;
      const lambda = this.onGround ? (dir !== 0 ? 17 : 11) : 3.2;
      this.vx = damp(this.vx, target, lambda, dt);
      if (Math.abs(this.vx) > 8 && this.onGround) {
        this.runPhase += Math.abs(this.vx) * dt * 0.028;
        this.stepTimer -= dt;
        if (this.stepTimer <= 0) {
          this.stepTimer = 0.27;
          if (Math.abs(this.vx) > 80) {
            this.spawnDust(game, 1, -this.facing);
            game.sfx.step();
          }
        }
      }
    }

    this.applyPhysics(dt, game);
    this.updatePose(dt, game, foe, false);
    this.updateTrail(dt);
  }

  updateAttack(dt, game, foe) {
    const a = this.attack;
    if (!a) return;
    const d = a.def;
    const before = a.t;
    a.t += dt;

    if (!a.whooshed && a.t >= d.startup) {
      a.whooshed = true;
      game.sfx.whoosh(a.type === 'heavy');
    }

    if (!a.hasHit && a.t >= d.startup && a.t <= d.startup + d.active + 0.02) {
      game.resolveHit(this, foe);
    }

    if (a.t >= d.startup + d.active + d.recover) {
      this.attack = null;
    }
    if (a.t > before && a.t >= d.startup && a.t <= d.startup + d.active) {
      const k = (a.t - d.startup) / Math.max(0.001, d.active);
      this.lunge = Math.sin(Math.PI * clamp(k, 0, 1)) * d.lunge * this.facing;
    } else {
      this.lunge = damp(this.lunge, 0, 18, dt);
    }
  }

  startAttack(type, game, chain = 0) {
    if (!this.canAct) return false;
    if (this.attack) return false;
    if (!this.onGround && type !== 'heavy') type = 'air';
    if (!this.onGround && type === 'heavy') type = 'air';
    const def = ATTACKS[type];
    this.attack = { type, def, t: 0, hasHit: false, whooshed: false, chain };
    this.blocking = false;
    this.lunge = 0;
    return true;
  }

  activatePower(game, foe) {
    if (this.power < MAX_POWER || this.inPower) return false;
    this.power = 0;
    this.powerTime = POWER_TIME;
    this.invuln = 0.38;
    this.powerFlash = 1;
    this.blocking = false;
    game.sfx.power();
    game.spawnPowerBurst(this);
    game.shake(9);
    game.flash('#ff3b30', 0.18);
    game.hitstop(0.06);
    if (foe && Math.abs(foe.x - this.x) < 190) {
      const dir = foe.x >= this.x ? 1 : -1;
      foe.vx = dir * 420;
      foe.vy = -180;
      foe.onGround = false;
      foe.hitstun = Math.max(foe.hitstun, 0.22);
      foe.hp = Math.max(1, foe.hp - 4);
      foe.power = clamp(foe.power + 4, 0, MAX_POWER);
      game.spawnHit(foe.x, foe.y - 100, '#ff3b30', 1.4);
    }
    game.floatText(this.x, this.y - 220, 'POWER', '#ff3b30', 28, 0.9);
    return true;
  }

  applyPhysics(dt, game) {
    if (!this.onGround) this.vy += GRAVITY * dt;
    this.y += this.vy * dt;

    if (this.y >= this.ground) {
      const impact = this.vy;
      if (!this.onGround && impact > 240) {
        this.spawnDust(game, impact > 700 ? 10 : 5, 0);
        game.sfx.land();
        game.shake(impact > 700 ? 3 : 1.5);
      }
      this.y = this.ground;
      this.vy = 0;
      this.onGround = true;
    } else {
      this.onGround = false;
    }

    this.x += this.vx * dt;
    if (this.x < 58) {
      this.x = 58;
      this.vx = Math.max(0, this.vx);
    }
    if (this.x > game.world.w - 58) {
      this.x = game.world.w - 58;
      this.vx = Math.min(0, this.vx);
    }
  }

  spawnDust(game, count, dir) {
    if (game.spawnDust) game.spawnDust(this.x, this.ground - 4, count, dir);
  }

  updateTrail(dt) {
    for (const t of this.trail) t.life -= dt;
    this.trail = this.trail.filter((t) => t.life > 0);
    const wantsTrail = this.inPower || this.dashTime > 0;
    if (!wantsTrail) return;
    this.trailTimer -= dt;
    if (this.trailTimer <= 0) {
      this.trailTimer = this.dashTime > 0 ? 0.025 : 0.055;
      this.trail.push({
        x: this.x + this.lunge,
        y: this.y,
        facing: this.facing,
        pose: clonePose(this.pose),
        life: 0.28,
        maxLife: 0.28,
        dash: this.dashTime > 0,
      });
      if (this.trail.length > 9) this.trail.shift();
    }
  }

  updatePose(dt, game, foe, dead) {
    let target;
    if (dead) {
      target = P.ko;
    } else if (this.victory) {
      target = P.victory;
    } else if (this.stun > 0) {
      target = P.stagger;
    } else if (this.hitstun > 0) {
      target = P.hit;
    } else if (this.attack) {
      target = this.attackPose();
    } else if (this.blocking) {
      target = P.block;
    } else if (!this.onGround) {
      target = this.vy < 0 ? P.jump : P.fall;
    } else if (Math.abs(this.vx) > 55) {
      const s = Math.sin(this.runPhase);
      target = {
        lean: 0.16,
        head: -0.02,
        crouch: 3 + Math.abs(s) * 2.5,
        armF: [0.82 * s + 0.08, 0.55 + 0.22 * Math.cos(this.runPhase)],
        armB: [-0.82 * s - 0.08, 0.55 - 0.22 * Math.cos(this.runPhase)],
        legF: [0.72 * s, -0.16 - 0.72 * Math.max(0, -s)],
        legB: [-0.72 * s, -0.16 - 0.72 * Math.max(0, s)],
      };
    } else {
      const breathe = Math.sin(this.animTime * 2.1);
      const low = this.hp < 32 ? 1.7 : 1;
      target = {
        lean: 0.03 + breathe * 0.012 * low,
        head: breathe * 0.018,
        crouch: 2 + breathe * 1.3 * low,
        armF: [0.24 + breathe * 0.025, 0.22 + breathe * 0.02],
        armB: [-0.2 - breathe * 0.025, 0.1 - breathe * 0.02],
        legF: [0.17, -0.05],
        legB: [-0.19, -0.07],
      };
    }

    if (this.inPower && !dead) {
      target = { ...target, crouch: target.crouch + 1.5, lean: target.lean + 0.015 };
    }

    const rate = this.attack ? 34 : this.hitstun > 0 ? 26 : 15;
    const k = 1 - Math.exp(-rate * dt);
    this.pose.lean = lerp(this.pose.lean, target.lean, k);
    this.pose.head = lerp(this.pose.head, target.head, k);
    this.pose.crouch = lerp(this.pose.crouch, target.crouch, k);
    for (const key of ['armF', 'armB', 'legF', 'legB']) {
      this.pose[key][0] = lerp(this.pose[key][0], target[key][0], k);
      this.pose[key][1] = lerp(this.pose[key][1], target[key][1], k);
    }
  }

  attackPose() {
    const a = this.attack;
    const d = a.def;
    let wind;
    let hit;
    if (a.type === 'heavy') {
      wind = P.heavyWind;
      hit = P.heavyHit;
    } else if (a.type === 'air') {
      wind = P.lightWind;
      hit = P.airHit;
    } else {
      wind = P.lightWind;
      hit = P.lightHit;
    }
    if (a.t < d.startup) {
      return lerpPose(P.idle, wind, easeOutCubic(clamp(a.t / d.startup, 0, 1)));
    }
    if (a.t < d.startup + d.active) {
      return lerpPose(wind, hit, easeOutQuint(clamp((a.t - d.startup) / d.active, 0, 1)));
    }
    const k = clamp((a.t - d.startup - d.active) / d.recover, 0, 1);
    return lerpPose(hit, P.idle, easeInOutCubic(k));
  }
}
