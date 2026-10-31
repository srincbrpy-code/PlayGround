const KEY = 'spellbreak.save.v1'

export const DEFAULT_SETTINGS = {
  resolution: 'auto',      // auto | sharp | balanced | chunky
  effects: 'high',         // low | medium | high | ultra
  shake: true,
  glow: true,
  scanlines: false,
  reduceFlashes: false,
  reduceMotion: false,
  fps: '60',               // 60 | 120 | unlimited
  volume: 0.8,
  sfx: 0.9,
  music: 0.45,
}

export function defaultSave() {
  return {
    version: 1,
    stage: 0,              // 0-based index of the next duel
    highestStage: 1,       // highest stage number reached
    runActive: false,
    difficulty: 'medium',
    points: 3,
    skills: {},
    wins: 0,
    losses: 0,
    highestCleared: 0,
    parries: 0,
    bestCombo: 0,
    totalPoints: 0,
    settings: { ...DEFAULT_SETTINGS },
    seenHelp: false,
    createdAt: Date.now(),
  }
}

function clampNumber(value, min, max, fallback) {
  return Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback
}

export function sanitize(raw) {
  const base = defaultSave()
  if (!raw || typeof raw !== 'object') return base
  const out = { ...base, ...raw }
  out.version = 1
  out.stage = Math.max(0, Math.floor(clampNumber(raw.stage, 0, 9999, 0)))
  out.highestStage = Math.max(1, Math.floor(clampNumber(raw.highestStage, 1, 9999, 1)))
  out.runActive = Boolean(raw.runActive)
  out.difficulty = ['easy', 'medium', 'hard'].includes(raw.difficulty) ? raw.difficulty : 'medium'
  out.points = Math.max(0, Math.floor(clampNumber(raw.points, 0, 9999, 0)))
  out.wins = Math.max(0, Math.floor(clampNumber(raw.wins, 0, 999999, 0)))
  out.losses = Math.max(0, Math.floor(clampNumber(raw.losses, 0, 999999, 0)))
  out.highestCleared = Math.max(0, Math.floor(clampNumber(raw.highestCleared, 0, 9999, 0)))
  out.parries = Math.max(0, Math.floor(clampNumber(raw.parries, 0, 999999, 0)))
  out.bestCombo = Math.max(0, Math.floor(clampNumber(raw.bestCombo, 0, 999999, 0)))
  out.totalPoints = Math.max(0, Math.floor(clampNumber(raw.totalPoints, 0, 999999, 0)))
  out.seenHelp = Boolean(raw.seenHelp)
  out.skills = {}
  if (raw.skills && typeof raw.skills === 'object') {
    for (const [key, value] of Object.entries(raw.skills)) {
      if (/^[a-z]+$/.test(key)) out.skills[key] = Math.max(0, Math.min(9, Math.floor(clampNumber(value, 0, 9, 0))))
    }
  }
  out.settings = { ...DEFAULT_SETTINGS, ...(raw.settings && typeof raw.settings === 'object' ? raw.settings : {}) }
  out.settings.resolution = ['auto', 'sharp', 'balanced', 'chunky'].includes(out.settings.resolution) ? out.settings.resolution : 'auto'
  out.settings.effects = ['low', 'medium', 'high', 'ultra'].includes(out.settings.effects) ? out.settings.effects : 'high'
  out.settings.fps = ['60', '120', 'unlimited'].includes(out.settings.fps) ? out.settings.fps : '60'
  out.settings.shake = Boolean(out.settings.shake)
  out.settings.glow = Boolean(out.settings.glow)
  out.settings.scanlines = Boolean(out.settings.scanlines)
  out.settings.reduceFlashes = Boolean(out.settings.reduceFlashes)
  out.settings.reduceMotion = Boolean(out.settings.reduceMotion)
  out.settings.volume = clampNumber(Number(out.settings.volume), 0, 1, 0.8)
  out.settings.sfx = clampNumber(Number(out.settings.sfx), 0, 1, 0.9)
  out.settings.music = clampNumber(Number(out.settings.music), 0, 1, 0.45)
  return out
}

export function loadSave() {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return defaultSave()
    return sanitize(JSON.parse(raw))
  } catch {
    return defaultSave()
  }
}

export function writeSave(save) {
  try {
    localStorage.setItem(KEY, JSON.stringify(save))
    return true
  } catch {
    return false
  }
}

export function clearSave() {
  try {
    localStorage.removeItem(KEY)
  } catch { /* ignore */ }
}

export { KEY as SAVE_KEY }
