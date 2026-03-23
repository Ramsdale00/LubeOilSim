import { clsx } from 'clsx'

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  color?: 'blue' | 'cyan' | 'green' | 'white'
  label?: string
}

const sizeClasses = {
  sm: 'w-4 h-4 border-2',
  md: 'w-8 h-8 border-2',
  lg: 'w-12 h-12 border-3',
}

const colorClasses: Record<string, string> = {
  blue: 'border-blue-200 border-t-blue-500',
  cyan: 'border-cyan-200 border-t-cyan-500',
  green: 'border-green-200 border-t-green-500',
  white: 'border-white/30 border-t-white',
}

export function LoadingSpinner({ size = 'md', color = 'blue', label }: LoadingSpinnerProps) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className={clsx(
          'rounded-full animate-spin',
          sizeClasses[size],
          colorClasses[color]
        )}
        style={{
          boxShadow: color === 'blue'
            ? '0 0 10px rgba(96, 165, 250, 0.4)'
            : color === 'cyan'
            ? '0 0 10px rgba(34, 211, 238, 0.4)'
            : 'none',
        }}
      />
      {label && <span className="text-xs text-slate-500 animate-pulse">{label}</span>}
    </div>
  )
}
