import * as THREE from './node_modules/three/build/three.module.js';

const $ = (selector) => document.querySelector(selector);
const scene = new THREE.Scene();
scene.background = new THREE.Color('#16151c');
scene.fog = new THREE.FogExp2('#16151c', 0.023);
const camera = new THREE.PerspectiveCamera(48, innerWidth / innerHeight, 0.1, 100);
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
$('#viewport').appendChild(renderer.domElement);

const material = (color, roughness = 0.85, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness });
const stone = material('#514a50'), trim = material('#716467'), dark = material('#29272e'), gold = material('#c49a58', .42, .55);
scene.add(new THREE.HemisphereLight('#b7b9d0', '#332821', 1.7));
const moon = new THREE.DirectionalLight('#d5c9b9', 2.4);
moon.position.set(-7, 14, 8); moon.castShadow = true;
moon.shadow.mapSize.set(1024, 1024); moon.shadow.camera.left = -18; moon.shadow.camera.right = 18; moon.shadow.camera.top = 18; moon.shadow.camera.bottom = -18;
scene.add(moon);
const ambientGlow = new THREE.PointLight('#d68e4d', 30, 25, 2);
ambientGlow.position.set(0, 5, 0); scene.add(ambientGlow);
const world = new THREE.Group(); scene.add(world);
function block(parent, x, y, z, sx, sy, sz, mat, cast = true) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat);
  mesh.position.set(x, y, z); mesh.castShadow = cast; mesh.receiveShadow = true; parent.add(mesh); return mesh;
}
const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), material('#343139'));
floor.rotation.x = -Math.PI / 2; floor.position.y = -.13; floor.receiveShadow = true; world.add(floor);
const floorMats = ['#37333a', '#403a40', '#39353d'].map(c => material(c));
for (let x = -7; x <= 7; x++) for (let z = -7; z <= 7; z++) {
  const tile = new THREE.Mesh(new THREE.BoxGeometry(1.94, .12, 1.94), floorMats[Math.abs(x * 7 + z * 13) % 3]);
  tile.position.set(x * 2, -.045, z * 2); tile.receiveShadow = true; world.add(tile);
}
const ring = new THREE.Mesh(new THREE.TorusGeometry(3.1, .045, 5, 72), gold);
ring.rotation.x = Math.PI / 2; ring.position.y = .035; world.add(ring);
for (let i = 0; i < 8; i++) {
  const angle = i * Math.PI / 4;
  const rune = block(world, Math.cos(angle) * 3.1, .05, Math.sin(angle) * 3.1, .13, .025, .4, gold, false);
  rune.rotation.y = -angle;
}
for (let i = -6; i <= 6; i++) for (const side of [-1, 1]) {
  block(world, i * 2, 1.25, side * 14, 1.96, 2.6, .7, i % 3 ? stone : trim);
  block(world, side * 14, 1.25, i * 2, .7, 2.6, 1.96, i % 3 ? stone : trim);
  block(world, i * 2, 2.62, side * 14, 2.05, .18, .8, dark);
}
for (const x of [-11, 11]) for (const z of [-11, 11]) {
  block(world, x, 1.4, z, 1.4, 2.8, 1.4, dark); block(world, x, 1.4, z, 1, 2.75, 1, trim);
  block(world, x, 2.9, z, 1.65, .3, 1.65, stone); block(world, x, .15, z, 1.7, .3, 1.7, gold);
}
const flames = [];
for (const [x, z] of [[-12, -5], [12, -5], [-12, 5], [12, 5], [-5, -12], [5, -12]]) {
  block(world, x, .55, z, .65, 1.1, .65, dark); block(world, x, 1.12, z, .86, .16, .86, gold);
  const flame = new THREE.Mesh(new THREE.OctahedronGeometry(.25, 1), new THREE.MeshBasicMaterial({ color: '#ffac50' }));
  flame.position.set(x, 1.5, z); world.add(flame); flames.push(flame);
  const light = new THREE.PointLight('#ff8c43', 5, 8, 2); light.position.set(x, 1.7, z); scene.add(light);
}
for (let i = 0; i < 3; i++) {
  const dais = new THREE.Mesh(new THREE.CylinderGeometry(4 - i * .42, 4 - i * .42, .16, 12), i === 2 ? trim : dark);
  dais.position.set(0, -.02 + i * .15, -5); dais.receiveShadow = true; dais.castShadow = true; scene.add(dais);
}

const player = new THREE.Group(); scene.add(player);
const skin = material('#ddb797'), cloak = material('#385b61'), leather = material('#2b2930'), steel = material('#c8c9c8', .3, .7);
const body = new THREE.Mesh(new THREE.CapsuleGeometry(.32, .55, 4, 8), cloak); body.position.y = 1.05; body.castShadow = true; player.add(body);
const head = new THREE.Mesh(new THREE.SphereGeometry(.24, 12, 10), skin); head.position.y = 1.72; head.castShadow = true; player.add(head);
const hood = new THREE.Mesh(new THREE.ConeGeometry(.28, .4, 8), material('#b38a58')); hood.position.y = 1.98; hood.castShadow = true; player.add(hood);
const legs = [];
for (const side of [-1, 1]) {
  const leg = new THREE.Mesh(new THREE.CapsuleGeometry(.13, .42, 3, 7), leather); leg.position.set(side * .17, .36, 0); leg.castShadow = true; player.add(leg); legs.push(leg);
}
const sword = new THREE.Group(); sword.position.set(.5, 1, 0); player.add(sword);
block(sword, 0, .38, 0, .1, .76, .055, steel); block(sword, 0, .03, 0, .39, .09, .11, gold); block(sword, 0, -.14, 0, .12, .29, .12, leather);

const chest = new THREE.Group(); chest.position.set(-9, .06, 1.5); scene.add(chest);
block(chest, 0, .32, 0, 1.3, .62, .84, material('#573d2c')); block(chest, 0, .68, 0, 1.34, .16, .88, gold);
const lid = block(chest, 0, .83, 0, 1.28, .22, .82, material('#765238'));
const chestLight = new THREE.PointLight('#edb760', 0, 4); chestLight.position.set(-9, 1.2, 1.5); scene.add(chestLight);

const enemies = [];
function makeEnemy(type, x, z) {
  const boss = type === 'boss', group = new THREE.Group(); scene.add(group);
  const size = boss ? 1.65 : 1; group.scale.setScalar(size);
  const bodyMat = material(boss ? '#50363d' : '#79727a');
  const bone = material(boss ? '#c1a17f' : '#c8bda8');
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(.34, .6, 4, 8), bodyMat); torso.position.y = .96; torso.castShadow = true; group.add(torso);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(.27, 12, 10), bone); skull.position.y = 1.65; skull.castShadow = true; group.add(skull);
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(boss ? .055 : .035, 8, 6), new THREE.MeshBasicMaterial({ color: '#ff4c49' }));
    eye.position.set(side * .1, 1.69, -.24); group.add(eye);
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(.1, .52, 3, 6), bone); arm.position.set(side * .46, 1, 0); arm.rotation.z = side * .45; group.add(arm);
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(.12, .44, 3, 6), dark); leg.position.set(side * .18, .34, 0); group.add(leg);
  }
  const weapon = new THREE.Mesh(new THREE.BoxGeometry(.11, boss ? 1.35 : .95, .12), material(boss ? '#a64b51' : '#77777e', .4, .45));
  weapon.position.set(.52, 1.08, 0); weapon.rotation.z = -.22; group.add(weapon);
  const glow = new THREE.PointLight(boss ? '#ed4444' : '#e35e49', boss ? 2 : .5, 4); glow.position.y = 1.5; group.add(glow);
  const enemy = { type, x, z, hp: boss ? 650 : 125, maxHp: boss ? 650 : 125, group, alive: true, cooldown: 1.2, phase: Math.random() * 5 };
  group.position.set(x, 0, z); enemies.push(enemy); return enemy;
}
makeEnemy('skeleton', -5, 1); makeEnemy('skeleton', 5, -.5); makeEnemy('skeleton', -4, -6); makeEnemy('boss', 1, -7);

const state = { x: 0, z: 7, hp: 100, maxHp: 100, level: 7, xp: 320, gold: 45, shards: 2, attackCd: 0, attackAnim: 0, dodge: 0, dodgeCd: 0, invuln: 0, potionCd: 0, dead: false };
const keys = new Set(), touchMove = new Set();
let started = false, won = false, chestOpened = false, soundOn = false, audioCtx, walkTime = 0, toastTimer = 0, spellCd = 0, cleaveCd = 0;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const setVisible = (selector, visible) => { $(selector).style.display = visible ? '' : 'none'; };
function playTone(frequency, duration = .12, waveform = 'sine', volume = .035) {
  if (!soundOn) return;
  try {
    audioCtx ||= new AudioContext();
    const oscillator = audioCtx.createOscillator(), gain = audioCtx.createGain();
    oscillator.type = waveform; oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(volume, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(.001, audioCtx.currentTime + duration);
    oscillator.connect(gain); gain.connect(audioCtx.destination); oscillator.start(); oscillator.stop(audioCtx.currentTime + duration);
  } catch { /* Audio is optional. */ }
}
function toast(message, duration = 2.4) {
  $('#toast-text').textContent = message;
  $('#toast').classList.add('show'); toastTimer = duration;
}
function log(message, icon = '✦') {
  const feed = $('#combat-feed'), item = document.createElement('div');
  item.innerHTML = `<i class="feed-gold">${icon}</i> ${message}`;
  feed.prepend(item);
  while (feed.children.length > 4) feed.lastElementChild.remove();
}
function updateUI() {
  const healthRatio = clamp(state.hp / state.maxHp, 0, 1);
  $('#health-fill').style.width = `${healthRatio * 100}%`;
  $('#health-label').textContent = `${Math.ceil(state.hp)} / ${state.maxHp}`;
  $('#level').textContent = String(state.level).padStart(2, '0');
  $('#xp-fill').style.width = `${clamp(state.xp / (state.level * 100 - 200), 0, 1) * 100}%`;
  $('#xp-label').textContent = `${state.xp} / ${state.level * 100 - 200} XP`;
  $('#gold-count').textContent = state.gold;
  $('#shard-count').textContent = state.shards;
  const boss = enemies.find(enemy => enemy.type === 'boss');
  if (boss) {
    $('#boss-fill').style.width = `${clamp(boss.hp / boss.maxHp, 0, 1) * 100}%`;
    $('#boss-hp-text').textContent = `${Math.max(0, Math.ceil(boss.hp))} / ${boss.maxHp}`;
    setVisible('#boss-bar', started && boss.alive && distance(state, boss) < 12);
  }
  $('#quest-objective').textContent = boss?.alive ? 'Defeat the Hollow King' : 'Find the ancient treasure chest';
  $('#quest-check').textContent = boss?.alive ? '◌' : '✓';
}
function gainXP(amount) {
  state.xp += amount;
  let threshold = state.level * 100 - 200;
  while (state.xp >= threshold) {
    state.xp -= threshold; state.level++; state.maxHp += 12; state.hp = Math.min(state.maxHp, state.hp + 35);
    threshold = state.level * 100 - 200;
    $('#level-up-label').textContent = `LEVEL ${String(state.level).padStart(2, '0')}`;
    $('#level-up').classList.add('show'); setTimeout(() => $('#level-up').classList.remove('show'), 1500);
    toast(`LEVEL UP — VITALITY INCREASED`); playTone(740, .3, 'triangle', .05);
  }
  updateUI();
}
function nearestEnemy(maxRange = Infinity, facingOnly = false) {
  let target = null, best = maxRange;
  const forward = new THREE.Vector2(Math.sin(player.rotation.y), Math.cos(player.rotation.y));
  for (const enemy of enemies) {
    if (!enemy.alive) continue;
    const dx = enemy.x - state.x, dz = enemy.z - state.z, distanceTo = Math.hypot(dx, dz);
    if (facingOnly && distanceTo > .001 && (dx * forward.x + dz * forward.y) / distanceTo < -.25) continue;
    if (distanceTo < best) { best = distanceTo; target = enemy; }
  }
  return target;
}
function damageEnemy(enemy, amount) {
  if (!enemy?.alive) return;
  enemy.hp -= amount; enemy.hitFlash = .18;
  const towardPlayer = new THREE.Vector3(state.x - enemy.x, 0, state.z - enemy.z).normalize();
  enemy.x -= towardPlayer.x * .22; enemy.z -= towardPlayer.z * .22;
  playTone(enemy.type === 'boss' ? 125 : 210, .08, 'square', .025);
  if (enemy.hp <= 0) {
    enemy.alive = false; enemy.group.visible = false;
    const isBoss = enemy.type === 'boss';
    state.gold += isBoss ? 120 : 14 + Math.floor(Math.random() * 8);
    state.shards += isBoss ? 4 : 1;
    gainXP(isBoss ? 800 : 110);
    log(isBoss ? 'The Hollow King is vanquished!' : 'Undead slain — loot collected.', isBoss ? '☠' : '◈');
    toast(isBoss ? 'THE HOLLOW KING HAS FALLEN' : 'UNDEAD SLAIN — LOOT COLLECTED');
    if (isBoss) victory();
  }
  updateUI();
}
function attack() {
  if (!started || state.dead || state.attackCd > 0) return;
  state.attackCd = .58; state.attackAnim = .28;
  const target = nearestEnemy(3.35, true) || nearestEnemy(2.35);
  if (target) {
    const dx = target.x - state.x, dz = target.z - state.z;
    player.rotation.y = Math.atan2(dx, dz);
    damageEnemy(target, target.type === 'boss' ? 92 : 108);
    log(`Strike lands for ${target.type === 'boss' ? 92 : 108} damage.`, '⚔');
  } else {
    playTone(330, .07, 'triangle', .018);
  }
}
function castSpell() {
  if (!started || state.dead || spellCd > 0) return;
  spellCd = 5;
  const target = nearestEnemy(10);
  if (!target) { toast('NO ENEMY IN FROST LANCE RANGE'); return; }
  player.rotation.y = Math.atan2(target.x - state.x, target.z - state.z);
  damageEnemy(target, 155);
  log(`Frost lance hits for 155 damage.`, '✧'); toast('FROST LANCE — 155 DAMAGE');
  playTone(610, .2, 'sine', .05);
}
function cleave() {
  if (!started || state.dead || cleaveCd > 0) return;
  cleaveCd = 4; state.invuln = Math.max(state.invuln, .32); state.attackAnim = .4;
  let hits = 0;
  for (const enemy of enemies) if (enemy.alive && distance(state, enemy) < 3.8) { damageEnemy(enemy, 105); hits++; }
  toast(hits ? `WHIRLWIND — ${hits} ENEMY${hits > 1 ? 'IES' : ''} HIT` : 'WHIRLWIND — NO ENEMIES NEARBY');
  playTone(280, .2, 'sawtooth', .035);
}
function usePotion() {
  if (!started || state.dead || state.potionCd > 0) return;
  if (state.hp >= state.maxHp) { toast('VITALITY IS ALREADY FULL'); return; }
  state.hp = Math.min(state.maxHp, state.hp + 42); state.potionCd = 12;
  toast('POTION USED — 42 VITALITY RESTORED'); log('A healing draught restores your strength.', '♜');
  playTone(490, .18, 'sine', .04); updateUI();
}
function dodge() {
  if (!started || state.dead || state.dodgeCd > 0) return;
  state.dodge = .28; state.dodgeCd = 1.15; state.invuln = .42;
  playTone(390, .08, 'triangle', .022);
}
function interact() {
  if (!started || state.dead) return;
  if (!chestOpened && Math.hypot(state.x + 9, state.z - 1.5) < 2.4) {
    chestOpened = true; chestLight.intensity = 8; state.gold += 80; state.shards += 2;
    lid.rotation.x = -.9; lid.position.y = .97;
    log('Ancient chest opened: 80 gold and 2 soul shards.', '◈');
    toast('TREASURE FOUND — 80 GOLD + 2 SOUL SHARDS'); playTone(780, .22, 'triangle', .05); updateUI(); return;
  }
  toast('NOTHING TO INTERACT WITH HERE');
}
function hurtPlayer(amount) {
  if (state.invuln > 0 || state.dead) return;
  state.hp = Math.max(0, state.hp - amount); state.invuln = .55;
  $('#game-shell').classList.add('hurt'); setTimeout(() => $('#game-shell').classList.remove('hurt'), 150);
  playTone(95, .15, 'sawtooth', .04); updateUI();
  if (state.hp <= 0) defeat();
}
function victory() {
  if (won) return;
  won = true; state.gold += 120;
  $('#cover-title').innerHTML = 'THE KING<br /><em>IS SILENT</em>';
  $('#cover-copy').textContent = 'The Hollow King is defeated. Your name will be remembered beyond these crypt walls.';
  $('#start-btn').innerHTML = '<span>PLAY AGAIN</span><b>↻</b>';
  $('#quest-title').textContent = 'THE CRYPT IS QUIET';
  $('#quest-desc').innerHTML = 'The Hollow King is no more.<br />Your legend begins.';
  $('#quest-check').textContent = '✓'; $('#quest-objective').textContent = 'The Hollow King is defeated';
  $('#screen-cover').classList.add('visible'); updateUI();
}
function defeat() {
  state.dead = true;
  $('#cover-title').innerHTML = 'LOST TO THE<br /><em>HOLLOW</em>';
  $('#cover-copy').textContent = 'The crypt claims another soul. Rise again and finish what you started.';
  $('#start-btn').innerHTML = '<span>RISE AGAIN</span><b>↻</b>';
  $('#screen-cover').classList.add('visible');
}
function startGame() {
  if (won || state.dead) { location.reload(); return; }
  started = true; $('#screen-cover').classList.remove('visible');
  toast('THE DEAD STIR IN THE DARKNESS'); log('Your descent into the Sunken Crypt begins.', '✦');
  updateUI(); renderer.domElement.focus();
}
function directionFromInput() {
  const x = (keys.has('d') || keys.has('arrowright') || touchMove.has('right') ? 1 : 0) - (keys.has('a') || keys.has('arrowleft') || touchMove.has('left') ? 1 : 0);
  const z = (keys.has('s') || keys.has('arrowdown') || touchMove.has('down') ? 1 : 0) - (keys.has('w') || keys.has('arrowup') || touchMove.has('up') ? 1 : 0);
  const vector = new THREE.Vector2(x, z);
  if (vector.lengthSq()) vector.normalize();
  return vector;
}
function updateEnemies(delta, time) {
  for (const enemy of enemies) {
    if (!enemy.alive) continue;
    enemy.cooldown -= delta; enemy.phase += delta * 2;
    const dx = state.x - enemy.x, dz = state.z - enemy.z, range = Math.hypot(dx, dz) || .001;
    if (range > (enemy.type === 'boss' ? 2.7 : 1.8)) {
      const speed = enemy.type === 'boss' ? 1.05 : 1.35;
      enemy.x += dx / range * speed * delta; enemy.z += dz / range * speed * delta;
      enemy.group.rotation.y = Math.atan2(dx, dz);
    } else if (enemy.cooldown <= 0) {
      enemy.cooldown = enemy.type === 'boss' ? 1.45 : 1.8;
      hurtPlayer(enemy.type === 'boss' ? 15 : 9);
      enemy.group.rotation.x = -.22;
    } else enemy.group.rotation.x = THREE.MathUtils.damp(enemy.group.rotation.x, 0, 4, delta);
    enemy.group.position.set(enemy.x, Math.sin(enemy.phase) * .045, enemy.z);
    if (enemy.hitFlash > 0) enemy.hitFlash -= delta;
    enemy.group.position.y += enemy.hitFlash > 0 ? Math.sin(time * 70) * .045 : 0;
  }
}
function drawMinimap() {
  const canvas = $('#minimap'), context = canvas.getContext('2d');
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = 'rgba(17,18,26,.88)'; context.fillRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = 'rgba(229,185,105,.28)'; context.lineWidth = 2; context.strokeRect(9, 9, 122, 122);
  context.strokeStyle = 'rgba(220,210,190,.12)'; context.beginPath(); context.arc(70, 70, 17, 0, Math.PI * 2); context.stroke();
  const point = (x, z) => ({ x: 70 + x * 4.1, y: 70 + z * 4.1 });
  for (const enemy of enemies) if (enemy.alive) {
    const p = point(enemy.x, enemy.z); context.fillStyle = enemy.type === 'boss' ? '#f26b5f' : '#d97b69';
    context.beginPath(); context.arc(p.x, p.y, enemy.type === 'boss' ? 4.5 : 3, 0, Math.PI * 2); context.fill();
  }
  if (!chestOpened) { const p = point(-9, 1.5); context.fillStyle = '#e5b969'; context.fillRect(p.x - 2, p.y - 2, 4, 4); }
  const p = point(state.x, state.z); context.fillStyle = '#a9d8bd'; context.beginPath(); context.arc(p.x, p.y, 4, 0, Math.PI * 2); context.fill();
  context.strokeStyle = '#a9d8bd'; context.beginPath(); context.moveTo(p.x, p.y); context.lineTo(p.x + Math.sin(player.rotation.y) * 8, p.y + Math.cos(player.rotation.y) * 8); context.stroke();
}
function animate(now = 0) {
  requestAnimationFrame(animate);
  const delta = Math.min(clock.getDelta(), .05), time = now / 1000;
  if (started && !state.dead && !won) {
    const input = directionFromInput(), moving = input.lengthSq() > 0;
    if (moving) {
      const speed = state.dodge > 0 ? 9 : 4.1;
      state.x += input.x * speed * delta; state.z += input.y * speed * delta;
      player.rotation.y = Math.atan2(input.x, input.y); walkTime += delta * (state.dodge > 0 ? 17 : 10);
    }
    state.x = clamp(state.x, -12.1, 12.1); state.z = clamp(state.z, -12.1, 12.1);
    player.position.set(state.x, 0, state.dodge > 0 ? .08 : 0);
    legs[0].rotation.x = moving ? Math.sin(walkTime) * .55 : 0; legs[1].rotation.x = moving ? -Math.sin(walkTime) * .55 : 0;
    if (state.attackAnim > 0) { state.attackAnim -= delta; sword.rotation.z = -Math.sin((state.attackAnim / .28) * Math.PI) * 1.8; }
    else sword.rotation.z = THREE.MathUtils.damp(sword.rotation.z, 0, 12, delta);
    for (const key of ['attackCd', 'dodge', 'dodgeCd', 'invuln', 'potionCd']) state[key] = Math.max(0, state[key] - delta);
    spellCd = Math.max(0, spellCd - delta); cleaveCd = Math.max(0, cleaveCd - delta);
    if (toastTimer > 0 && (toastTimer -= delta) <= 0) $('#toast').classList.remove('show');
    if (!chestOpened && Math.hypot(state.x + 9, state.z - 1.5) < 2.4) setVisible('#interact-prompt', true);
    else setVisible('#interact-prompt', false);
    const potionFill = $('#potion-cooldown'); potionFill.style.height = `${state.potionCd / 12 * 100}%`;
    updateEnemies(delta, time); updateUI(); drawMinimap();
  }
  for (let i = 0; i < flames.length; i++) { flames[i].scale.y = .8 + Math.sin(time * 8 + i) * .25; flames[i].rotation.y += delta * 1.2; }
  const desired = new THREE.Vector3(state.x + 11, 15, state.z + 13);
  camera.position.lerp(desired, 1 - Math.exp(-delta * 3));
  camera.lookAt(state.x, .25, state.z - 1.2); renderer.render(scene, camera);
}
const clock = new THREE.Clock();

$('#start-btn').addEventListener('click', startGame);
$('#help-btn').addEventListener('click', () => $('#help-modal').classList.add('open'));
$('#close-help').addEventListener('click', () => $('#help-modal').classList.remove('open'));
$('#close-help-2').addEventListener('click', () => $('#help-modal').classList.remove('open'));
$('#sound-btn').addEventListener('click', () => {
  soundOn = !soundOn; $('#sound-btn').classList.toggle('enabled', soundOn);
  if (soundOn) { playTone(520, .08); toast('SOUND ENABLED'); } else toast('SOUND MUTED');
});
$('#map-toggle').addEventListener('click', () => $('.minimap-frame').classList.toggle('map-hidden'));
$('#touch-attack').addEventListener('pointerdown', event => { event.preventDefault(); attack(); });
$('#touch-heal').addEventListener('pointerdown', event => { event.preventDefault(); usePotion(); });
for (const button of document.querySelectorAll('[data-move]')) {
  const release = event => { event.preventDefault(); touchMove.delete(button.dataset.move); };
  button.addEventListener('pointerdown', event => { event.preventDefault(); touchMove.add(button.dataset.move); button.setPointerCapture(event.pointerId); });
  button.addEventListener('pointerup', release); button.addEventListener('pointercancel', release); button.addEventListener('lostpointercapture', release);
}
for (const slot of document.querySelectorAll('[data-slot]')) slot.addEventListener('click', () => {
  document.querySelectorAll('[data-slot]').forEach(item => item.classList.toggle('active', item === slot));
  ({ '1': usePotion, '2': attack, '3': castSpell, '4': cleave })[slot.dataset.slot]();
});
renderer.domElement.addEventListener('pointerdown', event => { if (event.button === 0 && started) attack(); });
window.addEventListener('keydown', event => {
  const key = event.key.toLowerCase();
  if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) event.preventDefault();
  keys.add(key);
  if (event.repeat) return;
  if (key === 'j' || key === ' ') dodge();
  if (key === 'e') interact();
  if (key === '1' || key === 'q') usePotion();
  if (key === '2') attack(); if (key === '3') castSpell(); if (key === '4') cleave();
  if (key === 'escape') $('#help-modal').classList.remove('open');
});
window.addEventListener('keyup', event => keys.delete(event.key.toLowerCase()));
window.addEventListener('blur', () => { keys.clear(); touchMove.clear(); });
window.addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight); renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
});
$('#boss-bar').style.display = 'none'; $('#interact-prompt').style.display = 'none';
updateUI(); drawMinimap(); animate();
