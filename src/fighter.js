import {
  ARENA, PHYSICS, PARRY, DASH, ATTACKS, SPELLS, SPELL_ORDER, COMBO_WINDOW,
} from './config.js'

const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
const rand = (a, b) => a + Math.random() * (b - a)
const sign = v => (v >= 0 ? 1 : -1)

export class Fighter {
  constructor(options) {
    const {
      name = 'DUELIST', title = '', palette, x = 0, facing = 1,
      maxHp = 100, maxMana = 60, isPlayer = false,
      stats = null, stage = null, difficulty = null, spells = ['ember'],
    } = options
    this.name = name
    this.title = title
    this.palette = palette
    this.isPlayer = isPlayer
    this.stats = stats
    this.stage = stage
    this.difficulty = difficulty
    this.spells = spells.slice()
    this.x = x
    this.y = 0
    this.vx = 0
    this.vy = 0
    this.facing = facing
    this.grounded = true
    this.maxHp = maxHp
    this.hp = maxHp
    this.maxMana = maxMana
    this.mana = maxMana
    this.hpGhost = maxHp
    this.action = 'idle'
    this.actionT = 0
    this.actionDur = 0
    this.attackKind = null
    this.attackData = null
    this.attackHit = false
    this.comboStep = 0
    this.comboQueue = false
    this.comboTimer = 0
    this.parryActive = false
    this.parryCd = 0
    this.dashCd = 0
    this.spellCd = Object.fromEntries(SPELL_ORDER.map(id => [id, 0]))
    this.hurtT = 0
    this.staggerT = 0
    this.stunT = 0
    this.slowT = 0
    this.burnT = 0
    this.burnTick = 0.5
    this.invuln = 0
    this.flash = 0
    this.charge = 0
    this.animTime = 0
    this.seed = Math.random() * 10
    this.bladeTrail = []
    this.ghostTimer = 0
    this.dead = false
    this.deathT = 0
    this.enraged = false
    this.phase = 1
    this.damageMult = 1
    this.damageTaken = 1
    this.moveSpeed = PHYSICS.moveSpeed
    this.parryWindow = PARRY.active
    this.parryCooldown = PARRY.cooldown
    this.dashCooldown = DASH.cooldown
    this.siphon = 0
    this.castSpellId = null
    this.castColor = null
    this.castReleased = false
    this.ai = {
      timer: rand(0.2, 0.7), guardT: 0, reacted: false, parryDelay: 0, feint: 0, dashCd: 0,
    }
    this.lastHitBy = null
    this.comboHits = 0
    this.guardFlash = 0

    if (isPlayer && stats) {
      this.maxHp = stats.maxHp
      this.hp = stats.maxHp
      this.hpGhost = stats.maxHp
      this.maxMana = stats.maxMana
      this.mana = stats.maxMana
      this.parryWindow = stats.parryWindow
      this.parryCooldown = stats.parryCooldown
      this.dashCooldown = stats.dashCooldown
      this.moveSpeed = PHYSICS.moveSpeed * stats.speed
      this.damageMult = stats.melee
      this.spellPower = stats.arcane
      this.damageTaken = stats.resist
      this.siphon = stats.siphon
    } else if (stage) {
      const d = difficulty || { dmg: 1, hp: 1, reaction: 1, windup: 1, cooldown: 1 }
      this.maxHp = Math.round(stage.hp * d.hp)
      this.hp = this.maxHp
      this.hpGhost = this.maxHp
      this.maxMana = 100
      this.mana = 100
      this.moveSpeed = PHYSICS.moveSpeed * (stage.speed || 1)
      this.damageMult = (stage.dmg || 1) * d.dmg
      this.spellPower = 1 + (stage.boss ? 0.18 : 0)
      this.parryChance = (stage.parryChance + d.parryChance) / 2
      this.reaction = d.reaction
      this.windupScale = d.windup
      this.spellCooldownScale = d.cooldown
      this.aggression = stage.aggression * (0.6 + d.aggression * 0.7)
      this.preferred = stage.preferred || 36
    }
  }

  get hpRatio() { return Math.max(0, this.hp) / this.maxHp }
  get manaRatio() { return Math.max(0, this.mana) / this.maxMana }

  get busy() {
    return ['strike1', 'strike2', 'strike3', 'heavy', 'parry', 'cast', 'dash', 'hurt', 'stagger', 'dead'].includes(this.action)
  }

  get canMove() {
    return !this.dead && ['idle', 'run', 'jump', 'guard'].includes(this.action) && this.staggerT <= 0 && this.stunT <= 0
  }

  canAct() {
    if (this.dead || this.staggerT > 0 || this.stunT > 0) return false
    if (['strike1', 'strike2', 'strike3', 'heavy'].includes(this.action)) {
      const d = this.attackData
      return d && this.actionT >= d.windup + d.active * 0.7
    }
    return ['idle', 'run', 'jump', 'guard'].includes(this.action)
  }

  faceToward(other) {
    if (!other || this.busy) return
    if (Math.abs(other.x - this.x) > 1) this.facing = sign(other.x - this.x)
  }

  startStrike(step = 1) {
    const key = `light${clamp(step, 1, 3)}`
    const base = ATTACKS[key]
    this.attackKind = key
    this.attackData = this.scaleAttack(base)
    this.action = `strike${clamp(step, 1, 3)}`
    this.actionT = 0
    this.actionDur = this.attackData.windup + this.attackData.active + this.attackData.recover
    this.attackHit = false
    this.slashFxDone = false
    this.comboQueue = false
    this.comboStep = step
    this.vx += this.facing * (step === 3 ? 46 : 30)
    this.charge = 0.25
    return { type: 'swing', heavy: false }
  }

  startHeavy() {
    this.attackKind = 'heavy'
    this.attackData = this.scaleAttack(ATTACKS.heavy)
    this.action = 'heavy'
    this.actionT = 0
    this.actionDur = this.attackData.windup + this.attackData.active + this.attackData.recover
    this.attackHit = false
    this.slashFxDone = false
    this.comboQueue = false
    this.comboStep = 0
    this.vx += this.facing * 40
    this.charge = 0.5
    return { type: 'swingHeavy', heavy: true }
  }

  scaleAttack(base) {
    const copy = { ...base }
    if (!this.isPlayer) {
      copy.windup *= this.windupScale || 1
      copy.recover *= 0.92
    }
    return copy
  }

  tryStrike() {
    if (!this.canAct()) return null
    if (['strike1', 'strike2', 'strike3'].includes(this.action)) {
      if (this.comboStep < 3 && !this.comboQueue && this.actionT >= (this.attackData?.windup || 0) + 0.02) {
        this.comboQueue = true
        return { type: 'queue' }
      }
      return null
    }
    return this.startStrike(1)
  }

  tryHeavy() {
    if (!this.canAct()) return null
    if (['strike1', 'strike2', 'strike3'].includes(this.action)) return null
    return this.startHeavy()
  }

  tryParry() {
    if (!this.canAct() || this.parryCd > 0) return null
    this.action = 'parry'
    this.actionT = 0
    this.actionDur = this.parryWindow + 0.26
    this.parryActive = true
    this.parryCd = this.parryCooldown
    this.vx *= 0.3
    return { type: 'parry' }
  }

  tryDash(axis = 0) {
    if (!this.canAct() || this.dashCd > 0 || !this.grounded) return null
    const dir = axis || this.facing
    this.facing = dir
    this.action = 'dash'
    this.actionT = 0
    this.actionDur = DASH.duration
    this.dashCd = this.dashCooldown
    this.vx = dir * DASH.speed
    this.vy = 0
    this.invuln = Math.max(this.invuln, DASH.iframes)
    this.ghostTimer = 0
    return { type: 'dash', dir }
  }

  tryCast(id, game) {
    if (this.dead) return null
    if (!SPELLS[id]) return null
    if (!this.spells.includes(id)) {
      if (this.isPlayer) game?.notice(`${SPELLS[id].name} unlocks at stage ${SPELLS[id].unlockStage}`, 'locked')
      return null
    }
    if (this.spellCd[id] > 0) return null
    if (this.isPlayer && this.mana < SPELLS[id].cost) {
      game?.notice('NOT ENOUGH MANA', 'mana')
      return null
    }
    if (!this.canAct()) return null
    if (!this.isPlayer) {
      if (this.spellCd[id] > 0) return null
    }
    this.action = 'cast'
    this.actionT = 0
    this.actionDur = 0.56
    this.castSpellId = id
    this.castReleased = false
    this.castColor = SPELLS[id].glow
    this.spellCd[id] = SPELLS[id].cooldown * (this.isPlayer ? 1 : this.spellCooldownScale || 1) * (this.enraged ? 0.7 : 1)
    if (this.isPlayer) this.mana -= SPELLS[id].cost
    this.vx *= 0.25
    return { type: 'castStart', spell: id }
  }

  releaseCast(game) {
    if (this.castReleased || !this.castSpellId) return
    this.castReleased = true
    game.castSpell(this, this.castSpellId)
  }

  isParryingFrom(attacker) {
    if (!this.parryActive) return false
    if (this.action !== 'parry') return false
    if (!attacker) return true
    const dir = sign(attacker.x - this.x)
    return dir === this.facing || Math.abs(attacker.x - this.x) < 4
  }

  onParry(attacker, game) {
    this.mana = Math.min(this.maxMana, this.mana + PARRY.manaGain)
    if (this.siphon > 0) {
      this.hp = Math.min(this.maxHp, this.hp + this.siphon)
      game?.fx.text(this.x, -40, `+${this.siphon}`, '#7cf7c4', { size: 8, life: 0.8 })
    }
    if (attacker) {
      attacker.staggerT = PARRY.stagger
      attacker.action = 'stagger'
      attacker.actionT = 0
      attacker.actionDur = PARRY.stagger
      attacker.vx = sign(attacker.x - this.x) * 80
      attacker.parryActive = false
      attacker.comboStep = 0
    }
  }

  takeHit(data, attacker, game) {
    if (this.dead) return 'dead'
    if (this.invuln > 0) return 'miss'
    const fromFront = attacker ? sign(attacker.x - this.x) === this.facing : true

    if (this.isParryingFrom(attacker)) {
      this.onParry(attacker, game)
      return 'parry'
    }

    if (this.action === 'guard' && fromFront) {
      if (data.guardBreak) {
        const dmg = data.dmg * attacker.damageMult * this.damageTaken * 0.55
        this.applyDamage(dmg, attacker)
        this.staggerT = 0.95
        this.action = 'stagger'
        this.actionT = 0
        this.actionDur = 0.95
        this.vx = sign(this.x - attacker.x) * 150
        this.action = 'stagger'
        return 'guardBreak'
      }
      const dmg = data.dmg * attacker.damageMult * this.damageTaken * 0.2
      this.applyDamage(dmg, attacker)
      this.vx = sign(this.x - attacker.x) * 35
      this.guardFlash = 0.18
      this.mana = Math.min(this.maxMana, this.mana + 3)
      return 'guard'
    }

    const variance = rand(0.94, 1.06)
    const dmg = data.dmg * attacker.damageMult * this.damageTaken * variance * (this.staggerT > 0 ? 1.2 : 1)
    this.applyDamage(dmg, attacker)
    this.flash = 0.14
    this.invuln = 0.09
    this.action = 'hurt'
    this.actionT = 0
    this.actionDur = data.dmg > 14 ? 0.38 : 0.26
    this.vx = sign(this.x - attacker.x) * (data.kb || 70)
    this.vy = Math.min(this.vy, -40)
    this.grounded = false
    this.parryActive = false
    this.comboStep = 0
    this.castReleased = true
    return 'hit'
  }

  applyDamage(amount, attacker) {
    const dmg = Math.max(0.5, amount)
    this.hp = Math.max(0, this.hp - dmg)
    this.lastHitBy = attacker
    this.hitFlashAmount = dmg
    if (this.hp <= 0) this.die()
    return dmg
  }

  die() {
    if (this.dead) return
    this.dead = true
    this.action = 'dead'
    this.actionT = 0
    this.actionDur = 1.2
    this.vx = -this.facing * 40
    this.vy = -120
    this.grounded = false
    this.parryActive = false
  }

  update(dt, ctrl, game) {
    if (this.dead) {
      this.animTime += dt
      this.deathT += dt
      this.updatePhysics(dt, 0, true)
      return
    }
    this.animTime += dt
    this.flash = Math.max(0, this.flash - dt)
    this.invuln = Math.max(0, this.invuln - dt)
    this.parryCd = Math.max(0, this.parryCd - dt)
    this.dashCd = Math.max(0, this.dashCd - dt)
    this.guardFlash = Math.max(0, this.guardFlash - dt)
    this.charge = Math.max(0, this.charge - dt * 2.5)
    this.comboTimer = Math.max(0, this.comboTimer - dt)
    this.hpGhost += (this.hp - this.hpGhost) * Math.min(1, dt * 4.5)
    for (const id of Object.keys(this.spellCd)) this.spellCd[id] = Math.max(0, this.spellCd[id] - dt)

    if (this.slowT > 0) this.slowT = Math.max(0, this.slowT - dt)
    if (this.burnT > 0) {
      this.burnT -= dt
      this.burnTick -= dt
      if (this.burnTick <= 0) {
        this.burnTick = 0.45
        this.applyDamage(1.4, this.lastHitBy)
        game?.fx.burst(this.x, rand(-24, -6), { count: 3, colors: ['#ff8a3c', '#ffd08a'], speed: 18, gravity: -45, life: 0.5, size: 1.4 })
        game?.fx.text(this.x + rand(-8, 8), -34, '1', '#ff9a3c', { size: 6, life: 0.5 })
      }
    }
    if (this.staggerT > 0) this.staggerT = Math.max(0, this.staggerT - dt)
    if (this.stunT > 0) this.stunT = Math.max(0, this.stunT - dt)

    if (this.isPlayer) {
      this.mana = Math.min(this.maxMana, this.mana + (3.4 + (this.dead ? 0 : 0.6)) * dt)
    }

    // action lifecycle
    this.actionT += dt
    this.parryActive = this.action === 'parry' && this.actionT < this.parryWindow
    if (this.action === 'cast' && !this.castReleased && this.actionT >= 0.32) {
      this.releaseCast(game)
    }
    if (this.staggerT > 0 && this.action !== 'stagger') {
      this.action = 'stagger'
      this.actionT = 0
      this.actionDur = this.staggerT
    }
    if (this.stunT > 0 && this.action !== 'stagger') {
      // stunned: brief flinch, still can be hit
      if (!this.busy) {
        this.action = 'hurt'
        this.actionT = 0
        this.actionDur = this.stunT
      }
    }

    if (['strike1', 'strike2', 'strike3', 'heavy'].includes(this.action)) {
      if (ctrl.strike) this.tryStrike()
      this.updateAttack(dt, game)
      this.updatePhysics(dt, 0, true)
      return
    }
    if (this.action === 'parry') {
      if (this.actionT >= this.actionDur) {
        this.action = 'idle'
        this.parryActive = false
      }
      this.updatePhysics(dt, 0, true)
      return
    }
    if (this.action === 'cast') {
      if (this.actionT >= this.actionDur) this.action = 'idle'
      this.updatePhysics(dt, 0, true)
      return
    }
    if (this.action === 'dash') {
      if (this.actionT >= this.actionDur) {
        this.action = 'idle'
        this.vx *= 0.3
      }
      this.ghostTimer -= dt
      if (this.ghostTimer <= 0 && game) {
        this.ghostTimer = 0.025
        game.pushGhost(this)
      }
      this.updatePhysics(dt, 0, true)
      return
    }
    if (this.action === 'hurt' || this.action === 'stagger') {
      if (this.actionT >= this.actionDur) {
        this.action = 'idle'
        this.vx *= 0.4
      }
      this.updatePhysics(dt, 0, true)
      return
    }

    // free movement
    const axis = this.stunT > 0 ? 0 : ctrl.axis
    if (this.parryCd > 0) this.parryActive = false

    if (ctrl.parry && this.tryParry()) {
      game?.onAction(this, 'parry')
      this.updatePhysics(dt, 0, true)
      return
    }
    if (ctrl.dash) {
      const res = this.tryDash(axis)
      if (res) {
        game?.onAction(this, 'dash', res)
        this.updatePhysics(dt, 0, true)
        return
      }
    }
    if (ctrl.strike) {
      const res = this.tryStrike()
      if (res) {
        game?.onAction(this, res.type === 'queue' ? 'queue' : 'strike')
        if (res.type !== 'queue') this.updatePhysics(dt, 0, true)
        return
      }
    }
    if (ctrl.heavy) {
      const res = this.tryHeavy()
      if (res) {
        game?.onAction(this, 'heavy')
        this.updatePhysics(dt, 0, true)
        return
      }
    }
    if (ctrl.spell) {
      const res = this.tryCast(ctrl.spell, game)
      if (res) {
        game?.onAction(this, 'cast', res)
        this.updatePhysics(dt, 0, true)
        return
      }
    }
    if (ctrl.jump && this.grounded && this.canMove) {
      this.vy = PHYSICS.jumpVel
      this.grounded = false
      this.action = 'jump'
      game?.onAction(this, 'jump')
    }

    if (ctrl.guard && this.grounded && this.canMove && !ctrl.jump) {
      this.action = 'guard'
      this.vx *= 0.6
      this.updatePhysics(dt, 0, true)
      return
    }
    if (this.action === 'guard' && !ctrl.guard) this.action = 'idle'

    if (this.grounded) {
      if (axis !== 0) {
        this.vx += axis * PHYSICS.groundAccel * dt
        this.vx = clamp(this.vx, -this.moveSpeed, this.moveSpeed)
        this.action = 'run'
        this.facing = axis
      } else {
        this.vx -= this.vx * Math.min(1, PHYSICS.friction * dt / Math.max(1, Math.abs(this.vx) + 30))
        if (Math.abs(this.vx) < 3) this.vx = 0
        this.action = 'idle'
      }
    } else {
      if (axis !== 0) this.vx += axis * PHYSICS.airAccel * dt
      this.vx = clamp(this.vx, -this.moveSpeed * 1.25, this.moveSpeed * 1.25)
    }
    this.updatePhysics(dt, axis, false)
  }

  updateAttack(dt, game) {
    const d = this.attackData
    if (!d) { this.action = 'idle'; return }
    // active hit sampling is handled by game; here only pose/queue
    if (this.actionT >= this.actionDur) {
      if (this.comboQueue && this.comboStep > 0 && this.comboStep < 3) {
        this.startStrike(this.comboStep + 1)
        game?.onAction(this, 'strike')
      } else {
        this.action = 'idle'
        this.comboTimer = COMBO_WINDOW
        this.comboStep = 0
        this.comboQueue = false
        this.charge = 0
      }
    }
  }

  updatePhysics(dt, axis, locked) {
    if (!this.grounded) {
      this.vy = Math.min(PHYSICS.maxFall, this.vy + PHYSICS.gravity * dt)
      this.y += this.vy * dt
      if (this.y >= 0) {
        this.y = 0
        this.vy = 0
        this.grounded = true
        this.action = this.action === 'jump' ? 'idle' : this.action
        this.onLand?.()
      }
    }
    if (locked) {
      if (this.grounded && this.action !== 'dash') {
        this.vx -= this.vx * Math.min(1, dt * 7)
      }
    }
    this.x += this.vx * dt
    if (this.x < ARENA.minX) { this.x = ARENA.minX; this.vx = Math.max(0, this.vx) }
    if (this.x > ARENA.maxX) { this.x = ARENA.maxX; this.vx = Math.min(0, this.vx) }
  }

  // ------------------------------------------------------------- enemy AI
  updateAI(dt, game) {
    if (this.dead) return { axis: 0 }
    const player = game.player
    if (!player) return { axis: 0 }
    const dx = player.x - this.x
    const dist = Math.abs(dx)
    if (!this.busy) this.facing = sign(dx)

    this.ai.timer -= dt
    this.ai.guardT = Math.max(0, this.ai.guardT - dt)

    // parry reaction to telegraphed swings
    const playerSwing = player.action.startsWith('strike') || player.action === 'heavy'
    if (playerSwing && player.attackData && dist < 58 && this.grounded && this.parryCd <= 0) {
      const windupLeft = player.attackData.windup - player.actionT
      if (windupLeft > 0 && !this.ai.reacted) {
        this.ai.reacted = true
        this.ai.parryDelay = Math.max(0.02, 0.07 * this.reaction + rand(0, 0.05))
      }
    }
    if (this.ai.reacted) {
      this.ai.parryDelay -= dt
      if (this.ai.parryDelay <= 0) {
        this.ai.reacted = false
        const chance = (this.parryChance || 0.1) * (this.enraged ? 1.2 : 1)
        if (Math.random() < chance && dist < 62 && this.canAct()) {
          const res = this.tryParry()
          if (res) {
            game.onAction(this, 'parry')
            return { axis: 0 }
          }
        }
      }
      if (!playerSwing) this.ai.reacted = false
    }

    // react to projectiles by parrying / dashing
    if (this.parryCd <= 0 && this.canAct()) {
      for (const p of game.projectiles) {
        if (p.owner === this) continue
        const towards = sign(p.x - this.x) === sign(-p.vx) && Math.abs(p.x - this.x) < 54
        if (!towards) continue
        if (Math.random() < 0.035 * (this.reaction ? 1 / this.reaction : 1)) {
          const res = this.tryParry()
          if (res) { game.onAction(this, 'parry'); return { axis: 0 } }
        }
        if (this.dashCd <= 0 && Math.abs(p.x - this.x) < 26 && Math.random() < 0.05) {
          const res = this.tryDash(-sign(p.vx))
          if (res) { game.onAction(this, 'dash', res); return { axis: 0 } }
        }
      }
    }

    if (!this.canAct()) return { axis: 0, guard: this.ai.guardT > 0 }

    // choice
    if (this.ai.timer <= 0) {
      this.ai.timer = (0.22 + Math.random() * 0.38) * (this.reaction || 1)
      if (dist < 50) {
        const roll = Math.random()
        if (roll < this.aggression) {
          if (Math.random() < 0.22) {
            const res = this.tryHeavy()
            if (res) { game.onAction(this, 'heavy'); return { axis: 0 } }
          } else {
            const res = this.tryStrike()
            if (res) { game.onAction(this, 'strike'); return { axis: 0 } }
          }
        } else if (roll < this.aggression + 0.18) {
          this.ai.guardT = 0.25 + Math.random() * 0.4
          return { axis: 0, guard: true }
        } else if (roll < this.aggression + 0.42) {
          const res = this.tryParry()
          if (res) { game.onAction(this, 'parry'); return { axis: 0 } }
        }
      } else if (dist > 56) {
        if (this.spells.length && Math.random() < 0.5) {
          const ready = this.spells.filter(id => this.spellCd[id] <= 0)
          if (ready.length) {
            const id = ready[Math.floor(Math.random() * ready.length)]
            const res = this.tryCast(id, game)
            if (res) { game.onAction(this, 'cast', res); return { axis: 0 } }
          }
        }
        if (dist > 105 && this.dashCd <= 0 && Math.random() < 0.32) {
          const res = this.tryDash(sign(dx))
          if (res) { game.onAction(this, 'dash', res); return { axis: 0 } }
        }
      }
    }

    let axis = 0
    if (this.ai.guardT > 0) {
      return { axis: 0, guard: true }
    }
    if (dist > this.preferred + 7) axis = sign(dx)
    else if (dist < this.preferred - 22) axis = -sign(dx)
    else if (Math.random() < 0.008) axis = -sign(dx)
    return { axis, guard: false }
  }

  snapshot() {
    return {
      x: this.x, y: this.y, facing: this.facing, vx: this.vx, vy: this.vy,
      grounded: this.grounded, action: this.action, actionT: this.actionT,
      actionDur: this.actionDur, animTime: this.animTime, flash: 0,
      slowT: this.slowT, enraged: false, parryActive: this.parryActive,
      palette: this.palette, seed: this.seed, dead: false,
      pose: null,
    }
  }
}
