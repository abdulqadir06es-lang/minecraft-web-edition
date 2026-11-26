/** Web Audio API synthesized sound effects — no external assets. */

export class SoundFX {
  private ctx: AudioContext | null = null;
  enabled = true;

  private ac(): AudioContext | null {
    if (!this.enabled) return null;
    if (!this.ctx) {
      try {
        this.ctx = new AudioContext();
      } catch {
        return null;
      }
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.ctx;
  }

  resume(): void {
    const c = this.ac();
    if (c && c.state === 'suspended') void c.resume();
  }

  /** Short filtered noise burst — used for digging/stepping. */
  private noiseBurst(freq: number, dur: number, gain: number, type: BiquadFilterType = 'bandpass'): void {
    const ctx = this.ac();
    if (!ctx) return;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = freq;
    filter.Q.value = 0.8;
    const g = ctx.createGain();
    g.gain.value = gain;
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    src.connect(filter).connect(g).connect(ctx.destination);
    src.start();
  }

  /** Simple tone with pitch drop. */
  private tone(freq: number, dur: number, gain: number, type: OscillatorType = 'square', slide = 0.5): void {
    const ctx = this.ac();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq * slide), ctx.currentTime + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    osc.connect(g).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + dur);
  }

  place() {
    this.noiseBurst(400, 0.12, 0.25, 'lowpass');
    this.tone(180, 0.08, 0.1, 'triangle', 0.8);
  }
  break_() {
    this.noiseBurst(700, 0.18, 0.3);
    this.tone(120, 0.1, 0.08, 'sawtooth', 0.6);
  }
  dig() {
    this.noiseBurst(900, 0.05, 0.08);
  }
  step() {
    this.noiseBurst(500 + Math.random() * 300, 0.07, 0.08);
  }
  jump() {
    this.tone(250, 0.15, 0.1, 'square', 1.6);
  }
  splash() {
    this.noiseBurst(1200, 0.3, 0.2, 'highpass');
  }
  click() {
    this.tone(600, 0.06, 0.12, 'square', 1.2);
  }
}
