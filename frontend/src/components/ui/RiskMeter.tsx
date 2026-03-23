import { useEffect, useRef } from 'react'
import { useAnimatedValue } from '@/hooks/useAnimatedValue'

interface RiskMeterProps {
  value: number
  size?: number
  showLabel?: boolean
}

function getRiskColor(risk: number): string {
  if (risk < 30) return '#4ADE80'
  if (risk < 70) return '#FBBF24'
  return '#F87171'
}

function getRiskLabel(risk: number): string {
  if (risk < 30) return 'LOW RISK'
  if (risk < 70) return 'MODERATE'
  return 'HIGH RISK'
}

export function RiskMeter({ value, size = 200, showLabel = true }: RiskMeterProps) {
  const animatedValue = useAnimatedValue(Math.min(100, Math.max(0, value)), 800)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    canvas.width = size * dpr
    canvas.height = (size / 2 + 30) * dpr
    ctx.scale(dpr, dpr)

    const cx = size / 2
    const cy = size / 2
    const radius = size * 0.38
    const strokeWidth = size * 0.08

    ctx.clearRect(0, 0, size, size)

    // Background arc
    ctx.beginPath()
    ctx.arc(cx, cy, radius, Math.PI, 0, false)
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.2)'
    ctx.lineWidth = strokeWidth
    ctx.lineCap = 'round'
    ctx.stroke()

    // Colored arc segments
    const segments = [
      { from: 0, to: 30, color: '#4ADE80' },
      { from: 30, to: 70, color: '#FBBF24' },
      { from: 70, to: 100, color: '#F87171' },
    ]

    segments.forEach(({ from, to, color }) => {
      const startAngle = Math.PI + (from / 100) * Math.PI
      const endAngle = Math.PI + (to / 100) * Math.PI
      ctx.beginPath()
      ctx.arc(cx, cy, radius, startAngle, endAngle, false)
      ctx.strokeStyle = color
      ctx.lineWidth = strokeWidth * 0.4
      ctx.globalAlpha = 0.3
      ctx.stroke()
      ctx.globalAlpha = 1
    })

    // Active arc
    const activeEndAngle = Math.PI + (animatedValue / 100) * Math.PI
    const activeColor = getRiskColor(animatedValue)

    const gradient = ctx.createLinearGradient(cx - radius, cy, cx + radius, cy)
    gradient.addColorStop(0, '#4ADE80')
    gradient.addColorStop(0.5, '#FBBF24')
    gradient.addColorStop(1, '#F87171')

    ctx.beginPath()
    ctx.arc(cx, cy, radius, Math.PI, activeEndAngle, false)
    ctx.strokeStyle = gradient
    ctx.lineWidth = strokeWidth
    ctx.lineCap = 'round'
    ctx.stroke()

    // Glow effect
    ctx.beginPath()
    ctx.arc(cx, cy, radius, Math.PI, activeEndAngle, false)
    ctx.strokeStyle = activeColor
    ctx.lineWidth = strokeWidth * 1.5
    ctx.globalAlpha = 0.2
    ctx.stroke()
    ctx.globalAlpha = 1

    // Needle
    const needleAngle = Math.PI + (animatedValue / 100) * Math.PI
    const needleLength = radius * 0.75
    const needleX = cx + Math.cos(needleAngle) * needleLength
    const needleY = cy + Math.sin(needleAngle) * needleLength

    ctx.beginPath()
    ctx.moveTo(cx, cy)
    ctx.lineTo(needleX, needleY)
    ctx.strokeStyle = activeColor
    ctx.lineWidth = 2
    ctx.globalAlpha = 1
    ctx.stroke()

    // Center dot
    ctx.beginPath()
    ctx.arc(cx, cy, 6, 0, Math.PI * 2)
    ctx.fillStyle = activeColor
    ctx.fill()

    // Value text
    ctx.fillStyle = activeColor
    ctx.font = `bold ${size * 0.12}px -apple-system, sans-serif`
    ctx.textAlign = 'center'
    ctx.fillText(`${Math.round(animatedValue)}%`, cx, cy + radius * 0.35)

  }, [animatedValue, size])

  const color = getRiskColor(animatedValue)
  const label = getRiskLabel(animatedValue)

  return (
    <div className="flex flex-col items-center">
      <canvas
        ref={canvasRef}
        style={{
          width: size,
          height: size / 2 + 30,
        }}
      />
      {showLabel && (
        <div
          className="text-xs font-bold tracking-widest mt-1"
          style={{ color }}
        >
          {label}
        </div>
      )}
    </div>
  )
}
