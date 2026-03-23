import { create } from 'zustand'

type TimeAcceleration = 1 | 5 | 10

interface SimulationState {
  timeAcceleration: TimeAcceleration
  isRunning: boolean
  tickCount: number
  lastTick: number
  simulatedTime: Date
  setTimeAcceleration: (acceleration: TimeAcceleration) => void
  toggleRunning: () => void
  recordTick: () => void
  setSimulatedTime: (time: Date) => void
}

export const useSimulationStore = create<SimulationState>((set) => ({
  timeAcceleration: 1,
  isRunning: true,
  tickCount: 0,
  lastTick: Date.now(),
  simulatedTime: new Date(),

  setTimeAcceleration: (acceleration) =>
    set({ timeAcceleration: acceleration }),

  toggleRunning: () =>
    set((state) => ({ isRunning: !state.isRunning })),

  recordTick: () =>
    set((state) => ({
      tickCount: state.tickCount + 1,
      lastTick: Date.now(),
      simulatedTime: new Date(
        state.simulatedTime.getTime() + state.timeAcceleration * 1000
      ),
    })),

  setSimulatedTime: (time) => set({ simulatedTime: time }),
}))
