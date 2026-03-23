import { create } from 'zustand'
import type { AIResponse, Scenario } from '@/types'

interface AIPanelState {
  commandHistory: AIResponse[]
  currentResponse: AIResponse | null
  isProcessing: boolean
  scenarios: Scenario[]
  typingText: string
  addResponse: (response: AIResponse) => void
  setCurrentResponse: (response: AIResponse | null) => void
  setIsProcessing: (processing: boolean) => void
  setScenarios: (scenarios: Scenario[]) => void
  updateScenario: (id: string, updates: Partial<Scenario>) => void
  addScenario: (scenario: Scenario) => void
  setTypingText: (text: string) => void
}

export const useAIPanelStore = create<AIPanelState>((set) => ({
  commandHistory: [],
  currentResponse: null,
  isProcessing: false,
  scenarios: [],
  typingText: '',

  addResponse: (response) =>
    set((state) => ({
      commandHistory: [response, ...state.commandHistory].slice(0, 50),
    })),

  setCurrentResponse: (currentResponse) => set({ currentResponse }),
  setIsProcessing: (isProcessing) => set({ isProcessing }),
  setScenarios: (scenarios) => set({ scenarios }),

  updateScenario: (id, updates) =>
    set((state) => ({
      scenarios: state.scenarios.map((s) =>
        s.id === id ? { ...s, ...updates } : s
      ),
    })),

  addScenario: (scenario) =>
    set((state) => ({ scenarios: [...state.scenarios, scenario] })),

  setTypingText: (typingText) => set({ typingText }),
}))
