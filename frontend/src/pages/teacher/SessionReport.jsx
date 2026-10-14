import React, { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import PageContainer from '../../components/PageContainer'
import Button from '../../components/Button'
import StatusBadge from '../../components/StatusBadge'
import MetricCard from '../../components/analytics/MetricCard'
import DistributionBarChart from '../../components/analytics/DistributionBarChart'
import ConfusionDistributionChart from '../../components/analytics/ConfusionDistributionChart'
import TimelineTrendChart from '../../components/analytics/TimelineTrendChart'
import { calculateSessionSummary } from '../../features/analytics/sessionAnalytics'
import { API_BASE_URL } from '../../config/api'

export default function SessionReport() {
  const { sessionId } = useParams()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [summaryData, setSummaryData] = useState(null)
  const [classroomData, setClassroomData] = useState(null)
  const [telemetrySource, setTelemetrySource] = useState('unavailable') // 'persisted', 'live_cache', 'unavailable'
  const [dataQuality, setDataQuality] = useState('no_telemetry')
  const [bucketStats, setBucketStats] = useState({ totalBuckets: 0, validBuckets: 0 })

  useEffect(() => {
    let isMounted = true

    const fetchSummary = async () => {
      try {
        const token = localStorage.getItem('token')
        if (!token) {
          navigate('/login')
          return
        }

        // 1. Fetch REST session summary and participant roster
        const res = await fetch(`${API_BASE_URL}/api/sessions/${sessionId}/summary`, {
          headers: { Authorization: `Bearer ${token}` }
        })

        if (res.status === 401) {
          navigate('/login')
          return
        }
        if (res.status === 403) {
          setError('You are not authorized to view this session report.')
          return
        }
        if (res.status === 404) {
          setError('Session not found.')
          return
        }
        if (!res.ok) {
          throw new Error('Failed to load session summary')
        }

        const data = await res.json()
        if (!isMounted) return

        // 2. Fetch classroom details for join code
        if (data.classroom_id) {
          try {
            const classRes = await fetch(`${API_BASE_URL}/api/classrooms/${data.classroom_id}`, {
              headers: { Authorization: `Bearer ${token}` }
            })
            if (classRes.ok) {
              const cData = await classRes.json()
              if (isMounted) setClassroomData(cData)
            }
          } catch {
            // Non-blocking
          }
        }

        // 3. Attempt to fetch persisted analytics summary & 1-minute buckets from backend
        let persistedSummary = null
        let persistedBuckets = []

        try {
          const [analyticsRes, bucketsRes] = await Promise.all([
            fetch(`${API_BASE_URL}/api/sessions/${sessionId}/analytics/summary`, {
              headers: { Authorization: `Bearer ${token}` }
            }),
            fetch(`${API_BASE_URL}/api/sessions/${sessionId}/analytics/buckets`, {
              headers: { Authorization: `Bearer ${token}` }
            })
          ])

          if (analyticsRes.ok) {
            persistedSummary = await analyticsRes.json()
          }
          if (bucketsRes.ok) {
            persistedBuckets = await bucketsRes.json()
          }
        } catch {
          // Fall back gracefully if analytics endpoints are unreachable
        }

        // 4. Resolve telemetry data source (persisted MongoDB vs live cache vs unavailable)
        let resolvedSummary = null
        let resolvedSource = 'unavailable'
        let resolvedQuality = 'no_telemetry'
        let totalB = 0
        let validB = 0

        if (persistedSummary && persistedSummary.telemetry_status === 'persisted' && persistedSummary.total_observations > 0) {
          resolvedSource = 'persisted'
          resolvedQuality = persistedSummary.data_quality || 'reliable'
          totalB = persistedSummary.total_buckets || persistedBuckets.length
          validB = persistedSummary.valid_buckets || 0

          // Map 1-minute buckets into timeline progression
          const timelineFromBuckets = (persistedBuckets || [])
            .filter((b) => b.normal_pct !== null && b.normal_pct !== undefined)
            .map((b) => ({
              timestamp_ms: new Date(b.start_time).getTime(),
              time_label: new Date(b.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              normal_pct: b.normal_pct,
              reduced_pct: b.reduced_pct,
              elevated_confusion_pct: b.elevated_confusion_pct,
              reporting_count: b.reporting_students || 0
            }))

          const calculated = calculateSessionSummary(data, data.participants || [], {
            counts: {
              total_observations: persistedSummary.total_observations,
              normal_count: persistedSummary.engagement_distribution.normal_count,
              reduced_count: persistedSummary.engagement_distribution.reduced_count,
              uncertain_engagement_count: persistedSummary.engagement_distribution.uncertain_count,
              low_confusion_count: persistedSummary.confusion_distribution.low_count,
              elevated_confusion_count: persistedSummary.confusion_distribution.elevated_count,
              uncertain_confusion_count: persistedSummary.confusion_distribution.uncertain_count,
              confidence_sum: (persistedSummary.mean_confidence || 0) * persistedSummary.total_observations,
              confidence_count: persistedSummary.total_observations
            },
            timeline: timelineFromBuckets
          })

          // Ensure exact percentage matches from backend
          calculated.engagementDistribution.normalPct = persistedSummary.engagement_distribution.normal_pct
          calculated.engagementDistribution.reducedPct = persistedSummary.engagement_distribution.reduced_pct
          calculated.engagementDistribution.uncertainPct = persistedSummary.engagement_distribution.uncertain_pct
          calculated.confusionDistribution.lowPct = persistedSummary.confusion_distribution.low_pct
          calculated.confusionDistribution.elevatedPct = persistedSummary.confusion_distribution.elevated_pct
          calculated.confusionDistribution.uncertainPct = persistedSummary.confusion_distribution.uncertain_pct
          calculated.meanConfidence = persistedSummary.mean_confidence
          calculated.isTelemetryAvailable = true

          resolvedSummary = calculated
        } else {
          // Check for in-memory session cache from active teacher session
          let cachedTelemetry = null
          try {
            const rawCached = sessionStorage.getItem(`mindmap_session_summary_${sessionId}`)
            if (rawCached) {
              cachedTelemetry = JSON.parse(rawCached)
            }
          } catch {
            // Ignore cache parse failure
          }

          const calculated = calculateSessionSummary(data, data.participants || [], cachedTelemetry)
          if (cachedTelemetry && calculated.isTelemetryAvailable) {
            resolvedSource = 'live_cache'
            resolvedQuality = 'in_memory'
          } else {
            resolvedSource = 'unavailable'
            resolvedQuality = 'no_telemetry'
            calculated.isTelemetryAvailable = false
          }
          resolvedSummary = calculated
        }

        resolvedSummary.classroomName = data.classroom_name || 'Classroom'
        resolvedSummary.classroomId = data.classroom_id

        if (isMounted) {
          setSummaryData(resolvedSummary)
          setTelemetrySource(resolvedSource)
          setDataQuality(resolvedQuality)
          setBucketStats({ totalBuckets: totalB, validBuckets: validB })
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message || 'Error loading session summary.')
        }
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    fetchSummary()

    return () => {
      isMounted = false
    }
  }, [sessionId, navigate])

  const handlePrint = () => {
    window.print()
  }

  if (loading) {
    return (
      <PageContainer size="large" className="py-12 text-center">
        <p className="text-xs text-text-muted">Loading session analytics and report...</p>
      </PageContainer>
    )
  }

  if (error || !summaryData) {
    return (
      <PageContainer size="small" className="py-12">
        <div className="card-panel space-y-4 text-center">
          <StatusBadge status="danger" label="Report Error" />
          <h3 className="text-h3 text-brand-navy">Unable to Load Report</h3>
          <p className="text-xs text-text-muted">{error || 'Session report is unavailable.'}</p>
          <div className="pt-2">
            <Link to="/teacher">
              <Button variant="primary">Return to Teacher Portal</Button>
            </Link>
          </div>
        </div>
      </PageContainer>
    )
  }

  const {
    sessionTitle,
    classroomName,
    classroomId,
    durationFormatted,
    totalParticipants,
    activeParticipants,
    leftParticipants,
    attendanceRoster,
    isTelemetryAvailable,
    totalObservations,
    engagementDistribution,
    confusionDistribution,
    meanConfidence,
    timeline,
    startedAt,
    endedAt
  } = summaryData

  return (
    <PageContainer size="large" className="py-6 space-y-6 print:py-0 print:space-y-4">
      {/* Printable styles override */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body {
            background-color: #ffffff !important;
            color: #0f172a !important;
          }
          .no-print {
            display: none !important;
          }
          .card-panel {
            box-shadow: none !important;
            border: 1px solid #cbd5e1 !important;
            break-inside: avoid;
          }
        }
      `}} />

      {/* Report Header Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-panel-bg border border-neutral-border rounded p-4 shadow-sm print:border-none print:shadow-none print:p-0">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] uppercase font-mono font-bold tracking-widest text-primary-700 bg-primary-50 border border-primary-200 px-2 py-0.5 rounded">
              MindMap Session Report
            </span>
            <StatusBadge status="info" label="Concluded Session" />
            {telemetrySource === 'persisted' && (
              <span className="text-[10px] uppercase font-mono font-bold tracking-widest text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                Persisted Analytics (MongoDB)
              </span>
            )}
            {telemetrySource === 'live_cache' && (
              <span className="text-[10px] uppercase font-mono font-bold tracking-widest text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                Live In-Memory Snapshot
              </span>
            )}
            {telemetrySource === 'unavailable' && (
              <span className="text-[10px] uppercase font-mono font-bold tracking-widest text-text-muted bg-neutral-light border border-neutral-border px-2 py-0.5 rounded">
                No Persisted Telemetry
              </span>
            )}
          </div>

          <h1 className="text-xl font-bold text-brand-navy mt-1.5 print:text-2xl">
            {sessionTitle}
          </h1>

          <div className="text-xs text-text-muted mt-1 space-x-2">
            <span className="font-semibold text-brand-navy-light">{classroomName}</span>
            {classroomData?.join_code && (
              <>
                <span>&bull;</span>
                <span>Code: <code className="font-mono bg-neutral-light border px-1 rounded">{classroomData.join_code}</code></span>
              </>
            )}
            {startedAt && (
              <>
                <span>&bull;</span>
                <span>Date: {new Date(startedAt).toLocaleDateString()}</span>
              </>
            )}
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 no-print self-end sm:self-auto">
          {classroomId && (
            <Link to={`/teacher/classroom/${classroomId}`}>
              <Button variant="secondary" className="text-xs py-1.5 px-3">
                &larr; Classroom
              </Button>
            </Link>
          )}

          <Button
            variant="primary"
            onClick={handlePrint}
            className="text-xs py-1.5 px-3 flex items-center gap-1.5 shadow-sm"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            <span>Download Report (PDF)</span>
          </Button>
        </div>
      </div>

      {/* Persistence & Data Quality Indicator Banner */}
      {telemetrySource === 'persisted' && (
        <div className="bg-emerald-50/70 border border-emerald-200/80 rounded p-3 text-xs text-emerald-800 flex flex-col sm:flex-row justify-between sm:items-center gap-2">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>
              <strong>Privacy-Preserving Telemetry Verified:</strong> Derived from genuine client observations aggregated into 1-minute non-biometric time buckets.
            </span>
          </div>
          <div className="text-[11px] font-mono text-emerald-700 flex items-center gap-3">
            <span>Interval: 1 min</span>
            {bucketStats.totalBuckets > 0 && <span>Buckets: {bucketStats.validBuckets}/{bucketStats.totalBuckets} valid</span>}
            <span>Quality: {dataQuality}</span>
          </div>
        </div>
      )}

      {telemetrySource === 'unavailable' && (
        <div className="bg-neutral-light border border-neutral-border rounded p-4 text-xs text-text-muted space-y-1">
          <p className="font-semibold text-brand-navy">
            Historical Telemetry Unavailable
          </p>
          <p>
            This session does not contain persisted behavioral telemetry records (it was concluded prior to persistence activation or without active student telemetry reporting). Attendance records and session duration are preserved below.
          </p>
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <MetricCard
          label="Duration"
          value={durationFormatted}
          sublabel={startedAt && endedAt ? `${new Date(startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${new Date(endedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Session Length'}
          valueColor="text-brand-navy"
        />

        <MetricCard
          label="Students"
          value={totalParticipants}
          sublabel={`${activeParticipants} Active / ${leftParticipants} Left`}
          valueColor="text-brand-navy"
        />

        <MetricCard
          label="Normal Behaviour"
          value={engagementDistribution.normalPct !== null ? `${engagementDistribution.normalPct}%` : '--'}
          sublabel={isTelemetryAvailable ? `${engagementDistribution.normalCount} observations` : 'No telemetry data'}
          valueColor="text-emerald-600"
        />

        <MetricCard
          label="Elevated Confusion"
          value={confusionDistribution.elevatedPct !== null ? `${confusionDistribution.elevatedPct}%` : '--'}
          sublabel={isTelemetryAvailable ? `${confusionDistribution.elevatedCount} observations` : 'No telemetry data'}
          valueColor={confusionDistribution.elevatedPct > 35 ? 'text-rose-600' : 'text-indigo-600'}
        />

        <MetricCard
          label="Mean Confidence"
          value={meanConfidence !== null ? `${Math.round(meanConfidence * 100)}%` : '--'}
          sublabel={totalObservations > 0 ? `${totalObservations} samples` : 'Unavailable'}
          valueColor="text-brand-navy"
        />
      </div>

      {/* Behavioural Distribution Charts */}
      {isTelemetryAvailable && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <DistributionBarChart
            title="Engagement Distribution"
            subtitle="Estimated time spent across normal vs reduced engagement states"
            normalPct={engagementDistribution.normalPct}
            reducedPct={engagementDistribution.reducedPct}
            uncertainPct={engagementDistribution.uncertainPct}
            normalCount={engagementDistribution.normalCount}
            reducedCount={engagementDistribution.reducedCount}
            uncertainCount={engagementDistribution.uncertainCount}
          />

          <ConfusionDistributionChart
            title="Confusion Signal Distribution"
            subtitle="Distribution of facial/gaze indicators associated with confusion"
            lowPct={confusionDistribution.lowPct}
            elevatedPct={confusionDistribution.elevatedPct}
            uncertainPct={confusionDistribution.uncertainPct}
            lowCount={confusionDistribution.lowCount}
            elevatedCount={confusionDistribution.elevatedCount}
            uncertainCount={confusionDistribution.uncertainCount}
          />
        </div>
      )}

      {/* Session Behaviour Timeline (If continuous timeline was recorded) */}
      {isTelemetryAvailable && (
        <TimelineTrendChart
          timeline={timeline}
          title="Session Behaviour Trajectory (1-Minute Intervals)"
          subtitle="Discrete 1-minute bucket progression of classroom normal behaviour and elevated confusion"
        />
      )}

      {/* Student Attendance & Participation Roster */}
      <div className="card-panel space-y-3">
        <div className="flex justify-between items-center border-b border-neutral-border pb-2.5">
          <div>
            <h3 className="text-sm font-bold text-brand-navy uppercase tracking-wider">
              Student Participation Summary
            </h3>
            <p className="text-[11px] text-text-muted mt-0.5">
              Verified attendance and session duration records for enrolled participants
            </p>
          </div>
          <span className="text-xs font-mono text-text-muted">
            {totalParticipants} Enrolled
          </span>
        </div>

        {attendanceRoster.length === 0 ? (
          <p className="text-xs text-text-muted py-6 text-center italic">
            No students attended this session.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-neutral-light border-b border-neutral-border text-[10px] uppercase font-mono text-text-muted">
                <tr>
                  <th className="py-2.5 px-3">Student Name</th>
                  <th className="py-2.5 px-3">Email</th>
                  <th className="py-2.5 px-3">Join Time</th>
                  <th className="py-2.5 px-3">Leave Time</th>
                  <th className="py-2.5 px-3">Duration</th>
                  <th className="py-2.5 px-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-border text-text-muted">
                {attendanceRoster.map((p, idx) => (
                  <tr key={idx} className="hover:bg-neutral-light/35">
                    <td className="py-2.5 px-3 font-semibold text-brand-navy-light">
                      {p.student_name}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[11px]">
                      {p.student_email || '--'}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[11px]">
                      {p.joined_at ? new Date(p.joined_at).toLocaleTimeString() : '--'}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[11px]">
                      {p.left_at ? new Date(p.left_at).toLocaleTimeString() : (endedAt ? new Date(endedAt).toLocaleTimeString() : 'Active')}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[11px]">
                      {p.duration_formatted}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      {p.status === 'joined' ? (
                        <StatusBadge status="success" label="Joined" />
                      ) : (
                        <StatusBadge status="info" label="Left" />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Privacy Notice Banner */}
      <div className="bg-primary-50/60 border border-primary-200/70 rounded p-4 text-xs text-text-muted space-y-1">
        <div className="flex items-center gap-1.5 font-semibold text-primary-900">
          <svg className="w-4 h-4 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <span>MindMap Privacy & Ethical Standards</span>
        </div>
        <p className="leading-relaxed">
          This report contains aggregate classroom statistics and student attendance records. Individual biometric data, raw webcam streams, facial landmark meshes, Eye Aspect Ratio (EAR), and head-pose telemetry are strictly processed client-side in the student's browser and are never persisted to MongoDB Atlas.
        </p>
      </div>
    </PageContainer>
  )
}
