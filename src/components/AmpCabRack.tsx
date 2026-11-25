import React, { useRef } from 'react';
import { Home, Radio, Sliders, Upload } from 'lucide-react';
import { AmpCabState, AmpModel, CabModel, OutputMode } from '../types/pedalboard';
import { RotaryKnob } from './RotaryKnob';

interface AmpCabRackProps {
  ampCab: AmpCabState;
  outputMode: OutputMode;
  onAmpCabChange: (patch: Partial<AmpCabState>) => void;
  onOutputModeChange: (mode: OutputMode) => void;
  onLoadCustomIr: (file: File) => void;
}

const AMP_MODELS: { id: AmpModel; name: string; desc: string }[] = [
  { id: 'clean-twin', name: 'Clean Twin', desc: 'Valvulado limpo brilhante' },
  { id: 'british-crunch', name: 'British Crunch', desc: 'Rock clássico encorpado' },
  { id: 'modern-metal', name: 'Modern Metal', desc: 'Alto ganho agressivo' },
  { id: 'acoustic-direct', name: 'Acoustic / DI', desc: 'Pré limpo transparente' }
];

const CAB_MODELS: { id: Exclude<CabModel, 'custom-ir'>; name: string }[] = [
  { id: '4x12-v30', name: '4x12 V30 (Rock/Metal)' },
  { id: '2x12-open', name: '2x12 Open (Clean/Blues)' },
  { id: '1x12-tweed', name: '1x12 Tweed (Vintage)' },
  { id: '4x10-clean', name: '4x10 Wide (Limpo/Violão)' }
];

export const AmpCabRack: React.FC<AmpCabRackProps> = ({
  ampCab,
  outputMode,
  onAmpCabChange,
  onOutputModeChange,
  onLoadCustomIr
}) => {
  const irInputRef = useRef<HTMLInputElement>(null);

  const effectiveAmpOn = outputMode !== 'amp-front' && ampCab.ampEnabled;
  const effectiveCabOn = outputMode === 'home-theater' && ampCab.cabEnabled;

  return (
    <section className="amp-cab-rack">
      {/* Output Mode Banner: Home Theater vs Amplificador */}
      <div className="output-mode-bar">
        <div className="output-mode-label">
          <span className="section-eyebrow">MODO DE SAÍDA (TECLA B)</span>
          <span className="output-mode-hint">
            {outputMode === 'home-theater' &&
              'Cab Sim ATIVO + Limiter de proteção — ideal para Home Theater, caixas de som ou fones.'}
            {outputMode === 'amp-return' &&
              'Pré-Amp ATIVO / Cab Sim DESLIGADO — plugue no FX Return / Power Amp In do amplificador.'}
            {outputMode === 'amp-front' &&
              'Amp & Cab em BYPASS — apenas os pedais ativos para plugar na entrada frontal do amplificador.'}
          </span>
        </div>

        <div className="output-mode-switcher">
          <button
            type="button"
            className={`output-btn ${outputMode === 'home-theater' ? 'is-active' : ''}`}
            onClick={() => onOutputModeChange('home-theater')}
          >
            <Home size={15} />
            <span>Home Theater / Fones</span>
          </button>
          <button
            type="button"
            className={`output-btn ${outputMode === 'amp-return' ? 'is-active' : ''}`}
            onClick={() => onOutputModeChange('amp-return')}
          >
            <Radio size={15} />
            <span>Amp (FX Return)</span>
          </button>
          <button
            type="button"
            className={`output-btn ${outputMode === 'amp-front' ? 'is-active' : ''}`}
            onClick={() => onOutputModeChange('amp-front')}
          >
            <Sliders size={15} />
            <span>Frente do Amp</span>
          </button>
        </div>
      </div>

      {/* Amp Head & Cabinet Sim Panels */}
      <div className="amp-cab-grid">
        {/* AMP HEAD */}
        <div className={`amp-head-panel ${effectiveAmpOn ? '' : 'is-dimmed'}`}>
          <div className="rack-header">
            <div className="rack-title-group">
              <span className={`rack-led ${effectiveAmpOn ? 'is-on' : ''}`} />
              <div>
                <h2>SIMULADOR DE AMPLIFICADOR</h2>
                <p>Pré-amplificador valvulado 4x oversampled</p>
              </div>
            </div>
            <button
              type="button"
              className={`power-toggle ${ampCab.ampEnabled && outputMode !== 'amp-front' ? 'is-on' : ''}`}
              disabled={outputMode === 'amp-front'}
              onClick={() => onAmpCabChange({ ampEnabled: !ampCab.ampEnabled })}
            >
              {outputMode === 'amp-front'
                ? 'BYPASS (MODO AMP)'
                : ampCab.ampEnabled
                ? 'AMP LIGADO'
                : 'AMP BYPASS'}
            </button>
          </div>

          <div className="amp-model-tabs">
            {AMP_MODELS.map((m) => (
              <button
                key={m.id}
                type="button"
                className={`amp-tab ${ampCab.ampModel === m.id ? 'is-active' : ''}`}
                onClick={() => onAmpCabChange({ ampModel: m.id })}
                title={m.desc}
              >
                <strong>{m.name}</strong>
                <span>{m.desc}</span>
              </button>
            ))}
          </div>

          <div className="amp-knobs-row">
            <RotaryKnob
              label="Gain"
              value={ampCab.gain}
              min={0}
              max={100}
              defaultValue={40}
              accentColor="#f97316"
              size={54}
              onChange={(v) => onAmpCabChange({ gain: v })}
            />
            <RotaryKnob
              label="Bass"
              value={ampCab.bass}
              min={0}
              max={100}
              defaultValue={50}
              accentColor="#f97316"
              size={54}
              onChange={(v) => onAmpCabChange({ bass: v })}
            />
            <RotaryKnob
              label="Mid"
              value={ampCab.mid}
              min={0}
              max={100}
              defaultValue={50}
              accentColor="#f97316"
              size={54}
              onChange={(v) => onAmpCabChange({ mid: v })}
            />
            <RotaryKnob
              label="Treble"
              value={ampCab.treble}
              min={0}
              max={100}
              defaultValue={55}
              accentColor="#f97316"
              size={54}
              onChange={(v) => onAmpCabChange({ treble: v })}
            />
            <RotaryKnob
              label="Presence"
              value={ampCab.presence}
              min={0}
              max={100}
              defaultValue={55}
              accentColor="#f97316"
              size={54}
              onChange={(v) => onAmpCabChange({ presence: v })}
            />
            <RotaryKnob
              label="Master"
              value={ampCab.master}
              min={0}
              max={100}
              defaultValue={72}
              accentColor="#22c55e"
              size={54}
              onChange={(v) => onAmpCabChange({ master: v })}
            />
          </div>
        </div>

        {/* CABINET SIMULATOR / IR LOADER */}
        <div className={`cab-panel ${effectiveCabOn ? '' : 'is-dimmed'}`}>
          <div className="rack-header">
            <div className="rack-title-group">
              <span className={`rack-led cab-led ${effectiveCabOn ? 'is-on' : ''}`} />
              <div>
                <h2>CAB SIM / IMPULSE RESPONSE</h2>
                <p>Simulação acústica de falante de guitarra</p>
              </div>
            </div>
            <button
              type="button"
              className={`power-toggle ${effectiveCabOn ? 'is-on' : ''}`}
              disabled={outputMode !== 'home-theater'}
              onClick={() => onAmpCabChange({ cabEnabled: !ampCab.cabEnabled })}
            >
              {outputMode !== 'home-theater'
                ? 'AUTO OFF (AMP)'
                : ampCab.cabEnabled
                ? 'CAB LIGADO'
                : 'CAB BYPASS'}
            </button>
          </div>

          <div className="cab-list">
            {CAB_MODELS.map((c) => (
              <button
                key={c.id}
                type="button"
                className={`cab-option ${ampCab.cabModel === c.id ? 'is-active' : ''}`}
                onClick={() => onAmpCabChange({ cabModel: c.id })}
              >
                <span className="speaker-dot" />
                <span>{c.name}</span>
              </button>
            ))}

            <div className="custom-ir-row">
              <input
                ref={irInputRef}
                type="file"
                accept=".wav,audio/wav,audio/*"
                hidden
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) onLoadCustomIr(file);
                  e.target.value = '';
                }}
              />
              <button
                type="button"
                className={`cab-option custom-ir-btn ${ampCab.cabModel === 'custom-ir' ? 'is-active' : ''}`}
                onClick={() => irInputRef.current?.click()}
              >
                <Upload size={14} />
                <span>
                  {ampCab.customIrName
                    ? `IR Custom: ${ampCab.customIrName}`
                    : 'Carregar Impulse Response (.WAV)'}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
