import { useEffect, useState } from 'react'
import { TruckIcon, Sparkles, CheckCircle2, Star, Clock, IndianRupee, Package, TrendingDown, ShieldCheck } from 'lucide-react'
import { clsx } from 'clsx'
import { motion, AnimatePresence } from 'framer-motion'
import { GlassCard } from '@/components/ui/GlassCard'
import { useSupplyStore } from '@/store/supplyStore'
import type { Brand, QualityGrade } from '@/types'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts'

// ── Dummy brand data ──────────────────────────────────────────────────────────

const INITIAL_BRANDS: Brand[] = [
  {
    id: 'b1',
    name: 'Indian Oil Corporation',
    region: 'North India',
    is_preferred: true,
    reliability_percent: 98,
    products: [
      { id: 'p1', name: 'Servo Base Oil SN 150', material: 'base_oil', price_per_liter: 95, lead_time_days: 4, quality_grade: 'A+', min_order_liters: 5000 },
      { id: 'p2', name: 'Servo Base Oil SN 500', material: 'base_oil', price_per_liter: 112, lead_time_days: 4, quality_grade: 'A+', min_order_liters: 3000 },
      { id: 'p3', name: 'Servo Gear Additive GA-3', material: 'detergent', price_per_liter: 178, lead_time_days: 6, quality_grade: 'A', min_order_liters: 1000 },
    ],
  },
  {
    id: 'b2',
    name: 'HP Lubricants',
    region: 'West India',
    is_preferred: true,
    reliability_percent: 96,
    products: [
      { id: 'p4', name: 'HP Laal Ghoda Base Oil', material: 'base_oil', price_per_liter: 88, lead_time_days: 5, quality_grade: 'A', min_order_liters: 10000 },
      { id: 'p5', name: 'Hyspin Viscosity Mod. VM-200', material: 'viscosity_modifier', price_per_liter: 298, lead_time_days: 7, quality_grade: 'A+', min_order_liters: 1000 },
      { id: 'p6', name: 'HP Pour Point Depressant PPD-7', material: 'pour_point_depressant', price_per_liter: 412, lead_time_days: 9, quality_grade: 'B+', min_order_liters: 500 },
    ],
  },
  {
    id: 'b3',
    name: 'Castrol India',
    region: 'South India',
    is_preferred: false,
    reliability_percent: 92,
    products: [
      { id: 'p7', name: 'Castrol Base Blend CB-4', material: 'base_oil', price_per_liter: 118, lead_time_days: 6, quality_grade: 'A', min_order_liters: 2000 },
      { id: 'p8', name: 'Castrol Viscosity Mod. VMX-300', material: 'viscosity_modifier', price_per_liter: 325, lead_time_days: 8, quality_grade: 'A+', min_order_liters: 800 },
      { id: 'p9', name: 'Castrol Antioxidant AO-7', material: 'antioxidant', price_per_liter: 645, lead_time_days: 10, quality_grade: 'A+', min_order_liters: 400 },
    ],
  },
  {
    id: 'b4',
    name: 'Shell India',
    region: 'East India',
    is_preferred: false,
    reliability_percent: 94,
    products: [
      { id: 'p10', name: 'Shell Base Oil 150N', material: 'base_oil', price_per_liter: 105, lead_time_days: 5, quality_grade: 'A+', min_order_liters: 2000 },
      { id: 'p11', name: 'Shell Spirax Gear Additive', material: 'detergent', price_per_liter: 420, lead_time_days: 7, quality_grade: 'A', min_order_liters: 600 },
      { id: 'p12', name: 'Shell Antioxidant AX-5', material: 'antioxidant', price_per_liter: 710, lead_time_days: 11, quality_grade: 'A+', min_order_liters: 300 },
    ],
  },
]

const COST_BREAKDOWN = [
  { name: 'Base Oil', value: 62, color: '#3B82F6' },
  { name: 'Visc. Mod.', value: 18, color: '#8B5CF6' },
  { name: 'Antioxidant', value: 10, color: '#EC4899' },
  { name: 'Detergent', value: 7, color: '#F59E0B' },
  { name: 'PPD', value: 3, color: '#10B981' },
]

const PRICE_TREND = [
  { month: 'Oct', base: 92, vm: 290 },
  { month: 'Nov', base: 96, vm: 295 },
  { month: 'Dec', base: 101, vm: 305 },
  { month: 'Jan', base: 98, vm: 288 },
  { month: 'Feb', base: 94, vm: 292 },
  { month: 'Mar', base: 95, vm: 298 },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

const GRADE_COLORS: Record<QualityGrade, string> = {
  'A+': 'text-green-700 bg-green-100/70',
  'A':  'text-green-600 bg-green-100/50',
  'B+': 'text-blue-600 bg-blue-100/50',
  'B':  'text-blue-500 bg-blue-100/40',
  'C':  'text-slate-500 bg-slate-100/50',
}

const MATERIAL_LABELS: Record<string, string> = {
  base_oil: 'Base Oil',
  viscosity_modifier: 'Visc. Modifier',
  antioxidant: 'Antioxidant',
  detergent: 'Detergent',
  pour_point_depressant: 'PPD',
  finished_product: 'Finished',
}

// ── Brand Card ────────────────────────────────────────────────────────────────

function BrandCard({
  brand,
  selectedProducts,
  materialFilter,
  onToggleProduct,
}: {
  brand: Brand
  selectedProducts: string[]
  materialFilter: string
  onToggleProduct: (id: string) => void
}) {
  const visibleProducts = materialFilter === 'all'
    ? brand.products
    : brand.products.filter(p => p.material === materialFilter)

  if (visibleProducts.length === 0) return null

  const anySelected = brand.products.some(p => selectedProducts.includes(p.id))

  return (
    <GlassCard
      animated
      className={clsx('p-4', anySelected && 'border-blue-300/60 bg-white/35')}
      glow={brand.is_preferred ? 'blue' : 'none'}
    >
      {/* Brand header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-slate-600 to-slate-800 flex items-center justify-center flex-shrink-0">
            <TruckIcon className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-bold text-slate-800">{brand.name}</p>
              {brand.is_preferred && <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />}
            </div>
            <p className="text-xs text-slate-400">{brand.region}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
          <span className={clsx('text-xs font-semibold', brand.reliability_percent >= 95 ? 'text-green-600' : 'text-amber-600')}>
            {brand.reliability_percent}% reliable
          </span>
        </div>
      </div>

      {/* Reliability bar */}
      <div className="w-full h-1 rounded-full bg-white/30 mb-3">
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${brand.reliability_percent}%`,
            background: brand.reliability_percent >= 95 ? '#22C55E' : '#F59E0B',
          }}
        />
      </div>

      {/* Product rows */}
      <div className="space-y-2">
        {visibleProducts.map(product => {
          const isSelected = selectedProducts.includes(product.id)
          return (
            <div
              key={product.id}
              onClick={() => onToggleProduct(product.id)}
              className={clsx(
                'flex items-center gap-2 px-3 py-2 rounded-xl cursor-pointer transition-all',
                isSelected
                  ? 'bg-blue-50/70 border border-blue-200/60'
                  : 'bg-white/20 border border-white/20 hover:bg-white/35',
              )}
            >
              {/* Checkbox */}
              <div className={clsx('w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all', isSelected ? 'bg-blue-500 border-blue-500' : 'border-slate-300')}>
                {isSelected && <CheckCircle2 className="w-3 h-3 text-white" />}
              </div>

              {/* Product name + type */}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-slate-700 truncate">{product.name}</p>
                <p className="text-xs text-slate-400">{MATERIAL_LABELS[product.material]}</p>
              </div>

              {/* Grade */}
              <span className={clsx('text-xs px-1.5 py-0.5 rounded-full font-bold flex-shrink-0', GRADE_COLORS[product.quality_grade])}>
                {product.quality_grade}
              </span>

              {/* Price */}
              <div className="flex items-center gap-0.5 flex-shrink-0">
                <IndianRupee className="w-3 h-3 text-green-500" />
                <span className="text-xs font-bold text-slate-700">{product.price_per_liter}/L</span>
              </div>

              {/* Lead time */}
              <div className="flex items-center gap-0.5 flex-shrink-0">
                <Clock className="w-3 h-3 text-blue-400" />
                <span className="text-xs text-slate-500">{product.lead_time_days}d</span>
              </div>

              {/* Min order */}
              <div className="flex items-center gap-0.5 flex-shrink-0">
                <Package className="w-3 h-3 text-purple-400" />
                <span className="text-xs text-slate-500">{(product.min_order_liters / 1000).toFixed(0)}kL</span>
              </div>
            </div>
          )
        })}
      </div>
    </GlassCard>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export function SupplyPage() {
  const {
    brands, selectedProducts, optimizationResult, isOptimizing,
    setBrands, toggleProductSelection, setOptimizationResult, setIsOptimizing,
  } = useSupplyStore()

  const [materialFilter, setMaterialFilter] = useState<string>('all')

  useEffect(() => {
    if (brands.length === 0) setBrands(INITIAL_BRANDS)
  }, [])

  const handleOptimize = () => {
    setIsOptimizing(true)
    setTimeout(() => {
      setOptimizationResult({
        recommended_mix: [
          { supplier_id: 'p4', supplier_name: 'HP Laal Ghoda Base Oil', material: 'base_oil', volume_liters: 30000, cost: 2640000, percentage: 60 },
          { supplier_id: 'p5', supplier_name: 'Hyspin Viscosity Mod. VM-200', material: 'viscosity_modifier', volume_liters: 6000, cost: 1788000, percentage: 20 },
          { supplier_id: 'p9', supplier_name: 'Castrol Antioxidant AO-7', material: 'antioxidant', volume_liters: 2000, cost: 1290000, percentage: 10 },
          { supplier_id: 'p11', supplier_name: 'Shell Spirax Gear Additive', material: 'detergent', volume_liters: 2000, cost: 840000, percentage: 10 },
        ],
        total_cost_current: 9008820,
        total_cost_optimized: 6558000,
        savings_percent: 27.2,
        quality_impact: 'minimal',
        lead_time_days: 9,
      })
      setIsOptimizing(false)
    }, 1800)
  }

  // Collect all unique material types across all brands
  const allMaterials = Array.from(
    new Set(INITIAL_BRANDS.flatMap(b => b.products.map(p => p.material)))
  )

  const totalProducts = brands.flatMap(b => b.products).length

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Material Procurement Hub</h1>
          <p className="text-sm text-slate-500 mt-0.5">{brands.length} brands · {totalProducts} products · {selectedProducts.length} selected</p>
        </div>
        <button
          onClick={handleOptimize}
          disabled={isOptimizing}
          className="btn-primary flex items-center gap-2"
        >
          <Sparkles className="w-4 h-4" />
          {isOptimizing ? 'Optimizing...' : 'AI Optimize Procurement'}
        </button>
      </div>

      {/* Material filter */}
      <div className="flex gap-1.5 flex-wrap">
        <button
          onClick={() => setMaterialFilter('all')}
          className={clsx('px-3 py-1 rounded-full text-xs font-medium transition-all', materialFilter === 'all' ? 'bg-slate-700 text-white' : 'glass-card text-slate-600 hover:bg-white/40')}
        >
          All
        </button>
        {allMaterials.map(m => (
          <button
            key={m}
            onClick={() => setMaterialFilter(m)}
            className={clsx('px-3 py-1 rounded-full text-xs font-medium transition-all', materialFilter === m ? 'bg-blue-500 text-white' : 'glass-card text-slate-600 hover:bg-white/40')}
          >
            {MATERIAL_LABELS[m] ?? m}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Brand cards */}
        <div className="lg:col-span-2 space-y-3">
          {brands.map(brand => (
            <BrandCard
              key={brand.id}
              brand={brand}
              selectedProducts={selectedProducts}
              materialFilter={materialFilter}
              onToggleProduct={toggleProductSelection}
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
            <p className="text-sm font-semibold text-slate-700 mb-3">Price Trends (₹/L)</p>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={PRICE_TREND} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#94A3B8' }} axisLine={false} tickLine={false} domain={[80, 320]} />
                <Tooltip contentStyle={{ background: 'rgba(255,255,255,0.9)', border: 'none', borderRadius: 10, fontSize: 11 }} />
                <Bar dataKey="base" name="Base Oil" fill="#3B82F6" radius={[4, 4, 0, 0]} fillOpacity={0.8} />
                <Bar dataKey="vm" name="Visc. Mod." fill="#8B5CF6" radius={[4, 4, 0, 0]} fillOpacity={0.8} />
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
                    <p className="text-sm font-semibold text-green-700">Optimized Procurement Mix</p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div className="glass-card p-2.5 text-center">
                      <p className="text-xs text-slate-500">Current Cost</p>
                      <p className="text-base font-bold text-slate-700">₹{(optimizationResult.total_cost_current / 100000).toFixed(1)}L</p>
                    </div>
                    <div className="glass-card p-2.5 text-center">
                      <p className="text-xs text-slate-500">Optimized Cost</p>
                      <p className="text-base font-bold text-green-600">₹{(optimizationResult.total_cost_optimized / 100000).toFixed(1)}L</p>
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
                        <span className="text-green-600 font-semibold ml-2">₹{(item.cost / 100000).toFixed(1)}L</span>
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
