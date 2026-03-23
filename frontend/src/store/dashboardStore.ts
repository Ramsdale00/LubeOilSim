import { create } from 'zustand'
import type { KPISnapshot, EventLog, TimelineEntry, HeatmapCell } from '@/types'

interface DashboardState {
  kpis: KPISnapshot | null
  events: EventLog[]
  timeline: TimelineEntry[]
  energyHeatmap: HeatmapCell[]
  setKPIs: (kpis: KPISnapshot) => void
  appendEvent: (event: EventLog) => void
  setEvents: (events: EventLog[]) => void
  setTimeline: (timeline: TimelineEntry[]) => void
  setEnergyHeatmap: (heatmap: HeatmapCell[]) => void
  acknowledgeEvent: (id: string) => void
}

export const useDashboardStore = create<DashboardState>((set) => ({
  kpis: null,
  events: [],
  timeline: [],
  energyHeatmap: [],

  setKPIs: (kpis) => set({ kpis }),

  appendEvent: (event) =>
    set((state) => ({
      events: [event, ...state.events].slice(0, 100),
    })),

  setEvents: (events) => set({ events }),
  setTimeline: (timeline) => set({ timeline }),
  setEnergyHeatmap: (energyHeatmap) => set({ energyHeatmap }),

  acknowledgeEvent: (id) =>
    set((state) => ({
      events: state.events.map((e) =>
        e.id === id ? { ...e, acknowledged: true } : e
      ),
    })),
}))
