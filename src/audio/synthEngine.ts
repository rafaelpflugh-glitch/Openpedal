export type SynthVoicePreset =
  | 'grand-piano'
  | 'rhodes-ep'
  | 'rock-organ'
  | 'synth-lead'
  | 'warm-pad'
  | 'synth-bass';

export type InstrumentRouting = 'clean-looper' | 'pedal-chain';

interface ActiveVoice {
  stop: (releaseTime?: number) => void;
  midi: number;
  sustained: boolean;
}

export function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export class SynthEngine {
  private ctx: AudioContext;
  private outGain: GainNode;
  private preset: SynthVoicePreset = 'grand-piano';
  private activeVoices = new Map<number, ActiveVoice>();
  private sustainActive = false;

  constructor(ctx: AudioContext, destination: AudioNode) {
    this.ctx = ctx;
    this.outGain = ctx.createGain();
    this.outGain.gain.value = 0.65;
    this.outGain.connect(destination);
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
    const clamped = Math.max(0, Math.min(1.2, vol));
    this.outGain.gain.setTargetAtTime(clamped, this.ctx.currentTime, 0.015);
  }

  setPreset(preset: SynthVoicePreset) {
    this.preset = preset;
  }

  setSustain(active: boolean) {
    this.sustainActive = active;
    if (!active) {
      // Release all notes that were held only by sustain
      for (const [midi, voice] of Array.from(this.activeVoices.entries())) {
        if (voice.sustained) {
          voice.stop();
          this.activeVoices.delete(midi);
        }
      }
    }
  }

  noteOn(midi: number, velocity = 0.85) {
    // Re-trigger cleanly if already sounding
    const prev = this.activeVoices.get(midi);
    if (prev) {
      prev.stop(0.025);
      this.activeVoices.delete(midi);
    }

    const now = this.ctx.currentTime;
    const freq = midiToFreq(midi);
    const vel = Math.max(0.1, Math.min(1, velocity));

    const voiceGain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();
    const oscs: OscillatorNode[] = [];
    const extraNodes: AudioNode[] = [];

    let releaseSec = 0.25;

    if (this.preset === 'grand-piano') {
      // Hammered multi-harmonic acoustic piano approximation
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const osc3 = this.ctx.createOscillator();
      osc1.type = 'triangle';
      osc1.frequency.setValueAtTime(freq, now);

      osc2.type = 'sawtooth';
      osc2.frequency.setValueAtTime(freq, now);
      osc2.detune.setValueAtTime(3.5, now);

      osc3.type = 'sine';
      osc3.frequency.setValueAtTime(freq * 2, now);

      const g1 = this.ctx.createGain();
      const g2 = this.ctx.createGain();
      const g3 = this.ctx.createGain();
      g1.gain.value = 0.62;
      g2.gain.value = 0.22;
      g3.gain.value = 0.18;

      filter.type = 'lowpass';
      filter.Q.value = 0.8;
      filter.frequency.setValueAtTime(Math.min(9000, freq * 12), now);
      filter.frequency.exponentialRampToValueAtTime(Math.max(420, freq * 2.3), now + 0.65);

      osc1.connect(g1).connect(filter);
      osc2.connect(g2).connect(filter);
      osc3.connect(g3).connect(filter);

      voiceGain.gain.setValueAtTime(0.0001, now);
      voiceGain.gain.linearRampToValueAtTime(0.46 * vel, now + 0.008);
      voiceGain.gain.exponentialRampToValueAtTime(0.2 * vel, now + 0.35);
      voiceGain.gain.exponentialRampToValueAtTime(0.025 * vel, now + 2.6);

      oscs.push(osc1, osc2, osc3);
      extraNodes.push(g1, g2, g3);
      releaseSec = 0.28;
    } else if (this.preset === 'rhodes-ep') {
      // Warm Fender Rhodes bell-like electric piano
      const carrier = this.ctx.createOscillator();
      const bell = this.ctx.createOscillator();
      const sub = this.ctx.createOscillator();

      carrier.type = 'sine';
      carrier.frequency.setValueAtTime(freq, now);
      bell.type = 'sine';
      bell.frequency.setValueAtTime(freq * 3, now);
      sub.type = 'triangle';
      sub.frequency.setValueAtTime(freq, now);
      sub.detune.setValueAtTime(-4, now);

      const gCarrier = this.ctx.createGain();
      const gBell = this.ctx.createGain();
      const gSub = this.ctx.createGain();

      gCarrier.gain.value = 0.72;
      gSub.gain.value = 0.22;
      gBell.gain.setValueAtTime(0.32 * vel, now);
      gBell.gain.exponentialRampToValueAtTime(0.001, now + 0.24);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(3400, now);

      carrier.connect(gCarrier).connect(filter);
      bell.connect(gBell).connect(filter);
      sub.connect(gSub).connect(filter);

      voiceGain.gain.setValueAtTime(0.0001, now);
      voiceGain.gain.linearRampToValueAtTime(0.44 * vel, now + 0.01);
      voiceGain.gain.exponentialRampToValueAtTime(0.24 * vel, now + 0.45);
      voiceGain.gain.exponentialRampToValueAtTime(0.04 * vel, now + 3.2);

      oscs.push(carrier, bell, sub);
      extraNodes.push(gCarrier, gBell, gSub);
      releaseSec = 0.35;
    } else if (this.preset === 'rock-organ') {
      // Hammond-inspired drawbars (16', 8', 5-1/3', 4')
      const ratios = [
        { mult: 0.5, amp: 0.32 },
        { mult: 1.0, amp: 0.44 },
        { mult: 1.5, amp: 0.22 },
        { mult: 2.0, amp: 0.24 },
        { mult: 4.0, amp: 0.1 }
      ];
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(4800, now);

      for (const r of ratios) {
        const o = this.ctx.createOscillator();
        o.type = 'sine';
        o.frequency.setValueAtTime(freq * r.mult, now);
        const g = this.ctx.createGain();
        g.gain.value = r.amp;
        o.connect(g).connect(filter);
        oscs.push(o);
        extraNodes.push(g);
      }

      voiceGain.gain.setValueAtTime(0.0001, now);
      voiceGain.gain.linearRampToValueAtTime(0.38 * vel, now + 0.008);
      releaseSec = 0.09;
    } else if (this.preset === 'synth-lead') {
      // Dual detuned sawtooth analog synth lead
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      osc1.type = 'sawtooth';
      osc2.type = 'sawtooth';
      osc1.frequency.setValueAtTime(freq, now);
      osc2.frequency.setValueAtTime(freq, now);
      osc1.detune.setValueAtTime(-9, now);
      osc2.detune.setValueAtTime(9, now);

      filter.type = 'lowpass';
      filter.Q.value = 3.2;
      filter.frequency.setValueAtTime(420, now);
      filter.frequency.exponentialRampToValueAtTime(Math.min(7200, freq * 8), now + 0.055);
      filter.frequency.exponentialRampToValueAtTime(Math.max(550, freq * 3.2), now + 0.45);

      osc1.connect(filter);
      osc2.connect(filter);

      voiceGain.gain.setValueAtTime(0.0001, now);
      voiceGain.gain.linearRampToValueAtTime(0.3 * vel, now + 0.015);
      voiceGain.gain.exponentialRampToValueAtTime(0.22 * vel, now + 0.25);

      oscs.push(osc1, osc2);
      releaseSec = 0.22;
    } else if (this.preset === 'warm-pad') {
      // Lush detuned slow-attack stereo pad
      const detunes = [-12, 0, 12];
      filter.type = 'lowpass';
      filter.Q.value = 1.2;
      filter.frequency.setValueAtTime(650, now);
      filter.frequency.linearRampToValueAtTime(2400, now + 0.9);

      for (const d of detunes) {
        const o = this.ctx.createOscillator();
        o.type = d === 0 ? 'triangle' : 'sawtooth';
        o.frequency.setValueAtTime(freq, now);
        o.detune.setValueAtTime(d, now);
        const g = this.ctx.createGain();
        g.gain.value = d === 0 ? 0.38 : 0.22;
        o.connect(g).connect(filter);
        oscs.push(o);
        extraNodes.push(g);
      }

      voiceGain.gain.setValueAtTime(0.0001, now);
      voiceGain.gain.linearRampToValueAtTime(0.34 * vel, now + 0.32);
      releaseSec = 0.85;
    } else {
      // Synth / Electric Bass (one octave down punch)
      const bassFreq = freq * 0.5;
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

      filter.type = 'lowpass';
      filter.Q.value = 2.0;
      filter.frequency.setValueAtTime(1600, now);
      filter.frequency.exponentialRampToValueAtTime(260, now + 0.24);

      osc1.connect(g1).connect(filter);
      osc2.connect(g2).connect(filter);

      voiceGain.gain.setValueAtTime(0.0001, now);
      voiceGain.gain.linearRampToValueAtTime(0.54 * vel, now + 0.008);
      voiceGain.gain.exponentialRampToValueAtTime(0.32 * vel, now + 0.22);

      oscs.push(osc1, osc2);
      extraNodes.push(g1, g2);
      releaseSec = 0.16;
    }

    filter.connect(voiceGain);
    voiceGain.connect(this.outGain);
    oscs.forEach((o) => o.start(now));

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
        oscs.forEach((o) => {
          try {
            o.stop(t + rel + 0.03);
          } catch {
            // ignore
          }
        });
        window.setTimeout(() => {
          try {
            voiceGain.disconnect();
            filter.disconnect();
            extraNodes.forEach((n) => n.disconnect());
          } catch {
            // ignore
          }
        }, (rel + 0.08) * 1000);
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
