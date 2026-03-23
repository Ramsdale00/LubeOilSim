import { useEffect, useState } from 'react'
import { FlaskConical, Sparkles, Save, RotateCcw, TrendingUp, AlertCircle, CheckCircle } from 'lucide-react'
import { clsx } from 'clsx'
import { motion, AnimatePresence } from 'framer-motion'
import { GlassCard } from '@/components/ui/GlassCard'
import { useRecipeStore } from '@/store/recipeStore'
import type { Recipe, RecipeIngredients } from '@/types'
import { RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer, Tooltip } from 'recharts'

// ── Dummy data ────────────────────────────────────────────────────────────────

const INITIAL_RECIPES: Recipe[] = [
  { id: 'r1', name: 'Hydraulic ISO 46', description: 'Premium hydraulic fluid, anti-wear formulation', ingredients: { base_oil: 76, viscosity_modifier: 10, antioxidant: 3, detergent: 7, pour_point_depressant: 4 }, target_viscosity: 46, target_flash_point: 220, target_tbn: 6.5, quality_score: 94, cost_per_liter: 1.82, created_at: '2026-01-15', status: 'production' },
  { id: 'r2', name: 'SAE 20W-50', description: 'Heavy duty engine oil, multi-grade', ingredients: { base_oil: 72, viscosity_modifier: 14, antioxidant: 2.5, detergent: 8, pour_point_depressant: 3.5 }, target_viscosity: 165, target_flash_point: 235, target_tbn: 9.0, quality_score: 92, cost_per_liter: 2.14, created_at: '2026-01-20', status: 'production' },
  { id: 'r3', name: 'Gear Oil EP 90', description: 'Extreme pressure gear lubricant', ingredients: { base_oil: 78, viscosity_modifier: 8, antioxidant: 2, detergent: 9, pour_point_depressant: 3 }, target_viscosity: 90, target_flash_point: 210, target_tbn: 5.0, quality_score: 88, cost_per_liter: 1.95, created_at: '2026-02-01', status: 'approved' },
  { id: 'r4', name: 'SAE 5W-30 FS', description: 'Full synthetic low-viscosity formulation', ingredients: { base_oil: 80, viscosity_modifier: 7, antioxidant: 4, detergent: 5, pour_point_depressant: 4 }, target_viscosity: 62, target_flash_point: 240, target_tbn: 8.5, quality_score: 97, cost_per_liter: 3.20, created_at: '2026-02-10', status: 'production' },
  { id: 'r5', name: 'Turbine Oil 32', description: 'Turbine lubricant with oxidation inhibitors', ingredients: { base_oil: 84, viscosity_modifier: 6, antioxidant: 5, detergent: 3, pour_point_depressant: 2 }, target_viscosity: 32, target_flash_point: 228, target_tbn: 4.0, quality_score: 96, cost_per_liter: 2.80, created_at: '2026-02-18', status: 'approved' },
  { id: 'r6', name: 'Compressor Oil 46', description: 'Rotary screw compressor lubricant', ingredients: { base_oil: 82, viscosity_modifier: 9, antioxidant: 4, detergent: 3, pour_point_depressant: 2 }, target_viscosity: 46, target_flash_point: 232, target_tbn: 3.5, quality_score: 91, cost_per_liter: 2.45, created_at: '2026-03-01', status: 'draft' },
]

// ── AI prediction function (simulated) ───────────────────────────────────────

function predictQuality(ing: RecipeIngredients, mode: string): { viscosity: number; flash_point: number; tbn: number; cost: number; off_spec_risk: number } {
  const baseOilFactor = ing.base_oil / 100
  const vmFactor = ing.viscosity_modifier / 100
  const viscosity = 30 + vmFactor * 400 + baseOilFactor * 20 + (Math.random() - 0.5) * 3
  const flash_point = 200 + ing.antioxidant * 3 + baseOilFactor * 30 + (Math.random() - 0.5) * 2
  const tbn = ing.detergent * 1.2 + ing.antioxidant * 0.5 + (Math.random() - 0.5) * 0.5
  const costMultiplier = mode === 'cost' ? 0.85 : mode === 'quality' ? 1.15 : 1.0
  const cost = (1.5 + ing.antioxidant * 0.12 + ing.detergent * 0.08 + ing.viscosity_modifier * 0.05) * costMultiplier
  const off_spec_risk = Math.max(0, Math.min(100, 100 - (ing.base_oil + ing.antioxidant * 2 - vmFactor * 10 + (Math.random() - 0.5) * 5)))
  return { viscosity, flash_point, tbn, cost, off_spec_risk }
}

const AI_SUGGESTIONS: Record<string, { ingredients: RecipeIngredients; note: string }> = {
  cost: {
    ingredients: { base_oil: 78, viscosity_modifier: 9, antioxidant: 2, detergent: 6, pour_point_depressant: 5 },
    note: 'Reduced antioxidant by 1.5% and adjusted VM ratio to lower cost by ~12% while maintaining spec compliance.',
  },
  quality: {
    ingredients: { base_oil: 74, viscosity_modifier: 12, antioxidant: 5, detergent: 6, pour_point_depressant: 3 },
    note: 'Increased antioxidant and VM content for higher thermal stability. Flash point +8°C. Quality score: 98.',
  },
  balanced: {
    ingredients: { base_oil: 76, viscosity_modifier: 11, antioxidant: 3.5, detergent: 6, pour_point_depressant: 3.5 },
    note: 'Balanced formulation — slight VM increase improves viscosity index. Cost delta: +2.4%. Quality: +3 pts.',
  },
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  draft: 'text-slate-500 bg-slate-100/60',
  approved: 'text-blue-600 bg-blue-100/60',
  production: 'text-green-600 bg-green-100/60',
  archived: 'text-slate-400 bg-slate-50/60',
}

function sum(ing: RecipeIngredients) {
  return Object.values(ing).reduce((a, b) => a + b, 0)
}

const INGREDIENT_KEYS: (keyof RecipeIngredients)[] = ['base_oil', 'viscosity_modifier', 'antioxidant', 'detergent', 'pour_point_depressant']

const INGREDIENT_LABELS: Record<keyof RecipeIngredients, string> = {
  base_oil: 'Base Oil',
  viscosity_modifier: 'Viscosity Modifier',
  antioxidant: 'Antioxidant',
  detergent: 'Detergent',
  pour_point_depressant: 'Pour Point Dep.',
}

const INGREDIENT_COLORS = ['#3B82F6', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981']

// ── Component ─────────────────────────────────────────────────────────────────

export function RecipePage() {
  const { recipes, selectedRecipe, draftRecipe, prediction, isPredicting, optimizationMode, setRecipes, selectRecipe, updateDraftIngredient, setDraftRecipe, setPrediction, setIsPredicting, setOptimizationMode, addRecipe } = useRecipeStore()
  const [aiNote, setAiNote] = useState<string | null>(null)
  const [showAINote, setShowAINote] = useState(false)
  const total = sum(draftRecipe)

  // Init
  useEffect(() => {
    if (recipes.length === 0) {
      setRecipes(INITIAL_RECIPES)
      selectRecipe(INITIAL_RECIPES[0])
    }
  }, [])

  // Auto-predict when draft changes
  useEffect(() => {
    setIsPredicting(true)
    const timeout = setTimeout(() => {
      const pred = predictQuality(draftRecipe, optimizationMode)
      setPrediction({
        viscosity: pred.viscosity,
        viscosity_confidence: 0.94,
        flash_point: pred.flash_point,
        flash_point_confidence: 0.91,
        tbn: pred.tbn,
        tbn_confidence: 0.88,
        off_spec_risk: pred.off_spec_risk,
        cost_per_liter: pred.cost,
        timestamp: new Date().toISOString(),
      })
      setIsPredicting(false)
    }, 600)
    return () => clearTimeout(timeout)
  }, [draftRecipe, optimizationMode])

  const handleSelectRecipe = (r: Recipe) => {
    selectRecipe(r)
    setDraftRecipe(r.ingredients)
    setAiNote(null)
    setShowAINote(false)
  }

  const handleAISuggest = () => {
    setIsPredicting(true)
    setShowAINote(false)
    setTimeout(() => {
      const suggestion = AI_SUGGESTIONS[optimizationMode]
      setDraftRecipe(suggestion.ingredients)
      setAiNote(suggestion.note)
      setShowAINote(true)
      setIsPredicting(false)
    }, 1200)
  }

  const handleSaveRecipe = () => {
    const newRecipe: Recipe = {
      id: `r${Date.now()}`,
      name: `Custom Blend ${recipes.length + 1}`,
      description: 'User-created formulation',
      ingredients: { ...draftRecipe },
      target_viscosity: prediction?.viscosity ?? 46,
      target_flash_point: prediction?.flash_point ?? 220,
      target_tbn: prediction?.tbn ?? 5,
      quality_score: Math.round(100 - (prediction?.off_spec_risk ?? 20)),
      cost_per_liter: prediction?.cost_per_liter ?? 2.0,
      created_at: new Date().toISOString().split('T')[0],
      status: 'draft',
    }
    addRecipe(newRecipe)
    selectRecipe(newRecipe)
  }

  const radarData = [
    { metric: 'Viscosity', value: Math.min(100, ((prediction?.viscosity ?? 46) / 200) * 100) },
    { metric: 'Flash Pt', value: Math.min(100, ((prediction?.flash_point ?? 220) / 280) * 100) },
    { metric: 'TBN', value: Math.min(100, ((prediction?.tbn ?? 6) / 15) * 100) },
    { metric: 'Anti-Ox', value: draftRecipe.antioxidant * 15 },
    { metric: 'Stability', value: 100 - (prediction?.off_spec_risk ?? 20) },
  ]

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Recipe Lab</h1>
          <p className="text-sm text-slate-500 mt-0.5">AI-assisted formulation design · {recipes.length} recipes</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleSaveRecipe} className="btn-secondary flex items-center gap-2 text-sm">
            <Save className="w-4 h-4" /> Save Recipe
          </button>
          <button onClick={handleAISuggest} disabled={isPredicting} className="btn-primary flex items-center gap-2 text-sm">
            <Sparkles className="w-4 h-4" />
            {isPredicting ? 'AI Thinking...' : 'AI Suggest Recipe'}
          </button>
        </div>
      </div>

      {/* Optimization mode */}
      <GlassCard className="p-3 flex items-center gap-3">
        <span className="text-xs font-medium text-slate-500 mr-1">Optimize for:</span>
        {(['cost', 'quality', 'balanced'] as const).map((mode) => (
          <button
            key={mode}
            onClick={() => setOptimizationMode(mode)}
            className={clsx(
              'px-4 py-1.5 rounded-xl text-xs font-semibold transition-all capitalize',
              optimizationMode === mode ? 'bg-blue-500 text-white shadow-md' : 'glass-card text-slate-600 hover:bg-white/40'
            )}
          >
            {mode}
          </button>
        ))}
      </GlassCard>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Recipe Library */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide px-1">Recipe Library</p>
          <div className="space-y-1.5 max-h-[60vh] overflow-y-auto pr-1">
            {recipes.map((r) => (
              <GlassCard
                key={r.id}
                hoverable
                onClick={() => handleSelectRecipe(r)}
                className={clsx('p-3 cursor-pointer', selectedRecipe?.id === r.id && 'border-purple-300/60 bg-white/35')}
              >
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-semibold text-slate-700 truncate">{r.name}</p>
                  <span className={clsx('text-xs px-1.5 py-0.5 rounded-full font-medium', STATUS_COLORS[r.status])}>
                    {r.status}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">Score: <b className="text-purple-600">{r.quality_score}</b></span>
                  <span className="text-xs text-slate-500">${r.cost_per_liter.toFixed(2)}/L</span>
                </div>
              </GlassCard>
            ))}
          </div>
        </div>

        {/* Ingredient Sliders */}
        <GlassCard className="p-4 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-semibold text-slate-700">Ingredient Formulation</p>
            <div className={clsx('text-xs font-bold px-2 py-1 rounded-lg', Math.abs(total - 100) < 0.1 ? 'text-green-600 bg-green-100/60' : 'text-red-600 bg-red-100/60')}>
              Total: {total.toFixed(1)}%
            </div>
          </div>

          {/* Stacked bar */}
          <div className="h-4 rounded-full overflow-hidden flex mb-4 gap-0.5">
            {INGREDIENT_KEYS.map((key, i) => (
              <div
                key={key}
                className="h-full transition-all duration-300"
                style={{ width: `${(draftRecipe[key] / total) * 100}%`, background: INGREDIENT_COLORS[i] }}
                title={`${INGREDIENT_LABELS[key]}: ${draftRecipe[key].toFixed(1)}%`}
              />
            ))}
          </div>

          <div className="space-y-4">
            {INGREDIENT_KEYS.map((key, i) => (
              <div key={key}>
                <div className="flex justify-between items-center mb-1.5">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: INGREDIENT_COLORS[i] }} />
                    <span className="text-sm font-medium text-slate-700">{INGREDIENT_LABELS[key]}</span>
                  </div>
                  <span className="text-sm font-bold" style={{ color: INGREDIENT_COLORS[i] }}>{draftRecipe[key].toFixed(1)}%</span>
                </div>
                <input
                  type="range"
                  min={key === 'base_oil' ? 60 : 0}
                  max={key === 'base_oil' ? 95 : 15}
                  step={0.5}
                  value={draftRecipe[key]}
                  onChange={(e) => updateDraftIngredient(key, parseFloat(e.target.value))}
                  className="w-full"
                  style={{ accentColor: INGREDIENT_COLORS[i] }}
                />
                <div className="flex justify-between text-xs text-slate-400 mt-0.5">
                  <span>{key === 'base_oil' ? '60%' : '0%'}</span>
                  <span>{key === 'base_oil' ? '95%' : '15%'}</span>
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={() => {
              if (selectedRecipe) setDraftRecipe(selectedRecipe.ingredients)
            }}
            className="btn-secondary flex items-center gap-2 mt-4 text-xs"
          >
            <RotateCcw className="w-3 h-3" /> Reset to Original
          </button>
        </GlassCard>

        {/* AI Predictions */}
        <div className="space-y-3">
          <GlassCard className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <FlaskConical className="w-4 h-4 text-purple-500" />
              <p className="text-sm font-semibold text-slate-700">AI Predictions</p>
              {isPredicting && <div className="ml-auto w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />}
            </div>

            <div className="space-y-3">
              {[
                { label: 'Viscosity', value: prediction?.viscosity, unit: 'cSt', conf: prediction?.viscosity_confidence, color: '#3B82F6' },
                { label: 'Flash Point', value: prediction?.flash_point, unit: '°C', conf: prediction?.flash_point_confidence, color: '#F59E0B' },
                { label: 'TBN', value: prediction?.tbn, unit: 'mg KOH/g', conf: prediction?.tbn_confidence, color: '#10B981' },
              ].map(({ label, value, unit, conf, color }) => (
                <div key={label}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-slate-500 font-medium">{label}</span>
                    <div className="flex items-center gap-1">
                      <span className="text-sm font-bold" style={{ color }}>{value?.toFixed(1) ?? '—'}</span>
                      <span className="text-xs text-slate-400">{unit}</span>
                    </div>
                  </div>
                  <div className="w-full h-1 rounded-full bg-white/30">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${(conf ?? 0) * 100}%`, background: color }}
                    />
                  </div>
                  <p className="text-xs text-slate-400 text-right mt-0.5">{((conf ?? 0) * 100).toFixed(0)}% confidence</p>
                </div>
              ))}
            </div>

            <div className="mt-3 p-3 rounded-xl glass-card">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500 font-medium">Cost / Liter</span>
                <span className="text-base font-bold text-green-600">${prediction?.cost_per_liter.toFixed(2) ?? '—'}</span>
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-xs text-slate-500 font-medium">Off-Spec Risk</span>
                <span className={clsx('text-base font-bold', (prediction?.off_spec_risk ?? 0) < 30 ? 'text-green-600' : (prediction?.off_spec_risk ?? 0) < 70 ? 'text-amber-600' : 'text-red-600')}>
                  {prediction?.off_spec_risk.toFixed(0) ?? '—'}%
                </span>
              </div>
            </div>
          </GlassCard>

          {/* Radar */}
          <GlassCard className="p-4">
            <p className="text-xs font-medium text-slate-500 mb-2">Quality Profile</p>
            <ResponsiveContainer width="100%" height={180}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="rgba(148,163,184,0.3)" />
                <PolarAngleAxis dataKey="metric" tick={{ fontSize: 10, fill: '#94A3B8' }} />
                <Radar name="Recipe" dataKey="value" stroke="#8B5CF6" fill="#8B5CF6" fillOpacity={0.2} />
              </RadarChart>
            </ResponsiveContainer>
          </GlassCard>

          {/* AI Note */}
          <AnimatePresence>
            {showAINote && aiNote && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <GlassCard className="p-3" glow="purple">
                  <div className="flex items-start gap-2">
                    <Sparkles className="w-4 h-4 text-purple-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-semibold text-purple-600 mb-1">AI Recommendation</p>
                      <p className="text-xs text-slate-600 leading-relaxed">{aiNote}</p>
                    </div>
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
