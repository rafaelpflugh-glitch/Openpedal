import React, { useRef } from 'react';
import { AlertTriangle, FileAudio, Mic, MicOff, Music, Play, RefreshCw, Square, X } from 'lucide-react';
import { AudioDeviceList } from '../audio/OpenPedalEngine';
import { InputChannelMode, TestRiffStyle } from '../types/pedalboard';

interface AudioSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  engineReady: boolean;
  liveActive: boolean;
  devices: AudioDeviceList;
  selectedInputId: string;
  selectedOutputId: string;
  channelMode: InputChannelMode;
  inputGainDb: number;
  latencyInfo: { baseLatencyMs: number; outputLatencyMs: number; sampleRate: number };
  testRiffPlaying: boolean;
  testRiffStyle: TestRiffStyle;
  diFileName: string;
  diFilePlaying: boolean;
  errorMsg: string | null;
  onRefreshDevices: () => void;
  onSelectInput: (id: string) => void;
  onSelectOutput: (id: string) => void;
  onChannelModeChange: (mode: InputChannelMode) => void;
  onInputGainChange: (db: number) => void;
  onToggleLiveInput: () => void;
  onTestRiffStyleChange: (style: TestRiffStyle) => void;
  onToggleTestRiff: () => void;
  onUploadDiFile: (file: File) => void;
  onToggleDiFile: () => void;
}

export const AudioSetupModal: React.FC<AudioSetupModalProps> = ({
  isOpen,
  onClose,
  engineReady,
  liveActive,
  devices,
  selectedInputId,
  selectedOutputId,
  channelMode,
  inputGainDb,
  latencyInfo,
  testRiffPlaying,
  testRiffStyle,
  diFileName,
  diFilePlaying,
  errorMsg,
  onRefreshDevices,
  onSelectInput,
  onSelectOutput,
  onChannelModeChange,
  onInputGainChange,
  onToggleLiveInput,
  onTestRiffStyleChange,
  onToggleTestRiff,
  onUploadDiFile,
  onToggleDiFile
}) => {
  const diRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel audio-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2>Configuração de Áudio & Cabo P10 → P2</h2>
            <p>
              Sample Rate: <strong>{(latencyInfo.sampleRate / 1000).toFixed(1)} kHz</strong> •
              Latência estimada:{' '}
              <strong>{(latencyInfo.baseLatencyMs + latencyInfo.outputLatencyMs).toFixed(1)} ms</strong>
            </p>
          </div>
          <button type="button" className="btn-icon" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {errorMsg && (
          <div className="alert-banner">
            <AlertTriangle size={16} />
            <span>{errorMsg}</span>
          </div>
        )}

        <div className="modal-grid">
          {/* Live Input & Output Device Selection */}
          <div className="modal-section">
            <div className="modal-section-head">
              <h3>1. Entrada da Guitarra & Saída de Som</h3>
              <button type="button" className="btn-chip" onClick={onRefreshDevices}>
                <RefreshCw size={13} />
                <span>Atualizar</span>
              </button>
            </div>

            <div className="form-field">
              <label>Dispositivo de Entrada (Line-In / Mic / Interface USB)</label>
              <select value={selectedInputId} onChange={(e) => onSelectInput(e.target.value)}>
                <option value="">Entrada Padrão do Windows</option>
                {devices.inputs.map((d) => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.label || `Entrada ${d.deviceId.slice(0, 6)}`}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-field">
              <label>Canal Mono da Guitarra (muito importante para P10→P2 e Interfaces!)</label>
              <div className="segmented-3">
                {(['left', 'right', 'mix'] as InputChannelMode[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    className={channelMode === m ? 'is-active' : ''}
                    onClick={() => onChannelModeChange(m)}
                  >
                    {m === 'left' ? 'Esquerdo (Ch 1)' : m === 'right' ? 'Direito (Ch 2)' : 'Soma (L+R)'}
                  </button>
                ))}
              </div>
            </div>

            <div className="form-field">
              <label>
                Ganho de Entrada (Trim): <strong>{inputGainDb > 0 ? `+${inputGainDb}` : inputGainDb} dB</strong>
              </label>
              <input
                type="range"
                min={-12}
                max={24}
                step={0.5}
                value={inputGainDb}
                onChange={(e) => onInputGainChange(Number(e.target.value))}
              />
            </div>

            <div className="form-field">
              <label>Dispositivo de Saída (Home Theater / Amplificador / Fones)</label>
              <select value={selectedOutputId} onChange={(e) => onSelectOutput(e.target.value)}>
                <option value="">Saída Padrão do Windows</option>
                {devices.outputs.map((d) => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.label || `Saída ${d.deviceId.slice(0, 6)}`}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              className={`btn-wide ${liveActive ? 'is-danger-solid' : 'is-success-solid'}`}
              onClick={onToggleLiveInput}
            >
              {liveActive ? <MicOff size={16} /> : <Mic size={16} />}
              <span>{liveActive ? 'Desligar Entrada ao Vivo' : 'Ativar Entrada da Guitarra (Ao Vivo)'}</span>
            </button>
          </div>

          {/* Built-in Test Guitar + DI Player */}
          <div className="modal-section">
            <h3>2. Guitarra de Teste Interna (Sem Precisar Plugar)</h3>
            <p className="muted-p">
              Gera sinal seco (DI) direto na entrada da pedaleira para você testar timbres, pedais, Cab Sim e Looper agora mesmo.
            </p>

            <div className="form-field">
              <label>Estilo do Riff de Teste</label>
              <select
                value={testRiffStyle}
                onChange={(e) => onTestRiffStyleChange(e.target.value as TestRiffStyle)}
              >
                <option value="clean-arpeggio">Arpejo Clean Strat (Em9 - Cmaj7 - G - D)</option>
                <option value="blues-lick">Blues Shuffle c/ Vibrato em Lá</option>
                <option value="rock-power">Power Chords Rock Clássico</option>
                <option value="gilmour-lead">Solo Sustentado c/ Vibrato (p/ Big Muff & Wah)</option>
                <option value="metal-chug">Palm-Mute Metal em Mi</option>
              </select>
            </div>

            <button
              type="button"
              className={`btn-wide ${testRiffPlaying ? 'is-amber-solid' : 'is-accent-solid'}`}
              disabled={!engineReady}
              onClick={onToggleTestRiff}
            >
              {testRiffPlaying ? <Square size={15} /> : <Play size={15} />}
              <span>{testRiffPlaying ? 'Parar Guitarra de Teste' : 'Tocar Guitarra de Teste'}</span>
            </button>

            <div className="divider-line" />

            <div className="form-field">
              <label>Ou carregue um áudio gravado da sua guitarra (.wav / .mp3)</label>
              <input
                ref={diRef}
                type="file"
                accept="audio/*"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onUploadDiFile(f);
                  e.target.value = '';
                }}
              />
              <div className="di-row">
                <button
                  type="button"
                  className="btn-chip"
                  disabled={!engineReady}
                  onClick={() => diRef.current?.click()}
                >
                  <FileAudio size={14} />
                  <span>{diFileName ? diFileName : 'Carregar DI (.wav/.mp3)'}</span>
                </button>
                {diFileName && (
                  <button type="button" className="btn-chip is-accent" onClick={onToggleDiFile}>
                    {diFilePlaying ? <Square size={13} /> : <Music size={13} />}
                    <span>{diFilePlaying ? 'Parar' : 'Loopar DI'}</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Practical Connection Guide */}
        <div className="guide-box">
          <h4>Guia Rápido — Ligando com Cabo P10→P2 hoje e no Home Theater / Amplificador</h4>
          <ul>
            <li>
              <strong>Entrada do PC (P10→P2):</strong> prefira a entrada <strong>Line-In (azul)</strong> se o seu PC tiver, pois distorce menos que a entrada de microfone (rosa). Se usar a entrada de microfone, deixe o <em>Boost de Microfone</em> do Windows em <strong>0 dB</strong> e ajuste o volume pelo <strong>Ganho de Entrada</strong> aqui no OpenPedal.
            </li>
            <li>
              <strong>Ruído / Chiado 60Hz:</strong> mantenha o pedal <strong>Noise Gate</strong> ligado com o botão <strong>Filtro 60Hz ON</strong>. Ele corta o zumbido típico de cabos P10→P2 e aterramento.
            </li>
            <li>
              <strong>Tocando no Home Theater:</strong> deixe o Modo de Saída em <strong>Home Theater / Fones</strong> (Cab Sim ativo + limiter de segurança) e <strong>comece com o volume do Home Theater baixo</strong> para evitar microfonia caso a guitarra fique muito perto das caixas.
            </li>
            <li>
              <strong>Tocando num Amplificador de Guitarra:</strong> mude para <strong>Frente do Amp</strong> (usa só os pedais) ou <strong>Amp FX Return</strong> (usa pedais + pré-amp, desligando o Cab Sim).
            </li>
            <li>
              <strong>Quando comprar uma Interface USB (Focusrite, Behringer, M-Audio):</strong> basta selecioná-la aqui na Entrada/Saída — a latência cai para ~5ms e o sinal fica nível estúdio!
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};
