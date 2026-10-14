import React, { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import PageContainer from '../../components/PageContainer'
import Button from '../../components/Button'
import FourLevelIndicator, { mapScoreToFourLevel } from '../../components/analytics/FourLevelIndicator'
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

  // Derived Indicators from Recent Session History
  const latestSessionWithTelemetry = sessionHistory.find(
    (s) => s.telemetry_status === 'persisted' && s.classroom_normal_pct !== null
  )

  const attentionScore = latestSessionWithTelemetry?.classroom_normal_pct ?? null
  const confusionScore = latestSessionWithTelemetry?.classroom_elevated_confusion_pct ?? null

  const attentionLevel = attentionScore !== null ? mapScoreToFourLevel('attention', attentionScore) : 'uncertain'
  const confusionLevel = confusionScore !== null ? mapScoreToFourLevel('confusion', confusionScore) : 'uncertain'

  return (
    <PageContainer size="large" className="py-6 space-y-8">
      {/* Header and Welcome Action Bar */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-panel-bg border border-neutral-border rounded-xl p-6 shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-primary-600 bg-primary-50 px-2 py-0.5 rounded-full border border-primary-200/60 font-mono">
              Student Learning Portal
            </span>
            <span className="text-text-muted text-xs">&bull;</span>
            <span className="text-text-muted text-xs">Self-Guided Attention & Reflection</span>
          </div>
          <h1 className="text-2xl font-bold text-brand-navy tracking-tight">
            Welcome back, {user?.name || 'Student'}
          </h1>
          <p className="text-xs text-text-muted max-w-xl leading-relaxed">
            Review your classroom attendance history, monitor cohort learning engagement trends, and write private learning reflections.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <Button
            variant="secondary"
            onClick={() => handleOpenCreateReflection()}
            className="text-xs py-2 px-3.5"
          >
            + Write Reflection
          </Button>
          <Link to="/student/join">
            <Button variant="primary" className="text-xs py-2 px-4 shadow-sm">
              Enter Class with Code &rarr;
            </Button>
          </Link>
        </div>
      </div>

      {/* Primary Behavioral Indicators Section */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-1">
          <div>
            <h3 className="text-sm font-bold text-brand-navy uppercase tracking-wider">
              Learning Engagement & Confusion Indicators
            </h3>
            <p className="text-xs text-text-muted">
              {latestSessionWithTelemetry
                ? `Derived from cohort telemetry in your most recent session: "${latestSessionWithTelemetry.session_title}"`
                : 'Indicators update automatically when you attend classroom sessions with active telemetry.'}
            </p>
          </div>
          <span className="text-[11px] text-text-muted font-mono">
            {latestSessionWithTelemetry ? `Session Date: ${new Date(latestSessionWithTelemetry.joined_at).toLocaleDateString()}` : 'Awaiting First Session'}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Indicator 1: Attention-Related Estimate */}
          <FourLevelIndicator
            type="attention"
            level={attentionLevel}
            score={attentionScore}
            confidence={attentionScore !== null ? 0.85 : null}
            showExplanation={true}
          />

          {/* Indicator 2: Confusion-Related Estimate */}
          <FourLevelIndicator
            type="confusion"
            level={confusionLevel}
            score={confusionScore}
            confidence={confusionScore !== null ? 0.82 : null}
            showExplanation={true}
          />
        </div>

        <div className="p-3 bg-slate-100/70 border border-slate-200/80 rounded-lg text-slate-600 text-[11px] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-slate-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>
              <strong>Scientific & Privacy Notice:</strong> These estimates represent uncalibrated heuristic behavioural cues relative to baseline, not clinical or cognitive measurements. All webcam video is processed purely on-device and is never stored or transmitted.
            </span>
          </div>
          <Link to="/student/check" className="text-primary-600 font-semibold hover:underline shrink-0">
            Hardware Diagnostics &rarr;
          </Link>
        </div>
      </div>

      {/* Summary Stat Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card-panel p-4 bg-panel-bg flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center font-bold text-sm">
            {sessionHistory.length}
          </div>
          <div>
            <span className="text-[10px] font-mono uppercase text-text-muted">Total Sessions</span>
            <p className="text-sm font-bold text-brand-navy">Attended Lectures</p>
          </div>
        </div>

        <div className="card-panel p-4 bg-panel-bg flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-sm">
            {reflections.length}
          </div>
          <div>
            <span className="text-[10px] font-mono uppercase text-text-muted">Private Journal</span>
            <p className="text-sm font-bold text-brand-navy">Reflections Logged</p>
          </div>
        </div>

        <div className="card-panel p-4 bg-panel-bg flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-xs">
            100%
          </div>
          <div>
            <span className="text-[10px] font-mono uppercase text-text-muted">Privacy Safeguard</span>
            <p className="text-sm font-bold text-brand-navy">Zero Cloud Video</p>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-6 border-b border-neutral-border text-sm font-medium">
        <button
          onClick={() => setActiveTab('sessions')}
          className={`pb-3 border-b-2 font-semibold transition-colors flex items-center gap-2 ${
            activeTab === 'sessions'
              ? 'border-primary-600 text-primary-600'
              : 'border-transparent text-text-muted hover:text-brand-navy'
          }`}
        >
          <span>Attended Sessions</span>
          <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-100 text-slate-600 font-mono">
            {sessionHistory.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('reflections')}
          className={`pb-3 border-b-2 font-semibold transition-colors flex items-center gap-2 ${
            activeTab === 'reflections'
              ? 'border-primary-600 text-primary-600'
              : 'border-transparent text-text-muted hover:text-brand-navy'
          }`}
        >
          <span>Private Reflections</span>
          <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-100 text-slate-600 font-mono">
            {reflections.length}
          </span>
        </button>
      </div>

      {/* TAB 1: SESSIONS HISTORY */}
      {activeTab === 'sessions' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-sm font-bold text-brand-navy">Learning Session History</h3>
              <p className="text-xs text-text-muted mt-0.5">Classes you attended with attendance duration and classroom cohort trends</p>
            </div>
            <button
              onClick={fetchSessionHistory}
              disabled={historyLoading}
              className="text-xs text-primary-600 hover:text-primary-700 font-medium underline disabled:opacity-50"
            >
              Refresh
            </button>
          </div>

          {historyLoading ? (
            <div className="card-panel text-center py-10">
              <div className="w-6 h-6 border-2 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
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
            <div className="card-panel text-center py-12 bg-slate-50/50 border-dashed space-y-3 rounded-xl">
              <div className="w-12 h-12 rounded-2xl bg-primary-50 text-primary-600 flex items-center justify-center mx-auto shadow-xs">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                <Button variant="primary" className="text-xs py-2 px-4 shadow-sm">
                  Join a Live Session Now
                </Button>
              </Link>
            </div>
          ) : (
            <div className="border border-neutral-border rounded-xl overflow-x-auto shadow-xs bg-panel-bg">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-neutral-border font-semibold text-brand-navy">
                    <th className="p-3.5">Date</th>
                    <th className="p-3.5">Session Topic</th>
                    <th className="p-3.5">Classroom</th>
                    <th className="p-3.5">Time Attended</th>
                    <th className="p-3.5">Classroom Engagement</th>
                    <th className="p-3.5">Reflection</th>
                    <th className="p-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-border text-text-muted">
                  {sessionHistory.map((s) => (
                    <tr key={s.session_id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="p-3.5 font-mono text-[11px]">
                        {new Date(s.joined_at).toLocaleDateString()}
                      </td>
                      <td className="p-3.5 font-semibold text-brand-navy max-w-[160px] truncate">
                        {s.session_title}
                      </td>
                      <td className="p-3.5 text-text-muted max-w-[130px] truncate">
                        {s.classroom_name}
                      </td>
                      <td className="p-3.5 font-mono text-[11px]">
                        {s.participation_duration_formatted}
                      </td>
                      <td className="p-3.5">
                        {s.telemetry_status === 'persisted' && s.classroom_normal_pct !== null ? (
                          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                            {s.classroom_normal_pct}% Class Focus
                          </span>
                        ) : (
                          <span className="text-text-muted italic text-[11px]" title="Aggregated classroom telemetry unavailable for this lecture">
                            Unavailable
                          </span>
                        )}
                      </td>
                      <td className="p-3.5">
                        {s.has_reflection ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                            <svg className="w-3 h-3 text-emerald-600" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                            Reflected
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
                      <td className="p-3.5 text-right">
                        <Button
                          variant="secondary"
                          onClick={() => handleOpenDetailModal(s.session_id)}
                          className="text-[11px] py-1 px-2.5"
                        >
                          View Summary
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
              <h3 className="text-sm font-bold text-brand-navy">Private Learning Reflections</h3>
              <p className="text-xs text-text-muted mt-0.5">
                Self-evaluation journal entries strictly private to you. Not visible to professors or peers.
              </p>
            </div>
            <Button
              variant="primary"
              onClick={() => handleOpenCreateReflection()}
              className="text-xs py-1.5 px-3"
            >
              + New Entry
            </Button>
          </div>

          {reflectionsLoading ? (
            <div className="card-panel text-center py-10">
              <div className="w-6 h-6 border-2 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
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
            <div className="card-panel text-center py-12 bg-slate-50/50 border-dashed space-y-3 rounded-xl">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto shadow-xs">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </div>
              <div>
                <h4 className="font-semibold text-brand-navy text-sm">No reflection entries written yet</h4>
                <p className="text-xs text-text-muted mt-1 max-w-md mx-auto">
                  Take a moment after classes to note what went well, what felt difficult, and your personal goal for next session.
                </p>
              </div>
              <Button
                variant="primary"
                onClick={() => handleOpenCreateReflection()}
                className="text-xs py-2 px-4 shadow-sm"
              >
                Write Your First Reflection
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {reflections.map((refl) => (
                <div key={refl.id} className="card-panel bg-panel-bg p-5 space-y-3.5 rounded-xl border border-neutral-border shadow-xs hover:border-slate-300 transition-all">
                  <div className="flex justify-between items-start gap-2 border-b border-neutral-border pb-3">
                    <div>
                      <span className="text-[10px] font-mono font-semibold uppercase text-primary-700 bg-primary-50 px-2 py-0.5 rounded border border-primary-200/60">
                        {refl.session_title || 'General Reflection'}
                      </span>
                      <p className="text-[11px] text-text-muted font-mono mt-1">
                        {new Date(refl.created_at).toLocaleDateString()} at {new Date(refl.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleOpenEditReflection(refl)}
                        className="text-xs text-primary-600 hover:text-primary-800 p-1"
                        title="Edit reflection"
                      >
                        Edit
                      </button>
                      <span className="text-text-muted text-xs">&bull;</span>
                      <button
                        onClick={() => handleDeleteReflection(refl.id)}
                        className="text-xs text-danger-600 hover:text-danger-800 p-1"
                        title="Delete reflection"
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2 text-xs leading-relaxed">
                    <div className="bg-emerald-50/60 p-2.5 rounded-lg border border-emerald-100">
                      <span className="font-bold text-emerald-900 block text-[11px] mb-0.5">What went well:</span>
                      <p className="text-slate-700">{refl.what_went_well}</p>
                    </div>

                    <div className="bg-amber-50/60 p-2.5 rounded-lg border border-amber-100">
                      <span className="font-bold text-amber-900 block text-[11px] mb-0.5">What was challenging:</span>
                      <p className="text-slate-700">{refl.what_was_difficult}</p>
                    </div>

                    <div className="bg-blue-50/60 p-2.5 rounded-lg border border-blue-100">
                      <span className="font-bold text-blue-900 block text-[11px] mb-0.5">Personal Goal:</span>
                      <p className="text-slate-700">{refl.improvement_goal}</p>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="bg-panel-bg border border-neutral-border rounded-xl shadow-xl max-w-lg w-full p-6 space-y-4 animate-in fade-in duration-150">
            <div className="flex justify-between items-start border-b border-neutral-border pb-3">
              <div>
                <span className="text-[10px] font-mono uppercase font-bold text-primary-600 bg-primary-50 px-2 py-0.5 rounded border border-primary-200">
                  Session Overview
                </span>
                <h3 className="text-h3 text-base mt-1.5 text-brand-navy">
                  {selectedSessionDetail?.session_title || 'Session Details'}
                </h3>
                <p className="text-xs text-text-muted mt-0.5">
                  {selectedSessionDetail?.classroom_name}
                </p>
              </div>
              <button
                onClick={() => setShowDetailModal(false)}
                className="text-text-muted hover:text-brand-navy text-xl leading-none p-1"
              >
                &times;
              </button>
            </div>

            {detailLoading ? (
              <div className="py-8 text-center text-xs text-text-muted">
                <div className="w-5 h-5 border-2 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                Loading session record...
              </div>
            ) : selectedSessionDetail?.error ? (
              <p className="text-xs text-danger-600 py-4">{selectedSessionDetail.error}</p>
            ) : (
              <div className="space-y-4 text-xs">
                {/* Participation info grid */}
                <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3.5 rounded-lg border border-slate-200">
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
                      {selectedSessionDetail?.student_joined_at ? new Date(selectedSessionDetail.student_joined_at).toLocaleTimeString() : '--'}
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
                <div className="bg-primary-50/50 border border-primary-200/60 rounded-lg p-3.5 space-y-1.5">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-primary-900 text-[11px] uppercase tracking-wider font-mono">
                      Classroom Cohort Trend (Non-Diagnostic)
                    </span>
                    {selectedSessionDetail?.telemetry_status === 'persisted' && selectedSessionDetail?.classroom_normal_pct !== null ? (
                      <span className="font-bold text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded-full text-[11px] border border-emerald-200">
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
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-2 text-[11px]">
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
                    <div className="text-center py-4 bg-slate-50/70 rounded-lg border border-dashed border-neutral-border">
                      <p className="text-text-muted text-xs mb-2">You haven't reflected on this lecture yet.</p>
                      <Button
                        variant="secondary"
                        onClick={() => {
                          setShowDetailModal(false)
                          handleOpenCreateReflection(selectedSessionDetail?.session_id)
                        }}
                        className="text-xs py-1.5 px-3"
                      >
                        + Write Reflection Now
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="flex justify-end pt-3 border-t border-neutral-border">
              <Button variant="secondary" onClick={() => setShowDetailModal(false)} className="text-xs py-1.5 px-3">
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: WRITE / EDIT REFLECTION */}
      {showReflectionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="bg-panel-bg border border-neutral-border rounded-xl shadow-xl max-w-lg w-full p-6 space-y-4 animate-in fade-in duration-150">
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
                className="text-text-muted hover:text-brand-navy text-xl leading-none p-1"
              >
                &times;
              </button>
            </div>

            {formError && (
              <p className="text-xs text-danger-600 bg-danger-50 p-2.5 rounded-lg border border-danger-200">{formError}</p>
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
                    className="w-full border border-neutral-border rounded-lg p-2.5 text-xs bg-panel-bg focus:ring-2 focus:ring-primary-500/20 focus:border-primary-600"
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
                  placeholder="e.g., I understood the main theorem and maintained steady attention during the proofs."
                  rows={3}
                  maxLength={2000}
                  className="w-full border border-neutral-border rounded-lg p-2.5 text-xs focus:ring-2 focus:ring-primary-500/20 focus:border-primary-600 focus:outline-none"
                  required
                />
                <span className="text-[10px] text-text-muted float-right mt-1">
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
                  placeholder="e.g., The transition to multi-variable formulas felt fast; I had questions on the derivation."
                  rows={3}
                  maxLength={2000}
                  className="w-full border border-neutral-border rounded-lg p-2.5 text-xs focus:ring-2 focus:ring-primary-500/20 focus:border-primary-600 focus:outline-none"
                  required
                />
                <span className="text-[10px] text-text-muted float-right mt-1">
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
                  placeholder="e.g., Review textbook chapter exercises before next lecture and prepare questions."
                  rows={2}
                  maxLength={2000}
                  className="w-full border border-neutral-border rounded-lg p-2.5 text-xs focus:ring-2 focus:ring-primary-500/20 focus:border-primary-600 focus:outline-none"
                  required
                />
                <span className="text-[10px] text-text-muted float-right mt-1">
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
                  className="text-xs py-1.5 px-4 shadow-sm"
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
