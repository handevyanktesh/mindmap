/**
 * Behavioural Inference Test Suite (Phase 3B — Locked Specification)
 *
 * Validates the locked mathematical specification for Phase 3B:
 * 1. Exact modality weights (EAR = 0.25, Gaze = 0.40, Pose = 0.35)
 * 2. Deviation normalization thresholds (EAR=0.10, Gaze=0.15, Pose=20.0 deg)
 * 3. Dynamic weight renormalization (0, 1, 2, 3 valid modalities)
 * 4. Modality coverage (valid / 3)
 * 5. Meaningful-modality agreement at threshold 0.50 (null when 0 valid)
 * 6. Persistence scaling (below, at, above 4000 ms)
 * 7. Engagement evidence formula (0.55*M + 0.30*P + 0.15*A)
 * 8. Engagement state threshold at 0.35 (<0.35 -> NORMAL, >=0.35 -> REDUCED)
 * 9. Engagement confidence formula (0.40*cov + 0.35*persist + 0.25*evid)
 * 10. Confusion evidence formula (0.40*gazeInstab + 0.30*poseChange + 0.20*nonEARDev + 0.10*persist)
 * 11. Single low EAR does not trigger elevated confusion
 * 12. Confusion state threshold at 0.35 (<0.35 -> LOW, >=0.35 -> ELEVATED)
 * 13. Confusion confidence formula (0.40*cov + 0.35*persist + 0.25*evid)
 * 14. Missing data preservation (null never converts to 0)
 * 15. Uncertainty gating (baseline not ready -> UNCERTAIN, no modalities -> UNCERTAIN)
 * 16. Hysteresis (1 window rejected, 2 consecutive windows confirmed)
 * 17. Numerical safety (no NaN, no Infinity)
 * 18. Deterministic idempotency
 */

import assert from 'node:assert'
import {
  EAR_DEVIATION_THRESHOLD,
  GAZE_DEVIATION_THRESHOLD,
  POSE_DEVIATION_THRESHOLD,
  MODALITY_WEIGHT_EAR,
  MODALITY_WEIGHT_GAZE,
  MODALITY_WEIGHT_POSE,
  AGREEMENT_INTENSITY_THRESHOLD,
  PERSISTENCE_TARGET_MS,
  ENGAGEMENT_MODALITY_WEIGHT,
  ENGAGEMENT_PERSISTENCE_WEIGHT,
  ENGAGEMENT_AGREEMENT_WEIGHT,
  ENGAGEMENT_THRESHOLD,
  CONFIDENCE_COVERAGE_WEIGHT,
  CONFIDENCE_PERSISTENCE_WEIGHT,
  CONFIDENCE_EVIDENCE_WEIGHT,
  CONFUSION_GAZE_WEIGHT,
  CONFUSION_POSE_WEIGHT,
  CONFUSION_DEVIATION_WEIGHT,
  CONFUSION_PERSISTENCE_WEIGHT,
  CONFUSION_THRESHOLD,
  ENGAGEMENT_STATE,
  CONFUSION_STATE,
  STATE_CONFIRMATION_WINDOWS
} from './inferenceConstants.js'

import {
  clamp,
  normalizeDeviationIntensity,
  computeModalityIntensities,
  computeWeightedModalityEvidence,
  computeModalityCoverage,
  computeCrossModalAgreement,
  computePersistence
} from './inferenceNormalization.js'

import { inferEngagementCandidate } from './engagementInference.js'
import { inferConfusionCandidate } from './confusionInference.js'
import { InferenceStateMachine } from './inferenceStateMachine.js'

console.log('--- Running Phase 3B Behavioural Inference Test Suite (Locked Spec) ---')

// ============================================================================
// 1. EXACT MODALITY WEIGHTS
// ============================================================================
console.log('\n[1] Exact modality weights...')
assert.strictEqual(MODALITY_WEIGHT_EAR, 0.25, 'EAR weight must be exactly 0.25')
assert.strictEqual(MODALITY_WEIGHT_GAZE, 0.40, 'Gaze weight must be exactly 0.40')
assert.strictEqual(MODALITY_WEIGHT_POSE, 0.35, 'Pose weight must be exactly 0.35')
assert.strictEqual(MODALITY_WEIGHT_EAR + MODALITY_WEIGHT_GAZE + MODALITY_WEIGHT_POSE, 1.0, 'Weights must sum to 1.0')
console.log('✓ Modality weights verified (0.25, 0.40, 0.35)')

// ============================================================================
// 2. NORMALIZATION & THRESHOLDS
// ============================================================================
console.log('\n[2] Deviation normalization thresholds...')
assert.strictEqual(EAR_DEVIATION_THRESHOLD, 0.10)
assert.strictEqual(GAZE_DEVIATION_THRESHOLD, 0.15)
assert.strictEqual(POSE_DEVIATION_THRESHOLD, 20.0)

assert.strictEqual(normalizeDeviationIntensity(0.05, 0.10), 0.5)
assert.strictEqual(normalizeDeviationIntensity(0.10, 0.10), 1.0)
assert.strictEqual(normalizeDeviationIntensity(0.20, 0.10), 1.0) // Clamps to 1.0
assert.strictEqual(normalizeDeviationIntensity(0.0, 0.10), 0.0)
assert.strictEqual(normalizeDeviationIntensity(null, 0.10), null) // Preserves null
console.log('✓ Normalization thresholds and clamping verified')

// ============================================================================
// 3. DYNAMIC WEIGHT RENORMALIZATION (0, 1, 2, 3 VALID MODALITIES)
// ============================================================================
console.log('\n[3] Dynamic weight renormalization across modalities...')

// 0 valid modalities
const res0 = computeWeightedModalityEvidence({ ear: null, gaze: null, pose: null })
assert.strictEqual(res0.evidence, null)
assert.strictEqual(res0.validCount, 0)

// 1 valid modality (Gaze only)
const res1Gaze = computeWeightedModalityEvidence({ ear: null, gaze: 0.8, pose: null })
assert.strictEqual(res1Gaze.validCount, 1)
assert.strictEqual(res1Gaze.effectiveWeights.gaze, 1.0)
assert.strictEqual(res1Gaze.effectiveWeights.ear, 0.0)
assert.strictEqual(res1Gaze.effectiveWeights.pose, 0.0)
assert.strictEqual(res1Gaze.evidence, 0.8)

// 2 valid modalities (EAR + Pose, missing Gaze)
// EAR (0.25) + Pose (0.35) = 0.60
const res2 = computeWeightedModalityEvidence({ ear: 0.6, gaze: null, pose: 0.9 })
assert.strictEqual(res2.validCount, 2)
assert.ok(Math.abs(res2.effectiveWeights.ear - 0.25 / 0.60) < 1e-6)
assert.ok(Math.abs(res2.effectiveWeights.pose - 0.35 / 0.60) < 1e-6)
assert.strictEqual(res2.effectiveWeights.gaze, 0.0)
const expEvid2 = (0.25 / 0.60) * 0.6 + (0.35 / 0.60) * 0.9
assert.ok(Math.abs(res2.evidence - expEvid2) < 1e-6)

// 3 valid modalities (Full coverage)
const res3 = computeWeightedModalityEvidence({ ear: 0.2, gaze: 0.4, pose: 0.6 })
assert.strictEqual(res3.validCount, 3)
assert.strictEqual(res3.effectiveWeights.ear, 0.25)
assert.strictEqual(res3.effectiveWeights.gaze, 0.40)
assert.strictEqual(res3.effectiveWeights.pose, 0.35)
const expEvid3 = 0.25 * 0.2 + 0.40 * 0.4 + 0.35 * 0.6
assert.ok(Math.abs(res3.evidence - expEvid3) < 1e-6)
console.log('✓ Dynamic weight renormalization verified (0, 1, 2, 3 channels)')

// ============================================================================
// 4. MODALITY COVERAGE (valid / 3)
// ============================================================================
console.log('\n[4] Modality coverage...')
assert.strictEqual(computeModalityCoverage(0), 0.0)
assert.ok(Math.abs(computeModalityCoverage(1) - 1 / 3) < 1e-6)
assert.ok(Math.abs(computeModalityCoverage(2) - 2 / 3) < 1e-6)
assert.strictEqual(computeModalityCoverage(3), 1.0)
console.log('✓ Modality coverage verified')

// ============================================================================
// 5. MEANINGFUL-MODALITY AGREEMENT (Threshold = 0.50)
// ============================================================================
console.log('\n[5] Meaningful-modality agreement (threshold >= 0.50)...')
assert.strictEqual(AGREEMENT_INTENSITY_THRESHOLD, 0.50)

// 0 valid modalities -> null
assert.strictEqual(computeCrossModalAgreement({ ear: null, gaze: null, pose: null }), null)

// 1 valid modality, not meaningful (< 0.50) -> 0 / 1 = 0.0
assert.strictEqual(computeCrossModalAgreement({ ear: 0.49, gaze: null, pose: null }), 0.0)
// 1 valid modality, meaningful (>= 0.50) -> 1 / 1 = 1.0
assert.strictEqual(computeCrossModalAgreement({ ear: 0.50, gaze: null, pose: null }), 1.0)

// 2 valid modalities: one meaningful, one not -> 1 / 2 = 0.5
assert.strictEqual(computeCrossModalAgreement({ ear: 0.60, gaze: 0.40, pose: null }), 0.5)

// 3 valid modalities:
// none meaningful -> 0 / 3 = 0.0
assert.strictEqual(computeCrossModalAgreement({ ear: 0.1, gaze: 0.2, pose: 0.3 }), 0.0)
// one meaningful -> 1 / 3
assert.ok(Math.abs(computeCrossModalAgreement({ ear: 0.6, gaze: 0.2, pose: 0.3 }) - 1 / 3) < 1e-6)
// two meaningful -> 2 / 3
assert.ok(Math.abs(computeCrossModalAgreement({ ear: 0.6, gaze: 0.7, pose: 0.3 }) - 2 / 3) < 1e-6)
// three meaningful -> 3 / 3 = 1.0
assert.strictEqual(computeCrossModalAgreement({ ear: 0.6, gaze: 0.7, pose: 0.8 }), 1.0)
console.log('✓ Meaningful-modality agreement at 0.50 verified')

// ============================================================================
// 6. PERSISTENCE SCALING (Target = 4000 ms)
// ============================================================================
console.log('\n[6] Persistence scaling (target = 4000 ms)...')
assert.strictEqual(PERSISTENCE_TARGET_MS, 4000)
assert.strictEqual(computePersistence(0), 0.0)
assert.strictEqual(computePersistence(2000), 0.5) // below
assert.strictEqual(computePersistence(4000), 1.0) // at
assert.strictEqual(computePersistence(8000), 1.0) // above (clamped)
console.log('✓ Persistence scaling verified')

// ============================================================================
// 7. ENGAGEMENT EVIDENCE FORMULA (0.55*M + 0.30*P + 0.15*A)
// ============================================================================
console.log('\n[7] Engagement evidence formula...')
assert.strictEqual(ENGAGEMENT_MODALITY_WEIGHT, 0.55)
assert.strictEqual(ENGAGEMENT_PERSISTENCE_WEIGHT, 0.30)
assert.strictEqual(ENGAGEMENT_AGREEMENT_WEIGHT, 0.15)

// Test case: M = 0.40, P = 0.50 (2000ms), intensities: EAR=0.2 (0.2/0.1=1.0), Gaze=0.06 (0.4), Pose=4.0 (0.2)
// Intensities: [1.0, 0.4, 0.2]. Valid count = 3.
// Meaningful: 1.0 is >= 0.50, others are not. Agreement A = 1/3.
// M = 0.25*1.0 + 0.40*0.4 + 0.35*0.2 = 0.25 + 0.16 + 0.07 = 0.48
// P = 2000 / 4000 = 0.50
// Expected evidence = 0.55 * 0.48 + 0.30 * 0.50 + 0.15 * (1/3) = 0.264 + 0.150 + 0.050 = 0.464
const testEng = inferEngagementCandidate({
  deviations: { ear: 0.10, gaze: 0.06, headPose: 4.0 },
  baselineReady: true,
  sustainedDurationMs: 2000
})
assert.ok(Math.abs(testEng.evidence - 0.464) < 1e-6, `Expected ~0.464, got ${testEng.evidence}`)
console.log('✓ Engagement evidence formula verified')

// ============================================================================
// 8. ENGAGEMENT STATE THRESHOLDS (<0.35 -> NORMAL, >=0.35 -> REDUCED)
// ============================================================================
console.log('\n[8] Engagement state thresholds (<0.35 -> NORMAL, >=0.35 -> REDUCED)...')
assert.strictEqual(ENGAGEMENT_THRESHOLD, 0.35)

// Case A: evidence < 0.35 -> NORMAL_BEHAVIOUR
const engLow = inferEngagementCandidate({
  deviations: { ear: 0.01, gaze: 0.01, headPose: 1.0 },
  baselineReady: true,
  sustainedDurationMs: 0
})
assert.ok(engLow.evidence < 0.35)
assert.strictEqual(engLow.state, ENGAGEMENT_STATE.NORMAL)

// Case B: evidence >= 0.35 -> REDUCED_ENGAGEMENT_LIKE
const engHigh = inferEngagementCandidate({
  deviations: { ear: 0.10, gaze: 0.15, headPose: 20.0 },
  baselineReady: true,
  sustainedDurationMs: 4000
})
assert.ok(engHigh.evidence >= 0.35)
assert.strictEqual(engHigh.state, ENGAGEMENT_STATE.REDUCED)
console.log('✓ Engagement state thresholds verified')

// ============================================================================
// 9. ENGAGEMENT CONFIDENCE FORMULA (0.40*cov + 0.35*persist + 0.25*evid)
// ============================================================================
console.log('\n[9] Engagement confidence formula...')
assert.strictEqual(CONFIDENCE_COVERAGE_WEIGHT, 0.40)
assert.strictEqual(CONFIDENCE_PERSISTENCE_WEIGHT, 0.35)
assert.strictEqual(CONFIDENCE_EVIDENCE_WEIGHT, 0.25)

// For engHigh: coverage = 1.0, persistence = 1.0, evidence = 1.0
// confidence = 0.40*1.0 + 0.35*1.0 + 0.25*1.0 = 1.0
assert.strictEqual(engHigh.confidence, 1.0)

// Partial: coverage = 2/3, persistence = 0.5 (2000ms), evidence = 0.464
// confidence = 0.40 * (2/3) + 0.35 * 0.5 + 0.25 * 0.464
const engPartial = inferEngagementCandidate({
  deviations: { ear: null, gaze: 0.06, headPose: 4.0 },
  baselineReady: true,
  sustainedDurationMs: 2000
})
const expConf = 0.40 * (2 / 3) + 0.35 * 0.50 + 0.25 * engPartial.evidence
assert.ok(Math.abs(engPartial.confidence - expConf) < 1e-6)
console.log('✓ Engagement confidence formula verified')

// ============================================================================
// 10. CONFUSION EVIDENCE FORMULA (0.40*gazeInstab + 0.30*poseChange + 0.20*nonEAR + 0.10*persist)
// ============================================================================
console.log('\n[10] Confusion evidence formula...')
assert.strictEqual(CONFUSION_GAZE_WEIGHT, 0.40)
assert.strictEqual(CONFUSION_POSE_WEIGHT, 0.30)
assert.strictEqual(CONFUSION_DEVIATION_WEIGHT, 0.20)
assert.strictEqual(CONFUSION_PERSISTENCE_WEIGHT, 0.10)

const confSample = inferConfusionCandidate({
  deviations: { ear: 0.01, gaze: 0.15, headPose: 20.0 }, // non-EAR dev = (0.4*1.0 + 0.35*1.0)/0.75 = 1.0
  baselineReady: true,
  temporalData: {
    gaze: { stdX: 0.20, stdY: 0.0 }, // composite = 0.20 -> instab = 0.20 / 0.20 = 1.0
    headPose: { yawStd: 15.0, pitchStd: 0.0, rollStd: 0.0 } // composite = 15.0 -> poseChange = 15.0 / 15.0 = 1.0
  },
  sustainedDurationMs: 4000 // persistence = 1.0
})
// All components = 1.0 -> evidence = 0.40*1 + 0.30*1 + 0.20*1 + 0.10*1 = 1.0
assert.ok(Math.abs(confSample.evidence - 1.0) < 1e-6, `Expected ~1.0, got ${confSample.evidence}`)
assert.strictEqual(confSample.state, CONFUSION_STATE.ELEVATED)
console.log('✓ Confusion evidence formula verified')

// ============================================================================
// 11. SINGLE LOW EAR DOES NOT TRIGGER ELEVATED CONFUSION
// ============================================================================
console.log('\n[11] Single low EAR does not trigger elevated confusion...')
const confOnlyEAR = inferConfusionCandidate({
  deviations: { ear: 0.10, gaze: 0.0, headPose: 0.0 }, // Only EAR is deviated (closed eyes/blink)
  baselineReady: true,
  temporalData: {
    gaze: { stdX: 0.0, stdY: 0.0 },
    headPose: { yawStd: 0.0, pitchStd: 0.0, rollStd: 0.0 }
  },
  sustainedDurationMs: 4000 // Even with sustained eye closure
})
// Non-EAR deviation is 0.0, gaze instab = 0.0, pose change = 0.0, persistence = 1.0 -> evidence = 0.10 * 1.0 = 0.10 < 0.35
assert.ok(confOnlyEAR.evidence < 0.35, `Confusion evidence should be < 0.35, got ${confOnlyEAR.evidence}`)
assert.strictEqual(confOnlyEAR.state, CONFUSION_STATE.LOW)
console.log('✓ Single low EAR does not trigger elevated confusion')

// ============================================================================
// 12. CONFUSION STATE THRESHOLDS (<0.35 -> LOW, >=0.35 -> ELEVATED)
// ============================================================================
console.log('\n[12] Confusion state thresholds (<0.35 -> LOW, >=0.35 -> ELEVATED)...')
assert.strictEqual(CONFUSION_THRESHOLD, 0.35)
assert.strictEqual(confOnlyEAR.state, CONFUSION_STATE.LOW)
assert.strictEqual(confSample.state, CONFUSION_STATE.ELEVATED)
console.log('✓ Confusion state thresholds verified')

// ============================================================================
// 13. CONFUSION CONFIDENCE FORMULA (0.40*cov + 0.35*persist + 0.25*evid)
// ============================================================================
console.log('\n[13] Confusion confidence formula...')
assert.ok(Math.abs(confSample.confidence - 1.0) < 1e-6, `Expected ~1.0, got ${confSample.confidence}`)
const expConfLow = 0.40 * 1.0 + 0.35 * 1.0 + 0.25 * confOnlyEAR.evidence
assert.ok(Math.abs(confOnlyEAR.confidence - expConfLow) < 1e-6)
console.log('✓ Confusion confidence formula verified')

// ============================================================================
// 14. MISSING DATA PRESERVATION (Never converted to 0)
// ============================================================================
console.log('\n[14] Missing data preservation (null never converts to 0)...')
const intMissing = computeModalityIntensities({ ear: null, gaze: 0.10, headPose: null })
assert.strictEqual(intMissing.ear, null)
assert.notStrictEqual(intMissing.ear, 0.0)
assert.strictEqual(intMissing.pose, null)
assert.notStrictEqual(intMissing.pose, 0.0)
assert.strictEqual(intMissing.gaze, 0.10 / 0.15)
console.log('✓ Null values preserved without zero substitution')

// ============================================================================
// 15. UNCERTAINTY GATING (Baseline not ready / No modalities -> UNCERTAIN)
// ============================================================================
console.log('\n[15] Uncertainty gating...')
const engNoBase = inferEngagementCandidate({
  deviations: { ear: 0.10, gaze: 0.15, headPose: 20.0 },
  baselineReady: false
})
assert.strictEqual(engNoBase.state, ENGAGEMENT_STATE.UNCERTAIN)
assert.strictEqual(engNoBase.evidence, null)
assert.strictEqual(engNoBase.confidence, 0.0)

const confNoBase = inferConfusionCandidate({
  deviations: { ear: 0.10, gaze: 0.15, headPose: 20.0 },
  baselineReady: false
})
assert.strictEqual(confNoBase.state, CONFUSION_STATE.UNCERTAIN)
assert.strictEqual(confNoBase.evidence, null)
assert.strictEqual(confNoBase.confidence, 0.0)

const engNoMod = inferEngagementCandidate({
  deviations: { ear: null, gaze: null, headPose: null },
  baselineReady: true
})
assert.strictEqual(engNoMod.state, ENGAGEMENT_STATE.UNCERTAIN)

const confNoMod = inferConfusionCandidate({
  deviations: { ear: null, gaze: null, headPose: null },
  baselineReady: true
})
assert.strictEqual(confNoMod.state, CONFUSION_STATE.UNCERTAIN)
console.log('✓ Uncertainty gating verified')

// ============================================================================
// 16. HYSTERESIS (1 window rejected, 2 consecutive windows confirmed)
// ============================================================================
console.log('\n[16] Temporal state hysteresis...')
assert.strictEqual(STATE_CONFIRMATION_WINDOWS, 2)
const sm = new InferenceStateMachine({ confirmationWindows: 2 })

// Window 1 normal
sm.update({ deviations: { ear: 0, gaze: 0, headPose: 0 }, baselineReady: true })
// Window 2 normal -> stable state = NORMAL
sm.update({ deviations: { ear: 0, gaze: 0, headPose: 0 }, baselineReady: true })
assert.strictEqual(sm.getState().engagement.state, ENGAGEMENT_STATE.NORMAL)

// Window 1 of elevated deviation -> candidate is REDUCED, but stable remains NORMAL
sm.update({ deviations: { ear: 0.10, gaze: 0.15, headPose: 20 }, baselineReady: true, sustainedDurationMs: 4000 })
assert.strictEqual(sm.getState().engagement.candidateState, ENGAGEMENT_STATE.REDUCED)
assert.strictEqual(sm.getState().engagement.state, ENGAGEMENT_STATE.NORMAL, '1 window must NOT change stable state')

// Window 2 of elevated deviation -> stable transitions to REDUCED
sm.update({ deviations: { ear: 0.10, gaze: 0.15, headPose: 20 }, baselineReady: true, sustainedDurationMs: 4000 })
assert.strictEqual(sm.getState().engagement.state, ENGAGEMENT_STATE.REDUCED, '2 consecutive windows MUST change state')

// One contradictory normal window -> candidate is NORMAL, but stable remains REDUCED
sm.update({ deviations: { ear: 0, gaze: 0, headPose: 0 }, baselineReady: true })
assert.strictEqual(sm.getState().engagement.candidateState, ENGAGEMENT_STATE.NORMAL)
assert.strictEqual(sm.getState().engagement.state, ENGAGEMENT_STATE.REDUCED, '1 contradictory window must NOT change state')

// Second normal window -> stable recovers to NORMAL
sm.update({ deviations: { ear: 0, gaze: 0, headPose: 0 }, baselineReady: true })
assert.strictEqual(sm.getState().engagement.state, ENGAGEMENT_STATE.NORMAL, '2 consecutive windows MUST recover state')
console.log('✓ Temporal hysteresis verified')

// ============================================================================
// 17. NUMERICAL SAFETY (No NaN / No Infinity)
// ============================================================================
console.log('\n[17] Numerical safety (no NaN / Infinity)...')
assert.strictEqual(clamp(NaN, 0, 1), null)
assert.strictEqual(clamp(Infinity, 0, 1), null)
assert.strictEqual(normalizeDeviationIntensity(NaN, 10), null)
assert.strictEqual(normalizeDeviationIntensity(Infinity, 10), null)

const engNaN = inferEngagementCandidate({
  deviations: { ear: NaN, gaze: Infinity, headPose: -Infinity },
  baselineReady: true
})
assert.strictEqual(engNaN.evidence, null)
assert.strictEqual(engNaN.state, ENGAGEMENT_STATE.UNCERTAIN)
console.log('✓ Numerical safety confirmed')

// ============================================================================
// 18. DETERMINISTIC IDEMPOTENCY
// ============================================================================
console.log('\n[18] Deterministic idempotency...')
const testParams = {
  deviations: { ear: 0.05, gaze: 0.075, headPose: 10.0 },
  baselineReady: true,
  sustainedDurationMs: 1500
}
const runA = inferEngagementCandidate(testParams)
const runB = inferEngagementCandidate(testParams)
assert.deepStrictEqual(runA, runB)
console.log('✓ Deterministic repeated inputs produce identical outputs')

console.log('\n============================================================')
console.log('ALL PHASE 3B BEHAVIOURAL INFERENCE TESTS PASSED SUCCESSFULLY!')
console.log('============================================================')
