import { useEffect, useState } from 'react'
import { TruckIcon, Sparkles, CheckCircle2, Star, Clock, DollarSign, Package, TrendingDown } from 'lucide-react'
import { clsx } from 'clsx'
import { motion, AnimatePresence } from 'framer-motion'
import { GlassCard } from '@/components/ui/GlassCard'
import { useSupplyStore } from '@/store/supplyStore'
import type { Supplier, QualityGrade } from '@/types'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts'

// ── Dummy data ────────────────────────────────────────────────────────────────

const INITIAL_SUPPLIERS: Supplier[] = [
  { id: 's1', name: 'Nexus Petrochemicals', material: 'base_oil', price_per_liter: 1.24, lead_time_days: 5, quality_grade: 'A+', reliability_percent: 98, min_order_liters: 5000, is_preferred: true, region: 'North America' },
  { id: 's2', name: 'Gulf Base Oils Ltd', material: 'base_oil', price_per_liter: 1.18, lead_time_days: 8, quality_grade: 'A', reliability_percent: 94, min_order_liters: 10000, is_preferred: false, region: 'Middle East' },
  { id: 's3', name: 'EuroLube AG', material: 'base_oil', price_per_liter: 1.32, lead_time_days: 3, quality_grade: 'A+', reliability_percent: 99, min_order_liters: 2000, is_preferred: false, region: 'Europe' },
  { id: 's4', name: 'Viscoflex Corp', material: 'viscosity_modifier', price_per_liter: 3.82, lead_time_days: 7, quality_grade: 'A+', reliability_percent: 96, min_order_liters: 1000, is_preferred: true, region: 'North America' },
  { id: 's5', name: 'Polyadd Industries', material: 'viscosity_modifier', price_per_liter: 3.65, lead_time_days: 12, quality_grade: 'B+', reliability_percent: 88, min_order_liters: 2000, is_preferred: false, region: 'Asia Pacific' },
  { id: 's6', name: 'Oxiprotect GmbH', material: 'antioxidant', price_per_liter: 8.40, lead_time_days: 10, quality_grade: 'A+', reliability_percent: 97, min_order_liters: 500, is_preferred: true, region: 'Europe' },
  { id: 's7', name: 'ChemGuard Inc', material: 'antioxidant', price_per_liter: 7.95, lead_time_days: 6, quality_grade: 'A', reliability_percent: 92, min_order_liters: 800, is_preferred: false, region: 'North America' },
  { id: 's8', name: 'CleanAdd Solutions', material: 'detergent', price_per_liter: 5.20, lead_time_days: 4, quality_grade: 'A', reliability_percent: 95, min_order_liters: 1500, is_preferred: true, region: 'Europe' },
]

const COST_BREAKDOWN = [
  { name: 'Base Oil', value: 62, color: '#3B82F6' },
  { name: 'Visc. Mod.', value: 18, color: '#8B5CF6' },
  { name: 'Antioxidant', value: 10, color: '#EC4899' },
  { name: 'Detergent', value: 7, color: '#F59E0B' },
  { name: 'PPD', value: 3, color: '#10B981' },
]

const PRICE_TREND = [
  { month: 'Oct', base: 1.19, vm: 3.75 },
  { month: 'Nov', base: 1.22, vm: 3.78 },
  { month: 'Dec', base: 1.25, vm: 3.82 },
  { month: 'Jan', base: 1.21, vm: 3.70 },
  { month: 'Feb', base: 1.18, vm: 3.65 },
  { month: 'Mar', base: 1.24, vm: 3.82 },
]

// ── Helpers ──────────────────────────────────────────────────────────────────

const GRADE_COLORS: Record<QualityGrade, string> = {
  'A+': 'text-green-700 bg-green-100/70',
  'A': 'text-green-600 bg-green-100/50',
  'B+': 'text-blue-600 bg-blue-100/50',
  'B': 'text-blue-500 bg-blue-100/40',
  'C': 'text-slate-500 bg-slate-100/50',
}

const MATERIAL_LABELS: Record<string, string> = {
  base_oil: 'Base Oil',
  viscosity_modifier: 'Visc. Modifier',
  antioxidant: 'Antioxidant',
  detergent: 'Detergent',
  pour_point_depressant: 'PPD',
  finished_product: 'Finished Product',
}

// ── Supplier Card ─────────────────────────────────────────────────────────────

function SupplierCard({ supplier, selected, onToggle }: { supplier: Supplier; selected: boolean; onToggle: () => void }) {
  return (
    <GlassCard
      hoverable
      animated
      onClick={onToggle}
      className={clsx('p-3 cursor-pointer', selected && 'border-blue-300/60 bg-white/35')}
      glow={supplier.is_preferred ? 'blue' : 'none'}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1 min-w-0 mr-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className="text-xs font-bold text-slate-700 truncate">{supplier.name}</p>
            {supplier.is_preferred && <Star className="w-3 h-3 text-amber-400 fill-amber-400 flex-shrink-0" />}
          </div>
          <p className="text-xs text-slate-400 mt-0.5">{supplier.region}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className={clsx('text-xs px-1.5 py-0.5 rounded-full font-bold', GRADE_COLORS[supplier.quality_grade])}>
            {supplier.quality_grade}
          </span>
          <div className={clsx('w-4 h-4 rounded border-2 flex items-center justify-center transition-all', selected ? 'bg-blue-500 border-blue-500' : 'border-slate-300')}>
            {selected && <CheckCircle2 className="w-3 h-3 text-white" />}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-1 text-xs">
        <div className="flex items-center gap-1">
          <DollarSign className="w-3 h-3 text-green-500" />
          <span className="text-slate-600 font-semibold">${supplier.price_per_liter.toFixed(2)}/L</span>
        </div>
        <div className="flex items-center gap-1">
          <Clock className="w-3 h-3 text-blue-400" />
          <span className="text-slate-500">{supplier.lead_time_days}d lead</span>
        </div>
        <div className="flex items-center gap-1">
          <Package className="w-3 h-3 text-purple-400" />
          <span className="text-slate-500">{(supplier.min_order_liters / 1000).toFixed(0)}k L min</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-slate-500">Rel: <b className={supplier.reliability_percent >= 95 ? 'text-green-600' : 'text-amber-600'}>{supplier.reliability_percent}%</b></span>
        </div>
      </div>
      {/* Reliability bar */}
      <div className="mt-2 w-full h-1 rounded-full bg-white/30">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${supplier.reliability_percent}%`, background: supplier.reliability_percent >= 95 ? '#22C55E' : '#F59E0B' }}
        />
      </div>
    </GlassCard>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export function SupplyPage() {
  const { suppliers, selectedSuppliers, optimizationResult, isOptimizing, setSuppliers, toggleSupplierSelection, setOptimizationResult, setIsOptimizing } = useSupplyStore()
  const [materialFilter, setMaterialFilter] = useState<string>('all')

  useEffect(() => {
    if (suppliers.length === 0) setSuppliers(INITIAL_SUPPLIERS)
  }, [])

  const handleOptimize = () => {
    setIsOptimizing(true)
    setTimeout(() => {
      setOptimizationResult({
        recommended_mix: [
          { supplier_id: 's2', supplier_name: 'Gulf Base Oils Ltd', material: 'base_oil', volume_liters: 30000, cost: 35400, percentage: 60 },
          { supplier_id: 's4', supplier_name: 'Viscoflex Corp', material: 'viscosity_modifier', volume_liters: 6000, cost: 22920, percentage: 20 },
          { supplier_id: 's7', supplier_name: 'ChemGuard Inc', material: 'antioxidant', volume_liters: 2000, cost: 15900, percentage: 10 },
          { supplier_id: 's8', supplier_name: 'CleanAdd Solutions', material: 'detergent', volume_liters: 2000, cost: 10400, percentage: 10 },
        ],
        total_cost_current: 108540,
        total_cost_optimized: 84620,
        savings_percent: 22.1,
        quality_impact: 'minimal',
        lead_time_days: 8,
      })
      setIsOptimizing(false)
    }, 1800)
  }

  const materials = Array.from(new Set(suppliers.map(s => s.material)))
  const filtered = materialFilter === 'all' ? suppliers : suppliers.filter(s => s.material === materialFilter)

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Supply & Cost Optimizer</h1>
          <p className="text-sm text-slate-500 mt-0.5">{suppliers.length} suppliers · {selectedSuppliers.length} selected</p>
        </div>
        <button
          onClick={handleOptimize}
          disabled={isOptimizing}
          className="btn-primary flex items-center gap-2"
        >
          <Sparkles className="w-4 h-4" />
          {isOptimizing ? 'Optimizing...' : 'AI Optimize Supply Mix'}
        </button>
      </div>

      {/* Material filter */}
      <div className="flex gap-1.5 flex-wrap">
        <button onClick={() => setMaterialFilter('all')} className={clsx('px-3 py-1 rounded-full text-xs font-medium transition-all', materialFilter === 'all' ? 'bg-slate-700 text-white' : 'glass-card text-slate-600 hover:bg-white/40')}>All</button>
        {materials.map(m => (
          <button key={m} onClick={() => setMaterialFilter(m)} className={clsx('px-3 py-1 rounded-full text-xs font-medium transition-all', materialFilter === m ? 'bg-blue-500 text-white' : 'glass-card text-slate-600 hover:bg-white/40')}>
            {MATERIAL_LABELS[m] ?? m}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Supplier Grid */}
        <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {filtered.map(s => (
            <SupplierCard
              key={s.id}
              supplier={s}
              selected={selectedSuppliers.includes(s.id)}
              onToggle={() => toggleSupplierSelection(s.id)}
            />
          ))}
        </div>

        {/* Right panel */}
        <div className="space-y-4">
          {/* Cost Breakdown Pie */}
          <GlassCard className="p-4">
            <p className="text-sm font-semibold text-slate-700 mb-3">Cost Breakdown</p>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={COST_BREAKDOWN} dataKey="value" cx="50%" cy="50%" outerRadius={70} paddingAngle={3}>
                  {COST_BREAKDOWN.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: 'rgba(255,255,255,0.95)', border: '1px solid rgba(255,255,255,0.5)', borderRadius: 10, fontSize: 12 }}
                  formatter={(v: number) => [`${v}%`, '']}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="grid grid-cols-2 gap-1.5 mt-1">
              {COST_BREAKDOWN.map(({ name, value, color }) => (
                <div key={name} className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: color }} />
                  <span className="text-xs text-slate-600">{name}: <b>{value}%</b></span>
                </div>
              ))}
            </div>
          </GlassCard>

          {/* Price trend chart */}
          <GlassCard className="p-4">
            <p className="text-sm font-semibold text-slate-700 mb-3">Price Trends ($/L)</p>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={PRICE_TREND} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#94A3B8' }} axisLine={false} tickLine={false} domain={[1.1, 4.0]} />
                <Tooltip contentStyle={{ background: 'rgba(255,255,255,0.9)', border: 'none', borderRadius: 10, fontSize: 11 }} />
                <Bar dataKey="base" name="Base Oil" fill="#3B82F6" radius={[4, 4, 0, 0]} fillOpacity={0.8} />
              </BarChart>
            </ResponsiveContainer>
          </GlassCard>

          {/* AI Optimization Result */}
          <AnimatePresence>
            {optimizationResult && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <GlassCard className="p-4" glow="green">
                  <div className="flex items-center gap-2 mb-3">
                    <TrendingDown className="w-4 h-4 text-green-600" />
                    <p className="text-sm font-semibold text-green-700">Optimized Supply Mix</p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div className="glass-card p-2.5 text-center">
                      <p className="text-xs text-slate-500">Current Cost</p>
                      <p className="text-base font-bold text-slate-700">${(optimizationResult.total_cost_current / 1000).toFixed(1)}k</p>
                    </div>
                    <div className="glass-card p-2.5 text-center">
                      <p className="text-xs text-slate-500">Optimized Cost</p>
                      <p className="text-base font-bold text-green-600">${(optimizationResult.total_cost_optimized / 1000).toFixed(1)}k</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-green-50/60 border border-green-200/60 mb-3">
                    <span className="text-xs font-medium text-green-700">Cost Savings</span>
                    <span className="text-base font-bold text-green-700">−{optimizationResult.savings_percent.toFixed(1)}%</span>
                  </div>

                  <div className="space-y-1.5">
                    {optimizationResult.recommended_mix.map((item) => (
                      <div key={item.supplier_id} className="flex items-center justify-between text-xs">
                        <span className="text-slate-600 truncate flex-1">{item.supplier_name}</span>
                        <span className="text-slate-500 ml-2">{(item.volume_liters / 1000).toFixed(0)}k L</span>
                        <span className="text-green-600 font-semibold ml-2">${(item.cost / 1000).toFixed(1)}k</span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-3 flex items-center gap-1.5">
                    <span className="text-xs text-slate-500">Quality impact:</span>
                    <span className={clsx('text-xs font-semibold', optimizationResult.quality_impact === 'none' ? 'text-green-600' : 'text-amber-600')}>
                      {optimizationResult.quality_impact}
                    </span>
                    <span className="text-xs text-slate-500 ml-2">Lead time: {optimizationResult.lead_time_days}d</span>
                  </div>
                </GlassCard>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
