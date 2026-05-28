import { useState, useCallback } from 'react'
import {
  TrendingUp, DollarSign, Award, ChevronRight, ChevronDown,
  CheckCircle2, AlertTriangle, RotateCcw, Play, BarChart3,
  Layers, FlaskConical, Activity, Zap, Target, FileText,
  RefreshCw, Wrench
} from 'lucide-react'
import { clsx } from 'clsx'
import { motion, AnimatePresence } from 'framer-motion'
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

// ─── Palette ──────────────────────────────────────────────────────────────────
const BRAND    = '#1F3864'
const BRAND2   = '#2E75B6'
const SUCCESS  = '#1D9E75'
const WARNING  = '#BA7517'
const DANGER   = '#A32D2D'
const PURPLE   = '#7F77DD'

const LUBE_COLORS = ['#2E75B6','#1D9E75','#BA7517','#A32D2D','#7F77DD','#5DCAA5']

type Severity = 'clean' | 'rebalanced' | 'hardware' | 'offspec'
type FilterMode = 'all' | 'rebalanced' | 'hardware' | 'clean'

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getSeverity(rec: BatchSavingsRecord, profiles: LubeProfile[]): Severity {
  if (!rec.inSpec) return 'offspec'
  if (rec.rebalance.applied) return 'rebalanced'
  const profile = profiles.find(p => p.lubeId === rec.lubeId)
  if (profile) {
    const addComp = profile.components.find(c => c.role === 'additive')
    if (addComp?.stdCa && rec.coaInputs.additiveActualCa && rec.coaInputs.additiveActualCa > addComp.stdCa * 1.04) return 'hardware'
    if (addComp?.stdZn && rec.coaInputs.additiveActualZn && rec.coaInputs.additiveActualZn > addComp.stdZn * 1.04) return 'hardware'
  }
  return 'clean'
}

function getBriefing(rec: BatchSavingsRecord, sev: Severity, profile: LubeProfile | undefined): string {
  const rftGapPct = profile ? Math.round(((0.99 - profile.currentRftPct / 100) / (0.99 - 0.90)) * 100) : 0
  if (sev === 'rebalanced')
    return `OmniBlend Discover shifted the recipe before execution — swing adjustment ${rec.rebalance.shiftDelta >= 0 ? '+' : ''}${rec.rebalance.shiftDelta.toFixed(2)} pp. KV corrected from ${rec.rebalance.predictedKVBefore.toFixed(2)} to ${rec.rebalance.achievedKV.toFixed(2)} cSt. Material top-up avoided; RFT credit booked at ${rftGapPct}% gap closure.`
  if (sev === 'hardware')
    return `Lab elemental readings above prediction — additive flow-meter may have dispensed more than recorded. Schedule calibration. Batch confirmed in spec; RFT credit booked.`
  if (sev === 'offspec')
    return `Blend landed out of specification. Savings not credited this batch. Review COA inputs and recipe configuration before next run.`
  return `Standard recipe ran clean. Predicted KV ${rec.rebalance.achievedKV.toFixed(2)} cSt within ±${profile?.specWindow ?? '—'} spec window. RFT credit booked at ${rftGapPct}% gap closure toward 99% target.`
}

const SEV_STYLE: Record<Severity, { border: string; badge: string; badgeText: string; label: string }> = {
  clean:      { border: SUCCESS,  badge: '#E1F5EE', badgeText: '#0F6E56', label: '✓ In spec'    },
  rebalanced: { border: BRAND2,   badge: '#E6F1FB', badgeText: '#0C447C', label: '⚙ Rebalanced' },
  hardware:   { border: WARNING,  badge: '#FAEEDA', badgeText: '#854F0B', label: '🔧 HW flagged' },
  offspec:    { border: DANGER,   badge: '#FCEBEB', badgeText: '#791F1F', label: '✗ Off-spec'   },
}

// ─── COA Variance Table ───────────────────────────────────────────────────────
function COAVarianceTable({ rec, profile }: { rec: BatchSavingsRecord; profile: LubeProfile }) {
  type Row = { label: string; std: number; actual: number | undefined; unit: string }
  const rows: Row[] = []

  for (const comp of profile.components) {
    if (comp.role === 'swing_heavy' && comp.stdKV !== undefined)
      rows.push({ label: comp.name + ' KV', std: comp.stdKV, actual: rec.coaInputs.swingHeavyActualKV, unit: 'cSt' })
    if (comp.role === 'swing_light' && comp.stdKV !== undefined)
      rows.push({ label: comp.name + ' KV', std: comp.stdKV, actual: rec.coaInputs.swingLightActualKV, unit: 'cSt' })
    if (comp.role === 'additive') {
      if (comp.stdKV !== undefined)
        rows.push({ label: comp.name + ' KV',  std: comp.stdKV,  actual: rec.coaInputs.additiveActualKV,  unit: 'cSt' })
      if (comp.stdCa !== undefined)
        rows.push({ label: 'Additive Ca %',     std: comp.stdCa,  actual: rec.coaInputs.additiveActualCa,  unit: '%'   })
      if (comp.stdZn !== undefined)
        rows.push({ label: 'Additive Zn %',     std: comp.stdZn,  actual: rec.coaInputs.additiveActualZn,  unit: '%'   })
      if (comp.stdP  !== undefined)
        rows.push({ label: 'Additive P %',      std: comp.stdP,   actual: rec.coaInputs.additiveActualP,   unit: '%'   })
    }
  }

  return (
    <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>
      <thead>
        <tr style={{ borderBottom: '1px solid #DCE0E7', background: '#F4F6FA' }}>
          {['Property','Standard','Actual','Variance','Status'].map(h => (
            <th key={h} style={{ padding: '6px 8px', textAlign: h === 'Property' ? 'left' : 'right',
              color: '#5F5E5A', fontWeight: 600, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.4px' }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map(({ label, std, actual, unit }) => {
          const vPct = actual !== undefined ? ((actual - std) / std) * 100 : null
          const isUp   = vPct !== null && vPct >  2
          const isDown = vPct !== null && vPct < -2
          return (
            <tr key={label} style={{ borderBottom: '1px solid #ECEFF4' }}>
              <td style={{ padding: '6px 8px', color: '#1a1a1a', fontWeight: 500 }}>{label}</td>
              <td style={{ padding: '6px 8px', textAlign: 'right', color: '#888780', fontVariantNumeric: 'tabular-nums' }}>{std.toFixed(std < 1 ? 4 : std < 10 ? 2 : 1)} {unit}</td>
              <td style={{ padding: '6px 8px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#1a1a1a' }}>{actual !== undefined ? `${actual.toFixed(actual < 1 ? 4 : actual < 10 ? 2 : 1)} ${unit}` : '—'}</td>
              <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600,
                color: isUp ? DANGER : isDown ? BRAND2 : '#888780' }}>
                {vPct !== null ? `${vPct >= 0 ? '+' : ''}${vPct.toFixed(1)}%` : '—'}
              </td>
              <td style={{ padding: '6px 8px', textAlign: 'right' }}>
                <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 10, fontWeight: 500,
                  background: isUp ? '#FAEEDA' : isDown ? '#E6F1FB' : '#E1F5EE',
                  color: isUp ? '#854F0B' : isDown ? '#0C447C' : '#0F6E56' }}>
                  {isUp ? '↑ over' : isDown ? '↓ under' : vPct !== null ? '✓ on-spec' : '—'}
                </span>
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

// ─── Compute Cards ────────────────────────────────────────────────────────────
function ComputeCards({ rec, profile }: { rec: BatchSavingsRecord; profile: LubeProfile }) {
  const s = rec.savings
  const rb = rec.rebalance
  const addComp = profile.components.find(c => c.role === 'additive')
  const rftGapPct = ((0.99 - profile.currentRftPct / 100) / (0.99 - 0.90)) * 100

  const cardStyle = (color: string): React.CSSProperties => ({
    background: '#F4F6FA', borderRadius: 8, padding: '12px 14px',
    borderLeft: `3px solid ${color}`,
  })
  const titleStyle: React.CSSProperties = { fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#5F5E5A', fontWeight: 600, marginBottom: 8 }
  const rowStyle: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px dashed #DCE0E7', fontSize: 12 }
  const totalRow: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', padding: '6px 0 0', borderTop: `1px solid #B4B8C2`, marginTop: 4, fontSize: 12 }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
      {/* Material Avoidance */}
      <div style={cardStyle(SUCCESS)}>
        <div style={titleStyle}>💧 Material Avoidance</div>
        <div style={rowStyle}><span style={{ color: '#5F5E5A' }}>Top-up rate</span><strong style={{ fontVariantNumeric: 'tabular-nums' }}>{profile.topupPct}%</strong></div>
        <div style={rowStyle}><span style={{ color: '#5F5E5A' }}>Cost differential</span><strong>${(profile.additiveCostMT - profile.baseOilCostMT).toFixed(0)}/MT</strong></div>
        <div style={rowStyle}><span style={{ color: '#5F5E5A' }}>Batch mass</span><strong>{rec.batchMT.toFixed(1)} MT</strong></div>
        <div style={rowStyle}><span style={{ color: '#5F5E5A' }}>Rebalance applied</span><strong>{rb.applied ? `+${rb.shiftDelta.toFixed(2)}pp` : '—'}</strong></div>
        <div style={totalRow}><span style={{ color: '#1a1a1a', fontWeight: 600 }}>Material Avoided</span><strong style={{ color: SUCCESS, fontSize: 14 }}>{formatUSD(s.materialAvoided)}</strong></div>
      </div>

      {/* Elemental Potency */}
      <div style={cardStyle(WARNING)}>
        <div style={titleStyle}>⚗️ Elemental Potency</div>
        {addComp?.stdCa !== undefined && (
          <div style={rowStyle}>
            <span style={{ color: '#5F5E5A' }}>Ca overage</span>
            <strong style={{ color: rec.coaInputs.additiveActualCa && addComp.stdCa && rec.coaInputs.additiveActualCa > addComp.stdCa ? DANGER : '#888780' }}>
              {rec.coaInputs.additiveActualCa && addComp.stdCa ? `+${(((rec.coaInputs.additiveActualCa - addComp.stdCa) / addComp.stdCa) * 100).toFixed(1)}%` : '—'}
            </strong>
          </div>
        )}
        {addComp?.stdZn !== undefined && (
          <div style={rowStyle}>
            <span style={{ color: '#5F5E5A' }}>Zn overage</span>
            <strong style={{ color: rec.coaInputs.additiveActualZn && addComp.stdZn && rec.coaInputs.additiveActualZn > addComp.stdZn ? DANGER : '#888780' }}>
              {rec.coaInputs.additiveActualZn && addComp.stdZn ? `+${(((rec.coaInputs.additiveActualZn - addComp.stdZn) / addComp.stdZn) * 100).toFixed(1)}%` : '—'}
            </strong>
          </div>
        )}
        {addComp?.stdP !== undefined && (
          <div style={rowStyle}>
            <span style={{ color: '#5F5E5A' }}>P overage</span>
            <strong style={{ color: rec.coaInputs.additiveActualP && addComp.stdP && rec.coaInputs.additiveActualP > addComp.stdP ? DANGER : '#888780' }}>
              {rec.coaInputs.additiveActualP && addComp.stdP ? `+${(((rec.coaInputs.additiveActualP - addComp.stdP) / addComp.stdP) * 100).toFixed(1)}%` : '—'}
            </strong>
          </div>
        )}
        <div style={rowStyle}><span style={{ color: '#5F5E5A' }}>Reducible frac</span><strong>{(s.reducibleFrac * 100).toFixed(2)}%</strong></div>
        <div style={totalRow}><span style={{ color: '#1a1a1a', fontWeight: 600 }}>Elemental Saving</span><strong style={{ color: WARNING, fontSize: 14 }}>{formatUSD(s.elementalSaving)}</strong></div>
      </div>

      {/* RFT Lift */}
      <div style={cardStyle(PURPLE)}>
        <div style={titleStyle}>🎯 RFT Lift</div>
        <div style={rowStyle}><span style={{ color: '#5F5E5A' }}>Current RFT</span><strong>{profile.currentRftPct.toFixed(1)}%</strong></div>
        <div style={rowStyle}><span style={{ color: '#5F5E5A' }}>Target RFT</span><strong>99.0%</strong></div>
        <div style={rowStyle}><span style={{ color: '#5F5E5A' }}>Gap closure</span><strong>{rftGapPct.toFixed(1)}%</strong></div>
        <div style={rowStyle}><span style={{ color: '#5F5E5A' }}>Rate</span><strong>$3.15/MT</strong></div>
        <div style={rowStyle}><span style={{ color: '#5F5E5A' }}>In spec</span><strong style={{ color: rb.inSpec ? SUCCESS : DANGER }}>{rb.inSpec ? '✓ Yes' : '✗ No'}</strong></div>
        <div style={totalRow}><span style={{ color: '#1a1a1a', fontWeight: 600 }}>RFT Lift</span><strong style={{ color: PURPLE, fontSize: 14 }}>{formatUSD(s.rftLifted)}</strong></div>
      </div>
    </div>
  )
}

// ─── Full Batch Drilldown ─────────────────────────────────────────────────────
function BatchDrilldown({ rec, profiles }: { rec: BatchSavingsRecord; profiles: LubeProfile[] }) {
  const profile = profiles.find(p => p.lubeId === rec.lubeId)
  if (!profile) return null
  const sev = getSeverity(rec, profiles)
  const sevStyle = SEV_STYLE[sev]

  return (
    <div style={{ padding: '16px 20px', borderTop: `2px solid ${BRAND2}`, background: '#F4F6FA', display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Batch briefing */}
      <div style={{ padding: '10px 14px', borderRadius: 8, borderLeft: `4px solid ${sevStyle.border}`,
        background: sev === 'clean' ? 'rgba(29,158,117,0.06)' : sev === 'rebalanced' ? 'rgba(46,117,182,0.06)' : sev === 'hardware' ? 'rgba(186,117,23,0.07)' : 'rgba(163,45,45,0.07)' }}>
        <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 4, color: '#1a1a1a', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Batch Briefing — <span style={{ color: sevStyle.badgeText }}>{sevStyle.label}</span>
        </div>
        <div style={{ fontSize: 12, color: '#5F5E5A', lineHeight: 1.6 }}>{getBriefing(rec, sev, profile)}</div>
      </div>

      {/* Two-column: COA variance + savings hero */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 16 }}>
        {/* COA Variance */}
        <div style={{ background: '#fff', borderRadius: 8, border: '1px solid #DCE0E7', overflow: 'hidden' }}>
          <div style={{ padding: '8px 12px', background: '#ECEFF4', fontSize: 11, fontWeight: 600, color: BRAND, textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid #DCE0E7' }}>
            COA Receipt — Actual vs Standard
          </div>
          <div style={{ padding: 2 }}>
            <COAVarianceTable rec={rec} profile={profile} />
          </div>
        </div>

        {/* Savings hero + rebalance */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Hero saving */}
          <div style={{ background: `linear-gradient(135deg, ${BRAND} 0%, ${BRAND2} 60%, #5DCAA5 100%)`, borderRadius: 10, padding: '16px 18px', color: '#fff', textAlign: 'center' }}>
            <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.6px', opacity: 0.8, marginBottom: 6 }}>Discover Savings · This Batch</div>
            <div style={{ fontSize: 30, fontWeight: 800, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.5px' }}>{formatUSD(rec.savings.totalSaving)}</div>
            <div style={{ marginTop: 8, fontSize: 11, opacity: 0.8, display: 'flex', justifyContent: 'center', gap: 12 }}>
              <span>Mat: {formatUSD(rec.savings.materialAvoided)}</span>
              <span>Elem: {formatUSD(rec.savings.elementalSaving)}</span>
              <span>RFT: {formatUSD(rec.savings.rftLifted)}</span>
            </div>
          </div>

          {/* Rebalance audit card */}
          <div style={{ background: '#fff', border: `1px solid #DCE0E7`, borderRadius: 8, padding: '10px 12px',
            borderLeft: `4px solid ${rec.rebalance.applied ? BRAND2 : SUCCESS}` }}>
            <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#1a1a1a', marginBottom: 4 }}>
              {rec.rebalance.applied ? 'Rebalance Engine' : 'Blend Audit'}
            </div>
            <div style={{ fontSize: 11, color: '#5F5E5A', lineHeight: 1.5 }}>{rec.rebalance.message}</div>
            {rec.rebalance.applied && (
              <div style={{ marginTop: 6, fontSize: 11, fontFamily: 'ui-monospace, monospace', color: BRAND2 }}>
                KV: {rec.rebalance.predictedKVBefore.toFixed(2)} → {rec.rebalance.achievedKV.toFixed(2)} cSt
                {' · '}shift {rec.rebalance.shiftDelta >= 0 ? '+' : ''}{rec.rebalance.shiftDelta.toFixed(2)} pp
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Compute cards */}
      <ComputeCards rec={rec} profile={profile} />

      {/* Formula trace */}
      <div>
        <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: BRAND, marginBottom: 6 }}>
          Derivation Trace
        </div>
        <div style={{ background: '#fff', border: '1px solid #DCE0E7', borderRadius: 6, padding: '10px 12px',
          fontFamily: 'ui-monospace, "SFMono-Regular", Menlo, monospace', fontSize: 11, color: '#5F5E5A', lineHeight: 1.7 }}>
          {rec.savings.steps.map((step, i) => (
            <div key={i}>{step}</div>
          ))}
        </div>
      </div>

      {/* Audit reference */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div style={{ background: '#fff', border: '1px solid #DCE0E7', borderRadius: 8, padding: '10px 14px', borderLeft: `4px solid ${SUCCESS}` }}>
          <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Case 1 — Flow Meter</div>
          <div style={{ display: 'inline-block', fontSize: 10, padding: '2px 8px', borderRadius: 8, fontWeight: 500, marginBottom: 6,
            background: sev === 'hardware' ? '#FAEEDA' : '#E1F5EE', color: sev === 'hardware' ? '#854F0B' : '#0F6E56' }}>
            {sev === 'hardware' ? 'Flagged' : 'Not triggered'}
          </div>
          <div style={{ fontSize: 11, color: '#5F5E5A', lineHeight: 1.5 }}>
            Lab Ca/Zn above prediction → additive over-dispensed. Schedule flow-meter calibration.
          </div>
        </div>
        <div style={{ background: '#fff', border: '1px solid #DCE0E7', borderRadius: 8, padding: '10px 14px', borderLeft: `4px solid ${WARNING}` }}>
          <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Case 2 — Valve Leakage</div>
          <div style={{ display: 'inline-block', fontSize: 10, padding: '2px 8px', borderRadius: 8, fontWeight: 500, marginBottom: 6,
            background: '#E1F5EE', color: '#0F6E56' }}>
            Not triggered
          </div>
          <div style={{ fontSize: 11, color: '#5F5E5A', lineHeight: 1.5 }}>
            Metals match, KV low → excess base oil. Inspect base-oil valves for bypass.
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Tab 1: Portfolio Overview ────────────────────────────────────────────────
function PortfolioTab() {
  const { portfolioScenarios, activeScenario, setActiveScenario, batchSavings } = useSavingsStore()
  const scenarios = portfolioScenarios
  if (!scenarios) return <div style={{ padding: 32, textAlign: 'center', color: '#888780' }}>No data yet.</div>

  const active: ScenarioValues = scenarios[activeScenario]

  const lubeMap: Record<string, { lubeName: string; material: number; elemental: number; rft: number; total: number; batches: number; color: string }> = {}
  batchSavings.forEach(rec => {
    if (!lubeMap[rec.lubeId]) {
      const idx = SEED_LUBE_PROFILES.findIndex(p => p.lubeId === rec.lubeId)
      lubeMap[rec.lubeId] = { lubeName: rec.lubeName, material: 0, elemental: 0, rft: 0, total: 0, batches: 0, color: LUBE_COLORS[idx % LUBE_COLORS.length] }
    }
    const s = rec.savings
    lubeMap[rec.lubeId].material  += s.materialAvoided
    lubeMap[rec.lubeId].elemental += s.elementalSaving
    lubeMap[rec.lubeId].rft       += s.rftLifted
    lubeMap[rec.lubeId].total     += s.totalSaving
    lubeMap[rec.lubeId].batches   += 1
  })
  const lubeRows = Object.values(lubeMap).sort((a, b) => b.total - a.total)

  const scenarios3 = [
    { key: 'conservative' as SavingsScenario, label: 'Conservative', mult: '0.67×', pill: { bg: '#FAEEDA', color: '#854F0B' } },
    { key: 'expected'     as SavingsScenario, label: 'Expected',     mult: '1.00×', pill: { bg: '#E1F5EE', color: '#0F6E56' } },
    { key: 'optimistic'   as SavingsScenario, label: 'Optimistic',   mult: '1.33×', pill: { bg: '#E6F1FB', color: '#0C447C' } },
  ]

  const totalCaptured = batchSavings.reduce((s, r) => s + r.savings.totalSaving, 0)
  const maxBar = Math.max(...lubeRows.map(r => r.total), 1)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Hero */}
      <div style={{ background: `linear-gradient(135deg, ${BRAND} 0%, ${BRAND2} 60%, #5DCAA5 100%)`, borderRadius: 12, padding: '22px 28px', color: '#fff' }}>
        <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.6px', opacity: 0.8, marginBottom: 8 }}>
          <Zap style={{ display: 'inline', width: 14, height: 14, marginRight: 6 }} />
          OmniBlend Discover — Expected Annual Savings
        </div>
        <div style={{ fontSize: 44, fontWeight: 900, letterSpacing: '-1px', lineHeight: 1 }}>{formatUSD(scenarios.expected.total)}</div>
        <div style={{ marginTop: 10, fontSize: 13, opacity: 0.8, display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          <span>Conservative: {formatUSD(scenarios.conservative.total)}</span>
          <span>Optimistic: {formatUSD(scenarios.optimistic.total)}</span>
          <span>{scenarios.expected.savingsAsMaterialPct.toFixed(1)}% of material cost</span>
          <span>{batchSavings.length} batches captured</span>
        </div>
      </div>

      {/* Stat tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {[
          { label: 'Captured 30d', value: formatUSD(totalCaptured), border: BRAND2, sub: `${batchSavings.length} batches` },
          { label: 'Material Avoidance', value: formatUSD(active.material), border: SUCCESS, sub: 'annual expected' },
          { label: 'RFT Lift', value: formatUSD(active.rft), border: PURPLE, sub: '$3.15/MT reference' },
          { label: 'Capacity Freed', value: `${Math.round(active.capacityHours)} hrs`, border: WARNING, sub: '2 hrs/batch' },
        ].map(({ label, value, border, sub }) => (
          <div key={label} style={{ background: '#F4F6FA', borderRadius: 8, padding: '14px 16px', borderLeft: `3px solid ${border}` }}>
            <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 500, color: '#5F5E5A', marginBottom: 4 }}>{label}</div>
            <div style={{ fontSize: 22, fontWeight: 600, color: '#1a1a1a', fontVariantNumeric: 'tabular-nums' }}>{value}</div>
            <div style={{ fontSize: 11, color: '#888780', marginTop: 3 }}>{sub}</div>
          </div>
        ))}
      </div>

      {/* Scenario mode toggle */}
      <div style={{ display: 'flex', gap: 6, padding: 6, background: '#F4F6FA', borderRadius: 8, width: 'fit-content' }}>
        {scenarios3.map(({ key, label, mult, pill }) => (
          <button key={key} onClick={() => setActiveScenario(key)}
            style={{ padding: '8px 16px', borderRadius: 6, cursor: 'pointer', fontWeight: 500, fontSize: 12, border: 'none', transition: 'all 0.15s',
              background: activeScenario === key ? '#fff' : 'transparent',
              color: activeScenario === key ? BRAND : '#5F5E5A',
              boxShadow: activeScenario === key ? '0 1px 4px rgba(0,0,0,0.08)' : 'none' }}>
            {label} <span style={{ fontSize: 10, opacity: 0.7 }}>{mult}</span>
          </button>
        ))}
      </div>

      {/* Scenario comparison table */}
      <div style={{ background: '#fff', border: '1px solid #DCE0E7', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid #DCE0E7' }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1a' }}>Scenario Comparison</div>
          <div style={{ fontSize: 12, color: '#888780', marginTop: 2 }}>Annual projections from 30-day captured data × 365/30</div>
        </div>
        <div style={{ padding: '0 20px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #B4B8C2' }}>
                {['Scenario','Material $','Elemental $','RFT Lift $','Total $','% Cost'].map((h, i) => (
                  <th key={h} style={{ padding: '10px 8px', textAlign: i === 0 ? 'left' : 'right', color: '#5F5E5A', fontWeight: 500, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.4px' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {scenarios3.map(({ key, label, mult, pill }) => {
                const s: ScenarioValues = scenarios[key]
                const isActive = activeScenario === key
                return (
                  <tr key={key} onClick={() => setActiveScenario(key)} style={{ cursor: 'pointer', background: isActive ? 'rgba(46,117,182,0.06)' : undefined, borderBottom: '1px solid #ECEFF4' }}>
                    <td style={{ padding: '10px 8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, fontWeight: 500, background: pill.bg, color: pill.color }}>{label} {mult}</span>
                      </div>
                    </td>
                    <td style={{ padding: '10px 8px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatUSD(s.material)}</td>
                    <td style={{ padding: '10px 8px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatUSD(s.elemental)}</td>
                    <td style={{ padding: '10px 8px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatUSD(s.rft)}</td>
                    <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: '#1a1a1a' }}>{formatUSD(s.total)}</td>
                    <td style={{ padding: '10px 8px', textAlign: 'right', color: '#5F5E5A' }}>{s.savingsAsMaterialPct.toFixed(1)}%</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Portfolio by grade */}
      {lubeRows.length > 0 && (
        <div style={{ background: '#fff', border: '1px solid #DCE0E7', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid #DCE0E7', fontSize: 14, fontWeight: 600, color: '#1a1a1a' }}>Portfolio by Lubricant</div>
          <div style={{ padding: '0 20px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #B4B8C2' }}>
                  {['Lubricant','Batches','Material $','Elemental $','RFT $','Total $','Share'].map((h, i) => (
                    <th key={h} style={{ padding: '10px 8px', textAlign: i === 0 ? 'left' : 'right', color: '#5F5E5A', fontWeight: 500, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.4px' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lubeRows.map(row => (
                  <tr key={row.lubeName} style={{ borderBottom: '1px solid #ECEFF4' }}>
                    <td style={{ padding: '10px 8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: row.color, flexShrink: 0 }} />
                        <span style={{ fontWeight: 600, color: '#1a1a1a' }}>{row.lubeName}</span>
                      </div>
                    </td>
                    <td style={{ padding: '10px 8px', textAlign: 'right', color: '#888780' }}>{row.batches}</td>
                    <td style={{ padding: '10px 8px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatUSD(row.material)}</td>
                    <td style={{ padding: '10px 8px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatUSD(row.elemental)}</td>
                    <td style={{ padding: '10px 8px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatUSD(row.rft)}</td>
                    <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 600, color: '#1a1a1a', fontVariantNumeric: 'tabular-nums' }}>{formatUSD(row.total)}</td>
                    <td style={{ padding: '10px 8px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
                        <div style={{ width: 60, height: 5, background: '#ECEFF4', borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{ width: `${(row.total / maxBar) * 100}%`, height: '100%', background: row.color, borderRadius: 3 }} />
                        </div>
                        <span style={{ fontSize: 11, color: '#888780' }}>{((row.total / (totalCaptured || 1)) * 100).toFixed(0)}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Formula strip */}
      <div style={{ background: '#F4F6FA', borderRadius: 8, padding: '12px 16px', fontFamily: 'ui-monospace, "SFMono-Regular", Menlo, monospace', fontSize: 11.5, color: '#5F5E5A', lineHeight: 1.8 }}>
        <div><strong style={{ color: BRAND }}>Stream 1 · Material Avoidance</strong> = (topupPct / 100) × (additiveCost − baseCost) × batchMT</div>
        <div><strong style={{ color: BRAND }}>Stream 2 · Elemental Potency</strong> = reducibleFrac × additiveMassFrac × batchMT × costDiff</div>
        <div><strong style={{ color: BRAND }}>Stream 3 · RFT Lift</strong> = $3.15/MT × batchMT × max(0, (0.99 − currentRFT) / 0.09)</div>
        <div><strong style={{ color: BRAND }}>Annual Projection</strong> = captured(30d) × (365 / 30) · Conservative ×0.67 · Expected ×1.00 · Optimistic ×1.33</div>
        <div style={{ marginTop: 6, paddingTop: 6, borderTop: '1px dashed #DCE0E7', color: '#888780' }}>
          Reference calibration: 25,000 MT/yr · 250 batches/yr · 90% RFT baseline · $2,500 additive · $850 base oil · 0.5% top-up → Conservative $39,375 · Expected $78,750 · 500 hrs freed
        </div>
      </div>
    </div>
  )
}

// ─── Tab 2: Batch Ledger ──────────────────────────────────────────────────────
function BatchLedgerTab() {
  const { batchSavings } = useSavingsStore()
  const profiles = SEED_LUBE_PROFILES
  const [expanded, setExpanded] = useState<string | null>(null)
  const [filterMode, setFilterMode] = useState<FilterMode>('all')
  const [lubeFilter, setLubeFilter] = useState('all')

  const uniqueLubes = Array.from(new Set(batchSavings.map(r => r.lubeName)))

  const filtered = batchSavings.filter(rec => {
    if (lubeFilter !== 'all' && rec.lubeName !== lubeFilter) return false
    if (filterMode === 'all') return true
    const sev = getSeverity(rec, profiles)
    if (filterMode === 'rebalanced') return sev === 'rebalanced'
    if (filterMode === 'hardware') return sev === 'hardware'
    if (filterMode === 'clean') return sev === 'clean'
    return true
  })

  // Sidebar aggregates
  const totalCaptured = batchSavings.reduce((s, r) => s + r.savings.totalSaving, 0)
  const totalMat = batchSavings.reduce((s, r) => s + r.savings.materialAvoided, 0)
  const totalRft = batchSavings.reduce((s, r) => s + r.savings.rftLifted, 0)
  const totalMT  = batchSavings.reduce((s, r) => s + r.batchMT, 0)
  const rebalanceCount = batchSavings.filter(r => r.rebalance.applied).length
  const hardwareCount  = batchSavings.filter(r => getSeverity(r, profiles) === 'hardware').length
  const realisedPerMT  = totalMT > 0 ? totalCaptured / totalMT : 0

  const byLube = SEED_LUBE_PROFILES.map((p, i) => {
    const recs = batchSavings.filter(r => r.lubeId === p.lubeId)
    return { name: p.lubeName, captured: recs.reduce((s, r) => s + r.savings.totalSaving, 0), count: recs.length, color: LUBE_COLORS[i % LUBE_COLORS.length] }
  }).filter(r => r.count > 0).sort((a, b) => b.captured - a.captured)

  const filterTabs: { key: FilterMode; label: string }[] = [
    { key: 'all',        label: `📋 All (${batchSavings.length})` },
    { key: 'rebalanced', label: `⚙ Rebalanced (${rebalanceCount})` },
    { key: 'hardware',   label: `🔧 HW Flagged (${hardwareCount})` },
    { key: 'clean',      label: `✓ In Spec` },
  ]

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 18, alignItems: 'start' }}>
      {/* Main */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Filter bar */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 4, padding: 5, background: '#F4F6FA', borderRadius: 8 }}>
            {filterTabs.map(({ key, label }) => (
              <button key={key} onClick={() => setFilterMode(key)}
                style={{ padding: '6px 12px', borderRadius: 5, cursor: 'pointer', fontWeight: 500, fontSize: 12, border: 'none', transition: 'all 0.15s',
                  background: filterMode === key ? '#fff' : 'transparent',
                  color: filterMode === key ? BRAND : '#5F5E5A',
                  boxShadow: filterMode === key ? '0 1px 4px rgba(0,0,0,0.08)' : 'none' }}>
                {label}
              </button>
            ))}
          </div>
          <select value={lubeFilter} onChange={e => setLubeFilter(e.target.value)}
            style={{ height: 34, border: '1px solid #DCE0E7', borderRadius: 8, padding: '0 10px', fontSize: 12, color: '#5F5E5A', background: '#fff' }}>
            <option value="all">All lubricants</option>
            {uniqueLubes.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>

        {/* Filter help */}
        <div style={{ fontSize: 11, color: '#888780' }}>
          {filterMode === 'all' && 'Every batch in the last 30 days, regardless of outcome.'}
          {filterMode === 'rebalanced' && 'OmniBlend Discover shifted the recipe before execution to keep KV in spec — material avoidance booked.'}
          {filterMode === 'hardware' && 'Lab COA diverged from prediction; flow-meter or valve issue flagged for inspection.'}
          {filterMode === 'clean' && 'Standard recipe ran clean; lab confirmed in spec; RFT credit booked.'}
        </div>

        {/* Batch cards */}
        {filtered.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#888780', background: '#fff', border: '1px solid #DCE0E7', borderRadius: 12 }}>
            No batches match this filter.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filtered.map(rec => {
              const sev = getSeverity(rec, profiles)
              const sevStyle = SEV_STYLE[sev]
              const isOpen = expanded === rec.id
              const profile = profiles.find(p => p.lubeId === rec.lubeId)

              return (
                <div key={rec.id} style={{ background: '#fff', border: '1px solid #DCE0E7', borderRadius: 10, overflow: 'hidden', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
                  {/* Card header */}
                  <button
                    onClick={() => setExpanded(isOpen ? null : rec.id)}
                    style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left' }}
                  >
                    <div style={{ width: 4, alignSelf: 'stretch', background: sevStyle.border, borderRadius: 2, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                        <span style={{ fontFamily: 'ui-monospace, monospace', fontWeight: 700, fontSize: 13, color: '#1a1a1a' }}>{rec.batchId}</span>
                        <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, fontWeight: 500, background: sevStyle.badge, color: sevStyle.badgeText }}>{sevStyle.label}</span>
                        {rec.coaInputs.additiveActualP !== undefined && rec.coaInputs.additiveActualP > 0.085 && (
                          <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, fontWeight: 500, background: '#FCEBEB', color: '#791F1F' }}>⚠ ILSAC P risk</span>
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: '#888780', marginTop: 3 }}>
                        {rec.lubeName} · {rec.batchDate} · {rec.batchMT.toFixed(1)} MT
                      </div>
                      <div style={{ fontSize: 11, color: '#5F5E5A', marginTop: 4, lineHeight: 1.5 }}>
                        {getBriefing(rec, sev, profile)}
                      </div>
                      {/* Math block */}
                      <div style={{ marginTop: 6, fontFamily: 'ui-monospace, monospace', fontSize: 10.5, color: '#888780', lineHeight: 1.7 }}>
                        {rec.savings.materialAvoided > 0 && <div>Material avoidance: {rec.batchMT.toFixed(1)} MT × {profile?.topupPct ?? '—'}% × ${profile ? (profile.additiveCostMT - profile.baseOilCostMT) : '—'}/MT = <strong style={{ color: SUCCESS }}>{formatUSD(rec.savings.materialAvoided)}</strong></div>}
                        {rec.savings.rftLifted > 0 && <div>RFT lift: $3.15/MT × {rec.batchMT.toFixed(1)} MT × {profile ? (((0.99 - profile.currentRftPct / 100) / 0.09) * 100).toFixed(0) : '—'}% gap = <strong style={{ color: PURPLE }}>{formatUSD(rec.savings.rftLifted)}</strong></div>}
                        <div style={{ borderTop: '1px solid #ECEFF4', marginTop: 3, paddingTop: 3 }}>Total: <strong style={{ color: SUCCESS, fontSize: 12 }}>{formatUSD(rec.savings.totalSaving)}</strong></div>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: 22, fontWeight: 700, color: '#1a1a1a', fontVariantNumeric: 'tabular-nums' }}>{formatUSD(rec.savings.totalSaving)}</div>
                      <div style={{ fontSize: 10, color: '#888780' }}>Discover savings</div>
                      <div style={{ marginTop: 6, color: '#888780' }}>
                        {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                      </div>
                    </div>
                  </button>

                  {/* Full drilldown */}
                  {isOpen && <BatchDrilldown rec={rec} profiles={profiles} />}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Sidebar */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, position: 'sticky', top: 20 }}>
        {/* Total captured */}
        <div style={{ background: '#fff', border: '1px solid #DCE0E7', borderRadius: 10, padding: '16px 18px', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
          <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#888780', marginBottom: 6 }}>Total Captured · 30 Days</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: SUCCESS, fontVariantNumeric: 'tabular-nums' }}>{formatUSD(totalCaptured)}</div>
          <div style={{ fontSize: 11, color: '#888780', marginTop: 4 }}>{batchSavings.length} batches · {totalMT.toFixed(0)} MT blended</div>
        </div>

        {/* Stream breakdown */}
        <div style={{ background: '#fff', border: '1px solid #DCE0E7', borderRadius: 10, overflow: 'hidden', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
          {[
            { label: 'Material Avoidance', value: totalMat, color: SUCCESS, sub: `${rebalanceCount} avoided corrections` },
            { label: 'RFT Lift', value: totalRft, color: PURPLE, sub: '$3.15/MT reference rate' },
            { label: 'Realised $/MT', value: `$${realisedPerMT.toFixed(2)}/MT`, color: BRAND2, sub: 'across captured MT', isStr: true },
            { label: 'HW / Rebalance events', value: `${rebalanceCount + hardwareCount}`, color: WARNING, sub: 'interventions captured', isStr: true },
          ].map(({ label, value, color, sub, isStr }) => (
            <div key={label} style={{ padding: '10px 14px', borderBottom: '1px solid #ECEFF4' }}>
              <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.4px', color: '#888780', marginBottom: 2 }}>{label}</div>
              <div style={{ fontSize: 18, fontWeight: 600, color, fontVariantNumeric: 'tabular-nums' }}>
                {isStr ? value : formatUSD(value as number)}
              </div>
              <div style={{ fontSize: 10, color: '#888780', marginTop: 1 }}>{sub}</div>
            </div>
          ))}
        </div>

        {/* By lubricant mini */}
        <div style={{ background: '#fff', border: '1px solid #DCE0E7', borderRadius: 10, overflow: 'hidden', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
          <div style={{ padding: '10px 14px', borderBottom: '1px solid #ECEFF4', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600, color: '#888780' }}>By Lubricant</div>
          {byLube.map(({ name, captured, count, color }) => (
            <div key={name} style={{ padding: '8px 14px', borderBottom: '1px solid #ECEFF4', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 11.5, color: '#1a1a1a', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, display: 'inline-block' }} />
                  {name}
                </div>
                <div style={{ fontSize: 10, color: '#888780', marginTop: 1 }}>{count} batches</div>
              </div>
              <strong style={{ color: SUCCESS, fontSize: 12 }}>{formatUSD(captured)}</strong>
            </div>
          ))}
        </div>

        {/* Annualised projection */}
        <div style={{ background: '#F4F6FA', borderRadius: 8, padding: '10px 14px', borderLeft: `3px solid ${BRAND2}` }}>
          <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.4px', color: '#5F5E5A', marginBottom: 4 }}>Annualised Projection</div>
          <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11, color: '#5F5E5A', lineHeight: 1.7 }}>
            <div>Conservative: <strong style={{ color: '#854F0B' }}>{formatUSD(totalCaptured * (365/30) * 0.67)}</strong></div>
            <div>Expected: <strong style={{ color: SUCCESS }}>{formatUSD(totalCaptured * (365/30))}</strong></div>
            <div>Optimistic: <strong style={{ color: BRAND2 }}>{formatUSD(totalCaptured * (365/30) * 1.33)}</strong></div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Tab 3: COA Calculator ────────────────────────────────────────────────────
function COAWizardTab() {
  const { lubeProfiles, commitBatch } = useSavingsStore()
  const [step, setStep] = useState(0)
  const [selectedProfile, setSelectedProfile] = useState<LubeProfile | null>(null)
  const [batchMT, setBatchMT] = useState(8.76)
  const [batchDate, setBatchDate] = useState(new Date().toISOString().split('T')[0])
  const [coa, setCoa] = useState<COAInputs>({})
  const [preview, setPreview] = useState<{ rebalance: ReturnType<typeof solveRebalance>; savings: ReturnType<typeof calculateBatchSavings> } | null>(null)
  const [committed, setCommitted] = useState(false)

  const STEPS = ['Select Grade', 'Batch Details', 'COA Receipts', 'Potency Check', 'Commit & Savings']

  const addComp = selectedProfile?.components.find(c => c.role === 'additive')
  const swingH  = selectedProfile?.components.find(c => c.role === 'swing_heavy')
  const swingL  = selectedProfile?.components.find(c => c.role === 'swing_light')

  const recalc = useCallback(() => {
    if (selectedProfile && step >= 2) {
      const rb = solveRebalance(selectedProfile, coa)
      const s  = calculateBatchSavings(selectedProfile, coa, batchMT, rb)
      setPreview({ rebalance: rb, savings: s })
    }
  }, [coa, batchMT, selectedProfile, step])

  // recalc whenever inputs change
  useState(() => { recalc() })

  function handleCommit() {
    if (!selectedProfile || !preview) return
    const id = `sb-${Date.now()}`
    const record: BatchSavingsRecord = {
      id,
      batchId: `B-${new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14)}`,
      lubeId: selectedProfile.lubeId, lubeName: selectedProfile.lubeName,
      batchMT, batchDate, coaInputs: coa,
      rebalance: preview.rebalance, savings: preview.savings,
      inSpec: preview.rebalance.inSpec, committedAt: new Date().toISOString(),
    }
    commitBatch(record)
    setCommitted(true)
    setTimeout(() => { setStep(0); setSelectedProfile(null); setCoa({}); setPreview(null); setCommitted(false) }, 2500)
  }

  const inputStyle: React.CSSProperties = { height: 38, border: '1px solid #DCE0E7', borderRadius: 8, padding: '0 10px', fontSize: 13, width: '100%', background: '#fff', color: '#1a1a1a', outline: 'none' }
  const labelStyle: React.CSSProperties = { fontSize: 11, fontWeight: 500, color: '#5F5E5A', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.4px' }

  return (
    <div style={{ maxWidth: 800 }}>
      {/* Step indicator */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 24 }}>
        {STEPS.map((label, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600,
              background: i === step ? BRAND : i < step ? '#E1F5EE' : '#F4F6FA',
              color: i === step ? '#fff' : i < step ? '#0F6E56' : '#888780' }}>
              {i < step ? <CheckCircle2 size={12} /> : <span>{i + 1}</span>}
              <span style={{ display: window.innerWidth > 500 ? 'inline' : 'none' }}>{label}</span>
            </div>
            {i < STEPS.length - 1 && <div style={{ width: 20, height: 2, background: i < step ? SUCCESS : '#DCE0E7', margin: '0 2px' }} />}
          </div>
        ))}
      </div>

      {/* Step 0: Select Grade */}
      {step === 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {lubeProfiles.map((p, idx) => (
            <button key={p.lubeId} onClick={() => { setSelectedProfile(p); setCoa({}); setPreview(null); setStep(1) }}
              style={{ background: '#fff', border: `2px solid ${selectedProfile?.lubeId === p.lubeId ? BRAND2 : '#DCE0E7'}`, borderRadius: 10, padding: 0, cursor: 'pointer', textAlign: 'left', overflow: 'hidden', transition: 'border-color 0.15s' }}>
              <div style={{ height: 4, background: LUBE_COLORS[idx % LUBE_COLORS.length] }} />
              <div style={{ padding: '12px 14px' }}>
                <div style={{ fontSize: 11, color: BRAND2, fontWeight: 600, marginBottom: 2 }}>{p.gradeCode}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1a1a' }}>{p.lubeName}</div>
                <div style={{ fontSize: 11, color: '#888780', marginTop: 4 }}>Target KV: {p.targetKV} ± {p.specWindow} cSt</div>
                <div style={{ fontSize: 11, color: '#888780' }}>{p.batchKL} KL · {p.batchesPerYear} batches/yr</div>
                <div style={{ fontSize: 11, color: '#888780' }}>RFT: {p.currentRftPct}%</div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Step 1: Batch Details */}
      {step === 1 && selectedProfile && (
        <div style={{ background: '#fff', border: '1px solid #DCE0E7', borderRadius: 12, padding: 24, maxWidth: 480 }}>
          <h3 style={{ margin: '0 0 16px', color: '#1a1a1a', fontSize: 15, fontWeight: 600 }}>{selectedProfile.lubeName} — Batch Details</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div><label style={labelStyle}>Batch Date</label><input type="date" value={batchDate} onChange={e => setBatchDate(e.target.value)} style={inputStyle} /></div>
            <div>
              <label style={labelStyle}>Batch Mass (MT) — from {selectedProfile.batchKL} KL × {selectedProfile.density} g/cm³</label>
              <input type="number" step="0.01" value={batchMT} onChange={e => setBatchMT(parseFloat(e.target.value) || selectedProfile.batchKL * selectedProfile.density)} style={inputStyle} />
            </div>
            <div style={{ background: '#F4F6FA', borderRadius: 8, padding: '10px 12px', fontSize: 12, color: '#5F5E5A' }}>
              Additive: ${selectedProfile.additiveCostMT}/MT · Base Oil: ${selectedProfile.baseOilCostMT}/MT · Top-up: {selectedProfile.topupPct}%
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
            <button onClick={() => setStep(0)} style={{ ...inputStyle, width: 'auto', padding: '0 16px', cursor: 'pointer', color: '#5F5E5A' }}>← Back</button>
            <button onClick={() => { recalc(); setStep(2) }} style={{ ...inputStyle, width: 'auto', padding: '0 16px', cursor: 'pointer', background: BRAND, color: '#fff', border: 'none', fontWeight: 600 }}>Next →</button>
          </div>
        </div>
      )}

      {/* Step 2: COA Receipts */}
      {step === 2 && selectedProfile && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Base oil KV */}
          <div style={{ background: '#fff', border: '1px solid #DCE0E7', borderRadius: 12, padding: 20 }}>
            <h3 style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 600 }}>Base Oil COA — Kinematic Viscosity @ 100°C</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              {swingH && <div><label style={labelStyle}>{swingH.name} (std: {swingH.stdKV} cSt)</label><input type="number" step="0.01" placeholder={String(swingH.stdKV)} value={coa.swingHeavyActualKV ?? ''} onChange={e => { setCoa(c => ({ ...c, swingHeavyActualKV: parseFloat(e.target.value) || undefined })); recalc() }} style={inputStyle} /></div>}
              {swingL && <div><label style={labelStyle}>{swingL.name} (std: {swingL.stdKV} cSt)</label><input type="number" step="0.01" placeholder={String(swingL.stdKV)} value={coa.swingLightActualKV ?? ''} onChange={e => { setCoa(c => ({ ...c, swingLightActualKV: parseFloat(e.target.value) || undefined })); recalc() }} style={inputStyle} /></div>}
            </div>
          </div>
          {/* Additive */}
          {addComp && (
            <div style={{ background: '#fff', border: '1px solid #DCE0E7', borderRadius: 12, padding: 20 }}>
              <h3 style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 600 }}>Additive Package COA</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
                {addComp.stdKV !== undefined && <div><label style={labelStyle}>KV (std: {addComp.stdKV})</label><input type="number" step="0.1" placeholder={String(addComp.stdKV)} value={coa.additiveActualKV ?? ''} onChange={e => { setCoa(c => ({ ...c, additiveActualKV: parseFloat(e.target.value) || undefined })); recalc() }} style={inputStyle} /></div>}
                {addComp.stdCa !== undefined && <div><label style={labelStyle}>Ca % (std: {addComp.stdCa})</label><input type="number" step="0.01" placeholder={String(addComp.stdCa)} value={coa.additiveActualCa ?? ''} onChange={e => { setCoa(c => ({ ...c, additiveActualCa: parseFloat(e.target.value) || undefined })); recalc() }} style={inputStyle} /></div>}
                {addComp.stdZn !== undefined && <div><label style={labelStyle}>Zn % (std: {addComp.stdZn})</label><input type="number" step="0.001" placeholder={String(addComp.stdZn)} value={coa.additiveActualZn ?? ''} onChange={e => { setCoa(c => ({ ...c, additiveActualZn: parseFloat(e.target.value) || undefined })); recalc() }} style={inputStyle} /></div>}
                {addComp.stdP !== undefined && <div>
                  <label style={labelStyle}>P % (std: {addComp.stdP})</label>
                  <input type="number" step="0.001" placeholder={String(addComp.stdP)} value={coa.additiveActualP ?? ''} onChange={e => { setCoa(c => ({ ...c, additiveActualP: parseFloat(e.target.value) || undefined })); recalc() }} style={{ ...inputStyle, borderColor: coa.additiveActualP && coa.additiveActualP > 0.085 ? DANGER : '#DCE0E7' }} />
                  {coa.additiveActualP && coa.additiveActualP > 0.085 && <div style={{ fontSize: 11, color: DANGER, marginTop: 4 }}>⚠ P &gt; 0.085% — ILSAC phosphorus cap risk</div>}
                </div>}
              </div>
            </div>
          )}
          {/* Live prediction */}
          {preview && (
            <div style={{ background: '#fff', border: `1px solid ${preview.rebalance.inSpec ? SUCCESS : WARNING}`, borderLeft: `4px solid ${preview.rebalance.inSpec ? SUCCESS : WARNING}`, borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              {preview.rebalance.inSpec ? <CheckCircle2 size={18} color={SUCCESS} style={{ marginTop: 2 }} /> : <AlertTriangle size={18} color={WARNING} style={{ marginTop: 2 }} />}
              <div>
                <div style={{ fontWeight: 600, fontSize: 13, color: '#1a1a1a' }}>{preview.rebalance.message}</div>
                <div style={{ fontSize: 12, color: '#5F5E5A', marginTop: 3 }}>Predicted KV: {preview.rebalance.predictedKVBefore.toFixed(2)} → {preview.rebalance.achievedKV.toFixed(2)} cSt (Target: {selectedProfile.targetKV} ± {selectedProfile.specWindow})</div>
                <div style={{ fontSize: 12, color: SUCCESS, fontWeight: 600, marginTop: 3 }}>Estimated batch saving: {formatUSD(preview.savings.totalSaving)}</div>
              </div>
            </div>
          )}
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => setStep(1)} style={{ ...inputStyle, width: 'auto', padding: '0 16px', cursor: 'pointer', color: '#5F5E5A' }}>← Back</button>
            <button onClick={() => setStep(3)} style={{ ...inputStyle, width: 'auto', padding: '0 16px', cursor: 'pointer', background: BRAND, color: '#fff', border: 'none', fontWeight: 600 }}>Next →</button>
          </div>
        </div>
      )}

      {/* Step 3: Potency Check */}
      {step === 3 && selectedProfile && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {addComp ? (
            <div style={{ background: '#fff', border: '1px solid #DCE0E7', borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ padding: '14px 20px', borderBottom: '1px solid #DCE0E7', fontSize: 14, fontWeight: 600 }}>Elemental Potency Check — {addComp.name}</div>
              <div style={{ padding: 20 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead><tr style={{ borderBottom: '1px solid #B4B8C2' }}>{['Element','Standard %','Actual %','Variance','Status'].map((h, i) => <th key={h} style={{ padding: '8px', textAlign: i === 0 ? 'left' : 'right', color: '#5F5E5A', fontWeight: 500, fontSize: 11, textTransform: 'uppercase' }}>{h}</th>)}</tr></thead>
                  <tbody>
                    {([{ el: 'Ca', std: addComp.stdCa, actual: coa.additiveActualCa }, { el: 'Zn', std: addComp.stdZn, actual: coa.additiveActualZn }, { el: 'P', std: addComp.stdP, actual: coa.additiveActualP }] as const).filter(r => r.std !== undefined).map(({ el, std, actual }) => {
                      if (!std) return null
                      const v = actual ? ((actual - std) / std) * 100 : null
                      const status = v === null ? '—' : v > 2 ? 'over-potent' : v < -2 ? 'under-potent' : 'on-spec'
                      return (
                        <tr key={el} style={{ borderBottom: '1px solid #ECEFF4', background: status === 'over-potent' ? 'rgba(186,117,23,0.05)' : 'transparent' }}>
                          <td style={{ padding: '8px', fontWeight: 600 }}>{el}</td>
                          <td style={{ padding: '8px', textAlign: 'right', color: '#888780', fontVariantNumeric: 'tabular-nums' }}>{std.toFixed(3)}</td>
                          <td style={{ padding: '8px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{actual?.toFixed(3) ?? '—'}</td>
                          <td style={{ padding: '8px', textAlign: 'right', fontWeight: 600, color: v !== null ? (v > 0 ? DANGER : BRAND2) : '#888780' }}>{v !== null ? `${v >= 0 ? '+' : ''}${v.toFixed(1)}%` : '—'}</td>
                          <td style={{ padding: '8px', textAlign: 'right' }}><span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, fontWeight: 500, background: status === 'over-potent' ? '#FAEEDA' : status === 'on-spec' ? '#E1F5EE' : '#F4F6FA', color: status === 'over-potent' ? '#854F0B' : status === 'on-spec' ? '#0F6E56' : '#888780' }}>{status === 'over-potent' ? '↑ over-potent' : status === 'on-spec' ? '✓ on-spec' : status === 'under-potent' ? '↓ under' : '—'}</span></td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                {preview && preview.savings.elementalSaving > 0 && (
                  <div style={{ marginTop: 12, padding: '10px 14px', background: '#FAEEDA', borderRadius: 8, fontSize: 12, color: '#854F0B' }}>
                    Over-potency saving: <strong>{formatUSD(preview.savings.elementalSaving)}</strong> — reducible fraction {(preview.savings.reducibleFrac * 100).toFixed(2)}%
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div style={{ padding: '20px', background: '#fff', border: '1px solid #DCE0E7', borderRadius: 12, color: '#888780', fontSize: 13 }}>No additive component — skipping potency check.</div>
          )}
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => setStep(2)} style={{ ...inputStyle, width: 'auto', padding: '0 16px', cursor: 'pointer', color: '#5F5E5A' }}>← Back</button>
            <button onClick={() => setStep(4)} style={{ ...inputStyle, width: 'auto', padding: '0 16px', cursor: 'pointer', background: BRAND, color: '#fff', border: 'none', fontWeight: 600 }}>Next →</button>
          </div>
        </div>
      )}

      {/* Step 4: Commit */}
      {step === 4 && selectedProfile && preview && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {committed && <div style={{ padding: '14px 20px', background: '#E1F5EE', borderRadius: 10, color: '#0F6E56', fontWeight: 600, fontSize: 14 }}>✓ Batch committed to the Savings Ledger</div>}
          {/* Hero */}
          <div style={{ background: `linear-gradient(135deg, #065f46 0%, ${SUCCESS} 100%)`, borderRadius: 12, padding: '22px 28px', color: '#fff', textAlign: 'center' }}>
            <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.6px', opacity: 0.8, marginBottom: 8 }}>OmniBlend Discover Savings · This Batch</div>
            <div style={{ fontSize: 44, fontWeight: 900, letterSpacing: '-1px', fontVariantNumeric: 'tabular-nums' }}>{formatUSD(preview.savings.totalSaving)}</div>
            <div style={{ marginTop: 10, fontSize: 13, opacity: 0.8, display: 'flex', justifyContent: 'center', gap: 24 }}>
              <span>Material: {formatUSD(preview.savings.materialAvoided)}</span>
              <span>Elemental: {formatUSD(preview.savings.elementalSaving)}</span>
              <span>RFT: {formatUSD(preview.savings.rftLifted)}</span>
            </div>
          </div>
          {/* Derivation */}
          <div style={{ background: '#fff', border: '1px solid #DCE0E7', borderRadius: 12, padding: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: BRAND, marginBottom: 10 }}>Savings Derivation</div>
            <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11.5, color: '#5F5E5A', lineHeight: 1.7 }}>
              {preview.savings.steps.map((s, i) => <div key={i}>{s}</div>)}
            </div>
          </div>
          {/* Rebalance */}
          <div style={{ background: '#fff', border: `1px solid #DCE0E7`, borderLeft: `4px solid ${preview.rebalance.inSpec ? SUCCESS : DANGER}`, borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
            {preview.rebalance.applied ? <RotateCcw size={16} color={BRAND2} /> : <CheckCircle2 size={16} color={SUCCESS} />}
            <div>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{preview.rebalance.message}</div>
              {preview.rebalance.applied && <div style={{ fontSize: 11, color: '#888780', marginTop: 3, fontFamily: 'ui-monospace, monospace' }}>KV {preview.rebalance.predictedKVBefore.toFixed(2)} → {preview.rebalance.achievedKV.toFixed(2)} cSt · shift {preview.rebalance.shiftDelta >= 0 ? '+' : ''}{preview.rebalance.shiftDelta.toFixed(2)} pp</div>}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => setStep(3)} style={{ ...inputStyle, width: 'auto', padding: '0 16px', cursor: 'pointer', color: '#5F5E5A' }}>← Back</button>
            <button onClick={handleCommit} disabled={committed} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 24px', height: 40, borderRadius: 8, fontSize: 13, fontWeight: 600, border: 'none', cursor: committed ? 'not-allowed' : 'pointer', background: SUCCESS, color: '#fff' }}>
              <Play size={14} /> Commit Batch Savings
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Tab 4: AI Insights ───────────────────────────────────────────────────────
function generateFinanceReport(batchSavings: BatchSavingsRecord[], profiles: LubeProfile[]): string {
  const totalCaptured = batchSavings.reduce((s, r) => s + r.savings.totalSaving, 0)
  const totalMat = batchSavings.reduce((s, r) => s + r.savings.materialAvoided, 0)
  const totalRft = batchSavings.reduce((s, r) => s + r.savings.rftLifted, 0)
  const totalMT  = batchSavings.reduce((s, r) => s + r.batchMT, 0)
  const annual   = totalCaptured * (365 / 30)
  const top = profiles.map(p => {
    const recs = batchSavings.filter(r => r.lubeId === p.lubeId)
    return { name: p.lubeName, total: recs.reduce((s, r) => s + r.savings.totalSaving, 0), batches: recs.length }
  }).sort((a, b) => b.total - a.total)[0]

  return `## OmniBlend Discover · Finance Executive Briefing\n\n### Savings Performance — 30-Day Capture\n\nOmniBlend Discover captured **${formatUSD(totalCaptured)}** in verified blend savings across **${batchSavings.length} batches** and **${totalMT.toFixed(0)} MT** of blended product over the assessment window.\n\nAnnualised at the observed operating rate (×365/30), the expected annual savings pool is **${formatUSD(annual)}**, with the conservative case at **${formatUSD(annual * 0.67)}** and the optimistic case at **${formatUSD(annual * 1.33)}**.\n\n### Savings Stream Attribution\n\n- **Material Avoidance** contributed **${formatUSD(totalMat)}** (${((totalMat/totalCaptured)*100).toFixed(0)}% of captured savings). This stream is generated when Discover rebalances swing components before execution, avoiding the need for a corrective additive top-up.\n\n- **RFT Lift** contributed **${formatUSD(totalRft)}** (${((totalRft/totalCaptured)*100).toFixed(0)}% of captured savings). Valued at $3.15/MT at full gap closure from the 90% RFT baseline toward the 99% target.\n\n> The elemental potency stream adds incremental value as COA variance data deepens — projected to add 8–15% to total savings in Year 2 as the model refines reducible-fraction estimates.\n\n### Top Contributor\n\n**${top?.name ?? '—'}** is the highest-contributing lubricant grade with **${formatUSD(top?.total ?? 0)}** captured across ${top?.batches ?? 0} batches. This grade should be prioritised for full recipe digitisation and lot-level COA tracking.\n\n### Scenario Confidence\n\nThe 0.67× conservative envelope reflects Year-1 ramp uncertainty — COA capture coverage broadening, operator adoption, and recipe digitisation progress. The 1.33× optimistic envelope is achievable in Year 2 once all grades are on continuous batch tracking.\n\n### Recommendation\n\nCommit to a 90-day full-plant rollout targeting all ${profiles.length} lubricant grades. At the expected savings rate, payback on deployment effort occurs within the first operating quarter. Priority action: ensure every batch has a COA receipt committed before the blend cycle closes.`
}

function generateOpsReport(batchSavings: BatchSavingsRecord[], profiles: LubeProfile[]): string {
  const profiles2 = SEED_LUBE_PROFILES
  const rebalanced = batchSavings.filter(r => r.rebalance.applied)
  const hardware   = batchSavings.filter(r => getSeverity(r, profiles2) === 'hardware')
  const offspec    = batchSavings.filter(r => !r.inSpec)

  const avgRft = profiles.reduce((s, p) => s + p.currentRftPct, 0) / profiles.length
  const rftGap = ((0.99 - avgRft / 100) / 0.09) * 100

  const elemFlags = profiles.map(p => {
    const recs = batchSavings.filter(r => r.lubeId === p.lubeId)
    const addComp = p.components.find(c => c.role === 'additive')
    if (!addComp?.stdCa) return null
    const avgCaOver = recs.filter(r => r.coaInputs.additiveActualCa && addComp.stdCa && r.coaInputs.additiveActualCa > addComp.stdCa)
      .map(r => ((r.coaInputs.additiveActualCa! - addComp.stdCa!) / addComp.stdCa!) * 100)
    if (avgCaOver.length === 0) return null
    return { name: p.lubeName, avgCaOver: avgCaOver.reduce((a, b) => a + b, 0) / avgCaOver.length, count: avgCaOver.length }
  }).filter(Boolean).sort((a, b) => (b?.avgCaOver ?? 0) - (a?.avgCaOver ?? 0))

  return `## OmniBlend Discover · Operations & Quality Briefing\n\n### COA Variance Status — Portfolio Live\n\n**${rebalanced.length} batches** required a rebalance intervention in the last 30 days — Discover corrected KV before execution in each case, booking material avoidance savings. **${hardware.length} batches** showed elemental divergence above prediction (flow-meter calibration recommended). **${offspec.length} batches** completed out of specification — no savings credited.\n\n### RFT Gap Closure\n\nPortfolio average RFT stands at **${avgRft.toFixed(1)}%**, leaving a **${rftGap.toFixed(0)}% gap** toward the 99% target. At $3.15/MT, each percentage point of RFT improvement adds approximately **${formatUSD(batchSavings.reduce((s, r) => s + r.batchMT, 0) * 0.35 * (365/30))}** per year to the savings pool.\n\n### Elemental Potency Flags\n\n${elemFlags.length > 0 ? elemFlags.map(f => `- **${f!.name}**: Ca overage averaging +${f!.avgCaOver.toFixed(1)}% across ${f!.count} batch(es) — additive lot variance above tolerance`).join('\n') : '- No significant elemental overages detected in current batch window.'}\n\n### Quality Audit — Hardware Cases\n\n**Case 1 — Flow Meter:** When lab Ca/Zn exceeds predicted values, the additive dispensing system has over-delivered. Schedule periodic calibration of additive flow meters — this is the most common hardware trigger in the portfolio.\n\n**Case 2 — Valve Leakage:** When elemental fingerprints match prediction but achieved KV falls below predicted KV, base oil has been over-dispensed. Inspect base-oil metering valves for bypass or seat wear.\n\n### Prioritised Actions\n\n1. Schedule additive flow-meter calibration — ${hardware.length} batch(es) flagged this period\n2. Target ${(0.99 - avgRft/100 > 0.02) ? 'operator training on recipe adherence' : 'maintenance of current RFT performance'} to close the ${rftGap.toFixed(0)}% RFT gap\n3. Review COA receipts for ${elemFlags[0]?.name ?? 'all grades'} — highest elemental variance in portfolio\n4. Digitise remaining recipes to enable real-time KV prediction before valve-open\n\n### Next Batch Recommendation\n\nFor all rebalanced grades: confirm swing component lot KV values against the COA before the next blend cycle. The rebalance engine will automatically resolve KV targets — your role is ensuring the COA receipt is captured accurately before execution begins.`
}

function AIInsightsTab() {
  const { batchSavings } = useSavingsStore()
  const profiles = SEED_LUBE_PROFILES
  const [financeReport, setFinanceReport] = useState<string | null>(null)
  const [opsReport, setOpsReport] = useState<string | null>(null)
  const [financeLoading, setFinanceLoading] = useState(false)
  const [opsLoading, setOpsLoading] = useState(false)
  const [activeReport, setActiveReport] = useState<'finance' | 'ops'>('finance')

  function generateFinance() {
    setFinanceLoading(true)
    setTimeout(() => {
      setFinanceReport(generateFinanceReport(batchSavings, profiles))
      setFinanceLoading(false)
      setActiveReport('finance')
    }, 1800)
  }

  function generateOps() {
    setOpsLoading(true)
    setTimeout(() => {
      setOpsReport(generateOpsReport(batchSavings, profiles))
      setOpsLoading(false)
      setActiveReport('ops')
    }, 1600)
  }

  function renderMarkdown(text: string) {
    return text.split('\n').map((line, i) => {
      if (line.startsWith('## ')) return <h2 key={i} style={{ fontSize: 17, fontWeight: 700, color: BRAND, margin: '20px 0 10px', paddingBottom: 8, borderBottom: `2px solid #ECEFF4` }}>{line.slice(3)}</h2>
      if (line.startsWith('### ')) return <h3 key={i} style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1a', margin: '14px 0 8px', paddingTop: 10, borderTop: '1px solid #ECEFF4' }}>{line.slice(4)}</h3>
      if (line.startsWith('> ')) return <div key={i} style={{ padding: '8px 14px', borderLeft: `3px solid ${BRAND2}`, background: '#E6F1FB', borderRadius: 6, margin: '8px 0', fontSize: 12, color: '#0C447C' }}>{line.slice(2)}</div>
      if (line.startsWith('- ')) {
        const content = line.slice(2).replace(/\*\*(.*?)\*\*/g, (_: string, m: string) => `<strong style="color:${BRAND}">${m}</strong>`)
        return <li key={i} style={{ fontSize: 13, color: '#5F5E5A', lineHeight: 1.6, marginLeft: 18, padding: '2px 0' }} dangerouslySetInnerHTML={{ __html: content }} />
      }
      if (line.trim() === '') return <div key={i} style={{ height: 6 }} />
      const content = line.replace(/\*\*(.*?)\*\*/g, (_: string, m: string) => `<strong style="color:${BRAND}">${m}</strong>`)
      return <p key={i} style={{ fontSize: 13, color: '#5F5E5A', margin: '4px 0', lineHeight: 1.7 }} dangerouslySetInnerHTML={{ __html: content }} />
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Report selector */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {/* Finance card */}
        <div style={{ background: '#fff', border: '1px solid #DCE0E7', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #DCE0E7' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <DollarSign size={16} color={BRAND} />
              <div style={{ fontWeight: 600, fontSize: 14, color: '#1a1a1a' }}>Finance Executive Briefing</div>
            </div>
            <div style={{ fontSize: 12, color: '#888780' }}>
              Savings totals across all three scenarios, top lubricants, $/MT realised, and headroom between scenarios.
            </div>
          </div>
          <div style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ fontSize: 11, color: '#888780', flex: 1 }}>
              {financeReport ? '✓ Report generated from live simulation data' : 'Local generator · runs offline from batch ledger'}
            </div>
            <button onClick={generateFinance} disabled={financeLoading}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, border: '1px solid #DCE0E7', background: '#fff', cursor: financeLoading ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: 500, color: '#5F5E5A' }}>
              {financeLoading ? <RefreshCw size={13} className="animate-spin" /> : <Zap size={13} />}
              {financeLoading ? 'Generating…' : financeReport ? '↺ Regenerate' : '⚡ Generate report'}
            </button>
          </div>
        </div>

        {/* Ops card */}
        <div style={{ background: '#fff', border: '1px solid #DCE0E7', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #DCE0E7' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <Wrench size={16} color={WARNING} />
              <div style={{ fontWeight: 600, fontSize: 14, color: '#1a1a1a' }}>Operations & Quality Briefing</div>
            </div>
            <div style={{ fontSize: 12, color: '#888780' }}>
              COA variance live, predicted vs achieved divergence, RFT gap closure, and prioritised quality actions.
            </div>
          </div>
          <div style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ fontSize: 11, color: '#888780', flex: 1 }}>
              {opsReport ? '✓ Report generated from live simulation data' : 'Local generator · runs offline from batch ledger'}
            </div>
            <button onClick={generateOps} disabled={opsLoading}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, border: '1px solid #DCE0E7', background: '#fff', cursor: opsLoading ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: 500, color: '#5F5E5A' }}>
              {opsLoading ? <RefreshCw size={13} className="animate-spin" /> : <Zap size={13} />}
              {opsLoading ? 'Generating…' : opsReport ? '↺ Regenerate' : '⚡ Generate briefing'}
            </button>
          </div>
        </div>
      </div>

      {/* Report output */}
      {(financeLoading || opsLoading) && (
        <div style={{ background: '#fff', border: '1px solid #DCE0E7', borderRadius: 12, padding: '32px', textAlign: 'center' }}>
          <RefreshCw size={24} color={BRAND2} style={{ marginBottom: 12, animation: 'radarSpin 1s linear infinite' }} />
          <div style={{ fontSize: 13, color: '#5F5E5A', fontWeight: 500 }}>Generating report from batch ledger…</div>
          <div style={{ fontSize: 11, color: '#888780', marginTop: 6 }}>Analysing {batchSavings.length} batches across {SEED_LUBE_PROFILES.length} lubricant grades</div>
        </div>
      )}

      {!financeLoading && !opsLoading && (financeReport || opsReport) && (
        <div style={{ background: '#fff', border: '1px solid #DCE0E7', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
          {/* Tab selector */}
          {financeReport && opsReport && (
            <div style={{ display: 'flex', borderBottom: '1px solid #DCE0E7' }}>
              {(['finance', 'ops'] as const).map(key => (
                <button key={key} onClick={() => setActiveReport(key)}
                  style={{ padding: '12px 20px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500,
                    color: activeReport === key ? BRAND : '#888780',
                    borderBottom: activeReport === key ? `2px solid ${BRAND}` : '2px solid transparent',
                    marginBottom: -1 }}>
                  {key === 'finance' ? '💰 Finance Briefing' : '🔧 Operations Briefing'}
                </button>
              ))}
            </div>
          )}
          <div style={{ padding: '20px 24px', maxHeight: 600, overflowY: 'auto' }}>
            {activeReport === 'finance' && financeReport && <div>{renderMarkdown(financeReport)}</div>}
            {activeReport === 'ops' && opsReport && <div>{renderMarkdown(opsReport)}</div>}
          </div>
        </div>
      )}

      {!financeLoading && !opsLoading && !financeReport && !opsReport && (
        <div style={{ background: '#fff', border: '1px solid #DCE0E7', borderRadius: 12, padding: '40px', textAlign: 'center' }}>
          <FileText size={32} color="#DCE0E7" style={{ marginBottom: 12 }} />
          <div style={{ fontSize: 14, color: '#1a1a1a', fontWeight: 600, marginBottom: 6 }}>No report generated yet</div>
          <div style={{ fontSize: 12, color: '#888780', maxWidth: 420, margin: '0 auto' }}>
            Click <strong>⚡ Generate report</strong> above to produce a narrative briefing from the live batch ledger. The local generator runs offline — no API key required.
          </div>
        </div>
      )}

      {/* Batch-level AI callouts */}
      <div style={{ background: '#fff', border: '1px solid #DCE0E7', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid #DCE0E7' }}>
          <div style={{ fontWeight: 600, fontSize: 14, color: '#1a1a1a' }}>AI Batch Insights — Portfolio Signals</div>
          <div style={{ fontSize: 12, color: '#888780', marginTop: 2 }}>Auto-generated from batch ledger · updated on each new batch committed</div>
        </div>
        <div style={{ padding: '14px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Grade opportunity ranking */}
          {SEED_LUBE_PROFILES.map((p, i) => {
            const recs = batchSavings.filter(r => r.lubeId === p.lubeId)
            if (recs.length === 0) return null
            const totalSav = recs.reduce((s, r) => s + r.savings.totalSaving, 0)
            const avgPerBatch = totalSav / recs.length
            const rebalCount = recs.filter(r => r.rebalance.applied).length
            const rftGapPct = ((0.99 - p.currentRftPct / 100) / 0.09) * 100
            const hasElemOverage = recs.some(r => { const a = p.components.find(c => c.role === 'additive'); return a?.stdCa && r.coaInputs.additiveActualCa && r.coaInputs.additiveActualCa > a.stdCa * 1.02 })

            const signals: string[] = []
            if (rebalCount > 0) signals.push(`${rebalCount} rebalance${rebalCount > 1 ? 's' : ''} — swing variance present`)
            if (rftGapPct > 30) signals.push(`${rftGapPct.toFixed(0)}% RFT gap — high lift potential`)
            if (hasElemOverage) signals.push('Elemental overage detected — consider reducible fraction review')

            return (
              <div key={p.lubeId} style={{ padding: '12px 14px', background: '#F4F6FA', borderRadius: 8, borderLeft: `3px solid ${LUBE_COLORS[i % LUBE_COLORS.length]}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13, color: '#1a1a1a' }}>{p.lubeName}</div>
                    <div style={{ fontSize: 11, color: '#888780', marginTop: 2 }}>{recs.length} batches · avg {formatUSD(avgPerBatch)}/batch</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: SUCCESS, fontVariantNumeric: 'tabular-nums' }}>{formatUSD(totalSav)}</div>
                    <div style={{ fontSize: 10, color: '#888780' }}>captured</div>
                  </div>
                </div>
                {signals.length > 0 && (
                  <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {signals.map(sig => (
                      <span key={sig} style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: '#E6F1FB', color: '#0C447C', fontWeight: 500 }}>
                        {sig}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── Tab 5: Analytics ─────────────────────────────────────────────────────────
function AnalyticsTab() {
  const { batchSavings, portfolioScenarios } = useSavingsStore()

  const timeline = [...batchSavings].sort((a, b) => a.batchDate.localeCompare(b.batchDate)).slice(-20).map(r => ({
    date: r.batchDate.slice(5),
    material: Math.round(r.savings.materialAvoided),
    rft: Math.round(r.savings.rftLifted),
    elemental: Math.round(r.savings.elementalSaving),
    total: Math.round(r.savings.totalSaving),
  }))

  const heatRows = SEED_LUBE_PROFILES.map((p, i) => {
    const recs = batchSavings.filter(r => r.lubeId === p.lubeId)
    const captured = recs.reduce((s, r) => s + r.savings.totalSaving, 0)
    const annual = captured * (365 / 30)
    return { name: p.gradeCode, conservative: Math.round(annual * 0.67), expected: Math.round(annual), optimistic: Math.round(annual * 1.33), color: LUBE_COLORS[i % LUBE_COLORS.length] }
  })

  const maxVal = Math.max(...heatRows.map(r => r.optimistic), 1)

  const mixData = [
    { name: 'Material', value: Math.round(batchSavings.reduce((s, r) => s + r.savings.materialAvoided, 0)), color: BRAND2 },
    { name: 'Elemental', value: Math.round(batchSavings.reduce((s, r) => s + r.savings.elementalSaving, 0)), color: WARNING },
    { name: 'RFT Lift', value: Math.round(batchSavings.reduce((s, r) => s + r.savings.rftLifted, 0)), color: PURPLE },
  ].filter(d => d.value > 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {portfolioScenarios && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          {[
            { label: 'Expected Annual', value: formatUSD(portfolioScenarios.expected.total), sub: 'projection', border: BRAND2 },
            { label: 'Conservative', value: formatUSD(portfolioScenarios.conservative.total), sub: 'Year-1 commit', border: '#888780' },
            { label: 'Optimistic', value: formatUSD(portfolioScenarios.optimistic.total), sub: 'upper bound', border: SUCCESS },
            { label: '% of Material Cost', value: `${portfolioScenarios.expected.savingsAsMaterialPct.toFixed(1)}%`, sub: 'expected case', border: WARNING },
          ].map(({ label, value, sub, border }) => (
            <div key={label} style={{ background: '#fff', border: '1px solid #DCE0E7', borderLeft: `3px solid ${border}`, borderRadius: 10, padding: '14px 16px', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
              <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#888780', marginBottom: 4 }}>{label}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#1a1a1a', fontVariantNumeric: 'tabular-nums' }}>{value}</div>
              <div style={{ fontSize: 11, color: '#888780', marginTop: 2 }}>{sub}</div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
        {/* Timeline */}
        <div style={{ background: '#fff', border: '1px solid #DCE0E7', borderRadius: 12, padding: 20, boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14, color: '#1a1a1a' }}>Per-Batch Savings Timeline</div>
          {timeline.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={timeline}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ECEFF4" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#888780' }} />
                <YAxis tick={{ fontSize: 10, fill: '#888780' }} tickFormatter={v => `$${v}`} />
                <Tooltip formatter={(v: number) => formatUSD(v)} contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #DCE0E7' }} />
                <Bar dataKey="material" stackId="s" fill={BRAND2}  name="Material" />
                <Bar dataKey="elemental" stackId="s" fill={WARNING} name="Elemental" />
                <Bar dataKey="rft"       stackId="s" fill={PURPLE}  name="RFT Lift" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <div style={{ textAlign: 'center', padding: 40, color: '#888780' }}>No batch data</div>}
        </div>

        {/* Savings mix */}
        <div style={{ background: '#fff', border: '1px solid #DCE0E7', borderRadius: 12, padding: 20, boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14, color: '#1a1a1a' }}>Savings Mix</div>
          {mixData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={mixData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ percent }) => `${(percent * 100).toFixed(0)}%`}>
                  {mixData.map(d => <Cell key={d.name} fill={d.color} />)}
                </Pie>
                <Tooltip formatter={(v: number) => formatUSD(v)} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : <div style={{ textAlign: 'center', padding: 40, color: '#888780' }}>No data</div>}
        </div>
      </div>

      {/* Heatmap */}
      <div style={{ background: '#fff', border: '1px solid #DCE0E7', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid #DCE0E7', fontSize: 13, fontWeight: 600, color: '#1a1a1a' }}>Portfolio Savings Heatmap — Annual Projections</div>
        <div style={{ padding: '14px 20px', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr><th style={{ textAlign: 'left', padding: '8px', color: '#5F5E5A', fontSize: 11, fontWeight: 500, textTransform: 'uppercase' }}>Grade</th>
                {['Conservative','Expected','Optimistic'].map(s => <th key={s} style={{ textAlign: 'right', padding: '8px', color: '#5F5E5A', fontSize: 11, fontWeight: 500, textTransform: 'uppercase', width: 140 }}>{s}</th>)}
              </tr>
            </thead>
            <tbody>
              {heatRows.map(row => (
                <tr key={row.name}>
                  <td style={{ padding: '6px 8px', fontWeight: 600, color: '#1a1a1a' }}>{row.name}</td>
                  {(['conservative','expected','optimistic'] as const).map(s => {
                    const val = row[s]
                    const t = val / maxVal
                    const bg = t < 0.33 ? `rgba(46,117,182,${0.15 + t * 1.5})` : t < 0.66 ? `rgba(127,119,221,${0.3 + t * 0.7})` : `rgba(29,158,117,${0.4 + t * 0.6})`
                    const textColor = t > 0.5 ? '#fff' : '#1a1a1a'
                    return (
                      <td key={s} style={{ padding: '4px 6px' }}>
                        <div style={{ background: bg, color: textColor, borderRadius: 8, padding: '8px 12px', textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums', fontSize: 12, transition: 'transform 0.15s' }}>
                          {formatUSD(val)}
                        </div>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: '#888780' }}>
            <span>Low</span>
            <div style={{ flex: 1, height: 6, borderRadius: 3, background: `linear-gradient(90deg, rgba(46,117,182,0.3), rgba(127,119,221,0.7), rgba(29,158,117,1))` }} />
            <span>High</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export function SavingsPage() {
  const [tab, setTab] = useState<'portfolio' | 'ledger' | 'calculator' | 'insights' | 'analytics'>('portfolio')

  const TABS = [
    { key: 'portfolio',  label: 'Portfolio',       icon: BarChart3 },
    { key: 'ledger',     label: 'Batch Ledger',    icon: Layers },
    { key: 'calculator', label: 'COA Calculator',  icon: FlaskConical },
    { key: 'insights',   label: 'AI Insights',     icon: Zap },
    { key: 'analytics',  label: 'Analytics',       icon: Activity },
  ] as const

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <TrendingUp size={22} color={SUCCESS} />
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#1a1a1a' }}>Savings Impact</h1>
            <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 10, background: '#E1F5EE', color: '#0F6E56', fontWeight: 600 }}>OmniBlend Discover</span>
          </div>
          <p style={{ margin: 0, fontSize: 12, color: '#888780' }}>Material avoidance · Elemental potency · RFT lift — three savings streams, one audit trail</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#888780' }}>
          <Target size={13} />
          <span>Ref: 25,000 MT · $3.15/MT RFT · 90→99% target</span>
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ borderBottom: '1px solid #DCE0E7', marginBottom: 20, display: 'flex', gap: 0 }}>
        {TABS.map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setTab(key)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '12px 18px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500, transition: 'all 0.15s',
              color: tab === key ? BRAND : '#5F5E5A',
              borderBottom: tab === key ? `2px solid ${BRAND}` : '2px solid transparent',
              marginBottom: -1 }}>
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
          {tab === 'portfolio'  && <PortfolioTab />}
          {tab === 'ledger'     && <BatchLedgerTab />}
          {tab === 'calculator' && <COAWizardTab />}
          {tab === 'insights'   && <AIInsightsTab />}
          {tab === 'analytics'  && <AnalyticsTab />}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
