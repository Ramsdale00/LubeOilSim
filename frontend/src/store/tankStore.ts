import { create } from 'zustand'
import type { Tank } from '@/types'

interface TankState {
  tanks: Tank[]
  selectedTank: Tank | null
  setTanks: (tanks: Tank[]) => void
  updateTank: (id: string, updates: Partial<Tank>) => void
  selectTank: (tank: Tank | null) => void
  updateTankPosition: (id: string, x: number, y: number) => void
}

export const useTankStore = create<TankState>((set) => ({
  tanks: [],
  selectedTank: null,

  setTanks: (tanks) => set({ tanks }),

  updateTank: (id, updates) =>
    set((state) => ({
      tanks: state.tanks.map((t) => (t.id === id ? { ...t, ...updates } : t)),
      selectedTank:
        state.selectedTank?.id === id
          ? { ...state.selectedTank, ...updates }
          : state.selectedTank,
    })),

  selectTank: (tank) => set({ selectedTank: tank }),

  updateTankPosition: (id, x, y) =>
    set((state) => ({
      tanks: state.tanks.map((t) =>
        t.id === id ? { ...t, position_x: x, position_y: y } : t
      ),
    })),
}))
