import { AmpModel, DriveMode, FuzzMode } from '../types/pedalboard';

const CURVE_SAMPLES = 8192;

/**
 * Calibrated, musical analog waveshaper curves (designed for clean studio gain staging
 * without harsh square-wave aliasing buzz).
 */
export function makeDriveCurve(mode: DriveMode, driveAmount: number): Float32Array<ArrayBuffer> {
  const curve = new Float32Array(new ArrayBuffer(CURVE_SAMPLES * 4));
  const norm = Math.max(0.02, driveAmount / 100);

  for (let i = 0; i < CURVE_SAMPLES; i++) {
    const x = (i * 2) / (CURVE_SAMPLES - 1) - 1;

    if (mode === 'klon') {
      // Klon Centaur: silky warm Germanium soft-clipping knee
      const k = 1.2 + norm * 3.2;
      const bias = 0.03 * norm;
      const y = (Math.tanh((x + bias) * k) - Math.tanh(bias * k) * 0.5) / Math.tanh(k);
      curve[i] = y * 0.92;
    } else if (mode === 'ts9') {
      // Tube Screamer TS9: smooth asymmetric tube-like soft clip
      const k = 1.6 + norm * 4.8;
      const bias = 0.06 * norm;
      const y = (Math.tanh((x + bias) * k) - Math.tanh(bias * k) * 0.65) / Math.tanh(k);
      curve[i] = Math.max(-0.92, Math.min(0.92, y));
    } else if (mode === 'ds1') {
      // Boss DS-1: crisp silicon diode clipping with smooth knees (punchy, not fizzy!)
      const k = 2.4 + norm * 7.5;
      const y = (2 / Math.PI) * Math.atan(x * k);
      curve[i] = y * 0.9;
    } else {
      // ProCo RAT: slightly asymmetric gritty crunch
      const k = 2.0 + norm * 6.5;
      const y = (2 / Math.PI) * Math.atan((x + 0.04 * norm) * k);
      curve[i] = Math.max(-0.88, Math.min(0.92, y * 0.94));
    }
  }
  return curve;
}

/**
 * Musical, warm Fuzz curves (Big Muff violin sustain, Germanium Fuzz Face wool, Super Fuzz octave grit).
 */
export function makeFuzzCurve(mode: FuzzMode, sustainAmount: number): Float32Array<ArrayBuffer> {
  const curve = new Float32Array(new ArrayBuffer(CURVE_SAMPLES * 4));
  const norm = Math.max(0.02, sustainAmount / 100);

  for (let i = 0; i < CURVE_SAMPLES; i++) {
    const x = (i * 2) / (CURVE_SAMPLES - 1) - 1;

    if (mode === 'big-muff') {
      // Big Muff Pi: creamy 2-stage sustained violin saturation (Gilmour / Pumpkins)
      const k1 = 2.6 + norm * 7.0;
      const s1 = Math.tanh(x * k1);
      const k2 = 1.6 + norm * 3.4;
      const s2 = Math.tanh((s1 + 0.03) * k2) - 0.02;
      curve[i] = s2 * 0.88;
    } else if (mode === 'fuzz-face') {
      // Dallas-Arbiter Germanium Fuzz Face: warm biased asymmetric wool
      const k = 2.0 + norm * 5.8;
      const bias = 0.12 * norm;
      const raw = x >= 0 ? Math.tanh((x + bias) * k) : Math.tanh((x + bias * 0.4) * k * 0.78);
      const zero = Math.tanh(bias * k) * 0.65;
      curve[i] = Math.max(-0.9, Math.min(0.9, (raw - zero) * 0.94));
    } else {
      // Univox Super Fuzz: aggressive octave harmonic fold
      const k = 2.8 + norm * 7.5;
      const s = x * k;
      const oct = Math.tanh(s) + 0.3 * Math.tanh(Math.abs(s) * 0.85 - 0.35) * (x >= 0 ? 1 : -0.65);
      curve[i] = Math.max(-0.88, Math.min(0.88, oct * 0.78));
    }
  }
  return curve;
}

/**
 * Stage 1 Amp Preamp Tube curve (12AX7 input triode).
 */
export function makeAmpPreampCurve(model: AmpModel, gainAmount: number): Float32Array<ArrayBuffer> {
  const curve = new Float32Array(new ArrayBuffer(CURVE_SAMPLES * 4));
  const norm = Math.max(0.02, gainAmount / 100);

  for (let i = 0; i < CURVE_SAMPLES; i++) {
    const x = (i * 2) / (CURVE_SAMPLES - 1) - 1;

    if (model === 'acoustic-direct') {
      curve[i] = x; // Pure clean linear pass-through
    } else if (model === 'clean-twin') {
      // Fender Blackface: super clean & glassy, warm kiss of tube compression only when pushed hard
      const k = 1.05 + Math.pow(norm, 2.0) * 2.2;
      curve[i] = Math.tanh(x * k) / Math.tanh(k);
    } else if (model === 'british-crunch') {
      // Marshall Plexi / JCM800: warm crunchy tube saturation
      const k = 1.5 + norm * 4.5;
      const bias = 0.05 * norm;
      const y = (Math.tanh((x + bias) * k) - Math.tanh(bias * k) * 0.6) / Math.tanh(k);
      curve[i] = y * 0.94;
    } else {
      // Modern Metal (5150) Stage 1: tight thick high-gain saturation
      const k = 2.2 + norm * 6.5;
      const y = Math.tanh((x + 0.06) * k) - 0.04;
      curve[i] = y * 0.92;
    }
  }
  return curve;
}

/**
 * Stage 2 Power Tube saturation curve.
 */
export function makeAmpPowerCurve(model: AmpModel, gainAmount: number): Float32Array<ArrayBuffer> {
  const curve = new Float32Array(new ArrayBuffer(CURVE_SAMPLES * 4));
  const norm = Math.max(0.02, gainAmount / 100);

  for (let i = 0; i < CURVE_SAMPLES; i++) {
    const x = (i * 2) / (CURVE_SAMPLES - 1) - 1;

    if (model === 'modern-metal') {
      const k = 1.6 + norm * 3.8;
      curve[i] = Math.tanh((x - 0.03) * k) * 0.92;
    } else if (model === 'british-crunch') {
      const k = 1.2 + norm * 2.0;
      curve[i] = Math.tanh(x * k) / Math.tanh(k);
    } else {
      curve[i] = x;
    }
  }
  return curve;
}
