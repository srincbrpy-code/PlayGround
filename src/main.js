import {
  SPELLS, SPELL_ORDER, SKILLS, DIFFICULTIES, STAGES, deriveStats,
  unlockedSpells, stageFor, VERSION,
} from './config.js'
import { loadSave, writeSave, clearSave, defaultSave } from './save.js'
import { Input } from './input.js'
import { AudioEngine } from './audio.js'
import { Game } from './game.js'

const $ = sel => document.querySelector(sel)
const $$ = sel => Array.from(document.querySelectorAll(sel))
const clamp01 = v => Math.max(0, Math.min(1, v))
const pad = n => String(n).padStart(2, '0')
const roman = n => ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'][Math.min(10, n)] || String(n)

let save = loadSave()
let touchDevice = matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0
let currentScreen = 'title'
let pendingDifficulty = save.difficulty
let selectedSkill = 'vitality'
let skillsReturn = 'title'
let settingsReturn = 'title'
let helpReturn = 'title'
let introTimer = 0
let inFight = false
let paused = false
let lastView = null
let comboTimeout = 0
let toastTimeout = 0
let eraseArmed = false
let eraseTimer = 0
let resetArmed = false
let resetTimer = 0

const screens = $$('.screen')
const hud = $('#hud')
const skillbar = $('#skillbar')
const touch = $('#touch')
const toastEl = $('#toast')
const comboEl = $('#combo')
const comboCount = $('#combo-count')
const spellSlotsEl = $('#spell-slots')

const audio = new AudioEngine(save.settings)
const input = new Input(window)
input.onFirstInput = () => audio.unlock()

const game = new Game($('#game'), {
  settings: save.settings,
  audio,
  input,
  onEvent: handleEvent,
  onHud: handleHud,
})
game.setPlayerStats(deriveStats(save.skills))

// ------------------------------------------------------------------ helpers

function showScreen(name) {
  currentScreen = name
  for (const screen of screens) screen.classList.toggle('active', screen.dataset.screen === name)
}

function hideScreens() {
  currentScreen = ''
  for (const screen of screens) screen.classList.remove('active')
}

function setFightUI(visible) {
  hud.classList.toggle('is-hidden', !visible)
  skillbar.classList.toggle('is-hidden', !visible || touchDevice)
  touch.classList.toggle('is-hidden', !visible || !touchDevice)
  document.body.classList.toggle('in-duel', visible)
  if (!visible) comboEl.classList.remove('show')
}

function showToast(text, kind = 'info') {
  if (!text) return
  toastEl.textContent = text
  toastEl.className = `toast show${kind === 'locked' || kind === 'mana' ? ' is-warn' : kind === 'bad' ? ' is-bad' : ''}`
  clearTimeout(toastTimeout)
  toastTimeout = setTimeout(() => toastEl.classList.remove('show'), 1700)
}

function showCombo(n) {
  if (n < 2) return
  comboCount.textContent = n
  comboEl.classList.add('show')
  clearTimeout(comboTimeout)
  comboTimeout = setTimeout(() => comboEl.classList.remove('show'), 1250)
}

function updatePointLabels() {
  const text = save.points > 0 ? `${save.points} SP` : 'NO SP'
  for (const el of [$('#title-points'), $('#result-points'), $('#sp-points')]) {
    if (!el) continue
    el.textContent = text
  }
  const titlePip = $('#title-points')
  if (titlePip) titlePip.classList.toggle('is-empty', save.points <= 0)
  const resultPip = $('#result-points')
  if (resultPip) resultPip.classList.toggle('is-empty', save.points <= 0)
}

function updateStatsUI() {
  $('#set-wins').textContent = save.wins
  $('#set-losses').textContent = save.losses
  $('#set-parries').textContent = save.parries
  $('#set-combo').textContent = save.bestCombo
  $('#title-wins').textContent = save.wins
  $('#title-parries').textContent = save.parries
}

// ------------------------------------------------------------------- audio

function unlockAudio() {
  audio.unlock()
}

window.addEventListener('pointerdown', () => {
  unlockAudio()
  if (matchMedia('(pointer: coarse)').matches) touchDevice = true
}, { passive: true })
window.addEventListener('keydown', () => unlockAudio(), { once: true })

document.addEventListener('click', event => {
  const btn = event.target.closest('button, .spell-slot')
  if (!btn) return
  if (btn.id && btn.id.includes('back')) audio.play('uiBack')
  else audio.play('ui')
})

// --------------------------------------------------------------- title view

function renderTitle() {
  const diff = DIFFICULTIES[save.difficulty] || DIFFICULTIES.medium
  const stageNumber = save.stage + 1
  const cycle = Math.floor(save.stage / STAGES.length) + 1
  const continuing = save.runActive || save.stage > 0
  $('#play-hint').textContent = continuing
    ? `CONTINUE · GATE ${pad(stageNumber)}${cycle > 1 ? ` · CYCLE ${roman(cycle)}` : ''}`
    : 'BEGIN THE ASCENT'
  const chip = $('#title-diff')
  chip.textContent = diff.label
  chip.style.color = diff.color
  chip.style.borderColor = `${diff.color}66`
  chip.style.background = `${diff.color}12`
  $('#title-best').textContent = `STAGE ${pad(save.highestStage)}`
  updateStatsUI()
  updatePointLabels()
  $('#foot-build').textContent = VERSION
  renderGateList()
}

function renderGateList() {
  const list = $('#gate-list')
  const current = save.stage % STAGES.length
  const cycle = Math.floor(save.stage / STAGES.length)
  const sideLabel = document.querySelector('.side-label')
  if (sideLabel) sideLabel.textContent = cycle > 0 ? `THE TEN GATES · CYCLE ${roman(cycle + 1)}` : 'THE TEN GATES'
  list.innerHTML = STAGES.map((stage, i) => {
    const cleared = i < save.stage
    const isCurrent = i === current && save.runActive
    const classes = ['gate-item']
    if (isCurrent) classes.push('current')
    if (cleared && !isCurrent) classes.push('cleared')
    if (stage.boss) classes.push('boss')
    const label = stage.name.replace(/^THE /, '')
    return `<li class="${classes.join(' ')}"><span class="g-num">${pad(i + 1)}</span><span class="g-name">${label}</span><span class="g-state"></span></li>`
  }).join('')
  if (!save.runActive && save.stage === 0) {
    const first = list.firstElementChild
    if (first) first.classList.add('current')
  }
}

// ------------------------------------------------------------------ gameplay

function play() {
  unlockAudio()
  if (save.stage > 0 || save.runActive) startStage(save.stage)
  else openDifficulty()
}

function startStage(index) {
  clearTimeout(introTimer)
  hideScreens()
  setFightUI(false)
  inFight = false
  paused = false
  save.stage = Math.max(0, index)
  save.runActive = true
  save.highestStage = Math.max(save.highestStage, index + 1)
  writeSave(save)
  game.setPlayerStats(deriveStats(save.skills))
  game.prepareStage(index, save.difficulty, save.highestStage)
  showScreen('vs')
  introTimer = setTimeout(skipVS, 2200)
  renderTitle()
  updatePointLabels()
}

function skipVS() {
  if (!introTimer) return
  clearTimeout(introTimer)
  introTimer = 0
  if (game.state !== 'intro') return
  hideScreens()
  inFight = true
  game.beginFight()
  setFightUI(true)
  unlockAudio()
}

function buildSpellSlots() {
  spellSlotsEl.innerHTML = SPELL_ORDER.map(id => {
    const spell = SPELLS[id]
    return `<div class="spell-slot" data-spell="${id}" role="button" tabindex="0" style="--slot-color:${spell.color}" aria-label="Cast ${spell.name}">
      <div class="slot-top"><span class="slot-key">${spell.key}</span><span class="slot-glyph">${spell.sigil}</span></div>
      <div class="slot-name">${spell.name}</div>
      <div class="slot-bottom"><span class="slot-cost">${spell.cost} MP</span><span class="slot-cd" data-cd></span></div>
      <span class="slot-mask"></span>
    </div>`
  }).join('')
  spellSlotsEl.querySelectorAll('.spell-slot').forEach((slot, i) => {
    const action = `spell${i + 1}`
    const cast = event => {
      event.preventDefault()
      unlockAudio()
      input.setTouch(action, true)
      setTimeout(() => input.setTouch(action, false), 60)
    }
    slot.addEventListener('pointerdown', cast)
    slot.addEventListener('keydown', event => {
      if (event.code === 'Enter' || event.code === 'Space') { event.preventDefault(); cast(event) }
    })
  })
}

function onPrepared({ stage, difficulty }) {
  $('#vs-stage').textContent = `STAGE ${pad(stage.id)}${stage.boss ? ' / BOSS' : ''}`
  $('#vs-diff').textContent = difficulty.label
  $('#vs-diff').style.color = difficulty.color
  $('#vs-name').textContent = stage.name
  $('#vs-title').textContent = stage.title.toUpperCase()
  $('#vs-quote').textContent = `“${stage.quote}”`
  $('#vs-role').textContent = stage.boss ? 'CROWNED FOE' : stage.ascended ? `ASCENDANT · CYCLE ${Math.floor((stage.id - 1) / STAGES.length) + 1}` : 'CHALLENGER'
  $('#vs-boss').textContent = stage.boss ? '✦ CROWNED GATE' : stage.ascended ? '✦ ASCENSION' : ''
  $('#hud-player-name').textContent = 'VESPER'
  $('#hud-enemy-name').textContent = stage.name
  document.documentElement.style.setProperty('--enemy', stage.accent)
  $('#hud-diff').textContent = difficulty.label
  $('#hud-diff').style.color = stage.accent
  $('#hud-stage').textContent = `STAGE ${pad(stage.id)}${stage.boss ? ' · BOSS' : ''}`
  game.render()
}

function handleEvent(type, data) {
  switch (type) {
    case 'prepared':
      onPrepared(data)
      break
    case 'fight':
      inFight = true
      paused = false
      hideScreens()
      setFightUI(true)
      break
    case 'notice':
      showToast(data.text, data.kind)
      break
    case 'combo':
      showCombo(data.combo)
      break
    case 'parry':
      break
    case 'victory':
      finishVictory(data)
      break
    case 'defeat':
      finishDefeat(data)
      break
    default:
      break
  }
}

function handleHud(data) {
  if (!data || !data.player) return
  const p = data.player
  const e = data.enemy
  setWidth($('#hp-fill-p'), p.hp / p.maxHp)
  setWidth($('#hp-lag-p'), p.ghost / p.maxHp)
  setWidth($('#mana-fill-p'), p.mana / p.maxMana)
  setWidth($('#hp-fill-e'), e.hp / e.maxHp)
  setWidth($('#hp-lag-e'), e.ghost / e.maxHp)
  $('#hud-player-name').textContent = p.name
  $('#hud-enemy-name').textContent = e.name
  $('#hud-enemy-name').parentElement.parentElement.classList.toggle('is-enraged', e.enraged)
  if (data.stage) {
    $('#hud-stage').textContent = `STAGE ${pad(data.stage.id)}${data.stage.boss ? ' · BOSS' : ''}`
    $('#hud-diff').textContent = data.difficulty.label
    $('#hud-diff').style.color = data.stage.accent
  }
  for (const slot of spellSlotsEl.querySelectorAll('.spell-slot')) {
    const id = slot.dataset.spell
    const spell = data.spells.find(s => s.id === id)
    if (!spell) continue
    const ratio = spell.total > 0 ? clamp01(spell.cd / spell.total) : 0
    slot.style.setProperty('--cd', String(ratio))
    slot.classList.toggle('locked', spell.locked)
    slot.classList.toggle('ready', spell.ready)
    slot.classList.toggle('insufficient', !spell.locked && !spell.affordable)
    const cd = slot.querySelector('[data-cd]')
    if (cd) cd.textContent = spell.locked ? `G${spell.unlockStage}` : spell.cd > 0.05 ? spell.cd.toFixed(1) : ''
  }
  for (const spellBtn of document.querySelectorAll('#touch [data-spell]')) {
    const spell = data.spells.find(s => s.id === spellBtn.dataset.spell)
    if (!spell) continue
    const ratio = spell.total > 0 ? clamp01(spell.cd / spell.total) : 0
    spellBtn.style.setProperty('--cd', String(ratio))
    spellBtn.classList.toggle('locked', spell.locked)
  }
  setChip($('#cd-parry'), p.parryTotal ? p.parryCd / p.parryTotal : 0)
  setChip($('#cd-dash'), p.dashTotal ? p.dashCd / p.dashTotal : 0)
  if (p.combo >= 2) showCombo(p.combo)
}

function setWidth(el, ratio) {
  if (el) el.style.width = `${clamp01(ratio) * 100}%`
}

function setChip(el, ratio) {
  if (!el) return
  el.style.setProperty('--cd', String(clamp01(ratio)))
  el.classList.toggle('ready', ratio <= 0.001)
}

// -------------------------------------------------------------------- result

function finishVictory(data) {
  const prevUnlocked = unlockedSpells(save.highestStage)
  const stageNumber = data.stageIndex + 1
  const difficulty = DIFFICULTIES[save.difficulty] || DIFFICULTIES.medium
  const firstClear = stageNumber > (save.highestCleared || 0)
  const bonus = firstClear && data.stage.boss ? 2 : 0
  const reward = difficulty.points + bonus

  save.wins += 1
  save.parries += data.stats.parries
  save.bestCombo = Math.max(save.bestCombo, data.stats.maxCombo)
  save.highestCleared = Math.max(save.highestCleared || 0, stageNumber)
  save.points += reward
  save.totalPoints += reward
  save.stage = data.stageIndex + 1
  save.highestStage = Math.max(save.highestStage, save.stage + 1)
  save.runActive = true
  writeSave(save)

  const afterUnlocked = unlockedSpells(save.highestStage)
  const newSpells = afterUnlocked.filter(id => !prevUnlocked.includes(id))
  const next = stageFor(save.stage)
  const view = {
    victory: true,
    stageIndex: data.stageIndex,
    stage: data.stage,
    difficulty,
    stats: data.stats,
    reward,
    bonus,
    firstClear,
    next,
    newSpells,
    summary: `${data.stage.name} YIELDS THE GATE.`,
    notes: [],
    nextLabel: data.stageIndex >= STAGES.length - 1 ? 'ENTER ASCENSION' : 'NEXT DUEL',
  }
  if (newSpells.length) view.notes.push(`ARCANA UNLOCKED · ${newSpells.map(id => SPELLS[id].name).join(' / ')}`)
  if (data.stageIndex >= STAGES.length - 1) view.notes.push('THE TEN GATES ARE BROKEN. THE ASCENSION BEGINS.')
  else view.notes.push(`NEXT · ${next.name}`)
  if (bonus) view.notes.push('FIRST CLEAR OF A CROWNED GATE · +2 SP')
  showResult(view)
}

function finishDefeat(data) {
  save.losses += 1
  save.parries += data.stats.parries
  save.bestCombo = Math.max(save.bestCombo, data.stats.maxCombo)
  writeSave(save)
  const view = {
    victory: false,
    stageIndex: data.stageIndex,
    stage: data.stage,
    difficulty: DIFFICULTIES[save.difficulty] || DIFFICULTIES.medium,
    stats: data.stats,
    reward: 0,
    bonus: 0,
    next: stageFor(save.stage),
    newSpells: [],
    summary: `${data.stage.name} STILL HOLDS THE GATE.`,
    notes: ['RANKS AND POINTS PERSIST. RETRY WITH WHAT YOU LEARNED.'],
    nextLabel: 'RETRY GATE',
  }
  showResult(view)
}

function showResult(view) {
  lastView = view
  inFight = false
  paused = false
  game.state = 'result'
  audio.setMode('menu')
  setFightUI(false)
  clearTimeout(introTimer)
  introTimer = 0
  renderResult(view)
  showScreen('result')
  renderTitle()
  updatePointLabels()
}

function renderResult(view) {
  const number = view.stageIndex + 1
  $('#result-kicker').textContent = `GATE ${pad(number)} ${view.victory ? 'CLEARED' : 'FAILED'}${view.stage.boss ? ' · CROWNED' : ''}`
  const title = $('#result-title')
  title.textContent = view.victory ? 'VICTORY' : 'DEFEAT'
  title.classList.toggle('is-defeat', !view.victory)
  $('#result-sub').textContent = view.summary
  $('#result-time').textContent = formatTime(view.stats.time)
  $('#result-parries').textContent = view.stats.parries
  $('#result-combo').textContent = view.stats.maxCombo
  $('#result-damage').textContent = view.stats.damage
  const reward = $('#result-reward')
  if (view.victory) {
    reward.textContent = `+${view.reward} SKILL POINT${view.reward === 1 ? '' : 'S'}`
    reward.classList.remove('is-none')
  } else {
    reward.textContent = 'NO POINTS EARNED'
    reward.classList.add('is-none')
  }
  $('#result-note').textContent = view.notes.join('  ·  ')
  $('#btn-next').textContent = view.nextLabel
  $('#btn-next').classList.toggle('btn-primary', true)
  $('#result-hint').textContent = view.victory ? 'ENTER FOR NEXT DUEL · ESC FOR TITLE' : 'ENTER TO RETRY · ESC FOR TITLE'
  updatePointLabels()
}

function formatTime(seconds) {
  const s = Math.max(0, Math.floor(seconds || 0))
  return `${pad(Math.floor(s / 60))}:${pad(s % 60)}`
}

// ---------------------------------------------------------------- difficulty

function renderDifficultyCards() {
  const cards = $('#diff-cards')
  cards.innerHTML = ['easy', 'medium', 'hard'].map(id => {
    const d = DIFFICULTIES[id]
    const meter = (label, value) => `<div class="meter"><span>${label}</span><span class="dots">${[1, 2, 3].map(n => `<i class="${n <= value ? 'on' : ''}"></i>`).join('')}</span></div>`
    return `<button class="diff-card${pendingDifficulty === id ? ' selected' : ''}" data-diff="${id}" style="--card-accent:${d.color}" aria-pressed="${pendingDifficulty === id}">
      <span class="card-check"></span>
      <div class="card-top"><span>${d.tag}</span><span class="card-tag">${id === 'easy' ? '01' : id === 'medium' ? '02' : '03'}</span></div>
      <h3>${d.label}</h3>
      <p class="card-blurb">${d.blurb}</p>
      <div class="diff-meters">${meter('THREAT', d.bars.threat)}${meter('WIT', d.bars.wit)}${meter('REWARD', d.bars.reward)}</div>
      <div class="card-reward"><span>PER VICTORY</span><b>+${d.points} SP</b></div>
    </button>`
  }).join('')
  updateDifficultySummary()
}

function updateDifficultySummary() {
  const d = DIFFICULTIES[pendingDifficulty]
  $('#diff-reward').textContent = `+${d.points} SP`
  $('#diff-reward').style.color = d.color
  const warning = $('#diff-warning')
  warning.textContent = save.stage > 0
    ? 'BEGINNING AGAIN RESETS THE GATES TO 01. RANKS AND POINTS REMAIN.'
    : 'THE FIRST ASCENT. EVERY RANK YOU EARN IS YOURS TO KEEP.'
  $('#diff-note').textContent = pendingDifficulty === 'hard'
    ? 'Ruthless foes read faster and punish harder. Victory pays the most.'
    : pendingDifficulty === 'easy'
      ? 'A gentler duel. Learn the parry window before the dark learns you.'
      : 'A fair duel. Skill points are earned at the standard rate.'
  const begin = $('#btn-begin')
  begin.textContent = save.stage > 0 ? 'BEGIN AGAIN' : 'BEGIN ASCENT'
  begin.style.borderColor = d.color
  begin.style.background = d.color
}

function openDifficulty() {
  pendingDifficulty = save.difficulty
  renderDifficultyCards()
  showScreen('difficulty')
}

function chooseDifficulty(id) {
  pendingDifficulty = id
  renderDifficultyCards()
  audio.play('ui')
}

function beginAscent() {
  unlockAudio()
  save.difficulty = pendingDifficulty
  save.stage = 0
  save.runActive = true
  save.highestStage = Math.max(1, save.highestStage)
  writeSave(save)
  startStage(0)
}

// -------------------------------------------------------------------- skills

const SKILL_EDGES = [
  ['focus', 'vitality'], ['focus', 'tempo'], ['focus', 'blade'],
  ['vitality', 'tempo'], ['tempo', 'arcane'], ['tempo', 'flow'],
  ['blade', 'flow'], ['arcane', 'siphon'], ['flow', 'ward'], ['arcane', 'ward'],
]

function openSkills(returnTo) {
  skillsReturn = returnTo
  showScreen('skills')
  renderSkills()
}

function selectSkill(id, announce = false) {
  if (id) selectedSkill = id
  const skill = SKILLS.find(s => s.id === selectedSkill) || SKILLS[0]
  const rank = save.skills[skill.id] || 0
  const maxed = rank >= skill.max
  const cost = maxed ? 0 : skill.costs[rank]
  const canBuy = !maxed && save.points >= cost
  $('#detail-glyph').textContent = skill.glyph
  $('#detail-name').textContent = skill.name
  $('#detail-desc').textContent = skill.desc
  $('#detail-ranks').innerHTML = Array.from({ length: skill.max }, (_, i) => `<i class="${i < rank ? 'on' : ''}"></i>`).join('')
  const current = rank > 0 ? skill.format(rank) : '—'
  const next = maxed ? 'MAX RANK' : `${skill.format(rank + 1)} · ${cost} SP`
  $('#detail-effect').innerHTML = `<div>CURRENT <b>${current}</b></div><div>${maxed ? 'MAX RANK' : 'NEXT'} <b>${next}</b></div>`
  const learn = $('#btn-learn')
  if (maxed) {
    learn.textContent = 'RANK MAXED'
    learn.disabled = true
    learn.classList.add('is-disabled')
  } else if (canBuy) {
    learn.textContent = `LEARN · ${cost} SP`
    learn.disabled = false
    learn.classList.remove('is-disabled')
  } else {
    learn.textContent = `NEED ${cost} SP`
    learn.disabled = true
    learn.classList.add('is-disabled')
  }
  for (const node of document.querySelectorAll('.skill-node')) node.classList.toggle('selected', node.dataset.skill === skill.id)
  if (announce) audio.play('ui')
}

function renderSkills() {
  const board = $('#skill-board')
  board.querySelectorAll('.skill-node').forEach(n => n.remove())
  for (const skill of SKILLS) {
    const rank = save.skills[skill.id] || 0
    const maxed = rank >= skill.max
    const cost = maxed ? 0 : skill.costs[rank]
    const canBuy = !maxed && save.points >= cost
    const node = document.createElement('button')
    node.className = `skill-node${rank > 0 ? ' owned' : ''}${maxed ? ' maxed' : ''}${canBuy ? ' can-buy' : ''}`
    node.dataset.skill = skill.id
    node.style.gridColumn = String(skill.column + 1)
    node.style.gridRow = String(skill.row + 1)
    node.setAttribute('aria-label', `${skill.name}, rank ${rank} of ${skill.max}`)
    node.innerHTML = `
      <span class="node-glyph">${skill.glyph}</span>
      <span class="node-name">${skill.name}</span>
      <span class="node-ranks">${Array.from({ length: skill.max }, (_, i) => `<i class="${i < rank ? 'on' : ''}"></i>`).join('')}</span>
      <span class="node-cost">${maxed ? 'MAX' : `${rank}/${skill.max} · ${cost} SP`}</span>`
    node.addEventListener('click', () => {
      selectSkill(skill.id, true)
    })
    board.appendChild(node)
  }
  $('#sp-points').textContent = save.points > 0 ? `${save.points} SP` : 'NO SP'
  renderArcana()
  selectSkill(selectedSkill)
  requestAnimationFrame(drawSkillLines)
}

function drawSkillLines() {
  if (currentScreen !== 'skills') return
  const board = $('#skill-board')
  const svg = $('#skill-lines')
  if (!board || !svg) return
  const br = board.getBoundingClientRect()
  if (!br.width || !br.height) return
  svg.setAttribute('viewBox', `0 0 ${Math.max(1, br.width)} ${Math.max(1, br.height)}`)
  while (svg.firstChild) svg.removeChild(svg.firstChild)
  const positions = {}
  for (const node of board.querySelectorAll('.skill-node')) {
    const r = node.getBoundingClientRect()
    positions[node.dataset.skill] = { x: r.left - br.left + r.width / 2, y: r.top - br.top + r.height / 2 }
  }
  for (const [a, b] of SKILL_EDGES) {
    const pa = positions[a]
    const pb = positions[b]
    if (!pa || !pb) continue
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line')
    line.setAttribute('x1', pa.x)
    line.setAttribute('y1', pa.y)
    line.setAttribute('x2', pb.x)
    line.setAttribute('y2', pb.y)
    if ((save.skills[a] || 0) > 0 || (save.skills[b] || 0) > 0) line.classList.add('lit')
    svg.appendChild(line)
  }
}

function renderArcana() {
  const unlocked = unlockedSpells(save.highestStage)
  $('#arcana-list').innerHTML = SPELL_ORDER.map(id => {
    const spell = SPELLS[id]
    const isUnlocked = unlocked.includes(id)
    return `<div class="arcana-item${isUnlocked ? ' unlocked' : ''}"><span class="a-glyph">${spell.sigil}</span><span>${spell.name}</span><span class="a-when">${isUnlocked ? 'UNLOCKED' : `GATE ${spell.unlockStage}`}</span></div>`
  }).join('')
}

function learnSkill() {
  const skill = SKILLS.find(s => s.id === selectedSkill)
  if (!skill) return
  const rank = save.skills[skill.id] || 0
  if (rank >= skill.max) return
  const cost = skill.costs[rank]
  if (save.points < cost) {
    showToast(`NEED ${cost} SKILL POINTS`, 'bad')
    audio.play('uiBack')
    return
  }
  save.points -= cost
  save.skills[skill.id] = rank + 1
  save.totalPoints = save.totalPoints || 0
  writeSave(save)
  game.setPlayerStats(deriveStats(save.skills))
  renderSkills()
  updatePointLabels()
  updateStatsUI()
  const maxed = save.skills[skill.id] >= skill.max
  audio.play(maxed ? 'levelup' : 'unlock')
  showToast(`${skill.name} · RANK ${save.skills[skill.id]}${maxed ? ' MAX' : ''}`)
}

function refundSkillPoints() {
  let refund = 0
  for (const skill of SKILLS) {
    const rank = save.skills[skill.id] || 0
    for (let i = 0; i < rank; i++) refund += skill.costs[i]
  }
  if (!refund) {
    showToast('NO POINTS SPENT', 'bad')
    return
  }
  save.points += refund
  save.skills = {}
  writeSave(save)
  game.setPlayerStats(deriveStats(save.skills))
  renderSkills()
  updatePointLabels()
  audio.play('unlock')
  showToast(`REFUNDED ${refund} SKILL POINTS`)
}

// ------------------------------------------------------------------ settings

function syncSettingsUI() {
  const s = save.settings
  for (const seg of $$('.seg[data-setting]')) {
    const key = seg.dataset.setting
    for (const btn of seg.querySelectorAll('button')) btn.classList.toggle('on', s[key] === btn.dataset.value)
  }
  for (const toggle of $$('.toggle[data-toggle]')) {
    const key = toggle.dataset.toggle
    const value = Boolean(s[key])
    toggle.setAttribute('aria-pressed', String(value))
    const label = toggle.querySelector('span')
    if (label) label.textContent = value ? 'ON' : 'OFF'
  }
  for (const slider of $$('input[type="range"][data-volume]')) {
    const key = slider.dataset.volume
    slider.value = String(Math.round((s[key] ?? 0.5) * 100))
    updateSlider(slider)
  }
  document.getElementById('scanlines').classList.toggle('on', Boolean(s.scanlines))
  document.body.classList.toggle('reduce-motion', Boolean(s.reduceMotion))
  updateStatsUI()
}

function updateSlider(slider) {
  const value = Number(slider.value)
  slider.style.setProperty('--fill', `${value}%`)
  const label = document.querySelector(`#${slider.id}-val`)
  if (label) label.textContent = String(value)
}

function applyVisualSettings() {
  game.setSettings(save.settings)
  audio.setSettings(save.settings)
}

function openSettings(returnTo) {
  settingsReturn = returnTo
  syncSettingsUI()
  showScreen('settings')
}

function closeSettings() {
  if (settingsReturn === 'pause') showScreen('pause')
  else if (settingsReturn === 'title') { showScreen('title'); renderTitle() }
  else if (settingsReturn === 'result') showScreen('result')
  else showScreen('title')
}

function openHelp(returnTo) {
  helpReturn = returnTo
  showScreen('help')
}

function closeHelp() {
  if (helpReturn === 'pause') showScreen('pause')
  else if (helpReturn === 'result') showScreen('result')
  else { showScreen('title'); renderTitle() }
}

// --------------------------------------------------------------------- pause

function pauseGame() {
  if (game.state !== 'fight') return
  game.pause()
  paused = true
  setFightUI(false)
  showScreen('pause')
  audio.setMode('menu')
}

function resumeGame() {
  if (game.state !== 'paused') return
  game.resume()
  paused = false
  hideScreens()
  setFightUI(true)
  audio.setMode(game.stage?.boss ? 'boss' : 'fight')
}

function restartDuel() {
  startStage(save.stage)
}

function quitToTitle() {
  clearTimeout(introTimer)
  introTimer = 0
  game.setupAttract()
  inFight = false
  paused = false
  setFightUI(false)
  showScreen('title')
  renderTitle()
  audio.setMode('menu')
}

// ------------------------------------------------------------------- binding

$('#btn-play').addEventListener('click', play)
$('#btn-new').addEventListener('click', () => { audio.play('ui'); openDifficulty() })
$('#btn-skills').addEventListener('click', () => { audio.play('ui'); openSkills('title') })
$('#btn-settings').addEventListener('click', () => { audio.play('ui'); openSettings('title') })
$('#btn-help').addEventListener('click', () => { audio.play('ui'); openHelp('title') })

$('#diff-back').addEventListener('click', () => { showScreen('title'); renderTitle() })
$('#diff-cards').addEventListener('click', event => {
  const card = event.target.closest('.diff-card')
  if (card) chooseDifficulty(card.dataset.diff)
})
$('#btn-begin').addEventListener('click', beginAscent)

$('#skills-back').addEventListener('click', () => {
  if (skillsReturn === 'pause') showScreen('pause')
  else if (skillsReturn === 'result') showScreen('result')
  else { showScreen('title'); renderTitle() }
})
$('#skills-done').addEventListener('click', () => {
  if (skillsReturn === 'pause') showScreen('pause')
  else if (skillsReturn === 'result') showScreen('result')
  else { showScreen('title'); renderTitle() }
})
$('#btn-learn').addEventListener('click', learnSkill)
$('#btn-reset-skills').addEventListener('click', () => {
  if (!resetArmed) {
    resetArmed = true
    $('#btn-reset-skills').textContent = 'CONFIRM RESET'
    clearTimeout(resetTimer)
    resetTimer = setTimeout(() => {
      resetArmed = false
      $('#btn-reset-skills').textContent = 'RESET TREE'
    }, 3500)
    return
  }
  clearTimeout(resetTimer)
  resetArmed = false
  $('#btn-reset-skills').textContent = 'RESET TREE'
  refundSkillPoints()
})

$('#settings-back').addEventListener('click', closeSettings)
$('#settings-done').addEventListener('click', closeSettings)
$('#help-back').addEventListener('click', closeHelp)
$('#help-done').addEventListener('click', closeHelp)

for (const seg of $$('.seg[data-setting]')) {
  seg.addEventListener('click', event => {
    const btn = event.target.closest('button')
    if (!btn) return
    const key = seg.dataset.setting
    save.settings[key] = btn.dataset.value
    writeSave(save)
    syncSettingsUI()
    applyVisualSettings()
    audio.play('ui')
  })
}

for (const toggle of $$('.toggle[data-toggle]')) {
  toggle.addEventListener('click', () => {
    const key = toggle.dataset.toggle
    save.settings[key] = !save.settings[key]
    writeSave(save)
    syncSettingsUI()
    applyVisualSettings()
    audio.play(save.settings[key] ? 'ui' : 'uiBack')
  })
}

for (const slider of $$('input[type="range"][data-volume]')) {
  slider.addEventListener('input', () => {
    const key = slider.dataset.volume
    save.settings[key] = Number(slider.value) / 100
    updateSlider(slider)
    audio.setSettings(save.settings)
    writeSave(save)
  })
}

$('#btn-fullscreen').addEventListener('click', async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen()
    else await document.documentElement.requestFullscreen()
  } catch {
    showToast('FULLSCREEN NOT AVAILABLE', 'bad')
  }
  setTimeout(() => game.resize(), 150)
})

$('#btn-erase').addEventListener('click', () => {
  if (!eraseArmed) {
    eraseArmed = true
    $('#btn-erase').textContent = 'CONFIRM ERASE'
    $('#erase-note').textContent = 'Click again to permanently erase ranks, points, and gate progress.'
    clearTimeout(eraseTimer)
    eraseTimer = setTimeout(() => {
      eraseArmed = false
      $('#btn-erase').textContent = 'ERASE ALL PROGRESS'
      $('#erase-note').textContent = 'This clears skill points, ranks, and gate progress.'
    }, 4500)
    return
  }
  clearTimeout(eraseTimer)
  eraseArmed = false
  clearSave()
  save = defaultSave()
  pendingDifficulty = save.difficulty
  selectedSkill = 'vitality'
  game.setPlayerStats(deriveStats(save.skills))
  game.setupAttract()
  closeSettings()
  hideScreens()
  showScreen('title')
  $('#btn-erase').textContent = 'ERASE ALL PROGRESS'
  $('#erase-note').textContent = 'This clears skill points, ranks, and gate progress.'
  syncSettingsUI()
  renderTitle()
  audio.setSettings(save.settings)
  audio.setMode('menu')
  audio.play('uiBack')
  showToast('PROGRESS ERASED')
})

$('#btn-resume').addEventListener('click', resumeGame)
$('#btn-pause-settings').addEventListener('click', () => openSettings('pause'))
$('#btn-pause-skills').addEventListener('click', () => openSkills('pause'))
$('#btn-restart').addEventListener('click', restartDuel)
$('#btn-quit').addEventListener('click', quitToTitle)

$('#btn-next').addEventListener('click', () => startStage(save.stage))
$('#btn-result-skills').addEventListener('click', () => openSkills('result'))
$('#btn-result-title').addEventListener('click', quitToTitle)

$('#screen-vs').addEventListener('pointerdown', event => {
  if (event.target.closest('button')) return
  skipVS()
})

// ------------------------------------------------------------------- touch

function bindTouchButton(btn) {
  const action = btn.dataset.action
  if (!action) return
  const press = event => {
    event.preventDefault()
    unlockAudio()
    btn.classList.add('active')
    input.setTouch(action, true)
    try { btn.setPointerCapture(event.pointerId) } catch { /* ignore */ }
  }
  const release = event => {
    if (event) event.preventDefault()
    btn.classList.remove('active')
    input.setTouch(action, false)
  }
  btn.addEventListener('pointerdown', press)
  btn.addEventListener('pointerup', release)
  btn.addEventListener('pointercancel', release)
  btn.addEventListener('lostpointercapture', () => {
    btn.classList.remove('active')
    input.setTouch(action, false)
  })
  btn.addEventListener('contextmenu', event => event.preventDefault())
}
for (const btn of document.querySelectorAll('#touch .tbtn')) bindTouchButton(btn)

// ---------------------------------------------------------------- keyboard

window.addEventListener('keydown', event => {
  if (event.target.tagName === 'BUTTON' || event.target.tagName === 'INPUT') {
    if (event.code === 'Escape') { /* allow global escape below */ }
    else return
  }
  if (event.code === 'Escape') {
    event.preventDefault()
    if (currentScreen === 'settings' || currentScreen === 'help') {
      if (currentScreen === 'settings') closeSettings()
      else closeHelp()
      return
    }
    if (currentScreen === 'skills') {
      if (skillsReturn === 'pause') showScreen('pause')
      else if (skillsReturn === 'result') showScreen('result')
      else { showScreen('title'); renderTitle() }
      return
    }
    if (currentScreen === 'difficulty') { showScreen('title'); renderTitle(); return }
    if (currentScreen === 'result') { quitToTitle(); return }
    if (currentScreen === 'pause') { resumeGame(); return }
    if (game.state === 'fight') { pauseGame(); return }
    return
  }
  if (event.code === 'Enter') {
    if (event.target.tagName === 'BUTTON' || event.target.tagName === 'INPUT') return
    if (currentScreen === 'title') { event.preventDefault(); play() }
    else if (currentScreen === 'result') { event.preventDefault(); $('#btn-next').click() }
    else if (currentScreen === 'vs') { event.preventDefault(); skipVS() }
  }
})

// --------------------------------------------------------------- lifecycle

const debounce = (fn, ms) => {
  let t = 0
  return (...args) => {
    clearTimeout(t)
    t = setTimeout(() => fn(...args), ms)
  }
}

window.addEventListener('resize', debounce(() => {
  game.resize()
  if (currentScreen === 'skills') requestAnimationFrame(drawSkillLines)
}, 120))

window.addEventListener('orientationchange', () => setTimeout(() => game.resize(), 220))

document.addEventListener('visibilitychange', () => {
  if (document.hidden && game.state === 'fight') pauseGame()
})

document.addEventListener('contextmenu', event => {
  if (event.target.closest('#touch, #game')) event.preventDefault()
})

// ------------------------------------------------------------------- boot

buildSpellSlots()
syncSettingsUI()
renderTitle()
renderDifficultyCards()
renderArcana()
showScreen('title')
game.setupAttract()
game.start()
updatePointLabels()

document.fonts.ready.then(() => game.render()).catch(() => {})

window.__spellbreak = {
  version: VERSION,
  get save() { return save },
  game,
  startStage,
  skipVS,
  play,
  openSkills,
  openSettings,
  showScreen,
  chooseDifficulty,
  beginAscent,
  pauseGame,
  resumeGame,
  refresh() { renderTitle(); syncSettingsUI(); updatePointLabels() },
}
