import { create } from 'zustand'

export interface SourceChunk {
  doc_id: string
  doc_title: string
  section: string
  excerpt: string
  score: number
}

export interface DocMessage {
  id: string
  role: 'user' | 'assistant'
  text: string
  sources?: SourceChunk[]
  timestamp: string
  processing_time_ms?: number
  total_chunks_searched?: number
  ollama_error?: string | null
}

interface DocAssistantState {
  messages: DocMessage[]
  isLoading: boolean
  typingText: string
  lastSources: SourceChunk[]
  addMessage: (msg: DocMessage) => void
  setLoading: (v: boolean) => void
  setTypingText: (t: string) => void
  setLastSources: (sources: SourceChunk[]) => void
}

export const useDocAssistantStore = create<DocAssistantState>((set) => ({
  messages: [],
  isLoading: false,
  typingText: '',
  lastSources: [],

  addMessage: (msg) =>
    set((state) => ({
      messages: [...state.messages, msg].slice(-100),
    })),

  setLoading: (v) => set({ isLoading: v }),

  setTypingText: (t) => set({ typingText: t }),

  setLastSources: (sources) => set({ lastSources: sources }),
}))
