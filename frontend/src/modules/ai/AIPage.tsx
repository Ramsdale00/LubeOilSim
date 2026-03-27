import { useEffect, useRef, useState } from 'react'
import { Bot, Send, Zap, Play, BarChart2, FlaskConical, TruckIcon, CheckCircle2, Clock, AlertTriangle } from 'lucide-react'
import { clsx } from 'clsx'
import { motion, AnimatePresence } from 'framer-motion'
import { GlassCard } from '@/components/ui/GlassCard'
import { useAIPanelStore } from '@/store/aiPanelStore'
import type { AIResponse, Scenario } from '@/types'
import { RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer } from 'recharts'

// ── Simulated AI responses ────────────────────────────────────────────────────

const COMMAND_RESPONSES: Record<string, Omit<AIResponse, 'id' | 'command' | 'timestamp' | 'processing_time_ms'>> = {
  default: {
    response: "I've analyzed the current plant state. All systems are nominal. Active batches: B043 (Hydraulic ISO 46, 47% complete), B045 (SAE 5W-30 FS, 88% in lab phase). Tank T-06 PPD is at 8% — reorder recommended within 24 hours.",
    actions_taken: ['Queried blend simulator state', 'Checked tank inventory levels', 'Reviewed quality predictions'],
  },
  blend: {
    response: "Initiating blend sequence for B046 — Compressor Oil ISO 46. Pre-checks complete: all ingredients available (base oil 76%, VM 12%, AO 3%, Det 7%, PPD 2%). Temperature target: 72°C. ETA: 3h 45min. Pipeline flow will activate in 30 seconds.",
    actions_taken: ['Validated recipe B046', 'Checked ingredient availability', 'Reserved Blender-2', 'Scheduled pipeline flow'],
  },
  optimize: {
    response: "Recipe optimization complete for cost mode. Suggested adjustment: reduce antioxidant by 0.8% (from 3% to 2.2%), increase base oil by 0.8%. Projected savings: $0.14/L with <2% viscosity impact. Quality score remains above 90. Apply?",
    actions_taken: ['Ran cost optimization model', 'Evaluated 847 formulation variants', 'Validated spec compliance', 'Generated recommendation'],
  },
  status: {
    response: "Plant status summary: Utilization 78.4% ✓. Active batches: 3. Quality pass rate: 96.2% (last 24h). Critical alert: Tank T-06 PPD at 8% — 2 days supply remaining. Predictive maintenance: Pump P-03 due for inspection (61% health). Energy: 8,820 kWh today (−3.2% vs yesterday).",
    actions_taken: ['Polled all sensor feeds', 'Aggregated KPI data', 'Checked maintenance schedules'],
  },
  quality: {
    response: "Quality analysis for active batches: B043 viscosity trending low (44.8 cSt vs 46.0 target). Recommended action: increase VM by 0.8% in next 15 minutes before sampling phase. B045 is on-spec across all parameters. Lab queue: 2 samples pending.",
    actions_taken: ['Analyzed viscosity trend', 'Compared to spec limits', 'Generated corrective recommendation'],
  },
  supplier: {
    response: "Supply optimization complete. Switching to Gulf Base Oils Ltd for base oil (saves $0.06/L, 8-day lead time). Viscoflex Corp retained for VM due to quality grade A+. Estimated monthly savings: $23,900. Quality impact: minimal. Confirm switch?",
    actions_taken: ['Compared 8 active suppliers', 'Ran cost-quality trade-off analysis', 'Generated optimized mix'],
  },
}

function getAIResponse(command: string): Omit<AIResponse, 'id' | 'command' | 'timestamp' | 'processing_time_ms'> {
  const lower = command.toLowerCase()
  if (lower.includes('blend') || lower.includes('start') || lower.includes('batch')) return COMMAND_RESPONSES.blend
  if (lower.includes('optimiz') || lower.includes('recipe') || lower.includes('formulat')) return COMMAND_RESPONSES.optimize
  if (lower.includes('status') || lower.includes('overview') || lower.includes('summary')) return COMMAND_RESPONSES.status
  if (lower.includes('quality') || lower.includes('viscosity') || lower.includes('spec')) return COMMAND_RESPONSES.quality
  if (lower.includes('supplier') || lower.includes('supply') || lower.includes('cost')) return COMMAND_RESPONSES.supplier
  return COMMAND_RESPONSES.default
}

// ── Initial scenarios ─────────────────────────────────────────────────────────

const INITIAL_SCENARIOS: Scenario[] = [
  {
    id: 'sc1', name: 'High VM Variant', description: 'Increased viscosity modifier for better high-temp performance',
    recipe_id: 'r1',
    parameters: { temperature: 75, mixing_speed: 320, ingredient_ratios: { base_oil: 72, viscosity_modifier: 15, antioxidant: 3, detergent: 7, pour_point_depressant: 3 } },
    results: { viscosity: 51.2, flash_point: 226, tbn: 7.1, cost_per_liter: 1.96, off_spec_risk: 8 },
    status: 'completed',
  },
  {
    id: 'sc2', name: 'Cost-Optimized', description: 'Reduced additive content for lower production cost',
    recipe_id: 'r1',
    parameters: { temperature: 70, mixing_speed: 300, ingredient_ratios: { base_oil: 79, viscosity_modifier: 9, antioxidant: 2, detergent: 6, pour_point_depressant: 4 } },
    results: { viscosity: 43.1, flash_point: 218, tbn: 5.9, cost_per_liter: 1.67, off_spec_risk: 34 },
    status: 'completed',
  },
  {
    id: 'sc3', name: 'Premium Syn', description: 'Full synthetic formulation with max quality',
    recipe_id: 'r1',
    parameters: { temperature: 80, mixing_speed: 350, ingredient_ratios: { base_oil: 74, viscosity_modifier: 13, antioxidant: 5, detergent: 5, pour_point_depressant: 3 } },
    results: { viscosity: 48.8, flash_point: 241, tbn: 8.4, cost_per_liter: 2.30, off_spec_risk: 4 },
    status: 'completed',
  },
]

const QUICK_COMMANDS = [
  { icon: Play, label: 'Start blend B046', color: 'text-blue-600' },
  { icon: BarChart2, label: 'Plant status overview', color: 'text-green-600' },
  { icon: FlaskConical, label: 'Optimize recipe for cost', color: 'text-purple-600' },
  { icon: TruckIcon, label: 'Analyze supplier options', color: 'text-orange-600' },
]

// ── Component ─────────────────────────────────────────────────────────────────

export function AIPage() {
  const { commandHistory, isProcessing, scenarios, typingText, addResponse, setIsProcessing, setScenarios, setTypingText } = useAIPanelStore()
  const [input, setInput] = useState('')
  const chatEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (scenarios.length === 0) setScenarios(INITIAL_SCENARIOS)
    // Boot message
    if (commandHistory.length === 0) {
      addResponse({
        id: 'boot',
        command: '— System Initialised —',
        response: "OmniBlend AI Control Panel online. I can help you manage blends, optimise recipes, monitor quality, and analyse supply options. Try a quick command or type a natural language instruction.",
        actions_taken: ['System check complete', 'All modules connected', 'Simulation running'],
        timestamp: new Date().toISOString(),
        processing_time_ms: 0,
      })
    }
  }, [])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [commandHistory, typingText])

  const handleSend = (cmd?: string) => {
    const command = (cmd ?? input).trim()
    if (!command || isProcessing) return
    setInput('')
    setIsProcessing(true)

    // Add user command immediately
    const id = `cmd-${Date.now()}`
    const responseData = getAIResponse(command)

    // Simulate typing effect
    let i = 0
    const fullText = responseData.response
    setTypingText('')

    const typingInterval = setInterval(() => {
      i += 3
      setTypingText(fullText.slice(0, i))
      if (i >= fullText.length) {
        clearInterval(typingInterval)
        setTypingText('')
        addResponse({
          id,
          command,
          ...responseData,
          timestamp: new Date().toISOString(),
          processing_time_ms: Math.round(400 + Math.random() * 600),
        })
        setIsProcessing(false)
      }
    }, 20)
  }

  const radarForScenario = (s: Scenario) => s.results ? [
    { metric: 'Viscosity', value: Math.min(100, (s.results.viscosity / 200) * 100 + 30) },
    { metric: 'Flash Pt', value: Math.min(100, ((s.results.flash_point - 200) / 60) * 100) },
    { metric: 'TBN', value: Math.min(100, (s.results.tbn / 12) * 100) },
    { metric: 'Cost Eff.', value: Math.max(0, 100 - ((s.results.cost_per_liter - 1.5) / 1.5) * 100) },
    { metric: 'Quality', value: 100 - s.results.off_spec_risk },
  ] : []

  const getCombinedRadarData = () => {
    const metrics = ['Viscosity', 'Flash Pt', 'TBN', 'Cost Eff.', 'Quality']
    return metrics.map(metric => {
      const dataPoint: any = { metric }
      INITIAL_SCENARIOS.forEach((scenario, index) => {
        const scenarioData = radarForScenario(scenario)
        const metricData = scenarioData.find(d => d.metric === metric)
        dataPoint[`scenario${index}`] = metricData ? metricData.value : 0
      })
      return dataPoint
    })
  }

  const SCENARIO_COLORS = ['#3B82F6', '#10B981', '#8B5CF6']

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">AI Control Panel</h1>
          <p className="text-sm text-slate-500 mt-0.5">Natural language plant control · Scenario analysis</p>
        </div>
        <div className="flex items-center gap-2 glass-card px-3 py-2">
          <Bot className="w-4 h-4 text-pink-500" />
          <span className="text-xs font-medium text-slate-600">OmniBlend AI v2.4</span>
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* AI Chat Panel */}
        <div className="lg:col-span-2 flex flex-col gap-3">
          {/* Quick commands */}
          <GlassCard className="p-3">
            <p className="text-xs font-medium text-slate-500 mb-2">Quick Commands</p>
            <div className="flex flex-wrap gap-2">
              {QUICK_COMMANDS.map(({ icon: Icon, label, color }) => (
                <button
                  key={label}
                  onClick={() => handleSend(label)}
                  disabled={isProcessing}
                  className="flex items-center gap-1.5 glass-card px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-white/40 transition-all"
                >
                  <Icon className={clsx('w-3.5 h-3.5', color)} />
                  {label}
                </button>
              ))}
            </div>
          </GlassCard>

          {/* Chat history */}
          <GlassCard className="p-4 flex-1 min-h-0">
            <div className="space-y-4 max-h-96 overflow-y-auto pr-1">
              <AnimatePresence initial={false}>
                {[...commandHistory].reverse().map((entry) => (
                  <motion.div
                    key={entry.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-2"
                  >
                    {/* User command */}
                    {entry.command !== '— System Initialised —' && (
                      <div className="flex justify-end">
                        <div className="glass-card px-3 py-2 max-w-xs">
                          <p className="text-xs text-slate-700">{entry.command}</p>
                        </div>
                      </div>
                    )}
                    {/* AI response */}
                    <div className="flex items-start gap-2.5">
                      <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                        <Bot className="w-4 h-4 text-white" />
                      </div>
                      <div className="glass-card p-3 flex-1">
                        {entry.id === 'boot' && (
                          <p className="text-xs font-semibold text-pink-600 mb-1">OmniBlend AI</p>
                        )}
                        <p className="text-xs text-slate-700 leading-relaxed">{entry.response}</p>
                        {entry.actions_taken.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {entry.actions_taken.map((action: string) => (
                              <span key={action} className="text-xs text-slate-400 bg-white/30 px-2 py-0.5 rounded-full">
                                {action}
                              </span>
                            ))}
                          </div>
                        )}
                        {entry.processing_time_ms > 0 && (
                          <p className="text-xs text-slate-300 mt-1.5">{entry.processing_time_ms}ms</p>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}

                {/* Typing indicator */}
                {(isProcessing && typingText) && (
                  <motion.div key="typing" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex items-start gap-2.5">
                    <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                      <Bot className="w-4 h-4 text-white" />
                    </div>
                    <div className="glass-card p-3 flex-1">
                      <p className="text-xs text-slate-700 leading-relaxed">{typingText}<span className="inline-block w-1 h-3 bg-pink-500 ml-0.5 animate-pulse" /></p>
                    </div>
                  </motion.div>
                )}

                {(isProcessing && !typingText) && (
                  <motion.div key="thinking" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                      <Bot className="w-4 h-4 text-white animate-pulse" />
                    </div>
                    <div className="glass-card px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex gap-1">
                          {[0, 1, 2].map(i => (
                            <div key={i} className="w-1.5 h-1.5 rounded-full bg-pink-400 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                          ))}
                        </div>
                        <span className="text-xs text-slate-400">Processing...</span>
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
                placeholder="Type a command... (e.g. 'Start blend B046', 'Optimize recipe for cost')"
                rows={2}
                className="flex-1 resize-none glass-card px-3 py-2 text-sm text-slate-700 placeholder-slate-400 outline-none focus:border-pink-300/60 bg-white/10"
                disabled={isProcessing}
              />
              <button
                onClick={() => handleSend()}
                disabled={isProcessing || !input.trim()}
                className={clsx(
                  'p-3 rounded-xl transition-all',
                  input.trim() && !isProcessing
                    ? 'bg-gradient-to-br from-pink-500 to-purple-600 text-white shadow-lg hover:shadow-pink-300/30'
                    : 'bg-white/20 text-slate-400'
                )}
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </GlassCard>
        </div>

        {/* Scenario Comparison */}
        <div className="space-y-4">
          <GlassCard className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Zap className="w-4 h-4 text-amber-500" />
              <p className="text-sm font-semibold text-slate-700">Scenario Comparison</p>
            </div>

            {/* Radar overlay */}
            <ResponsiveContainer width="100%" height={200}>
              <RadarChart data={getCombinedRadarData()}>
                <PolarGrid stroke="rgba(148,163,184,0.3)" />
                <PolarAngleAxis dataKey="metric" tick={{ fontSize: 9, fill: '#94A3B8' }} />
                {INITIAL_SCENARIOS.map((s, i) => (
                  <Radar
                    key={s.id}
                    name={s.name}
                    dataKey={`scenario${i}`}
                    stroke={SCENARIO_COLORS[i]}
                    fill={SCENARIO_COLORS[i]}
                    fillOpacity={0.1}
                  />
                ))}
              </RadarChart>
            </ResponsiveContainer>

            {/* Legend */}
            <div className="flex flex-wrap gap-2 mt-1">
              {INITIAL_SCENARIOS.map((s, i) => (
                <div key={s.id} className="flex items-center gap-1">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: SCENARIO_COLORS[i] }} />
                  <span className="text-xs text-slate-500">{s.name}</span>
                </div>
              ))}
            </div>
          </GlassCard>

          {/* Scenario cards */}
          <div className="space-y-2">
            {INITIAL_SCENARIOS.map((s, i) => (
              <GlassCard key={s.id} className="p-3">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: SCENARIO_COLORS[i] }} />
                  <p className="text-xs font-semibold text-slate-700">{s.name}</p>
                  <span className="ml-auto text-xs text-green-600 font-medium flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Done
                  </span>
                </div>
                <p className="text-xs text-slate-500 mb-2">{s.description}</p>
                {s.results && (
                  <div className="grid grid-cols-2 gap-1 text-xs">
                    <span className="text-slate-500">Viscosity: <b style={{ color: SCENARIO_COLORS[i] }}>{s.results.viscosity.toFixed(1)} cSt</b></span>
                    <span className="text-slate-500">Flash: <b style={{ color: SCENARIO_COLORS[i] }}>{s.results.flash_point}°C</b></span>
                    <span className="text-slate-500">Cost: <b style={{ color: SCENARIO_COLORS[i] }}>${s.results.cost_per_liter.toFixed(2)}/L</b></span>
                    <span className={clsx('font-medium', s.results.off_spec_risk < 15 ? 'text-green-600' : s.results.off_spec_risk < 40 ? 'text-amber-600' : 'text-red-600')}>
                      Risk: {s.results.off_spec_risk}%
                    </span>
                  </div>
                )}
              </GlassCard>
            ))}
          </div>

          {/* Event injection */}
          <GlassCard className="p-4">
            <p className="text-xs font-semibold text-slate-600 mb-3 uppercase tracking-wide">Inject Event</p>
            <div className="space-y-2">
              {[
                { icon: AlertTriangle, label: 'Equipment Failure', color: 'text-red-500', cmd: 'Simulate equipment failure on Blender-1' },
                { icon: Clock, label: 'Material Shortage', color: 'text-amber-500', cmd: 'Simulate critical shortage on antioxidant tank' },
                { icon: CheckCircle2, label: 'Quality Deviation', color: 'text-blue-500', cmd: 'Simulate quality deviation on batch B043' },
              ].map(({ icon: Icon, label, color, cmd }) => (
                <button
                  key={label}
                  onClick={() => handleSend(cmd)}
                  disabled={isProcessing}
                  className="w-full flex items-center gap-2 glass-card px-3 py-2 text-left hover:bg-white/30 transition-all"
                >
                  <Icon className={clsx('w-4 h-4', color)} />
                  <span className="text-xs text-slate-600">{label}</span>
                </button>
              ))}
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  )
}
