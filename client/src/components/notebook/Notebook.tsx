import { AnimatePresence } from 'motion/react';
import { useQuoteSession } from '../../hooks/useQuoteSession';
import { InputCell } from './InputCell';
import { ExtractionCell } from './ExtractionCell';
import { QuoteCell } from './QuoteCell';
import { QuoteExport } from './QuoteExport';

export function Notebook() {
  const {
    session,
    setInput,
    extract,
    updateArea,
    removeArea,
    updateExtractionField,
    confirmAndPrice,
    adjustMargin,
    startFollowUp,
    reset,
  } = useQuoteSession();

  const isFollowUp = session.conversationHistory.length > 0;

  return (
    <div className="max-w-4xl mx-auto">
      {/* Error banner */}
      {session.error && (
        <div className="nb-error mb-4">
          {session.error}
        </div>
      )}

      {/* Input Cell — always visible */}
      <InputCell
        value={session.input}
        state={session.inputState}
        isFollowUp={isFollowUp}
        onChange={setInput}
        onExtract={extract}
        onReset={reset}
      />

      {/* Extraction Cell — progressive reveal */}
      <AnimatePresence>
        {session.extractionState !== 'hidden' && session.extraction && (
          <ExtractionCell
            extraction={session.extraction}
            state={session.extractionState}
            onUpdateArea={updateArea}
            onRemoveArea={removeArea}
            onUpdateField={updateExtractionField}
            onConfirm={confirmAndPrice}
          />
        )}
      </AnimatePresence>

      {/* Loading state for extraction */}
      <AnimatePresence>
        {session.extractionState === 'loading' && !session.extraction && (
          <ExtractionCell
            extraction={{ areas: [], dispatchLocation: '', distance: 0, risks: [], paymentTerms: '', confidence: 0, ambiguities: [], rawInput: '' }}
            state="loading"
            onUpdateArea={() => {}}
            onRemoveArea={() => {}}
            onUpdateField={() => {}}
            onConfirm={() => {}}
          />
        )}
      </AnimatePresence>

      {/* Quote Cell */}
      <AnimatePresence>
        {session.quote && session.quoteState !== 'hidden' && (
          <QuoteCell
            quote={session.quote}
            state={session.quoteState}
            onAdjustMargin={adjustMargin}
          />
        )}
      </AnimatePresence>

      {/* Export Cell */}
      <AnimatePresence>
        {session.quote && session.exportState !== 'hidden' && (
          <QuoteExport
            quote={session.quote}
            state={session.exportState}
            onFollowUp={startFollowUp}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
