/**
 * Temporal Behavioural Features Extractor
 *
 * Computes windowed rolling statistics over temporal buffer samples:
 * - EAR statistics (mean, variance, standard deviation, min, max, change rate, sustained closure duration)
 * - Gaze statistics (mean X/Y, standard deviation X/Y, total displacement, sustained deviation duration)
 * - Head pose statistics (mean yaw/pitch/roll, standard deviation, angular displacement, sustained turn duration)
 *
 * IMPORTANT:
 * - All calculations are strictly browser-local numerical feature extractions.
 * - NO behavioural classifications (attention, distraction, confusion) are performed here.
 * - Missing values (null) are filtered out and NEVER substituted with zeros.
 */

import {
  calculateMean,
  calculateVariance,
  calculateStandardDeviation,
  calculateMin,
  calculateMax,
  filterValidNumbers
} from './temporalStats.js'

/**
 * Calculates continuous sustained duration (in ms) from the latest sample backwards
 * that satisfies the given predicate function.
 *
 * @param {Array<object>} samples - Chronologically ordered samples
 * @param {function(object): boolean} predicate - Condition to evaluate on each sample
 * @returns {number} - Duration in milliseconds (0 if latest does not match or insufficient samples)
 */
export function computeSustainedDuration(samples, predicate) {
  if (!Array.isArray(samples) || samples.length === 0 || typeof predicate !== 'function') {
    return 0
  }

  // Check the latest sample first
  const latest = samples[samples.length - 1]
  if (!predicate(latest)) {
    return 0
  }

  let earliestMatch = latest
  for (let i = samples.length - 2; i >= 0; i--) {
    const s = samples[i]
    if (predicate(s)) {
      earliestMatch = s
    } else {
      break
    }
  }

  const duration = latest.timestamp - earliestMatch.timestamp
  return Math.max(0, duration)
}

/**
 * Calculates accumulated 2D Euclidean displacement across consecutive valid gaze coordinates.
 *
 * @param {Array<object>} samples
 * @returns {number | null} - Total accumulated Euclidean displacement, or null if < 2 valid points
 */
export function calculateGazeDisplacement(samples) {
  if (!Array.isArray(samples)) return null

  const validGaze = samples.filter(
    (s) => s && typeof s.gazeX === 'number' && Number.isFinite(s.gazeX) &&
               typeof s.gazeY === 'number' && Number.isFinite(s.gazeY)
  )

  if (validGaze.length < 2) return null

  let totalDisplacement = 0
  for (let i = 1; i < validGaze.length; i++) {
    const dx = validGaze[i].gazeX - validGaze[i - 1].gazeX
    const dy = validGaze[i].gazeY - validGaze[i - 1].gazeY
    totalDisplacement += Math.sqrt(dx * dx + dy * dy)
  }

  return totalDisplacement
}

/**
 * Calculates accumulated 3D angular displacement across consecutive valid head pose angles (yaw, pitch, roll).
 *
 * @param {Array<object>} samples
 * @returns {number | null} - Total angular change in degrees, or null if < 2 valid poses
 */
export function calculatePoseDisplacement(samples) {
  if (!Array.isArray(samples)) return null

  const validPoses = samples.filter(
    (s) => s && typeof s.yaw === 'number' && Number.isFinite(s.yaw) &&
               typeof s.pitch === 'number' && Number.isFinite(s.pitch) &&
               typeof s.roll === 'number' && Number.isFinite(s.roll)
  )

  if (validPoses.length < 2) return null

  let totalAngle = 0
  for (let i = 1; i < validPoses.length; i++) {
    const dyaw = validPoses[i].yaw - validPoses[i - 1].yaw
    const dpitch = validPoses[i].pitch - validPoses[i - 1].pitch
    const droll = validPoses[i].roll - validPoses[i - 1].roll
    totalAngle += Math.sqrt(dyaw * dyaw + dpitch * dpitch + droll * droll)
  }

  return totalAngle
}

/**
 * Calculates mean absolute frame-to-frame change for a scalar feature.
 *
 * @param {Array<number|null>} values
 * @returns {number | null} - Mean absolute delta between consecutive valid samples, or null if < 2 valid
 */
export function calculateMeanStepChange(values) {
  const valid = filterValidNumbers(values)
  if (valid.length < 2) return null

  let sumDelta = 0
  for (let i = 1; i < valid.length; i++) {
    sumDelta += Math.abs(valid[i] - valid[i - 1])
  }

  return sumDelta / (valid.length - 1)
}

/**
 * Extracts comprehensive temporal statistics over buffered samples.
 *
 * @param {object|Array<object>} bufferOrSamples - TemporalBuffer instance or array of sample objects
 * @param {object} [options]
 * @param {number} [options.earClosureThreshold=0.20] - Threshold for sustained eye closure duration
 * @param {number} [options.gazeDeviationThreshold=0.35] - Threshold for sustained gaze deviation duration
 * @param {number} [options.poseTurnThreshold=25.0] - Threshold for sustained head turn duration (degrees)
 * @returns {object} Temporal feature summary
 */
export function extractTemporalFeatures(bufferOrSamples, options = {}) {
  const {
    earClosureThreshold = 0.20,
    gazeDeviationThreshold = 0.35,
    poseTurnThreshold = 25.0
  } = options

  const samples = Array.isArray(bufferOrSamples)
    ? bufferOrSamples
    : (bufferOrSamples && typeof bufferOrSamples.getSamples === 'function' ? bufferOrSamples.getSamples() : [])

  const sampleCount = samples.length
  const windowSpanMs = sampleCount >= 2
    ? Math.max(0, samples[sampleCount - 1].timestamp - samples[0].timestamp)
    : 0

  // 1. EAR Temporal Features
  const earValues = samples.map((s) => s?.ear)
  const validEarValues = filterValidNumbers(earValues)
  const earStats = {
    mean: calculateMean(validEarValues),
    variance: calculateVariance(validEarValues),
    std: calculateStandardDeviation(validEarValues),
    min: calculateMin(validEarValues),
    max: calculateMax(validEarValues),
    meanStepChange: calculateMeanStepChange(validEarValues),
    sustainedClosureDurationMs: computeSustainedDuration(
      samples,
      (s) => s && typeof s.ear === 'number' && Number.isFinite(s.ear) && s.ear < earClosureThreshold
    )
  }

  // 2. Gaze Temporal Features
  const gazeXValues = samples.map((s) => s?.gazeX)
  const gazeYValues = samples.map((s) => s?.gazeY)
  const validGazeX = filterValidNumbers(gazeXValues)
  const validGazeY = filterValidNumbers(gazeYValues)
  const gazeStats = {
    meanX: calculateMean(validGazeX),
    meanY: calculateMean(validGazeY),
    stdX: calculateStandardDeviation(validGazeX),
    stdY: calculateStandardDeviation(validGazeY),
    displacement: calculateGazeDisplacement(samples),
    sustainedDeviationDurationMs: computeSustainedDuration(
      samples,
      (s) => s && typeof s.gazeX === 'number' && Number.isFinite(s.gazeX) &&
             Math.abs(s.gazeX) > gazeDeviationThreshold
    )
  }

  // 3. Head Pose Temporal Features
  const yawValues = samples.map((s) => s?.yaw)
  const pitchValues = samples.map((s) => s?.pitch)
  const rollValues = samples.map((s) => s?.roll)
  const validYaw = filterValidNumbers(yawValues)
  const validPitch = filterValidNumbers(pitchValues)
  const validRoll = filterValidNumbers(rollValues)
  const poseStats = {
    meanYaw: calculateMean(validYaw),
    meanPitch: calculateMean(validPitch),
    meanRoll: calculateMean(validRoll),
    yawStd: calculateStandardDeviation(validYaw),
    pitchStd: calculateStandardDeviation(validPitch),
    rollStd: calculateStandardDeviation(validRoll),
    angularDisplacement: calculatePoseDisplacement(samples),
    sustainedTurnDurationMs: computeSustainedDuration(
      samples,
      (s) => s && typeof s.yaw === 'number' && Number.isFinite(s.yaw) &&
             Math.abs(s.yaw) > poseTurnThreshold
    )
  }

  return {
    sampleCount,
    validSamples: {
      ear: validEarValues.length,
      gaze: validGazeX.length,
      pose: validYaw.length
    },
    windowSpanMs,
    ear: earStats,
    gaze: gazeStats,
    headPose: poseStats
  }
}
