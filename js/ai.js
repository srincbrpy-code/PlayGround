import { clamp, rand } from './utils.js';

// A deliberately readable but merciless duelist:
// it reacts late enough to be fair, punishes whiffs, and respects the corner.
export class AI {
  constructor(self) {
    this.self = self;
    this.reset();
  }

  reset() {
    this.decisionTimer = 0;
    this.reacted = false;
    this.seenAttack = null;
    this.reactAt = 0.08;
    this.guardTimer = 0;
    this.guardBreak = 0;
    this.move = 0;
    this.queued = { strike: false, heavy: false, jump: false, power: false, dash: 0 };
    this.playerGuardTime = 0;
    this.time = 0;
    this.reaction = 0.065;
    this.parryChance = 0.2;
    this.blockChance = 0.48;
    this.aggression = 0.62;
  }

  update(dt, foe, game) {
    const c = this.self.emptyControl();
    if (game.state !== 'fight' || !this.self.alive || !foe.alive) {
      this.queued = { strike: false, heavy: false, jump: false, power: false, dash: 0 };
      this.self.control = c;
      return c;
    }

    this.time += dt;
    this.decisionTimer -= dt;
    this.guardTimer = Math.max(0, this.guardTimer - dt);
    this.guardBreak = Math.max(0, this.guardBreak - dt);
    if (foe.blocking) this.playerGuardTime += dt;
    else this.playerGuardTime = Math.max(0, this.playerGuardTime - dt * 0.4);

    const dx = foe.x - this.self.x;
    const dist = Math.abs(dx);
    const toward = dx >= 0 ? 1 : -1;
    const wall = 96;
    const nearWall = this.self.x < wall || this.self.x > game.world.w - wall;

    // React to the start of an attack, but only after a human-ish delay.
    if (foe.attack && this.seenAttack !== foe.attack) {
      this.seenAttack = foe.attack;
      this.reactAt = rand(this.reaction, this.reaction + 0.075);
      this.reacted = false;
    }
    if (!foe.attack) {
      this.seenAttack = null;
      this.reacted = false;
    }

    if (foe.attack && !this.reacted && foe.attack.t >= this.reactAt) {
      const def = foe.attack.def;
      const timeToImpact = def.startup - foe.attack.t;
      if (timeToImpact > 0 && timeToImpact < 0.13 && dist < def.range + 76) {
        this.reacted = true;
        const roll = Math.random();
        if (roll < this.parryChance) {
          this.guardTimer = Math.max(this.guardTimer, timeToImpact + 0.06);
          this.guardBreak = 0.035;
        } else if (roll < this.parryChance + this.blockChance) {
          this.guardTimer = Math.max(this.guardTimer, timeToImpact + 0.2);
          this.guardBreak = 0.035;
        } else if (roll < 0.9 && !nearWall) {
          this.queued.dash = -toward;
          this.move = -toward;
        }
      }
    }

    // The CPU commits to a new idea a few times a second.
    if (this.decisionTimer <= 0) {
      this.decisionTimer = rand(0.075, 0.15);
      this.choose(foe, game, dist, toward, nearWall);
    }

    // Spacing: stay in striking distance, but not glued to the rival.
    c.move = this.move;
    if (this.guardTimer > 0 && this.guardBreak <= 0) c.guard = true;
    if (this.queued.strike) c.strike = true;
    if (this.queued.heavy) c.heavy = true;
    if (this.queued.jump) c.jump = true;
    if (this.queued.power) c.power = true;
    if (this.queued.dash) c.dash = this.queued.dash;
    this.queued = { strike: false, heavy: false, jump: false, power: false, dash: 0 };

    this.self.control = c;
    return c;
  }

  choose(foe, game, dist, toward, nearWall) {
    const self = this.self;
    this.move = 0;

    const canStrike = !self.attack && self.canAct;
    const chainReady =
      self.attack &&
      self.attack.type === 'light' &&
      self.attack.hasHit &&
      self.attack.chain < 2 &&
      self.attack.t > self.attack.def.startup + self.attack.def.active;

    // Finish the job.
    if (canStrike && self.power >= 100 && !self.inPower && dist < 235 && Math.random() < 0.62) {
      this.queued.power = true;
      return;
    }

    // Light chains keep the pressure honest.
    if (chainReady && Math.random() < 0.55) {
      this.queued.strike = true;
      return;
    }

    // Punish a whiffed attack with the heavy.
    if (
      canStrike &&
      foe.attack &&
      foe.attack.t > foe.attack.def.startup + foe.attack.def.active &&
      dist < foe.attack.def.range + 54 &&
      Math.random() < 0.72
    ) {
      this.queued.heavy = true;
      this.move = toward;
      return;
    }

    // Punish hitstun.
    if (canStrike && foe.hitstun > 0.08 && dist < 190) {
      if (Math.random() < 0.55) this.queued.heavy = true;
      else this.queued.strike = true;
      this.move = toward;
      return;
    }

    // Desperate defence.
    if (self.hp < 26 && dist < 135 && Math.random() < 0.38) {
      this.guardTimer = Math.max(this.guardTimer, 0.35);
      this.move = nearWall ? toward : -toward;
      return;
    }

    // Do not get cornered for free.
    if (nearWall && dist < 150 && Math.random() < 0.3) {
      this.queued.jump = true;
      this.move = toward;
      return;
    }

    // Rival powered up: create space.
    if (foe.inPower && dist < 175 && Math.random() < 0.45) {
      this.move = -toward;
      if (Math.random() < 0.4) this.queued.dash = -toward;
      return;
    }

    if (dist > 290) {
      this.move = toward;
      if (Math.random() < 0.18) this.queued.dash = toward;
      return;
    }

    if (dist > 168) {
      this.move = toward;
      if (foe.attack && Math.random() < 0.4) this.guardTimer = Math.max(this.guardTimer, 0.2);
      if (Math.random() < 0.1) this.queued.jump = true;
      return;
    }

    if (!canStrike) {
      // While recovering, reposition or guard rather than mash.
      if (Math.random() < 0.5) this.move = toward;
      else if (Math.random() < 0.3) this.move = -toward;
      return;
    }

    // In range: mix it up. Guarding players eat more heavy chip.
    const guardBias = clamp(this.playerGuardTime * 0.28, 0, 0.24);
    const roll = Math.random();
    if (roll < 0.46 - guardBias) {
      this.queued.strike = true;
      this.move = toward;
    } else if (roll < 0.62 + guardBias) {
      this.queued.heavy = true;
      this.move = toward;
    } else if (roll < 0.76) {
      this.guardTimer = Math.max(this.guardTimer, 0.22);
      this.move = Math.random() < 0.5 ? toward : 0;
    } else if (roll < 0.88) {
      this.move = -toward;
    } else {
      this.queued.jump = true;
      this.move = toward;
    }
  }
}
