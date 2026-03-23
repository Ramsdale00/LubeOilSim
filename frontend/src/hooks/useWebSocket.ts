import { useEffect, useRef, useState, useCallback } from 'react'

export type WSStatus = 'connecting' | 'connected' | 'disconnected' | 'error'

interface UseWebSocketReturn<T> {
  lastMessage: T | null
  status: WSStatus
  send: (data: unknown) => void
}

export function useWebSocket<T = unknown>(path: string): UseWebSocketReturn<T> {
  const [lastMessage, setLastMessage] = useState<T | null>(null)
  const [status, setStatus] = useState<WSStatus>('disconnected')
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const reconnectAttemptsRef = useRef(0)
  const mountedRef = useRef(true)

  const getBackoffDelay = (attempt: number): number => {
    const delay = Math.min(1000 * Math.pow(2, attempt), 30000)
    return delay
  }

  const connect = useCallback(() => {
    if (!mountedRef.current) return

    const wsUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws/${path}`

    try {
      setStatus('connecting')
      const ws = new WebSocket(wsUrl)
      wsRef.current = ws

      ws.onopen = () => {
        if (!mountedRef.current) return
        setStatus('connected')
        reconnectAttemptsRef.current = 0
      }

      ws.onmessage = (event) => {
        if (!mountedRef.current) return
        try {
          const parsed = JSON.parse(event.data) as T
          setLastMessage(parsed)
        } catch {
          // ignore parse errors
        }
      }

      ws.onerror = () => {
        if (!mountedRef.current) return
        setStatus('error')
      }

      ws.onclose = () => {
        if (!mountedRef.current) return
        setStatus('disconnected')
        wsRef.current = null

        const delay = getBackoffDelay(reconnectAttemptsRef.current)
        reconnectAttemptsRef.current += 1
        reconnectTimerRef.current = setTimeout(connect, delay)
      }
    } catch {
      setStatus('error')
      const delay = getBackoffDelay(reconnectAttemptsRef.current)
      reconnectAttemptsRef.current += 1
      reconnectTimerRef.current = setTimeout(connect, delay)
    }
  }, [path])

  useEffect(() => {
    mountedRef.current = true
    connect()

    return () => {
      mountedRef.current = false
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current)
      }
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
    }
  }, [connect])

  const send = useCallback((data: unknown) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data))
    }
  }, [])

  return { lastMessage, status, send }
}
