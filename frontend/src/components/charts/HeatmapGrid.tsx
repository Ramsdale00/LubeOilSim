import type { HeatmapCell } from '@/types'

interface HeatmapGridProps {
  cells: HeatmapCell[]
  rows: number
  cols: number
  width?: number
  height?: number
  colorScale?: 'blue' | 'heat' | 'energy'
}

function getColor(value: number, scale: string): string {
  const clamped = Math.max(0, Math.min(1, value))

  if (scale === 'heat') {
    const r = Math.round(clamped * 248 + (1 - clamped) * 74)
    const g = Math.round(clamped * 113 + (1 - clamped) * 222)
    const b = Math.round(clamped * 113 + (1 - clamped) * 128)
    return `rgba(${r},${g},${b},0.8)`
  }

  if (scale === 'energy') {
    // Green → Yellow → Red
    if (clamped < 0.5) {
      const t = clamped * 2
      const r = Math.round(t * 251)
      const g = Math.round(74 + t * (191 - 74))
      return `rgba(${r},${g},36,0.8)`
    } else {
      const t = (clamped - 0.5) * 2
      const g = Math.round(191 * (1 - t))
      return `rgba(248,${g},36,0.8)`
    }
  }

  // Blue scale
  const intensity = Math.round(clamped * 200 + 55)
  return `rgba(59,${Math.round(130 * (1 - clamped * 0.5))},${intensity},${0.3 + clamped * 0.6})`
}

export function HeatmapGrid({
  cells,
  rows,
  cols,
  width = 400,
  height = 200,
  colorScale = 'energy',
}: HeatmapGridProps) {
  const cellWidth = width / cols
  const cellHeight = height / rows
  const padding = 2

  const maxValue = Math.max(...cells.map((c) => c.value), 1)

  return (
    <svg width={width} height={height} className="rounded-xl overflow-hidden">
      {cells.map((cell) => {
        const x = cell.x * cellWidth
        const y = cell.y * cellHeight
        const normalized = cell.value / maxValue
        const fill = getColor(normalized, colorScale)

        return (
          <g key={`${cell.x}-${cell.y}`}>
            <rect
              x={x + padding}
              y={y + padding}
              width={cellWidth - padding * 2}
              height={cellHeight - padding * 2}
              rx={4}
              fill={fill}
              className="transition-all duration-500"
            />
            {cellWidth > 40 && cellHeight > 24 && (
              <text
                x={x + cellWidth / 2}
                y={y + cellHeight / 2}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={9}
                fill="rgba(30,41,59,0.8)"
                fontWeight="600"
              >
                {cell.label}
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}
