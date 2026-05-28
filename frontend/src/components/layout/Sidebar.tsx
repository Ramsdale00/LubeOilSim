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
  ChevronLeft,
  ChevronRight,
  Droplets,
  TrendingUp,
} from 'lucide-react'
import { useSimulationStore } from '@/store/simulationStore'

const navItems = [
  { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/blend',     icon: Layers,          label: 'Blend Simulator' },
  { path: '/tanks',     icon: FlaskConical,    label: 'Tank Digital Twin' },
  { path: '/recipe',    icon: Beaker,          label: 'Recipe Lab' },
  { path: '/quality',   icon: CheckCircle,     label: 'Quality AI Engine' },
  { path: '/supply',    icon: TruckIcon,       label: 'Procurement Hub' },
  { path: '/ai',        icon: Bot,             label: 'AI Control Panel' },
  { path: '/savings',   icon: TrendingUp,      label: 'Savings Impact' },
]

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)
  const location = useLocation()
  const { timeAcceleration, setTimeAcceleration, isRunning, toggleRunning } = useSimulationStore()

  return (
    <aside
      className={clsx(
        'flex flex-col h-full transition-all duration-300 relative z-20',
        collapsed ? 'w-16' : 'w-56'
      )}
      style={{ background: '#ffffff', borderRight: '1px solid #DCE0E7', boxShadow: '2px 0 8px rgba(0,0,0,0.04)' }}
    >
      {/* Logo */}
      <div
        className={clsx('flex items-center px-4 py-4', collapsed && 'justify-center')}
        style={{ borderBottom: '1px solid #DCE0E7' }}
      >
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, #1F3864 0%, #2E75B6 100%)' }}
        >
          <Droplets className="w-4 h-4 text-white" />
        </div>
        {!collapsed && (
          <div className="ml-2.5">
            <div className="font-semibold text-sm" style={{ color: '#1F3864' }}>OmniBlend</div>
            <div className="text-[10px] font-medium tracking-wide" style={{ color: '#888780' }}>LOBP Simulator</div>
          </div>
        )}
      </div>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-16 w-6 h-6 rounded-full flex items-center justify-center transition-colors z-30"
        style={{ background: '#fff', border: '1px solid #DCE0E7', boxShadow: '0 2px 6px rgba(0,0,0,0.08)' }}
        onMouseEnter={e => (e.currentTarget.style.borderColor = '#2E75B6')}
        onMouseLeave={e => (e.currentTarget.style.borderColor = '#DCE0E7')}
      >
        {collapsed
          ? <ChevronRight className="w-3 h-3" style={{ color: '#5F5E5A' }} />
          : <ChevronLeft  className="w-3 h-3" style={{ color: '#5F5E5A' }} />
        }
      </button>

      {/* Nav */}
      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
        {navItems.map(({ path, icon: Icon, label }) => {
          const isActive = location.pathname === path || location.pathname.startsWith(path + '/')
          return (
            <NavLink
              key={path}
              to={path}
              title={collapsed ? label : undefined}
              className={clsx('flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 relative group', collapsed && 'justify-center')}
              style={isActive
                ? { background: '#E6F1FB', color: '#1F3864' }
                : { color: '#5F5E5A' }
              }
              onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = '#F4F6FA' }}
              onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = '' }}
            >
              {/* Active left bar */}
              {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 rounded-r-full" style={{ background: '#2E75B6' }} />
              )}

              <Icon
                className="w-4 h-4 flex-shrink-0"
                style={{ color: isActive ? '#1F3864' : '#888780' }}
              />

              {!collapsed && (
                <span className="text-sm font-medium" style={{ color: isActive ? '#1F3864' : '#5F5E5A' }}>
                  {label}
                </span>
              )}

              {/* Tooltip when collapsed */}
              {collapsed && (
                <div
                  className="absolute left-full ml-3 px-2.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50"
                  style={{ background: '#1F3864', color: '#fff', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}
                >
                  {label}
                </div>
              )}
            </NavLink>
          )
        })}
      </nav>

      {/* Sim Controls */}
      <div
        className={clsx('px-2 py-3', collapsed && 'px-1')}
        style={{ borderTop: '1px solid #DCE0E7' }}
      >
        {!collapsed && (
          <p className="text-[10px] font-600 uppercase tracking-widest mb-2 px-1" style={{ color: '#888780', letterSpacing: '0.6px', fontWeight: 600 }}>
            Sim Speed
          </p>
        )}
        <div className={clsx('flex gap-1', collapsed ? 'flex-col items-center' : 'px-1')}>
          {([1, 5, 10] as const).map((speed) => (
            <button
              key={speed}
              onClick={() => setTimeAcceleration(speed)}
              className={clsx(
                'rounded text-xs font-bold transition-all duration-150',
                collapsed ? 'w-8 h-8 flex items-center justify-center' : 'flex-1 py-1.5',
              )}
              style={timeAcceleration === speed
                ? { background: '#1F3864', color: '#fff' }
                : { background: '#F4F6FA', color: '#5F5E5A', border: '1px solid #DCE0E7' }
              }
            >
              {speed}x
            </button>
          ))}
        </div>

        <button
          onClick={toggleRunning}
          className={clsx('mt-2 w-full py-1.5 rounded text-xs font-bold transition-all duration-150')}
          style={isRunning
            ? { background: '#E1F5EE', color: '#0F6E56', border: '1px solid #1D9E75' }
            : { background: '#FCEBEB', color: '#791F1F', border: '1px solid #A32D2D' }
          }
        >
          {collapsed ? (isRunning ? '●' : '■') : (isRunning ? '● RUNNING' : '■ PAUSED')}
        </button>
      </div>
    </aside>
  )
}
