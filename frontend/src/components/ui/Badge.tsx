import { clsx } from 'clsx'

type BadgeVariant = 'info' | 'warning' | 'critical' | 'success' | 'neutral'

interface BadgeProps {
  label: string
  variant?: BadgeVariant
  size?: 'sm' | 'md'
}

const variantClasses: Record<BadgeVariant, string> = {
  info: 'bg-blue-100/80 text-blue-700 border-blue-200',
  warning: 'bg-amber-100/80 text-amber-700 border-amber-200',
  critical: 'bg-red-100/80 text-red-700 border-red-200',
  success: 'bg-green-100/80 text-green-700 border-green-200',
  neutral: 'bg-slate-100/80 text-slate-600 border-slate-200',
}

const sizeClasses = {
  sm: 'text-xs px-2 py-0.5',
  md: 'text-sm px-3 py-1',
}

export function Badge({ label, variant = 'neutral', size = 'sm' }: BadgeProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center font-semibold rounded-full border backdrop-blur-sm',
        variantClasses[variant],
        sizeClasses[size]
      )}
    >
      {label}
    </span>
  )
}
