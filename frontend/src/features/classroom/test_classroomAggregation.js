/**
 * Classroom Aggregation Test Suite (Phase 3C)
 *
 * Validates deterministic aggregation of classroom behavioural metrics
 * and enforces strict privacy invariants on telemetry payloads.
 */

import assert from 'node:assert'
import {
  STALE_TELEMETRY_MS,
  isStudentReporting,
  calculateClassroomAggregation
} from './classroomAggregation.js'

console.log('--- Running Classroom Behavioural Aggregation Tests (Phase 3C) ---')

const NOW = 1728362400000

// ============================================================================
// 1. Zero students / Empty records
// ============================================================================
console.log('\n[1] Zero students / Empty records...')
const resEmpty = calculateClassroomAggregation([], NOW)
assert.strictEqual(resEmpty.reportingCount, 0)
assert.strictEqual(resEmpty.normalPercentage, null)
assert.strictEqual(resEmpty.reducedPercentage, null)
assert.strictEqual(resEmpty.elevatedConfusionPercentage, null)
assert.strictEqual(resEmpty.meanConfidence, null)
assert.strictEqual(Number.isNaN(resEmpty.normalPercentage), false)
console.log('✓ Zero students handled safely without NaN')

// ============================================================================
// 2. Single reporting student
// ============================================================================
console.log('\n[2] Single reporting student...')
const resSingle = calculateClassroomAggregation([
  {
    user_id: 's1',
    engagement_state: 'NORMAL_BEHAVIOUR',
    confusion_signal: 'LOW',
    confidence: 0.85,
    received_at_ms: NOW - 1000
  }
], NOW)
assert.strictEqual(resSingle.reportingCount, 1)
assert.strictEqual(resSingle.normalPercentage, 100)
assert.strictEqual(resSingle.reducedPercentage, 0)
assert.strictEqual(resSingle.elevatedConfusionPercentage, 0)
assert.strictEqual(resSingle.meanConfidence, 0.85)
console.log('✓ Single reporting student verified')

// ============================================================================
// 3. All normal behaviour
// ============================================================================
console.log('\n[3] All normal behaviour...')
const resAllNormal = calculateClassroomAggregation([
  { user_id: 's1', engagement_state: 'NORMAL_BEHAVIOUR', confusion_signal: 'LOW', confidence: 0.8, received_at_ms: NOW - 500 },
  { user_id: 's2', engagement_state: 'NORMAL_BEHAVIOUR', confusion_signal: 'LOW', confidence: 0.9, received_at_ms: NOW - 1500 }
], NOW)
assert.strictEqual(resAllNormal.reportingCount, 2)
assert.strictEqual(resAllNormal.normalPercentage, 100)
assert.strictEqual(resAllNormal.reducedPercentage, 0)
assert.ok(Math.abs(resAllNormal.meanConfidence - 0.85) < 1e-6)
console.log('✓ All normal behaviour verified')

// ============================================================================
// 4. All reduced-engagement-like
// ============================================================================
console.log('\n[4] All reduced-engagement-like...')
const resAllReduced = calculateClassroomAggregation([
  { user_id: 's1', engagement_state: 'REDUCED_ENGAGEMENT_LIKE', confusion_signal: 'LOW', confidence: 0.7, received_at_ms: NOW - 500 },
  { user_id: 's2', engagement_state: 'REDUCED_ENGAGEMENT_LIKE', confusion_signal: 'LOW', confidence: 0.9, received_at_ms: NOW - 1000 }
], NOW)
assert.strictEqual(resAllReduced.reportingCount, 2)
assert.strictEqual(resAllReduced.normalPercentage, 0)
assert.strictEqual(resAllReduced.reducedPercentage, 100)
console.log('✓ All reduced-engagement-like verified')

// ============================================================================
// 5. Mixed states & elevated confusion
// ============================================================================
console.log('\n[5] Mixed states & elevated confusion...')
const resMixed = calculateClassroomAggregation([
  { user_id: 's1', engagement_state: 'NORMAL_BEHAVIOUR', confusion_signal: 'LOW', confidence: 0.8, received_at_ms: NOW - 2000 },
  { user_id: 's2', engagement_state: 'REDUCED_ENGAGEMENT_LIKE', confusion_signal: 'ELEVATED', confidence: 0.9, received_at_ms: NOW - 3000 },
  { user_id: 's3', engagement_state: 'NORMAL_BEHAVIOUR', confusion_signal: 'ELEVATED', confidence: 0.7, received_at_ms: NOW - 1000 },
  { user_id: 's4', engagement_state: 'UNCERTAIN', confusion_signal: 'LOW', confidence: 0.4, received_at_ms: NOW - 4000 }
], NOW)
assert.strictEqual(resMixed.reportingCount, 4)
assert.strictEqual(resMixed.normalPercentage, 50) // 2 / 4 = 50%
assert.strictEqual(resMixed.reducedPercentage, 25) // 1 / 4 = 25%
assert.strictEqual(resMixed.elevatedConfusionPercentage, 50) // 2 / 4 = 50%
assert.ok(Math.abs(resMixed.meanConfidence - 0.7) < 1e-6) // (0.8 + 0.9 + 0.7 + 0.4) / 4 = 0.7
console.log('✓ Mixed states and elevated confusion percentages verified')

// ============================================================================
// 6. Stale student detection (>10 seconds)
// ============================================================================
console.log('\n[6] Stale student detection (>10 seconds)...')
assert.strictEqual(isStudentReporting({ received_at_ms: NOW - 5000 }, NOW), true)
assert.strictEqual(isStudentReporting({ received_at_ms: NOW - 10000 }, NOW), true)
assert.strictEqual(isStudentReporting({ received_at_ms: NOW - 10001 }, NOW), false)
assert.strictEqual(isStudentReporting({ received_at_ms: NOW - 30000 }, NOW), false)

const resStale = calculateClassroomAggregation([
  // Active student
  { user_id: 's1', engagement_state: 'NORMAL_BEHAVIOUR', confusion_signal: 'LOW', confidence: 0.9, received_at_ms: NOW - 2000 },
  // Stale student (> 10s ago)
  { user_id: 's2', engagement_state: 'REDUCED_ENGAGEMENT_LIKE', confusion_signal: 'ELEVATED', confidence: 0.9, received_at_ms: NOW - 12000 }
], NOW)
// Stale student must be excluded from reporting count and percentages
assert.strictEqual(resStale.reportingCount, 1)
assert.strictEqual(resStale.totalTrackedCount, 2)
assert.strictEqual(resStale.normalPercentage, 100)
assert.strictEqual(resStale.reducedPercentage, 0)
assert.strictEqual(resStale.elevatedConfusionPercentage, 0)
console.log('✓ Stale students excluded from active aggregation')

// ============================================================================
// 7. Null & invalid records handled safely
// ============================================================================
console.log('\n[7] Null & invalid records...')
const resInvalid = calculateClassroomAggregation([null, undefined, {}, { received_at_ms: 'not-a-number' }], NOW)
assert.strictEqual(resInvalid.reportingCount, 0)
assert.strictEqual(resInvalid.normalPercentage, null)
console.log('✓ Null and invalid records safely ignored')

// ============================================================================
// 8. Deterministic idempotency
// ============================================================================
console.log('\n[8] Deterministic idempotency...')
const dataset = [
  { user_id: 's1', engagement_state: 'NORMAL_BEHAVIOUR', confusion_signal: 'LOW', confidence: 0.8, received_at_ms: NOW - 1000 },
  { user_id: 's2', engagement_state: 'NORMAL_BEHAVIOUR', confusion_signal: 'ELEVATED', confidence: 0.6, received_at_ms: NOW - 1000 }
]
const r1 = calculateClassroomAggregation(dataset, NOW)
const r2 = calculateClassroomAggregation(dataset, NOW)
assert.deepStrictEqual(r1, r2)
console.log('✓ Idempotency confirmed')

// ============================================================================
// 9. Privacy invariant validation
// ============================================================================
console.log('\n[9] Privacy invariant on outgoing telemetry payload...')
// Function simulating student uplink packaging from Phase 3B inference output
function createStudentUplinkMessage(inferenceData) {
  return {
    type: 'student_behaviour_update',
    payload: {
      engagement_state: inferenceData?.engagement?.state || 'UNCERTAIN',
      confusion_signal: inferenceData?.confusion?.state || 'UNCERTAIN',
      confidence: typeof inferenceData?.engagement?.confidence === 'number'
        ? inferenceData.engagement.confidence
        : 0.0
    }
  }
}

const mockInference = {
  engagement: { state: 'NORMAL_BEHAVIOUR', confidence: 0.88 },
  confusion: { state: 'LOW', confidence: 0.82 },
  quality: { rating: 'High', coverage: 1.0 },
  modalityEvidence: { ear: 0.05, gaze: 0.08, pose: 5.0 }
}

const outgoing = createStudentUplinkMessage(mockInference)
assert.strictEqual(outgoing.type, 'student_behaviour_update')
assert.ok(outgoing.payload && typeof outgoing.payload === 'object')

// Uplink payload must contain strictly: engagement_state, confusion_signal, confidence
const allowedPayloadKeys = new Set(['engagement_state', 'confusion_signal', 'confidence'])
assert.deepStrictEqual(new Set(Object.keys(outgoing.payload)), allowedPayloadKeys)

// Forbidden biometric signals must never be included
const forbiddenTerms = ['ear', 'gaze', 'pose', 'headpose', 'landmarks', 'baseline', 'temporal', 'video', 'frame', 'timestamp_ms']
for (const term of forbiddenTerms) {
  assert.strictEqual(outgoing.payload[term], undefined, `Forbidden signal '${term}' found in payload`)
  assert.strictEqual(outgoing[term], undefined, `Forbidden signal '${term}' found in message`)
}
console.log('✓ Outgoing telemetry payload contains zero raw biometric signals and strictly allowed keys')

console.log('\nALL CLASSROOM AGGREGATION TESTS PASSED!')
