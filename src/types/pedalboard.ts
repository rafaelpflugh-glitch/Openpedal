export type PedalId =
  | 'gate'
  | 'compressor'
  | 'wah'
  | 'whammy'
  | 'octaver'
  | 'drive'
  | 'fuzz'
  | 'eq'
  | 'phaser'
  | 'flanger'
  | 'vibe'
  | 'tremolo'
  | 'chorus'
  | 'delay'
  | 'reverb';

export type DriveMode = 'klon' | 'ts9' | 'ds1' | 'rat';

export type FuzzMode = 'big-muff' | 'fuzz-face' | 'super-fuzz';

export type WahMode = 'manual' | 'auto-env' | 'lfo';

export type WhammyInterval = 'oct-up' | 'oct-down' | 'fifth-up' | 'detune';

export type VibeMode = 'univibe' | 'rotary';

export type TremoloWave = 'sine' | 'triangle' | 'square';

export type ReverbMode = 'hall' | 'spring' | 'shimmer';

export type AmpModel = 'clean-twin' | 'british-crunch' | 'modern-metal' | 'acoustic-direct';

export type CabModel = '4x12-v30' | '2x12-open' | '1x12-tweed' | '4x10-clean' | 'custom-ir';

export type OutputMode = 'home-theater' | 'amp-return' | 'amp-front';

export type InputChannelMode = 'left' | 'right' | 'mix';

export type InputSourceMode = 'live' | 'test-riff' | 'di-file';

export type TestRiffStyle = 'clean-arpeggio' | 'blues-lick' | 'rock-power' | 'gilmour-lead' | 'metal-chug';

export interface GateParams {
  threshold: number;
  release: number;
  humFilter60Hz: boolean;
}

export interface CompressorParams {
  threshold: number;
  ratio: number;
  attack: number;
  makeup: number;
}

export interface WahParams {
  mode: WahMode;
  position: number;
  q: number;
  range: number;
}

export interface WhammyParams {
  interval: WhammyInterval;
  pedal: number; // 0 to 100 % bend toward target interval
  mix: number;   // 0 to 100 %
}

export interface OctaverParams {
  dry: number;
  sub: number;
  octUp: number;
}

export interface DriveParams {
  mode: DriveMode;
  drive: number;
  tone: number;
  level: number;
}

export interface FuzzParams {
  mode: FuzzMode;
  sustain: number;
  tone: number;
  level: number;
}

export interface EqParams {
  band100: number;
  band250: number;
  band800: number;
  band2000: number;
  band4000: number;
  level: number;
}

export interface PhaserParams {
  rate: number;
  depth: number;
  feedback: number;
  mix: number;
}

export interface FlangerParams {
  rate: number;     // 0.08 to 4 Hz
  depth: number;    // 0 to 100 %
  feedback: number; // -85 to +85 %
  mix: number;      // 0 to 100 %
}

export interface VibeParams {
  mode: VibeMode;
  speed: number; // 0.3 to 9 Hz
  depth: number; // 0 to 100 %
  mix: number;   // 0 to 100 %
}

export interface TremoloParams {
  wave: TremoloWave;
  rate: number;
  depth: number;
}

export interface ChorusParams {
  rate: number;
  depth: number;
  mix: number;
}

export interface DelayParams {
  timeMs: number;
  feedback: number;
  tone: number;
  mix: number;
}

export interface ReverbParams {
  mode: ReverbMode;
  decay: number;
  dampening: number;
  mix: number;
}

export interface PedalParamsMap {
  gate: GateParams;
  compressor: CompressorParams;
  wah: WahParams;
  whammy: WhammyParams;
  octaver: OctaverParams;
  drive: DriveParams;
  fuzz: FuzzParams;
  eq: EqParams;
  phaser: PhaserParams;
  flanger: FlangerParams;
  vibe: VibeParams;
  tremolo: TremoloParams;
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
  gain: number;
  bass: number;
  mid: number;
  treble: number;
  presence: number;
  master: number;
  cabEnabled: boolean;
  cabModel: CabModel;
  customIrName?: string;
}

export interface RigState {
  chainOrder: PedalId[];
  pedals: { [K in PedalId]: PedalState<K> };
  ampCab: AmpCabState;
  outputMode: OutputMode;
  inputGainDb: number;
  masterVolume: number;
}

export interface Preset {
  id: string;
  name: string;
  artist?: string;
  description?: string;
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
  number: number;
}

export interface StudioTrack {
  id: string;
  name: string;
  color: string;
  buffer: AudioBuffer;
  peaks: number[]; // normalized 0..1 waveform bars for canvas visualization
  durationSec: number;
  volume: number;    // 0..1.5
  pan: number;       // -1..+1
  muted: boolean;
  solo: boolean;
  trimStartSec: number;
  trimEndSec: number;
  offsetMs: number;  // -500 to +500 ms sync alignment
}
