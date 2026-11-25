import React, { useRef } from 'react';
import { ChevronLeft, ChevronRight, GripVertical } from 'lucide-react';
import {
  DriveMode,
  PedalId,
  PedalParamsMap,
  PedalState
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
    accent: '#ef4444',
    bgTint: 'linear-gradient(165deg, #3a1d24 0%, #1f1419 100%)',
    shortcut: 'W'
  },
  drive: {
    title: 'OVERDRIVE',
    subtitle: 'Tube / Crunch / Fuzz',
    accent: '#f59e0b',
    bgTint: 'linear-gradient(165deg, #3d2c12 0%, #21190f 100%)',
    shortcut: 'E'
  },
  eq: {
    title: '5-BAND EQ',
    subtitle: 'Modelador de Tom',
    accent: '#e2e8f0',
    bgTint: 'linear-gradient(165deg, #242933 0%, #151820 100%)',
    shortcut: 'R'
  },
  chorus: {
    title: 'CHORUS',
    subtitle: 'Modulação Estéreo',
    accent: '#38bdf8',
    bgTint: 'linear-gradient(165deg, #132f42 0%, #111c27 100%)',
    shortcut: 'Y'
  },
  delay: {
    title: 'ANALOG DELAY',
    subtitle: 'Eco + Tap Tempo',
    accent: '#a855f7',
    bgTint: 'linear-gradient(165deg, #2d1b42 0%, #1a1326 100%)',
    shortcut: 'U'
  },
  reverb: {
    title: 'REVERB',
    subtitle: 'Hall / Plate Estéreo',
    accent: '#14b8a6',
    bgTint: 'linear-gradient(165deg, #113535 0%, #101f22 100%)',
    shortcut: 'I'
  }
};

interface PedalUnitProps<T extends PedalId = PedalId> {
  pedal: PedalState<T>;
  index: number;
  total: number;
  gateIsOpen?: boolean;
  onToggle: (id: PedalId) => void;
  onParamChange: <K extends PedalId>(id: K, patch: Partial<PedalParamsMap[K]>) => void;
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
  onMove,
  onDragStart,
  onDropOn
}) => {
  const meta = PEDAL_META[pedal.id];
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
                defaultValue={-54}
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
                title="Remove zumbido de 60Hz/120Hz da rede elétrica (ótimo para cabo P10→P2)"
              >
                Filtro 60Hz {p.humFilter60Hz ? 'ON' : 'OFF'}
              </button>
              <span
                className={`gate-led ${pedal.enabled ? (gateIsOpen ? 'open' : 'closed') : 'off'}`}
                title={gateIsOpen ? 'Sinal passando' : 'Ruído cortado (Gate fechado)'}
              >
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
                defaultValue={-24}
                unit="dB"
                accentColor={meta.accent}
                onChange={(v) => onParamChange('compressor', { threshold: v })}
              />
              <RotaryKnob
                label="Ratio"
                value={p.ratio}
                min={1}
                max={16}
                step={0.5}
                defaultValue={4}
                formatValue={(v) => `${v.toFixed(1)}:1`}
                accentColor={meta.accent}
                onChange={(v) => onParamChange('compressor', { ratio: v })}
              />
              <RotaryKnob
                label="Attack"
                value={p.attack * 1000}
                min={2}
                max={100}
                step={1}
                defaultValue={12}
                unit="ms"
                accentColor={meta.accent}
                onChange={(v) => onParamChange('compressor', { attack: v / 1000 })}
              />
              <RotaryKnob
                label="Makeup"
                value={p.makeup}
                min={0}
                max={18}
                step={0.5}
                defaultValue={4}
                unit="dB"
                accentColor={meta.accent}
                onChange={(v) => onParamChange('compressor', { makeup: v })}
              />
            </div>
          </div>
        );
      }

      case 'drive': {
        const p = pedal.params as PedalParamsMap['drive'];
        const modes: { id: DriveMode; label: string }[] = [
          { id: 'tube-od', label: 'Tube' },
          { id: 'crunch', label: 'Crunch' },
          { id: 'metal-fuzz', label: 'Fuzz' }
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
                  onClick={() => onParamChange('drive', { mode: m.id })}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <div className="knob-grid three-col">
              <RotaryKnob
                label="Drive"
                value={p.drive}
                min={0}
                max={100}
                defaultValue={45}
                accentColor={meta.accent}
                size={46}
                onChange={(v) => onParamChange('drive', { drive: v })}
              />
              <RotaryKnob
                label="Tone"
                value={p.tone}
                min={0}
                max={100}
                defaultValue={58}
                accentColor={meta.accent}
                size={46}
                onChange={(v) => onParamChange('drive', { tone: v })}
              />
              <RotaryKnob
                label="Level"
                value={p.level}
                min={0}
                max={100}
                defaultValue={68}
                accentColor={meta.accent}
                size={46}
                onChange={(v) => onParamChange('drive', { level: v })}
              />
            </div>
          </div>
        );
      }

      case 'eq': {
        const p = pedal.params as PedalParamsMap['eq'];
        const sliders: { key: keyof PedalParamsMap['eq']; label: string }[] = [
          { key: 'band100', label: '100' },
          { key: 'band250', label: '250' },
          { key: 'band800', label: '800' },
          { key: 'band2000', label: '2k' },
          { key: 'band4000', label: '4k' },
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
                size={46}
                onChange={(v) => onParamChange('chorus', { rate: v })}
              />
              <RotaryKnob
                label="Depth"
                value={p.depth}
                min={0}
                max={100}
                defaultValue={45}
                unit="%"
                accentColor={meta.accent}
                size={46}
                onChange={(v) => onParamChange('chorus', { depth: v })}
              />
              <RotaryKnob
                label="Mix"
                value={p.mix}
                min={0}
                max={100}
                defaultValue={35}
                unit="%"
                accentColor={meta.accent}
                size={46}
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
                size={46}
                onChange={(v) => onParamChange('delay', { timeMs: v })}
              />
              <RotaryKnob
                label="F.Back"
                value={p.feedback}
                min={0}
                max={85}
                defaultValue={34}
                unit="%"
                accentColor={meta.accent}
                size={46}
                onChange={(v) => onParamChange('delay', { feedback: v })}
              />
              <RotaryKnob
                label="Tone"
                value={p.tone}
                min={0}
                max={100}
                defaultValue={55}
                accentColor={meta.accent}
                size={46}
                onChange={(v) => onParamChange('delay', { tone: v })}
              />
              <RotaryKnob
                label="Mix"
                value={p.mix}
                min={0}
                max={100}
                defaultValue={28}
                unit="%"
                accentColor={meta.accent}
                size={46}
                onChange={(v) => onParamChange('delay', { mix: v })}
              />
            </div>
            <button type="button" className="tap-btn" onClick={handleDelayTap}>
              TAP TEMPO ({Math.round(60000 / Math.max(40, p.timeMs))} BPM)
            </button>
          </div>
        );
      }

      case 'reverb': {
        const p = pedal.params as PedalParamsMap['reverb'];
        return (
          <div className="pedal-controls">
            <div className="knob-grid three-col">
              <RotaryKnob
                label="Decay"
                value={p.decay}
                min={0.4}
                max={6.0}
                step={0.1}
                defaultValue={1.9}
                unit="s"
                accentColor={meta.accent}
                size={46}
                onChange={(v) => onParamChange('reverb', { decay: v })}
              />
              <RotaryKnob
                label="Damp"
                value={p.dampening}
                min={0}
                max={100}
                defaultValue={45}
                unit="%"
                accentColor={meta.accent}
                size={46}
                onChange={(v) => onParamChange('reverb', { dampening: v })}
              />
              <RotaryKnob
                label="Mix"
                value={p.mix}
                min={0}
                max={100}
                defaultValue={26}
                unit="%"
                accentColor={meta.accent}
                size={46}
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
      {/* Top Bar: Reorder + Drag + Shortcut */}
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
        <span className="shortcut-chip" title={`Atalho de teclado: tecla ${meta.shortcut}`}>
          {meta.shortcut}
        </span>
      </div>

      {/* Pedal Header & LED */}
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

      {/* Controls */}
      {renderControls()}

      {/* Stomp Footswitch */}
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
