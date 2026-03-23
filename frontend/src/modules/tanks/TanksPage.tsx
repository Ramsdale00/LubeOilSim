import { useEffect, useState } from 'react'
import { Thermometer, Droplets, AlertTriangle, Info } from 'lucide-react'
import { clsx } from 'clsx'
import { motion, AnimatePresence } from 'framer-motion'
import { GlassCard } from '@/components/ui/GlassCard'
import { useTankStore } from '@/store/tankStore'
import { useSimulationStore } from '@/store/simulationStore'
import type { Tank, MaterialType, TankStatus } from '@/types'
import { LineChart, Line, ResponsiveContainer, Tooltip } from 'recharts'

// ── Dummy data ────────────────────────────────────────────────────────────────

const INITIAL_TANKS: Tank[] = [
  { id: 't1', name: 'T-01 Base Oil A', capacity_liters: 50000, current_level_liters: 38000, fill_percent: 76, material: 'base_oil', temperature_c: 45.2, status: 'normal', position_x: 120, position_y: 100, last_updated: new Date().toISOString(), temp_history: [43,44,44.5,45,45.2] },
  { id: 't2', name: 'T-02 Base Oil B', capacity_liters: 30000, current_level_liters: 24600, fill_percent: 82, material: 'base_oil', temperature_c: 47.8, status: 'normal', position_x: 580, position_y: 100, last_updated: new Date().toISOString(), temp_history: [46,47,47.2,47.5,47.8] },
  { id: 't3', name: 'T-03 Visc. Modifier', capacity_liters: 20000, current_level_liters: 15600, fill_percent: 78, material: 'viscosity_modifier', temperature_c: 38.1, status: 'normal', position_x: 120, position_y: 440, last_updated: new Date().toISOString(), temp_history: [37,37.5,37.8,38,38.1] },
  { id: 't4', name: 'T-04 Antioxidant', capacity_liters: 10000, current_level_liters: 1800, fill_percent: 18, material: 'antioxidant', temperature_c: 32.0, status: 'low', position_x: 580, position_y: 440, last_updated: new Date().toISOString(), temp_history: [31,31.5,31.8,32,32] },
  { id: 't5', name: 'T-05 Detergent', capacity_liters: 15000, current_level_liters: 11250, fill_percent: 75, material: 'detergent', temperature_c: 50.4, status: 'normal', position_x: 350, position_y: 80, last_updated: new Date().toISOString(), temp_history: [49,49.5,50,50.2,50.4] },
  { id: 't6', name: 'T-06 PPD', capacity_liters: 8000, current_level_liters: 640, fill_percent: 8, material: 'pour_point_depressant', temperature_c: 28.5, status: 'critical', position_x: 350, position_y: 460, last_updated: new Date().toISOString(), temp_history: [28,28.2,28.3,28.4,28.5] },
  { id: 't7', name: 'T-07 Finished 46', capacity_liters: 60000, current_level_liters: 12000, fill_percent: 20, material: 'finished_product', temperature_c: 35.0, status: 'normal', position_x: 700, position_y: 280, last_updated: new Date().toISOString(), temp_history: [34,34.5,34.8,35,35] },
  { id: 't8', name: 'T-08 Finished 20W', capacity_liters: 60000, current_level_liters: 42000, fill_percent: 70, material: 'finished_product', temperature_c: 33.2, status: 'filling', position_x: 50, position_y: 280, last_updated: new Date().toISOString(), temp_history: [32,32.5,33,33,33.2] },
]

// ── Helpers ──────────────────────────────────────────────────────────────────

const MATERIAL_COLORS: Record<MaterialType, string> = {
  base_oil: '#3B82F6',
  viscosity_modifier: '#8B5CF6',
  antioxidant: '#EC4899',
  detergent: '#F59E0B',
  pour_point_depressant: '#10B981',
  finished_product: '#22D3EE',
}

const MATERIAL_LABELS: Record<MaterialType, string> = {
  base_oil: 'Base Oil',
  viscosity_modifier: 'Visc. Modifier',
  antioxidant: 'Antioxidant',
  detergent: 'Detergent',
  pour_point_depressant: 'Pour Point Dep.',
  finished_product: 'Finished Product',
}

const STATUS_BADGES: Record<TankStatus, string> = {
  normal: 'text-green-600 bg-green-100/60',
  low: 'text-amber-600 bg-amber-100/60',
  critical: 'text-red-600 bg-red-100/60',
  filling: 'text-blue-600 bg-blue-100/60',
  draining: 'text-purple-600 bg-purple-100/60',
  offline: 'text-slate-500 bg-slate-100/60',
}

// ── Tank Card ─────────────────────────────────────────────────────────────────

function TankCard({ tank, selected, onClick }: { tank: Tank; selected: boolean; onClick: () => void }) {
  const color = MATERIAL_COLORS[tank.material]
  const isAlert = tank.status === 'critical' || tank.status === 'low'

  return (
    <GlassCard
      hoverable
      animated
      onClick={onClick}
      className={clsx('p-3 cursor-pointer transition-all', selected && 'border-blue-300/60 bg-white/35')}
      glow={tank.status === 'critical' ? 'red' : tank.status === 'low' ? 'amber' : 'none'}
    >
      <div className="flex items-start justify-between mb-2">
        <div>
          <p className="text-xs font-bold text-slate-700">{tank.name}</p>
          <p className="text-xs text-slate-500">{MATERIAL_LABELS[tank.material]}</p>
        </div>
        <span className={clsx('text-xs px-2 py-0.5 rounded-full font-medium', STATUS_BADGES[tank.status])}>
          {tank.status.charAt(0).toUpperCase() + tank.status.slice(1)}
        </span>
      </div>

      {/* Liquid fill visualisation */}
      <div className="relative h-20 w-full rounded-xl overflow-hidden bg-white/20 border border-white/30 mb-2">
        <motion.div
          className="absolute bottom-0 left-0 right-0 rounded-b-xl transition-all"
          initial={{ height: 0 }}
          animate={{ height: `${tank.fill_percent}%` }}
          transition={{ duration: 1, ease: 'easeOut' }}
          style={{ background: `${color}40`, borderTop: `2px solid ${color}80` }}
        />
        {/* Liquid shimmer */}
        {tank.status === 'filling' && (
          <div
            className="absolute bottom-0 left-0 right-0 h-1 opacity-70"
            style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)`, animation: 'shimmer 2s linear infinite', backgroundSize: '200% auto' }}
          />
        )}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-2xl font-bold" style={{ color }}>{tank.fill_percent.toFixed(0)}%</span>
        </div>
        {isAlert && (
          <div className="absolute top-1 right-1">
            <AlertTriangle className="w-4 h-4 text-amber-500 animate-pulse" />
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-1 text-xs">
        <div className="flex items-center gap-1">
          <Droplets className="w-3 h-3 text-blue-400" />
          <span className="text-slate-500">{(tank.current_level_liters / 1000).toFixed(0)}k L</span>
        </div>
        <div className="flex items-center gap-1">
          <Thermometer className="w-3 h-3 text-orange-400" />
          <span className="text-slate-500">{tank.temperature_c.toFixed(1)}°C</span>
        </div>
      </div>
    </GlassCard>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export function TanksPage() {
  const { tanks, selectedTank, setTanks, updateTank, selectTank } = useTankStore()
  const { isRunning, timeAcceleration } = useSimulationStore()
  const [filter, setFilter] = useState<MaterialType | 'all'>('all')

  // Init
  useEffect(() => {
    if (tanks.length === 0) setTanks(INITIAL_TANKS)
  }, [])

  // Simulate live tank updates
  useEffect(() => {
    if (!isRunning) return
    const interval = setInterval(() => {
      tanks.forEach((tank) => {
        const tempDelta = (Math.random() - 0.5) * 0.4
        const levelDelta = tank.status === 'filling' ? 0.3 : tank.status === 'draining' ? -0.2 : (Math.random() - 0.5) * 0.1
        const newLevel = Math.max(0, Math.min(100, tank.fill_percent + levelDelta))
        const newTemp = Math.max(20, Math.min(95, tank.temperature_c + tempDelta))
        const newTempHistory = [...(tank.temp_history ?? []).slice(-19), newTemp]
        let newStatus: TankStatus = tank.status
        if (newLevel < 10) newStatus = 'critical'
        else if (newLevel < 20) newStatus = 'low'
        else if (tank.status === 'critical' || tank.status === 'low') newStatus = 'normal'
        updateTank(tank.id, {
          fill_percent: newLevel,
          current_level_liters: (newLevel / 100) * tank.capacity_liters,
          temperature_c: newTemp,
          temp_history: newTempHistory,
          status: newStatus,
        })
      })
    }, 1500 / timeAcceleration)
    return () => clearInterval(interval)
  }, [isRunning, timeAcceleration, tanks, updateTank])

  const filtered = filter === 'all' ? tanks : tanks.filter(t => t.material === filter)
  const materials = Array.from(new Set(tanks.map(t => t.material)))

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Tank Digital Twin</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {tanks.filter(t => t.status === 'critical').length} critical ·
            {tanks.filter(t => t.status === 'low').length} low stock ·
            {tanks.filter(t => t.status === 'filling').length} filling
          </p>
        </div>
        {/* Filter chips */}
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setFilter('all')}
            className={clsx('px-3 py-1 rounded-full text-xs font-medium transition-all', filter === 'all' ? 'bg-slate-700 text-white' : 'glass-card text-slate-600 hover:bg-white/40')}
          >
            All
          </button>
          {materials.map((mat) => (
            <button
              key={mat}
              onClick={() => setFilter(mat)}
              className={clsx('px-3 py-1 rounded-full text-xs font-medium transition-all', filter === mat ? 'text-white' : 'glass-card text-slate-600 hover:bg-white/40')}
              style={filter === mat ? { background: MATERIAL_COLORS[mat] } : {}}
            >
              {MATERIAL_LABELS[mat]}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Tank Grid */}
        <div className="lg:col-span-2 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {filtered.map((tank) => (
            <TankCard
              key={tank.id}
              tank={tank}
              selected={selectedTank?.id === tank.id}
              onClick={() => selectTank(tank)}
            />
          ))}
        </div>

        {/* Detail Panel */}
        <div>
          <AnimatePresence mode="wait">
            {selectedTank ? (
              <motion.div key={selectedTank.id} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <GlassCard className="p-4" glow={selectedTank.status === 'critical' ? 'red' : selectedTank.status === 'low' ? 'amber' : 'blue'}>
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h2 className="text-lg font-bold text-slate-800">{selectedTank.name}</h2>
                      <p className="text-sm" style={{ color: MATERIAL_COLORS[selectedTank.material] }}>
                        {MATERIAL_LABELS[selectedTank.material]}
                      </p>
                    </div>
                    <span className={clsx('text-xs px-2.5 py-1 rounded-full font-semibold', STATUS_BADGES[selectedTank.status])}>
                      {selectedTank.status.toUpperCase()}
                    </span>
                  </div>

                  {/* Big fill indicator */}
                  <div className="relative h-32 rounded-xl overflow-hidden bg-white/20 border border-white/30 mb-4">
                    <motion.div
                      className="absolute bottom-0 left-0 right-0"
                      animate={{ height: `${selectedTank.fill_percent}%` }}
                      transition={{ duration: 0.8 }}
                      style={{ background: `${MATERIAL_COLORS[selectedTank.material]}30`, borderTop: `2px solid ${MATERIAL_COLORS[selectedTank.material]}80` }}
                    />
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-4xl font-bold" style={{ color: MATERIAL_COLORS[selectedTank.material] }}>
                        {selectedTank.fill_percent.toFixed(1)}%
                      </span>
                      <span className="text-sm text-slate-500">
                        {(selectedTank.current_level_liters / 1000).toFixed(1)}k / {(selectedTank.capacity_liters / 1000).toFixed(0)}k L
                      </span>
                    </div>
                    {(selectedTank.status === 'critical' || selectedTank.status === 'low') && (
                      <div className="absolute top-2 right-2 flex items-center gap-1 bg-amber-500/20 rounded-lg px-2 py-1">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                        <span className="text-xs text-amber-600 font-medium">Low Stock</span>
                      </div>
                    )}
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <GlassCard className="p-3">
                      <p className="text-xs text-slate-500 mb-1">Temperature</p>
                      <p className="text-xl font-bold text-orange-500">{selectedTank.temperature_c.toFixed(1)}°C</p>
                    </GlassCard>
                    <GlassCard className="p-3">
                      <p className="text-xs text-slate-500 mb-1">Capacity</p>
                      <p className="text-xl font-bold text-slate-700">{(selectedTank.capacity_liters / 1000).toFixed(0)}k L</p>
                    </GlassCard>
                  </div>

                  {/* Temp history sparkline */}
                  {selectedTank.temp_history && selectedTank.temp_history.length > 0 && (
                    <div>
                      <p className="text-xs text-slate-500 mb-1 font-medium">Temperature History</p>
                      <ResponsiveContainer width="100%" height={60}>
                        <LineChart data={selectedTank.temp_history.map((v, i) => ({ i, v }))}>
                          <Line type="monotone" dataKey="v" stroke="#F97316" strokeWidth={2} dot={false} isAnimationActive={false} />
                          <Tooltip
                            contentStyle={{ background: 'rgba(255,255,255,0.9)', border: 'none', borderRadius: 8, fontSize: 11 }}
                            formatter={(v: number) => [`${v.toFixed(1)}°C`, 'Temp']}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => updateTank(selectedTank.id, { status: 'filling' })}
                      className="btn-primary flex-1 text-center text-xs py-1.5"
                    >
                      Start Fill
                    </button>
                    <button
                      onClick={() => updateTank(selectedTank.id, { status: 'draining' })}
                      className="btn-secondary flex-1 text-center text-xs py-1.5"
                    >
                      Drain
                    </button>
                    <button
                      onClick={() => updateTank(selectedTank.id, { status: 'offline' })}
                      className="btn-danger flex-1 text-center text-xs py-1.5"
                    >
                      Offline
                    </button>
                  </div>
                </GlassCard>
              </motion.div>
            ) : (
              <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <GlassCard className="p-8 text-center">
                  <Info className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm text-slate-400">Select a tank to view details</p>
                </GlassCard>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Summary */}
          <GlassCard className="p-4 mt-4">
            <p className="text-sm font-semibold text-slate-700 mb-3">Inventory Summary</p>
            <div className="space-y-2">
              {tanks.map((t) => (
                <div key={t.id} className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: MATERIAL_COLORS[t.material] }} />
                  <span className="text-xs text-slate-600 flex-1 truncate">{t.name}</span>
                  <div className="w-16 h-1.5 rounded-full bg-white/30">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${t.fill_percent}%`, background: t.fill_percent < 10 ? '#EF4444' : t.fill_percent < 20 ? '#F59E0B' : MATERIAL_COLORS[t.material] }}
                    />
                  </div>
                  <span className="text-xs font-medium text-slate-500 w-8 text-right">{t.fill_percent.toFixed(0)}%</span>
                </div>
              ))}
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  )
}
