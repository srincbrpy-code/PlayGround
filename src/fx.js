const TAU = Math.PI * 2
const rand = (a, b) => a + Math.random() * (b - a)
const pick = arr => arr[Math.floor(Math.random() * arr.length)]
const clamp = (v, a, b) => Math.max(a, Math.min(b, v))

export const FX_QUALITY = {
  low: { max: 150, scale: 0.45, ambient: 18 },
  medium: { max: 300, scale: 0.7, ambient: 32 },
  high: { max: 540, scale: 1, ambient: 48 },
  ultra: { max: 900, scale: 1.35, ambient: 70 },
}

export class FX {
  constructor() {
    this.particles = []
    this.rings = []
    this.arcs = []
    this.texts = []
    this.bolts = []
    this.sigils = []
    this.flashes = []
    this.ghosts = []
    this.trauma = 0
    this.punch = 0
    this.stopTimer = 0
    this.slowTimer = 0
    this.slowScale = 1
    this.quality = 'high'
    this.glow = true
    this.reduceFlashes = false
    this.time = 0
    this._seed = 0
  }

  setQuality(name) {
    this.quality = FX_QUALITY[name] ? name : 'high'
  }

  get qualityData() {
    return FX_QUALITY[this.quality] || FX_QUALITY.high
  }

  reset() {
    this.particles.length = 0
    this.rings.length = 0
    this.arcs.length = 0
    this.texts.length = 0
    this.bolts.length = 0
    this.sigils.length = 0
    this.flashes.length = 0
    this.ghosts.length = 0
    this.trauma = 0
    this.punch = 0
    this.stopTimer = 0
    this.slowTimer = 0
    this.slowScale = 1
  }

  particle(options) {
    const q = this.qualityData
    if (this.particles.length >= q.max) this.particles.shift()
    const life = options.life ?? 0.6
    this.particles.push({
      x: options.x, y: options.y,
      vx: options.vx ?? 0, vy: options.vy ?? 0,
      life, max: life,
      size: (options.size ?? 1.4) * (options.unscaled ? 1 : q.scale),
      color: options.color ?? '#ffffff',
      glow: options.glow ?? true,
      gravity: options.gravity ?? 0,
      drag: options.drag ?? 1.5,
      shape: options.shape ?? 'spark',
      rot: options.rot ?? 0,
      vr: options.vr ?? 0,
      fade: options.fade ?? 'ease',
      alpha: options.alpha ?? 1,
    })
  }

  burst(x, y, options = {}) {
    const q = this.qualityData
    const count = Math.max(1, Math.round((options.count ?? 12) * q.scale))
    const colors = options.colors ?? ['#ffffff']
    const angle = options.angle ?? 0
    const spread = options.spread ?? TAU
    const speed = options.speed ?? 90
    const size = options.size ?? 1.5
    const life = options.life ?? 0.45
    for (let i = 0; i < count; i++) {
      const a = angle + (spread === TAU ? rand(0, TAU) : rand(-spread / 2, spread / 2))
      const v = speed * rand(0.25, 1)
      this.particle({
        x: x + rand(-2, 2), y: y + rand(-2, 2),
        vx: Math.cos(a) * v, vy: Math.sin(a) * v,
        life: life * rand(0.55, 1.25),
        size: size * rand(0.6, 1.5),
        color: pick(colors),
        gravity: options.gravity ?? 120,
        drag: options.drag ?? 2.2,
        shape: options.shape ?? 'spark',
        glow: options.glow ?? true,
      })
    }
  }

  sparks(x, y, color, count = 10, speed = 120, angle = 0, spread = TAU) {
    this.burst(x, y, {
      count, speed, angle, spread,
      colors: [color, '#ffffff', color],
      size: 1.3, life: 0.42, gravity: 260, drag: 1.2,
    })
  }

  impact(x, y, color, power = 1) {
    const q = this.qualityData
    this.ring(x, y, {
      radius: 2, radiusEnd: 22 + power * 10,
      life: 0.32, width: 2.2, color, squash: 0.7,
    })
    this.burst(x, y, {
      count: Math.round(10 + 10 * power),
      speed: 80 + 70 * power,
      colors: [color, '#ffffff'],
      size: 1.4 + power * 0.4,
      life: 0.4 + power * 0.15,
      gravity: 200,
    })
    this.shake(0.18 * power)
    this.punch = Math.max(this.punch, 0.006 * power)
  }

  ring(x, y, options = {}) {
    const life = options.life ?? 0.4
    this.rings.push({
      x, y,
      radius: options.radius ?? 4,
      radiusEnd: options.radiusEnd ?? 40,
      life, max: life,
      width: options.width ?? 2,
      color: options.color ?? '#ffffff',
      glow: options.glow ?? true,
      squash: options.squash ?? 1,
      alpha: options.alpha ?? 1,
      easing: options.easing ?? 'out',
      delay: options.delay ?? 0,
    })
  }

  column(x, y, color, height = 120, width = 5) {
    this.ring(x, y, { radius: 1, radiusEnd: width, radiusEnd: width, life: 0.28, width: height, color, squash: 0.1, alpha: 0.7 })
  }

  slashArc(x, y, from, to, radius, color, options = {}) {
    this.arcs.push({
      x, y, from, to, radius,
      life: options.life ?? 0.2, max: options.life ?? 0.2,
      color,
      width: options.width ?? 3,
      alpha: options.alpha ?? 0.9,
    })
  }

  text(x, y, value, color = '#ffffff', options = {}) {
    const life = options.life ?? 0.72
    this.texts.push({
      x, y, value, color,
      life, max: life,
      size: options.size ?? 9,
      vy: options.vy ?? -34,
      vx: options.vx ?? 0,
      weight: options.weight ?? 'bold',
      glow: options.glow ?? true,
    })
  }

  bolt(x, fromY, toY, color = '#e8dcff', options = {}) {
    const points = [{ x, y: fromY }]
    let cx = x
    let cy = fromY
    const segments = 9
    for (let i = 1; i < segments; i++) {
      const p = i / segments
      cx = x + rand(-1, 1) * (1 - p) * 26
      cy = fromY + (toY - fromY) * p
      points.push({ x: cx, y: cy })
    }
    points.push({ x: x + rand(-2, 2), y: toY })
    const branches = []
    for (let i = 1; i < segments - 1; i++) {
      if (Math.random() > 0.42) continue
      const length = rand(8, 26) * (options.power ?? 1)
      const dir = Math.random() > 0.5 ? 1 : -1
      branches.push([
        points[i],
        { x: points[i].x + dir * length * 0.6, y: points[i].y + length * 0.4 },
        { x: points[i].x + dir * length, y: points[i].y + length * 0.55 },
      ])
    }
    this.bolts.push({
      points, branches,
      life: options.life ?? 0.24, max: options.life ?? 0.24,
      color, width: options.width ?? 3,
    })
  }

  sigil(x, y, color, options = {}) {
    const life = options.life ?? 0.7
    this.sigils.push({
      x, y,
      radius: options.radius ?? 26,
      life, max: life,
      color,
      rot: options.rot ?? rand(0, TAU),
      spin: options.spin ?? 3,
      squash: options.squash ?? 0.3,
      grow: options.grow ?? true,
      alpha: options.alpha ?? 0.8,
    })
  }

  ghost(snapshot, color, life = 0.24) {
    const q = this.qualityData
    if (this.ghosts.length > q.max / 6) this.ghosts.shift()
    this.ghosts.push({ ...snapshot, color, life, max: life })
  }

  flash(color = '#ffffff', alpha = 0.5) {
    if (this.reduceFlashes) alpha *= 0.35
    this.flashes.push({ color, alpha, life: 0.16, max: 0.16 })
  }

  shake(amount) {
    this.trauma = clamp(this.trauma + amount, 0, 1)
  }

  stop(seconds) {
    this.stopTimer = Math.max(this.stopTimer, seconds)
  }

  slow(scale, seconds) {
    this.slowScale = scale
    this.slowTimer = Math.max(this.slowTimer, seconds)
  }

  get frozen() {
    return this.stopTimer > 0
  }

  get timeScale() {
    if (this.stopTimer > 0) return 0.015
    if (this.slowTimer > 0) return this.slowScale
    return 1
  }

  shakeOffset() {
    const power = this.trauma * this.trauma * 9
    return {
      x: rand(-power, power),
      y: rand(-power, power * 0.8),
    }
  }

  update(dt, realDt = dt) {
    this.time += realDt
    this.stopTimer = Math.max(0, this.stopTimer - realDt)
    this.slowTimer = Math.max(0, this.slowTimer - realDt)
    this.trauma = Math.max(0, this.trauma - realDt * 1.5)
    this.punch = Math.max(0, this.punch - realDt * 0.055)

    const s = this.stopTimer > 0 ? dt * 0.08 : dt
    if (s <= 0) return

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i]
      p.life -= s
      if (p.life <= 0) { this.particles.splice(i, 1); continue }
      p.vx -= p.vx * p.drag * s
      p.vy -= p.vy * p.drag * s * 0.25
      p.vy += p.gravity * s
      p.x += p.vx * s
      p.y += p.vy * s
      p.rot += p.vr * s
    }
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i]
      if (r.delay > 0) { r.delay -= s; continue }
      r.life -= s
      if (r.life <= 0) this.rings.splice(i, 1)
    }
    for (let i = this.arcs.length - 1; i >= 0; i--) {
      const a = this.arcs[i]
      a.life -= s
      if (a.life <= 0) this.arcs.splice(i, 1)
    }
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const t = this.texts[i]
      t.life -= realDt
      if (t.life <= 0) { this.texts.splice(i, 1); continue }
      t.y += t.vy * realDt
      t.x += t.vx * realDt
      t.vy += 28 * realDt
    }
    for (let i = this.bolts.length - 1; i >= 0; i--) {
      const b = this.bolts[i]
      b.life -= s
      if (b.life <= 0) this.bolts.splice(i, 1)
    }
    for (let i = this.sigils.length - 1; i >= 0; i--) {
      const g = this.sigils[i]
      g.life -= s
      g.rot += g.spin * s
      if (g.life <= 0) this.sigils.splice(i, 1)
    }
    for (let i = this.flashes.length - 1; i >= 0; i--) {
      const f = this.flashes[i]
      f.life -= realDt
      if (f.life <= 0) this.flashes.splice(i, 1)
    }
    for (let i = this.ghosts.length - 1; i >= 0; i--) {
      const g = this.ghosts[i]
      g.life -= s
      if (g.life <= 0) this.ghosts.splice(i, 1)
    }
  }

  render(ctx, cam) {
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'

    // ground sigils
    for (const s of this.sigils) {
      const t = 1 - s.life / s.max
      const alpha = s.alpha * (1 - t) * (0.4 + 0.6 * Math.sin(t * Math.PI))
      const radius = s.radius * (s.grow ? 0.5 + t * 1.4 : 1)
      this._ellipseRune(ctx, cam.X(s.x), cam.Y(s.y), radius * cam.scale, radius * s.squash * cam.scale, s.rot, s.color, alpha, 1.5)
    }

    // arcs / slash trails
    for (const a of this.arcs) {
      const t = 1 - a.life / a.max
      const alpha = a.alpha * (1 - t) * 0.9
      const steps = 13
      for (let i = 0; i < steps; i++) {
        const p = i / (steps - 1)
        const ang = a.from + (a.to - a.from) * p
        const rr = a.radius * (0.82 + 0.18 * p)
        const x = cam.X(a.x + Math.cos(ang) * rr)
        const y = cam.Y(a.y + Math.sin(ang) * rr)
        const w = Math.max(1, a.width * cam.scale * (0.4 + 0.6 * Math.sin(p * Math.PI)))
        if (this.glow) {
          ctx.globalAlpha = alpha * 0.26
          ctx.fillStyle = a.color
          ctx.fillRect(x - w * 2, y - w * 2, w * 4, w * 4)
        }
        ctx.globalAlpha = alpha * (0.5 + 0.5 * Math.sin(p * Math.PI))
        ctx.fillStyle = i % 3 === 0 ? '#ffffff' : a.color
        ctx.fillRect(x - w / 2, y - w / 2, w, w)
      }
    }

    // rings
    for (const r of this.rings) {
      if (r.delay > 0) continue
      const t = 1 - r.life / r.max
      const e = 1 - Math.pow(1 - t, 3)
      const radius = r.radius + (r.radiusEnd - r.radius) * e
      const alpha = r.alpha * (1 - t) * 0.85
      const x = cam.X(r.x)
      const y = cam.Y(r.y)
      const rx = Math.max(0.6, radius * cam.scale)
      const ry = Math.max(0.6, radius * r.squash * cam.scale)
      ctx.globalAlpha = alpha
      ctx.strokeStyle = r.color
      ctx.lineWidth = Math.max(1, r.width * cam.scale * (1 - t * 0.6))
      ctx.beginPath()
      ctx.ellipse(x, y, rx, ry, 0, 0, TAU)
      ctx.stroke()
      if (this.glow) {
        ctx.globalAlpha = alpha * 0.25
        ctx.lineWidth *= 3.4
        ctx.stroke()
      }
    }

    // bolts
    for (const b of this.bolts) {
      const t = 1 - b.life / b.max
      const alpha = Math.sin((1 - t) * Math.PI) * 0.95
      const jitterX = t < 0.6 ? rand(-2, 2) : 0
      for (let pass = 0; pass < 2; pass++) {
        ctx.globalAlpha = pass === 0 ? alpha * 0.28 : alpha
        ctx.strokeStyle = pass === 0 ? b.color : '#ffffff'
        ctx.lineWidth = (pass === 0 ? b.width * 3 : b.width) * cam.scale
        ctx.beginPath()
        b.points.forEach((p, i) => {
          const x = cam.X(p.x + jitterX * (pass + 1))
          const y = cam.Y(p.y)
          if (i === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        })
        ctx.stroke()
        for (const branch of b.branches) {
          ctx.beginPath()
          branch.forEach((p, i) => {
            const x = cam.X(p.x)
            const y = cam.Y(p.y)
            if (i === 0) ctx.moveTo(x, y)
            else ctx.lineTo(x, y)
          })
          ctx.stroke()
        }
      }
    }

    // particles
    for (const p of this.particles) {
      const t = 1 - p.life / p.max
      const alpha = p.alpha * (p.fade === 'ease' ? Math.pow(1 - t, 1.3) : 1 - t)
      if (alpha <= 0.01) continue
      const x = cam.X(p.x)
      const y = cam.Y(p.y)
      const size = Math.max(1, p.size * cam.scale)
      ctx.globalAlpha = alpha
      ctx.fillStyle = p.color
      if (p.shape === 'spark' && (Math.abs(p.vx) + Math.abs(p.vy)) > 10) {
        const vx = p.vx * 0.012 * cam.scale
        const vy = p.vy * 0.012 * cam.scale
        if (this.glow && p.glow) {
          ctx.globalAlpha = alpha * 0.25
          ctx.fillRect(x + vx * 0.5 - 1, y + vy * 0.5 - 1, size * 2.6, size * 2.6)
          ctx.globalAlpha = alpha
        }
        ctx.fillRect(x - Math.abs(vx) / 2, y - Math.abs(vy) / 2, Math.max(1, Math.abs(vx)), Math.max(1, Math.abs(vy)))
      } else if (p.shape === 'shard') {
        ctx.save()
        ctx.translate(x, y)
        ctx.rotate(p.rot)
        ctx.fillRect(-size / 2, -size / 2, size, size * 0.45)
        ctx.restore()
      } else {
        const s = p.shape === 'smoke' ? size * 2.6 : size
        if (this.glow && p.glow) {
          ctx.globalAlpha = alpha * 0.22
          ctx.fillRect(x - s * 1.5, y - s * 1.5, s * 3, s * 3)
          ctx.globalAlpha = alpha
        }
        ctx.fillRect(x - s / 2, y - s / 2, s, s)
      }
    }
    ctx.restore()

    // soft-textured smoke (normal blend) drawn after
    ctx.save()
    for (const p of this.particles) {
      if (p.shape !== 'smoke') continue
      const t = 1 - p.life / p.max
      ctx.globalAlpha = p.alpha * (1 - t) * 0.22
      ctx.fillStyle = p.color
      const x = cam.X(p.x)
      const y = cam.Y(p.y)
      const size = p.size * cam.scale * (1 + t * 2)
      ctx.beginPath()
      ctx.arc(x, y, Math.max(1, size), 0, TAU)
      ctx.fill()
    }
    ctx.restore()

    // floating text
    this._texts(ctx, cam)
  }

  _texts(ctx, cam) {
    if (!this.texts.length) return
    ctx.save()
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    for (const t of this.texts) {
      const p = 1 - t.life / t.max
      const alpha = p < 0.12 ? p / 0.12 : Math.pow(1 - (p - 0.12) / 0.88, 0.8)
      const size = Math.max(7, Math.round(t.size * cam.scale * (1 + Math.sin(Math.min(1, p * 2.4) * Math.PI) * 0.16)))
      ctx.font = `${t.weight === 'bold' ? '700 ' : ''}${size}px Silkscreen, "Courier New", monospace`
      const x = Math.round(cam.X(t.x))
      const y = Math.round(cam.Y(t.y))
      ctx.globalAlpha = alpha * 0.9
      ctx.fillStyle = 'rgba(4,4,10,0.85)'
      ctx.fillText(t.value, x + 1, y + 1)
      ctx.globalAlpha = alpha
      ctx.fillStyle = t.color
      if (this.glow) {
        ctx.globalAlpha = alpha * 0.35
        ctx.fillText(t.value, x, y)
        ctx.globalAlpha = alpha
      }
      ctx.fillText(t.value, x, y)
    }
    ctx.restore()
  }

  _ellipseRune(ctx, x, y, rx, ry, rot, color, alpha, width) {
    ctx.save()
    ctx.globalAlpha = alpha
    ctx.strokeStyle = color
    ctx.lineWidth = Math.max(1, width * 0.9)
    ctx.beginPath()
    ctx.ellipse(x, y, rx, ry, 0, 0, TAU)
    ctx.stroke()
    ctx.globalAlpha = alpha * 0.55
    ctx.beginPath()
    ctx.ellipse(x, y, rx * 0.72, ry * 0.72, 0, 0, TAU)
    ctx.stroke()
    for (let i = 0; i < 8; i++) {
      const a = rot + (i / 8) * TAU
      const ix = x + Math.cos(a) * rx * 0.86
      const iy = y + Math.sin(a) * ry * 0.86
      ctx.fillStyle = i % 2 ? color : '#ffffff'
      ctx.fillRect(ix - 1, iy - 1, 2, 2)
    }
    ctx.restore()
  }

  renderScreen(ctx, width, height) {
    for (const f of this.flashes) {
      const p = f.life / f.max
      ctx.globalAlpha = f.alpha * p
      ctx.fillStyle = f.color
      ctx.fillRect(0, 0, width, height)
    }
    ctx.globalAlpha = 1
  }

  renderGhosts(ctx, cam, drawGhost) {
    for (const g of this.ghosts) {
      const alpha = (g.life / g.max) * 0.5
      drawGhost(ctx, cam, g, g.color, alpha)
    }
  }
}
