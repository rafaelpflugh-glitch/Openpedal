import { CabModel } from '../types/pedalboard';

/**
 * Generates realistic guitar speaker Cabinet Impulse Responses (IRs) using an OfflineAudioContext.
 * Authentic guitar speakers strongly roll off above ~5kHz and below ~75Hz, with distinct
 * cone resonances and cabinet box reflections. This makes distortion sound rich & natural
 * through a Home Theater or headphones instead of harsh/fizzy.
 */
export async function generateCabinetIR(
  sampleRate: number,
  model: Exclude<CabModel, 'custom-ir'>
): Promise<AudioBuffer> {
  const length = Math.floor(sampleRate * 0.045); // 45ms IR
  const offline = new OfflineAudioContext(2, length, sampleRate);

  // Create stereo impulse with subtle cabinet early reflections
  const impulse = offline.createBuffer(2, length, sampleRate);
  const chL = impulse.getChannelData(0);
  const chR = impulse.getChannelData(1);

  chL[0] = 1.0;
  chR[0] = 1.0;

  // Subtle room/cabinet box reflections for stereo width on Home Theater
  const reflections =
    model === '4x12-v30'
      ? [
          { ms: 1.1, l: -0.22, r: -0.18 },
          { ms: 2.6, l: 0.14, r: 0.17 },
          { ms: 5.4, l: -0.07, r: 0.08 },
          { ms: 9.2, l: 0.03, r: -0.03 }
        ]
      : model === '2x12-open'
      ? [
          { ms: 1.6, l: -0.19, r: -0.24 },
          { ms: 4.1, l: 0.16, r: 0.13 },
          { ms: 8.5, l: -0.09, r: 0.11 },
          { ms: 14.0, l: 0.04, r: -0.04 }
        ]
      : model === '1x12-tweed'
      ? [
          { ms: 1.2, l: -0.26, r: -0.22 },
          { ms: 3.3, l: 0.12, r: 0.15 },
          { ms: 6.8, l: -0.06, r: 0.06 }
        ]
      : [
          { ms: 1.4, l: -0.15, r: -0.15 },
          { ms: 3.8, l: 0.11, r: 0.13 },
          { ms: 7.5, l: -0.05, r: 0.05 }
        ];

  for (const ref of reflections) {
    const idx = Math.floor((ref.ms / 1000) * sampleRate);
    if (idx < length) {
      chL[idx] += ref.l;
      chR[idx] += ref.r;
    }
  }

  const src = offline.createBufferSource();
  src.buffer = impulse;

  // Build authentic guitar speaker EQ Voicing
  const hpf = offline.createBiquadFilter();
  hpf.type = 'highpass';

  const lowRes = offline.createBiquadFilter();
  lowRes.type = 'peaking';

  const midDip = offline.createBiquadFilter();
  midDip.type = 'peaking';

  const upperMid = offline.createBiquadFilter();
  upperMid.type = 'peaking';

  const lpf1 = offline.createBiquadFilter();
  lpf1.type = 'lowpass';

  const lpf2 = offline.createBiquadFilter();
  lpf2.type = 'lowpass';

  if (model === '4x12-v30') {
    // Celestion Vintage 30 4x12 closed back: tight punchy lows, famous 2.4kHz bite, smooth steep rolloff
    hpf.frequency.value = 78;
    hpf.Q.value = 0.9;
    lowRes.frequency.value = 115;
    lowRes.Q.value = 1.6;
    lowRes.gain.value = 4.2;
    midDip.frequency.value = 420;
    midDip.Q.value = 1.1;
    midDip.gain.value = -3.2;
    upperMid.frequency.value = 2350;
    upperMid.Q.value = 1.4;
    upperMid.gain.value = 4.5;
    lpf1.frequency.value = 4700;
    lpf1.Q.value = 1.1;
    lpf2.frequency.value = 5400;
    lpf2.Q.value = 0.8;
  } else if (model === '2x12-open') {
    // Open-back Jensen/Greenback 2x12: airy cleans, warm mids, sparkly top
    hpf.frequency.value = 85;
    hpf.Q.value = 0.7;
    lowRes.frequency.value = 130;
    lowRes.Q.value = 1.2;
    lowRes.gain.value = 2.8;
    midDip.frequency.value = 550;
    midDip.Q.value = 0.9;
    midDip.gain.value = -1.8;
    upperMid.frequency.value = 2900;
    upperMid.Q.value = 1.1;
    upperMid.gain.value = 3.0;
    lpf1.frequency.value = 5600;
    lpf1.Q.value = 0.85;
    lpf2.frequency.value = 6400;
    lpf2.Q.value = 0.7;
  } else if (model === '1x12-tweed') {
    // Vintage 1x12 Tweed combo: boxy woody midrange, warm rolled-off highs
    hpf.frequency.value = 105;
    hpf.Q.value = 0.8;
    lowRes.frequency.value = 165;
    lowRes.Q.value = 1.5;
    lowRes.gain.value = 3.5;
    midDip.frequency.value = 780;
    midDip.Q.value = 1.2;
    midDip.gain.value = 2.2;
    upperMid.frequency.value = 2000;
    upperMid.Q.value = 1.3;
    upperMid.gain.value = 2.4;
    lpf1.frequency.value = 4200;
    lpf1.Q.value = 1.0;
    lpf2.frequency.value = 4800;
    lpf2.Q.value = 0.7;
  } else {
    // 4x10 Clean/Acoustic FR-leaning cab: wide balanced response
    hpf.frequency.value = 65;
    hpf.Q.value = 0.7;
    lowRes.frequency.value = 110;
    lowRes.Q.value = 1.0;
    lowRes.gain.value = 2.2;
    midDip.frequency.value = 500;
    midDip.Q.value = 0.9;
    midDip.gain.value = -1.2;
    upperMid.frequency.value = 3400;
    upperMid.Q.value = 0.9;
    upperMid.gain.value = 2.5;
    lpf1.frequency.value = 7200;
    lpf1.Q.value = 0.7;
    lpf2.frequency.value = 8500;
    lpf2.Q.value = 0.7;
  }

  const outGain = offline.createGain();
  outGain.gain.value = 0.95;

  src.connect(hpf);
  hpf.connect(lowRes);
  lowRes.connect(midDip);
  midDip.connect(upperMid);
  upperMid.connect(lpf1);
  lpf1.connect(lpf2);
  lpf2.connect(outGain);
  outGain.connect(offline.destination);

  src.start(0);
  const rendered = await offline.startRendering();

  // Normalize IR energy so cabinet switching keeps consistent loudness
  let maxEnergy = 0;
  for (let ch = 0; ch < rendered.numberOfChannels; ch++) {
    const data = rendered.getChannelData(ch);
    let sumSq = 0;
    for (let i = 0; i < data.length; i++) {
      sumSq += data[i] * data[i];
    }
    maxEnergy = Math.max(maxEnergy, Math.sqrt(sumSq));
  }

  if (maxEnergy > 0.001) {
    const scale = 0.82 / maxEnergy;
    for (let ch = 0; ch < rendered.numberOfChannels; ch++) {
      const data = rendered.getChannelData(ch);
      for (let i = 0; i < data.length; i++) {
        data[i] *= scale;
      }
    }
  }

  return rendered;
}

/**
 * Generates a lush stereo Reverb Impulse Response with configurable decay and high-frequency dampening.
 */
export function generateReverbIR(
  ctx: BaseAudioContext,
  decaySec: number,
  dampeningPct: number
): AudioBuffer {
  const clampedDecay = Math.max(0.3, Math.min(7.0, decaySec));
  const length = Math.floor(ctx.sampleRate * clampedDecay);
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
  const damp = Math.max(0.05, Math.min(0.95, dampeningPct / 100));

  // Simple one-pole low-pass dampening coefficient
  const lpAlpha = 0.15 + (1 - damp) * 0.75;

  for (let ch = 0; ch < 2; ch++) {
    const data = buffer.getChannelData(ch);
    let prev = 0;
    const preDelaySamples = Math.floor(ctx.sampleRate * (ch === 0 ? 0.012 : 0.017));

    for (let i = 0; i < length; i++) {
      if (i < preDelaySamples) {
        data[i] = 0;
        continue;
      }
      const t = (i - preDelaySamples) / (length - preDelaySamples);
      const env = Math.pow(1 - t, 2.4) * Math.exp(-t * 2.2);
      const white = Math.random() * 2 - 1;
      prev = prev + lpAlpha * (white - prev);
      data[i] = prev * env * 0.42;
    }
  }

  return buffer;
}
