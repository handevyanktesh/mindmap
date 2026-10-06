/**
 * Temporal Statistics Utility
 *
 * Provides pure, reusable numerical statistical functions for time-series feature analysis.
 * Explicitly guards against null, undefined, NaN, Infinity, and empty sets.
 */

/**
 * Filters an array to only valid finite numbers.
 *
 * @param {Array<number|null|undefined>} values
 * @returns {number[]}
 */
export function filterValidNumbers(values) {
  if (!Array.isArray(values)) return []
  return values.filter((v) => typeof v === 'number' && Number.isFinite(v))
}

/**
 * Computes arithmetic mean of an array of numbers.
 *
 * @param {Array<number|null|undefined>} values
 * @returns {number | null} - Mean or null if no valid numbers
 */
export function calculateMean(values) {
  const valid = filterValidNumbers(values)
  if (valid.length === 0) return null
  const sum = valid.reduce((acc, v) => acc + v, 0)
  return sum / valid.length
}

/**
 * Computes population or sample variance of an array of numbers.
 *
 * @param {Array<number|null|undefined>} values
 * @param {boolean} isSample - Whether to use sample variance (N-1) vs population (N). Defaults to false (population).
 * @returns {number | null} - Variance or null if insufficient numbers
 */
export function calculateVariance(values, isSample = false) {
  const valid = filterValidNumbers(values)
  if (valid.length === 0) return null
  if (valid.length === 1) return 0.0

  const mean = calculateMean(valid)
  if (mean === null) return null

  const sumSquares = valid.reduce((acc, v) => acc + (v - mean) ** 2, 0)
  const divisor = isSample ? valid.length - 1 : valid.length
  return sumSquares / divisor
}

/**
 * Computes standard deviation of an array of numbers.
 *
 * @param {Array<number|null|undefined>} values
 * @param {boolean} isSample - Whether to use sample standard deviation.
 * @returns {number | null} - Standard deviation or null if insufficient numbers
 */
export function calculateStandardDeviation(values, isSample = false) {
  const variance = calculateVariance(values, isSample)
  if (variance === null) return null
  return Math.sqrt(variance)
}

/**
 * Computes minimum value of an array of numbers.
 *
 * @param {Array<number|null|undefined>} values
 * @returns {number | null}
 */
export function calculateMin(values) {
  const valid = filterValidNumbers(values)
  if (valid.length === 0) return null
  return Math.min(...valid)
}

/**
 * Computes maximum value of an array of numbers.
 *
 * @param {Array<number|null|undefined>} values
 * @returns {number | null}
 */
export function calculateMax(values) {
  const valid = filterValidNumbers(values)
  if (valid.length === 0) return null
  return Math.max(...valid)
}
