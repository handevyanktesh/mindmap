/**
 * Multimodal Feature Fusion Verification Test Suite (Phase 2.9)
 *
 * Covers 18 core verification requirements:
 * 1. Normal valid fusion (all 3 modalities present)
 * 2. EAR-only valid fusion
 * 3. Gaze-only valid fusion
 * 4. Head-pose-only valid fusion
 * 5. Two-modality fusion
 * 6. Missing EAR
 * 7. Missing gaze
 * 8. Missing head pose
 * 9. All modalities unavailable
 * 10. Null values handling
 * 11. NaN values handling
 * 12. Infinity values handling
 * 13. Dynamic weight renormalization
 * 14. Weight sum validation
 * 15. Clamping / bounds adherence
 * 16. Insufficient temporal data thresholding
 * 17. No accidental zero substitution
 * 18. Deterministic idempotency
 */

import assert from 'node:assert'
import {
  clamp,
  normalizeLinear,
  normalizeEAR,
  normalizeGazeAlignment,
  normalizeHeadPoseAlignment,
  EAR_MIN_BASELINE,
  EAR_MAX_BASELINE
} from './fusionNormalization.js'
import {
  DEFAULT_FUSION_WEIGHTS,
  MIN_MODALITY_SAMPLES,
  sanitizeFusionWeights,
  extractNormalizedEAR,
  extractNormalizedGaze,
  extractNormalizedHeadPose,
  fuseMultimodalFeatures
} from './fusionFeatures.js'

console.log('--- Running Multimodal Feature Fusion Unit Tests (Phase 2.9) ---')

// Helper function to create standard mock temporal data
function createMockTemporalData(overrides = {}) {
  return {
    sampleCount: 30,
    validSamples: {
      ear: 30,
      gaze: 30,
      pose: 30,
      ...(overrides.validSamples || {})
    },
    windowSpanMs: 5000,
    ear: {
      mean: 0.30,
      variance: 0.0004,
      std: 0.02,
      min: 0.28,
      max: 0.32,
      meanStepChange: 0.005,
      sustainedClosureDurationMs: 0,
      ...(overrides.ear || {})
    },
    gaze: {
      meanX: 0.50,
      meanY: 0.50,
      stdX: 0.02,
      stdY: 0.02,
      displacement: 0.5,
      sustainedDeviationDurationMs: 0,
      ...(overrides.gaze || {})
    },
    headPose: {
      meanYaw: 0.0,
      meanPitch: 0.0,
      meanRoll: 0.0,
      yawStd: 1.0,
      pitchStd: 1.0,
      rollStd: 1.0,
      angularDisplacement: 5.0,
      sustainedTurnDurationMs: 0,
      ...(overrides.headPose || {})
    },
    ...overrides
  }
}

// ============================================================================
// 1. Normal Valid Fusion (All 3 Modalities Present)
// ============================================================================
console.log('\n[1] Normal valid fusion with 3 modalities...')
const dataAllValid = createMockTemporalData()
const resAllValid = fuseMultimodalFeatures(dataAllValid)

assert.strictEqual(resAllValid.valid, true)
assert.strictEqual(resAllValid.modalityCoverage.availableCount, 3)
assert.strictEqual(resAllValid.modalityCoverage.coverageRatio, 1.0)
assert.strictEqual(resAllValid.modalityCoverage.ear, true)
assert.strictEqual(resAllValid.modalityCoverage.gaze, true)
assert.strictEqual(resAllValid.modalityCoverage.headPose, true)
assert.ok(typeof resAllValid.fusedSignal === 'number' && Number.isFinite(resAllValid.fusedSignal))
assert.ok(resAllValid.fusedSignal >= 0.0 && resAllValid.fusedSignal <= 1.0)
assert.strictEqual(resAllValid.multimodalVector.length, 3)
assert.ok(resAllValid.multimodalVector.every((v) => typeof v === 'number' && Number.isFinite(v)))
console.log('✓ Normal valid fusion passed')

// ============================================================================
// 2. EAR-Only Valid Fusion
// ============================================================================
console.log('\n[2] EAR-only valid fusion...')
const dataEAROnly = createMockTemporalData({
  validSamples: { ear: 20, gaze: 0, pose: 0 },
  gaze: { meanX: null, meanY: null },
  headPose: { meanYaw: null, meanPitch: null, meanRoll: null }
})
const resEAROnly = fuseMultimodalFeatures(dataEAROnly)

assert.strictEqual(resEAROnly.valid, true)
assert.strictEqual(resEAROnly.modalityCoverage.availableCount, 1)
assert.strictEqual(resEAROnly.modalityCoverage.ear, true)
assert.strictEqual(resEAROnly.modalityCoverage.gaze, false)
assert.strictEqual(resEAROnly.modalityCoverage.headPose, false)
// Effective weight for EAR must renormalize to 1.0
assert.strictEqual(resEAROnly.weights.effective.ear, 1.0)
assert.strictEqual(resEAROnly.weights.effective.gaze, 0.0)
assert.strictEqual(resEAROnly.weights.effective.headPose, 0.0)
// Fused signal must exactly match normalized EAR signal
assert.strictEqual(resEAROnly.fusedSignal, resEAROnly.normalized.ear.signal)
assert.strictEqual(resEAROnly.contributions.gaze, null)
assert.strictEqual(resEAROnly.contributions.headPose, null)
console.log('✓ EAR-only valid fusion passed')

// ============================================================================
// 3. Gaze-Only Valid Fusion
// ============================================================================
console.log('\n[3] Gaze-only valid fusion...')
const dataGazeOnly = createMockTemporalData({
  validSamples: { ear: 0, gaze: 25, pose: 0 },
  ear: { mean: null },
  headPose: { meanYaw: null, meanPitch: null, meanRoll: null }
})
const resGazeOnly = fuseMultimodalFeatures(dataGazeOnly)

assert.strictEqual(resGazeOnly.valid, true)
assert.strictEqual(resGazeOnly.modalityCoverage.availableCount, 1)
assert.strictEqual(resGazeOnly.modalityCoverage.gaze, true)
assert.strictEqual(resGazeOnly.weights.effective.gaze, 1.0)
assert.strictEqual(resGazeOnly.fusedSignal, resGazeOnly.normalized.gaze.signal)
console.log('✓ Gaze-only valid fusion passed')

// ============================================================================
// 4. Head-Pose-Only Valid Fusion
// ============================================================================
console.log('\n[4] Head-pose-only valid fusion...')
const dataPoseOnly = createMockTemporalData({
  validSamples: { ear: 0, gaze: 0, pose: 30 },
  ear: { mean: null },
  gaze: { meanX: null, meanY: null }
})
const resPoseOnly = fuseMultimodalFeatures(dataPoseOnly)

assert.strictEqual(resPoseOnly.valid, true)
assert.strictEqual(resPoseOnly.modalityCoverage.availableCount, 1)
assert.strictEqual(resPoseOnly.modalityCoverage.headPose, true)
assert.strictEqual(resPoseOnly.weights.effective.headPose, 1.0)
assert.strictEqual(resPoseOnly.fusedSignal, resPoseOnly.normalized.headPose.signal)
console.log('✓ Head-pose-only valid fusion passed')

// ============================================================================
// 5. Two-Modality Fusion (EAR + Gaze)
// ============================================================================
console.log('\n[5] Two-modality fusion (EAR + Gaze)...')
const dataTwoMod = createMockTemporalData({
  validSamples: { ear: 20, gaze: 20, pose: 0 },
  headPose: { meanYaw: null, meanPitch: null, meanRoll: null }
})
const resTwoMod = fuseMultimodalFeatures(dataTwoMod)

assert.strictEqual(resTwoMod.valid, true)
assert.strictEqual(resTwoMod.modalityCoverage.availableCount, 2)
assert.strictEqual(resTwoMod.modalityCoverage.ear, true)
assert.strictEqual(resTwoMod.modalityCoverage.gaze, true)
assert.strictEqual(resTwoMod.modalityCoverage.headPose, false)
// Effective weights must sum to 1.0
const effectiveSumTwo = resTwoMod.weights.effective.ear + resTwoMod.weights.effective.gaze
assert.ok(Math.abs(effectiveSumTwo - 1.0) < 1e-9)
assert.strictEqual(resTwoMod.weights.effective.headPose, 0.0)
console.log('✓ Two-modality fusion passed')

// ============================================================================
// 6. Missing EAR
// ============================================================================
console.log('\n[6] Missing EAR handling...')
const dataMissingEAR = createMockTemporalData({
  validSamples: { ear: 0, gaze: 15, pose: 15 },
  ear: { mean: null }
})
const resMissingEAR = fuseMultimodalFeatures(dataMissingEAR)

assert.strictEqual(resMissingEAR.modalityCoverage.ear, false)
assert.strictEqual(resMissingEAR.normalized.ear.valid, false)
assert.strictEqual(resMissingEAR.contributions.ear, null)
assert.strictEqual(resMissingEAR.valid, true)
console.log('✓ Missing EAR passed')

// ============================================================================
// 7. Missing Gaze
// ============================================================================
console.log('\n[7] Missing gaze handling...')
const dataMissingGaze = createMockTemporalData({
  validSamples: { ear: 15, gaze: 0, pose: 15 },
  gaze: { meanX: null, meanY: null }
})
const resMissingGaze = fuseMultimodalFeatures(dataMissingGaze)

assert.strictEqual(resMissingGaze.modalityCoverage.gaze, false)
assert.strictEqual(resMissingGaze.normalized.gaze.valid, false)
assert.strictEqual(resMissingGaze.contributions.gaze, null)
assert.strictEqual(resMissingGaze.valid, true)
console.log('✓ Missing gaze passed')

// ============================================================================
// 8. Missing Head Pose
// ============================================================================
console.log('\n[8] Missing head pose handling...')
const dataMissingPose = createMockTemporalData({
  validSamples: { ear: 15, gaze: 15, pose: 0 },
  headPose: { meanYaw: null, meanPitch: null, meanRoll: null }
})
const resMissingPose = fuseMultimodalFeatures(dataMissingPose)

assert.strictEqual(resMissingPose.modalityCoverage.headPose, false)
assert.strictEqual(resMissingPose.normalized.headPose.valid, false)
assert.strictEqual(resMissingPose.contributions.headPose, null)
assert.strictEqual(resMissingPose.valid, true)
console.log('✓ Missing head pose passed')

// ============================================================================
// 9. All Modalities Unavailable
// ============================================================================
console.log('\n[9] All modalities unavailable...')
const dataAllMissing = createMockTemporalData({
  validSamples: { ear: 0, gaze: 0, pose: 0 },
  ear: { mean: null },
  gaze: { meanX: null, meanY: null },
  headPose: { meanYaw: null, meanPitch: null, meanRoll: null }
})
const resAllMissing = fuseMultimodalFeatures(dataAllMissing)

assert.strictEqual(resAllMissing.valid, false)
assert.strictEqual(resAllMissing.modalityCoverage.availableCount, 0)
assert.strictEqual(resAllMissing.fusedSignal, null)
assert.strictEqual(resAllMissing.contributions.ear, null)
assert.strictEqual(resAllMissing.contributions.gaze, null)
assert.strictEqual(resAllMissing.contributions.headPose, null)
console.log('✓ All modalities unavailable passed')

// ============================================================================
// 10. Null Values Handling
// ============================================================================
console.log('\n[10] Null values handling...')
assert.strictEqual(clamp(null, 0, 1), null)
assert.strictEqual(normalizeLinear(null, 0, 1), null)
assert.strictEqual(normalizeEAR(null), null)
assert.strictEqual(normalizeGazeAlignment(null, 0.5), null)
assert.strictEqual(normalizeHeadPoseAlignment(0, null, 0), null)

const nullTemporalResult = fuseMultimodalFeatures(null)
assert.strictEqual(nullTemporalResult.valid, false)
assert.strictEqual(nullTemporalResult.fusedSignal, null)
console.log('✓ Null values handling passed')

// ============================================================================
// 11. NaN Values Handling
// ============================================================================
console.log('\n[11] NaN values handling...')
assert.strictEqual(clamp(NaN, 0, 1), null)
assert.strictEqual(normalizeLinear(NaN, 0, 1), null)
assert.strictEqual(normalizeEAR(NaN), null)

const dataNaN = createMockTemporalData({
  ear: { mean: NaN },
  gaze: { meanX: NaN, meanY: 0.5 },
  headPose: { meanYaw: NaN, meanPitch: 0.0, meanRoll: 0.0 }
})
const resNaN = fuseMultimodalFeatures(dataNaN)
assert.strictEqual(resNaN.valid, false)
assert.strictEqual(resNaN.fusedSignal, null)
assert.strictEqual(resNaN.normalized.ear.signal, null)
console.log('✓ NaN values handling passed')

// ============================================================================
// 12. Infinity Values Handling
// ============================================================================
console.log('\n[12] Infinity values handling...')
assert.strictEqual(clamp(Infinity, 0, 1), null)
assert.strictEqual(clamp(-Infinity, 0, 1), null)
assert.strictEqual(normalizeEAR(Infinity), null)

const dataInfinity = createMockTemporalData({
  ear: { mean: Infinity },
  gaze: { meanX: -Infinity, meanY: 0.5 },
  headPose: { meanYaw: Infinity, meanPitch: 0.0, meanRoll: 0.0 }
})
const resInfinity = fuseMultimodalFeatures(dataInfinity)
assert.strictEqual(resInfinity.valid, false)
assert.strictEqual(resInfinity.fusedSignal, null)
console.log('✓ Infinity values handling passed')

// ============================================================================
// 13. Dynamic Weight Renormalization
// ============================================================================
console.log('\n[13] Dynamic weight renormalization...')
const customWeights = { ear: 0.20, gaze: 0.30, headPose: 0.50 }
// Only ear and headPose valid
const dataRenorm = createMockTemporalData({
  validSamples: { ear: 20, gaze: 0, pose: 20 },
  gaze: { meanX: null, meanY: null }
})
const resRenorm = fuseMultimodalFeatures(dataRenorm, { weights: customWeights })

// configured ear: 0.2, headPose: 0.5 -> sum = 0.7
// effective ear: 0.2 / 0.7 ≈ 0.2857, effective headPose: 0.5 / 0.7 ≈ 0.7143
assert.ok(Math.abs(resRenorm.weights.effective.ear - (0.2 / 0.7)) < 1e-9)
assert.ok(Math.abs(resRenorm.weights.effective.headPose - (0.5 / 0.7)) < 1e-9)
assert.strictEqual(resRenorm.weights.effective.gaze, 0.0)
const totalEffectiveWeight = resRenorm.weights.effective.ear + resRenorm.weights.effective.headPose
assert.ok(Math.abs(totalEffectiveWeight - 1.0) < 1e-9)
console.log('✓ Dynamic weight renormalization passed')

// ============================================================================
// 14. Weight Sum Validation
// ============================================================================
console.log('\n[14] Weight sum validation...')
const zeroWeights = sanitizeFusionWeights({ ear: 0, gaze: 0, headPose: 0 })
assert.deepStrictEqual(zeroWeights, DEFAULT_FUSION_WEIGHTS)

const unnormalizedWeights = sanitizeFusionWeights({ ear: 2, gaze: 3, headPose: 5 })
assert.strictEqual(unnormalizedWeights.ear, 0.2)
assert.strictEqual(unnormalizedWeights.gaze, 0.3)
assert.strictEqual(unnormalizedWeights.headPose, 0.5)

const invalidWeights = sanitizeFusionWeights({ ear: -5, gaze: 'abc', headPose: null })
assert.deepStrictEqual(invalidWeights, DEFAULT_FUSION_WEIGHTS)
console.log('✓ Weight sum validation passed')

// ============================================================================
// 15. Clamping and Bounds Adherence
// ============================================================================
console.log('\n[15] Clamping and bounds adherence...')
// EAR far below minimum baseline (0.05 < 0.15) must clamp to 0.0
assert.strictEqual(normalizeEAR(0.05), 0.0)
// EAR far above maximum baseline (0.80 > 0.38) must clamp to 1.0
assert.strictEqual(normalizeEAR(0.80), 1.0)

// Gaze far off bounds
assert.strictEqual(normalizeGazeAlignment(2.0, -1.0), 0.0)

// Head pose with extreme yaw (150 degrees > 60 max)
assert.strictEqual(normalizeHeadPoseAlignment(150.0, 0.0, 0.0), 0.0)
console.log('✓ Clamping and bounds adherence passed')

// ============================================================================
// 16. Insufficient Temporal Data Thresholding
// ============================================================================
console.log('\n[16] Insufficient temporal data thresholding...')
// 3 samples is less than MIN_MODALITY_SAMPLES (5)
const dataInsufficient = createMockTemporalData({
  validSamples: { ear: 3, gaze: 3, pose: 3 }
})
const resInsufficient = fuseMultimodalFeatures(dataInsufficient)
assert.strictEqual(resInsufficient.valid, false)
assert.strictEqual(resInsufficient.modalityCoverage.availableCount, 0)
assert.strictEqual(resInsufficient.fusedSignal, null)
console.log('✓ Insufficient temporal data thresholding passed')

// ============================================================================
// 17. No Accidental Zero Substitution
// ============================================================================
console.log('\n[17] No accidental zero substitution...')
const dataNoZeroSub = createMockTemporalData({
  validSamples: { ear: 0, gaze: 0, pose: 0 },
  ear: { mean: null },
  gaze: { meanX: null, meanY: null },
  headPose: { meanYaw: null, meanPitch: null, meanRoll: null }
})
const resNoZeroSub = fuseMultimodalFeatures(dataNoZeroSub)
// Fused signal must be null, NEVER 0.0
assert.strictEqual(resNoZeroSub.fusedSignal, null)
assert.notStrictEqual(resNoZeroSub.fusedSignal, 0.0)
assert.strictEqual(resNoZeroSub.multimodalVector[0], null)
assert.notStrictEqual(resNoZeroSub.multimodalVector[0], 0.0)
console.log('✓ No accidental zero substitution passed')

// ============================================================================
// 18. Deterministic Idempotency
// ============================================================================
console.log('\n[18] Deterministic repeated input produces identical output...')
const dataDet = createMockTemporalData()
const runA = fuseMultimodalFeatures(dataDet)
const runB = fuseMultimodalFeatures(dataDet)
assert.deepStrictEqual(runA, runB)
console.log('✓ Deterministic idempotency passed')

console.log('\nALL 18 MULTIMODAL FEATURE FUSION TEST SUITES PASSED SUCCESSFULLY!')
