import {
  RadarChart as RechartsRadarChart,
  PolarGrid,
  PolarAngleAxis,
  Radar,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'

interface RadarDataPoint {
  subject: string
  value: number
  fullMark?: number
}

interface RadarChartProps {
  data: RadarDataPoint[]
  color?: string
  height?: number
}

export function RadarChart({ data, color = '#3B82F6', height = 220 }: RadarChartProps) {
  const r = parseInt(color.slice(1, 3), 16)
  const g = parseInt(color.slice(3, 5), 16)
  const b = parseInt(color.slice(5, 7), 16)

  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartsRadarChart data={data} margin={{ top: 10, right: 20, bottom: 10, left: 20 }}>
        <PolarGrid stroke="rgba(148,163,184,0.3)" />
        <PolarAngleAxis
          dataKey="subject"
          tick={{ fontSize: 11, fill: '#64748B', fontWeight: 500 }}
        />
        <Tooltip
          contentStyle={{
            background: 'rgba(255,255,255,0.9)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255,255,255,0.3)',
            borderRadius: '12px',
            fontSize: '12px',
          }}
          formatter={(value: number) => [`${value.toFixed(1)}`, '']}
        />
        <Radar
          name="Quality"
          dataKey="value"
          stroke={color}
          fill={`rgba(${r},${g},${b},0.25)`}
          strokeWidth={2}
        />
      </RechartsRadarChart>
    </ResponsiveContainer>
  )
}
