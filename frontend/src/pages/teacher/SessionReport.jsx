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

  useEffect(() => {
    let isMounted = true

    const fetchSummary = async () => {
      try {
        const token = localStorage.getItem('token')
        if (!token) {
          navigate('/login')
          return
        }

        // 1. Fetch REST session summary from backend
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

        // 2. Fetch classroom details for join code & course name if available
        if (data.classroom_id) {
          try {
            const classRes = await fetch(`${API_BASE_URL}/api/classrooms/${data.classroom_id}`, {
              headers: { Authorization: `Bearer ${token}` }
            })
            if (classRes.ok) {
              const cData = await classRes.json()
              if (isMounted) setClassroomData(cData)
            }
          } catch (_) {
            // Classroom details are non-blocking
          }
        }

        // 3. Check for in-memory / session-cached live telemetry accumulated by teacher
        let cachedTelemetry = null
        try {
          const rawCached = sessionStorage.getItem(`mindmap_session_summary_${sessionId}`)
          if (rawCached) {
            cachedTelemetry = JSON.parse(rawCached)
          }
        } catch (_) {
          // Ignore cache parse failure
        }

        // 4. Calculate integrated session summary
        const calculated = calculateSessionSummary(data, data.participants || [], cachedTelemetry)
        calculated.classroomName = data.classroom_name || 'Classroom'
        calculated.classroomId = data.classroom_id

        if (isMounted) {
          setSummaryData(calculated)
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
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase font-mono font-bold tracking-widest text-primary-700 bg-primary-50 border border-primary-200 px-2 py-0.5 rounded">
              MindMap Session Report
            </span>
            <StatusBadge status="info" label="Concluded Session" />
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

        {/* Action Controls (Hidden during print export) */}
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
          value={engagementDistribution.normalPct !== null ? `${engagementDistribution.normalPct}%` : '—'}
          sublabel={isTelemetryAvailable ? `${engagementDistribution.normalCount} observations` : 'No live telemetry'}
          valueColor="text-emerald-600"
        />

        <MetricCard
          label="Elevated Confusion"
          value={confusionDistribution.elevatedPct !== null ? `${confusionDistribution.elevatedPct}%` : '—'}
          sublabel={isTelemetryAvailable ? `${confusionDistribution.elevatedCount} observations` : 'No live telemetry'}
          valueColor={confusionDistribution.elevatedPct > 35 ? 'text-rose-600' : 'text-indigo-600'}
        />

        <MetricCard
          label="Mean Confidence"
          value={meanConfidence !== null ? `${Math.round(meanConfidence * 100)}%` : '—'}
          sublabel={totalObservations > 0 ? `${totalObservations} samples` : 'Uncalibrated'}
          valueColor="text-brand-navy"
        />
      </div>

      {/* Behavioural Distribution Charts */}
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

      {/* Session Behaviour Timeline (If continuous timeline was recorded) */}
      <TimelineTrendChart
        timeline={timeline}
        title="Session Behaviour Trajectory"
        subtitle="Progression of classroom engagement and confusion throughout the lecture duration"
      />

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
              <tbody className="divide-y divide-neutral-border/60">
                {attendanceRoster.map((student) => (
                  <tr key={student.student_id} className="hover:bg-neutral-light/50 transition-colors">
                    <td className="py-2 px-3 font-medium text-brand-navy">
                      {student.student_name}
                    </td>
                    <td className="py-2 px-3 text-text-muted font-mono text-[11px]">
                      {student.student_email || '—'}
                    </td>
                    <td className="py-2 px-3 text-text-muted">
                      {student.joined_at ? new Date(student.joined_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                    </td>
                    <td className="py-2 px-3 text-text-muted">
                      {student.left_at ? new Date(student.left_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : (endedAt ? new Date(endedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Active')}
                    </td>
                    <td className="py-2 px-3 font-mono text-[11px] font-semibold text-brand-navy">
                      {student.duration_formatted}
                    </td>
                    <td className="py-2 px-3 text-right">
                      {student.status === 'joined' ? (
                        <StatusBadge status="success" label="Active" />
                      ) : (
                        <StatusBadge status="info" label="Completed" />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Ethical & Scientific Interpretability Disclaimer */}
      <div className="p-4 bg-neutral-light border border-neutral-border rounded text-[11px] text-text-muted space-y-1.5 leading-relaxed">
        <div className="flex items-center gap-1.5 font-bold text-brand-navy text-xs">
          <svg className="w-4 h-4 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>Ethical & Scientific Interpretability Notice</span>
        </div>
        <p>
          Behavioural states and confusion signals are heuristic algorithmic approximations derived from non-invasive facial cues (eye aspect ratio, gaze stability, and head pose variance) relative to each student's personal baseline calibration.
        </p>
        <p>
          These indicators are designed to provide aggregated classroom feedback and do <strong>not</strong> constitute medical, cognitive, or definitive assessments of individual student comprehension or learning capability. In accordance with MindMap privacy architecture, all raw video frames and facial landmarks remain strictly local to the student's browser and are never persisted.
        </p>
      </div>
    </PageContainer>
  )
}
