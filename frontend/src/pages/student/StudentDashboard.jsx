import React, { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import PageContainer from '../../components/PageContainer'
import Button from '../../components/Button'
import { useAuth } from '../../context/AuthContext'
import { API_BASE_URL } from '../../config/api'

export default function StudentDashboard() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState('sessions') // 'sessions' | 'reflections'

  // Sessions History State
  const [sessionHistory, setSessionHistory] = useState([])
  const [historyLoading, setHistoryLoading] = useState(true)
  const [historyError, setHistoryError] = useState('')

  // Reflections Journal State
  const [reflections, setReflections] = useState([])
  const [reflectionsLoading, setReflectionsLoading] = useState(true)
  const [reflectionsError, setReflectionsError] = useState('')

  // Modal States
  const [selectedSessionDetail, setSelectedSessionDetail] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [showDetailModal, setShowDetailModal] = useState(false)

  const [showReflectionModal, setShowReflectionModal] = useState(false)
  const [editingReflection, setEditingReflection] = useState(null)
  const [reflectionForm, setReflectionForm] = useState({
    session_id: '',
    what_went_well: '',
    what_was_difficult: '',
    improvement_goal: ''
  })
  const [formSaving, setFormSaving] = useState(false)
  const [formError, setFormError] = useState('')

  const fetchSessionHistory = useCallback(async () => {
    setHistoryLoading(true)
    setHistoryError('')
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`${API_BASE_URL}/api/sessions/student/history`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (!res.ok) {
        throw new Error('Failed to load learning session history')
      }
      const data = await res.json()
      setSessionHistory(data)
    } catch (err) {
      console.error(err)
      setHistoryError(err.message || 'Could not load learning session history.')
    } finally {
      setHistoryLoading(false)
    }
  }, [])

  const fetchReflections = useCallback(async () => {
    setReflectionsLoading(true)
    setReflectionsError('')
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`${API_BASE_URL}/api/reflections/`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (!res.ok) {
        throw new Error('Failed to load private reflection journal')
      }
      const data = await res.json()
      setReflections(data)
    } catch (err) {
      console.error(err)
      setReflectionsError(err.message || 'Could not load reflections.')
    } finally {
      setReflectionsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSessionHistory()
    fetchReflections()
  }, [fetchSessionHistory, fetchReflections])

  const handleOpenDetailModal = async (sessionId) => {
    setDetailLoading(true)
    setShowDetailModal(true)
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`${API_BASE_URL}/api/sessions/${sessionId}/student-details`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (!res.ok) {
        throw new Error('Could not load session details')
      }
      const data = await res.json()
      setSelectedSessionDetail(data)
    } catch (err) {
      console.error(err)
      setSelectedSessionDetail({ error: err.message || 'Failed to load details' })
    } finally {
      setDetailLoading(false)
    }
  }

  const handleOpenCreateReflection = (sessionId = '') => {
    setEditingReflection(null)
    setReflectionForm({
      session_id: sessionId || '',
      what_went_well: '',
      what_was_difficult: '',
      improvement_goal: ''
    })
    setFormError('')
    setShowReflectionModal(true)
  }

  const handleOpenEditReflection = (refl) => {
    setEditingReflection(refl)
    setReflectionForm({
      session_id: refl.session_id || '',
      what_went_well: refl.what_went_well,
      what_was_difficult: refl.what_was_difficult,
      improvement_goal: refl.improvement_goal
    })
    setFormError('')
    setShowReflectionModal(true)
  }

  const handleSaveReflection = async (e) => {
    e.preventDefault()
    if (!reflectionForm.what_went_well.trim() || !reflectionForm.what_was_difficult.trim() || !reflectionForm.improvement_goal.trim()) {
      setFormError('Please complete all reflection questions.')
      return
    }

    setFormSaving(true)
    setFormError('')
    try {
      const token = localStorage.getItem('token')
      const url = editingReflection
        ? `${API_BASE_URL}/api/reflections/${editingReflection.id}`
        : `${API_BASE_URL}/api/reflections/`
      const method = editingReflection ? 'PUT' : 'POST'

      const payload = {
        what_went_well: reflectionForm.what_went_well.trim(),
        what_was_difficult: reflectionForm.what_was_difficult.trim(),
        improvement_goal: reflectionForm.improvement_goal.trim(),
        ...(editingReflection ? {} : { session_id: reflectionForm.session_id || null })
      }

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      })

      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.detail || 'Failed to save reflection')
      }

      setShowReflectionModal(false)
      await fetchReflections()
      await fetchSessionHistory()
    } catch (err) {
      console.error(err)
      setFormError(err.message || 'Could not save reflection.')
    } finally {
      setFormSaving(false)
    }
  }

  const handleDeleteReflection = async (reflectionId) => {
    if (!window.confirm('Are you sure you want to delete this private reflection?')) return
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`${API_BASE_URL}/api/reflections/${reflectionId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      })
      if (!res.ok) {
        throw new Error('Failed to delete reflection')
      }
      await fetchReflections()
      await fetchSessionHistory()
    } catch (err) {
      console.error(err)
      alert(err.message || 'Could not delete reflection.')
    }
  }

  return (
    <PageContainer size="default" className="space-y-8">
      {/* Welcome Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-neutral-border pb-6">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">
            Student Learning Portal
          </span>
          <h2 className="text-h1 mt-1">Welcome back, {user?.name || 'Student'}</h2>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            onClick={() => handleOpenCreateReflection()}
            className="text-xs py-2 px-3.5"
          >
            + Write Reflection
          </Button>
          <Link to="/student/join">
            <Button variant="primary" className="text-xs py-2 px-4">
              Enter Class with Code &rarr;
            </Button>
          </Link>
        </div>
      </div>

      {/* Privacy Notice Banner */}
      <div className="p-4 rounded-md bg-emerald-50/70 border border-emerald-200/80 text-emerald-800 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 font-medium">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-emerald-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          <span>
            <strong>Privacy & Reflection Guard:</strong> Webcam analysis runs 100% locally in your browser. Reflections and personal goals are strictly private to you and are never shared with instructors or classmates.
          </span>
        </div>
        <Link to="/student/check" className="text-primary-600 hover:underline shrink-0 text-xs">
          Hardware Check &rarr;
        </Link>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-4 border-b border-neutral-border text-sm">
        <button
          onClick={() => setActiveTab('sessions')}
          className={`pb-3 font-semibold transition-colors border-b-2 ${
            activeTab === 'sessions'
              ? 'border-primary-600 text-primary-600'
              : 'border-transparent text-text-muted hover:text-brand-navy'
          }`}
        >
          My Attended Sessions ({sessionHistory.length})
        </button>
        <button
          onClick={() => setActiveTab('reflections')}
          className={`pb-3 font-semibold transition-colors border-b-2 ${
            activeTab === 'reflections'
              ? 'border-primary-600 text-primary-600'
              : 'border-transparent text-text-muted hover:text-brand-navy'
          }`}
        >
          Private Reflection Journal ({reflections.length})
        </button>
      </div>

      {/* TAB 1: SESSIONS HISTORY */}
      {activeTab === 'sessions' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-h3">Learning Session History</h3>
              <p className="text-xs text-text-muted mt-0.5">Classes you attended with attendance duration and classroom cohort trends</p>
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
            <div className="card-panel text-center py-8">
              <p className="text-xs text-text-muted">Loading learning sessions...</p>
            </div>
          ) : historyError ? (
            <div className="card-panel text-center py-6 space-y-2">
              <p className="text-xs text-danger-600">{historyError}</p>
              <Button variant="secondary" onClick={fetchSessionHistory} className="text-xs py-1 px-3">
                Retry
              </Button>
            </div>
          ) : sessionHistory.length === 0 ? (
            <div className="card-panel text-center py-10 bg-neutral-light/30 border-dashed space-y-3">
              <div className="w-10 h-10 rounded-full bg-primary-50 text-primary-600 flex items-center justify-center mx-auto">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <div>
                <h4 className="font-semibold text-brand-navy text-sm">No session participation records found</h4>
                <p className="text-xs text-text-muted mt-1 max-w-md mx-auto">
                  When you join a lecture using an instructor's classroom code, your participation will appear here with personal attendance timestamps and self-reflection logs.
                </p>
              </div>
              <Link to="/student/join">
                <Button variant="primary" className="text-xs py-1.5 px-3">
                  Join a Live Session Now
                </Button>
              </Link>
            </div>
          ) : (
            <div className="border border-neutral-border rounded overflow-x-auto shadow-sm bg-panel-bg">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-neutral-light border-b border-neutral-border font-semibold text-brand-navy">
                    <th className="p-3">Date</th>
                    <th className="p-3">Session Topic</th>
                    <th className="p-3">Classroom</th>
                    <th className="p-3">Time Attended</th>
                    <th className="p-3">Classroom Engagement</th>
                    <th className="p-3">Reflection</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-border text-text-muted">
                  {sessionHistory.map((s) => (
                    <tr key={s.session_id} className="hover:bg-neutral-light/35 transition-colors">
                      <td className="p-3 font-mono text-[11px]">
                        {new Date(s.joined_at).toLocaleDateString()}
                      </td>
                      <td className="p-3 font-semibold text-brand-navy-light max-w-[150px] truncate">
                        {s.session_title}
                      </td>
                      <td className="p-3 text-text-muted max-w-[120px] truncate">
                        {s.classroom_name}
                      </td>
                      <td className="p-3 font-mono text-[11px]">
                        {s.participation_duration_formatted}
                      </td>
                      <td className="p-3">
                        {s.telemetry_status === 'persisted' && s.classroom_normal_pct !== null ? (
                          <span className="text-emerald-600 font-semibold text-[11px]">
                            {s.classroom_normal_pct}% Class Focus
                          </span>
                        ) : (
                          <span className="text-text-muted italic text-[11px]" title="Aggregated classroom telemetry unavailable for this lecture">
                            Unavailable
                          </span>
                        )}
                      </td>
                      <td className="p-3">
                        {s.has_reflection ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                            âœ“ Reflected
                          </span>
                        ) : (
                          <button
                            onClick={() => handleOpenCreateReflection(s.session_id)}
                            className="text-[11px] text-primary-600 hover:text-primary-700 font-semibold hover:underline"
                          >
                            + Reflect
                          </button>
                        )}
                      </td>
                      <td className="p-3 text-right">
                        <Button
                          variant="secondary"
                          onClick={() => handleOpenDetailModal(s.session_id)}
                          className="text-[11px] py-1 px-2.5"
                        >
                          Details
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: PRIVATE REFLECTION JOURNAL */}
      {activeTab === 'reflections' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-h3">Private Reflection Journal</h3>
              <p className="text-xs text-text-muted mt-0.5">Your personal learning self-assessments, difficulty logs, and actionable goals</p>
            </div>
            <Button
              variant="primary"
              onClick={() => handleOpenCreateReflection()}
              className="text-xs py-1.5 px-3"
            >
              + New Journal Entry
            </Button>
          </div>

          {reflectionsLoading ? (
            <div className="card-panel text-center py-8">
              <p className="text-xs text-text-muted">Loading reflections...</p>
            </div>
          ) : reflectionsError ? (
            <div className="card-panel text-center py-6 space-y-2">
              <p className="text-xs text-danger-600">{reflectionsError}</p>
              <Button variant="secondary" onClick={fetchReflections} className="text-xs py-1 px-3">
                Retry
              </Button>
            </div>
          ) : reflections.length === 0 ? (
            <div className="card-panel text-center py-10 bg-neutral-light/30 border-dashed space-y-3">
              <div className="w-10 h-10 rounded-full bg-primary-50 text-primary-600 flex items-center justify-center mx-auto">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </div>
              <div>
                <h4 className="font-semibold text-brand-navy text-sm">Your reflection journal is empty</h4>
                <p className="text-xs text-text-muted mt-1 max-w-md mx-auto">
                  Take a moment after each class to note what went well, what concepts felt difficult, and your personal goal for next session.
                </p>
              </div>
              <Button
                variant="primary"
                onClick={() => handleOpenCreateReflection()}
                className="text-xs py-1.5 px-3"
              >
                Write Your First Reflection
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {reflections.map((r) => (
                <div key={r.id} className="card-panel bg-panel-bg space-y-3.5 border border-neutral-border shadow-sm">
                  {/* Card Header */}
                  <div className="flex justify-between items-start gap-2 border-b border-neutral-border pb-2.5">
                    <div>
                      <h4 className="font-bold text-sm text-brand-navy">
                        {r.session_title || 'General Reflection'}
                      </h4>
                      <div className="text-[11px] text-text-muted mt-0.5 space-x-1">
                        {r.classroom_name && <span>{r.classroom_name} &bull;</span>}
                        <span>{new Date(r.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => handleOpenEditReflection(r)}
                        className="text-[11px] text-primary-600 hover:text-primary-700 font-medium px-2 py-1 rounded hover:bg-primary-50"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteReflection(r.id)}
                        className="text-[11px] text-danger-600 hover:text-danger-700 font-medium px-2 py-1 rounded hover:bg-danger-50"
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  {/* Reflection Body */}
                  <div className="space-y-2.5 text-xs">
                    <div className="bg-emerald-50/60 border-l-2 border-emerald-500 p-2.5 rounded-r">
                      <span className="font-semibold text-emerald-800 block text-[11px] uppercase tracking-wider mb-0.5">
                        What Went Well
                      </span>
                      <p className="text-brand-navy whitespace-pre-wrap leading-relaxed">{r.what_went_well}</p>
                    </div>

                    <div className="bg-amber-50/60 border-l-2 border-amber-500 p-2.5 rounded-r">
                      <span className="font-semibold text-amber-800 block text-[11px] uppercase tracking-wider mb-0.5">
                        What Was Difficult
                      </span>
                      <p className="text-brand-navy whitespace-pre-wrap leading-relaxed">{r.what_was_difficult}</p>
                    </div>

                    <div className="bg-primary-50/60 border-l-2 border-primary-500 p-2.5 rounded-r">
                      <span className="font-semibold text-primary-800 block text-[11px] uppercase tracking-wider mb-0.5">
                        Next-Session Improvement Goal
                      </span>
                      <p className="text-brand-navy whitespace-pre-wrap leading-relaxed">{r.improvement_goal}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* MODAL: SESSION DETAILS */}
      {showDetailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-panel-bg border border-neutral-border rounded-lg shadow-xl max-w-lg w-full p-6 space-y-5 animate-in fade-in duration-150">
            <div className="flex justify-between items-start border-b border-neutral-border pb-3">
              <div>
                <span className="text-[10px] font-mono uppercase font-bold text-primary-600 bg-primary-50 px-2 py-0.5 rounded">
                  Session Overview
                </span>
                <h3 className="text-h3 text-base mt-1 text-brand-navy">
                  {selectedSessionDetail?.session_title || 'Session Details'}
                </h3>
                <p className="text-xs text-text-muted mt-0.5">
                  {selectedSessionDetail?.classroom_name}
                </p>
              </div>
              <button
                onClick={() => setShowDetailModal(false)}
                className="text-text-muted hover:text-brand-navy text-lg leading-none"
              >
                &times;
              </button>
            </div>

            {detailLoading ? (
              <p className="text-xs text-text-muted py-6 text-center">Loading details...</p>
            ) : selectedSessionDetail?.error ? (
              <p className="text-xs text-danger-600 py-4">{selectedSessionDetail.error}</p>
            ) : (
              <div className="space-y-4 text-xs">
                {/* Participation info grid */}
                <div className="grid grid-cols-2 gap-3 bg-neutral-light p-3 rounded">
                  <div>
                    <span className="text-text-muted text-[11px]">Time Attended:</span>
                    <p className="font-mono font-bold text-brand-navy mt-0.5">
                      {selectedSessionDetail?.participation_duration_formatted}
                    </p>
                  </div>
                  <div>
                    <span className="text-text-muted text-[11px]">Session Status:</span>
                    <p className="font-semibold text-brand-navy mt-0.5 capitalize">
                      {selectedSessionDetail?.session_status}
                    </p>
                  </div>
                  <div>
                    <span className="text-text-muted text-[11px]">Joined At:</span>
                    <p className="font-mono text-brand-navy mt-0.5">
                      {selectedSessionDetail?.student_joined_at ? new Date(selectedSessionDetail.student_joined_at).toLocaleTimeString() : 'â€”'}
                    </p>
                  </div>
                  <div>
                    <span className="text-text-muted text-[11px]">Left At:</span>
                    <p className="font-mono text-brand-navy mt-0.5">
                      {selectedSessionDetail?.student_left_at ? new Date(selectedSessionDetail.student_left_at).toLocaleTimeString() : (selectedSessionDetail?.session_status === 'active' ? 'Active' : 'Session Ended')}
                    </p>
                  </div>
                </div>

                {/* Classroom Cohort Engagement Indicator */}
                <div className="bg-primary-50/50 border border-primary-200/60 rounded p-3 space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-primary-900 text-[11px] uppercase tracking-wider">
                      Classroom Cohort Trend (Non-Diagnostic)
                    </span>
                    {selectedSessionDetail?.telemetry_status === 'persisted' && selectedSessionDetail?.classroom_normal_pct !== null ? (
                      <span className="font-bold text-emerald-700 bg-emerald-100/70 px-1.5 py-0.5 rounded text-[11px]">
                        {selectedSessionDetail.classroom_normal_pct}% Normal
                      </span>
                    ) : (
                      <span className="text-text-muted text-[11px] italic">Unavailable</span>
                    )}
                  </div>
                  <p className="text-[11px] text-text-muted leading-relaxed">
                    This represents the anonymous aggregate trend for the entire classroom cohort. It is not an individual diagnostic score and does not evaluate your comprehension.
                  </p>
                </div>

                {/* Attached Reflection or Action */}
                <div className="border-t border-neutral-border pt-3">
                  <h4 className="font-semibold text-xs text-brand-navy mb-2">My Private Reflection for this Class:</h4>
                  {selectedSessionDetail?.reflection ? (
                    <div className="bg-neutral-light/60 p-3 rounded space-y-2 text-[11px]">
                      <div>
                        <strong className="text-emerald-800">Went Well:</strong> {selectedSessionDetail.reflection.what_went_well}
                      </div>
                      <div>
                        <strong className="text-amber-800">Difficult:</strong> {selectedSessionDetail.reflection.what_was_difficult}
                      </div>
                      <div>
                        <strong className="text-primary-800">Goal:</strong> {selectedSessionDetail.reflection.improvement_goal}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-3 bg-neutral-light/40 rounded border border-dashed border-neutral-border">
                      <p className="text-text-muted text-xs mb-2">You haven't reflected on this lecture yet.</p>
                      <Button
                        variant="secondary"
                        onClick={() => {
                          setShowDetailModal(false)
                          handleOpenCreateReflection(selectedSessionDetail?.session_id)
                        }}
                        className="text-xs py-1 px-3"
                      >
                        + Write Reflection Now
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="flex justify-end pt-2 border-t border-neutral-border">
              <Button variant="secondary" onClick={() => setShowDetailModal(false)} className="text-xs py-1.5 px-3">
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: WRITE / EDIT REFLECTION */}
      {showReflectionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-panel-bg border border-neutral-border rounded-lg shadow-xl max-w-lg w-full p-6 space-y-4 animate-in fade-in duration-150">
            <div className="flex justify-between items-start border-b border-neutral-border pb-3">
              <div>
                <h3 className="text-h3 text-base text-brand-navy">
                  {editingReflection ? 'Edit Private Reflection' : 'New Private Reflection'}
                </h3>
                <p className="text-xs text-text-muted mt-0.5">
                  100% confidential. Designed for personal self-assessment and continuous growth.
                </p>
              </div>
              <button
                onClick={() => setShowReflectionModal(false)}
                className="text-text-muted hover:text-brand-navy text-lg leading-none"
              >
                &times;
              </button>
            </div>

            {formError && (
              <p className="text-xs text-danger-600 bg-danger-50 p-2 rounded">{formError}</p>
            )}

            <form onSubmit={handleSaveReflection} className="space-y-4 text-xs">
              {/* Optional Session Association */}
              {!editingReflection && (
                <div>
                  <label className="block text-[11px] font-semibold text-brand-navy mb-1">
                    Associate with Attended Session (Optional):
                  </label>
                  <select
                    value={reflectionForm.session_id}
                    onChange={(e) => setReflectionForm({ ...reflectionForm, session_id: e.target.value })}
                    className="w-full border border-neutral-border rounded p-2 text-xs bg-panel-bg"
                  >
                    <option value="">-- General Learning Reflection (No specific session) --</option>
                    {sessionHistory.map((s) => (
                      <option key={s.session_id} value={s.session_id}>
                        {s.session_title} ({s.classroom_name} &bull; {new Date(s.joined_at).toLocaleDateString()})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Question 1: What went well */}
              <div>
                <label className="block text-[11px] font-semibold text-brand-navy mb-1">
                  1. What went well during this learning session? <span className="text-danger-600">*</span>
                </label>
                <textarea
                  value={reflectionForm.what_went_well}
                  onChange={(e) => setReflectionForm({ ...reflectionForm, what_went_well: e.target.value })}
                  placeholder="e.g., I understood the first theorem clearly and stayed focused during the proofs."
                  rows={3}
                  maxLength={2000}
                  className="w-full border border-neutral-border rounded p-2.5 text-xs focus:ring-1 focus:ring-primary-600 focus:outline-none"
                  required
                />
                <span className="text-[10px] text-text-muted float-right">
                  {reflectionForm.what_went_well.length}/2000
                </span>
              </div>

              {/* Question 2: What was difficult */}
              <div>
                <label className="block text-[11px] font-semibold text-brand-navy mb-1">
                  2. What was challenging or difficult? <span className="text-danger-600">*</span>
                </label>
                <textarea
                  value={reflectionForm.what_was_difficult}
                  onChange={(e) => setReflectionForm({ ...reflectionForm, what_was_difficult: e.target.value })}
                  placeholder="e.g., The derivation on slide 15 felt fast; I got confused about the integration limits."
                  rows={3}
                  maxLength={2000}
                  className="w-full border border-neutral-border rounded p-2.5 text-xs focus:ring-1 focus:ring-primary-600 focus:outline-none"
                  required
                />
                <span className="text-[10px] text-text-muted float-right">
                  {reflectionForm.what_was_difficult.length}/2000
                </span>
              </div>

              {/* Question 3: Next-session improvement goal */}
              <div>
                <label className="block text-[11px] font-semibold text-brand-navy mb-1">
                  3. Actionable goal for next session / review: <span className="text-danger-600">*</span>
                </label>
                <textarea
                  value={reflectionForm.improvement_goal}
                  onChange={(e) => setReflectionForm({ ...reflectionForm, improvement_goal: e.target.value })}
                  placeholder="e.g., Review textbook chapter 4 exercises before Thursday's lecture and write questions down."
                  rows={2}
                  maxLength={2000}
                  className="w-full border border-neutral-border rounded p-2.5 text-xs focus:ring-1 focus:ring-primary-600 focus:outline-none"
                  required
                />
                <span className="text-[10px] text-text-muted float-right">
                  {reflectionForm.improvement_goal.length}/2000
                </span>
              </div>

              {/* Buttons */}
              <div className="flex justify-end gap-2 pt-3 border-t border-neutral-border">
                <Button
                  variant="secondary"
                  type="button"
                  onClick={() => setShowReflectionModal(false)}
                  disabled={formSaving}
                  className="text-xs py-1.5 px-3"
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  type="submit"
                  disabled={formSaving}
                  className="text-xs py-1.5 px-4"
                >
                  {formSaving ? 'Saving...' : editingReflection ? 'Save Changes' : 'Save Reflection'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </PageContainer>
  )
}
