// Tiny WebAudio synthesizer — no audio files required.
const NOTE = {
  C2: 65.41, D2: 73.42, E2: 82.41, F2: 87.31, G2: 98.0, A2: 110.0, B2: 123.47,
  C3: 130.81, D3: 146.83, E3: 164.81, F3: 174.61, G3: 196.0, A3: 220.0, B3: 246.94,
  C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.0, A4: 440.0, B4: 493.88,
  C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99, A5: 880.0, B5: 987.77,
  C6: 1046.5, D6: 1174.66, E6: 1318.51, G6: 1567.98, A6: 1760.0,
}

export class AudioEngine {
  constructor(settings) {
    this.settings = settings || {}
    this.ctx = null
    this.master = null
    this.sfxBus = null
    this.musicBus = null
    this.noiseBuffer = null
    this.mode = 'off'
    this.nextPad = 0
    this.nextPluck = 0
    this.chordIndex = 0
    this.intensity = 0
    this.enabled = true
    this._lastSfx = new Map()
  }

  unlock() {
    if (!this.enabled) return
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext
      if (!AC) { this.enabled = false; return }
      try {
        this.ctx = new AC()
        this.master = this.ctx.createGain()
        this.master.gain.value = this.settings.volume ?? 0.8
        this.master.connect(this.ctx.destination)
        this.sfxBus = this.ctx.createGain()
        this.sfxBus.gain.value = this.settings.sfx ?? 0.9
        this.sfxBus.connect(this.master)
        this.musicBus = this.ctx.createGain()
        this.musicBus.gain.value = (this.settings.music ?? 0.45) * 0.5
        this.musicBus.connect(this.master)
        this.noiseBuffer = this._makeNoise()
        this.nextPad = this.ctx.currentTime + 0.1
        this.nextPluck = this.ctx.currentTime + 1.2
      } catch {
        this.enabled = false
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {})
  }

  _makeNoise() {
    const ctx = this.ctx
    const length = Math.floor(ctx.sampleRate * 1.2)
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1
    return buffer
  }

  setSettings(settings) {
    this.settings = settings
    if (!this.ctx) return
    const t = this.ctx.currentTime
    this.master.gain.setTargetAtTime(settings.volume ?? 0.8, t, 0.03)
    this.sfxBus.gain.setTargetAtTime(settings.sfx ?? 0.9, t, 0.03)
    this.musicBus.gain.setTargetAtTime((settings.music ?? 0.45) * 0.5, t, 0.05)
  }

  setMode(mode) {
    if (mode === this.mode) return
    this.mode = mode
    if (!this.ctx) return
    this.chordIndex = 0
    this.nextPad = this.ctx.currentTime + 0.05
    this.nextPluck = this.ctx.currentTime + 0.8
  }

  setIntensity(value) {
    this.intensity = Math.max(0, Math.min(1, value))
  }

  _tone({ freq = 440, end = freq, dur = 0.15, type = 'sine', gain = 0.12, attack = 0.005, release = 0.12, pan = 0, filter = 0, filterEnd = filter, bus = null, delay = 0 }) {
    if (!this.ctx) return
    const ctx = this.ctx
    const t = ctx.currentTime + delay
    const osc = ctx.createOscillator()
    const env = ctx.createGain()
    const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null
    osc.type = type
    osc.frequency.setValueAtTime(Math.max(20, freq), t)
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, end), t + dur)
    env.gain.setValueAtTime(0.0001, t)
    env.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t + attack)
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur + release)
    let node = osc
    if (filter) {
      const biquad = ctx.createBiquadFilter()
      biquad.type = 'lowpass'
      biquad.frequency.setValueAtTime(filter, t)
      biquad.frequency.exponentialRampToValueAtTime(Math.max(60, filterEnd), t + dur)
      biquad.Q.value = 2
      node.connect(biquad)
      node = biquad
    }
    if (panner) {
      panner.pan.value = pan
      node.connect(panner)
      node = panner
    }
    node.connect(env)
    env.connect(bus || this.sfxBus)
    osc.start(t)
    osc.stop(t + dur + release + 0.05)
  }

  _noise({ dur = 0.15, gain = 0.12, filter = 1400, filterEnd = filter, type = 'bandpass', q = 0.8, pan = 0, bus = null, delay = 0 }) {
    if (!this.ctx || !this.noiseBuffer) return
    const ctx = this.ctx
    const t = ctx.currentTime + delay
    const src = ctx.createBufferSource()
    src.buffer = this.noiseBuffer
    const biquad = ctx.createBiquadFilter()
    biquad.type = type
    biquad.frequency.setValueAtTime(filter, t)
    biquad.frequency.exponentialRampToValueAtTime(Math.max(50, filterEnd), t + dur)
    biquad.Q.value = q
    const env = ctx.createGain()
    env.gain.setValueAtTime(0.0001, t)
    env.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t + 0.008)
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null
    src.connect(biquad)
    if (panner) {
      panner.pan.value = pan
      biquad.connect(panner)
      panner.connect(env)
    } else {
      biquad.connect(env)
    }
    env.connect(bus || this.sfxBus)
    src.start(t)
    src.stop(t + dur + 0.02)
  }

  play(name, { pitch = 1, gain = 1, pan = 0 } = {}) {
    if (!this.ctx || !this.settings.sfx) return
    const now = this.ctx.currentTime
    const last = this._lastSfx.get(name) || 0
    if (now - last < 0.018) return
    this._lastSfx.set(name, now)
    const g = gain
    switch (name) {
      case 'ui':
        this._tone({ freq: 720 * pitch, end: 980 * pitch, dur: 0.05, type: 'square', gain: 0.045 * g, pan })
        break
      case 'uiBack':
        this._tone({ freq: 520 * pitch, end: 360 * pitch, dur: 0.08, type: 'square', gain: 0.04 * g, pan })
        break
      case 'swing':
        this._noise({ dur: 0.13, gain: 0.13 * g, filter: 1800, filterEnd: 320, q: 0.6, pan })
        break
      case 'swingHeavy':
        this._noise({ dur: 0.24, gain: 0.16 * g, filter: 900, filterEnd: 180, q: 0.7, pan })
        this._tone({ freq: 140 * pitch, end: 70, dur: 0.18, type: 'triangle', gain: 0.07 * g, pan })
        break
      case 'hit':
        this._noise({ dur: 0.09, gain: 0.17 * g, filter: 1200, filterEnd: 300, pan })
        this._tone({ freq: 150 * pitch, end: 62, dur: 0.11, type: 'square', gain: 0.075 * g, pan })
        break
      case 'hitHeavy':
        this._noise({ dur: 0.2, gain: 0.22 * g, filter: 800, filterEnd: 100, pan })
        this._tone({ freq: 92 * pitch, end: 38, dur: 0.26, type: 'sawtooth', gain: 0.1 * g, pan })
        break
      case 'parry':
        this._tone({ freq: 1760 * pitch, end: 2350, dur: 0.2, type: 'sine', gain: 0.15 * g, pan })
        this._tone({ freq: 2640 * pitch, end: 2100, dur: 0.32, type: 'sine', gain: 0.07 * g, pan })
        this._noise({ dur: 0.12, gain: 0.1 * g, filter: 4200, filterEnd: 1800, type: 'highpass', q: 0.4, pan })
        break
      case 'guard':
        this._tone({ freq: 620 * pitch, end: 380, dur: 0.1, type: 'triangle', gain: 0.08 * g, pan })
        this._noise({ dur: 0.08, gain: 0.08 * g, filter: 2600, filterEnd: 900, pan })
        break
      case 'guardBreak':
        this._tone({ freq: 210, end: 70, dur: 0.3, type: 'sawtooth', gain: 0.12 * g, pan })
        this._noise({ dur: 0.3, gain: 0.18 * g, filter: 2400, filterEnd: 200, pan })
        break
      case 'cast':
        this._tone({ freq: 220 * pitch, end: 880, dur: 0.3, type: 'sawtooth', gain: 0.05 * g, filter: 420, filterEnd: 2600, pan })
        break
      case 'castFire':
        this._noise({ dur: 0.32, gain: 0.16 * g, filter: 260, filterEnd: 2200, q: 0.5, pan })
        this._tone({ freq: 180 * pitch, end: 540, dur: 0.3, type: 'sawtooth', gain: 0.06 * g, filter: 700, filterEnd: 2800, pan })
        break
      case 'castFrost':
        this._tone({ freq: 1400, end: 2600, dur: 0.4, type: 'sine', gain: 0.08 * g, pan })
        this._tone({ freq: 2100, end: 3100, dur: 0.32, type: 'triangle', gain: 0.04 * g, pan })
        this._noise({ dur: 0.4, gain: 0.08 * g, filter: 5200, filterEnd: 2400, type: 'highpass', q: 0.4, pan })
        break
      case 'castStorm':
        this._noise({ dur: 0.5, gain: 0.2 * g, filter: 240, filterEnd: 1200, q: 0.5, pan })
        this._tone({ freq: 70 * pitch, end: 45, dur: 0.5, type: 'sawtooth', gain: 0.1 * g, pan })
        break
      case 'bolt':
        this._noise({ dur: 0.28, gain: 0.25 * g, filter: 6000, filterEnd: 400, type: 'highpass', pan })
        this._tone({ freq: 120, end: 40, dur: 0.35, type: 'sawtooth', gain: 0.14 * g, pan })
        break
      case 'jump':
        this._tone({ freq: 300 * pitch, end: 440, dur: 0.09, type: 'triangle', gain: 0.035 * g, pan })
        break
      case 'land':
        this._noise({ dur: 0.1, gain: 0.09 * g, filter: 500, filterEnd: 120, pan })
        this._tone({ freq: 120, end: 60, dur: 0.12, type: 'sine', gain: 0.05 * g, pan })
        break
      case 'dash':
        this._noise({ dur: 0.18, gain: 0.12 * g, filter: 700, filterEnd: 2600, q: 0.5, pan })
        break
      case 'hurt':
        this._tone({ freq: 230 * pitch, end: 90, dur: 0.16, type: 'square', gain: 0.06 * g, pan })
        break
      case 'death':
        this._tone({ freq: 260 * pitch, end: 48, dur: 0.9, type: 'sawtooth', gain: 0.12 * g, filter: 900, filterEnd: 80, pan })
        this._noise({ dur: 0.7, gain: 0.12 * g, filter: 800, filterEnd: 60, pan })
        break
      case 'victory': {
        const seq = [523.25, 659.25, 783.99, 1046.5]
        seq.forEach((f, i) => this._tone({ freq: f, end: f, dur: 0.24, type: 'triangle', gain: 0.07 * g, delay: i * 0.13, pan }))
        break
      }
      case 'defeat': {
        const seq = [392, 329.63, 261.63, 196]
        seq.forEach((f, i) => this._tone({ freq: f, end: f, dur: 0.4, type: 'sine', gain: 0.06 * g, delay: i * 0.18, pan }))
        break
      }
      case 'levelup': {
        const seq = [523.25, 783.99, 1046.5, 1318.51]
        seq.forEach((f, i) => this._tone({ freq: f, end: f, dur: 0.28, type: 'sine', gain: 0.06 * g, delay: i * 0.1, pan }))
        break
      }
      case 'unlock':
        this._tone({ freq: 880, end: 1320, dur: 0.22, type: 'triangle', gain: 0.07 * g, pan })
        this._tone({ freq: 1320, end: 1760, dur: 0.3, type: 'sine', gain: 0.05 * g, pan })
        break
      default:
        break
    }
  }

  _pad(freqs, dur, gain, bus) {
    if (!this.ctx) return
    const ctx = this.ctx
    const t = ctx.currentTime
    const env = ctx.createGain()
    env.gain.setValueAtTime(0.0001, t)
    env.gain.exponentialRampToValueAtTime(gain, t + 1.2)
    env.gain.setValueAtTime(gain, t + dur - 0.6)
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 900 + this.intensity * 1600
    filter.Q.value = 0.6
    filter.connect(env)
    env.connect(bus || this.musicBus)
    freqs.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      osc.type = i === 0 ? 'triangle' : 'sine'
      osc.frequency.value = freq
      osc.detune.value = (i - 1) * 5
      const vg = ctx.createGain()
      vg.gain.value = i === 0 ? 0.5 : 0.28
      osc.connect(vg)
      vg.connect(filter)
      osc.start(t)
      osc.stop(t + dur + 0.1)
    })
  }

  _pluck(freq) {
    if (!this.ctx) return
    const ctx = this.ctx
    const t = ctx.currentTime
    const osc = ctx.createOscillator()
    const env = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = freq
    env.gain.setValueAtTime(0.0001, t)
    env.gain.exponentialRampToValueAtTime(0.022, t + 0.01)
    env.gain.exponentialRampToValueAtTime(0.0001, t + 0.9)
    osc.connect(env)
    env.connect(this.musicBus)
    osc.start(t)
    osc.stop(t + 0.95)
  }

  update() {
    if (!this.ctx || !this.settings.music || this.mode === 'off' || this.ctx.state !== 'running') return
    const t = this.ctx.currentTime
    if (this.nextPad < t + 0.2) {
      const menuChords = [
        [NOTE.C2, NOTE.G2, NOTE.E3, NOTE.B3],
        [NOTE.A2, NOTE.E3, NOTE.C4, NOTE.G4],
        [NOTE.F2, NOTE.C3, NOTE.A3, NOTE.E4],
        [NOTE.G2, NOTE.D3, NOTE.B3, NOTE.F4],
      ]
      const fightChords = [
        [NOTE.D2, NOTE.A2, NOTE.F3, NOTE.C4],
        [NOTE.B2, NOTE.F3, NOTE.D4, NOTE.A4],
        [NOTE.G2, NOTE.D3, NOTE.B3, NOTE.F4],
        [NOTE.A2, NOTE.E3, NOTE.C4, NOTE.G4],
      ]
      const bossChords = [
        [NOTE.C2, NOTE.G2, NOTE.E3, NOTE.A3],
        [NOTE.A2, NOTE.E3, NOTE.C4, NOTE.F4],
        [NOTE.F2, NOTE.C3, NOTE.A3, NOTE.D4],
        [NOTE.G2, NOTE.D3, NOTE.B3, NOTE.E4],
      ]
      const chords = this.mode === 'boss' ? bossChords : this.mode === 'fight' ? fightChords : menuChords
      const chord = chords[this.chordIndex % chords.length]
      this.chordIndex++
      const dur = this.mode === 'menu' ? 6.4 : 3.6
      this._pad(chord, dur + 0.6, this.mode === 'menu' ? 0.075 : 0.085)
      this._pad([chord[0] / 2], dur + 0.4, 0.09)
      this.nextPad = t + dur
    }
    if (this.nextPluck < t + 0.1) {
      const scale = this.mode === 'menu'
        ? [NOTE.E4, NOTE.G4, NOTE.A4, NOTE.C5, NOTE.B4, NOTE.G4]
        : [NOTE.A4, NOTE.C5, NOTE.E5, NOTE.D5, NOTE.G5, NOTE.E5, NOTE.C5, NOTE.D5]
      const note = scale[Math.floor(Math.random() * scale.length)]
      if (Math.random() < 0.72) this._pluck(note)
      const pace = this.mode === 'menu' ? 1.9 : this.mode === 'boss' ? 0.7 : 1.0
      this.nextPluck = t + pace * (0.7 + Math.random() * 0.8)
    }
  }
}
