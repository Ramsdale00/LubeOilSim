import { create } from 'zustand'
import type { QualityPrediction } from '@/types'

export interface QualityRecommendation {
  id: string
  text: string
  type: 'ingredient' | 'temperature' | 'process' | 'supplier'
  impact: 'low' | 'medium' | 'high'
  applied: boolean
}

export interface ComparisonRow {
  batch_id: string
  batch_name: string
  parameter: string
  target: number
  predicted: number
  actual: number | null
  delta: number | null
  status: 'on_spec' | 'off_spec' | 'pending'
  unit: string
}

interface QualityState {
  predictions: Array<QualityPrediction & { index: number }>
  currentRisk: number
  recommendations: QualityRecommendation[]
  comparisonRows: ComparisonRow[]
  appendPrediction: (prediction: QualityPrediction) => void
  setRisk: (risk: number) => void
  setRecommendations: (recs: QualityRecommendation[]) => void
  applyRecommendation: (id: string) => void
  setComparisonRows: (rows: ComparisonRow[]) => void
}

export const useQualityStore = create<QualityState>((set) => ({
  predictions: [],
  currentRisk: 15,
  recommendations: [],
  comparisonRows: [],

  appendPrediction: (prediction) =>
    set((state) => {
      const newPredictions = [
        ...state.predictions,
        { ...prediction, index: state.predictions.length },
      ].slice(-60)
      return { predictions: newPredictions }
    }),

  setRisk: (currentRisk) => set({ currentRisk }),

  setRecommendations: (recommendations) => set({ recommendations }),

  applyRecommendation: (id) =>
    set((state) => ({
      recommendations: state.recommendations.map((r) =>
        r.id === id ? { ...r, applied: true } : r
      ),
    })),

  setComparisonRows: (comparisonRows) => set({ comparisonRows }),
}))
