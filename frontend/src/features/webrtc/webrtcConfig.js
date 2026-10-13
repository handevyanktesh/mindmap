/**
 * WebRTC ICE Configuration for MindMap Classroom Media Transport
 */

export const DEFAULT_ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' }
]

export function getIceServers() {
  if (typeof window !== 'undefined' && window.__ICE_SERVERS__) {
    return window.__ICE_SERVERS__
  }
  try {
    const envIce = import.meta.env?.VITE_ICE_SERVERS
    if (envIce) {
      return JSON.parse(envIce)
    }
  } catch (_) {
    // Fallback to standard Google STUN servers
  }
  return DEFAULT_ICE_SERVERS
}
