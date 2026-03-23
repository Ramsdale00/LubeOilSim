import { clsx } from 'clsx'

interface SliderInputProps {
  label: string
  value: number
  min: number
  max: number
  step?: number
  unit?: string
  color?: 'blue' | 'green' | 'amber' | 'purple' | 'cyan'
  onChange: (value: number) => void
  disabled?: boolean
}

const colorClasses: Record<string, string> = {
  blue: 'accent-blue-500',
  green: 'accent-green-500',
  amber: 'accent-amber-500',
  purple: 'accent-purple-500',
  cyan: 'accent-cyan-500',
}

export function SliderInput({
  label,
  value,
  min,
  max,
  step = 0.1,
  unit,
  color = 'blue',
  onChange,
  disabled = false,
}: SliderInputProps) {
  const percentage = ((value - min) / (max - min)) * 100

  return (
    <div className={clsx('space-y-1', disabled && 'opacity-50')}>
      <div className="flex justify-between items-center">
        <label className="text-xs font-medium text-slate-600">{label}</label>
        <span className="text-sm font-bold text-slate-800">
          {value.toFixed(step < 1 ? 1 : 0)}
          {unit && <span className="text-xs text-slate-500 ml-1">{unit}</span>}
        </span>
      </div>
      <div className="relative">
        <div className="w-full h-2 bg-white/30 rounded-full overflow-hidden backdrop-blur-sm">
          <div
            className="h-full rounded-full transition-all duration-150"
            style={{
              width: `${percentage}%`,
              background: `linear-gradient(90deg, ${
                color === 'blue' ? '#3B82F6, #06B6D4' :
                color === 'green' ? '#22C55E, #10B981' :
                color === 'amber' ? '#F59E0B, #F97316' :
                color === 'purple' ? '#8B5CF6, #A855F7' :
                '#06B6D4, #0891B2'
              })`,
            }}
          />
        </div>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className={clsx(
            'absolute inset-0 w-full opacity-0 cursor-pointer',
            colorClasses[color],
            disabled && 'cursor-not-allowed'
          )}
          style={{ height: '8px' }}
        />
      </div>
      <div className="flex justify-between text-xs text-slate-400">
        <span>{min}{unit}</span>
        <span>{max}{unit}</span>
      </div>
    </div>
  )
}
