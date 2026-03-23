import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'

interface LineConfig {
  key: string
  label: string
  color: string
  dashed?: boolean
}

interface MultiLineChartProps {
  data: Record<string, number | string>[]
  lines: LineConfig[]
  height?: number
  xKey?: string
  unit?: string
}

export function MultiLineChart({
  data,
  lines,
  height = 220,
  xKey = 'index',
  unit,
}: MultiLineChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
        <XAxis
          dataKey={xKey}
          tick={{ fontSize: 10, fill: '#94A3B8' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 10, fill: '#94A3B8' }}
          axisLine={false}
          tickLine={false}
          width={45}
          tickFormatter={(v) => `${v}${unit ?? ''}`}
        />
        <Tooltip
          contentStyle={{
            background: 'rgba(255,255,255,0.9)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255,255,255,0.3)',
            borderRadius: '12px',
            fontSize: '12px',
          }}
          formatter={(value: number) => [`${value.toFixed(2)}${unit ?? ''}`, '']}
        />
        <Legend
          wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }}
        />
        {lines.map((line) => (
          <Line
            key={line.key}
            type="monotone"
            dataKey={line.key}
            name={line.label}
            stroke={line.color}
            strokeWidth={2}
            strokeDasharray={line.dashed ? '6 3' : undefined}
            dot={false}
            isAnimationActive={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}
