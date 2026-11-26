import {
  AmpCabState,
  DriveMode,
  PedalId,
  PedalParamsMap,
  Preset,
  RigState
} from '../types/pedalboard';

export const DEFAULT_CHAIN_ORDER: PedalId[] = [
  'gate',
  'compressor',
  'wah',
  'whammy',
  'octaver',
  'drive',
  'fuzz',
  'eq',
  'phaser',
  'flanger',
  'vibe',
  'tremolo',
  'chorus',
  'delay',
  'reverb'
];

export const DEFAULT_PEDAL_PARAMS: PedalParamsMap = {
  gate: { threshold: -56, release: 0.14, humFilter60Hz: true },
  compressor: { threshold: -28, ratio: 5, attack: 0.008, makeup: 5 },
  wah: { mode: 'auto-env', position: 62, q: 5.5, range: 82 },
  whammy: { interval: 'oct-up', pedal: 100, mix: 70 },
  octaver: { dry: 85, sub: 65, octUp: 25 },
  drive: { mode: 'klon', drive: 55, tone: 62, level: 72 },
  fuzz: { mode: 'big-muff', sustain: 78, tone: 55, level: 72 },
  eq: { band100: 0, band250: 0, band800: 0, band2000: 0, band4000: 0, level: 0 },
  phaser: { rate: 0.65, depth: 78, feedback: 58, mix: 62 },
  flanger: { rate: 0.35, depth: 72, feedback: 60, mix: 55 },
  vibe: { mode: 'univibe', speed: 2.2, depth: 76, mix: 72 },
  tremolo: { wave: 'sine', rate: 4.2, depth: 68 },
  chorus: { rate: 1.1, depth: 64, mix: 55 },
  delay: { timeMs: 360, feedback: 42, tone: 56, mix: 40 },
  reverb: { mode: 'hall', decay: 2.3, dampening: 40, mix: 34 }
};

export const DEFAULT_AMP_CAB: AmpCabState = {
  ampEnabled: true,
  ampModel: 'clean-twin',
  gain: 26,
  bass: 54,
  mid: 46,
  treble: 64,
  presence: 60,
  master: 75,
  cabEnabled: true,
  cabModel: '2x12-open'
};

export function getDefaultPedalParams<K extends PedalId>(id: K): PedalParamsMap[K] {
  return JSON.parse(JSON.stringify(DEFAULT_PEDAL_PARAMS[id])) as PedalParamsMap[K];
}

export function createBaseRig(overrides?: Partial<RigState>): RigState {
  const pedals = {} as RigState['pedals'];
  for (const id of DEFAULT_CHAIN_ORDER) {
    pedals[id] = {
      id,
      enabled: id === 'gate' || id === 'reverb',
      params: getDefaultPedalParams(id)
    } as never;
  }

  const base: RigState = {
    chainOrder: [...DEFAULT_CHAIN_ORDER],
    pedals,
    ampCab: { ...DEFAULT_AMP_CAB },
    outputMode: 'home-theater',
    inputGainDb: 0,
    masterVolume: 78
  };

  if (!overrides) return base;
  return {
    ...base,
    ...overrides,
    pedals: {
      ...base.pedals,
      ...(overrides.pedals || {})
    },
    ampCab: {
      ...base.ampCab,
      ...(overrides.ampCab || {})
    }
  };
}

/**
 * Safely migrates any older saved user presets into the 15-pedal RigState.
 */
export function migrateRig(raw: Partial<RigState> | undefined): RigState {
  const base = createBaseRig();
  if (!raw) return base;

  const mergedPedals = { ...base.pedals };
  if (raw.pedals) {
    for (const key of DEFAULT_CHAIN_ORDER) {
      if (raw.pedals[key]) {
        mergedPedals[key] = {
          ...base.pedals[key],
          ...raw.pedals[key],
          params: {
            ...base.pedals[key].params,
            ...(raw.pedals[key].params || {})
          }
        } as never;
      }
    }
  }

  const rawMode = (mergedPedals.drive.params.mode as unknown as string) || 'klon';
  const legacyMap: Record<string, DriveMode> = {
    'tube-od': 'ts9',
    crunch: 'ds1',
    'metal-fuzz': 'rat'
  };
  if (legacyMap[rawMode]) {
    mergedPedals.drive.params.mode = legacyMap[rawMode];
  }

  const existingOrder = Array.isArray(raw.chainOrder)
    ? raw.chainOrder.filter((id): id is PedalId => DEFAULT_CHAIN_ORDER.includes(id))
    : [];
  const chainOrder =
    existingOrder.length === DEFAULT_CHAIN_ORDER.length ? existingOrder : [...DEFAULT_CHAIN_ORDER];

  return {
    ...base,
    ...raw,
    chainOrder,
    pedals: mergedPedals,
    ampCab: {
      ...base.ampCab,
      ...(raw.ampCab || {})
    }
  };
}

/**
 * Primary 8 Factory Presets (quick keys 1–8)
 */
export const FACTORY_PRESETS: Preset[] = [
  {
    id: 'factory-clean-studio',
    name: 'Clean Studio',
    artist: 'Fender Twin Clássico',
    description: 'Limpo cristalino de estúdio com Compressor, Chorus 3D e Hall Reverb.',
    category: 'Clean',
    factory: true,
    rig: createBaseRig({
      pedals: {
        ...createBaseRig().pedals,
        compressor: {
          id: 'compressor',
          enabled: true,
          params: { threshold: -30, ratio: 5, attack: 0.008, makeup: 5.5 }
        },
        chorus: {
          id: 'chorus',
          enabled: true,
          params: { rate: 0.9, depth: 62, mix: 55 }
        },
        reverb: {
          id: 'reverb',
          enabled: true,
          params: { mode: 'hall', decay: 2.6, dampening: 32, mix: 42 }
        }
      },
      ampCab: {
        ampEnabled: true,
        ampModel: 'clean-twin',
        gain: 22,
        bass: 56,
        mid: 42,
        treble: 68,
        presence: 64,
        master: 78,
        cabEnabled: true,
        cabModel: '2x12-open'
      }
    })
  },
  {
    id: 'factory-srv-texas',
    name: 'SRV Texas Blues',
    artist: 'Stevie Ray Vaughan',
    description: 'Tube Screamer TS9 empurrando Clean Twin com Spring Reverb de mola.',
    category: 'Blues',
    factory: true,
    rig: createBaseRig({
      pedals: {
        ...createBaseRig().pedals,
        compressor: {
          id: 'compressor',
          enabled: true,
          params: { threshold: -26, ratio: 4, attack: 0.01, makeup: 4 }
        },
        drive: {
          id: 'drive',
          enabled: true,
          params: { mode: 'ts9', drive: 64, tone: 62, level: 82 }
        },
        reverb: {
          id: 'reverb',
          enabled: true,
          params: { mode: 'spring', decay: 1.9, dampening: 42, mix: 38 }
        }
      },
      ampCab: {
        ampEnabled: true,
        ampModel: 'clean-twin',
        gain: 58,
        bass: 60,
        mid: 64,
        treble: 64,
        presence: 60,
        master: 78,
        cabEnabled: true,
        cabModel: '2x12-open'
      }
    })
  },
  {
    id: 'factory-cobain-ds1',
    name: 'Cobain DS-1 Grunge',
    artist: 'Kurt Cobain (Nirvana)',
    description: 'Boss DS-1 clássico + Chorus Small Clone + Marshall 4x12 V30.',
    category: 'Rock / Grunge',
    factory: true,
    rig: createBaseRig({
      pedals: {
        ...createBaseRig().pedals,
        drive: {
          id: 'drive',
          enabled: true,
          params: { mode: 'ds1', drive: 78, tone: 58, level: 76 }
        },
        chorus: {
          id: 'chorus',
          enabled: true,
          params: { rate: 1.45, depth: 66, mix: 42 }
        },
        reverb: {
          id: 'reverb',
          enabled: true,
          params: { mode: 'hall', decay: 1.5, dampening: 52, mix: 22 }
        }
      },
      ampCab: {
        ampEnabled: true,
        ampModel: 'british-crunch',
        gain: 62,
        bass: 62,
        mid: 58,
        treble: 66,
        presence: 64,
        master: 75,
        cabEnabled: true,
        cabModel: '4x12-v30'
      }
    })
  },
  {
    id: 'factory-gilmour-muff',
    name: 'Gilmour Big Muff',
    artist: 'David Gilmour (Pink Floyd)',
    description: 'Klon empurrando Big Muff Pi + Electric Mistress Flanger + Ping-Pong Delay + Hall.',
    category: 'Fuzz / Solo',
    factory: true,
    rig: createBaseRig({
      pedals: {
        ...createBaseRig().pedals,
        drive: {
          id: 'drive',
          enabled: true,
          params: { mode: 'klon', drive: 34, tone: 66, level: 80 }
        },
        fuzz: {
          id: 'fuzz',
          enabled: true,
          params: { mode: 'big-muff', sustain: 86, tone: 56, level: 76 }
        },
        flanger: {
          id: 'flanger',
          enabled: true,
          params: { rate: 0.25, depth: 64, feedback: 52, mix: 44 }
        },
        delay: {
          id: 'delay',
          enabled: true,
          params: { timeMs: 440, feedback: 48, tone: 50, mix: 44 }
        },
        reverb: {
          id: 'reverb',
          enabled: true,
          params: { mode: 'hall', decay: 3.6, dampening: 34, mix: 42 }
        }
      },
      ampCab: {
        ampEnabled: true,
        ampModel: 'clean-twin',
        gain: 36,
        bass: 64,
        mid: 56,
        treble: 62,
        presence: 58,
        master: 76,
        cabEnabled: true,
        cabModel: '4x12-v30'
      }
    })
  },
  {
    id: 'factory-hendrix-vibe',
    name: 'Hendrix Fuzz + Vibe',
    artist: 'Jimi Hendrix',
    description: 'Cry Auto-Wah + Fuzz Face de germânio + Uni-Vibe pulsante + British Crunch.',
    category: 'Psicodélico',
    factory: true,
    rig: createBaseRig({
      pedals: {
        ...createBaseRig().pedals,
        wah: {
          id: 'wah',
          enabled: true,
          params: { mode: 'auto-env', position: 65, q: 5.8, range: 84 }
        },
        fuzz: {
          id: 'fuzz',
          enabled: true,
          params: { mode: 'fuzz-face', sustain: 82, tone: 56, level: 78 }
        },
        vibe: {
          id: 'vibe',
          enabled: true,
          params: { mode: 'univibe', speed: 2.6, depth: 82, mix: 76 }
        },
        reverb: {
          id: 'reverb',
          enabled: true,
          params: { mode: 'spring', decay: 2.2, dampening: 45, mix: 34 }
        }
      },
      ampCab: {
        ampEnabled: true,
        ampModel: 'british-crunch',
        gain: 58,
        bass: 64,
        mid: 68,
        treble: 60,
        presence: 58,
        master: 75,
        cabEnabled: true,
        cabModel: '4x12-v30'
      }
    })
  },
  {
    id: 'factory-metallica-thrash',
    name: 'Metallica Master',
    artist: 'James Hetfield (Metallica)',
    description: 'Noise Gate firme + TS9 boost + EQ em V (médios cavados) + Modern Metal 4x12.',
    category: 'Metal',
    factory: true,
    rig: createBaseRig({
      pedals: {
        ...createBaseRig().pedals,
        gate: {
          id: 'gate',
          enabled: true,
          params: { threshold: -42, release: 0.055, humFilter60Hz: true }
        },
        drive: {
          id: 'drive',
          enabled: true,
          params: { mode: 'ts9', drive: 26, tone: 74, level: 86 }
        },
        eq: {
          id: 'eq',
          enabled: true,
          params: { band100: 5, band250: -2.5, band800: -7, band2000: 3.5, band4000: 4.5, level: 0 }
        },
        reverb: {
          id: 'reverb',
          enabled: true,
          params: { mode: 'hall', decay: 1.0, dampening: 64, mix: 14 }
        }
      },
      ampCab: {
        ampEnabled: true,
        ampModel: 'modern-metal',
        gain: 86,
        bass: 68,
        mid: 34,
        treble: 74,
        presence: 74,
        master: 72,
        cabEnabled: true,
        cabModel: '4x12-v30'
      }
    })
  },
  {
    id: 'factory-shimmer-cathedral',
    name: 'Shimmer Catedral',
    artist: 'The Edge (U2) / Ambient',
    description: 'Ping-Pong Delay colcheia pontuada + Shimmer Reverb oitavado angelical!',
    category: 'Ambient',
    factory: true,
    rig: createBaseRig({
      pedals: {
        ...createBaseRig().pedals,
        compressor: {
          id: 'compressor',
          enabled: true,
          params: { threshold: -30, ratio: 5, attack: 0.008, makeup: 5.5 }
        },
        chorus: {
          id: 'chorus',
          enabled: true,
          params: { rate: 0.65, depth: 72, mix: 55 }
        },
        delay: {
          id: 'delay',
          enabled: true,
          params: { timeMs: 375, feedback: 58, tone: 62, mix: 56 }
        },
        reverb: {
          id: 'reverb',
          enabled: true,
          params: { mode: 'shimmer', decay: 5.4, dampening: 22, mix: 74 }
        }
      },
      ampCab: {
        ampEnabled: true,
        ampModel: 'clean-twin',
        gain: 20,
        bass: 52,
        mid: 46,
        treble: 70,
        presence: 68,
        master: 76,
        cabEnabled: true,
        cabModel: '2x12-open'
      }
    })
  },
  {
    id: 'factory-amp-pedals',
    name: 'Pedais p/ Amp',
    artist: 'Modo Amplificador Real',
    description: 'Amp & Cab em BYPASS automático — apenas pedais prontos para plugar no seu amplificador.',
    category: 'Para Amplificador',
    factory: true,
    rig: createBaseRig({
      outputMode: 'amp-front',
      pedals: {
        ...createBaseRig().pedals,
        drive: {
          id: 'drive',
          enabled: true,
          params: { mode: 'klon', drive: 62, tone: 62, level: 76 }
        },
        delay: {
          id: 'delay',
          enabled: true,
          params: { timeMs: 360, feedback: 36, tone: 54, mix: 34 }
        },
        reverb: {
          id: 'reverb',
          enabled: true,
          params: { mode: 'spring', decay: 2.0, dampening: 46, mix: 28 }
        }
      },
      ampCab: {
        ...DEFAULT_AMP_CAB,
        ampEnabled: false,
        cabEnabled: false
      }
    })
  }
];

/**
 * Extra Signature Guitarist Library Presets (accessible in the "Timbres Lendários" catalog!)
 */
export const LEGENDARY_EXTRA_PRESETS: Preset[] = [
  {
    id: 'legend-slash',
    name: 'Slash Appetite Rock',
    artist: 'Slash (Guns N\' Roses)',
    description: 'Klon Boost suave + Marshall British Crunch encorpado + 4x12 V30 + Delay curto.',
    category: 'Hard Rock',
    factory: true,
    rig: createBaseRig({
      pedals: {
        ...createBaseRig().pedals,
        drive: {
          id: 'drive',
          enabled: true,
          params: { mode: 'klon', drive: 48, tone: 60, level: 78 }
        },
        delay: {
          id: 'delay',
          enabled: true,
          params: { timeMs: 340, feedback: 28, tone: 48, mix: 24 }
        },
        reverb: {
          id: 'reverb',
          enabled: true,
          params: { mode: 'hall', decay: 1.9, dampening: 48, mix: 26 }
        }
      },
      ampCab: {
        ampEnabled: true,
        ampModel: 'british-crunch',
        gain: 76,
        bass: 64,
        mid: 70,
        treble: 62,
        presence: 62,
        master: 76,
        cabEnabled: true,
        cabModel: '4x12-v30'
      }
    })
  },
  {
    id: 'legend-van-halen',
    name: 'Van Halen Brown Sound',
    artist: 'Eddie Van Halen',
    description: 'Phase 90 lento + ProCo RAT + British Crunch no talo + Flanger jato + Slapback.',
    category: 'Hard Rock',
    factory: true,
    rig: createBaseRig({
      pedals: {
        ...createBaseRig().pedals,
        drive: {
          id: 'drive',
          enabled: true,
          params: { mode: 'rat', drive: 54, tone: 64, level: 74 }
        },
        phaser: {
          id: 'phaser',
          enabled: true,
          params: { rate: 0.42, depth: 78, feedback: 58, mix: 56 }
        },
        flanger: {
          id: 'flanger',
          enabled: true,
          params: { rate: 0.28, depth: 76, feedback: 68, mix: 45 }
        },
        delay: {
          id: 'delay',
          enabled: true,
          params: { timeMs: 295, feedback: 22, tone: 46, mix: 26 }
        },
        reverb: {
          id: 'reverb',
          enabled: true,
          params: { mode: 'hall', decay: 2.2, dampening: 42, mix: 32 }
        }
      },
      ampCab: {
        ampEnabled: true,
        ampModel: 'british-crunch',
        gain: 82,
        bass: 62,
        mid: 68,
        treble: 70,
        presence: 72,
        master: 76,
        cabEnabled: true,
        cabModel: '4x12-v30'
      }
    })
  },
  {
    id: 'legend-frusciante',
    name: 'Frusciante Funk Clean',
    artist: 'John Frusciante (RHCP)',
    description: 'Strat limpa no limite da saturação + Compressor estalado + Chorus sutil + Spring.',
    category: 'Funk / Rock',
    factory: true,
    rig: createBaseRig({
      pedals: {
        ...createBaseRig().pedals,
        compressor: {
          id: 'compressor',
          enabled: true,
          params: { threshold: -28, ratio: 4.5, attack: 0.006, makeup: 5 }
        },
        chorus: {
          id: 'chorus',
          enabled: true,
          params: { rate: 0.85, depth: 48, mix: 36 }
        },
        reverb: {
          id: 'reverb',
          enabled: true,
          params: { mode: 'spring', decay: 1.7, dampening: 44, mix: 34 }
        }
      },
      ampCab: {
        ampEnabled: true,
        ampModel: 'british-crunch',
        gain: 30,
        bass: 56,
        mid: 62,
        treble: 66,
        presence: 62,
        master: 78,
        cabEnabled: true,
        cabModel: '2x12-open'
      }
    })
  },
  {
    id: 'legend-jack-white',
    name: 'Jack White Whammy Fuzz',
    artist: 'Jack White / Tom Morello',
    description: 'Whammy (-1 Oitava de baixo monstro!) + Big Muff Pi rasgado + British Crunch.',
    category: 'Garage / Fuzz',
    factory: true,
    rig: createBaseRig({
      pedals: {
        ...createBaseRig().pedals,
        whammy: {
          id: 'whammy',
          enabled: true,
          params: { interval: 'oct-down', pedal: 100, mix: 92 }
        },
        fuzz: {
          id: 'fuzz',
          enabled: true,
          params: { mode: 'big-muff', sustain: 84, tone: 64, level: 78 }
        },
        reverb: {
          id: 'reverb',
          enabled: true,
          params: { mode: 'spring', decay: 1.5, dampening: 48, mix: 24 }
        }
      },
      ampCab: {
        ampEnabled: true,
        ampModel: 'british-crunch',
        gain: 62,
        bass: 66,
        mid: 64,
        treble: 64,
        presence: 60,
        master: 75,
        cabEnabled: true,
        cabModel: '1x12-tweed'
      }
    })
  },
  {
    id: 'legend-dick-dale',
    name: 'Surf Rock Spring',
    artist: 'Dick Dale / Tarantino',
    description: 'Clean Twin brilhante + Opto-Tremolo vintage + Spring Reverb encharcado!',
    category: 'Surf / Vintage',
    factory: true,
    rig: createBaseRig({
      pedals: {
        ...createBaseRig().pedals,
        tremolo: {
          id: 'tremolo',
          enabled: true,
          params: { wave: 'sine', rate: 5.2, depth: 62 }
        },
        reverb: {
          id: 'reverb',
          enabled: true,
          params: { mode: 'spring', decay: 3.1, dampening: 26, mix: 64 }
        }
      },
      ampCab: {
        ampEnabled: true,
        ampModel: 'clean-twin',
        gain: 30,
        bass: 54,
        mid: 46,
        treble: 76,
        presence: 74,
        master: 78,
        cabEnabled: true,
        cabModel: '2x12-open'
      }
    })
  },
  {
    id: 'legend-bb-king',
    name: 'B.B. King Lucille Tweed',
    artist: 'B.B. King',
    description: 'Klon Centaur cremoso + 1x12 Tweed amadeirado + Reverb de mola sutil.',
    category: 'Blues',
    factory: true,
    rig: createBaseRig({
      pedals: {
        ...createBaseRig().pedals,
        drive: {
          id: 'drive',
          enabled: true,
          params: { mode: 'klon', drive: 44, tone: 58, level: 74 }
        },
        reverb: {
          id: 'reverb',
          enabled: true,
          params: { mode: 'spring', decay: 1.8, dampening: 52, mix: 30 }
        }
      },
      ampCab: {
        ampEnabled: true,
        ampModel: 'clean-twin',
        gain: 42,
        bass: 56,
        mid: 68,
        treble: 58,
        presence: 54,
        master: 78,
        cabEnabled: true,
        cabModel: '1x12-tweed'
      }
    })
  },
  {
    id: 'legend-leslie-organ',
    name: 'Rotary Leslie Clean',
    artist: 'Beatles / Deep Purple',
    description: 'Caixa giratória Rotary (Leslie) estéreo + Klon suave — incrível na guitarra e no Órgão Rock!',
    category: 'Modulação',
    factory: true,
    rig: createBaseRig({
      pedals: {
        ...createBaseRig().pedals,
        drive: {
          id: 'drive',
          enabled: true,
          params: { mode: 'klon', drive: 40, tone: 62, level: 74 }
        },
        vibe: {
          id: 'vibe',
          enabled: true,
          params: { mode: 'rotary', speed: 5.6, depth: 84, mix: 86 }
        },
        reverb: {
          id: 'reverb',
          enabled: true,
          params: { mode: 'hall', decay: 2.4, dampening: 38, mix: 36 }
        }
      },
      ampCab: {
        ampEnabled: true,
        ampModel: 'clean-twin',
        gain: 34,
        bass: 58,
        mid: 58,
        treble: 62,
        presence: 58,
        master: 78,
        cabEnabled: true,
        cabModel: '2x12-open'
      }
    })
  }
];

export const ALL_LEGENDARY_PRESETS: Preset[] = [...FACTORY_PRESETS, ...LEGENDARY_EXTRA_PRESETS];
