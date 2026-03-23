import { clsx } from 'clsx'

type Status = 'online' | 'warning' | 'critical' | 'offline'

interface StatusIndicatorProps {
  status: Status
  size?: 'sm' | 'md' | 'lg'
  label?: string
}

const statusConfig: Record<Status, { color: string; pulse: string; label: string }> = {
  online: {
    color: 'bg-green-400',
    pulse: 'bg-green-400',
    label: 'Online',
  },
  warning: {
    color: 'bg-amber-400',
    pulse: 'bg-amber-400',
    label: 'Warning',
  },
  critical: {
    color: 'bg-red-500',
    pulse: 'bg-red-500',
    label: 'Critical',
  },
  offline: {
    color: 'bg-slate-400',
    pulse: 'bg-slate-400',
    label: 'Offline',
  },
}

const sizeClasses = {
  sm: 'w-2 h-2',
  md: 'w-3 h-3',
  lg: 'w-4 h-4',
}

export function StatusIndicator({ status, size = 'md', label }: StatusIndicatorProps) {
  const config = statusConfig[status]
  const dotSize = sizeClasses[size]

  return (
    <div className="flex items-center gap-2">
      <div className="relative flex items-center justify-center">
        {status !== 'offline' && (
          <div
            className={clsx(
              'absolute rounded-full animate-ping opacity-75',
              dotSize,
              config.pulse
            )}
          />
        )}
        <div className={clsx('relative rounded-full', dotSize, config.color)} />
      </div>
      {label && (
        <span className="text-xs font-medium text-slate-600">
          {label || config.label}
        </span>
      )}
    </div>
  )
}
