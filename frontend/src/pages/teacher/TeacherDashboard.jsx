import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import PageContainer from '../../components/PageContainer'
import Button from '../../components/Button'
import StatusBadge from '../../components/StatusBadge'
import { mapScoreToFourLevel, LEVEL_CONFIG } from '../../components/analytics/FourLevelIndicator'
import { API_BASE_URL } from '../../config/api'

export default function TeacherDashboard() {
  const [activeClassrooms, setActiveClassrooms] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [copiedCode, setCopiedCode] = useState(null)

  const [sessionHistory, setSessionHistory] = useState([])
  const [historyLoading, setHistoryLoading] = useState(true)
  const [historyError, setHistoryError] = useState('')

  useEffect(() => {
    fetchClassrooms()
    fetchSessionHistory()
  }, [])

  const fetchClassrooms = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_BASE_URL}/api/classrooms/`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (!response.ok) {
        throw new Error('Failed to fetch classrooms')
      }
      const data = await response.json()
      setActiveClassrooms(data)
    } catch (err) {
      console.error(err)
      setError('Could not load classrooms.')
    } finally {
      setLoading(false)
    }
  }

  const fetchSessionHistory = async () => {
    setHistoryLoading(true)
    setHistoryError('')
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_BASE_URL}/api/sessions/teacher/history`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (!response.ok) {
        throw new Error('Failed to fetch session history')
      }
      const data = await response.json()
      setSessionHistory(data)
    } catch (err) {
      console.error(err)
      setHistoryError('Could not load session history.')
    } finally {
      setHistoryLoading(false)
    }
  }

  // Calculate classroom cohort aggregate stats from persisted sessions
  const sessionsWithTelemetry = sessionHistory.filter(
    (s) => s.telemetry_status === 'persisted' && s.normal_pct !== null
  )

  const avgAttention = sessionsWithTelemetry.length > 0
    ? Math.round(sessionsWithTelemetry.reduce((acc, s) => acc + s.normal_pct, 0) / sessionsWithTelemetry.length)
    : null

  const avgConfusion = sessionsWithTelemetry.length > 0
    ? Math.round(sessionsWithTelemetry.reduce((acc, s) => acc + (s.elevated_confusion_pct || 0), 0) / sessionsWithTelemetry.length)
    : null

  const totalParticipations = sessionHistory.reduce((acc, s) => acc + (s.total_participants || 0), 0)

  return (
    <PageContainer size="large" className="py-6 space-y-8">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-panel-bg border border-neutral-border rounded-xl p-6 shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-primary-600 bg-primary-50 px-2 py-0.5 rounded-full border border-primary-200/60 font-mono">
              Instructor Portal
            </span>
            <span className="text-text-muted text-xs">&bull;</span>
            <span className="text-text-muted text-xs">Real-Time Classroom Management & Analytics</span>
          </div>
          <h1 className="text-2xl font-bold text-brand-navy tracking-tight">Instructor Dashboard</h1>
          <p className="text-xs text-text-muted max-w-xl leading-relaxed">
            Manage your live classrooms, monitor real-time attention distributions, and review privacy-preserving session reports.
          </p>
        </div>

        <Link to="/teacher/create">
          <Button variant="accent" className="text-xs py-2 px-4 shadow-sm">
            + Create Classroom
          </Button>
        </Link>
      </div>

      {/* Classroom Aggregate Analytics Overview Cards */}
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <h3 className="text-xs font-bold text-brand-navy uppercase tracking-wider">
            Classroom Cohort Analytics Summary
          </h3>
          <span className="text-[11px] text-text-muted font-mono">
            {sessionsWithTelemetry.length} Session{sessionsWithTelemetry.length === 1 ? '' : 's'} with Persisted Telemetry
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="card-panel p-4 bg-panel-bg space-y-2 border border-neutral-border rounded-xl">
            <span className="text-[10px] font-mono uppercase text-text-muted">Overall Attention Cohort Avg</span>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-extrabold text-emerald-600">
                {avgAttention !== null ? `${avgAttention}%` : '--'}
              </span>
              {avgAttention !== null && (
                <span className="text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  {mapScoreToFourLevel('attention', avgAttention).toUpperCase()}
                </span>
              )}
            </div>
            <p className="text-[11px] text-text-muted">Mean normal attention signal across recorded sessions</p>
          </div>

          <div className="card-panel p-4 bg-panel-bg space-y-2 border border-neutral-border rounded-xl">
            <span className="text-[10px] font-mono uppercase text-text-muted">Elevated Confusion Baseline</span>
            <div className="flex items-baseline justify-between">
              <span className={`text-2xl font-extrabold ${avgConfusion !== null && avgConfusion > 25 ? 'text-amber-600' : 'text-indigo-600'}`}>
                {avgConfusion !== null ? `${avgConfusion}%` : '--'}
              </span>
              {avgConfusion !== null && (
                <span className="text-[11px] font-medium text-slate-700 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                  {mapScoreToFourLevel('confusion', avgConfusion).toUpperCase()}
                </span>
              )}
            </div>
            <p className="text-[11px] text-text-muted">Mean elevated confusion markers across lectures</p>
          </div>

          <div className="card-panel p-4 bg-panel-bg space-y-2 border border-neutral-border rounded-xl">
            <span className="text-[10px] font-mono uppercase text-text-muted">Completed Sessions</span>
            <div className="text-2xl font-extrabold text-brand-navy">
              {sessionHistory.length}
            </div>
            <p className="text-[11px] text-text-muted">Total lectures concluded with historical logs</p>
          </div>

          <div className="card-panel p-4 bg-panel-bg space-y-2 border border-neutral-border rounded-xl">
            <span className="text-[10px] font-mono uppercase text-text-muted">Total Student Attendances</span>
            <div className="text-2xl font-extrabold text-primary-600">
              {totalParticipations}
            </div>
            <p className="text-[11px] text-text-muted">Cumulative student participations recorded</p>
          </div>
        </div>
      </div>

      {/* Main Workspace Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">

        {/* LEFT COLUMN (2 Cols): Active Classrooms & Session Performance Logs */}
        <div className="lg:col-span-2 space-y-6">

          {/* Active & Scheduled Classrooms */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold text-brand-navy">Active & Scheduled Classrooms</h3>
              <span className="text-xs text-text-muted font-mono">{activeClassrooms.length} Rooms</span>
            </div>

            {loading ? (
              <div className="card-panel text-center py-8">
                <div className="w-5 h-5 border-2 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                <p className="text-xs text-text-muted">Loading classrooms...</p>
              </div>
            ) : error ? (
              <p className="text-xs text-danger-600 p-4 card-panel">{error}</p>
            ) : activeClassrooms.length === 0 ? (
              <div className="card-panel text-center py-10 bg-slate-50/50 border-dashed rounded-xl">
                <p className="text-sm font-medium text-brand-navy">No classrooms created yet</p>
                <p className="text-xs text-text-muted mt-1 max-w-sm mx-auto">
                  Set up your first classroom to generate a join code and start monitoring live student attention.
                </p>
                <Link to="/teacher/create" className="inline-block mt-3">
                  <Button variant="primary" className="text-xs py-1.5 px-3">
                    + Create Classroom Now
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {activeClassrooms.map((room) => (
                  <div key={room.id} className="card-panel flex flex-col sm:flex-row justify-between sm:items-center gap-4 bg-panel-bg hover:border-slate-300 transition-all rounded-xl p-4 border border-neutral-border shadow-xs">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-brand-navy text-sm">{room.name}</h4>
                        {room.is_active ? (
                          <StatusBadge status="success" label="Active" dot={true} />
                        ) : (
                          <StatusBadge status="neutral" label="Inactive" />
                        )}
                      </div>
                      <div className="text-xs text-text-muted flex items-center gap-2 font-mono">
                        <span>Join Code:</span>
                        <code className="bg-slate-100 border border-slate-200 px-2 py-0.5 rounded font-bold text-brand-navy tracking-wider text-xs">
                          {room.join_code}
                        </code>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard?.writeText(room.join_code)
                            setCopiedCode(room.join_code)
                            setTimeout(() => setCopiedCode(null), 2000)
                          }}
                          className="text-[11px] font-sans font-medium text-primary-600 hover:text-primary-800 transition-colors"
                          title="Copy join code to clipboard"
                        >
                          {copiedCode === room.join_code ? 'Copied!' : 'Copy'}
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Link to={`/teacher/classroom/${room.id}`}>
                        <Button variant={room.is_active ? 'primary' : 'secondary'} className="text-xs py-1.5 px-3">
                          {room.is_active ? 'Open Live Classroom' : 'View Classroom'}
                        </Button>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Genuine Recent History Table */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-sm font-bold text-brand-navy">Past Session Performance Logs</h3>
                <p className="text-xs text-text-muted mt-0.5">Persisted privacy-preserving analytics across concluded sessions</p>
              </div>
              <button
                onClick={fetchSessionHistory}
                disabled={historyLoading}
                className="text-xs text-primary-600 hover:text-primary-700 underline disabled:opacity-50 font-medium"
              >
                Refresh
              </button>
            </div>

            {historyLoading ? (
              <div className="card-panel text-center py-8">
                <div className="w-5 h-5 border-2 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                <p className="text-xs text-text-muted">Loading session history...</p>
              </div>
            ) : historyError ? (
              <div className="card-panel text-center py-6 space-y-2">
                <p className="text-xs text-danger-600">{historyError}</p>
                <Button variant="secondary" onClick={fetchSessionHistory} className="text-xs py-1 px-3">
                  Retry
                </Button>
              </div>
            ) : sessionHistory.length === 0 ? (
              <div className="card-panel text-center py-10 bg-slate-50/50 border-dashed rounded-xl">
                <p className="text-sm font-medium text-brand-navy">No completed sessions found</p>
                <p className="text-xs text-text-muted mt-1 max-w-sm mx-auto">
                  Start and end a classroom session with connected students to begin generating historical analytics logs.
                </p>
              </div>
            ) : (
              <div className="border border-neutral-border rounded-xl overflow-x-auto shadow-xs bg-panel-bg">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-neutral-border font-semibold text-brand-navy">
                      <th className="p-3.5">Date</th>
                      <th className="p-3.5">Session Topic</th>
                      <th className="p-3.5">Classroom</th>
                      <th className="p-3.5">Duration</th>
                      <th className="p-3.5">Students</th>
                      <th className="p-3.5">Cohort Attention</th>
                      <th className="p-3.5">Peak Confusion</th>
                      <th className="p-3.5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-border text-text-muted">
                    {sessionHistory.map((session) => {
                      const attLvl = session.normal_pct !== null ? mapScoreToFourLevel('attention', session.normal_pct) : 'uncertain'
                      const confLvl = session.elevated_confusion_pct !== null ? mapScoreToFourLevel('confusion', session.elevated_confusion_pct) : 'uncertain'
                      const attConfig = LEVEL_CONFIG.attention[attLvl]
                      const confConfig = LEVEL_CONFIG.confusion[confLvl]

                      return (
                        <tr key={session.id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="p-3.5 font-mono text-[11px]">
                            {new Date(session.started_at || session.created_at).toLocaleDateString()}
                          </td>
                          <td className="p-3.5 font-semibold text-brand-navy max-w-[150px] truncate">
                            {session.title}
                          </td>
                          <td className="p-3.5 text-text-muted max-w-[120px] truncate">
                            {session.classroom_name}
                          </td>
                          <td className="p-3.5 font-mono text-[11px]">
                            {session.duration_formatted}
                          </td>
                          <td className="p-3.5 font-mono">
                            {session.total_participants}
                          </td>
                          <td className="p-3.5">
                            {session.telemetry_status === 'persisted' && session.normal_pct !== null ? (
                              <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${attConfig.badgeClass}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${attConfig.dotClass}`} />
                                {session.normal_pct}%
                              </span>
                            ) : (
                              <span className="text-text-muted italic text-[11px]" title="No telemetry was recorded for this session">
                                Unavailable
                              </span>
                            )}
                          </td>
                          <td className="p-3.5">
                            {session.telemetry_status === 'persisted' && session.elevated_confusion_pct !== null ? (
                              <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${confConfig.badgeClass}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${confConfig.dotClass}`} />
                                {session.elevated_confusion_pct}%
                              </span>
                            ) : (
                              <span className="text-text-muted italic text-[11px]" title="No telemetry was recorded for this session">
                                Unavailable
                              </span>
                            )}
                          </td>
                          <td className="p-3.5 text-right">
                            <Link to={`/teacher/session/${session.id}/report`}>
                              <Button variant="secondary" className="text-[11px] py-1 px-2.5">
                                View Report
                              </Button>
                            </Link>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN (1 Col): Privacy & Policy Safeguard Card */}
        <div className="space-y-4">
          <div className="card-panel bg-panel-bg p-5 space-y-4 rounded-xl border border-neutral-border shadow-xs">
            <h3 className="text-xs uppercase font-bold tracking-wider text-text-muted">Privacy & Persistence Architecture</h3>
            <p className="text-xs text-text-muted leading-relaxed">
              Historical analytics are derived entirely from local browser signals. Webcam video and facial landmarks are never stored or transmitted to our servers.
            </p>
            <div className="text-[11px] text-text-muted space-y-2.5 border-t border-neutral-border pt-3">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                <span>1-minute privacy aggregation windows</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-primary-500 shrink-0" />
                <span>Zero facial biometric persistence</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-slate-400 shrink-0" />
                <span>90-day bucket retention policy</span>
              </div>
            </div>
          </div>
        </div>

      </div>
    </PageContainer>
  )
}
