import { TestRiffStyle } from '../types/pedalboard';

/**
 * Generates realistic dry DI plucked guitar notes via Karplus-Strong physical modeling
 * so users can test pedals, amp/cab sim, tuner, and looper before plugging in a guitar.
 */
function createPluckBuffer(
  ctx: AudioContext,
  frequency: number,
  durationSec: number,
  brightness = 0.65,
  velocity = 0.65
): AudioBuffer {
  const sr = ctx.sampleRate;
  const totalSamples = Math.floor(sr * durationSec);
  const buffer = ctx.createBuffer(1, totalSamples, sr);
  const out = buffer.getChannelData(0);

  const period = Math.max(8, Math.round(sr / frequency));
  const ring = new Float32Array(period);

  // Pick excitation burst (filtered noise + subtle harmonic click)
  let lp = 0;
  const pickFilter = 0.25 + brightness * 0.65;
  for (let i = 0; i < period; i++) {
    const noise = Math.random() * 2 - 1;
    lp = lp + pickFilter * (noise - lp);
    ring[i] = lp * velocity;
  }

  // Remove DC offset from excitation
  let mean = 0;
  for (let i = 0; i < period; i++) mean += ring[i];
  mean /= period;
  for (let i = 0; i < period; i++) ring[i] -= mean;

  const decay = 0.9945 + Math.min(0.0045, (1 - frequency / 1200) * 0.0042);
  const damp = 0.42 + (1 - brightness) * 0.16;

  let idx = 0;
  for (let n = 0; n < totalSamples; n++) {
    const curr = ring[idx];
    const next = ring[(idx + 1) % period];
    out[n] = curr;
    ring[idx] = ((1 - damp) * curr + damp * next) * decay;
    idx = (idx + 1) % period;
  }

  // Soft fade out at buffer end
  const fade = Math.min(512, totalSamples);
  for (let i = 0; i < fade; i++) {
    out[totalSamples - 1 - i] *= i / fade;
  }

  return buffer;
}

interface RiffStep {
  freqs: number[];
  stepLen: number; // in 16th-note beats
  dur: number;
  bright: number;
  vel: number;
}

const RIFFS: Record<TestRiffStyle, { bpm: number; steps: RiffStep[] }> = {
  'clean-arpeggio': {
    bpm: 96,
    steps: [
      { freqs: [82.41], stepLen: 2, dur: 1.8, bright: 0.65, vel: 0.62 },
      { freqs: [164.81], stepLen: 2, dur: 1.5, bright: 0.6, vel: 0.52 },
      { freqs: [246.94], stepLen: 2, dur: 1.4, bright: 0.7, vel: 0.56 },
      { freqs: [329.63], stepLen: 2, dur: 1.4, bright: 0.72, vel: 0.55 },
      { freqs: [130.81], stepLen: 2, dur: 1.8, bright: 0.65, vel: 0.62 },
      { freqs: [196.0], stepLen: 2, dur: 1.5, bright: 0.62, vel: 0.52 },
      { freqs: [246.94], stepLen: 2, dur: 1.4, bright: 0.7, vel: 0.54 },
      { freqs: [329.63], stepLen: 2, dur: 1.4, bright: 0.72, vel: 0.55 },
      { freqs: [98.0], stepLen: 2, dur: 1.8, bright: 0.65, vel: 0.62 },
      { freqs: [146.83], stepLen: 2, dur: 1.5, bright: 0.62, vel: 0.52 },
      { freqs: [196.0], stepLen: 2, dur: 1.4, bright: 0.68, vel: 0.55 },
      { freqs: [293.66], stepLen: 2, dur: 1.4, bright: 0.7, vel: 0.56 },
      { freqs: [146.83], stepLen: 2, dur: 1.8, bright: 0.65, vel: 0.6 },
      { freqs: [220.0], stepLen: 2, dur: 1.5, bright: 0.64, vel: 0.54 },
      { freqs: [293.66], stepLen: 2, dur: 1.4, bright: 0.7, vel: 0.55 },
      { freqs: [369.99], stepLen: 2, dur: 1.4, bright: 0.74, vel: 0.56 }
    ]
  },
  'blues-lick': {
    bpm: 102,
    steps: [
      { freqs: [110.0, 164.81], stepLen: 3, dur: 0.85, bright: 0.7, vel: 0.65 },
      { freqs: [110.0, 185.0], stepLen: 1, dur: 0.35, bright: 0.65, vel: 0.5 },
      { freqs: [110.0, 164.81], stepLen: 3, dur: 0.75, bright: 0.7, vel: 0.64 },
      { freqs: [130.81], stepLen: 1, dur: 0.45, bright: 0.78, vel: 0.65 },
      { freqs: [146.83], stepLen: 2, dur: 0.65, bright: 0.76, vel: 0.68 },
      { freqs: [196.0], stepLen: 2, dur: 0.65, bright: 0.8, vel: 0.7 },
      { freqs: [220.0], stepLen: 4, dur: 1.35, bright: 0.82, vel: 0.72 },
      { freqs: [261.63], stepLen: 2, dur: 0.65, bright: 0.82, vel: 0.68 },
      { freqs: [220.0], stepLen: 2, dur: 0.65, bright: 0.76, vel: 0.64 },
      { freqs: [196.0], stepLen: 2, dur: 0.6, bright: 0.74, vel: 0.62 },
      { freqs: [164.81], stepLen: 2, dur: 0.8, bright: 0.7, vel: 0.64 },
      { freqs: [110.0, 164.81, 220.0], stepLen: 4, dur: 1.5, bright: 0.74, vel: 0.72 }
    ]
  },
  'rock-power': {
    bpm: 120,
    steps: [
      { freqs: [82.41, 123.47, 164.81], stepLen: 4, dur: 1.1, bright: 0.82, vel: 0.78 },
      { freqs: [82.41, 123.47], stepLen: 2, dur: 0.45, bright: 0.75, vel: 0.65 },
      { freqs: [98.0, 146.83, 196.0], stepLen: 4, dur: 1.0, bright: 0.84, vel: 0.8 },
      { freqs: [110.0, 164.81, 220.0], stepLen: 6, dur: 1.5, bright: 0.85, vel: 0.82 },
      { freqs: [130.81, 196.0, 261.63], stepLen: 4, dur: 1.0, bright: 0.84, vel: 0.8 },
      { freqs: [110.0, 164.81, 220.0], stepLen: 4, dur: 0.9, bright: 0.8, vel: 0.76 },
      { freqs: [98.0, 146.83, 196.0], stepLen: 4, dur: 0.9, bright: 0.8, vel: 0.76 },
      { freqs: [82.41, 123.47, 164.81], stepLen: 4, dur: 1.2, bright: 0.82, vel: 0.8 }
    ]
  },
  'metal-chug': {
    bpm: 144,
    steps: [
      { freqs: [82.41, 123.47], stepLen: 2, dur: 0.26, bright: 0.68, vel: 0.82 },
      { freqs: [82.41], stepLen: 1, dur: 0.16, bright: 0.55, vel: 0.7 },
      { freqs: [82.41], stepLen: 1, dur: 0.16, bright: 0.55, vel: 0.72 },
      { freqs: [82.41, 123.47], stepLen: 2, dur: 0.28, bright: 0.72, vel: 0.85 },
      { freqs: [98.0, 146.83], stepLen: 2, dur: 0.38, bright: 0.86, vel: 0.85 },
      { freqs: [82.41], stepLen: 1, dur: 0.16, bright: 0.55, vel: 0.72 },
      { freqs: [82.41], stepLen: 1, dur: 0.16, bright: 0.55, vel: 0.72 },
      { freqs: [110.0, 164.81], stepLen: 2, dur: 0.4, bright: 0.88, vel: 0.86 },
      { freqs: [116.54, 174.61], stepLen: 2, dur: 0.42, bright: 0.88, vel: 0.86 },
      { freqs: [98.0, 146.83], stepLen: 2, dur: 0.5, bright: 0.85, vel: 0.84 }
    ]
  }
};

export class TestGuitarPlayer {
  private ctx: AudioContext;
  private destination: AudioNode;
  private style: TestRiffStyle = 'rock-power';
  private playing = false;
  private stepIdx = 0;
  private nextTime = 0;
  private timerId: number | null = null;
  private cache = new Map<string, AudioBuffer>();

  // Optional custom DI audio file playback
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

  private getPluck(freq: number, dur: number, bright: number, vel: number): AudioBuffer {
    const key = `${freq.toFixed(1)}-${dur.toFixed(2)}-${bright.toFixed(2)}-${vel.toFixed(2)}`;
    const existing = this.cache.get(key);
    if (existing) return existing;
    const buf = createPluckBuffer(this.ctx, freq, dur, bright, vel);
    if (this.cache.size > 80) {
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
        const buf = this.getPluck(f, step.dur, step.bright, step.vel / Math.sqrt(step.freqs.length));
        const src = this.ctx.createBufferSource();
        src.buffer = buf;
        src.connect(this.destination);
        // Subtle 7ms strum spread across chord strings
        src.start(this.nextTime + idx * 0.007);
      });
      this.nextTime += step.stepLen * sixteenth;
      this.stepIdx = (this.stepIdx + 1) % riff.steps.length;
    }
  }
}
