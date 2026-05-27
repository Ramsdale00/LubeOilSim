import { useState, useEffect, useRef } from 'react'
import {
  TrendingUp, DollarSign, Award, Zap, ChevronRight, ChevronDown,
  CheckCircle2, AlertTriangle, RotateCcw, Play, BarChart3,
  Layers, FlaskConical, Target, Activity
} from 'lucide-react'
import { clsx } from 'clsx'
import { motion, AnimatePresence } from 'framer-motion'
import { GlassCard } from '@/components/ui/GlassCard'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend, CartesianGrid
} from 'recharts'
import {
  useSavingsStore,
  SEED_LUBE_PROFILES,
  predictBlendKV,
  solveRebalance,
  calculateBatchSavings,
  formatUSD,
} from '@/store/savingsStore'
import type {
  LubeProfile, COAInputs, BatchSavingsRecord,
  SavingsScenario, ScenarioValues,
} from '@/types'

// ── Colour palette ────────────────────────────────────────────────────────────

const STREAM_COLORS = { material: '#3B82F6', elemental: '#F59E0B', rft: '#22C55E' }
const SCENARIO_COLORS: Record<SavingsScenario, string> = {
  conservative: '#94A3B8',
  expected:     '#3B82F6',
  optimistic:   '#22C55E',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function pct(n: number | undefined, d: number): string {
  if (!d || !n) return '0.0%'
  return `${((n / d) * 100).toFixed(1)}%`
}

function ScenarioTab({ label, active, onClick, color }: { label: string; active: boolean; onClick: () => void; color: string }) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        'px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200',
        active ? 'bg-white/80 shadow text-slate-800 border border-white/60' : 'text-slate-500 hover:bg-white/30'
      )}
      style={active ? { borderBottom: `3px solid ${color}` } : {}}
    >
      {label}
    </button>
  )
}

// ── Tab 1: Overview ───────────────────────────────────────────────────────────

function OverviewTab() {
  const { portfolioScenarios, activeScenario, setActiveScenario, batchSavings } = useSavingsStore()
  const scenarios = portfolioScenarios

  if (!scenarios) return <div className="text-slate-500 text-sm p-8 text-center">No data yet — commit batches in the COA Calculator.</div>

  const active = scenarios[activeScenario]

  const mixData = [
    { name: 'Material Avoidance', value: Math.round(active.material), color: STREAM_COLORS.material },
    { name: 'Elemental Potency', value: Math.round(active.elemental), color: STREAM_COLORS.elemental },
    { name: 'RFT Lift',          value: Math.round(active.rft),      color: STREAM_COLORS.rft },
  ].filter(d => d.value > 0)

  // Per-lube aggregates from ledger
  const lubeMap: Record<string, { lubeName: string; material: number; elemental: number; rft: number; total: number; batches: number }> = {}
  for (const rec of batchSavings) {
    if (!lubeMap[rec.lubeId]) lubeMap[rec.lubeId] = { lubeName: rec.lubeName, material: 0, elemental: 0, rft: 0, total: 0, batches: 0 }
    const s = rec.savings
    lubeMap[rec.lubeId].material  += s.materialAvoided
    lubeMap[rec.lubeId].elemental += s.elementalSaving
    lubeMap[rec.lubeId].rft       += s.rftLifted
    lubeMap[rec.lubeId].total     += s.totalSaving
    lubeMap[rec.lubeId].batches   += 1
  }
  const lubeRows = Object.values(lubeMap).sort((a, b) => b.total - a.total)

  const rangeData = SEED_LUBE_PROFILES.map(p => {
    const rows = batchSavings.filter(r => r.lubeId === p.lubeId)
    const captured = rows.reduce((s, r) => s + r.savings.totalSaving, 0)
    const annual = captured * (365 / 30)
    return {
      name: p.gradeCode,
      conservative: Math.round(annual * 0.67),
      expected:     Math.round(annual),
      optimistic:   Math.round(annual * 1.33),
    }
  })

  return (
    <div className="space-y-6">
      {/* Hero card */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl p-6 text-white"
        style={{ background: 'linear-gradient(135deg, #1e3a5f 0%, #1a6fb3 60%, #0ea5e9 100%)' }}
      >
        <div className="flex items-center gap-2 mb-2 opacity-80">
          <Zap className="w-4 h-4" />
          <span className="text-xs uppercase tracking-widest font-semibold">OmniBlend Discover — Expected Annual Savings</span>
        </div>
        <div className="text-5xl font-black tracking-tight">{formatUSD(scenarios.expected.total)}</div>
        <div className="mt-2 flex gap-6 text-sm opacity-80">
          <span>Conservative: {formatUSD(scenarios.conservative.total)}</span>
          <span>Optimistic: {formatUSD(scenarios.optimistic.total)}</span>
          <span>{scenarios.expected.savingsAsMaterialPct.toFixed(1)}% of material cost</span>
        </div>
      </motion.div>

      {/* Scenario toggle + metric tiles */}
      <div className="flex gap-2 bg-white/20 rounded-xl p-1 w-fit">
        {(['conservative', 'expected', 'optimistic'] as SavingsScenario[]).map(s => (
          <ScenarioTab key={s} label={s.charAt(0).toUpperCase() + s.slice(1)} active={activeScenario === s}
            onClick={() => setActiveScenario(s)} color={SCENARIO_COLORS[s]} />
        ))}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Savings', value: formatUSD(active.total), color: 'border-blue-400', icon: DollarSign },
          { label: 'Material Avoidance', value: formatUSD(active.material), color: 'border-blue-300', icon: Layers },
          { label: 'RFT Lift', value: formatUSD(active.rft), color: 'border-green-400', icon: Award },
          { label: 'Capacity Hours Freed', value: `${Math.round(active.capacityHours)} hrs`, color: 'border-amber-400', icon: Activity },
        ].map(({ label, value, color, icon: Icon }) => (
          <GlassCard key={label} className={`p-4 border-l-4 ${color}`}>
            <div className="flex items-center gap-2 mb-1">
              <Icon className="w-4 h-4 text-slate-500" />
              <span className="text-xs text-slate-500 uppercase tracking-wide">{label}</span>
            </div>
            <div className="text-xl font-bold text-slate-800">{value}</div>
          </GlassCard>
        ))}
      </div>

      {/* Scenario comparison table */}
      <GlassCard className="p-5">
        <h3 className="text-sm font-semibold text-slate-700 mb-4 uppercase tracking-wide">Scenario Comparison</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/30">
                <th className="text-left py-2 text-slate-500 font-medium">Scenario</th>
                <th className="text-right py-2 text-slate-500 font-medium">Material $</th>
                <th className="text-right py-2 text-slate-500 font-medium">Elemental $</th>
                <th className="text-right py-2 text-slate-500 font-medium">RFT Lift $</th>
                <th className="text-right py-2 text-slate-500 font-medium">Total $</th>
                <th className="text-right py-2 text-slate-500 font-medium">% Cost</th>
              </tr>
            </thead>
            <tbody>
              {([
                { key: 'conservative', label: 'Conservative', mult: '0.67×' },
                { key: 'expected',     label: 'Expected',     mult: '1.00×' },
                { key: 'optimistic',   label: 'Optimistic',   mult: '1.33×' },
              ] as const).map(({ key, label, mult }) => {
                const s: ScenarioValues = scenarios[key]
                const isActive = activeScenario === key
                return (
                  <tr key={key} onClick={() => setActiveScenario(key)} className={clsx('cursor-pointer transition-colors', isActive ? 'bg-blue-50/60' : 'hover:bg-white/30')}>
                    <td className="py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full" style={{ background: SCENARIO_COLORS[key] }} />
                        <span className="font-medium text-slate-700">{label}</span>
                        <span className="text-xs text-slate-400">{mult}</span>
                      </div>
                    </td>
                    <td className="text-right text-slate-700">{formatUSD(s.material)}</td>
                    <td className="text-right text-slate-700">{formatUSD(s.elemental)}</td>
                    <td className="text-right text-slate-700">{formatUSD(s.rft)}</td>
                    <td className="text-right font-semibold text-slate-800">{formatUSD(s.total)}</td>
                    <td className="text-right text-slate-600">{s.savingsAsMaterialPct.toFixed(1)}%</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </GlassCard>

      {/* Charts row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Savings mix pie */}
        <GlassCard className="p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4 uppercase tracking-wide">Savings Mix</h3>
          {mixData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={mixData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75} label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}>
                  {mixData.map(d => <Cell key={d.name} fill={d.color} />)}
                </Pie>
                <Tooltip formatter={(v: number) => formatUSD(v)} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : <p className="text-slate-400 text-sm text-center py-8">No savings data yet</p>}
        </GlassCard>

        {/* Range chart */}
        <GlassCard className="p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4 uppercase tracking-wide">Annual Range by Grade</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={rangeData} margin={{ top: 0, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={v => v >= 1000 ? `$${(v/1000).toFixed(0)}K` : `$${v}`} />
              <Tooltip formatter={(v: number) => formatUSD(v)} />
              <Bar dataKey="conservative" stackId="a" fill={SCENARIO_COLORS.conservative} name="Conservative" />
              <Bar dataKey="expected"     stackId="b" fill={SCENARIO_COLORS.expected}     name="Expected" />
              <Bar dataKey="optimistic"   stackId="c" fill={SCENARIO_COLORS.optimistic}   name="Optimistic" />
            </BarChart>
          </ResponsiveContainer>
        </GlassCard>
      </div>

      {/* Portfolio table */}
      <GlassCard className="p-5">
        <h3 className="text-sm font-semibold text-slate-700 mb-4 uppercase tracking-wide">Portfolio Breakdown</h3>
        {lubeRows.length === 0 ? (
          <p className="text-slate-400 text-sm text-center py-6">No batches committed yet</p>
        ) : (
          <table className="w-full text-sm">
            <thead><tr className="border-b border-white/30">
              <th className="text-left py-2 text-slate-500">Grade</th>
              <th className="text-right py-2 text-slate-500">Batches</th>
              <th className="text-right py-2 text-slate-500">Material $</th>
              <th className="text-right py-2 text-slate-500">RFT Lift $</th>
              <th className="text-right py-2 text-slate-500 font-semibold">Total $</th>
            </tr></thead>
            <tbody>
              {lubeRows.map(row => (
                <tr key={row.lubeName} className="border-b border-white/10 hover:bg-white/20">
                  <td className="py-2 font-medium text-slate-700">{row.lubeName}</td>
                  <td className="py-2 text-right text-slate-500">{row.batches}</td>
                  <td className="py-2 text-right text-slate-600">{formatUSD(row.material)}</td>
                  <td className="py-2 text-right text-slate-600">{formatUSD(row.rft)}</td>
                  <td className="py-2 text-right font-semibold text-slate-800">{formatUSD(row.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </GlassCard>
    </div>
  )
}

// ── Tab 2: COA Wizard ─────────────────────────────────────────────────────────

function COAWizardTab() {
  const { lubeProfiles, commitBatch } = useSavingsStore()
  const [step, setStep] = useState(0)
  const [selectedProfile, setSelectedProfile] = useState<LubeProfile | null>(null)
  const [batchMT, setBatchMT] = useState(8.76)
  const [batchDate, setBatchDate] = useState(new Date().toISOString().split('T')[0])
  const [coa, setCoa] = useState<COAInputs>({})
  const [preview, setPreview] = useState<{ rebalance: ReturnType<typeof solveRebalance>; savings: ReturnType<typeof calculateBatchSavings> } | null>(null)

  const STEPS = ['Select Grade', 'Batch Details', 'COA Receipts', 'Potency Check', 'Commit & Savings']

  useEffect(() => {
    if (selectedProfile && step >= 2) {
      const rb = solveRebalance(selectedProfile, coa)
      const s  = calculateBatchSavings(selectedProfile, coa, batchMT, rb)
      setPreview({ rebalance: rb, savings: s })
    }
  }, [coa, batchMT, selectedProfile, step])

  function handleCommit() {
    if (!selectedProfile || !preview) return
    const id = `sb-${Date.now()}`
    const record: BatchSavingsRecord = {
      id,
      batchId: `B-${new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14)}`,
      lubeId: selectedProfile.lubeId,
      lubeName: selectedProfile.lubeName,
      batchMT,
      batchDate,
      coaInputs: coa,
      rebalance: preview.rebalance,
      savings: preview.savings,
      inSpec: preview.rebalance.inSpec,
      committedAt: new Date().toISOString(),
    }
    commitBatch(record)
    setStep(0); setSelectedProfile(null); setCoa({}); setPreview(null)
  }

  const addComp = selectedProfile?.components.find(c => c.role === 'additive')
  const swingH  = selectedProfile?.components.find(c => c.role === 'swing_heavy')
  const swingL  = selectedProfile?.components.find(c => c.role === 'swing_light')

  return (
    <div className="space-y-6">
      {/* Step indicator */}
      <div className="flex items-center gap-0">
        {STEPS.map((label, i) => (
          <div key={i} className="flex items-center">
            <div className={clsx('flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all',
              i === step ? 'bg-blue-500 text-white shadow' : i < step ? 'bg-green-100 text-green-700' : 'bg-white/30 text-slate-400')}>
              {i < step ? <CheckCircle2 className="w-3 h-3" /> : <span className="w-4 h-4 flex items-center justify-center">{i + 1}</span>}
              <span className="hidden sm:inline">{label}</span>
            </div>
            {i < STEPS.length - 1 && <div className={clsx('h-0.5 w-6', i < step ? 'bg-green-300' : 'bg-white/30')} />}
          </div>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={step} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>

          {/* Step 0: Select Grade */}
          {step === 0 && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {lubeProfiles.map(p => (
                <GlassCard key={p.lubeId} onClick={() => { setSelectedProfile(p); setCoa({}); setStep(1) }}
                  className={clsx('p-4 cursor-pointer hover:shadow-lg transition-all border-2', selectedProfile?.lubeId === p.lubeId ? 'border-blue-400' : 'border-transparent')}>
                  <div className="text-xs text-blue-500 font-semibold mb-1">{p.gradeCode}</div>
                  <div className="font-bold text-slate-800">{p.lubeName}</div>
                  <div className="text-xs text-slate-500 mt-1">Target KV: {p.targetKV} ± {p.specWindow} cSt</div>
                  <div className="text-xs text-slate-500">{p.batchKL} KL/batch · {p.batchesPerYear} batches/yr</div>
                  <div className="text-xs text-slate-400 mt-1">RFT: {p.currentRftPct}%</div>
                </GlassCard>
              ))}
            </div>
          )}

          {/* Step 1: Batch Details */}
          {step === 1 && selectedProfile && (
            <GlassCard className="p-6 max-w-lg space-y-4">
              <h3 className="font-semibold text-slate-700">{selectedProfile.lubeName} — Batch Details</h3>
              <div>
                <label className="text-xs text-slate-500 block mb-1">Batch Date</label>
                <input type="date" value={batchDate} onChange={e => setBatchDate(e.target.value)}
                  className="w-full bg-white/50 border border-white/40 rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-400" />
              </div>
              <div>
                <label className="text-xs text-slate-500 block mb-1">Batch Mass (MT) — auto from {selectedProfile.batchKL} KL × {selectedProfile.density} g/cm³</label>
                <input type="number" step="0.01" value={batchMT}
                  onChange={e => setBatchMT(parseFloat(e.target.value) || selectedProfile.batchKL * selectedProfile.density)}
                  className="w-full bg-white/50 border border-white/40 rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-400" />
              </div>
              <div className="text-xs text-slate-500 bg-blue-50/50 rounded-lg p-3">
                Additive: ${selectedProfile.additiveCostMT}/MT · Base Oil: ${selectedProfile.baseOilCostMT}/MT · Top-up: {selectedProfile.topupPct}%
              </div>
              <div className="flex gap-3">
                <button onClick={() => setStep(0)} className="px-4 py-2 rounded-xl text-sm text-slate-600 bg-white/30 hover:bg-white/50">← Back</button>
                <button onClick={() => setStep(2)} className="px-4 py-2 rounded-xl text-sm text-white bg-blue-500 hover:bg-blue-600">Next →</button>
              </div>
            </GlassCard>
          )}

          {/* Step 2: COA Receipts */}
          {step === 2 && selectedProfile && (
            <div className="space-y-4">
              <GlassCard className="p-5">
                <h3 className="font-semibold text-slate-700 mb-4">Base Oil COA — Kinematic Viscosity @ 100°C</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {swingH && (
                    <div>
                      <label className="text-xs text-slate-500 block mb-1">{swingH.name} (std: {swingH.stdKV} cSt)</label>
                      <input type="number" step="0.01" placeholder={String(swingH.stdKV)}
                        value={coa.swingHeavyActualKV ?? ''}
                        onChange={e => setCoa(c => ({ ...c, swingHeavyActualKV: parseFloat(e.target.value) || undefined }))}
                        className="w-full bg-white/50 border border-white/40 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                    </div>
                  )}
                  {swingL && (
                    <div>
                      <label className="text-xs text-slate-500 block mb-1">{swingL.name} (std: {swingL.stdKV} cSt)</label>
                      <input type="number" step="0.01" placeholder={String(swingL.stdKV)}
                        value={coa.swingLightActualKV ?? ''}
                        onChange={e => setCoa(c => ({ ...c, swingLightActualKV: parseFloat(e.target.value) || undefined }))}
                        className="w-full bg-white/50 border border-white/40 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                    </div>
                  )}
                </div>
              </GlassCard>

              {addComp && (
                <GlassCard className="p-5">
                  <h3 className="font-semibold text-slate-700 mb-4">Additive Package COA</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <label className="text-xs text-slate-500 block mb-1">KV (std: {addComp.stdKV} cSt)</label>
                      <input type="number" step="0.1" placeholder={String(addComp.stdKV)} value={coa.additiveActualKV ?? ''}
                        onChange={e => setCoa(c => ({ ...c, additiveActualKV: parseFloat(e.target.value) || undefined }))}
                        className="w-full bg-white/50 border border-white/40 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                    </div>
                    {addComp.stdCa !== undefined && (
                      <div>
                        <label className="text-xs text-slate-500 block mb-1">Ca % (std: {addComp.stdCa})</label>
                        <input type="number" step="0.01" placeholder={String(addComp.stdCa)} value={coa.additiveActualCa ?? ''}
                          onChange={e => setCoa(c => ({ ...c, additiveActualCa: parseFloat(e.target.value) || undefined }))}
                          className="w-full bg-white/50 border border-white/40 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                      </div>
                    )}
                    {addComp.stdZn !== undefined && (
                      <div>
                        <label className="text-xs text-slate-500 block mb-1">Zn % (std: {addComp.stdZn})</label>
                        <input type="number" step="0.001" placeholder={String(addComp.stdZn)} value={coa.additiveActualZn ?? ''}
                          onChange={e => setCoa(c => ({ ...c, additiveActualZn: parseFloat(e.target.value) || undefined }))}
                          className="w-full bg-white/50 border border-white/40 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                      </div>
                    )}
                    {addComp.stdP !== undefined && (
                      <div>
                        <label className="text-xs text-slate-500 block mb-1">P % (std: {addComp.stdP})</label>
                        <input type="number" step="0.001" placeholder={String(addComp.stdP)} value={coa.additiveActualP ?? ''}
                          onChange={e => setCoa(c => ({ ...c, additiveActualP: parseFloat(e.target.value) || undefined }))}
                          className={clsx('w-full bg-white/50 border border-white/40 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400',
                            coa.additiveActualP && coa.additiveActualP > 0.085 ? 'border-red-400' : '')} />
                        {coa.additiveActualP && coa.additiveActualP > 0.085 && (
                          <p className="text-xs text-red-500 mt-1">⚠ P &gt; 0.085% — ILSAC phosphorus cap risk</p>
                        )}
                      </div>
                    )}
                  </div>
                </GlassCard>
              )}

              {/* Live predicted KV */}
              {preview && (
                <GlassCard className={clsx('p-4 border-l-4', preview.rebalance.inSpec ? 'border-green-400' : 'border-amber-400')}>
                  <div className="flex items-start gap-3">
                    {preview.rebalance.inSpec
                      ? <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5" />
                      : <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5" />}
                    <div>
                      <div className="font-semibold text-slate-700 text-sm">{preview.rebalance.message}</div>
                      <div className="text-xs text-slate-500 mt-1">
                        Predicted KV: {preview.rebalance.predictedKVBefore.toFixed(2)} cSt →
                        Achieved: {preview.rebalance.achievedKV.toFixed(2)} cSt
                        (Target: {selectedProfile.targetKV} ± {selectedProfile.specWindow})
                      </div>
                      <div className="text-xs text-blue-600 font-semibold mt-1">
                        Estimated batch saving: {formatUSD(preview.savings.totalSaving)}
                      </div>
                    </div>
                  </div>
                </GlassCard>
              )}

              <div className="flex gap-3">
                <button onClick={() => setStep(1)} className="px-4 py-2 rounded-xl text-sm text-slate-600 bg-white/30 hover:bg-white/50">← Back</button>
                <button onClick={() => setStep(3)} className="px-4 py-2 rounded-xl text-sm text-white bg-blue-500 hover:bg-blue-600">Next →</button>
              </div>
            </div>
          )}

          {/* Step 3: Potency Check */}
          {step === 3 && selectedProfile && addComp && (
            <div className="space-y-4">
              <GlassCard className="p-5">
                <h3 className="font-semibold text-slate-700 mb-4">Elemental Potency Check — {addComp.name}</h3>
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-white/30">
                    <th className="text-left py-2 text-slate-500">Element</th>
                    <th className="text-right py-2 text-slate-500">Std %</th>
                    <th className="text-right py-2 text-slate-500">Actual %</th>
                    <th className="text-right py-2 text-slate-500">Variance</th>
                    <th className="text-right py-2 text-slate-500">Status</th>
                  </tr></thead>
                  <tbody>
                    {[
                      { el: 'Ca', std: addComp.stdCa, actual: coa.additiveActualCa },
                      { el: 'Zn', std: addComp.stdZn, actual: coa.additiveActualZn },
                      { el: 'P',  std: addComp.stdP,  actual: coa.additiveActualP  },
                    ].filter(r => r.std !== undefined).map(({ el, std, actual }) => {
                      if (!std) return null
                      const variance = actual ? ((actual - std) / std) * 100 : null
                      const status = variance === null ? 'no data' : variance > 2 ? 'over-potent' : variance < -2 ? 'under-potent' : 'on-spec'
                      return (
                        <tr key={el} className={clsx('border-b border-white/10',
                          status === 'over-potent' ? 'bg-amber-50/40' : status === 'on-spec' ? 'bg-green-50/40' : '')}>
                          <td className="py-2 font-semibold text-slate-700">{el}</td>
                          <td className="py-2 text-right text-slate-500">{std.toFixed(3)}</td>
                          <td className="py-2 text-right text-slate-700">{actual?.toFixed(3) ?? '—'}</td>
                          <td className="py-2 text-right">{variance !== null ? <span className={variance > 0 ? 'text-amber-600' : 'text-blue-600'}>{variance >= 0 ? '+' : ''}{variance.toFixed(1)}%</span> : '—'}</td>
                          <td className="py-2 text-right">
                            <span className={clsx('text-xs px-2 py-0.5 rounded-full',
                              status === 'over-potent' ? 'bg-amber-100 text-amber-700' :
                              status === 'on-spec' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500')}>
                              {status === 'over-potent' ? '↑ over-potent' : status === 'on-spec' ? '✓ on-spec' : status === 'under-potent' ? '↓ under-potent' : '—'}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                {preview && preview.savings.elementalSaving > 0 && (
                  <div className="mt-3 text-sm text-amber-700 bg-amber-50/60 rounded-lg p-3">
                    Over-potency saving: <strong>{formatUSD(preview.savings.elementalSaving)}</strong> — reduce additive dose by {(preview.savings.reducibleFrac * 100).toFixed(2)} pp
                  </div>
                )}
              </GlassCard>
              <div className="flex gap-3">
                <button onClick={() => setStep(2)} className="px-4 py-2 rounded-xl text-sm text-slate-600 bg-white/30 hover:bg-white/50">← Back</button>
                <button onClick={() => setStep(4)} className="px-4 py-2 rounded-xl text-sm text-white bg-blue-500 hover:bg-blue-600">Next →</button>
              </div>
            </div>
          )}

          {/* Step 3 fallback: no additive comp */}
          {step === 3 && selectedProfile && !addComp && (
            <GlassCard className="p-5">
              <p className="text-slate-500 text-sm">No additive component configured for this grade — skipping potency check.</p>
              <div className="flex gap-3 mt-4">
                <button onClick={() => setStep(2)} className="px-4 py-2 rounded-xl text-sm text-slate-600 bg-white/30 hover:bg-white/50">← Back</button>
                <button onClick={() => setStep(4)} className="px-4 py-2 rounded-xl text-sm text-white bg-blue-500 hover:bg-blue-600">Next →</button>
              </div>
            </GlassCard>
          )}

          {/* Step 4: Commit & Savings */}
          {step === 4 && selectedProfile && preview && (
            <div className="space-y-4">
              {/* Hero savings */}
              <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }}
                className="rounded-2xl p-6 text-white text-center"
                style={{ background: 'linear-gradient(135deg, #065f46 0%, #059669 100%)' }}>
                <div className="text-xs uppercase tracking-widest opacity-80 mb-2">OmniBlend Discover Savings · This Batch</div>
                <div className="text-5xl font-black">{formatUSD(preview.savings.totalSaving)}</div>
                <div className="mt-3 flex justify-center gap-6 text-sm opacity-80">
                  <span>Material: {formatUSD(preview.savings.materialAvoided)}</span>
                  <span>Elemental: {formatUSD(preview.savings.elementalSaving)}</span>
                  <span>RFT: {formatUSD(preview.savings.rftLifted)}</span>
                </div>
              </motion.div>

              {/* Derivation trace */}
              <GlassCard className="p-5">
                <h3 className="text-sm font-semibold text-slate-700 mb-3 uppercase tracking-wide">Savings Derivation</h3>
                <div className="space-y-1">
                  {preview.savings.steps.map((s, i) => (
                    <div key={i} className="font-mono text-xs text-slate-600 bg-slate-50/50 rounded px-3 py-1.5">{s}</div>
                  ))}
                </div>
              </GlassCard>

              {/* Rebalance summary */}
              <GlassCard className={clsx('p-4 border-l-4', preview.rebalance.inSpec ? 'border-green-400' : 'border-red-400')}>
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  {preview.rebalance.applied ? <RotateCcw className="w-4 h-4 text-blue-500" /> : <CheckCircle2 className="w-4 h-4 text-green-500" />}
                  {preview.rebalance.message}
                </div>
                {preview.rebalance.applied && (
                  <div className="text-xs text-slate-500 mt-1">
                    KV {preview.rebalance.predictedKVBefore.toFixed(2)} → {preview.rebalance.achievedKV.toFixed(2)} cSt
                    (shift: {preview.rebalance.shiftDelta >= 0 ? '+' : ''}{preview.rebalance.shiftDelta.toFixed(2)} pp)
                  </div>
                )}
              </GlassCard>

              <div className="flex gap-3">
                <button onClick={() => setStep(3)} className="px-4 py-2 rounded-xl text-sm text-slate-600 bg-white/30 hover:bg-white/50">← Back</button>
                <button onClick={handleCommit}
                  className="flex items-center gap-2 px-6 py-2 rounded-xl text-sm text-white bg-green-500 hover:bg-green-600 font-semibold shadow">
                  <Play className="w-4 h-4" /> Commit Batch Savings
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

// ── Tab 3: Savings Ledger ─────────────────────────────────────────────────────

function LedgerTab() {
  const { batchSavings } = useSavingsStore()
  const [expanded, setExpanded] = useState<string | null>(null)
  const [lubeFilter, setLubeFilter] = useState('all')

  const uniqueLubes = Array.from(new Set(batchSavings.map(r => r.lubeName)))
  const filtered = lubeFilter === 'all' ? batchSavings : batchSavings.filter(r => r.lubeName === lubeFilter)

  return (
    <div className="space-y-4">
      {/* Filter */}
      <div className="flex gap-2 flex-wrap">
        {['all', ...uniqueLubes].map(l => (
          <button key={l} onClick={() => setLubeFilter(l)}
            className={clsx('px-3 py-1.5 rounded-full text-xs font-semibold transition-all',
              lubeFilter === l ? 'bg-blue-500 text-white' : 'bg-white/30 text-slate-600 hover:bg-white/50')}>
            {l === 'all' ? 'All Grades' : l}
          </button>
        ))}
      </div>

      {/* Batch list */}
      {filtered.length === 0 ? (
        <GlassCard className="p-8 text-center text-slate-400 text-sm">No batch records yet — use the COA Calculator to commit batches.</GlassCard>
      ) : (
        <div className="space-y-3">
          {filtered.map(rec => (
            <GlassCard key={rec.id} className="p-0 overflow-hidden">
              <button
                className="w-full p-4 flex items-center justify-between hover:bg-white/20 transition-colors"
                onClick={() => setExpanded(expanded === rec.id ? null : rec.id)}
              >
                <div className="flex items-center gap-4 text-left">
                  <div className={clsx('w-2 h-12 rounded-l-full flex-shrink-0', rec.inSpec ? 'bg-green-400' : 'bg-red-400')} />
                  <div>
                    <div className="font-semibold text-slate-800">{rec.batchId}</div>
                    <div className="text-xs text-slate-500">{rec.lubeName} · {rec.batchDate} · {rec.batchMT.toFixed(1)} MT</div>
                  </div>
                  <span className={clsx('text-xs px-2 py-0.5 rounded-full ml-2',
                    rec.rebalance.applied ? 'bg-blue-100 text-blue-700' : rec.inSpec ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700')}>
                    {rec.rebalance.applied ? '⚙ Rebalanced' : rec.inSpec ? '✓ In spec' : '⚠ Out of spec'}
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="font-bold text-slate-800 text-lg">{formatUSD(rec.savings.totalSaving)}</div>
                    <div className="text-xs text-slate-500">total saving</div>
                  </div>
                  {expanded === rec.id ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                </div>
              </button>

              {/* Inline drilldown */}
              <AnimatePresence>
                {expanded === rec.id && (
                  <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                    <div className="px-6 pb-5 pt-2 bg-white/10 space-y-4">
                      {/* Stream breakdown */}
                      <div className="grid grid-cols-3 gap-3">
                        {[
                          { label: 'Material Avoidance', value: rec.savings.materialAvoided, color: 'bg-blue-100 text-blue-700' },
                          { label: 'Elemental Saving',   value: rec.savings.elementalSaving, color: 'bg-amber-100 text-amber-700' },
                          { label: 'RFT Lift',           value: rec.savings.rftLifted,       color: 'bg-green-100 text-green-700' },
                        ].map(({ label, value, color }) => (
                          <div key={label} className={clsx('rounded-xl p-3 text-center', color)}>
                            <div className="text-xs font-medium mb-1">{label}</div>
                            <div className="font-bold text-lg">{formatUSD(value)}</div>
                          </div>
                        ))}
                      </div>

                      {/* Derivation trace */}
                      <div>
                        <div className="text-xs font-semibold text-slate-500 uppercase mb-2">Derivation</div>
                        <div className="space-y-1">
                          {rec.savings.steps.map((s, i) => (
                            <div key={i} className="font-mono text-xs text-slate-600 bg-white/30 rounded px-3 py-1">{s}</div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </GlassCard>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Tab 4: Analytics ──────────────────────────────────────────────────────────

function AnalyticsTab() {
  const { batchSavings, portfolioScenarios } = useSavingsStore()

  // Batch timeline (savings over time)
  const timeline = [...batchSavings]
    .sort((a, b) => a.batchDate.localeCompare(b.batchDate))
    .slice(-20)
    .map(r => ({
      date: r.batchDate.slice(5),
      material: Math.round(r.savings.materialAvoided),
      rft: Math.round(r.savings.rftLifted),
      elemental: Math.round(r.savings.elementalSaving),
    }))

  // Heatmap data: lube × scenario
  const lubeIds = SEED_LUBE_PROFILES.map(p => p.lubeId)
  const heatRows = SEED_LUBE_PROFILES.map(p => {
    const recs = batchSavings.filter(r => r.lubeId === p.lubeId)
    const captured = recs.reduce((s, r) => s + r.savings.totalSaving, 0)
    const annual = captured * (365 / 30)
    return {
      name: p.gradeCode,
      conservative: Math.round(annual * 0.67),
      expected: Math.round(annual),
      optimistic: Math.round(annual * 1.33),
    }
  })

  const maxVal = Math.max(...heatRows.map(r => r.optimistic), 1)

  function heatColor(val: number) {
    const t = val / maxVal
    if (t < 0.33) return `rgba(59,130,246,${0.2 + t * 0.8})`
    if (t < 0.66) return `rgba(139,92,246,${0.3 + t * 0.5})`
    return `rgba(239,68,68,${0.3 + t * 0.7})`
  }

  return (
    <div className="space-y-6">
      {/* Headline stats */}
      {portfolioScenarios && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Expected Savings', value: formatUSD(portfolioScenarios.expected.total), sub: 'annual projection', color: 'border-blue-400' },
            { label: 'Conservative', value: formatUSD(portfolioScenarios.conservative.total), sub: 'Year-1 commit', color: 'border-slate-400' },
            { label: 'Optimistic', value: formatUSD(portfolioScenarios.optimistic.total), sub: 'upper bound', color: 'border-green-400' },
            { label: '% of Material Cost', value: `${portfolioScenarios.expected.savingsAsMaterialPct.toFixed(1)}%`, sub: 'expected scenario', color: 'border-amber-400' },
          ].map(({ label, value, sub, color }) => (
            <GlassCard key={label} className={`p-4 border-l-4 ${color}`}>
              <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">{label}</div>
              <div className="text-xl font-bold text-slate-800">{value}</div>
              <div className="text-xs text-slate-400">{sub}</div>
            </GlassCard>
          ))}
        </div>
      )}

      {/* Savings timeline */}
      <GlassCard className="p-5">
        <h3 className="text-sm font-semibold text-slate-700 mb-4 uppercase tracking-wide">Per-Batch Savings Timeline (last 20)</h3>
        {timeline.length === 0 ? (
          <p className="text-slate-400 text-sm text-center py-8">No batch data</p>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={timeline}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `$${v}`} />
              <Tooltip formatter={(v: number) => formatUSD(v)} />
              <Bar dataKey="material"  stackId="s" fill={STREAM_COLORS.material}  name="Material" />
              <Bar dataKey="elemental" stackId="s" fill={STREAM_COLORS.elemental} name="Elemental" />
              <Bar dataKey="rft"       stackId="s" fill={STREAM_COLORS.rft}       name="RFT Lift" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </GlassCard>

      {/* Portfolio heatmap */}
      <GlassCard className="p-5">
        <h3 className="text-sm font-semibold text-slate-700 mb-4 uppercase tracking-wide">Portfolio Savings Heatmap</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr>
              <th className="text-left py-2 text-slate-500 pr-4">Grade</th>
              {['Conservative', 'Expected', 'Optimistic'].map(s => (
                <th key={s} className="text-right py-2 text-slate-500 w-32">{s}</th>
              ))}
            </tr></thead>
            <tbody>
              {heatRows.map(row => (
                <tr key={row.name}>
                  <td className="py-2 pr-4 font-medium text-slate-700">{row.name}</td>
                  {['conservative', 'expected', 'optimistic'].map(s => {
                    const val = row[s as 'conservative'|'expected'|'optimistic']
                    return (
                      <td key={s} className="py-1.5 px-2">
                        <div className="rounded-lg px-3 py-2 text-right font-semibold transition-transform hover:scale-105"
                          style={{ background: heatColor(val), color: val > maxVal * 0.5 ? '#fff' : '#334155' }}>
                          {formatUSD(val)}
                        </div>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-3 flex items-center gap-2 text-xs text-slate-400">
            <span>Low</span>
            <div className="flex-1 h-2 rounded-full" style={{ background: 'linear-gradient(90deg, rgba(59,130,246,0.3), rgba(139,92,246,0.6), rgba(239,68,68,0.9))' }} />
            <span>High</span>
          </div>
        </div>
      </GlassCard>
    </div>
  )
}

// ── Main SavingsPage ──────────────────────────────────────────────────────────

export function SavingsPage() {
  const [tab, setTab] = useState<'overview' | 'calculator' | 'ledger' | 'analytics'>('overview')

  const TABS = [
    { key: 'overview',    label: 'Overview',       icon: BarChart3 },
    { key: 'calculator',  label: 'COA Calculator',  icon: FlaskConical },
    { key: 'ledger',      label: 'Savings Ledger',  icon: Layers },
    { key: 'analytics',   label: 'Analytics',       icon: Activity },
  ] as const

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-emerald-500" />
            <h1 className="text-2xl font-bold text-slate-800">Savings Impact</h1>
            <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-semibold">OmniBlend Discover</span>
          </div>
          <p className="text-sm text-slate-500 mt-0.5">Material avoidance · Elemental potency · RFT lift — three savings streams, one audit trail</p>
        </div>
        <div className="flex items-center gap-1.5">
          <Target className="w-4 h-4 text-slate-400" />
          <span className="text-xs text-slate-400">Ref: 25,000 MT · $3.15/MT RFT · 90→99% target</span>
        </div>
      </div>

      {/* Tab navigation */}
      <div className="flex gap-1 bg-white/20 rounded-xl p-1 w-fit">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setTab(key as typeof tab)}
            className={clsx('flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200',
              tab === key ? 'bg-white/80 shadow text-slate-800 border border-white/60' : 'text-slate-500 hover:bg-white/30')}>
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
          {tab === 'overview'   && <OverviewTab />}
          {tab === 'calculator' && <COAWizardTab />}
          {tab === 'ledger'     && <LedgerTab />}
          {tab === 'analytics'  && <AnalyticsTab />}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
