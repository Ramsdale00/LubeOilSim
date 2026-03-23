import { useEffect } from 'react'
import { CheckCircle2, XCircle, Clock, TrendingUp, AlertTriangle, Lightbulb } from 'lucide-react'
import { clsx } from 'clsx'
import { GlassCard } from '@/components/ui/GlassCard'
import { RiskMeter } from '@/components/ui/RiskMeter'
import { RealtimeLineChart } from '@/components/charts/RealtimeLineChart'
import { useQualityStore, type QualityRecommendation, type ComparisonRow } from '@/store/qualityStore'
import { useSimulationStore } from '@/store/simulationStore'
import type { QualityPrediction } from '@/types'

// ── Dummy data ────────────────────────────────────────────────────────────────

const INITIAL_RECOMMENDATIONS: QualityRecommendation[] = [
  { id: 'rec1', text: 'Increase viscosity modifier by 0.8% to meet SAE 46 spec lower bound', type: 'ingredient', impact: 'high', applied: false },
  { id: 'rec2', text: 'Raise mixing temperature to 74°C for improved additive solubility', type: 'temperature', impact: 'medium', applied: false },
  { id: 'rec3', text: 'Add 0.3% antioxidant to reduce oxidation risk at elevated temperatures', type: 'ingredient', impact: 'medium', applied: false },
  { id: 'rec4', text: 'Switch base oil supplier to Grade A+ for TBN improvement', type: 'supplier', impact: 'low', applied: false },
  { id: 'rec5', text: 'Extend sampling phase by 15 min to confirm viscosity stabilisation', type: 'process', impact: 'low', applied: true },
]

const INITIAL_COMPARISON: ComparisonRow[] = [
  { batch_id: 'B043', batch_name: 'Hydraulic ISO 46', parameter: 'Viscosity', target: 46.0, predicted: 44.8, actual: 44.6, delta: -1.4, status: 'off_spec', unit: 'cSt' },
  { batch_id: 'B043', batch_name: 'Hydraulic ISO 46', parameter: 'Flash Point', target: 220, predicted: 224.2, actual: 223.8, delta: 3.8, status: 'on_spec', unit: '°C' },
  { batch_id: 'B043', batch_name: 'Hydraulic ISO 46', parameter: 'TBN', target: 6.5, predicted: 6.7, actual: null, delta: null, status: 'pending', unit: 'mg KOH/g' },
  { batch_id: 'B045', batch_name: 'SAE 5W-30 FS', parameter: 'Viscosity', target: 62.0, predicted: 63.4, actual: 63.1, delta: 1.1, status: 'on_spec', unit: 'cSt' },
  { batch_id: 'B045', batch_name: 'SAE 5W-30 FS', parameter: 'Flash Point', target: 240, predicted: 238.5, actual: null, delta: null, status: 'pending', unit: '°C' },
  { batch_id: 'B045', batch_name: 'SAE 5W-30 FS', parameter: 'TBN', target: 8.5, predicted: 8.9, actual: 8.7, delta: 0.2, status: 'on_spec', unit: 'mg KOH/g' },
]

// ── Generate initial prediction history ──────────────────────────────────────

function generateHistory(count: number): Array<QualityPrediction & { index: number }> {
  return Array.from({ length: count }, (_, i) => {
    const t = i / count
    return {
      viscosity: 44 + Math.sin(t * 8) * 2 + Math.random() * 0.5,
      viscosity_confidence: 0.88 + Math.random() * 0.08,
      flash_point: 222 + Math.cos(t * 6) * 3 + Math.random() * 0.5,
      flash_point_confidence: 0.90 + Math.random() * 0.07,
      tbn: 6.5 + Math.sin(t * 10 + 1) * 0.5 + Math.random() * 0.1,
      tbn_confidence: 0.85 + Math.random() * 0.1,
      off_spec_risk: 15 + Math.sin(t * 12) * 10 + Math.random() * 3,
      cost_per_liter: 1.8 + Math.sin(t * 4) * 0.1,
      timestamp: new Date(Date.now() - (count - i) * 5000).toISOString(),
      index: i,
    }
  })
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const IMPACT_COLORS: Record<string, string> = {
  high: 'text-red-600 bg-red-100/60',
  medium: 'text-amber-600 bg-amber-100/60',
  low: 'text-blue-600 bg-blue-100/60',
}

const TYPE_ICONS: Record<string, React.ElementType> = {
  ingredient: TrendingUp,
  temperature: AlertTriangle,
  process: Clock,
  supplier: Lightbulb,
}

// ── Component ─────────────────────────────────────────────────────────────────

export function QualityPage() {
  const { predictions, currentRisk, recommendations, comparisonRows, appendPrediction, setRisk, setRecommendations, applyRecommendation, setComparisonRows } = useQualityStore()
  const { isRunning, timeAcceleration } = useSimulationStore()

  // Init
  useEffect(() => {
    const history = generateHistory(40)
    history.forEach(p => appendPrediction(p))
    setRisk(22)
    setRecommendations(INITIAL_RECOMMENDATIONS)
    setComparisonRows(INITIAL_COMPARISON)
  }, [])

  // Live stream simulated quality predictions
  useEffect(() => {
    if (!isRunning) return
    const interval = setInterval(() => {
      const last = predictions[predictions.length - 1]
      if (!last) return
      const newPred: QualityPrediction = {
        viscosity: Math.max(35, Math.min(60, last.viscosity + (Math.random() - 0.48) * 0.6)),
        viscosity_confidence: 0.88 + Math.random() * 0.08,
        flash_point: Math.max(200, Math.min(250, last.flash_point + (Math.random() - 0.5) * 0.8)),
        flash_point_confidence: 0.90 + Math.random() * 0.07,
        tbn: Math.max(4, Math.min(12, last.tbn + (Math.random() - 0.5) * 0.15)),
        tbn_confidence: 0.85 + Math.random() * 0.1,
        off_spec_risk: Math.max(5, Math.min(80, currentRisk + (Math.random() - 0.49) * 3)),
        cost_per_liter: 1.8 + Math.random() * 0.2,
        timestamp: new Date().toISOString(),
      }
      appendPrediction(newPred)
      setRisk(newPred.off_spec_risk)
    }, 2000 / timeAcceleration)
    return () => clearInterval(interval)
  }, [isRunning, timeAcceleration, predictions, currentRisk, appendPrediction, setRisk])

  const viscData = predictions.map(p => ({ index: p.index, value: p.viscosity, upper: p.viscosity + 2, lower: p.viscosity - 2 }))
  const flashData = predictions.map(p => ({ index: p.index, value: p.flash_point, upper: p.flash_point + 3, lower: p.flash_point - 3 }))
  const tbnData = predictions.map(p => ({ index: p.index, value: p.tbn }))

  const latest = predictions[predictions.length - 1]

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Quality AI Engine</h1>
          <p className="text-sm text-slate-500 mt-0.5">Live predictions · {predictions.length} data points</p>
        </div>
        <div className="flex items-center gap-2 glass-card px-3 py-2">
          <div className={clsx('w-2 h-2 rounded-full animate-pulse', currentRisk < 30 ? 'bg-green-400' : currentRisk < 70 ? 'bg-amber-400' : 'bg-red-400')} />
          <span className="text-xs font-medium text-slate-600">
            Active Batch: B043 — Hydraulic ISO 46
          </span>
        </div>
      </div>

      {/* Top row: Risk Meter + Live values */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <GlassCard className="p-4 flex flex-col items-center" glow={currentRisk > 70 ? 'red' : currentRisk > 30 ? 'amber' : 'green'}>
          <p className="text-sm font-semibold text-slate-700 mb-2 self-start">Off-Spec Risk</p>
          <RiskMeter value={currentRisk} size={200} />
        </GlassCard>

        <GlassCard className="p-4 lg:col-span-2">
          <p className="text-sm font-semibold text-slate-700 mb-3">Current Predictions</p>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Viscosity', value: latest?.viscosity, unit: 'cSt', spec: '44–48', ok: latest ? latest.viscosity >= 44 && latest.viscosity <= 48 : true, color: '#3B82F6' },
              { label: 'Flash Point', value: latest?.flash_point, unit: '°C', spec: '≥220', ok: latest ? latest.flash_point >= 220 : true, color: '#F59E0B' },
              { label: 'TBN', value: latest?.tbn, unit: 'mg KOH/g', spec: '6.0–7.0', ok: latest ? latest.tbn >= 6.0 && latest.tbn <= 7.0 : true, color: '#10B981' },
            ].map(({ label, value, unit, spec, ok, color }) => (
              <GlassCard key={label} className="p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-slate-500 font-medium">{label}</span>
                  {ok
                    ? <CheckCircle2 className="w-4 h-4 text-green-500" />
                    : <XCircle className="w-4 h-4 text-red-500 animate-pulse" />
                  }
                </div>
                <p className="text-2xl font-bold mb-1" style={{ color }}>{value?.toFixed(1) ?? '—'}</p>
                <p className="text-xs text-slate-400">{unit}</p>
                <p className="text-xs text-slate-400 mt-1">Spec: {spec}</p>
              </GlassCard>
            ))}
          </div>
        </GlassCard>
      </div>

      {/* Live charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <GlassCard className="p-4">
          <RealtimeLineChart data={viscData} color="#3B82F6" label="Viscosity (cSt)" specMin={44} specMax={48} unit="cSt" showConfidence height={160} />
        </GlassCard>
        <GlassCard className="p-4">
          <RealtimeLineChart data={flashData} color="#F59E0B" label="Flash Point (°C)" specMin={220} unit="°C" showConfidence height={160} />
        </GlassCard>
        <GlassCard className="p-4">
          <RealtimeLineChart data={tbnData} color="#10B981" label="TBN (mg KOH/g)" specMin={6.0} specMax={7.0} unit="" height={160} />
        </GlassCard>
      </div>

      {/* Recommendations + Comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* AI Recommendations */}
        <GlassCard className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Lightbulb className="w-4 h-4 text-amber-500" />
            <p className="text-sm font-semibold text-slate-700">AI Recommendations</p>
          </div>
          <div className="space-y-2">
            {recommendations.map((rec) => {
              const Icon = TYPE_ICONS[rec.type] ?? Lightbulb
              return (
                <div
                  key={rec.id}
                  className={clsx('flex items-start gap-3 p-3 rounded-xl transition-all', rec.applied ? 'opacity-50' : 'hover:bg-white/20')}
                >
                  <div className={clsx('p-1.5 rounded-lg flex-shrink-0 mt-0.5', IMPACT_COLORS[rec.impact])}>
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-slate-700 leading-relaxed">{rec.text}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={clsx('text-xs px-1.5 py-0.5 rounded-full font-medium capitalize', IMPACT_COLORS[rec.impact])}>
                        {rec.impact} impact
                      </span>
                      <span className="text-xs text-slate-400 capitalize">{rec.type}</span>
                    </div>
                  </div>
                  {!rec.applied && (
                    <button
                      onClick={() => applyRecommendation(rec.id)}
                      className="btn-primary text-xs px-2 py-1 flex-shrink-0"
                    >
                      Apply
                    </button>
                  )}
                  {rec.applied && (
                    <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                  )}
                </div>
              )
            })}
          </div>
        </GlassCard>

        {/* Predicted vs Actual */}
        <GlassCard className="p-4">
          <p className="text-sm font-semibold text-slate-700 mb-3">Predicted vs Actual</p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-slate-400 font-medium">
                  <th className="text-left pb-2">Batch</th>
                  <th className="text-left pb-2">Parameter</th>
                  <th className="text-right pb-2">Target</th>
                  <th className="text-right pb-2">Predicted</th>
                  <th className="text-right pb-2">Actual</th>
                  <th className="text-right pb-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/20">
                {comparisonRows.map((row, i) => (
                  <tr key={`${row.batch_id}-${row.parameter}-${i}`} className="hover:bg-white/10">
                    <td className="py-2 text-slate-600">{row.batch_id}</td>
                    <td className="py-2 text-slate-700 font-medium">{row.parameter}</td>
                    <td className="py-2 text-right text-slate-500">{row.target} {row.unit}</td>
                    <td className="py-2 text-right text-blue-600 font-medium">{row.predicted.toFixed(1)}</td>
                    <td className="py-2 text-right text-slate-700 font-medium">
                      {row.actual !== null ? row.actual.toFixed(1) : <span className="text-slate-400">—</span>}
                    </td>
                    <td className="py-2 text-right">
                      {row.status === 'on_spec' && <span className="text-green-600 font-semibold">✓ PASS</span>}
                      {row.status === 'off_spec' && <span className="text-red-600 font-semibold animate-pulse">✗ FAIL</span>}
                      {row.status === 'pending' && <span className="text-slate-400 flex items-center justify-end gap-1"><Clock className="w-3 h-3 inline" /> Pending</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </GlassCard>
      </div>
    </div>
  )
}
