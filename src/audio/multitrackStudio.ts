import { StudioTrack } from '../types/pedalboard';

const TRACK_COLORS = ['#38bdf8', '#f97316', '#22c55e', '#c084fc', '#f43f5e', '#facc15', '#2dd4bf', '#818cf8'];

export function pickTrackColor(index: number): string {
  return TRACK_COLORS[index % TRACK_COLORS.length];
}

/**
 * Extracts normalized 0..1 waveform peak bars for crisp DAW waveform display.
 */
export function extractWaveformPeaks(buffer: AudioBuffer, bars = 140): number[] {
  const chL = buffer.getChannelData(0);
  const chR = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : chL;
  const total = chL.length;
  if (total === 0) return Array(bars).fill(0);

  const blockSize = Math.max(1, Math.floor(total / bars));
  const peaks: number[] = [];
  let globalMax = 0.01;

  for (let b = 0; b < bars; b++) {
    const start = b * blockSize;
    const end = Math.min(total, start + blockSize);
    let maxVal = 0;
    const step = Math.max(1, Math.floor((end - start) / 48));
    for (let i = start; i < end; i += step) {
      const v = Math.max(Math.abs(chL[i]), Math.abs(chR[i]));
      if (v > maxVal) maxVal = v;
    }
    if (maxVal > globalMax) globalMax = maxVal;
    peaks.push(maxVal);
  }

  const norm = Math.max(0.15, globalMax);
  return peaks.map((p) => Math.min(1, p / norm));
}

/**
 * Computes effective song duration across all active tracks.
 */
export function computeProjectDuration(tracks: StudioTrack[]): number {
  let maxEnd = 0;
  for (const t of tracks) {
    const playLen = Math.max(0, t.trimEndSec - t.trimStartSec);
    const startAt = Math.max(0, t.offsetMs / 1000);
    maxEnd = Math.max(maxEnd, startAt + playLen);
  }
  return maxEnd;
}

/**
 * Encodes an AudioBuffer into a standard 16-bit Stereo PCM .WAV Blob.
 */
export function encodeWav16Bit(buffer: AudioBuffer): Blob {
  const numChannels = Math.min(2, buffer.numberOfChannels);
  const sampleRate = buffer.sampleRate;
  const length = buffer.length;
  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const dataSize = length * blockAlign;
  const arrayBuf = new ArrayBuffer(44 + dataSize);
  const view = new DataView(arrayBuf);

  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true); // 16-bit
  writeStr(36, 'data');
  view.setUint32(40, dataSize, true);

  const chL = buffer.getChannelData(0);
  const chR = numChannels > 1 ? buffer.getChannelData(1) : chL;

  let offset = 44;
  for (let i = 0; i < length; i++) {
    const sL = Math.max(-1, Math.min(1, chL[i]));
    view.setInt16(offset, sL < 0 ? sL * 0x8000 : sL * 0x7fff, true);
    offset += 2;
    if (numChannels > 1) {
      const sR = Math.max(-1, Math.min(1, chR[i]));
      view.setInt16(offset, sR < 0 ? sR * 0x8000 : sR * 0x7fff, true);
      offset += 2;
    }
  }

  return new Blob([arrayBuf], { type: 'audio/wav' });
}

/**
 * Mixes all active (non-muted, respecting Solo) tracks into a single stereo studio .WAV file
 * with each track's exact Volume, Pan, Trim Start/End, and Sync Offset applied!
 */
export async function renderMixdownWav(tracks: StudioTrack[], sampleRate = 48000): Promise<Blob> {
  const anySolo = tracks.some((t) => t.solo);
  const active = tracks.filter((t) => (anySolo ? t.solo : !t.muted));
  if (active.length === 0) {
    throw new Error('Nenhuma faixa ativa para exportar.');
  }

  const totalSec = Math.max(0.5, computeProjectDuration(active) + 0.15);
  const totalFrames = Math.ceil(totalSec * sampleRate);
  const offline = new OfflineAudioContext(2, totalFrames, sampleRate);

  const limiter = offline.createDynamicsCompressor();
  limiter.threshold.value = -1.2;
  limiter.knee.value = 3;
  limiter.ratio.value = 14;
  limiter.attack.value = 0.002;
  limiter.release.value = 0.08;
  limiter.connect(offline.destination);

  for (const track of active) {
    const playDur = Math.max(0, track.trimEndSec - track.trimStartSec);
    if (playDur <= 0.01) continue;

    const src = offline.createBufferSource();
    src.buffer = track.buffer;

    const gain = offline.createGain();
    gain.gain.value = track.volume;

    const panner = offline.createStereoPanner();
    panner.pan.value = Math.max(-1, Math.min(1, track.pan));

    src.connect(gain).connect(panner).connect(limiter);

    const offsetSec = track.offsetMs / 1000;
    const when = Math.max(0, offsetSec);
    const extraTrim = offsetSec < 0 ? Math.abs(offsetSec) : 0;
    const startOffset = Math.min(track.trimEndSec, track.trimStartSec + extraTrim);
    const effectiveDur = Math.max(0, track.trimEndSec - startOffset);

    if (effectiveDur > 0.01) {
      src.start(when, startOffset, effectiveDur);
    }
  }

  const rendered = await offline.startRendering();
  return encodeWav16Bit(rendered);
}

interface PlayingNode {
  trackId: string;
  src: AudioBufferSourceNode;
  gain: GainNode;
  panner: StereoPannerNode;
}

/**
 * Sample-accurate Multitrack Playback Controller with live Volume/Pan/Mute/Solo updates.
 */
export class MultitrackPlayer {
  private ctx: AudioContext;
  private destination: AudioNode;
  private activeNodes: PlayingNode[] = [];
  private playing = false;
  private startCtxTime = 0;
  private totalDuration = 0;
  private endTimerId: number | null = null;

  constructor(ctx: AudioContext, destination: AudioNode) {
    this.ctx = ctx;
    this.destination = destination;
  }

  isPlaying() {
    return this.playing;
  }

  getPlayheadSec(): number {
    if (!this.playing) return 0;
    return Math.max(0, this.ctx.currentTime - this.startCtxTime);
  }

  start(tracks: StudioTrack[], onEnded?: () => void) {
    this.stop();
    if (tracks.length === 0) return;

    const now = this.ctx.currentTime + 0.03;
    this.startCtxTime = now;
    this.totalDuration = computeProjectDuration(tracks);
    this.playing = true;

    const anySolo = tracks.some((t) => t.solo);

    for (const track of tracks) {
      const src = this.ctx.createBufferSource();
      src.buffer = track.buffer;

      const gain = this.ctx.createGain();
      const audible = anySolo ? track.solo : !track.muted;
      gain.gain.value = audible ? track.volume : 0;

      const panner = this.ctx.createStereoPanner();
      panner.pan.value = Math.max(-1, Math.min(1, track.pan));

      src.connect(gain).connect(panner).connect(this.destination);

      const offsetSec = track.offsetMs / 1000;
      const when = now + Math.max(0, offsetSec);
      const extraTrim = offsetSec < 0 ? Math.abs(offsetSec) : 0;
      const startOffset = Math.min(track.trimEndSec, track.trimStartSec + extraTrim);
      const effectiveDur = Math.max(0, track.trimEndSec - startOffset);

      if (effectiveDur > 0.01) {
        src.start(when, startOffset, effectiveDur);
        this.activeNodes.push({ trackId: track.id, src, gain, panner });
      }
    }

    if (onEnded && this.totalDuration > 0) {
      this.endTimerId = window.setTimeout(() => {
        if (this.playing) {
          this.stop();
          onEnded();
        }
      }, (this.totalDuration + 0.12) * 1000);
    }
  }

  updateLiveMix(tracks: StudioTrack[]) {
    if (!this.playing) return;
    const now = this.ctx.currentTime;
    const anySolo = tracks.some((t) => t.solo);
    const byId = new Map(tracks.map((t) => [t.id, t]));

    for (const node of this.activeNodes) {
      const t = byId.get(node.trackId);
      if (!t) {
        node.gain.gain.setTargetAtTime(0, now, 0.015);
        continue;
      }
      const audible = anySolo ? t.solo : !t.muted;
      node.gain.gain.setTargetAtTime(audible ? t.volume : 0, now, 0.015);
      node.panner.pan.setTargetAtTime(Math.max(-1, Math.min(1, t.pan)), now, 0.015);
    }
  }

  stop() {
    this.playing = false;
    if (this.endTimerId !== null) {
      window.clearTimeout(this.endTimerId);
      this.endTimerId = null;
    }
    for (const n of this.activeNodes) {
      try {
        n.src.stop();
        n.src.disconnect();
        n.gain.disconnect();
        n.panner.disconnect();
      } catch {
        // ignore
      }
    }
    this.activeNodes = [];
  }
}
