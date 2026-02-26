import { motion } from 'motion/react';
import { CheckCircle2, AlertTriangle, Ban } from 'lucide-react';
import type { QuoteResult, QuoteCellState } from '../../engine/types';
import { BUILDING_TYPES } from '../../engine/constants';
import { formatCurrency } from '@/lib/utils';
import { MarginSlider } from './MarginSlider';
import { Loader2 } from 'lucide-react';

interface QuoteCellProps {
  quote: QuoteResult;
  state: QuoteCellState;
  onAdjustMargin: (margin: number) => void;
}

function IntegrityBadge({ status, flags }: { status: string; flags: Array<{ message: string; severity: string }> }) {
  if (status === 'passed') {
    return (
      <div>
        <span className="nb-badge nb-badge-passed">
          <CheckCircle2 size={12} /> PASSED
        </span>
      </div>
    );
  }
  if (status === 'warning') {
    return (
      <div>
        <span className="nb-badge nb-badge-warning">
          <AlertTriangle size={12} /> WARNING
        </span>
        {flags.map((f, i) => (
          <p key={i} className="text-xs text-[var(--nb-warning)] mt-1 font-mono">{f.message}</p>
        ))}
      </div>
    );
  }
  return (
    <div>
      <span className="nb-badge nb-badge-blocked">
        <Ban size={12} /> BLOCKED
      </span>
      {flags.map((f, i) => (
        <p key={i} className="text-xs text-[var(--nb-error)] mt-1 font-mono">{f.message}</p>
      ))}
    </div>
  );
}

export function QuoteCell({ quote, state, onAdjustMargin }: QuoteCellProps) {
  if (state === 'hidden') return null;

  if (state === 'calculating') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="nb-cell flex items-center justify-center py-8"
      >
        <Loader2 size={24} className="nb-spinner text-[var(--nb-accent)]" />
        <span className="ml-3 text-[var(--nb-text-muted)] font-mono text-sm">
          Calculating pricing...
        </span>
      </motion.div>
    );
  }

  const grossProfit = quote.grandTotal - quote.totalUpteamCost;

  // Group line items by area
  const areaGroups = new Map<string, typeof quote.lineItems>();
  for (const li of quote.lineItems) {
    const key = li.areaId;
    if (!areaGroups.has(key)) areaGroups.set(key, []);
    areaGroups.get(key)!.push(li);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="nb-cell"
    >
      <span className="nb-cell-number">[3] quote</span>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="nb-kpi">
          <div className="nb-kpi-label">Grand Total</div>
          <div className="nb-kpi-value text-[var(--nb-accent)]">{formatCurrency(quote.grandTotal)}</div>
        </div>
        <div className="nb-kpi">
          <div className="nb-kpi-label">Upteam Cost</div>
          <div className="nb-kpi-value">{formatCurrency(quote.totalUpteamCost)}</div>
        </div>
        <div className="nb-kpi">
          <div className="nb-kpi-label">Gross Profit</div>
          <div className="nb-kpi-value text-[var(--nb-success)]">{formatCurrency(grossProfit)}</div>
        </div>
        <div className="nb-kpi">
          <div className="nb-kpi-label">Margin</div>
          <div className="nb-kpi-value" style={{
            color: quote.grossMarginPercent < 40 ? 'var(--nb-error)' : quote.grossMarginPercent < 46 ? 'var(--nb-warning)' : 'var(--nb-success)'
          }}>
            {quote.grossMarginPercent.toFixed(1)}%
          </div>
        </div>
      </div>

      {/* Margin Slider */}
      <div className="mb-6">
        <MarginSlider
          value={quote.grossMargin}
          onChange={onAdjustMargin}
        />
      </div>

      {/* Integrity */}
      <div className="mb-6">
        <IntegrityBadge status={quote.integrityStatus} flags={quote.integrityFlags} />
      </div>

      {quote.isTierA && (
        <div className="nb-ambiguity mb-4">
          <span className="font-mono text-xs font-medium">TIER A PROJECT</span> — Total sqft exceeds 50,000. Manual review recommended.
        </div>
      )}

      {/* Line Items Table */}
      <div className="overflow-x-auto mb-4">
        <table className="nb-table">
          <thead>
            <tr>
              <th>Area / Discipline</th>
              <th>Type</th>
              <th>Sqft</th>
              <th>LOD</th>
              <th>Scope</th>
              <th className="text-right">Client</th>
              <th className="text-right">Upteam</th>
            </tr>
          </thead>
          <tbody>
            {Array.from(areaGroups.entries()).map(([areaId, items]) => (
              items.map((li, idx) => (
                <tr key={li.id}>
                  <td>
                    {idx === 0 && areaId !== 'travel' && (
                      <span className="text-[var(--nb-text)] text-xs font-medium block mb-0.5">
                        {li.areaName}
                      </span>
                    )}
                    <span className="text-xs">{li.discipline}</span>
                    {li.riskMultiplier > 1 && (
                      <span className="text-[var(--nb-warning)] text-[0.65rem] ml-1">
                        x{li.riskMultiplier.toFixed(2)}
                      </span>
                    )}
                  </td>
                  <td className="text-xs">
                    {li.buildingType ? BUILDING_TYPES[li.buildingType]?.name || li.buildingType : '—'}
                  </td>
                  <td className="font-mono text-xs">
                    {li.effectiveSqft > 0 ? li.effectiveSqft.toLocaleString() : '—'}
                  </td>
                  <td className="font-mono text-xs">{li.lod || '—'}</td>
                  <td className="text-xs">{li.scope || '—'}</td>
                  <td className="nb-amount font-mono text-xs">{formatCurrency(li.clientPrice)}</td>
                  <td className="nb-amount font-mono text-xs text-[var(--nb-text-dim)]">
                    {formatCurrency(li.upteamCost)}
                  </td>
                </tr>
              ))
            ))}
          </tbody>
        </table>
      </div>

      {/* Subtotals */}
      <div className="border-t border-[var(--nb-border-accent)] pt-3 space-y-1.5">
        {quote.subtotals.modeling > 0 && (
          <div className="flex justify-between font-mono text-xs">
            <span className="text-[var(--nb-text-muted)]">Modeling</span>
            <span>{formatCurrency(quote.subtotals.modeling)}</span>
          </div>
        )}
        {quote.subtotals.services > 0 && (
          <div className="flex justify-between font-mono text-xs">
            <span className="text-[var(--nb-text-muted)]">Services</span>
            <span>{formatCurrency(quote.subtotals.services)}</span>
          </div>
        )}
        {quote.subtotals.elevations > 0 && (
          <div className="flex justify-between font-mono text-xs">
            <span className="text-[var(--nb-text-muted)]">Elevations</span>
            <span>{formatCurrency(quote.subtotals.elevations)}</span>
          </div>
        )}
        {quote.subtotals.travel > 0 && (
          <div className="flex justify-between font-mono text-xs">
            <span className="text-[var(--nb-text-muted)]">Travel ({quote.travel.label})</span>
            <span>{formatCurrency(quote.subtotals.travel)}</span>
          </div>
        )}

        <div className="flex justify-between font-mono text-xs pt-2 border-t border-[var(--nb-border)]">
          <span className="text-[var(--nb-text-muted)]">Subtotal</span>
          <span>{formatCurrency(quote.totalClientPrice)}</span>
        </div>

        {quote.paymentTermPremium > 0 && (
          <div className="flex justify-between font-mono text-xs">
            <span className="text-[var(--nb-warning)]">Payment Term Premium ({quote.paymentTerms})</span>
            <span className="text-[var(--nb-warning)]">+{formatCurrency(quote.paymentTermPremium)}</span>
          </div>
        )}

        <div className="flex justify-between items-baseline pt-3 border-t border-[var(--nb-border-accent)]">
          <span className="nb-label">Grand Total</span>
          <span className="nb-grand-total">{formatCurrency(quote.grandTotal)}</span>
        </div>
      </div>
    </motion.div>
  );
}
