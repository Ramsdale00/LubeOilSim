import { useState, useEffect } from 'react'
import { clsx } from 'clsx'
import { format } from 'date-fns'
import { AlertTriangle, ChevronDown, Wifi, WifiOff, Droplets } from 'lucide-react'
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
      // API may not be available
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
    <header
      className="h-14 flex items-center justify-between px-6 relative z-10"
      style={{ background: 'linear-gradient(90deg, #1F3864 0%, #2E75B6 100%)', boxShadow: '0 2px 8px rgba(0,0,0,0.18)' }}
    >
      {/* Left: Brand */}
      <div className="flex items-center gap-3">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ background: 'rgba(255,255,255,0.18)' }}
        >
          <Droplets className="w-4 h-4 text-white" />
        </div>
        <div>
          <span className="font-semibold text-white text-sm tracking-wide">OmniBlend</span>
          <span className="text-white/50 text-xs ml-2">Digital Twin Simulator</span>
        </div>
      </div>

      {/* Center: Sim Clock + Speed */}
      <div className="flex items-center gap-4">
        <div
          className="flex items-center gap-3 px-4 py-1.5 rounded-lg"
          style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.20)' }}
        >
          <span className="text-white/60 text-xs font-medium tracking-wider">SIM</span>
          <span className="text-white text-sm font-mono font-bold">
            {format(simulatedTime, 'HH:mm:ss')}
          </span>
          <span className="text-white/50 text-xs">
            {format(simulatedTime, 'dd MMM yyyy')}
          </span>
        </div>

        {/* Time acceleration */}
        <div className="flex items-center gap-1">
          {([1, 5, 10] as const).map((speed) => (
            <button
              key={speed}
              onClick={() => handleAcceleration(speed)}
              className={clsx(
                'w-9 h-7 rounded text-xs font-bold transition-all duration-150',
                timeAcceleration === speed
                  ? 'bg-white text-[#1F3864]'
                  : 'text-white/70 hover:text-white hover:bg-white/15'
              )}
              style={timeAcceleration !== speed ? { border: '1px solid rgba(255,255,255,0.25)' } : {}}
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
            className="flex items-center gap-2 px-3 py-1.5 rounded text-xs font-medium text-white/90 transition-all duration-150 hover:bg-white/15"
            style={{ border: '1px solid rgba(255,255,255,0.30)' }}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            Inject Event
            <ChevronDown className={clsx('w-3 h-3 transition-transform', showEventMenu && 'rotate-180')} />
          </button>

          {showEventMenu && (
            <div
              className="absolute right-0 top-full mt-2 py-1 min-w-[180px] z-50 rounded-lg"
              style={{ background: '#fff', border: '1px solid #DCE0E7', boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}
            >
              {injectableEvents.map((event) => (
                <button
                  key={event.id}
                  onClick={() => handleInjectEvent(event.id)}
                  className="w-full text-left px-4 py-2 text-xs transition-colors flex items-center gap-2"
                  style={{ color: '#5F5E5A' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#F4F6FA')}
                  onMouseLeave={e => (e.currentTarget.style.background = '')}
                >
                  <span>{event.icon}</span>
                  <span className="font-medium" style={{ color: '#1a1a1a' }}>{event.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* WS Status */}
        <div
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium"
          style={isConnected
            ? { background: 'rgba(29,158,117,0.20)', border: '1px solid rgba(29,158,117,0.35)', color: '#5DCAA5' }
            : { background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.20)', color: 'rgba(255,255,255,0.55)' }
          }
        >
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
