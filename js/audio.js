// Tiny procedural sound engine. No audio files, no network.
export class Sfx {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.noiseBuffer = null;
    this.muted = false;
    try {
      this.muted = localStorage.getItem('power.muted') === '1';
    } catch {
      this.muted = false;
    }
  }

  unlock() {
    if (!this.ctx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      this.ctx = new Ctx();
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -18;
      comp.knee.value = 22;
      comp.ratio.value = 8;
      comp.attack.value = 0.003;
      comp.release.value = 0.2;
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.55;
      this.master.connect(comp);
      comp.connect(this.ctx.destination);
      this.noiseBuffer = this.makeNoise(1);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
  }

  makeNoise(seconds) {
    const length = Math.floor(this.ctx.sampleRate * seconds);
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master && this.ctx) {
      this.master.gain.cancelScheduledValues(this.ctx.currentTime);
      this.master.gain.setTargetAtTime(muted ? 0 : 0.55, this.ctx.currentTime, 0.02);
    }
    try {
      localStorage.setItem('power.muted', muted ? '1' : '0');
    } catch {}
  }

  toggle() {
    this.setMuted(!this.muted);
    if (!this.muted) this.unlock();
    return this.muted;
  }

  get now() {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  tone({ freq = 220, endFreq = null, type = 'sine', dur = 0.2, gain = 0.3, delay = 0, attack = 0.004 }) {
    if (!this.ctx || this.muted) return;
    const t = this.now + delay;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(20, freq), t);
    if (endFreq !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  noise({ dur = 0.15, gain = 0.2, type = 'bandpass', freq = 800, endFreq = null, q = 0.9, delay = 0 }) {
    if (!this.ctx || this.muted) return;
    const t = this.now + delay;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.setValueAtTime(freq, t);
    if (endFreq !== null) filter.frequency.exponentialRampToValueAtTime(Math.max(40, endFreq), t + dur);
    filter.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(this.master);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  ui() {
    this.tone({ freq: 660, endFreq: 520, type: 'square', dur: 0.05, gain: 0.05 });
  }

  whoosh(heavy = false) {
    this.noise({
      dur: heavy ? 0.22 : 0.13,
      gain: heavy ? 0.16 : 0.1,
      type: 'bandpass',
      freq: heavy ? 280 : 620,
      endFreq: heavy ? 1500 : 1800,
      q: 1.6,
    });
  }

  hit(power = 1) {
    this.tone({ freq: 150, endFreq: 44, type: 'sine', dur: 0.18, gain: 0.55 * power });
    this.noise({ dur: 0.11, gain: 0.4 * power, type: 'bandpass', freq: 1100, endFreq: 240, q: 0.7 });
    this.tone({ freq: 72, endFreq: 40, type: 'triangle', dur: 0.24, gain: 0.3 * power, delay: 0.01 });
  }

  block() {
    this.tone({ freq: 320, endFreq: 210, type: 'square', dur: 0.07, gain: 0.11 });
    this.noise({ dur: 0.06, gain: 0.13, type: 'highpass', freq: 1800, q: 0.8 });
  }

  parry() {
    this.tone({ freq: 1480, endFreq: 1980, type: 'triangle', dur: 0.16, gain: 0.22 });
    this.tone({ freq: 2210, endFreq: 2950, type: 'sine', dur: 0.22, gain: 0.12, delay: 0.01 });
    this.noise({ dur: 0.05, gain: 0.2, type: 'highpass', freq: 3200, q: 0.9 });
  }

  ready() {
    this.tone({ freq: 880, endFreq: 1320, type: 'sine', dur: 0.16, gain: 0.1 });
    this.tone({ freq: 1320, endFreq: 1760, type: 'triangle', dur: 0.24, gain: 0.07, delay: 0.07 });
  }

  power() {
    this.tone({ freq: 46, endFreq: 180, type: 'sawtooth', dur: 0.7, gain: 0.3, attack: 0.05 });
    this.tone({ freq: 92, endFreq: 360, type: 'square', dur: 0.55, gain: 0.1, attack: 0.05 });
    this.noise({ dur: 0.6, gain: 0.16, type: 'bandpass', freq: 180, endFreq: 2400, q: 1.2 });
  }

  ko() {
    this.tone({ freq: 110, endFreq: 28, type: 'sine', dur: 1.4, gain: 0.6 });
    this.tone({ freq: 220, endFreq: 55, type: 'triangle', dur: 0.9, gain: 0.18 });
    this.noise({ dur: 1.1, gain: 0.25, type: 'lowpass', freq: 900, endFreq: 90, q: 0.8 });
  }

  jump() {
    this.noise({ dur: 0.08, gain: 0.05, type: 'highpass', freq: 900, q: 0.7 });
  }

  land() {
    this.tone({ freq: 90, endFreq: 46, type: 'sine', dur: 0.1, gain: 0.12 });
    this.noise({ dur: 0.07, gain: 0.08, type: 'lowpass', freq: 500, q: 0.7 });
  }

  step() {
    this.noise({ dur: 0.03, gain: 0.022, type: 'lowpass', freq: 380, q: 0.7 });
  }
}
