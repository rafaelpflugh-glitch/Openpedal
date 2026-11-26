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
import { DEFAULT_CHAIN_ORDER } from '../data/factoryPresets';
import { DrumEngine, DrumKitStyle, DrumPadId, DrumPattern, DrumRouting } from './drumEngine';
import { generateCabinetIR, generateReverbIR } from './irGenerator';
import { MetronomeEngine } from './metronome';
import { InstrumentRouting, SynthEngine, SynthVoicePreset } from './synthEngine';
import { TestGuitarPlayer } from './testGuitar';
import { detectPitch } from './tuner';
import { makeAmpPowerCurve, makeAmpPreampCurve } from './waveshaper';

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

// Pedals 0..6 run Pre-Amp (Gate, Comp, Wah, Octaver, Drive, Fuzz, EQ);
// Pedals 7..11 run Post-Amp in True Stereo FX Loop (Phaser, Tremolo, Chorus, Delay, Reverb).
export const FX_LOOP_SPLIT_INDEX = 7;

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

  // 12 Pedals
  private pedals!: Record<PedalId, PedalModule>;

  // Gate
  private gateWorklet: AudioWorkletNode | null = null;
  private humNotch60: BiquadFilterNode | null = null;
  private humNotch120: BiquadFilterNode | null = null;

  // Compressor
  private compNode: DynamicsCompressorNode | null = null;
  private compMakeup: GainNode | null = null;

  // Cry Baby / Auto-Wah Worklet
  private wahWorklet: AudioWorkletNode | null = null;

  // Analog Octaver (-1 Oct / +1 Oct) Worklet
  private octaverWorklet: AudioWorkletNode | null = null;

  // Legendary Drive (4x Oversampled AudioWorklet: Klon Centaur, TS9, Boss DS-1, ProCo RAT)
  private drivePreHpf: BiquadFilterNode | null = null;
  private drivePreVoice: BiquadFilterNode | null = null;
  private driveWorklet: AudioWorkletNode | null = null;
  private drivePostVoice: BiquadFilterNode | null = null;
  private driveTone: BiquadFilterNode | null = null;
  private driveLevel: GainNode | null = null;

  // Legendary Fuzz (4x Oversampled AudioWorklet: Big Muff Pi w/ Tilt Tone Stack, Fuzz Face, Super Fuzz)
  private fuzzPreHpf: BiquadFilterNode | null = null;
  private fuzzPreVoice: BiquadFilterNode | null = null;
  private fuzzWorklet: AudioWorkletNode | null = null;
  private fuzzTiltLow: BiquadFilterNode | null = null;
  private fuzzTiltHigh: BiquadFilterNode | null = null;
  private fuzzTiltLowGain: GainNode | null = null;
  private fuzzTiltHighGain: GainNode | null = null;
  private fuzzPostLpf: BiquadFilterNode | null = null;
  private fuzzLevel: GainNode | null = null;

  // 5-Band EQ
  private eqBands: BiquadFilterNode[] = [];
  private eqLevel: GainNode | null = null;

  // 4-Stage All-Pass Phaser (MXR Phase 90 / Small Stone)
  private phaserStages: BiquadFilterNode[] = [];
  private phaserLfo: OscillatorNode | null = null;
  private phaserLfoGains: GainNode[] = [];
  private phaserFeedback: GainNode | null = null;
  private phaserDry: GainNode | null = null;
  private phaserWet: GainNode | null = null;

  // Opto-Tremolo (Sine / Triangle / Square)
  private tremoloAmpGain: GainNode | null = null;
  private tremoloLfo: OscillatorNode | null = null;
  private tremoloLfoDepth: GainNode | null = null;

  // True Stereo Dual-Voice Chorus
  private chorusWetHpf: BiquadFilterNode | null = null;
  private chorusDelayL: DelayNode | null = null;
  private chorusDelayR: DelayNode | null = null;
  private chorusLfo: OscillatorNode | null = null;
  private chorusLfoGainL: GainNode | null = null;
  private chorusLfoGainR: GainNode | null = null;
  private chorusEffectWet: GainNode | null = null;
  private chorusEffectDry: GainNode | null = null;

  // True Stereo Ping-Pong Analog Delay
  private delayL: DelayNode | null = null;
  private delayR: DelayNode | null = null;
  private delayToneL: BiquadFilterNode | null = null;
  private delayToneR: BiquadFilterNode | null = null;
  private delayFeedback: GainNode | null = null;
  private delayEffectWet: GainNode | null = null;
  private delayEffectDry: GainNode | null = null;

  // True Stereo Studio Hall/Cathedral Reverb
  private reverbConvolver: ConvolverNode | null = null;
  private reverbEffectWet: GainNode | null = null;
  private reverbEffectDry: GainNode | null = null;
  private lastReverbKey = '';

  // Dual-Stage Amp & Cab
  private ampInput: GainNode | null = null;
  private ampDryGain: GainNode | null = null;
  private ampWetGain: GainNode | null = null;
  private ampPreHpf: BiquadFilterNode | null = null;
  private ampPreVoice: BiquadFilterNode | null = null;
  private ampPreGain: GainNode | null = null;
  private ampShaper: WaveShaperNode | null = null;
  private ampInterStage: BiquadFilterNode | null = null;
  private ampPowerGain: GainNode | null = null;
  private ampPowerShaper: WaveShaperNode | null = null;
  private ampPostVoice: BiquadFilterNode | null = null;
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

  private currentOrder: PedalId[] = [...DEFAULT_CHAIN_ORDER];
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

    const AudioCtx =
      window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new AudioCtx({ latencyHint: 'interactive' });
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }

    // Load AudioWorklet processors (Gate, Wah, Octaver, Looper)
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

    this.testGuitar = new TestGuitarPlayer(this.ctx, this.inputTrimGain);

    // Build all 12 Pedals
    this.buildPedals();

    // Build Dual-Stage Amp & Cab section
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
    this.safetyLimiter.threshold.value = -1.5;
    this.safetyLimiter.knee.value = 3;
    this.safetyLimiter.ratio.value = 16;
    this.safetyLimiter.attack.value = 0.002;
    this.safetyLimiter.release.value = 0.07;

    this.outputAnalyser = this.ctx.createAnalyser();
    this.outputAnalyser.fftSize = 1024;
    this.outputAnalyser.smoothingTimeConstant = 0.3;

    this.looperWorklet.connect(this.masterGain);
    this.masterGain.connect(this.safetyLimiter);
    this.safetyLimiter.connect(this.outputAnalyser);
    this.outputAnalyser.connect(this.ctx.destination);

    // Metronome
    this.metronome = new MetronomeEngine(this.ctx, this.safetyLimiter, (beat, total) => {
      this.callbacks.onMetronomeBeat?.(beat, total);
    });

    // Virtual Instruments: Piano/Synth + Drum Machine
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

    // 1. Noise Gate + 60Hz/120Hz Hum Notch
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

    // 2. Optical Compressor
    const compressor = makeModule('compressor');
    this.compNode = ctx.createDynamicsCompressor();
    this.compNode.knee.value = 6;
    this.compNode.release.value = 0.095;
    this.compMakeup = ctx.createGain();
    compressor.input.connect(this.compNode);
    this.compNode.connect(this.compMakeup);
    this.compMakeup.connect(compressor.wetGain);

    // 3. Cry Baby Wah / Envelope Auto-Wah (AudioWorklet SVF)
    const wah = makeModule('wah');
    this.wahWorklet = new AudioWorkletNode(ctx, 'envelope-wah-processor');
    wah.input.connect(this.wahWorklet);
    this.wahWorklet.connect(wah.wetGain);

    // 4. Analog Octaver (-1 Oct Boss OC-2 + +1 Oct Octavia)
    const octaver = makeModule('octaver');
    this.octaverWorklet = new AudioWorkletNode(ctx, 'octaver-processor');
    octaver.input.connect(this.octaverWorklet);
    this.octaverWorklet.connect(octaver.wetGain);

    // 5. Legendary Overdrive / Distortion (4x Oversampled AudioWorklet w/ Dynamic Bias Sag & Slew!)
    const drive = makeModule('drive');
    this.drivePreHpf = ctx.createBiquadFilter();
    this.drivePreHpf.type = 'highpass';
    this.drivePreHpf.frequency.value = 120;

    this.drivePreVoice = ctx.createBiquadFilter();
    this.drivePreVoice.type = 'peaking';
    this.drivePreVoice.frequency.value = 1000;
    this.drivePreVoice.Q.value = 1.2;

    this.driveWorklet = new AudioWorkletNode(ctx, 'analog-drive-processor');

    this.drivePostVoice = ctx.createBiquadFilter();
    this.drivePostVoice.type = 'peaking';
    this.drivePostVoice.frequency.value = 500;
    this.drivePostVoice.Q.value = 1.1;

    this.driveTone = ctx.createBiquadFilter();
    this.driveTone.type = 'lowpass';
    this.driveTone.Q.value = 0.8;
    this.driveLevel = ctx.createGain();

    drive.input.connect(this.drivePreHpf);
    this.drivePreHpf.connect(this.drivePreVoice);
    this.drivePreVoice.connect(this.driveWorklet);
    this.driveWorklet.connect(this.drivePostVoice);
    this.drivePostVoice.connect(this.driveTone);
    this.driveTone.connect(this.driveLevel);
    this.driveLevel.connect(drive.wetGain);

    // 6. Legendary Fuzz (4x Oversampled Cascading AudioWorklet + Big Muff Passive Tilt Tone Stack!)
    const fuzz = makeModule('fuzz');
    this.fuzzPreHpf = ctx.createBiquadFilter();
    this.fuzzPreHpf.type = 'highpass';
    this.fuzzPreHpf.frequency.value = 55;

    this.fuzzPreVoice = ctx.createBiquadFilter();
    this.fuzzPreVoice.type = 'peaking';
    this.fuzzPreVoice.frequency.value = 220;
    this.fuzzPreVoice.Q.value = 1.0;

    this.fuzzWorklet = new AudioWorkletNode(ctx, 'analog-fuzz-processor');

    this.fuzzTiltLow = ctx.createBiquadFilter();
    this.fuzzTiltLow.type = 'lowpass';
    this.fuzzTiltLow.frequency.value = 460;
    this.fuzzTiltLow.Q.value = 0.7;

    this.fuzzTiltHigh = ctx.createBiquadFilter();
    this.fuzzTiltHigh.type = 'highpass';
    this.fuzzTiltHigh.frequency.value = 1550;
    this.fuzzTiltHigh.Q.value = 0.7;

    this.fuzzTiltLowGain = ctx.createGain();
    this.fuzzTiltHighGain = ctx.createGain();

    this.fuzzPostLpf = ctx.createBiquadFilter();
    this.fuzzPostLpf.type = 'lowpass';
    this.fuzzPostLpf.frequency.value = 4200;
    this.fuzzLevel = ctx.createGain();

    fuzz.input.connect(this.fuzzPreHpf);
    this.fuzzPreHpf.connect(this.fuzzPreVoice);
    this.fuzzPreVoice.connect(this.fuzzWorklet);

    this.fuzzWorklet.connect(this.fuzzTiltLow);
    this.fuzzTiltLow.connect(this.fuzzTiltLowGain);
    this.fuzzTiltLowGain.connect(this.fuzzPostLpf);

    this.fuzzWorklet.connect(this.fuzzTiltHigh);
    this.fuzzTiltHigh.connect(this.fuzzTiltHighGain);
    this.fuzzTiltHighGain.connect(this.fuzzPostLpf);

    this.fuzzPostLpf.connect(this.fuzzLevel);
    this.fuzzLevel.connect(fuzz.wetGain);

    // 7. 5-Band Graphic Guitar EQ
    const eq = makeModule('eq');
    const freqs = [100, 280, 800, 2200, 4800];
    this.eqBands = freqs.map((freq, idx) => {
      const f = ctx.createBiquadFilter();
      f.type = idx === 0 ? 'lowshelf' : idx === freqs.length - 1 ? 'highshelf' : 'peaking';
      f.frequency.value = freq;
      f.Q.value = 1.45;
      f.gain.value = 0;
      return f;
    });
    this.eqLevel = ctx.createGain();
    let eqPrev: AudioNode = eq.input;
    for (const band of this.eqBands) {
      eqPrev.connect(band);
      eqPrev = band;
    }
    eqPrev.connect(this.eqLevel);
    this.eqLevel.connect(eq.wetGain);

    // 8. 4-Stage All-Pass Phaser (MXR Phase 90 / Small Stone)
    const phaser = makeModule('phaser');
    this.phaserDry = ctx.createGain();
    this.phaserWet = ctx.createGain();
    this.phaserFeedback = ctx.createGain();
    this.phaserFeedback.gain.value = 0.52;

    const stageBaseFreqs = [340, 680, 1250, 2200];
    this.phaserStages = stageBaseFreqs.map((f) => {
      const ap = ctx.createBiquadFilter();
      ap.type = 'allpass';
      ap.frequency.value = f;
      ap.Q.value = 0.707;
      return ap;
    });

    this.phaserLfo = ctx.createOscillator();
    this.phaserLfo.type = 'sine';
    this.phaserLfo.frequency.value = 0.65;
    this.phaserLfoGains = stageBaseFreqs.map((baseF, idx) => {
      const g = ctx.createGain();
      g.gain.value = baseF * 0.65;
      this.phaserLfo!.connect(g);
      g.connect(this.phaserStages[idx].frequency);
      return g;
    });
    this.phaserLfo.start();

    const phaserSum = ctx.createGain();
    phaser.input.connect(this.phaserDry);
    this.phaserDry.connect(phaser.wetGain);

    phaser.input.connect(phaserSum);
    let pPrev: AudioNode = phaserSum;
    for (const st of this.phaserStages) {
      pPrev.connect(st);
      pPrev = st;
    }
    pPrev.connect(this.phaserFeedback);
    this.phaserFeedback.connect(phaserSum);
    pPrev.connect(this.phaserWet);
    this.phaserWet.connect(phaser.wetGain);

    // 9. Opto-Tremolo (Sine / Triangle / Square)
    const tremolo = makeModule('tremolo');
    this.tremoloAmpGain = ctx.createGain();
    this.tremoloAmpGain.gain.value = 0.7;
    this.tremoloLfo = ctx.createOscillator();
    this.tremoloLfo.type = 'sine';
    this.tremoloLfo.frequency.value = 4.2;
    this.tremoloLfoDepth = ctx.createGain();
    this.tremoloLfoDepth.gain.value = 0.3;

    this.tremoloLfo.connect(this.tremoloLfoDepth);
    this.tremoloLfoDepth.connect(this.tremoloAmpGain.gain);
    this.tremoloLfo.start();

    tremolo.input.connect(this.tremoloAmpGain);
    this.tremoloAmpGain.connect(tremolo.wetGain);

    // 10. True Stereo Dual-Voice Chorus
    const chorus = makeModule('chorus');
    this.chorusEffectDry = ctx.createGain();
    this.chorusEffectWet = ctx.createGain();
    this.chorusWetHpf = ctx.createBiquadFilter();
    this.chorusWetHpf.type = 'highpass';
    this.chorusWetHpf.frequency.value = 160;

    this.chorusDelayL = ctx.createDelay(0.1);
    this.chorusDelayL.delayTime.value = 0.013;
    this.chorusDelayR = ctx.createDelay(0.1);
    this.chorusDelayR.delayTime.value = 0.017;

    this.chorusLfo = ctx.createOscillator();
    this.chorusLfo.type = 'sine';
    this.chorusLfo.frequency.value = 1.1;

    this.chorusLfoGainL = ctx.createGain();
    this.chorusLfoGainL.gain.value = 0.0045;
    this.chorusLfoGainR = ctx.createGain();
    this.chorusLfoGainR.gain.value = -0.0045;

    this.chorusLfo.connect(this.chorusLfoGainL);
    this.chorusLfo.connect(this.chorusLfoGainR);
    this.chorusLfoGainL.connect(this.chorusDelayL.delayTime);
    this.chorusLfoGainR.connect(this.chorusDelayR.delayTime);
    this.chorusLfo.start();

    const chorusMerger = ctx.createChannelMerger(2);
    chorus.input.connect(this.chorusEffectDry);
    this.chorusEffectDry.connect(chorus.wetGain);

    chorus.input.connect(this.chorusWetHpf);
    this.chorusWetHpf.connect(this.chorusDelayL);
    this.chorusWetHpf.connect(this.chorusDelayR);
    this.chorusDelayL.connect(chorusMerger, 0, 0);
    this.chorusDelayR.connect(chorusMerger, 0, 1);
    chorusMerger.connect(this.chorusEffectWet);
    this.chorusEffectWet.connect(chorus.wetGain);

    // 11. True Stereo Ping-Pong Analog Tape Delay
    const delay = makeModule('delay');
    this.delayEffectDry = ctx.createGain();
    this.delayEffectWet = ctx.createGain();

    this.delayL = ctx.createDelay(1.5);
    this.delayR = ctx.createDelay(1.5);
    this.delayL.delayTime.value = 0.36;
    this.delayR.delayTime.value = 0.36;

    this.delayToneL = ctx.createBiquadFilter();
    this.delayToneL.type = 'lowpass';
    this.delayToneL.frequency.value = 3400;

    this.delayToneR = ctx.createBiquadFilter();
    this.delayToneR.type = 'lowpass';
    this.delayToneR.frequency.value = 3400;

    this.delayFeedback = ctx.createGain();
    this.delayFeedback.gain.value = 0.42;

    const delayMerger = ctx.createChannelMerger(2);

    delay.input.connect(this.delayEffectDry);
    this.delayEffectDry.connect(delay.wetGain);

    delay.input.connect(this.delayL);
    this.delayL.connect(this.delayToneL);
    this.delayToneL.connect(delayMerger, 0, 0);
    this.delayToneL.connect(this.delayR);
    this.delayR.connect(this.delayToneR);
    this.delayToneR.connect(delayMerger, 0, 1);
    this.delayToneR.connect(this.delayFeedback);
    this.delayFeedback.connect(this.delayL);

    delayMerger.connect(this.delayEffectWet);
    this.delayEffectWet.connect(delay.wetGain);

    // 12. True Stereo Hall/Cathedral Reverb
    const reverb = makeModule('reverb');
    this.reverbEffectDry = ctx.createGain();
    this.reverbEffectWet = ctx.createGain();
    this.reverbConvolver = ctx.createConvolver();
    this.reverbConvolver.normalize = false;
    this.reverbConvolver.buffer = generateReverbIR(ctx, 2.2, 42);

    reverb.input.connect(this.reverbEffectDry);
    this.reverbEffectDry.connect(reverb.wetGain);
    reverb.input.connect(this.reverbConvolver);
    this.reverbConvolver.connect(this.reverbEffectWet);
    this.reverbEffectWet.connect(reverb.wetGain);

    this.pedals = {
      gate,
      compressor,
      wah,
      octaver,
      drive,
      fuzz,
      eq,
      phaser,
      tremolo,
      chorus,
      delay,
      reverb
    };
  }

  private async buildAmpAndCab() {
    const ctx = this.ctx!;

    this.ampInput = ctx.createGain();
    this.ampDryGain = ctx.createGain();
    this.ampWetGain = ctx.createGain();
    this.ampOutput = ctx.createGain();

    this.ampPreHpf = ctx.createBiquadFilter();
    this.ampPreHpf.type = 'highpass';
    this.ampPreHpf.frequency.value = 80;

    this.ampPreVoice = ctx.createBiquadFilter();
    this.ampPreVoice.type = 'peaking';
    this.ampPreVoice.frequency.value = 1200;
    this.ampPreVoice.Q.value = 1.1;

    this.ampPreGain = ctx.createGain();
    this.ampShaper = ctx.createWaveShaper();
    this.ampShaper.oversample = '4x';

    this.ampInterStage = ctx.createBiquadFilter();
    this.ampInterStage.type = 'lowpass';
    this.ampInterStage.frequency.value = 5800;

    this.ampPowerGain = ctx.createGain();
    this.ampPowerShaper = ctx.createWaveShaper();
    this.ampPowerShaper.oversample = '4x';

    this.ampPostVoice = ctx.createBiquadFilter();
    this.ampPostVoice.type = 'peaking';
    this.ampPostVoice.frequency.value = 500;
    this.ampPostVoice.Q.value = 1.0;

    this.ampBass = ctx.createBiquadFilter();
    this.ampBass.type = 'lowshelf';
    this.ampBass.frequency.value = 115;

    this.ampMid = ctx.createBiquadFilter();
    this.ampMid.type = 'peaking';
    this.ampMid.frequency.value = 720;
    this.ampMid.Q.value = 1.15;

    this.ampTreble = ctx.createBiquadFilter();
    this.ampTreble.type = 'highshelf';
    this.ampTreble.frequency.value = 2600;

    this.ampPresence = ctx.createBiquadFilter();
    this.ampPresence.type = 'peaking';
    this.ampPresence.frequency.value = 4600;
    this.ampPresence.Q.value = 1.1;

    this.ampMaster = ctx.createGain();

    this.ampInput.connect(this.ampDryGain);
    this.ampDryGain.connect(this.ampOutput);

    this.ampInput.connect(this.ampPreHpf);
    this.ampPreHpf.connect(this.ampPreVoice);
    this.ampPreVoice.connect(this.ampPreGain);
    this.ampPreGain.connect(this.ampShaper);
    this.ampShaper.connect(this.ampInterStage);
    this.ampInterStage.connect(this.ampPowerGain);
    this.ampPowerGain.connect(this.ampPowerShaper);
    this.ampPowerShaper.connect(this.ampPostVoice);
    this.ampPostVoice.connect(this.ampBass);
    this.ampBass.connect(this.ampMid);
    this.ampMid.connect(this.ampTreble);
    this.ampTreble.connect(this.ampPresence);
    this.ampPresence.connect(this.ampMaster);
    this.ampMaster.connect(this.ampWetGain);
    this.ampWetGain.connect(this.ampOutput);

    // Cabinet Sim (normalize=false because our IRs are already calibrated to unity RMS!)
    this.cabDryGain = ctx.createGain();
    this.cabWetGain = ctx.createGain();
    this.cabConvolver = ctx.createConvolver();
    this.cabConvolver.normalize = false;
    this.cabOutput = ctx.createGain();

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
    if (!this.ctx || !this.chainEntry || !this.ampInput || !this.cabOutput || !this.looperWorklet) return;

    try {
      this.chainEntry.disconnect();
    } catch {
      // ignore
    }
    try {
      this.cabOutput.disconnect();
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

    const splitIdx = Math.min(FX_LOOP_SPLIT_INDEX, order.length);
    const preAmpPedals = order.slice(0, splitIdx);
    const postAmpPedals = order.slice(splitIdx);

    let prev: AudioNode = this.chainEntry;
    for (const id of preAmpPedals) {
      const mod = this.pedals[id];
      if (!mod) continue;
      prev.connect(mod.input);
      prev = mod.output;
    }
    prev.connect(this.ampInput);

    let postPrev: AudioNode = this.cabOutput;
    for (const id of postAmpPedals) {
      const mod = this.pedals[id];
      if (!mod) continue;
      postPrev.connect(mod.input);
      postPrev = mod.output;
    }
    postPrev.connect(this.looperWorklet);

    this.currentOrder = [...order];
  }

  applyRig(rig: RigState, forceReconnect = false) {
    if (!this.initialized || !this.ctx) return;
    const now = this.ctx.currentTime;
    const smooth = 0.015;

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
    this.masterGain!.gain.setTargetAtTime(Math.pow(rig.masterVolume / 100, 1.3) * 1.25, now, smooth);

    const setBypass = (id: PedalId, enabled: boolean) => {
      const mod = this.pedals[id];
      if (!mod) return;
      mod.wetGain.gain.setTargetAtTime(enabled ? 1 : 0, now, smooth);
      mod.dryGain.gain.setTargetAtTime(enabled ? 0 : 1, now, smooth);
    };

    // 1. Noise Gate + 60Hz Hum Notch
    const g = rig.pedals.gate;
    setBypass('gate', g.enabled);
    if (this.gateWorklet) {
      this.gateWorklet.parameters.get('threshold')?.setTargetAtTime(g.params.threshold, now, smooth);
      this.gateWorklet.parameters.get('release')?.setTargetAtTime(g.params.release, now, smooth);
      this.gateWorklet.parameters.get('enabled')?.setValueAtTime(g.enabled ? 1 : 0, now);
    }
    if (this.humNotch60 && this.humNotch120) {
      this.humNotch60.type = g.params.humFilter60Hz ? 'notch' : 'allpass';
      this.humNotch120.type = g.params.humFilter60Hz ? 'notch' : 'allpass';
    }

    // 2. Optical Compressor
    const c = rig.pedals.compressor;
    setBypass('compressor', c.enabled);
    this.compNode!.threshold.setTargetAtTime(c.params.threshold, now, smooth);
    this.compNode!.ratio.setTargetAtTime(c.params.ratio, now, smooth);
    this.compNode!.attack.setTargetAtTime(c.params.attack, now, smooth);
    this.compMakeup!.gain.setTargetAtTime(Math.pow(10, c.params.makeup / 20), now, smooth);

    // 3. Cry Baby / Auto-Wah
    const w = rig.pedals.wah;
    setBypass('wah', w.enabled);
    if (this.wahWorklet) {
      const modeNum = w.params.mode === 'manual' ? 0 : w.params.mode === 'auto-env' ? 1 : 2;
      this.wahWorklet.parameters.get('mode')?.setValueAtTime(modeNum, now);
      this.wahWorklet.parameters.get('position')?.setTargetAtTime(w.params.position, now, smooth);
      this.wahWorklet.parameters.get('q')?.setTargetAtTime(w.params.q, now, smooth);
      this.wahWorklet.parameters.get('range')?.setTargetAtTime(w.params.range, now, smooth);
      this.wahWorklet.parameters.get('enabled')?.setValueAtTime(w.enabled ? 1 : 0, now);
    }

    // 4. Analog Octaver (-1 Oct / +1 Oct)
    const oct = rig.pedals.octaver;
    setBypass('octaver', oct.enabled);
    if (this.octaverWorklet) {
      this.octaverWorklet.parameters.get('dry')?.setTargetAtTime(oct.params.dry / 100, now, smooth);
      this.octaverWorklet.parameters.get('sub')?.setTargetAtTime(oct.params.sub / 100, now, smooth);
      this.octaverWorklet.parameters.get('octUp')?.setTargetAtTime(oct.params.octUp / 100, now, smooth);
      this.octaverWorklet.parameters.get('enabled')?.setValueAtTime(oct.enabled ? 1 : 0, now);
    }

    // 5. Legendary Overdrive / Distortion (4x Oversampled AudioWorklet w/ Dynamic Sag & Slew)
    const d = rig.pedals.drive;
    setBypass('drive', d.enabled);
    const driveModeIdx =
      d.params.mode === 'klon' ? 0 : d.params.mode === 'ts9' ? 1 : d.params.mode === 'ds1' ? 2 : 3;

    if (this.driveWorklet) {
      this.driveWorklet.parameters.get('mode')?.setValueAtTime(driveModeIdx, now);
      this.driveWorklet.parameters.get('drive')?.setTargetAtTime(d.params.drive, now, smooth);
      this.driveWorklet.parameters.get('enabled')?.setValueAtTime(d.enabled ? 1 : 0, now);
    }

    if (d.params.mode === 'klon') {
      this.drivePreHpf!.frequency.setTargetAtTime(85, now, smooth);
      this.drivePreVoice!.frequency.setTargetAtTime(1000, now, smooth);
      this.drivePreVoice!.gain.setTargetAtTime(3.2, now, smooth);
      this.drivePostVoice!.frequency.setTargetAtTime(2200, now, smooth);
      this.drivePostVoice!.gain.setTargetAtTime(1.5, now, smooth);
    } else if (d.params.mode === 'ts9') {
      this.drivePreHpf!.frequency.setTargetAtTime(145, now, smooth);
      this.drivePreVoice!.frequency.setTargetAtTime(720, now, smooth);
      this.drivePreVoice!.gain.setTargetAtTime(4.8, now, smooth);
      this.drivePostVoice!.frequency.setTargetAtTime(1100, now, smooth);
      this.drivePostVoice!.gain.setTargetAtTime(1.0, now, smooth);
    } else if (d.params.mode === 'ds1') {
      this.drivePreHpf!.frequency.setTargetAtTime(110, now, smooth);
      this.drivePreVoice!.frequency.setTargetAtTime(1600, now, smooth);
      this.drivePreVoice!.gain.setTargetAtTime(3.6, now, smooth);
      this.drivePostVoice!.frequency.setTargetAtTime(520, now, smooth);
      this.drivePostVoice!.gain.setTargetAtTime(-4.2, now, smooth);
    } else {
      this.drivePreHpf!.frequency.setTargetAtTime(125, now, smooth);
      this.drivePreVoice!.frequency.setTargetAtTime(1200, now, smooth);
      this.drivePreVoice!.gain.setTargetAtTime(4.2, now, smooth);
      this.drivePostVoice!.frequency.setTargetAtTime(2100, now, smooth);
      this.drivePostVoice!.gain.setTargetAtTime(2.0, now, smooth);
    }
    const toneFreq = 850 + Math.pow(d.params.tone / 100, 1.55) * 4200;
    this.driveTone!.frequency.setTargetAtTime(toneFreq, now, smooth);
    const modeLevelTrim = d.params.mode === 'ds1' ? 0.68 : d.params.mode === 'rat' ? 0.72 : 0.88;
    this.driveLevel!.gain.setTargetAtTime((0.28 + (d.params.level / 100) * 0.95) * modeLevelTrim, now, smooth);

    // 6. Legendary Fuzz (4x Oversampled Cascading AudioWorklet + Passive Tilt Tone Stack)
    const fz = rig.pedals.fuzz;
    setBypass('fuzz', fz.enabled);
    const fuzzModeIdx = fz.params.mode === 'big-muff' ? 0 : fz.params.mode === 'fuzz-face' ? 1 : 2;
    const fzTone = fz.params.tone / 100;

    if (this.fuzzWorklet) {
      this.fuzzWorklet.parameters.get('mode')?.setValueAtTime(fuzzModeIdx, now);
      this.fuzzWorklet.parameters.get('sustain')?.setTargetAtTime(fz.params.sustain, now, smooth);
      this.fuzzWorklet.parameters.get('enabled')?.setValueAtTime(fz.enabled ? 1 : 0, now);
    }

    if (fz.params.mode === 'big-muff') {
      this.fuzzPreHpf!.frequency.setTargetAtTime(62, now, smooth);
      this.fuzzPreVoice!.frequency.setTargetAtTime(185, now, smooth);
      this.fuzzPreVoice!.gain.setTargetAtTime(3.6, now, smooth);
      this.fuzzTiltLow!.frequency.setTargetAtTime(460, now, smooth);
      this.fuzzTiltHigh!.frequency.setTargetAtTime(1450, now, smooth);
      this.fuzzTiltLowGain!.gain.setTargetAtTime((1 - fzTone * 0.82) * 1.15, now, smooth);
      this.fuzzTiltHighGain!.gain.setTargetAtTime((0.18 + fzTone * 0.9) * 1.15, now, smooth);
      this.fuzzPostLpf!.frequency.setTargetAtTime(3200 + fzTone * 1500, now, smooth);
    } else if (fz.params.mode === 'fuzz-face') {
      this.fuzzPreHpf!.frequency.setTargetAtTime(68, now, smooth);
      this.fuzzPreVoice!.frequency.setTargetAtTime(280, now, smooth);
      this.fuzzPreVoice!.gain.setTargetAtTime(4.8, now, smooth);
      this.fuzzTiltLow!.frequency.setTargetAtTime(880, now, smooth);
      this.fuzzTiltHigh!.frequency.setTargetAtTime(1100, now, smooth);
      this.fuzzTiltLowGain!.gain.setTargetAtTime(1.05 - fzTone * 0.42, now, smooth);
      this.fuzzTiltHighGain!.gain.setTargetAtTime(0.35 + fzTone * 0.65, now, smooth);
      this.fuzzPostLpf!.frequency.setTargetAtTime(2200 + fzTone * 2100, now, smooth);
    } else {
      this.fuzzPreHpf!.frequency.setTargetAtTime(105, now, smooth);
      this.fuzzPreVoice!.frequency.setTargetAtTime(1350, now, smooth);
      this.fuzzPreVoice!.gain.setTargetAtTime(4.2, now, smooth);
      this.fuzzTiltLow!.frequency.setTargetAtTime(520, now, smooth);
      this.fuzzTiltHigh!.frequency.setTargetAtTime(1650, now, smooth);
      this.fuzzTiltLowGain!.gain.setTargetAtTime(0.75 * (1 - fzTone * 0.55), now, smooth);
      this.fuzzTiltHighGain!.gain.setTargetAtTime(0.4 + fzTone * 0.82, now, smooth);
      this.fuzzPostLpf!.frequency.setTargetAtTime(4200, now, smooth);
    }
    const fzTrim = fz.params.mode === 'fuzz-face' ? 0.78 : 0.68;
    this.fuzzLevel!.gain.setTargetAtTime((0.28 + (fz.params.level / 100) * 0.92) * fzTrim, now, smooth);

    // 7. 5-Band EQ
    const eq = rig.pedals.eq;
    setBypass('eq', eq.enabled);
    const eqVals = [
      eq.params.band100,
      eq.params.band250,
      eq.params.band800,
      eq.params.band2000,
      eq.params.band4000
    ];
    eqVals.forEach((v, i) => this.eqBands[i]?.gain.setTargetAtTime(v * 1.2, now, smooth));
    this.eqLevel!.gain.setTargetAtTime(Math.pow(10, eq.params.level / 20), now, smooth);

    // 8. 4-Stage All-Pass Phaser
    const ph = rig.pedals.phaser;
    setBypass('phaser', ph.enabled);
    this.phaserLfo!.frequency.setTargetAtTime(ph.params.rate, now, smooth);
    const phDepthNorm = ph.params.depth / 100;
    const phBases = [340, 680, 1250, 2200];
    this.phaserLfoGains.forEach((gNode, idx) => {
      gNode.gain.setTargetAtTime(phBases[idx] * 0.72 * phDepthNorm, now, smooth);
    });
    this.phaserFeedback!.gain.setTargetAtTime(Math.min(0.78, (ph.params.feedback / 100) * 0.85), now, smooth);
    const phMix = ph.params.mix / 100;
    this.phaserDry!.gain.setTargetAtTime(1 - phMix * 0.45, now, smooth);
    this.phaserWet!.gain.setTargetAtTime(phMix * 0.95, now, smooth);

    // 9. Opto-Tremolo
    const tr = rig.pedals.tremolo;
    setBypass('tremolo', tr.enabled);
    if (this.tremoloLfo!.type !== tr.params.wave) {
      this.tremoloLfo!.type = tr.params.wave;
    }
    this.tremoloLfo!.frequency.setTargetAtTime(tr.params.rate, now, smooth);
    const trDepth = (tr.params.depth / 100) * 0.48;
    this.tremoloAmpGain!.gain.setTargetAtTime(1 - trDepth, now, smooth);
    this.tremoloLfoDepth!.gain.setTargetAtTime(trDepth, now, smooth);

    // 10. True Stereo Dual-Voice Chorus
    const ch = rig.pedals.chorus;
    setBypass('chorus', ch.enabled);
    this.chorusLfo!.frequency.setTargetAtTime(ch.params.rate, now, smooth);
    const depthSec = 0.0008 + (ch.params.depth / 100) * 0.0095;
    this.chorusLfoGainL!.gain.setTargetAtTime(depthSec, now, smooth);
    this.chorusLfoGainR!.gain.setTargetAtTime(-depthSec, now, smooth);
    const chMix = ch.params.mix / 100;
    this.chorusEffectDry!.gain.setTargetAtTime(1 - chMix * 0.4, now, smooth);
    this.chorusEffectWet!.gain.setTargetAtTime(chMix * 1.15, now, smooth);

    // 11. True Stereo Ping-Pong Analog Delay
    const dl = rig.pedals.delay;
    setBypass('delay', dl.enabled);
    const tSec = Math.max(0.04, dl.params.timeMs / 1000);
    this.delayL!.delayTime.setTargetAtTime(tSec, now, 0.03);
    this.delayR!.delayTime.setTargetAtTime(tSec, now, 0.03);
    this.delayFeedback!.gain.setTargetAtTime(Math.min(0.84, (dl.params.feedback / 100) * 0.92), now, smooth);
    const dlTone = 700 + Math.pow(dl.params.tone / 100, 1.7) * 6800;
    this.delayToneL!.frequency.setTargetAtTime(dlTone, now, smooth);
    this.delayToneR!.frequency.setTargetAtTime(dlTone * 0.9, now, smooth);
    const dlMix = dl.params.mix / 100;
    this.delayEffectDry!.gain.setTargetAtTime(1, now, smooth);
    this.delayEffectWet!.gain.setTargetAtTime(dlMix * 1.15, now, smooth);

    // 12. True Stereo Hall/Cathedral Reverb
    const rv = rig.pedals.reverb;
    setBypass('reverb', rv.enabled);
    const rvMix = rv.params.mix / 100;
    this.reverbEffectDry!.gain.setTargetAtTime(1 - rvMix * 0.55, now, smooth);
    this.reverbEffectWet!.gain.setTargetAtTime(rvMix * 1.18, now, smooth);
    const rvKey = `${rv.params.decay.toFixed(1)}-${Math.round(rv.params.dampening / 5) * 5}`;
    if (rvKey !== this.lastReverbKey) {
      this.lastReverbKey = rvKey;
      this.reverbConvolver!.buffer = generateReverbIR(this.ctx, rv.params.decay, rv.params.dampening);
    }

    // Dual-Stage Amp & Cab
    this.applyAmpCab(rig.ampCab, rig.outputMode);
  }

  private applyAmpCab(ampCab: AmpCabState, outputMode: OutputMode) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const smooth = 0.018;

    const effectiveAmpOn = outputMode === 'amp-front' ? false : ampCab.ampEnabled;
    const effectiveCabOn = outputMode === 'home-theater' ? ampCab.cabEnabled : false;

    this.ampWetGain!.gain.setTargetAtTime(effectiveAmpOn ? 1 : 0, now, smooth);
    this.ampDryGain!.gain.setTargetAtTime(effectiveAmpOn ? 0 : 1, now, smooth);

    const gainNorm = ampCab.gain / 100;

    if (ampCab.ampModel === 'clean-twin') {
      this.ampPreHpf!.frequency.setTargetAtTime(55, now, smooth);
      this.ampPreVoice!.frequency.setTargetAtTime(450, now, smooth);
      this.ampPreVoice!.gain.setTargetAtTime(-2.5, now, smooth);
      this.ampPreGain!.gain.setTargetAtTime(1.0 + gainNorm * 1.3, now, smooth);
      this.ampInterStage!.frequency.setTargetAtTime(8500, now, smooth);
      this.ampPowerGain!.gain.setTargetAtTime(1.0, now, smooth);
      this.ampPostVoice!.frequency.setTargetAtTime(4000, now, smooth);
      this.ampPostVoice!.gain.setTargetAtTime(2.5, now, smooth);
    } else if (ampCab.ampModel === 'british-crunch') {
      this.ampPreHpf!.frequency.setTargetAtTime(110, now, smooth);
      this.ampPreVoice!.frequency.setTargetAtTime(1300, now, smooth);
      this.ampPreVoice!.gain.setTargetAtTime(3.5, now, smooth);
      this.ampPreGain!.gain.setTargetAtTime(1.3 + gainNorm * 2.8, now, smooth);
      this.ampInterStage!.frequency.setTargetAtTime(3900, now, smooth);
      this.ampPowerGain!.gain.setTargetAtTime(1.15 + gainNorm * 1.1, now, smooth);
      this.ampPostVoice!.frequency.setTargetAtTime(1600, now, smooth);
      this.ampPostVoice!.gain.setTargetAtTime(2.0, now, smooth);
    } else if (ampCab.ampModel === 'modern-metal') {
      this.ampPreHpf!.frequency.setTargetAtTime(140, now, smooth);
      this.ampPreVoice!.frequency.setTargetAtTime(1550, now, smooth);
      this.ampPreVoice!.gain.setTargetAtTime(4.0, now, smooth);
      this.ampPreGain!.gain.setTargetAtTime(1.8 + gainNorm * 4.2, now, smooth);
      this.ampInterStage!.frequency.setTargetAtTime(3600, now, smooth);
      this.ampPowerGain!.gain.setTargetAtTime(1.35 + gainNorm * 1.6, now, smooth);
      this.ampPostVoice!.frequency.setTargetAtTime(480, now, smooth);
      this.ampPostVoice!.gain.setTargetAtTime(-4.0, now, smooth);
    } else {
      this.ampPreHpf!.frequency.setTargetAtTime(45, now, smooth);
      this.ampPreVoice!.frequency.setTargetAtTime(180, now, smooth);
      this.ampPreVoice!.gain.setTargetAtTime(2.0, now, smooth);
      this.ampPreGain!.gain.setTargetAtTime(1.0 + gainNorm * 0.6, now, smooth);
      this.ampInterStage!.frequency.setTargetAtTime(12000, now, smooth);
      this.ampPowerGain!.gain.setTargetAtTime(1.0, now, smooth);
      this.ampPostVoice!.frequency.setTargetAtTime(6000, now, smooth);
      this.ampPostVoice!.gain.setTargetAtTime(3.0, now, smooth);
    }

    this.ampShaper!.curve = makeAmpPreampCurve(ampCab.ampModel, ampCab.gain);
    this.ampPowerShaper!.curve = makeAmpPowerCurve(ampCab.ampModel, ampCab.gain);

    const toDb = (val: number, span = 9) => ((val - 50) / 50) * span;
    this.ampBass!.gain.setTargetAtTime(toDb(ampCab.bass, 9), now, smooth);
    this.ampMid!.gain.setTargetAtTime(toDb(ampCab.mid, 10), now, smooth);
    this.ampTreble!.gain.setTargetAtTime(toDb(ampCab.treble, 9), now, smooth);
    this.ampPresence!.gain.setTargetAtTime(toDb(ampCab.presence, 7), now, smooth);

    const modelTrim =
      ampCab.ampModel === 'modern-metal'
        ? 0.62
        : ampCab.ampModel === 'british-crunch'
        ? 0.74
        : ampCab.ampModel === 'clean-twin'
        ? 1.0
        : 1.05;
    this.ampMaster!.gain.setTargetAtTime((0.25 + (ampCab.master / 100) * 1.05) * modelTrim, now, smooth);

    this.cabWetGain!.gain.setTargetAtTime(effectiveCabOn ? 1.2 : 0, now, smooth);
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
