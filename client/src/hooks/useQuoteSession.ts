// Notebook CPQ — Session State Management Hook

import { useState, useCallback } from 'react';
import type {
  NotebookSession,
  ExtractionResult,
  QuoteResult,
  Area,
  InputCellState,
  ExtractionCellState,
  QuoteCellState,
  ExportCellState,
} from '../engine/types';
import { extractQuoteParameters } from '../engine/extract';
import { calculateQuote, applyMarginTarget } from '../engine/pricing';
import { MARGIN_DEFAULT } from '../engine/constants';

const initialSession: NotebookSession = {
  input: '',
  inputState: 'empty',
  extraction: null,
  extractionState: 'hidden',
  quote: null,
  quoteState: 'hidden',
  exportState: 'hidden',
  conversationHistory: [],
  error: null,
};

export function useQuoteSession() {
  const [session, setSession] = useState<NotebookSession>(initialSession);

  const setInput = useCallback((input: string) => {
    setSession(prev => ({
      ...prev,
      input,
      inputState: input.length > 0 ? 'writing' : 'empty',
      error: null,
    }));
  }, []);

  const extract = useCallback(async () => {
    setSession(prev => ({
      ...prev,
      inputState: 'extracting',
      extractionState: 'loading',
      error: null,
    }));

    try {
      const existingAreas = session.extraction?.areas;
      const result = await extractQuoteParameters(
        session.input,
        undefined,
        existingAreas && existingAreas.length > 0 ? existingAreas : undefined,
        session.conversationHistory.length > 0 ? session.conversationHistory : undefined
      );

      setSession(prev => ({
        ...prev,
        inputState: 'done',
        extraction: result,
        extractionState: 'review',
        quoteState: 'hidden',
        exportState: 'hidden',
        conversationHistory: [
          ...prev.conversationHistory,
          { role: 'user', content: prev.input },
          { role: 'assistant', content: JSON.stringify(result) },
        ],
      }));
    } catch (err) {
      setSession(prev => ({
        ...prev,
        inputState: 'writing',
        extractionState: 'hidden',
        error: err instanceof Error ? err.message : 'Extraction failed',
      }));
    }
  }, [session.input, session.extraction, session.conversationHistory]);

  const updateArea = useCallback((areaId: string, updates: Partial<Area>) => {
    setSession(prev => {
      if (!prev.extraction) return prev;
      const updatedAreas = prev.extraction.areas.map(area =>
        area.id === areaId ? { ...area, ...updates } : area
      );
      return {
        ...prev,
        extraction: { ...prev.extraction, areas: updatedAreas },
      };
    });
  }, []);

  const removeArea = useCallback((areaId: string) => {
    setSession(prev => {
      if (!prev.extraction) return prev;
      return {
        ...prev,
        extraction: {
          ...prev.extraction,
          areas: prev.extraction.areas.filter(a => a.id !== areaId),
        },
      };
    });
  }, []);

  const updateExtractionField = useCallback((field: string, value: string | number) => {
    setSession(prev => {
      if (!prev.extraction) return prev;
      return {
        ...prev,
        extraction: { ...prev.extraction, [field]: value },
      };
    });
  }, []);

  const confirmAndPrice = useCallback(() => {
    if (!session.extraction) return;

    setSession(prev => ({
      ...prev,
      extractionState: 'confirmed',
      quoteState: 'calculating',
    }));

    try {
      const quoteInput = {
        areas: session.extraction.areas,
        dispatchLocation: session.extraction.dispatchLocation,
        distance: session.extraction.distance,
        marginTarget: MARGIN_DEFAULT,
        paymentTerms: session.extraction.paymentTerms || 'owner',
        risks: session.extraction.risks || [],
      };

      const result = calculateQuote(quoteInput);

      setSession(prev => ({
        ...prev,
        quote: result,
        quoteState: 'ready',
        exportState: 'available',
      }));
    } catch (err) {
      setSession(prev => ({
        ...prev,
        quoteState: 'hidden',
        error: err instanceof Error ? err.message : 'Pricing calculation failed',
      }));
    }
  }, [session.extraction]);

  const adjustMargin = useCallback((marginTarget: number) => {
    if (!session.quote) return;

    const adjusted = applyMarginTarget(session.quote, marginTarget);
    setSession(prev => ({
      ...prev,
      quote: adjusted,
    }));
  }, [session.quote]);

  const startFollowUp = useCallback(() => {
    setSession(prev => ({
      ...prev,
      input: '',
      inputState: 'empty',
      extractionState: prev.extraction ? 'review' : 'hidden',
      quoteState: 'hidden',
      exportState: 'hidden',
      error: null,
    }));
  }, []);

  const reset = useCallback(() => {
    setSession(initialSession);
  }, []);

  return {
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
  };
}
