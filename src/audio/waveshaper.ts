import { AmpModel, DriveMode } from '../types/pedalboard';

const CURVE_SAMPLES = 4096;

export function makeDriveCurve(mode: DriveMode, driveAmount: number): Float32Array<ArrayBuffer> {
  const curve = new Float32Array(new ArrayBuffer(CURVE_SAMPLES * 4));
  const norm = Math.max(0.01, driveAmount / 100);

  for (let i = 0; i < CURVE_SAMPLES; i++) {
    const x = (i * 2) / (CURVE_SAMPLES - 1) - 1;

    if (mode === 'tube-od') {
      // Warm asymmetric soft clipping (Tube Screamer style)
      const k = 1.5 + norm * 16;
      const shifted = x + 0.06 * norm;
      const y = Math.tanh(shifted * k) - Math.tanh(0.06 * norm * k) * 0.6;
      curve[i] = y / Math.max(1, Math.tanh(k));
    } else if (mode === 'crunch') {
      // British diode clipping with harmonic bite
      const k = 2.5 + norm * 28;
      const y = (2 / Math.PI) * Math.atan(x * k);
      const asym = x > 0 ? y * 1.05 : y * 0.92;
      curve[i] = Math.max(-1, Math.min(1, asym));
    } else {
      // High-gain fuzz / aggressive clipping
      const k = 4 + norm * 55;
      const clipped = Math.tanh(x * k * (1 + 0.35 * Math.abs(x)));
      const hard = Math.max(-0.88, Math.min(0.88, clipped * 1.15));
      curve[i] = hard;
    }
  }
  return curve;
}

export function makeAmpPreampCurve(model: AmpModel, gainAmount: number): Float32Array<ArrayBuffer> {
  const curve = new Float32Array(new ArrayBuffer(CURVE_SAMPLES * 4));
  const norm = Math.max(0.01, gainAmount / 100);

  for (let i = 0; i < CURVE_SAMPLES; i++) {
    const x = (i * 2) / (CURVE_SAMPLES - 1) - 1;

    if (model === 'acoustic-direct') {
      // Ultra clean with gentle warm headroom limiter
      curve[i] = Math.tanh(x * (1 + norm * 1.2)) / Math.tanh(1 + norm * 1.2);
    } else if (model === 'clean-twin') {
      // Fender-style high-headroom tube clean, breaks up softly at high gain
      const k = 1.1 + norm * 4.5;
      curve[i] = Math.tanh(x * k) / Math.tanh(k);
    } else if (model === 'british-crunch') {
      // Plexi/JCM800 asymmetric tube crunch
      const k = 1.8 + norm * 14;
      const bias = 0.08 * norm;
      const y = Math.tanh((x + bias) * k) - Math.tanh(bias * k) * 0.7;
      curve[i] = Math.max(-1, Math.min(1, y * 1.08));
    } else {
      // Modern high-gain cascading 12AX7 stages
      const k1 = 3.0 + norm * 22;
      const stage1 = Math.tanh((x + 0.07) * k1) - 0.04;
      const k2 = 1.6 + norm * 8;
      const stage2 = Math.tanh((stage1 - 0.05) * k2);
      curve[i] = Math.max(-1, Math.min(1, stage2 * 1.05));
    }
  }
  return curve;
}
