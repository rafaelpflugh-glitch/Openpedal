import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  AudioWaveform,
  Cable,
  Guitar,
  Keyboard,
  Mic,
  MicOff,
  Play,
  Power,
  Radio,
  Settings,
  Square,
  Volume2
} from 'lucide-react';
import { AudioDeviceList, FX_LOOP_SPLIT_INDEX, OpenPedalEngine } from './audio/OpenPedalEngine';
import {
  DRUM_GROOVES,
  DrumKitStyle,
  DrumPadId,
  DrumPattern,
  DrumRouting
} from './audio/drumEngine';
import { IncomingMidiEvent, MidiDeviceSummary, MidiManager } from './audio/midiManager';
import { InstrumentRouting, SynthVoicePreset } from './audio/synthEngine';
import { AmpCabRack } from './components/AmpCabRack';
import { AudioSetupModal } from './components/AudioSetupModal';
import { InstrumentDeck, InstrumentTab } from './components/InstrumentDeck';
import { LooperDeck } from './components/LooperDeck';
import { MetronomeWidget } from './components/MetronomeWidget';
import { MidiModal } from './components/MidiModal';
import { PEDAL_META, PedalUnit } from './components/PedalUnit';
import { PresetBar } from './components/PresetBar';
import { RotaryKnob } from './components/RotaryKnob';
import { TunerBar } from './components/TunerBar';
import { VuMeter } from './components/VuMeter';
import { FACTORY_PRESETS, migrateRig } from './data/factoryPresets';
import {
  AmpCabState,
  InputChannelMode,
  LooperTelemetry,
  MidiActionTarget,
  MidiBinding,
  OutputMode,
  PedalId,
  PedalParamsMap,
  Preset,
  RigState,
  TestRiffStyle
} from './types/pedalboard';

const STORAGE_PRESETS_KEY = 'openpedal.userPresets.v1';
const STORAGE_MIDI_KEY = 'openpedal.midiBindings.v1';

function cloneRig(rig: RigState): RigState {
  return JSON.parse(JSON.stringify(rig)) as RigState;
}

function loadUserPresets(): Preset[] {
  try {
    const raw = localStorage.getItem(STORAGE_PRESETS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((p: Preset) => ({ ...p, rig: migrateRig(p.rig) }));
  } catch {
    return [];
  }
}

function loadMidiBindings(): MidiBinding[] {
  try {
    const raw = localStorage.getItem(STORAGE_MIDI_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export const App: React.FC = () => {
  const engineRef = useRef<OpenPedalEngine | null>(null);
  if (!engineRef.current) {
    engineRef.current = new OpenPedalEngine();
  }
  const engine = engineRef.current;

  const midiRef = useRef<MidiManager | null>(null);
  if (!midiRef.current) {
    midiRef.current = new MidiManager();
  }

  // Presets & Rig State
  const [userPresets, setUserPresets] = useState<Preset[]>(() => loadUserPresets());
  const allPresets = useMemo(() => [...FACTORY_PRESETS, ...userPresets], [userPresets]);
  const [activePresetId, setActivePresetId] = useState<string>(FACTORY_PRESETS[0].id); // Clean Studio default
  const [rig, setRig] = useState<RigState>(() => cloneRig(FACTORY_PRESETS[0].rig));
  const [isDirty, setIsDirty] = useState(false);

  // Audio Engine State
  const [engineReady, setEngineReady] = useState(false);
  const [liveActive, setLiveActive] = useState(false);
  const [devices, setDevices] = useState<AudioDeviceList>({ inputs: [], outputs: [] });
  const [selectedInputId, setSelectedInputId] = useState('');
  const [selectedOutputId, setSelectedOutputId] = useState('');
  const [channelMode, setChannelMode] = useState<InputChannelMode>('left');
  const [audioError, setAudioError] = useState<string | null>(null);
  const [latencyInfo, setLatencyInfo] = useState({ baseLatencyMs: 0, outputLatencyMs: 0, sampleRate: 48000 });

  // Test Guitar & DI
  const [testRiffStyle, setTestRiffStyle] = useState<TestRiffStyle>('clean-arpeggio');
  const [testRiffPlaying, setTestRiffPlaying] = useState(false);
  const [diFileName, setDiFileName] = useState('');
  const [diFilePlaying, setDiFilePlaying] = useState(false);

  // Gate Telemetry
  const [gateIsOpen, setGateIsOpen] = useState(true);

  // Tuner
  const [tunerOpen, setTunerOpen] = useState(false);
  const [tunerMuted, setTunerMuted] = useState(false);

  // Looper
  const [looperTelemetry, setLooperTelemetry] = useState<LooperTelemetry>({
    state: 'idle',
    progress: 0,
    durationSec: 0,
    hasUndo: false,
    layers: 0
  });
  const [looperVolume, setLooperVolume] = useState(0.85);

  // Metronome
  const [metroRunning, setMetroRunning] = useState(false);
  const [metroBpm, setMetroBpm] = useState(110);
  const [metroBeats, setMetroBeats] = useState(4);
  const [metroCurrentBeat, setMetroCurrentBeat] = useState(0);
  const [metroVolume, setMetroVolume] = useState(0.5);

  // Virtual Instrument Deck (Piano / Synth + Electronic Drums)
  const [instrumentOpen, setInstrumentOpen] = useState(false);
  const [instrumentTab, setInstrumentTab] = useState<InstrumentTab>('piano');
  const [pcCaptureEnabled, setPcCaptureEnabled] = useState(true);
  const [synthPreset, setSynthPreset] = useState<SynthVoicePreset>('grand-piano');
  const [synthRouting, setSynthRouting] = useState<InstrumentRouting>('clean-looper');
  const [synthVolume, setSynthVolume] = useState(0.7);
  const [synthOctave, setSynthOctave] = useState(4);
  const [synthSustain, setSynthSustain] = useState(false);

  const [drumKit, setDrumKit] = useState<DrumKitStyle>('acoustic-rock');
  const [drumRouting, setDrumRouting] = useState<DrumRouting>('direct-clean');
  const [drumVolume, setDrumVolume] = useState(0.85);
  const [drumBpm, setDrumBpm] = useState(112);
  const [drumPattern, setDrumPattern] = useState<DrumPattern>(() =>
    JSON.parse(JSON.stringify(DRUM_GROOVES.rock.pattern))
  );
  const [drumSeqRunning, setDrumSeqRunning] = useState(false);
  const [drumCurrentStep, setDrumCurrentStep] = useState(-1);

  // Modals & Drag
  const [audioModalOpen, setAudioModalOpen] = useState(false);
  const [midiModalOpen, setMidiModalOpen] = useState(false);
  const [draggedPedalId, setDraggedPedalId] = useState<PedalId | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // MIDI State
  const [midiDevices, setMidiDevices] = useState<MidiDeviceSummary[]>([]);
  const [midiBindings, setMidiBindings] = useState<MidiBinding[]>(() => loadMidiBindings());
  const [learningAction, setLearningAction] = useState<{ label: string; target: MidiActionTarget } | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 2800);
    return () => window.clearTimeout(t);
  }, [toast]);

  // Persist user presets & MIDI bindings
  useEffect(() => {
    localStorage.setItem(STORAGE_PRESETS_KEY, JSON.stringify(userPresets));
  }, [userPresets]);

  useEffect(() => {
    localStorage.setItem(STORAGE_MIDI_KEY, JSON.stringify(midiBindings));
  }, [midiBindings]);

  // Sync Rig changes to DSP Engine
  useEffect(() => {
    if (engineReady) {
      engine.applyRig(rig);
    }
  }, [rig, engineReady, engine]);

  // Register engine telemetry callbacks
  useEffect(() => {
    engine.setCallbacks({
      onGateStatus: (isOpen) => setGateIsOpen(isOpen),
      onLooperTelemetry: (tel) => setLooperTelemetry(tel),
      onMetronomeBeat: (beat) => setMetroCurrentBeat(beat),
      onDrumStep: (step) => setDrumCurrentStep(step)
    });
  }, [engine]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      engine.dispose();
    };
  }, [engine]);

  const refreshDevices = useCallback(async () => {
    const list = await engine.listDevices();
    setDevices(list);
  }, [engine]);

  const ensureEngineStarted = useCallback(async (): Promise<boolean> => {
    try {
      setAudioError(null);
      if (!engine.isInitialized()) {
        await engine.init(rig);
        engine.setInputChannelMode(channelMode);
        engine.setTestRiffStyle(testRiffStyle);
        engine.looperSetVolume(looperVolume);
        engine.metronomeSetBpm(metroBpm);
        engine.metronomeSetBeats(metroBeats);
        engine.metronomeSetVolume(metroVolume);
        engine.synthSetPreset(synthPreset);
        engine.synthSetVolume(synthVolume);
        engine.synthSetRouting(synthRouting);
        engine.drumSetKit(drumKit);
        engine.drumSetVolume(drumVolume);
        engine.drumSetRouting(drumRouting);
        engine.drumSetBpm(drumBpm);
        engine.drumSetPattern(drumPattern);
        setEngineReady(true);
        setLatencyInfo(engine.getLatencyInfo());
        await refreshDevices();
      }
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao iniciar motor de áudio.';
      setAudioError(message);
      return false;
    }
  }, [
    engine,
    rig,
    channelMode,
    testRiffStyle,
    looperVolume,
    metroBpm,
    metroBeats,
    metroVolume,
    synthPreset,
    synthVolume,
    synthRouting,
    drumKit,
    drumVolume,
    drumRouting,
    drumBpm,
    drumPattern,
    refreshDevices
  ]);

  const handleToggleLiveInput = useCallback(async () => {
    const ok = await ensureEngineStarted();
    if (!ok) return;

    if (liveActive) {
      engine.stopLiveInput();
      setLiveActive(false);
      showToast('Entrada da guitarra desligada');
      return;
    }

    try {
      setAudioError(null);
      await engine.startLiveInput(selectedInputId || undefined);
      setLiveActive(true);
      await refreshDevices();
      showToast('Entrada ao vivo ativa! Ajuste o Ganho de Entrada se necessário.');
    } catch (err) {
      const msg =
        err instanceof Error
          ? `Não foi possível acessar a entrada de áudio: ${err.message}`
          : 'Permissão de microfone/Line-In negada.';
      setAudioError(msg);
      setAudioModalOpen(true);
    }
  }, [ensureEngineStarted, liveActive, engine, selectedInputId, refreshDevices, showToast]);

  const handleSelectInputDevice = async (deviceId: string) => {
    setSelectedInputId(deviceId);
    if (liveActive) {
      try {
        await engine.startLiveInput(deviceId || undefined);
        showToast('Dispositivo de entrada alterado');
      } catch (err) {
        setAudioError(err instanceof Error ? err.message : 'Erro ao trocar dispositivo de entrada');
      }
    }
  };

  const handleSelectOutputDevice = async (deviceId: string) => {
    setSelectedOutputId(deviceId);
    const ok = await ensureEngineStarted();
    if (!ok) return;
    try {
      const supported = await engine.setOutputDevice(deviceId);
      if (supported) {
        showToast('Saída de áudio atualizada');
      } else {
        showToast('Troca de saída direta não suportada neste navegador — use o mixer do Windows');
      }
    } catch (err) {
      setAudioError(err instanceof Error ? err.message : 'Erro ao alterar saída de áudio');
    }
  };

  const handleChannelModeChange = (mode: InputChannelMode) => {
    setChannelMode(mode);
    engine.setInputChannelMode(mode);
  };

  // Test Guitar controls
  const handleToggleTestRiff = useCallback(async () => {
    const ok = await ensureEngineStarted();
    if (!ok) return;

    if (testRiffPlaying) {
      engine.stopTestRiff();
      setTestRiffPlaying(false);
    } else {
      engine.setTestRiffStyle(testRiffStyle);
      engine.startTestRiff();
      setTestRiffPlaying(true);
      setDiFilePlaying(false);
      showToast('Tocando guitarra de teste interna — experimente os pedais e presets!');
    }
  }, [ensureEngineStarted, testRiffPlaying, engine, testRiffStyle, showToast]);

  const handleTestRiffStyleChange = (style: TestRiffStyle) => {
    setTestRiffStyle(style);
    engine.setTestRiffStyle(style);
  };

  const handleUploadDiFile = async (file: File) => {
    const ok = await ensureEngineStarted();
    if (!ok) return;
    try {
      const name = await engine.loadDiFile(file);
      setDiFileName(name);
      engine.startDiFile();
      setDiFilePlaying(true);
      setTestRiffPlaying(false);
      showToast(`Áudio DI carregado: ${name}`);
    } catch {
      setAudioError('Não foi possível decodificar o arquivo de áudio. Tente .WAV ou .MP3.');
    }
  };

  const handleToggleDiFile = () => {
    if (diFilePlaying) {
      engine.stopDiFile();
      setDiFilePlaying(false);
    } else {
      engine.startDiFile();
      setDiFilePlaying(true);
      setTestRiffPlaying(false);
    }
  };

  // Pedal & Amp Mutations
  const handleTogglePedal = useCallback((id: PedalId) => {
    setRig((prev) => ({
      ...prev,
      pedals: {
        ...prev.pedals,
        [id]: {
          ...prev.pedals[id],
          enabled: !prev.pedals[id].enabled
        }
      }
    }));
    setIsDirty(true);
  }, []);

  const handlePedalParamChange = useCallback(
    <K extends PedalId>(id: K, patch: Partial<PedalParamsMap[K]>) => {
      setRig((prev) => ({
        ...prev,
        pedals: {
          ...prev.pedals,
          [id]: {
            ...prev.pedals[id],
            params: {
              ...prev.pedals[id].params,
              ...patch
            }
          }
        }
      }));
      setIsDirty(true);
    },
    []
  );

  const handleMovePedal = useCallback((fromIdx: number, toIdx: number) => {
    setRig((prev) => {
      if (toIdx < 0 || toIdx >= prev.chainOrder.length) return prev;
      const next = [...prev.chainOrder];
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      return { ...prev, chainOrder: next };
    });
    setIsDirty(true);
  }, []);

  const handleDropPedal = useCallback(
    (targetId: PedalId) => {
      if (!draggedPedalId || draggedPedalId === targetId) return;
      setRig((prev) => {
        const fromIdx = prev.chainOrder.indexOf(draggedPedalId);
        const toIdx = prev.chainOrder.indexOf(targetId);
        if (fromIdx === -1 || toIdx === -1) return prev;
        const next = [...prev.chainOrder];
        const [moved] = next.splice(fromIdx, 1);
        next.splice(toIdx, 0, moved);
        return { ...prev, chainOrder: next };
      });
      setDraggedPedalId(null);
      setIsDirty(true);
    },
    [draggedPedalId]
  );

  const handleAmpCabChange = useCallback((patch: Partial<AmpCabState>) => {
    setRig((prev) => ({
      ...prev,
      ampCab: { ...prev.ampCab, ...patch }
    }));
    setIsDirty(true);
  }, []);

  const handleOutputModeChange = useCallback(
    (mode: OutputMode) => {
      setRig((prev) => ({ ...prev, outputMode: mode }));
      setIsDirty(true);
      const label =
        mode === 'home-theater'
          ? 'Modo Home Theater / Fones (Cab Sim ATIVO)'
          : mode === 'amp-return'
          ? 'Modo Amp FX Return (Cab Sim DESLIGADO)'
          : 'Modo Frente do Amp (Apenas Pedais)';
      showToast(label);
    },
    [showToast]
  );

  const cycleOutputMode = useCallback(() => {
    const order: OutputMode[] = ['home-theater', 'amp-return', 'amp-front'];
    setRig((prev) => {
      const next = order[(order.indexOf(prev.outputMode) + 1) % order.length];
      showToast(
        next === 'home-theater'
          ? 'Saída: Home Theater / Fones (Cab Sim ON)'
          : next === 'amp-return'
          ? 'Saída: Amp FX Return (Cab Sim OFF)'
          : 'Saída: Frente do Amp (Só Pedais)'
      );
      return { ...prev, outputMode: next };
    });
    setIsDirty(true);
  }, [showToast]);

  const handleLoadCustomIr = async (file: File) => {
    const ok = await ensureEngineStarted();
    if (!ok) return;
    try {
      const name = await engine.loadCustomCabIR(file);
      handleAmpCabChange({ cabModel: 'custom-ir', customIrName: name, cabEnabled: true });
      showToast(`Impulse Response carregado: ${name}`);
    } catch {
      setAudioError('Erro ao carregar o arquivo IR .wav.');
    }
  };

  // Presets handlers
  const handleSelectPreset = useCallback(
    (preset: Preset) => {
      setActivePresetId(preset.id);
      setRig(cloneRig(preset.rig));
      setIsDirty(false);
      showToast(`Preset: ${preset.name}`);
    },
    [showToast]
  );

  const handleSaveCurrentPreset = () => {
    setUserPresets((prev) =>
      prev.map((p) => (p.id === activePresetId ? { ...p, rig: cloneRig(rig) } : p))
    );
    setIsDirty(false);
    showToast('Preset atualizado!');
  };

  const handleSaveAsNewPreset = (name: string) => {
    const created: Preset = {
      id: `user-${Date.now()}`,
      name,
      category: 'Personalizado',
      factory: false,
      rig: cloneRig(rig)
    };
    setUserPresets((prev) => [...prev, created]);
    setActivePresetId(created.id);
    setIsDirty(false);
    showToast(`Preset "${name}" salvo!`);
  };

  const handleDeletePreset = (id: string) => {
    setUserPresets((prev) => prev.filter((p) => p.id !== id));
    if (activePresetId === id) {
      handleSelectPreset(FACTORY_PRESETS[0]);
    }
    showToast('Preset excluído');
  };

  const handleExportPresets = () => {
    const payload = JSON.stringify({ version: 1, presets: userPresets, currentRig: rig }, null, 2);
    const blob = new Blob([payload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'openpedal-presets.json';
    a.click();
    URL.revokeObjectURL(url);
    showToast('Presets exportados (.json)');
  };

  const handleImportPresets = async (file: File) => {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed.presets)) {
        const imported: Preset[] = parsed.presets.map((p: Preset, idx: number) => ({
          ...p,
          id: `imp-${Date.now()}-${idx}`,
          factory: false,
          rig: migrateRig(p.rig)
        }));
        setUserPresets((prev) => [...prev, ...imported]);
        showToast(`${imported.length} preset(s) importado(s)!`);
      } else if (parsed.currentRig) {
        setRig(migrateRig(parsed.currentRig));
        setIsDirty(true);
        showToast('Rig importado com sucesso!');
      }
    } catch {
      showToast('Arquivo JSON inválido');
    }
  };

  // Tuner
  const handleToggleTuner = useCallback(async () => {
    if (!tunerOpen) {
      await ensureEngineStarted();
      setTunerOpen(true);
    } else {
      setTunerOpen(false);
      setTunerMuted(false);
      engine.setTunerMute(false);
    }
  }, [tunerOpen, ensureEngineStarted, engine]);

  const handleToggleTunerMute = () => {
    const next = !tunerMuted;
    setTunerMuted(next);
    engine.setTunerMute(next);
  };

  // Looper
  const handleLooperStomp = useCallback(async () => {
    const ok = await ensureEngineStarted();
    if (!ok) return;
    engine.looperStomp();
  }, [ensureEngineStarted, engine]);

  const handleLooperStop = useCallback(() => engine.looperStop(), [engine]);
  const handleLooperUndo = useCallback(() => engine.looperUndo(), [engine]);
  const handleLooperClear = useCallback(() => engine.looperClear(), [engine]);
  const handleLooperVolume = useCallback(
    (vol: number) => {
      setLooperVolume(vol);
      engine.looperSetVolume(vol);
    },
    [engine]
  );

  // Metronome
  const handleToggleMetronome = useCallback(async () => {
    const ok = await ensureEngineStarted();
    if (!ok) return;
    if (metroRunning) {
      engine.metronomeStop();
      setMetroRunning(false);
    } else {
      engine.metronomeSetBpm(metroBpm);
      engine.metronomeSetBeats(metroBeats);
      engine.metronomeSetVolume(metroVolume);
      engine.metronomeStart();
      setMetroRunning(true);
    }
  }, [ensureEngineStarted, metroRunning, engine, metroBpm, metroBeats, metroVolume]);

  const handleMetroBpm = (bpm: number) => {
    setMetroBpm(bpm);
    engine.metronomeSetBpm(bpm);
  };

  const handleMetroBeats = (beats: number) => {
    setMetroBeats(beats);
    engine.metronomeSetBeats(beats);
  };

  const handleMetroVolume = (vol: number) => {
    setMetroVolume(vol);
    engine.metronomeSetVolume(vol);
  };

  // Virtual Instrument handlers (Piano / Synth + Electronic Drums)
  const handleSynthNoteOn = useCallback(
    async (midi: number, velocity = 0.85) => {
      const ok = await ensureEngineStarted();
      if (!ok) return;
      engine.synthNoteOn(midi, velocity);
    },
    [ensureEngineStarted, engine]
  );

  const handleSynthNoteOff = useCallback(
    (midi: number) => {
      engine.synthNoteOff(midi);
    },
    [engine]
  );

  const handleSynthPresetChange = (preset: SynthVoicePreset) => {
    setSynthPreset(preset);
    engine.synthSetPreset(preset);
  };

  const handleSynthRoutingChange = (routing: InstrumentRouting) => {
    setSynthRouting(routing);
    engine.synthSetRouting(routing);
    showToast(
      routing === 'pedal-chain'
        ? 'Teclado roteado pela Pedaleira (FX + Amp + Looper)'
        : 'Teclado em saída limpa + Looper'
    );
  };

  const handleSynthVolumeChange = (vol: number) => {
    setSynthVolume(vol);
    engine.synthSetVolume(vol);
  };

  const handleSynthSustainChange = useCallback(
    (active: boolean) => {
      setSynthSustain(active);
      engine.synthSetSustain(active);
    },
    [engine]
  );

  const handleDrumTrigger = useCallback(
    async (pad: DrumPadId, velocity = 0.92) => {
      const ok = await ensureEngineStarted();
      if (!ok) return;
      engine.drumTrigger(pad, velocity);
    },
    [ensureEngineStarted, engine]
  );

  const handleDrumKitChange = (kit: DrumKitStyle) => {
    setDrumKit(kit);
    engine.drumSetKit(kit);
  };

  const handleDrumRoutingChange = (routing: DrumRouting) => {
    setDrumRouting(routing);
    engine.drumSetRouting(routing);
    showToast(
      routing === 'pedal-chain'
        ? 'Bateria roteada pela Pedaleira (FX)'
        : routing === 'clean-looper'
        ? 'Bateria limpa entrando no Looper'
        : 'Bateria limpa direto na saída (Base)'
    );
  };

  const handleDrumVolumeChange = (vol: number) => {
    setDrumVolume(vol);
    engine.drumSetVolume(vol);
  };

  const handleDrumBpmChange = (bpm: number) => {
    setDrumBpm(bpm);
    engine.drumSetBpm(bpm);
  };

  const handleDrumPatternChange = (nextPattern: DrumPattern) => {
    setDrumPattern(nextPattern);
    engine.drumSetPattern(nextPattern);
  };

  const handleDrumToggleSeq = async () => {
    const ok = await ensureEngineStarted();
    if (!ok) return;
    if (drumSeqRunning) {
      engine.drumStopSequencer();
      setDrumSeqRunning(false);
      setDrumCurrentStep(-1);
    } else {
      engine.drumSetBpm(drumBpm);
      engine.drumSetPattern(drumPattern);
      engine.drumStartSequencer();
      setDrumSeqRunning(true);
    }
  };

  const handleDrumLoadGroove = (grooveKey: string) => {
    const g = DRUM_GROOVES[grooveKey];
    if (!g) return;
    const cloned: DrumPattern = JSON.parse(JSON.stringify(g.pattern));
    setDrumPattern(cloned);
    setDrumBpm(g.bpm);
    setDrumKit(g.kit);
    engine.drumSetPattern(cloned);
    engine.drumSetBpm(g.bpm);
    engine.drumSetKit(g.kit);
    showToast(`Groove carregado: ${g.label} (${g.bpm} BPM)`);
  };

  // Execute MIDI Action
  const executeMidiTarget = useCallback(
    (target: MidiActionTarget) => {
      if (target.type === 'pedal') {
        handleTogglePedal(target.pedalId);
      } else if (target.type === 'preset') {
        const p = allPresets[target.index];
        if (p) handleSelectPreset(p);
      } else if (target.type === 'looper-stomp') {
        handleLooperStomp();
      } else if (target.type === 'looper-stop') {
        handleLooperStop();
      } else if (target.type === 'output-mode') {
        cycleOutputMode();
      } else if (target.type === 'tuner-toggle') {
        handleToggleTuner();
      }
    },
    [allPresets, handleTogglePedal, handleSelectPreset, handleLooperStomp, handleLooperStop, cycleOutputMode, handleToggleTuner]
  );

  // Wire up Web MIDI
  const midiStateRef = useRef({ learningAction, midiBindings, executeMidiTarget });
  midiStateRef.current = { learningAction, midiBindings, executeMidiTarget };

  useEffect(() => {
    midiRef.current?.init(
      (evt: IncomingMidiEvent) => {
        const { learningAction: learn, midiBindings: binds, executeMidiTarget: exec } = midiStateRef.current;
        if (learn) {
          const targetKey = MidiManager.targetKey(learn.target);
          const newBinding: MidiBinding = {
            id: `midi-${Date.now()}`,
            label: learn.label,
            target: learn.target,
            messageType: evt.messageType,
            channel: evt.channel,
            number: evt.number
          };
          setMidiBindings((prev) => [
            ...prev.filter((b) => MidiManager.targetKey(b.target) !== targetKey),
            newBinding
          ]);
          setLearningAction(null);
          showToast(`MIDI mapeado: ${learn.label} (${MidiManager.formatBinding(newBinding)})`);
          return;
        }

        const matched = binds.filter(
          (b) => b.messageType === evt.messageType && b.channel === evt.channel && b.number === evt.number
        );
        matched.forEach((b) => exec(b.target));
      },
      (devs) => setMidiDevices(devs)
    );
  }, [showToast]);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      const key = e.key.toLowerCase();

      if (key === 'escape' && instrumentOpen && pcCaptureEnabled) {
        e.preventDefault();
        setPcCaptureEnabled(false);
        engine.synthPanic();
        showToast('Teclado voltou para atalhos da pedaleira');
        return;
      }

      // 1-8 Presets always work
      if (key >= '1' && key <= '8') {
        const idx = Number(key) - 1;
        if (allPresets[idx]) {
          e.preventDefault();
          handleSelectPreset(allPresets[idx]);
        }
        return;
      }

      // Spacebar Looper always works (super handy while playing piano/drums!)
      if (e.code === 'Space') {
        e.preventDefault();
        handleLooperStomp();
        return;
      }

      // When PC Keyboard is playing Piano or Drums, skip pedal letter shortcuts
      if (instrumentOpen && pcCaptureEnabled) {
        return;
      }

      // Pedal toggles (12 stompboxes!)
      const shortcutMap: Record<string, PedalId> = {
        q: 'gate',
        w: 'compressor',
        e: 'wah',
        r: 'octaver',
        a: 'drive',
        s: 'fuzz',
        d: 'eq',
        f: 'phaser',
        g: 'tremolo',
        y: 'chorus',
        u: 'delay',
        i: 'reverb'
      };
      if (shortcutMap[key]) {
        e.preventDefault();
        handleTogglePedal(shortcutMap[key]);
        return;
      }

      if (key === 't') {
        e.preventDefault();
        handleToggleTuner();
      } else if (key === 'm') {
        e.preventDefault();
        handleToggleMetronome();
      } else if (key === 'b') {
        e.preventDefault();
        cycleOutputMode();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    allPresets,
    handleSelectPreset,
    handleTogglePedal,
    handleLooperStomp,
    handleToggleTuner,
    handleToggleMetronome,
    cycleOutputMode,
    instrumentOpen,
    pcCaptureEnabled,
    engine,
    showToast
  ]);

  return (
    <div className="app-shell">
      {/* TOP STUDIO HEADER */}
      <header className="top-bar">
        <div className="brand-block">
          <div className="brand-icon">
            <Guitar size={20} />
          </div>
          <div>
            <h1>
              OPEN<span>PEDAL</span>
            </h1>
            <span className="brand-sub">Pedaleira Digital em Tempo Real</span>
          </div>
        </div>

        {/* Quick Audio Controls */}
        <div className="top-center-controls">
          {!engineReady ? (
            <button
              type="button"
              className="btn-power-start"
              onClick={async () => {
                const ok = await ensureEngineStarted();
                if (ok) showToast('Motor de áudio ligado! Clique em "Guitarra Ao Vivo" ou "Testar Riff".');
              }}
            >
              <Power size={16} />
              <span>Ligar Motor de Áudio</span>
            </button>
          ) : (
            <>
              <button
                type="button"
                className={`btn-pill ${liveActive ? 'is-live' : ''}`}
                onClick={handleToggleLiveInput}
                title="Ativar/Desativar entrada do cabo P10→P2 ou Interface USB"
              >
                {liveActive ? <Mic size={15} /> : <MicOff size={15} />}
                <span>{liveActive ? 'Guitarra Ao Vivo' : 'Ligar Guitarra (P2/USB)'}</span>
              </button>

              <button
                type="button"
                className={`btn-pill ${testRiffPlaying ? 'is-amber' : ''}`}
                onClick={handleToggleTestRiff}
                title="Tocar guitarra simulada interna para testar timbres sem plugar"
              >
                {testRiffPlaying ? <Square size={14} /> : <Play size={14} />}
                <span>{testRiffPlaying ? 'Parar Riff' : 'Testar Riff'}</span>
              </button>

              <select
                className="compact-select"
                value={testRiffStyle}
                onChange={(e) => handleTestRiffStyleChange(e.target.value as TestRiffStyle)}
                title="Escolher estilo da guitarra de teste"
              >
                <option value="clean-arpeggio">Riff: Clean Arpejo</option>
                <option value="blues-lick">Riff: Blues c/ Vibrato</option>
                <option value="rock-power">Riff: Rock Power</option>
                <option value="gilmour-lead">Riff: Solo Sustentado (Fuzz)</option>
                <option value="metal-chug">Riff: Metal Palm-Mute</option>
              </select>
            </>
          )}

          <VuMeter engine={engine} active={engineReady} />
        </div>

        {/* Right Controls: Master Vol, Tuner, Audio Setup, MIDI */}
        <div className="top-right-controls">
          <div className="master-vol-inline" title="Volume Master de Saída">
            <Volume2 size={15} className="muted-icon" />
            <RotaryKnob
              label="Master"
              value={rig.masterVolume}
              min={0}
              max={100}
              defaultValue={78}
              unit="%"
              accentColor="#22c55e"
              size={40}
              onChange={(v) => {
                setRig((prev) => ({ ...prev, masterVolume: v }));
                setIsDirty(true);
              }}
            />
          </div>

          <button
            type="button"
            className={`btn-tool ${instrumentOpen ? 'is-active' : ''}`}
            onClick={async () => {
              if (!instrumentOpen) {
                await ensureEngineStarted();
                setInstrumentOpen(true);
                setPcCaptureEnabled(true);
                showToast('Modo Teclado / Bateria aberto! Toque pelas teclas A–L ou clique nos pads.');
              } else {
                setInstrumentOpen(false);
                engine.synthPanic();
              }
            }}
            title="Tocar Piano/Synth ou Bateria Eletrônica pelo teclado do PC"
          >
            <Keyboard size={16} />
            <span>Teclado / Bateria</span>
          </button>

          <button
            type="button"
            className={`btn-tool ${tunerOpen ? 'is-active' : ''}`}
            onClick={handleToggleTuner}
            title="Afinador Cromático (Tecla T)"
          >
            <Activity size={16} />
            <span>Afinador</span>
          </button>

          <button
            type="button"
            className="btn-tool"
            onClick={async () => {
              await ensureEngineStarted();
              await refreshDevices();
              setAudioModalOpen(true);
            }}
            title="Configuração de Áudio, Cabo P10→P2 e Guia Home Theater"
          >
            <Cable size={16} />
            <span>Áudio / P2</span>
          </button>

          <button
            type="button"
            className={`btn-tool ${midiDevices.length > 0 ? 'has-midi' : ''}`}
            onClick={() => setMidiModalOpen(true)}
            title="Controlador MIDI e Atalhos de Teclado"
          >
            <Radio size={16} />
            <span>MIDI{midiDevices.length > 0 ? ` (${midiDevices.length})` : ''}</span>
          </button>
        </div>
      </header>

      {/* PRESET BAR */}
      <PresetBar
        presets={allPresets}
        activePresetId={activePresetId}
        isDirty={isDirty}
        onSelect={handleSelectPreset}
        onSaveCurrent={handleSaveCurrentPreset}
        onSaveAsNew={handleSaveAsNewPreset}
        onDelete={handleDeletePreset}
        onExport={handleExportPresets}
        onImport={handleImportPresets}
      />

      {/* QUICK START BANNER (when engine not yet started) */}
      {!engineReady && (
        <div className="welcome-strip">
          <div className="welcome-text">
            <AudioWaveform size={18} />
            <span>
              <strong>Pronto para tocar:</strong> clique em <strong>Ligar Motor de Áudio</strong> acima para começar — você pode plugar sua guitarra pelo cabo <strong>P10→P2</strong> ou usar o botão <strong>Testar Riff</strong> para ouvir os efeitos imediatamente no Home Theater ou fones!
            </span>
          </div>
          <button
            type="button"
            className="btn-chip is-accent"
            onClick={async () => {
              const ok = await ensureEngineStarted();
              if (ok) {
                engine.setTestRiffStyle(testRiffStyle);
                engine.startTestRiff();
                setTestRiffPlaying(true);
                showToast('Ouvindo guitarra de teste — teste trocar os presets (teclas 1 a 6)!');
              }
            }}
          >
            <Play size={13} />
            <span>Ligar e Ouvir Demo Agora</span>
          </button>
        </div>
      )}

      {/* CHROMATIC TUNER DRAWER */}
      <TunerBar
        engine={engine}
        isOpen={tunerOpen}
        muted={tunerMuted}
        onToggleMute={handleToggleTunerMute}
        onClose={handleToggleTuner}
      />

      {/* VIRTUAL INSTRUMENT DECK: PIANO/SYNTH + ELECTRONIC DRUMS */}
      <InstrumentDeck
        isOpen={instrumentOpen}
        activeTab={instrumentTab}
        pcCaptureEnabled={pcCaptureEnabled}
        onTabChange={(tab) => {
          setInstrumentTab(tab);
          engine.synthPanic();
        }}
        onTogglePcCapture={() => {
          setPcCaptureEnabled((prev) => !prev);
          engine.synthPanic();
        }}
        onClose={() => {
          setInstrumentOpen(false);
          engine.synthPanic();
        }}
        synthPreset={synthPreset}
        synthRouting={synthRouting}
        synthVolume={synthVolume}
        octave={synthOctave}
        sustain={synthSustain}
        onSynthPresetChange={handleSynthPresetChange}
        onSynthRoutingChange={handleSynthRoutingChange}
        onSynthVolumeChange={handleSynthVolumeChange}
        onOctaveChange={setSynthOctave}
        onSustainChange={handleSynthSustainChange}
        onNoteOn={handleSynthNoteOn}
        onNoteOff={handleSynthNoteOff}
        drumKit={drumKit}
        drumRouting={drumRouting}
        drumVolume={drumVolume}
        drumBpm={drumBpm}
        drumPattern={drumPattern}
        drumSeqRunning={drumSeqRunning}
        drumCurrentStep={drumCurrentStep}
        onDrumKitChange={handleDrumKitChange}
        onDrumRoutingChange={handleDrumRoutingChange}
        onDrumVolumeChange={handleDrumVolumeChange}
        onDrumBpmChange={handleDrumBpmChange}
        onDrumTrigger={handleDrumTrigger}
        onDrumPatternChange={handleDrumPatternChange}
        onDrumToggleSeq={handleDrumToggleSeq}
        onDrumLoadGroove={handleDrumLoadGroove}
      />

      {/* MAIN STUDIO WORKSPACE */}
      <main className="studio-main">
        {/* PEDALBOARD SIGNAL CHAIN */}
        <section className="pedalboard-section">
          <div className="section-bar">
            <div>
              <span className="section-eyebrow">CADEIA DE PEDAIS (ARRASTE OU USE AS SETAS PARA REORDENAR)</span>
              <div className="signal-flow-tags">
                <span className="flow-pill">ENTRADA ({liveActive ? 'AO VIVO' : testRiffPlaying ? 'RIFF TESTE' : diFilePlaying ? 'ÁUDIO DI' : 'PRONTO'})</span>
                {rig.chainOrder.slice(0, FX_LOOP_SPLIT_INDEX).map((id) => (
                  <React.Fragment key={id}>
                    <span className="flow-arrow">→</span>
                    <span className={`flow-pill ${rig.pedals[id].enabled ? 'is-on' : ''}`}>
                      {PEDAL_META[id].title}
                    </span>
                  </React.Fragment>
                ))}
                <span className="flow-arrow">→</span>
                <span className="flow-pill is-amp">
                  {rig.outputMode === 'home-theater'
                    ? 'AMP + CAB SIM'
                    : rig.outputMode === 'amp-return'
                    ? 'AMP PRE (FX RET)'
                    : 'AMP BYPASS'}
                </span>
                {rig.chainOrder.slice(FX_LOOP_SPLIT_INDEX).map((id) => (
                  <React.Fragment key={id}>
                    <span className="flow-arrow">→</span>
                    <span className={`flow-pill ${rig.pedals[id].enabled ? 'is-on' : ''}`}>
                      {PEDAL_META[id].title} (ST)
                    </span>
                  </React.Fragment>
                ))}
                <span className="flow-arrow">→</span>
                <span className="flow-pill">LOOPER / SAÍDA</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn-chip"
                onClick={() => {
                  setRig((prev) => {
                    const cleared = { ...prev.pedals };
                    (Object.keys(cleared) as PedalId[]).forEach((pid) => {
                      cleared[pid] = { ...cleared[pid], enabled: false } as never;
                    });
                    return { ...prev, pedals: cleared };
                  });
                  setIsDirty(true);
                  showToast('Todos os pedais em BYPASS — ouvindo apenas guitarra limpa + Amp');
                }}
                title="Desliga todos os pedais para ouvir o sinal limpo e ir ligando um por um"
              >
                <span>Bypass Todos Pedais</span>
              </button>
              <button
                type="button"
                className="btn-chip"
                onClick={async () => {
                  await ensureEngineStarted();
                  await refreshDevices();
                  setAudioModalOpen(true);
                }}
              >
                <Settings size={13} />
                <span>Ganho Entrada: {rig.inputGainDb > 0 ? `+${rig.inputGainDb}` : rig.inputGainDb} dB</span>
              </button>
            </div>
          </div>

          <div className="pedalboard-grid">
            {rig.chainOrder.map((id, idx) => (
              <PedalUnit
                key={id}
                pedal={rig.pedals[id]}
                index={idx}
                total={rig.chainOrder.length}
                gateIsOpen={gateIsOpen}
                onToggle={handleTogglePedal}
                onParamChange={handlePedalParamChange}
                onMove={handleMovePedal}
                onDragStart={(pid) => setDraggedPedalId(pid)}
                onDropOn={handleDropPedal}
              />
            ))}
          </div>
        </section>

        {/* AMP + CABINET SIMULATOR + OUTPUT MODE */}
        <AmpCabRack
          ampCab={rig.ampCab}
          outputMode={rig.outputMode}
          onAmpCabChange={handleAmpCabChange}
          onOutputModeChange={handleOutputModeChange}
          onLoadCustomIr={handleLoadCustomIr}
        />

        {/* BOTTOM UTILITY DECK: LOOPER + METRONOME */}
        <section className="utility-grid">
          <LooperDeck
            telemetry={looperTelemetry}
            volume={looperVolume}
            engineReady={engineReady}
            onStomp={handleLooperStomp}
            onStop={handleLooperStop}
            onUndo={handleLooperUndo}
            onClear={handleLooperClear}
            onVolumeChange={handleLooperVolume}
          />
          <MetronomeWidget
            running={metroRunning}
            bpm={metroBpm}
            beatsPerBar={metroBeats}
            currentBeat={metroCurrentBeat}
            volume={metroVolume}
            engineReady={engineReady}
            onToggle={handleToggleMetronome}
            onBpmChange={handleMetroBpm}
            onBeatsChange={handleMetroBeats}
            onVolumeChange={handleMetroVolume}
          />
        </section>
      </main>

      {/* MODALS */}
      <AudioSetupModal
        isOpen={audioModalOpen}
        onClose={() => setAudioModalOpen(false)}
        engineReady={engineReady}
        liveActive={liveActive}
        devices={devices}
        selectedInputId={selectedInputId}
        selectedOutputId={selectedOutputId}
        channelMode={channelMode}
        inputGainDb={rig.inputGainDb}
        latencyInfo={latencyInfo}
        testRiffPlaying={testRiffPlaying}
        testRiffStyle={testRiffStyle}
        diFileName={diFileName}
        diFilePlaying={diFilePlaying}
        errorMsg={audioError}
        onRefreshDevices={refreshDevices}
        onSelectInput={handleSelectInputDevice}
        onSelectOutput={handleSelectOutputDevice}
        onChannelModeChange={handleChannelModeChange}
        onInputGainChange={(db) => {
          setRig((prev) => ({ ...prev, inputGainDb: db }));
          setIsDirty(true);
        }}
        onToggleLiveInput={handleToggleLiveInput}
        onTestRiffStyleChange={handleTestRiffStyleChange}
        onToggleTestRiff={handleToggleTestRiff}
        onUploadDiFile={handleUploadDiFile}
        onToggleDiFile={handleToggleDiFile}
      />

      <MidiModal
        isOpen={midiModalOpen}
        onClose={() => {
          setLearningAction(null);
          setMidiModalOpen(false);
        }}
        supported={midiRef.current.isSupported()}
        devices={midiDevices}
        bindings={midiBindings}
        learningTargetKey={learningAction ? MidiManager.targetKey(learningAction.target) : null}
        onStartLearn={(label, target) => setLearningAction({ label, target })}
        onCancelLearn={() => setLearningAction(null)}
        onRemoveBinding={(id) => setMidiBindings((prev) => prev.filter((b) => b.id !== id))}
      />

      {/* TOAST */}
      {toast && <div className="toast-pill">{toast}</div>}
    </div>
  );
};
