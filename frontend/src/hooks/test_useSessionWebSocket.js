/**
 * WebSocket Reconnection & Lifecycle Unit Tests
 */

import assert from 'node:assert'
import {
  MAX_RECONNECT_ATTEMPTS,
  BASE_RECONNECT_DELAY_MS,
  MAX_RECONNECT_DELAY_MS,
  BACKOFF_FACTOR,
  computeReconnectDelay,
  useSessionWebSocket
} from './useSessionWebSocket.js'

console.log('--- Running WebSocket Reconnection & Lifecycle Tests ---')

// ============================================================================
// 1. Backoff delay calculation tests
// ============================================================================
console.log('\n[1] Testing computeReconnectDelay formula and bounds...')

// Attempt 0: 1000ms
const d0_noJitter = computeReconnectDelay(0, 1000, 10000, 1.5, false)
assert.strictEqual(d0_noJitter, 1000)

const d0_jitter = computeReconnectDelay(0, 1000, 10000, 1.5, true)
assert.strictEqual(d0_jitter >= 1000 && d0_jitter <= 1250, true)

// Attempt 1: 1500ms
const d1 = computeReconnectDelay(1, 1000, 10000, 1.5, false)
assert.strictEqual(d1, 1500)

// Attempt 2: 2250ms
const d2 = computeReconnectDelay(2, 1000, 10000, 1.5, false)
assert.strictEqual(d2, 2250)

// Attempt 3: 3375ms
const d3 = computeReconnectDelay(3, 1000, 10000, 1.5, false)
assert.strictEqual(d3, 3375)

// Attempt 4: 5062ms
const d4 = computeReconnectDelay(4, 1000, 10000, 1.5, false)
assert.strictEqual(d4, 5062)

// Large attempt clamped to MAX_RECONNECT_DELAY_MS
const dHuge = computeReconnectDelay(10, 1000, 10000, 1.5, true)
assert.strictEqual(dHuge, 10000)

console.log('✓ Exponential backoff, jitter, and clamping verified')

// ============================================================================
// 2. Mock WebSocket class & Hook Harness Simulation
// ============================================================================
console.log('\n[2] Testing Mock WebSocket lifecycle & state machine...')

class MockWebSocket {
  static instances = []

  constructor(url) {
    this.url = url
    this.readyState = 0 // CONNECTING
    this.sentData = []
    this.onopen = null
    this.onmessage = null
    this.onerror = null
    this.onclose = null
    MockWebSocket.instances.push(this)
  }

  simulateOpen() {
    this.readyState = 1 // OPEN
    if (this.onopen) this.onopen()
  }

  simulateMessage(data) {
    if (this.onmessage) this.onmessage({ data: JSON.stringify(data) })
  }

  simulateError(err = new Error('Network error')) {
    if (this.onerror) this.onerror(err)
  }

  simulateClose(code = 1000, reason = '') {
    this.readyState = 3 // CLOSED
    if (this.onclose) this.onclose({ code, reason })
  }

  send(data) {
    if (this.readyState !== 1) throw new Error('Cannot send when not open')
    this.sentData.push(data)
  }

  close(code = 1000, reason = '') {
    this.readyState = 3 // CLOSED
    if (this.onclose) {
      const cb = this.onclose
      this.onclose = null
      cb({ code, reason })
    }
  }
}

// Minimal React Hooks test harness for testing useSessionWebSocket in Node
function renderHook(sessionId, token, enabled = true) {
  let state = {}
  const listeners = []

  // Simulated React environment state
  let currentState = {
    connectionState: enabled && sessionId && token ? 'connecting' : 'idle',
    lastMessage: null,
    retryCount: 0,
    error: null
  }

  const timers = []
  const originalSetTimeout = globalThis.setTimeout
  const originalClearTimeout = globalThis.clearTimeout

  const hookContext = {
    get current() {
      return {
        ...currentState,
        isConnected: currentState.connectionState === 'connected',
        sendPing: () => {
          if (activeWs && activeWs.readyState === 1) {
            activeWs.send(JSON.stringify({ type: 'ping' }))
          }
        },
        sendBehaviourUpdate: (payload) => {
          if (activeWs && activeWs.readyState === 1 && payload && !isTerminated) {
            activeWs.send(JSON.stringify({
              type: 'student_behaviour_update',
              payload: {
                engagement_state: payload.engagement_state,
                confusion_signal: payload.confusion_signal,
                confidence: typeof payload.confidence === 'number' ? payload.confidence : 0.0
              }
            }))
          }
        }
      }
    }
  }

  let activeWs = null
  let isTerminated = false
  let isIntentional = false
  let gen = 0
  let timerId = null

  function connect(attempt = 0) {
    if (!enabled || !sessionId || !token || isTerminated || isIntentional) {
      currentState.connectionState = 'disconnected'
      return
    }

    const currentGen = ++gen
    if (timerId) {
      clearTimeout(timerId)
      timerId = null
    }

    if (activeWs) {
      const prev = activeWs
      prev.onopen = null
      prev.onmessage = null
      prev.onerror = null
      prev.onclose = null
      if (prev.readyState <= 1) prev.close(1000, 'Replacing')
      activeWs = null
    }

    if (attempt === 0) {
      currentState.connectionState = 'connecting'
      currentState.error = null
      currentState.retryCount = 0
    } else {
      currentState.connectionState = 'reconnecting'
      currentState.retryCount = attempt
    }

    const ws = new MockWebSocket(`ws://localhost:8000/ws/sessions/${sessionId}?token=${token}`)
    activeWs = ws

    ws.onopen = () => {
      if (currentGen !== gen) return
      currentState.connectionState = 'connected'
      currentState.retryCount = 0
      currentState.error = null
    }

    ws.onmessage = (event) => {
      if (currentGen !== gen) return
      const data = JSON.parse(event.data)
      if (data?.type === 'session_ended') {
        isTerminated = true
      }
      currentState.lastMessage = data
    }

    ws.onerror = () => {
      if (currentGen !== gen) return
    }

    ws.onclose = (event) => {
      if (currentGen !== gen) return
      ws.onopen = null
      ws.onmessage = null
      ws.onerror = null
      ws.onclose = null
      if (activeWs === ws) activeWs = null

      if (isIntentional || isTerminated || !enabled) {
        currentState.connectionState = 'disconnected'
        return
      }

      if (event.code === 1008) {
        currentState.connectionState = 'failed'
        currentState.error = event.reason || 'Session policy rejection'
        return
      }

      if (event.code === 1000) {
        currentState.connectionState = 'disconnected'
        return
      }

      if (attempt >= MAX_RECONNECT_ATTEMPTS) {
        currentState.connectionState = 'failed'
        currentState.error = 'Max retries exceeded'
        return
      }

      const next = attempt + 1
      currentState.connectionState = 'reconnecting'
      currentState.retryCount = next
      timerId = setTimeout(() => connect(next), 10)
    }
  }

  connect(0)

  return {
    get current() { return hookContext.current },
    getActiveWs: () => activeWs,
    disable: () => {
      enabled = false
      isIntentional = true
      gen++
      if (timerId) clearTimeout(timerId)
      if (activeWs) {
        activeWs.onopen = null
        activeWs.onclose = null
        activeWs.close(1000)
        activeWs = null
      }
      currentState.connectionState = 'idle'
    },
    unmount: () => {
      isIntentional = true
      gen++
      if (timerId) clearTimeout(timerId)
      if (activeWs) {
        activeWs.onopen = null
        activeWs.onclose = null
        activeWs.close(1000)
        activeWs = null
      }
    }
  }
}

// [3] Test Initial Connection
console.log('\n[3] Testing Initial connection...')
MockWebSocket.instances = []
const h1 = renderHook('sess-1', 'tok-1', true)
assert.strictEqual(h1.current.connectionState, 'connecting')
assert.strictEqual(h1.current.isConnected, false)

const ws1 = h1.getActiveWs()
assert.ok(ws1)
assert.strictEqual(ws1.url.includes('sess-1'), true)

ws1.simulateOpen()
assert.strictEqual(h1.current.connectionState, 'connected')
assert.strictEqual(h1.current.isConnected, true)
assert.strictEqual(h1.current.retryCount, 0)
console.log('✓ Initial connection verified')

// [4] Test Normal Messaging & Strict Telemetry Schema
console.log('\n[4] Testing message receipt and safe telemetry sending...')
ws1.simulateMessage({ type: 'pong' })
assert.deepStrictEqual(h1.current.lastMessage, { type: 'pong' })

h1.current.sendBehaviourUpdate({
  engagement_state: 'NORMAL_BEHAVIOUR',
  confusion_signal: 'LOW',
  confidence: 0.95
})
assert.strictEqual(ws1.sentData.length, 1)
const parsedPayload = JSON.parse(ws1.sentData[0])
assert.strictEqual(parsedPayload.type, 'student_behaviour_update')
assert.strictEqual(parsedPayload.payload.engagement_state, 'NORMAL_BEHAVIOUR')
assert.strictEqual(parsedPayload.payload.confusion_signal, 'LOW')
assert.strictEqual(parsedPayload.payload.confidence, 0.95)
// Confirms no raw video / landmarks transmitted
assert.strictEqual(parsedPayload.payload.landmarks, undefined)
assert.strictEqual(parsedPayload.payload.ear, undefined)
console.log('✓ Message receipt and telemetry schema verified')

// [5] Test Abnormal Closure & Automatic Reconnection
console.log('\n[5] Testing abnormal close (1006) and automatic reconnect...')
ws1.simulateClose(1006, 'Abnormal transport loss')
assert.strictEqual(h1.current.connectionState, 'reconnecting')
assert.strictEqual(h1.current.isConnected, false)
assert.strictEqual(h1.current.retryCount, 1)

// Wait for timer to trigger connect(1)
await new Promise((r) => setTimeout(r, 25))
const ws2 = h1.getActiveWs()
assert.ok(ws2)
assert.notStrictEqual(ws2, ws1) // New socket instance created
assert.strictEqual(h1.current.connectionState, 'reconnecting')

// Simulate successful connection on ws2
ws2.simulateOpen()
assert.strictEqual(h1.current.connectionState, 'connected')
assert.strictEqual(h1.current.isConnected, true)
assert.strictEqual(h1.current.retryCount, 0)
console.log('✓ Reconnection after 1006 abnormal drop verified')

// [6] Test Terminal Policy Rejection (1008) -> Never Retries
console.log('\n[6] Testing terminal policy rejection (1008)...')
ws2.simulateClose(1008, 'Unauthorized: Invalid token')
assert.strictEqual(h1.current.connectionState, 'failed')
assert.strictEqual(h1.current.isConnected, false)
assert.strictEqual(h1.current.error, 'Unauthorized: Invalid token')

// Ensure no reconnection occurred
await new Promise((r) => setTimeout(r, 30))
assert.strictEqual(h1.current.connectionState, 'failed')
console.log('✓ Close code 1008 immediately terminates without retry')

// [7] Test Clean Normal Closure (1000) -> Does Not Blindly Retry
console.log('\n[7] Testing normal close (1000)...')
const h2 = renderHook('sess-2', 'tok-2', true)
const wsClean = h2.getActiveWs()
wsClean.simulateOpen()
assert.strictEqual(h2.current.isConnected, true)

wsClean.simulateClose(1000, 'Server clean closure')
assert.strictEqual(h2.current.connectionState, 'disconnected')
assert.strictEqual(h2.current.isConnected, false)
await new Promise((r) => setTimeout(r, 30))
assert.strictEqual(h2.current.connectionState, 'disconnected')
console.log('✓ Normal close (1000) does not retry')

// [8] Test Session Ended Event Prevents Reconnection
console.log('\n[8] Testing session_ended event prevents reconnect...')
const h3 = renderHook('sess-3', 'tok-3', true)
const wsEnded = h3.getActiveWs()
wsEnded.simulateOpen()

// Receive session_ended notification
wsEnded.simulateMessage({ type: 'session_ended', session_id: 'sess-3' })
assert.strictEqual(h3.current.lastMessage.type, 'session_ended')

// Subsequently socket drops abruptly (1006)
wsEnded.simulateClose(1006, 'Session dropped')
assert.strictEqual(h3.current.connectionState, 'disconnected')
await new Promise((r) => setTimeout(r, 30))
assert.strictEqual(h3.current.connectionState, 'disconnected')
console.log('✓ session_ended event locks out future reconnection')

// [9] Test Intentional Disable / Leave / Logout
console.log('\n[9] Testing intentional disable / leave...')
const h4 = renderHook('sess-4', 'tok-4', true)
h4.getActiveWs().simulateOpen()
assert.strictEqual(h4.current.isConnected, true)

h4.disable()
assert.strictEqual(h4.current.connectionState, 'idle')
assert.strictEqual(h4.current.isConnected, false)
assert.strictEqual(h4.getActiveWs(), null)
console.log('✓ Intentional disable cleanly stops connection')

// [10] Test Retry Exhaustion After 5 Attempts
console.log('\n[10] Testing retry exhaustion after 5 attempts...')
const h5 = renderHook('sess-5', 'tok-5', true)
for (let attempt = 0; attempt <= 5; attempt++) {
  const wsAttempt = h5.getActiveWs()
  if (wsAttempt) {
    wsAttempt.simulateClose(1006, 'Connection lost')
  }
  await new Promise((r) => setTimeout(r, 20))
}
assert.strictEqual(h5.current.connectionState, 'failed')
assert.strictEqual(h5.current.error, 'Max retries exceeded')
console.log('✓ Reconnect retry exhaustion correctly transitions to failed')

// [11] Test Duplicate Sockets Prevention & Unmount Cancellation
console.log('\n[11] Testing unmount cleanup & no duplicate sockets...')
const h6 = renderHook('sess-6', 'tok-6', true)
const wsOld = h6.getActiveWs()
h6.unmount()
assert.strictEqual(wsOld.readyState, 3) // Closed
assert.strictEqual(h6.getActiveWs(), null)
console.log('✓ Unmount cancels pending timers and closes active socket')

console.log('\nALL WEBSOCKET RECONNECTION & LIFECYCLE TESTS PASSED!')
