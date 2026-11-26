import React, { useRef } from 'react';
import { ChevronLeft, ChevronRight, GripVertical, RotateCcw } from 'lucide-react';
import {
  DriveMode,
  FuzzMode,
  PedalId,
  PedalParamsMap,
  PedalState,
  ReverbMode,
  TremoloWave,
  VibeMode,
  WahMode,
  WhammyInterval
} from '../types/pedalboard';
import { RotaryKnob } from './RotaryKnob';

interface PedalMeta {
  title: string;
  subtitle: string;
  accent: string;
  bgTint: string;
  shortcut: string;
}

export const PEDAL_META: Record<PedalId, PedalMeta> = {
  gate: {
    title: 'NOISE GATE',
    subtitle: 'Silenciador + 60Hz',
    accent: '#94a3b8',
    bgTint: 'linear-gradient(165deg, #272d38 0%, #191d25 100%)',
    shortcut: 'Q'
  },
  compressor: {
    title: 'COMP',
    subtitle: 'Sustain Óptico',
    accent: '#f43f5e',
    bgTint: 'linear-gradient(165deg, #3c1b27 0%, #201219 100%)',
    shortcut: 'W'
  },
  wah: {
    title: 'CRY WAH',
    subtitle: 'Cry Baby / Auto-Wah',
    accent: '#facc15',
    bgTint: 'linear-gradient(165deg, #342f16 0%, #1b1910 100%)',
    shortcut: 'E'
  },
  whammy: {
    title: 'WHAMMY',
    subtitle: 'Pitch Shifter / Bend',
    accent: '#ef4444',
    bgTint: 'linear-gradient(165deg, #4b151a 0%, #230f13 100%)',
    shortcut: 'Z'
  },
  octaver: {
    title: 'OCTAVER',
    subtitle: 'Sub -1 / Octavia +1',
    accent: '#818cf8',
    bgTint: 'linear-gradient(165deg, #242147 0%, #141328 100%)',
    shortcut: 'R'
  },
  drive: {
    title: 'KLON / DRIVE',
    subtitle: 'Klon • TS9 • DS-1 • RAT',
    accent: '#fbbf24',
    bgTint: 'linear-gradient(165deg, #473411 0%, #241b0c 100%)',
    shortcut: 'A'
  },
  fuzz: {
    title: 'BIG MUFF',
    subtitle: 'Muff • Fuzz Face • Oct',
    accent: '#ef4444',
    bgTint: 'linear-gradient(165deg, #3d1d1f 0%, #1c1418 100%)',
    shortcut: 'S'
  },
  eq: {
    title: '5-BAND EQ',
    subtitle: 'Modelador de Tom',
    accent: '#e2e8f0',
    bgTint: 'linear-gradient(165deg, #242933 0%, #151820 100%)',
    shortcut: 'D'
  },
  phaser: {
    title: 'PHASE 90',
    subtitle: '4-Stage All-Pass',
    accent: '#fb923c',
    bgTint: 'linear-gradient(165deg, #472512 0%, #24150e 100%)',
    shortcut: 'F'
  },
  flanger: {
    title: 'FLANGER',
    subtitle: 'Electric Mistress Jet',
    accent: '#e879f9',
    bgTint: 'linear-gradient(165deg, #3b1c47 0%, #1d1226 100%)',
    shortcut: 'X'
  },
  vibe: {
    title: 'UNI-VIBE',
    subtitle: 'Uni-Vibe / Rotary',
    accent: '#60a5fa',
    bgTint: 'linear-gradient(165deg, #172a4a 0%, #10192b 100%)',
    shortcut: 'C'
  },
  tremolo: {
    title: 'TREMOLO',
    subtitle: 'Opto-Pulse Vintage',
    accent: '#34d399',
    bgTint: 'linear-gradient(165deg, #12382c 0%, #0f1f1b 100%)',
    shortcut: 'G'
  },
  chorus: {
    title: 'CHORUS 3D',
    subtitle: 'Estéreo Dual-Voice',
    accent: '#38bdf8',
    bgTint: 'linear-gradient(165deg, #132f42 0%, #111c27 100%)',
    shortcut: 'Y'
  },
  delay: {
    title: 'PING-PONG',
    subtitle: 'Delay Estéreo + Tap',
    accent: '#c084fc',
    bgTint: 'linear-gradient(165deg, #2d1b42 0%, #1a1326 100%)',
    shortcut: 'U'
  },
  reverb: {
    title: 'REVERB',
    subtitle: 'Hall • Spring • Shimmer',
    accent: '#2dd4bf',
    bgTint: 'linear-gradient(165deg, #113535 0%, #101f22 100%)',
    shortcut: 'I'
  }
};

function getDynamicSkin(pedal: PedalState): PedalMeta {
  const base = PEDAL_META[pedal.id];

  if (pedal.id === 'drive') {
    const mode = (pedal.params as PedalParamsMap['drive']).mode;
    if (mode === 'klon') {
      return {
        ...base,
        title: 'KLON CENTAUR',
        subtitle: 'Overdrive Dourado + Clean',
        accent: '#fbbf24',
        bgTint: 'linear-gradient(165deg, #4b3914 0%, #261e0d 100%)'
      };
    }
    if (mode === 'ts9') {
      return {
        ...base,
        title: 'TUBE SCREAMER',
        subtitle: 'TS9 Mid-Hump 720Hz',
        accent: '#4ade80',
        bgTint: 'linear-gradient(165deg, #143f26 0%, #0f2117 100%)'
      };
    }
    if (mode === 'ds1') {
      return {
        ...base,
        title: 'BOSS DS-1',
        subtitle: 'Hard Diode Distortion',
        accent: '#fb923c',
        bgTint: 'linear-gradient(165deg, #52260d 0%, #29150b 100%)'
      };
    }
    return {
      ...base,
      title: 'PROCO RAT',
      subtitle: 'Raw Op-Amp Distortion',
      accent: '#f8fafc',
      bgTint: 'linear-gradient(165deg, #27272a 0%, #141417 100%)'
    };
  }

  if (pedal.id === 'fuzz') {
    const mode = (pedal.params as PedalParamsMap['fuzz']).mode;
    if (mode === 'big-muff') {
      return {
        ...base,
        title: 'BIG MUFF Pi',
        subtitle: 'Sustain Infinito + Tilt',
        accent: '#ef4444',
        bgTint: 'linear-gradient(165deg, #3b262a 0%, #1b171c 100%)'
      };
    }
    if (mode === 'fuzz-face') {
      return {
        ...base,
        title: 'FUZZ FACE',
        subtitle: 'Germânio Vintage Hendrix',
        accent: '#fb7185',
        bgTint: 'linear-gradient(165deg, #4c1727 0%, #231018 100%)'
      };
    }
    return {
      ...base,
      title: 'SUPER FUZZ',
      subtitle: 'Octave Fuzz Selvagem',
      accent: '#f59e0b',
      bgTint: 'linear-gradient(165deg, #47280f 0%, #21150c 100%)'
    };
  }

  if (pedal.id === 'vibe') {
    const mode = (pedal.params as PedalParamsMap['vibe']).mode;
    if (mode === 'rotary') {
      return {
        ...base,
        title: 'ROTARY LESLIE',
        subtitle: 'Caixa Giratória Estéreo',
        accent: '#38bdf8',
        bgTint: 'linear-gradient(165deg, #1b314b 0%, #111b2b 100%)'
      };
    }
    return {
      ...base,
      title: 'UNI-VIBE',
      subtitle: 'Shin-Ei Psicodélico',
      accent: '#a78bfa',
      bgTint: 'linear-gradient(165deg, #281f4c 0%, #151228 100%)'
    };
  }

  if (pedal.id === 'reverb') {
    const mode = (pedal.params as PedalParamsMap['reverb']).mode;
    if (mode === 'spring') {
      return { ...base, title: 'SPRING REVERB', subtitle: 'Tanque de Mola Fender' };
    }
    if (mode === 'shimmer') {
      return {
        ...base,
        title: 'SHIMMER REV',
        subtitle: 'Catedral +1 Oitava',
        accent: '#38bdf8'
      };
    }
    return { ...base, title: 'HALL REVERB', subtitle: 'Sala / Catedral Estéreo' };
  }

  return base;
}

interface PedalUnitProps<T extends PedalId = PedalId> {
  pedal: PedalState<T>;
  index: number;
  total: number;
  gateIsOpen?: boolean;
  onToggle: (id: PedalId) => void;
  onParamChange: <K extends PedalId>(id: K, patch: Partial<PedalParamsMap[K]>) => void;
  onResetPedal: (id: PedalId) => void;
  onMove: (fromIdx: number, toIdx: number) => void;
  onDragStart: (id: PedalId) => void;
  onDropOn: (targetId: PedalId) => void;
}

export const PedalUnit: React.FC<PedalUnitProps> = ({
  pedal,
  index,
  total,
  gateIsOpen = true,
  onToggle,
  onParamChange,
  onResetPedal,
  onMove,
  onDragStart,
  onDropOn
}) => {
  const meta = getDynamicSkin(pedal);
  const tapTimesRef = useRef<number[]>([]);

  const handleDelayTap = () => {
    const now = performance.now();
    const list = tapTimesRef.current.filter((t) => now - t < 2000);
    list.push(now);
    tapTimesRef.current = list.slice(-5);
    if (list.length >= 2) {
      let sum = 0;
      for (let i = 1; i < list.length; i++) sum += list[i] - list[i - 1];
      const avg = Math.round(sum / (list.length - 1));
      const clamped = Math.max(40, Math.min(1000, avg));
      onParamChange('delay', { timeMs: clamped });
    }
  };

  const renderControls = () => {
    switch (pedal.id) {
      case 'gate': {
        const p = pedal.params as PedalParamsMap['gate'];
        return (
          <div className="pedal-controls">
            <div className="knob-grid two-col">
              <RotaryKnob
                label="Thresh"
                value={p.threshold}
                min={-80}
                max={-15}
                step={1}
                defaultValue={-56}
                unit="dB"
                accentColor={meta.accent}
                onChange={(v) => onParamChange('gate', { threshold: v })}
              />
              <RotaryKnob
                label="Release"
                value={p.release * 1000}
                min={20}
                max={500}
                step={5}
                defaultValue={140}
                unit="ms"
                accentColor={meta.accent}
                onChange={(v) => onParamChange('gate', { release: v / 1000 })}
              />
            </div>
            <div className="pedal-mini-row">
              <button
                type="button"
                className={`mini-toggle ${p.humFilter60Hz ? 'is-on' : ''}`}
                onClick={() => onParamChange('gate', { humFilter60Hz: !p.humFilter60Hz })}
                title="Remove zumbido de 60Hz/120Hz da rede elétrica"
              >
                Filtro 60Hz {p.humFilter60Hz ? 'ON' : 'OFF'}
              </button>
              <span className={`gate-led ${pedal.enabled ? (gateIsOpen ? 'open' : 'closed') : 'off'}`}>
                {gateIsOpen ? 'ABERTO' : 'CORTANDO'}
              </span>
            </div>
          </div>
        );
      }

      case 'compressor': {
        const p = pedal.params as PedalParamsMap['compressor'];
        return (
          <div className="pedal-controls">
            <div className="knob-grid two-col">
              <RotaryKnob
                label="Thresh"
                value={p.threshold}
                min={-50}
                max={0}
                step={1}
                defaultValue={-28}
                unit="dB"
                accentColor={meta.accent}
                size={44}
                onChange={(v) => onParamChange('compressor', { threshold: v })}
              />
              <RotaryKnob
                label="Ratio"
                value={p.ratio}
                min={1}
                max={16}
                step={0.5}
                defaultValue={5}
                formatValue={(v) => `${v.toFixed(1)}:1`}
                accentColor={meta.accent}
                size={44}
                onChange={(v) => onParamChange('compressor', { ratio: v })}
              />
              <RotaryKnob
                label="Attack"
                value={p.attack * 1000}
                min={2}
                max={100}
                step={1}
                defaultValue={8}
                unit="ms"
                accentColor={meta.accent}
                size={44}
                onChange={(v) => onParamChange('compressor', { attack: v / 1000 })}
              />
              <RotaryKnob
                label="Makeup"
                value={p.makeup}
                min={0}
                max={18}
                step={0.5}
                defaultValue={5}
                unit="dB"
                accentColor={meta.accent}
                size={44}
                onChange={(v) => onParamChange('compressor', { makeup: v })}
              />
            </div>
          </div>
        );
      }

      case 'wah': {
        const p = pedal.params as PedalParamsMap['wah'];
        const modes: { id: WahMode; label: string }[] = [
          { id: 'auto-env', label: 'Auto' },
          { id: 'manual', label: 'Pedal' },
          { id: 'lfo', label: 'LFO' }
        ];
        const posLabel = p.mode === 'manual' ? 'Pedal' : p.mode === 'auto-env' ? 'Sens' : 'Speed';
        return (
          <div className="pedal-controls">
            <div className="mode-pills">
              {modes.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  className={`mode-pill ${p.mode === m.id ? 'is-active' : ''}`}
                  style={p.mode === m.id ? { borderColor: meta.accent, color: meta.accent } : undefined}
                  onClick={() => onParamChange('wah', { mode: m.id })}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <div className="knob-grid three-col">
              <RotaryKnob
                label={posLabel}
                value={p.position}
                min={0}
                max={100}
                defaultValue={62}
                unit="%"
                accentColor={meta.accent}
                size={44}
                onChange={(v) => onParamChange('wah', { position: v })}
              />
              <RotaryKnob
                label="Peak Q"
                value={p.q}
                min={1.5}
                max={10}
                step={0.1}
                defaultValue={5.5}
                accentColor={meta.accent}
                size={44}
                onChange={(v) => onParamChange('wah', { q: v })}
              />
              <RotaryKnob
                label="Range"
                value={p.range}
                min={15}
                max={100}
                defaultValue={82}
                unit="%"
                accentColor={meta.accent}
                size={44}
                onChange={(v) => onParamChange('wah', { range: v })}
              />
            </div>
          </div>
        );
      }

      case 'whammy': {
        const p = pedal.params as PedalParamsMap['whammy'];
        const intervals: { id: WhammyInterval; label: string }[] = [
          { id: 'oct-up', label: '+1 Oct' },
          { id: 'oct-down', label: '-1 Oct' },
          { id: 'fifth-up', label: '+5ª' },
          { id: 'detune', label: 'Det' }
        ];
        return (
          <div className="pedal-controls">
            <div className="mode-pills four-col">
              {intervals.map((iv) => (
                <button
                  key={iv.id}
                  type="button"
                  className={`mode-pill ${p.interval === iv.id ? 'is-active' : ''}`}
                  style={p.interval === iv.id ? { borderColor: meta.accent, color: meta.accent } : undefined}
                  onClick={() => onParamChange('whammy', { interval: iv.id })}
                >
                  {iv.label}
                </button>
              ))}
            </div>
            <div className="knob-grid two-col">
              <RotaryKnob
                label="Pedal"
                value={p.pedal}
                min={0}
                max={100}
                defaultValue={100}
                unit="%"
                accentColor={meta.accent}
                size={48}
                onChange={(v) => onParamChange('whammy', { pedal: v })}
              />
              <RotaryKnob
                label="Mix"
                value={p.mix}
                min={0}
                max={100}
                defaultValue={70}
                unit="%"
                accentColor={meta.accent}
                size={48}
                onChange={(v) => onParamChange('whammy', { mix: v })}
              />
            </div>
          </div>
        );
      }

      case 'octaver': {
        const p = pedal.params as PedalParamsMap['octaver'];
        return (
          <div className="pedal-controls">
            <div className="knob-grid three-col">
              <RotaryKnob
                label="Dry"
                value={p.dry}
                min={0}
                max={100}
                defaultValue={85}
                unit="%"
                accentColor={meta.accent}
                size={44}
                onChange={(v) => onParamChange('octaver', { dry: v })}
              />
              <RotaryKnob
                label="Sub -1"
                value={p.sub}
                min={0}
                max={100}
                defaultValue={65}
                unit="%"
                accentColor={meta.accent}
                size={44}
                onChange={(v) => onParamChange('octaver', { sub: v })}
              />
              <RotaryKnob
                label="Oct +1"
                value={p.octUp}
                min={0}
                max={100}
                defaultValue={25}
                unit="%"
                accentColor={meta.accent}
                size={44}
                onChange={(v) => onParamChange('octaver', { octUp: v })}
              />
            </div>
          </div>
        );
      }

      case 'drive': {
        const p = pedal.params as PedalParamsMap['drive'];
        const modes: { id: DriveMode; label: string }[] = [
          { id: 'klon', label: 'Klon' },
          { id: 'ts9', label: 'TS9' },
          { id: 'ds1', label: 'DS-1' },
          { id: 'rat', label: 'RAT' }
        ];
        return (
          <div className="pedal-controls">
            <div className="mode-pills four-col">
              {modes.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  className={`mode-pill ${p.mode === m.id ? 'is-active' : ''}`}
                  style={p.mode === m.id ? { borderColor: meta.accent, color: meta.accent } : undefined}
                  onClick={() => onParamChange('drive', { mode: m.id })}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <div className="knob-grid three-col">
              <RotaryKnob
                label="Gain"
                value={p.drive}
                min={0}
                max={100}
                defaultValue={55}
                accentColor={meta.accent}
                size={44}
                onChange={(v) => onParamChange('drive', { drive: v })}
              />
              <RotaryKnob
                label="Tone"
                value={p.tone}
                min={0}
                max={100}
                defaultValue={62}
                accentColor={meta.accent}
                size={44}
                onChange={(v) => onParamChange('drive', { tone: v })}
              />
              <RotaryKnob
                label="Level"
                value={p.level}
                min={0}
                max={100}
                defaultValue={72}
                accentColor={meta.accent}
                size={44}
                onChange={(v) => onParamChange('drive', { level: v })}
              />
            </div>
          </div>
        );
      }

      case 'fuzz': {
        const p = pedal.params as PedalParamsMap['fuzz'];
        const modes: { id: FuzzMode; label: string }[] = [
          { id: 'big-muff', label: 'Muff' },
          { id: 'fuzz-face', label: 'Face' },
          { id: 'super-fuzz', label: 'Super' }
        ];
        return (
          <div className="pedal-controls">
            <div className="mode-pills">
              {modes.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  className={`mode-pill ${p.mode === m.id ? 'is-active' : ''}`}
                  style={p.mode === m.id ? { borderColor: meta.accent, color: meta.accent } : undefined}
                  onClick={() => onParamChange('fuzz', { mode: m.id })}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <div className="knob-grid three-col">
              <RotaryKnob
                label="Sustain"
                value={p.sustain}
                min={0}
                max={100}
                defaultValue={78}
                accentColor={meta.accent}
                size={44}
                onChange={(v) => onParamChange('fuzz', { sustain: v })}
              />
              <RotaryKnob
                label="Tone"
                value={p.tone}
                min={0}
                max={100}
                defaultValue={55}
                accentColor={meta.accent}
                size={44}
                onChange={(v) => onParamChange('fuzz', { tone: v })}
              />
              <RotaryKnob
                label="Vol"
                value={p.level}
                min={0}
                max={100}
                defaultValue={72}
                accentColor={meta.accent}
                size={44}
                onChange={(v) => onParamChange('fuzz', { level: v })}
              />
            </div>
          </div>
        );
      }

      case 'eq': {
        const p = pedal.params as PedalParamsMap['eq'];
        const sliders: { key: keyof PedalParamsMap['eq']; label: string }[] = [
          { key: 'band100', label: '100' },
          { key: 'band250', label: '280' },
          { key: 'band800', label: '800' },
          { key: 'band2000', label: '2.2k' },
          { key: 'band4000', label: '4.8k' },
          { key: 'level', label: 'LVL' }
        ];
        return (
          <div className="pedal-controls">
            <div className="eq-sliders">
              {sliders.map((s) => (
                <div key={s.key} className="eq-col">
                  <span className="eq-db">{p[s.key] > 0 ? `+${p[s.key]}` : p[s.key]}</span>
                  <input
                    type="range"
                    min={-12}
                    max={12}
                    step={0.5}
                    value={p[s.key]}
                    onChange={(e) => onParamChange('eq', { [s.key]: Number(e.target.value) })}
                    onDoubleClick={() => onParamChange('eq', { [s.key]: 0 })}
                    className="eq-range"
                  />
                  <span className="eq-freq">{s.label}</span>
                </div>
              ))}
            </div>
          </div>
        );
      }

      case 'phaser': {
        const p = pedal.params as PedalParamsMap['phaser'];
        return (
          <div className="pedal-controls">
            <div className="knob-grid two-col">
              <RotaryKnob
                label="Rate"
                value={p.rate}
                min={0.1}
                max={6}
                step={0.05}
                defaultValue={0.65}
                unit="Hz"
                accentColor={meta.accent}
                size={42}
                onChange={(v) => onParamChange('phaser', { rate: v })}
              />
              <RotaryKnob
                label="Depth"
                value={p.depth}
                min={0}
                max={100}
                defaultValue={78}
                unit="%"
                accentColor={meta.accent}
                size={42}
                onChange={(v) => onParamChange('phaser', { depth: v })}
              />
              <RotaryKnob
                label="Reson"
                value={p.feedback}
                min={0}
                max={80}
                defaultValue={58}
                unit="%"
                accentColor={meta.accent}
                size={42}
                onChange={(v) => onParamChange('phaser', { feedback: v })}
              />
              <RotaryKnob
                label="Mix"
                value={p.mix}
                min={0}
                max={100}
                defaultValue={62}
                unit="%"
                accentColor={meta.accent}
                size={42}
                onChange={(v) => onParamChange('phaser', { mix: v })}
              />
            </div>
          </div>
        );
      }

      case 'flanger': {
        const p = pedal.params as PedalParamsMap['flanger'];
        return (
          <div className="pedal-controls">
            <div className="knob-grid two-col">
              <RotaryKnob
                label="Rate"
                value={p.rate}
                min={0.08}
                max={4}
                step={0.02}
                defaultValue={0.35}
                unit="Hz"
                accentColor={meta.accent}
                size={42}
                onChange={(v) => onParamChange('flanger', { rate: v })}
              />
              <RotaryKnob
                label="Depth"
                value={p.depth}
                min={0}
                max={100}
                defaultValue={72}
                unit="%"
                accentColor={meta.accent}
                size={42}
                onChange={(v) => onParamChange('flanger', { depth: v })}
              />
              <RotaryKnob
                label="Regen"
                value={p.feedback}
                min={-85}
                max={85}
                step={1}
                defaultValue={60}
                unit="%"
                accentColor={meta.accent}
                size={42}
                onChange={(v) => onParamChange('flanger', { feedback: v })}
              />
              <RotaryKnob
                label="Mix"
                value={p.mix}
                min={0}
                max={100}
                defaultValue={55}
                unit="%"
                accentColor={meta.accent}
                size={42}
                onChange={(v) => onParamChange('flanger', { mix: v })}
              />
            </div>
          </div>
        );
      }

      case 'vibe': {
        const p = pedal.params as PedalParamsMap['vibe'];
        const modes: { id: VibeMode; label: string }[] = [
          { id: 'univibe', label: 'Uni-Vibe' },
          { id: 'rotary', label: 'Rotary' }
        ];
        return (
          <div className="pedal-controls">
            <div className="mode-pills two-col">
              {modes.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  className={`mode-pill ${p.mode === m.id ? 'is-active' : ''}`}
                  style={p.mode === m.id ? { borderColor: meta.accent, color: meta.accent } : undefined}
                  onClick={() => onParamChange('vibe', { mode: m.id })}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <div className="knob-grid three-col">
              <RotaryKnob
                label="Speed"
                value={p.speed}
                min={0.3}
                max={9}
                step={0.1}
                defaultValue={2.2}
                unit="Hz"
                accentColor={meta.accent}
                size={44}
                onChange={(v) => onParamChange('vibe', { speed: v })}
              />
              <RotaryKnob
                label="Depth"
                value={p.depth}
                min={0}
                max={100}
                defaultValue={76}
                unit="%"
                accentColor={meta.accent}
                size={44}
                onChange={(v) => onParamChange('vibe', { depth: v })}
              />
              <RotaryKnob
                label="Mix"
                value={p.mix}
                min={0}
                max={100}
                defaultValue={72}
                unit="%"
                accentColor={meta.accent}
                size={44}
                onChange={(v) => onParamChange('vibe', { mix: v })}
              />
            </div>
          </div>
        );
      }

      case 'tremolo': {
        const p = pedal.params as PedalParamsMap['tremolo'];
        const waves: { id: TremoloWave; label: string }[] = [
          { id: 'sine', label: 'Sine' },
          { id: 'triangle', label: 'Tri' },
          { id: 'square', label: 'Chop' }
        ];
        return (
          <div className="pedal-controls">
            <div className="mode-pills">
              {waves.map((w) => (
                <button
                  key={w.id}
                  type="button"
                  className={`mode-pill ${p.wave === w.id ? 'is-active' : ''}`}
                  style={p.wave === w.id ? { borderColor: meta.accent, color: meta.accent } : undefined}
                  onClick={() => onParamChange('tremolo', { wave: w.id })}
                >
                  {w.label}
                </button>
              ))}
            </div>
            <div className="knob-grid two-col">
              <RotaryKnob
                label="Rate"
                value={p.rate}
                min={0.5}
                max={14}
                step={0.1}
                defaultValue={4.2}
                unit="Hz"
                accentColor={meta.accent}
                size={48}
                onChange={(v) => onParamChange('tremolo', { rate: v })}
              />
              <RotaryKnob
                label="Depth"
                value={p.depth}
                min={0}
                max={100}
                defaultValue={68}
                unit="%"
                accentColor={meta.accent}
                size={48}
                onChange={(v) => onParamChange('tremolo', { depth: v })}
              />
            </div>
          </div>
        );
      }

      case 'chorus': {
        const p = pedal.params as PedalParamsMap['chorus'];
        return (
          <div className="pedal-controls">
            <div className="knob-grid three-col">
              <RotaryKnob
                label="Rate"
                value={p.rate}
                min={0.1}
                max={6}
                step={0.05}
                defaultValue={1.1}
                unit="Hz"
                accentColor={meta.accent}
                size={44}
                onChange={(v) => onParamChange('chorus', { rate: v })}
              />
              <RotaryKnob
                label="Depth"
                value={p.depth}
                min={0}
                max={100}
                defaultValue={64}
                unit="%"
                accentColor={meta.accent}
                size={44}
                onChange={(v) => onParamChange('chorus', { depth: v })}
              />
              <RotaryKnob
                label="Mix"
                value={p.mix}
                min={0}
                max={100}
                defaultValue={55}
                unit="%"
                accentColor={meta.accent}
                size={44}
                onChange={(v) => onParamChange('chorus', { mix: v })}
              />
            </div>
          </div>
        );
      }

      case 'delay': {
        const p = pedal.params as PedalParamsMap['delay'];
        return (
          <div className="pedal-controls">
            <div className="knob-grid two-col">
              <RotaryKnob
                label="Time"
                value={p.timeMs}
                min={40}
                max={1000}
                step={5}
                defaultValue={360}
                unit="ms"
                accentColor={meta.accent}
                size={42}
                onChange={(v) => onParamChange('delay', { timeMs: v })}
              />
              <RotaryKnob
                label="F.Back"
                value={p.feedback}
                min={0}
                max={85}
                defaultValue={42}
                unit="%"
                accentColor={meta.accent}
                size={42}
                onChange={(v) => onParamChange('delay', { feedback: v })}
              />
              <RotaryKnob
                label="Tone"
                value={p.tone}
                min={0}
                max={100}
                defaultValue={56}
                accentColor={meta.accent}
                size={42}
                onChange={(v) => onParamChange('delay', { tone: v })}
              />
              <RotaryKnob
                label="Mix"
                value={p.mix}
                min={0}
                max={100}
                defaultValue={40}
                unit="%"
                accentColor={meta.accent}
                size={42}
                onChange={(v) => onParamChange('delay', { mix: v })}
              />
            </div>
            <button type="button" className="tap-btn" onClick={handleDelayTap}>
              TAP ({Math.round(60000 / Math.max(40, p.timeMs))} BPM)
            </button>
          </div>
        );
      }

      case 'reverb': {
        const p = pedal.params as PedalParamsMap['reverb'];
        const modes: { id: ReverbMode; label: string }[] = [
          { id: 'hall', label: 'Hall' },
          { id: 'spring', label: 'Spring' },
          { id: 'shimmer', label: 'Shimmer' }
        ];
        return (
          <div className="pedal-controls">
            <div className="mode-pills">
              {modes.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  className={`mode-pill ${p.mode === m.id ? 'is-active' : ''}`}
                  style={p.mode === m.id ? { borderColor: meta.accent, color: meta.accent } : undefined}
                  onClick={() => onParamChange('reverb', { mode: m.id })}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <div className="knob-grid three-col">
              <RotaryKnob
                label="Decay"
                value={p.decay}
                min={0.4}
                max={6.0}
                step={0.1}
                defaultValue={2.3}
                unit="s"
                accentColor={meta.accent}
                size={44}
                onChange={(v) => onParamChange('reverb', { decay: v })}
              />
              <RotaryKnob
                label="Damp"
                value={p.dampening}
                min={0}
                max={100}
                defaultValue={40}
                unit="%"
                accentColor={meta.accent}
                size={44}
                onChange={(v) => onParamChange('reverb', { dampening: v })}
              />
              <RotaryKnob
                label="Mix"
                value={p.mix}
                min={0}
                max={100}
                defaultValue={34}
                unit="%"
                accentColor={meta.accent}
                size={44}
                onChange={(v) => onParamChange('reverb', { mix: v })}
              />
            </div>
          </div>
        );
      }
    }
  };

  return (
    <div
      className={`pedal-card ${pedal.enabled ? 'is-enabled' : 'is-bypassed'}`}
      style={{
        background: meta.bgTint,
        borderColor: pedal.enabled ? meta.accent : 'rgba(148,163,184,0.18)'
      }}
      draggable
      onDragStart={() => onDragStart(pedal.id)}
      onDragOver={(e) => e.preventDefault()}
      onDrop={() => onDropOn(pedal.id)}
    >
      <div className="pedal-top-bar">
        <div className="pedal-order-btns">
          <button
            type="button"
            disabled={index === 0}
            onClick={() => onMove(index, index - 1)}
            title="Mover pedal para antes na cadeia"
          >
            <ChevronLeft size={13} />
          </button>
          <span className="drag-handle" title="Arraste para reordenar a cadeia de sinal">
            <GripVertical size={13} />
          </span>
          <button
            type="button"
            disabled={index === total - 1}
            onClick={() => onMove(index, index + 1)}
            title="Mover pedal para depois na cadeia"
          >
            <ChevronRight size={13} />
          </button>
        </div>

        <div className="pedal-top-right">
          <button
            type="button"
            className="pedal-reset-btn"
            onClick={() => onResetPedal(pedal.id)}
            title={`Zerar knobs de ${meta.title} para a posição original`}
          >
            <RotateCcw size={11} />
          </button>
          <span className="shortcut-chip" title={`Atalho de teclado: tecla ${meta.shortcut}`}>
            {meta.shortcut}
          </span>
        </div>
      </div>

      <div className="pedal-header">
        <span
          className="pedal-led"
          style={{
            backgroundColor: pedal.enabled ? meta.accent : '#2a2f3a',
            boxShadow: pedal.enabled ? `0 0 10px ${meta.accent}` : 'none'
          }}
        />
        <div>
          <h3 className="pedal-title">{meta.title}</h3>
          <p className="pedal-subtitle">{meta.subtitle}</p>
        </div>
      </div>

      {renderControls()}

      <div className="pedal-footer">
        <button
          type="button"
          className={`stomp-switch ${pedal.enabled ? 'is-on' : ''}`}
          onClick={() => onToggle(pedal.id)}
          title={`Ligar/Desligar ${meta.title} (Tecla ${meta.shortcut})`}
        >
          <span className="stomp-cap" />
        </button>
        <span className="stomp-status">{pedal.enabled ? 'ATIVO' : 'BYPASS'}</span>
      </div>
    </div>
  );
};
