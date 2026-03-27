import { useEffect, useRef, useState } from 'react'
import {
  BookOpen,
  Send,
  FileText,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  Database,
  Search,
} from 'lucide-react'
import { clsx } from 'clsx'
import { motion, AnimatePresence } from 'framer-motion'
import { GlassCard } from '@/components/ui/GlassCard'
import { useDocAssistantStore, type SourceChunk } from '@/store/docAssistantStore'
import axios from 'axios'

// ── Quick prompts from D0 RAG demo guide ──────────────────────────────────────

const QUICK_PROMPTS: { label: string; docTag: string; color: string; query: string }[] = [
  // D1 — Batch Manufacturing Record
  { label: 'What ingredients are in the 15W-40 batch?', docTag: 'D1', color: 'bg-blue-100 text-blue-700 border-blue-200', query: 'What ingredients and quantities are used in the 15W-40 batch manufacturing record?' },
  { label: 'Who approved the batch record?', docTag: 'D1', color: 'bg-blue-100 text-blue-700 border-blue-200', query: 'Who approved the batch manufacturing record? List the approval chain.' },
  { label: 'What QC parameters were tested in the batch?', docTag: 'D1', color: 'bg-blue-100 text-blue-700 border-blue-200', query: 'What quality control parameters and results are recorded in the batch record?' },
  // D2 — SCADA / OPC-UA
  { label: 'What OPC-UA tags monitor temperature?', docTag: 'D2', color: 'bg-cyan-100 text-cyan-700 border-cyan-200', query: 'What OPC-UA tags are used for temperature monitoring in the SCADA system?' },
  { label: 'How does SCADA integrate with SAP?', docTag: 'D2', color: 'bg-cyan-100 text-cyan-700 border-cyan-200', query: 'How does the SCADA system integrate with SAP? Describe the integration specification.' },
  { label: 'What are the alarm priorities?', docTag: 'D2', color: 'bg-cyan-100 text-cyan-700 border-cyan-200', query: 'What are the alarm priorities and required actions in the SCADA alarm table?' },
  // D3 — Cybersecurity
  { label: 'What are the highest-risk cyber threats?', docTag: 'D3', color: 'bg-red-100 text-red-700 border-red-200', query: 'What are the highest likelihood and consequence cybersecurity risks in the risk register?' },
  { label: 'What security level targets apply?', docTag: 'D3', color: 'bg-red-100 text-red-700 border-red-200', query: 'What are the IEC 62443 security level targets for the control zone?' },
  // D4 — Process Map
  { label: 'What KPI improvements does the To-Be process deliver?', docTag: 'D4', color: 'bg-green-100 text-green-700 border-green-200', query: 'What KPI improvements are shown in the To-Be process map compared to As-Is?' },
  { label: 'What changes are made in the blending step?', docTag: 'D4', color: 'bg-green-100 text-green-700 border-green-200', query: 'What process changes are made in the blending process area in the To-Be design?' },
  // D5 — QC Procedures
  { label: 'What is the viscosity spec for 15W-40?', docTag: 'D5', color: 'bg-amber-100 text-amber-700 border-amber-200', query: 'What is the viscosity specification for 15W-40 grade lubricant?' },
  { label: 'How is flash point measured?', docTag: 'D5', color: 'bg-amber-100 text-amber-700 border-amber-200', query: 'What are the step-by-step procedures for flash point testing?' },
  { label: 'How is TBN calculated?', docTag: 'D5', color: 'bg-amber-100 text-amber-700 border-amber-200', query: 'What is the procedure and calculation method for TBN (Total Base Number) testing?' },
  // D6 — LIMS
  { label: 'What are the must-have LIMS requirements?', docTag: 'D6', color: 'bg-purple-100 text-purple-700 border-purple-200', query: 'What are the Must-Have (MoSCoW) functional requirements for the LIMS system?' },
  { label: 'How does LIMS integrate with SAP QM?', docTag: 'D6', color: 'bg-purple-100 text-purple-700 border-purple-200', query: 'How does the LIMS system integrate with SAP QM for quality management data flow?' },
  // Cross-domain
  { label: 'Full QC workflow from blend to approval?', docTag: 'CROSS', color: 'bg-slate-100 text-slate-700 border-slate-200', query: 'What is the complete quality control workflow from blend initiation through laboratory testing to final approval?' },
]

// ── Document metadata for status panel ───────────────────────────────────────

const DOC_REGISTRY = [
  { id: 'D0', title: 'RAG Demo Guide', desc: '88 sample questions across all domains', color: 'text-slate-600' },
  { id: 'D1', title: 'Batch Manufacturing Record', desc: '15W-40 formula, 8-ingredient log, QC results', color: 'text-blue-600' },
  { id: 'D2', title: 'SCADA / OPC-UA Tag Register', desc: '12-tag I/O table, alarm table, SAP integration', color: 'text-cyan-600' },
  { id: 'D3', title: 'Cybersecurity Risk Assessment', desc: 'IEC 62443, 8-risk register, zone model', color: 'text-red-600' },
  { id: 'D4', title: 'As-Is / To-Be Process Map', desc: '3 process areas, KPI impact table', color: 'text-green-600' },
  { id: 'D5', title: 'QC Test Procedures & Specs', desc: '6-grade spec matrix, 3 full SOPs', color: 'text-amber-600' },
  { id: 'D6', title: 'LIMS Requirements Spec', desc: '12 functional reqs, 5-instrument integration', color: 'text-purple-600' },
]

const DOC_TAG_COLOR: Record<string, string> = {
  D0: 'bg-slate-200 text-slate-700',
  D1: 'bg-blue-200 text-blue-800',
  D2: 'bg-cyan-200 text-cyan-800',
  D3: 'bg-red-200 text-red-800',
  D4: 'bg-green-200 text-green-800',
  D5: 'bg-amber-200 text-amber-800',
  D6: 'bg-purple-200 text-purple-800',
}

// ── API call ──────────────────────────────────────────────────────────────────

interface DocStatusEntry {
  doc_id: string
  doc_title: string
  loaded: boolean
  chunk_count: number
}

async function queryDocuments(query: string) {
  const res = await axios.post('/api/v1/ai/doc-query', { query })
  const data = res.data
  if (typeof data?.answer !== 'string' || !Array.isArray(data?.sources)) {
    throw new Error('Invalid response from API')
  }
  return data as {
    query: string
    answer: string
    sources: SourceChunk[]
    processing_time_ms: number
    total_chunks_searched: number
  }
}

async function fetchDocStatus(): Promise<DocStatusEntry[]> {
  const res = await axios.get('/api/v1/ai/doc-status')
  return Array.isArray(res.data?.docs) ? (res.data.docs as DocStatusEntry[]) : []
}

// ── Component ─────────────────────────────────────────────────────────────────

export function DocumentAssistantPage() {
  const { messages, isLoading, typingText, lastSources, addMessage, setLoading, setTypingText, setLastSources } =
    useDocAssistantStore()

  const [input, setInput] = useState('')
  const [docStatuses, setDocStatuses] = useState<DocStatusEntry[]>([])
  const [statusLoading, setStatusLoading] = useState(true)
  const [statusError, setStatusError] = useState<string | null>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Load doc statuses + boot message
  useEffect(() => {
    setStatusLoading(true)
    setStatusError(null)
    fetchDocStatus()
      .then((docs) => {
        setDocStatuses(docs)
      })
      .catch(() => {
        setDocStatuses([])
        setStatusError('Unable to load document repository status. Check backend connectivity.')
      })
      .finally(() => setStatusLoading(false))

    if (messages.length === 0) {
      addMessage({
        id: 'boot',
        role: 'assistant',
        text: 'Document Assistant online. I can search across 7 knowledge-base documents (D0–D6) covering batch manufacturing, SCADA/OPC-UA, cybersecurity, process maps, QC procedures, and LIMS requirements. Ask a question or use a quick prompt below.',
        timestamp: new Date().toISOString(),
      })
    }
  }, [])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, typingText])

  const handleSend = async (cmd?: string) => {
    const query = (cmd ?? input).trim()
    if (!query || isLoading) return
    setInput('')
    setLoading(true)
    setTypingText('')

    // Add user message immediately
    addMessage({
      id: `u-${Date.now()}`,
      role: 'user',
      text: query,
      timestamp: new Date().toISOString(),
    })

    try {
      const result = await queryDocuments(query)

      // Simulate typing effect for the answer
      const fullText = result.answer
      let i = 0
      const interval = setInterval(() => {
        i += 4
        setTypingText(fullText.slice(0, i))
        if (i >= fullText.length) {
          clearInterval(interval)
          setTypingText('')
          setLastSources(result.sources)
          addMessage({
            id: `a-${Date.now()}`,
            role: 'assistant',
            text: result.answer,
            sources: result.sources,
            timestamp: new Date().toISOString(),
            processing_time_ms: result.processing_time_ms,
            total_chunks_searched: result.total_chunks_searched,
          })
          setLoading(false)
        }
      }, 18)
    } catch {
      setTypingText('')
      addMessage({
        id: `err-${Date.now()}`,
        role: 'assistant',
        text: 'Could not reach the backend. Make sure the API server is running at localhost:8000.',
        timestamp: new Date().toISOString(),
      })
      setLoading(false)
    }
  }

  const safeDocStatuses = docStatuses ?? []
  const loadedCount = safeDocStatuses.filter((d) => d.loaded).length

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Document Assistant</h1>
          <p className="text-sm text-slate-500 mt-0.5">Keyword search across D0–D6 knowledge-base documents</p>
        </div>
        <div className="flex items-center gap-2 glass-card px-3 py-2">
          <BookOpen className="w-4 h-4 text-teal-500" />
          <span className="text-xs font-medium text-slate-600">
            {statusLoading ? 'Loading...' : `${loadedCount} / ${DOC_REGISTRY.length} Docs Loaded`}
          </span>
          <div className={clsx('w-2 h-2 rounded-full', loadedCount > 0 ? 'bg-teal-400 animate-pulse' : 'bg-slate-300')} />
        </div>
      </div>

      {statusError && (
        <div className="glass-card p-3 border border-red-200 bg-red-50 text-red-700 text-sm rounded-lg">
          {statusError}
        </div>
      )}

      <GlassCard className="p-4">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h2 className="text-lg font-bold text-slate-800">Document Repository</h2>
            <p className="text-xs text-slate-500">View all injected knowledge documents and their ingest status.</p>
          </div>
          <span className="text-xs font-medium text-slate-600">Total chunks: {safeDocStatuses.reduce((acc, d) => acc + d.chunk_count, 0)}</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
          {DOC_REGISTRY.map((doc) => {
            const status = safeDocStatuses.find((s) => s.doc_id === doc.id)
            return (
              <div key={doc.id} className="glass-card p-2 rounded-lg border border-white/30">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold">{doc.id}</span>
                  <span className={clsx('text-[10px] font-bold px-1.5 py-0.5 rounded', status?.loaded ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500')}>
                    {status?.loaded ? 'Loaded' : 'Missing'}
                  </span>
                </div>
                <p className="text-xs text-slate-700 font-semibold">{doc.title}</p>
                <p className="text-[10px] text-slate-500 mt-1">{doc.desc}</p>
                <p className="text-[10px] text-slate-500 mt-2">Chunks: {status?.chunk_count ?? 0}</p>
              </div>
            )
          })}
        </div>
      </GlassCard>

      {safeDocStatuses.length === 0 && !statusLoading && (
        <GlassCard className="p-4 bg-slate-50 border border-slate-200">
          <p className="text-sm font-medium text-slate-700">Document repository is empty.</p>
          <p className="text-xs text-slate-500 mt-1">Add D0-D6 `.docx` files to `backend/app/data` or run seed data, then reload.</p>
        </GlassCard>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: Chat + prompts */}
        <div className="lg:col-span-2 flex flex-col gap-3">

          {/* Quick prompts */}
          <GlassCard className="p-3">
            <div className="flex items-center gap-2 mb-2">
              <Search className="w-3.5 h-3.5 text-slate-400" />
              <p className="text-xs font-medium text-slate-500">Quick Prompts — from D0 Sample Questions</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-52 overflow-y-auto pr-1">
              {QUICK_PROMPTS.map(({ label, docTag, color, query }) => (
                <button
                  key={label}
                  onClick={() => handleSend(query)}
                  disabled={isLoading}
                  className={clsx(
                    'flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-left text-xs font-medium transition-all',
                    'hover:brightness-95 disabled:opacity-50',
                    color,
                  )}
                >
                  <span className={clsx('text-xs font-bold px-1 py-0.5 rounded', DOC_TAG_COLOR[docTag] ?? 'bg-slate-200 text-slate-700')}>
                    {docTag}
                  </span>
                  <span className="line-clamp-1">{label}</span>
                  <ChevronRight className="w-3 h-3 ml-auto flex-shrink-0 opacity-60" />
                </button>
              ))}
            </div>
          </GlassCard>

          {/* Chat history */}
          <GlassCard className="p-4 flex-1 min-h-0">
            <div className="space-y-4 max-h-[460px] overflow-y-auto pr-1">
              <AnimatePresence initial={false}>
                {messages.map((msg) => (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-1"
                  >
                    {msg.role === 'user' ? (
                      <div className="flex justify-end">
                        <div className="glass-card px-3 py-2 max-w-sm">
                          <p className="text-xs text-slate-700">{msg.text}</p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start gap-2.5">
                        <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-600 flex items-center justify-center flex-shrink-0">
                          <BookOpen className="w-3.5 h-3.5 text-white" />
                        </div>
                        <div className="glass-card p-3 flex-1">
                          {msg.id === 'boot' && (
                            <p className="text-xs font-semibold text-teal-600 mb-1">Document Assistant</p>
                          )}
                          <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">{msg.text}</p>

                          {/* Source tags */}
                          {msg.sources && msg.sources.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {msg.sources.map((s, i) => (
                                <span
                                  key={i}
                                  className={clsx(
                                    'text-xs px-1.5 py-0.5 rounded font-medium',
                                    DOC_TAG_COLOR[s.doc_id] ?? 'bg-slate-200 text-slate-700'
                                  )}
                                >
                                  {s.doc_id}: {s.section.length > 30 ? s.section.slice(0, 28) + '…' : s.section}
                                </span>
                              ))}
                            </div>
                          )}

                          {msg.processing_time_ms !== undefined && (
                            <p className="text-xs text-slate-300 mt-1.5">
                              {msg.processing_time_ms}ms · {msg.total_chunks_searched} chunks searched
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </motion.div>
                ))}

                {/* Typing effect */}
                {isLoading && typingText && (
                  <motion.div key="typing" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex items-start gap-2.5">
                    <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-600 flex items-center justify-center flex-shrink-0">
                      <BookOpen className="w-3.5 h-3.5 text-white" />
                    </div>
                    <div className="glass-card p-3 flex-1">
                      <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">
                        {typingText}
                        <span className="inline-block w-1 h-3 bg-teal-500 ml-0.5 animate-pulse" />
                      </p>
                    </div>
                  </motion.div>
                )}

                {isLoading && !typingText && (
                  <motion.div key="thinking" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-600 flex items-center justify-center flex-shrink-0">
                      <BookOpen className="w-3.5 h-3.5 text-white animate-pulse" />
                    </div>
                    <div className="glass-card px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex gap-1">
                          {[0, 1, 2].map((i) => (
                            <div key={i} className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                          ))}
                        </div>
                        <span className="text-xs text-slate-400">Searching documents...</span>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              <div ref={chatEndRef} />
            </div>

            {/* Input */}
            <div className="flex items-end gap-2 mt-4 pt-3 border-t border-white/20">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleSend()
                  }
                }}
                placeholder="Ask anything about the plant documents… (e.g. 'What is the viscosity spec for 15W-40?')"
                rows={2}
                className="flex-1 resize-none glass-card px-3 py-2 text-sm text-slate-700 placeholder-slate-400 outline-none focus:border-teal-300/60 bg-white/10"
                disabled={isLoading}
              />
              <button
                onClick={() => handleSend()}
                disabled={isLoading || !input.trim()}
                className={clsx(
                  'p-3 rounded-xl transition-all',
                  input.trim() && !isLoading
                    ? 'bg-gradient-to-br from-teal-500 to-cyan-600 text-white shadow-lg hover:shadow-teal-300/30'
                    : 'bg-white/20 text-slate-400'
                )}
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </GlassCard>
        </div>

        {/* Right: Doc status + last sources */}
        <div className="space-y-4">
          {/* Knowledge Base Documents */}
          <GlassCard className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Database className="w-4 h-4 text-teal-500" />
              <p className="text-sm font-semibold text-slate-700">Knowledge Base</p>
            </div>
            <div className="space-y-2">
              {DOC_REGISTRY.map((doc) => {
                const status = docStatuses.find((s) => s.doc_id === doc.id)
                const loaded = status?.loaded ?? false
                const chunks = status?.chunk_count ?? 0

                return (
                  <div key={doc.id} className="glass-card p-2.5 flex items-start gap-2">
                    <span className={clsx('text-xs font-bold px-1.5 py-0.5 rounded flex-shrink-0 mt-0.5', DOC_TAG_COLOR[doc.id])}>
                      {doc.id}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className={clsx('text-xs font-medium truncate', doc.color)}>{doc.title}</p>
                      <p className="text-xs text-slate-400 truncate">{doc.desc}</p>
                      {!statusLoading && (
                        <p className="text-xs text-slate-300 mt-0.5">
                          {loaded ? `${chunks} chunks` : 'Not loaded'}
                        </p>
                      )}
                    </div>
                    <div className="flex-shrink-0">
                      {statusLoading ? (
                        <div className="w-3.5 h-3.5 rounded-full bg-slate-200 animate-pulse" />
                      ) : loaded ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                      ) : (
                        <AlertCircle className="w-3.5 h-3.5 text-slate-300" />
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </GlassCard>

          {/* Retrieved Sources from last query */}
          {lastSources.length > 0 && (
            <GlassCard className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <FileText className="w-4 h-4 text-slate-500" />
                <p className="text-sm font-semibold text-slate-700">Retrieved Sources</p>
              </div>
              <div className="space-y-2">
                {lastSources.map((src, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: 8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.06 }}
                    className="glass-card p-2.5"
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className={clsx('text-xs font-bold px-1 py-0.5 rounded', DOC_TAG_COLOR[src.doc_id])}>
                        {src.doc_id}
                      </span>
                      <span className="text-xs text-slate-500 truncate">{src.section.length > 28 ? src.section.slice(0, 26) + '…' : src.section}</span>
                      <span className="ml-auto text-xs text-slate-300">{(src.score * 100).toFixed(0)}%</span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed line-clamp-3">{src.excerpt}</p>
                  </motion.div>
                ))}
              </div>
            </GlassCard>
          )}
        </div>
      </div>
    </div>
  )
}
