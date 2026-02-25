import { useState } from 'react';
import { ChevronDown, ChevronUp, Key, BookOpenCheck, Zap, Shield, Calculator, Brain } from 'lucide-react';
import { Notebook } from '../components/notebook/Notebook';
import { BuildingMap } from '../components/notebook/BuildingMap';
import type { BuildingInsights } from '../components/notebook/BuildingMap';

export function NotebookCPQ() {
  const [showSettings, setShowSettings] = useState(false);
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('s2p-anthropic-key') || '');
  const [buildingInsights, setBuildingInsights] = useState<BuildingInsights | null>(null);

  function handleSaveKey(key: string) {
    setApiKey(key);
    if (key) {
      localStorage.setItem('s2p-anthropic-key', key);
    } else {
      localStorage.removeItem('s2p-anthropic-key');
    }
  }

  const hasEnvKey = !!process.env.ANTHROPIC_API_KEY;
  const hasAnyKey = hasEnvKey || !!apiKey;

  return (
    <div className="notebook-theme">
      {/* Page header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 rounded-xl bg-[var(--nb-accent-light)] flex items-center justify-center">
                <BookOpenCheck size={20} className="text-[var(--nb-accent)]" />
              </div>
              <div>
                <h1 className="text-2xl font-semibold text-[var(--nb-text)]">
                  Notebook CPQ
                </h1>
                <p className="text-sm text-[var(--nb-text-muted)]">
                  Natural language quoting engine
                </p>
              </div>
            </div>
          </div>

          <button
            className="nb-btn nb-btn-ghost text-xs"
            onClick={() => setShowSettings(!showSettings)}
          >
            <Key size={12} />
            API Key
            {showSettings ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
        </div>

        {/* Settings panel */}
        {showSettings && (
          <div className="mt-3 p-4 rounded-lg border border-[var(--nb-border)] bg-[var(--nb-bg-elevated)]">
            {hasEnvKey ? (
              <p className="text-xs font-mono text-[var(--nb-success)]">
                Anthropic API key configured via environment variable.
              </p>
            ) : (
              <div>
                <label className="nb-label block mb-1">Anthropic API Key</label>
                <div className="flex gap-2">
                  <input
                    type="password"
                    className="nb-input flex-1"
                    value={apiKey}
                    onChange={e => handleSaveKey(e.target.value)}
                    placeholder="sk-ant-..."
                  />
                  {apiKey && (
                    <button className="nb-btn nb-btn-ghost text-xs" onClick={() => handleSaveKey('')}>
                      Clear
                    </button>
                  )}
                </div>
                <p className="text-[0.65rem] text-[var(--nb-text-dim)] mt-1 font-mono">
                  Stored in localStorage. For production, set ANTHROPIC_API_KEY in .env.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Warning if no key */}
        {!hasAnyKey && (
          <div className="nb-error mt-3">
            No API key configured. Click "API Key" above to enter your Anthropic key, or set ANTHROPIC_API_KEY in .env.
          </div>
        )}
      </div>

      {/* How it works strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="flex items-start gap-3 p-3 rounded-lg bg-white border border-[var(--nb-border)]">
          <div className="p-2 rounded-lg bg-blue-50 text-blue-500 shrink-0">
            <Brain size={16} />
          </div>
          <div>
            <div className="text-xs font-medium text-[var(--nb-text)]">Describe</div>
            <div className="text-[0.7rem] text-[var(--nb-text-muted)] leading-tight mt-0.5">
              Type your project in plain English
            </div>
          </div>
        </div>
        <div className="flex items-start gap-3 p-3 rounded-lg bg-white border border-[var(--nb-border)]">
          <div className="p-2 rounded-lg bg-purple-50 text-purple-500 shrink-0">
            <Zap size={16} />
          </div>
          <div>
            <div className="text-xs font-medium text-[var(--nb-text)]">Extract</div>
            <div className="text-[0.7rem] text-[var(--nb-text-muted)] leading-tight mt-0.5">
              AI extracts structured parameters
            </div>
          </div>
        </div>
        <div className="flex items-start gap-3 p-3 rounded-lg bg-white border border-[var(--nb-border)]">
          <div className="p-2 rounded-lg bg-green-50 text-green-600 shrink-0">
            <Calculator size={16} />
          </div>
          <div>
            <div className="text-xs font-medium text-[var(--nb-text)]">Price</div>
            <div className="text-[0.7rem] text-[var(--nb-text-muted)] leading-tight mt-0.5">
              Deterministic engine calculates quote
            </div>
          </div>
        </div>
        <div className="flex items-start gap-3 p-3 rounded-lg bg-white border border-[var(--nb-border)]">
          <div className="p-2 rounded-lg bg-amber-50 text-amber-600 shrink-0">
            <Shield size={16} />
          </div>
          <div>
            <div className="text-xs font-medium text-[var(--nb-text)]">Verify</div>
            <div className="text-[0.7rem] text-[var(--nb-text-muted)] leading-tight mt-0.5">
              Margin guardrails protect profitability
            </div>
          </div>
        </div>
      </div>

      {/* Main layout: notebook + sidebar */}
      <div className="flex gap-6 items-start">
        {/* Notebook (main) */}
        <div className="flex-1 min-w-0">
          <Notebook />
        </div>

        {/* Sidebar */}
        <div className="hidden lg:block w-80 shrink-0 space-y-4 sticky top-24">
          {/* Building Map */}
          <div className="nb-info-panel">
            <div className="nb-info-panel-header">Building Location</div>
            <BuildingMap
              address={buildingInsights?.address}
              onBuildingInsights={setBuildingInsights}
            />
          </div>

          {/* Quick Reference */}
          <div className="nb-info-panel">
            <div className="nb-info-panel-header">Quick Reference</div>
            <div className="space-y-2">
              <div>
                <div className="text-[0.65rem] font-mono text-[var(--nb-text-dim)] uppercase tracking-wider mb-1">LOD Levels</div>
                <div className="space-y-0.5">
                  <div className="nb-stat-row">
                    <span className="nb-stat-label">200</span>
                    <span className="nb-stat-value text-xs">Conceptual</span>
                  </div>
                  <div className="nb-stat-row">
                    <span className="nb-stat-label">300</span>
                    <span className="nb-stat-value text-xs">Standard</span>
                  </div>
                  <div className="nb-stat-row">
                    <span className="nb-stat-label">350</span>
                    <span className="nb-stat-value text-xs">Construction</span>
                  </div>
                </div>
              </div>

              <div className="border-t border-[var(--nb-border)] pt-2">
                <div className="text-[0.65rem] font-mono text-[var(--nb-text-dim)] uppercase tracking-wider mb-1">Disciplines</div>
                <div className="flex flex-wrap gap-1.5">
                  {['arch', 'mepf', 'structure', 'site'].map(d => (
                    <span key={d} className="px-2 py-0.5 bg-[#F1F5F9] text-[var(--nb-text-muted)] rounded text-[0.65rem] font-mono">
                      {d}
                    </span>
                  ))}
                </div>
              </div>

              <div className="border-t border-[var(--nb-border)] pt-2">
                <div className="text-[0.65rem] font-mono text-[var(--nb-text-dim)] uppercase tracking-wider mb-1">Dispatch Locations</div>
                <div className="flex flex-wrap gap-1.5">
                  {['TROY', 'WOODSTOCK', 'BOISE', 'BROOKLYN'].map(loc => (
                    <span key={loc} className="px-2 py-0.5 bg-[#F1F5F9] text-[var(--nb-text-muted)] rounded text-[0.65rem] font-mono">
                      {loc}
                    </span>
                  ))}
                </div>
              </div>

              <div className="border-t border-[var(--nb-border)] pt-2">
                <div className="text-[0.65rem] font-mono text-[var(--nb-text-dim)] uppercase tracking-wider mb-1">Risk Premiums</div>
                <div className="space-y-0.5">
                  <div className="nb-stat-row">
                    <span className="nb-stat-label">occupied</span>
                    <span className="nb-stat-value text-xs text-[var(--nb-warning)]">+15%</span>
                  </div>
                  <div className="nb-stat-row">
                    <span className="nb-stat-label">hazardous</span>
                    <span className="nb-stat-value text-xs text-[var(--nb-error)]">+25%</span>
                  </div>
                  <div className="nb-stat-row">
                    <span className="nb-stat-label">no_power</span>
                    <span className="nb-stat-value text-xs text-[var(--nb-warning)]">+20%</span>
                  </div>
                </div>
                <p className="text-[0.6rem] text-[var(--nb-text-dim)] font-mono mt-1 italic">
                  Arch discipline only
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
