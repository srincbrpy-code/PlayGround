// SPELLBREAK — game data & balance
export const VERSION = '1.0.0'
export const TITLE = 'SPELLBREAK'

export const ARENA = {
  halfWidth: 176,
  minX: -164,
  maxX: 164,
  groundY: 0,
  depth: 26,
}

export const PHYSICS = {
  gravity: 980,
  jumpVel: -332,
  moveSpeed: 84,
  groundAccel: 1500,
  airAccel: 760,
  friction: 1900,
  maxFall: 760,
}

export const PARRY = {
  duration: 0.46,
  active: 0.19,
  cooldown: 0.72,
  stagger: 1.05,
  manaGain: 15,
}

export const DASH = {
  speed: 360,
  duration: 0.15,
  cooldown: 1.15,
  iframes: 0.12,
}

export const ATTACKS = {
  light1: {
    windup: 0.1, active: 0.08, recover: 0.18,
    dmg: 7, reach: 32, half: 8, height: 34, kb: 60,
    hitstop: 0.055, shake: 0.18, guardBreak: false, name: 'STRIKE',
  },
  light2: {
    windup: 0.09, active: 0.08, recover: 0.19,
    dmg: 8, reach: 34, half: 9, height: 34, kb: 80,
    hitstop: 0.06, shake: 0.22, guardBreak: false, name: 'STRIKE',
  },
  light3: {
    windup: 0.13, active: 0.1, recover: 0.26,
    dmg: 12, reach: 38, half: 10, height: 36, kb: 150,
    hitstop: 0.095, shake: 0.34, guardBreak: false, name: 'FINISHER',
  },
  heavy: {
    windup: 0.33, active: 0.1, recover: 0.34,
    dmg: 18, reach: 42, half: 11, height: 38, kb: 190,
    hitstop: 0.12, shake: 0.5, guardBreak: true, name: 'BREAKER',
  },
}

export const SPELLS = {
  ember: {
    id: 'ember', key: '1', name: 'EMBER LANCE', sigil: '✦',
    cost: 16, cooldown: 1.9, unlockStage: 1,
    dmg: 12, speed: 260, radius: 5,
    color: '#ff8a3c', glow: '#ffb35c',
    desc: 'Hurl a lance of living fire. Fast, cheap, punishable.',
  },
  frost: {
    id: 'frost', key: '2', name: 'FROST NOVA', sigil: '❄',
    cost: 26, cooldown: 5.8, unlockStage: 3,
    dmg: 10, radius: 62, slow: 0.45, slowTime: 2.6,
    color: '#8fe6ff', glow: '#c9f5ff',
    desc: 'Detonate a ring of frost. Chills and slows everything near you.',
  },
  storm: {
    id: 'storm', key: '3', name: 'STORM SIGIL', sigil: '⚡',
    cost: 38, cooldown: 8.5, unlockStage: 5,
    dmg: 26, radius: 28, delay: 0.62, stun: 0.55,
    color: '#c8a2ff', glow: '#e4d4ff',
    desc: 'Brand the ground with a sigil. Lightning answers a breath later.',
  },
}

export const SPELL_ORDER = ['ember', 'frost', 'storm']

export const DIFFICULTIES = {
  easy: {
    id: 'easy', label: 'EASY', tag: 'MERCIFUL',
    blurb: 'Slower foes. Softer blows. Room to learn the parry.',
    hp: 0.78, dmg: 0.62, aggression: 0.34, reaction: 1.55,
    parryChance: 0.06, windup: 1.28, cooldown: 1.3,
    points: 2, color: '#7cf7c4',
    bars: { threat: 1, wit: 1, reward: 1 },
  },
  medium: {
    id: 'medium', label: 'MEDIUM', tag: 'BALANCED',
    blurb: 'A fair duel. They punish greed, and they learn your habits.',
    hp: 1, dmg: 1, aggression: 0.56, reaction: 1,
    parryChance: 0.24, windup: 1, cooldown: 1,
    points: 3, color: '#6ee7ff',
    bars: { threat: 2, wit: 2, reward: 2 },
  },
  hard: {
    id: 'hard', label: 'HARD', tag: 'RUTHLESS',
    blurb: 'Fast reads, brutal punishes. Every opening costs blood.',
    hp: 1.28, dmg: 1.38, aggression: 0.82, reaction: 0.62,
    parryChance: 0.46, windup: 0.85, cooldown: 0.78,
    points: 4, color: '#ff6bd6',
    bars: { threat: 3, wit: 3, reward: 3 },
  },
}

// 10 handcrafted opponents, then an endless ascension.
export const STAGES = [
  {
    id: 1, name: 'THE WARDEN', title: 'Keeper of the First Gate',
    palette: 'ash', hp: 78, dmg: 0.85, speed: 0.86, spells: ['ember'],
    aggression: 0.34, parryChance: 0.05, preferred: 34, boss: false,
    quote: 'You carry a blade into a house of spells.',
  },
  {
    id: 2, name: 'SABLE', title: 'The Veil That Moves',
    palette: 'violet', hp: 88, dmg: 0.92, speed: 1.18, spells: [],
    aggression: 0.5, parryChance: 0.12, preferred: 30, boss: false,
    quote: 'Blink, and the duel is already decided.',
  },
  {
    id: 3, name: 'HOLLOW PRIEST', title: 'Voice of the Cinder Choir',
    palette: 'ember', hp: 96, dmg: 1, speed: 0.9, spells: ['ember', 'ember'],
    aggression: 0.42, parryChance: 0.1, preferred: 90, boss: false,
    quote: 'Kneel. The flame is a kind of mercy.',
  },
  {
    id: 4, name: 'IRON CANTOR', title: 'The Unbroken Hymn',
    palette: 'iron', hp: 120, dmg: 1.15, speed: 0.78, spells: [],
    aggression: 0.62, parryChance: 0.18, preferred: 26, boss: false,
    quote: 'Steel does not flinch. Steel does not forgive.',
  },
  {
    id: 5, name: 'THE PALE KING', title: 'Sovereign of the Quiet Court',
    palette: 'gold', hp: 138, dmg: 1.08, speed: 1, spells: ['ember', 'storm'],
    aggression: 0.6, parryChance: 0.28, preferred: 40, boss: true,
    quote: 'A crown is only a heavier kind of chain.',
  },
  {
    id: 6, name: 'CINDER DANCER', title: 'She Who Wears the Ember',
    palette: 'cinder', hp: 132, dmg: 1.12, speed: 1.22, spells: ['ember'],
    aggression: 0.78, parryChance: 0.16, preferred: 28, boss: false,
    quote: 'Come closer. I promise the fire is warm.',
  },
  {
    id: 7, name: 'FROST WIDOW', title: 'The Stillness Beneath',
    palette: 'frost', hp: 146, dmg: 1.15, speed: 1.08, spells: ['frost', 'ember'],
    aggression: 0.58, parryChance: 0.3, preferred: 52, boss: false,
    quote: 'Everything ends in silence. I simply hurry it along.',
  },
  {
    id: 8, name: 'THE STORMCALLER', title: 'Conductor of the Black Sky',
    palette: 'storm', hp: 158, dmg: 1.2, speed: 1.06, spells: ['storm', 'ember'],
    aggression: 0.66, parryChance: 0.34, preferred: 84, boss: false,
    quote: 'Raise your blade. The sky will answer for you.',
  },
  {
    id: 9, name: 'THE MIRROR', title: 'A Shape You Almost Recognize',
    palette: 'mirror', hp: 172, dmg: 1.18, speed: 1.14, spells: ['ember', 'frost'],
    aggression: 0.7, parryChance: 0.5, preferred: 34, boss: false,
    quote: 'You parry like a frightened thing. I parry like you.',
  },
  {
    id: 10, name: 'ECLIPSE', title: 'The Last Name of the Dark',
    palette: 'eclipse', hp: 210, dmg: 1.28, speed: 1.12, spells: ['ember', 'frost', 'storm'],
    aggression: 0.78, parryChance: 0.42, preferred: 44, boss: true,
    quote: 'Ten gates. Ten graves. Sit. Be the last one.',
  },
]

export const PALETTES = {
  player: {
    cloak: '#1c2748', cloakDark: '#0e1428', cloakLight: '#3b5088',
    trim: '#6ee7ff', accent: '#a8f4ff', blade: '#c8fbff',
    glow: '#3ed7ff', eye: '#d9fdff', metal: '#8091b5',
  },
  ash: {
    cloak: '#351d24', cloakDark: '#190c11', cloakLight: '#6a3443',
    trim: '#ff7a4d', accent: '#ffb08a', blade: '#ffd0b8',
    glow: '#ff5a2a', eye: '#ffd9c8', metal: '#9c6b5d',
  },
  violet: {
    cloak: '#201833', cloakDark: '#100b1c', cloakLight: '#3b2c5c',
    trim: '#b78cff', accent: '#dcc8ff', blade: '#eadcff',
    glow: '#8a5cff', eye: '#f0e4ff', metal: '#7a6a9e',
  },
  ember: {
    cloak: '#2c1612', cloakDark: '#170a08', cloakLight: '#50251b',
    trim: '#ff9a3c', accent: '#ffd28a', blade: '#ffe4bd',
    glow: '#ff6a1a', eye: '#fff0d8', metal: '#a56a42',
  },
  iron: {
    cloak: '#20232b', cloakDark: '#0e1015', cloakLight: '#3c4352',
    trim: '#aebdd8', accent: '#e3ecff', blade: '#f2f7ff',
    glow: '#8fa8d8', eye: '#f4f8ff', metal: '#9ba7bb',
  },
  gold: {
    cloak: '#2c2415', cloakDark: '#171109', cloakLight: '#514126',
    trim: '#ffd76e', accent: '#fff0b8', blade: '#fff4cc',
    glow: '#ffba2e', eye: '#fffbdc', metal: '#c8a75a',
  },
  cinder: {
    cloak: '#2a1214', cloakDark: '#160809', cloakLight: '#4e2022',
    trim: '#ff5c5c', accent: '#ffb0a0', blade: '#ffd6c8',
    glow: '#ff3030', eye: '#ffe6dc', metal: '#a05050',
  },
  frost: {
    cloak: '#14202b', cloakDark: '#091018', cloakLight: '#264057',
    trim: '#8fe6ff', accent: '#d2f7ff', blade: '#eafcff',
    glow: '#46c8ff', eye: '#f0fdff', metal: '#6b90a8',
  },
  storm: {
    cloak: '#1e1732', cloakDark: '#0d0a18', cloakLight: '#392b58',
    trim: '#c8a2ff', accent: '#e8dcff', blade: '#f4ecff',
    glow: '#9a6bff', eye: '#f6f0ff', metal: '#8573a8',
  },
  mirror: {
    cloak: '#1a1a2e', cloakDark: '#0c0c18', cloakLight: '#33325a',
    trim: '#ff6bd6', accent: '#ffc4ef', blade: '#ffe2f7',
    glow: '#ff3cbf', eye: '#ffeaf9', metal: '#8f6c95',
  },
  eclipse: {
    cloak: '#14101f', cloakDark: '#07050d', cloakLight: '#2b2144',
    trim: '#d8b4ff', accent: '#f0e0ff', blade: '#fff0ff',
    glow: '#b04cff', eye: '#fcefff', metal: '#77648f',
  },
}

export const SKILLS = [
  {
    id: 'vitality', name: 'VITALITY', glyph: '♥', column: 0, row: 1,
    max: 4, costs: [1, 2, 2, 3],
    desc: '+15 maximum health per rank.',
    format: r => `+${15 * r} MAX HP`,
  },
  {
    id: 'focus', name: 'FOCUS', glyph: '◇', column: 1, row: 0,
    max: 3, costs: [1, 2, 3],
    desc: '+15 maximum mana per rank.',
    format: r => `+${15 * r} MAX MANA`,
  },
  {
    id: 'tempo', name: 'TEMPO', glyph: '◈', column: 2, row: 1,
    max: 3, costs: [2, 3, 4],
    desc: '+0.04s parry window and -0.06s parry cooldown per rank.',
    format: r => `+${(0.04 * r).toFixed(2)}s WINDOW`,
  },
  {
    id: 'blade', name: 'BLADE', glyph: '†', column: 1, row: 2,
    max: 3, costs: [2, 3, 4],
    desc: '+12% melee damage per rank.',
    format: r => `+${12 * r}% MELEE`,
  },
  {
    id: 'arcane', name: 'ARCANE', glyph: '✶', column: 3, row: 1,
    max: 3, costs: [2, 3, 4],
    desc: '+18% spell damage per rank.',
    format: r => `+${18 * r}% SPELL`,
  },
  {
    id: 'flow', name: 'FLOW', glyph: '≋', column: 1, row: 3,
    max: 2, costs: [2, 3],
    desc: '+8% move speed and -12% dash cooldown per rank.',
    format: r => `+${8 * r}% SPEED`,
  },
  {
    id: 'siphon', name: 'SIPHON', glyph: '◉', column: 4, row: 2,
    max: 2, costs: [3, 4],
    desc: 'A successful parry restores +10 health per rank.',
    format: r => `+${10 * r} HP ON PARRY`,
  },
  {
    id: 'ward', name: 'WARD', glyph: '⬡', column: 3, row: 3,
    max: 2, costs: [2, 3],
    desc: '-15% damage taken per rank.',
    format: r => `-${15 * r}% DAMAGE TAKEN`,
  },
]

export function deriveStats(skills = {}) {
  const s = id => Math.max(0, skills[id] || 0)
  return {
    maxHp: 100 + 15 * s('vitality'),
    maxMana: 60 + 15 * s('focus'),
    parryWindow: PARRY.active + 0.04 * s('tempo'),
    parryCooldown: Math.max(0.32, PARRY.cooldown - 0.06 * s('tempo')),
    melee: 1 + 0.12 * s('blade'),
    arcane: 1 + 0.18 * s('arcane'),
    speed: 1 + 0.08 * s('flow'),
    dashCooldown: DASH.cooldown * (1 - 0.12 * s('flow')),
    siphon: 10 * s('siphon'),
    resist: 1 - 0.15 * s('ward'),
  }
}

export function unlockedSpells(highestStage = 1) {
  return SPELL_ORDER.filter(id => SPELLS[id].unlockStage <= Math.max(1, highestStage))
}

export function stageFor(index) {
  if (index < STAGES.length) return STAGES[index]
  const base = STAGES[index % STAGES.length]
  const loop = Math.floor(index / STAGES.length)
  const romans = ['', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X']
  const suffix = romans[Math.min(loop, romans.length - 1)]
  return {
    ...base,
    id: index + 1,
    name: `${base.name} ${suffix}`,
    title: loop === 0 ? base.title : `Ascendant Echo · Cycle ${loop + 1}`,
    hp: Math.round(base.hp * (1 + 0.24 * loop)),
    dmg: base.dmg * (1 + 0.14 * loop),
    boss: base.boss || loop % 5 === 4,
    ascended: loop > 0,
  }
}

export const COMBO_WINDOW = 0.62
export const MAX_HP_TRAIL = 0.55
