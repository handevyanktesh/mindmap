/**
 * API and WebSocket Configuration Unit Tests
 */

import assert from 'node:assert'
import {
  trimTrailingSlash,
  deriveWsUrl,
  API_BASE_URL,
  WS_BASE_URL
} from './api.js'

console.log('--- Running API & WebSocket Configuration Tests ---')

// [1] Trailing slash trimming
console.log('\n[1] Trailing slash trimming...')
assert.strictEqual(trimTrailingSlash('http://localhost:8000/'), 'http://localhost:8000')
assert.strictEqual(trimTrailingSlash('http://localhost:8000///'), 'http://localhost:8000')
assert.strictEqual(trimTrailingSlash('https://api.mindmap.internal'), 'https://api.mindmap.internal')
assert.strictEqual(trimTrailingSlash('  https://api.mindmap.internal/  '), 'https://api.mindmap.internal')
assert.strictEqual(trimTrailingSlash(''), '')
assert.strictEqual(trimTrailingSlash(null), '')
assert.strictEqual(trimTrailingSlash(undefined), '')
console.log('✓ trimTrailingSlash verified')

// [2] HTTP to WS and HTTPS to WSS derivation
console.log('\n[2] Protocol derivation...')
assert.strictEqual(deriveWsUrl('http://localhost:8000'), 'ws://localhost:8000')
assert.strictEqual(deriveWsUrl('http://localhost:8000/'), 'ws://localhost:8000')
assert.strictEqual(deriveWsUrl('http://127.0.0.1:8000'), 'ws://127.0.0.1:8000')
assert.strictEqual(deriveWsUrl('https://api.mindmap.org'), 'wss://api.mindmap.org')
assert.strictEqual(deriveWsUrl('https://api.mindmap.org:8443/'), 'wss://api.mindmap.org:8443')
assert.strictEqual(deriveWsUrl('ws://custom-ws.org:9000'), 'ws://custom-ws.org:9000')
assert.strictEqual(deriveWsUrl('wss://custom-secure.org:9000'), 'wss://custom-secure.org:9000')
assert.strictEqual(deriveWsUrl(''), 'ws://localhost:8000')
// Verify HTTPS NEVER produces insecure ws://
assert.strictEqual(deriveWsUrl('https://secure-host.com').startsWith('wss://'), true)
console.log('✓ Protocol derivation and HTTPS->WSS mapping verified')

// [3] Exported defaults
console.log('\n[3] Exported defaults validation...')
assert.strictEqual(typeof API_BASE_URL, 'string')
assert.strictEqual(typeof WS_BASE_URL, 'string')
assert.strictEqual(API_BASE_URL.endsWith('/'), false)
assert.strictEqual(WS_BASE_URL.endsWith('/'), false)
if (API_BASE_URL.startsWith('https://')) {
  assert.strictEqual(WS_BASE_URL.startsWith('wss://'), true)
} else if (API_BASE_URL.startsWith('http://')) {
  assert.strictEqual(WS_BASE_URL.startsWith('ws://'), true)
}
console.log('✓ Exported defaults verified')

console.log('\nALL API CONFIGURATION UNIT TESTS PASSED!')
