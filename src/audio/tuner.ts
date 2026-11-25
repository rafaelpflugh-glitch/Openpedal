import { TunerReading } from '../types/pedalboard';

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export const STANDARD_GUITAR_STRINGS = [
  { label: '6ª E2', note: 'E', octave: 2, freq: 82.41 },
  { label: '5ª A2', note: 'A', octave: 2, freq: 110.0 },
  { label: '4ª D3', note: 'D', octave: 3, freq: 146.83 },
  { label: '3ª G3', note: 'G', octave: 3, freq: 196.0 },
  { label: '2ª B3', note: 'B', octave: 3, freq: 246.94 },
  { label: '1ª E4', note: 'E', octave: 4, freq: 329.63 }
];

/**
 * YIN-inspired normalized autocorrelation pitch detector optimized for guitar (55Hz - 1400Hz).
 */
export function detectPitch(buffer: Float32Array, sampleRate: number): TunerReading {
  const size = buffer.length;
  let rms = 0;
  for (let i = 0; i < size; i++) {
    rms += buffer[i] * buffer[i];
  }
  rms = Math.sqrt(rms / size);

  if (rms < 0.008) {
    return { note: '--', octave: 0, frequency: 0, cents: 0, clarity: 0, detected: false };
  }

  const maxFreq = 1350;
  const minFreq = 55; // Supports down to A1 / Drop B / Bass A1
  const minLag = Math.max(2, Math.floor(sampleRate / maxFreq));
  const maxLag = Math.min(Math.floor(size / 2), Math.floor(sampleRate / minFreq));

  if (maxLag <= minLag) {
    return { note: '--', octave: 0, frequency: 0, cents: 0, clarity: 0, detected: false };
  }

  const diff = new Float32Array(maxLag + 1);
  const cmnd = new Float32Array(maxLag + 1);
  cmnd[0] = 1;

  let runningSum = 0;
  for (let lag = 1; lag <= maxLag; lag++) {
    let sum = 0;
    const limit = size - maxLag;
    for (let i = 0; i < limit; i++) {
      const delta = buffer[i] - buffer[i + lag];
      sum += delta * delta;
    }
    diff[lag] = sum;
    runningSum += sum;
    cmnd[lag] = runningSum > 0 ? (sum * lag) / runningSum : 1;
  }

  const threshold = 0.16;
  let bestLag = -1;
  for (let lag = minLag; lag < maxLag; lag++) {
    if (cmnd[lag] < threshold) {
      while (lag + 1 < maxLag && cmnd[lag + 1] < cmnd[lag]) {
        lag++;
      }
      bestLag = lag;
      break;
    }
  }

  if (bestLag === -1) {
    // Fallback to global minimum if reasonably clear
    let minVal = 1;
    for (let lag = minLag; lag < maxLag; lag++) {
      if (cmnd[lag] < minVal) {
        minVal = cmnd[lag];
        bestLag = lag;
      }
    }
    if (minVal > 0.35 || bestLag === -1) {
      return { note: '--', octave: 0, frequency: 0, cents: 0, clarity: 0, detected: false };
    }
  }

  // Parabolic interpolation around bestLag for sub-cent precision
  let refinedLag = bestLag;
  if (bestLag > 1 && bestLag < maxLag) {
    const s0 = cmnd[bestLag - 1];
    const s1 = cmnd[bestLag];
    const s2 = cmnd[bestLag + 1];
    const denom = 2 * (2 * s1 - s2 - s0);
    if (Math.abs(denom) > 1e-6) {
      refinedLag = bestLag + (s2 - s0) / denom;
    }
  }

  const frequency = sampleRate / refinedLag;
  const clarity = Math.max(0, Math.min(1, 1 - cmnd[bestLag]));

  if (!isFinite(frequency) || frequency < minFreq || frequency > maxFreq) {
    return { note: '--', octave: 0, frequency: 0, cents: 0, clarity: 0, detected: false };
  }

  const midiFloat = 69 + 12 * Math.log2(frequency / 440);
  const nearestMidi = Math.round(midiFloat);
  const cents = Math.round((midiFloat - nearestMidi) * 100);
  const noteIdx = ((nearestMidi % 12) + 12) % 12;
  const octave = Math.floor(nearestMidi / 12) - 1;

  return {
    note: NOTE_NAMES[noteIdx],
    octave,
    frequency,
    cents,
    clarity,
    detected: true
  };
}
