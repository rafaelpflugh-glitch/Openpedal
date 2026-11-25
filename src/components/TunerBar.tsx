import React, { useEffect, useState } from 'react';
import { Volume2, VolumeX, X } from 'lucide-react';
import { OpenPedalEngine } from '../audio/OpenPedalEngine';
import { STANDARD_GUITAR_STRINGS } from '../audio/tuner';
import { TunerReading } from '../types/pedalboard';

interface TunerBarProps {
  engine: OpenPedalEngine;
  isOpen: boolean;
  muted: boolean;
  onToggleMute: () => void;
  onClose: () => void;
}

export const TunerBar: React.FC<TunerBarProps> = ({
  engine,
  isOpen,
  muted,
  onToggleMute,
  onClose
}) => {
  const [reading, setReading] = useState<TunerReading>({
    note: '--',
    octave: 0,
    frequency: 0,
    cents: 0,
    clarity: 0,
    detected: false
  });

  useEffect(() => {
    if (!isOpen) return;
    let rafId = 0;
    let lastUpdate = 0;

    const tick = (now: number) => {
      if (now - lastUpdate > 45) {
        lastUpdate = now;
        if (engine.isInitialized()) {
          setReading(engine.getTunerReading());
        }
      }
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [engine, isOpen]);

  if (!isOpen) return null;

  const clampedCents = Math.max(-50, Math.min(50, reading.cents));
  const needlePosPct = 50 + clampedCents; // 0% to 100%
  const inTune = reading.detected && Math.abs(reading.cents) <= 5;
  const flat = reading.detected && reading.cents < -5;
  const sharp = reading.detected && reading.cents > 5;

  const closestString = reading.detected
    ? STANDARD_GUITAR_STRINGS.reduce((best, curr) =>
        Math.abs(curr.freq - reading.frequency) < Math.abs(best.freq - reading.frequency) ? curr : best
      )
    : null;

  return (
    <div className="tuner-drawer">
      <div className="tuner-header">
        <div className="tuner-title">
          <span className="section-eyebrow">AFINADOR CROMÁTICO EM TEMPO REAL (PRÉ-EFEITOS)</span>
          <span className="tuner-hint">Toque uma corda solta por vez — capta o sinal limpo antes da distorção</span>
        </div>
        <div className="tuner-actions">
          <button
            type="button"
            className={`btn-chip ${muted ? 'is-danger' : ''}`}
            onClick={onToggleMute}
          >
            {muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
            <span>{muted ? 'Saída Mutada' : 'Mutar ao Afinar'}</span>
          </button>
          <button type="button" className="btn-icon" onClick={onClose} title="Fechar afinador (Tecla T)">
            <X size={16} />
          </button>
        </div>
      </div>

      <div className="tuner-body">
        <div className={`tuner-note-box ${inTune ? 'in-tune' : ''}`}>
          <span className="tuner-direction">{flat ? '▲ SUBIR' : sharp ? '▼ DESCER' : inTune ? '✓ AFINADO' : 'AGUARDANDO'}</span>
          <div className="tuner-note-value">
            {reading.detected ? (
              <>
                {reading.note}
                <small>{reading.octave}</small>
              </>
            ) : (
              '--'
            )}
          </div>
          <span className="tuner-hz">
            {reading.detected ? `${reading.frequency.toFixed(1)} Hz (${reading.cents > 0 ? '+' : ''}${reading.cents} cents)` : '440 Hz Ref'}
          </span>
        </div>

        <div className="tuner-gauge-col">
          <div className="tuner-scale-labels">
            <span>-50¢</span>
            <span>-25¢</span>
            <span className={inTune ? 'in-tune-text' : ''}>0</span>
            <span>+25¢</span>
            <span>+50¢</span>
          </div>
          <div className="tuner-bar-track">
            <div className="tuner-center-zone" />
            <div
              className={`tuner-needle ${inTune ? 'in-tune' : reading.detected ? 'active' : ''}`}
              style={{ left: `${reading.detected ? needlePosPct : 50}%` }}
            />
          </div>

          <div className="guitar-strings-row">
            {STANDARD_GUITAR_STRINGS.map((str) => {
              const isMatch = closestString?.label === str.label && Math.abs(str.freq - reading.frequency) < 18;
              return (
                <div
                  key={str.label}
                  className={`string-pill ${isMatch ? (inTune ? 'is-tuned' : 'is-near') : ''}`}
                >
                  <strong>{str.label}</strong>
                  <span>{str.freq.toFixed(0)} Hz</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
