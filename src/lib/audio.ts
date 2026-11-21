"use client";

/**
 * Colonna sonora ambientale originale, generata in tempo reale con la Web Audio API.
 * Nessun file audio esterno: pad armonici lenti (Re maggiore, accordi di nona),
 * note di "celesta" sparse con eco, e un fruscio d'acqua filtrato.
 * Parte SOLO dopo un gesto esplicito dell'utente.
 */

type Voice = { stop: (at: number) => void };

const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

// Dmaj9 – Bm9 – Gmaj9 – Asus4(add9)  (note MIDI)
const CHORDS: number[][] = [
  [50, 57, 61, 64, 66],
  [47, 54, 57, 61, 62],
  [43, 50, 54, 57, 62],
  [45, 52, 57, 59, 64],
];
const BELL_SCALE = [74, 76, 78, 81, 83, 86, 88]; // Re maggiore pentatonica, registro acuto
const CHORD_LEN = 9; // secondi

class AmbientEngine {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private dry!: GainNode;
  private wet!: GainNode;
  private delay!: DelayNode;
  private timer: ReturnType<typeof setInterval> | null = null;
  private nextChordAt = 0;
  private chordIndex = 0;
  private voices: Voice[] = [];
  private water: AudioBufferSourceNode | null = null;
  private playing = false;

  get supported() {
    return typeof window !== "undefined" && !!(window.AudioContext || (window as unknown as { webkitAudioContext?: unknown }).webkitAudioContext);
  }

  private init() {
    if (this.ctx) return;
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctor({ latencyHint: "playback" });
    this.ctx = ctx;

    this.master = ctx.createGain();
    this.master.gain.value = 0;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.ratio.value = 3;
    this.master.connect(comp).connect(ctx.destination);

    this.dry = ctx.createGain();
    this.dry.gain.value = 0.55;
    this.dry.connect(this.master);

    const reverb = ctx.createConvolver();
    reverb.buffer = this.impulse(5.5, 2.6);
    this.wet = ctx.createGain();
    this.wet.gain.value = 0.9;
    this.wet.connect(reverb).connect(this.master);

    // eco puntata per le note di celesta
    this.delay = ctx.createDelay(2);
    this.delay.delayTime.value = 0.62;
    const fb = ctx.createGain();
    fb.gain.value = 0.38;
    const dl = ctx.createBiquadFilter();
    dl.type = "lowpass";
    dl.frequency.value = 2600;
    this.delay.connect(dl).connect(fb).connect(this.delay);
    dl.connect(this.wet);
  }

  private impulse(seconds: number, decay: number) {
    const ctx = this.ctx!;
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
  }

  private padNote(freq: number, t: number, dur: number, level: number) {
    const ctx = this.ctx!;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(level, t + 3.2);
    g.gain.setTargetAtTime(0, t + dur - 0.5, 1.6);
    const f = ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.setValueAtTime(500, t);
    f.frequency.linearRampToValueAtTime(1300, t + dur * 0.5);
    f.frequency.linearRampToValueAtTime(700, t + dur + 3);
    f.Q.value = 0.4;
    const oscs = [-6, 5].map((det, k) => {
      const o = ctx.createOscillator();
      o.type = k === 0 ? "sine" : "triangle";
      o.frequency.value = freq;
      o.detune.value = det;
      o.connect(f);
      o.start(t);
      o.stop(t + dur + 7);
      return o;
    });
    f.connect(g);
    g.connect(this.dry);
    g.connect(this.wet);
    this.voices.push({ stop: (at) => oscs.forEach((o) => { try { o.stop(at); } catch { /* già fermo */ } }) });
  }

  private bell(freq: number, t: number, level = 0.05) {
    const ctx = this.ctx!;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(level, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 3.8);
    [1, 2.01, 3.98].forEach((mult, k) => {
      const o = ctx.createOscillator();
      o.type = "sine";
      o.frequency.value = freq * mult;
      const og = ctx.createGain();
      og.gain.value = [1, 0.28, 0.08][k];
      o.connect(og).connect(g);
      o.start(t);
      o.stop(t + 4);
    });
    g.connect(this.dry);
    g.connect(this.delay);
    g.connect(this.wet);
  }

  private startWater() {
    const ctx = this.ctx!;
    const len = ctx.sampleRate * 4;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.997 * b0 + w * 0.029;
      b1 = 0.985 * b1 + w * 0.032;
      b2 = 0.95 * b2 + w * 0.048;
      d[i] = (b0 + b1 + b2) * 0.35;
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = "lowpass";
    bp.frequency.value = 520;
    const g = ctx.createGain();
    g.gain.value = 0.05;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.09;
    const lg = ctx.createGain();
    lg.gain.value = 0.03;
    lfo.connect(lg).connect(g.gain);
    lfo.start();
    src.connect(bp).connect(g).connect(this.master);
    src.start();
    this.water = src;
  }

  private schedule = () => {
    const ctx = this.ctx;
    if (!ctx || !this.playing) return;
    while (this.nextChordAt < ctx.currentTime + 1.5) {
      const t = this.nextChordAt;
      const chord = CHORDS[this.chordIndex % CHORDS.length];
      chord.forEach((n, i) => this.padNote(midi(n), t, CHORD_LEN + 1.5, i === 0 ? 0.05 : 0.032));
      const bells = 1 + Math.floor(Math.random() * 3);
      for (let b = 0; b < bells; b++) {
        const note = BELL_SCALE[Math.floor(Math.random() * BELL_SCALE.length)];
        this.bell(midi(note), t + 1.2 + Math.random() * (CHORD_LEN - 2), 0.03 + Math.random() * 0.025);
      }
      this.chordIndex++;
      this.nextChordAt += CHORD_LEN;
    }
    if (this.voices.length > 40) this.voices.splice(0, this.voices.length - 40);
  };

  async start() {
    if (!this.supported) return false;
    this.init();
    const ctx = this.ctx!;
    if (ctx.state === "suspended") await ctx.resume();
    if (this.playing) return true;
    this.playing = true;
    const now = ctx.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setValueAtTime(this.master.gain.value, now);
    this.master.gain.linearRampToValueAtTime(0.9, now + 3);
    this.nextChordAt = now + 0.1;
    if (!this.water) this.startWater();
    this.schedule();
    this.timer = setInterval(this.schedule, 400);
    return true;
  }

  stop() {
    const ctx = this.ctx;
    if (!ctx || !this.playing) return;
    this.playing = false;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    const now = ctx.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setValueAtTime(this.master.gain.value, now);
    this.master.gain.linearRampToValueAtTime(0, now + 1.4);
    const voices = this.voices.splice(0);
    voices.forEach((v) => v.stop(now + 1.6));
    setTimeout(() => {
      if (!this.playing) {
        this.water?.stop();
        this.water = null;
        ctx.suspend().catch(() => {});
      }
    }, 1700);
  }

  /** Il "tin" dei calici: solo se la musica è attiva. */
  chime() {
    const ctx = this.ctx;
    if (!ctx || !this.playing) return;
    const t = ctx.currentTime + 0.01;
    this.bell(2637, t, 0.035);
    this.bell(3520, t + 0.015, 0.02);
  }
}

let engine: AmbientEngine | null = null;
export const getAudio = () => (engine ??= new AmbientEngine());
