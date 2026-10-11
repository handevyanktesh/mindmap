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

  const sendBehaviourUpdate = useCallback((payload) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && payload) {
      wsRef.current.send(JSON.stringify({
        type: 'student_behaviour_update',
        payload: {
          engagement_state: payload.engagement_state,
          confusion_signal: payload.confusion_signal,
          confidence: typeof payload.confidence === 'number' ? payload.confidence : 0.0
        }
      }))
    }
  }, [])

  return { isConnected, lastMessage, sendPing, sendBehaviourUpdate }
}
