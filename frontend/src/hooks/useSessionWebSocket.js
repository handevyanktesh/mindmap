import { useEffect, useRef, useState, useCallback } from 'react'
import { WS_BASE_URL } from '../config/api.js'

export const MAX_RECONNECT_ATTEMPTS = 5
export const BASE_RECONNECT_DELAY_MS = 1000
export const MAX_RECONNECT_DELAY_MS = 10000
export const BACKOFF_FACTOR = 1.5

/**
 * Computes exponential backoff delay with jitter.
 */
export function computeReconnectDelay(
  attempt,
  baseDelay = BASE_RECONNECT_DELAY_MS,
  maxDelay = MAX_RECONNECT_DELAY_MS,
  factor = BACKOFF_FACTOR,
  jitter = true
) {
  const exp = Math.min(maxDelay, baseDelay * Math.pow(factor, attempt))
  const randJitter = jitter ? Math.floor(Math.random() * 250) : 0
  return Math.min(maxDelay, Math.floor(exp + randJitter))
}

/**
 * Hook for managing an authenticated session WebSocket with bounded reconnection.
 *
 * Connection States:
 * - 'idle': Hook disabled or missing required credentials.
 * - 'connecting': Initial handshake in progress.
 * - 'connected': WebSocket is open and active.
 * - 'reconnecting': Transport dropped; backoff retry scheduled.
 * - 'disconnected': Cleanly terminated or intentionally closed.
 * - 'failed': Terminal rejection (e.g. policy 1008) or retry limit exhausted.
 */
export function useSessionWebSocket(sessionId, token, enabled = true, WebSocketClass = (typeof WebSocket !== 'undefined' ? WebSocket : (typeof globalThis !== 'undefined' ? globalThis.WebSocket : null))) {
  const [connectionState, setConnectionState] = useState(enabled && sessionId && token ? 'connecting' : 'idle')
  const [lastMessage, setLastMessage] = useState(null)
  const [retryCount, setRetryCount] = useState(0)
  const [error, setError] = useState(null)

  const wsRef = useRef(null)
  const reconnectTimerRef = useRef(null)
  const generationRef = useRef(0)
  const isIntentionalCloseRef = useRef(false)
  const isSessionTerminatedRef = useRef(false)

  // Keep latest enabled/sessionId/token accessible in async callbacks
  const stateRef = useRef({ enabled, sessionId, token })
  useEffect(() => {
    stateRef.current = { enabled, sessionId, token }
  }, [enabled, sessionId, token])

  useEffect(() => {
    // If disabled or missing credentials, shut down any active connection cleanly
    if (!enabled || !sessionId || !token) {
      isIntentionalCloseRef.current = true
      generationRef.current += 1

      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current)
        reconnectTimerRef.current = null
      }

      if (wsRef.current) {
        const ws = wsRef.current
        ws.onopen = null
        ws.onmessage = null
        ws.onclose = null
        ws.onerror = null
        if (ws.readyState === 1 /* OPEN */ || ws.readyState === 0 /* CONNECTING */) {
          try {
            ws.close(1000, 'Disabled')
          } catch (_) {
            // Ignore close error during teardown
          }
        }
        wsRef.current = null
      }

      setConnectionState('idle')
      setRetryCount(0)
      setError(null)
      return
    }

    if (!WebSocketClass) {
      setConnectionState('failed')
      setError('WebSocket is not supported in this environment')
      return
    }

    // Reset termination flag for new active session
    isSessionTerminatedRef.current = false
    isIntentionalCloseRef.current = false

    const connect = (attempt = 0) => {
      // Guard against stale triggers
      const { enabled: isNowEnabled, sessionId: curSession, token: curToken } = stateRef.current
      if (!isNowEnabled || !curSession || !curToken || isSessionTerminatedRef.current || isIntentionalCloseRef.current) {
        setConnectionState('disconnected')
        return
      }

      // Generation token to invalidate stale callbacks from prior sockets
      const currentGen = ++generationRef.current

      // Clear any pending timer
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current)
        reconnectTimerRef.current = null
      }

      // Detach and close prior socket if one exists
      if (wsRef.current) {
        const prevWs = wsRef.current
        prevWs.onopen = null
        prevWs.onmessage = null
        prevWs.onclose = null
        prevWs.onerror = null
        if (prevWs.readyState === 1 || prevWs.readyState === 0) {
          try {
            prevWs.close(1000, 'Replacing socket')
          } catch (_) {
            // Ignore close error during replacement
          }
        }
        wsRef.current = null
      }

      if (attempt === 0) {
        setConnectionState('connecting')
        setError(null)
        setRetryCount(0)
      } else {
        setConnectionState('reconnecting')
        setRetryCount(attempt)
      }

      const wsUrl = `${WS_BASE_URL}/ws/sessions/${curSession}?token=${curToken}`
      let ws
      try {
        ws = new WebSocketClass(wsUrl)
        wsRef.current = ws
      } catch (err) {
        setConnectionState('failed')
        setError(err.message || 'Failed to initialize WebSocket')
        return
      }

      ws.onopen = () => {
        if (currentGen !== generationRef.current) return
        setConnectionState('connected')
        setRetryCount(0)
        setError(null)
      }

      ws.onmessage = (event) => {
        if (currentGen !== generationRef.current) return
        try {
          const data = JSON.parse(event.data)
          if (data && data.type === 'session_ended') {
            isSessionTerminatedRef.current = true
          }
          setLastMessage(data)
        } catch (err) {
          console.error('WebSocket JSON parse error:', err)
        }
      }

      ws.onerror = (_event) => {
        if (currentGen !== generationRef.current) return
        // Do not leak token/url in error logging
        console.warn('WebSocket connection encountered an error')
      }

      ws.onclose = (event) => {
        if (currentGen !== generationRef.current) return

        // Detach listeners and clear active socket reference
        ws.onopen = null
        ws.onmessage = null
        ws.onclose = null
        ws.onerror = null
        if (wsRef.current === ws) {
          wsRef.current = null
        }

        // 1. Check intentional closure or session termination
        if (isIntentionalCloseRef.current || isSessionTerminatedRef.current || !stateRef.current.enabled) {
          setConnectionState('disconnected')
          return
        }

        // 2. Terminal server policy rejections (e.g. 1008 for unauthorized, session ended/scheduled, participant not active)
        if (event.code === 1008) {
          setConnectionState('failed')
          setError(event.reason || 'Session policy rejection or unauthorized')
          return
        }

        // 3. Normal clean closure by server
        if (event.code === 1000) {
          setConnectionState('disconnected')
          return
        }

        // 4. Abnormal transport failures (e.g. 1006, 1001, drop)
        if (attempt >= MAX_RECONNECT_ATTEMPTS) {
          setConnectionState('failed')
          setError(`Connection lost: maximum retry attempts exceeded (${MAX_RECONNECT_ATTEMPTS}/${MAX_RECONNECT_ATTEMPTS})`)
          return
        }

        // Schedule exponential backoff reconnect
        const nextAttempt = attempt + 1
        setConnectionState('reconnecting')
        setRetryCount(nextAttempt)

        const delay = computeReconnectDelay(attempt)
        reconnectTimerRef.current = setTimeout(() => {
          connect(nextAttempt)
        }, delay)
      }
    }

    connect(0)

    return () => {
      generationRef.current += 1
      isIntentionalCloseRef.current = true

      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current)
        reconnectTimerRef.current = null
      }

      if (wsRef.current) {
        const ws = wsRef.current
        ws.onopen = null
        ws.onmessage = null
        ws.onclose = null
        ws.onerror = null
        if (ws.readyState === 1 || ws.readyState === 0) {
          try {
            ws.close(1000, 'Unmount')
          } catch (_) {
            // Ignore close error during unmount
          }
        }
        wsRef.current = null
      }
    }
  }, [sessionId, token, enabled, WebSocketClass])

  const sendPing = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === 1) {
      wsRef.current.send(JSON.stringify({ type: 'ping' }))
    }
  }, [])

  const sendBehaviourUpdate = useCallback((payload) => {
    if (
      wsRef.current &&
      wsRef.current.readyState === 1 &&
      payload &&
      !isSessionTerminatedRef.current
    ) {
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

  const isConnected = connectionState === 'connected'

  return {
    isConnected,
    connectionState,
    lastMessage,
    retryCount,
    error,
    sendPing,
    sendBehaviourUpdate
  }
}
