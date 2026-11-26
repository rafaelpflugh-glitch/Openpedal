import React, { useMemo, useState } from 'react';
import { Sparkles, X } from 'lucide-react';
import { ALL_LEGENDARY_PRESETS } from '../data/factoryPresets';
import { Preset } from '../types/pedalboard';

interface LegendaryPresetsModalProps {
  isOpen: boolean;
  activePresetId: string;
  onSelect: (preset: Preset) => void;
  onClose: () => void;
}

export const LegendaryPresetsModal: React.FC<LegendaryPresetsModalProps> = ({
  isOpen,
  activePresetId,
  onSelect,
  onClose
}) => {
  const [selectedCat, setSelectedCat] = useState<string>('Todos');

  const categories = useMemo(() => {
    const set = new Set<string>(ALL_LEGENDARY_PRESETS.map((p) => p.category));
    return ['Todos', ...Array.from(set)];
  }, []);

  const filtered = useMemo(() => {
    if (selectedCat === 'Todos') return ALL_LEGENDARY_PRESETS;
    return ALL_LEGENDARY_PRESETS.filter((p) => p.category === selectedCat);
  }, [selectedCat]);

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel legends-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2>
              <Sparkles size={18} style={{ verticalAlign: 'middle', marginRight: 6, color: '#fbbf24' }} />
              Biblioteca de Timbres Lendários (Grandes Guitarristas)
            </h2>
            <p>
              Presets inspirados nos rigs históricos do rock, blues, grunge, psicodélico e metal — clique para carregar na hora!
            </p>
          </div>
          <button type="button" className="btn-icon" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="category-tabs" style={{ marginBottom: 14 }}>
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              className={`cat-tab ${selectedCat === cat ? 'is-active' : ''}`}
              onClick={() => setSelectedCat(cat)}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="legends-grid">
          {filtered.map((preset) => {
            const isActive = preset.id === activePresetId;
            const enabledCount = Object.values(preset.rig.pedals).filter((p) => p.enabled).length;
            return (
              <button
                key={preset.id}
                type="button"
                className={`legend-card ${isActive ? 'is-active' : ''}`}
                onClick={() => {
                  onSelect(preset);
                  onClose();
                }}
              >
                <div className="legend-card-top">
                  <span className="legend-cat">{preset.category}</span>
                  <span className="legend-pedals-count">{enabledCount} pedais</span>
                </div>
                <strong>{preset.name}</strong>
                {preset.artist && <span className="legend-artist">{preset.artist}</span>}
                {preset.description && <p className="legend-desc">{preset.description}</p>}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
