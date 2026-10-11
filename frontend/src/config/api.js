/**
 * Centralized API and WebSocket Base URL Configuration
 *
 * Supports Vite environment variables:
 * - VITE_API_BASE_URL (defaults to http://localhost:8000)
 * - VITE_WS_BASE_URL (defaults to derived ws:// or wss:// from API base URL)
 */

export function trimTrailingSlash(url) {
  if (!url || typeof url !== 'string') return ''
  return url.trim().replace(/\/+$/, '')
}

export function deriveWsUrl(apiUrl) {
  const trimmed = trimTrailingSlash(apiUrl)
  if (!trimmed) return 'ws://localhost:8000'
  if (trimmed.startsWith('https://')) {
    return 'wss://' + trimmed.slice('https://'.length)
  }
  if (trimmed.startsWith('http://')) {
    return 'ws://' + trimmed.slice('http://'.length)
  }
  if (trimmed.startsWith('wss://') || trimmed.startsWith('ws://')) {
    return trimmed
  }
  return `ws://${trimmed}`
}

// In standard Vite / Node environments:
const rawApiBase = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL)
  ? import.meta.env.VITE_API_BASE_URL
  : (typeof process !== 'undefined' && process.env?.VITE_API_BASE_URL)
    ? process.env.VITE_API_BASE_URL
    : 'http://localhost:8000'

const rawWsBase = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_WS_BASE_URL)
  ? import.meta.env.VITE_WS_BASE_URL
  : (typeof process !== 'undefined' && process.env?.VITE_WS_BASE_URL)
    ? process.env.VITE_WS_BASE_URL
    : ''

export const API_BASE_URL = trimTrailingSlash(rawApiBase) || 'http://localhost:8000'
export const WS_BASE_URL = trimTrailingSlash(rawWsBase) || deriveWsUrl(API_BASE_URL)
