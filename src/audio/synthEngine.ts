export type InstrumentCategory = 'keys' | 'brass' | 'bass' | 'strings';

export type SynthVoicePreset =
  // Keys & Synths
  | 'grand-piano'
  | 'rhodes-ep'
  | 'rock-organ'
  | 'accordion'
  | 'clavinet'
  | 'synth-lead'
  | 'warm-pad'
  | 'synth-bass'
  // Brass & Winds (Sopros & Metais)
  | 'saxophone'
  | 'trumpet'
  | 'trombone'
  | 'tuba'
  | 'flute'
  // Real Basses (Baixos Reais)
  | 'electric-bass'
  | 'slap-bass'
  | 'upright-bass'
  // Strings & Playable Electric Guitar
  | 'violin'
  | 'strings-ensemble'
  | 'electric-guitar';

export interface VoiceDefinition {
  id: SynthVoicePreset;
  label: string;
  category: InstrumentCategory;
  hint?: string;
}

export const INSTRUMENT_CATEGORIES: { id: InstrumentCategory; label: string }[] = [
  { id: 'keys', label: 'Teclas & Synths' },
  { id: 'brass', label: 'Sopros & Metais' },
  { id: 'bass', label: 'Baixos Reais' },
  { id: 'strings', label: 'Cordas & Guitarra' }
];

export const SYNTH_VOICE_CATALOG: VoiceDefinition[] = [
  // Teclas & Synths
  { id: 'grand-piano', label: 'Grand Piano', category: 'keys' },
  { id: 'rhodes-ep', label: 'Rhodes E-Piano', category: 'keys' },
  { id: 'rock-organ', label: 'Órgão Rock', category: 'keys' },
  { id: 'accordion', label: 'Acordeon / Sanfona', category: 'keys' },
  { id: 'clavinet', label: 'Clavinet Funk', category: 'keys', hint: 'Experimente com Cry Wah (Via FX)!' },
  { id: 'synth-lead', label: 'Synth Lead', category: 'keys' },
  { id: 'warm-pad', label: 'Pad Atmosférico', category: 'keys' },
  { id: 'synth-bass', label: 'Baixo Synth', category: 'keys' },

  // Sopros & Metais
  { id: 'saxophone', label: 'Saxofone Tenor', category: 'brass' },
  { id: 'trumpet', label: 'Trompete', category: 'brass' },
  { id: 'trombone', label: 'Trombone', category: 'brass' },
  { id: 'tuba', label: 'Tuba (Grave)', category: 'brass' },
  { id: 'flute', label: 'Flauta Transversal', category: 'brass' },

  // Baixos Reais
  { id: 'electric-bass', label: 'Baixo Elétrico (Jazz)', category: 'bass' },
  { id: 'slap-bass', label: 'Baixo Slap / Pick', category: 'bass' },
  { id: 'upright-bass', label: 'Contrabaixo Acústico', category: 'bass' },

  // Cordas & Guitarra
  { id: 'violin', label: 'Violino Solo', category: 'strings' },
  { id: 'strings-ensemble', label: 'Orquestra Strings', category: 'strings' },
  { id: 'electric-guitar', label: 'Guitarra Elétrica', category: 'strings', hint: 'Use "Via Pedaleira (FX)" para tocar com Big Muff, Klon e DS-1!' }
];

export type InstrumentRouting = 'clean-looper' | 'pedal-chain';

interface ActiveVoice {
  stop: (releaseTime?: number) => void;
  midi: number;
  sustained: boolean;
}

export function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/**
 * Physical-modeling fractional-delay plucked string generator used for
 * Electric Bass, Slap Bass, Upright Acoustic Bass, and Playable Electric Guitar.
 */
function createPluckedStringBuffer(
  ctx: AudioContext,
  frequency: number,
  style: 'electric-bass' | 'slap-bass' | 'upright-bass' | 'electric-guitar',
  durationSec = 3.2
): AudioBuffer {
  const sr = ctx.sampleRate;
  const totalSamples = Math.floor(sr * durationSec);
  const buffer = ctx.createBuffer(1, totalSamples, sr);
  const out = buffer.getChannelData(0);

  const exactPeriod = sr / Math.max(28, frequency);
  const delayLen = Math.max(4, Math.floor(exactPeriod - 0.5));
  const frac = Math.max(0.01, Math.min(0.99, exactPeriod - 0.5 - delayLen));
  const apCoeff = (1 - frac) / (1 + frac);
  const ring = new Float32Array(delayLen);

  const pickPos =
    style === 'upright-bass' ? 0.34 : style === 'electric-bass' ? 0.28 : style === 'slap-bass' ? 0.14 : 0.21;
  const pluckPeak = Math.max(1, Math.min(delayLen - 2, Math.round(delayLen * pickPos)));
  const noiseAlpha =
    style === 'slap-bass' ? 0.55 : style === 'electric-guitar' ? 0.28 : style === 'electric-bass' ? 0.16 : 0.1;
  const noiseMix =
    style === 'slap-bass' ? 0.6 : style === 'electric-guitar' ? 0.36 : style === 'electric-bass' ? 0.22 : 0.18;

  let lp = 0;
  for (let i = 0; i < delayLen; i++) {
    const tri =
      i <= pluckPeak ? i / pluckPeak : (delayLen - 1 - i) / Math.max(1, delayLen - 1 - pluckPeak);
    const centered = (tri - 0.5) * 2.0;
    const raw = Math.random() * 2 - 1;
    lp += noiseAlpha * (raw - lp);
    ring[i] = centered * 0.8 + lp * noiseMix;
  }

  let mean = 0;
  for (let i = 0; i < delayLen; i++) mean += ring[i];
  mean /= delayLen;
  for (let i = 0; i < delayLen; i++) ring[i] -= mean;

  const rt60 =
    style === 'upright-bass'
      ? 1.45
      : style === 'electric-bass'
      ? 3.4
      : style === 'slap-bass'
      ? 2.6
      : Math.max(2.4, 4.8 - frequency / 220);

  const decay = Math.min(0.9993, Math.pow(0.001, 1 / Math.max(8, rt60 * frequency)));
  const damp =
    style === 'upright-bass' ? 0.54 : style === 'electric-bass' ? 0.46 : style === 'slap-bass' ? 0.28 : 0.35;

  const pickupOffset = Math.max(
    1,
    Math.min(delayLen - 1, Math.round(delayLen * (style === 'upright-bass' ? 0.28 : 0.17)))
  );

  // Resonant body / pickup lowpass filter
  const fc =
    style === 'upright-bass'
      ? 620
      : style === 'electric-bass'
      ? 1350
      : style === 'slap-bass'
      ? 3400
      : 3150;
  const q = style === 'slap-bass' ? 1.7 : style === 'electric-guitar' ? 1.45 : style === 'upright-bass' ? 1.2 : 1.1;

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
  const attLen = Math.floor(sr * (style === 'upright-bass' ? 0.008 : 0.003));
  const outScale = style === 'electric-guitar' ? 0.44 : 0.62;

  for (let n = 0; n < totalSamples; n++) {
    const curr = ring[idx];
    const nextIdx = (idx + 1) % delayLen;
    const next = ring[nextIdx];

    const pIdx = (idx + pickupOffset) % delayLen;
    const picked = style === 'upright-bass' ? curr * 0.8 + ring[pIdx] * 0.35 : curr - 0.52 * ring[pIdx];

    const y = b0 * picked + z1;
    z1 = b1 * picked - a1 * y + z2;
    z2 = b2 * picked - a2 * y;

    const clean = 0.996 * (dcOut + y - dcIn);
    dcIn = y;
    dcOut = clean;

    const att = n < attLen ? n / attLen : 1.0;
    out[n] = clean * outScale * att;

    const damped = ((1 - damp) * curr + damp * next) * decay;
    const apOut = apCoeff * (damped - apPrevOut) + apPrevIn;
    apPrevIn = damped;
    apPrevOut = apOut;
    ring[idx] = apOut;

    idx = nextIdx;
  }

  const fade = Math.min(Math.floor(sr * 0.03), totalSamples);
  for (let i = 0; i < fade; i++) {
    out[totalSamples - 1 - i] *= i / fade;
  }

  return buffer;
}

export class SynthEngine {
  private ctx: AudioContext;
  private outGain: GainNode;
  private noiseBuffer: AudioBuffer;
  private pluckCache = new Map<string, AudioBuffer>();
  private preset: SynthVoicePreset = 'grand-piano';
  private activeVoices = new Map<number, ActiveVoice>();
  private sustainActive = false;
  private autoVibrato = true;

  constructor(ctx: AudioContext, destination: AudioNode) {
    this.ctx = ctx;
    this.outGain = ctx.createGain();
    this.outGain.gain.value = 0.7;
    this.outGain.connect(destination);

    // Pre-generate 2s noise buffer for realistic breath/chiff/bow friction on winds & strings
    const nLen = Math.floor(ctx.sampleRate * 2);
    this.noiseBuffer = ctx.createBuffer(1, nLen, ctx.sampleRate);
    const d = this.noiseBuffer.getChannelData(0);
    for (let i = 0; i < nLen; i++) d[i] = Math.random() * 2 - 1;
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
    const clamped = Math.max(0, Math.min(1.25, vol));
    this.outGain.gain.setTargetAtTime(clamped, this.ctx.currentTime, 0.015);
  }

  setPreset(preset: SynthVoicePreset) {
    this.preset = preset;
  }

  setAutoVibrato(enabled: boolean) {
    this.autoVibrato = enabled;
  }

  setSustain(active: boolean) {
    this.sustainActive = active;
    if (!active) {
      for (const [midi, voice] of Array.from(this.activeVoices.entries())) {
        if (voice.sustained) {
          voice.stop();
          this.activeVoices.delete(midi);
        }
      }
    }
  }

  private getPluckedBuffer(
    freq: number,
    style: 'electric-bass' | 'slap-bass' | 'upright-bass' | 'electric-guitar'
  ): AudioBuffer {
    const key = `${style}-${freq.toFixed(1)}`;
    const cached = this.pluckCache.get(key);
    if (cached) return cached;
    const buf = createPluckedStringBuffer(this.ctx, freq, style, style === 'upright-bass' ? 2.2 : 3.4);
    if (this.pluckCache.size > 120) this.pluckCache.clear();
    this.pluckCache.set(key, buf);
    return buf;
  }

  noteOn(midi: number, velocity = 0.85) {
    const prev = this.activeVoices.get(midi);
    if (prev) {
      prev.stop(0.025);
      this.activeVoices.delete(midi);
    }

    const now = this.ctx.currentTime;
    const baseFreq = midiToFreq(midi);
    const vel = Math.max(0.1, Math.min(1, velocity));

    const voiceGain = this.ctx.createGain();
    const stoppables: (OscillatorNode | AudioBufferSourceNode)[] = [];
    const cleanupNodes: AudioNode[] = [voiceGain];
    let releaseSec = 0.22;

    // Helper: attach expressive delayed vibrato LFO to oscillator(s) or buffer source detune
    const attachVibrato = (
      targets: AudioParam[],
      rateHz: number,
      depthCents: number,
      delaySec: number
    ) => {
      if (!this.autoVibrato) return;
      const lfo = this.ctx.createOscillator();
      const lfoGain = this.ctx.createGain();
      lfo.type = 'sine';
      lfo.frequency.setValueAtTime(rateHz, now);
      lfoGain.gain.setValueAtTime(0, now);
      lfoGain.gain.linearRampToValueAtTime(0, now + delaySec);
      lfoGain.gain.linearRampToValueAtTime(depthCents, now + delaySec + 0.45);
      lfo.connect(lfoGain);
      targets.forEach((p) => lfoGain.connect(p));
      lfo.start(now);
      stoppables.push(lfo);
      cleanupNodes.push(lfoGain);
    };

    // Helper: breath / bow chiff burst
    const addBreathNoise = (
      dest: AudioNode,
      bpFreq: number,
      bpQ: number,
      peakGain: number,
      attackSec: number,
      decaySec: number,
      sustainGain = 0.0001
    ) => {
      const nSrc = this.ctx.createBufferSource();
      nSrc.buffer = this.noiseBuffer;
      nSrc.loop = true;
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(bpFreq, now);
      bp.Q.setValueAtTime(bpQ, now);
      const ng = this.ctx.createGain();
      ng.gain.setValueAtTime(0.0001, now);
      ng.gain.linearRampToValueAtTime(peakGain * vel, now + attackSec);
      ng.gain.exponentialRampToValueAtTime(Math.max(0.0001, sustainGain * vel), now + attackSec + decaySec);
      nSrc.connect(bp).connect(ng).connect(dest);
      nSrc.start(now);
      stoppables.push(nSrc);
      cleanupNodes.push(bp, ng);
    };

    // =========================================================================
    // PHYSICAL-MODELED PLUCKED STRINGS: Electric Bass, Slap, Upright, Guitar
    // =========================================================================
    if (
      this.preset === 'electric-bass' ||
      this.preset === 'slap-bass' ||
      this.preset === 'upright-bass' ||
      this.preset === 'electric-guitar'
    ) {
      // Basses automatically transpose 1 octave down so C4 on keyboard plays rich bass C3/C2!
      const isBass = this.preset !== 'electric-guitar';
      const freq = isBass ? baseFreq * 0.5 : baseFreq;
      const buf = this.getPluckedBuffer(freq, this.preset);
      const src = this.ctx.createBufferSource();
      src.buffer = buf;

      const eq = this.ctx.createBiquadFilter();
      if (this.preset === 'slap-bass') {
        eq.type = 'peaking';
        eq.frequency.value = 450;
        eq.Q.value = 1.2;
        eq.gain.value = -5.5;
      } else if (this.preset === 'upright-bass') {
        eq.type = 'peaking';
        eq.frequency.value = 155;
        eq.Q.value = 1.1;
        eq.gain.value = 5.0;
      } else if (this.preset === 'electric-bass') {
        eq.type = 'lowshelf';
        eq.frequency.value = 120;
        eq.gain.value = 3.5;
      } else {
        eq.type = 'allpass';
      }

      voiceGain.gain.setValueAtTime(vel, now);
      src.connect(eq).connect(voiceGain).connect(this.outGain);
      src.start(now);

      if (this.preset === 'electric-guitar') {
        attachVibrato([src.detune], 5.2, 14, 0.28);
      }

      stoppables.push(src);
      cleanupNodes.push(eq);
      releaseSec = isBass ? 0.14 : 0.18;
    }

    // =========================================================================
    // SOPROS & METAIS: Saxophone, Trumpet, Trombone, Tuba, Flute
    // =========================================================================
    else if (this.preset === 'saxophone') {
      // Tenor Sax: reed sawtooth + sub-harmonic warmth + nasal sax formant (1050Hz) + breath attack + vibrato!
      const freq = baseFreq * 0.5; // Rich tenor sax register
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      osc1.type = 'sawtooth';
      osc2.type = 'triangle';
      osc1.frequency.setValueAtTime(freq * 0.985, now);
      osc1.frequency.exponentialRampToValueAtTime(freq, now + 0.045); // Reed embouchure scoop-in!
      osc2.frequency.setValueAtTime(freq, now);

      const g1 = this.ctx.createGain();
      const g2 = this.ctx.createGain();
      g1.gain.value = 0.62;
      g2.gain.value = 0.34;

      const lpf = this.ctx.createBiquadFilter();
      lpf.type = 'lowpass';
      lpf.Q.value = 1.4;
      lpf.frequency.setValueAtTime(420, now);
      lpf.frequency.exponentialRampToValueAtTime(Math.min(3600, freq * 7.5), now + 0.085);
      lpf.frequency.exponentialRampToValueAtTime(Math.min(2600, freq * 5.2), now + 0.45);

      const formant = this.ctx.createBiquadFilter();
      formant.type = 'peaking';
      formant.frequency.value = 1020;
      formant.Q.value = 2.0;
      formant.gain.value = 7.5;

      osc1.connect(g1).connect(lpf);
      osc2.connect(g2).connect(lpf);
      lpf.connect(formant).connect(voiceGain).connect(this.outGain);

      addBreathNoise(formant, 1800, 1.8, 0.12, 0.02, 0.14, 0.022);

      voiceGain.gain.setValueAtTime(0.0001, now);
      voiceGain.gain.linearRampToValueAtTime(0.46 * vel, now + 0.055);
      voiceGain.gain.exponentialRampToValueAtTime(0.36 * vel, now + 0.35);

      attachVibrato([osc1.detune, osc2.detune], 5.4, 22, 0.24);
      osc1.start(now);
      osc2.start(now);
      stoppables.push(osc1, osc2);
      cleanupNodes.push(g1, g2, lpf, formant);
      releaseSec = 0.16;
    } else if (this.preset === 'trumpet') {
      // Bright Brass Trumpet: quick lip-buzz pitch snap + dramatic brass filter swell + bell formant 2.1kHz!
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      osc1.type = 'sawtooth';
      osc2.type = 'sawtooth';
      osc1.frequency.setValueAtTime(baseFreq * 0.975, now);
      osc1.frequency.exponentialRampToValueAtTime(baseFreq, now + 0.032);
      osc2.frequency.setValueAtTime(baseFreq, now);
      osc2.detune.setValueAtTime(5, now);

      const lpf = this.ctx.createBiquadFilter();
      lpf.type = 'lowpass';
      lpf.Q.value = 1.8;
      lpf.frequency.setValueAtTime(480, now);
      lpf.frequency.exponentialRampToValueAtTime(Math.min(5400, baseFreq * 9), now + 0.055);
      lpf.frequency.exponentialRampToValueAtTime(Math.min(3400, baseFreq * 5.8), now + 0.32);

      const bell = this.ctx.createBiquadFilter();
      bell.type = 'peaking';
      bell.frequency.value = 2050;
      bell.Q.value = 1.9;
      bell.gain.value = 6.5;

      osc1.connect(lpf);
      osc2.connect(lpf);
      lpf.connect(bell).connect(voiceGain).connect(this.outGain);

      addBreathNoise(bell, 2600, 2.2, 0.09, 0.012, 0.07, 0.01);

      voiceGain.gain.setValueAtTime(0.0001, now);
      voiceGain.gain.linearRampToValueAtTime(0.42 * vel, now + 0.038);
      voiceGain.gain.exponentialRampToValueAtTime(0.32 * vel, now + 0.3);

      attachVibrato([osc1.detune, osc2.detune], 5.8, 18, 0.25);
      osc1.start(now);
      osc2.start(now);
      stoppables.push(osc1, osc2);
      cleanupNodes.push(lpf, bell);
      releaseSec = 0.14;
    } else if (this.preset === 'trombone') {
      // Warm Rich Brass Trombone (1 octave down)
      const freq = baseFreq * 0.5;
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      osc1.type = 'sawtooth';
      osc2.type = 'triangle';
      osc1.frequency.setValueAtTime(freq * 0.98, now);
      osc1.frequency.exponentialRampToValueAtTime(freq, now + 0.055);
      osc2.frequency.setValueAtTime(freq, now);

      const g1 = this.ctx.createGain();
      const g2 = this.ctx.createGain();
      g1.gain.value = 0.65;
      g2.gain.value = 0.4;

      const lpf = this.ctx.createBiquadFilter();
      lpf.type = 'lowpass';
      lpf.Q.value = 1.5;
      lpf.frequency.setValueAtTime(240, now);
      lpf.frequency.exponentialRampToValueAtTime(Math.min(2500, freq * 7.5), now + 0.09);
      lpf.frequency.exponentialRampToValueAtTime(Math.min(1650, freq * 4.8), now + 0.45);

      const brassMid = this.ctx.createBiquadFilter();
      brassMid.type = 'peaking';
      brassMid.frequency.value = 680;
      brassMid.Q.value = 1.6;
      brassMid.gain.value = 5.5;

      osc1.connect(g1).connect(lpf);
      osc2.connect(g2).connect(lpf);
      lpf.connect(brassMid).connect(voiceGain).connect(this.outGain);

      addBreathNoise(brassMid, 1200, 1.5, 0.08, 0.025, 0.1, 0.012);

      voiceGain.gain.setValueAtTime(0.0001, now);
      voiceGain.gain.linearRampToValueAtTime(0.48 * vel, now + 0.065);
      voiceGain.gain.exponentialRampToValueAtTime(0.38 * vel, now + 0.35);

      attachVibrato([osc1.detune, osc2.detune], 4.8, 16, 0.3);
      osc1.start(now);
      osc2.start(now);
      stoppables.push(osc1, osc2);
      cleanupNodes.push(g1, g2, lpf, brassMid);
      releaseSec = 0.18;
    } else if (this.preset === 'tuba') {
      // Deep Thunderous Tuba (2 octaves down! Massive round brass bass!)
      const freq = Math.max(32, baseFreq * 0.25);
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const osc3 = this.ctx.createOscillator();
      osc1.type = 'sawtooth';
      osc2.type = 'sine';
      osc3.type = 'triangle';
      osc1.frequency.setValueAtTime(freq * 0.985, now);
      osc1.frequency.exponentialRampToValueAtTime(freq, now + 0.07);
      osc2.frequency.setValueAtTime(freq, now);
      osc3.frequency.setValueAtTime(freq * 2, now);

      const g1 = this.ctx.createGain();
      const g2 = this.ctx.createGain();
      const g3 = this.ctx.createGain();
      g1.gain.value = 0.65;
      g2.gain.value = 0.65;
      g3.gain.value = 0.22;

      const lpf = this.ctx.createBiquadFilter();
      lpf.type = 'lowpass';
      lpf.Q.value = 1.6;
      lpf.frequency.setValueAtTime(140, now);
      lpf.frequency.exponentialRampToValueAtTime(Math.min(1150, freq * 8.5), now + 0.11);
      lpf.frequency.exponentialRampToValueAtTime(Math.min(720, freq * 5.2), now + 0.5);

      const lowBell = this.ctx.createBiquadFilter();
      lowBell.type = 'peaking';
      lowBell.frequency.value = 240;
      lowBell.Q.value = 1.2;
      lowBell.gain.value = 5.5;

      osc1.connect(g1).connect(lpf);
      osc2.connect(g2).connect(lpf);
      osc3.connect(g3).connect(lpf);
      lpf.connect(lowBell).connect(voiceGain).connect(this.outGain);

      addBreathNoise(lowBell, 520, 1.2, 0.09, 0.03, 0.12, 0.01);

      voiceGain.gain.setValueAtTime(0.0001, now);
      voiceGain.gain.linearRampToValueAtTime(0.62 * vel, now + 0.08);
      voiceGain.gain.exponentialRampToValueAtTime(0.48 * vel, now + 0.4);

      osc1.start(now);
      osc2.start(now);
      osc3.start(now);
      stoppables.push(osc1, osc2, osc3);
      cleanupNodes.push(g1, g2, g3, lpf, lowBell);
      releaseSec = 0.22;
    } else if (this.preset === 'flute') {
      // Sweet Breathy Concert Flute
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      osc1.type = 'sine';
      osc2.type = 'triangle';
      osc1.frequency.setValueAtTime(baseFreq, now);
      osc2.frequency.setValueAtTime(baseFreq * 2, now);

      const g1 = this.ctx.createGain();
      const g2 = this.ctx.createGain();
      g1.gain.value = 0.85;
      g2.gain.value = 0.14;

      const lpf = this.ctx.createBiquadFilter();
      lpf.type = 'lowpass';
      lpf.frequency.value = 4800;

      osc1.connect(g1).connect(lpf);
      osc2.connect(g2).connect(lpf);
      lpf.connect(voiceGain).connect(this.outGain);

      // Authentic airy flute chiff on attack + subtle breath stream
      addBreathNoise(voiceGain, Math.min(4200, baseFreq * 3.5), 2.8, 0.15, 0.03, 0.12, 0.032);

      voiceGain.gain.setValueAtTime(0.0001, now);
      voiceGain.gain.linearRampToValueAtTime(0.42 * vel, now + 0.075);

      attachVibrato([osc1.detune, osc2.detune], 5.6, 18, 0.24);
      osc1.start(now);
      osc2.start(now);
      stoppables.push(osc1, osc2);
      cleanupNodes.push(g1, g2, lpf);
      releaseSec = 0.18;
    }

    // =========================================================================
    // CORDAS: Violino Solo & Orquestra de Cordas
    // =========================================================================
    else if (this.preset === 'violin') {
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      osc1.type = 'sawtooth';
      osc2.type = 'sawtooth';
      osc1.frequency.setValueAtTime(baseFreq, now);
      osc2.frequency.setValueAtTime(baseFreq, now);
      osc2.detune.setValueAtTime(4, now);

      const body1 = this.ctx.createBiquadFilter();
      body1.type = 'peaking';
      body1.frequency.value = 480;
      body1.Q.value = 1.6;
      body1.gain.value = 5.0;

      const body2 = this.ctx.createBiquadFilter();
      body2.type = 'peaking';
      body2.frequency.value = 2550;
      body2.Q.value = 2.0;
      body2.gain.value = 4.5;

      const lpf = this.ctx.createBiquadFilter();
      lpf.type = 'lowpass';
      lpf.frequency.setValueAtTime(1200, now);
      lpf.frequency.linearRampToValueAtTime(4200, now + 0.18);

      osc1.connect(body1);
      osc2.connect(body1);
      body1.connect(body2).connect(lpf).connect(voiceGain).connect(this.outGain);

      // Soft rosined bow friction on onset
      addBreathNoise(body2, 3200, 1.6, 0.07, 0.05, 0.15, 0.015);

      voiceGain.gain.setValueAtTime(0.0001, now);
      voiceGain.gain.linearRampToValueAtTime(0.32 * vel, now + 0.15);

      attachVibrato([osc1.detune, osc2.detune], 5.8, 22, 0.22);
      osc1.start(now);
      osc2.start(now);
      stoppables.push(osc1, osc2);
      cleanupNodes.push(body1, body2, lpf);
      releaseSec = 0.28;
    } else if (this.preset === 'strings-ensemble') {
      const detunes = [-12, -4, 4, 12];
      const lpf = this.ctx.createBiquadFilter();
      lpf.type = 'lowpass';
      lpf.Q.value = 0.8;
      lpf.frequency.setValueAtTime(900, now);
      lpf.frequency.linearRampToValueAtTime(2900, now + 0.45);

      const detuneParams: AudioParam[] = [];
      for (const det of detunes) {
        const o = this.ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.setValueAtTime(baseFreq, now);
        o.detune.setValueAtTime(det, now);
        const g = this.ctx.createGain();
        g.gain.value = 0.22;
        o.connect(g).connect(lpf);
        o.start(now);
        stoppables.push(o);
        cleanupNodes.push(g);
        detuneParams.push(o.detune);
      }

      lpf.connect(voiceGain).connect(this.outGain);
      voiceGain.gain.setValueAtTime(0.0001, now);
      voiceGain.gain.linearRampToValueAtTime(0.36 * vel, now + 0.28);

      attachVibrato(detuneParams, 5.1, 12, 0.35);
      cleanupNodes.push(lpf);
      releaseSec = 0.65;
    }

    // =========================================================================
    // TECLAS EXTRAS: Acordeon / Sanfona & Clavinet Funk
    // =========================================================================
    else if (this.preset === 'accordion') {
      // Wet Musette / Gaúcho Accordion (3 detuned reeds + bellows body formant!)
      const reeds = [
        { mult: 1.0, det: -10, amp: 0.32, type: 'sawtooth' as OscillatorType },
        { mult: 1.0, det: 0, amp: 0.38, type: 'sawtooth' as OscillatorType },
        { mult: 1.0, det: 11, amp: 0.32, type: 'sawtooth' as OscillatorType },
        { mult: 0.5, det: 0, amp: 0.24, type: 'triangle' as OscillatorType }
      ];

      const formant = this.ctx.createBiquadFilter();
      formant.type = 'peaking';
      formant.frequency.value = 1150;
      formant.Q.value = 1.4;
      formant.gain.value = 5.5;

      const lpf = this.ctx.createBiquadFilter();
      lpf.type = 'lowpass';
      lpf.frequency.value = 3400;

      for (const r of reeds) {
        const o = this.ctx.createOscillator();
        o.type = r.type;
        o.frequency.setValueAtTime(baseFreq * r.mult, now);
        o.detune.setValueAtTime(r.det, now);
        const g = this.ctx.createGain();
        g.gain.value = r.amp;
        o.connect(g).connect(formant);
        o.start(now);
        stoppables.push(o);
        cleanupNodes.push(g);
      }

      formant.connect(lpf).connect(voiceGain).connect(this.outGain);
      voiceGain.gain.setValueAtTime(0.0001, now);
      voiceGain.gain.linearRampToValueAtTime(0.36 * vel, now + 0.035);
      cleanupNodes.push(formant, lpf);
      releaseSec = 0.14;
    } else if (this.preset === 'clavinet') {
      // Funky Hohner Clavinet D6 (Stevie Wonder — snappy nasal tangent pluck!)
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      osc1.type = 'sawtooth';
      osc2.type = 'square';
      osc1.frequency.setValueAtTime(baseFreq, now);
      osc2.frequency.setValueAtTime(baseFreq * 2, now);

      const g1 = this.ctx.createGain();
      const g2 = this.ctx.createGain();
      g1.gain.value = 0.55;
      g2.gain.value = 0.22;

      const hpf = this.ctx.createBiquadFilter();
      hpf.type = 'highpass';
      hpf.frequency.value = 240;

      const nasal = this.ctx.createBiquadFilter();
      nasal.type = 'peaking';
      nasal.frequency.value = 1900;
      nasal.Q.value = 2.4;
      nasal.gain.value = 7.0;

      const lpf = this.ctx.createBiquadFilter();
      lpf.type = 'lowpass';
      lpf.frequency.setValueAtTime(6200, now);
      lpf.frequency.exponentialRampToValueAtTime(1400, now + 0.28);

      osc1.connect(g1).connect(hpf);
      osc2.connect(g2).connect(hpf);
      hpf.connect(nasal).connect(lpf).connect(voiceGain).connect(this.outGain);

      voiceGain.gain.setValueAtTime(0.0001, now);
      voiceGain.gain.linearRampToValueAtTime(0.46 * vel, now + 0.004);
      voiceGain.gain.exponentialRampToValueAtTime(0.14 * vel, now + 0.22);
      voiceGain.gain.exponentialRampToValueAtTime(0.015 * vel, now + 1.1);

      osc1.start(now);
      osc2.start(now);
      stoppables.push(osc1, osc2);
      cleanupNodes.push(g1, g2, hpf, nasal, lpf);
      releaseSec = 0.08;
    }

    // =========================================================================
    // ORIGINAL CORE KEYS & SYNTHS (Grand Piano, Rhodes, Organ, Lead, Pad, Synth Bass)
    // =========================================================================
    else if (this.preset === 'grand-piano') {
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const osc3 = this.ctx.createOscillator();
      osc1.type = 'triangle';
      osc1.frequency.setValueAtTime(baseFreq, now);
      osc2.type = 'sawtooth';
      osc2.frequency.setValueAtTime(baseFreq, now);
      osc2.detune.setValueAtTime(3.5, now);
      osc3.type = 'sine';
      osc3.frequency.setValueAtTime(baseFreq * 2, now);

      const g1 = this.ctx.createGain();
      const g2 = this.ctx.createGain();
      const g3 = this.ctx.createGain();
      g1.gain.value = 0.62;
      g2.gain.value = 0.22;
      g3.gain.value = 0.18;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.Q.value = 0.8;
      filter.frequency.setValueAtTime(Math.min(9000, baseFreq * 12), now);
      filter.frequency.exponentialRampToValueAtTime(Math.max(420, baseFreq * 2.3), now + 0.65);

      osc1.connect(g1).connect(filter);
      osc2.connect(g2).connect(filter);
      osc3.connect(g3).connect(filter);
      filter.connect(voiceGain).connect(this.outGain);

      voiceGain.gain.setValueAtTime(0.0001, now);
      voiceGain.gain.linearRampToValueAtTime(0.46 * vel, now + 0.008);
      voiceGain.gain.exponentialRampToValueAtTime(0.2 * vel, now + 0.35);
      voiceGain.gain.exponentialRampToValueAtTime(0.025 * vel, now + 2.6);

      osc1.start(now);
      osc2.start(now);
      osc3.start(now);
      stoppables.push(osc1, osc2, osc3);
      cleanupNodes.push(g1, g2, g3, filter);
      releaseSec = 0.28;
    } else if (this.preset === 'rhodes-ep') {
      const carrier = this.ctx.createOscillator();
      const bell = this.ctx.createOscillator();
      const sub = this.ctx.createOscillator();
      carrier.type = 'sine';
      carrier.frequency.setValueAtTime(baseFreq, now);
      bell.type = 'sine';
      bell.frequency.setValueAtTime(baseFreq * 3, now);
      sub.type = 'triangle';
      sub.frequency.setValueAtTime(baseFreq, now);
      sub.detune.setValueAtTime(-4, now);

      const gCarrier = this.ctx.createGain();
      const gBell = this.ctx.createGain();
      const gSub = this.ctx.createGain();
      gCarrier.gain.value = 0.72;
      gSub.gain.value = 0.22;
      gBell.gain.setValueAtTime(0.32 * vel, now);
      gBell.gain.exponentialRampToValueAtTime(0.001, now + 0.24);

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 3400;

      carrier.connect(gCarrier).connect(filter);
      bell.connect(gBell).connect(filter);
      sub.connect(gSub).connect(filter);
      filter.connect(voiceGain).connect(this.outGain);

      voiceGain.gain.setValueAtTime(0.0001, now);
      voiceGain.gain.linearRampToValueAtTime(0.44 * vel, now + 0.01);
      voiceGain.gain.exponentialRampToValueAtTime(0.24 * vel, now + 0.45);
      voiceGain.gain.exponentialRampToValueAtTime(0.04 * vel, now + 3.2);

      carrier.start(now);
      bell.start(now);
      sub.start(now);
      stoppables.push(carrier, bell, sub);
      cleanupNodes.push(gCarrier, gBell, gSub, filter);
      releaseSec = 0.35;
    } else if (this.preset === 'rock-organ') {
      const ratios = [
        { mult: 0.5, amp: 0.32 },
        { mult: 1.0, amp: 0.44 },
        { mult: 1.5, amp: 0.22 },
        { mult: 2.0, amp: 0.24 },
        { mult: 4.0, amp: 0.1 }
      ];
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 4800;

      for (const r of ratios) {
        const o = this.ctx.createOscillator();
        o.type = 'sine';
        o.frequency.setValueAtTime(baseFreq * r.mult, now);
        const g = this.ctx.createGain();
        g.gain.value = r.amp;
        o.connect(g).connect(filter);
        o.start(now);
        stoppables.push(o);
        cleanupNodes.push(g);
      }
      filter.connect(voiceGain).connect(this.outGain);
      voiceGain.gain.setValueAtTime(0.0001, now);
      voiceGain.gain.linearRampToValueAtTime(0.38 * vel, now + 0.008);
      cleanupNodes.push(filter);
      releaseSec = 0.09;
    } else if (this.preset === 'synth-lead') {
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      osc1.type = 'sawtooth';
      osc2.type = 'sawtooth';
      osc1.frequency.setValueAtTime(baseFreq, now);
      osc2.frequency.setValueAtTime(baseFreq, now);
      osc1.detune.setValueAtTime(-9, now);
      osc2.detune.setValueAtTime(9, now);

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.Q.value = 3.2;
      filter.frequency.setValueAtTime(420, now);
      filter.frequency.exponentialRampToValueAtTime(Math.min(7200, baseFreq * 8), now + 0.055);
      filter.frequency.exponentialRampToValueAtTime(Math.max(550, baseFreq * 3.2), now + 0.45);

      osc1.connect(filter);
      osc2.connect(filter);
      filter.connect(voiceGain).connect(this.outGain);

      voiceGain.gain.setValueAtTime(0.0001, now);
      voiceGain.gain.linearRampToValueAtTime(0.3 * vel, now + 0.015);
      voiceGain.gain.exponentialRampToValueAtTime(0.22 * vel, now + 0.25);

      attachVibrato([osc1.detune, osc2.detune], 5.5, 16, 0.3);
      osc1.start(now);
      osc2.start(now);
      stoppables.push(osc1, osc2);
      cleanupNodes.push(filter);
      releaseSec = 0.22;
    } else if (this.preset === 'warm-pad') {
      const detunes = [-12, 0, 12];
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.Q.value = 1.2;
      filter.frequency.setValueAtTime(650, now);
      filter.frequency.linearRampToValueAtTime(2400, now + 0.9);

      for (const d of detunes) {
        const o = this.ctx.createOscillator();
        o.type = d === 0 ? 'triangle' : 'sawtooth';
        o.frequency.setValueAtTime(baseFreq, now);
        o.detune.setValueAtTime(d, now);
        const g = this.ctx.createGain();
        g.gain.value = d === 0 ? 0.38 : 0.22;
        o.connect(g).connect(filter);
        o.start(now);
        stoppables.push(o);
        cleanupNodes.push(g);
      }

      filter.connect(voiceGain).connect(this.outGain);
      voiceGain.gain.setValueAtTime(0.0001, now);
      voiceGain.gain.linearRampToValueAtTime(0.34 * vel, now + 0.32);
      cleanupNodes.push(filter);
      releaseSec = 0.85;
    } else {
      // Synth Bass
      const bassFreq = baseFreq * 0.5;
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      osc1.type = 'sawtooth';
      osc2.type = 'sine';
      osc1.frequency.setValueAtTime(bassFreq, now);
      osc2.frequency.setValueAtTime(bassFreq, now);

      const g1 = this.ctx.createGain();
      const g2 = this.ctx.createGain();
      g1.gain.value = 0.42;
      g2.gain.value = 0.65;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.Q.value = 2.2;
      filter.frequency.setValueAtTime(1600, now);
      filter.frequency.exponentialRampToValueAtTime(240, now + 0.24);

      osc1.connect(g1).connect(filter);
      osc2.connect(g2).connect(filter);
      filter.connect(voiceGain).connect(this.outGain);

      voiceGain.gain.setValueAtTime(0.0001, now);
      voiceGain.gain.linearRampToValueAtTime(0.54 * vel, now + 0.008);
      voiceGain.gain.exponentialRampToValueAtTime(0.32 * vel, now + 0.22);

      osc1.start(now);
      osc2.start(now);
      stoppables.push(osc1, osc2);
      cleanupNodes.push(g1, g2, filter);
      releaseSec = 0.16;
    }

    let stopped = false;
    const stop = (customRelease?: number) => {
      if (stopped) return;
      stopped = true;
      const rel = customRelease ?? releaseSec;
      const t = this.ctx.currentTime;
      try {
        voiceGain.gain.cancelScheduledValues(t);
        voiceGain.gain.setValueAtTime(Math.max(0.0001, voiceGain.gain.value), t);
        voiceGain.gain.exponentialRampToValueAtTime(0.0001, t + rel);
        stoppables.forEach((s) => {
          try {
            s.stop(t + rel + 0.03);
          } catch {
            // ignore
          }
        });
        window.setTimeout(() => {
          cleanupNodes.forEach((n) => {
            try {
              n.disconnect();
            } catch {
              // ignore
            }
          });
        }, (rel + 0.1) * 1000);
      } catch {
        // ignore
      }
    };

    this.activeVoices.set(midi, { stop, midi, sustained: false });
  }

  noteOff(midi: number) {
    const voice = this.activeVoices.get(midi);
    if (!voice) return;
    if (this.sustainActive) {
      voice.sustained = true;
      return;
    }
    voice.stop();
    this.activeVoices.delete(midi);
  }

  panic() {
    for (const voice of this.activeVoices.values()) {
      voice.stop(0.03);
    }
    this.activeVoices.clear();
  }
}
