import React from 'react';
import { Keyboard, Radio, Trash2, X } from 'lucide-react';
import { MidiDeviceSummary, MidiManager } from '../audio/midiManager';
import { MidiActionTarget, MidiBinding, PedalId } from '../types/pedalboard';
import { PEDAL_META } from './PedalUnit';

interface MidiModalProps {
  isOpen: boolean;
  onClose: () => void;
  supported: boolean;
  devices: MidiDeviceSummary[];
  bindings: MidiBinding[];
  learningTargetKey: string | null;
  onStartLearn: (label: string, target: MidiActionTarget) => void;
  onCancelLearn: () => void;
  onRemoveBinding: (id: string) => void;
}

const LEARNABLE_ACTIONS: { label: string; target: MidiActionTarget }[] = [
  ...(Object.keys(PEDAL_META) as PedalId[]).map((id) => ({
    label: `Pedal: ${PEDAL_META[id].title}`,
    target: { type: 'pedal', pedalId: id } as MidiActionTarget
  })),
  { label: 'Preset 1', target: { type: 'preset', index: 0 } },
  { label: 'Preset 2', target: { type: 'preset', index: 1 } },
  { label: 'Preset 3', target: { type: 'preset', index: 2 } },
  { label: 'Preset 4', target: { type: 'preset', index: 3 } },
  { label: 'Looper: Gravar / Tocar / Overdub', target: { type: 'looper-stomp' } },
  { label: 'Looper: Parar', target: { type: 'looper-stop' } },
  { label: 'Alternar Modo de Saída (Home Theater / Amp)', target: { type: 'output-mode' } },
  { label: 'Abrir / Fechar Afinador', target: { type: 'tuner-toggle' } }
];

export const MidiModal: React.FC<MidiModalProps> = ({
  isOpen,
  onClose,
  supported,
  devices,
  bindings,
  learningTargetKey,
  onStartLearn,
  onCancelLearn,
  onRemoveBinding
}) => {
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel midi-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2>Controlador MIDI & Atalhos de Teclado</h2>
            <p>Controle pedais, presets e looper pelo teclado do PC ou por uma pedaleira controladora MIDI USB</p>
          </div>
          <button type="button" className="btn-icon" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-grid">
          {/* Keyboard shortcuts */}
          <div className="modal-section">
            <div className="modal-section-head">
              <h3>
                <Keyboard size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} />
                Atalhos de Teclado
              </h3>
            </div>
            <div className="shortcut-table">
              <div><kbd>1</kbd> – <kbd>8</kbd><span>Trocar entre os Presets 1 a 8</span></div>
              <div><kbd>Q</kbd><span>Ligar / Desligar Noise Gate</span></div>
              <div><kbd>W</kbd><span>Ligar / Desligar Compressor</span></div>
              <div><kbd>E</kbd><span>Ligar / Desligar Overdrive / Distortion</span></div>
              <div><kbd>R</kbd><span>Ligar / Desligar 5-Band EQ</span></div>
              <div><kbd>Y</kbd><span>Ligar / Desligar Chorus</span></div>
              <div><kbd>U</kbd><span>Ligar / Desligar Delay</span></div>
              <div><kbd>I</kbd><span>Ligar / Desligar Reverb</span></div>
              <div><kbd>Espaço</kbd><span>Looper (Gravar → Tocar → Overdub)</span></div>
              <div><kbd>T</kbd><span>Abrir / Fechar Afinador Cromático</span></div>
              <div><kbd>M</kbd><span>Ligar / Parar Metrônomo</span></div>
              <div><kbd>B</kbd><span>Alternar Saída (Home Theater ↔ Amp)</span></div>
            </div>
          </div>

          {/* Web MIDI Learn */}
          <div className="modal-section">
            <div className="modal-section-head">
              <h3>
                <Radio size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} />
                Controlador MIDI (MIDI Learn)
              </h3>
            </div>

            {!supported ? (
              <p className="muted-p">
                Web MIDI não suportado neste navegador. Use Chrome ou Edge para conectar controladores MIDI USB (ex: M-Vave Chocolate, Behringer FCB1010).
              </p>
            ) : (
              <>
                <div className="midi-devices-box">
                  {devices.length === 0 ? (
                    <span className="muted-p">
                      Nenhum controlador MIDI USB conectado no momento. Plugue um controlador e clique em &quot;Aprender&quot; abaixo.
                    </span>
                  ) : (
                    devices.map((d) => (
                      <div key={d.id} className="midi-device-pill">
                        <span className="status-dot is-on" />
                        <strong>{d.name}</strong>
                        <span>{d.manufacturer}</span>
                      </div>
                    ))
                  )}
                </div>

                <div className="midi-learn-list">
                  {LEARNABLE_ACTIONS.map((act) => {
                    const key = MidiManager.targetKey(act.target);
                    const existing = bindings.find((b) => MidiManager.targetKey(b.target) === key);
                    const isLearning = learningTargetKey === key;

                    return (
                      <div key={key} className="midi-row">
                        <span className="midi-row-label">{act.label}</span>
                        <div className="midi-row-right">
                          {existing && (
                            <>
                              <span className="midi-bind-tag">{MidiManager.formatBinding(existing)}</span>
                              <button
                                type="button"
                                className="btn-icon-sm"
                                onClick={() => onRemoveBinding(existing.id)}
                                title="Remover mapeamento"
                              >
                                <Trash2 size={12} />
                              </button>
                            </>
                          )}
                          {isLearning ? (
                            <button type="button" className="btn-chip is-amber" onClick={onCancelLearn}>
                              Pise no pedal MIDI... (Cancelar)
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="btn-chip"
                              onClick={() => onStartLearn(act.label, act.target)}
                            >
                              Aprender
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
