/**
 * Session Analytics & Summary Calculation Module (Phase 4)
 *
 * Deterministically computes classroom attendance, engagement distributions,
 * confusion indicators, data coverage, and timeline progressions from session
 * and telemetry records.
 *
 * Enforces strict numerical safety (no NaN / Infinity) and preserves privacy
 * invariants (works entirely on derived states, zero biometrics).
 */

/**
 * Format duration in seconds into a friendly human-readable string.
 * e.g. 3672 -> "1h 1m 12s", 185 -> "3m 5s", 42 -> "42s", 0 -> "0s"
 */
export function formatDuration(seconds) {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds <= 0) {
    return '0s'
  }

  const s = Math.floor(seconds)
  const hours = Math.floor(s / 3600)
  const minutes = Math.floor((s % 3600) / 60)
  const remSeconds = s % 60

  if (hours > 0) {
    return `${hours}h ${minutes}m ${remSeconds}s`
  }
  if (minutes > 0) {
    return `${minutes}m ${remSeconds}s`
  }
  return `${remSeconds}s`
}

/**
 * Compute session summary metrics from session info, participant roster, and telemetry.
 *
 * @param {Object} session - Session document ({ id, title, started_at, ended_at, status })
 * @param {Array} participants - List of participant objects ({ student_id, student_name, joined_at, left_at, status })
 * @param {Array|Object} telemetryInput - Array of telemetry snapshots/messages or an in-memory summary object
 * @returns {Object} Deterministic session summary object
 */
export function calculateSessionSummary(session = {}, participants = [], telemetryInput = null) {
  // 1. Session Duration Calculation
  let durationSeconds = 0
  const startedAt = session?.started_at ? new Date(session.started_at) : null
  const endedAt = session?.ended_at ? new Date(session.ended_at) : null

  if (startedAt && !Number.isNaN(startedAt.getTime())) {
    const end = (endedAt && !Number.isNaN(endedAt.getTime())) ? endedAt : new Date()
    durationSeconds = Math.max(0, Math.floor((end.getTime() - startedAt.getTime()) / 1000))
  } else if (typeof session?.duration_seconds === 'number') {
    durationSeconds = Math.max(0, Math.floor(session.duration_seconds))
  }

  // 2. Participant Attendance
  const validParticipants = Array.isArray(participants) ? participants : []
  const seenStudentIds = new Set()
  const attendanceRoster = []
  let activeCount = 0
  let leftCount = 0

  for (const p of validParticipants) {
    if (!p || !p.student_id) continue
    if (seenStudentIds.has(p.student_id)) continue
    seenStudentIds.add(p.student_id)

    const isJoined = p.status === 'joined'
    if (isJoined) activeCount++
    else leftCount++

    let pDurationSeconds = null
    const pJoined = p.joined_at ? new Date(p.joined_at) : null
    const pLeft = p.left_at ? new Date(p.left_at) : null

    if (pJoined && !Number.isNaN(pJoined.getTime())) {
      const pEnd = (pLeft && !Number.isNaN(pLeft.getTime()))
        ? pLeft
        : (endedAt || new Date())
      pDurationSeconds = Math.max(0, Math.floor((pEnd.getTime() - pJoined.getTime()) / 1000))
    }

    attendanceRoster.push({
      student_id: p.student_id,
      student_name: p.student_name || 'Student',
      student_email: p.student_email || '',
      status: p.status || 'joined',
      joined_at: p.joined_at || null,
      left_at: p.left_at || null,
      duration_seconds: pDurationSeconds,
      duration_formatted: pDurationSeconds !== null ? formatDuration(pDurationSeconds) : '—'
    })
  }

  // 3. Telemetry Processing & Aggregated Distribution
  let isTelemetryAvailable = false
  let normalCount = 0
  let reducedCount = 0
  let uncertainEngagementCount = 0
  let lowConfusionCount = 0
  let elevatedConfusionCount = 0
  let uncertainConfusionCount = 0
  let confidenceSum = 0
  let confidenceCount = 0
  let totalObservations = 0
  const timeline = []

  // Check if telemetryInput is an array of messages / snapshots or a pre-aggregated map
  if (telemetryInput) {
    if (Array.isArray(telemetryInput) && telemetryInput.length > 0) {
      isTelemetryAvailable = true
      for (const entry of telemetryInput) {
        if (!entry) continue

        // Check if entry is a raw telemetry packet
        const data = entry.data || entry.payload || entry
        const engagement = data.engagement_state
        const confusion = data.confusion_signal || data.confusion_state
        const conf = typeof data.confidence === 'number' ? data.confidence : null

        if (engagement || confusion) {
          totalObservations++
          if (engagement === 'NORMAL_BEHAVIOUR') normalCount++
          else if (engagement === 'REDUCED_ENGAGEMENT_LIKE') reducedCount++
          else uncertainEngagementCount++

          if (confusion === 'LOW') lowConfusionCount++
          else if (confusion === 'ELEVATED') elevatedConfusionCount++
          else uncertainConfusionCount++

          if (conf !== null && Number.isFinite(conf) && conf >= 0 && conf <= 1) {
            confidenceSum += conf
            confidenceCount++
          }
        }

        // Check if entry is a timeline snapshot point
        if (typeof entry.timestamp_ms === 'number' && typeof entry.normal_pct !== 'undefined') {
          timeline.push({
            timestamp_ms: entry.timestamp_ms,
            time_label: new Date(entry.timestamp_ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            normal_pct: entry.normal_pct,
            reduced_pct: entry.reduced_pct,
            elevated_confusion_pct: entry.elevated_confusion_pct,
            reporting_count: entry.reporting_count || 0
          })
        }
      }
    } else if (typeof telemetryInput === 'object') {
      // In-memory summary snapshot object
      const counts = telemetryInput.counts || telemetryInput
      if (typeof counts.total_observations === 'number' && counts.total_observations > 0) {
        isTelemetryAvailable = true
        totalObservations = counts.total_observations
        normalCount = counts.normal_count || 0
        reducedCount = counts.reduced_count || 0
        uncertainEngagementCount = counts.uncertain_engagement_count || 0
        lowConfusionCount = counts.low_confusion_count || 0
        elevatedConfusionCount = counts.elevated_confusion_count || 0
        uncertainConfusionCount = counts.uncertain_confusion_count || 0
        confidenceSum = counts.confidence_sum || 0
        confidenceCount = counts.confidence_count || 0
      }
      if (Array.isArray(telemetryInput.timeline)) {
        for (const pt of telemetryInput.timeline) {
          timeline.push({
            timestamp_ms: pt.timestamp_ms,
            time_label: new Date(pt.timestamp_ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            normal_pct: pt.normal_pct,
            reduced_pct: pt.reduced_pct,
            elevated_confusion_pct: pt.elevated_confusion_pct,
            reporting_count: pt.reporting_count || 0
          })
        }
        if (timeline.length > 0) {
          isTelemetryAvailable = true
        }
      }
    }
  }

  // Calculate percentages safely without NaN
  const validEngagementTotal = normalCount + reducedCount + uncertainEngagementCount
  const normalPct = (isTelemetryAvailable && validEngagementTotal > 0)
    ? Math.round((normalCount / validEngagementTotal) * 1000) / 10
    : null
  const reducedPct = (isTelemetryAvailable && validEngagementTotal > 0)
    ? Math.round((reducedCount / validEngagementTotal) * 1000) / 10
    : null
  const uncertainEngagementPct = (isTelemetryAvailable && validEngagementTotal > 0)
    ? Math.round((uncertainEngagementCount / validEngagementTotal) * 1000) / 10
    : null

  const validConfusionTotal = lowConfusionCount + elevatedConfusionCount + uncertainConfusionCount
  const lowConfusionPct = (isTelemetryAvailable && validConfusionTotal > 0)
    ? Math.round((lowConfusionCount / validConfusionTotal) * 1000) / 10
    : null
  const elevatedConfusionPct = (isTelemetryAvailable && validConfusionTotal > 0)
    ? Math.round((elevatedConfusionCount / validConfusionTotal) * 1000) / 10
    : null
  const uncertainConfusionPct = (isTelemetryAvailable && validConfusionTotal > 0)
    ? Math.round((uncertainConfusionCount / validConfusionTotal) * 1000) / 10
    : null

  const meanConfidence = (confidenceCount > 0)
    ? Math.round((confidenceSum / confidenceCount) * 100) / 100
    : null

  return {
    sessionId: session?.id || session?._id || 'unknown',
    sessionTitle: session?.title || 'Session',
    sessionStatus: session?.status || 'ended',
    startedAt: session?.started_at || null,
    endedAt: session?.ended_at || null,
    durationSeconds,
    durationFormatted: formatDuration(durationSeconds),
    totalParticipants: seenStudentIds.size,
    activeParticipants: activeCount,
    leftParticipants: leftCount,
    attendanceRoster,
    isTelemetryAvailable,
    totalObservations,
    engagementDistribution: {
      normalCount,
      reducedCount,
      uncertainCount: uncertainEngagementCount,
      normalPct,
      reducedPct,
      uncertainPct: uncertainEngagementPct
    },
    confusionDistribution: {
      lowCount: lowConfusionCount,
      elevatedCount: elevatedConfusionCount,
      uncertainCount: uncertainConfusionCount,
      lowPct: lowConfusionPct,
      elevatedPct: elevatedConfusionPct,
      uncertainPct: uncertainConfusionPct
    },
    meanConfidence,
    timeline,
    dataCoverage: {
      totalEnrolled: seenStudentIds.size,
      observationsCount: totalObservations,
      hasTimeline: timeline.length > 0,
      privacyPolicy: 'Raw video and landmark biometrics are browser-local. Only derived state distributions are processed.'
    }
  }
}
