import React from 'react';
import { RotateCcw, Square, Trash2 } from 'lucide-react';
import { LooperTelemetry } from '../types/pedalboard';
import { RotaryKnob } from './RotaryKnob';

interface LooperDeckProps {
  telemetry: LooperTelemetry;
  volume: number;
  engineReady: boolean;
  onStomp: () => void;
  onStop: () => void;
  onUndo: () => void;
  onClear: () => void;
  onVolumeChange: (val: number) => void;
}

export const LooperDeck: React.FC<LooperDeckProps> = ({
  telemetry,
  volume,
  engineReady,
  onStomp,
  onStop,
  onUndo,
  onClear,
  onVolumeChange
}) => {
  const { state, progress, durationSec, hasUndo, layers } = telemetry;

  const radius = 32;
  const circumference = 2 * Math.PI * radius;
  const strokeOffset =
    state === 'recording'
      ? circumference * (1 - Math.min(1, durationSec / 60))
      : circumference * (1 - Math.max(0, Math.min(1, progress)));

  const ringColor =
    state === 'recording'
      ? '#ef4444'
      : state === 'overdubbing'
      ? '#f59e0b'
      : state === 'playing'
      ? '#22c55e'
      : '#475569';

  const stompLabel =
    state === 'idle'
      ? 'GRAVAR'
      : state === 'recording'
      ? 'TOCAR'
      : state === 'playing'
      ? 'OVERDUB'
      : state === 'overdubbing'
      ? 'FECHAR DUB'
      : 'RETOMAR';

  const statusText =
    state === 'idle'
      ? 'Pronto (Espaço p/ gravar base)'
      : state === 'recording'
      ? `Gravando base... ${durationSec.toFixed(1)}s`
      : state === 'playing'
      ? `Tocando loop (${durationSec.toFixed(1)}s • ${layers} camada${layers > 1 ? 's' : ''})`
      : state === 'overdubbing'
      ? `Gravando camada ${layers} sobre o loop...`
      : `Pausado (${durationSec.toFixed(1)}s salvos)`;

  return (
    <div className="utility-card looper-deck">
      <div className="utility-header">
        <div>
          <span className="section-eyebrow">LOOPER PÓS-EFEITOS (TECLA ESPAÇO)</span>
          <p className="utility-status">{statusText}</p>
        </div>
        <span className={`looper-badge state-${state}`}>{state.toUpperCase()}</span>
      </div>

      <div className="looper-body">
        <button
          type="button"
          className={`looper-stomp-btn state-${state}`}
          disabled={!engineReady}
          onClick={onStomp}
          title="Espaço: Gravar → Tocar → Overdub (grave uma base limpa e troque de preset para solar!)"
        >
          <svg viewBox="0 0 80 80" width="76" height="76" className="looper-ring">
            <circle cx="40" cy="40" r={radius} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="5" />
            <circle
              cx="40"
              cy="40"
              r={radius}
              fill="none"
              stroke={ringColor}
              strokeWidth="5"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={state === 'idle' ? circumference : strokeOffset}
              transform="rotate(-90 40 40)"
            />
          </svg>
          <span className="looper-stomp-text">{stompLabel}</span>
        </button>

        <div className="looper-controls">
          <div className="looper-btn-row">
            <button
              type="button"
              className="btn-chip"
              disabled={!engineReady || state === 'idle' || state === 'stopped'}
              onClick={onStop}
              title="Parar reprodução mantendo o loop salvo"
            >
              <Square size={13} />
              <span>Stop</span>
            </button>
            <button
              type="button"
              className="btn-chip"
              disabled={!engineReady || !hasUndo}
              onClick={onUndo}
              title="Desfazer o último overdub gravado"
            >
              <RotateCcw size={13} />
              <span>Undo</span>
            </button>
            <button
              type="button"
              className="btn-chip is-danger"
              disabled={!engineReady || state === 'idle'}
              onClick={onClear}
              title="Apagar loop completamente"
            >
              <Trash2 size={13} />
              <span>Limpar</span>
            </button>
          </div>
          <p className="looper-tip">
            Dica: grave uma base no preset <strong>Clean</strong> e mude para <strong>Classic Rock</strong> para solar por cima!
          </p>
        </div>

        <RotaryKnob
          label="Loop Vol"
          value={Math.round(volume * 100)}
          min={0}
          max={130}
          defaultValue={85}
          unit="%"
          accentColor="#22c55e"
          size={50}
          onChange={(v) => onVolumeChange(v / 100)}
        />
      </div>
    </div>
  );
};
