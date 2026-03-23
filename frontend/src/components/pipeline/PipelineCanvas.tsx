import { useState, useRef, useEffect } from 'react'
import { useTankStore } from '@/store/tankStore'
import { useBlendStore } from '@/store/blendStore'
import type { Tank } from '@/types'

interface PipelineCanvasProps {
  width?: number
  height?: number
  compact?: boolean
}

const MATERIAL_COLORS: Record<string, string> = {
  base_oil: '#3B82F6',
  viscosity_modifier: '#8B5CF6',
  antioxidant: '#EC4899',
  detergent: '#F59E0B',
  pour_point_depressant: '#10B981',
  finished_product: '#22D3EE',
}

const MATERIAL_LABELS: Record<string, string> = {
  base_oil: 'Base Oil',
  viscosity_modifier: 'VM',
  antioxidant: 'AO',
  detergent: 'Det',
  pour_point_depressant: 'PPD',
  finished_product: 'FP',
}

function TankIcon({
  tank,
  x,
  y,
  size = 60,
  onClick,
  selected,
}: {
  tank: Tank
  x: number
  y: number
  size?: number
  onClick?: () => void
  selected?: boolean
}) {
  const fillHeight = (tank.fill_percent / 100) * (size * 0.55)
  const color = MATERIAL_COLORS[tank.material] || '#64748B'
  const label = MATERIAL_LABELS[tank.material] || '?'
  const w = size * 0.55
  const h = size * 0.65
  const tankX = x - w / 2
  const tankY = y - h / 2 + 8

  const tempGlow = tank.temperature_c > 80 ? 'rgba(251,191,36,0.4)' :
                   tank.temperature_c > 60 ? 'rgba(96,165,250,0.3)' : 'rgba(96,165,250,0.1)'

  return (
    <g
      className="cursor-pointer"
      onClick={onClick}
      style={{ filter: selected ? `drop-shadow(0 0 8px ${color})` : undefined }}
    >
      {/* Tank body */}
      <rect
        x={tankX}
        y={tankY}
        width={w}
        height={h}
        rx={4}
        fill="rgba(255,255,255,0.6)"
        stroke={selected ? color : 'rgba(148,163,184,0.4)'}
        strokeWidth={selected ? 2 : 1}
      />
      {/* Liquid fill */}
      <clipPath id={`clip-${tank.id}`}>
        <rect x={tankX + 1} y={tankY + 1} width={w - 2} height={h - 2} rx={3} />
      </clipPath>
      <rect
        x={tankX + 1}
        y={tankY + h - fillHeight - 1}
        width={w - 2}
        height={fillHeight}
        fill={`${color}60`}
        clipPath={`url(#clip-${tank.id})`}
        className="transition-all duration-1000"
      />
      {/* Temperature tint */}
      <rect
        x={tankX}
        y={tankY}
        width={w}
        height={h}
        rx={4}
        fill={tempGlow}
        stroke="none"
        opacity={0.5}
      />
      {/* Label */}
      <text
        x={x}
        y={tankY + h / 2 - 4}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={10}
        fontWeight="700"
        fill={color}
      >
        {label}
      </text>
      <text
        x={x}
        y={tankY + h / 2 + 8}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={8}
        fill="rgba(30,41,59,0.6)"
      >
        {tank.fill_percent.toFixed(0)}%
      </text>
      {/* Status dot */}
      {tank.status === 'critical' || tank.status === 'low' ? (
        <circle
          cx={tankX + w - 4}
          cy={tankY + 4}
          r={4}
          fill={tank.status === 'critical' ? '#EF4444' : '#F59E0B'}
        >
          <animate attributeName="opacity" values="1;0.3;1" dur="1.5s" repeatCount="indefinite" />
        </circle>
      ) : null}
      {/* Tank name */}
      <text
        x={x}
        y={tankY + h + 12}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={9}
        fill="rgba(71,85,105,0.8)"
      >
        {tank.name}
      </text>
    </g>
  )
}

function AnimatedPipe({
  x1, y1, x2, y2,
  color,
  active,
}: {
  x1: number; y1: number; x2: number; y2: number
  color: string; active: boolean
}) {
  const cx = (x1 + x2) / 2
  const d = `M ${x1} ${y1} C ${cx} ${y1}, ${cx} ${y2}, ${x2} ${y2}`

  return (
    <g>
      <path
        d={d}
        stroke="rgba(148,163,184,0.3)"
        strokeWidth={4}
        fill="none"
        strokeLinecap="round"
      />
      {active && (
        <>
          <path
            d={d}
            stroke={color}
            strokeWidth={3}
            fill="none"
            strokeLinecap="round"
            strokeDasharray="10 6"
            opacity={0.8}
          >
            <animate attributeName="stroke-dashoffset" from="16" to="0" dur="1.5s" repeatCount="indefinite" />
          </path>
          {/* Droplet */}
          <circle r={4} fill={color} opacity={0.9}>
            <animateMotion dur="2s" repeatCount="indefinite" path={d} />
          </circle>
        </>
      )}
    </g>
  )
}

export function PipelineCanvas({ width = 700, height = 380, compact = false }: PipelineCanvasProps) {
  const { tanks, selectedTank, selectTank } = useTankStore()
  const { pipelineActive, activeBatch } = useBlendStore()
  const [viewBox, setViewBox] = useState({ x: 0, y: 0, w: width, h: height })
  const [isPanning, setIsPanning] = useState(false)
  const panStart = useRef({ x: 0, y: 0, vbX: 0, vbY: 0 })
  const svgRef = useRef<SVGSVGElement>(null)

  // Blender position
  const blenderX = width / 2
  const blenderY = height / 2

  const tankSize = compact ? 48 : 60

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.target === svgRef.current) {
      setIsPanning(true)
      panStart.current = { x: e.clientX, y: e.clientY, vbX: viewBox.x, vbY: viewBox.y }
    }
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isPanning) return
    const dx = ((e.clientX - panStart.current.x) / width) * viewBox.w
    const dy = ((e.clientY - panStart.current.y) / height) * viewBox.h
    setViewBox((v) => ({ ...v, x: panStart.current.vbX - dx, y: panStart.current.vbY - dy }))
  }

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    const factor = e.deltaY > 0 ? 1.1 : 0.9
    setViewBox((v) => {
      const newW = Math.max(300, Math.min(1200, v.w * factor))
      const newH = Math.max(150, Math.min(800, v.h * factor))
      return { ...v, w: newW, h: newH }
    })
  }

  // Compute tank positions in the canvas space
  // Use normalized positions if available, else distribute in a circle
  const getTankCanvasPos = (tank: Tank, index: number, total: number) => {
    if (tank.position_x > 0 && tank.position_y > 0) {
      const scaleX = width / 900
      const scaleY = height / 600
      return { x: tank.position_x * scaleX, y: tank.position_y * scaleY }
    }
    // Default circular layout
    const angle = (index / total) * Math.PI * 2 - Math.PI / 2
    const rx = width * 0.35
    const ry = height * 0.38
    return {
      x: blenderX + Math.cos(angle) * rx,
      y: blenderY + Math.sin(angle) * ry,
    }
  }

  return (
    <div className="relative rounded-xl overflow-hidden" style={{ width, height }}>
      {/* Background grid */}
      <svg
        ref={svgRef}
        width={width}
        height={height}
        viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
        className="w-full h-full cursor-default"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={() => setIsPanning(false)}
        onMouseLeave={() => setIsPanning(false)}
        onWheel={handleWheel}
        style={{ background: 'rgba(248,250,252,0.6)' }}
      >
        {/* Grid pattern */}
        <defs>
          <pattern id="grid" width="30" height="30" patternUnits="userSpaceOnUse">
            <path d="M 30 0 L 0 0 0 30" fill="none" stroke="rgba(148,163,184,0.15)" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width={width * 3} height={height * 3} x={-width} y={-height} fill="url(#grid)" />

        {/* Pipes from tanks to blender */}
        {tanks.map((tank, index) => {
          const pos = getTankCanvasPos(tank, index, tanks.length)
          const matColor = MATERIAL_COLORS[tank.material] || '#64748B'
          const isSource = activeBatch?.ingredient_sequence?.includes(tank.material)
          return (
            <AnimatedPipe
              key={`pipe-${tank.id}`}
              x1={pos.x}
              y1={pos.y}
              x2={blenderX}
              y2={blenderY}
              color={matColor}
              active={pipelineActive && (isSource ?? false)}
            />
          )
        })}

        {/* Blender */}
        <g>
          <circle
            cx={blenderX}
            cy={blenderY}
            r={28}
            fill="rgba(255,255,255,0.8)"
            stroke={pipelineActive ? '#22D3EE' : 'rgba(148,163,184,0.5)'}
            strokeWidth={2}
          />
          {pipelineActive && (
            <circle cx={blenderX} cy={blenderY} r={34} fill="none" stroke="#22D3EE" strokeWidth={2} opacity={0.4}>
              <animate attributeName="r" values="28;38;28" dur="2s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.5;0;0.5" dur="2s" repeatCount="indefinite" />
            </circle>
          )}
          <text x={blenderX} y={blenderY - 4} textAnchor="middle" fontSize={10} fontWeight="700" fill="#22D3EE">
            BLEND
          </text>
          <text x={blenderX} y={blenderY + 8} textAnchor="middle" fontSize={8} fill="rgba(71,85,105,0.7)">
            {pipelineActive ? 'ACTIVE' : 'IDLE'}
          </text>
        </g>

        {/* Tanks */}
        {tanks.map((tank, index) => {
          const pos = getTankCanvasPos(tank, index, tanks.length)
          return (
            <TankIcon
              key={tank.id}
              tank={tank}
              x={pos.x}
              y={pos.y}
              size={tankSize}
              onClick={() => selectTank(tank)}
              selected={selectedTank?.id === tank.id}
            />
          )
        })}
      </svg>

      {/* Legend */}
      <div className="absolute bottom-2 right-2 glass-card px-3 py-2">
        <div className="flex flex-wrap gap-2">
          {Object.entries(MATERIAL_LABELS).slice(0, 5).map(([key, label]) => (
            <div key={key} className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full" style={{ background: MATERIAL_COLORS[key] }} />
              <span className="text-xs text-slate-500">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
