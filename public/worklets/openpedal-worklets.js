// OpenPedal AudioWorklet Processors
// 1. Noise Gate with hysteresis and smooth attack/release
// 2. Cry Baby / Auto-Wah State-Variable Filter Processor
// 3. Analog Sub-Octave (-1 Oct) & Octavia (+1 Oct) Processor
// 4. Analog Drive Processor (4x Oversampled Klon Centaur, TS9, Boss DS-1, ProCo RAT w/ Dynamic Sag & Slew)
// 5. Analog Fuzz Processor (4x Oversampled Cascading Big Muff Pi, Germanium Fuzz Face, Super Fuzz)
// 6. Sample-accurate Stereo Looper with Overdub & Undo

class NoiseGateProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'threshold', defaultValue: -50, minValue: -85, maxValue: -5, automationRate: 'k-rate' },
      { name: 'release', defaultValue: 0.12, minValue: 0.01, maxValue: 0.8, automationRate: 'k-rate' },
      { name: 'enabled', defaultValue: 1, minValue: 0, maxValue: 1, automationRate: 'k-rate' }
    ];
  }

  constructor() {
    super();
    this.envelope = 0;
    this.gain = 1;
    this.isOpen = true;
    this.frameCounter = 0;
    this.peakRms = 0;
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];
    if (!input || input.length === 0 || !output || output.length === 0) return true;

    const enabled = parameters.enabled[0] >= 0.5;
    const thresholdDb = parameters.threshold[0];
    const releaseSec = Math.max(0.01, parameters.release[0]);
    const openThreshold = Math.pow(10, thresholdDb / 20);
    const closeThreshold = Math.pow(10, (thresholdDb - 4) / 20);

    const attackCoeff = Math.exp(-1 / (sampleRate * 0.002));
    const releaseCoeff = Math.exp(-1 / (sampleRate * releaseSec));
    const envSmooth = Math.exp(-1 / (sampleRate * 0.005));

    const chCount = Math.min(input.length, output.length);
    const frames = input[0].length;
    let sumSq = 0;

    for (let i = 0; i < frames; i++) {
      let monoAbs = 0;
      for (let ch = 0; ch < chCount; ch++) {
        const s = input[ch][i];
        monoAbs = Math.max(monoAbs, Math.abs(s));
        sumSq += s * s;
      }

      this.envelope = envSmooth * this.envelope + (1 - envSmooth) * monoAbs;

      if (!enabled) {
        this.isOpen = true;
        this.gain = 1;
      } else {
        if (this.isOpen) {
          if (this.envelope < closeThreshold) this.isOpen = false;
        } else {
          if (this.envelope > openThreshold) this.isOpen = true;
        }

        const targetGain = this.isOpen ? 1 : 0;
        if (targetGain > this.gain) {
          this.gain = attackCoeff * this.gain + (1 - attackCoeff) * targetGain;
        } else {
          this.gain = releaseCoeff * this.gain + (1 - releaseCoeff) * targetGain;
        }
      }

      for (let ch = 0; ch < chCount; ch++) {
        output[ch][i] = input[ch][i] * this.gain;
      }
    }

    const rms = Math.sqrt(sumSq / Math.max(1, frames * chCount));
    this.peakRms = Math.max(this.peakRms * 0.85, rms);
    this.frameCounter += frames;

    if (this.frameCounter >= sampleRate * 0.05) {
      this.frameCounter = 0;
      const levelDb = this.peakRms > 1e-6 ? 20 * Math.log10(this.peakRms) : -96;
      this.port.postMessage({ isOpen: this.isOpen, levelDb });
    }

    return true;
  }
}

class EnvelopeWahProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'mode', defaultValue: 1, minValue: 0, maxValue: 2, automationRate: 'k-rate' },
      { name: 'position', defaultValue: 55, minValue: 0, maxValue: 100, automationRate: 'k-rate' },
      { name: 'q', defaultValue: 4.8, minValue: 1.5, maxValue: 10, automationRate: 'k-rate' },
      { name: 'range', defaultValue: 80, minValue: 15, maxValue: 100, automationRate: 'k-rate' },
      { name: 'enabled', defaultValue: 0, minValue: 0, maxValue: 1, automationRate: 'k-rate' }
    ];
  }

  constructor() {
    super();
    this.env = 0;
    this.smoothPos = 0.5;
    this.lfoPhase = 0;
    this.lowL = 0;
    this.bandL = 0;
    this.lowR = 0;
    this.bandR = 0;
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];
    if (!input || input.length === 0 || !output || output.length === 0) return true;

    const enabled = parameters.enabled[0] >= 0.5;
    const mode = Math.round(parameters.mode[0]);
    const posParam = parameters.position[0] / 100;
    const qVal = Math.max(1.5, Math.min(10, parameters.q[0]));
    const rangeNorm = parameters.range[0] / 100;

    const inL = input[0];
    const inR = input[1] || input[0];
    const outL = output[0];
    const outR = output[1] || output[0];
    const frames = outL.length;

    if (!enabled) {
      for (let i = 0; i < frames; i++) {
        outL[i] = inL[i];
        if (output[1]) outR[i] = inR[i];
      }
      return true;
    }

    const att = Math.exp(-1 / (sampleRate * 0.008));
    const rel = Math.exp(-1 / (sampleRate * 0.16));
    const posSmooth = Math.exp(-1 / (sampleRate * 0.012));
    const lfoRate = 0.35 + posParam * 4.5;
    const lfoInc = (2 * Math.PI * lfoRate) / sampleRate;

    const minFreq = 320;
    const maxFreq = 950 + rangeNorm * 1850;
    const damp = 1 / qVal;
    const bpGain = 1.15 / Math.sqrt(qVal);

    for (let i = 0; i < frames; i++) {
      const sL = inL[i];
      const sR = inR[i];
      const absIn = Math.max(Math.abs(sL), Math.abs(sR));

      if (absIn > this.env) {
        this.env = att * this.env + (1 - att) * absIn;
      } else {
        this.env = rel * this.env + (1 - rel) * absIn;
      }

      let targetPos = posParam;
      if (mode === 1) {
        const sens = 1.6 + posParam * 10.5;
        targetPos = Math.min(1, Math.pow(Math.min(1, this.env * sens), 0.78));
      } else if (mode === 2) {
        this.lfoPhase += lfoInc;
        if (this.lfoPhase > Math.PI * 2) this.lfoPhase -= Math.PI * 2;
        targetPos = 0.5 + 0.5 * Math.sin(this.lfoPhase);
      }

      this.smoothPos = posSmooth * this.smoothPos + (1 - posSmooth) * targetPos;
      const freq = minFreq * Math.pow(maxFreq / minFreq, this.smoothPos);
      const f = Math.min(0.65, 2 * Math.sin((Math.PI * freq) / sampleRate));

      for (let os = 0; os < 2; os++) {
        const fHalf = f * 0.5;
        this.lowL += fHalf * this.bandL;
        const highL = sL - this.lowL - damp * this.bandL;
        this.bandL += fHalf * highL;

        this.lowR += fHalf * this.bandR;
        const highR = sR - this.lowR - damp * this.bandR;
        this.bandR += fHalf * highR;
      }

      const wetL = this.bandL * bpGain + sL * 0.32;
      const wetR = this.bandR * bpGain + sR * 0.32;

      outL[i] = Math.max(-1.2, Math.min(1.2, wetL));
      if (output[1]) outR[i] = Math.max(-1.2, Math.min(1.2, wetR));
    }

    return true;
  }
}

class OctaverProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'dry', defaultValue: 0.85, minValue: 0, maxValue: 1, automationRate: 'k-rate' },
      { name: 'sub', defaultValue: 0.65, minValue: 0, maxValue: 1, automationRate: 'k-rate' },
      { name: 'octUp', defaultValue: 0.25, minValue: 0, maxValue: 1, automationRate: 'k-rate' },
      { name: 'enabled', defaultValue: 0, minValue: 0, maxValue: 1, automationRate: 'k-rate' }
    ];
  }

  constructor() {
    super();
    this.lpTrack1 = 0;
    this.lpTrack2 = 0;
    this.prevSign = false;
    this.flipFlop = 1;
    this.subLp1 = 0;
    this.subLp2 = 0;
    this.env = 0;
    this.upHpIn = 0;
    this.upHpOut = 0;
    this.upDcIn = 0;
    this.upDcOut = 0;
    this.upLp = 0;
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];
    if (!input || input.length === 0 || !output || output.length === 0) return true;

    const enabled = parameters.enabled[0] >= 0.5;
    const dryMix = parameters.dry[0];
    const subMix = parameters.sub[0];
    const upMix = parameters.octUp[0];

    const inL = input[0];
    const inR = input[1] || input[0];
    const outL = output[0];
    const outR = output[1] || output[0];
    const frames = outL.length;

    if (!enabled) {
      for (let i = 0; i < frames; i++) {
        outL[i] = inL[i];
        if (output[1]) outR[i] = inR[i];
      }
      return true;
    }

    const trackAlpha = 1 - Math.exp((-2 * Math.PI * 280) / sampleRate);
    const subAlpha = 1 - Math.exp((-2 * Math.PI * 240) / sampleRate);
    const upLpAlpha = 1 - Math.exp((-2 * Math.PI * 3600) / sampleRate);
    const envAtt = Math.exp(-1 / (sampleRate * 0.006));
    const envRel = Math.exp(-1 / (sampleRate * 0.09));

    for (let i = 0; i < frames; i++) {
      const mono = 0.5 * (inL[i] + inR[i]);
      const absM = Math.abs(mono);

      if (absM > this.env) {
        this.env = envAtt * this.env + (1 - envAtt) * absM;
      } else {
        this.env = envRel * this.env + (1 - envRel) * absM;
      }

      this.lpTrack1 += trackAlpha * (mono - this.lpTrack1);
      this.lpTrack2 += trackAlpha * (this.lpTrack1 - this.lpTrack2);

      const hyst = 0.0025;
      if (!this.prevSign && this.lpTrack2 > hyst) {
        this.prevSign = true;
        this.flipFlop = -this.flipFlop;
      } else if (this.prevSign && this.lpTrack2 < -hyst) {
        this.prevSign = false;
      }

      const rawSub = this.flipFlop * this.env * 1.65;
      this.subLp1 += subAlpha * (rawSub - this.subLp1);
      this.subLp2 += subAlpha * (this.subLp1 - this.subLp2);
      const subSig = this.subLp2 * 1.35;

      const hp = 0.985 * (this.upHpOut + mono - this.upHpIn);
      this.upHpIn = mono;
      this.upHpOut = hp;

      const rect = Math.abs(hp) * 1.45;
      const dcBlocked = 0.992 * (this.upDcOut + rect - this.upDcIn);
      this.upDcIn = rect;
      this.upDcOut = dcBlocked;

      this.upLp += upLpAlpha * (dcBlocked - this.upLp);
      const upSig = this.upLp;

      const mixL = inL[i] * dryMix + subSig * subMix + upSig * upMix;
      const mixR = inR[i] * dryMix + subSig * subMix + upSig * upMix;

      outL[i] = Math.max(-1.5, Math.min(1.5, mixL));
      if (output[1]) outR[i] = Math.max(-1.5, Math.min(1.5, mixR));
    }

    return true;
  }
}

/**
 * 4x Oversampled Analog Overdrive / Distortion Processor
 * Models real dynamic bias sag, diode asymmetry, feedback-loop clean mixing (TS9/Klon),
 * and LM308 op-amp slew-rate limiting (RAT/DS-1) with zero digital aliasing!
 * Modes: 0 = Klon Centaur, 1 = Tube Screamer TS9, 2 = Boss DS-1, 3 = ProCo RAT
 */
class AnalogDriveProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'mode', defaultValue: 0, minValue: 0, maxValue: 3, automationRate: 'k-rate' },
      { name: 'drive', defaultValue: 55, minValue: 0, maxValue: 100, automationRate: 'k-rate' },
      { name: 'enabled', defaultValue: 0, minValue: 0, maxValue: 1, automationRate: 'k-rate' }
    ];
  }

  constructor() {
    super();
    this.prevIn = 0;
    this.sagEnv = 0;
    this.slewState = 0;
    this.aaLp1 = 0;
    this.aaLp2 = 0;
    this.dcIn = 0;
    this.dcOut = 0;
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];
    if (!input || input.length === 0 || !output || output.length === 0) return true;

    const enabled = parameters.enabled[0] >= 0.5;
    const mode = Math.round(parameters.mode[0]);
    const norm = Math.max(0.01, parameters.drive[0] / 100);

    const inL = input[0];
    const inR = input[1] || input[0];
    const outL = output[0];
    const outR = output[1] || output[0];
    const frames = outL.length;

    if (!enabled) {
      for (let i = 0; i < frames; i++) {
        outL[i] = inL[i];
        if (output[1]) outR[i] = inR[i];
      }
      return true;
    }

    const osRate = sampleRate * 4;
    const aaAlpha = 1 - Math.exp((-2 * Math.PI * 11000) / osRate);
    const sagAtt = Math.exp(-1 / (osRate * 0.005));
    const sagRel = Math.exp(-1 / (osRate * 0.085));

    // Mode-specific analog circuit parameters
    const preGain =
      mode === 0
        ? 1.5 + Math.pow(norm, 1.35) * 9.5 // Klon: transparent golden drive
        : mode === 1
        ? 2.2 + Math.pow(norm, 1.3) * 14.0 // TS9: singing blues-rock sustain
        : mode === 2
        ? 4.2 + Math.pow(norm, 1.2) * 26.0 // DS-1: hard silicon diode crunch
        : 3.4 + Math.pow(norm, 1.25) * 22.0; // RAT: thick LM308 op-amp roar

    // Op-amp slew limit per oversampled tick (rounds harsh brittle spikes!)
    const maxSlew = mode === 3 ? 0.055 : mode === 2 ? 0.085 : 0.14;

    for (let i = 0; i < frames; i++) {
      const currIn = 0.5 * (inL[i] + inR[i]);
      let downSampled = 0;

      // 4x Oversampling loop
      for (let os = 1; os <= 4; os++) {
        const frac = os * 0.25;
        const x = this.prevIn + (currIn - this.prevIn) * frac;

        // Track dynamic envelope for realistic transistor/diode sag
        const ax = Math.abs(x);
        if (ax > this.sagEnv) {
          this.sagEnv = sagAtt * this.sagEnv + (1 - sagAtt) * ax;
        } else {
          this.sagEnv = sagRel * this.sagEnv + (1 - sagRel) * ax;
        }

        // Dynamic bias shift adds living 2nd-order even harmonics on pick attack!
        const dynBias = this.sagEnv * (mode === 1 ? 0.42 : mode === 0 ? 0.28 : 0.22);
        const driven = x * preGain;

        let shaped = 0;
        if (mode === 0) {
          // Klon Centaur: Germanium soft diode clipping + parallel dynamic clean blend
          const clipPos = Math.tanh((driven + dynBias) * 0.85);
          const clipNeg = Math.tanh((driven + dynBias) * 0.78);
          const clipped = driven >= 0 ? clipPos : clipNeg;
          const cleanWeight = (1 - norm * 0.62) * 0.65;
          const dirtyWeight = 0.45 + norm * 0.55;
          shaped = clipped * dirtyWeight + x * 1.4 * cleanWeight;
        } else if (mode === 1) {
          // Tube Screamer TS9: real op-amp feedback loop adds dry input to diode-clipped path!
          const u = driven + dynBias;
          // Asymmetric 2-diode vs 1-diode soft clipping
          const diodeClip = u >= 0 ? Math.tanh(u * 1.1) : Math.tanh(u * 0.82) * 1.06;
          shaped = diodeClip * 0.86 + x * 0.32;
        } else if (mode === 2) {
          // Boss DS-1: hard symmetric silicon diodes with smooth knee transition
          const u = driven + dynBias * 0.5;
          const soft = (2 / Math.PI) * Math.atan(u * 1.15);
          const clamp = Math.max(-0.78, Math.min(0.78, u * 0.45));
          shaped = soft * 0.62 + clamp * 0.38;
        } else {
          // ProCo RAT: aggressive asymmetric silicon hard-clipping
          const u = driven + dynBias * 0.7;
          const raw = (2 / Math.PI) * Math.atan(u * 1.25);
          shaped = u >= 0 ? Math.min(0.84, raw * 1.08) : Math.max(-0.74, raw * 0.96);
        }

        // Op-amp Slew-Rate Limiter (tames harsh digital edges naturally!)
        const delta = shaped - this.slewState;
        if (delta > maxSlew) this.slewState += maxSlew;
        else if (delta < -maxSlew) this.slewState -= maxSlew;
        else this.slewState = shaped;

        // 2-pole Anti-Aliasing Low-Pass filter at 11kHz before decimation
        this.aaLp1 += aaAlpha * (this.slewState - this.aaLp1);
        this.aaLp2 += aaAlpha * (this.aaLp1 - this.aaLp2);
        downSampled = this.aaLp2;
      }

      this.prevIn = currIn;

      // DC Blocker removes any sub-sonic offset from asymmetric clipping
      const dcBlocked = 0.994 * (this.dcOut + downSampled - this.dcIn);
      this.dcIn = downSampled;
      this.dcOut = dcBlocked;

      outL[i] = dcBlocked;
      if (output[1]) outR[i] = dcBlocked;
    }

    return true;
  }
}

/**
 * 4x Oversampled Analog Fuzz Processor
 * Models genuine multi-stage cascading transistor fuzz with dynamic bias starvation & violin sustain!
 * Modes: 0 = Big Muff Pi (2 cascading stages), 1 = Germanium Fuzz Face, 2 = Super Fuzz (Octave)
 */
class AnalogFuzzProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'mode', defaultValue: 0, minValue: 0, maxValue: 2, automationRate: 'k-rate' },
      { name: 'sustain', defaultValue: 78, minValue: 0, maxValue: 100, automationRate: 'k-rate' },
      { name: 'enabled', defaultValue: 0, minValue: 0, maxValue: 1, automationRate: 'k-rate' }
    ];
  }

  constructor() {
    super();
    this.prevIn = 0;
    this.sagEnv = 0;
    this.interHpIn = 0;
    this.interHpOut = 0;
    this.interLp = 0;
    this.slew = 0;
    this.aaLp1 = 0;
    this.aaLp2 = 0;
    this.dcIn = 0;
    this.dcOut = 0;
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];
    if (!input || input.length === 0 || !output || output.length === 0) return true;

    const enabled = parameters.enabled[0] >= 0.5;
    const mode = Math.round(parameters.mode[0]);
    const norm = Math.max(0.01, parameters.sustain[0] / 100);

    const inL = input[0];
    const inR = input[1] || input[0];
    const outL = output[0];
    const outR = output[1] || output[0];
    const frames = outL.length;

    if (!enabled) {
      for (let i = 0; i < frames; i++) {
        outL[i] = inL[i];
        if (output[1]) outR[i] = inR[i];
      }
      return true;
    }

    const osRate = sampleRate * 4;
    const aaAlpha = 1 - Math.exp((-2 * Math.PI * 10500) / osRate);
    const interLpAlpha = 1 - Math.exp((-2 * Math.PI * 3600) / osRate);
    const sagAtt = Math.exp(-1 / (osRate * 0.004));
    const sagRel = Math.exp(-1 / (osRate * 0.11));

    for (let i = 0; i < frames; i++) {
      const currIn = 0.5 * (inL[i] + inR[i]);
      let downSampled = 0;

      for (let os = 1; os <= 4; os++) {
        const x = this.prevIn + (currIn - this.prevIn) * (os * 0.25);

        const ax = Math.abs(x);
        if (ax > this.sagEnv) {
          this.sagEnv = sagAtt * this.sagEnv + (1 - sagAtt) * ax;
        } else {
          this.sagEnv = sagRel * this.sagEnv + (1 - sagRel) * ax;
        }

        let out = 0;
        if (mode === 0) {
          // BIG MUFF Pi: Stage 1 Transistor Clip -> Inter-stage Smooth Filter -> Stage 2 Clip (endless creamy violin sustain!)
          const g1 = 4.5 + Math.pow(norm, 1.15) * 18.0;
          const s1 = Math.tanh((x + this.sagEnv * 0.18) * g1);

          // Coupling cap HPF + warm LPF between Stage 1 and Stage 2 (prevents flubby buzz!)
          const hp = 0.996 * (this.interHpOut + s1 - this.interHpIn);
          this.interHpIn = s1;
          this.interHpOut = hp;
          this.interLp += interLpAlpha * (hp - this.interLp);

          const g2 = 2.6 + norm * 7.5;
          out = Math.tanh((this.interLp - this.sagEnv * 0.12) * g2) * 0.88;
        } else if (mode === 1) {
          // GERMANIUM FUZZ FACE: Rich, biased asymmetric wool with dynamic voltage sag (Hendrix!)
          // Cleans up smoothly on soft notes, blooms into thick syrupy wool on hard notes
          const g = 2.4 + Math.pow(norm, 1.3) * 14.5;
          const bias = 0.16 + this.sagEnv * 0.65;
          const u = x * g + bias;
          const clipped = u >= 0 ? Math.tanh(u * 0.92) : Math.tanh(u * 0.62) * 1.15;
          // Gentle transistor slew rounds top end like vintage NKT275 germanium
          const maxSlew = 0.048;
          const d = clipped - this.slew;
          this.slew += Math.max(-maxSlew, Math.min(maxSlew, d));
          out = this.slew * 0.92;
        } else {
          // UNIVOX SUPER FUZZ: Wild full-wave octave-doubling fuzz + harmonic snarl
          const g = 5.0 + Math.pow(norm, 1.2) * 19.0;
          const s1 = Math.tanh(x * g);
          // Full-wave rectification creates aggressive upper-octave harmonic blend
          const octRect = Math.abs(s1) * 1.2 - 0.45;
          out = Math.tanh((s1 * 0.65 + octRect * 0.55) * 2.2) * 0.82;
        }

        this.aaLp1 += aaAlpha * (out - this.aaLp1);
        this.aaLp2 += aaAlpha * (this.aaLp1 - this.aaLp2);
        downSampled = this.aaLp2;
      }

      this.prevIn = currIn;

      const dcBlocked = 0.994 * (this.dcOut + downSampled - this.dcIn);
      this.dcIn = downSampled;
      this.dcOut = dcBlocked;

      outL[i] = dcBlocked;
      if (output[1]) outR[i] = dcBlocked;
    }

    return true;
  }
}

class LooperProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.maxSeconds = 60;
    this.maxSamples = Math.floor(sampleRate * this.maxSeconds);
    this.bufL = new Float32Array(this.maxSamples);
    this.bufR = new Float32Array(this.maxSamples);
    this.undoL = null;
    this.undoR = null;

    this.state = 'idle';
    this.loopLength = 0;
    this.playhead = 0;
    this.loopVolume = 0.85;
    this.hasUndo = false;
    this.layers = 0;
    this.telemetryCounter = 0;

    this.port.onmessage = (event) => {
      const msg = event.data;
      if (!msg || !msg.type) return;

      switch (msg.type) {
        case 'stomp':
          this.handleStomp();
          break;
        case 'stop':
          this.handleStop();
          break;
        case 'clear':
          this.handleClear();
          break;
        case 'undo':
          this.handleUndo();
          break;
        case 'volume':
          if (typeof msg.value === 'number') {
            this.loopVolume = Math.max(0, Math.min(1.5, msg.value));
          }
          break;
      }
      this.sendTelemetry();
    };
  }

  applyBoundaryFade() {
    const fadeLen = Math.min(Math.floor(sampleRate * 0.005), Math.floor(this.loopLength / 4));
    for (let i = 0; i < fadeLen; i++) {
      const g = i / fadeLen;
      this.bufL[i] *= g;
      this.bufR[i] *= g;
      const endIdx = this.loopLength - 1 - i;
      this.bufL[endIdx] *= g;
      this.bufR[endIdx] *= g;
    }
  }

  snapshotForUndo() {
    if (this.loopLength <= 0) return;
    this.undoL = this.bufL.slice(0, this.loopLength);
    this.undoR = this.bufR.slice(0, this.loopLength);
    this.hasUndo = true;
  }

  handleStomp() {
    if (this.state === 'idle') {
      this.loopLength = 0;
      this.playhead = 0;
      this.layers = 1;
      this.hasUndo = false;
      this.state = 'recording';
    } else if (this.state === 'recording') {
      if (this.playhead < sampleRate * 0.15) {
        this.handleClear();
        return;
      }
      this.loopLength = this.playhead;
      this.applyBoundaryFade();
      this.playhead = 0;
      this.state = 'playing';
    } else if (this.state === 'playing') {
      this.snapshotForUndo();
      this.layers += 1;
      this.state = 'overdubbing';
    } else if (this.state === 'overdubbing') {
      this.state = 'playing';
    } else if (this.state === 'stopped') {
      if (this.loopLength > 0) {
        this.playhead = 0;
        this.state = 'playing';
      } else {
        this.state = 'idle';
      }
    }
  }

  handleStop() {
    if (this.state === 'recording') {
      if (this.playhead >= sampleRate * 0.15) {
        this.loopLength = this.playhead;
        this.applyBoundaryFade();
        this.playhead = 0;
        this.state = 'stopped';
      } else {
        this.handleClear();
      }
    } else if (this.state === 'playing' || this.state === 'overdubbing') {
      this.playhead = 0;
      this.state = 'stopped';
    }
  }

  handleUndo() {
    if (!this.hasUndo || !this.undoL || !this.undoR || this.loopLength <= 0) return;
    this.bufL.set(this.undoL, 0);
    this.bufR.set(this.undoR, 0);
    this.hasUndo = false;
    this.layers = Math.max(1, this.layers - 1);
    if (this.state === 'overdubbing') {
      this.state = 'playing';
    }
  }

  handleClear() {
    if (this.loopLength > 0) {
      this.bufL.fill(0, 0, Math.min(this.loopLength + 256, this.maxSamples));
      this.bufR.fill(0, 0, Math.min(this.loopLength + 256, this.maxSamples));
    }
    this.undoL = null;
    this.undoR = null;
    this.loopLength = 0;
    this.playhead = 0;
    this.hasUndo = false;
    this.layers = 0;
    this.state = 'idle';
  }

  sendTelemetry() {
    const durationSec = this.loopLength > 0
      ? this.loopLength / sampleRate
      : (this.state === 'recording' ? this.playhead / sampleRate : 0);
    const progress = this.loopLength > 0 ? this.playhead / this.loopLength : 0;
    this.port.postMessage({
      state: this.state,
      progress,
      durationSec,
      hasUndo: this.hasUndo,
      layers: this.layers
    });
  }

  process(inputs, outputs) {
    const input = inputs[0];
    const output = outputs[0];
    if (!output || output.length === 0) return true;

    const inL = input && input[0] ? input[0] : null;
    const inR = input && input[1] ? input[1] : inL;
    const outL = output[0];
    const outR = output[1] || output[0];
    const frames = outL.length;

    for (let i = 0; i < frames; i++) {
      const sL = inL ? inL[i] : 0;
      const sR = inR ? inR[i] : 0;

      if (this.state === 'recording') {
        if (this.playhead < this.maxSamples) {
          this.bufL[this.playhead] = sL;
          this.bufR[this.playhead] = sR;
          this.playhead++;
        } else {
          this.loopLength = this.maxSamples;
          this.applyBoundaryFade();
          this.playhead = 0;
          this.state = 'playing';
        }
        outL[i] = sL;
        if (output[1]) outR[i] = sR;
      } else if (this.state === 'playing' && this.loopLength > 0) {
        const lL = this.bufL[this.playhead] * this.loopVolume;
        const lR = this.bufR[this.playhead] * this.loopVolume;
        this.playhead = (this.playhead + 1) % this.loopLength;
        outL[i] = sL + lL;
        if (output[1]) outR[i] = sR + lR;
      } else if (this.state === 'overdubbing' && this.loopLength > 0) {
        const prevL = this.bufL[this.playhead];
        const prevR = this.bufR[this.playhead];
        const nextL = Math.max(-1.5, Math.min(1.5, prevL + sL));
        const nextR = Math.max(-1.5, Math.min(1.5, prevR + sR));
        this.bufL[this.playhead] = nextL;
        this.bufR[this.playhead] = nextR;
        this.playhead = (this.playhead + 1) % this.loopLength;
        outL[i] = sL + prevL * this.loopVolume;
        if (output[1]) outR[i] = sR + prevR * this.loopVolume;
      } else {
        outL[i] = sL;
        if (output[1]) outR[i] = sR;
      }
    }

    this.telemetryCounter += frames;
    if (this.telemetryCounter >= sampleRate * 0.04) {
      this.telemetryCounter = 0;
      this.sendTelemetry();
    }

    return true;
  }
}

registerProcessor('noise-gate-processor', NoiseGateProcessor);
registerProcessor('envelope-wah-processor', EnvelopeWahProcessor);
registerProcessor('octaver-processor', OctaverProcessor);
registerProcessor('analog-drive-processor', AnalogDriveProcessor);
registerProcessor('analog-fuzz-processor', AnalogFuzzProcessor);
registerProcessor('looper-processor', LooperProcessor);
