export type DrumPadId =
  | 'kick'
  | 'snare'
  | 'chh'
  | 'ohh'
  | 'clap'
  | 'tom-hi'
  | 'tom-lo'
  | 'crash';

export type DrumKitStyle = 'acoustic-rock' | 'electronic-808';

export type DrumRouting = 'direct-clean' | 'clean-looper' | 'pedal-chain';

export interface DrumPadMeta {
  id: DrumPadId;
  name: string;
  short: string;
  key: string;
  color: string;
}

export const DRUM_PADS: DrumPadMeta[] = [
  { id: 'kick', name: 'Bumbo (Kick)', short: 'KICK', key: 'A', color: '#ef4444' },
  { id: 'snare', name: 'Caixa (Snare)', short: 'SNARE', key: 'S', color: '#f97316' },
  { id: 'chh', name: 'Chimbal Fechado', short: 'CHH', key: 'D', color: '#38bdf8' },
  { id: 'ohh', name: 'Chimbal Aberto', short: 'OHH', key: 'F', color: '#0ea5e9' },
  { id: 'clap', name: 'Palma (Clap)', short: 'CLAP', key: 'G', color: '#ec4899' },
  { id: 'tom-hi', name: 'Tom Agudo', short: 'TOM 1', key: 'H', color: '#a855f7' },
  { id: 'tom-lo', name: 'Surdo / Tom Grave', short: 'TOM 2', key: 'J', color: '#8b5cf6' },
  { id: 'crash', name: 'Prato (Crash)', short: 'CRASH', key: 'K', color: '#eab308' }
];

export type DrumPattern = Record<DrumPadId, boolean[]>;

export function createEmptyPattern(): DrumPattern {
  return {
    kick: Array(16).fill(false),
    snare: Array(16).fill(false),
    chh: Array(16).fill(false),
    ohh: Array(16).fill(false),
    clap: Array(16).fill(false),
    'tom-hi': Array(16).fill(false),
    'tom-lo': Array(16).fill(false),
    crash: Array(16).fill(false)
  };
}

function fromSteps(map: Partial<Record<DrumPadId, number[]>>): DrumPattern {
  const p = createEmptyPattern();
  for (const [id, steps] of Object.entries(map) as [DrumPadId, number[]][]) {
    for (const s of steps) {
      if (s >= 0 && s < 16) p[id][s] = true;
    }
  }
  return p;
}

export const DRUM_GROOVES: Record<string, { label: string; bpm: number; kit: DrumKitStyle; pattern: DrumPattern }> = {
  rock: {
    label: 'Rock Básico',
    bpm: 112,
    kit: 'acoustic-rock',
    pattern: fromSteps({
      kick: [0, 6, 8, 10],
      snare: [4, 12],
      chh: [0, 2, 4, 6, 8, 10, 12],
      ohh: [14]
    })
  },
  funk: {
    label: 'Pop / Funk',
    bpm: 106,
    kit: 'acoustic-rock',
    pattern: fromSteps({
      kick: [0, 3, 8, 10, 14],
      snare: [4, 12],
      clap: [12],
      chh: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]
    })
  },
  metal: {
    label: 'Metal Pedal Duplo',
    bpm: 140,
    kit: 'acoustic-rock',
    pattern: fromSteps({
      kick: [0, 1, 2, 3, 6, 8, 9, 10, 14, 15],
      snare: [4, 12],
      chh: [2, 6, 10, 14],
      crash: [0]
    })
  },
  lofi: {
    label: '808 / Lo-Fi Beat',
    bpm: 88,
    kit: 'electronic-808',
    pattern: fromSteps({
      kick: [0, 7, 10],
      snare: [4, 12],
      clap: [4, 12],
      chh: [0, 2, 4, 6, 8, 10, 12, 14],
      ohh: [15]
    })
  }
};

export class DrumEngine {
  private ctx: AudioContext;
  private outGain: GainNode;
  private noiseBuffer: AudioBuffer;
  private kit: DrumKitStyle = 'acoustic-rock';

  // Open hi-hat choke tracking
  private activeOhhGain: GainNode | null = null;

  // Step Sequencer state
  private seqRunning = false;
  private bpm = 112;
  private pattern: DrumPattern = DRUM_GROOVES.rock.pattern;
  private currentStep = 0;
  private nextStepTime = 0;
  private timerId: number | null = null;
  private onStep?: (step: number) => void;

  constructor(ctx: AudioContext, destination: AudioNode, onStep?: (step: number) => void) {
    this.ctx = ctx;
    this.onStep = onStep;
    this.outGain = ctx.createGain();
    this.outGain.gain.value = 0.85;
    this.outGain.connect(destination);

    // Pre-generate 1.5s white noise buffer for snares, hats, claps, crash
    const len = Math.floor(ctx.sampleRate * 1.5);
    this.noiseBuffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = this.noiseBuffer.getChannelData(0);
    for (let i = 0; i < len; i++) {
      data[i] = Math.random() * 2 - 1;
    }
  }

  reconnect(destination: AudioNode) {
    try {
      this.outGain.disconnect();
    } catch {
      // ignore
    }
    this.outGain.connect(destination);
  }

  setVolume(vol: number) {
    const clamped = Math.max(0, Math.min(1.3, vol));
    this.outGain.gain.setTargetAtTime(clamped, this.ctx.currentTime, 0.015);
  }

  setKit(kit: DrumKitStyle) {
    this.kit = kit;
  }

  setBpm(bpm: number) {
    this.bpm = Math.max(50, Math.min(220, Math.round(bpm)));
  }

  setPattern(pattern: DrumPattern) {
    this.pattern = pattern;
  }

  isSequencerRunning() {
    return this.seqRunning;
  }

  startSequencer() {
    if (this.seqRunning) return;
    this.seqRunning = true;
    this.currentStep = 0;
    this.nextStepTime = this.ctx.currentTime + 0.04;
    this.timerId = window.setInterval(() => this.scheduler(), 25);
  }

  stopSequencer() {
    this.seqRunning = false;
    if (this.timerId !== null) {
      window.clearInterval(this.timerId);
      this.timerId = null;
    }
  }

  private scheduler() {
    const lookahead = 0.1;
    const sixteenthSec = 60 / this.bpm / 4;

    while (this.nextStepTime < this.ctx.currentTime + lookahead) {
      const stepIdx = this.currentStep;
      const t = this.nextStepTime;

      for (const pad of DRUM_PADS) {
        if (this.pattern[pad.id]?.[stepIdx]) {
          this.trigger(pad.id, t, stepIdx % 4 === 0 ? 0.95 : 0.78);
        }
      }

      const delayMs = Math.max(0, (t - this.ctx.currentTime) * 1000);
      window.setTimeout(() => {
        if (this.seqRunning) {
          this.onStep?.(stepIdx);
        }
      }, delayMs);

      this.nextStepTime += sixteenthSec;
      this.currentStep = (this.currentStep + 1) % 16;
    }
  }

  trigger(pad: DrumPadId, scheduledTime?: number, velocity = 0.9) {
    const t = scheduledTime ?? this.ctx.currentTime;
    const vel = Math.max(0.1, Math.min(1.1, velocity));
    const is808 = this.kit === 'electronic-808';

    switch (pad) {
      case 'kick': {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(is808 ? 145 : 168, t);
        osc.frequency.exponentialRampToValueAtTime(is808 ? 42 : 52, t + (is808 ? 0.09 : 0.065));
        osc.frequency.exponentialRampToValueAtTime(is808 ? 34 : 38, t + (is808 ? 0.45 : 0.24));

        gain.gain.setValueAtTime(0.98 * vel, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + (is808 ? 0.52 : 0.28));

        osc.connect(gain).connect(this.outGain);
        osc.start(t);
        osc.stop(t + (is808 ? 0.56 : 0.32));

        // Beater click for acoustic punch
        if (!is808) {
          const click = this.ctx.createBufferSource();
          click.buffer = this.noiseBuffer;
          const bp = this.ctx.createBiquadFilter();
          bp.type = 'bandpass';
          bp.frequency.value = 2600;
          const cg = this.ctx.createGain();
          cg.gain.setValueAtTime(0.32 * vel, t);
          cg.gain.exponentialRampToValueAtTime(0.001, t + 0.018);
          click.connect(bp).connect(cg).connect(this.outGain);
          click.start(t);
          click.stop(t + 0.025);
        }
        break;
      }

      case 'snare': {
        // Snare noise wires
        const noise = this.ctx.createBufferSource();
        noise.buffer = this.noiseBuffer;
        const hp = this.ctx.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.value = is808 ? 1500 : 1100;
        const ng = this.ctx.createGain();
        ng.gain.setValueAtTime(0.68 * vel, t);
        ng.gain.exponentialRampToValueAtTime(0.001, t + (is808 ? 0.16 : 0.22));
        noise.connect(hp).connect(ng).connect(this.outGain);
        noise.start(t);
        noise.stop(t + 0.25);

        // Snare shell body
        const body = this.ctx.createOscillator();
        body.type = 'triangle';
        body.frequency.setValueAtTime(is808 ? 220 : 195, t);
        body.frequency.exponentialRampToValueAtTime(125, t + 0.07);
        const bg = this.ctx.createGain();
        bg.gain.setValueAtTime(0.55 * vel, t);
        bg.gain.exponentialRampToValueAtTime(0.001, t + 0.11);
        body.connect(bg).connect(this.outGain);
        body.start(t);
        body.stop(t + 0.13);
        break;
      }

      case 'chh': {
        // Choke open hi-hat if currently ringing
        if (this.activeOhhGain) {
          try {
            this.activeOhhGain.gain.cancelScheduledValues(t);
            this.activeOhhGain.gain.setTargetAtTime(0.0001, t, 0.008);
          } catch {
            // ignore
          }
          this.activeOhhGain = null;
        }
        const src = this.ctx.createBufferSource();
        src.buffer = this.noiseBuffer;
        const hp = this.ctx.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.value = is808 ? 7800 : 6800;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.36 * vel, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.055);
        src.connect(hp).connect(g).connect(this.outGain);
        src.start(t);
        src.stop(t + 0.07);
        break;
      }

      case 'ohh': {
        const src = this.ctx.createBufferSource();
        src.buffer = this.noiseBuffer;
        const hp = this.ctx.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.value = is808 ? 7200 : 5800;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.38 * vel, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.38);
        src.connect(hp).connect(g).connect(this.outGain);
        src.start(t);
        src.stop(t + 0.42);
        this.activeOhhGain = g;
        break;
      }

      case 'clap': {
        // Triple staggered micro-burst clap
        const offsets = [0, 0.011, 0.022, 0.033];
        offsets.forEach((off, idx) => {
          const src = this.ctx.createBufferSource();
          src.buffer = this.noiseBuffer;
          const bp = this.ctx.createBiquadFilter();
          bp.type = 'bandpass';
          bp.frequency.value = is808 ? 1350 : 1650;
          bp.Q.value = 1.4;
          const g = this.ctx.createGain();
          const tail = idx === offsets.length - 1 ? 0.18 : 0.025;
          g.gain.setValueAtTime((idx === offsets.length - 1 ? 0.55 : 0.42) * vel, t + off);
          g.gain.exponentialRampToValueAtTime(0.001, t + off + tail);
          src.connect(bp).connect(g).connect(this.outGain);
          src.start(t + off);
          src.stop(t + off + tail + 0.02);
        });
        break;
      }

      case 'tom-hi':
      case 'tom-lo': {
        const isHi = pad === 'tom-hi';
        const osc = this.ctx.createOscillator();
        osc.type = is808 ? 'sine' : 'triangle';
        osc.frequency.setValueAtTime(isHi ? 210 : 132, t);
        osc.frequency.exponentialRampToValueAtTime(isHi ? 122 : 74, t + 0.18);
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.7 * vel, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
        osc.connect(g).connect(this.outGain);
        osc.start(t);
        osc.stop(t + 0.32);
        break;
      }

      case 'crash': {
        const src = this.ctx.createBufferSource();
        src.buffer = this.noiseBuffer;
        const hp = this.ctx.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.value = 4400;
        const bp = this.ctx.createBiquadFilter();
        bp.type = 'peaking';
        bp.frequency.value = 7800;
        bp.gain.value = 5;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.42 * vel, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 1.15);
        src.connect(hp).connect(bp).connect(g).connect(this.outGain);
        src.start(t);
        src.stop(t + 1.25);
        break;
      }
    }
  }
}
