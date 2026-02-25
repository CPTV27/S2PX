import { KeyboardEvent } from 'react';
import { Loader2, SendHorizonal, RotateCcw } from 'lucide-react';
import { motion } from 'motion/react';
import type { InputCellState } from '../../engine/types';

interface InputCellProps {
  value: string;
  state: InputCellState;
  isFollowUp: boolean;
  onChange: (value: string) => void;
  onExtract: () => void;
  onReset: () => void;
}

export function InputCell({ value, state, isFollowUp, onChange, onExtract, onReset }: InputCellProps) {
  const isExtracting = state === 'extracting';
  const canExtract = value.trim().length > 0 && !isExtracting;

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && e.shiftKey && canExtract) {
      e.preventDefault();
      onExtract();
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="nb-cell"
    >
      <span className="nb-cell-number">[1] {isFollowUp ? 'follow-up' : 'input'}</span>

      <textarea
        className="nb-textarea"
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={
          isFollowUp
            ? "Modify the quote... (e.g., 'Make the hospital interior-only scope')"
            : "Describe the project... (e.g., '120k sqft hospital, LOD 300 arch and MEP, dispatching from Woodstock, 80 miles')"
        }
        disabled={isExtracting}
      />

      <div className="flex items-center justify-between mt-3">
        <span className="nb-label">
          {isExtracting ? 'Extracting parameters...' : 'Shift+Enter to extract'}
        </span>

        <div className="flex items-center gap-2">
          {isFollowUp && (
            <button className="nb-btn nb-btn-ghost" onClick={onReset}>
              <RotateCcw size={14} />
              New Quote
            </button>
          )}
          <button
            className="nb-btn nb-btn-primary"
            onClick={onExtract}
            disabled={!canExtract}
          >
            {isExtracting ? (
              <>
                <Loader2 size={14} className="nb-spinner" />
                Extracting
              </>
            ) : (
              <>
                <SendHorizonal size={14} />
                Extract
              </>
            )}
          </button>
        </div>
      </div>
    </motion.div>
  );
}
