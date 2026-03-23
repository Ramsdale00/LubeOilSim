import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
  ReferenceLine,
} from 'recharts'

interface DataPoint {
  index: number
  value: number
  upper?: number
  lower?: number
  timestamp?: string
}

interface RealtimeLineChartProps {
  data: DataPoint[]
  dataKey?: string
  label?: string
  color?: string
  showConfidence?: boolean
  specMin?: number
  specMax?: number
  unit?: string
  height?: number
  smooth?: boolean
}

const defaultColors = {
  stroke: '#3B82F6',
  fill: 'rgba(59, 130, 246, 0.15)',
  confidence: 'rgba(59, 130, 246, 0.08)',
}

export function RealtimeLineChart({
  data,
  color = '#3B82F6',
  label,
  showConfidence = false,
  specMin,
  specMax,
  unit,
  height = 180,
}: RealtimeLineChartProps) {
  const displayData = data.slice(-60)

  const CustomTooltip = ({
    active,
    payload,
  }: {
    active?: boolean
    payload?: Array<{ value: number; name: string }>
  }) => {
    if (active && payload && payload.length) {
      return (
        <div className="glass-card px-3 py-2 text-xs">
          <p className="font-bold text-slate-800">
            {payload[0].value.toFixed(2)}{unit && ` ${unit}`}
          </p>
          {showConfidence && payload[1] && (
            <p className="text-slate-500">
              ±{((payload[1].value - payload[0].value) / 2).toFixed(2)}
            </p>
          )}
        </div>
      )
    }
    return null
  }

  if (showConfidence) {
    return (
      <div>
        {label && (
          <p className="text-xs font-medium text-slate-500 mb-2">{label}</p>
        )}
        <ResponsiveContainer width="100%" height={height}>
          <AreaChart data={displayData} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id={`grad-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.25} />
                <stop offset="95%" stopColor={color} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
            <XAxis dataKey="index" hide />
            <YAxis
              tick={{ fontSize: 10, fill: '#94A3B8' }}
              axisLine={false}
              tickLine={false}
              width={40}
              tickFormatter={(v) => `${v}${unit ? unit : ''}`}
            />
            <Tooltip content={<CustomTooltip />} />
            {specMin !== undefined && (
              <ReferenceLine y={specMin} stroke="#FBBF24" strokeDasharray="4 2" strokeWidth={1.5} />
            )}
            {specMax !== undefined && (
              <ReferenceLine y={specMax} stroke="#FBBF24" strokeDasharray="4 2" strokeWidth={1.5} />
            )}
            <Area
              type="monotone"
              dataKey="upper"
              stroke="none"
              fill={`rgba(${parseInt(color.slice(1,3),16)},${parseInt(color.slice(3,5),16)},${parseInt(color.slice(5,7),16)},0.1)`}
              isAnimationActive={false}
            />
            <Area
              type="monotone"
              dataKey="lower"
              stroke="none"
              fill="white"
              isAnimationActive={false}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke={color}
              strokeWidth={2}
              fill={`url(#grad-${color.replace('#', '')})`}
              dot={false}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    )
  }

  return (
    <div>
      {label && (
        <p className="text-xs font-medium text-slate-500 mb-2">{label}</p>
      )}
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={displayData} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={`grad-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.25} />
              <stop offset="95%" stopColor={color} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
          <XAxis dataKey="index" hide />
          <YAxis
            tick={{ fontSize: 10, fill: '#94A3B8' }}
            axisLine={false}
            tickLine={false}
            width={40}
            tickFormatter={(v) => `${v}${unit ? unit : ''}`}
          />
          <Tooltip content={<CustomTooltip />} />
          {specMin !== undefined && (
            <ReferenceLine y={specMin} stroke="#FBBF24" strokeDasharray="4 2" strokeWidth={1.5} />
          )}
          {specMax !== undefined && (
            <ReferenceLine y={specMax} stroke="#FBBF24" strokeDasharray="4 2" strokeWidth={1.5} />
          )}
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2}
            fill={`url(#grad-${color.replace('#', '')})`}
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
