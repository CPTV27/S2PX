import { useState } from 'react';
import { motion } from 'motion/react';
import {
    DollarSign, Users, TrendingUp, Building2, Zap, Plus, Trash2,
    Save, RotateCcw, ChevronDown, ChevronRight, AlertTriangle, Layers,
    Radar, RefreshCw, Activity,
} from 'lucide-react';
import {
    loadPricingConfig, savePricingConfig, resetPricingConfig,
    calcOverheadPct, calcTotalAllocatedPct, calcCOGSMultiplier,
    calcScanMetrics,
} from '@/services/pricingConfig';
import { fetchScanRecordsFromFieldApp } from '@/services/api';
import { cn } from '@/lib/utils';
import type {
    PricingConfig, CostInput, PersonnelAllocation,
    ProfitAllocation, AddOnService, Multiplier, ScanRecord,
} from '@/types';

type Section = 'scan' | 'modeling' | 'personnel' | 'profit' | 'overhead' | 'addons' | 'multipliers' | 'scanIntel';

export function PricingRules() {
    const [config, setConfig] = useState<PricingConfig>(loadPricingConfig);
    const [dirty, setDirty] = useState(false);
    const [saved, setSaved] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [expanded, setExpanded] = useState<Record<Section, boolean>>({
        scan: true, modeling: true, personnel: true, profit: true,
        overhead: true, addons: false, multipliers: false, scanIntel: true,
    });

    const toggle = (s: Section) => setExpanded(prev => ({ ...prev, [s]: !prev[s] }));

    const update = (partial: Partial<PricingConfig>) => {
        setConfig(prev => ({ ...prev, ...partial }));
        setDirty(true);
        setSaved(false);
    };

    const handleSave = () => {
        savePricingConfig(config);
        setDirty(false);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
    };

    const handleReset = () => {
        if (!confirm('Reset all pricing rules to defaults? This cannot be undone.')) return;
        setConfig(resetPricingConfig());
        setDirty(false);
    };

    // Calculated values
    const overheadPct = calcOverheadPct(config.overhead);
    const totalAllocPct = calcTotalAllocatedPct(config);
    const cogsMultiplier = calcCOGSMultiplier(config);
    const cogsRoom = 100 - totalAllocPct;
    const scanMetrics = calcScanMetrics(config.scanIntelligence?.records || []);

    const handleSyncFieldApp = async () => {
        setSyncing(true);
        try {
            const records = await fetchScanRecordsFromFieldApp();
            if (records.length === 0) {
                alert('No scan data available from the field app. Make sure VITE_FIELD_APP_URL is configured and the field app is running.');
                return;
            }
            // Merge: keep existing manual records, add new field app records
            const existingIds = new Set((config.scanIntelligence?.records || []).map(r => r.id));
            const newRecords = records.filter(r => !existingIds.has(r.id));
            update({
                scanIntelligence: {
                    ...config.scanIntelligence,
                    records: [...(config.scanIntelligence?.records || []), ...newRecords],
                    lastSyncedFromFieldApp: new Date().toISOString(),
                },
            });
        } finally {
            setSyncing(false);
        }
    };

    // ── Generic list helpers ──
    const updateItem = <T extends { id: string }>(list: T[], id: string, field: keyof T, value: any): T[] =>
        list.map(item => item.id === id ? { ...item, [field]: value } : item);

    const removeItem = <T extends { id: string }>(list: T[], id: string): T[] =>
        list.filter(item => item.id !== id);

    // Section header component
    const SectionHeader = ({ label, icon: Icon, section, count, badge }: {
        label: string; icon: any; section: Section; count: number; badge?: string;
    }) => (
        <button onClick={() => toggle(section)} className="w-full flex items-center justify-between py-3">
            <div className="flex items-center gap-2">
                <Icon size={18} className="text-s2p-primary" />
                <span className="text-lg font-semibold">{label}</span>
                <span className="text-xs font-mono bg-s2p-secondary text-s2p-muted px-2 py-0.5 rounded-full">{count}</span>
                {badge && (
                    <span className="text-xs font-mono bg-s2p-primary/10 text-s2p-primary px-2 py-0.5 rounded-full">{badge}</span>
                )}
            </div>
            {expanded[section] ? <ChevronDown size={16} className="text-s2p-muted" /> : <ChevronRight size={16} className="text-s2p-muted" />}
        </button>
    );

    // Input cell helper
    const Cell = ({ value, onChange, placeholder, className: cls, type = 'text', prefix, suffix, step }: {
        value: any; onChange: (v: any) => void; placeholder?: string; className?: string;
        type?: string; prefix?: string; suffix?: string; step?: string;
    }) => (
        <div className={cn("relative", cls)}>
            {prefix && <span className="absolute left-2 top-1/2 -translate-y-1/2 text-s2p-muted text-xs">{prefix}</span>}
            <input
                type={type}
                step={step}
                value={value}
                onChange={e => onChange(type === 'number' ? Number(e.target.value) : e.target.value)}
                placeholder={placeholder}
                className={cn(
                    "w-full py-2 bg-s2p-secondary border border-s2p-border rounded-lg text-sm focus:outline-none focus:border-s2p-primary",
                    prefix ? "pl-6 pr-2" : suffix ? "pl-3 pr-7" : "px-3",
                    type === 'number' && "font-mono"
                )}
            />
            {suffix && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-s2p-muted text-xs">{suffix}</span>}
        </div>
    );

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-end">
                <div>
                    <h2 className="text-2xl font-bold text-s2p-fg">Pricing Rules</h2>
                    <p className="text-s2p-muted text-sm mt-1">Profit-first pricing model. The AI quote engine uses these rules.</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={handleReset} className="flex items-center gap-2 px-4 py-2.5 bg-s2p-secondary text-s2p-muted rounded-xl font-medium text-sm hover:bg-s2p-border hover:text-s2p-fg transition-colors">
                        <RotateCcw size={14} /> Reset
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={!dirty}
                        className={cn(
                            "flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-sm transition-all",
                            dirty ? "bg-s2p-primary text-white hover:bg-s2p-accent shadow-sm"
                                : saved ? "bg-green-500 text-white"
                                    : "bg-s2p-secondary text-s2p-muted cursor-not-allowed"
                        )}
                    >
                        <Save size={14} /> {saved ? 'Saved!' : 'Save Rules'}
                    </button>
                </div>
            </div>

            {/* ── KPI Strip: The Formula ── */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                className="bg-white border border-s2p-border rounded-2xl p-5">
                <div className="text-[10px] font-mono uppercase tracking-wider text-s2p-muted mb-3">Calculated Pricing Formula</div>
                <div className="grid grid-cols-4 gap-4">
                    <div className="bg-s2p-secondary/50 border border-s2p-border rounded-xl p-4 text-center">
                        <div className="text-[10px] font-mono uppercase text-s2p-muted mb-1">Total Allocated</div>
                        <div className={cn("text-2xl font-bold font-mono", totalAllocPct > 90 ? "text-red-600" : "text-s2p-fg")}>
                            {totalAllocPct.toFixed(1)}%
                        </div>
                        <div className="text-[10px] text-s2p-muted mt-1">of revenue</div>
                    </div>
                    <div className="bg-s2p-secondary/50 border border-s2p-border rounded-xl p-4 text-center">
                        <div className="text-[10px] font-mono uppercase text-s2p-muted mb-1">COGS Room</div>
                        <div className={cn("text-2xl font-bold font-mono", cogsRoom < 20 ? "text-amber-600" : "text-s2p-fg")}>
                            {cogsRoom.toFixed(1)}%
                        </div>
                        <div className="text-[10px] text-s2p-muted mt-1">of revenue for costs</div>
                    </div>
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center">
                        <div className="text-[10px] font-mono uppercase text-blue-600 mb-1">COGS Multiplier</div>
                        <div className="text-2xl font-bold font-mono text-blue-700">{cogsMultiplier}x</div>
                        <div className="text-[10px] text-blue-500 mt-1">on primary line item</div>
                    </div>
                    <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 text-center">
                        <div className="text-[10px] font-mono uppercase text-orange-600 mb-1">Overhead</div>
                        <div className="text-2xl font-bold font-mono text-orange-700">{overheadPct}%</div>
                        <div className="text-[10px] text-orange-500 mt-1">rolling {config.overhead.rollingMonths}-mo avg</div>
                    </div>
                </div>
                {totalAllocPct > 90 && (
                    <div className="mt-3 flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                        <AlertTriangle size={14} />
                        Total allocation exceeds 90% — COGS multiplier is very high. Consider reducing allocations.
                    </div>
                )}
            </motion.div>

            {/* ── Scan Intelligence ── */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.02 }}
                className="bg-white border border-s2p-border rounded-2xl p-5">
                <div className="flex items-center justify-between">
                    <SectionHeader label="Scan Intelligence" icon={Radar} section="scanIntel"
                        count={(config.scanIntelligence?.records || []).length}
                        badge={scanMetrics.totalProjects > 0 ? `${scanMetrics.avgSqftPerScanDay.toLocaleString()} sqft/day avg` : undefined} />
                    <button
                        onClick={handleSyncFieldApp}
                        disabled={syncing}
                        className="flex items-center gap-1.5 text-xs text-s2p-primary hover:text-s2p-accent transition-colors px-3 py-1.5 bg-s2p-primary/5 rounded-lg"
                    >
                        <RefreshCw size={12} className={syncing ? 'animate-spin' : ''} />
                        {syncing ? 'Syncing...' : 'Sync from Field App'}
                    </button>
                </div>

                {expanded.scanIntel && (
                    <div className="space-y-4 mt-2">
                        {/* Metrics KPIs */}
                        {scanMetrics.totalProjects > 0 && (
                            <div className="grid grid-cols-4 gap-3">
                                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-center">
                                    <div className="text-[10px] font-mono uppercase text-emerald-600 mb-1">Avg Sqft / Scan Day</div>
                                    <div className="text-xl font-bold font-mono text-emerald-700">{scanMetrics.avgSqftPerScanDay.toLocaleString()}</div>
                                </div>
                                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-center">
                                    <div className="text-[10px] font-mono uppercase text-emerald-600 mb-1">Avg Positions / Day</div>
                                    <div className="text-xl font-bold font-mono text-emerald-700">{scanMetrics.avgScanPositionsPerDay}</div>
                                </div>
                                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-center">
                                    <div className="text-[10px] font-mono uppercase text-emerald-600 mb-1">Avg Min / Position</div>
                                    <div className="text-xl font-bold font-mono text-emerald-700">{scanMetrics.avgMinutesPerScanPosition}</div>
                                </div>
                                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-center">
                                    <div className="text-[10px] font-mono uppercase text-emerald-600 mb-1">Projects Tracked</div>
                                    <div className="text-xl font-bold font-mono text-emerald-700">{scanMetrics.totalProjects}</div>
                                </div>
                            </div>
                        )}

                        {/* By Building Type breakdown */}
                        {Object.keys(scanMetrics.byBuildingType).length > 0 && (
                            <div className="bg-s2p-secondary/30 border border-s2p-border rounded-xl p-4">
                                <div className="text-[10px] font-mono uppercase tracking-wider text-s2p-muted mb-2 flex items-center gap-1.5">
                                    <Activity size={12} /> Performance by Building Type
                                </div>
                                <div className="grid grid-cols-12 gap-2 text-[10px] font-mono uppercase text-s2p-muted px-1 mb-1">
                                    <div className="col-span-3">Type</div>
                                    <div className="col-span-2">Projects</div>
                                    <div className="col-span-3">Sqft/Day</div>
                                    <div className="col-span-2">Pos/Day</div>
                                    <div className="col-span-2">Complexity</div>
                                </div>
                                {Object.entries(scanMetrics.byBuildingType).map(([bt, d]) => (
                                    <div key={bt} className="grid grid-cols-12 gap-2 text-sm items-center py-1">
                                        <div className="col-span-3 font-medium">{bt}</div>
                                        <div className="col-span-2 font-mono text-s2p-muted">{d.count}</div>
                                        <div className="col-span-3 font-mono text-emerald-700">{d.avgSqftPerDay.toLocaleString()}</div>
                                        <div className="col-span-2 font-mono text-s2p-muted">{d.avgPositionsPerDay}</div>
                                        <div className="col-span-2 font-mono text-s2p-muted">{d.avgComplexity}/3</div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Scan Records table */}
                        <div className="space-y-2">
                            <div className="text-[10px] font-mono uppercase tracking-wider text-s2p-muted">Project Records</div>
                            <div className="grid grid-cols-12 gap-2 text-[10px] font-mono uppercase tracking-wider text-s2p-muted px-1">
                                <div className="col-span-2">Project</div>
                                <div className="col-span-1">Type</div>
                                <div className="col-span-1">Sqft</div>
                                <div className="col-span-1">Floors</div>
                                <div className="col-span-1">Scan Days</div>
                                <div className="col-span-1">Positions</div>
                                <div className="col-span-1">Deliverable</div>
                                <div className="col-span-1">Complexity</div>
                                <div className="col-span-2">Notes</div>
                            </div>
                            {(config.scanIntelligence?.records || []).map(r => (
                                <div key={r.id} className="grid grid-cols-12 gap-2 items-center">
                                    <Cell className="col-span-2" value={r.projectName} onChange={v => {
                                        const records = (config.scanIntelligence?.records || []).map(rec => rec.id === r.id ? { ...rec, projectName: v } : rec);
                                        update({ scanIntelligence: { ...config.scanIntelligence, records } });
                                    }} placeholder="Project" />
                                    <div className="col-span-1">
                                        <select value={r.buildingType} onChange={e => {
                                            const records = (config.scanIntelligence?.records || []).map(rec => rec.id === r.id ? { ...rec, buildingType: e.target.value } : rec);
                                            update({ scanIntelligence: { ...config.scanIntelligence, records } });
                                        }} className="w-full py-2 px-1 bg-s2p-secondary border border-s2p-border rounded-lg text-xs focus:outline-none focus:border-s2p-primary">
                                            {['Commercial', 'Industrial', 'Healthcare', 'Residential', 'Education', 'Mixed-Use', 'Other'].map(t => (
                                                <option key={t} value={t}>{t}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <Cell className="col-span-1" value={r.squareFootage} onChange={v => {
                                        const records = (config.scanIntelligence?.records || []).map(rec => rec.id === r.id ? { ...rec, squareFootage: v } : rec);
                                        update({ scanIntelligence: { ...config.scanIntelligence, records } });
                                    }} type="number" />
                                    <Cell className="col-span-1" value={r.numFloors} onChange={v => {
                                        const records = (config.scanIntelligence?.records || []).map(rec => rec.id === r.id ? { ...rec, numFloors: v } : rec);
                                        update({ scanIntelligence: { ...config.scanIntelligence, records } });
                                    }} type="number" />
                                    <Cell className="col-span-1" value={r.scanDays} onChange={v => {
                                        const records = (config.scanIntelligence?.records || []).map(rec => rec.id === r.id ? { ...rec, scanDays: v, totalScanMinutes: v * 480 } : rec);
                                        update({ scanIntelligence: { ...config.scanIntelligence, records } });
                                    }} type="number" />
                                    <Cell className="col-span-1" value={r.numScanPositions} onChange={v => {
                                        const records = (config.scanIntelligence?.records || []).map(rec => rec.id === r.id ? { ...rec, numScanPositions: v } : rec);
                                        update({ scanIntelligence: { ...config.scanIntelligence, records } });
                                    }} type="number" />
                                    <div className="col-span-1">
                                        <select value={r.deliverableType} onChange={e => {
                                            const records = (config.scanIntelligence?.records || []).map(rec => rec.id === r.id ? { ...rec, deliverableType: e.target.value } : rec);
                                            update({ scanIntelligence: { ...config.scanIntelligence, records } });
                                        }} className="w-full py-2 px-1 bg-s2p-secondary border border-s2p-border rounded-lg text-xs focus:outline-none focus:border-s2p-primary">
                                            {['2D Plans', 'BIM LOD200', 'BIM LOD300', 'BIM LOD350'].map(t => (
                                                <option key={t} value={t}>{t}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="col-span-1">
                                        <select value={r.complexity} onChange={e => {
                                            const records = (config.scanIntelligence?.records || []).map(rec => rec.id === r.id ? { ...rec, complexity: e.target.value as ScanRecord['complexity'] } : rec);
                                            update({ scanIntelligence: { ...config.scanIntelligence, records } });
                                        }} className="w-full py-2 px-1 bg-s2p-secondary border border-s2p-border rounded-lg text-xs focus:outline-none focus:border-s2p-primary">
                                            {['Low', 'Medium', 'High'].map(t => (
                                                <option key={t} value={t}>{t}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <Cell className="col-span-1" value={r.notes || ''} onChange={v => {
                                        const records = (config.scanIntelligence?.records || []).map(rec => rec.id === r.id ? { ...rec, notes: v } : rec);
                                        update({ scanIntelligence: { ...config.scanIntelligence, records } });
                                    }} placeholder="Notes" />
                                    <button onClick={() => {
                                        const records = (config.scanIntelligence?.records || []).filter(rec => rec.id !== r.id);
                                        update({ scanIntelligence: { ...config.scanIntelligence, records } });
                                    }} className="p-2 text-s2p-muted hover:text-red-500 transition-colors justify-self-center"><Trash2 size={14} /></button>
                                </div>
                            ))}
                            <button onClick={() => {
                                const newRecord: ScanRecord = {
                                    id: `si-${Date.now()}`, projectName: '', buildingType: 'Commercial',
                                    squareFootage: 0, numFloors: 1, scanDays: 1, totalScanMinutes: 480,
                                    travelDays: 1, numScanPositions: 0, deliverableType: 'BIM LOD300',
                                    complexity: 'Medium', completedDate: new Date().toISOString().split('T')[0],
                                };
                                update({
                                    scanIntelligence: {
                                        ...config.scanIntelligence,
                                        records: [...(config.scanIntelligence?.records || []), newRecord],
                                    },
                                });
                            }} className="flex items-center gap-1 text-sm text-s2p-primary hover:text-s2p-accent transition-colors mt-2">
                                <Plus size={14} /> Add Scan Record
                            </button>
                        </div>

                        {config.scanIntelligence?.lastSyncedFromFieldApp && (
                            <div className="text-xs text-s2p-muted font-mono">
                                Last synced from field app: {new Date(config.scanIntelligence.lastSyncedFromFieldApp).toLocaleString()}
                            </div>
                        )}
                    </div>
                )}
            </motion.div>

            {/* Minimum Project Value */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.03 }}
                className="bg-white border border-s2p-border rounded-2xl p-5">
                <div className="flex items-center gap-4">
                    <div className="text-sm font-medium">Minimum Project Value</div>
                    <Cell value={config.minimumProjectValue} onChange={v => update({ minimumProjectValue: v })}
                        type="number" prefix="$" className="w-32" />
                    <span className="text-xs text-s2p-muted">Quotes below this are bumped to minimum</span>
                </div>
            </motion.div>

            {/* ── Scanning Costs ── */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 }}
                className="bg-white border border-s2p-border rounded-2xl p-5">
                <SectionHeader label="Scanning Costs" icon={DollarSign} section="scan" count={config.scanCosts.length} badge="COGS" />
                {expanded.scan && (
                    <div className="space-y-2 mt-2">
                        <div className="grid grid-cols-12 gap-2 text-[10px] font-mono uppercase tracking-wider text-s2p-muted px-1">
                            <div className="col-span-3">Item</div><div className="col-span-1">Unit</div>
                            <div className="col-span-2">Cost/Unit</div><div className="col-span-2">Vendor</div>
                            <div className="col-span-3">Notes</div><div className="col-span-1"></div>
                        </div>
                        {config.scanCosts.map(c => (
                            <div key={c.id} className="grid grid-cols-12 gap-2 items-center">
                                <Cell className="col-span-3" value={c.label} onChange={v => update({ scanCosts: updateItem(config.scanCosts, c.id, 'label', v) })} placeholder="Item" />
                                <Cell className="col-span-1" value={c.unit} onChange={v => update({ scanCosts: updateItem(config.scanCosts, c.id, 'unit', v) })} />
                                <Cell className="col-span-2" value={c.costPerUnit} onChange={v => update({ scanCosts: updateItem(config.scanCosts, c.id, 'costPerUnit', v) })} type="number" step="0.01" prefix="$" />
                                <Cell className="col-span-2" value={c.vendor} onChange={v => update({ scanCosts: updateItem(config.scanCosts, c.id, 'vendor', v) })} />
                                <Cell className="col-span-3" value={c.notes || ''} onChange={v => update({ scanCosts: updateItem(config.scanCosts, c.id, 'notes', v) })} placeholder="Notes" />
                                <button onClick={() => update({ scanCosts: removeItem(config.scanCosts, c.id) })} className="col-span-1 p-2 text-s2p-muted hover:text-red-500 transition-colors justify-self-center"><Trash2 size={14} /></button>
                            </div>
                        ))}
                        <button onClick={() => update({ scanCosts: [...config.scanCosts, { id: `sc-${Date.now()}`, label: '', unit: 'day', costPerUnit: 0, vendor: '', notes: '' }] })}
                            className="flex items-center gap-1 text-sm text-s2p-primary hover:text-s2p-accent transition-colors mt-2">
                            <Plus size={14} /> Add Scan Cost
                        </button>
                    </div>
                )}
            </motion.div>

            {/* ── Modeling / Vendor Costs ── */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }}
                className="bg-white border border-s2p-border rounded-2xl p-5">
                <SectionHeader label="Modeling / Vendor Costs" icon={Building2} section="modeling" count={config.modelingCosts.length} badge="COGS" />
                {expanded.modeling && (
                    <div className="space-y-2 mt-2">
                        <div className="grid grid-cols-12 gap-2 text-[10px] font-mono uppercase tracking-wider text-s2p-muted px-1">
                            <div className="col-span-3">Service</div><div className="col-span-1">Unit</div>
                            <div className="col-span-2">Cost/Unit</div><div className="col-span-2">Vendor</div>
                            <div className="col-span-3">Notes</div><div className="col-span-1"></div>
                        </div>
                        {config.modelingCosts.map(c => (
                            <div key={c.id} className="grid grid-cols-12 gap-2 items-center">
                                <Cell className="col-span-3" value={c.label} onChange={v => update({ modelingCosts: updateItem(config.modelingCosts, c.id, 'label', v) })} placeholder="Service" />
                                <Cell className="col-span-1" value={c.unit} onChange={v => update({ modelingCosts: updateItem(config.modelingCosts, c.id, 'unit', v) })} />
                                <Cell className="col-span-2" value={c.costPerUnit} onChange={v => update({ modelingCosts: updateItem(config.modelingCosts, c.id, 'costPerUnit', v) })} type="number" step="0.01" prefix="$" />
                                <Cell className="col-span-2" value={c.vendor} onChange={v => update({ modelingCosts: updateItem(config.modelingCosts, c.id, 'vendor', v) })} />
                                <Cell className="col-span-3" value={c.notes || ''} onChange={v => update({ modelingCosts: updateItem(config.modelingCosts, c.id, 'notes', v) })} placeholder="Notes" />
                                <button onClick={() => update({ modelingCosts: removeItem(config.modelingCosts, c.id) })} className="col-span-1 p-2 text-s2p-muted hover:text-red-500 transition-colors justify-self-center"><Trash2 size={14} /></button>
                            </div>
                        ))}
                        <button onClick={() => update({ modelingCosts: [...config.modelingCosts, { id: `mc-${Date.now()}`, label: '', unit: 'sq ft', costPerUnit: 0, vendor: '', notes: '' }] })}
                            className="flex items-center gap-1 text-sm text-s2p-primary hover:text-s2p-accent transition-colors mt-2">
                            <Plus size={14} /> Add Modeling Cost
                        </button>
                    </div>
                )}
            </motion.div>

            {/* ── Personnel Allocations ── */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}
                className="bg-white border border-s2p-border rounded-2xl p-5">
                <SectionHeader label="Personnel Allocations" icon={Users} section="personnel"
                    count={config.personnelAllocations.length}
                    badge={`${config.personnelAllocations.reduce((s, p) => s + p.pct, 0)}% of rev`} />
                {expanded.personnel && (
                    <div className="space-y-2 mt-2">
                        <div className="grid grid-cols-12 gap-2 text-[10px] font-mono uppercase tracking-wider text-s2p-muted px-1">
                            <div className="col-span-3">Name</div><div className="col-span-4">Role</div>
                            <div className="col-span-3">% of Revenue</div><div className="col-span-2"></div>
                        </div>
                        {config.personnelAllocations.map(p => (
                            <div key={p.id} className="grid grid-cols-12 gap-2 items-center">
                                <Cell className="col-span-3" value={p.name} onChange={v => update({ personnelAllocations: updateItem(config.personnelAllocations, p.id, 'name', v) })} />
                                <Cell className="col-span-4" value={p.role} onChange={v => update({ personnelAllocations: updateItem(config.personnelAllocations, p.id, 'role', v) })} />
                                <Cell className="col-span-3" value={p.pct} onChange={v => update({ personnelAllocations: updateItem(config.personnelAllocations, p.id, 'pct', v) })} type="number" step="0.5" suffix="%" />
                                <button onClick={() => update({ personnelAllocations: removeItem(config.personnelAllocations, p.id) })} className="col-span-2 p-2 text-s2p-muted hover:text-red-500 transition-colors justify-self-start"><Trash2 size={14} /></button>
                            </div>
                        ))}
                        <button onClick={() => update({ personnelAllocations: [...config.personnelAllocations, { id: `pa-${Date.now()}`, name: '', role: '', pct: 0 }] })}
                            className="flex items-center gap-1 text-sm text-s2p-primary hover:text-s2p-accent transition-colors mt-2">
                            <Plus size={14} /> Add Person
                        </button>
                    </div>
                )}
            </motion.div>

            {/* ── Profit Allocations (Above the Line) ── */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                className="bg-white border border-s2p-border rounded-2xl p-5">
                <SectionHeader label="Above-the-Line Allocations" icon={TrendingUp} section="profit"
                    count={config.profitAllocations.length}
                    badge={`${config.profitAllocations.reduce((s, p) => s + p.pct, 0)}% of rev`} />
                {expanded.profit && (
                    <div className="space-y-2 mt-2">
                        <div className="grid grid-cols-12 gap-2 text-[10px] font-mono uppercase tracking-wider text-s2p-muted px-1">
                            <div className="col-span-3">Category</div><div className="col-span-2">% of Revenue</div>
                            <div className="col-span-4">Notes</div><div className="col-span-1">Flex?</div><div className="col-span-2"></div>
                        </div>
                        {config.profitAllocations.map(p => (
                            <div key={p.id} className="grid grid-cols-12 gap-2 items-center">
                                <Cell className="col-span-3" value={p.label} onChange={v => update({ profitAllocations: updateItem(config.profitAllocations, p.id, 'label', v) })} />
                                <Cell className="col-span-2" value={p.pct} onChange={v => update({ profitAllocations: updateItem(config.profitAllocations, p.id, 'pct', v) })} type="number" step="0.5" suffix="%" />
                                <Cell className="col-span-4" value={p.notes || ''} onChange={v => update({ profitAllocations: updateItem(config.profitAllocations, p.id, 'notes', v) })} placeholder="Notes" />
                                <div className="col-span-1 flex justify-center">
                                    <input type="checkbox" checked={!!p.flexible}
                                        onChange={e => update({ profitAllocations: updateItem(config.profitAllocations, p.id, 'flexible', e.target.checked) })}
                                        className="rounded" />
                                </div>
                                <button onClick={() => update({ profitAllocations: removeItem(config.profitAllocations, p.id) })} className="col-span-2 p-2 text-s2p-muted hover:text-red-500 transition-colors justify-self-start"><Trash2 size={14} /></button>
                            </div>
                        ))}
                        <button onClick={() => update({ profitAllocations: [...config.profitAllocations, { id: `pr-${Date.now()}`, label: '', pct: 0, notes: '', flexible: false }] })}
                            className="flex items-center gap-1 text-sm text-s2p-primary hover:text-s2p-accent transition-colors mt-2">
                            <Plus size={14} /> Add Allocation
                        </button>
                    </div>
                )}
            </motion.div>

            {/* ── Overhead (Rolling Average) ── */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}
                className="bg-white border border-s2p-border rounded-2xl p-5">
                <SectionHeader label="Overhead (Dynamic)" icon={Building2} section="overhead"
                    count={config.overhead.monthlyEntries.length} badge={`${overheadPct}% of rev`} />
                {expanded.overhead && (
                    <div className="space-y-4 mt-2">
                        <div className="flex items-center gap-4 text-sm">
                            <span className="text-s2p-muted">Rolling average window:</span>
                            <Cell value={config.overhead.rollingMonths}
                                onChange={v => update({ overhead: { ...config.overhead, rollingMonths: v } })}
                                type="number" suffix="mo" className="w-24" />
                            <span className="text-s2p-muted">Manual override:</span>
                            <Cell value={config.overhead.manualOverridePct ?? ''}
                                onChange={v => update({ overhead: { ...config.overhead, manualOverridePct: v === '' || v === 0 ? null : v } })}
                                type="number" suffix="%" className="w-24" placeholder="Auto" />
                        </div>

                        <div className="grid grid-cols-12 gap-2 text-[10px] font-mono uppercase tracking-wider text-s2p-muted px-1">
                            <div className="col-span-3">Month</div><div className="col-span-3">Revenue</div>
                            <div className="col-span-3">Overhead</div><div className="col-span-2">OH %</div><div className="col-span-1"></div>
                        </div>
                        {config.overhead.monthlyEntries.map((e, i) => (
                            <div key={i} className="grid grid-cols-12 gap-2 items-center">
                                <Cell className="col-span-3" value={e.month} onChange={v => {
                                    const entries = [...config.overhead.monthlyEntries];
                                    entries[i] = { ...entries[i], month: v };
                                    update({ overhead: { ...config.overhead, monthlyEntries: entries } });
                                }} placeholder="YYYY-MM" />
                                <Cell className="col-span-3" value={e.revenue} onChange={v => {
                                    const entries = [...config.overhead.monthlyEntries];
                                    entries[i] = { ...entries[i], revenue: v };
                                    update({ overhead: { ...config.overhead, monthlyEntries: entries } });
                                }} type="number" prefix="$" />
                                <Cell className="col-span-3" value={e.overhead} onChange={v => {
                                    const entries = [...config.overhead.monthlyEntries];
                                    entries[i] = { ...entries[i], overhead: v };
                                    update({ overhead: { ...config.overhead, monthlyEntries: entries } });
                                }} type="number" prefix="$" />
                                <div className="col-span-2 text-sm font-mono text-s2p-muted px-3">
                                    {e.revenue > 0 ? `${((e.overhead / e.revenue) * 100).toFixed(1)}%` : '—'}
                                </div>
                                <button onClick={() => {
                                    const entries = config.overhead.monthlyEntries.filter((_, j) => j !== i);
                                    update({ overhead: { ...config.overhead, monthlyEntries: entries } });
                                }} className="col-span-1 p-2 text-s2p-muted hover:text-red-500 transition-colors justify-self-center"><Trash2 size={14} /></button>
                            </div>
                        ))}
                        <button onClick={() => {
                            const entries = [...config.overhead.monthlyEntries, { month: '', revenue: 0, overhead: 0 }];
                            update({ overhead: { ...config.overhead, monthlyEntries: entries } });
                        }} className="flex items-center gap-1 text-sm text-s2p-primary hover:text-s2p-accent transition-colors mt-2">
                            <Plus size={14} /> Add Month
                        </button>
                    </div>
                )}
            </motion.div>

            {/* ── Add-On Services ── */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.14 }}
                className="bg-white border border-s2p-border rounded-2xl p-5">
                <SectionHeader label="Add-On Services (Lean Pricing)" icon={Layers} section="addons" count={config.addOnServices.length} badge="pass-through" />
                {expanded.addons && (
                    <div className="space-y-2 mt-2">
                        <div className="grid grid-cols-12 gap-2 text-[10px] font-mono uppercase tracking-wider text-s2p-muted px-1">
                            <div className="col-span-3">Service</div><div className="col-span-1">Unit</div>
                            <div className="col-span-2">Vendor Cost</div><div className="col-span-1">Markup</div>
                            <div className="col-span-2">Client Price</div><div className="col-span-2">Vendor</div><div className="col-span-1"></div>
                        </div>
                        {config.addOnServices.map(a => (
                            <div key={a.id} className="grid grid-cols-12 gap-2 items-center">
                                <Cell className="col-span-3" value={a.label} onChange={v => update({ addOnServices: updateItem(config.addOnServices, a.id, 'label', v) })} />
                                <Cell className="col-span-1" value={a.unit} onChange={v => update({ addOnServices: updateItem(config.addOnServices, a.id, 'unit', v) })} />
                                <Cell className="col-span-2" value={a.vendorCostPerUnit} onChange={v => update({ addOnServices: updateItem(config.addOnServices, a.id, 'vendorCostPerUnit', v) })} type="number" step="0.01" prefix="$" />
                                <Cell className="col-span-1" value={a.markupFactor} onChange={v => update({ addOnServices: updateItem(config.addOnServices, a.id, 'markupFactor', v) })} type="number" step="0.05" suffix="x" />
                                <div className="col-span-2 text-sm font-mono text-s2p-primary px-3">
                                    ${(a.vendorCostPerUnit * a.markupFactor).toFixed(2)}/{a.unit}
                                </div>
                                <Cell className="col-span-2" value={a.vendor} onChange={v => update({ addOnServices: updateItem(config.addOnServices, a.id, 'vendor', v) })} />
                                <button onClick={() => update({ addOnServices: removeItem(config.addOnServices, a.id) })} className="col-span-1 p-2 text-s2p-muted hover:text-red-500 transition-colors justify-self-center"><Trash2 size={14} /></button>
                            </div>
                        ))}
                        <button onClick={() => update({ addOnServices: [...config.addOnServices, { id: `ao-${Date.now()}`, label: '', unit: 'sq ft', vendorCostPerUnit: 0, markupFactor: 1.25, vendor: '', notes: '' }] })}
                            className="flex items-center gap-1 text-sm text-s2p-primary hover:text-s2p-accent transition-colors mt-2">
                            <Plus size={14} /> Add Service
                        </button>
                    </div>
                )}
            </motion.div>

            {/* ── Multipliers ── */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }}
                className="bg-white border border-s2p-border rounded-2xl p-5">
                <SectionHeader label="Situational Multipliers" icon={Zap} section="multipliers" count={config.multipliers.length} />
                {expanded.multipliers && (
                    <div className="space-y-2 mt-2">
                        <div className="grid grid-cols-12 gap-2 text-[10px] font-mono uppercase tracking-wider text-s2p-muted px-1">
                            <div className="col-span-3">Name</div><div className="col-span-5">Trigger</div>
                            <div className="col-span-2">Factor</div><div className="col-span-2"></div>
                        </div>
                        {config.multipliers.map(m => (
                            <div key={m.id} className="grid grid-cols-12 gap-2 items-center">
                                <Cell className="col-span-3" value={m.name} onChange={v => update({ multipliers: updateItem(config.multipliers, m.id, 'name', v) })} />
                                <Cell className="col-span-5" value={m.trigger} onChange={v => update({ multipliers: updateItem(config.multipliers, m.id, 'trigger', v) })} />
                                <Cell className="col-span-2" value={m.factor} onChange={v => update({ multipliers: updateItem(config.multipliers, m.id, 'factor', v) })} type="number" step="0.05" suffix="x" />
                                <button onClick={() => update({ multipliers: removeItem(config.multipliers, m.id) })} className="col-span-2 p-2 text-s2p-muted hover:text-red-500 transition-colors justify-self-start"><Trash2 size={14} /></button>
                            </div>
                        ))}
                        <button onClick={() => update({ multipliers: [...config.multipliers, { id: `mul-${Date.now()}`, name: '', trigger: '', factor: 1.0 }] })}
                            className="flex items-center gap-1 text-sm text-s2p-primary hover:text-s2p-accent transition-colors mt-2">
                            <Plus size={14} /> Add Multiplier
                        </button>
                    </div>
                )}
            </motion.div>

            <div className="text-xs text-s2p-muted font-mono text-right">
                Last saved: {new Date(config.lastUpdated).toLocaleString()}
            </div>
        </div>
    );
}
