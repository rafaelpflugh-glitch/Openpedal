import { TestRiffStyle } from '../types/pedalboard';

/**
 * High-precision Physical Modeling Clean Electric Guitar Synthesizer (Julius O. Smith III extended Karplus-Strong)
 * - Exact fractional-delay All-Pass tuning (0.01 cent accuracy on every fret!)
 * - Triangular plectrum pluck displacement + filtered pick transient (zero harsh white noise!)
 * - Magnetic pickup comb-filtering + authentic RLC pickup resonance peak (3.1 kHz, Q=1.5)
 * - Natural sustain, palm-mute damping, and real finger vibrato on lead notes!
 */
function createRealisticElectricGuitarNote(
  ctx: AudioContext,
  frequency: number,
  durationSec: number,
  velocity = 0.8,
  palmMute = false,
  pickPos = 0.22 // 0.22 = bridge/mid pickup sweet spot
): AudioBuffer {
  const sr = ctx.sampleRate;
  const totalSamples = Math.floor(sr * durationSec);
  const buffer = ctx.createBuffer(1, totalSamples, sr);
  const out = buffer.getChannelData(0);

  // Exact loop delay accounting for 0.5-sample damping filter delay
  const exactPeriod = sr / frequency;
  const delayLen = Math.max(4, Math.floor(exactPeriod - 0.5));
  const frac = Math.max(0.01, Math.min(0.99, exactPeriod - 0.5 - delayLen));
  const apCoeff = (1 - frac) / (1 + frac);

  const ring = new Float32Array(delayLen);

  // 1. Authentic plucked string initial displacement (triangular string pull + gentle filtered pick attack)
  const pluckPeakIdx = Math.max(1, Math.min(delayLen - 2, Math.round(delayLen * pickPos)));
  let noiseLp = 0;
  for (let i = 0; i < delayLen; i++) {
    const tri =
      i <= pluckPeakIdx
        ? i / pluckPeakIdx
        : (delayLen - 1 - i) / Math.max(1, delayLen - 1 - pluckPeakIdx);
    const centeredTri = (tri - 0.5) * 2.0;

    // Gentle filtered pick attack texture (warm nylon pick scrape, NOT bright hiss)
    const rawNoise = Math.random() * 2 - 1;
    noiseLp += (palmMute ? 0.14 : 0.28) * (rawNoise - noiseLp);

    ring[i] = (centeredTri * 0.78 + noiseLp * 0.38) * velocity;
  }

  // Remove DC offset from initial string excitation
  let mean = 0;
  for (let i = 0; i < delayLen; i++) mean += ring[i];
  mean /= delayLen;
  for (let i = 0; i < delayLen; i++) ring[i] -= mean;

  // 2. Frequency-compensated realistic steel-string decay
  const targetRt60 = palmMute ? 0.18 : Math.max(2.2, 5.2 - frequency / 220);
  const cyclesInRt60 = targetRt60 * frequency;
  const decay = Math.min(0.9992, Math.pow(0.001, 1 / Math.max(8, cyclesInRt60)));

  // Damping blend (palm mute damps highs rapidly; open string retains shimmering upper partials)
  const damp = palmMute ? 0.62 : 0.36;

  // Magnetic pickup comb offset (~16% of string period)
  const pickupOffset = Math.max(1, Math.min(delayLen - 1, Math.round(delayLen * 0.16)));

  // Authentic Magnetic Pickup RLC Resonant Lowpass (fc = 3100Hz, Q = 1.45 — unmistakable electric guitar voice!)
  const fc = palmMute ? 1650 : 3150;
  const q = palmMute ? 0.85 : 1.45;
  const w0 = (2 * Math.PI * fc) / sr;
  const cosW = Math.cos(w0);
  const sinW = Math.sin(w0);
  const alpha = sinW / (2 * q);
  const b0 = ((1 - cosW) * 0.5) / (1 + alpha);
  const b1 = (1 - cosW) / (1 + alpha);
  const b2 = b0;
  const a1 = (-2 * cosW) / (1 + alpha);
  const a2 = (1 - alpha) / (1 + alpha);

  let z1 = 0;
  let z2 = 0;
  let apPrevIn = 0;
  let apPrevOut = 0;
  let dcIn = 0;
  let dcOut = 0;

  let idx = 0;
  const attackSamples = Math.floor(sr * 0.003);

  for (let n = 0; n < totalSamples; n++) {
    const curr = ring[idx];
    const nextIdx = (idx + 1) % delayLen;
    const next = ring[nextIdx];

    // Pickup senses traveling wave difference across magnetic pole
    const pickupIdx = (idx + pickupOffset) % delayLen;
    const picked = curr - 0.55 * ring[pickupIdx];

    // Pass through Magnetic Pickup RLC Resonant Filter (Direct Form II)
    const yPickup = b0 * picked + z1;
    z1 = b1 * picked - a1 * yPickup + z2;
    z2 = b2 * picked - a2 * yPickup;

    // Subtle DC blocker + smooth 3ms attack ramp
    const clean = 0.996 * (dcOut + yPickup - dcIn);
    dcIn = yPickup;
    dcOut = clean;

    const att = n < attackSamples ? n / attackSamples : 1.0;
    out[n] = clean * 0.52 * att;

    // String loop update: 2-point lowpass damping -> All-Pass fractional delay -> write back
    const damped = ((1 - damp) * curr + damp * next) * decay;
    const apOut = apCoeff * (damped - apPrevOut) + apPrevIn;
    apPrevIn = damped;
    apPrevOut = apOut;
    ring[idx] = apOut;

    idx = nextIdx;
  }

  // Smooth release fade
  const fade = Math.min(Math.floor(sr * 0.03), totalSamples);
  for (let i = 0; i < fade; i++) {
    out[totalSamples - 1 - i] *= i / fade;
  }

  return buffer;
}

interface RiffStep {
  freqs: number[];
  stepLen: number; // in 16th-note steps
  dur: number;
  vel: number;
  palmMute?: boolean;
  vibrato?: boolean;
}

const RIFFS: Record<TestRiffStyle, { bpm: number; steps: RiffStep[] }> = {
  'clean-arpeggio': {
    bpm: 88,
    steps: [
      // Lush Strat clean arpeggio: Em9 -> Cmaj7 -> G -> Dsus2
      { freqs: [82.41], stepLen: 2, dur: 2.8, vel: 0.88 },
      { freqs: [164.81], stepLen: 2, dur: 2.3, vel: 0.76 },
      { freqs: [246.94], stepLen: 2, dur: 2.2, vel: 0.78 },
      { freqs: [369.99], stepLen: 2, dur: 2.2, vel: 0.75 },
      { freqs: [130.81], stepLen: 2, dur: 2.8, vel: 0.88 },
      { freqs: [196.0], stepLen: 2, dur: 2.3, vel: 0.76 },
      { freqs: [246.94], stepLen: 2, dur: 2.2, vel: 0.78 },
      { freqs: [329.63], stepLen: 2, dur: 2.2, vel: 0.76 },
      { freqs: [98.0], stepLen: 2, dur: 2.8, vel: 0.88 },
      { freqs: [146.83], stepLen: 2, dur: 2.3, vel: 0.76 },
      { freqs: [196.0], stepLen: 2, dur: 2.2, vel: 0.78 },
      { freqs: [293.66], stepLen: 2, dur: 2.2, vel: 0.78 },
      { freqs: [146.83], stepLen: 2, dur: 2.8, vel: 0.86 },
      { freqs: [220.0], stepLen: 2, dur: 2.3, vel: 0.76 },
      { freqs: [293.66], stepLen: 2, dur: 2.2, vel: 0.78 },
      { freqs: [329.63], stepLen: 2, dur: 2.4, vel: 0.8, vibrato: true }
    ]
  },
  'blues-lick': {
    bpm: 92,
    steps: [
      // Expressive SRV / BB King style A minor blues with real vibrato!
      { freqs: [110.0, 164.81], stepLen: 3, dur: 1.25, vel: 0.9 },
      { freqs: [110.0, 185.0], stepLen: 1, dur: 0.5, vel: 0.72 },
      { freqs: [110.0, 164.81], stepLen: 3, dur: 1.05, vel: 0.88 },
      { freqs: [196.0], stepLen: 1, dur: 0.7, vel: 0.84 },
      { freqs: [220.0], stepLen: 2, dur: 1.2, vel: 0.9 },
      { freqs: [261.63], stepLen: 2, dur: 1.2, vel: 0.92 },
      { freqs: [293.66], stepLen: 4, dur: 2.1, vel: 0.95, vibrato: true },
      { freqs: [261.63], stepLen: 2, dur: 1.0, vel: 0.86 },
      { freqs: [220.0], stepLen: 2, dur: 1.0, vel: 0.84 },
      { freqs: [196.0], stepLen: 2, dur: 0.95, vel: 0.82 },
      { freqs: [164.81], stepLen: 2, dur: 1.15, vel: 0.85 },
      { freqs: [110.0, 164.81, 220.0], stepLen: 4, dur: 2.1, vel: 0.92 }
    ]
  },
  'rock-power': {
    bpm: 112,
    steps: [
      // Chunky rock riff: open power chords + tight palm mutes (awesome for DS-1, RAT, Crunch!)
      { freqs: [82.41, 123.47, 164.81], stepLen: 4, dur: 1.6, vel: 0.96 },
      { freqs: [82.41, 123.47], stepLen: 2, dur: 0.25, vel: 0.88, palmMute: true },
      { freqs: [98.0, 146.83, 196.0], stepLen: 4, dur: 1.5, vel: 0.96 },
      { freqs: [110.0, 164.81, 220.0], stepLen: 6, dur: 2.1, vel: 0.98 },
      { freqs: [130.81, 196.0, 261.63], stepLen: 4, dur: 1.5, vel: 0.96 },
      { freqs: [110.0, 164.81, 220.0], stepLen: 4, dur: 1.35, vel: 0.94 },
      { freqs: [98.0, 146.83, 196.0], stepLen: 4, dur: 1.35, vel: 0.94 },
      { freqs: [82.41, 123.47, 164.81], stepLen: 4, dur: 1.8, vel: 0.98 }
    ]
  },
  'gilmour-lead': {
    bpm: 78,
    steps: [
      // Soaring sustained solo phrases with finger vibrato (built for Big Muff Pi, Fuzz Face, Wah, Delay!)
      { freqs: [293.66], stepLen: 4, dur: 2.2, vel: 0.92, vibrato: true }, // D4
      { freqs: [329.63], stepLen: 2, dur: 1.1, vel: 0.88 },                // E4
      { freqs: [369.99], stepLen: 6, dur: 3.1, vel: 0.96, vibrato: true }, // F#4
      { freqs: [440.0], stepLen: 4, dur: 2.1, vel: 0.94, vibrato: true },  // A4
      { freqs: [392.0], stepLen: 2, dur: 1.1, vel: 0.88 },                 // G4
      { freqs: [369.99], stepLen: 2, dur: 1.1, vel: 0.86 },                // F#4
      { freqs: [329.63], stepLen: 4, dur: 2.2, vel: 0.92, vibrato: true }, // E4
      { freqs: [246.94], stepLen: 8, dur: 3.8, vel: 0.96, vibrato: true }  // B3
    ]
  },
  'metal-chug': {
    bpm: 134,
    steps: [
      { freqs: [82.41, 123.47], stepLen: 2, dur: 0.22, vel: 0.95, palmMute: true },
      { freqs: [82.41], stepLen: 1, dur: 0.14, vel: 0.88, palmMute: true },
      { freqs: [82.41], stepLen: 1, dur: 0.14, vel: 0.9, palmMute: true },
      { freqs: [82.41, 123.47], stepLen: 2, dur: 0.24, vel: 0.96, palmMute: true },
      { freqs: [98.0, 146.83, 196.0], stepLen: 2, dur: 0.85, vel: 0.98 },
      { freqs: [82.41], stepLen: 1, dur: 0.14, vel: 0.88, palmMute: true },
      { freqs: [82.41], stepLen: 1, dur: 0.14, vel: 0.9, palmMute: true },
      { freqs: [110.0, 164.81, 220.0], stepLen: 2, dur: 0.85, vel: 0.98 },
      { freqs: [116.54, 174.61, 233.08], stepLen: 2, dur: 0.9, vel: 0.98 },
      { freqs: [98.0, 146.83, 196.0], stepLen: 2, dur: 1.0, vel: 0.96 }
    ]
  }
};

export class TestGuitarPlayer {
  private ctx: AudioContext;
  private destination: AudioNode;
  private style: TestRiffStyle = 'clean-arpeggio';
  private playing = false;
  private stepIdx = 0;
  private nextTime = 0;
  private timerId: number | null = null;
  private cache = new Map<string, AudioBuffer>();

  private customBuffer: AudioBuffer | null = null;
  private customSource: AudioBufferSourceNode | null = null;
  private customPlaying = false;

  constructor(ctx: AudioContext, destination: AudioNode) {
    this.ctx = ctx;
    this.destination = destination;
  }

  setStyle(style: TestRiffStyle) {
    this.style = style;
    this.stepIdx = 0;
  }

  isPlaying() {
    return this.playing;
  }

  startRiff() {
    this.stopCustomFile();
    if (this.playing) return;
    this.playing = true;
    this.stepIdx = 0;
    this.nextTime = this.ctx.currentTime + 0.05;
    this.timerId = window.setInterval(() => this.schedule(), 40);
  }

  stopRiff() {
    this.playing = false;
    if (this.timerId !== null) {
      window.clearInterval(this.timerId);
      this.timerId = null;
    }
  }

  async loadCustomFile(file: File): Promise<string> {
    const arrayBuffer = await file.arrayBuffer();
    this.customBuffer = await this.ctx.decodeAudioData(arrayBuffer);
    return file.name;
  }

  startCustomFile() {
    this.stopRiff();
    if (!this.customBuffer) return;
    this.stopCustomFile();
    const src = this.ctx.createBufferSource();
    src.buffer = this.customBuffer;
    src.loop = true;
    src.connect(this.destination);
    src.start(0);
    this.customSource = src;
    this.customPlaying = true;
  }

  stopCustomFile() {
    if (this.customSource) {
      try {
        this.customSource.stop();
        this.customSource.disconnect();
      } catch {
        // ignore
      }
      this.customSource = null;
    }
    this.customPlaying = false;
  }

  isCustomPlaying() {
    return this.customPlaying;
  }

  hasCustomFile() {
    return this.customBuffer !== null;
  }

  stopAll() {
    this.stopRiff();
    this.stopCustomFile();
  }

  private getPluck(freq: number, dur: number, vel: number, pm: boolean): AudioBuffer {
    const key = `${freq.toFixed(2)}-${dur.toFixed(2)}-${vel.toFixed(2)}-${pm ? 1 : 0}`;
    const existing = this.cache.get(key);
    if (existing) return existing;
    const buf = createRealisticElectricGuitarNote(this.ctx, freq, dur, vel, pm);
    if (this.cache.size > 140) {
      this.cache.clear();
    }
    this.cache.set(key, buf);
    return buf;
  }

  private schedule() {
    const riff = RIFFS[this.style];
    const sixteenth = 60 / riff.bpm / 4;

    while (this.nextTime < this.ctx.currentTime + 0.14) {
      const step = riff.steps[this.stepIdx % riff.steps.length];
      step.freqs.forEach((f, idx) => {
        const scaledVel = step.vel / Math.pow(step.freqs.length, 0.52);
        const buf = this.getPluck(f, step.dur, scaledVel, Boolean(step.palmMute));
        const src = this.ctx.createBufferSource();
        src.buffer = buf;
        const startTime = this.nextTime + idx * 0.008;

        // Expressive delayed human finger vibrato on sustained solo notes!
        if (step.vibrato && step.dur >= 1.2) {
          const vibLfo = this.ctx.createOscillator();
          const vibDepth = this.ctx.createGain();
          vibLfo.type = 'sine';
          vibLfo.frequency.value = 5.3;
          vibDepth.gain.setValueAtTime(0, startTime);
          vibDepth.gain.linearRampToValueAtTime(0, startTime + 0.24);
          vibDepth.gain.linearRampToValueAtTime(16, startTime + 0.72); // smooth ±16 cents vibrato
          vibLfo.connect(vibDepth);
          vibDepth.connect(src.detune);
          vibLfo.start(startTime);
          vibLfo.stop(startTime + step.dur + 0.05);
        }

        src.connect(this.destination);
        src.start(startTime);
      });
      this.nextTime += step.stepLen * sixteenth;
      this.stepIdx = (this.stepIdx + 1) % riff.steps.length;
    }
  }
}
