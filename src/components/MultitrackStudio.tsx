import React, { useEffect, useRef, useState } from 'react';
import {
  Circle,
  Copy,
  Download,
  Layers,
  Play,
  Scissors,
  Square,
  Trash2,
  Upload,
  Volume2,
  X
} from 'lucide-react';
import { OpenPedalEngine } from '../audio/OpenPedalEngine';
import {
  computeProjectDuration,
  extractWaveformPeaks,
  pickTrackColor,
  renderMixdownWav
} from '../audio/multitrackStudio';
import { StudioTrack } from '../types/pedalboard';

interface TrackWaveformProps {
  track: StudioTrack;
  projectDuration: number;
  playheadSec: number;
  isPlaying: boolean;
}

const TrackWaveform: React.FC<TrackWaveformProps> = ({
  track,
  projectDuration,
  playheadSec,
  isPlaying
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // Background
    ctx.fillStyle = '#0a0e17';
    ctx.fillRect(0, 0, w, h);

    // Center line
    ctx.strokeStyle = 'rgba(148,163,184,0.16)';
    ctx.beginPath();
    ctx.moveTo(0, h / 2);
    ctx.lineTo(w, h / 2);
    ctx.stroke();

    const totalRef = Math.max(projectDuration, track.durationSec, 0.5);
    const barCount = track.peaks.length;
    const trackWidthPx = (track.durationSec / totalRef) * w;
    const offsetPx = (track.offsetMs / 1000 / totalRef) * w;
    const barW = Math.max(1.5, trackWidthPx / Math.max(1, barCount));

    const trimStartRatio = track.trimStartSec / Math.max(0.01, track.durationSec);
    const trimEndRatio = track.trimEndSec / Math.max(0.01, track.durationSec);

    for (let i = 0; i < barCount; i++) {
      const ratio = i / barCount;
      const x = offsetPx + ratio * trackWidthPx;
      if (x < -barW || x > w) continue;

      const insideTrim = ratio >= trimStartRatio && ratio <= trimEndRatio;
      const amp = Math.max(0.06, track.peaks[i]) * (h * 0.44);
      ctx.fillStyle = insideTrim
        ? track.muted
          ? 'rgba(148,163,184,0.35)'
          : track.color
        : 'rgba(100,116,139,0.22)';
      ctx.fillRect(x, h / 2 - amp, Math.max(1, barW - 1), amp * 2);
    }

    // Trim markers
    const tStartX = offsetPx + trimStartRatio * trackWidthPx;
    const tEndX = offsetPx + trimEndRatio * trackWidthPx;
    ctx.strokeStyle = 'rgba(255,255,255,0.45)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(tStartX, 0);
    ctx.lineTo(tStartX, h);
    ctx.moveTo(tEndX, 0);
    ctx.lineTo(tEndX, h);
    ctx.stroke();

    // Live Playhead
    if (isPlaying && totalRef > 0) {
      const playX = (playheadSec / totalRef) * w;
      if (playX >= 0 && playX <= w) {
        ctx.strokeStyle = '#f8fafc';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(playX, 0);
        ctx.lineTo(playX, h);
        ctx.stroke();
      }
    }
  }, [track, projectDuration, playheadSec, isPlaying]);

  return <canvas ref={canvasRef} width={520} height={54} className="studio-wave-canvas" />;
};

interface MultitrackStudioProps {
  isOpen: boolean;
  engine: OpenPedalEngine;
  onEnsureEngine: () => Promise<boolean>;
  onClose: () => void;
  onNotify: (msg: string) => void;
}

export const MultitrackStudio: React.FC<MultitrackStudioProps> = ({
  isOpen,
  engine,
  onEnsureEngine,
  onClose,
  onNotify
}) => {
  const [tracks, setTracks] = useState<StudioTrack[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [recElapsedSec, setRecElapsedSec] = useState(0);
  const [playheadSec, setPlayheadSec] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [expandedEditId, setExpandedEditId] = useState<string | null>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const recStartMsRef = useRef(0);

  const projectDuration = Math.max(computeProjectDuration(tracks), isRecording ? recElapsedSec : 0);

  // Sync live volume/pan/mute/solo changes during playback
  useEffect(() => {
    if (isPlaying) {
      engine.studioUpdateLiveMix(tracks);
    }
  }, [tracks, isPlaying, engine]);

  // Animate playhead & recording timer
  useEffect(() => {
    if (!isPlaying && !isRecording) return;
    let rafId = 0;
    const tick = () => {
      if (isRecording) {
        const elapsed = (performance.now() - recStartMsRef.current) / 1000;
        setRecElapsedSec(elapsed);
        setPlayheadSec(elapsed);
      } else if (isPlaying) {
        setPlayheadSec(engine.studioGetPlayheadSec());
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [isPlaying, isRecording, engine]);

  if (!isOpen) return null;

  const handleToggleRecord = async () => {
    const ok = await onEnsureEngine();
    if (!ok) return;

    if (!isRecording) {
      // Start isolated recording + play existing tracks in sync!
      engine.studioStopPlayback();
      recStartMsRef.current = performance.now();
      setRecElapsedSec(0);
      setIsRecording(true);
      if (tracks.length > 0) {
        engine.studioPlayTracks(tracks);
        setIsPlaying(true);
      }
      engine.startStudioRecording();
      onNotify(
        tracks.length > 0
          ? 'Gravando nova camada ouvindo as faixas anteriores (sem vazamento)!'
          : 'Gravando Faixa 1 — toque sua guitarra, teclado ou bateria!'
      );
    } else {
      // Stop recording & create track
      engine.studioStopPlayback();
      setIsPlaying(false);
      setIsRecording(false);
      const buf = await engine.stopStudioRecording();
      if (!buf) {
        onNotify('Gravação muito curta — descartada.');
        return;
      }

      const newTrack: StudioTrack = {
        id: `trk-${Date.now()}`,
        name: `Faixa ${tracks.length + 1}`,
        color: pickTrackColor(tracks.length),
        buffer: buf,
        peaks: extractWaveformPeaks(buf),
        durationSec: buf.duration,
        volume: 0.95,
        pan: 0,
        muted: false,
        solo: false,
        trimStartSec: 0,
        trimEndSec: buf.duration,
        offsetMs: 0
      };
      setTracks((prev) => [...prev, newTrack]);
      onNotify(`"${newTrack.name}" gravada (${buf.duration.toFixed(1)}s)!`);
    }
  };

  const handleTogglePlay = async () => {
    if (tracks.length === 0) return;
    const ok = await onEnsureEngine();
    if (!ok) return;

    if (isPlaying) {
      engine.studioStopPlayback();
      setIsPlaying(false);
      setPlayheadSec(0);
    } else {
      setIsPlaying(true);
      engine.studioPlayTracks(tracks, () => {
        setIsPlaying(false);
        setPlayheadSec(0);
      });
    }
  };

  const handleImportAudio = async (file: File) => {
    const ok = await onEnsureEngine();
    if (!ok) return;
    try {
      const trk = await engine.decodeAudioFileToTrack(file, tracks.length);
      setTracks((prev) => [...prev, trk]);
      onNotify(`Faixa importada: ${trk.name}`);
    } catch {
      onNotify('Erro ao decodificar o arquivo de áudio.');
    }
  };

  const handleExportMixdown = async () => {
    if (tracks.length === 0) return;
    setExporting(true);
    try {
      const wavBlob = await renderMixdownWav(tracks, engine.getSampleRate());
      const url = URL.createObjectURL(wavBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `openpedal-mix-${new Date().toISOString().slice(0, 10)}.wav`;
      a.click();
      URL.revokeObjectURL(url);
      onNotify('Mixagem final (.WAV estéreo) exportada com sucesso!');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Erro ao exportar mixagem.');
    } finally {
      setExporting(false);
    }
  };

  const updateTrack = (id: string, patch: Partial<StudioTrack>) => {
    setTracks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  };

  const duplicateTrack = (trk: StudioTrack) => {
    const copy: StudioTrack = {
      ...trk,
      id: `trk-${Date.now()}`,
      name: `${trk.name} (Cópia)`,
      color: pickTrackColor(tracks.length)
    };
    setTracks((prev) => [...prev, copy]);
  };

  const deleteTrack = (id: string) => {
    setTracks((prev) => prev.filter((t) => t.id !== id));
    if (expandedEditId === id) setExpandedEditId(null);
  };

  return (
    <section className="studio-drawer">
      <div className="studio-header">
        <div className="studio-title">
          <Layers size={18} style={{ color: '#38bdf8' }} />
          <div>
            <h2>ESTÚDIO MULTIPISTA (GRAVADOR DE CAMADAS & MIXDOWN .WAV)</h2>
            <p>
              Grave bateria, baixo, guitarra base e solo em faixas separadas sem vazamento, edite cada camada e junte tudo em 1 arquivo .WAV!
            </p>
          </div>
        </div>
        <button type="button" className="btn-icon" onClick={onClose} title="Fechar Estúdio Multipista">
          <X size={16} />
        </button>
      </div>

      {/* Transport Bar */}
      <div className="studio-transport">
        <div className="studio-transport-left">
          <button
            type="button"
            className={`btn-rec ${isRecording ? 'is-recording' : ''}`}
            onClick={handleToggleRecord}
          >
            <Circle size={13} fill={isRecording ? '#fff' : '#ef4444'} />
            <span>
              {isRecording
                ? `Parar Gravação (${recElapsedSec.toFixed(1)}s)`
                : tracks.length > 0
                ? 'Gravar Nova Camada'
                : 'Gravar Faixa 1'}
            </span>
          </button>

          <button
            type="button"
            className="btn-pill"
            disabled={tracks.length === 0 || isRecording}
            onClick={handleTogglePlay}
          >
            {isPlaying ? <Square size={14} /> : <Play size={14} />}
            <span>{isPlaying ? 'Parar' : 'Tocar Tudo'}</span>
          </button>

          <span className="studio-clock">
            {playheadSec.toFixed(1)}s / {projectDuration.toFixed(1)}s • {tracks.length} faixa{tracks.length === 1 ? '' : 's'}
          </span>
        </div>

        <div className="studio-transport-right">
          <input
            ref={importRef}
            type="file"
            accept="audio/*"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleImportAudio(f);
              e.target.value = '';
            }}
          />
          <button
            type="button"
            className="btn-chip"
            disabled={isRecording}
            onClick={() => importRef.current?.click()}
            title="Importar backing track ou áudio externo (.wav / .mp3)"
          >
            <Upload size={13} />
            <span>Importar Faixa</span>
          </button>

          <button
            type="button"
            className="btn-export-wav"
            disabled={tracks.length === 0 || isRecording || exporting}
            onClick={handleExportMixdown}
            title="Mixar todas as faixas ativas com volume, pan e cortes em 1 arquivo .WAV"
          >
            <Download size={14} />
            <span>{exporting ? 'Mixando...' : 'Juntar Tudo (.WAV)'}</span>
          </button>
        </div>
      </div>

      {/* Track Lanes */}
      {tracks.length === 0 ? (
        <div className="studio-empty">
          Nenhuma faixa gravada ainda. Clique em <strong>Gravar Faixa 1</strong> e toque a bateria, o teclado ou sua guitarra! Depois clique em <strong>Gravar Nova Camada</strong> para gravar outro instrumento por cima em sincronia.
        </div>
      ) : (
        <div className="studio-tracks-list">
          {tracks.map((trk) => {
            const isEditing = expandedEditId === trk.id;
            return (
              <div key={trk.id} className="studio-track-card">
                <div className="track-main-row">
                  {/* Left: Color bar, Name, Mute/Solo */}
                  <div className="track-info-col" style={{ borderLeftColor: trk.color }}>
                    <input
                      type="text"
                      className="track-name-input"
                      value={trk.name}
                      onChange={(e) => updateTrack(trk.id, { name: e.target.value })}
                    />
                    <div className="track-ms-row">
                      <button
                        type="button"
                        className={`ms-btn ${trk.muted ? 'is-muted' : ''}`}
                        onClick={() => updateTrack(trk.id, { muted: !trk.muted })}
                        title="Mutar faixa"
                      >
                        M
                      </button>
                      <button
                        type="button"
                        className={`ms-btn ${trk.solo ? 'is-solo' : ''}`}
                        onClick={() => updateTrack(trk.id, { solo: !trk.solo })}
                        title="Solar apenas esta faixa"
                      >
                        S
                      </button>
                      <button
                        type="button"
                        className={`btn-icon-sm ${isEditing ? 'is-active-edit' : ''}`}
                        onClick={() => setExpandedEditId(isEditing ? null : trk.id)}
                        title="Editar corte (Trim) e sincronia (ms)"
                      >
                        <Scissors size={12} />
                      </button>
                      <button
                        type="button"
                        className="btn-icon-sm"
                        onClick={() => duplicateTrack(trk)}
                        title="Duplicar faixa"
                      >
                        <Copy size={12} />
                      </button>
                      <button
                        type="button"
                        className="btn-icon-sm"
                        onClick={() => deleteTrack(trk.id)}
                        title="Excluir faixa"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>

                  {/* Center: Waveform Visualizer */}
                  <div className="track-wave-col">
                    <TrackWaveform
                      track={trk}
                      projectDuration={projectDuration}
                      playheadSec={playheadSec}
                      isPlaying={isPlaying}
                    />
                  </div>

                  {/* Right: Volume & Pan */}
                  <div className="track-mixer-col">
                    <label className="mini-slider">
                      <span>
                        <Volume2 size={11} /> {Math.round(trk.volume * 100)}%
                      </span>
                      <input
                        type="range"
                        min={0}
                        max={150}
                        value={Math.round(trk.volume * 100)}
                        onChange={(e) => updateTrack(trk.id, { volume: Number(e.target.value) / 100 })}
                      />
                    </label>
                    <label className="mini-slider">
                      <span>
                        Pan {trk.pan === 0 ? 'C' : trk.pan < 0 ? `L${Math.round(-trk.pan * 100)}` : `R${Math.round(trk.pan * 100)}`}
                      </span>
                      <input
                        type="range"
                        min={-100}
                        max={100}
                        value={Math.round(trk.pan * 100)}
                        onDoubleClick={() => updateTrack(trk.id, { pan: 0 })}
                        onChange={(e) => updateTrack(trk.id, { pan: Number(e.target.value) / 100 })}
                      />
                    </label>
                  </div>
                </div>

                {/* Expandable Edit Panel (Trim Start/End + Sync Offset) */}
                {isEditing && (
                  <div className="track-edit-bar">
                    <label>
                      <span>Cortar Início: <strong>{trk.trimStartSec.toFixed(2)}s</strong></span>
                      <input
                        type="range"
                        min={0}
                        max={Math.max(0.1, trk.trimEndSec - 0.1)}
                        step={0.05}
                        value={trk.trimStartSec}
                        onChange={(e) => updateTrack(trk.id, { trimStartSec: Number(e.target.value) })}
                      />
                    </label>
                    <label>
                      <span>Cortar Fim: <strong>{trk.trimEndSec.toFixed(2)}s</strong></span>
                      <input
                        type="range"
                        min={Math.min(trk.durationSec, trk.trimStartSec + 0.1)}
                        max={trk.durationSec}
                        step={0.05}
                        value={trk.trimEndSec}
                        onChange={(e) => updateTrack(trk.id, { trimEndSec: Number(e.target.value) })}
                      />
                    </label>
                    <label>
                      <span>Alinhar Sincronia: <strong>{trk.offsetMs > 0 ? `+${trk.offsetMs}` : trk.offsetMs} ms</strong></span>
                      <input
                        type="range"
                        min={-400}
                        max={400}
                        step={5}
                        value={trk.offsetMs}
                        onDoubleClick={() => updateTrack(trk.id, { offsetMs: 0 })}
                        onChange={(e) => updateTrack(trk.id, { offsetMs: Number(e.target.value) })}
                      />
                    </label>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};
