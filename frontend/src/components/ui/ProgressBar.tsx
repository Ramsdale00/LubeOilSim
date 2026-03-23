import { clsx } from 'clsx'
import { useAnimatedValue } from '@/hooks/useAnimatedValue'

interface ProgressBarProps {
  value: number
  color?: 'blue' | 'green' | 'amber' | 'red' | 'purple' | 'cyan'
  label?: string
  animated?: boolean
  showValue?: boolean
  height?: 'sm' | 'md' | 'lg'
}

const colorGradients: Record<string, string> = {
  blue: 'from-blue-400 to-blue-600',
  green: 'from-green-400 to-emerald-600',
  amber: 'from-amber-400 to-orange-500',
  red: 'from-red-400 to-rose-600',
  purple: 'from-purple-400 to-violet-600',
  cyan: 'from-cyan-400 to-teal-500',
}

const heightClasses = {
  sm: 'h-1.5',
  md: 'h-2.5',
  lg: 'h-4',
}

export function ProgressBar({
  value,
  color = 'blue',
  label,
  animated = true,
  showValue = false,
  height = 'md',
}: ProgressBarProps) {
  const animatedValue = useAnimatedValue(Math.min(100, Math.max(0, value)))
  const displayValue = animated ? animatedValue : value

  return (
    <div className="w-full">
      {(label || showValue) && (
        <div className="flex justify-between items-center mb-1">
          {label && <span className="text-xs text-slate-500 font-medium">{label}</span>}
          {showValue && (
            <span className="text-xs font-bold text-slate-700">{displayValue.toFixed(0)}%</span>
          )}
        </div>
      )}
      <div
        className={clsx(
          'w-full rounded-full overflow-hidden',
          heightClasses[height],
          'bg-white/30 backdrop-blur-sm'
        )}
      >
        <div
          className={clsx(
            'h-full rounded-full bg-gradient-to-r transition-all duration-500',
            colorGradients[color]
          )}
          style={{ width: `${displayValue}%` }}
        />
      </div>
    </div>
  )
}
