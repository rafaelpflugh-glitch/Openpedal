import { CabModel } from '../types/pedalboard';

/**
 * Generates clean, warm, ZERO-comb-filter minimum-phase Guitar Cabinet Impulse Responses.
 * Real mic'd guitar speakers (SM57 on 4x12 V30 / 2x12 Twin / 1x12 Tweed) have a steep, smooth
 * 4th-order speaker cone roll-off around 4-5.5 kHz that turns distortion creamy and natural
 * on a Home Theater or headphones — WITHOUT metallic tin-can echoes.
 */
export async function generateCabinetIR(
  sampleRate: number,
  model: Exclude<CabModel, 'custom-ir'>
): Promise<AudioBuffer> {
  const length = Math.floor(sampleRate * 0.032); // Clean 32ms minimum-phase speaker IR
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

  // 2 cascaded lowpass filters = authentic 24dB/oct guitar speaker cone roll-off (eliminates ALL digital fizz!)
  const coneLpf1 = offline.createBiquadFilter();
  coneLpf1.type = 'lowpass';

  const coneLpf2 = offline.createBiquadFilter();
  coneLpf2.type = 'lowpass';

  if (model === '4x12-v30') {
    // Mesa / Marshall 4x12 Celestion V30: deep tight 110Hz punch, smooth 2.2kHz voice, silky 4.2kHz rolloff
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
    // Fender Twin 2x12 Open Back: warm open clean chime, smooth 5.4kHz sparkle
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
    // Vintage 1x12 Tweed Combo: warm bluesy woody mids, velvety 3.4kHz rolloff
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
    // 4x10 Wide Studio Clean
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

  // Studio SM57 fizz-taming dip (~3.8kHz) removes harsh digital buzz while preserving guitar bite!
  const fizzNotch = offline.createBiquadFilter();
  fizzNotch.type = 'peaking';
  fizzNotch.frequency.value = model === '1x12-tweed' ? 3100 : 3850;
  fizzNotch.Q.value = 2.6;
  fizzNotch.gain.value = model === '4x10-clean' ? -1.0 : -4.2;

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

  // Calibrate IR to exact unity energy
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
    const scale = 0.92 / maxEnergy;
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
 * Generates a warm, silky True Stereo Hall/Plate Reverb Impulse Response (Lexicon/Strymon style)
 * with smooth onset, progressive darkening, and unity RMS normalization (zero metallic hiss!).
 */
export function generateReverbIR(
  ctx: BaseAudioContext,
  decaySec: number,
  dampeningPct: number
): AudioBuffer {
  const sr = ctx.sampleRate;
  const rt60 = Math.max(0.35, Math.min(7.5, decaySec));
  const length = Math.floor(sr * (rt60 + 0.15));
  const buffer = ctx.createBuffer(2, length, sr);

  const damp = Math.max(0.12, Math.min(0.95, dampeningPct / 100));
  const decayRate = 6.907755 / rt60;

  for (let ch = 0; ch < 2; ch++) {
    const data = buffer.getChannelData(ch);
    const preDelay = Math.floor(sr * (ch === 0 ? 0.016 : 0.023));
    const bloomSamples = Math.floor(sr * 0.045);

    let lp1 = 0;
    let lp2 = 0;
    let lp3 = 0;
    let hpPrevIn = 0;
    let hpPrevOut = 0;

    for (let i = preDelay; i < length; i++) {
      const tSec = (i - preDelay) / sr;
      const bloom = Math.min(1, (i - preDelay) / bloomSamples);
      const env = bloom * Math.exp(-decayRate * tSec);

      // 3-pole warm air absorption so tail stays velvety & non-metallic
      const alpha = Math.max(0.03, (0.52 - damp * 0.42) * Math.exp(-tSec * (0.45 + damp * 1.2)));
      const white = Math.random() * 2 - 1;
      lp1 += alpha * (white - lp1);
      lp2 += alpha * (lp1 - lp2);
      lp3 += Math.min(0.8, alpha * 1.3) * (lp2 - lp3);

      // Gentle 160Hz HPF so reverb never muddies low guitar strings
      const hpOut = 0.982 * (hpPrevOut + lp3 - hpPrevIn);
      hpPrevIn = lp3;
      hpPrevOut = hpOut;

      data[i] = hpOut * env;
    }

    // Calibrate RMS energy to studio unity
    let sumSq = 0;
    for (let i = 0; i < length; i++) {
      sumSq += data[i] * data[i];
    }
    const rmsEnergy = Math.sqrt(sumSq);
    if (rmsEnergy > 0.001) {
      const targetGain = 0.95 / rmsEnergy;
      for (let i = 0; i < length; i++) {
        data[i] *= targetGain;
      }
    }
  }

  return buffer;
}
