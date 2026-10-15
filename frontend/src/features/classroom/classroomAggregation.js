/**
 * Classroom Behavioural Aggregation Module (Phase 3C)
 *
 * Provides pure, deterministic aggregation functions for computing real-time
 * classroom-level behavioral distributions across reporting students.
 *
 * Strict Guardrails:
 * - Real-time in-memory calculation only (never persisted to DB).
 * - Excludes stale students (> STALE_TELEMETRY_MS) from active percentages.
 * - Handles zero students safely without returning NaN or fake percentages.
 * - Never computes or references raw biometric signals.
 */

export const STALE_TELEMETRY_MS = 10000 // 10.0 seconds stale threshold

/**
 * Checks if a telemetry record is actively reporting based on lastUpdated timestamp.
 *
 * @param {object|null|undefined} record - Student telemetry record
 * @param {number} [nowMs=Date.now()] - Current epoch timestamp in ms
 * @returns {boolean}
 */
export function isStudentReporting(record, nowMs = Date.now()) {
  if (!record || typeof record !== 'object') return false
  const timestamp = typeof record.received_at_ms === 'number'
    ? record.received_at_ms
    : record.lastUpdated
  if (typeof timestamp !== 'number' || !Number.isFinite(timestamp)) return false
  const elapsed = nowMs - timestamp
  return elapsed >= -60000 && elapsed <= STALE_TELEMETRY_MS
}

/**
 * Calculates classroom-level aggregate statistics across active student telemetry records.
 *
 * @param {Array<object>|object} telemetryRecords - Array of student telemetry records or dictionary keyed by student_id
 * @param {number} [nowMs=Date.now()] - Current epoch timestamp in ms
 * @returns {object} Aggregated classroom statistics
 */
export function calculateClassroomAggregation(telemetryRecords, nowMs = Date.now()) {
  // Normalize records to an array
  let records = []
  if (Array.isArray(telemetryRecords)) {
    records = telemetryRecords
  } else if (telemetryRecords && typeof telemetryRecords === 'object') {
    records = Object.values(telemetryRecords)
  }

  // Filter to valid objects
  const validRecords = records.filter((r) => r && typeof r === 'object')

  // Filter to actively reporting students (within STALE_TELEMETRY_MS)
  const reportingStudents = validRecords.filter((r) => isStudentReporting(r, nowMs))
  const reportingCount = reportingStudents.length

  // Base state when zero students are reporting
  if (reportingCount === 0) {
    return {
      reportingCount: 0,
      totalTrackedCount: validRecords.length,
      normalPercentage: null,
      reducedPercentage: null,
      elevatedConfusionPercentage: null,
      meanConfidence: null,
      counts: {
        normal: 0,
        reduced: 0,
        uncertainEngagement: 0,
        lowConfusion: 0,
        elevatedConfusion: 0,
        uncertainConfusion: 0
      }
    }
  }

  // Count states among actively reporting students
  let normalCount = 0
  let reducedCount = 0
  let uncertainEngagementCount = 0

  let lowConfusionCount = 0
  let elevatedConfusionCount = 0
  let uncertainConfusionCount = 0

  let confidenceSum = 0
  let validConfidenceCount = 0

  for (const student of reportingStudents) {
    // Engagement state
    if (student.engagement_state === 'NORMAL_BEHAVIOUR') {
      normalCount++
    } else if (student.engagement_state === 'REDUCED_ENGAGEMENT_LIKE') {
      reducedCount++
    } else {
      uncertainEngagementCount++
    }

    // Confusion signal
    const confusionSignal = student.confusion_signal ?? student.confusion_state
    if (confusionSignal === 'LOW') {
      lowConfusionCount++
    } else if (confusionSignal === 'ELEVATED') {
      elevatedConfusionCount++
    } else {
      uncertainConfusionCount++
    }

    // Confidence
    if (typeof student.confidence === 'number' && Number.isFinite(student.confidence)) {
      confidenceSum += Math.min(Math.max(student.confidence, 0.0), 1.0)
      validConfidenceCount++
    }
  }

  const normalPercentage = (normalCount / reportingCount) * 100
  const reducedPercentage = (reducedCount / reportingCount) * 100
  const elevatedConfusionPercentage = (elevatedConfusionCount / reportingCount) * 100
  const meanConfidence = validConfidenceCount > 0 ? confidenceSum / validConfidenceCount : null

  return {
    reportingCount,
    totalTrackedCount: validRecords.length,
    normalPercentage,
    reducedPercentage,
    elevatedConfusionPercentage,
    meanConfidence,
    counts: {
      normal: normalCount,
      reduced: reducedCount,
      uncertainEngagement: uncertainEngagementCount,
      lowConfusion: lowConfusionCount,
      elevatedConfusion: elevatedConfusionCount,
      uncertainConfusion: uncertainConfusionCount
    }
  }
}
