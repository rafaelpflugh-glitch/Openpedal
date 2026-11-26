import React, { useRef, useState } from 'react';
import { Download, Plus, Save, Sparkles, Trash2, Upload } from 'lucide-react';
import { Preset } from '../types/pedalboard';

interface PresetBarProps {
  presets: Preset[];
  activePresetId: string;
  isDirty: boolean;
  onSelect: (preset: Preset) => void;
  onOpenLegends: () => void;
  onSaveCurrent: () => void;
  onSaveAsNew: (name: string) => void;
  onDelete: (id: string) => void;
  onExport: () => void;
  onImport: (file: File) => void;
}

export const PresetBar: React.FC<PresetBarProps> = ({
  presets,
  activePresetId,
  isDirty,
  onSelect,
  onOpenLegends,
  onSaveCurrent,
  onSaveAsNew,
  onDelete,
  onExport,
  onImport
}) => {
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const activePreset = presets.find((p) => p.id === activePresetId);

  const submitNew = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newName.trim();
    if (!trimmed) return;
    onSaveAsNew(trimmed);
    setNewName('');
    setCreating(false);
  };

  return (
    <div className="preset-bar">
      <div className="preset-list">
        <button
          type="button"
          className="btn-legends"
          onClick={onOpenLegends}
          title="Abrir biblioteca completa de presets inspirados nos grandes guitarristas (Gilmour, Hendrix, Slash, Van Halen, SRV, Metallica...)"
        >
          <Sparkles size={13} />
          <span>Timbres Lendários</span>
        </button>

        {presets.map((preset, idx) => {
          const isActive = preset.id === activePresetId;
          return (
            <button
              key={preset.id}
              type="button"
              className={`preset-slot ${isActive ? 'is-active' : ''}`}
              onClick={() => onSelect(preset)}
              title={`${preset.name} (${preset.category})${idx < 8 ? ` — Tecla ${idx + 1}` : ''}`}
            >
              <span className="preset-num">{idx < 8 ? idx + 1 : '•'}</span>
              <span className="preset-name">
                {preset.name}
                {isActive && isDirty ? ' *' : ''}
              </span>
            </button>
          );
        })}
      </div>

      <div className="preset-actions">
        {creating ? (
          <form className="preset-new-form" onSubmit={submitNew}>
            <input
              type="text"
              placeholder="Nome do preset..."
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              autoFocus
            />
            <button type="submit" className="btn-chip is-accent">
              Salvar
            </button>
            <button type="button" className="btn-chip" onClick={() => setCreating(false)}>
              Cancelar
            </button>
          </form>
        ) : (
          <>
            {activePreset && !activePreset.factory && (
              <button
                type="button"
                className="btn-chip"
                onClick={onSaveCurrent}
                title="Sobrescrever este preset com os ajustes atuais"
              >
                <Save size={13} />
                <span>Atualizar</span>
              </button>
            )}
            <button
              type="button"
              className="btn-chip is-accent"
              onClick={() => setCreating(true)}
              title="Salvar configuração atual como novo preset"
            >
              <Plus size={13} />
              <span>Salvar Novo</span>
            </button>
            {activePreset && !activePreset.factory && (
              <button
                type="button"
                className="btn-chip is-danger"
                onClick={() => onDelete(activePreset.id)}
                title="Excluir preset personalizado"
              >
                <Trash2 size={13} />
              </button>
            )}
            <button type="button" className="btn-chip" onClick={onExport} title="Exportar presets (.json)">
              <Download size={13} />
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".json,application/json"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onImport(file);
                e.target.value = '';
              }}
            />
            <button
              type="button"
              className="btn-chip"
              onClick={() => fileRef.current?.click()}
              title="Importar presets (.json)"
            >
              <Upload size={13} />
            </button>
          </>
        )}
      </div>
    </div>
  );
};
