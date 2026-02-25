import { Loader2, Check, AlertTriangle, X, Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import type { ExtractionResult, Area, Discipline, ExtractionCellState } from '../../engine/types';
import { BUILDING_TYPES, DISPATCH_LOCATIONS } from '../../engine/constants';

interface ExtractionCellProps {
  extraction: ExtractionResult;
  state: ExtractionCellState;
  onUpdateArea: (areaId: string, updates: Partial<Area>) => void;
  onRemoveArea: (areaId: string) => void;
  onUpdateField: (field: string, value: string | number) => void;
  onConfirm: () => void;
}

const DISCIPLINES: Discipline[] = ['arch', 'mepf', 'structure', 'site'];
const LODS = ['200', '300', '350'];
const SCOPES = ['full', 'interior', 'exterior', 'mixed'] as const;
const RISKS = ['occupied', 'hazardous', 'no_power'] as const;
const PAYMENT_TERMS = ['partner', 'owner', 'net30', 'net60', 'net90'];

function ConfidenceBadge({ confidence }: { confidence: number }) {
  const pct = Math.round(confidence * 100);
  const cls = pct >= 80 ? 'nb-confidence-high' : pct >= 60 ? 'nb-confidence-medium' : 'nb-confidence-low';
  return <span className={`nb-confidence ${cls}`}>{pct}% confidence</span>;
}

function AreaCard({
  area,
  onUpdate,
  onRemove,
  isConfirmed,
}: {
  area: Area;
  onUpdate: (updates: Partial<Area>) => void;
  onRemove: () => void;
  isConfirmed: boolean;
}) {
  const isLandscape = area.buildingType === '14' || area.buildingType === '15';

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="nb-area-card"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 mr-3">
          <input
            className="nb-input w-full text-sm font-medium"
            value={area.name}
            onChange={e => onUpdate({ name: e.target.value })}
            disabled={isConfirmed}
            style={{ fontFamily: 'var(--nb-font-serif)', fontSize: '0.95rem' }}
          />
        </div>
        {!isConfirmed && (
          <button onClick={onRemove} className="text-[var(--nb-text-dim)] hover:text-[var(--nb-error)] transition-colors p-1">
            <X size={16} />
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
        {/* Building Type */}
        <div>
          <label className="nb-label block mb-1">Building Type</label>
          <select
            className="nb-select w-full"
            value={area.buildingType}
            onChange={e => onUpdate({ buildingType: e.target.value })}
            disabled={isConfirmed}
          >
            {Object.entries(BUILDING_TYPES).map(([id, bt]) => (
              <option key={id} value={id}>{id}. {bt.name}</option>
            ))}
          </select>
        </div>

        {/* Square Feet / Acres */}
        <div>
          <label className="nb-label block mb-1">{isLandscape ? 'Acres' : 'Square Feet'}</label>
          <input
            type="number"
            className="nb-input w-full"
            value={area.squareFeet}
            onChange={e => onUpdate({ squareFeet: Number(e.target.value) || 0 })}
            disabled={isConfirmed}
            min={0}
          />
        </div>

        {/* LOD */}
        <div>
          <label className="nb-label block mb-1">LOD</label>
          <select
            className="nb-select w-full"
            value={area.lod || '300'}
            onChange={e => onUpdate({ lod: e.target.value })}
            disabled={isConfirmed}
          >
            {LODS.map(l => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>
        </div>

        {/* Scope */}
        <div>
          <label className="nb-label block mb-1">Scope</label>
          <select
            className="nb-select w-full"
            value={area.scope}
            onChange={e => onUpdate({ scope: e.target.value as Area['scope'] })}
            disabled={isConfirmed}
          >
            {SCOPES.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Disciplines */}
      <div className="mb-3">
        <label className="nb-label block mb-1.5">Disciplines</label>
        <div className="flex flex-wrap gap-2">
          {DISCIPLINES.map(d => (
            <label key={d} className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                className="nb-checkbox"
                checked={area.disciplines.includes(d)}
                onChange={e => {
                  const newDiscs = e.target.checked
                    ? [...area.disciplines, d]
                    : area.disciplines.filter(x => x !== d);
                  onUpdate({ disciplines: newDiscs });
                }}
                disabled={isConfirmed}
              />
              <span className="font-mono text-xs text-[var(--nb-text-muted)]">{d}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Risks */}
      <div className="mb-3">
        <label className="nb-label block mb-1.5">Risks</label>
        <div className="flex flex-wrap gap-2">
          {RISKS.map(r => (
            <label key={r} className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                className="nb-checkbox"
                checked={area.risks?.includes(r) || false}
                onChange={e => {
                  const current = area.risks || [];
                  const newRisks = e.target.checked
                    ? [...current, r]
                    : current.filter(x => x !== r);
                  onUpdate({ risks: newRisks });
                }}
                disabled={isConfirmed}
              />
              <span className="font-mono text-xs text-[var(--nb-text-muted)]">{r.replace('_', ' ')}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* Additional Elevations */}
        <div>
          <label className="nb-label block mb-1">Additional Elevations</label>
          <input
            type="number"
            className="nb-input w-full"
            value={area.additionalElevations || 0}
            onChange={e => onUpdate({ additionalElevations: Number(e.target.value) || 0 })}
            disabled={isConfirmed}
            min={0}
          />
        </div>

        {/* Matterport */}
        <div className="flex items-end pb-1">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              className="nb-checkbox"
              checked={area.includeMatterport || false}
              onChange={e => onUpdate({ includeMatterport: e.target.checked })}
              disabled={isConfirmed}
            />
            <span className="font-mono text-xs text-[var(--nb-text-muted)]">Include Matterport</span>
          </label>
        </div>
      </div>
    </motion.div>
  );
}

export function ExtractionCell({
  extraction,
  state,
  onUpdateArea,
  onRemoveArea,
  onUpdateField,
  onConfirm,
}: ExtractionCellProps) {
  if (state === 'hidden') return null;

  if (state === 'loading') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="nb-cell flex items-center justify-center py-8"
      >
        <Loader2 size={24} className="nb-spinner text-[var(--nb-accent)]" />
        <span className="ml-3 text-[var(--nb-text-muted)] font-mono text-sm">
          Extracting parameters...
        </span>
      </motion.div>
    );
  }

  const isConfirmed = state === 'confirmed';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="nb-cell"
    >
      <span className="nb-cell-number">[2] extraction</span>

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h3 className="font-medium text-[var(--nb-text)]" style={{ fontFamily: 'var(--nb-font-serif)' }}>
            Extracted Parameters
          </h3>
          <ConfidenceBadge confidence={extraction.confidence} />
        </div>
        <span className="font-mono text-xs text-[var(--nb-text-dim)]">
          {extraction.areas.length} area{extraction.areas.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Ambiguities */}
      {extraction.ambiguities.length > 0 && (
        <div className="nb-ambiguity mb-4">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle size={14} />
            <span className="font-mono text-xs font-medium uppercase tracking-wider">Notes</span>
          </div>
          <ul className="text-sm space-y-0.5">
            {extraction.ambiguities.map((a, i) => (
              <li key={i}>- {a}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Area Cards */}
      <AnimatePresence>
        {extraction.areas.map(area => (
          <AreaCard
            key={area.id}
            area={area}
            onUpdate={updates => onUpdateArea(area.id, updates)}
            onRemove={() => onRemoveArea(area.id)}
            isConfirmed={isConfirmed}
          />
        ))}
      </AnimatePresence>

      {/* Global fields */}
      <div className="grid grid-cols-3 gap-3 mt-4 mb-4">
        <div>
          <label className="nb-label block mb-1">Dispatch Location</label>
          <select
            className="nb-select w-full"
            value={extraction.dispatchLocation}
            onChange={e => onUpdateField('dispatchLocation', e.target.value)}
            disabled={isConfirmed}
          >
            {DISPATCH_LOCATIONS.map(loc => (
              <option key={loc} value={loc}>{loc}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="nb-label block mb-1">Distance (miles)</label>
          <input
            type="number"
            className="nb-input w-full"
            value={extraction.distance}
            onChange={e => onUpdateField('distance', Number(e.target.value) || 0)}
            disabled={isConfirmed}
            min={0}
          />
        </div>
        <div>
          <label className="nb-label block mb-1">Payment Terms</label>
          <select
            className="nb-select w-full"
            value={extraction.paymentTerms}
            onChange={e => onUpdateField('paymentTerms', e.target.value)}
            disabled={isConfirmed}
          >
            {PAYMENT_TERMS.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Confirm button */}
      {!isConfirmed && (
        <div className="flex justify-end">
          <button
            className="nb-btn nb-btn-primary"
            onClick={onConfirm}
            disabled={extraction.areas.length === 0}
          >
            <Check size={14} />
            Confirm & Price
          </button>
        </div>
      )}
    </motion.div>
  );
}
