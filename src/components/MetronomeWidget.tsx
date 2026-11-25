import React, { useRef } from 'react';
import { Play, Square } from 'lucide-react';

interface MetronomeWidgetProps {
  running: boolean;
  bpm: number;
  beatsPerBar: number;
  currentBeat: number;
  volume: number;
  engineReady: boolean;
  onToggle: () => void;
  onBpmChange: (bpm: number) => void;
  onBeatsChange: (beats: number) => void;
  onVolumeChange: (vol: number) => void;
}

export const MetronomeWidget: React.FC<MetronomeWidgetProps> = ({
  running,
  bpm,
  beatsPerBar,
  currentBeat,
  volume,
  engineReady,
  onToggle,
  onBpmChange,
  onBeatsChange,
  onVolumeChange
}) => {
  const tapsRef = useRef<number[]>([]);

  const handleTap = () => {
    const now = performance.now();
    const valid = tapsRef.current.filter((t) => now - t < 2200);
    valid.push(now);
    tapsRef.current = valid.slice(-6);
    if (valid.length >= 2) {
      let sum = 0;
      for (let i = 1; i < valid.length; i++) sum += valid[i] - valid[i - 1];
      const avgMs = sum / (valid.length - 1);
      onBpmChange(Math.max(40, Math.min(240, Math.round(60000 / avgMs))));
    }
  };

  return (
    <div className="utility-card metronome-card">
      <div className="utility-header">
        <div>
          <span className="section-eyebrow">METRÔNOMO (TECLA M)</span>
          <p className="utility-status">Saída limpa — não entra na distorção nem no Looper</p>
        </div>
        <div className="beat-leds">
          {Array.from({ length: beatsPerBar }).map((_, idx) => (
            <span
              key={idx}
              className={`beat-led ${running && currentBeat === idx ? (idx === 0 ? 'is-accent' : 'is-lit') : ''}`}
            />
          ))}
        </div>
      </div>

      <div className="metronome-body">
        <button
          type="button"
          className={`btn-primary-sm ${running ? 'is-running' : ''}`}
          disabled={!engineReady}
          onClick={onToggle}
        >
          {running ? <Square size={14} /> : <Play size={14} />}
          <span>{running ? 'Parar' : 'Tocar'}</span>
        </button>

        <div className="bpm-group">
          <button type="button" className="btn-step" onClick={() => onBpmChange(Math.max(40, bpm - 1))}>
            -
          </button>
          <div className="bpm-readout">
            <strong>{bpm}</strong>
            <span>BPM</span>
          </div>
          <button type="button" className="btn-step" onClick={() => onBpmChange(Math.min(240, bpm + 1))}>
            +
          </button>
          <button type="button" className="btn-chip" onClick={handleTap}>
            TAP
          </button>
        </div>

        <div className="metro-extras">
          <select
            value={beatsPerBar}
            onChange={(e) => onBeatsChange(Number(e.target.value))}
            className="compact-select"
            title="Compasso"
          >
            <option value={4}>4/4</option>
            <option value={3}>3/4</option>
            <option value={6}>6/8</option>
            <option value={2}>2/4</option>
          </select>

          <label className="vol-slider-label" title="Volume do metrônomo">
            <span>Vol</span>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(volume * 100)}
              onChange={(e) => onVolumeChange(Number(e.target.value) / 100)}
            />
          </label>
        </div>
      </div>
    </div>
  );
};
