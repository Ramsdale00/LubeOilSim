import { type LucideIcon } from 'lucide-react'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { clsx } from 'clsx'
import { useAnimatedValue } from '@/hooks/useAnimatedValue'
import { GlassCard } from './GlassCard'
import { AreaChart, Area, ResponsiveContainer } from 'recharts'

interface KPITileProps {
  label: string
  value: number
  unit?: string
  trend?: 'up' | 'down' | 'stable'
  trendValue?: number
  color?: 'blue' | 'green' | 'amber' | 'red' | 'purple' | 'cyan'
  icon?: LucideIcon
  sparklineData?: number[]
  decimals?: number
}

const colorMap: Record<string, { text: string; bg: string; glow: string; stroke: string }> = {
  blue: {
    text: 'text-blue-600',
    bg: 'bg-blue-100/50',
    glow: 'blue' as const,
    stroke: '#3B82F6',
  },
  green: {
    text: 'text-green-600',
    bg: 'bg-green-100/50',
    glow: 'green' as const,
    stroke: '#22C55E',
  },
  amber: {
    text: 'text-amber-600',
    bg: 'bg-amber-100/50',
    glow: 'amber' as const,
    stroke: '#F59E0B',
  },
  red: {
    text: 'text-red-500',
    bg: 'bg-red-100/50',
    glow: 'red' as const,
    stroke: '#EF4444',
  },
  purple: {
    text: 'text-purple-600',
    bg: 'bg-purple-100/50',
    glow: 'purple' as const,
    stroke: '#8B5CF6',
  },
  cyan: {
    text: 'text-cyan-600',
    bg: 'bg-cyan-100/50',
    glow: 'none' as const,
    stroke: '#06B6D4',
  },
}

export function KPITile({
  label,
  value,
  unit,
  trend = 'stable',
  trendValue,
  color = 'blue',
  icon: Icon,
  sparklineData,
  decimals = 0,
}: KPITileProps) {
  const animatedValue = useAnimatedValue(value, 800, decimals)
  const colors = colorMap[color]

  const TrendIcon =
    trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus
  const trendColor =
    trend === 'up' ? 'text-green-500' : trend === 'down' ? 'text-red-500' : 'text-slate-400'

  const sparkData = sparklineData?.map((v, i) => ({ v, i })) ?? []

  return (
    <GlassCard className="p-4" glow={colors.glow as 'blue' | 'green' | 'amber' | 'red' | 'none'} hoverable>
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          {Icon && (
            <div className={clsx('p-2 rounded-xl', colors.bg)}>
              <Icon className={clsx('w-4 h-4', colors.text)} />
            </div>
          )}
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">
            {label}
          </span>
        </div>
        <div className={clsx('flex items-center gap-1', trendColor)}>
          <TrendIcon className="w-3.5 h-3.5" />
          {trendValue !== undefined && (
            <span className="text-xs font-medium">{trendValue > 0 ? '+' : ''}{trendValue.toFixed(1)}%</span>
          )}
        </div>
      </div>

      <div className="flex items-end justify-between">
        <div>
          <span className={clsx('text-2xl font-bold', colors.text)}>
            {animatedValue.toLocaleString(undefined, {
              minimumFractionDigits: decimals,
              maximumFractionDigits: decimals,
            })}
          </span>
          {unit && <span className="text-sm text-slate-500 ml-1">{unit}</span>}
        </div>
        {sparkData.length > 0 && (
          <div className="w-20 h-10">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={sparkData}>
                <defs>
                  <linearGradient id={`sparkGrad-${color}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={colors.stroke} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={colors.stroke} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="v"
                  stroke={colors.stroke}
                  strokeWidth={1.5}
                  fill={`url(#sparkGrad-${color})`}
                  dot={false}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </GlassCard>
  )
}
