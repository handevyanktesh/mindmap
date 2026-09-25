import { useEffect, useRef, useState, useCallback } from 'react'

export function useSessionWebSocket(sessionId, token, enabled = true) {
  const [isConnected, setIsConnected] = useState(false)
  const [lastMessage, setLastMessage] = useState(null)
  const wsRef = useRef(null)

  useEffect(() => {
    if (!enabled || !sessionId || !token) {
      setIsConnected(false)
      return
    }

    const wsUrl = `ws://localhost:8000/ws/sessions/${sessionId}?token=${token}`
    const ws = new WebSocket(wsUrl)
    wsRef.current = ws

    ws.onopen = () => {
      setIsConnected(true)
    }

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        setLastMessage(data)
      } catch (err) {
        console.error('WebSocket JSON parse error:', err)
      }
    }

    ws.onclose = () => {
      setIsConnected(false)
    }

    ws.onerror = (err) => {
      console.error('WebSocket connection error:', err)
      setIsConnected(false)
    }

    return () => {
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close()
      }
      wsRef.current = null
      setIsConnected(false)
    }
  }, [sessionId, token, enabled])

  const sendPing = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'ping' }))
    }
  }, [])

  return { isConnected, lastMessage, sendPing }
}
