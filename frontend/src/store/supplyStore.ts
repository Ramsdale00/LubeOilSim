import { create } from 'zustand'
import type { Supplier, OptimizationResult } from '@/types'

export interface CostBreakdownItem {
  name: string
  material: string
  cost: number
  volume: number
  percentage: number
  color: string
}

interface SupplyState {
  suppliers: Supplier[]
  selectedSuppliers: string[]
  optimizationResult: OptimizationResult | null
  costBreakdown: CostBreakdownItem[]
  isOptimizing: boolean
  setSuppliers: (suppliers: Supplier[]) => void
  toggleSupplierSelection: (id: string) => void
  setOptimizationResult: (result: OptimizationResult | null) => void
  setCostBreakdown: (breakdown: CostBreakdownItem[]) => void
  setIsOptimizing: (optimizing: boolean) => void
  updateSupplier: (id: string, updates: Partial<Supplier>) => void
}

export const useSupplyStore = create<SupplyState>((set) => ({
  suppliers: [],
  selectedSuppliers: [],
  optimizationResult: null,
  costBreakdown: [],
  isOptimizing: false,

  setSuppliers: (suppliers) => set({ suppliers }),

  toggleSupplierSelection: (id) =>
    set((state) => ({
      selectedSuppliers: state.selectedSuppliers.includes(id)
        ? state.selectedSuppliers.filter((s) => s !== id)
        : [...state.selectedSuppliers, id],
    })),

  setOptimizationResult: (optimizationResult) => set({ optimizationResult }),
  setCostBreakdown: (costBreakdown) => set({ costBreakdown }),
  setIsOptimizing: (isOptimizing) => set({ isOptimizing }),

  updateSupplier: (id, updates) =>
    set((state) => ({
      suppliers: state.suppliers.map((s) =>
        s.id === id ? { ...s, ...updates } : s
      ),
    })),
}))
