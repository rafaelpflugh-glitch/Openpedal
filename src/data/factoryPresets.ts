import { DriveMode, PedalId, Preset, RigState } from '../types/pedalboard';

export const DEFAULT_CHAIN_ORDER: PedalId[] = [
  'gate',
  'compressor',
  'wah',
  'octaver',
  'drive',
  'fuzz',
  'eq',
  'phaser',
  'tremolo',
  'chorus',
  'delay',
  'reverb'
];

export function createBaseRig(overrides?: Partial<RigState>): RigState {
  const base: RigState = {
    chainOrder: [...DEFAULT_CHAIN_ORDER],
    pedals: {
      gate: {
        id: 'gate',
        enabled: true,
        params: {
          threshold: -56,
          release: 0.14,
          humFilter60Hz: true
        }
      },
      compressor: {
        id: 'compressor',
        enabled: false,
        params: {
          threshold: -28,
          ratio: 5,
          attack: 0.008,
          makeup: 5
        }
      },
      wah: {
        id: 'wah',
        enabled: false,
        params: {
          mode: 'auto-env',
          position: 62,
          q: 5.5,
          range: 82
        }
      },
      octaver: {
        id: 'octaver',
        enabled: false,
        params: {
          dry: 85,
          sub: 65,
          octUp: 25
        }
      },
      drive: {
        id: 'drive',
        enabled: false,
        params: {
          mode: 'klon',
          drive: 55,
          tone: 62,
          level: 72
        }
      },
      fuzz: {
        id: 'fuzz',
        enabled: false,
        params: {
          mode: 'big-muff',
          sustain: 78,
          tone: 55,
          level: 72
        }
      },
      eq: {
        id: 'eq',
        enabled: false,
        params: {
          band100: 0,
          band250: 0,
          band800: 0,
          band2000: 0,
          band4000: 0,
          level: 0
        }
      },
      phaser: {
        id: 'phaser',
        enabled: false,
        params: {
          rate: 0.65,
          depth: 78,
          feedback: 58,
          mix: 62
        }
      },
      tremolo: {
        id: 'tremolo',
        enabled: false,
        params: {
          wave: 'sine',
          rate: 4.2,
          depth: 68
        }
      },
      chorus: {
        id: 'chorus',
        enabled: false,
        params: {
          rate: 1.1,
          depth: 64,
          mix: 55
        }
      },
      delay: {
        id: 'delay',
        enabled: false,
        params: {
          timeMs: 360,
          feedback: 42,
          tone: 56,
          mix: 40
        }
      },
      reverb: {
        id: 'reverb',
        enabled: true,
        params: {
          decay: 2.3,
          dampening: 40,
          mix: 34
        }
      }
    },
    ampCab: {
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
    },
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
 * Safely migrates any older saved user presets (e.g. from v1 with 7 pedals or old drive modes)
 * into the full 12-pedal RigState without breaking localStorage data.
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

  // Migrate legacy drive mode names ('tube-od' -> 'ts9', 'crunch' -> 'ds1', 'metal-fuzz' -> 'rat')
  const rawMode = (mergedPedals.drive.params.mode as unknown as string) || 'klon';
  const legacyMap: Record<string, DriveMode> = {
    'tube-od': 'ts9',
    crunch: 'ds1',
    'metal-fuzz': 'rat'
  };
  if (legacyMap[rawMode]) {
    mergedPedals.drive.params.mode = legacyMap[rawMode];
  }

  // Ensure all 12 pedals exist in chainOrder
  const existingOrder = Array.isArray(raw.chainOrder)
    ? raw.chainOrder.filter((id): id is PedalId => DEFAULT_CHAIN_ORDER.includes(id))
    : [];
  const missing = DEFAULT_CHAIN_ORDER.filter((id) => !existingOrder.includes(id));
  const chainOrder = existingOrder.length === DEFAULT_CHAIN_ORDER.length
    ? existingOrder
    : [...DEFAULT_CHAIN_ORDER];
  if (existingOrder.length > 0 && missing.length === 0) {
    // keep user order
  }

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

export const FACTORY_PRESETS: Preset[] = [
  {
    id: 'factory-clean-studio',
    name: 'Clean Studio',
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
          params: { rate: 0.9, depth: 62, mix: 58 }
        },
        reverb: {
          id: 'reverb',
          enabled: true,
          params: { decay: 2.8, dampening: 30, mix: 44 }
        }
      },
      ampCab: {
        ampEnabled: true,
        ampModel: 'clean-twin',
        gain: 22,
        bass: 56,
        mid: 42,
        treble: 70,
        presence: 68,
        master: 78,
        cabEnabled: true,
        cabModel: '2x12-open'
      }
    })
  },
  {
    id: 'factory-klon-blues',
    name: 'Klon Centaur Blues',
    category: 'Blues',
    factory: true,
    rig: createBaseRig({
      pedals: {
        ...createBaseRig().pedals,
        drive: {
          id: 'drive',
          enabled: true,
          params: { mode: 'klon', drive: 68, tone: 64, level: 78 }
        },
        delay: {
          id: 'delay',
          enabled: true,
          params: { timeMs: 260, feedback: 28, tone: 46, mix: 32 }
        },
        reverb: {
          id: 'reverb',
          enabled: true,
          params: { decay: 2.1, dampening: 50, mix: 34 }
        }
      },
      ampCab: {
        ampEnabled: true,
        ampModel: 'british-crunch',
        gain: 42,
        bass: 58,
        mid: 66,
        treble: 62,
        presence: 58,
        master: 76,
        cabEnabled: true,
        cabModel: '1x12-tweed'
      }
    })
  },
  {
    id: 'factory-ds1-rock',
    name: 'DS-1 Grunge Rock',
    category: 'Rock',
    factory: true,
    rig: createBaseRig({
      pedals: {
        ...createBaseRig().pedals,
        gate: {
          id: 'gate',
          enabled: true,
          params: { threshold: -52, release: 0.12, humFilter60Hz: true }
        },
        drive: {
          id: 'drive',
          enabled: true,
          params: { mode: 'ds1', drive: 78, tone: 60, level: 74 }
        },
        chorus: {
          id: 'chorus',
          enabled: true,
          params: { rate: 1.4, depth: 50, mix: 36 }
        },
        delay: {
          id: 'delay',
          enabled: true,
          params: { timeMs: 360, feedback: 34, tone: 52, mix: 28 }
        },
        reverb: {
          id: 'reverb',
          enabled: true,
          params: { decay: 1.8, dampening: 48, mix: 26 }
        }
      },
      ampCab: {
        ampEnabled: true,
        ampModel: 'british-crunch',
        gain: 68,
        bass: 62,
        mid: 60,
        treble: 68,
        presence: 66,
        master: 74,
        cabEnabled: true,
        cabModel: '4x12-v30'
      }
    })
  },
  {
    id: 'factory-big-muff',
    name: 'Big Muff Gilmour',
    category: 'Fuzz',
    factory: true,
    rig: createBaseRig({
      pedals: {
        ...createBaseRig().pedals,
        drive: {
          id: 'drive',
          enabled: true,
          params: { mode: 'klon', drive: 32, tone: 68, level: 82 }
        },
        fuzz: {
          id: 'fuzz',
          enabled: true,
          params: { mode: 'big-muff', sustain: 86, tone: 58, level: 76 }
        },
        phaser: {
          id: 'phaser',
          enabled: true,
          params: { rate: 0.45, depth: 75, feedback: 55, mix: 52 }
        },
        delay: {
          id: 'delay',
          enabled: true,
          params: { timeMs: 440, feedback: 48, tone: 50, mix: 44 }
        },
        reverb: {
          id: 'reverb',
          enabled: true,
          params: { decay: 3.6, dampening: 34, mix: 44 }
        }
      },
      ampCab: {
        ampEnabled: true,
        ampModel: 'clean-twin',
        gain: 34,
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
    id: 'factory-fuzz-face',
    name: 'Fuzz Face + Wah',
    category: 'Psychedelic',
    factory: true,
    rig: createBaseRig({
      pedals: {
        ...createBaseRig().pedals,
        wah: {
          id: 'wah',
          enabled: true,
          params: { mode: 'auto-env', position: 68, q: 6.2, range: 86 }
        },
        octaver: {
          id: 'octaver',
          enabled: true,
          params: { dry: 85, sub: 45, octUp: 55 }
        },
        fuzz: {
          id: 'fuzz',
          enabled: true,
          params: { mode: 'fuzz-face', sustain: 82, tone: 56, level: 78 }
        },
        tremolo: {
          id: 'tremolo',
          enabled: true,
          params: { wave: 'sine', rate: 4.5, depth: 58 }
        },
        reverb: {
          id: 'reverb',
          enabled: true,
          params: { decay: 2.4, dampening: 45, mix: 34 }
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
    id: 'factory-modern-metal',
    name: 'TS9 Modern Metal',
    category: 'High Gain',
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
          params: { mode: 'ts9', drive: 28, tone: 76, level: 88 }
        },
        eq: {
          id: 'eq',
          enabled: true,
          params: { band100: 4.5, band250: -3, band800: -5.5, band2000: 4, band4000: 3.5, level: 0 }
        },
        reverb: {
          id: 'reverb',
          enabled: true,
          params: { decay: 1.1, dampening: 62, mix: 16 }
        }
      },
      ampCab: {
        ampEnabled: true,
        ampModel: 'modern-metal',
        gain: 88,
        bass: 68,
        mid: 36,
        treble: 74,
        presence: 76,
        master: 72,
        cabEnabled: true,
        cabModel: '4x12-v30'
      }
    })
  },
  {
    id: 'factory-ambient',
    name: 'Ambient Catedral',
    category: 'Ambient',
    factory: true,
    rig: createBaseRig({
      pedals: {
        ...createBaseRig().pedals,
        compressor: {
          id: 'compressor',
          enabled: true,
          params: { threshold: -32, ratio: 5.5, attack: 0.008, makeup: 6 }
        },
        phaser: {
          id: 'phaser',
          enabled: true,
          params: { rate: 0.35, depth: 70, feedback: 52, mix: 45 }
        },
        chorus: {
          id: 'chorus',
          enabled: true,
          params: { rate: 0.55, depth: 82, mix: 68 }
        },
        delay: {
          id: 'delay',
          enabled: true,
          params: { timeMs: 470, feedback: 64, tone: 52, mix: 65 }
        },
        reverb: {
          id: 'reverb',
          enabled: true,
          params: { decay: 5.8, dampening: 24, mix: 76 }
        }
      },
      ampCab: {
        ampEnabled: true,
        ampModel: 'clean-twin',
        gain: 18,
        bass: 52,
        mid: 44,
        treble: 68,
        presence: 66,
        master: 76,
        cabEnabled: true,
        cabModel: '2x12-open'
      }
    })
  },
  {
    id: 'factory-amp-pedals',
    name: 'Pedais p/ Amp',
    category: 'Para Amplificador',
    factory: true,
    rig: createBaseRig({
      outputMode: 'amp-front',
      pedals: {
        ...createBaseRig().pedals,
        gate: {
          id: 'gate',
          enabled: true,
          params: { threshold: -52, release: 0.12, humFilter60Hz: true }
        },
        drive: {
          id: 'drive',
          enabled: true,
          params: { mode: 'klon', drive: 62, tone: 62, level: 76 }
        },
        delay: {
          id: 'delay',
          enabled: true,
          params: { timeMs: 360, feedback: 38, tone: 54, mix: 36 }
        },
        reverb: {
          id: 'reverb',
          enabled: true,
          params: { decay: 2.2, dampening: 46, mix: 30 }
        }
      },
      ampCab: {
        ampEnabled: false,
        ampModel: 'clean-twin',
        gain: 35,
        bass: 50,
        mid: 50,
        treble: 50,
        presence: 50,
        master: 75,
        cabEnabled: false,
        cabModel: '4x12-v30'
      }
    })
  }
];
