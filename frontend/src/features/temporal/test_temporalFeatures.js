/**
 * Comprehensive Unit Test Suite for Temporal Analysis (Phase 2.8)
 *
 * Tests:
 * 1. Statistical utility functions (filter, mean, variance, std, min, max, null/NaN handling)
 * 2. Temporal rolling buffer (time-based window eviction, capacity ceiling, sanitization)
 * 3. Temporal feature extractor (EAR, gaze, head pose summaries, displacement, sustained durations)
 * 4. Missing data resilience (null face frames, no-face intervals, no NaN/Infinity)
 */

import assert from 'node:assert'
import {
  filterValidNumbers,
  calculateMean,
  calculateVariance,
  calculateStandardDeviation,
  calculateMin,
  calculateMax
} from './temporalStats.js'
import { TemporalBuffer } from './temporalBuffer.js'
import {
  computeSustainedDuration,
  calculateGazeDisplacement,
  calculatePoseDisplacement,
  calculateMeanStepChange,
  extractTemporalFeatures
} from './temporalFeatures.js'

console.log('--- Running Temporal Analysis Unit Tests (Phase 2.8) ---')

// ==========================================
// 1. Statistical Utility Tests
// ==========================================
console.log('\n[1] Testing temporalStats.js...')

// 1.1 filterValidNumbers
assert.deepStrictEqual(filterValidNumbers([1, null, 2, undefined, NaN, Infinity, -Infinity, 3, '4']), [1, 2, 3])
assert.deepStrictEqual(filterValidNumbers([]), [])
assert.deepStrictEqual(filterValidNumbers(null), [])
assert.deepStrictEqual(filterValidNumbers(undefined), [])

// 1.2 calculateMean
assert.strictEqual(calculateMean([]), null)
assert.strictEqual(calculateMean([null, NaN]), null)
assert.strictEqual(calculateMean([10]), 10)
assert.strictEqual(calculateMean([2, 4, 6]), 4)
assert.strictEqual(calculateMean([1, null, 3]), 2) // filters null correctly

// 1.3 calculateVariance & calculateStandardDeviation
assert.strictEqual(calculateVariance([]), null)
assert.strictEqual(calculateVariance([5]), 0.0) // single value variance is 0
assert.strictEqual(calculateStandardDeviation([]), null)
assert.strictEqual(calculateStandardDeviation([5]), 0.0)

// Values: [2, 4, 4, 4, 5, 5, 7, 9], Mean = 5
// Population Variance = 4.0, Std = 2.0
const testDataset = [2, 4, 4, 4, 5, 5, 7, 9]
assert.strictEqual(calculateMean(testDataset), 5)
assert.strictEqual(calculateVariance(testDataset), 4.0)
assert.strictEqual(calculateStandardDeviation(testDataset), 2.0)

// 1.4 calculateMin & calculateMax
assert.strictEqual(calculateMin([]), null)
assert.strictEqual(calculateMax([]), null)
assert.strictEqual(calculateMin([5, 1, 9, null, -3]), -3)
assert.strictEqual(calculateMax([5, 1, 9, null, -3]), 9)

console.log('✓ temporalStats.js passed all assertions')

// ==========================================
// 2. TemporalBuffer Tests
// ==========================================
console.log('\n[2] Testing temporalBuffer.js...')

const buffer = new TemporalBuffer(5000, 10) // 5.0s window, max 10 samples for test

// 2.1 Empty buffer behavior
assert.strictEqual(buffer.size(), 0)
assert.strictEqual(buffer.getSpanMs(), 0)
assert.deepStrictEqual(buffer.getSamples(), [])

// 2.2 Adding samples with timestamps
buffer.addSample({ timestamp: 1000, ear: 0.32, gazeX: 0.01, gazeY: -0.02, yaw: 1.0, pitch: -2.0, roll: 0.5 })
buffer.addSample({ timestamp: 2000, ear: 0.33, gazeX: 0.02, gazeY: -0.01, yaw: 1.5, pitch: -2.1, roll: 0.6 })
assert.strictEqual(buffer.size(), 2)
assert.strictEqual(buffer.getSpanMs(), 1000)

// 2.3 Rolling time eviction (cutoff = current - 5000)
// Adding at t=6500: cutoff = 1500 -> sample at t=1000 must be evicted
buffer.addSample({ timestamp: 6500, ear: 0.31, gazeX: 0.00, gazeY: 0.00, yaw: 0.8, pitch: -1.9, roll: 0.4 })
assert.strictEqual(buffer.size(), 2)
assert.strictEqual(buffer.getSamples()[0].timestamp, 2000)
assert.strictEqual(buffer.getSamples()[1].timestamp, 6500)
assert.strictEqual(buffer.getSpanMs(), 4500)

// 2.4 Max capacity safety ceiling
const smallBuffer = new TemporalBuffer(10000, 3)
smallBuffer.addSample({ timestamp: 100, ear: 0.3 })
smallBuffer.addSample({ timestamp: 200, ear: 0.3 })
smallBuffer.addSample({ timestamp: 300, ear: 0.3 })
smallBuffer.addSample({ timestamp: 400, ear: 0.3 })
assert.strictEqual(smallBuffer.size(), 3)
assert.strictEqual(smallBuffer.getSamples()[0].timestamp, 200) // 100 evicted by capacity
assert.strictEqual(smallBuffer.getSamples()[2].timestamp, 400)

// 2.5 Sanitization (NaN / Infinity converted to null, timestamps preserved)
const sanitizeBuffer = new TemporalBuffer(5000)
sanitizeBuffer.addSample({
  timestamp: 1000,
  ear: NaN,
  gazeX: Infinity,
  gazeY: -Infinity,
  yaw: null,
  pitch: 12.5,
  roll: undefined
})
const sanitizedSample = sanitizeBuffer.getSamples()[0]
assert.strictEqual(sanitizedSample.timestamp, 1000)
assert.strictEqual(sanitizedSample.ear, null)
assert.strictEqual(sanitizedSample.gazeX, null)
assert.strictEqual(sanitizedSample.gazeY, null)
assert.strictEqual(sanitizedSample.yaw, null)
assert.strictEqual(sanitizedSample.pitch, 12.5)
assert.strictEqual(sanitizedSample.roll, null)

// 2.6 Buffer clear
sanitizeBuffer.clear()
assert.strictEqual(sanitizeBuffer.size(), 0)

console.log('✓ temporalBuffer.js passed all assertions')

// ==========================================
// 3. Feature Extractor Helper Tests
// ==========================================
console.log('\n[3] Testing displacement and sustained duration helpers...')

// 3.1 Gaze displacement
const gazeTrack = [
  { timestamp: 0, gazeX: 0.0, gazeY: 0.0 },
  { timestamp: 33, gazeX: 3.0, gazeY: 4.0 }, // step = 5.0
  { timestamp: 66, gazeX: 3.0, gazeY: 7.0 }  // step = 3.0
]
assert.strictEqual(calculateGazeDisplacement(gazeTrack), 8.0)
assert.strictEqual(calculateGazeDisplacement([{ gazeX: 0, gazeY: 0 }]), null)
assert.strictEqual(calculateGazeDisplacement([]), null)

// 3.2 Pose displacement
const poseTrack = [
  { timestamp: 0, yaw: 0, pitch: 0, roll: 0 },
  { timestamp: 33, yaw: 2, pitch: 3, roll: 6 }, // sqrt(4+9+36) = 7
  { timestamp: 66, yaw: 2, pitch: 3, roll: 10 }  // sqrt(0+0+16) = 4
]
assert.strictEqual(calculatePoseDisplacement(poseTrack), 11.0)
assert.strictEqual(calculatePoseDisplacement([]), null)

// 3.3 Mean step change
assert.strictEqual(calculateMeanStepChange([0.30, 0.32, 0.36]), 0.03) // (|0.02| + |0.04|) / 2 = 0.03
assert.strictEqual(calculateMeanStepChange([0.30]), null)
assert.strictEqual(calculateMeanStepChange([]), null)

// 3.4 Sustained duration
const closureSequence = [
  { timestamp: 1000, ear: 0.32 },
  { timestamp: 1100, ear: 0.15 },
  { timestamp: 1200, ear: 0.14 },
  { timestamp: 1300, ear: 0.16 }
]
// Latest is at 1300 (<0.20), earliest continuous match is at 1100 -> duration = 1300 - 1100 = 200ms
const closureDuration = computeSustainedDuration(closureSequence, (s) => s.ear !== null && s.ear < 0.20)
assert.strictEqual(closureDuration, 200)

// Interrupted streak: latest reopened (0.33) -> sustained closure duration must be 0
const reopenedSequence = [
  ...closureSequence,
  { timestamp: 1400, ear: 0.33 }
]
const zeroClosure = computeSustainedDuration(reopenedSequence, (s) => s.ear !== null && s.ear < 0.20)
assert.strictEqual(zeroClosure, 0)

console.log('✓ Displacement and sustained duration helpers passed all assertions')

// ==========================================
// 4. End-to-End extractTemporalFeatures Tests
// ==========================================
console.log('\n[4] Testing extractTemporalFeatures with synthetic streams...')

// 4.1 Empty input
const emptyResult = extractTemporalFeatures([])
assert.strictEqual(emptyResult.sampleCount, 0)
assert.strictEqual(emptyResult.windowSpanMs, 0)
assert.strictEqual(emptyResult.ear.mean, null)
assert.strictEqual(emptyResult.ear.sustainedClosureDurationMs, 0)
assert.strictEqual(emptyResult.gaze.meanX, null)
assert.strictEqual(emptyResult.gaze.displacement, null)
assert.strictEqual(emptyResult.headPose.meanYaw, null)
assert.strictEqual(emptyResult.headPose.angularDisplacement, null)

// 4.2 Single sample input
const singleSampleBuffer = new TemporalBuffer(5000)
singleSampleBuffer.addSample({
  timestamp: 1000,
  ear: 0.325,
  gazeX: 0.05,
  gazeY: -0.02,
  yaw: 2.5,
  pitch: -1.0,
  roll: 0.2
})
const singleResult = extractTemporalFeatures(singleSampleBuffer)
assert.strictEqual(singleResult.sampleCount, 1)
assert.strictEqual(singleResult.windowSpanMs, 0)
assert.strictEqual(singleResult.ear.mean, 0.325)
assert.strictEqual(singleResult.ear.min, 0.325)
assert.strictEqual(singleResult.ear.max, 0.325)
assert.strictEqual(singleResult.ear.std, 0.0)
assert.strictEqual(singleResult.ear.meanStepChange, null)
assert.strictEqual(singleResult.gaze.meanX, 0.05)
assert.strictEqual(singleResult.gaze.displacement, null)
assert.strictEqual(singleResult.headPose.meanYaw, 2.5)

// 4.3 Multi-sample realistic synthetic stream (30 frames across 1000ms)
const streamBuffer = new TemporalBuffer(5000)
for (let i = 0; i < 30; i++) {
  const t = 1000 + i * 33.33
  streamBuffer.addSample({
    timestamp: t,
    ear: 0.30 + (i % 3) * 0.01, // 0.30, 0.31, 0.32
    gazeX: -0.05 + i * 0.003,
    gazeY: 0.02,
    yaw: 5.0 + Math.sin(i / 5) * 2,
    pitch: -2.0,
    roll: 1.0
  })
}

const fullResult = extractTemporalFeatures(streamBuffer)
assert.strictEqual(fullResult.sampleCount, 30)
assert.strictEqual(fullResult.validSamples.ear, 30)
assert.strictEqual(fullResult.validSamples.gaze, 30)
assert.strictEqual(fullResult.validSamples.pose, 30)
assert.ok(fullResult.windowSpanMs > 900 && fullResult.windowSpanMs < 1000)

// Statistical values exist and are finite numbers
assert.ok(Number.isFinite(fullResult.ear.mean))
assert.ok(Number.isFinite(fullResult.ear.std))
assert.ok(Number.isFinite(fullResult.ear.min))
assert.ok(Number.isFinite(fullResult.ear.max))
assert.ok(Number.isFinite(fullResult.ear.meanStepChange))
assert.ok(Number.isFinite(fullResult.gaze.meanX))
assert.ok(Number.isFinite(fullResult.gaze.stdX))
assert.ok(Number.isFinite(fullResult.gaze.displacement))
assert.ok(Number.isFinite(fullResult.headPose.meanYaw))
assert.ok(Number.isFinite(fullResult.headPose.yawStd))
assert.ok(Number.isFinite(fullResult.headPose.angularDisplacement))

// 4.4 Missing data handling: face loss intervals (nulls)
const intermittentBuffer = new TemporalBuffer(5000)
// 10 valid frames
for (let i = 0; i < 10; i++) {
  intermittentBuffer.addSample({
    timestamp: 1000 + i * 33,
    ear: 0.32,
    gazeX: 0.0,
    gazeY: 0.0,
    yaw: 0.0,
    pitch: 0.0,
    roll: 0.0
  })
}
// 10 face-lost frames (all null)
for (let i = 10; i < 20; i++) {
  intermittentBuffer.addSample({
    timestamp: 1000 + i * 33,
    ear: null,
    gazeX: null,
    gazeY: null,
    yaw: null,
    pitch: null,
    roll: null
  })
}

const intermittentResult = extractTemporalFeatures(intermittentBuffer)
assert.strictEqual(intermittentResult.sampleCount, 20)
assert.strictEqual(intermittentResult.validSamples.ear, 10)
assert.strictEqual(intermittentResult.validSamples.gaze, 10)
assert.strictEqual(intermittentResult.validSamples.pose, 10)
// Valid numbers are computed only over the 10 valid frames, NOT polluted by zeros
assert.ok(Math.abs(intermittentResult.ear.mean - 0.32) < 1e-9)
assert.strictEqual(intermittentResult.ear.min, 0.32)
assert.strictEqual(intermittentResult.ear.max, 0.32)
assert.strictEqual(intermittentResult.gaze.meanX, 0.0)
// Sustained closure should be 0 because latest frames are null (no face detected)
assert.strictEqual(intermittentResult.ear.sustainedClosureDurationMs, 0)

// 4.5 Sustained head turn test
const turnBuffer = new TemporalBuffer(5000)
// Student turns head > 25 degrees for 500ms
for (let i = 0; i < 10; i++) {
  turnBuffer.addSample({
    timestamp: 2000 + i * 50,
    ear: 0.30,
    gazeX: 0.1,
    gazeY: 0.0,
    yaw: 35.0, // > 25.0 threshold
    pitch: 0.0,
    roll: 0.0
  })
}
const turnResult = extractTemporalFeatures(turnBuffer, { poseTurnThreshold: 25.0 })
assert.strictEqual(turnResult.headPose.sustainedTurnDurationMs, 450) // 2000 to 2450 = 450ms

console.log('✓ extractTemporalFeatures passed all assertions')
console.log('\nALL TEMPORAL ANALYSIS UNIT TESTS PASSED SUCCESSFULLY (32 assertions)!')
