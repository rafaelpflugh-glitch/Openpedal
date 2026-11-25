import { Preset, RigState } from '../types/pedalboard';

export const DEFAULT_CHAIN_ORDER = [
  'gate',
  'compressor',
  'drive',
  'eq',
  'chorus',
  'delay',
  'reverb'
] as const;

export function createBaseRig(overrides?: Partial<RigState>): RigState {
  const base: RigState = {
    chainOrder: ['gate', 'compressor', 'drive', 'eq', 'chorus', 'delay', 'reverb'],
    pedals: {
      gate: {
        id: 'gate',
        enabled: true,
        params: {
          threshold: -54,
          release: 0.14,
          humFilter60Hz: true
        }
      },
      compressor: {
        id: 'compressor',
        enabled: false,
        params: {
          threshold: -24,
          ratio: 4,
          attack: 0.012,
          makeup: 4
        }
      },
      drive: {
        id: 'drive',
        enabled: false,
        params: {
          mode: 'tube-od',
          drive: 42,
          tone: 58,
          level: 65
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
      chorus: {
        id: 'chorus',
        enabled: false,
        params: {
          rate: 1.1,
          depth: 45,
          mix: 35
        }
      },
      delay: {
        id: 'delay',
        enabled: false,
        params: {
          timeMs: 360,
          feedback: 34,
          tone: 55,
          mix: 28
        }
      },
      reverb: {
        id: 'reverb',
        enabled: true,
        params: {
          decay: 1.9,
          dampening: 45,
          mix: 26
        }
      }
    },
    ampCab: {
      ampEnabled: true,
      ampModel: 'clean-twin',
      gain: 35,
      bass: 52,
      mid: 50,
      treble: 58,
      presence: 52,
      master: 72,
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
          params: { threshold: -22, ratio: 3.5, attack: 0.015, makeup: 3.5 }
        },
        chorus: {
          id: 'chorus',
          enabled: true,
          params: { rate: 0.85, depth: 38, mix: 30 }
        },
        reverb: {
          id: 'reverb',
          enabled: true,
          params: { decay: 2.2, dampening: 40, mix: 28 }
        }
      },
      ampCab: {
        ampEnabled: true,
        ampModel: 'clean-twin',
        gain: 28,
        bass: 54,
        mid: 48,
        treble: 62,
        presence: 58,
        master: 75,
        cabEnabled: true,
        cabModel: '2x12-open'
      }
    })
  },
  {
    id: 'factory-blues-od',
    name: 'Blues Overdrive',
    category: 'Crunch',
    factory: true,
    rig: createBaseRig({
      pedals: {
        ...createBaseRig().pedals,
        drive: {
          id: 'drive',
          enabled: true,
          params: { mode: 'tube-od', drive: 48, tone: 62, level: 70 }
        },
        delay: {
          id: 'delay',
          enabled: true,
          params: { timeMs: 310, feedback: 24, tone: 45, mix: 20 }
        },
        reverb: {
          id: 'reverb',
          enabled: true,
          params: { decay: 1.7, dampening: 52, mix: 24 }
        }
      },
      ampCab: {
        ampEnabled: true,
        ampModel: 'british-crunch',
        gain: 44,
        bass: 56,
        mid: 64,
        treble: 58,
        presence: 55,
        master: 74,
        cabEnabled: true,
        cabModel: '1x12-tweed'
      }
    })
  },
  {
    id: 'factory-classic-rock',
    name: 'Classic Rock',
    category: 'Rock',
    factory: true,
    rig: createBaseRig({
      pedals: {
        ...createBaseRig().pedals,
        gate: {
          id: 'gate',
          enabled: true,
          params: { threshold: -50, release: 0.12, humFilter60Hz: true }
        },
        drive: {
          id: 'drive',
          enabled: true,
          params: { mode: 'crunch', drive: 62, tone: 58, level: 68 }
        },
        eq: {
          id: 'eq',
          enabled: true,
          params: { band100: 1.5, band250: -1, band800: 2.5, band2000: 2, band4000: 0.5, level: 0 }
        },
        delay: {
          id: 'delay',
          enabled: true,
          params: { timeMs: 380, feedback: 30, tone: 50, mix: 22 }
        },
        reverb: {
          id: 'reverb',
          enabled: true,
          params: { decay: 1.5, dampening: 55, mix: 18 }
        }
      },
      ampCab: {
        ampEnabled: true,
        ampModel: 'british-crunch',
        gain: 66,
        bass: 58,
        mid: 60,
        treble: 64,
        presence: 62,
        master: 72,
        cabEnabled: true,
        cabModel: '4x12-v30'
      }
    })
  },
  {
    id: 'factory-modern-metal',
    name: 'Modern Metal',
    category: 'High Gain',
    factory: true,
    rig: createBaseRig({
      pedals: {
        ...createBaseRig().pedals,
        gate: {
          id: 'gate',
          enabled: true,
          params: { threshold: -44, release: 0.06, humFilter60Hz: true }
        },
        drive: {
          id: 'drive',
          enabled: true,
          params: { mode: 'tube-od', drive: 26, tone: 72, level: 82 }
        },
        eq: {
          id: 'eq',
          enabled: true,
          params: { band100: 3, band250: -2, band800: -3.5, band2000: 2.5, band4000: 2, level: 0 }
        },
        reverb: {
          id: 'reverb',
          enabled: true,
          params: { decay: 1.1, dampening: 65, mix: 12 }
        }
      },
      ampCab: {
        ampEnabled: true,
        ampModel: 'modern-metal',
        gain: 82,
        bass: 64,
        mid: 42,
        treble: 68,
        presence: 70,
        master: 70,
        cabEnabled: true,
        cabModel: '4x12-v30'
      }
    })
  },
  {
    id: 'factory-ambient',
    name: 'Ambient Space',
    category: 'Ambient',
    factory: true,
    rig: createBaseRig({
      pedals: {
        ...createBaseRig().pedals,
        compressor: {
          id: 'compressor',
          enabled: true,
          params: { threshold: -26, ratio: 4.5, attack: 0.01, makeup: 4.5 }
        },
        chorus: {
          id: 'chorus',
          enabled: true,
          params: { rate: 0.6, depth: 65, mix: 45 }
        },
        delay: {
          id: 'delay',
          enabled: true,
          params: { timeMs: 480, feedback: 52, tone: 42, mix: 42 }
        },
        reverb: {
          id: 'reverb',
          enabled: true,
          params: { decay: 4.5, dampening: 32, mix: 48 }
        }
      },
      ampCab: {
        ampEnabled: true,
        ampModel: 'clean-twin',
        gain: 22,
        bass: 52,
        mid: 46,
        treble: 60,
        presence: 54,
        master: 74,
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
          params: { mode: 'tube-od', drive: 54, tone: 58, level: 68 }
        },
        delay: {
          id: 'delay',
          enabled: true,
          params: { timeMs: 360, feedback: 32, tone: 52, mix: 26 }
        },
        reverb: {
          id: 'reverb',
          enabled: true,
          params: { decay: 1.8, dampening: 50, mix: 20 }
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
