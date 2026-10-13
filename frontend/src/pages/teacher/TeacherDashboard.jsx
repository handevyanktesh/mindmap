import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import PageContainer from '../../components/PageContainer'
import Button from '../../components/Button'
import StatusBadge from '../../components/StatusBadge'
import { API_BASE_URL } from '../../config/api'

export default function TeacherDashboard() {
  const [activeClassrooms, setActiveClassrooms] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

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

  return (
    <PageContainer size="default" className="space-y-8">
      {/* Dashboard Welcome */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-neutral-border pb-6">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">
            Instructor Portal
          </span>
          <h2 className="text-h1 mt-1">Instructor Dashboard</h2>
        </div>
        <Link to="/teacher/create">
          <Button variant="accent">Create Classroom Session</Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">

        {/* Main Class List & Session History */}
        <div className="md:col-span-2 space-y-8">
          <div className="space-y-4">
            <h3 className="text-h3">Active & Scheduled Classrooms</h3>

            {loading ? (
              <p className="text-xs text-text-muted">Loading classrooms...</p>
            ) : error ? (
              <p className="text-xs text-danger-600">{error}</p>
            ) : activeClassrooms.length === 0 ? (
              <div className="card-panel text-center py-8">
                <p className="text-sm text-text-muted">No classrooms found. Create one to get started.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {activeClassrooms.map((room) => (
                  <div key={room.id} className="card-panel flex flex-col sm:flex-row justify-between sm:items-center gap-4 bg-panel-bg">
                    <div>
                      <h4 className="font-semibold text-brand-navy">{room.name}</h4>
                      <div className="text-xs text-text-muted mt-1 space-x-2">
                        <span>Code: <code className="bg-neutral-light border px-1 rounded font-bold text-brand-navy">{room.join_code}</code></span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {room.is_active ? (
                        <>
                          <StatusBadge status="success" label="Active" />
                          <Link to={`/teacher/classroom/${room.id}`}>
                            <Button variant="primary" className="text-xs py-1.5 px-3">View Live Dashboard</Button>
                          </Link>
                        </>
                      ) : (
                        <>
                          <StatusBadge status="info" label="Inactive" />
                          <Link to={`/teacher/classroom/${room.id}`}>
                            <Button variant="secondary" className="text-xs py-1.5 px-3">View Details</Button>
                          </Link>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Genuine Recent History Table */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-h3">Past Session Performance Logs</h3>
                <p className="text-xs text-text-muted mt-0.5">Persisted privacy-preserving analytics across concluded sessions</p>
              </div>
              <button
                onClick={fetchSessionHistory}
                disabled={historyLoading}
                className="text-xs text-primary-600 hover:text-primary-700 underline disabled:opacity-50"
              >
                Refresh
              </button>
            </div>

            {historyLoading ? (
              <div className="card-panel text-center py-6">
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
              <div className="card-panel text-center py-8 bg-neutral-light/30 border-dashed">
                <p className="text-sm font-medium text-brand-navy">No completed sessions found</p>
                <p className="text-xs text-text-muted mt-1">
                  Start and end a classroom session with connected students to begin generating historical analytics logs.
                </p>
              </div>
            ) : (
              <div className="border border-neutral-border rounded overflow-x-auto shadow-sm bg-panel-bg">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-neutral-light border-b border-neutral-border font-semibold text-brand-navy">
                      <th className="p-3">Date</th>
                      <th className="p-3">Session Topic</th>
                      <th className="p-3">Classroom</th>
                      <th className="p-3">Duration</th>
                      <th className="p-3">Students</th>
                      <th className="p-3">Avg Engagement</th>
                      <th className="p-3">Peak Confusion</th>
                      <th className="p-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-border text-text-muted">
                    {sessionHistory.map((session) => (
                      <tr key={session.id} className="hover:bg-neutral-light/35 transition-colors">
                        <td className="p-3 font-mono text-[11px]">
                          {new Date(session.started_at || session.created_at).toLocaleDateString()}
                        </td>
                        <td className="p-3 font-semibold text-brand-navy-light max-w-[140px] truncate">
                          {session.title}
                        </td>
                        <td className="p-3 text-text-muted max-w-[120px] truncate">
                          {session.classroom_name}
                        </td>
                        <td className="p-3 font-mono text-[11px]">
                          {session.duration_formatted}
                        </td>
                        <td className="p-3">
                          {session.total_participants}
                        </td>
                        <td className="p-3">
                          {session.telemetry_status === 'persisted' && session.normal_pct !== null ? (
                            <span className="text-emerald-600 font-bold">{session.normal_pct}%</span>
                          ) : (
                            <span className="text-text-muted italic text-[11px]" title="No telemetry was recorded for this session">
                              Unavailable
                            </span>
                          )}
                        </td>
                        <td className="p-3">
                          {session.telemetry_status === 'persisted' && session.elevated_confusion_pct !== null ? (
                            <span className={`font-bold ${session.elevated_confusion_pct > 30 ? 'text-rose-600' : 'text-indigo-600'}`}>
                              {session.elevated_confusion_pct}%
                            </span>
                          ) : (
                            <span className="text-text-muted italic text-[11px]" title="No telemetry was recorded for this session">
                              Unavailable
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-right">
                          <Link to={`/teacher/session/${session.id}/report`}>
                            <Button variant="secondary" className="text-[11px] py-1 px-2.5">
                              View Report
                            </Button>
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Action Panel sidebar */}
        <div className="space-y-6">
          <div className="card-panel bg-neutral-light/50 space-y-4">
            <h3 className="text-h3 text-xs uppercase tracking-wider text-text-muted">Privacy & Persistence Policy</h3>
            <p className="text-xs text-text-muted leading-relaxed">
              Historical analytics are derived entirely from local browser signals. Webcam video and facial landmarks are never stored or transmitted.
            </p>
            <div className="text-[11px] text-text-muted space-y-1.5 border-t border-neutral-border pt-3">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                <span>1-minute privacy aggregation</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-primary-500"></span>
                <span>Zero facial biometric persistence</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-neutral-400"></span>
                <span>90-day bucket retention</span>
              </div>
            </div>
          </div>
        </div>

      </div>
    </PageContainer>
  )
}
