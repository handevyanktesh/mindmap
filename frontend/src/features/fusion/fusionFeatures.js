/**
 * Multimodal Feature Fusion Engine
 *
 * Integrates heterogeneous temporal feature descriptors (EAR, Gaze, Head Pose)
 * into a unified, quality-gated multimodal behavioural representation.
 *
 * Design Principles:
 * 1. 100% pure JavaScript — no React or DOM dependencies.
 * 2. Quality-Aware — missing, corrupt, or insufficient samples never produce
 *    artificial 0.0 values. Modalities are flagged as invalid and excluded.
 * 3. Dynamic Weight Renormalization — weights of available valid modalities
 *    are dynamically rescaled to sum to 1.0.
 * 4. Transparent Linearity — outputs both the fused signal and explicit per-modality
 *    contributions and coverage metrics.
 * 5. Architectural Boundary — strictly a FEATURE REPRESENTATION layer.
 *    Does NOT perform attention, distraction, confusion, or mental-state inference.
 */

import {
  normalizeEAR,
  normalizeEARVariability,
  normalizeGazeAlignment,
  normalizeGazeDisplacement,
  normalizeHeadPoseAlignment,
  normalizePoseAngularDisplacement
} from './fusionNormalization.js'

/**
 * Baseline Fusion Configuration
 * Documented engineering parameters defining relative modality importance.
 * NOTE: These are engineering baseline parameters, NOT trained machine learning weights.
 */
export const DEFAULT_FUSION_WEIGHTS = {
  ear: 0.35,
  gaze: 0.35,
  headPose: 0.30
}

/**
 * Minimum valid sample threshold within a temporal window
 * to consider a modality statistically reliable.
 */
export const MIN_MODALITY_SAMPLES = 5

/**
 * Reference rolling window span in milliseconds (5.0 seconds).
 */
export const DEFAULT_WINDOW_SPAN_MS = 5000

/**
 * Validates and sanitizes a fusion weights configuration object.
 * Returns normalized weights summing to 1.0, or defaults if invalid.
 *
 * @param {object} [weights]
 * @returns {{ ear: number, gaze: number, headPose: number }}
 */
export function sanitizeFusionWeights(weights) {
  if (!weights || typeof weights !== 'object') {
    return { ...DEFAULT_FUSION_WEIGHTS }
  }

  const ear = typeof weights.ear === 'number' && Number.isFinite(weights.ear) && weights.ear >= 0 ? weights.ear : 0
  const gaze = typeof weights.gaze === 'number' && Number.isFinite(weights.gaze) && weights.gaze >= 0 ? weights.gaze : 0
  const headPose = typeof weights.headPose === 'number' && Number.isFinite(weights.headPose) && weights.headPose >= 0 ? weights.headPose : 0

  const sum = ear + gaze + headPose
  if (sum <= 0) {
    return { ...DEFAULT_FUSION_WEIGHTS }
  }

  return {
    ear: ear / sum,
    gaze: gaze / sum,
    headPose: headPose / sum
  }
}

/**
 * Transforms and validates temporal EAR features into a normalized representation.
 *
 * @param {object} [temporalEAR]
 * @param {number} [validCount=0]
 * @param {number} [windowSpanMs=DEFAULT_WINDOW_SPAN_MS]
 * @param {number} [minSamples=MIN_MODALITY_SAMPLES]
 * @returns {object}
 */
export function extractNormalizedEAR(temporalEAR, validCount = 0, windowSpanMs = DEFAULT_WINDOW_SPAN_MS, minSamples = MIN_MODALITY_SAMPLES) {
  const count = typeof validCount === 'number' && Number.isFinite(validCount) ? Math.max(0, validCount) : 0
  const span = typeof windowSpanMs === 'number' && windowSpanMs > 0 ? windowSpanMs : DEFAULT_WINDOW_SPAN_MS

  const mean = temporalEAR?.mean
  const std = temporalEAR?.std
  const closureMs = temporalEAR?.sustainedClosureDurationMs

  const hasSufficientSamples = count >= minSamples
  const isMeanFinite = typeof mean === 'number' && Number.isFinite(mean)
  const isValid = hasSufficientSamples && isMeanFinite

  if (!isValid) {
    return {
      valid: false,
      sampleCount: count,
      normalizedOpenness: null,
      normalizedVariability: null,
      sustainedClosureRatio: null,
      signal: null
    }
  }

  const normalizedOpenness = normalizeEAR(mean)
  const normalizedVariability = normalizeEARVariability(std)
  const sustainedClosureRatio = Math.min(1.0, Math.max(0.0, (typeof closureMs === 'number' && Number.isFinite(closureMs) ? closureMs : 0) / span))

  // Modality signal: Openness penalized by sustained closure
  const closurePenalty = 1.0 - (0.8 * sustainedClosureRatio)
  const signal = Math.min(1.0, Math.max(0.0, normalizedOpenness * closurePenalty))

  return {
    valid: true,
    sampleCount: count,
    normalizedOpenness,
    normalizedVariability,
    sustainedClosureRatio,
    signal
  }
}

/**
 * Transforms and validates temporal Gaze features into a normalized representation.
 *
 * @param {object} [temporalGaze]
 * @param {number} [validCount=0]
 * @param {number} [windowSpanMs=DEFAULT_WINDOW_SPAN_MS]
 * @param {number} [minSamples=MIN_MODALITY_SAMPLES]
 * @returns {object}
 */
export function extractNormalizedGaze(temporalGaze, validCount = 0, windowSpanMs = DEFAULT_WINDOW_SPAN_MS, minSamples = MIN_MODALITY_SAMPLES) {
  const count = typeof validCount === 'number' && Number.isFinite(validCount) ? Math.max(0, validCount) : 0
  const span = typeof windowSpanMs === 'number' && windowSpanMs > 0 ? windowSpanMs : DEFAULT_WINDOW_SPAN_MS

  const meanX = temporalGaze?.meanX
  const meanY = temporalGaze?.meanY
  const displacement = temporalGaze?.displacement
  const deviationMs = temporalGaze?.sustainedDeviationDurationMs

  const hasSufficientSamples = count >= minSamples
  const areCoordinatesFinite =
    typeof meanX === 'number' && Number.isFinite(meanX) &&
    typeof meanY === 'number' && Number.isFinite(meanY)
  const isValid = hasSufficientSamples && areCoordinatesFinite

  if (!isValid) {
    return {
      valid: false,
      sampleCount: count,
      normalizedAlignment: null,
      normalizedDisplacement: null,
      sustainedDeviationRatio: null,
      signal: null
    }
  }

  const normalizedAlignment = normalizeGazeAlignment(meanX, meanY)
  const normalizedDisplacement = normalizeGazeDisplacement(displacement)
  const sustainedDeviationRatio = Math.min(1.0, Math.max(0.0, (typeof deviationMs === 'number' && Number.isFinite(deviationMs) ? deviationMs : 0) / span))

  // Modality signal: Gaze centered alignment penalized by sustained deviation
  const deviationPenalty = 1.0 - (0.6 * sustainedDeviationRatio)
  const signal = Math.min(1.0, Math.max(0.0, normalizedAlignment * deviationPenalty))

  return {
    valid: true,
    sampleCount: count,
    normalizedAlignment,
    normalizedDisplacement,
    sustainedDeviationRatio,
    signal
  }
}

/**
 * Transforms and validates temporal Head Pose features into a normalized representation.
 *
 * @param {object} [temporalPose]
 * @param {number} [validCount=0]
 * @param {number} [windowSpanMs=DEFAULT_WINDOW_SPAN_MS]
 * @param {number} [minSamples=MIN_MODALITY_SAMPLES]
 * @returns {object}
 */
export function extractNormalizedHeadPose(temporalPose, validCount = 0, windowSpanMs = DEFAULT_WINDOW_SPAN_MS, minSamples = MIN_MODALITY_SAMPLES) {
  const count = typeof validCount === 'number' && Number.isFinite(validCount) ? Math.max(0, validCount) : 0
  const span = typeof windowSpanMs === 'number' && windowSpanMs > 0 ? windowSpanMs : DEFAULT_WINDOW_SPAN_MS

  const meanYaw = temporalPose?.meanYaw
  const meanPitch = temporalPose?.meanPitch
  const meanRoll = temporalPose?.meanRoll
  const angularDisp = temporalPose?.angularDisplacement
  const turnMs = temporalPose?.sustainedTurnDurationMs

  const hasSufficientSamples = count >= minSamples
  const areAnglesFinite =
    typeof meanYaw === 'number' && Number.isFinite(meanYaw) &&
    typeof meanPitch === 'number' && Number.isFinite(meanPitch) &&
    typeof meanRoll === 'number' && Number.isFinite(meanRoll)
  const isValid = hasSufficientSamples && areAnglesFinite

  if (!isValid) {
    return {
      valid: false,
      sampleCount: count,
      normalizedFrontalAlignment: null,
      normalizedAngularDisplacement: null,
      sustainedTurnRatio: null,
      signal: null
    }
  }

  const normalizedFrontalAlignment = normalizeHeadPoseAlignment(meanYaw, meanPitch, meanRoll)
  const normalizedAngularDisplacement = normalizePoseAngularDisplacement(angularDisp)
  const sustainedTurnRatio = Math.min(1.0, Math.max(0.0, (typeof turnMs === 'number' && Number.isFinite(turnMs) ? turnMs : 0) / span))

  // Modality signal: Frontal alignment penalized by sustained turn away
  const turnPenalty = 1.0 - (0.7 * sustainedTurnRatio)
  const signal = Math.min(1.0, Math.max(0.0, normalizedFrontalAlignment * turnPenalty))

  return {
    valid: true,
    sampleCount: count,
    normalizedFrontalAlignment,
    normalizedAngularDisplacement,
    sustainedTurnRatio,
    signal
  }
}

/**
 * Performs quality-gated multimodal fusion across temporal feature descriptors.
 *
 * @param {object} [temporalData] - Output structure from extractTemporalFeatures
 * @param {object} [options]
 * @param {object} [options.weights] - Optional custom modality weights
 * @param {number} [options.minSamples=MIN_MODALITY_SAMPLES] - Minimum samples per modality
 * @returns {object} Fused multimodal representation
 */
export function fuseMultimodalFeatures(temporalData, options = {}) {
  const minSamples = options.minSamples || MIN_MODALITY_SAMPLES
  const configuredWeights = sanitizeFusionWeights(options.weights)

  // Empty or invalid temporalData fallback
  if (!temporalData || typeof temporalData !== 'object') {
    return createEmptyFusionResult(configuredWeights)
  }

  const windowSpanMs = temporalData.windowSpanMs || DEFAULT_WINDOW_SPAN_MS
  const validCounts = temporalData.validSamples || {}

  // 1. Extract and normalize individual modalities
  const normalizedEAR = extractNormalizedEAR(temporalData.ear, validCounts.ear, windowSpanMs, minSamples)
  const normalizedGaze = extractNormalizedGaze(temporalData.gaze, validCounts.gaze, windowSpanMs, minSamples)
  const normalizedHeadPose = extractNormalizedHeadPose(temporalData.headPose, validCounts.pose, windowSpanMs, minSamples)

  // 2. Modality coverage evaluation
  const isEARValid = normalizedEAR.valid && normalizedEAR.signal !== null
  const isGazeValid = normalizedGaze.valid && normalizedGaze.signal !== null
  const isHeadPoseValid = normalizedHeadPose.valid && normalizedHeadPose.signal !== null

  let availableCount = 0
  if (isEARValid) availableCount++
  if (isGazeValid) availableCount++
  if (isHeadPoseValid) availableCount++

  const modalityCoverage = {
    ear: isEARValid,
    gaze: isGazeValid,
    headPose: isHeadPoseValid,
    availableCount,
    totalCount: 3,
    coverageRatio: availableCount / 3
  }

  // 3. Quality-Gated Weight Renormalization
  const activeWeightsSum =
    (isEARValid ? configuredWeights.ear : 0) +
    (isGazeValid ? configuredWeights.gaze : 0) +
    (isHeadPoseValid ? configuredWeights.headPose : 0)

  // If no modalities are statistically valid, fusion is invalid
  if (activeWeightsSum <= 0 || availableCount === 0) {
    return {
      valid: false,
      modalityCoverage,
      normalized: {
        ear: normalizedEAR,
        gaze: normalizedGaze,
        headPose: normalizedHeadPose
      },
      weights: {
        configured: configuredWeights,
        effective: { ear: 0.0, gaze: 0.0, headPose: 0.0 }
      },
      contributions: {
        ear: null,
        gaze: null,
        headPose: null
      },
      fusedSignal: null,
      multimodalVector: [
        normalizedEAR.signal,
        normalizedGaze.signal,
        normalizedHeadPose.signal
      ]
    }
  }

  // Dynamically renormalize weights across available valid modalities
  const effectiveWeights = {
    ear: isEARValid ? configuredWeights.ear / activeWeightsSum : 0.0,
    gaze: isGazeValid ? configuredWeights.gaze / activeWeightsSum : 0.0,
    headPose: isHeadPoseValid ? configuredWeights.headPose / activeWeightsSum : 0.0
  }

  // 4. Calculate individual modality contributions and fused signal
  const earContribution = isEARValid ? effectiveWeights.ear * normalizedEAR.signal : null
  const gazeContribution = isGazeValid ? effectiveWeights.gaze * normalizedGaze.signal : null
  const headPoseContribution = isHeadPoseValid ? effectiveWeights.headPose * normalizedHeadPose.signal : null

  let fusedSum = 0
  if (isEARValid) fusedSum += earContribution
  if (isGazeValid) fusedSum += gazeContribution
  if (isHeadPoseValid) fusedSum += headPoseContribution

  const fusedSignal = Math.min(1.0, Math.max(0.0, fusedSum))

  return {
    valid: true,
    modalityCoverage,
    normalized: {
      ear: normalizedEAR,
      gaze: normalizedGaze,
      headPose: normalizedHeadPose
    },
    weights: {
      configured: configuredWeights,
      effective: effectiveWeights
    },
    contributions: {
      ear: earContribution,
      gaze: gazeContribution,
      headPose: headPoseContribution
    },
    fusedSignal,
    multimodalVector: [
      normalizedEAR.signal,
      normalizedGaze.signal,
      normalizedHeadPose.signal
    ]
  }
}

/**
 * Generates an empty, invalid fusion result structure.
 *
 * @param {object} configuredWeights
 * @returns {object}
 */
function createEmptyFusionResult(configuredWeights) {
  return {
    valid: false,
    modalityCoverage: {
      ear: false,
      gaze: false,
      headPose: false,
      availableCount: 0,
      totalCount: 3,
      coverageRatio: 0.0
    },
    normalized: {
      ear: { valid: false, sampleCount: 0, normalizedOpenness: null, normalizedVariability: null, sustainedClosureRatio: null, signal: null },
      gaze: { valid: false, sampleCount: 0, normalizedAlignment: null, normalizedDisplacement: null, sustainedDeviationRatio: null, signal: null },
      headPose: { valid: false, sampleCount: 0, normalizedFrontalAlignment: null, normalizedAngularDisplacement: null, sustainedTurnRatio: null, signal: null }
    },
    weights: {
      configured: configuredWeights,
      effective: { ear: 0.0, gaze: 0.0, headPose: 0.0 }
    },
    contributions: {
      ear: null,
      gaze: null,
      headPose: null
    },
    fusedSignal: null,
    multimodalVector: [null, null, null]
  }
}
