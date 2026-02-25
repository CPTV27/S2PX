import { useState } from 'react';
import { motion } from 'motion/react';
import { Copy, Download, Check, MessageSquarePlus } from 'lucide-react';
import type { QuoteResult, ExportCellState } from '../../engine/types';
import { formatCurrency } from '@/lib/utils';
import { BUILDING_TYPES } from '../../engine/constants';

interface QuoteExportProps {
  quote: QuoteResult;
  state: ExportCellState;
  onFollowUp: () => void;
}

function buildClipboardText(quote: QuoteResult): string {
  const lines: string[] = [];
  lines.push('SCAN2PLAN QUOTE');
  lines.push('═'.repeat(40));
  lines.push('');

  // Group by area
  const areas = new Map<string, typeof quote.lineItems>();
  for (const li of quote.lineItems) {
    if (!areas.has(li.areaId)) areas.set(li.areaId, []);
    areas.get(li.areaId)!.push(li);
  }

  for (const [, items] of areas) {
    if (items[0].areaId === 'travel') continue;
    lines.push(`▸ ${items[0].areaName}`);
    const typeName = BUILDING_TYPES[items[0].buildingType]?.name || items[0].buildingType;
    lines.push(`  Type: ${typeName} | ${items[0].sqft.toLocaleString()} sqft`);
    for (const li of items) {
      lines.push(`  ${li.discipline.toUpperCase()} LOD ${li.lod} ${li.scope} → ${formatCurrency(li.clientPrice)}`);
    }
    lines.push('');
  }

  lines.push('─'.repeat(40));
  if (quote.subtotals.modeling > 0) lines.push(`Modeling:    ${formatCurrency(quote.subtotals.modeling)}`);
  if (quote.subtotals.services > 0) lines.push(`Services:    ${formatCurrency(quote.subtotals.services)}`);
  if (quote.subtotals.elevations > 0) lines.push(`Elevations:  ${formatCurrency(quote.subtotals.elevations)}`);
  if (quote.subtotals.travel > 0) lines.push(`Travel:      ${formatCurrency(quote.subtotals.travel)}`);
  lines.push(`Subtotal:    ${formatCurrency(quote.totalClientPrice)}`);
  if (quote.paymentTermPremium > 0) {
    lines.push(`Pay Term:   +${formatCurrency(quote.paymentTermPremium)}`);
  }
  lines.push('─'.repeat(40));
  lines.push(`GRAND TOTAL: ${formatCurrency(quote.grandTotal)}`);
  lines.push(`Margin:      ${quote.grossMarginPercent.toFixed(1)}%`);
  lines.push(`Integrity:   ${quote.integrityStatus.toUpperCase()}`);

  return lines.join('\n');
}

export function QuoteExport({ quote, state, onFollowUp }: QuoteExportProps) {
  const [copied, setCopied] = useState(false);

  if (state === 'hidden') return null;

  async function handleCopy() {
    const text = buildClipboardText(quote);
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleDownloadJSON() {
    const blob = new Blob([JSON.stringify(quote, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `scan2plan-quote-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="nb-cell"
    >
      <span className="nb-cell-number">[4] export</span>

      <div className="flex flex-wrap items-center gap-3">
        <button className="nb-btn nb-btn-primary" onClick={handleCopy}>
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? 'Copied!' : 'Copy Quote'}
        </button>

        <button className="nb-btn nb-btn-ghost" onClick={handleDownloadJSON}>
          <Download size={14} />
          Download JSON
        </button>

        <button className="nb-btn nb-btn-ghost" onClick={onFollowUp}>
          <MessageSquarePlus size={14} />
          Follow-Up
        </button>
      </div>
    </motion.div>
  );
}
