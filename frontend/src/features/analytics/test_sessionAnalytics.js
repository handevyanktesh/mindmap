/**
 * Session Analytics & Teacher Report Unit Tests (Phase 4)
 */

import assert from 'node:assert'
import {
  formatDuration,
  calculateSessionSummary
} from './sessionAnalytics.js'

console.log('--- Running Session Analytics & Teacher Report Unit Tests (Phase 4) ---')

// ============================================================================
// 1. Duration Formatting Tests
// ============================================================================
console.log('\n[1] Testing formatDuration...')
assert.strictEqual(formatDuration(0), '0s')
assert.strictEqual(formatDuration(-10), '0s')
assert.strictEqual(formatDuration(null), '0s')
assert.strictEqual(formatDuration(undefined), '0s')
assert.strictEqual(formatDuration(NaN), '0s')
assert.strictEqual(formatDuration(42), '42s')
assert.strictEqual(formatDuration(125), '2m 5s')
assert.strictEqual(formatDuration(3665), '1h 1m 5s')
assert.strictEqual(formatDuration(7200), '2h 0m 0s')
console.log('✓ formatDuration handles all edge cases and formats correctly')

// ============================================================================
// 2. Empty Session & Missing Metrics (Safety against NaN)
// ============================================================================
console.log('\n[2] Testing empty session and missing metrics...')
const emptySummary = calculateSessionSummary({}, [], null)
assert.strictEqual(emptySummary.durationSeconds, 0)
assert.strictEqual(emptySummary.durationFormatted, '0s')
assert.strictEqual(emptySummary.totalParticipants, 0)
assert.strictEqual(emptySummary.activeParticipants, 0)
assert.strictEqual(emptySummary.leftParticipants, 0)
assert.strictEqual(emptySummary.isTelemetryAvailable, false)
assert.strictEqual(emptySummary.meanConfidence, null)
assert.strictEqual(emptySummary.engagementDistribution.normalPct, null)
assert.strictEqual(emptySummary.engagementDistribution.reducedPct, null)
assert.strictEqual(emptySummary.engagementDistribution.uncertainPct, null)
assert.strictEqual(emptySummary.confusionDistribution.lowPct, null)
assert.strictEqual(emptySummary.confusionDistribution.elevatedPct, null)
assert.strictEqual(emptySummary.confusionDistribution.uncertainPct, null)
assert.strictEqual(Number.isNaN(emptySummary.durationSeconds), false)
console.log('✓ Empty session returns safe nulls without producing NaN')

// ============================================================================
// 3. Duration & Attendance Calculation from timestamps
// ============================================================================
console.log('\n[3] Testing session duration & attendance roster...')
const sessionData = {
  id: 'sess-123',
  title: 'Calculus I: Limits',
  status: 'ended',
  started_at: '2026-10-11T10:00:00Z',
  ended_at: '2026-10-11T10:45:30Z'
}
const participantsData = [
  {
    student_id: 's1',
    student_name: 'Alice Smith',
    student_email: 'alice@test.com',
    status: 'joined',
    joined_at: '2026-10-11T10:00:00Z',
    left_at: null
  },
  {
    student_id: 's2',
    student_name: 'Bob Jones',
    student_email: 'bob@test.com',
    status: 'left',
    joined_at: '2026-10-11T10:05:00Z',
    left_at: '2026-10-11T10:35:00Z'
  },
  // Duplicate record for s1 (historical entry)
  {
    student_id: 's1',
    student_name: 'Alice Smith',
    student_email: 'alice@test.com',
    status: 'left',
    joined_at: '2026-10-11T09:50:00Z',
    left_at: '2026-10-11T09:55:00Z'
  }
]

const summaryWithRoster = calculateSessionSummary(sessionData, participantsData, null)
assert.strictEqual(summaryWithRoster.durationSeconds, 45 * 60 + 30) // 2730 seconds
assert.strictEqual(summaryWithRoster.durationFormatted, '45m 30s')
assert.strictEqual(summaryWithRoster.totalParticipants, 2) // Deduplicated Alice and Bob
assert.strictEqual(summaryWithRoster.activeParticipants, 1)
assert.strictEqual(summaryWithRoster.leftParticipants, 1)
assert.strictEqual(summaryWithRoster.attendanceRoster.length, 2)

// Bob's duration: 10:05 to 10:35 = 30 minutes = 1800s
const bobEntry = summaryWithRoster.attendanceRoster.find((p) => p.student_id === 's2')
assert.strictEqual(bobEntry.duration_seconds, 1800)
assert.strictEqual(bobEntry.duration_formatted, '30m 0s')
console.log('✓ Session duration and participant roster calculations verified')

// ============================================================================
// 4. Telemetry Distribution & Percentages Calculation
// ============================================================================
console.log('\n[4] Testing telemetry distribution calculations...')
const sampleTelemetry = [
  { data: { engagement_state: 'NORMAL_BEHAVIOUR', confusion_signal: 'LOW', confidence: 0.90 } },
  { data: { engagement_state: 'NORMAL_BEHAVIOUR', confusion_signal: 'LOW', confidence: 0.85 } },
  { data: { engagement_state: 'NORMAL_BEHAVIOUR', confusion_signal: 'LOW', confidence: 0.95 } },
  { data: { engagement_state: 'REDUCED_ENGAGEMENT_LIKE', confusion_signal: 'ELEVATED', confidence: 0.80 } }
]

const summaryWithTelemetry = calculateSessionSummary(sessionData, participantsData, sampleTelemetry)
assert.strictEqual(summaryWithTelemetry.isTelemetryAvailable, true)
assert.strictEqual(summaryWithTelemetry.totalObservations, 4)

// 3 Normal out of 4 = 75.0%
assert.strictEqual(summaryWithTelemetry.engagementDistribution.normalCount, 3)
assert.strictEqual(summaryWithTelemetry.engagementDistribution.reducedCount, 1)
assert.strictEqual(summaryWithTelemetry.engagementDistribution.normalPct, 75.0)
assert.strictEqual(summaryWithTelemetry.engagementDistribution.reducedPct, 25.0)

// 3 Low Confusion out of 4 = 75.0%, 1 Elevated = 25.0%
assert.strictEqual(summaryWithTelemetry.confusionDistribution.lowCount, 3)
assert.strictEqual(summaryWithTelemetry.confusionDistribution.elevatedCount, 1)
assert.strictEqual(summaryWithTelemetry.confusionDistribution.lowPct, 75.0)
assert.strictEqual(summaryWithTelemetry.confusionDistribution.elevatedPct, 25.0)

// Mean confidence: (0.90 + 0.85 + 0.95 + 0.80) / 4 = 0.875 -> rounded to 0.88
assert.strictEqual(summaryWithTelemetry.meanConfidence, 0.88)
console.log('✓ Telemetry distributions and mean confidence verified')

// ============================================================================
// 5. Timeline Series Parsing
// ============================================================================
console.log('\n[5] Testing timeline series parsing...')
const timelineTelemetry = [
  { timestamp_ms: 1728362400000, normal_pct: 80.0, reduced_pct: 20.0, elevated_confusion_pct: 10.0, reporting_count: 5 },
  { timestamp_ms: 1728362410000, normal_pct: 90.0, reduced_pct: 10.0, elevated_confusion_pct: 5.0, reporting_count: 5 }
]
const summaryWithTimeline = calculateSessionSummary(sessionData, participantsData, timelineTelemetry)
assert.strictEqual(summaryWithTimeline.timeline.length, 2)
assert.strictEqual(summaryWithTimeline.timeline[0].normal_pct, 80.0)
assert.strictEqual(summaryWithTimeline.timeline[1].normal_pct, 90.0)
console.log('✓ Timeline series parsing verified')

console.log('\nALL SESSION ANALYTICS UNIT TESTS PASSED!')
