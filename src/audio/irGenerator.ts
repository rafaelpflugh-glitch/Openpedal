import { CabModel, ReverbMode } from '../types/pedalboard';

/**
 * Generates clean, warm, ZERO-comb-filter minimum-phase Guitar Cabinet Impulse Responses
 * with studio SM57 fizz-taming notch and 24dB/oct cone rolloff.
 */
export async function generateCabinetIR(
  sampleRate: number,
  model: Exclude<CabModel, 'custom-ir'>
): Promise<AudioBuffer> {
  const length = Math.floor(sampleRate * 0.032);
  const offline = new OfflineAudioContext(2, length, sampleRate);

  const impulse = offline.createBuffer(2, length, sampleRate);
  impulse.getChannelData(0)[0] = 1.0;
  impulse.getChannelData(1)[0] = 1.0;

  const src = offline.createBufferSource();
  src.buffer = impulse;

  const hpf = offline.createBiquadFilter();
  hpf.type = 'highpass';

  const lowBody = offline.createBiquadFilter();
  lowBody.type = 'peaking';

  const midShape = offline.createBiquadFilter();
  midShape.type = 'peaking';

  const upperPresence = offline.createBiquadFilter();
  upperPresence.type = 'peaking';

  const fizzNotch = offline.createBiquadFilter();
  fizzNotch.type = 'peaking';
  fizzNotch.frequency.value = model === '1x12-tweed' ? 3100 : 3850;
  fizzNotch.Q.value = 2.6;
  fizzNotch.gain.value = model === '4x10-clean' ? -1.0 : -4.2;

  const coneLpf1 = offline.createBiquadFilter();
  coneLpf1.type = 'lowpass';

  const coneLpf2 = offline.createBiquadFilter();
  coneLpf2.type = 'lowpass';

  if (model === '4x12-v30') {
    hpf.frequency.value = 78;
    hpf.Q.value = 0.85;
    lowBody.frequency.value = 115;
    lowBody.Q.value = 1.3;
    lowBody.gain.value = 4.2;
    midShape.frequency.value = 420;
    midShape.Q.value = 1.0;
    midShape.gain.value = -3.2;
    upperPresence.frequency.value = 2250;
    upperPresence.Q.value = 1.1;
    upperPresence.gain.value = 3.6;
    coneLpf1.frequency.value = 4100;
    coneLpf1.Q.value = 0.75;
    coneLpf2.frequency.value = 4500;
    coneLpf2.Q.value = 0.7;
  } else if (model === '2x12-open') {
    hpf.frequency.value = 82;
    hpf.Q.value = 0.7;
    lowBody.frequency.value = 135;
    lowBody.Q.value = 1.0;
    lowBody.gain.value = 2.8;
    midShape.frequency.value = 540;
    midShape.Q.value = 0.9;
    midShape.gain.value = -2.2;
    upperPresence.frequency.value = 3100;
    upperPresence.Q.value = 0.9;
    upperPresence.gain.value = 2.6;
    coneLpf1.frequency.value = 5200;
    coneLpf1.Q.value = 0.7;
    coneLpf2.frequency.value = 5800;
    coneLpf2.Q.value = 0.7;
  } else if (model === '1x12-tweed') {
    hpf.frequency.value = 110;
    hpf.Q.value = 0.75;
    lowBody.frequency.value = 175;
    lowBody.Q.value = 1.2;
    lowBody.gain.value = 3.0;
    midShape.frequency.value = 880;
    midShape.Q.value = 1.0;
    midShape.gain.value = 3.5;
    upperPresence.frequency.value = 1900;
    upperPresence.Q.value = 1.0;
    upperPresence.gain.value = 1.8;
    coneLpf1.frequency.value = 3300;
    coneLpf1.Q.value = 0.75;
    coneLpf2.frequency.value = 3800;
    coneLpf2.Q.value = 0.7;
  } else {
    hpf.frequency.value = 60;
    hpf.Q.value = 0.7;
    lowBody.frequency.value = 110;
    lowBody.Q.value = 0.8;
    lowBody.gain.value = 2.0;
    midShape.frequency.value = 500;
    midShape.Q.value = 0.8;
    midShape.gain.value = -1.0;
    upperPresence.frequency.value = 4200;
    upperPresence.Q.value = 0.8;
    upperPresence.gain.value = 2.2;
    coneLpf1.frequency.value = 7200;
    coneLpf1.Q.value = 0.7;
    coneLpf2.frequency.value = 8400;
    coneLpf2.Q.value = 0.7;
  }

  src.connect(hpf);
  hpf.connect(lowBody);
  lowBody.connect(midShape);
  midShape.connect(upperPresence);
  upperPresence.connect(fizzNotch);
  fizzNotch.connect(coneLpf1);
  coneLpf1.connect(coneLpf2);
  coneLpf2.connect(offline.destination);

  src.start(0);
  const rendered = await offline.startRendering();

  let maxEnergy = 0;
  for (let ch = 0; ch < rendered.numberOfChannels; ch++) {
    const data = rendered.getChannelData(ch);
    let sumSq = 0;
    for (let i = 0; i < data.length; i++) sumSq += data[i] * data[i];
    maxEnergy = Math.max(maxEnergy, Math.sqrt(sumSq));
  }

  if (maxEnergy > 0.001) {
    const scale = 0.92 / maxEnergy;
    for (let ch = 0; ch < rendered.numberOfChannels; ch++) {
      const data = rendered.getChannelData(ch);
      for (let i = 0; i < data.length; i++) data[i] *= scale;
    }
  }

  return rendered;
}

/**
 * Generates 3 distinct Reverb Impulse Responses:
 * - 'hall': silky velvety stereo concert hall / cathedral
 * - 'spring': classic Fender Twin / Surf Rock metallic bouncy spring tank!
 * - 'shimmer': wide airy cathedral tail tuned to bloom with octave-up shimmer pitch!
 */
export function generateReverbIR(
  ctx: BaseAudioContext,
  mode: ReverbMode,
  decaySec: number,
  dampeningPct: number
): AudioBuffer {
  const sr = ctx.sampleRate;
  const rt60 = Math.max(0.35, Math.min(7.5, mode === 'spring' ? Math.min(3.5, decaySec) : decaySec));
  const length = Math.floor(sr * (rt60 + 0.15));
  const buffer = ctx.createBuffer(2, length, sr);

  const damp = Math.max(0.1, Math.min(0.95, dampeningPct / 100));
  const decayRate = 6.907755 / rt60;

  for (let ch = 0; ch < 2; ch++) {
    const data = buffer.getChannelData(ch);

    if (mode === 'spring') {
      // Authentic Fender Twin Spring Tank: rhythmic spring drip reflections + resonant metallic chirp!
      const springPeriodMs = ch === 0 ? 31.5 : 34.2;
      const springPeriodSamples = Math.floor((springPeriodMs / 1000) * sr);
      let lp1 = 0;
      let lp2 = 0;
      let hpIn = 0;
      let hpOut = 0;

      for (let i = 0; i < length; i++) {
        const t = i / sr;
        const env = Math.exp(-decayRate * t);
        // Spring metallic flutter modulation
        const drip = 0.65 + 0.35 * Math.sin((2 * Math.PI * i) / springPeriodSamples);
        // Dispersive boing tone early in tail
        const boing = Math.sin(2 * Math.PI * (290 + 180 * Math.exp(-t * 14)) * t) * Math.exp(-t * 9) * 0.45;
        const white = Math.random() * 2 - 1;
        const alpha = Math.max(0.06, 0.42 - damp * 0.28);
        lp1 += alpha * (white - lp1);
        lp2 += alpha * (lp1 - lp2);

        // Tighter 280Hz HPF gives classic vintage spring midrange twang
        const hp = 0.965 * (hpOut + lp2 - hpIn);
        hpIn = lp2;
        hpOut = hp;

        data[i] = (hp * drip + boing) * env;
      }

      // Add discrete spring tank slap echoes
      for (let k = 1; k <= 8; k++) {
        const idx = k * springPeriodSamples;
        if (idx < length) {
          data[idx] += (k % 2 === 0 ? 0.35 : -0.35) * Math.pow(0.72, k);
        }
      }
    } else {
      // Hall or Shimmer Cathedral
      const isShimmer = mode === 'shimmer';
      const preDelay = Math.floor(sr * (ch === 0 ? 0.016 : 0.024));
      const bloomSamples = Math.floor(sr * (isShimmer ? 0.095 : 0.045));

      let lp1 = 0;
      let lp2 = 0;
      let lp3 = 0;
      let hpPrevIn = 0;
      let hpPrevOut = 0;

      for (let i = preDelay; i < length; i++) {
        const tSec = (i - preDelay) / sr;
        const bloom = Math.min(1, (i - preDelay) / bloomSamples);
        const env = bloom * Math.exp(-decayRate * tSec);

        const baseOpen = isShimmer ? 0.68 : 0.52;
        const alpha = Math.max(0.03, (baseOpen - damp * 0.42) * Math.exp(-tSec * (0.42 + damp * 1.1)));
        const white = Math.random() * 2 - 1;
        lp1 += alpha * (white - lp1);
        lp2 += alpha * (lp1 - lp2);
        lp3 += Math.min(0.85, alpha * 1.3) * (lp2 - lp3);

        const hpOut = 0.982 * (hpPrevOut + lp3 - hpPrevIn);
        hpPrevIn = lp3;
        hpPrevOut = hpOut;

        data[i] = hpOut * env;
      }
    }

    // Calibrate RMS energy to studio unity
    let sumSq = 0;
    for (let i = 0; i < length; i++) sumSq += data[i] * data[i];
    const rmsEnergy = Math.sqrt(sumSq);
    if (rmsEnergy > 0.001) {
      const targetGain = (mode === 'spring' ? 0.88 : 0.96) / rmsEnergy;
      for (let i = 0; i < length; i++) data[i] *= targetGain;
    }
  }

  return buffer;
}
