import { create } from 'zustand'
import type { BlendBatch } from '@/types'

interface BlendState {
  batches: BlendBatch[]
  activeBatch: BlendBatch | null
  pipelineActive: boolean
  setBatches: (batches: BlendBatch[]) => void
  updateBatch: (id: string, updates: Partial<BlendBatch>) => void
  setActiveBatch: (batch: BlendBatch | null) => void
  setPipelineActive: (active: boolean) => void
  addBatch: (batch: BlendBatch) => void
}

export const useBlendStore = create<BlendState>((set) => ({
  batches: [],
  activeBatch: null,
  pipelineActive: false,

  setBatches: (batches) => set({ batches }),

  updateBatch: (id, updates) =>
    set((state) => ({
      batches: state.batches.map((b) => (b.id === id ? { ...b, ...updates } : b)),
      activeBatch:
        state.activeBatch?.id === id
          ? { ...state.activeBatch, ...updates }
          : state.activeBatch,
    })),

  setActiveBatch: (batch) => set({ activeBatch: batch }),

  setPipelineActive: (active) => set({ pipelineActive: active }),

  addBatch: (batch) =>
    set((state) => ({ batches: [batch, ...state.batches] })),
}))
