import {
  AmpCabState,
  CabModel,
  InputChannelMode,
  LooperTelemetry,
  OutputMode,
  PedalId,
  RigState,
  TestRiffStyle,
  TunerReading
} from '../types/pedalboard';
import { DrumEngine, DrumKitStyle, DrumPadId, DrumPattern, DrumRouting } from './drumEngine';
import { generateCabinetIR, generateReverbIR } from './irGenerator';
import { MetronomeEngine } from './metronome';
import { InstrumentRouting, SynthEngine, SynthVoicePreset } from './synthEngine';
import { TestGuitarPlayer } from './testGuitar';
import { detectPitch } from './tuner';
import { makeAmpPreampCurve, makeDriveCurve } from './waveshaper';

interface PedalModule {
  id: PedalId;
  input: GainNode;
  output: GainNode;
  dryGain: GainNode;
  wetGain: GainNode;
}

export interface EngineTelemetryCallbacks {
  onGateStatus?: (isOpen: boolean, levelDb: number) => void;
  onLooperTelemetry?: (telemetry: LooperTelemetry) => void;
  onMetronomeBeat?: (beat: number, beatsPerBar: number) => void;
  onDrumStep?: (step: number) => void;
}

export interface AudioDeviceList {
  inputs: MediaDeviceInfo[];
  outputs: MediaDeviceInfo[];
}

export class OpenPedalEngine {
  private ctx: AudioContext | null = null;
  private initialized = false;
  private callbacks: EngineTelemetryCallbacks = {};

  // Input chain
  private mediaStream: MediaStream | null = null;
  private liveSource: MediaStreamAudioSourceNode | null = null;
  private channelSplitter: ChannelSplitterNode | null = null;
  private leftSelectGain: GainNode | null = null;
  private rightSelectGain: GainNode | null = null;
  private inputTrimGain: GainNode | null = null;
  private inputAnalyser: AnalyserNode | null = null;
  private tunerMuteGain: GainNode | null = null;
  private chainEntry: GainNode | null = null;

  // Test guitar, Metronome, Synth & Drums
  private testGuitar: TestGuitarPlayer | null = null;
  private metronome: MetronomeEngine | null = null;
  private synth: SynthEngine | null = null;
  private drums: DrumEngine | null = null;

  // Pedals
  private pedals!: Record<PedalId, PedalModule>;
  private gateWorklet: AudioWorkletNode | null = null;
  private humNotch60: BiquadFilterNode | null = null;
  private humNotch120: BiquadFilterNode | null = null;
  private compNode: DynamicsCompressorNode | null = null;
  private compMakeup: GainNode | null = null;
  private drivePreGain: GainNode | null = null;
  private driveShaper: WaveShaperNode | null = null;
  private driveTone: BiquadFilterNode | null = null;
  private driveLevel: GainNode | null = null;
  private eqBands: BiquadFilterNode[] = [];
  private eqLevel: GainNode | null = null;
  private chorusDelay: DelayNode | null = null;
  private chorusLfo: OscillatorNode | null = null;
  private chorusLfoGain: GainNode | null = null;
  private chorusEffectWet: GainNode | null = null;
  private chorusEffectDry: GainNode | null = null;
  private delayNode: DelayNode | null = null;
  private delayFeedback: GainNode | null = null;
  private delayTone: BiquadFilterNode | null = null;
  private delayEffectWet: GainNode | null = null;
  private delayEffectDry: GainNode | null = null;
  private reverbConvolver: ConvolverNode | null = null;
  private reverbEffectWet: GainNode | null = null;
  private reverbEffectDry: GainNode | null = null;
  private lastReverbKey = '';

  // Amp & Cab
  private ampInput: GainNode | null = null;
  private ampDryGain: GainNode | null = null;
  private ampWetGain: GainNode | null = null;
  private ampPreGain: GainNode | null = null;
  private ampPreHpf: BiquadFilterNode | null = null;
  private ampShaper: WaveShaperNode | null = null;
  private ampBass: BiquadFilterNode | null = null;
  private ampMid: BiquadFilterNode | null = null;
  private ampTreble: BiquadFilterNode | null = null;
  private ampPresence: BiquadFilterNode | null = null;
  private ampMaster: GainNode | null = null;
  private ampOutput: GainNode | null = null;

  private cabDryGain: GainNode | null = null;
  private cabWetGain: GainNode | null = null;
  private cabConvolver: ConvolverNode | null = null;
  private cabOutput: GainNode | null = null;
  private cabIRCache = new Map<CabModel, AudioBuffer>();
  private currentCabModel: CabModel = '2x12-open';

  // Looper & Master Output
  private looperWorklet: AudioWorkletNode | null = null;
  private masterGain: GainNode | null = null;
  private safetyLimiter: DynamicsCompressorNode | null = null;
  private outputAnalyser: AnalyserNode | null = null;

  // Analysis buffers
  private tunerBuffer = new Float32Array(2048);
  private inMeterBuffer = new Float32Array(512);
  private outMeterBuffer = new Float32Array(512);

  private currentOrder: PedalId[] = ['gate', 'compressor', 'drive', 'eq', 'chorus', 'delay', 'reverb'];
  private inputChannelMode: InputChannelMode = 'left';
  private liveInputActive = false;

  setCallbacks(callbacks: EngineTelemetryCallbacks) {
    this.callbacks = callbacks;
  }

  isInitialized() {
    return this.initialized;
  }

  isLiveInputActive() {
    return this.liveInputActive;
  }

  getLatencyInfo(): { baseLatencyMs: number; outputLatencyMs: number; sampleRate: number } {
    if (!this.ctx) return { baseLatencyMs: 0, outputLatencyMs: 0, sampleRate: 48000 };
    const ctxAny = this.ctx as AudioContext & { outputLatency?: number };
    return {
      baseLatencyMs: (this.ctx.baseLatency || 0) * 1000,
      outputLatencyMs: (ctxAny.outputLatency || 0) * 1000,
      sampleRate: this.ctx.sampleRate
    };
  }

  async init(initialRig: RigState): Promise<void> {
    if (this.initialized && this.ctx) {
      if (this.ctx.state === 'suspended') {
        await this.ctx.resume();
      }
      return;
    }

    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new AudioCtx({ latencyHint: 'interactive' });
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }

    // Load AudioWorklet processors (Noise Gate + Looper)
    await this.ctx.audioWorklet.addModule('/worklets/openpedal-worklets.js');

    // Build Input Stage
    this.leftSelectGain = this.ctx.createGain();
    this.rightSelectGain = this.ctx.createGain();
    this.inputTrimGain = this.ctx.createGain();
    this.inputAnalyser = this.ctx.createAnalyser();
    this.inputAnalyser.fftSize = 2048;
    this.inputAnalyser.smoothingTimeConstant = 0.2;
    this.tunerMuteGain = this.ctx.createGain();
    this.chainEntry = this.ctx.createGain();

    this.leftSelectGain.connect(this.inputTrimGain);
    this.rightSelectGain.connect(this.inputTrimGain);
    this.inputTrimGain.connect(this.inputAnalyser);
    this.inputAnalyser.connect(this.tunerMuteGain);
    this.tunerMuteGain.connect(this.chainEntry);
    this.applyChannelMode(this.inputChannelMode);

    // Test Guitar player feeds into inputTrimGain (so tuner/meters/pedals all work on test riffs!)
    this.testGuitar = new TestGuitarPlayer(this.ctx, this.inputTrimGain);

    // Build all 7 Pedals
    this.buildPedals();

    // Build Amp & Cab section
    await this.buildAmpAndCab();

    // Build Post-FX Looper & Master Output
    this.looperWorklet = new AudioWorkletNode(this.ctx, 'looper-processor', {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      outputChannelCount: [2]
    });
    this.looperWorklet.port.onmessage = (e) => {
      this.callbacks.onLooperTelemetry?.(e.data as LooperTelemetry);
    };

    this.masterGain = this.ctx.createGain();
    this.safetyLimiter = this.ctx.createDynamicsCompressor();
    this.safetyLimiter.threshold.value = -1.8;
    this.safetyLimiter.knee.value = 3;
    this.safetyLimiter.ratio.value = 14;
    this.safetyLimiter.attack.value = 0.002;
    this.safetyLimiter.release.value = 0.08;

    this.outputAnalyser = this.ctx.createAnalyser();
    this.outputAnalyser.fftSize = 1024;
    this.outputAnalyser.smoothingTimeConstant = 0.3;

    this.cabOutput!.connect(this.looperWorklet);
    this.looperWorklet.connect(this.masterGain);
    this.masterGain.connect(this.safetyLimiter);
    this.safetyLimiter.connect(this.outputAnalyser);
    this.outputAnalyser.connect(this.ctx.destination);

    // Metronome goes straight to safetyLimiter (clean, un-distorted, not recorded into looper)
    this.metronome = new MetronomeEngine(this.ctx, this.safetyLimiter, (beat, total) => {
      this.callbacks.onMetronomeBeat?.(beat, total);
    });

    // Virtual Instruments: Piano/Synth (default clean into Looper) + Drum Machine (default clean out)
    this.synth = new SynthEngine(this.ctx, this.looperWorklet);
    this.drums = new DrumEngine(this.ctx, this.safetyLimiter, (step) => {
      this.callbacks.onDrumStep?.(step);
    });

    this.initialized = true;
    this.applyRig(initialRig, true);
  }

  private buildPedals() {
    const ctx = this.ctx!;

    const makeModule = (id: PedalId): PedalModule => {
      const input = ctx.createGain();
      const output = ctx.createGain();
      const dryGain = ctx.createGain();
      const wetGain = ctx.createGain();
      input.connect(dryGain);
      dryGain.connect(output);
      wetGain.connect(output);
      return { id, input, output, dryGain, wetGain };
    };

    // 1. Noise Gate + 60Hz Hum Notch Filter
    const gate = makeModule('gate');
    this.humNotch60 = ctx.createBiquadFilter();
    this.humNotch60.type = 'notch';
    this.humNotch60.frequency.value = 60;
    this.humNotch60.Q.value = 14;

    this.humNotch120 = ctx.createBiquadFilter();
    this.humNotch120.type = 'notch';
    this.humNotch120.frequency.value = 120;
    this.humNotch120.Q.value = 14;

    this.gateWorklet = new AudioWorkletNode(ctx, 'noise-gate-processor');
    this.gateWorklet.port.onmessage = (e) => {
      this.callbacks.onGateStatus?.(Boolean(e.data.isOpen), Number(e.data.levelDb));
    };

    gate.input.connect(this.humNotch60);
    this.humNotch60.connect(this.humNotch120);
    this.humNotch120.connect(this.gateWorklet);
    this.gateWorklet.connect(gate.wetGain);

    // 2. Compressor
    const compressor = makeModule('compressor');
    this.compNode = ctx.createDynamicsCompressor();
    this.compNode.knee.value = 12;
    this.compNode.release.value = 0.14;
    this.compMakeup = ctx.createGain();
    compressor.input.connect(this.compNode);
    this.compNode.connect(this.compMakeup);
    this.compMakeup.connect(compressor.wetGain);

    // 3. Overdrive / Distortion
    const drive = makeModule('drive');
    const drivePreHpf = ctx.createBiquadFilter();
    drivePreHpf.type = 'highpass';
    drivePreHpf.frequency.value = 110; // Tightens bass before clipping like a Tube Screamer
    this.drivePreGain = ctx.createGain();
    this.driveShaper = ctx.createWaveShaper();
    this.driveShaper.oversample = '4x';
    this.driveTone = ctx.createBiquadFilter();
    this.driveTone.type = 'lowpass';
    this.driveTone.Q.value = 0.7;
    this.driveLevel = ctx.createGain();

    drive.input.connect(drivePreHpf);
    drivePreHpf.connect(this.drivePreGain);
    this.drivePreGain.connect(this.driveShaper);
    this.driveShaper.connect(this.driveTone);
    this.driveTone.connect(this.driveLevel);
    this.driveLevel.connect(drive.wetGain);

    // 4. 5-Band Graphic EQ
    const eq = makeModule('eq');
    const freqs = [100, 250, 800, 2000, 4000];
    this.eqBands = freqs.map((freq, idx) => {
      const f = ctx.createBiquadFilter();
      f.type = idx === 0 ? 'lowshelf' : idx === freqs.length - 1 ? 'highshelf' : 'peaking';
      f.frequency.value = freq;
      f.Q.value = 1.25;
      f.gain.value = 0;
      return f;
    });
    this.eqLevel = ctx.createGain();
    let prev: AudioNode = eq.input;
    for (const band of this.eqBands) {
      prev.connect(band);
      prev = band;
    }
    prev.connect(this.eqLevel);
    this.eqLevel.connect(eq.wetGain);

    // 5. Chorus
    const chorus = makeModule('chorus');
    this.chorusEffectDry = ctx.createGain();
    this.chorusEffectWet = ctx.createGain();
    this.chorusDelay = ctx.createDelay(0.1);
    this.chorusDelay.delayTime.value = 0.018;
    this.chorusLfo = ctx.createOscillator();
    this.chorusLfo.type = 'sine';
    this.chorusLfo.frequency.value = 1.1;
    this.chorusLfoGain = ctx.createGain();
    this.chorusLfoGain.gain.value = 0.004;

    this.chorusLfo.connect(this.chorusLfoGain);
    this.chorusLfoGain.connect(this.chorusDelay.delayTime);
    this.chorusLfo.start();

    chorus.input.connect(this.chorusEffectDry);
    this.chorusEffectDry.connect(chorus.wetGain);
    chorus.input.connect(this.chorusDelay);
    this.chorusDelay.connect(this.chorusEffectWet);
    this.chorusEffectWet.connect(chorus.wetGain);

    // 6. Delay
    const delay = makeModule('delay');
    this.delayEffectDry = ctx.createGain();
    this.delayEffectWet = ctx.createGain();
    this.delayNode = ctx.createDelay(1.5);
    this.delayNode.delayTime.value = 0.36;
    this.delayFeedback = ctx.createGain();
    this.delayFeedback.gain.value = 0.34;
    this.delayTone = ctx.createBiquadFilter();
    this.delayTone.type = 'lowpass';
    this.delayTone.frequency.value = 3800;

    delay.input.connect(this.delayEffectDry);
    this.delayEffectDry.connect(delay.wetGain);

    delay.input.connect(this.delayNode);
    this.delayNode.connect(this.delayTone);
    this.delayTone.connect(this.delayFeedback);
    this.delayFeedback.connect(this.delayNode);
    this.delayTone.connect(this.delayEffectWet);
    this.delayEffectWet.connect(delay.wetGain);

    // 7. Reverb
    const reverb = makeModule('reverb');
    this.reverbEffectDry = ctx.createGain();
    this.reverbEffectWet = ctx.createGain();
    this.reverbConvolver = ctx.createConvolver();
    this.reverbConvolver.buffer = generateReverbIR(ctx, 2.0, 45);

    reverb.input.connect(this.reverbEffectDry);
    this.reverbEffectDry.connect(reverb.wetGain);
    reverb.input.connect(this.reverbConvolver);
    this.reverbConvolver.connect(this.reverbEffectWet);
    this.reverbEffectWet.connect(reverb.wetGain);

    this.pedals = {
      gate,
      compressor,
      drive,
      eq,
      chorus,
      delay,
      reverb
    };
  }

  private async buildAmpAndCab() {
    const ctx = this.ctx!;

    // Preamp + Tone Stack
    this.ampInput = ctx.createGain();
    this.ampDryGain = ctx.createGain();
    this.ampWetGain = ctx.createGain();
    this.ampOutput = ctx.createGain();

    this.ampPreHpf = ctx.createBiquadFilter();
    this.ampPreHpf.type = 'highpass';
    this.ampPreHpf.frequency.value = 72;

    this.ampPreGain = ctx.createGain();
    this.ampShaper = ctx.createWaveShaper();
    this.ampShaper.oversample = '4x';

    this.ampBass = ctx.createBiquadFilter();
    this.ampBass.type = 'lowshelf';
    this.ampBass.frequency.value = 120;

    this.ampMid = ctx.createBiquadFilter();
    this.ampMid.type = 'peaking';
    this.ampMid.frequency.value = 680;
    this.ampMid.Q.value = 1.0;

    this.ampTreble = ctx.createBiquadFilter();
    this.ampTreble.type = 'highshelf';
    this.ampTreble.frequency.value = 2800;

    this.ampPresence = ctx.createBiquadFilter();
    this.ampPresence.type = 'peaking';
    this.ampPresence.frequency.value = 4500;
    this.ampPresence.Q.value = 1.1;

    this.ampMaster = ctx.createGain();

    this.ampInput.connect(this.ampDryGain);
    this.ampDryGain.connect(this.ampOutput);

    this.ampInput.connect(this.ampPreHpf);
    this.ampPreHpf.connect(this.ampPreGain);
    this.ampPreGain.connect(this.ampShaper);
    this.ampShaper.connect(this.ampBass);
    this.ampBass.connect(this.ampMid);
    this.ampMid.connect(this.ampTreble);
    this.ampTreble.connect(this.ampPresence);
    this.ampPresence.connect(this.ampMaster);
    this.ampMaster.connect(this.ampWetGain);
    this.ampWetGain.connect(this.ampOutput);

    // Cabinet Sim (Convolver IR)
    this.cabDryGain = ctx.createGain();
    this.cabWetGain = ctx.createGain();
    this.cabConvolver = ctx.createConvolver();
    this.cabOutput = ctx.createGain();

    // Pre-generate all built-in cabinet IRs in parallel
    const cabTypes: Exclude<CabModel, 'custom-ir'>[] = ['4x12-v30', '2x12-open', '1x12-tweed', '4x10-clean'];
    const buffers = await Promise.all(cabTypes.map((m) => generateCabinetIR(ctx.sampleRate, m)));
    cabTypes.forEach((m, i) => this.cabIRCache.set(m, buffers[i]));
    this.cabConvolver.buffer = this.cabIRCache.get('2x12-open') || null;

    this.ampOutput.connect(this.cabDryGain);
    this.cabDryGain.connect(this.cabOutput);
    this.ampOutput.connect(this.cabConvolver);
    this.cabConvolver.connect(this.cabWetGain);
    this.cabWetGain.connect(this.cabOutput);
  }

  private reconnectChain(order: PedalId[]) {
    if (!this.ctx || !this.chainEntry || !this.ampInput) return;

    try {
      this.chainEntry.disconnect();
    } catch {
      // ignore
    }
    for (const id of Object.keys(this.pedals) as PedalId[]) {
      try {
        this.pedals[id].output.disconnect();
      } catch {
        // ignore
      }
    }

    let prev: AudioNode = this.chainEntry;
    for (const id of order) {
      const mod = this.pedals[id];
      prev.connect(mod.input);
      prev = mod.output;
    }
    prev.connect(this.ampInput);
    this.currentOrder = [...order];
  }

  applyRig(rig: RigState, forceReconnect = false) {
    if (!this.initialized || !this.ctx) return;
    const now = this.ctx.currentTime;
    const smooth = 0.015;

    // Reconnect chain if order changed
    const orderChanged =
      forceReconnect ||
      rig.chainOrder.length !== this.currentOrder.length ||
      rig.chainOrder.some((id, idx) => id !== this.currentOrder[idx]);

    if (orderChanged) {
      this.reconnectChain(rig.chainOrder);
    }

    // Input Gain & Master Volume
    const inGainLinear = Math.pow(10, rig.inputGainDb / 20);
    this.inputTrimGain!.gain.setTargetAtTime(inGainLinear, now, smooth);
    this.masterGain!.gain.setTargetAtTime(Math.pow(rig.masterVolume / 100, 1.4) * 1.15, now, smooth);

    // Helper for pedal bypass
    const setBypass = (id: PedalId, enabled: boolean) => {
      const mod = this.pedals[id];
      mod.wetGain.gain.setTargetAtTime(enabled ? 1 : 0, now, smooth);
      mod.dryGain.gain.setTargetAtTime(enabled ? 0 : 1, now, smooth);
    };

    // 1. Noise Gate
    const g = rig.pedals.gate;
    setBypass('gate', g.enabled);
    if (this.gateWorklet) {
      this.gateWorklet.parameters.get('threshold')?.setTargetAtTime(g.params.threshold, now, smooth);
      this.gateWorklet.parameters.get('release')?.setTargetAtTime(g.params.release, now, smooth);
      this.gateWorklet.parameters.get('enabled')?.setValueAtTime(g.enabled ? 1 : 0, now);
    }
    if (this.humNotch60 && this.humNotch120) {
      this.humNotch60.Q.setTargetAtTime(g.params.humFilter60Hz ? 14 : 0.0001, now, smooth);
      this.humNotch60.type = g.params.humFilter60Hz ? 'notch' : 'allpass';
      this.humNotch120.type = g.params.humFilter60Hz ? 'notch' : 'allpass';
    }

    // 2. Compressor
    const c = rig.pedals.compressor;
    setBypass('compressor', c.enabled);
    this.compNode!.threshold.setTargetAtTime(c.params.threshold, now, smooth);
    this.compNode!.ratio.setTargetAtTime(c.params.ratio, now, smooth);
    this.compNode!.attack.setTargetAtTime(c.params.attack, now, smooth);
    this.compMakeup!.gain.setTargetAtTime(Math.pow(10, c.params.makeup / 20), now, smooth);

    // 3. Overdrive / Distortion
    const d = rig.pedals.drive;
    setBypass('drive', d.enabled);
    this.drivePreGain!.gain.setTargetAtTime(1 + (d.params.drive / 100) * 5.5, now, smooth);
    this.driveShaper!.curve = makeDriveCurve(d.params.mode, d.params.drive);
    const toneFreq = 900 + Math.pow(d.params.tone / 100, 1.8) * 6500;
    this.driveTone!.frequency.setTargetAtTime(toneFreq, now, smooth);
    this.driveLevel!.gain.setTargetAtTime(0.25 + (d.params.level / 100) * 1.15, now, smooth);

    // 4. 5-Band EQ
    const eq = rig.pedals.eq;
    setBypass('eq', eq.enabled);
    const eqVals = [
      eq.params.band100,
      eq.params.band250,
      eq.params.band800,
      eq.params.band2000,
      eq.params.band4000
    ];
    eqVals.forEach((v, i) => this.eqBands[i]?.gain.setTargetAtTime(v, now, smooth));
    this.eqLevel!.gain.setTargetAtTime(Math.pow(10, eq.params.level / 20), now, smooth);

    // 5. Chorus
    const ch = rig.pedals.chorus;
    setBypass('chorus', ch.enabled);
    this.chorusLfo!.frequency.setTargetAtTime(ch.params.rate, now, smooth);
    this.chorusLfoGain!.gain.setTargetAtTime((ch.params.depth / 100) * 0.0085, now, smooth);
    const chMix = ch.params.mix / 100;
    this.chorusEffectDry!.gain.setTargetAtTime(1 - chMix * 0.45, now, smooth);
    this.chorusEffectWet!.gain.setTargetAtTime(chMix * 0.85, now, smooth);

    // 6. Delay
    const dl = rig.pedals.delay;
    setBypass('delay', dl.enabled);
    this.delayNode!.delayTime.setTargetAtTime(Math.max(0.04, dl.params.timeMs / 1000), now, 0.03);
    this.delayFeedback!.gain.setTargetAtTime(Math.min(0.86, dl.params.feedback / 100), now, smooth);
    const dlTone = 800 + Math.pow(dl.params.tone / 100, 1.7) * 7200;
    this.delayTone!.frequency.setTargetAtTime(dlTone, now, smooth);
    const dlMix = dl.params.mix / 100;
    this.delayEffectDry!.gain.setTargetAtTime(1, now, smooth);
    this.delayEffectWet!.gain.setTargetAtTime(dlMix * 0.9, now, smooth);

    // 7. Reverb
    const rv = rig.pedals.reverb;
    setBypass('reverb', rv.enabled);
    const rvMix = rv.params.mix / 100;
    this.reverbEffectDry!.gain.setTargetAtTime(1 - rvMix * 0.35, now, smooth);
    this.reverbEffectWet!.gain.setTargetAtTime(rvMix * 1.15, now, smooth);
    const rvKey = `${rv.params.decay.toFixed(1)}-${Math.round(rv.params.dampening / 5) * 5}`;
    if (rvKey !== this.lastReverbKey) {
      this.lastReverbKey = rvKey;
      this.reverbConvolver!.buffer = generateReverbIR(this.ctx, rv.params.decay, rv.params.dampening);
    }

    // Amp & Cab (respecting Output Mode!)
    this.applyAmpCab(rig.ampCab, rig.outputMode);
  }

  private applyAmpCab(ampCab: AmpCabState, outputMode: OutputMode) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const smooth = 0.018;

    // Effective amp/cab enablement based on Output Mode
    const effectiveAmpOn = outputMode === 'amp-front' ? false : ampCab.ampEnabled;
    const effectiveCabOn = outputMode === 'home-theater' ? ampCab.cabEnabled : false;

    this.ampWetGain!.gain.setTargetAtTime(effectiveAmpOn ? 1 : 0, now, smooth);
    this.ampDryGain!.gain.setTargetAtTime(effectiveAmpOn ? 0 : 1, now, smooth);

    // Preamp voicing
    const gainNorm = ampCab.gain / 100;
    const preBoost =
      ampCab.ampModel === 'modern-metal'
        ? 1.8 + gainNorm * 6.5
        : ampCab.ampModel === 'british-crunch'
        ? 1.2 + gainNorm * 4.2
        : ampCab.ampModel === 'clean-twin'
        ? 0.9 + gainNorm * 1.8
        : 0.95 + gainNorm * 0.8;

    this.ampPreGain!.gain.setTargetAtTime(preBoost, now, smooth);
    this.ampShaper!.curve = makeAmpPreampCurve(ampCab.ampModel, ampCab.gain);

    // Tone stack (-10dB to +10dB around 50)
    const toDb = (val: number, span = 10) => ((val - 50) / 50) * span;
    this.ampBass!.gain.setTargetAtTime(toDb(ampCab.bass, 10), now, smooth);
    this.ampMid!.gain.setTargetAtTime(toDb(ampCab.mid, 11), now, smooth);
    this.ampTreble!.gain.setTargetAtTime(toDb(ampCab.treble, 10), now, smooth);
    this.ampPresence!.gain.setTargetAtTime(toDb(ampCab.presence, 8), now, smooth);

    // Compensate loudness slightly across high-gain vs clean
    const modelTrim =
      ampCab.ampModel === 'modern-metal'
        ? 0.62
        : ampCab.ampModel === 'british-crunch'
        ? 0.78
        : 1.05;
    this.ampMaster!.gain.setTargetAtTime((0.2 + (ampCab.master / 100) * 1.1) * modelTrim, now, smooth);

    // Cab Sim Convolver
    this.cabWetGain!.gain.setTargetAtTime(effectiveCabOn ? 1.15 : 0, now, smooth);
    this.cabDryGain!.gain.setTargetAtTime(effectiveCabOn ? 0 : 1, now, smooth);

    if (ampCab.cabModel !== this.currentCabModel) {
      const ir = this.cabIRCache.get(ampCab.cabModel);
      if (ir) {
        this.cabConvolver!.buffer = ir;
        this.currentCabModel = ampCab.cabModel;
      }
    }
  }

  async loadCustomCabIR(file: File): Promise<string> {
    if (!this.ctx) throw new Error('Inicie o motor de áudio primeiro.');
    const buf = await file.arrayBuffer();
    const decoded = await this.ctx.decodeAudioData(buf);
    this.cabIRCache.set('custom-ir', decoded);
    this.cabConvolver!.buffer = decoded;
    this.currentCabModel = 'custom-ir';
    return file.name;
  }

  async listDevices(): Promise<AudioDeviceList> {
    if (!navigator.mediaDevices?.enumerateDevices) {
      return { inputs: [], outputs: [] };
    }
    const all = await navigator.mediaDevices.enumerateDevices();
    return {
      inputs: all.filter((d) => d.kind === 'audioinput'),
      outputs: all.filter((d) => d.kind === 'audiooutput')
    };
  }

  async startLiveInput(deviceId?: string): Promise<void> {
    if (!this.ctx) throw new Error('AudioContext não iniciado');
    this.stopLiveInput();

    const audioConstraints: MediaTrackConstraints = {
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
      channelCount: { ideal: 2 },
      ...(deviceId ? { deviceId: { exact: deviceId } } : {})
    };

    this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints });
    this.liveSource = this.ctx.createMediaStreamSource(this.mediaStream);
    this.channelSplitter = this.ctx.createChannelSplitter(2);
    this.liveSource.connect(this.channelSplitter);
    this.channelSplitter.connect(this.leftSelectGain!, 0);
    // If mono input, Web Audio automatically handles channel 1 silently or mirrors; guard safely:
    try {
      this.channelSplitter.connect(this.rightSelectGain!, 1);
    } catch {
      this.channelSplitter.connect(this.rightSelectGain!, 0);
    }
    this.liveInputActive = true;
  }

  stopLiveInput() {
    if (this.liveSource) {
      try {
        this.liveSource.disconnect();
      } catch {
        // ignore
      }
      this.liveSource = null;
    }
    if (this.channelSplitter) {
      try {
        this.channelSplitter.disconnect();
      } catch {
        // ignore
      }
      this.channelSplitter = null;
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((t) => t.stop());
      this.mediaStream = null;
    }
    this.liveInputActive = false;
  }

  setInputChannelMode(mode: InputChannelMode) {
    this.inputChannelMode = mode;
    this.applyChannelMode(mode);
  }

  private applyChannelMode(mode: InputChannelMode) {
    if (!this.ctx || !this.leftSelectGain || !this.rightSelectGain) return;
    const now = this.ctx.currentTime;
    if (mode === 'left') {
      this.leftSelectGain.gain.setTargetAtTime(1, now, 0.01);
      this.rightSelectGain.gain.setTargetAtTime(0, now, 0.01);
    } else if (mode === 'right') {
      this.leftSelectGain.gain.setTargetAtTime(0, now, 0.01);
      this.rightSelectGain.gain.setTargetAtTime(1, now, 0.01);
    } else {
      this.leftSelectGain.gain.setTargetAtTime(0.7, now, 0.01);
      this.rightSelectGain.gain.setTargetAtTime(0.7, now, 0.01);
    }
  }

  async setOutputDevice(deviceId: string): Promise<boolean> {
    if (!this.ctx) return false;
    const ctxWithSink = this.ctx as AudioContext & { setSinkId?: (id: string) => Promise<void> };
    if (typeof ctxWithSink.setSinkId === 'function') {
      await ctxWithSink.setSinkId(deviceId);
      return true;
    }
    return false;
  }

  setTunerMute(muted: boolean) {
    if (!this.ctx || !this.tunerMuteGain) return;
    this.tunerMuteGain.gain.setTargetAtTime(muted ? 0 : 1, this.ctx.currentTime, 0.01);
  }

  // Test Guitar controls
  setTestRiffStyle(style: TestRiffStyle) {
    this.testGuitar?.setStyle(style);
  }

  startTestRiff() {
    this.testGuitar?.startRiff();
  }

  stopTestRiff() {
    this.testGuitar?.stopRiff();
  }

  async loadDiFile(file: File): Promise<string> {
    if (!this.testGuitar) throw new Error('Inicie o motor de áudio primeiro.');
    return this.testGuitar.loadCustomFile(file);
  }

  startDiFile() {
    this.testGuitar?.startCustomFile();
  }

  stopDiFile() {
    this.testGuitar?.stopCustomFile();
  }

  stopAllTestSources() {
    this.testGuitar?.stopAll();
  }

  // Looper controls
  looperStomp() {
    this.looperWorklet?.port.postMessage({ type: 'stomp' });
  }

  looperStop() {
    this.looperWorklet?.port.postMessage({ type: 'stop' });
  }

  looperUndo() {
    this.looperWorklet?.port.postMessage({ type: 'undo' });
  }

  looperClear() {
    this.looperWorklet?.port.postMessage({ type: 'clear' });
  }

  looperSetVolume(vol: number) {
    this.looperWorklet?.port.postMessage({ type: 'volume', value: vol });
  }

  // Metronome controls
  metronomeStart() {
    this.metronome?.start();
  }

  metronomeStop() {
    this.metronome?.stop();
  }

  metronomeSetBpm(bpm: number) {
    this.metronome?.setBpm(bpm);
  }

  metronomeSetBeats(beats: number) {
    this.metronome?.setBeatsPerBar(beats);
  }

  metronomeSetVolume(vol: number) {
    this.metronome?.setVolume(vol);
  }

  // Piano / Synth Instrument controls
  synthNoteOn(midi: number, velocity = 0.85) {
    this.synth?.noteOn(midi, velocity);
  }

  synthNoteOff(midi: number) {
    this.synth?.noteOff(midi);
  }

  synthSetPreset(preset: SynthVoicePreset) {
    this.synth?.setPreset(preset);
  }

  synthSetVolume(vol: number) {
    this.synth?.setVolume(vol);
  }

  synthSetSustain(active: boolean) {
    this.synth?.setSustain(active);
  }

  synthSetRouting(routing: InstrumentRouting) {
    if (!this.synth) return;
    if (routing === 'pedal-chain' && this.chainEntry) {
      this.synth.reconnect(this.chainEntry);
    } else if (this.looperWorklet) {
      this.synth.reconnect(this.looperWorklet);
    }
  }

  synthPanic() {
    this.synth?.panic();
  }

  // Drum Machine controls
  drumTrigger(pad: DrumPadId, velocity = 0.9) {
    this.drums?.trigger(pad, undefined, velocity);
  }

  drumSetKit(kit: DrumKitStyle) {
    this.drums?.setKit(kit);
  }

  drumSetVolume(vol: number) {
    this.drums?.setVolume(vol);
  }

  drumSetRouting(routing: DrumRouting) {
    if (!this.drums) return;
    if (routing === 'pedal-chain' && this.chainEntry) {
      this.drums.reconnect(this.chainEntry);
    } else if (routing === 'clean-looper' && this.looperWorklet) {
      this.drums.reconnect(this.looperWorklet);
    } else if (this.safetyLimiter) {
      this.drums.reconnect(this.safetyLimiter);
    }
  }

  drumSetBpm(bpm: number) {
    this.drums?.setBpm(bpm);
  }

  drumSetPattern(pattern: DrumPattern) {
    this.drums?.setPattern(pattern);
  }

  drumStartSequencer() {
    this.drums?.startSequencer();
  }

  drumStopSequencer() {
    this.drums?.stopSequencer();
  }

  // Real-time Tuner & Metering
  getTunerReading(): TunerReading {
    if (!this.ctx || !this.inputAnalyser) {
      return { note: '--', octave: 0, frequency: 0, cents: 0, clarity: 0, detected: false };
    }
    this.inputAnalyser.getFloatTimeDomainData(this.tunerBuffer);
    return detectPitch(this.tunerBuffer, this.ctx.sampleRate);
  }

  getMeters(): { inDb: number; outDb: number; inClip: boolean; outClip: boolean } {
    if (!this.inputAnalyser || !this.outputAnalyser) {
      return { inDb: -60, outDb: -60, inClip: false, outClip: false };
    }

    const measure = (analyser: AnalyserNode, buf: Float32Array<ArrayBuffer>) => {
      analyser.getFloatTimeDomainData(buf);
      let peak = 0;
      let sum = 0;
      for (let i = 0; i < buf.length; i++) {
        const a = Math.abs(buf[i]);
        if (a > peak) peak = a;
        sum += a * a;
      }
      const rms = Math.sqrt(sum / buf.length);
      const db = rms > 1e-5 ? Math.max(-60, Math.min(0, 20 * Math.log10(rms) + 3)) : -60;
      return { db, clip: peak >= 0.96 };
    };

    const inp = measure(this.inputAnalyser, this.inMeterBuffer);
    const out = measure(this.outputAnalyser, this.outMeterBuffer);
    return {
      inDb: inp.db,
      outDb: out.db,
      inClip: inp.clip,
      outClip: out.clip
    };
  }

  getOutputWaveform(target: Float32Array<ArrayBuffer>) {
    if (!this.outputAnalyser) {
      target.fill(0);
      return;
    }
    this.outputAnalyser.getFloatTimeDomainData(target);
  }

  dispose() {
    this.stopLiveInput();
    this.testGuitar?.stopAll();
    this.metronome?.stop();
    this.drums?.stopSequencer();
    this.synth?.panic();
    if (this.ctx) {
      this.ctx.close();
      this.ctx = null;
    }
    this.initialized = false;
  }
}
