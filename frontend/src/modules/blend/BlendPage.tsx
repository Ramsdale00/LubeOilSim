import { useEffect, useState } from 'react'
import { Play, Square, AlertTriangle, ChevronRight, Thermometer, Gauge, RefreshCw } from 'lucide-react'
import { clsx } from 'clsx'
import { motion, AnimatePresence } from 'framer-motion'
import { GlassCard } from '@/components/ui/GlassCard'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { PipelineCanvas } from '@/components/pipeline/PipelineCanvas'
import { useBlendStore } from '@/store/blendStore'
import { useTankStore } from '@/store/tankStore'
import { useSimulationStore } from '@/store/simulationStore'
import type { BlendBatch, BlendStage, Tank, MaterialType } from '@/types'

// ── Dummy data ───────────────────────────────────────────────────────────────

const STAGE_ORDER: BlendStage[] = ['queued', 'mixing', 'sampling', 'lab', 'completed']

const INITIAL_BATCHES: BlendBatch[] = [
  {
    id: 'B043', recipe_id: 'r1', recipe_name: 'Hydraulic ISO 46',
    stage: 'mixing', progress_percent: 47, temperature_c: 72, mixing_speed_rpm: 320,
    start_time: new Date(Date.now() - 5400000).toISOString(),
    estimated_end_time: new Date(Date.now() + 5400000).toISOString(),
    volume_liters: 3200, priority: 'high', alerts: [],
    ingredient_sequence: ['base_oil', 'viscosity_modifier', 'antioxidant'],
  },
  {
    id: 'B044', recipe_id: 'r2', recipe_name: 'Gear Oil EP 90',
    stage: 'queued', progress_percent: 0, temperature_c: 25, mixing_speed_rpm: 0,
    start_time: new Date(Date.now() + 3600000).toISOString(),
    estimated_end_time: new Date(Date.now() + 18000000).toISOString(),
    volume_liters: 1800, priority: 'normal', alerts: [],
    ingredient_sequence: ['base_oil', 'viscosity_modifier', 'detergent', 'pour_point_depressant'],
  },
  {
    id: 'B045', recipe_id: 'r3', recipe_name: 'SAE 5W-30 Full Syn',
    stage: 'lab', progress_percent: 88, temperature_c: 60, mixing_speed_rpm: 180,
    start_time: new Date(Date.now() - 12600000).toISOString(),
    estimated_end_time: new Date(Date.now() + 1800000).toISOString(),
    volume_liters: 2600, priority: 'urgent', alerts: ['Viscosity 1.2% below spec — minor'],
    ingredient_sequence: ['base_oil', 'viscosity_modifier', 'antioxidant', 'pour_point_depressant'],
  },
  {
    id: 'B042', recipe_id: 'r4', recipe_name: 'SAE 20W-50',
    stage: 'completed', progress_percent: 100, temperature_c: 40, mixing_speed_rpm: 0,
    start_time: new Date(Date.now() - 21600000).toISOString(),
    estimated_end_time: new Date(Date.now() - 3600000).toISOString(),
    volume_liters: 2400, priority: 'normal', alerts: [],
    ingredient_sequence: ['base_oil', 'viscosity_modifier', 'detergent'],
  },
]

const INITIAL_TANKS: Tank[] = [
  { id: 't1', name: 'T-01', capacity_liters: 50000, current_level_liters: 38000, fill_percent: 76, material: 'base_oil', temperature_c: 45, status: 'normal', position_x: 120, position_y: 100, last_updated: new Date().toISOString(), temp_history: [] },
  { id: 't2', name: 'T-02', capacity_liters: 20000, current_level_liters: 15600, fill_percent: 78, material: 'viscosity_modifier', temperature_c: 38, status: 'normal', position_x: 580, position_y: 100, last_updated: new Date().toISOString(), temp_history: [] },
  { id: 't3', name: 'T-03', capacity_liters: 10000, current_level_liters: 1800, fill_percent: 18, material: 'antioxidant', temperature_c: 32, status: 'low', position_x: 120, position_y: 440, last_updated: new Date().toISOString(), temp_history: [] },
  { id: 't4', name: 'T-04', capacity_liters: 15000, current_level_liters: 11200, fill_percent: 75, material: 'detergent', temperature_c: 50, status: 'normal', position_x: 580, position_y: 440, last_updated: new Date().toISOString(), temp_history: [] },
  { id: 't5', name: 'T-05', capacity_liters: 8000, current_level_liters: 1440, fill_percent: 18, material: 'pour_point_depressant', temperature_c: 28, status: 'low', position_x: 350, position_y: 80, last_updated: new Date().toISOString(), temp_history: [] },
  { id: 't6', name: 'T-06', capacity_liters: 60000, current_level_liters: 12000, fill_percent: 20, material: 'finished_product', temperature_c: 35, status: 'normal', position_x: 350, position_y: 460, last_updated: new Date().toISOString(), temp_history: [] },
]

// ── Helpers ──────────────────────────────────────────────────────────────────

const STAGE_LABELS: Record<BlendStage, string> = {
  queued: 'Queued', mixing: 'Mixing', sampling: 'Sampling', lab: 'Lab', completed: 'Completed', failed: 'Failed',
}

const STAGE_COLORS: Record<BlendStage, string> = {
  queued: 'text-slate-500 bg-slate-100/60',
  mixing: 'text-blue-600 bg-blue-100/60',
  sampling: 'text-purple-600 bg-purple-100/60',
  lab: 'text-amber-600 bg-amber-100/60',
  completed: 'text-green-600 bg-green-100/60',
  failed: 'text-red-600 bg-red-100/60',
}

const PRIORITY_COLORS: Record<string, string> = {
  low: 'text-slate-400',
  normal: 'text-blue-500',
  high: 'text-amber-500',
  urgent: 'text-red-500',
}

const PROGRESS_COLORS: Record<BlendStage, 'blue' | 'green' | 'amber' | 'purple' | 'cyan'> = {
  queued: 'blue',
  mixing: 'blue',
  sampling: 'purple',
  lab: 'amber',
  completed: 'green',
  failed: 'blue',
}

// ── Component ────────────────────────────────────────────────────────────────

export function BlendPage() {
  const { batches, activeBatch, setBatches, updateBatch, setActiveBatch, setPipelineActive } = useBlendStore()
  const { setTanks } = useTankStore()
  const { isRunning, timeAcceleration } = useSimulationStore()
  const [selectedId, setSelectedId] = useState<string>('B043')

  // Init
  useEffect(() => {
    setBatches(INITIAL_BATCHES)
    setTanks(INITIAL_TANKS)
    setActiveBatch(INITIAL_BATCHES[0])
    setPipelineActive(true)
  }, [])

  // Simulate progress
  useEffect(() => {
    if (!isRunning) return
    const interval = setInterval(() => {
      batches.forEach((b) => {
        if (b.stage === 'mixing' || b.stage === 'sampling' || b.stage === 'lab') {
          const increment = (0.08 * timeAcceleration)
          const newProgress = Math.min(100, b.progress_percent + increment)
          const newTemp = b.temperature_c + (Math.random() - 0.48) * 0.5
          const newRPM = b.mixing_speed_rpm + Math.round((Math.random() - 0.5) * 10)
          if (newProgress >= 100) {
            const currentIdx = STAGE_ORDER.indexOf(b.stage)
            const nextStage = STAGE_ORDER[currentIdx + 1] ?? 'completed'
            updateBatch(b.id, { stage: nextStage, progress_percent: 0, temperature_c: newTemp, mixing_speed_rpm: Math.max(0, newRPM) })
          } else {
            updateBatch(b.id, { progress_percent: newProgress, temperature_c: newTemp, mixing_speed_rpm: Math.max(0, newRPM) })
          }
        }
      })
    }, 1000 / timeAcceleration)
    return () => clearInterval(interval)
  }, [isRunning, timeAcceleration, batches, updateBatch])

  const selected = batches.find(b => b.id === selectedId) ?? batches[0]

  const handleStartStop = (batch: BlendBatch) => {
    if (batch.stage === 'queued') {
      updateBatch(batch.id, { stage: 'mixing' })
      setActiveBatch(batch)
      setPipelineActive(true)
    } else if (batch.stage === 'mixing') {
      updateBatch(batch.id, { stage: 'queued', progress_percent: 0 })
      setPipelineActive(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Blend Simulator</h1>
          <p className="text-sm text-slate-500 mt-0.5">Multi-stage blending control · {batches.filter(b => b.stage === 'mixing').length} active</p>
        </div>
        <button
          onClick={() => {
            const newBatch: BlendBatch = {
              id: `B${Math.floor(Math.random() * 900 + 100)}`,
              recipe_id: 'r5', recipe_name: 'Compressor Oil 46',
              stage: 'queued', progress_percent: 0, temperature_c: 25, mixing_speed_rpm: 0,
              start_time: new Date().toISOString(),
              estimated_end_time: new Date(Date.now() + 14400000).toISOString(),
              volume_liters: 2000, priority: 'normal', alerts: [],
              ingredient_sequence: ['base_oil', 'antioxidant'],
            }
            setBatches([...batches, newBatch])
          }}
          className="btn-primary flex items-center gap-2"
        >
          <Play className="w-4 h-4" />
          New Batch
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Batch List */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide px-1">Active Batches</p>
          {batches.map((batch) => (
            <GlassCard
              key={batch.id}
              hoverable
              animated
              className={clsx('p-3 cursor-pointer', selectedId === batch.id && 'border-blue-300/60 bg-white/35')}
              onClick={() => setSelectedId(batch.id)}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-800 text-sm">{batch.id}</span>
                  <span className={clsx('text-xs px-2 py-0.5 rounded-full font-medium', PRIORITY_COLORS[batch.priority])}>
                    {batch.priority.toUpperCase()}
                  </span>
                </div>
                <span className={clsx('text-xs px-2 py-0.5 rounded-full font-medium', STAGE_COLORS[batch.stage])}>
                  {STAGE_LABELS[batch.stage]}
                </span>
              </div>
              <p className="text-xs text-slate-600 mb-2">{batch.recipe_name}</p>
              {batch.stage !== 'queued' && batch.stage !== 'completed' && (
                <ProgressBar value={batch.progress_percent} color={PROGRESS_COLORS[batch.stage]} height="sm" />
              )}
              {batch.alerts.length > 0 && (
                <div className="flex items-center gap-1 mt-2">
                  <AlertTriangle className="w-3 h-3 text-amber-500" />
                  <span className="text-xs text-amber-600">{batch.alerts[0]}</span>
                </div>
              )}
            </GlassCard>
          ))}
        </div>

        {/* Pipeline Canvas + Detail */}
        <div className="lg:col-span-2 space-y-4">
          {/* Pipeline */}
          <GlassCard className="p-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-slate-700">Plant Pipeline Map</p>
              {activeBatch && (
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                  <span className="text-xs text-cyan-600 font-medium">Flow Active: {activeBatch.id}</span>
                </div>
              )}
            </div>
            <PipelineCanvas width={680} height={300} compact />
          </GlassCard>

          {/* Batch Detail */}
          <AnimatePresence mode="wait">
            {selected && (
              <motion.div key={selected.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <GlassCard className="p-4">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h2 className="text-lg font-bold text-slate-800">{selected.id} — {selected.recipe_name}</h2>
                      <p className="text-sm text-slate-500">{selected.volume_liters.toLocaleString()} L · Priority: <span className={PRIORITY_COLORS[selected.priority]}>{selected.priority}</span></p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleStartStop(selected)}
                        className={clsx('flex items-center gap-2', selected.stage === 'queued' ? 'btn-primary' : 'btn-danger')}
                      >
                        {selected.stage === 'queued' ? <><Play className="w-4 h-4" /> Start</> : <><Square className="w-4 h-4" /> Stop</>}
                      </button>
                    </div>
                  </div>

                  {/* Stage stepper */}
                  <div className="flex items-center gap-1 mb-4">
                    {STAGE_ORDER.filter(s => s !== 'failed').map((stage, i) => {
                      const currentIdx = STAGE_ORDER.indexOf(selected.stage)
                      const stageIdx = STAGE_ORDER.indexOf(stage)
                      const isDone = stageIdx < currentIdx
                      const isActive = stage === selected.stage
                      return (
                        <div key={stage} className="flex items-center flex-1">
                          <div className={clsx(
                            'flex-1 rounded-full py-1.5 text-xs font-medium text-center transition-all',
                            isActive ? 'bg-blue-500 text-white' : isDone ? 'bg-green-100 text-green-700' : 'bg-white/30 text-slate-400'
                          )}>
                            {STAGE_LABELS[stage]}
                          </div>
                          {i < 4 && <ChevronRight className="w-3 h-3 text-slate-300 flex-shrink-0" />}
                        </div>
                      )
                    })}
                  </div>

                  {/* Progress */}
                  {selected.stage !== 'queued' && (
                    <div className="mb-4">
                      <div className="flex justify-between text-xs text-slate-500 mb-1">
                        <span>Stage Progress</span>
                        <span>{selected.progress_percent.toFixed(1)}%</span>
                      </div>
                      <ProgressBar value={selected.progress_percent} color={PROGRESS_COLORS[selected.stage]} height="lg" />
                    </div>
                  )}

                  {/* Parameters */}
                  <div className="grid grid-cols-2 gap-3">
                    <GlassCard className="p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <Thermometer className="w-4 h-4 text-orange-500" />
                        <span className="text-xs text-slate-500 font-medium">Temperature</span>
                      </div>
                      <p className="text-2xl font-bold text-orange-500">{selected.temperature_c.toFixed(1)}°C</p>
                      <div className="mt-2">
                        <input
                          type="range" min={25} max={120} step={1}
                          value={Math.round(selected.temperature_c)}
                          onChange={(e) => updateBatch(selected.id, { temperature_c: Number(e.target.value) })}
                          className="w-full accent-orange-500"
                        />
                        <div className="flex justify-between text-xs text-slate-400">
                          <span>25°C</span><span>120°C</span>
                        </div>
                      </div>
                    </GlassCard>
                    <GlassCard className="p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <Gauge className="w-4 h-4 text-blue-500" />
                        <span className="text-xs text-slate-500 font-medium">Mixing Speed</span>
                      </div>
                      <p className="text-2xl font-bold text-blue-500">{selected.mixing_speed_rpm} RPM</p>
                      <div className="mt-2">
                        <input
                          type="range" min={0} max={500} step={10}
                          value={selected.mixing_speed_rpm}
                          onChange={(e) => updateBatch(selected.id, { mixing_speed_rpm: Number(e.target.value) })}
                          className="w-full accent-blue-500"
                        />
                        <div className="flex justify-between text-xs text-slate-400">
                          <span>0</span><span>500 RPM</span>
                        </div>
                      </div>
                    </GlassCard>
                  </div>

                  {/* Ingredient Sequence */}
                  <div className="mt-3">
                    <p className="text-xs font-medium text-slate-500 mb-2">Ingredient Sequence</p>
                    <div className="flex flex-wrap gap-2">
                      {selected.ingredient_sequence.map((ing, i) => (
                        <div key={ing} className="flex items-center gap-1.5 glass-card px-2.5 py-1">
                          <span className="text-xs font-bold text-slate-400">{i + 1}.</span>
                          <span className="text-xs text-slate-700 capitalize">{ing.replace(/_/g, ' ')}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {selected.alerts.length > 0 && (
                    <div className="mt-3 p-3 rounded-xl bg-amber-50/60 border border-amber-200/60">
                      {selected.alerts.map((alert, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-amber-500" />
                          <span className="text-xs text-amber-700">{alert}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </GlassCard>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
