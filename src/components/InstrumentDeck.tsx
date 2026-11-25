import React, { useEffect, useRef, useState } from 'react';
import { Disc3, Keyboard, Music, Play, Square, Trash2, Volume2, X } from 'lucide-react';
import {
  DRUM_GROOVES,
  DRUM_PADS,
  DrumKitStyle,
  DrumPadId,
  DrumPattern,
  DrumRouting,
  createEmptyPattern
} from '../audio/drumEngine';
import { InstrumentRouting, SynthVoicePreset } from '../audio/synthEngine';

export type InstrumentTab = 'piano' | 'drums';

interface PianoKeyDef {
  semitone: number;
  noteName: string;
  isBlack: boolean;
  pcKeys: string[];
  displayKey: string;
  whiteIndex: number; // position along white keys for black key placement
}

const PIANO_KEYS: PianoKeyDef[] = [
  { semitone: 0, noteName: 'C', isBlack: false, pcKeys: ['a'], displayKey: 'A', whiteIndex: 0 },
  { semitone: 1, noteName: 'C#', isBlack: true, pcKeys: ['w'], displayKey: 'W', whiteIndex: 0 },
  { semitone: 2, noteName: 'D', isBlack: false, pcKeys: ['s'], displayKey: 'S', whiteIndex: 1 },
  { semitone: 3, noteName: 'D#', isBlack: true, pcKeys: ['e'], displayKey: 'E', whiteIndex: 1 },
  { semitone: 4, noteName: 'E', isBlack: false, pcKeys: ['d'], displayKey: 'D', whiteIndex: 2 },
  { semitone: 5, noteName: 'F', isBlack: false, pcKeys: ['f'], displayKey: 'F', whiteIndex: 3 },
  { semitone: 6, noteName: 'F#', isBlack: true, pcKeys: ['t'], displayKey: 'T', whiteIndex: 3 },
  { semitone: 7, noteName: 'G', isBlack: false, pcKeys: ['g'], displayKey: 'G', whiteIndex: 4 },
  { semitone: 8, noteName: 'G#', isBlack: true, pcKeys: ['y'], displayKey: 'Y', whiteIndex: 4 },
  { semitone: 9, noteName: 'A', isBlack: false, pcKeys: ['h'], displayKey: 'H', whiteIndex: 5 },
  { semitone: 10, noteName: 'A#', isBlack: true, pcKeys: ['u'], displayKey: 'U', whiteIndex: 5 },
  { semitone: 11, noteName: 'B', isBlack: false, pcKeys: ['j'], displayKey: 'J', whiteIndex: 6 },
  { semitone: 12, noteName: 'C', isBlack: false, pcKeys: ['k'], displayKey: 'K', whiteIndex: 7 },
  { semitone: 13, noteName: 'C#', isBlack: true, pcKeys: ['o'], displayKey: 'O', whiteIndex: 7 },
  { semitone: 14, noteName: 'D', isBlack: false, pcKeys: ['l'], displayKey: 'L', whiteIndex: 8 },
  { semitone: 15, noteName: 'D#', isBlack: true, pcKeys: ['p'], displayKey: 'P', whiteIndex: 8 },
  { semitone: 16, noteName: 'E', isBlack: false, pcKeys: ['ç', ';'], displayKey: 'Ç', whiteIndex: 9 }
];

const SYNTH_PRESETS: { id: SynthVoicePreset; label: string }[] = [
  { id: 'grand-piano', label: 'Grand Piano' },
  { id: 'rhodes-ep', label: 'Rhodes E-Piano' },
  { id: 'rock-organ', label: 'Órgão Rock' },
  { id: 'synth-lead', label: 'Synth Lead' },
  { id: 'warm-pad', label: 'Pad Atmosférico' },
  { id: 'synth-bass', label: 'Baixo Synth' }
];

const WHITE_KEYS = PIANO_KEYS.filter((k) => !k.isBlack);
const BLACK_KEYS = PIANO_KEYS.filter((k) => k.isBlack);

interface InstrumentDeckProps {
  isOpen: boolean;
  activeTab: InstrumentTab;
  pcCaptureEnabled: boolean;
  onTabChange: (tab: InstrumentTab) => void;
  onTogglePcCapture: () => void;
  onClose: () => void;

  // Synth props
  synthPreset: SynthVoicePreset;
  synthRouting: InstrumentRouting;
  synthVolume: number;
  octave: number;
  sustain: boolean;
  onSynthPresetChange: (preset: SynthVoicePreset) => void;
  onSynthRoutingChange: (routing: InstrumentRouting) => void;
  onSynthVolumeChange: (vol: number) => void;
  onOctaveChange: (oct: number) => void;
  onSustainChange: (sustain: boolean) => void;
  onNoteOn: (midi: number, velocity?: number) => void;
  onNoteOff: (midi: number) => void;

  // Drum props
  drumKit: DrumKitStyle;
  drumRouting: DrumRouting;
  drumVolume: number;
  drumBpm: number;
  drumPattern: DrumPattern;
  drumSeqRunning: boolean;
  drumCurrentStep: number;
  onDrumKitChange: (kit: DrumKitStyle) => void;
  onDrumRoutingChange: (routing: DrumRouting) => void;
  onDrumVolumeChange: (vol: number) => void;
  onDrumBpmChange: (bpm: number) => void;
  onDrumTrigger: (pad: DrumPadId, velocity?: number) => void;
  onDrumPatternChange: (pattern: DrumPattern) => void;
  onDrumToggleSeq: () => void;
  onDrumLoadGroove: (grooveKey: string) => void;
}

export const InstrumentDeck: React.FC<InstrumentDeckProps> = ({
  isOpen,
  activeTab,
  pcCaptureEnabled,
  onTabChange,
  onTogglePcCapture,
  onClose,
  synthPreset,
  synthRouting,
  synthVolume,
  octave,
  sustain,
  onSynthPresetChange,
  onSynthRoutingChange,
  onSynthVolumeChange,
  onOctaveChange,
  onSustainChange,
  onNoteOn,
  onNoteOff,
  drumKit,
  drumRouting,
  drumVolume,
  drumBpm,
  drumPattern,
  drumSeqRunning,
  drumCurrentStep,
  onDrumKitChange,
  onDrumRoutingChange,
  onDrumVolumeChange,
  onDrumBpmChange,
  onDrumTrigger,
  onDrumPatternChange,
  onDrumToggleSeq,
  onDrumLoadGroove
}) => {
  const [pressedMidis, setPressedMidis] = useState<Set<number>>(new Set());
  const [litPads, setLitPads] = useState<Set<DrumPadId>>(new Set());
  const keyToMidiRef = useRef<Map<string, number>>(new Map());
  const padTimersRef = useRef<Map<DrumPadId, number>>(new Map());

  const baseMidi = (octave + 1) * 12; // octave 4 => C4 = 60

  const flashPad = (pad: DrumPadId) => {
    setLitPads((prev) => new Set(prev).add(pad));
    const prevTimer = padTimersRef.current.get(pad);
    if (prevTimer) window.clearTimeout(prevTimer);
    const id = window.setTimeout(() => {
      setLitPads((prev) => {
        const next = new Set(prev);
        next.delete(pad);
        return next;
      });
    }, 130);
    padTimersRef.current.set(pad, id);
  };

  // Flash pads in sync with step sequencer
  useEffect(() => {
    if (!drumSeqRunning || drumCurrentStep < 0) return;
    DRUM_PADS.forEach((p) => {
      if (drumPattern[p.id]?.[drumCurrentStep]) {
        flashPad(p.id);
      }
    });
  }, [drumCurrentStep, drumSeqRunning, drumPattern]);

  // Handle PC Keyboard playing when deck is open and PC capture is active
  useEffect(() => {
    if (!isOpen || !pcCaptureEnabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      if (e.key === 'Shift' && activeTab === 'piano') {
        if (!e.repeat) onSustainChange(true);
        return;
      }

      if (e.repeat) return;

      const key = e.key.toLowerCase();

      if (activeTab === 'piano') {
        if (key === 'z') {
          e.preventDefault();
          onOctaveChange(Math.max(2, octave - 1));
          return;
        }
        if (key === 'x') {
          e.preventDefault();
          onOctaveChange(Math.min(6, octave + 1));
          return;
        }

        const matched = PIANO_KEYS.find((k) => k.pcKeys.includes(key));
        if (matched) {
          e.preventDefault();
          const midi = baseMidi + matched.semitone;
          keyToMidiRef.current.set(key, midi);
          setPressedMidis((prev) => new Set(prev).add(midi));
          onNoteOn(midi, 0.88);
        }
      } else {
        // Drum pads mapped to A S D F G H J K
        const pad = DRUM_PADS.find((p) => p.key.toLowerCase() === key);
        if (pad) {
          e.preventDefault();
          flashPad(pad.id);
          onDrumTrigger(pad.id, 0.95);
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift' && activeTab === 'piano') {
        onSustainChange(false);
        return;
      }
      const key = e.key.toLowerCase();
      const midi = keyToMidiRef.current.get(key);
      if (midi !== undefined) {
        keyToMidiRef.current.delete(key);
        setPressedMidis((prev) => {
          const next = new Set(prev);
          next.delete(midi);
          return next;
        });
        onNoteOff(midi);
      }
    };

    const handleBlur = () => {
      for (const midi of keyToMidiRef.current.values()) {
        onNoteOff(midi);
      }
      keyToMidiRef.current.clear();
      setPressedMidis(new Set());
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, [
    isOpen,
    pcCaptureEnabled,
    activeTab,
    octave,
    baseMidi,
    onOctaveChange,
    onSustainChange,
    onNoteOn,
    onNoteOff,
    onDrumTrigger
  ]);

  if (!isOpen) return null;

  const triggerMouseNoteOn = (semitone: number) => {
    const midi = baseMidi + semitone;
    setPressedMidis((prev) => new Set(prev).add(midi));
    onNoteOn(midi, 0.9);
  };

  const triggerMouseNoteOff = (semitone: number) => {
    const midi = baseMidi + semitone;
    setPressedMidis((prev) => {
      const next = new Set(prev);
      next.delete(midi);
      return next;
    });
    onNoteOff(midi);
  };

  const toggleStep = (padId: DrumPadId, stepIdx: number) => {
    const next: DrumPattern = {
      ...drumPattern,
      [padId]: drumPattern[padId].map((val, idx) => (idx === stepIdx ? !val : val))
    };
    onDrumPatternChange(next);
  };

  return (
    <section className="instrument-deck">
      {/* Header Bar */}
      <div className="instrument-header">
        <div className="instrument-tabs">
          <button
            type="button"
            className={`inst-tab ${activeTab === 'piano' ? 'is-active' : ''}`}
            onClick={() => onTabChange('piano')}
          >
            <Music size={15} />
            <span>Piano / Teclado Synth</span>
          </button>
          <button
            type="button"
            className={`inst-tab ${activeTab === 'drums' ? 'is-active' : ''}`}
            onClick={() => onTabChange('drums')}
          >
            <Disc3 size={15} />
            <span>Bateria Eletrônica + Sequencer</span>
          </button>
        </div>

        <div className="instrument-header-right">
          <button
            type="button"
            className={`btn-chip ${pcCaptureEnabled ? 'is-accent' : ''}`}
            onClick={onTogglePcCapture}
            title="Quando ativo, as teclas do PC tocam notas/pads em vez de alternar pedais (ESC desativa)"
          >
            <Keyboard size={14} />
            <span>
              Teclado do PC: {pcCaptureEnabled ? 'TOCANDO (ESC p/ atalhos)' : 'PAUSADO'}
            </span>
          </button>
          <button type="button" className="btn-icon" onClick={onClose} title="Fechar painel de instrumentos">
            <X size={16} />
          </button>
        </div>
      </div>

      {/* PIANO / SYNTH VIEW */}
      {activeTab === 'piano' ? (
        <div className="piano-section">
          <div className="inst-toolbar">
            <div className="voice-pills">
              {SYNTH_PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={`voice-pill ${synthPreset === p.id ? 'is-active' : ''}`}
                  onClick={() => onSynthPresetChange(p.id)}
                >
                  {p.label}
                </button>
              ))}
            </div>

            <div className="inst-controls-right">
              <div className="octave-box" title="Use Z e X no teclado do PC para mudar a oitava">
                <button type="button" className="btn-step" onClick={() => onOctaveChange(Math.max(2, octave - 1))}>
                  Z -
                </button>
                <span>Oitava C{octave}</span>
                <button type="button" className="btn-step" onClick={() => onOctaveChange(Math.min(6, octave + 1))}>
                  X +
                </button>
              </div>

              <button
                type="button"
                className={`btn-chip ${sustain ? 'is-amber' : ''}`}
                onClick={() => onSustainChange(!sustain)}
                title="Segure SHIFT no teclado ou clique aqui para manter as notas soando"
              >
                Sustain (Shift): {sustain ? 'ON' : 'OFF'}
              </button>

              <div className="routing-switch">
                <button
                  type="button"
                  className={synthRouting === 'clean-looper' ? 'is-active' : ''}
                  onClick={() => onSynthRoutingChange('clean-looper')}
                  title="Som limpo (não distorce no amp da guitarra) e gravável no Looper"
                >
                  Limpo + Looper
                </button>
                <button
                  type="button"
                  className={synthRouting === 'pedal-chain' ? 'is-active' : ''}
                  onClick={() => onSynthRoutingChange('pedal-chain')}
                  title="Passa o teclado pelos pedais (Overdrive, Chorus, Delay, Reverb) e Amp!"
                >
                  Via Pedaleira (FX)
                </button>
              </div>

              <label className="vol-slider-label">
                <Volume2 size={14} />
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={Math.round(synthVolume * 100)}
                  onChange={(e) => onSynthVolumeChange(Number(e.target.value) / 100)}
                />
              </label>
            </div>
          </div>

          {/* Interactive Piano Keyboard */}
          <div className="piano-board-wrap">
            <div className="piano-keyboard">
              <div className="white-keys-row">
                {WHITE_KEYS.map((k) => {
                  const midi = baseMidi + k.semitone;
                  const active = pressedMidis.has(midi);
                  const noteOct = Math.floor(midi / 12) - 1;
                  return (
                    <button
                      key={k.semitone}
                      type="button"
                      className={`piano-key-white ${active ? 'is-pressed' : ''}`}
                      onPointerDown={(e) => {
                        e.preventDefault();
                        triggerMouseNoteOn(k.semitone);
                      }}
                      onPointerUp={() => triggerMouseNoteOff(k.semitone)}
                      onPointerLeave={() => {
                        if (active) triggerMouseNoteOff(k.semitone);
                      }}
                    >
                      <span className="piano-pc-badge">{k.displayKey}</span>
                      <span className="piano-note-tag">
                        {k.noteName}
                        {noteOct}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Black keys overlaid accurately */}
              <div className="black-keys-layer">
                {BLACK_KEYS.map((k) => {
                  const midi = baseMidi + k.semitone;
                  const active = pressedMidis.has(midi);
                  const leftPct = ((k.whiteIndex + 0.68) / WHITE_KEYS.length) * 100;
                  return (
                    <button
                      key={k.semitone}
                      type="button"
                      className={`piano-key-black ${active ? 'is-pressed' : ''}`}
                      style={{ left: `${leftPct}%` }}
                      onPointerDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        triggerMouseNoteOn(k.semitone);
                      }}
                      onPointerUp={(e) => {
                        e.stopPropagation();
                        triggerMouseNoteOff(k.semitone);
                      }}
                      onPointerLeave={() => {
                        if (active) triggerMouseNoteOff(k.semitone);
                      }}
                    >
                      <span className="piano-pc-badge">{k.displayKey}</span>
                      <span className="piano-note-tag">{k.noteName}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            <p className="inst-hint">
              Toque acordes com <strong>A S D F G H J K L Ç</strong> (brancas) e <strong>W E T Y U O P</strong> (sustenidos) • <strong>Z/X</strong> muda oitava • <strong>Shift</strong> Sustain • <strong>Espaço</strong> grava no Looper!
            </p>
          </div>
        </div>
      ) : (
        /* ELECTRONIC DRUMS + 16-STEP SEQUENCER VIEW */
        <div className="drums-section">
          <div className="inst-toolbar">
            <div className="drum-top-left">
              <div className="routing-switch">
                <button
                  type="button"
                  className={drumKit === 'acoustic-rock' ? 'is-active' : ''}
                  onClick={() => onDrumKitChange('acoustic-rock')}
                >
                  Kit Acoustic Rock
                </button>
                <button
                  type="button"
                  className={drumKit === 'electronic-808' ? 'is-active' : ''}
                  onClick={() => onDrumKitChange('electronic-808')}
                >
                  Kit 808 Eletrônica
                </button>
              </div>

              <div className="routing-switch">
                <button
                  type="button"
                  className={drumRouting === 'direct-clean' ? 'is-active' : ''}
                  onClick={() => onDrumRoutingChange('direct-clean')}
                  title="Sai limpo direto pro Home Theater/Fones sem distorcer no amp"
                >
                  Limpo (Base)
                </button>
                <button
                  type="button"
                  className={drumRouting === 'clean-looper' ? 'is-active' : ''}
                  onClick={() => onDrumRoutingChange('clean-looper')}
                  title="Limpo + entra no Looper para gravar batida manual"
                >
                  No Looper
                </button>
                <button
                  type="button"
                  className={drumRouting === 'pedal-chain' ? 'is-active' : ''}
                  onClick={() => onDrumRoutingChange('pedal-chain')}
                  title="Passa a bateria pela pedaleira (efeitos criativos / lo-fi distortion!)"
                >
                  Via FX
                </button>
              </div>
            </div>

            <div className="inst-controls-right">
              <button
                type="button"
                className={`btn-primary-sm ${drumSeqRunning ? 'is-running' : ''}`}
                onClick={onDrumToggleSeq}
              >
                {drumSeqRunning ? <Square size={14} /> : <Play size={14} />}
                <span>{drumSeqRunning ? 'Parar Batida' : 'Tocar Batida'}</span>
              </button>

              <div className="octave-box">
                <button type="button" className="btn-step" onClick={() => onDrumBpmChange(Math.max(50, drumBpm - 2))}>
                  -
                </button>
                <span>{drumBpm} BPM</span>
                <button type="button" className="btn-step" onClick={() => onDrumBpmChange(Math.min(220, drumBpm + 2))}>
                  +
                </button>
              </div>

              <label className="vol-slider-label">
                <Volume2 size={14} />
                <input
                  type="range"
                  min={0}
                  max={110}
                  value={Math.round(drumVolume * 100)}
                  onChange={(e) => onDrumVolumeChange(Number(e.target.value) / 100)}
                />
              </label>
            </div>
          </div>

          {/* 8 Drum Pads */}
          <div className="drum-pads-grid">
            {DRUM_PADS.map((pad) => {
              const isLit = litPads.has(pad.id);
              return (
                <button
                  key={pad.id}
                  type="button"
                  className={`drum-pad ${isLit ? 'is-hit' : ''}`}
                  style={{
                    borderColor: isLit ? pad.color : 'rgba(148,163,184,0.2)',
                    boxShadow: isLit ? `0 0 22px ${pad.color}66, inset 0 0 18px ${pad.color}44` : undefined
                  }}
                  onPointerDown={(e) => {
                    e.preventDefault();
                    flashPad(pad.id);
                    onDrumTrigger(pad.id, 0.95);
                  }}
                >
                  <span className="drum-pad-key" style={{ color: pad.color }}>
                    {pad.key}
                  </span>
                  <strong>{pad.short}</strong>
                  <span className="drum-pad-sub">{pad.name}</span>
                </button>
              );
            })}
          </div>

          {/* 16-Step Sequencer */}
          <div className="sequencer-box">
            <div className="sequencer-bar">
              <span className="section-eyebrow">SEQUENCIADOR DE 16 PASSOS (MONTE SUA BATIDA E TOQUE POR CIMA)</span>
              <div className="groove-btns">
                {Object.entries(DRUM_GROOVES).map(([key, g]) => (
                  <button
                    key={key}
                    type="button"
                    className="btn-chip"
                    onClick={() => onDrumLoadGroove(key)}
                  >
                    {g.label}
                  </button>
                ))}
                <button
                  type="button"
                  className="btn-chip is-danger"
                  onClick={() => onDrumPatternChange(createEmptyPattern())}
                  title="Limpar todos os passos"
                >
                  <Trash2 size={12} />
                  <span>Limpar</span>
                </button>
              </div>
            </div>

            <div className="seq-grid">
              {DRUM_PADS.map((pad) => (
                <div key={pad.id} className="seq-row">
                  <button
                    type="button"
                    className="seq-row-label"
                    onClick={() => {
                      flashPad(pad.id);
                      onDrumTrigger(pad.id, 0.9);
                    }}
                  >
                    <span className="seq-dot" style={{ backgroundColor: pad.color }} />
                    <span>{pad.short}</span>
                  </button>
                  <div className="seq-steps">
                    {drumPattern[pad.id].map((isOn, stepIdx) => {
                      const isPlayhead = drumSeqRunning && drumCurrentStep === stepIdx;
                      const isBeatStart = stepIdx % 4 === 0;
                      return (
                        <button
                          key={stepIdx}
                          type="button"
                          className={`seq-cell ${isOn ? 'is-on' : ''} ${isBeatStart ? 'is-beat' : ''} ${isPlayhead ? 'is-now' : ''}`}
                          style={isOn ? { backgroundColor: pad.color, borderColor: pad.color } : undefined}
                          onClick={() => toggleStep(pad.id, stepIdx)}
                          title={`${pad.name} — Passo ${stepIdx + 1}`}
                        />
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
