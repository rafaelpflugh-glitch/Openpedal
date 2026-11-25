// OpenPedal AudioWorklet Processors
// 1. Noise Gate with hysteresis and smooth attack/release
// 2. Sample-accurate Stereo Looper with Overdub & Undo

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
    if (!input || input.length === 0 || !output || output.length === 0) {
      return true;
    }

    const enabled = parameters.enabled[0] >= 0.5;
    const thresholdDb = parameters.threshold[0];
    const releaseSec = Math.max(0.01, parameters.release[0]);
    const openThreshold = Math.pow(10, thresholdDb / 20);
    const closeThreshold = Math.pow(10, (thresholdDb - 4) / 20); // 4dB hysteresis

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
          if (this.envelope < closeThreshold) {
            this.isOpen = false;
          }
        } else {
          if (this.envelope > openThreshold) {
            this.isOpen = true;
          }
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

class LooperProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.maxSeconds = 60;
    this.maxSamples = Math.floor(sampleRate * this.maxSeconds);
    this.bufL = new Float32Array(this.maxSamples);
    this.bufR = new Float32Array(this.maxSamples);
    this.undoL = null;
    this.undoR = null;

    this.state = 'idle'; // 'idle' | 'recording' | 'playing' | 'overdubbing' | 'stopped'
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
registerProcessor('looper-processor', LooperProcessor);
