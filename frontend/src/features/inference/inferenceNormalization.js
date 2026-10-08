/**
 * Inference Normalization Utilities
 *
 * Provides pure mathematical routines for normalizing raw behavioural deviations,
 * calculating coverage, agreement, persistence, and quality-gated weighted evidence.
 *
 * Strict numerical guarantees:
 * - Never returns NaN or Infinity.
 * - Missing values remain null and never convert to artificial 0.0.
 */

import {
  EAR_DEVIATION_THRESHOLD,
  GAZE_DEVIATION_THRESHOLD,
  POSE_DEVIATION_THRESHOLD,
  MODALITY_WEIGHT_EAR,
  MODALITY_WEIGHT_GAZE,
  MODALITY_WEIGHT_POSE,
  TOTAL_EXPECTED_MODALITIES,
  AGREEMENT_INTENSITY_THRESHOLD,
  PERSISTENCE_TARGET_MS
} from './inferenceConstants.js'

/**
 * Clamps a finite numerical value within [min, max].
 * Returns null if value is not a finite number.
 *
 * @param {number|null|undefined} val
 * @param {number} min
 * @param {number} max
 * @returns {number|null}
 */
export function clamp(val, min, max) {
  if (val === null || val === undefined || typeof val !== 'number' || !Number.isFinite(val)) {
    return null
  }
  return Math.min(Math.max(val, min), max)
}

/**
 * Normalizes a raw deviation against a reference engineering threshold into [0, 1].
 *
 * intensity = clamp(rawDeviation / threshold, 0, 1)
 *
 * @param {number|null|undefined} rawDeviation
 * @param {number} threshold
 * @returns {number|null}
 */
export function normalizeDeviationIntensity(rawDeviation, threshold) {
  if (rawDeviation === null || rawDeviation === undefined || typeof rawDeviation !== 'number' || !Number.isFinite(rawDeviation)) {
    return null
  }
  if (typeof threshold !== 'number' || !Number.isFinite(threshold) || threshold <= 0) {
    return null
  }
  return clamp(rawDeviation / threshold, 0.0, 1.0)
}

/**
 * Computes individual normalized deviation intensities for all three modalities.
 * Missing modalities strictly return null.
 *
 * @param {object} deviations - { ear: number|null, gaze: number|null, headPose: number|null }
 * @returns {{ ear: number|null, gaze: number|null, pose: number|null }}
 */
export function computeModalityIntensities(deviations) {
  if (!deviations || typeof deviations !== 'object') {
    return { ear: null, gaze: null, pose: null }
  }

  const earIntensity = normalizeDeviationIntensity(deviations.ear, EAR_DEVIATION_THRESHOLD)
  const gazeIntensity = normalizeDeviationIntensity(deviations.gaze, GAZE_DEVIATION_THRESHOLD)
  const poseIntensity = normalizeDeviationIntensity(deviations.headPose, POSE_DEVIATION_THRESHOLD)

  return {
    ear: earIntensity,
    gaze: gazeIntensity,
    pose: poseIntensity
  }
}

/**
 * Computes dynamic quality-gated weighted modality evidence.
 *
 * Re-normalizes weights across available valid modalities.
 * If no modality is valid, returns null.
 *
 * @param {{ ear: number|null, gaze: number|null, pose: number|null }} intensities
 * @returns {{ evidence: number|null, effectiveWeights: { ear: number, gaze: number, pose: number }, validCount: number }}
 */
export function computeWeightedModalityEvidence(intensities) {
  if (!intensities || typeof intensities !== 'object') {
    return {
      evidence: null,
      effectiveWeights: { ear: 0, gaze: 0, pose: 0 },
      validCount: 0
    }
  }

  const isEARValid = typeof intensities.ear === 'number' && Number.isFinite(intensities.ear)
  const isGazeValid = typeof intensities.gaze === 'number' && Number.isFinite(intensities.gaze)
  const isPoseValid = typeof intensities.pose === 'number' && Number.isFinite(intensities.pose)

  let validCount = 0
  let activeWeightSum = 0

  if (isEARValid) {
    validCount++
    activeWeightSum += MODALITY_WEIGHT_EAR
  }
  if (isGazeValid) {
    validCount++
    activeWeightSum += MODALITY_WEIGHT_GAZE
  }
  if (isPoseValid) {
    validCount++
    activeWeightSum += MODALITY_WEIGHT_POSE
  }

  if (validCount === 0 || activeWeightSum <= 0) {
    return {
      evidence: null,
      effectiveWeights: { ear: 0, gaze: 0, pose: 0 },
      validCount: 0
    }
  }

  const effectiveWeights = {
    ear: isEARValid ? MODALITY_WEIGHT_EAR / activeWeightSum : 0.0,
    gaze: isGazeValid ? MODALITY_WEIGHT_GAZE / activeWeightSum : 0.0,
    pose: isPoseValid ? MODALITY_WEIGHT_POSE / activeWeightSum : 0.0
  }

  let weightedSum = 0
  if (isEARValid) weightedSum += effectiveWeights.ear * intensities.ear
  if (isGazeValid) weightedSum += effectiveWeights.gaze * intensities.gaze
  if (isPoseValid) weightedSum += effectiveWeights.pose * intensities.pose

  return {
    evidence: clamp(weightedSum, 0.0, 1.0),
    effectiveWeights,
    validCount
  }
}

/**
 * Computes modality coverage ratio.
 *
 * coverage = validModalities / totalExpectedModalities (3)
 *
 * @param {number} validCount
 * @returns {number}
 */
export function computeModalityCoverage(validCount) {
  if (typeof validCount !== 'number' || !Number.isFinite(validCount) || validCount <= 0) {
    return 0.0
  }
  return Math.min(1.0, validCount / TOTAL_EXPECTED_MODALITIES)
}

/**
 * Computes cross-modal agreement.
 * Ratio of valid modalities exhibiting meaningful deviation (>= AGREEMENT_INTENSITY_THRESHOLD).
 *
 * @param {{ ear: number|null, gaze: number|null, pose: number|null }} intensities
 * @param {number} [threshold=AGREEMENT_INTENSITY_THRESHOLD]
 * @returns {number|null}
 */
export function computeCrossModalAgreement(intensities, threshold = AGREEMENT_INTENSITY_THRESHOLD) {
  if (!intensities || typeof intensities !== 'object') return null

  const validValues = [intensities.ear, intensities.gaze, intensities.pose].filter(
    (v) => typeof v === 'number' && Number.isFinite(v)
  )

  if (validValues.length === 0) return null

  const agreeingCount = validValues.filter((v) => v >= threshold).length
  return agreeingCount / validValues.length
}

/**
 * Computes persistence factor based on observed sustained duration.
 *
 * persistence = clamp(observedDurationMs / PERSISTENCE_TARGET_MS, 0, 1)
 *
 * @param {number|null|undefined} durationMs
 * @param {number} [targetMs=PERSISTENCE_TARGET_MS]
 * @returns {number}
 */
export function computePersistence(durationMs, targetMs = PERSISTENCE_TARGET_MS) {
  if (typeof durationMs !== 'number' || !Number.isFinite(durationMs) || durationMs <= 0) {
    return 0.0
  }
  if (typeof targetMs !== 'number' || targetMs <= 0) {
    return 0.0
  }
  return clamp(durationMs / targetMs, 0.0, 1.0)
}
