/**
 * Engagement-Related Behavioural Inference
 *
 * Combines weighted normalized modality deviations, persistence, and cross-modal agreement
 * into a quality-gated engagement-related behavioural evidence estimate and confidence score.
 *
 * Gating / Uncertainty:
 * If baseline is not ready, modalities are missing, or quality is insufficient,
 * state evaluates to UNCERTAIN.
 */

import {
  ENGAGEMENT_MODALITY_WEIGHT,
  ENGAGEMENT_PERSISTENCE_WEIGHT,
  ENGAGEMENT_AGREEMENT_WEIGHT,
  ENGAGEMENT_THRESHOLD,
  ENGAGEMENT_STATE_MODERATE_THRESHOLD,
  ENGAGEMENT_STATE,
  CONFIDENCE_COVERAGE_WEIGHT,
  CONFIDENCE_PERSISTENCE_WEIGHT,
  CONFIDENCE_EVIDENCE_WEIGHT
} from './inferenceConstants.js'

import {
  clamp,
  computeModalityIntensities,
  computeWeightedModalityEvidence,
  computeModalityCoverage,
  computeCrossModalAgreement,
  computePersistence
} from './inferenceNormalization.js'

/**
 * Computes engagement-related behavioural inference for a single observation window.
 *
 * @param {object} params
 * @param {object} params.deviations - { ear, gaze, headPose } from baselineTracker
 * @param {boolean} params.baselineReady - Whether baseline is established
 * @param {number} [params.sustainedDurationMs=0] - Observed sustained duration in ms
 * @param {object} [params.temporalData] - Raw temporal statistics for extra gating
 * @returns {object}
 */
export function inferEngagementCandidate(params) {
  const {
    deviations,
    baselineReady = false,
    sustainedDurationMs = 0
  } = params || {}

  // 1. Uncertainty Gating
  if (!baselineReady) {
    return {
      state: ENGAGEMENT_STATE.UNCERTAIN,
      evidence: null,
      confidence: 0.0,
      modalityEvidence: null,
      coverage: 0.0,
      agreement: null,
      persistence: 0.0,
      reason: 'BASELINE_NOT_READY'
    }
  }

  // 2. Compute Modality Intensities & Weighted Evidence
  const intensities = computeModalityIntensities(deviations)
  const weighted = computeWeightedModalityEvidence(intensities)

  if (weighted.validCount === 0 || weighted.evidence === null) {
    return {
      state: ENGAGEMENT_STATE.UNCERTAIN,
      evidence: null,
      confidence: 0.0,
      modalityEvidence: null,
      coverage: 0.0,
      agreement: null,
      persistence: 0.0,
      reason: 'NO_VALID_MODALITIES'
    }
  }

  // 3. Compute Coverage, Agreement, and Persistence
  const coverage = computeModalityCoverage(weighted.validCount)
  const agreement = computeCrossModalAgreement(intensities)
  const persistence = computePersistence(sustainedDurationMs)

  const agreementValue = agreement !== null ? agreement : 0.0

  // 4. Calculate Combined Behavioural Evidence
  // engagementEvidence = 0.55 * M + 0.30 * P + 0.15 * A
  const M = weighted.evidence
  const P = persistence
  const A = agreementValue

  const rawEvidence = (
    ENGAGEMENT_MODALITY_WEIGHT * M +
    ENGAGEMENT_PERSISTENCE_WEIGHT * P +
    ENGAGEMENT_AGREEMENT_WEIGHT * A
  )
  const evidence = clamp(rawEvidence, 0.0, 1.0)

  // 5. Calculate Confidence (quality / evidence consistency)
  // confidence = 0.40 * coverage + 0.35 * persistence + 0.25 * evidence
  const rawConfidence = (
    CONFIDENCE_COVERAGE_WEIGHT * coverage +
    CONFIDENCE_PERSISTENCE_WEIGHT * persistence +
    CONFIDENCE_EVIDENCE_WEIGHT * (evidence !== null ? evidence : 0.0)
  )
  const confidence = clamp(rawConfidence, 0.0, 1.0)

  // 6. Determine Candidate Behavioural State
  let state = ENGAGEMENT_STATE.NORMAL
  if (evidence !== null && evidence >= ENGAGEMENT_THRESHOLD) {
    state = ENGAGEMENT_STATE.REDUCED
  }

  return {
    state,
    evidence,
    confidence,
    modalityEvidence: M,
    intensities,
    coverage,
    agreement,
    persistence,
    reason: 'VALID_EVIDENCE'
  }
}
