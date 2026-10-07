/**
 * Personal Behavioural Baseline Verification Test Suite (Phase 3A)
 *
 * Covers 24 core verification requirements:
 * 1. Empty tracker initial state
 * 2. First valid observation ingestion
 * 3. Baseline readiness threshold progression (calibrating -> ready)
 * 4. Multiple valid observations
 * 5. Median / robust central tendency calculation
 * 6. Variability calculation (spread estimation)
 * 7. Missing EAR handling
 * 8. Missing Gaze handling
 * 9. Missing Head Pose handling
 * 10. All modalities missing
 * 11. Null values handling
 * 12. NaN values rejection
 * 13. Infinity values rejection
 * 14. Missing values never become artificial zero
 * 15. Relative deviation from baseline
 * 16. Zero deviation for observation matching baseline
 * 17. Large deviation from baseline
 * 18. Slow adaptation (EMA rate)
 * 19. Outliers do not immediately redefine baseline
 * 20. Tracker reset() support
 * 21. Bounded memory capacity enforcement
 * 22. Deterministic repeated input idempotency
 * 23. Partial modality coverage
 * 24. Session teardown / reset behaviour
 */

import assert from 'node:assert'
import {
  calculateMean,
  calculateMedian,
  calculateStandardDeviation,
  updateEMA,
  calculateEuclideanDistance2D,
  calculateAngularDistance3D
} from './baselineStats.js'
import {
  BaselineTracker,
  BASELINE_WARMUP_OBSERVATIONS,
  BASELINE_MAX_HISTORY,
  BASELINE_ADAPTATION_RATE
} from './baselineTracker.js'

console.log('--- Running Personal Behavioural Baseline Unit Tests (Phase 3A) ---')

// Helper for synthetic neutral observations
function mockObs(overrides = {}) {
  return {
    ear: 0.32,
    gazeX: 0.50,
    gazeY: 0.50,
    yaw: 0.0,
    pitch: 0.0,
    roll: 0.0,
    ...overrides
  }
}

// ============================================================================
// 1. Empty Tracker Initial State
// ============================================================================
console.log('\n[1] Empty tracker initial state...')
const tracker = new BaselineTracker({ warmupObservations: 10, maxHistory: 20 })
const emptyState = tracker.getState()

assert.strictEqual(emptyState.ready, false)
assert.strictEqual(emptyState.readiness.overall, false)
assert.strictEqual(emptyState.readiness.ear, false)
assert.strictEqual(emptyState.baseline.ear.value, null)
assert.strictEqual(emptyState.baseline.gaze.x, null)
assert.strictEqual(emptyState.baseline.headPose.yaw, null)
assert.strictEqual(emptyState.deviation.ear, null)
assert.strictEqual(emptyState.sampleCounts.totalUpdates, 0)
console.log('✓ Empty tracker verified')

// ============================================================================
// 2. First Valid Observation Ingestion
// ============================================================================
console.log('\n[2] First valid observation ingestion...')
const stateFirst = tracker.update(mockObs({ ear: 0.30, gazeX: 0.52, gazeY: 0.48, yaw: 2.0, pitch: -1.0, roll: 0.5 }))

assert.strictEqual(stateFirst.ready, false) // Not ready after 1 sample
assert.strictEqual(stateFirst.sampleCounts.ear, 1)
assert.strictEqual(stateFirst.baseline.ear.value, 0.30)
assert.strictEqual(stateFirst.baseline.gaze.x, 0.52)
assert.strictEqual(stateFirst.baseline.headPose.yaw, 2.0)
assert.strictEqual(stateFirst.deviation.ear, null) // Deviations remain null during warm-up
console.log('✓ First valid observation verified')

// ============================================================================
// 3. Baseline Readiness Threshold Progression
// ============================================================================
console.log('\n[3] Baseline readiness threshold progression...')
const trackerThreshold = new BaselineTracker({ warmupObservations: 5 })

for (let i = 1; i < 5; i++) {
  const s = trackerThreshold.update(mockObs())
  assert.strictEqual(s.ready, false, `Should not be ready at sample ${i}`)
  assert.strictEqual(s.warmupProgress.current, i)
}

// 5th sample reaches the warmup threshold
const s5 = trackerThreshold.update(mockObs())
assert.strictEqual(s5.ready, true)
assert.strictEqual(s5.readiness.overall, true)
assert.strictEqual(s5.readiness.ear, true)
assert.strictEqual(s5.readiness.gaze, true)
assert.strictEqual(s5.readiness.headPose, true)
console.log('✓ Readiness threshold progression verified')

// ============================================================================
// 4. Multiple Valid Observations
// ============================================================================
console.log('\n[4] Multiple valid observations...')
const trackerMulti = new BaselineTracker({ warmupObservations: 5 })
for (let i = 0; i < 10; i++) {
  trackerMulti.update(mockObs({ ear: 0.31 }))
}
assert.strictEqual(trackerMulti.getState().sampleCounts.ear, 10)
assert.strictEqual(trackerMulti.getState().sampleCounts.totalUpdates, 10)
console.log('✓ Multiple observations verified')

// ============================================================================
// 5. Median / Central Tendency Calculation
// ============================================================================
console.log('\n[5] Robust median central tendency calculation...')
const trackerMedian = new BaselineTracker({ warmupObservations: 5 })
// Feed values: [0.20, 0.25, 0.30, 0.35, 0.90] -> Median should be 0.30 (robust against 0.90 outlier)
trackerMedian.update(mockObs({ ear: 0.20 }))
trackerMedian.update(mockObs({ ear: 0.25 }))
trackerMedian.update(mockObs({ ear: 0.30 }))
trackerMedian.update(mockObs({ ear: 0.35 }))
const medianState = trackerMedian.update(mockObs({ ear: 0.90 }))

assert.strictEqual(medianState.baseline.ear.value, 0.30)
console.log('✓ Robust median verified')

// ============================================================================
// 6. Variability Calculation
// ============================================================================
console.log('\n[6] Variability calculation...')
const stdVal = calculateStandardDeviation([0.28, 0.30, 0.32])
assert.ok(Math.abs(stdVal - 0.0163299) < 1e-4)
assert.strictEqual(medianState.baseline.ear.variability > 0, true)
console.log('✓ Variability calculation verified')

// ============================================================================
// 7. Missing EAR Handling
// ============================================================================
console.log('\n[7] Missing EAR handling...')
const trackerMissingEAR = new BaselineTracker({ warmupObservations: 5 })
for (let i = 0; i < 5; i++) {
  trackerMissingEAR.update(mockObs({ ear: null }))
}
const stateNoEAR = trackerMissingEAR.getState()
assert.strictEqual(stateNoEAR.sampleCounts.ear, 0)
assert.strictEqual(stateNoEAR.baseline.ear.value, null)
assert.strictEqual(stateNoEAR.readiness.ear, false)
assert.strictEqual(stateNoEAR.readiness.gaze, true)
assert.strictEqual(stateNoEAR.deviation.ear, null)
console.log('✓ Missing EAR verified')

// ============================================================================
// 8. Missing Gaze Handling
// ============================================================================
console.log('\n[8] Missing gaze handling...')
const trackerMissingGaze = new BaselineTracker({ warmupObservations: 5 })
for (let i = 0; i < 5; i++) {
  trackerMissingGaze.update(mockObs({ gazeX: null, gazeY: null }))
}
const stateNoGaze = trackerMissingGaze.getState()
assert.strictEqual(stateNoGaze.sampleCounts.gaze, 0)
assert.strictEqual(stateNoGaze.baseline.gaze.x, null)
assert.strictEqual(stateNoGaze.readiness.gaze, false)
assert.strictEqual(stateNoGaze.readiness.ear, true)
assert.strictEqual(stateNoGaze.deviation.gaze, null)
console.log('✓ Missing gaze verified')

// ============================================================================
// 9. Missing Head Pose Handling
// ============================================================================
console.log('\n[9] Missing head pose handling...')
const trackerMissingPose = new BaselineTracker({ warmupObservations: 5 })
for (let i = 0; i < 5; i++) {
  trackerMissingPose.update(mockObs({ yaw: null, pitch: null, roll: null }))
}
const stateNoPose = trackerMissingPose.getState()
assert.strictEqual(stateNoPose.sampleCounts.headPose, 0)
assert.strictEqual(stateNoPose.baseline.headPose.yaw, null)
assert.strictEqual(stateNoPose.readiness.headPose, false)
assert.strictEqual(stateNoPose.deviation.headPose, null)
console.log('✓ Missing head pose verified')

// ============================================================================
// 10. All Modalities Missing
// ============================================================================
console.log('\n[10] All modalities missing...')
const trackerAllMissing = new BaselineTracker({ warmupObservations: 5 })
const stateAllMissing = trackerAllMissing.update({
  ear: null,
  gazeX: null,
  gazeY: null,
  yaw: null,
  pitch: null,
  roll: null
})
assert.strictEqual(stateAllMissing.valid, false)
assert.strictEqual(stateAllMissing.modalityCoverage.availableCount, 0)
assert.strictEqual(stateAllMissing.sampleCounts.totalUpdates, 0)
console.log('✓ All modalities missing verified')

// ============================================================================
// 11. Null Values Handling
// ============================================================================
console.log('\n[11] Null values handling...')
const trackerNull = new BaselineTracker()
const stateNull = trackerNull.update(null)
assert.strictEqual(stateNull.valid, false)
assert.strictEqual(stateNull.deviation.ear, null)
assert.strictEqual(stateNull.deviation.gaze, null)
assert.strictEqual(stateNull.deviation.headPose, null)
console.log('✓ Null values verified')

// ============================================================================
// 12. NaN Values Rejection
// ============================================================================
console.log('\n[12] NaN values rejection...')
const trackerNaN = new BaselineTracker()
const stateNaN = trackerNaN.update({
  ear: NaN,
  gazeX: NaN,
  gazeY: 0.5,
  yaw: NaN,
  pitch: 0.0,
  roll: NaN
})
assert.strictEqual(stateNaN.sampleCounts.ear, 0)
assert.strictEqual(stateNaN.sampleCounts.gaze, 0)
assert.strictEqual(stateNaN.sampleCounts.headPose, 0)
assert.strictEqual(stateNaN.baseline.ear.value, null)
console.log('✓ NaN values rejection verified')

// ============================================================================
// 13. Infinity Values Rejection
// ============================================================================
console.log('\n[13] Infinity values rejection...')
const trackerInf = new BaselineTracker()
const stateInf = trackerInf.update({
  ear: Infinity,
  gazeX: -Infinity,
  gazeY: 0.5,
  yaw: Infinity,
  pitch: -Infinity,
  roll: Infinity
})
assert.strictEqual(stateInf.sampleCounts.ear, 0)
assert.strictEqual(stateInf.sampleCounts.gaze, 0)
assert.strictEqual(stateInf.sampleCounts.headPose, 0)
console.log('✓ Infinity values rejection verified')

// ============================================================================
// 14. Missing Values Never Become Zero
// ============================================================================
console.log('\n[14] Missing values never become zero...')
const trackerNoZero = new BaselineTracker({ warmupObservations: 5 })
for (let i = 0; i < 5; i++) {
  trackerNoZero.update(mockObs())
}
// Now feed an observation with null gaze
const stateMissingGazeDev = trackerNoZero.update(mockObs({ gazeX: null, gazeY: null }))
assert.strictEqual(stateMissingGazeDev.deviation.gaze, null)
assert.notStrictEqual(stateMissingGazeDev.deviation.gaze, 0.0)
console.log('✓ Missing values distinction verified (remains null, never 0.0)')

// ============================================================================
// 15. Relative Deviation From Baseline
// ============================================================================
console.log('\n[15] Relative deviation from baseline...')
const trackerDev = new BaselineTracker({ warmupObservations: 5 })
for (let i = 0; i < 5; i++) {
  trackerDev.update(mockObs({ ear: 0.30, gazeX: 0.50, gazeY: 0.50, yaw: 0.0, pitch: 0.0, roll: 0.0 }))
}
// Observation with shift: ear = 0.25 (delta 0.05), gazeX = 0.53, gazeY = 0.54 (dist 0.05), yaw = 10.0 (dist 10)
const stateDev = trackerDev.update(mockObs({ ear: 0.25, gazeX: 0.53, gazeY: 0.54, yaw: 10.0, pitch: 0.0, roll: 0.0 }))
assert.ok(Math.abs(stateDev.deviation.ear - 0.05) < 1e-3)
assert.ok(Math.abs(stateDev.deviation.gaze - 0.05) < 1e-3)
assert.ok(Math.abs(stateDev.deviation.headPose - 10.0) < 1e-3)
console.log('✓ Relative deviation verified')

// ============================================================================
// 16. Zero Deviation For Observation Matching Baseline
// ============================================================================
console.log('\n[16] Zero deviation for observation matching baseline...')
const trackerExact = new BaselineTracker({ warmupObservations: 5 })
for (let i = 0; i < 5; i++) {
  trackerExact.update(mockObs({ ear: 0.32, gazeX: 0.50, gazeY: 0.50, yaw: 0.0, pitch: 0.0, roll: 0.0 }))
}
const stateExact = trackerExact.update(mockObs({ ear: 0.32, gazeX: 0.50, gazeY: 0.50, yaw: 0.0, pitch: 0.0, roll: 0.0 }))
assert.strictEqual(stateExact.deviation.ear, 0.0)
assert.strictEqual(stateExact.deviation.gaze, 0.0)
assert.strictEqual(stateExact.deviation.headPose, 0.0)
console.log('✓ Zero deviation for exact match verified')

// ============================================================================
// 17. Large Deviation From Baseline
// ============================================================================
console.log('\n[17] Large deviation bounded normalization...')
const trackerLarge = new BaselineTracker({ warmupObservations: 5 })
for (let i = 0; i < 5; i++) {
  trackerLarge.update(mockObs({ ear: 0.30, gazeX: 0.50, gazeY: 0.50, yaw: 0.0, pitch: 0.0, roll: 0.0 }))
}
// Turn head 90 degrees (> scale 45.0)
const stateLarge = trackerLarge.update(mockObs({ yaw: 90.0 }))
assert.strictEqual(stateLarge.deviation.headPose >= 90.0, true)
assert.strictEqual(stateLarge.normalizedDeviation.headPose, 1.0) // Bounded clamp to 1.0
console.log('✓ Large deviation clamp verified')

// ============================================================================
// 18. Slow Adaptation (EMA Rate)
// ============================================================================
console.log('\n[18] Slow adaptation (EMA rate)...')
const trackerAdapt = new BaselineTracker({ warmupObservations: 5, adaptationRate: 0.02 })
for (let i = 0; i < 5; i++) {
  trackerAdapt.update(mockObs({ ear: 0.30 }))
}
// Initial ready baseline is 0.30
assert.strictEqual(trackerAdapt.getState().baseline.ear.value, 0.30)
// Now update with ear = 0.40
// Expected new baseline = 0.30 * 0.98 + 0.40 * 0.02 = 0.294 + 0.008 = 0.302
trackerAdapt.update(mockObs({ ear: 0.40 }))
const adaptedBase = trackerAdapt.getState().baseline.ear.value
assert.ok(Math.abs(adaptedBase - 0.302) < 1e-4)
console.log('✓ Slow adaptation verified')

// ============================================================================
// 19. Outliers Do Not Immediately Redefine Baseline
// ============================================================================
console.log('\n[19] Outlier does not immediately redefine baseline...')
const trackerOutlier = new BaselineTracker({ warmupObservations: 5, adaptationRate: 0.02 })
for (let i = 0; i < 5; i++) {
  trackerOutlier.update(mockObs({ yaw: 0.0 }))
}
// Student turns head 60 degrees temporarily
trackerOutlier.update(mockObs({ yaw: 60.0 }))
const shiftedYaw = trackerOutlier.getState().baseline.headPose.yaw
// Shifted yaw should be 0.0 * 0.98 + 60.0 * 0.02 = 1.2 degrees (remains very close to 0.0)
assert.ok(Math.abs(shiftedYaw - 1.2) < 1e-3)
assert.ok(shiftedYaw < 5.0)
console.log('✓ Outlier resistance verified')

// ============================================================================
// 20. Tracker Reset Support
// ============================================================================
console.log('\n[20] Tracker reset() support...')
trackerOutlier.reset()
const stateReset = trackerOutlier.getState()
assert.strictEqual(stateReset.ready, false)
assert.strictEqual(stateReset.sampleCounts.ear, 0)
assert.strictEqual(stateReset.baseline.ear.value, null)
assert.strictEqual(stateReset.deviation.ear, null)
console.log('✓ Reset support verified')

// ============================================================================
// 21. Bounded Memory Capacity Enforcement
// ============================================================================
console.log('\n[21] Bounded memory capacity enforcement...')
const trackerBounded = new BaselineTracker({ warmupObservations: 3, maxHistory: 5 })
for (let i = 0; i < 20; i++) {
  trackerBounded.update(mockObs({ ear: 0.20 + i * 0.01 }))
}
assert.strictEqual(trackerBounded.history.ear.length, 5)
assert.strictEqual(trackerBounded.history.gaze.length, 5)
assert.strictEqual(trackerBounded.history.headPose.length, 5)
console.log('✓ Bounded memory capacity verified')

// ============================================================================
// 22. Deterministic Repeated Input Idempotency
// ============================================================================
console.log('\n[22] Deterministic repeated input idempotency...')
const trackerA = new BaselineTracker({ warmupObservations: 5 })
const trackerB = new BaselineTracker({ warmupObservations: 5 })
for (let i = 0; i < 10; i++) {
  const o = mockObs({ ear: 0.28 + (i % 3) * 0.02, gazeX: 0.49 + i * 0.002 })
  trackerA.update(o)
  trackerB.update(o)
}
assert.deepStrictEqual(trackerA.getState(), trackerB.getState())
console.log('✓ Deterministic idempotency verified')

// ============================================================================
// 23. Partial Modality Coverage
// ============================================================================
console.log('\n[23] Partial modality coverage...')
const trackerPartial = new BaselineTracker({ warmupObservations: 5 })
// 5 observations with EAR and Pose, but missing Gaze
for (let i = 0; i < 5; i++) {
  trackerPartial.update(mockObs({ gazeX: null, gazeY: null }))
}
const statePartial = trackerPartial.getState()
assert.strictEqual(statePartial.readiness.ear, true)
assert.strictEqual(statePartial.readiness.headPose, true)
assert.strictEqual(statePartial.readiness.gaze, false)
assert.strictEqual(statePartial.ready, false) // Overall requires all
assert.strictEqual(statePartial.modalityCoverage.availableCount, 2)
assert.ok(statePartial.deviation.ear !== null)
assert.strictEqual(statePartial.deviation.gaze, null)
console.log('✓ Partial modality coverage verified')

// ============================================================================
// 24. Session Teardown / Reset Behaviour
// ============================================================================
console.log('\n[24] Session teardown / reset behaviour...')
const trackerTeardown = new BaselineTracker({ warmupObservations: 5 })
for (let i = 0; i < 10; i++) {
  trackerTeardown.update(mockObs())
}
assert.strictEqual(trackerTeardown.getState().ready, true)
// Student exits room
trackerTeardown.reset()
assert.strictEqual(trackerTeardown.getState().ready, false)
assert.strictEqual(trackerTeardown.getState().baseline.ear.value, null)
console.log('✓ Session teardown / reset verified')

console.log('\nALL 24 BASELINE TRACKER UNIT TESTS PASSED SUCCESSFULLY!')
