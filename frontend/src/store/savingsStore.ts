import { create } from 'zustand'
import type {
  LubeProfile, BatchSavingsRecord, COAInputs, RebalanceResult,
  SavingsDerivation, PortfolioScenarios, SavingsScenario, ScenarioValues,
} from '@/types'

// ── Seed lube profiles ────────────────────────────────────────────────────────

export const SEED_LUBE_PROFILES: LubeProfile[] = [
  {
    lubeId: 'lp1', lubeName: 'SAE 15W-40 HD', gradeCode: '15W-40',
    targetKV: 14.5, specWindow: 0.3, batchKL: 10, density: 0.876,
    batchesPerYear: 48, additiveCostMT: 2500, baseOilCostMT: 850,
    topupPct: 0.5, currentRftPct: 93.5, hourlyCapacityCost: 28,
    components: [
      { name: 'SN 150 Base Oil', role: 'swing_light', massPct: 42, stdKV: 4.5 },
      { name: 'SN 500 Base Oil', role: 'swing_heavy', massPct: 38, stdKV: 12.0 },
      { name: 'DI Package HD', role: 'additive', massPct: 13, stdKV: 155, stdCa: 1.82, stdZn: 0.95, stdP: 0.087 },
      { name: 'OCP Viscosity Mod', role: 'vm', massPct: 5, stdKV: 1200 },
      { name: 'PPD-7', role: 'fixed', massPct: 2, stdKV: 180 },
    ],
  },
  {
    lubeId: 'lp2', lubeName: 'SAE 20W-50', gradeCode: '20W-50',
    targetKV: 18.5, specWindow: 0.4, batchKL: 12, density: 0.882,
    batchesPerYear: 36, additiveCostMT: 2500, baseOilCostMT: 850,
    topupPct: 0.5, currentRftPct: 95.0, hourlyCapacityCost: 26,
    components: [
      { name: 'SN 150 Base Oil', role: 'swing_light', massPct: 35, stdKV: 4.5 },
      { name: 'SN 600 Base Oil', role: 'swing_heavy', massPct: 45, stdKV: 16.0 },
      { name: 'DI Package 20W50', role: 'additive', massPct: 14, stdKV: 160, stdCa: 1.95, stdZn: 1.02, stdP: 0.091 },
      { name: 'OCP Viscosity Mod', role: 'vm', massPct: 4, stdKV: 1200 },
      { name: 'PPD-7', role: 'fixed', massPct: 2, stdKV: 180 },
    ],
  },
  {
    lubeId: 'lp3', lubeName: 'SAE 5W-30 FS', gradeCode: '5W-30',
    targetKV: 10.5, specWindow: 0.3, batchKL: 8, density: 0.858,
    batchesPerYear: 60, additiveCostMT: 3200, baseOilCostMT: 1100,
    topupPct: 0.4, currentRftPct: 96.5, hourlyCapacityCost: 32,
    components: [
      { name: 'Group III 4cSt', role: 'swing_light', massPct: 48, stdKV: 4.1 },
      { name: 'Group III 6cSt', role: 'swing_heavy', massPct: 30, stdKV: 6.1 },
      { name: 'GF-6 DI Package', role: 'additive', massPct: 12, stdKV: 130, stdCa: 1.22, stdZn: 0.72, stdP: 0.072 },
      { name: 'HSD Viscosity Mod', role: 'vm', massPct: 8, stdKV: 2500 },
      { name: 'PPD-4', role: 'fixed', massPct: 2, stdKV: 160 },
    ],
  },
  {
    lubeId: 'lp4', lubeName: 'Hydraulic ISO 46', gradeCode: 'ISO 46',
    targetKV: 8.5, specWindow: 0.25, batchKL: 15, density: 0.869,
    batchesPerYear: 52, additiveCostMT: 1800, baseOilCostMT: 820,
    topupPct: 0.3, currentRftPct: 97.0, hourlyCapacityCost: 22,
    components: [
      { name: 'SN 100 Base Oil', role: 'swing_light', massPct: 50, stdKV: 3.8 },
      { name: 'SN 300 Base Oil', role: 'swing_heavy', massPct: 38, stdKV: 8.5 },
      { name: 'AW Additive Pkg', role: 'additive', massPct: 9, stdKV: 95, stdZn: 0.055, stdP: 0.050 },
      { name: 'PPD-6', role: 'fixed', massPct: 3, stdKV: 150 },
    ],
  },
  {
    lubeId: 'lp5', lubeName: 'Gear Oil EP 90', gradeCode: '80W-90',
    targetKV: 14.0, specWindow: 0.5, batchKL: 8, density: 0.895,
    batchesPerYear: 30, additiveCostMT: 2200, baseOilCostMT: 870,
    topupPct: 0.5, currentRftPct: 91.0, hourlyCapacityCost: 24,
    components: [
      { name: 'SN 150 Base Oil', role: 'swing_light', massPct: 40, stdKV: 4.5 },
      { name: 'SN 500 Base Oil', role: 'swing_heavy', massPct: 41, stdKV: 12.0 },
      { name: 'GL-5 EP Package', role: 'additive', massPct: 16, stdKV: 200, stdP: 0.12 },
      { name: 'PPD-7', role: 'fixed', massPct: 3, stdKV: 180 },
    ],
  },
  {
    lubeId: 'lp6', lubeName: 'Turbine Oil 32', gradeCode: 'Turbine 32',
    targetKV: 5.5, specWindow: 0.2, batchKL: 10, density: 0.855,
    batchesPerYear: 24, additiveCostMT: 1600, baseOilCostMT: 900,
    topupPct: 0.3, currentRftPct: 97.5, hourlyCapacityCost: 20,
    components: [
      { name: 'Group II 3.5cSt', role: 'swing_light', massPct: 55, stdKV: 3.5 },
      { name: 'Group II 6cSt', role: 'swing_heavy', massPct: 36, stdKV: 6.0 },
      { name: 'Turbine Additive', role: 'additive', massPct: 7, stdKV: 80 },
      { name: 'Antioxidant AO-5', role: 'fixed', massPct: 2, stdKV: 60 },
    ],
  },
]

// ── Savings calculation engine (ported from OmniBlend Discover Calculator v15) ─

const RFT_TARGET = 0.99
const RFT_BASELINE = 0.90
const RFT_RATE_PER_MT = 3.15   // $/MT reference calibration
const BATCH_DAYS_BACK = 30
const SCENARIO_MULTIPLIERS = { conservative: 0.67, expected: 1.00, optimistic: 1.33 }

export function predictBlendKV(profile: LubeProfile, coa: COAInputs): number {
  const targetKV = profile.targetKV
  let perturbation = 0
  for (const comp of profile.components) {
    let actualKV: number | undefined
    if (comp.role === 'swing_heavy') actualKV = coa.swingHeavyActualKV
    else if (comp.role === 'swing_light') actualKV = coa.swingLightActualKV
    else if (comp.role === 'additive') actualKV = coa.additiveActualKV
    if (actualKV !== undefined && comp.stdKV) {
      const pctVariance = (actualKV - comp.stdKV) / comp.stdKV
      const massFrac = comp.massPct / 100
      const sensitivity = comp.role === 'vm' ? 1.5 : comp.role === 'additive' ? 0.6 : 1.0
      perturbation += pctVariance * massFrac * sensitivity
    }
  }
  return targetKV * (1 + perturbation)
}

export function solveRebalance(profile: LubeProfile, coa: COAInputs): RebalanceResult {
  const heavy = profile.components.find(c => c.role === 'swing_heavy')
  const light = profile.components.find(c => c.role === 'swing_light')
  if (!heavy || !light) {
    const predKV = predictBlendKV(profile, coa)
    const inSpec = Math.abs(predKV - profile.targetKV) <= profile.specWindow
    return { applied: false, shiftDelta: 0, predictedKVBefore: predKV, achievedKV: predKV, inSpec, message: inSpec ? '✓ Standard recipe in spec' : '⚠ No swing pair to rebalance' }
  }

  const predKVBefore = predictBlendKV(profile, coa)
  const inSpecBefore = Math.abs(predKVBefore - profile.targetKV) <= profile.specWindow
  if (inSpecBefore) {
    return { applied: false, shiftDelta: 0, predictedKVBefore: predKVBefore, achievedKV: predKVBefore, inSpec: true, message: '✓ Standard recipe lands in spec' }
  }

  // linear scan ±5pp in 0.05pp steps
  let bestShift = 0
  let bestError = Infinity
  for (let shift = -5.0; shift <= 5.0; shift += 0.05) {
    const modCoa: COAInputs = { ...coa }
    // simulate shift effect on blend KV via modified virtual heavy/light KV
    const heavyVirtual = (coa.swingHeavyActualKV ?? heavy.stdKV ?? 12) * (1 + shift * 0.01)
    const lightVirtual = (coa.swingLightActualKV ?? light.stdKV ?? 4.5) * (1 - shift * 0.005)
    modCoa.swingHeavyActualKV = heavyVirtual
    modCoa.swingLightActualKV = lightVirtual
    const kv = predictBlendKV(profile, modCoa)
    const err = Math.abs(kv - profile.targetKV)
    if (err < bestError) {
      bestError = err
      bestShift = shift
    }
  }

  const achievable = bestError < profile.targetKV * 0.02
  if (!achievable) {
    return { applied: false, shiftDelta: 0, predictedKVBefore: predKVBefore, achievedKV: predKVBefore + bestError, inSpec: false, message: '⚠ Out of spec — rebalance engine could not correct' }
  }

  const modCoa: COAInputs = { ...coa }
  modCoa.swingHeavyActualKV = (coa.swingHeavyActualKV ?? heavy.stdKV ?? 12) * (1 + bestShift * 0.01)
  modCoa.swingLightActualKV = (coa.swingLightActualKV ?? light.stdKV ?? 4.5) * (1 - bestShift * 0.005)
  const achievedKV = predictBlendKV(profile, modCoa)
  return { applied: true, shiftDelta: bestShift, predictedKVBefore: predKVBefore, achievedKV, inSpec: true, message: `⚙ Rebalanced: swing shift ${bestShift >= 0 ? '+' : ''}${bestShift.toFixed(2)} pp` }
}

export function calculateBatchSavings(
  profile: LubeProfile,
  coa: COAInputs,
  batchMT: number,
  rebalance: RebalanceResult,
): SavingsDerivation {
  const { additiveCostMT, baseOilCostMT, topupPct } = profile
  const costDiff = additiveCostMT - baseOilCostMT

  // Stream 1: Material Avoidance
  const avoidedRate = (topupPct / 100) * costDiff
  const materialAvoided = rebalance.inSpec ? avoidedRate * batchMT : 0

  // Stream 2: Elemental Potency
  const addComp = profile.components.find(c => c.role === 'additive')
  const additiveMassFrac = addComp ? addComp.massPct / 100 : 0.13
  let elementalSaving = 0
  let avgOverage = 0
  const overages: number[] = []
  if (addComp) {
    if (addComp.stdCa && coa.additiveActualCa) overages.push((coa.additiveActualCa - addComp.stdCa) / addComp.stdCa)
    if (addComp.stdZn && coa.additiveActualZn) overages.push((coa.additiveActualZn - addComp.stdZn) / addComp.stdZn)
    if (addComp.stdP  && coa.additiveActualP)  overages.push((coa.additiveActualP  - addComp.stdP)  / addComp.stdP)
  }
  if (overages.length > 0) {
    avgOverage = overages.reduce((a, b) => a + b, 0) / overages.length
    const reducibleFrac = Math.max(0, Math.min(avgOverage, topupPct / 100))
    elementalSaving = reducibleFrac * additiveMassFrac * batchMT * costDiff
  }

  // Stream 3: RFT Lift
  const currentRft = profile.currentRftPct / 100
  const rftGap = Math.max(0, (RFT_TARGET - currentRft) / (RFT_TARGET - RFT_BASELINE))
  const rftLifted = rebalance.inSpec ? RFT_RATE_PER_MT * batchMT * rftGap : 0

  const totalSaving = materialAvoided + elementalSaving + rftLifted

  const steps = [
    `step 1 · additive cost penalty = $${additiveCostMT.toFixed(0)} − $${baseOilCostMT.toFixed(0)} = $${costDiff.toFixed(0)}/MT`,
    `step 2 · avoided top-up rate = ${topupPct}% × $${costDiff.toFixed(0)} = $${avoidedRate.toFixed(2)}/MT`,
    `step 3a · rebalance saving = $${avoidedRate.toFixed(2)}/MT × ${batchMT.toFixed(1)} MT = $${materialAvoided.toFixed(0)}`,
    `step 3b · elemental potency saving = avg overage ${(avgOverage * 100).toFixed(1)}% → $${elementalSaving.toFixed(0)}`,
    `step 4 · RFT lift = $${RFT_RATE_PER_MT}/MT × ${batchMT.toFixed(1)} MT × ${(rftGap * 100).toFixed(1)}% gap = $${rftLifted.toFixed(0)}`,
    `step 5 · TOTAL = $${materialAvoided.toFixed(0)} + $${elementalSaving.toFixed(0)} + $${rftLifted.toFixed(0)} = $${totalSaving.toFixed(0)}`,
  ]

  return {
    additiveCostDiff: costDiff,
    topupRate: avoidedRate,
    materialAvoidedPerMT: rebalance.inSpec ? avoidedRate : 0,
    materialAvoided,
    avgElementalOverage: avgOverage,
    reducibleFrac: Math.max(0, Math.min(avgOverage, topupPct / 100)),
    elementalSaving,
    rftGap,
    rftLiftPerMT: RFT_RATE_PER_MT,
    rftLifted,
    totalSaving,
    steps,
  }
}

export function computePortfolioScenarios(ledger: BatchSavingsRecord[]): PortfolioScenarios {
  const cutoff = Date.now() - BATCH_DAYS_BACK * 24 * 3600 * 1000
  const recent = ledger.filter(r => new Date(r.batchDate).getTime() >= cutoff)

  const sumSavings = (recs: BatchSavingsRecord[]) => recs.reduce((acc, r) => {
    acc.material  += r.savings.materialAvoided
    acc.elemental += r.savings.elementalSaving
    acc.rft       += r.savings.rftLifted
    acc.total     += r.savings.totalSaving
    acc.capacityHours += 2 // 2 hrs per batch
    return acc
  }, { material: 0, elemental: 0, rft: 0, total: 0, capacityHours: 0, savingsAsMaterialPct: 0 })

  const captured = sumSavings(recent)
  const annualFactor = 365 / BATCH_DAYS_BACK
  const annualMT = SEED_LUBE_PROFILES.reduce((sum, p) => sum + p.batchKL * p.density * p.batchesPerYear, 0)
  const materialAnnualCost = annualMT * (0.875 * 850 + 0.125 * 2500) // blended avg

  const toScenario = (mult: number): ScenarioValues => {
    const base = { ...captured }
    const s: ScenarioValues = {
      material:  base.material * annualFactor * mult,
      elemental: base.elemental * annualFactor * mult,
      rft:       base.rft * annualFactor * mult,
      total:     base.total * annualFactor * mult,
      capacityHours: base.capacityHours * annualFactor * mult,
      savingsAsMaterialPct: 0,
    }
    s.savingsAsMaterialPct = materialAnnualCost > 0 ? (s.total / materialAnnualCost) * 100 : 0
    return s
  }

  const capturedScenario: ScenarioValues = {
    material: captured.material,
    elemental: captured.elemental,
    rft: captured.rft,
    total: captured.total,
    capacityHours: captured.capacityHours,
    savingsAsMaterialPct: materialAnnualCost > 0 ? (captured.total / materialAnnualCost) * 100 : 0,
  }

  return {
    conservative: toScenario(SCENARIO_MULTIPLIERS.conservative),
    expected:     toScenario(SCENARIO_MULTIPLIERS.expected),
    optimistic:   toScenario(SCENARIO_MULTIPLIERS.optimistic),
    capturedLast30d: capturedScenario,
    annualMT,
    lubeCount: new Set(recent.map(r => r.lubeId)).size,
    batchCount: recent.length,
  }
}

// ── Seed batch savings (15 realistic batches over last 30 days) ───────────────

function makeSeedBatch(
  id: string, batchId: string, lubeId: string, lubeName: string,
  batchMT: number, daysAgo: number,
  coa: COAInputs, inSpec: boolean,
): BatchSavingsRecord {
  const profile = SEED_LUBE_PROFILES.find(p => p.lubeId === lubeId)!
  const rebalance = solveRebalance(profile, coa)
  const savings = calculateBatchSavings(profile, coa, batchMT, rebalance)
  const batchDate = new Date(Date.now() - daysAgo * 24 * 3600 * 1000).toISOString().split('T')[0]
  return { id, batchId, lubeId, lubeName, batchMT, batchDate, coaInputs: coa, rebalance, savings, inSpec: rebalance.inSpec, committedAt: batchDate }
}

export const SEED_BATCH_SAVINGS: BatchSavingsRecord[] = [
  makeSeedBatch('sb1',  'B-2026-031', 'lp1', 'SAE 15W-40 HD',     8.76,  2,  { swingHeavyActualKV: 12.4, swingLightActualKV: 4.6, additiveActualKV: 158, additiveActualCa: 1.88, additiveActualZn: 0.98, additiveActualP: 0.090 }, true),
  makeSeedBatch('sb2',  'B-2026-030', 'lp2', 'SAE 20W-50',        10.58, 3,  { swingHeavyActualKV: 16.2, swingLightActualKV: 4.4, additiveActualKV: 163, additiveActualCa: 2.01, additiveActualZn: 1.05, additiveActualP: 0.094 }, true),
  makeSeedBatch('sb3',  'B-2026-029', 'lp3', 'SAE 5W-30 FS',       6.86, 5,  { swingHeavyActualKV: 6.3,  swingLightActualKV: 4.2, additiveActualKV: 133, additiveActualCa: 1.25, additiveActualZn: 0.74, additiveActualP: 0.074 }, true),
  makeSeedBatch('sb4',  'B-2026-028', 'lp4', 'Hydraulic ISO 46',  13.04, 6,  { swingHeavyActualKV: 8.7,  swingLightActualKV: 3.9, additiveActualKV: 97,  additiveActualZn: 0.057, additiveActualP: 0.052 }, true),
  makeSeedBatch('sb5',  'B-2026-027', 'lp1', 'SAE 15W-40 HD',      8.76, 8,  { swingHeavyActualKV: 12.8, swingLightActualKV: 4.7, additiveActualKV: 160, additiveActualCa: 1.90, additiveActualZn: 0.99, additiveActualP: 0.088 }, true),
  makeSeedBatch('sb6',  'B-2026-026', 'lp5', 'Gear Oil EP 90',     7.16, 10, { swingHeavyActualKV: 12.5, swingLightActualKV: 4.6, additiveActualKV: 205, additiveActualP: 0.13 }, true),
  makeSeedBatch('sb7',  'B-2026-025', 'lp2', 'SAE 20W-50',        10.58, 12, { swingHeavyActualKV: 15.8, swingLightActualKV: 4.5, additiveActualKV: 162, additiveActualCa: 1.93, additiveActualZn: 1.00, additiveActualP: 0.089 }, true),
  makeSeedBatch('sb8',  'B-2026-024', 'lp3', 'SAE 5W-30 FS',       6.86, 14, { swingHeavyActualKV: 6.5,  swingLightActualKV: 4.3, additiveActualKV: 135, additiveActualCa: 1.28, additiveActualZn: 0.76, additiveActualP: 0.076 }, true),
  makeSeedBatch('sb9',  'B-2026-023', 'lp6', 'Turbine Oil 32',     8.55, 15, { swingHeavyActualKV: 6.1,  swingLightActualKV: 3.6, additiveActualKV: 82 }, true),
  makeSeedBatch('sb10', 'B-2026-022', 'lp1', 'SAE 15W-40 HD',      8.76, 17, { swingHeavyActualKV: 11.9, swingLightActualKV: 4.4, additiveActualKV: 154, additiveActualCa: 1.84, additiveActualZn: 0.96, additiveActualP: 0.086 }, true),
  makeSeedBatch('sb11', 'B-2026-021', 'lp4', 'Hydraulic ISO 46',  13.04, 20, { swingHeavyActualKV: 8.8,  swingLightActualKV: 4.0, additiveActualZn: 0.058, additiveActualP: 0.053 }, true),
  makeSeedBatch('sb12', 'B-2026-020', 'lp2', 'SAE 20W-50',        10.58, 22, { swingHeavyActualKV: 16.5, swingLightActualKV: 4.6, additiveActualKV: 165, additiveActualCa: 2.05, additiveActualZn: 1.08, additiveActualP: 0.095 }, true),
  makeSeedBatch('sb13', 'B-2026-019', 'lp5', 'Gear Oil EP 90',     7.16, 24, { swingHeavyActualKV: 12.2, swingLightActualKV: 4.5, additiveActualKV: 198, additiveActualP: 0.122 }, true),
  makeSeedBatch('sb14', 'B-2026-018', 'lp3', 'SAE 5W-30 FS',       6.86, 27, { swingHeavyActualKV: 6.4,  swingLightActualKV: 4.15, additiveActualKV: 132, additiveActualCa: 1.24, additiveActualZn: 0.73, additiveActualP: 0.073 }, true),
  makeSeedBatch('sb15', 'B-2026-017', 'lp1', 'SAE 15W-40 HD',      8.76, 29, { swingHeavyActualKV: 12.6, swingLightActualKV: 4.55, additiveActualKV: 157, additiveActualCa: 1.86, additiveActualZn: 0.97, additiveActualP: 0.089 }, true),
]

// ── Helpers ───────────────────────────────────────────────────────────────────

export function formatUSD(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  if (n >= 10_000)    return `$${Math.round(n / 1000)}K`
  return `$${Math.round(n).toLocaleString()}`
}

// ── Store ─────────────────────────────────────────────────────────────────────

interface COADraft {
  lubeId: string
  batchMT: number
  batchDate: string
  coa: COAInputs
  step: number
}

interface SavingsState {
  lubeProfiles: LubeProfile[]
  batchSavings: BatchSavingsRecord[]
  coaDraft: COADraft | null
  activeScenario: SavingsScenario
  portfolioScenarios: PortfolioScenarios | null

  setActiveScenario: (s: SavingsScenario) => void
  setCoaDraft: (draft: COADraft | null) => void
  updateCoaDraft: (partial: Partial<COADraft>) => void
  commitBatch: (record: BatchSavingsRecord) => void
  recomputePortfolio: () => void
}

export const useSavingsStore = create<SavingsState>((set, get) => ({
  lubeProfiles: SEED_LUBE_PROFILES,
  batchSavings: SEED_BATCH_SAVINGS,
  coaDraft: null,
  activeScenario: 'expected',
  portfolioScenarios: computePortfolioScenarios(SEED_BATCH_SAVINGS),

  setActiveScenario: (activeScenario) => set({ activeScenario }),

  setCoaDraft: (coaDraft) => set({ coaDraft }),

  updateCoaDraft: (partial) => set(state => ({
    coaDraft: state.coaDraft ? { ...state.coaDraft, ...partial } : null,
  })),

  commitBatch: (record) => set(state => {
    const batchSavings = [record, ...state.batchSavings]
    return {
      batchSavings,
      portfolioScenarios: computePortfolioScenarios(batchSavings),
      coaDraft: null,
    }
  }),

  recomputePortfolio: () => set(state => ({
    portfolioScenarios: computePortfolioScenarios(state.batchSavings),
  })),
}))
