import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { clsx } from 'clsx'
import {
  LayoutDashboard,
  FlaskConical,
  Layers,
  Beaker,
  CheckCircle,
  TruckIcon,
  Bot,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Zap,
} from 'lucide-react'
import { useSimulationStore } from '@/store/simulationStore'

const navItems = [
  { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', color: 'text-blue-500' },
  { path: '/blend', icon: Layers, label: 'Blend Simulator', color: 'text-cyan-500' },
  { path: '/tanks', icon: FlaskConical, label: 'Tank Digital Twin', color: 'text-green-500' },
  { path: '/recipe', icon: Beaker, label: 'Recipe Lab', color: 'text-purple-500' },
  { path: '/quality', icon: CheckCircle, label: 'Quality AI Engine', color: 'text-amber-500' },
  { path: '/supply', icon: TruckIcon, label: 'Procurement Hub', color: 'text-orange-500' },
  { path: '/ai', icon: Bot, label: 'AI Control Panel', color: 'text-pink-500' },
  { path: '/docs', icon: BookOpen, label: 'Doc Assistant', color: 'text-teal-500' },
]

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)
  const location = useLocation()
  const { timeAcceleration, setTimeAcceleration, isRunning, toggleRunning } = useSimulationStore()

  return (
    <aside
      className={clsx(
        'flex flex-col h-full transition-all duration-300',
        'backdrop-blur-xl bg-white/30 border-r border-white/30',
        'relative z-20',
        collapsed ? 'w-16' : 'w-60'
      )}
    >
      {/* Logo */}
      <div className={clsx('flex items-center px-4 py-4 border-b border-white/20', collapsed && 'justify-center')}>
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-slate-800 text-sm">OmniBlend</span>
          </div>
        )}
        {collapsed && (
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
            <Zap className="w-4 h-4 text-white" />
          </div>
        )}
      </div>

      {/* Toggle Button */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className={clsx(
          'absolute -right-3 top-16 w-6 h-6 rounded-full',
          'bg-white/80 border border-white/50 shadow-md',
          'flex items-center justify-center',
          'hover:bg-white transition-colors z-30'
        )}
      >
        {collapsed
          ? <ChevronRight className="w-3 h-3 text-slate-600" />
          : <ChevronLeft className="w-3 h-3 text-slate-600" />
        }
      </button>

      {/* Nav Items */}
      <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
        {navItems.map(({ path, icon: Icon, label, color }) => {
          const isActive = location.pathname === path || location.pathname.startsWith(path + '/')
          return (
            <NavLink
              key={path}
              to={path}
              className={clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200',
                'relative group',
                isActive
                  ? 'bg-white/50 shadow-md border border-white/40'
                  : 'hover:bg-white/30',
                collapsed && 'justify-center'
              )}
            >
              {isActive && (
                <div className={clsx('absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r-full', color.replace('text-', 'bg-'))} />
              )}
              <Icon
                className={clsx(
                  'w-5 h-5 flex-shrink-0 transition-colors',
                  isActive ? color : 'text-slate-500 group-hover:text-slate-700'
                )}
              />
              {!collapsed && (
                <span
                  className={clsx(
                    'text-sm font-medium transition-colors',
                    isActive ? 'text-slate-800' : 'text-slate-600 group-hover:text-slate-800'
                  )}
                >
                  {label}
                </span>
              )}
              {collapsed && (
                <div className="absolute left-full ml-3 px-2 py-1 rounded-lg bg-white/90 text-xs font-medium text-slate-700 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 border border-white/50">
                  {label}
                </div>
              )}
            </NavLink>
          )
        })}
      </nav>

      {/* Sim Controls */}
      <div className={clsx('px-2 py-3 border-t border-white/20', collapsed && 'px-1')}>
        {!collapsed && (
          <p className="text-xs text-slate-500 px-2 mb-2 font-medium uppercase tracking-wide">Simulation Speed</p>
        )}
        <div className={clsx('flex gap-1', collapsed ? 'flex-col items-center' : 'px-2')}>
          {([1, 5, 10] as const).map((speed) => (
            <button
              key={speed}
              onClick={() => setTimeAcceleration(speed)}
              className={clsx(
                'rounded-lg text-xs font-bold transition-all duration-200',
                collapsed ? 'w-8 h-8 flex items-center justify-center' : 'flex-1 py-1.5',
                timeAcceleration === speed
                  ? 'bg-blue-500 text-white shadow-md'
                  : 'bg-white/30 text-slate-600 hover:bg-white/50'
              )}
            >
              {speed}x
            </button>
          ))}
        </div>
        <button
          onClick={toggleRunning}
          className={clsx(
            'mt-2 rounded-xl text-xs font-bold transition-all duration-200',
            collapsed ? 'w-full py-2' : 'w-full py-2',
            isRunning
              ? 'bg-green-500/20 text-green-700 border border-green-300'
              : 'bg-red-500/20 text-red-700 border border-red-300'
          )}
        >
          {collapsed ? (isRunning ? '●' : '■') : (isRunning ? '● RUNNING' : '■ PAUSED')}
        </button>
      </div>
    </aside>
  )
}
