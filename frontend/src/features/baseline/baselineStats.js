/**
 * Baseline Statistical Utilities
 *
 * Provides pure mathematical and robust statistical routines for
 * establishing and maintaining individual behavioural baselines.
 *
 * Implements:
 * - Median and robust central tendency
 * - Median Absolute Deviation (MAD) & Standard Deviation
 * - Exponential Moving Average (EMA) adaptation
 * - 2D & 3D Euclidean deviation distances
 *
 * Guards strictly against null, undefined, NaN, and Infinity.
 */

/**
 * Filters an array to valid finite numbers.
 *
 * @param {Array<number|null|undefined>} values
 * @returns {number[]}
 */
export function filterValidNumbers(values) {
  if (!Array.isArray(values)) return []
  return values.filter((v) => typeof v === 'number' && Number.isFinite(v))
}

/**
 * Computes the arithmetic mean of an array.
 *
 * @param {Array<number|null|undefined>} values
 * @returns {number|null}
 */
export function calculateMean(values) {
  const valid = filterValidNumbers(values)
  if (valid.length === 0) return null
  const sum = valid.reduce((acc, v) => acc + v, 0)
  return sum / valid.length
}

/**
 * Computes the median (50th percentile) of an array of numbers.
 * Robust against extreme outliers and sudden transient gestures.
 *
 * @param {Array<number|null|undefined>} values
 * @returns {number|null}
 */
export function calculateMedian(values) {
  const valid = filterValidNumbers(values)
  if (valid.length === 0) return null

  const sorted = valid.slice().sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)

  if (sorted.length % 2 !== 0) {
    return sorted[mid]
  }
  return (sorted[mid - 1] + sorted[mid]) / 2.0
}

/**
 * Computes standard deviation of an array of numbers.
 *
 * @param {Array<number|null|undefined>} values
 * @param {boolean} [isSample=false]
 * @returns {number|null}
 */
export function calculateStandardDeviation(values, isSample = false) {
  const valid = filterValidNumbers(values)
  if (valid.length === 0) return null
  if (valid.length === 1) return 0.0

  const mean = calculateMean(valid)
  if (mean === null) return null

  const sumSquares = valid.reduce((acc, v) => acc + (v - mean) ** 2, 0)
  const divisor = isSample ? valid.length - 1 : valid.length
  return Math.sqrt(sumSquares / divisor)
}

/**
 * Computes the Median Absolute Deviation (MAD):
 * MAD = median(|x_i - median(X)|)
 * Robust measure of statistical dispersion.
 *
 * @param {Array<number|null|undefined>} values
 * @returns {number|null}
 */
export function calculateMAD(values) {
  const valid = filterValidNumbers(values)
  if (valid.length === 0) return null
  if (valid.length === 1) return 0.0

  const med = calculateMedian(valid)
  if (med === null) return null

  const absoluteDeviations = valid.map((v) => Math.abs(v - med))
  return calculateMedian(absoluteDeviations)
}

/**
 * Updates a scalar value using Exponential Moving Average (EMA):
 * new = (1 - alpha) * previous + alpha * current
 *
 * @param {number|null} previousValue
 * @param {number|null} currentValue
 * @param {number} alpha - Adaptation factor in (0, 1]
 * @returns {number|null}
 */
export function updateEMA(previousValue, currentValue, alpha) {
  if (currentValue === null || currentValue === undefined || !Number.isFinite(currentValue)) {
    return previousValue
  }
  if (previousValue === null || previousValue === undefined || !Number.isFinite(previousValue)) {
    return currentValue
  }
  const safeAlpha = Math.min(1.0, Math.max(0.0, alpha))
  return (1.0 - safeAlpha) * previousValue + safeAlpha * currentValue
}

/**
 * Computes 2D Euclidean distance between two points (e.g. current vs baseline gaze).
 * Returns null if any coordinate is invalid.
 *
 * @param {number|null} x1
 * @param {number|null} y1
 * @param {number|null} x2
 * @param {number|null} y2
 * @returns {number|null}
 */
export function calculateEuclideanDistance2D(x1, y1, x2, y2) {
  if (
    typeof x1 !== 'number' || !Number.isFinite(x1) ||
    typeof y1 !== 'number' || !Number.isFinite(y1) ||
    typeof x2 !== 'number' || !Number.isFinite(x2) ||
    typeof y2 !== 'number' || !Number.isFinite(y2)
  ) {
    return null
  }
  const dx = x1 - x2
  const dy = y1 - y2
  return Math.sqrt(dx * dx + dy * dy)
}

/**
 * Computes 3D Euclidean angular distance between two orientations (yaw, pitch, roll in degrees).
 * Returns null if any angle is invalid.
 *
 * @param {number|null} yaw1
 * @param {number|null} pitch1
 * @param {number|null} roll1
 * @param {number|null} yaw2
 * @param {number|null} pitch2
 * @param {number|null} roll2
 * @returns {number|null}
 */
export function calculateAngularDistance3D(yaw1, pitch1, roll1, yaw2, pitch2, roll2) {
  if (
    typeof yaw1 !== 'number' || !Number.isFinite(yaw1) ||
    typeof pitch1 !== 'number' || !Number.isFinite(pitch1) ||
    typeof roll1 !== 'number' || !Number.isFinite(roll1) ||
    typeof yaw2 !== 'number' || !Number.isFinite(yaw2) ||
    typeof pitch2 !== 'number' || !Number.isFinite(pitch2) ||
    typeof roll2 !== 'number' || !Number.isFinite(roll2)
  ) {
    return null
  }
  const dyaw = yaw1 - yaw2
  const dpitch = pitch1 - pitch2
  const droll = roll1 - roll2
  return Math.sqrt(dyaw * dyaw + dpitch * dpitch + droll * droll)
}
