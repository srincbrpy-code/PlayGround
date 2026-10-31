// Procedural pixel-art renderer: arena, parallax sky, duelists.
const TAU = Math.PI * 2
const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
const rnd = (a, b) => a + Math.random() * (b - a)

const bg = { key: '', stars: [], mountains: [], dust: [] }
let lastPalette = null

function ensureBackground(w, h) {
  const key = `${w}x${h}`
  if (bg.key === key) return
  bg.key = key
  bg.stars = Array.from({ length: Math.round(w * h / 5200) }, () => ({
    x: Math.random() * w * 1.4 - w * 0.2,
    y: Math.random() * h * 0.72,
    r: Math.random() < 0.82 ? 1 : 2,
    p: Math.random() * TAU,
    s: 0.6 + Math.random() * 1.6,
    c: Math.random() < 0.15 ? '#9fe8ff' : Math.random() < 0.1 ? '#ffc4ef' : '#d8dcff',
  }))
  const layer = (amp, base) => {
    const points = []
    const span = w * 1.5
    const step = Math.max(14, w / 26)
    for (let x = -w * 0.25; x <= span; x += step) {
      points.push({ x, y: base + Math.sin(x * 0.021 + amp) * amp + Math.sin(x * 0.007 - amp * 2) * amp * 1.3 })
    }
    return points
  }
  bg.mountains = [
    { points: layer(22, h * 0.56), color: '#141128', par: 0.04, edge: '#1e1940' },
    { points: layer(30, h * 0.63), color: '#0e0b1e', par: 0.08, edge: '#181333' },
    { points: layer(18, h * 0.7), color: '#080714', par: 0.13, edge: '#120f24' },
  ]
  bg.dust = Array.from({ length: 22 }, () => ({
    x: Math.random() * w,
    y: Math.random() * h,
    r: Math.random() < 0.7 ? 1 : 2,
    sp: 2 + Math.random() * 7,
    p: Math.random() * TAU,
  }))
}

function px(ctx, x, y, w, h, color) {
  ctx.fillStyle = color
  ctx.fillRect(Math.round(x), Math.round(y), Math.max(1, Math.round(w)), Math.max(1, Math.round(h)))
}

function pline(ctx, x1, y1, x2, y2, width, color) {
  const steps = Math.max(2, Math.ceil(Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1)) / Math.max(1, width * 0.6)))
  ctx.fillStyle = color
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const x = Math.round(x1 + (x2 - x1) * t - width / 2)
    const y = Math.round(y1 + (y2 - y1) * t - width / 2)
    ctx.fillRect(x, y, Math.max(1, Math.round(width)), Math.max(1, Math.round(width)))
  }
}

function glowDot(ctx, x, y, r, color, alpha) {
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  ctx.globalAlpha = alpha
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.arc(x, y, r, 0, TAU)
  ctx.fill()
  ctx.restore()
}

// ------------------------------------------------------------------ sky

export function drawSky(ctx, cam, time, palette, settings, stage) {
  const w = cam.width
  const h = cam.height
  ensureBackground(w, h)
  const accent = stage?.accent || palette.trim

  const sky = ctx.createLinearGradient(0, 0, 0, h)
  sky.addColorStop(0, '#04040c')
  sky.addColorStop(0.38, '#080813')
  sky.addColorStop(0.64, '#0f0b20')
  sky.addColorStop(1, '#070610')
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, w, h)

  // aurora veil
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  const aurora = ctx.createRadialGradient(w * 0.52, h * 0.38, 0, w * 0.52, h * 0.38, w * 0.72)
  aurora.addColorStop(0, hexA(accent, 0.05))
  aurora.addColorStop(0.5, hexA(accent, 0.025))
  aurora.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = aurora
  ctx.fillRect(0, 0, w, h)
  ctx.restore()

  // stars
  const drift = -cam.x * 0.02
  for (const st of bg.stars) {
    const tw = 0.45 + 0.55 * Math.abs(Math.sin(time * st.s + st.p))
    if (tw < 0.35) continue
    ctx.globalAlpha = tw * 0.9
    px(ctx, ((st.x + drift) % (w * 1.4) + w * 1.4) % (w * 1.4) - w * 0.2, st.y - cam.y * 0.004, st.r, st.r, st.c)
  }
  ctx.globalAlpha = 1

  // moon
  const moonX = w * 0.74 - cam.x * 0.035
  const moonY = h * 0.24
  const moonR = Math.min(w, h) * 0.155
  const halo = ctx.createRadialGradient(moonX, moonY, moonR * 0.6, moonX, moonY, moonR * 2.9)
  halo.addColorStop(0, hexA(accent, 0.18))
  halo.addColorStop(0.4, hexA(accent, 0.06))
  halo.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = halo
  ctx.fillRect(moonX - moonR * 3, moonY - moonR * 3, moonR * 6, moonR * 6)

  ctx.fillStyle = '#e7e2ff'
  ctx.beginPath()
  ctx.arc(moonX, moonY, moonR, 0, TAU)
  ctx.fill()
  ctx.fillStyle = '#c9c2ea'
  ctx.beginPath()
  ctx.arc(moonX + moonR * 0.16, moonY + moonR * 0.12, moonR * 0.92, 0, TAU)
  ctx.fill()
  ctx.fillStyle = '#d8d2f3'
  ctx.beginPath()
  ctx.arc(moonX - moonR * 0.1, moonY - moonR * 0.06, moonR * 0.75, 0, TAU)
  ctx.fill()
  ctx.fillStyle = 'rgba(150,140,190,0.28)'
  for (const [cx, cy, cr] of [[-0.3, -0.18, 0.16], [0.18, 0.32, 0.12], [0.32, -0.34, 0.09], [-0.05, 0.48, 0.07], [-0.5, 0.3, 0.1]]) {
    ctx.beginPath()
    ctx.arc(moonX + moonR * cx, moonY + moonR * cy, moonR * cr, 0, TAU)
    ctx.fill()
  }
  // eclipse shadow for boss stages
  if (stage?.eclipse) {
    ctx.fillStyle = 'rgba(6,4,14,0.92)'
    ctx.beginPath()
    ctx.arc(moonX + moonR * 0.42, moonY - moonR * 0.2, moonR * 0.98, 0, TAU)
    ctx.fill()
    ctx.strokeStyle = hexA(accent, 0.5)
    ctx.lineWidth = Math.max(1, moonR * 0.045)
    ctx.beginPath()
    ctx.arc(moonX + moonR * 0.42, moonY - moonR * 0.2, moonR * 0.98, 0, TAU)
    ctx.stroke()
  }

  // mountains
  for (const layer of bg.mountains) {
    ctx.fillStyle = layer.color
    ctx.beginPath()
    let first = true
    for (const p of layer.points) {
      const x = p.x - cam.x * layer.par
      const y = p.y
      if (first) { ctx.moveTo(x, h); ctx.lineTo(x, y); first = false }
      else ctx.lineTo(x, y)
    }
    ctx.lineTo(w + w * 0.4, h)
    ctx.closePath()
    ctx.fill()
    ctx.strokeStyle = hexA(layer.edge, 0.4)
    ctx.lineWidth = 1
    ctx.stroke()
  }

  // distant shrine spires
  ctx.save()
  const par = -cam.x * 0.16
  for (const [sx, sh, sw] of [[w * 0.16, h * 0.16, 7], [w * 0.55, h * 0.1, 5], [w * 0.86, h * 0.19, 8]]) {
    const base = h * 0.66
    const x = sx + par
    ctx.fillStyle = '#0b0917'
    ctx.beginPath()
    ctx.moveTo(x - sw, base)
    ctx.lineTo(x - sw * 0.4, base - sh)
    ctx.lineTo(x, base - sh - 6)
    ctx.lineTo(x + sw * 0.4, base - sh)
    ctx.lineTo(x + sw, base)
    ctx.closePath()
    ctx.fill()
    ctx.globalCompositeOperation = 'lighter'
    ctx.globalAlpha = 0.5 + 0.3 * Math.sin(time * 1.4 + sx)
    glowDot(ctx, x, base - sh - 4, 2.2, accent, 0.65)
    ctx.globalCompositeOperation = 'source-over'
    ctx.globalAlpha = 1
  }
  ctx.restore()

  // horizon mist
  const mist = ctx.createLinearGradient(0, h * 0.55, 0, h * 0.84)
  mist.addColorStop(0, 'rgba(20,16,42,0)')
  mist.addColorStop(0.55, hexA(accent, 0.055))
  mist.addColorStop(1, 'rgba(8,6,16,0)')
  ctx.fillStyle = mist
  ctx.fillRect(0, h * 0.5, w, h * 0.4)

  // drifting dust
  for (const d of bg.dust) {
    const x = (d.x + time * d.sp * 0.4 + Math.sin(time * 0.4 + d.p) * 6 - cam.x * 0.05) % w
    ctx.globalAlpha = 0.12 + 0.16 * Math.abs(Math.sin(time * 0.8 + d.p))
    px(ctx, x < 0 ? x + w : x, d.y + Math.sin(time * 0.9 + d.p) * 4, d.r, d.r, accent)
  }
  ctx.globalAlpha = 1
}

// --------------------------------------------------------------- arena

export function drawPlatform(ctx, cam, time, palette, stage) {
  const y = cam.Y(0)
  const x0 = cam.X(-ARENA_HALF - 24)
  const x1 = cam.X(ARENA_HALF + 24)
  const w = x1 - x0
  const depth = ARENA_DEPTH * cam.scale
  const accent = stage?.accent || palette.trim

  // under-glow
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  const glow = ctx.createRadialGradient((x0 + x1) / 2, y + depth * 0.4, 0, (x0 + x1) / 2, y + depth * 0.4, w * 0.5)
  glow.addColorStop(0, hexA(accent, 0.14))
  glow.addColorStop(0.6, hexA(accent, 0.045))
  glow.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = glow
  ctx.beginPath()
  ctx.ellipse((x0 + x1) / 2, y + depth * 0.45, w * 0.5, depth * 1.2, 0, 0, TAU)
  ctx.fill()
  ctx.restore()

  // rocky underside
  const under = ctx.createLinearGradient(0, y, 0, y + depth * 2.4)
  under.addColorStop(0, '#10101e')
  under.addColorStop(0.5, '#0a0914')
  under.addColorStop(1, 'rgba(5,4,10,0)')
  ctx.fillStyle = under
  ctx.beginPath()
  ctx.moveTo(x0 - 4, y)
  ctx.lineTo(x0 + w * 0.06, y + depth * 1.6)
  ctx.lineTo(x0 + w * 0.2, y + depth * 1.05)
  ctx.lineTo(x0 + w * 0.33, y + depth * 2.1)
  ctx.lineTo(x0 + w * 0.48, y + depth * 1.2)
  ctx.lineTo(x0 + w * 0.62, y + depth * 2.3)
  ctx.lineTo(x0 + w * 0.78, y + depth * 1.1)
  ctx.lineTo(x0 + w * 0.9, y + depth * 1.7)
  ctx.lineTo(x1 + 4, y)
  ctx.closePath()
  ctx.fill()

  // front face layers
  ctx.fillStyle = '#0d0c18'
  ctx.fillRect(x0, y, w, depth)
  ctx.fillStyle = '#121022'
  ctx.fillRect(x0 + 2, y + 1, w - 4, depth * 0.5)
  ctx.fillStyle = '#090812'
  ctx.fillRect(x0, y + depth * 0.62, w, depth * 0.38)

  // cracks
  ctx.strokeStyle = 'rgba(90,84,140,0.22)'
  ctx.lineWidth = 1
  for (let i = 0; i < 7; i++) {
    const cx = x0 + (i + 0.5) * (w / 7)
    ctx.beginPath()
    ctx.moveTo(cx, y + 2)
    ctx.lineTo(cx + (i % 2 ? 3 : -4), y + depth * 0.55)
    ctx.lineTo(cx + (i % 2 ? -1 : 2), y + depth * 0.95)
    ctx.stroke()
  }

  // top edge
  ctx.fillStyle = '#24213d'
  ctx.fillRect(x0 - 1, y - 2, w + 2, 3)
  ctx.fillStyle = hexA(accent, 0.7)
  ctx.fillRect(x0 + w * 0.06, y - 2, w * 0.88, 1)
  ctx.fillStyle = 'rgba(255,255,255,0.1)'
  ctx.fillRect(x0, y + 1, w, 1)

  // edge pillars
  for (const dir of [-1, 1]) {
    const ex = cam.X(dir * (ARENA_HALF + 6))
    ctx.fillStyle = '#16142a'
    ctx.fillRect(ex - 3, y - 16 * cam.scale, 6, 16 * cam.scale)
    ctx.fillStyle = hexA(accent, 0.85)
    ctx.fillRect(ex - 1, y - 18 * cam.scale, 2, 3)
    ctx.globalCompositeOperation = 'lighter'
    glowDot(ctx, ex, y - 18 * cam.scale, 5 * cam.scale, accent, 0.12 + 0.05 * Math.sin(time * 2 + dir))
    ctx.globalCompositeOperation = 'source-over'
  }

  // central arena sigil
  ctx.save()
  ctx.translate(cam.X(0), y + depth * 0.42)
  const rx = 42 * cam.scale
  const ry = 9 * cam.scale
  ctx.strokeStyle = hexA(accent, 0.28)
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.ellipse(0, 0, rx, ry, 0, 0, TAU)
  ctx.stroke()
  ctx.beginPath()
  ctx.ellipse(0, 0, rx * 0.62, ry * 0.62, 0, 0, TAU)
  ctx.stroke()
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU + time * 0.14
    const gx = Math.cos(a) * rx * 0.82
    const gy = Math.sin(a) * ry * 0.82
    ctx.fillStyle = hexA(accent, i % 3 === 0 ? 0.65 : 0.28)
    ctx.fillRect(gx, gy, 1, 1)
  }
  ctx.restore()

  // hanging chains
  ctx.strokeStyle = 'rgba(52,48,84,0.55)'
  for (const dir of [-1, 1]) {
    const cx = cam.X(dir * 118)
    ctx.beginPath()
    ctx.moveTo(cx, y + depth)
    for (let i = 0; i < 6; i++) {
      const sway = Math.sin(time * 0.8 + i * 0.7 + dir) * i * 0.6
      ctx.lineTo(cx + sway, y + depth + (i + 1) * 4 * cam.scale)
    }
    ctx.stroke()
  }

  // foreground haze
  const fog = ctx.createLinearGradient(0, y - 8 * cam.scale, 0, y + depth * 2.2)
  fog.addColorStop(0, 'rgba(10,8,20,0)')
  fog.addColorStop(0.5, 'rgba(26,22,52,0.18)')
  fog.addColorStop(1, 'rgba(6,5,12,0)')
  ctx.fillStyle = fog
  ctx.fillRect(x0, y - 8 * cam.scale, w, depth * 2.2)

  // drifting floor energy
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  for (let i = 0; i < 5; i++) {
    const fx = cam.X(-150 + ((time * 14 + i * 60) % 300))
    ctx.globalAlpha = 0.06 + 0.05 * Math.sin(time * 1.5 + i)
    px(ctx, fx, y + 1, 10 * cam.scale, 1, accent)
  }
  ctx.restore()
}

// --------------------------------------------------------------- duelist

const POSES = {
  idle: { hand: [5, -19], blade: -0.48, lean: 0, crouch: 0 },
  strike1: { hand: [11, -23], blade: -0.05, lean: 1.2, crouch: 0 },
  strike2: { hand: [11, -19], blade: 0.35, lean: 1.4, crouch: 0 },
  strike3: { hand: [12, -24], blade: 0.15, lean: 1.8, crouch: 0 },
  heavy: { hand: [11, -17], blade: 0.85, lean: 2.2, crouch: 0.6 },
  parry: { hand: [7, -22], blade: -Math.PI / 2 - 0.2, lean: -0.8, crouch: 0.8 },
  cast: { hand: [11, -22], blade: -1.2, lean: -0.6, crouch: 0.3 },
  guard: { hand: [8, -20], blade: 0, lean: -1.4, crouch: 1.2 },
  hurt: { hand: [2, -15], blade: 1.2, lean: -2.6, crouch: 0.4 },
  stagger: { hand: [0, -13], blade: 1.5, lean: -3, crouch: 1.8 },
  dash: { hand: [7, -21], blade: 0.2, lean: 2.6, crouch: 0.5 },
  dead: { hand: [3, -14], blade: 1.4, lean: -4, crouch: 3 },
}

function blendPose(a, b, t) {
  return {
    hand: [a.hand[0] + (b.hand[0] - a.hand[0]) * t, a.hand[1] + (b.hand[1] - a.hand[1]) * t],
    blade: a.blade + (b.blade - a.blade) * t,
    lean: a.lean + (b.lean - a.lean) * t,
    crouch: a.crouch + (b.crouch - a.crouch) * t,
  }
}

function actionPose(f) {
  const t = f.actionT || 0
  const dur = f.actionDur || 1
  const p = clamp(t / dur, 0, 1)
  const base = POSES[f.drawPose || 'idle'] || POSES.idle
  const target = POSES[f.action] || POSES.idle
  if (f.action === 'strike1' || f.action === 'strike2' || f.action === 'strike3' || f.action === 'heavy') {
    if (p < 0.42) return blendPose(base, { ...target, hand: [-4, -27], blade: -2.5, lean: -1.2, crouch: target.crouch * 0.4 }, p / 0.42)
    if (p < 0.62) return blendPose({ ...target, hand: [-4, -27], blade: -2.5, lean: -1.2, crouch: target.crouch * 0.4 }, target, (p - 0.42) / 0.2)
    return blendPose(target, POSES.idle, Math.min(1, (p - 0.62) / 0.38))
  }
  if (f.action === 'cast') {
    if (p < 0.5) return blendPose(base, target, p / 0.5)
    return blendPose(target, POSES.idle, (p - 0.5) / 0.5)
  }
  if (f.action === 'parry') {
    if (p < 0.18) return blendPose(base, target, p / 0.18)
    if (p < 0.5) return target
    return blendPose(target, POSES.idle, (p - 0.5) / 0.5)
  }
  if (f.action === 'hurt' || f.action === 'stagger') {
    return blendPose(base, target, Math.min(1, p * 5))
  }
  if (f.action === 'dash') return target
  if (f.action === 'dead') return target
  return base
}

export function drawFighter(ctx, cam, f, time, opts = {}) {
  const s = cam.scale * 1.62
  const palette = opts.palette || f.palette
  const ghost = opts.ghost || null
  const ghostColor = opts.ghostColor
  const alpha = opts.alpha ?? 1
  const flash = f.flash > 0 && !ghost

  const footX = cam.X(f.x)
  const footY = cam.Y(f.y)
  if (!Number.isFinite(footX) || !Number.isFinite(footY)) return
  const d = f.facing >= 0 ? 1 : -1
  const pose = opts.pose || actionPose(f)
  const t = f.animTime || time
  const moving = f.grounded && Math.abs(f.vx) > 8
  const walk = moving ? Math.sin(t * 13) * clamp(Math.abs(f.vx) / 80, 0, 1) : 0
  const bob = f.grounded ? (moving ? Math.abs(Math.sin(t * 13)) * 0.9 : Math.sin(t * 2.1) * 0.7) : -0.7
  const lean = pose.lean + clamp(f.vx / 190, -1.4, 1.4)
  const crouch = pose.crouch

  const anchorX = Math.round(footX)
  const anchorY = Math.round(footY)

  const color = key => {
    if (ghostColor) return ghostColor
    if (flash) return '#ffffff'
    return palette[key]
  }

  const boots = color('cloakDark')
  const cloak = color('cloak')
  const cloakLight = color('cloakLight')
  const trim = color('trim')
  const accent = color('accent')
  const blade = color('blade')
  const glow = color('glow')
  const eye = color('eye')
  const metal = color('metal')

  ctx.save()
  ctx.globalAlpha = alpha
  if (ghost) {
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
  }

  const L = (x, y) => anchorX + x * d * s
  const V = (y) => anchorY + (y - crouch) * s

  // contact shadow
  if (!ghost && f.grounded) {
    ctx.globalAlpha = alpha * 0.4
    ctx.fillStyle = '#000000'
    ctx.beginPath()
    ctx.ellipse(anchorX, anchorY + 1, 8 * s, 2.2 * s, 0, 0, TAU)
    ctx.fill()
    ctx.globalAlpha = alpha * 0.22
    ctx.fillStyle = glow
    ctx.beginPath()
    ctx.ellipse(anchorX, anchorY + 1, 7 * s, 1.6 * s, 0, 0, TAU)
    ctx.fill()
    ctx.globalAlpha = alpha
  }

  // back arm
  const shoulder = [0, -24.5]
  const backHand = [-4.5 + walk * 1.4, -18 + bob]
  pline(ctx, L(shoulder[0], 0), V(shoulder[1]), L(-2 + walk, 0), V(-21), Math.max(1.4, 2.1 * s), color('cloakDark'))
  pline(ctx, L(-2 + walk, 0), V(-21), L(backHand[0], 0), V(backHand[1]), Math.max(1.3, 1.9 * s), color('cloakDark'))

  // legs
  const hipY = -13.5
  const air = !f.grounded
  const legSpread = air ? 2.2 : 2.5
  const fFoot = air ? [4.4, -3.5] : [legSpread + walk * 4.2, 0]
  const bFoot = air ? [-3.6, -2] : [-legSpread - walk * 4.2, 0]
  const kneeF = air ? [4.8, -8] : [legSpread * 0.9 + walk * 2.4, -7]
  const kneeB = air ? [-4, -7] : [-legSpread * 0.9 - walk * 2.4, -6.5]
  pline(ctx, L(0, 0), V(hipY), L(kneeB[0], 0), V(kneeB[1]), Math.max(1.5, 2.3 * s), color('cloakDark'))
  pline(ctx, L(kneeB[0], 0), V(kneeB[1]), L(bFoot[0], 0), V(bFoot[1]), Math.max(1.4, 2.1 * s), color('cloakDark'))
  pline(ctx, L(-1, 0), V(hipY), L(kneeF[0], 0), V(kneeF[1]), Math.max(1.6, 2.5 * s), cloak)
  pline(ctx, L(kneeF[0], 0), V(kneeF[1]), L(fFoot[0], 0), V(fFoot[1]), Math.max(1.5, 2.3 * s), cloak)
  // boots
  px(ctx, L(fFoot[0] - 0.5, V(fFoot[1] - 1.4)), 3.4 * s, 1.5 * s, boots)
  px(ctx, L(bFoot[0] - 0.5, V(bFoot[1] - 1.4)), 3.2 * s, 1.4 * s, boots)

  // cloak body — pixel rows
  const baseY = -25
  const hemY = -7 - crouch * 0.6
  const sway = Math.sin(t * 2.7) * 0.7
  for (let y = baseY; y <= hemY; y += 0.9) {
    const p = (y - baseY) / (hemY - baseY)
    const half = (3.6 + p * 3.2 + (air ? p * 1.2 : 0))
    const cx = -p * 0.8 + lean + sway * p
    px(ctx, L(cx - half, V(y)), half * 2 * s, Math.max(1, 1.15 * s), cloak)
    if (p < 0.55) px(ctx, L(cx - half, V(y)), 1.2 * s, Math.max(1, 1.15 * s), cloakLight)
    // torn hem
    if (p > 0.86 && Math.abs(Math.sin(y * 2.3 + t)) > 0.55) {
      px(ctx, L(cx + half * 0.3, V(y + 0.8)), 1.5 * s, 1.2 * s, cloak)
    }
  }
  // chest trim
  px(ctx, L(-1.1 + lean * 0.3, V(-22)), 1.1 * s, 7 * s, trim)
  px(ctx, L(-1.1 + lean * 0.3, V(-15.5)), 2.4 * s, 1.1 * s, trim)

  // scarf
  const scarfSegments = 5
  for (let i = 0; i < scarfSegments; i++) {
    const sx = -3 - i * 1.5 + Math.sin(t * 4 + i * 0.8) * 0.6 - (moving ? 1.5 : 0)
    const sy = -26 + i * 0.55 + Math.sin(t * 3.2 + i * 0.9) * 1.1
    ctx.globalAlpha = alpha * (0.75 - i * 0.11)
    px(ctx, L(sx, V(sy)), (2.2 - i * 0.25) * s, 1.3 * s, i % 2 ? accent : trim)
  }
  ctx.globalAlpha = alpha

  // hood / head
  const headCenter = -30.5 + bob
  for (let i = 0; i < 9; i++) {
    const yy = headCenter - 4.2 + i * 0.95
    const p = i / 8
    const half = 1.2 + Math.sin(Math.min(1, p * 1.2) * Math.PI * 0.62) * 3.4
    const cx = -1.4 + p * 0.2
    px(ctx, L(cx - half, V(yy)), half * 2 * s, Math.max(1, 1.05 * s), cloakLight)
  }
  // hood ridge + point
  px(ctx, L(-3.4, V(headCenter - 3.2)), 3.4 * s, 1.2 * s, cloak)
  px(ctx, L(-4.6, V(headCenter - 2.2)), 1.8 * s, 1.2 * s, cloak)
  // face void
  px(ctx, L(0.2, V(headCenter - 2.2)), 3.4 * s, 3.3 * s, '#05050c')
  // eyes
  const blink = Math.sin(t * 0.9 + f.seed * 7) > 0.985
  if (!blink && !ghost) {
    px(ctx, L(1.4, V(headCenter - 1.2)), Math.max(1, 1.1 * s), Math.max(1, 0.8 * s), eye)
    if (f.enraged) {
      ctx.save()
      ctx.globalCompositeOperation = 'lighter'
      glowDot(ctx, L(2, 0), V(headCenter - 1.1), 2.6 * s, glow, 0.4)
      ctx.restore()
    }
  }
  // hood cowl
  px(ctx, L(-3, V(-25.8)), 6 * s, 1.4 * s, cloak)
  px(ctx, L(-2, V(-26.8)), 4.4 * s, 1 * s, cloakLight)

  // front arm
  const hand = pose.hand
  const handWX = hand[0] + lean * 0.5
  const handWY = hand[1] + bob * 0.5
  const elbow = [(shoulder[0] + handWX) / 2 + 2.4, (shoulder[1] + handWY) / 2 + 1.6]
  pline(ctx, L(shoulder[0] + 1, 0), V(shoulder[1] + bob * 0.5), L(elbow[0], 0), V(elbow[1]), Math.max(1.7, 2.6 * s), cloakLight)
  pline(ctx, L(elbow[0], 0), V(elbow[1]), L(handWX, 0), V(handWY), Math.max(1.5, 2.3 * s), cloakLight)
  // hand
  px(ctx, L(handWX - 0.8, V(handWY - 0.8)), 2 * s, 2 * s, metal)

  // blade
  const bladeLen = f.action === 'heavy' ? 21 : 18
  const ba = pose.blade + (f.action === 'hurt' || f.action === 'stagger' ? Math.sin(t * 20) * 0.15 : 0)
  const bx = handWX
  const by = handWY
  const tipX = bx + Math.cos(ba) * bladeLen
  const tipY = by + Math.sin(ba) * bladeLen
  const hiltX = bx - Math.cos(ba) * 2.2
  const hiltY = by - Math.sin(ba) * 2.2

  if (ghost) {
    pline(ctx, L(hiltX, 0), V(hiltY), L(tipX, 0), V(tipY), Math.max(1, 2.2 * s), ghostColor)
  } else {
    // glow
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    ctx.globalAlpha = alpha * (0.16 + (f.charge || 0) * 0.2)
    pline(ctx, L(hiltX, 0), V(hiltY), L(tipX, 0), V(tipY), 5 * s, glow)
    ctx.globalAlpha = alpha * 0.3
    pline(ctx, L(hiltX, 0), V(hiltY), L(tipX, 0), V(tipY), 3 * s, trim)
    ctx.restore()
    ctx.globalAlpha = alpha
    // core
    pline(ctx, L(hiltX, 0), V(hiltY), L(tipX, 0), V(tipY), Math.max(1.2, 2 * s), flash ? '#ffffff' : blade)
    px(ctx, L(hiltX - 1.4, V(hiltY - 1.4)), 2.8 * s, 2.8 * s, metal)
    px(ctx, L(hiltX - 2.8, V(hiltY - 0.4)), 1.4 * s, 1 * s, trim)
    // tip glint
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    glowDot(ctx, L(tipX, 0), V(tipY), 2.4 * s, glow, 0.55)
    ctx.restore()
  }

  // parry ward
  if (f.action === 'parry' && f.parryActive) {
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    ctx.globalAlpha = alpha * 0.8
    ctx.strokeStyle = trim
    ctx.lineWidth = Math.max(1, 1.6 * s)
    ctx.beginPath()
    ctx.arc(L(5, 0), V(-20), 12 * s, -1.1, 1.1)
    ctx.stroke()
    ctx.globalAlpha = alpha * 0.32
    ctx.lineWidth = Math.max(2, 4 * s)
    ctx.stroke()
    for (let i = 0; i < 5; i++) {
      const a = -1 + i * 0.5
      const rx = 5 + Math.cos(a) * 12
      const ry = -20 + Math.sin(a) * 12
      px(ctx, L(rx - 0.5, V(ry - 0.5)), 1.4 * s, 1.4 * s, i % 2 ? '#ffffff' : accent)
    }
    ctx.restore()
    ctx.globalAlpha = alpha
  }

  // cast circle
  if (f.action === 'cast') {
    const p = clamp(f.actionT / (f.actionDur || 0.5), 0, 1)
    const cx = handWX + 2
    const cy = handWY - 1
    const r = (3 + p * 6) * s
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    ctx.globalAlpha = alpha * Math.min(1, p * 2)
    ctx.strokeStyle = f.castColor || glow
    ctx.lineWidth = Math.max(1, 1.2 * s)
    ctx.beginPath()
    ctx.arc(L(cx, 0), V(cy), r, 0, TAU)
    ctx.stroke()
    ctx.globalAlpha *= 0.6
    ctx.beginPath()
    ctx.arc(L(cx, 0), V(cy), r * 0.6, 0, TAU)
    ctx.stroke()
    for (let i = 0; i < 4; i++) {
      const a = time * 5 + (i / 4) * TAU
      px(ctx, L(cx + Math.cos(a) * r / s, V(cy + Math.sin(a) * r / s)), 1.4 * s, 1.4 * s, '#ffffff')
    }
    ctx.restore()
    ctx.globalAlpha = alpha
  }

  // guard sparkle
  if (f.action === 'guard') {
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    ctx.globalAlpha = alpha * (0.22 + 0.1 * Math.sin(t * 6))
    ctx.fillStyle = trim
    ctx.beginPath()
    ctx.arc(L(7, 0), V(-20), 14 * s, -1.2, 1.2)
    ctx.lineWidth = 2 * s
    ctx.strokeStyle = trim
    ctx.stroke()
    ctx.restore()
  }

  // status frost
  if (f.slowT > 0) {
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    ctx.globalAlpha = alpha * 0.22
    for (let i = 0; i < 3; i++) {
      const a = time * 1.4 + i * 2.1
      px(ctx, L(Math.cos(a) * 6, V(-18 + Math.sin(a) * 7)), 1.4 * s, 1.4 * s, '#9fe8ff')
    }
    ctx.restore()
  }

  // boss aura
  if (f.enraged && !ghost) {
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    ctx.globalAlpha = alpha * (0.22 + 0.1 * Math.sin(time * 4))
    ctx.strokeStyle = glow
    ctx.lineWidth = Math.max(1, 1.2 * s)
    ctx.beginPath()
    ctx.ellipse(anchorX, anchorY, 14 * s, 3.4 * s, 0, 0, TAU)
    ctx.stroke()
    for (let i = 0; i < 4; i++) {
      const a = time * 1.8 + (i / 4) * TAU
      glowDot(ctx, anchorX + Math.cos(a) * 12 * s, anchorY - 4 * s + Math.sin(a) * 9 * s, 1.5 * s, glow, 0.5)
    }
    ctx.restore()
  }

  if (ghost) ctx.restore()
  ctx.restore()
}

export function drawGhost(ctx, cam, snapshot, color, alpha) {
  drawFighter(ctx, cam, snapshot, snapshot.animTime || 0, {
    ghost: true,
    ghostColor: color,
    alpha,
    pose: snapshot.pose,
    palette: snapshot.palette,
  })
}

export function drawBladeTrail(ctx, cam, trail, color, alpha = 1) {
  if (!trail || trail.length < 2) return
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  for (let i = 0; i < trail.length; i++) {
    const p = trail[i]
    const a = (i / trail.length) * alpha * 0.7
    if (a <= 0.01) continue
    ctx.globalAlpha = a
    ctx.fillStyle = color
    const size = Math.max(1, (0.8 + (i / trail.length) * 1.8) * cam.scale)
    ctx.fillRect(cam.X(p.x) - size / 2, cam.Y(p.y) - size / 2, size, size)
  }
  ctx.restore()
}

// ------------------------------------------------------------- helpers

export function drawVignette(ctx, width, height) {
  const g = ctx.createRadialGradient(width / 2, height / 2, Math.min(width, height) * 0.35, width / 2, height / 2, Math.max(width, height) * 0.72)
  g.addColorStop(0, 'rgba(0,0,0,0)')
  g.addColorStop(1, 'rgba(0,0,0,0.55)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, width, height)
}

export function drawConfetti(ctx, cam, time, palette) {
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  for (let i = 0; i < 14; i++) {
    const x = (Math.sin(time * 0.4 + i * 1.7) * 0.5 + 0.5) * cam.width
    const y = (time * (8 + i * 0.7) + i * 47) % cam.height
    ctx.globalAlpha = 0.12 + 0.16 * Math.sin(time + i)
    const size = i % 3 === 0 ? 2 : 1
    ctx.fillStyle = i % 4 === 0 ? '#ffffff' : palette.trim
    ctx.fillRect(x, y, size, size)
  }
  ctx.restore()
}

export function hexA(hex, alpha) {
  if (!hex || !hex.startsWith('#')) return `rgba(150,140,255,${alpha})`
  let h = hex.slice(1)
  if (h.length === 3) h = h.split('').map(c => c + c).join('')
  const n = parseInt(h, 16)
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  return `rgba(${r},${g},${b},${alpha})`
}

const ARENA_HALF = 176
const ARENA_DEPTH = 26
