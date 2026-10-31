import {
  ARENA, PHYSICS, SPELLS, PALETTES, DIFFICULTIES, stageFor, SPELL_ORDER, MAX_HP_TRAIL,
} from './config.js'
import { Fighter } from './fighter.js'
import { drawSky, drawPlatform, drawFighter, drawGhost, drawBladeTrail, drawVignette, drawConfetti, hexA } from './sprites.js'
import { FX } from './fx.js'

const TAU = Math.PI * 2
const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
const lerp = (a, b, t) => a + (b - a) * t
const rand = (a, b) => a + Math.random() * (b - a)
const sign = v => (v >= 0 ? 1 : -1)

export class Camera {
  constructor() {
    this.width = 480
    this.height = 300
    this.viewW = 440
    this.scale = 1.1
    this.x = 0
    this.groundScreen = 220
    this.groundFrac = 0.75
    this.shakeX = 0
    this.shakeY = 0
    this.punch = 0
    this.baseScale = 1.1
  }

  configure(width, height, viewW, groundFrac) {
    this.width = width
    this.height = height
    this.viewW = viewW
    this.groundFrac = groundFrac
    this.scale = width / viewW
    this.baseScale = this.scale
    this.groundScreen = height * groundFrac
  }

  X(x) { return (x - this.x) * this.scale + this.width / 2 + this.shakeX }
  Y(y) { return this.groundScreen + y * this.scale + this.shakeY }
  S(v) { return v * this.scale }

  clampX(x) {
    const half = this.viewW / 2
    const min = -ARENA.halfWidth + half - 12
    const max = ARENA.halfWidth - half + 12
    if (min > max) return 0
    return clamp(x, min, max)
  }
}

class Projectile {
  constructor({ owner, type, x, y, vx, vy, dmg, game }) {
    this.owner = owner
    this.type = type
    this.x = x
    this.y = y
    this.vx = vx
    this.vy = vy
    this.dmg = dmg
    this.radius = SPELLS[type]?.radius || 5
    this.life = 2.4
    this.dead = false
    this.color = SPELLS[type]?.color || '#ff8a3c'
    this.glow = SPELLS[type]?.glow || '#ffb35c'
    this.trail = 0
    this.reflected = false
    this.spin = 0
    this.game = game
  }

  update(dt, game) {
    if (this.dead) return
    this.life -= dt
    if (this.life <= 0) { this.dead = true; return }
    this.x += this.vx * dt
    this.y += this.vy * dt
    this.spin += dt * 14
    this.trail -= dt
    if (this.trail <= 0) {
      this.trail = 0.018
      const c = this.reflected ? this.owner.palette.trim : this.color
      game.fx.particle({
        x: this.x - this.vx * 0.01, y: this.y + rand(-1.5, 1.5),
        vx: -this.vx * 0.12 + rand(-12, 12), vy: rand(-18, 18),
        life: 0.32, size: 2.2, color: c, glow: true, drag: 2.6, gravity: -20,
      })
      game.fx.particle({
        x: this.x, y: this.y, vx: rand(-30, 30), vy: rand(-30, 10),
        life: 0.22, size: 1.2, color: '#ffffff', glow: true, drag: 2,
      })
    }
    if (this.y > 4) { this.dead = true; game.fx.burst(this.x, 0, { count: 8, colors: [this.color, '#ffffff'], speed: 70, life: 0.3, gravity: 150 }); return }

    const target = this.owner === game.player ? game.enemy : game.player
    if (!target || target.dead) return
    const dx = this.x - target.x
    const bodyTop = target.y - 34
    if (Math.abs(dx) < 10 + this.radius && this.y > bodyTop - 8 && this.y < target.y + 4) {
      if (target.parryActive && target.isParryingFrom(this.owner)) {
        game.resolveParry(target, this.owner, this)
        this.reflected = true
        this.owner = target
        this.vx *= -1.35
        this.vy = -18
        this.dmg *= 1.45
        this.color = target.palette.trim
        this.glow = target.palette.accent
        this.life = Math.max(this.life, 1.4)
        this.radius += 1
        return
      }
      const result = target.takeHit({
        dmg: this.dmg, kb: 95, guardBreak: false, hitstop: 0.06, shake: 0.28,
        name: 'SPELL',
      }, this.owner, game)
      game.resolveHitResult(this.owner, target, this.dmg, result, { spell: this.type, x: this.x, y: this.y })
      this.dead = true
      if (result === 'hit') {
        target.burnT = Math.max(target.burnT || 0, 1.5)
      }
    }
  }

  render(ctx, cam) {
    const x = cam.X(this.x)
    const y = cam.Y(this.y)
    const s = cam.scale
    const r = this.radius * s
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    const g = ctx.createRadialGradient(x, y, 0, x, y, r * 3.2)
    g.addColorStop(0, hexA(this.glow, 0.8))
    g.addColorStop(0.45, hexA(this.color, 0.35))
    g.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = g
    ctx.fillRect(x - r * 3.2, y - r * 3.2, r * 6.4, r * 6.4)
    ctx.fillStyle = this.color
    ctx.beginPath()
    ctx.arc(x, y, r, 0, TAU)
    ctx.fill()
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.arc(x - this.vx * 0.002 * s, y, r * 0.45, 0, TAU)
    ctx.fill()
    // trailing shard
    for (let i = 1; i <= 4; i++) {
      const tx = x - this.vx * 0.0035 * s * i
      const ty = y - this.vy * 0.0035 * s * i
      ctx.globalAlpha = 0.4 - i * 0.08
      ctx.fillStyle = this.glow
      ctx.fillRect(tx - r * 0.3, ty - r * 0.3, r * 0.6, r * 0.6)
    }
    ctx.restore()
  }
}

export class Game {
  constructor(canvas, options = {}) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d', { alpha: false })
    this.settings = options.settings
    this.audio = options.audio
    this.input = options.input
    this.onEvent = options.onEvent || (() => {})
    this.onHud = options.onHud || (() => {})
    this.fx = new FX()
    this.fx.setQuality(this.settings.effects)
    this.fx.glow = this.settings.glow
    this.fx.reduceFlashes = this.settings.reduceFlashes
    this.cam = new Camera()
    this.player = null
    this.enemy = null
    this.stage = null
    this.stageIndex = 0
    this.difficulty = DIFFICULTIES.medium
    this.state = 'attract'
    this.projectiles = []
    this.sigils = []
    this.time = 0
    this.ambientTimer = 0
    this.fightTime = 0
    this.damageDealt = 0
    this.parries = 0
    this.maxCombo = 0
    this.combo = 0
    this.comboTimer = 0
    this.endTimer = 0
    this.resultSent = false
    this.attractTime = 0
    this.attractDir = 1
    this.lastNotice = 0
    this.noticeCooldown = 0
    this.hudAccum = 0
    this.phaseAnnounced = false
    this.introTimer = 0
    this.resize()
    this.setupAttract()
    this._loop = this._loop.bind(this)
    this.raf = 0
    this.lastFrame = 0
    this.fpsAccum = 0
    this.fpsFrames = 0
  }

  get unlocked() {
    return SPELL_ORDER.filter(id => SPELLS[id].unlockStage <= Math.max(1, this.highestStage || 1))
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect()
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const displayW = Math.max(320, rect.width || window.innerWidth)
    const displayH = Math.max(240, rect.height || window.innerHeight)
    const portrait = displayH > displayW * 1.15
    const touch = matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0
    const res = this.settings.resolution
    let cssPerPixel = touch ? 2.1 : 3.1
    if (res === 'sharp') cssPerPixel = touch ? 1.6 : 2.2
    else if (res === 'balanced') cssPerPixel = touch ? 2.1 : 3.1
    else if (res === 'chunky') cssPerPixel = touch ? 2.7 : 4.2
    // keep the backing store manageable on huge displays
    const targetW = Math.min(displayW / cssPerPixel, 760)
    const scale = displayW / targetW
    const internalW = Math.max(180, Math.round(displayW / scale))
    const internalH = Math.max(140, Math.round(internalW * displayH / displayW))
    if (this.canvas.width !== internalW || this.canvas.height !== internalH) {
      this.canvas.width = internalW
      this.canvas.height = internalH
    }
    this.display = { width: displayW, height: displayH, portrait, touch, dpr }
    let viewW
    if (portrait) viewW = clamp(displayW / 1.9, 180, 240)
    else if (touch && displayH < 520) viewW = clamp(displayW / 2.75, 300, 430)
    else viewW = clamp(displayW / 3.2, 320, 470)
    const groundFrac = portrait ? 0.7 : touch ? 0.68 : 0.75
    this.cam.configure(internalW, internalH, viewW, groundFrac)
    this.cam.scale = internalW / viewW
    this.ctx.imageSmoothingEnabled = false
    this.fx.setQuality(this.settings.effects)
    this.fx.glow = this.settings.glow
    this.fx.reduceFlashes = this.settings.reduceFlashes
    this.render()
  }

  setSettings(settings) {
    this.settings = settings
    this.fx.setQuality(settings.effects)
    this.fx.glow = settings.glow
    this.fx.reduceFlashes = settings.reduceFlashes
    this.resize()
  }

  setupAttract() {
    this.state = 'attract'
    this.projectiles = []
    this.sigils = []
    this.resultSent = false
    this.fx.reset()
    const palette = PALETTES.player
    this.player = new Fighter({
      name: 'VESPER', palette, x: -56, facing: 1, isPlayer: true,
      stats: { maxHp: 100, maxMana: 60, parryWindow: 0.19, parryCooldown: 0.72, dashCooldown: 1.15, speed: 1, melee: 1, arcane: 1, resist: 1, siphon: 0 },
      spells: ['ember'],
    })
    this.enemy = new Fighter({
      name: 'THE WARDEN', title: 'Keeper of the First Gate', palette: PALETTES.ash,
      x: 56, facing: -1, stage: stageFor(0), difficulty: DIFFICULTIES.easy, spells: ['ember'],
    })
    this.enemy.hp = this.enemy.maxHp * 0.72
    this.enemy.hpGhost = this.enemy.hp
    this.stage = { ...stageFor(0), accent: PALETTES.ash.trim }
    this.stageIndex = 0
    this.difficulty = DIFFICULTIES.easy
    this.cam.x = 0
    this.camZTarget = 0
    this.attractTime = 0
    this.audio?.setMode('menu')
  }

  prepareStage(index, difficulty, highestStage = 1) {
    this.highestStage = highestStage
    this.stageIndex = index
    this.difficulty = DIFFICULTIES[difficulty] || DIFFICULTIES.medium
    const raw = stageFor(index)
    const stage = {
      ...raw,
      accent: PALETTES[raw.palette]?.trim || '#6ee7ff',
      eclipse: raw.palette === 'eclipse' || raw.ascended,
    }
    this.stage = stage
    this.fx.reset()
    this.projectiles = []
    this.sigils = []
    this.state = 'intro'
    this.resultSent = false
    this.endTimer = 0
    this.fightTime = 0
    this.damageDealt = 0
    this.parries = 0
    this.maxCombo = 0
    this.combo = 0
    this.comboTimer = 0
    this.phaseAnnounced = false
    this.introTimer = 0
    this.noticeCooldown = 0

    this.player = new Fighter({
      name: 'VESPER', palette: PALETTES.player, x: -74, facing: 1,
      isPlayer: true, stats: this.playerStats, spells: this.unlocked,
    })
    this.player.onLand = () => this.onLand(this.player)
    this.enemy = new Fighter({
      name: stage.name, title: stage.title, palette: PALETTES[stage.palette] || PALETTES.ash,
      x: 74, facing: -1, stage, difficulty: this.difficulty,
      spells: stage.spells.length ? stage.spells : ['ember'],
    })
    this.enemy.onLand = () => this.onLand(this.enemy)
    this.enemy.agg = stage.aggression
    this.player.agg = 1
    this.cam.x = 0
    this.cam.shakeX = 0
    this.cam.shakeY = 0
    this.audio?.setMode(stage.boss ? 'boss' : 'fight')
    this.onEvent('prepared', { stage, difficulty: this.difficulty, player: this.player, enemy: this.enemy })
    this.render()
  }

  setPlayerStats(stats) {
    this.playerStats = stats
  }

  beginFight() {
    if (this.state !== 'intro') return
    this.state = 'fight'
    this.fx.flash(this.stage?.accent || '#ffffff', 0.18)
    this.fx.text(0, -64, 'DUEL', '#ffffff', { size: 14, life: 1, vy: -8 })
    this.fx.burst(this.player.x, -18, { count: 14, colors: [this.player.palette.trim, '#ffffff'], speed: 100, life: 0.4 })
    this.audio?.play('levelup')
    this.onEvent('fight', { stage: this.stage })
  }

  pause() {
    if (this.state === 'fight') {
      this.state = 'paused'
      this.audio?.setMode('menu')
    }
  }

  resume() {
    if (this.state === 'paused') {
      this.state = 'fight'
      this.audio?.setMode(this.stage?.boss ? 'boss' : 'fight')
    }
  }

  notice(text, kind = 'info') {
    if (this.time - this.lastNotice < 0.9) return
    this.lastNotice = this.time
    this.onEvent('notice', { text, kind })
  }

  start() {
    if (this.raf) return
    this.lastFrame = performance.now()
    this.raf = requestAnimationFrame(this._loop)
  }

  stop() {
    cancelAnimationFrame(this.raf)
    this.raf = 0
  }

  _loop(now) {
    this.raf = requestAnimationFrame(this._loop)
    let dt = (now - this.lastFrame) / 1000
    this.lastFrame = now
    if (!Number.isFinite(dt)) dt = 1 / 60
    dt = clamp(dt, 0, 1 / 20)
    this.fpsAccum += dt
    this.fpsFrames++
    if (this.fpsAccum >= 1) {
      this.fps = Math.round(this.fpsFrames / this.fpsAccum)
      this.fpsAccum = 0
      this.fpsFrames = 0
    }
    const cap = this.settings.fps
    const step = cap === '60' ? 1 / 60 : cap === '120' ? 1 / 120 : 0
    this.acc = (this.acc || 0) + dt
    if (step && this.acc < step) {
      this.render()
      this.input.endFrame()
      return
    }
    const frameDt = step ? Math.min(this.acc, 1 / 20) : dt
    this.acc = 0
    this.update(frameDt)
    this.render()
    this.input.endFrame()
  }

  update(dt) {
    this.time += dt
    this.noticeCooldown = Math.max(0, this.noticeCooldown - dt)
    if (this.state === 'paused') return

    this.fx.update(dt * (this.state === 'fight' || this.state === 'intro' ? this.fx.timeScale : 1), dt)
    this.audio?.update()

    if (this.state === 'attract') {
      this.updateAttract(dt)
      this.updateCamera(dt)
      this.updateAmbient(dt, true)
      return
    }

    if (this.state === 'intro') {
      this.introTimer += dt
      this.player.animTime += dt
      this.enemy.animTime += dt
      this.player.hpGhost = lerp(this.player.hpGhost, this.player.hp, Math.min(1, dt * 5))
      this.enemy.hpGhost = lerp(this.enemy.hpGhost, this.enemy.hp, Math.min(1, dt * 5))
      this.updateCamera(dt)
      this.updateAmbient(dt, true)
      this.emitHud()
      return
    }

    if (this.state !== 'fight' && this.state !== 'ending') {
      this.updateCamera(dt)
      this.updateAmbient(dt, false)
      return
    }

    const scaled = dt * this.fx.timeScale
    this.audio?.setIntensity(this.state === 'fight' ? clamp(1 - (this.enemy.hpRatio), 0.12, 1) : 0.2)
    this.audio?.update()

    if (this.state === 'fight') {
      this.fightTime += scaled
      this.player.faceToward(this.enemy)

      const ctrl = this.readPlayerControls()
      const enemyCtrl = this.enemy.updateAI(scaled, this)
      this.player.update(scaled, ctrl, this)
      this.enemy.update(scaled, enemyCtrl, this)
      this.checkAttacks(this.player, this.enemy)
      this.checkAttacks(this.enemy, this.player)

      for (const p of this.projectiles) p.update(scaled, this)
      this.projectiles = this.projectiles.filter(p => !p.dead)

      for (let i = this.sigils.length - 1; i >= 0; i--) {
        const s = this.sigils[i]
        s.timer -= scaled
        if (s.timer <= 0) {
          this.resolveSigil(s)
          this.sigils.splice(i, 1)
        }
      }

      this.comboTimer = Math.max(0, this.comboTimer - dt)
      if (this.comboTimer <= 0) this.combo = 0

      this.checkBossPhase()
      this.checkEnd()
    } else {
      this.player.update(dt * this.fx.timeScale, { axis: 0 }, this)
      this.enemy.update(dt * this.fx.timeScale, { axis: 0 }, this)
      for (const p of this.projectiles) p.update(dt * this.fx.timeScale, this)
      this.projectiles = this.projectiles.filter(p => !p.dead)
      this.endTimer -= dt
      if (this.endTimer <= 0 && !this.resultSent) {
        this.resultSent = true
        const winner = this.enemy.dead ? 'player' : 'enemy'
        this.onEvent(winner === 'player' ? 'victory' : 'defeat', {
          stage: this.stage,
          stageIndex: this.stageIndex,
          difficulty: this.difficulty,
          stats: {
            time: this.fightTime,
            parries: this.parries,
            maxCombo: this.maxCombo,
            damage: Math.round(this.damageDealt),
            hp: Math.round(this.player.hp),
          },
          nextStage: stageFor(this.stageIndex + 1),
        })
      }
    }

    this.updateCamera(dt)
    this.updateAmbient(dt, false)
    this.hudAccum += dt
    if (this.hudAccum > 0.03) {
      this.hudAccum = 0
      this.emitHud()
    }
  }

  readPlayerControls() {
    const spells = [this.input.pressed('spell1') ? 'ember' : null, this.input.pressed('spell2') ? 'frost' : null, this.input.pressed('spell3') ? 'storm' : null].filter(Boolean)
    return {
      axis: this.input.axis,
      jump: this.input.pressed('jump'),
      strike: this.input.pressed('strike'),
      heavy: this.input.pressed('heavy'),
      parry: this.input.pressed('parry'),
      dash: this.input.pressed('dash'),
      guard: this.input.down('guard'),
      spell: spells[0] || null,
    }
  }

  checkAttacks(attacker, target) {
    const d = attacker.attackData
    if (!d || attacker.attackHit) return
    if (!['strike1', 'strike2', 'strike3', 'heavy'].includes(attacker.action)) return
    const t = attacker.actionT
    if (t < d.windup) return
    if (t > d.windup + d.active) return
    if (!attacker.slashFxDone) {
      attacker.slashFxDone = true
      this.spawnSlash(attacker, d)
    }
    const dx = target.x - attacker.x
    if (Math.abs(dx) > d.reach + 10) return
    if (sign(dx) !== attacker.facing) return
    if (target.y < -44) return
    if (target.y - 34 > 2) return
    attacker.attackHit = true
    const before = target.hp
    const result = target.takeHit(d, attacker, this)
    this.resolveHitResult(attacker, target, before - target.hp, result, { melee: true })
  }

  spawnSlash(attacker, d) {
    const heavy = attacker.attackKind === 'heavy'
    const col = attacker.palette.trim
    const signX = attacker.facing
    const cx = attacker.x + signX * 22
    const cy = -20
    const from = heavy
      ? (signX > 0 ? -2.7 : Math.PI - 0.44)
      : (signX > 0 ? -2.35 : Math.PI - 0.79)
    const to = heavy
      ? (signX > 0 ? 0.75 : Math.PI + 2.7)
      : (signX > 0 ? 0.75 : Math.PI + 2.35)
    this.fx.slashArc(cx, cy, from, to, heavy ? 28 : 23, col, { life: heavy ? 0.26 : 0.18, width: heavy ? 4 : 3 })
    this.fx.burst(cx + rand(-4, 4), cy, {
      count: heavy ? 6 : 3, colors: [col, '#ffffff'], speed: 40, life: 0.25, size: 1.2, gravity: 40,
    })
    this.audio?.play(heavy ? 'swingHeavy' : 'swing', { gain: attacker.isPlayer ? 1 : 0.7 })
  }

  resolveHitResult(attacker, target, dmg, result, opts = {}) {
    const px = opts.x ?? target.x
    const py = opts.y ?? (target.y - 20)
    if (result === 'parry') {
      this.onParrySuccess(target, attacker)
      return
    }
    if (result === 'miss' || result === 'dead') return
    if (result === 'guard') {
      this.fx.burst(px, py, { count: 10, colors: [target.palette.trim, '#ffffff'], speed: 100, life: 0.3, size: 1.3 })
      this.fx.ring(px, py, { radius: 3, radiusEnd: 16, life: 0.24, width: 2, color: target.palette.trim })
      this.fx.shake(0.1)
      this.fx.stop(0.035)
      this.audio?.play('guard', { pan: clamp(px / 140, -1, 1) })
      return
    }
    if (result === 'guardBreak') {
      this.fx.burst(px, py, { count: 26, colors: [target.palette.trim, '#ffffff', '#ff6bd6'], speed: 170, life: 0.5, size: 2, gravity: 260 })
      this.fx.ring(px, py, { radius: 4, radiusEnd: 40, life: 0.4, width: 3, color: '#ff6bd6' })
      this.fx.text(target.x, -46, 'BREAK', '#ff6bd6', { size: 10, life: 0.9 })
      this.fx.shake(0.42)
      this.fx.stop(0.09)
      this.fx.flash('#ff6bd6', 0.12)
      this.audio?.play('guardBreak', { pan: clamp(px / 140, -1, 1) })
      return
    }
    // clean hit
    const rounded = Math.max(1, Math.round(dmg))
    const heavy = opts.spell ? true : opts.melee && target.action === 'hurt'
    const col = attacker.palette.trim
    this.fx.impact(px, py, col, heavy ? 1.5 : 1)
    this.fx.burst(px, py, {
      count: heavy ? 22 : 14,
      colors: [col, '#ffffff', target.palette.trim],
      speed: 130 + (heavy ? 80 : 0),
      size: 1.5,
      life: 0.5,
      gravity: 300,
    })
    this.fx.ring(px, py, { radius: 2, radiusEnd: 24, life: 0.28, width: 2, color: '#ffffff', squash: 0.8 })
    this.fx.text(target.x + rand(-5, 5), py - 6, `${rounded}`, attacker.isPlayer ? '#ffffff' : '#ffb3d9', { size: opts.spell ? 10 : 9, life: 0.7 })
    this.fx.shake(heavy ? 0.4 : 0.24)
    this.fx.stop(heavy ? 0.085 : 0.05)
    if (heavy) this.fx.flash(col, 0.08)
    this.audio?.play(heavy ? 'hitHeavy' : 'hit', { pan: clamp(px / 140, -1, 1), pitch: rand(0.9, 1.1) })
    this.audio?.play('hurt', { gain: 0.5 })

    if (attacker.isPlayer) {
      this.damageDealt += dmg
      this.combo++
      this.comboTimer = 1.25
      this.maxCombo = Math.max(this.maxCombo, this.combo)
      if (this.combo >= 2) this.onEvent('combo', { combo: this.combo })
    }
    if (target.dead) {
      this.fx.flash(target.isPlayer ? '#ff3355' : col, 0.2)
    }
  }

  onParrySuccess(parrier, attacker, projectile = null) {
    if (parrier.isPlayer) {
      this.parries++
      this.onEvent('parry', { count: this.parries })
    }
    const px = parrier.x + parrier.facing * 14
    const py = -22
    const col = parrier.isPlayer ? '#ffe08a' : parrier.palette.trim
    this.fx.stop(0.13)
    this.fx.slow(0.35, 0.22)
    this.fx.flash(col, 0.22)
    this.fx.shake(0.34)
    this.fx.punch = Math.max(this.fx.punch, 0.03)
    this.fx.text(parrier.x + parrier.facing * 8, -48, 'PARRY', col, { size: 12, life: 1, vy: -18 })
    this.fx.ring(px, py, { radius: 3, radiusEnd: 46, life: 0.4, width: 3, color: col })
    this.fx.ring(px, py, { radius: 1, radiusEnd: 26, life: 0.6, width: 1.6, color: '#ffffff' })
    this.fx.burst(px, py, { count: 32, colors: [col, '#ffffff', parrier.palette.trim], speed: 210, life: 0.55, size: 2, gravity: 120 })
    this.fx.sigil(px, py, col, { radius: 26, squash: 1, life: 0.35, grow: true, spin: 8 })
    this.fx.sparks(px, py, '#ffffff', 18, 240)
    this.audio?.play('parry', { gain: 1.2 })
    if (projectile) {
      this.fx.burst(px, py, { count: 12, colors: [projectile.color, '#ffffff'], speed: 140, life: 0.4, size: 1.6 })
    }
  }

  castSpell(caster, id) {
    const spell = SPELLS[id]
    if (!spell) return
    const target = caster === this.player ? this.enemy : this.player
    const power = spell.dmg * (caster.spellPower || 1) * (caster.isPlayer ? 1 : (caster.difficulty?.dmg || 1))
    const tx = caster.x + caster.facing * 12
    caster.castColor = spell.glow

    if (id === 'ember') {
      const sx = caster.x + caster.facing * 12
      const sy = -21
      const aimX = target.x - sx
      const aimY = (target.y - 18) - sy
      const len = Math.max(1, Math.hypot(aimX, aimY))
      const speed = spell.speed
      this.projectiles.push(new Projectile({
        owner: caster, type: id, x: sx, y: sy,
        vx: (aimX / len) * speed, vy: (aimY / len) * speed,
        dmg: power, game: this,
      }))
      this.fx.burst(tx, -21, { count: 12, colors: [spell.color, spell.glow, '#ffffff'], speed: 90, life: 0.35, size: 1.7, gravity: 40 })
      this.fx.ring(caster.x, -0, { radius: 3, radiusEnd: 15, life: 0.25, width: 1.6, color: spell.color, squash: 0.3 })
      this.audio?.play('castFire', { pan: clamp(caster.x / 160, -1, 1) })
      this.fx.text(caster.x, -46, 'EMBER', spell.glow, { size: 7, life: 0.6 })
    } else if (id === 'frost') {
      this.fx.ring(caster.x, -1, { radius: 4, radiusEnd: spell.radius * 1.6, life: 0.5, width: 4, color: spell.color, squash: 0.32 })
      this.fx.ring(caster.x, -4, { radius: 2, radiusEnd: spell.radius, life: 0.4, width: 2, color: '#ffffff', squash: 0.4 })
      this.fx.sigil(caster.x, 0, spell.color, { radius: spell.radius, squash: 0.3, life: 0.5, spin: 6, grow: true })
      this.fx.burst(caster.x, -8, { count: 30, colors: [spell.color, spell.glow, '#ffffff'], speed: 160, life: 0.55, size: 1.8, gravity: 60, shape: 'shard' })
      this.audio?.play('castFrost')
      this.fx.flash(spell.color, 0.08)
      if (target && !target.dead && Math.abs(target.x - caster.x) < spell.radius && Math.abs(target.y) < 40) {
        const before = target.hp
        const result = target.takeHit({ dmg: power, kb: 40, guardBreak: false, shake: 0.2 }, caster, this)
        this.resolveHitResult(caster, target, before - target.hp, result, { spell: id, x: target.x, y: target.y - 18 })
        if (result !== 'parry' && result !== 'miss') {
          target.slowT = Math.max(target.slowT, spell.slowTime)
          this.fx.text(target.x, -52, 'CHILLED', spell.color, { size: 7, life: 0.8 })
        }
      }
    } else if (id === 'storm') {
      const sx = target ? target.x : caster.x + caster.facing * 60
      const targetFighter = target
      this.sigils.push({
        x: sx, owner: caster, timer: spell.delay, radius: spell.radius,
        color: spell.color, glow: spell.glow, damage: power, stun: spell.stun,
      })
      this.fx.sigil(sx, -1, spell.color, { radius: spell.radius, squash: 0.3, life: spell.delay, spin: 4, grow: false })
      this.fx.ring(sx, -1, { radius: spell.radius, radiusEnd: spell.radius * 0.2, life: spell.delay, width: 1.5, color: spell.glow, squash: 0.3 })
      this.fx.text(caster.x, -48, 'SIGIL', spell.glow, { size: 7, life: 0.6 })
      this.audio?.play('castStorm')
      if (targetFighter) {
        this.fx.burst(sx, -1, { count: 12, colors: [spell.color, '#ffffff'], speed: 70, life: 0.4, size: 1.4, gravity: -40 })
      }
    }
  }

  resolveSigil(s) {
    const target = s.owner === this.player ? this.enemy : this.player
    const x = s.x
    this.fx.bolt(x, -280, -1, s.glow, { power: 1.2 })
    this.fx.ring(x, -1, { radius: 3, radiusEnd: s.radius * 2, life: 0.45, width: 4, color: s.glow, squash: 0.35 })
    this.fx.ring(x, -1, { radius: 2, radiusEnd: s.radius * 1.2, life: 0.3, width: 2, color: '#ffffff', squash: 0.4 })
    this.fx.burst(x, -2, { count: 34, colors: [s.color, s.glow, '#ffffff'], speed: 220, life: 0.6, size: 2, gravity: 340, angle: -Math.PI / 2, spread: 2.4 })
    this.fx.flash('#ffffff', 0.26)
    this.fx.shake(0.55)
    this.fx.stop(0.1)
    this.fx.punch = Math.max(this.fx.punch, 0.03)
    this.audio?.play('bolt')
    if (target && !target.dead && Math.abs(target.x - x) < s.radius) {
      const before = target.hp
      const result = target.takeHit({ dmg: s.damage, kb: 60, guardBreak: false, shake: 0.4 }, s.owner, this)
      this.resolveHitResult(s.owner, target, before - target.hp, result, { spell: 'storm', x: target.x, y: target.y - 20 })
      if (result !== 'parry' && result !== 'miss') {
        target.stunT = Math.max(target.stunT, s.stun)
        this.fx.text(target.x, -56, 'STUNNED', s.glow, { size: 8, life: 0.9 })
      }
    }
  }

  pushGhost(fighter) {
    this.fx.ghost(fighter.snapshot(), fighter.palette.trim, 0.28)
  }

  onAction(fighter, type, data) {
    if (type === 'jump' && fighter.grounded === false) {
      this.fx.burst(fighter.x, 0, { count: 7, colors: [fighter.palette.trim, '#ffffff'], speed: 55, life: 0.35, size: 1.2, gravity: 120 })
      this.audio?.play('jump', { gain: 0.6 })
    }
    if (type === 'dash') {
      this.fx.burst(fighter.x, -2, { count: 10, colors: [fighter.palette.trim, '#ffffff'], speed: 80, life: 0.3, size: 1.4, angle: Math.PI, spread: 0.8 })
      this.audio?.play('dash', { pan: clamp(fighter.x / 160, -1, 1) })
    }
    if (type === 'parry') {
      this.fx.ring(fighter.x + fighter.facing * 8, -20, { radius: 4, radiusEnd: 18, life: 0.18, width: 1.4, color: fighter.palette.trim, squash: 1 })
    }
    if (type === 'castStart') {
      this.fx.burst(fighter.x, -20, { count: 12, colors: [fighter.castColor || fighter.palette.trim, '#ffffff'], speed: 60, life: 0.4, size: 1.4, gravity: -20 })
      this.audio?.play('cast', { gain: 0.7 })
    }
  }

  onLand(fighter) {
    if (fighter.dead) return
    this.fx.burst(fighter.x, 0, { count: 8, colors: [fighter.palette.trim, '#8b87b5'], speed: 55, life: 0.35, size: 1.2, gravity: 120, shape: 'smoke' })
    this.audio?.play('land', { gain: 0.4, pan: clamp(fighter.x / 160, -1, 1) })
  }

  checkBossPhase() {
    if (this.phaseAnnounced || !this.stage?.boss) return
    if (this.enemy.hp / this.enemy.maxHp > 0.5) return
    this.phaseAnnounced = true
    this.enemy.enraged = true
    this.enemy.phase = 2
    this.enemy.damageMult *= 1.18
    this.enemy.moveSpeed *= 1.12
    this.fx.flash(this.enemy.palette.trim, 0.3)
    this.fx.shake(0.6)
    this.fx.stop(0.16)
    this.fx.slow(0.4, 0.5)
    this.fx.ring(this.enemy.x, -1, { radius: 4, radiusEnd: 90, life: 0.7, width: 4, color: this.enemy.palette.trim, squash: 0.3 })
    this.fx.ring(this.enemy.x, -20, { radius: 4, radiusEnd: 60, life: 0.5, width: 3, color: '#ffffff' })
    this.fx.burst(this.enemy.x, -20, { count: 40, colors: [this.enemy.palette.trim, '#ffffff', '#ff6bd6'], speed: 200, life: 0.8, size: 2, gravity: -40 })
    this.fx.text(this.enemy.x, -70, 'PHASE II', this.enemy.palette.trim, { size: 13, life: 1.4, vy: -6 })
    this.audio?.play('levelup', { pitch: 0.8 })
    this.audio?.setMode('boss')
  }

  checkEnd() {
    if (this.state !== 'fight') return
    if (this.enemy.dead) {
      this.state = 'ending'
      this.endTimer = 1.6
      this.combo = 0
      this.fx.slow(0.3, 1.2)
      this.fx.flash(this.stage.accent, 0.34)
      this.fx.shake(0.7)
      this.fx.burst(this.enemy.x, -18, { count: 60, colors: [this.enemy.palette.trim, '#ffffff', this.enemy.palette.accent], speed: 240, life: 1, size: 2.2, gravity: 260 })
      this.fx.ring(this.enemy.x, -18, { radius: 4, radiusEnd: 80, life: 0.8, width: 4, color: this.enemy.palette.trim })
      this.fx.text(0, -70, 'VICTORY', '#ffe08a', { size: 16, life: 1.6, vy: -4 })
      this.audio?.play('victory')
    } else if (this.player.dead) {
      this.state = 'ending'
      this.endTimer = 1.7
      this.combo = 0
      this.fx.slow(0.28, 1.2)
      this.fx.flash('#ff3355', 0.3)
      this.fx.shake(0.7)
      this.fx.burst(this.player.x, -18, { count: 50, colors: ['#ff3355', '#ffffff', this.player.palette.trim], speed: 220, life: 1, size: 2.2, gravity: 260 })
      this.fx.text(0, -70, 'DEFEAT', '#ff6b8a', { size: 16, life: 1.6, vy: -4 })
      this.audio?.play('defeat')
    }
  }

  updateAttract(dt) {
    this.attractTime += dt
    if (this.player) this.player.animTime += dt
    if (this.enemy) this.enemy.animTime += dt
    const target = Math.sin(this.attractTime * 0.16) * 46
    this.cam.x = lerp(this.cam.x, target, Math.min(1, dt * 1.4))
    if (Math.random() < dt * 0.6) {
      const x = rand(-150, 150)
      this.fx.burst(x, -1, { count: 2, colors: [this.stage?.accent || '#6ee7ff', '#ffffff'], speed: 20, life: 1.2, size: 1.2, gravity: -30 })
    }
  }

  updateAmbient(dt, quiet) {
    const q = this.fx.qualityData
    this.ambientTimer -= dt
    if (this.ambientTimer <= 0) {
      this.ambientTimer = rand(0.18, 0.5) * (quiet ? 1.5 : 1)
      const accent = this.stage?.accent || '#6ee7ff'
      if (this.fx.particles.length < q.ambient) {
        this.fx.particle({
          x: rand(-ARENA.halfWidth, ARENA.halfWidth),
          y: rand(-6, -1),
          vx: rand(-6, 6), vy: rand(-22, -8),
          life: rand(1, 2.4), size: rand(0.7, 1.7),
          color: Math.random() < 0.25 ? '#ffffff' : accent,
          glow: true, gravity: -4, drag: 0.3,
        })
      }
      if (Math.random() < 0.24 && !quiet) {
        this.fx.particle({
          x: rand(-180, 180), y: rand(-70, -30),
          vx: rand(-14, 14), vy: rand(-4, 8),
          life: rand(1.4, 3.2), size: 1, color: '#8b87b5', glow: false, drag: 0.1,
        })
      }
    }
    if (!quiet && this.state === 'fight' && Math.random() < dt * 3) {
      const f = Math.random() < 0.5 ? this.player : this.enemy
      if (f && !f.dead) {
        this.fx.particle({
          x: f.x + rand(-8, 8), y: f.y - rand(4, 30),
          vx: rand(-8, 8), vy: rand(-16, -4),
          life: rand(0.4, 0.9), size: 1, color: f.palette.trim, glow: true, gravity: -10, drag: 1,
        })
      }
    }
  }

  updateCamera(dt) {
    if (!this.player || !this.enemy) return
    const mid = (this.player.x + this.enemy.x) / 2
    let targetX = this.state === 'attract' ? this.cam.x : this.cam.clampX(mid)
    const follow = this.state === 'attract' ? 0 : 1
    this.cam.x = lerp(this.cam.x, follow ? targetX : this.cam.x, Math.min(1, dt * (this.state === 'fight' ? 6 : 4)))
    this.cam.punch = lerp(this.cam.punch, this.settings.reduceMotion ? 0 : this.fx.punch, Math.min(1, dt * 10))
    this.cam.scale = this.cam.baseScale * (1 + this.cam.punch * 2.4)
    const shake = this.settings.shake && !this.settings.reduceMotion ? this.fx.shakeOffset() : { x: 0, y: 0 }
    this.cam.shakeX = shake.x
    this.cam.shakeY = shake.y
  }

  emitHud() {
    if (this.state === 'attract') return
    const p = this.player
    const e = this.enemy
    if (!p || !e) return
    const spells = SPELL_ORDER.map((id, i) => {
      const s = SPELLS[id]
      const locked = s.unlockStage > Math.max(1, this.highestStage || 1)
      return {
        id, name: s.name, key: s.key, index: i,
        locked, unlockStage: s.unlockStage,
        cd: this.player.spellCd[id], total: s.cooldown,
        ready: !locked && this.player.spellCd[id] <= 0 && this.player.mana >= s.cost,
        affordable: this.player.mana >= s.cost,
        cost: s.cost,
      }
    })
    this.onHud({
      state: this.state,
      player: {
        name: p.name, hp: p.hp, maxHp: p.maxHp, ghost: p.hpGhost, mana: p.mana, maxMana: p.maxMana,
        parryCd: p.parryCd, parryTotal: p.parryCooldown, dashCd: p.dashCd, dashTotal: p.dashCooldown,
        combo: this.combo,
      },
      enemy: {
        name: e.name, title: e.title, hp: e.hp, maxHp: e.maxHp, ghost: e.hpGhost,
        enraged: e.enraged,
      },
      spells,
      stage: this.stage,
      difficulty: this.difficulty,
      time: this.fightTime,
      fps: this.fps,
    })
  }

  render() {
    const ctx = this.ctx
    const cam = this.cam
    const w = this.canvas.width
    const h = this.canvas.height
    if (!w || !h) return
    const palette = this.player?.palette || PALETTES.player
    const accent = this.stage?.accent || palette.trim

    drawSky(ctx, cam, this.time, palette, this.settings, this.stage)
    drawPlatform(ctx, cam, this.time, palette, this.stage)

    if (this.player && this.enemy) {
      // ghost afterimages
      this.fx.renderGhosts(ctx, cam, (c, cm, snapshot, color, alpha) => drawGhost(c, cm, snapshot, color, alpha))

      // order by facing for depth: draw the one further back first
      const order = [this.enemy, this.player]
      for (const f of order) {
        if (!f) continue
        drawFighter(ctx, cam, f, this.time)
        if (f.action === 'strike1' || f.action === 'strike2' || f.action === 'strike3' || f.action === 'heavy') {
          // subtle weapon spark trail
          if (Math.random() < 0.4) {
            const px = f.x + f.facing * rand(16, 30)
            const py = -rand(12, 30)
            this.fx.particle({ x: px, y: py, vx: rand(-10, 10), vy: rand(-10, 10), life: 0.16, size: 1, color: f.palette.trim, glow: true, drag: 2 })
          }
        }
      }

      for (const p of this.projectiles) p.render(ctx, cam)

      // foreground embers
      drawConfetti(ctx, cam, this.time, palette)
    }

    this.fx.render(ctx, cam)
    this.fx.renderScreen(ctx, w, h)
    drawVignette(ctx, w, h)

    // boss subtitle sheen during intro
    if (this.state === 'intro' && this.introTimer > 0.2) {
      const a = clamp((this.introTimer - 0.2) * 2, 0, 1)
      ctx.save()
      ctx.globalAlpha = a * 0.22
      ctx.fillStyle = accent
      ctx.fillRect(0, h * 0.62, w, 1)
      ctx.restore()
    }
  }
}
