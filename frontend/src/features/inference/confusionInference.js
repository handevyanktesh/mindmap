/**
 * Confusion-Related Behavioural Inference
 *
 * Estimates confusion-related behavioural signals from:
 * - Gaze instability / saccadic dispersion (stdX, stdY, displacement)
 * - Head pose change / angular dispersion (yawStd, pitchStd, rollStd)
 * - Behavioural deviation intensity
 * - Persistence
 *
 * Strict Guardrails:
 * - Does NOT reuse engagementEvidence directly.
 * - Does NOT treat blinking or low EAR as evidence of confusion.
 * - Missing baseline or absent modalities gate to UNCERTAIN.
 */

import {
  MODALITY_WEIGHT_GAZE,
  MODALITY_WEIGHT_POSE,
  CONFUSION_GAZE_WEIGHT,
  CONFUSION_POSE_WEIGHT,
  CONFUSION_DEVIATION_WEIGHT,
  CONFUSION_PERSISTENCE_WEIGHT,
  CONFUSION_GAZE_INSTABILITY_SCALE,
  CONFUSION_POSE_INSTABILITY_SCALE,
  CONFUSION_THRESHOLD,
  CONFUSION_STATE_ELEVATED_THRESHOLD,
  CONFUSION_STATE,
  CONFIDENCE_COVERAGE_WEIGHT,
  CONFIDENCE_PERSISTENCE_WEIGHT,
  CONFIDENCE_EVIDENCE_WEIGHT
} from './inferenceConstants.js'

import {
  clamp,
  computeModalityIntensities,
  computeWeightedModalityEvidence,
  computeModalityCoverage,
  computePersistence
} from './inferenceNormalization.js'

/**
 * Computes confusion-related behavioural inference for a single observation window.
 *
 * @param {object} params
 * @param {object} params.deviations - { ear, gaze, headPose } from baselineTracker
 * @param {boolean} params.baselineReady - Whether baseline is established
 * @param {object} [params.temporalData] - Windowed temporal stats (gaze, headPose)
 * @param {number} [params.sustainedDurationMs=0] - Observed duration of pattern in ms
 * @returns {object}
 */
export function inferConfusionCandidate(params) {
  const {
    deviations,
    baselineReady = false,
    temporalData,
    sustainedDurationMs = 0
  } = params || {}

  // 1. Uncertainty Gating
  if (!baselineReady) {
    return {
      state: CONFUSION_STATE.UNCERTAIN,
      evidence: null,
      confidence: 0.0,
      gazeInstability: null,
      poseChange: null,
      deviationEvidence: null,
      persistence: 0.0,
      reason: 'BASELINE_NOT_READY'
    }
  }

  const intensities = computeModalityIntensities(deviations)
  const weighted = computeWeightedModalityEvidence(intensities)

  if (weighted.validCount === 0 || weighted.evidence === null) {
    return {
      state: CONFUSION_STATE.UNCERTAIN,
      evidence: null,
      confidence: 0.0,
      gazeInstability: null,
      poseChange: null,
      deviationEvidence: null,
      persistence: 0.0,
      reason: 'NO_VALID_MODALITIES'
    }
  }

  // 2. Extract Gaze Instability from Temporal Features
  // Uses horizontal and vertical dispersion (stdX, stdY)
  let gazeInstability = 0.0
  const gazeStats = temporalData?.gaze
  if (
    gazeStats &&
    typeof gazeStats.stdX === 'number' && Number.isFinite(gazeStats.stdX) &&
    typeof gazeStats.stdY === 'number' && Number.isFinite(gazeStats.stdY)
  ) {
    const compositeSpread = Math.sqrt(gazeStats.stdX * gazeStats.stdX + gazeStats.stdY * gazeStats.stdY)
    gazeInstability = clamp(compositeSpread / CONFUSION_GAZE_INSTABILITY_SCALE, 0.0, 1.0)
  }

  // 3. Extract Head Pose Change from Temporal Features
  // Uses orientation variability (yawStd, pitchStd, rollStd)
  let poseChange = 0.0
  const poseStats = temporalData?.headPose
  if (
    poseStats &&
    typeof poseStats.yawStd === 'number' && Number.isFinite(poseStats.yawStd) &&
    typeof poseStats.pitchStd === 'number' && Number.isFinite(poseStats.pitchStd) &&
    typeof poseStats.rollStd === 'number' && Number.isFinite(poseStats.rollStd)
  ) {
    const angularStd = Math.sqrt(
      poseStats.yawStd * poseStats.yawStd +
      poseStats.pitchStd * poseStats.pitchStd +
      poseStats.rollStd * poseStats.rollStd
    )
    poseChange = clamp(angularStd / CONFUSION_POSE_INSTABILITY_SCALE, 0.0, 1.0)
  }

  // 4. Behavioural Deviation Evidence
  // Excludes EAR to ensure single low EAR (e.g. blinks or eye closure) is never treated as confusion evidence.
  let deviationEvidence = 0.0
  const isGazeValid = typeof intensities.gaze === 'number' && Number.isFinite(intensities.gaze)
  const isPoseValid = typeof intensities.pose === 'number' && Number.isFinite(intensities.pose)
  if (isGazeValid && isPoseValid) {
    deviationEvidence = (MODALITY_WEIGHT_GAZE * intensities.gaze + MODALITY_WEIGHT_POSE * intensities.pose) / (MODALITY_WEIGHT_GAZE + MODALITY_WEIGHT_POSE)
  } else if (isGazeValid) {
    deviationEvidence = intensities.gaze
  } else if (isPoseValid) {
    deviationEvidence = intensities.pose
  } else {
    // Only EAR valid -> do not use single low EAR as confusion evidence
    deviationEvidence = 0.0
  }

  // 5. Persistence Factor
  const persistence = computePersistence(sustainedDurationMs)

  // 6. Calculate Confusion-Related Evidence
  // confusionEvidence = 0.40 * gazeInstability + 0.30 * poseChange + 0.20 * deviation + 0.10 * persistence
  const rawEvidence = (
    CONFUSION_GAZE_WEIGHT * (gazeInstability !== null ? gazeInstability : 0.0) +
    CONFUSION_POSE_WEIGHT * (poseChange !== null ? poseChange : 0.0) +
    CONFUSION_DEVIATION_WEIGHT * (deviationEvidence !== null ? deviationEvidence : 0.0) +
    CONFUSION_PERSISTENCE_WEIGHT * persistence
  )
  const evidence = clamp(rawEvidence, 0.0, 1.0)

  // 7. Calculate Confidence
  const coverage = computeModalityCoverage(weighted.validCount)
  const rawConfidence = (
    CONFIDENCE_COVERAGE_WEIGHT * coverage +
    CONFIDENCE_PERSISTENCE_WEIGHT * persistence +
    CONFIDENCE_EVIDENCE_WEIGHT * (evidence !== null ? evidence : 0.0)
  )
  const confidence = clamp(rawConfidence, 0.0, 1.0)

  // 8. Determine Candidate State
  let state = CONFUSION_STATE.LOW
  if (evidence !== null && evidence >= CONFUSION_THRESHOLD) {
    state = CONFUSION_STATE.ELEVATED
  }

  return {
    state,
    evidence,
    confidence,
    gazeInstability,
    poseChange,
    deviationEvidence,
    persistence,
    coverage,
    reason: 'VALID_EVIDENCE'
  }
}
