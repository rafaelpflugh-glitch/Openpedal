export type PedalId =
  | 'gate'
  | 'compressor'
  | 'drive'
  | 'eq'
  | 'chorus'
  | 'delay'
  | 'reverb';

export type DriveMode = 'tube-od' | 'crunch' | 'metal-fuzz';

export type AmpModel = 'clean-twin' | 'british-crunch' | 'modern-metal' | 'acoustic-direct';

export type CabModel = '4x12-v30' | '2x12-open' | '1x12-tweed' | '4x10-clean' | 'custom-ir';

export type OutputMode = 'home-theater' | 'amp-return' | 'amp-front';

export type InputChannelMode = 'left' | 'right' | 'mix';

export type InputSourceMode = 'live' | 'test-riff' | 'di-file';

export type TestRiffStyle = 'clean-arpeggio' | 'blues-lick' | 'rock-power' | 'metal-chug';

export interface GateParams {
  threshold: number; // -80 to -15 dB
  release: number;   // 0.02 to 0.5 s
  humFilter60Hz: boolean;
}

export interface CompressorParams {
  threshold: number; // -50 to 0 dB
  ratio: number;     // 1 to 16
  attack: number;    // 0.002 to 0.1 s
  makeup: number;    // 0 to 18 dB
}

export interface DriveParams {
  mode: DriveMode;
  drive: number; // 0 to 100
  tone: number;  // 0 to 100
  level: number; // 0 to 100
}

export interface EqParams {
  band100: number; // -12 to +12 dB
  band250: number;
  band800: number;
  band2000: number;
  band4000: number;
  level: number;   // -12 to +12 dB
}

export interface ChorusParams {
  rate: number;  // 0.1 to 6 Hz
  depth: number; // 0 to 100 %
  mix: number;   // 0 to 100 %
}

export interface DelayParams {
  timeMs: number;   // 40 to 1000 ms
  feedback: number; // 0 to 85 %
  tone: number;     // 0 to 100 %
  mix: number;      // 0 to 100 %
}

export interface ReverbParams {
  decay: number;     // 0.4 to 6 s
  dampening: number; // 0 to 100 %
  mix: number;       // 0 to 100 %
}

export interface PedalParamsMap {
  gate: GateParams;
  compressor: CompressorParams;
  drive: DriveParams;
  eq: EqParams;
  chorus: ChorusParams;
  delay: DelayParams;
  reverb: ReverbParams;
}

export interface PedalState<T extends PedalId = PedalId> {
  id: T;
  enabled: boolean;
  params: PedalParamsMap[T];
}

export interface AmpCabState {
  ampEnabled: boolean;
  ampModel: AmpModel;
  gain: number;     // 0 to 100
  bass: number;     // 0 to 100
  mid: number;      // 0 to 100
  treble: number;   // 0 to 100
  presence: number; // 0 to 100
  master: number;   // 0 to 100
  cabEnabled: boolean;
  cabModel: CabModel;
  customIrName?: string;
}

export interface RigState {
  chainOrder: PedalId[];
  pedals: { [K in PedalId]: PedalState<K> };
  ampCab: AmpCabState;
  outputMode: OutputMode;
  inputGainDb: number;   // -12 to +24 dB
  masterVolume: number;  // 0 to 100
}

export interface Preset {
  id: string;
  name: string;
  category: string;
  factory?: boolean;
  rig: RigState;
}

export type LooperStateName = 'idle' | 'recording' | 'playing' | 'overdubbing' | 'stopped';

export interface LooperTelemetry {
  state: LooperStateName;
  progress: number;
  durationSec: number;
  hasUndo: boolean;
  layers: number;
}

export interface TunerReading {
  note: string;
  octave: number;
  frequency: number;
  cents: number;
  clarity: number;
  detected: boolean;
}

export type MidiActionTarget =
  | { type: 'pedal'; pedalId: PedalId }
  | { type: 'preset'; index: number }
  | { type: 'looper-stomp' }
  | { type: 'looper-stop' }
  | { type: 'output-mode' }
  | { type: 'tuner-toggle' };

export interface MidiBinding {
  id: string;
  label: string;
  target: MidiActionTarget;
  messageType: 'cc' | 'pc' | 'note';
  channel: number;
  number: number; // CC number, Program number, or Note number
}
