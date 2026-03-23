import React from 'react'
import { clsx } from 'clsx'
import { motion } from 'framer-motion'

type GlowColor = 'blue' | 'green' | 'amber' | 'red' | 'purple' | 'none'

interface GlassCardProps {
  children: React.ReactNode
  className?: string
  glow?: GlowColor
  hoverable?: boolean
  animated?: boolean
  onClick?: () => void
}

const glowClasses: Record<GlowColor, string> = {
  blue: 'glow-blue',
  green: 'glow-green',
  amber: 'glow-amber',
  red: 'glow-red',
  purple: 'glow-purple',
  none: '',
}

export function GlassCard({
  children,
  className,
  glow = 'none',
  hoverable = false,
  animated = false,
  onClick,
}: GlassCardProps) {
  const baseClasses = clsx(
    'glass-card',
    glowClasses[glow],
    hoverable && 'transition-all duration-300 hover:bg-white/30 hover:border-white/50 hover:shadow-2xl cursor-pointer',
    className
  )

  if (animated) {
    return (
      <motion.div
        className={baseClasses}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        onClick={onClick}
      >
        {children}
      </motion.div>
    )
  }

  return (
    <div className={baseClasses} onClick={onClick}>
      {children}
    </div>
  )
}
