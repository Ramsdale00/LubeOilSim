import { useEffect, useRef } from 'react'
import {
  Activity, Zap, BarChart3, Cpu, AlertTriangle,
  CheckCircle2, Info, XCircle, TrendingUp, Clock
} from 'lucide-react'
import { clsx } from 'clsx'
import { GlassCard } from '@/components/ui/GlassCard'
import { KPITile } from '@/components/ui/KPITile'
import { useDashboardStore } from '@/store/dashboardStore'
import { useSimulationStore } from '@/store/simulationStore'
import type { EventLog, KPISnapshot, TimelineEntry } from '@/types'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'

// ── Dummy data generators ────────────────────────────────────────────────────

function makeKPIs(seed: number): KPISnapshot {
  const jitter = (base: number, pct: number) => base + (Math.sin(seed * 0.1 + base) * base * pct)
  return {
    production_volume_liters: jitter(12450, 0.03),
    cost_per_batch: jitter(2340, 0.02),
    energy_kwh: jitter(8820, 0.04),
    utilization_percent: Math.min(99, jitter(78, 0.02)),
    active_batches: 3 + (seed % 3),
    completed_batches_today: 7 + (seed % 4),
    quality_pass_rate: Math.min(99.5, jitter(96.2, 0.01)),
    timestamp: new Date().toISOString(),
  }
}

const INITIAL_EVENTS: EventLog[] = [
  { id: 'e1', timestamp: new Date(Date.now() - 60000).toISOString(), type: 'batch_complete', severity: 'success', title: 'Batch B042 Completed', message: 'SAE 20W-50 blend completed. Quality: PASS. Volume: 2,400 L', source: 'Blender-1', acknowledged: false },
  { id: 'e2', timestamp: new Date(Date.now() - 180000).toISOString(), type: 'quality_deviation', severity: 'warning', title: 'Viscosity Deviation Detected', message: 'Batch B041 viscosity at 94.2 cSt — spec min 95. Recommend +0.5% VM', source: 'Lab Analyzer', acknowledged: false },
  { id: 'e3', timestamp: new Date(Date.now() - 420000).toISOString(), type: 'maintenance_due', severity: 'info', title: 'Pump P-03 Maintenance Due', message: 'Scheduled maintenance overdue by 12 hours. Plan window: tonight', source: 'Predictive Maint.', acknowledged: true },
  { id: 'e4', timestamp: new Date(Date.now() - 900000).toISOString(), type: 'material_shortage', severity: 'warning', title: 'Low Stock: Antioxidant AO-7', message: 'Tank T-05 at 18% capacity. Reorder recommended.', source: 'Tank Monitor', acknowledged: false },
  { id: 'e5', timestamp: new Date(Date.now() - 1800000).toISOString(), type: 'batch_complete', severity: 'success', title: 'Batch B040 Completed', message: 'Hydraulic Oil ISO 46 — 3,100 L produced. Cost: $2,186', source: 'Blender-2', acknowledged: true },
]

const TIMELINE_DATA: TimelineEntry[] = [
  { id: 't1', batch_id: 'B042', batch_name: 'SAE 20W-50', start_time: '06:00', end_time: '09:30', stage: 'completed', color: '#22C55E' },
  { id: 't2', batch_id: 'B043', batch_name: 'Hydraulic ISO 46', start_time: '08:00', end_time: '12:00', stage: 'mixing', color: '#3B82F6' },
  { id: 't3', batch_id: 'B044', batch_name: 'Gear Oil EP 90', start_time: '10:30', end_time: '14:30', stage: 'queued', color: '#94A3B8' },
  { id: 't4', batch_id: 'B045', batch_name: 'Turbine Oil 32', start_time: '12:00', end_time: '15:30', stage: 'queued', color: '#94A3B8' },
]

const HOURLY_PRODUCTION = [
  { hour: '06', vol: 320 }, { hour: '07', vol: 480 }, { hour: '08', vol: 560 },
  { hour: '09', vol: 720 }, { hour: '10', vol: 690 }, { hour: '11', vol: 810 },
  { hour: '12', vol: 750 }, { hour: '13', vol: 880 }, { hour: '14', vol: 920 },
]

const EQUIPMENT_HEALTH = [
  { name: 'Blender-1', health: 94, status: 'running' },
  { name: 'Blender-2', health: 87, status: 'running' },
  { name: 'Pump P-01', health: 98, status: 'running' },
  { name: 'Pump P-03', health: 61, status: 'idle' },
  { name: 'HX-01', health: 83, status: 'running' },
  { name: 'Lab Analyzer', health: 99, status: 'running' },
]

// ── Helpers ──────────────────────────────────────────────────────────────────

const EVENT_ICON: Record<string, React.ElementType> = {
  success: CheckCircle2,
  warning: AlertTriangle,
  critical: XCircle,
  info: Info,
}

const EVENT_COLORS: Record<string, string> = {
  success: 'text-green-600 bg-green-100/60',
  warning: 'text-amber-600 bg-amber-100/60',
  critical: 'text-red-600 bg-red-100/60',
  info: 'text-blue-600 bg-blue-100/60',
}

function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60) return `${Math.round(diff)}s ago`
  if (diff < 3600) return `${Math.round(diff / 60)}m ago`
  return `${Math.round(diff / 3600)}h ago`
}

// ── Component ────────────────────────────────────────────────────────────────

export function DashboardPage() {
  const { kpis, events, setKPIs, setEvents, acknowledgeEvent } = useDashboardStore()
  const { isRunning, timeAcceleration, tickCount } = useSimulationStore()
  const sparkRef = useRef<number[][]>([[], [], [], []])

  // Initialise
  useEffect(() => {
    setKPIs(makeKPIs(0))
    setEvents(INITIAL_EVENTS)
    const spark = Array.from({ length: 4 }, () =>
      Array.from({ length: 20 }, (_, i) => 50 + Math.sin(i * 0.5) * 20 + Math.random() * 10)
    )
    sparkRef.current = spark
  }, [])

  // Live updates
  useEffect(() => {
    if (!isRunning) return
    const interval = setInterval(() => {
      setKPIs(makeKPIs(Date.now()))
      sparkRef.current = sparkRef.current.map((arr) => {
        const next = [...arr.slice(-19), arr[arr.length - 1] * 0.97 + Math.random() * 6]
        return next
      })
    }, 2000 / timeAcceleration)
    return () => clearInterval(interval)
  }, [isRunning, timeAcceleration, setKPIs])

  const spark = sparkRef.current

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Command Dashboard</h1>
          <p className="text-sm text-slate-500 mt-0.5">Real-time operational overview · Tick #{tickCount}</p>
        </div>
        <div className="flex items-center gap-2 glass-card px-3 py-2">
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-xs font-medium text-slate-600">Live Simulation</span>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPITile
          label="Production Volume"
          value={kpis?.production_volume_liters ?? 0}
          unit="L"
          trend="up"
          trendValue={2.3}
          color="blue"
          icon={Activity}
          sparklineData={spark[0]}
          decimals={0}
        />
        <KPITile
          label="Cost Per Batch"
          value={kpis?.cost_per_batch ?? 0}
          unit="$"
          trend="down"
          trendValue={-1.2}
          color="green"
          icon={TrendingUp}
          sparklineData={spark[1]}
          decimals={0}
        />
        <KPITile
          label="Energy Consumption"
          value={kpis?.energy_kwh ?? 0}
          unit="kWh"
          trend="stable"
          color="amber"
          icon={Zap}
          sparklineData={spark[2]}
          decimals={0}
        />
        <KPITile
          label="Quality Pass Rate"
          value={kpis?.quality_pass_rate ?? 0}
          unit="%"
          trend="up"
          trendValue={0.4}
          color="purple"
          icon={CheckCircle2}
          sparklineData={spark[3]}
          decimals={1}
        />
      </div>

      {/* Secondary KPIs */}
      <div className="grid grid-cols-3 gap-3">
        <GlassCard className="p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-100/60 flex items-center justify-center">
            <Cpu className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">Active Batches</p>
            <p className="text-3xl font-bold text-blue-600">{kpis?.active_batches ?? 0}</p>
          </div>
        </GlassCard>
        <GlassCard className="p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-green-100/60 flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6 text-green-600" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">Completed Today</p>
            <p className="text-3xl font-bold text-green-600">{kpis?.completed_batches_today ?? 0}</p>
          </div>
        </GlassCard>
        <GlassCard className="p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-100/60 flex items-center justify-center">
            <BarChart3 className="w-6 h-6 text-amber-600" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">Utilization</p>
            <p className="text-3xl font-bold text-amber-600">{(kpis?.utilization_percent ?? 0).toFixed(1)}%</p>
          </div>
        </GlassCard>
      </div>

      {/* Charts + Event Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Hourly Production */}
        <GlassCard className="p-4 lg:col-span-2">
          <p className="text-sm font-semibold text-slate-700 mb-3">Hourly Production (L)</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={HOURLY_PRODUCTION} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
              <XAxis dataKey="hour" tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: 'rgba(255,255,255,0.9)', border: '1px solid rgba(255,255,255,0.5)', borderRadius: 12, fontSize: 12 }}
              />
              <Bar dataKey="vol" radius={[6, 6, 0, 0]}>
                {HOURLY_PRODUCTION.map((_, i) => (
                  <Cell key={i} fill={i === HOURLY_PRODUCTION.length - 1 ? '#3B82F6' : `rgba(59,130,246,${0.4 + i * 0.06})`} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </GlassCard>

        {/* Equipment Health */}
        <GlassCard className="p-4">
          <p className="text-sm font-semibold text-slate-700 mb-3">Equipment Health</p>
          <div className="space-y-2.5">
            {EQUIPMENT_HEALTH.map((eq) => (
              <div key={eq.name}>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs text-slate-600 font-medium">{eq.name}</span>
                  <span className={clsx('text-xs font-bold', eq.health > 80 ? 'text-green-600' : eq.health > 60 ? 'text-amber-600' : 'text-red-600')}>
                    {eq.health}%
                  </span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-white/30">
                  <div
                    className={clsx('h-full rounded-full transition-all duration-500', eq.health > 80 ? 'bg-green-400' : eq.health > 60 ? 'bg-amber-400' : 'bg-red-400')}
                    style={{ width: `${eq.health}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      </div>

      {/* Timeline + Events */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Operations Timeline */}
        <GlassCard className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-4 h-4 text-slate-500" />
            <p className="text-sm font-semibold text-slate-700">Operations Timeline</p>
          </div>
          <div className="relative">
            {/* Time axis */}
            <div className="flex justify-between text-xs text-slate-400 mb-2 px-2">
              {['06', '08', '10', '12', '14', '16'].map(h => <span key={h}>{h}:00</span>)}
            </div>
            <div className="space-y-2">
              {TIMELINE_DATA.map((entry) => {
                const startH = parseInt(entry.start_time) - 6
                const endH = parseInt(entry.end_time) - 6
                const left = (startH / 10) * 100
                const width = ((endH - startH) / 10) * 100
                return (
                  <div key={entry.id} className="relative h-7 bg-white/20 rounded-lg">
                    <div
                      className="absolute h-full rounded-lg flex items-center px-2"
                      style={{ left: `${left}%`, width: `${Math.max(width, 5)}%`, background: `${entry.color}30`, border: `1px solid ${entry.color}60` }}
                    >
                      <span className="text-xs font-medium truncate" style={{ color: entry.color }}>{entry.batch_name}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </GlassCard>

        {/* Live Event Feed */}
        <GlassCard className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-slate-500" />
              <p className="text-sm font-semibold text-slate-700">Live Event Feed</p>
            </div>
            <span className="text-xs text-slate-400">{(events ?? []).filter(e => !e.acknowledged).length} unread</span>
          </div>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {events.slice(0, 8).map((event) => {
              const Icon = EVENT_ICON[event.severity] ?? Info
              return (
                <div
                  key={event.id}
                  className={clsx(
                    'flex items-start gap-2.5 p-2.5 rounded-xl transition-all cursor-pointer',
                    event.acknowledged ? 'opacity-50' : 'hover:bg-white/30'
                  )}
                  onClick={() => acknowledgeEvent(event.id)}
                >
                  <div className={clsx('p-1.5 rounded-lg flex-shrink-0', EVENT_COLORS[event.severity])}>
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <p className="text-xs font-semibold text-slate-700 truncate">{event.title}</p>
                      <span className="text-xs text-slate-400 flex-shrink-0">{timeAgo(event.timestamp)}</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{event.message}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </GlassCard>
      </div>
    </div>
  )
}
