import React, { useState, useEffect, useRef } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import PageContainer from '../../components/PageContainer'
import Button from '../../components/Button'
import Input from '../../components/Input'
import StatusBadge from '../../components/StatusBadge'
import { useSessionWebSocket } from '../../hooks/useSessionWebSocket'
import { calculateClassroomAggregation, isStudentReporting } from '../../features/classroom/classroomAggregation'
import { API_BASE_URL } from '../../config/api'

export default function TeacherClassroom() {
  const { id } = useParams()
  const navigate = useNavigate()
  
  const [classroom, setClassroom] = useState(null)
  const [sessions, setSessions] = useState([])
  const [participants, setParticipants] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [sessionError, setSessionError] = useState('')
  const [actionLoading, setActionLoading] = useState(false)
  const [concludedSession, setConcludedSession] = useState(null)

  // In-memory session telemetry accumulation
  const telemetryTimelineRef = useRef([])
  const telemetryCountsRef = useRef({
    total_observations: 0,
    normal_count: 0,
    reduced_count: 0,
    uncertain_engagement_count: 0,
    low_confusion_count: 0,
    elevated_confusion_count: 0,
    uncertain_confusion_count: 0,
    confidence_sum: 0,
    confidence_count: 0
  })

  // Create session form state
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [newScheduledAt, setNewScheduledAt] = useState('')

  const fetchClassroomAndSessions = async () => {
    try {
      const token = localStorage.getItem('token')
      if (!token) {
        navigate('/login')
        return
      }

      // 1. Fetch classroom
      const classRes = await fetch(`${API_BASE_URL}/api/classrooms/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      
      if (classRes.status === 401) {
        navigate('/login')
        return
      }
      if (classRes.status === 403) {
        navigate('/teacher')
        return
      }
      if (!classRes.ok) {
        throw new Error('Failed to load classroom details')
      }
      const classData = await classRes.json()
      setClassroom(classData)

      // 2. Fetch sessions
      const sessRes = await fetch(`${API_BASE_URL}/api/classrooms/${id}/sessions`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (sessRes.ok) {
        const sessData = await sessRes.json()
        setSessions(sessData)

        // 3. Fetch participants for the active or latest session
        const curr = sessData.find((s) => s.status === 'active') || sessData.find((s) => s.status === 'scheduled') || sessData[0]
        if (curr) {
          const partRes = await fetch(`${API_BASE_URL}/api/sessions/${curr.id}/participants`, {
            headers: { Authorization: `Bearer ${token}` }
          })
          if (partRes.ok) {
            const partData = await partRes.json()
            const deduped = []
            const seenIds = new Set()
            for (const p of partData) {
              if (!seenIds.has(p.student_id)) {
                seenIds.add(p.student_id)
                deduped.push(p)
              }
            }
            setParticipants(deduped)
          }
        } else {
          setParticipants([])
        }
      }
    } catch (err) {
      console.error(err)
      setError('Could not load classroom or session details.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchClassroomAndSessions()
  }, [id, navigate])

  const handleCreateSession = async (e) => {
    e.preventDefault()
    if (!newTitle.trim()) {
      setSessionError('Session title is required.')
      return
    }

    setSessionError('')
    setActionLoading(true)
    try {
      const token = localStorage.getItem('token')
      const payload = {
        classroom_id: id,
        title: newTitle.trim(),
        description: newDescription.trim() || null,
        scheduled_at: newScheduledAt ? new Date(newScheduledAt).toISOString() : null
      }

      const res = await fetch(`${API_BASE_URL}/api/sessions/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      })

      if (res.status === 401) {
        navigate('/login')
        return
      }

      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.detail || 'Failed to create session')
      }

      setNewTitle('')
      setNewDescription('')
      setNewScheduledAt('')
      setShowCreateForm(false)
      await fetchClassroomAndSessions()
    } catch (err) {
      setSessionError(err.message || 'Error creating session')
    } finally {
      setActionLoading(false)
    }
  }

  const handleStartSession = async (sessionId) => {
    setSessionError('')
    setActionLoading(true)
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`${API_BASE_URL}/api/sessions/${sessionId}/start`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      })

      if (res.status === 401) {
        navigate('/login')
        return
      }

      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.detail || 'Failed to start session')
      }

      await fetchClassroomAndSessions()
    } catch (err) {
      setSessionError(err.message || 'Error starting session')
    } finally {
      setActionLoading(false)
    }
  }

  const handleEndSession = async (sessionId) => {
    setSessionError('')
    setActionLoading(true)
    try {
      // Seal in-memory telemetry summary into sessionStorage for immediate report access
      const sealedSummary = {
        session_id: sessionId,
        ended_at_ms: Date.now(),
        counts: { ...telemetryCountsRef.current },
        timeline: [...telemetryTimelineRef.current]
      }
      try {
        sessionStorage.setItem(`mindmap_session_summary_${sessionId}`, JSON.stringify(sealedSummary))
      } catch (_) {
        // Non-blocking storage
      }

      const token = localStorage.getItem('token')
      const res = await fetch(`${API_BASE_URL}/api/sessions/${sessionId}/end`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      })

      if (res.status === 401) {
        navigate('/login')
        return
      }

      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.detail || 'Failed to end session')
      }

      const endedData = await res.json()
      setConcludedSession(endedData)
      await fetchClassroomAndSessions()
    } catch (err) {
      setSessionError(err.message || 'Error ending session')
    } finally {
      setActionLoading(false)
    }
  }

  const activeSession = sessions.find((s) => s.status === 'active')
  const scheduledSession = sessions.find((s) => s.status === 'scheduled')
  const currentSession = activeSession || scheduledSession || (sessions.length > 0 ? sessions[0] : null)

  const courseTitle = classroom ? classroom.name : `Classroom session: ${id?.toUpperCase()}`

  // Phase 3C: Live student telemetry registry & real-time WebSocket connection
  const [liveTelemetry, setLiveTelemetry] = useState({})
  const [nowMs, setNowMs] = useState(() => Date.now())

  const token = localStorage.getItem('token')
  const isWsActive = Boolean(activeSession && activeSession.status === 'active')
  const { connectionState, retryCount, lastMessage } = useSessionWebSocket(
    activeSession?.id,
    token,
    isWsActive
  )

  // Ingest incoming student_behaviour_telemetry
  useEffect(() => {
    if (!lastMessage) return
    if (lastMessage.type === 'student_behaviour_telemetry' && lastMessage.data) {
      const data = lastMessage.data
      const studentId = data.user_id
      if (studentId) {
        setLiveTelemetry((prev) => ({
          ...prev,
          [studentId]: {
            user_id: studentId,
            student_name: data.student_name,
            engagement_state: data.engagement_state,
            confusion_signal: data.confusion_signal,
            confidence: data.confidence,
            received_at_ms: data.received_at_ms
          }
        }))

        // Accumulate in-memory session counts for summary report
        if (data.engagement_state === 'NORMAL_BEHAVIOUR') telemetryCountsRef.current.normal_count++
        else if (data.engagement_state === 'REDUCED_ENGAGEMENT_LIKE') telemetryCountsRef.current.reduced_count++
        else telemetryCountsRef.current.uncertain_engagement_count++

        if (data.confusion_signal === 'LOW') telemetryCountsRef.current.low_confusion_count++
        else if (data.confusion_signal === 'ELEVATED') telemetryCountsRef.current.elevated_confusion_count++
        else telemetryCountsRef.current.uncertain_confusion_count++

        telemetryCountsRef.current.total_observations++
        if (typeof data.confidence === 'number') {
          telemetryCountsRef.current.confidence_sum += data.confidence
          telemetryCountsRef.current.confidence_count++
        }

        // F-01 & F-03: Reconcile and synchronize the participant roster dynamically
        setParticipants((prev) => {
          const index = prev.findIndex((p) => p.student_id === studentId)
          if (index >= 0) {
            if (prev[index].status === 'joined') {
              return prev
            }
            const updated = [...prev]
            updated[index] = {
              ...updated[index],
              status: 'joined',
              left_at: null
            }
            return updated
          }
          // Absent from REST-loaded roster: dynamically add participant
          return [
            ...prev,
            {
              id: `live_${studentId}`,
              session_id: activeSession?.id,
              classroom_id: id,
              student_id: studentId,
              student_name: data.student_name || 'Student',
              student_email: '', // Not exposed over telemetry to protect privacy
              joined_at: new Date(data.received_at_ms || Date.now()).toISOString(),
              left_at: null,
              status: 'joined'
            }
          ]
        })
      }
    }
  }, [lastMessage, activeSession?.id, id])

  // Reset live telemetry when active session changes or ends
  useEffect(() => {
    if (!activeSession) {
      setLiveTelemetry({})
    }
  }, [activeSession])

  // Periodic ticker to re-evaluate student staleness (>10s) and capture timeline trajectory
  useEffect(() => {
    const timer = setInterval(() => {
      const currentNow = Date.now()
      setNowMs(currentNow)

      if (activeSession && activeSession.status === 'active') {
        const reporting = Object.values(liveTelemetry).filter((r) => currentNow - r.received_at_ms <= 10000)
        if (reporting.length > 0) {
          const normalCnt = reporting.filter((r) => r.engagement_state === 'NORMAL_BEHAVIOUR').length
          const reducedCnt = reporting.filter((r) => r.engagement_state === 'REDUCED_ENGAGEMENT_LIKE').length
          const confusionCnt = reporting.filter((r) => r.confusion_signal === 'ELEVATED').length
          telemetryTimelineRef.current.push({
            timestamp_ms: currentNow,
            normal_pct: Math.round((normalCnt / reporting.length) * 1000) / 10,
            reduced_pct: Math.round((reducedCnt / reporting.length) * 1000) / 10,
            elevated_confusion_pct: Math.round((confusionCnt / reporting.length) * 1000) / 10,
            reporting_count: reporting.length
          })
        }
      }
    }, 3000)
    return () => clearInterval(timer)
  }, [activeSession, liveTelemetry])

  // Calculate live classroom aggregation
  const aggregation = calculateClassroomAggregation(liveTelemetry, nowMs)

  if (loading) {
    return <PageContainer size="large" className="py-6"><p className="text-text-muted">Loading...</p></PageContainer>
  }

  if (error) {
    return <PageContainer size="large" className="py-6"><p className="text-danger-600">{error}</p></PageContainer>
  }

  return (
    <PageContainer size="large" className="py-6 space-y-6">
      {sessionError && (
        <div className="p-3 bg-danger-50 border border-danger-200 text-danger-600 text-xs rounded font-medium flex justify-between items-center">
          <span>{sessionError}</span>
          <button onClick={() => setSessionError('')} className="text-danger-600 hover:text-danger-800 text-sm font-bold ml-2">&times;</button>
        </div>
      )}

      {/* Concluded Session Alert Banner */}
      {concludedSession && (
        <div className="card-panel bg-primary-50/70 border border-primary-200 p-4 space-y-3">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
            <div>
              <div className="flex items-center gap-2">
                <StatusBadge status="info" label="Session Concluded" />
                <h4 className="font-bold text-sm text-brand-navy">{concludedSession.title}</h4>
              </div>
              <p className="text-xs text-text-muted mt-1">
                The live session has ended. Detailed attendance and behavioural summary metrics are ready.
              </p>
            </div>
            <div className="flex gap-2">
              <Link to={`/teacher/session/${concludedSession.id}/report`}>
                <Button variant="primary" className="text-xs py-1.5 px-3">
                  View Session Report &rarr;
                </Button>
              </Link>
              <Button
                variant="secondary"
                onClick={() => setConcludedSession(null)}
                className="text-xs py-1.5 px-2.5"
              >
                Dismiss
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Session header banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-panel-bg border border-neutral-border rounded p-4 shadow-sm">
        <div className="flex items-center gap-3">
          {activeSession ? (
            <StatusBadge status="success" label="Active Live Session" />
          ) : scheduledSession ? (
            <StatusBadge status="warning" label="Session Scheduled" />
          ) : (
            <StatusBadge status="info" label={classroom?.is_active ? 'No Active Session' : 'Inactive Room'} />
          )}
          <div>
            <h2 className="font-bold text-brand-navy text-base">
              {currentSession ? `${courseTitle} — ${currentSession.title}` : courseTitle}
            </h2>
            <div className="text-[10px] text-text-muted mt-0.5 space-x-2">
              <span>Live Code: <code className="bg-neutral-light border px-1 rounded font-semibold uppercase">{classroom?.join_code}</code></span>
              {activeSession && activeSession.started_at && (
                <span>&bull; Started: {new Date(activeSession.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              )}
              {currentSession && currentSession.status === 'scheduled' && currentSession.scheduled_at && (
                <span>&bull; Scheduled: {new Date(currentSession.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {activeSession && (
            <Button
              variant="secondary"
              onClick={() => handleEndSession(activeSession.id)}
              disabled={actionLoading}
              className="text-xs py-1.5 px-3 border-danger-200 text-danger-600 hover:bg-danger-50"
            >
              {actionLoading ? 'Ending...' : 'End Live Session'}
            </Button>
          )}

          {!activeSession && scheduledSession && (
            <Button
              variant="primary"
              onClick={() => handleStartSession(scheduledSession.id)}
              disabled={actionLoading}
              className="text-xs py-1.5 px-3"
            >
              {actionLoading ? 'Starting...' : 'Start Session'}
            </Button>
          )}

          <Link to="/teacher">
            <Button variant="secondary" className="text-xs py-1.5 px-3">Dashboard</Button>
          </Link>
        </div>
      </div>

      {/* Classroom Sessions Management Section */}
      <div className="card-panel space-y-4">
        <div className="flex justify-between items-center border-b border-neutral-border pb-3">
          <div>
            <h3 className="text-h3 text-sm font-semibold text-brand-navy">Classroom Sessions</h3>
            <p className="text-xs text-text-muted mt-0.5">Manage live and scheduled teaching events for this room</p>
          </div>
          <Button
            variant={showCreateForm ? 'secondary' : 'accent'}
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="text-xs py-1 px-3"
          >
            {showCreateForm ? 'Cancel' : '+ New Session'}
          </Button>
        </div>

        {/* Inline Create Session Form */}
        {showCreateForm && (
          <form onSubmit={handleCreateSession} className="bg-neutral-light border border-neutral-border rounded p-4 space-y-3">
            <h4 className="text-xs font-semibold text-brand-navy">Create a New Session</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="Session Title"
                id="session-title"
                placeholder="e.g. Lecture 4: Binary Trees"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                required
                disabled={actionLoading}
              />
              <Input
                label="Scheduled Time (Optional)"
                id="session-scheduled"
                type="datetime-local"
                value={newScheduledAt}
                onChange={(e) => setNewScheduledAt(e.target.value)}
                disabled={actionLoading}
              />
            </div>
            <div>
              <label htmlFor="session-desc" className="block text-xs font-semibold text-brand-navy-light mb-1">
                Description (Optional)
              </label>
              <textarea
                id="session-desc"
                rows="2"
                className="input-text resize-none text-xs"
                placeholder="Topic notes or outline for this session..."
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                disabled={actionLoading}
              />
            </div>
            <div className="flex gap-2 justify-end pt-1">
              <Button variant="secondary" onClick={() => setShowCreateForm(false)} className="text-xs py-1 px-3" disabled={actionLoading}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" className="text-xs py-1 px-3" disabled={actionLoading}>
                {actionLoading ? 'Creating...' : 'Create Session'}
              </Button>
            </div>
          </form>
        )}

        {/* Sessions List */}
        {sessions.length === 0 ? (
          <p className="text-xs text-text-muted py-2 text-center">No sessions created yet. Click "+ New Session" to schedule or start a session.</p>
        ) : (
          <div className="space-y-2">
            {sessions.map((sess) => (
              <div
                key={sess.id}
                className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 p-3 rounded border border-neutral-border/70 hover:bg-neutral-light/50 transition-colors"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-xs text-brand-navy">{sess.title}</span>
                    {sess.status === 'active' && <StatusBadge status="success" label="Active" />}
                    {sess.status === 'scheduled' && <StatusBadge status="warning" label="Scheduled" />}
                    {sess.status === 'ended' && <StatusBadge status="info" label="Ended" />}
                  </div>
                  {sess.description && (
                    <p className="text-[11px] text-text-muted mt-0.5">{sess.description}</p>
                  )}
                  <div className="text-[10px] text-text-muted mt-1 space-x-2">
                    <span>Created: {new Date(sess.created_at).toLocaleDateString()}</span>
                    {sess.started_at && <span>&bull; Started: {new Date(sess.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>}
                    {sess.ended_at && <span>&bull; Ended: {new Date(sess.ended_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {sess.status === 'scheduled' && (
                    <Button
                      variant="primary"
                      onClick={() => handleStartSession(sess.id)}
                      disabled={actionLoading}
                      className="text-xs py-1 px-2.5"
                    >
                      Start Session
                    </Button>
                  )}
                  {sess.status === 'active' && (
                    <Button
                      variant="secondary"
                      onClick={() => handleEndSession(sess.id)}
                      disabled={actionLoading}
                      className="text-xs py-1 px-2.5 border-danger-200 text-danger-600 hover:bg-danger-50"
                    >
                      End Session
                    </Button>
                  )}
                  {sess.status === 'ended' && (
                    <Link to={`/teacher/session/${sess.id}/report`}>
                      <Button variant="secondary" className="text-xs py-1 px-2.5">
                        View Report
                      </Button>
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Privacy Notice Banner */}
      <div className="bg-primary-50/60 border border-primary-200/70 rounded p-3 flex flex-col sm:flex-row justify-between sm:items-center gap-2">
        <div className="flex items-center gap-2 text-brand-navy">
          <span className="text-[10px] uppercase font-bold tracking-wider bg-primary-100 text-primary-800 px-1.5 py-0.5 rounded">Privacy Assurance</span>
          <p className="text-xs text-brand-navy-light">
            Browser-local inference; only derived behavioural signals are transmitted to the teacher dashboard.
          </p>
        </div>
        <div className="text-[10px] font-mono text-text-muted flex items-center gap-1.5 self-end sm:self-auto">
          <span className={`inline-block w-2 h-2 rounded-full ${
            connectionState === 'connected'
              ? 'bg-success-500'
              : connectionState === 'reconnecting'
                ? 'bg-warning-500 animate-pulse'
                : connectionState === 'failed'
                  ? 'bg-danger-500'
                  : 'bg-neutral-border'
          }`} />
          <span>{
            connectionState === 'connected'
              ? 'WebSocket Live'
              : connectionState === 'reconnecting'
                ? `Reconnecting (${retryCount}/5)...`
                : connectionState === 'failed'
                  ? 'Connection Offline'
                  : 'WebSocket Standby'
          }</span>
        </div>
      </div>

      {/* Real-time Classroom Aggregates Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="card-panel text-center py-3">
          <span className="text-[10px] uppercase font-mono text-text-muted">Reporting Students</span>
          <div className="text-2xl font-extrabold text-brand-navy mt-1">
            {aggregation.reportingCount}
            <span className="text-xs font-normal text-text-muted ml-1">/ {participants.filter((p) => p.status === 'joined').length}</span>
          </div>
          <span className="text-[9px] text-text-muted block mt-0.5">Active Telemetry</span>
        </div>

        <div className="card-panel text-center py-3">
          <span className="text-[10px] uppercase font-mono text-text-muted">Normal Behaviour</span>
          <div className="text-2xl font-extrabold text-emerald-600 mt-1">
            {aggregation.normalPercentage !== null ? `${Math.round(aggregation.normalPercentage)}%` : '—'}
          </div>
          <span className="text-[9px] text-text-muted block mt-0.5">
            {aggregation.counts.normal} student{aggregation.counts.normal === 1 ? '' : 's'}
          </span>
        </div>

        <div className="card-panel text-center py-3">
          <span className="text-[10px] uppercase font-mono text-text-muted">Reduced Engagement</span>
          <div className="text-2xl font-extrabold text-amber-600 mt-1">
            {aggregation.reducedPercentage !== null ? `${Math.round(aggregation.reducedPercentage)}%` : '—'}
          </div>
          <span className="text-[9px] text-text-muted block mt-0.5">
            {aggregation.counts.reduced} student{aggregation.counts.reduced === 1 ? '' : 's'}
          </span>
        </div>

        <div className="card-panel text-center py-3">
          <span className="text-[10px] uppercase font-mono text-text-muted">Elevated Confusion</span>
          <div className="text-2xl font-extrabold text-warning-600 mt-1">
            {aggregation.elevatedConfusionPercentage !== null ? `${Math.round(aggregation.elevatedConfusionPercentage)}%` : '—'}
          </div>
          <span className="text-[9px] text-text-muted block mt-0.5">
            {aggregation.counts.elevatedConfusion} student{aggregation.counts.elevatedConfusion === 1 ? '' : 's'}
          </span>
        </div>

        <div className="card-panel text-center py-3 col-span-2 sm:col-span-1">
          <span className="text-[10px] uppercase font-mono text-text-muted">Mean Confidence</span>
          <div className="text-2xl font-extrabold text-primary-600 mt-1">
            {aggregation.meanConfidence !== null ? aggregation.meanConfidence.toFixed(2) : '—'}
          </div>
          <span className="text-[9px] text-text-muted block mt-0.5">Evidence Quality</span>
        </div>
      </div>

      {/* Real-time Session Participants Roster */}
      <div className="card-panel space-y-4">
        <div className="flex justify-between items-center border-b border-neutral-border pb-3">
          <div className="flex items-center gap-2">
            <h3 className="text-h3 text-sm font-semibold text-brand-navy">Live Participant Behaviour Roster</h3>
            <span className="text-xs bg-primary-50 text-primary-600 font-bold px-2 py-0.5 rounded-full border border-primary-100">
              {participants.filter((p) => p.status === 'joined').length} Enrolled
            </span>
          </div>
          <span className="text-[10px] text-text-muted">
            {aggregation.reportingCount} of {participants.filter((p) => p.status === 'joined').length} reporting live telemetry
          </span>
        </div>

        {participants.length === 0 ? (
          <p className="text-xs text-text-muted py-6 text-center">
            No students have joined this session yet. Share the classroom code for students to enter when active.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-neutral-light border-b border-neutral-border text-[11px] font-semibold text-brand-navy">
                  <th className="p-3">Student</th>
                  <th className="p-3">Session Status</th>
                  <th className="p-3">Engagement Assessment</th>
                  <th className="p-3">Confusion Signal</th>
                  <th className="p-3">Confidence</th>
                  <th className="p-3 text-right">Telemetry Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-border">
                {participants.map((p) => {
                  const telemetry = liveTelemetry[p.student_id]
                  const reporting = isStudentReporting(telemetry, nowMs)
                  const isParticipantActive = p.status === 'joined'

                  return (
                    <tr key={p.id} className="hover:bg-neutral-light/40 transition-colors">
                      <td className="p-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-neutral-light border border-neutral-border flex items-center justify-center font-bold text-[11px] text-brand-navy shrink-0">
                            {p.student_name ? p.student_name.split(' ').map((n) => n[0]).join('') : 'S'}
                          </div>
                          <div>
                            <div className="font-semibold text-brand-navy text-xs">{p.student_name}</div>
                            <div className="text-[10px] text-text-muted">{p.student_email}</div>
                          </div>
                        </div>
                      </td>

                      <td className="p-3">
                        {p.status === 'joined' ? (
                          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 font-medium">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Joined
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] text-text-muted">
                            <span className="w-1.5 h-1.5 rounded-full bg-neutral-border" /> Left
                          </span>
                        )}
                      </td>

                      <td className="p-3">
                        {isParticipantActive && reporting && telemetry ? (
                          <>
                            {telemetry.engagement_state === 'NORMAL_BEHAVIOUR' && (
                              <span className="text-emerald-700 font-medium text-[11px]">Normal behaviour</span>
                            )}
                            {telemetry.engagement_state === 'REDUCED_ENGAGEMENT_LIKE' && (
                              <span className="text-amber-700 font-medium text-[11px]">Reduced-engagement-like</span>
                            )}
                            {telemetry.engagement_state === 'UNCERTAIN' && (
                              <span className="text-neutral-500 text-[11px]">Uncertain</span>
                            )}
                          </>
                        ) : (
                          <span className="text-text-muted text-[11px]">—</span>
                        )}
                      </td>

                      <td className="p-3">
                        {isParticipantActive && reporting && telemetry ? (
                          <>
                            {telemetry.confusion_signal === 'LOW' && (
                              <span className="text-brand-navy text-[11px]">Low</span>
                            )}
                            {telemetry.confusion_signal === 'ELEVATED' && (
                              <span className="text-amber-700 font-medium text-[11px]">Elevated</span>
                            )}
                            {telemetry.confusion_signal === 'UNCERTAIN' && (
                              <span className="text-neutral-500 text-[11px]">Uncertain</span>
                            )}
                          </>
                        ) : (
                          <span className="text-text-muted text-[11px]">—</span>
                        )}
                      </td>

                      <td className="p-3 font-mono text-[11px]">
                        {isParticipantActive && reporting && typeof telemetry?.confidence === 'number' ? (
                          <span className="text-text-muted">{telemetry.confidence.toFixed(2)}</span>
                        ) : (
                          <span className="text-text-muted">—</span>
                        )}
                      </td>

                      <td className="p-3 text-right">
                        {isParticipantActive ? (
                          reporting ? (
                            <StatusBadge status="success" label="Reporting" />
                          ) : (
                            <StatusBadge status="info" label="Inactive" />
                          )
                        ) : (
                          <StatusBadge status="info" label="Left" />
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </PageContainer>
  )
}
