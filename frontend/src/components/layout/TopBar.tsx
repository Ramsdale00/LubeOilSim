import { useState, useEffect } from 'react'
import { clsx } from 'clsx'
import { format } from 'date-fns'
import { Zap, AlertTriangle, ChevronDown, Wifi, WifiOff } from 'lucide-react'
import { useSimulationStore } from '@/store/simulationStore'
import { useSimulationSocket } from '@/hooks/useSimulationSocket'
import { post, put } from '@/hooks/useApi'

const injectableEvents = [
  { id: 'equipment_failure', label: 'Equipment Failure', icon: '⚙️' },
  { id: 'material_shortage', label: 'Material Shortage', icon: '📦' },
  { id: 'quality_deviation', label: 'Quality Deviation', icon: '⚗️' },
  { id: 'power_surge', label: 'Power Surge', icon: '⚡' },
]

export function TopBar() {
  const { simulatedTime, timeAcceleration, setTimeAcceleration } = useSimulationStore()
  const { status: wsStatus } = useSimulationSocket()
  const [showEventMenu, setShowEventMenu] = useState(false)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 1000)
    return () => clearInterval(interval)
  }, [])

  const handleAcceleration = async (speed: 1 | 5 | 10) => {
    setTimeAcceleration(speed)
    try {
      await put('/simulation/time-acceleration', { acceleration: speed })
    } catch {
      // API may not be available - state is already updated locally
    }
  }

  const handleInjectEvent = async (eventType: string) => {
    setShowEventMenu(false)
    try {
      await post('/simulation/inject-event', { type: eventType })
    } catch {
      // API not available
    }
  }

  const isConnected = wsStatus === 'connected'

  return (
    <header className="h-14 flex items-center justify-between px-6 backdrop-blur-xl bg-white/30 border-b border-white/30 relative z-10">
      {/* Left: Logo */}
      <div className="flex items-center gap-3">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
          <Zap className="w-4 h-4 text-white" />
        </div>
        <div>
          <span className="font-bold text-slate-800 text-sm">OmniBlend Control</span>
          <span className="text-slate-400 text-xs ml-2">Digital Twin Simulator</span>
        </div>
      </div>

      {/* Center: Sim Clock */}
      <div className="flex items-center gap-4">
        <div className="glass-card px-4 py-1.5 flex items-center gap-3">
          <div className="text-xs text-slate-500 font-medium">SIM TIME</div>
          <div className="text-sm font-mono font-bold text-blue-600">
            {format(simulatedTime, 'HH:mm:ss')}
          </div>
          <div className="text-xs text-slate-400">
            {format(simulatedTime, 'dd MMM yyyy')}
          </div>
        </div>

        {/* Time acceleration */}
        <div className="flex items-center gap-1">
          {([1, 5, 10] as const).map((speed) => (
            <button
              key={speed}
              onClick={() => handleAcceleration(speed)}
              className={clsx(
                'w-9 h-7 rounded-lg text-xs font-bold transition-all duration-200',
                timeAcceleration === speed
                  ? 'bg-blue-500 text-white shadow-md glow-blue'
                  : 'bg-white/40 text-slate-600 hover:bg-white/60 border border-white/30'
              )}
            >
              {speed}x
            </button>
          ))}
        </div>
      </div>

      {/* Right: Inject Event + WS Status */}
      <div className="flex items-center gap-3">
        <div className="relative">
          <button
            onClick={() => setShowEventMenu(!showEventMenu)}
            className={clsx(
              'flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium',
              'backdrop-blur-sm bg-amber-100/60 border border-amber-200 text-amber-700',
              'hover:bg-amber-200/60 transition-all duration-200'
            )}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            Inject Event
            <ChevronDown className={clsx('w-3 h-3 transition-transform', showEventMenu && 'rotate-180')} />
          </button>

          {showEventMenu && (
            <div className="absolute right-0 top-full mt-2 glass-card py-2 min-w-[180px] z-50">
              {injectableEvents.map((event) => (
                <button
                  key={event.id}
                  onClick={() => handleInjectEvent(event.id)}
                  className="w-full text-left px-4 py-2 text-xs hover:bg-white/30 transition-colors flex items-center gap-2"
                >
                  <span>{event.icon}</span>
                  <span className="text-slate-700 font-medium">{event.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* WS Status */}
        <div className={clsx(
          'flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium',
          isConnected
            ? 'bg-green-100/60 border border-green-200 text-green-700'
            : 'bg-slate-100/60 border border-slate-200 text-slate-500'
        )}>
          {isConnected
            ? <Wifi className="w-3.5 h-3.5" />
            : <WifiOff className="w-3.5 h-3.5" />
          }
          <span>{isConnected ? 'LIVE' : 'DEMO'}</span>
        </div>
      </div>
    </header>
  )
}
