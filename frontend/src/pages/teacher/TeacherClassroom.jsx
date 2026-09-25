import React, { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import PageContainer from '../../components/PageContainer'
import Button from '../../components/Button'
import Input from '../../components/Input'
import StatusBadge from '../../components/StatusBadge'

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
      const classRes = await fetch(`http://localhost:8000/api/classrooms/${id}`, {
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
      const sessRes = await fetch(`http://localhost:8000/api/classrooms/${id}/sessions`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (sessRes.ok) {
        const sessData = await sessRes.json()
        setSessions(sessData)

        // 3. Fetch participants for the active or latest session
        const curr = sessData.find((s) => s.status === 'active') || sessData.find((s) => s.status === 'scheduled') || sessData[0]
        if (curr) {
          const partRes = await fetch(`http://localhost:8000/api/sessions/${curr.id}/participants`, {
            headers: { Authorization: `Bearer ${token}` }
          })
          if (partRes.ok) {
            const partData = await partRes.json()
            setParticipants(partData)
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

      const res = await fetch('http://localhost:8000/api/sessions/', {
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
      const res = await fetch(`http://localhost:8000/api/sessions/${sessionId}/start`, {
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
      const token = localStorage.getItem('token')
      const res = await fetch(`http://localhost:8000/api/sessions/${sessionId}/end`, {
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

  // Mock student tracking roster
  const studentRoster = [
    { name: 'Alice Smith', status: 'attentive', attention: '94%', confusion: '2%' },
    { name: 'Bob Johnson', status: 'confused', attention: '65%', confusion: '45%' },
    { name: 'Charlie Brown', status: 'attentive', attention: '88%', confusion: '8%' },
    { name: 'Diana Prince', status: 'away', attention: '15%', confusion: '0%' },
    { name: 'Evan Wright', status: 'confused', attention: '58%', confusion: '52%' }
  ]

  // Mock alerts list
  const activeAlerts = [
    { type: 'warning', message: 'High confusion indices detected (Topic: Bounds integration)', time: '3 mins ago' },
    { type: 'danger', message: 'Student "Diana Prince" camera feed inactive', time: '5 mins ago' }
  ]

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
              <span className="text-[10px] font-normal text-warning-600 bg-warning-50 px-2 py-0.5 rounded ml-2 align-middle">Demo Telemetry</span>
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
                    <span className="text-[11px] font-medium text-text-muted italic px-2">Completed</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Metric summaries widget grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card-panel text-center">
          <span className="text-[10px] uppercase font-mono text-text-muted">Avg Engagement Estimate</span>
          <div className="text-3xl font-extrabold text-primary-600 mt-1">82%</div>
          <span className="text-[9px] text-success-600 font-bold block mt-1">&#8593; Optimal Range</span>
        </div>

        <div className="card-panel text-center">
          <span className="text-[10px] uppercase font-mono text-text-muted">Avg Confusion-related Signal</span>
          <div className="text-3xl font-extrabold text-warning-600 mt-1">16%</div>
          <span className="text-[9px] text-text-muted block mt-1">Baseline Reference</span>
        </div>

        <div className="card-panel text-center">
          <span className="text-[10px] uppercase font-mono text-text-muted">Active Warnings</span>
          <div className="text-3xl font-extrabold text-danger-600 mt-1">{activeAlerts.length}</div>
          <span className="text-[9px] text-danger-600 font-semibold block mt-1">Requires Interaction</span>
        </div>
      </div>

      {/* Engagement Timeline Graph Card */}
      <div className="card-panel space-y-4">
        <div className="flex justify-between items-center border-b border-neutral-border pb-3">
          <h3 className="text-h3 text-xs uppercase tracking-wider text-text-muted">Live Engagement Trend Timeline</h3>
          <span className="text-[9px] font-mono text-text-muted">[ Updated every 5 seconds ]</span>
        </div>

        {/* Mock Line Graph visual placeholder */}
        <div className="border border-neutral-border rounded p-6 bg-neutral-light/35 flex flex-col justify-center items-center text-center h-40">
          <div className="w-full flex items-end justify-between gap-2 max-w-2xl h-24 pt-4 border-b border-l border-neutral-border select-none">
            <div className="w-full bg-primary-600/20 h-16 hover:bg-primary-600/30 rounded-t-sm relative group">
              <span className="absolute -top-6 left-1/2 -translate-x-1/2 bg-brand-navy text-white text-[8px] px-1 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity">70%</span>
            </div>
            <div className="w-full bg-primary-600/30 h-18 hover:bg-primary-600/40 rounded-t-sm relative group">
              <span className="absolute -top-6 left-1/2 -translate-x-1/2 bg-brand-navy text-white text-[8px] px-1 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity">75%</span>
            </div>
            <div className="w-full bg-primary-600/40 h-20 hover:bg-primary-600/50 rounded-t-sm relative group">
              <span className="absolute -top-6 left-1/2 -translate-x-1/2 bg-brand-navy text-white text-[8px] px-1 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity">80%</span>
            </div>
            <div className="w-full bg-primary-600/50 h-20 hover:bg-primary-600/60 rounded-t-sm relative group">
              <span className="absolute -top-6 left-1/2 -translate-x-1/2 bg-brand-navy text-white text-[8px] px-1 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity">80%</span>
            </div>
            <div className="w-full bg-primary-600/70 h-22 hover:bg-primary-600/80 rounded-t-sm relative group">
              <span className="absolute -top-6 left-1/2 -translate-x-1/2 bg-brand-navy text-white text-[8px] px-1 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity">88%</span>
            </div>
            <div className="w-full bg-primary-600 h-24 hover:bg-primary-700 rounded-t-sm relative group">
              <span className="absolute -top-6 left-1/2 -translate-x-1/2 bg-brand-navy text-white text-[8px] px-1 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity">92%</span>
            </div>
            <div className="w-full bg-primary-600 h-22 hover:bg-primary-700 rounded-t-sm relative group">
              <span className="absolute -top-6 left-1/2 -translate-x-1/2 bg-brand-navy text-white text-[8px] px-1 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity">88%</span>
            </div>
            <div className="w-full bg-primary-600/80 h-16 hover:bg-primary-600/90 rounded-t-sm relative group">
              <span className="absolute -top-6 left-1/2 -translate-x-1/2 bg-brand-navy text-white text-[8px] px-1 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity">70%</span>
            </div>
            <div className="w-full bg-primary-600/60 h-14 hover:bg-primary-600/70 rounded-t-sm relative group">
              <span className="absolute -top-6 left-1/2 -translate-x-1/2 bg-brand-navy text-white text-[8px] px-1 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity">65%</span>
            </div>
            <div className="w-full bg-primary-600/80 h-20 hover:bg-primary-600/95 rounded-t-sm relative group">
              <span className="absolute -top-6 left-1/2 -translate-x-1/2 bg-brand-navy text-white text-[8px] px-1 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity">82%</span>
            </div>
          </div>
          <div className="flex justify-between w-full max-w-2xl text-[9px] text-text-muted mt-2 font-mono">
            <span>10:00 AM</span>
            <span>10:10 AM</span>
            <span>10:20 AM</span>
            <span>10:30 AM (Current)</span>
          </div>
        </div>
      </div>

      {/* Roster & Anomaly Alert Split Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Side: Real Session Participants */}
        <div className="lg:col-span-2 space-y-4">
          <div className="card-panel space-y-4">
            <div className="flex justify-between items-center border-b border-neutral-border pb-3">
              <div className="flex items-center gap-2">
                <h3 className="text-h3">Session Participants</h3>
                <span className="text-xs bg-primary-50 text-primary-600 font-bold px-2 py-0.5 rounded-full border border-primary-100">
                  {participants.filter(p => p.status === 'joined').length} Active
                </span>
              </div>
              <span className="text-[10px] text-text-muted">Total Enrolled in Session: {participants.length}</span>
            </div>

            {participants.length === 0 ? (
              <p className="text-xs text-text-muted py-6 text-center">
                No students have joined this session yet. Share the classroom code for students to enter when active.
              </p>
            ) : (
              <div className="divide-y divide-neutral-border">
                {participants.map((p) => (
                  <div key={p.id} className="flex justify-between items-center py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-neutral-light border border-neutral-border flex items-center justify-center font-bold text-xs text-brand-navy">
                        {p.student_name ? p.student_name.split(' ').map((n) => n[0]).join('') : 'S'}
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-brand-navy">{p.student_name}</div>
                        <div className="text-[10px] text-text-muted">{p.student_email}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-xs">
                      <span className="text-[10px] text-text-muted hidden sm:inline">
                        Joined: {new Date(p.joined_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        {p.left_at && ` • Left: ${new Date(p.left_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                      </span>
                      {p.status === 'joined' ? (
                        <StatusBadge status="success" label="Joined" />
                      ) : (
                        <StatusBadge status="info" label="Left" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Alert dashboard warnings */}
        <div className="space-y-4">
          <div className="card-panel space-y-4">
            <h3 className="text-h3 border-b border-neutral-border pb-3">Anomalous Activity Logs</h3>
            
            <div className="space-y-3">
              {activeAlerts.map((alert, idx) => (
                <div key={idx} className={`p-4 rounded border text-xs leading-relaxed ${
                  alert.type === 'danger'
                    ? 'bg-danger-50 border-danger-200 text-danger-600'
                    : 'bg-warning-50 border-warning-200 text-warning-600'
                }`}>
                  <div className="flex justify-between font-bold mb-1">
                    <span className="uppercase text-[9px]">{alert.type === 'danger' ? 'Critical Action' : 'Notice Alert'}</span>
                    <span className="font-mono font-normal text-text-muted">{alert.time}</span>
                  </div>
                  <p>{alert.message}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>

    </PageContainer>
  )
}
