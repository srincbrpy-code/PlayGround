import { Game } from './game.js';
import { POWER_TIME } from './fighter.js';
import { formatTime } from './utils.js';

const $ = (id) => document.getElementById(id);

const canvas = $('stage');
const hud = $('hud');
const title = $('title');
const result = $('result');
const banner = $('banner');
const bannerMain = $('banner-main');
const bannerSub = $('banner-sub');
const combo = $('combo');
const muteBtn = $('mute');
const roundLabel = $('round-label');
const hpYou = $('hp-you');
const hpRival = $('hp-rival');
const hpYouWrap = $('hp-you-wrap');
const hpRivalWrap = $('hp-rival-wrap');
const pwrYou = $('pwr-you');
const pwrRival = $('pwr-rival');
const pwrYouWrap = $('pwr-you-wrap');
const pwrRivalWrap = $('pwr-rival-wrap');
const pwrYouLabel = $('pwr-you-label');
const pwrRivalLabel = $('pwr-rival-label');
const pipsYou = $('pips-you');
const pipsRival = $('pips-rival');
const touchPower = document.querySelector('.tbtn.power');

let bannerTimer = 0;
let game;

function showBanner(main, sub, duration = 1, cls = '') {
  clearTimeout(bannerTimer);
  banner.className = 'banner';
  void banner.offsetWidth;
  bannerMain.textContent = main;
  bannerSub.textContent = sub || '';
  if (cls) banner.classList.add(cls);
  banner.classList.add('show');
  bannerTimer = window.setTimeout(() => banner.classList.remove('show'), Math.max(260, duration * 1000));
}

function statMarkup(label, value) {
  return `<div class="stat"><b>${value}</b><span>${label}</span></div>`;
}

function showResult(data) {
  clearTimeout(bannerTimer);
  banner.classList.remove('show');
  combo.classList.remove('show');
  document.body.classList.remove('in-match');
  hud.classList.add('hidden');
  result.classList.toggle('defeat', !data.win);
  $('result-eyebrow').textContent = `DUEL COMPLETE / ${data.scores.you}—${data.scores.rival}`;
  $('result-title').textContent = data.win ? 'VICTORY' : 'DEFEAT';
  $('result-sub').textContent = data.win ? 'The line is yours.' : 'The rival owns the line.';
  $('stats').innerHTML = [
    statMarkup('HITS', data.stats.hits),
    statMarkup('PARRIES', data.stats.parries),
    statMarkup('DAMAGE', data.stats.damage),
    statMarkup('MAX COMBO', data.stats.maxCombo),
    statMarkup('TIME', formatTime(data.stats.time)),
  ].join('');
  result.classList.remove('hidden');
  result.setAttribute('aria-label', data.win ? 'Victory' : 'Defeat');
}

function startGame() {
  if (game.state !== 'title' && game.state !== 'matchover') return;
  game.sfx.unlock();
  title.classList.add('hidden');
  result.classList.add('hidden');
  hud.classList.remove('hidden');
  document.body.classList.add('in-match');
  combo.classList.remove('show');
  game.startMatch();
}

function updateMute() {
  const muted = game.sfx.muted;
  muteBtn.textContent = muted ? 'SFX OFF' : 'SFX ON';
  muteBtn.classList.toggle('muted', muted);
  muteBtn.setAttribute('aria-pressed', String(muted));
}

class Input {
  constructor() {
    this.held = { left: false, right: false, guard: false };
    this.edges = { jump: false, strike: false, heavy: false, power: false, dash: 0 };
    this.lastJoyDir = 0;
    this.lastTapDir = 0;
    this.lastTapTime = 0;
    this.bind();
  }

  bind() {
    const gameKeys = new Set([
      'arrowleft',
      'arrowright',
      'arrowup',
      'arrowdown',
      ' ',
      'spacebar',
      'a',
      'd',
      'w',
      's',
      'j',
      'k',
      'l',
      'q',
      'shift',
    ]);

    window.addEventListener('keydown', (e) => {
      const k = e.key.toLowerCase();
      if (gameKeys.has(k)) e.preventDefault();
      if (e.repeat) return;

      if (k === 'enter') {
        if (game.state === 'title' || game.state === 'matchover') startGame();
        return;
      }
      if ((k === ' ' || k === 'spacebar') && (game.state === 'title' || game.state === 'matchover')) {
        startGame();
        return;
      }
      if (k === 'r') {
        if (game.state === 'matchover') startGame();
        return;
      }
      if (k === 'm') {
        game.sfx.unlock();
        game.sfx.toggle();
        updateMute();
        return;
      }

      switch (k) {
        case 'a':
        case 'arrowleft':
          this.held.left = true;
          break;
        case 'd':
        case 'arrowright':
          this.held.right = true;
          break;
        case 'w':
        case 'arrowup':
        case ' ':
        case 'spacebar':
          this.edges.jump = true;
          break;
        case 'j':
          this.edges.strike = true;
          break;
        case 'k':
          this.edges.heavy = true;
          break;
        case 'l':
          this.held.guard = true;
          break;
        case 'q':
          this.edges.power = true;
          game.sfx.unlock();
          break;
        case 'shift':
          this.edges.dash = this.held.right ? 1 : this.held.left ? -1 : game.player.facing;
          break;
        default:
          break;
      }
    });

    window.addEventListener('keyup', (e) => {
      const k = e.key.toLowerCase();
      switch (k) {
        case 'a':
        case 'arrowleft':
          this.held.left = false;
          break;
        case 'd':
        case 'arrowright':
          this.held.right = false;
          break;
        case 'l':
          this.held.guard = false;
          break;
        default:
          break;
      }
    });

    window.addEventListener('blur', () => {
      this.held.left = false;
      this.held.right = false;
      this.held.guard = false;
      this.edges = { jump: false, strike: false, heavy: false, power: false, dash: 0 };
    });

    const stick = $('stick');
    const knob = $('knob');
    let stickPointer = null;
    let stickCenter = { x: 0, y: 0 };
    let stickRadius = 1;

    const setStick = (e) => {
      let dx = e.clientX - stickCenter.x;
      let dy = e.clientY - stickCenter.y;
      const dist = Math.hypot(dx, dy);
      if (dist > stickRadius) {
        dx = (dx / dist) * stickRadius;
        dy = (dy / dist) * stickRadius;
      }
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      const nx = dx / stickRadius;
      this.held.left = nx < -0.26;
      this.held.right = nx > 0.26;

      const dir = nx > 0.62 ? 1 : nx < -0.62 ? -1 : 0;
      if (dir && dir !== this.lastJoyDir) {
        const now = performance.now();
        if (now - this.lastTapTime < 300 && dir === this.lastTapDir) {
          this.edges.dash = dir;
        }
        this.lastTapTime = now;
        this.lastTapDir = dir;
      }
      this.lastJoyDir = dir;
    };

    const releaseStick = () => {
      stickPointer = null;
      this.held.left = false;
      this.held.right = false;
      this.lastJoyDir = 0;
      knob.style.transform = 'translate(0px, 0px)';
      stick.classList.remove('active');
    };

    stick.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      game.sfx.unlock();
      stickPointer = e.pointerId;
      const rect = stick.getBoundingClientRect();
      stickCenter = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
      stickRadius = rect.width * 0.34;
      stick.classList.add('active');
      try {
        stick.setPointerCapture(e.pointerId);
      } catch {}
      setStick(e);
    });

    stick.addEventListener('pointermove', (e) => {
      if (e.pointerId !== stickPointer) return;
      e.preventDefault();
      setStick(e);
    });

    for (const evt of ['pointerup', 'pointercancel', 'lostpointercapture']) {
      stick.addEventListener(evt, (e) => {
        if (e.pointerId !== stickPointer) return;
        releaseStick();
      });
    }

    document.querySelectorAll('.tbtn').forEach((btn) => {
      const act = btn.dataset.act;
      const press = (e) => {
        e.preventDefault();
        game.sfx.unlock();
        btn.classList.add('pressed');
        try {
          btn.setPointerCapture(e.pointerId);
        } catch {}
        if (act === 'guard') this.held.guard = true;
        else if (act === 'dash') this.edges.dash = game.player.facing;
        else this.edges[act] = true;
      };
      const release = () => {
        btn.classList.remove('pressed');
        if (act === 'guard') this.held.guard = false;
      };
      btn.addEventListener('pointerdown', press);
      for (const evt of ['pointerup', 'pointercancel', 'lostpointercapture']) btn.addEventListener(evt, release);
    });
  }

  peek() {
    return {
      move: (this.held.right ? 1 : 0) - (this.held.left ? 1 : 0),
      guard: this.held.guard,
      jump: false,
      strike: false,
      heavy: false,
      power: false,
      dash: 0,
    };
  }

  control() {
    const c = {
      move: (this.held.right ? 1 : 0) - (this.held.left ? 1 : 0),
      guard: this.held.guard,
      jump: this.edges.jump,
      strike: this.edges.strike,
      heavy: this.edges.heavy,
      power: this.edges.power,
      dash: this.edges.dash,
    };
    this.edges = { jump: false, strike: false, heavy: false, power: false, dash: 0 };
    return c;
  }
}

const input = new Input();

game = new Game(canvas, {
  banner: showBanner,
  result: showResult,
  syncScore: () => {},
});

$('start').addEventListener('click', startGame);
$('rematch').addEventListener('click', startGame);

muteBtn.addEventListener('click', () => {
  game.sfx.unlock();
  game.sfx.toggle();
  updateMute();
});

updateMute();

// Exposed for debugging and automated play-testing.
window.__POWER__ = { game, input };

window.addEventListener('resize', () => game.resize());
window.addEventListener('orientationchange', () => setTimeout(() => game.resize(), 120));

let playerPowerCue = false;

function syncHud() {
  const p = game.player;
  const e = game.enemy;
  const playing = game.state !== 'title';

  hpYou.style.transform = `scaleX(${Math.max(0, p.hp) / 100})`;
  hpRival.style.transform = `scaleX(${Math.max(0, e.hp) / 100})`;
  hpYouWrap.classList.toggle('low', p.hp <= 28);
  hpRivalWrap.classList.toggle('low', e.hp <= 28);

  const pScale = p.inPower ? p.powerTime / POWER_TIME : p.power / 100;
  const eScale = e.inPower ? e.powerTime / POWER_TIME : e.power / 100;
  pwrYou.style.transform = `scaleX(${Math.max(0, Math.min(1, pScale))})`;
  pwrRival.style.transform = `scaleX(${Math.max(0, Math.min(1, eScale))})`;
  pwrYouWrap.classList.toggle('ready', p.power >= 100 && !p.inPower);
  pwrRivalWrap.classList.toggle('ready', e.power >= 100 && !e.inPower);
  pwrYouWrap.classList.toggle('active', p.inPower);
  pwrRivalWrap.classList.toggle('active', e.inPower);
  pwrYouLabel.textContent = p.inPower ? 'POWER' : p.power >= 100 ? 'READY' : 'POWER';
  pwrRivalLabel.textContent = e.inPower ? 'POWER' : e.power >= 100 ? 'READY' : 'POWER';

  if (game.state === 'fight' && p.power >= 100 && !p.inPower) {
    if (!playerPowerCue) {
      playerPowerCue = true;
      game.sfx.ready();
    }
  } else {
    playerPowerCue = false;
  }

  roundLabel.textContent = playing ? `ROUND ${String(game.round).padStart(2, '0')}` : 'DUEL 01';

  const youPips = pipsYou.querySelectorAll('i');
  const rivalPips = pipsRival.querySelectorAll('i');
  youPips.forEach((el, i) => el.classList.toggle('on', i < game.scores.you));
  rivalPips.forEach((el, i) => el.classList.toggle('on', i < game.scores.rival));

  if (game.state === 'fight' && p.combo >= 2) {
    combo.textContent = `${p.combo} HIT`;
    combo.classList.add('show');
  } else {
    combo.classList.remove('show');
  }

  if (touchPower) {
    touchPower.classList.toggle('ready', p.power >= 100 && !p.inPower);
    touchPower.classList.toggle('active', p.inPower);
  }
}

const STEP = 1 / 60;
let last = performance.now();
let accumulator = 0;

function frame(now) {
  const elapsed = Math.min((now - last) / 1000, 0.12);
  last = now;
  accumulator += elapsed;

  let steps = 0;
  while (accumulator >= STEP && steps < 7) {
    if (game.state === 'fight') {
      game.playerControl = game.hitstopT > 0 ? input.peek() : input.control();
    } else {
      input.control();
      game.playerControl = game.player.emptyControl();
    }
    game.update(STEP);
    accumulator -= STEP;
    steps += 1;
  }
  if (steps === 7) accumulator = 0;

  game.render();
  syncHud();

  requestAnimationFrame(frame);
}

requestAnimationFrame((now) => {
  last = now;
  requestAnimationFrame(frame);
});
