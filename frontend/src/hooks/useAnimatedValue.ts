import { useState, useEffect, useRef } from 'react'

export function useAnimatedValue(
  target: number,
  duration = 600,
  decimals = 1
): number {
  const [current, setCurrent] = useState(target)
  const startRef = useRef(target)
  const startTimeRef = useRef<number | null>(null)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    const startValue = current
    startRef.current = startValue
    startTimeRef.current = null

    const animate = (timestamp: number) => {
      if (startTimeRef.current === null) {
        startTimeRef.current = timestamp
      }

      const elapsed = timestamp - startTimeRef.current
      const progress = Math.min(elapsed / duration, 1)

      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      const value = startValue + (target - startValue) * eased

      const factor = Math.pow(10, decimals)
      setCurrent(Math.round(value * factor) / factor)

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate)
      }
    }

    rafRef.current = requestAnimationFrame(animate)

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, duration, decimals])

  return current
}

export function useAnimatedCounter(
  target: number,
  duration = 1000
): number {
  return useAnimatedValue(target, duration, 0)
}
