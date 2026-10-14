import React, { useState, useEffect, useRef } from 'react'
import { useParams, Link, useLocation, useNavigate } from 'react-router-dom'
import PageContainer from '../../components/PageContainer'
import Button from '../../components/Button'
import StatusBadge from '../../components/StatusBadge'
import FourLevelIndicator from '../../components/analytics/FourLevelIndicator'
import { useSessionWebSocket } from '../../hooks/useSessionWebSocket'
import { useCamera } from '../../hooks/useCamera'
import { useFaceLandmarker } from '../../hooks/useFaceLandmarker'
import { API_BASE_URL } from '../../config/api'
import { useAuth } from '../../context/AuthContext'
import ClassroomChat from '../../components/ClassroomChat'
import { useClassroomVoice } from '../../hooks/useClassroomVoice'
import { useScreenShare } from '../../hooks/useScreenShare'
import ClassroomVoiceControls from '../../components/ClassroomVoiceControls'
import ScreenShareViewer from '../../components/ScreenShareViewer'

export default function StudentClassroom() {
  const { id } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [participation, setParticipation] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [leaving, setLeaving] = useState(false)
  const [sessionEnded, setSessionEnded] = useState(false)

  const token = localStorage.getItem('token')
  const isJoined = participation !== null && participation.status === 'joined'

  // Real-time WebSocket connection
  const {
    isConnected: isWsConnected,
    connectionState,
    retryCount,
    lastMessage,
    sendBehaviourUpdate,
    sendChatMessage,
    sendSignal,
    sendScreenshareStarted,
    sendScreenshareStopped,
    sendVoiceJoin,
    sendVoiceLeave,
    sendVoiceStatus
  } = useSessionWebSocket(
    id,
    token,
    isJoined && !sessionEnded
  )

  const voice = useClassroomVoice({
    sessionId: id,
    currentUser: user,
    isWsConnected,
    lastMessage,
    sendSignal,
    sendVoiceJoin,
    sendVoiceLeave,
    sendVoiceStatus
  })

  const screen = useScreenShare({
    sessionId: id,
    currentUser: user,
    isWsConnected,
    lastMessage,
    sendSignal,
    sendScreenshareStarted,
    sendScreenshareStopped,
    isTeacher: false
  })

  // Browser webcam preview (100% local, no raw frames transmitted)
  const {
    videoRef,
    status: cameraStatus,
    error: cameraError,
    startCamera,
    stopCamera
  } = useCamera(isJoined && !sessionEnded)

  // MediaPipe Face Landmarker (runs strictly browser-locally on active camera)
  const {
    isLoading: isLandmarkerLoading,
    error: landmarkerError,
    faceDetected,
    ear,
    gazeX,
    gazeY,
    yaw,
    pitch,
    roll,
    temporalData,
    baselineData,
    inferenceData
  } = useFaceLandmarker(videoRef, cameraStatus === 'active')

  const classroomName = location.state?.classroomName
  const sessionTitle = location.state?.sessionTitle
  const courseTitle = sessionTitle
    ? `${sessionTitle} (${classroomName || 'Classroom'})`
    : `Classroom Session: ${id?.substring(0, 8)}...`

  useEffect(() => {
    let isMounted = true

    const joinSession = async () => {
      try {
        const token = localStorage.getItem('token')
        if (!token) {
          navigate('/login')
          return
        }

        // Attempt to join the session
        const res = await fetch(`${API_BASE_URL}/api/sessions/${id}/join`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          }
        })

        if (res.status === 401) {
          navigate('/login')
          return
        }

        if (res.ok) {
          const data = await res.json()
          if (isMounted) setParticipation(data)
        } else {
          const errData = await res.json()
          // If already joined, retrieve current participation record
          if (res.status === 400 && errData.detail && errData.detail.includes('already')) {
            const partRes = await fetch(`${API_BASE_URL}/api/sessions/${id}/participation`, {
              headers: { Authorization: `Bearer ${token}` }
            })
            if (partRes.ok) {
              const partData = await partRes.json()
              if (isMounted) setParticipation(partData)
            }
          } else {
            if (isMounted) setError(errData.detail || 'Failed to join session.')
          }
        }
      } catch (err) {
        if (isMounted) setError('Network error joining session.')
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    joinSession()

    return () => {
      isMounted = false
    }
  }, [id, navigate])

  // Handle session termination event from teacher
  useEffect(() => {
    if (lastMessage?.type === 'session_ended') {
      stopCamera()
      setSessionEnded(true)
    }
  }, [lastMessage, stopCamera])

  // Phase 3C: Throttled transmission of derived behavioural assessment to WebSocket
  const lastSentTimeRef = useRef(0)
  const lastSentStateRef = useRef({ engagement: null, confusion: null })

  useEffect(() => {
    if (!isWsConnected || cameraStatus !== 'active' || !inferenceData || sessionEnded) return

    const currentEngagement = inferenceData.engagement?.state || 'UNCERTAIN'
    const currentConfusion = inferenceData.confusion?.state || 'UNCERTAIN'
    const currentConfidence = typeof inferenceData.engagement?.confidence === 'number'
      ? inferenceData.engagement.confidence
      : 0.0

    const now = Date.now()
    const stateChanged =
      currentEngagement !== lastSentStateRef.current.engagement ||
      currentConfusion !== lastSentStateRef.current.confusion

    const timeSinceLast = now - lastSentTimeRef.current

    // Transmit approximately once per second (1000ms) OR immediately upon state change
    if (stateChanged || timeSinceLast >= 1000) {
      sendBehaviourUpdate({
        engagement_state: currentEngagement,
        confusion_signal: currentConfusion,
        confidence: currentConfidence
      })
      lastSentTimeRef.current = now
      lastSentStateRef.current = {
        engagement: currentEngagement,
        confusion: currentConfusion
      }
    }
  }, [inferenceData, isWsConnected, cameraStatus, sessionEnded, sendBehaviourUpdate])

  const handleLeaveSession = async () => {
    stopCamera()
    setLeaving(true)
    try {
      const token = localStorage.getItem('token')
      await fetch(`${API_BASE_URL}/api/sessions/${id}/leave`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      })
    } catch (err) {
      console.error('Error leaving session:', err)
    } finally {
      navigate('/student')
    }
  }

  if (sessionEnded) {
    return (
      <PageContainer size="small" className="py-16">
        <div className="card-panel space-y-4 text-center p-8 rounded-xl shadow-md bg-panel-bg">
          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <StatusBadge status="info" label="Session Concluded" />
          <h2 className="text-xl font-bold text-brand-navy">Lecture Session Has Ended</h2>
          <p className="text-xs text-text-muted leading-relaxed max-w-sm mx-auto">
            Your instructor has concluded this session. Camera access and local behavioral processing have been stopped.
          </p>
          <div className="pt-3">
            <Link to="/student">
              <Button variant="primary" className="text-xs py-2 px-4">
                Return to Student Portal
              </Button>
            </Link>
          </div>
        </div>
      </PageContainer>
    )
  }

  if (loading) {
    return (
      <PageContainer size="large" className="py-16 text-center">
        <div className="w-8 h-8 border-2 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-xs text-text-muted">Connecting and entering live classroom...</p>
      </PageContainer>
    )
  }

  if (error) {
    return (
      <PageContainer size="small" className="py-16">
        <div className="card-panel space-y-4 text-center p-8 rounded-xl shadow-md bg-panel-bg">
          <h3 className="text-lg font-bold text-danger-600">Unable to Join Session</h3>
          <p className="text-xs text-text-muted">{error}</p>
          <div className="pt-3">
            <Link to="/student">
              <Button variant="primary">Return to Student Portal</Button>
            </Link>
          </div>
        </div>
      </PageContainer>
    )
  }

  // Derive active behavioral indicators from real-time local inferenceData
  const activeEngagementState = inferenceData?.engagement?.state || 'UNCERTAIN'
  const activeConfusionState = inferenceData?.confusion?.state || 'UNCERTAIN'
  const activeEngagementEvidence = inferenceData?.engagement?.evidence ?? null
  const activeConfusionEvidence = inferenceData?.confusion?.evidence ?? null
  const activeConfidence = inferenceData?.engagement?.confidence ?? null

  return (
    <PageContainer size="full" className="py-5 px-4 sm:px-6 lg:px-8 space-y-5">
      {/* Classroom Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-panel-bg border border-neutral-border rounded-xl p-4 shadow-xs">
        <div className="flex flex-wrap items-center gap-2.5">
          <StatusBadge status="success" label="Active Participant" dot={true} />
          {connectionState === 'connected' && <StatusBadge status="info" label="Realtime Sync" />}
          {connectionState === 'reconnecting' && <StatusBadge status="warning" label={`Reconnecting (${retryCount}/5)...`} dot={true} />}
          {connectionState === 'failed' && <StatusBadge status="danger" label="Sync Offline" />}
          <div className="pl-1">
            <h1 className="font-bold text-brand-navy text-base leading-tight">{courseTitle}</h1>
            <p className="text-[11px] text-text-muted font-mono mt-0.5">
              Live Session &bull; Joined at {participation?.joined_at ? new Date(participation.joined_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Now'}
            </p>
          </div>
        </div>

        <Button
          variant="secondary"
          onClick={handleLeaveSession}
          disabled={leaving}
          className="text-xs py-1.5 px-3 border-danger-200 text-danger-600 hover:bg-danger-50 shrink-0"
        >
          {leaving ? 'Leaving...' : 'Exit Classroom'}
        </Button>
      </div>

      {/* Classroom Voice Controls Top-Bar */}
      <ClassroomVoiceControls
        isVoiceJoined={voice.isVoiceJoined}
        isMuted={voice.isMuted}
        isSpeaking={voice.isSpeaking}
        voiceStatus={voice.voiceStatus}
        voiceError={voice.voiceError}
        remotePeers={voice.remotePeers}
        onJoinVoice={voice.joinVoice}
        onLeaveVoice={voice.leaveVoice}
        onToggleMute={voice.toggleMute}
        disabled={!isWsConnected}
      />

      {/* Main Classroom Workspace Grid: 2 Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">

        {/* LEFT COLUMN (8 of 12 cols): Presentation & Real-time Behavioral Indicators */}
        <div className="lg:col-span-8 space-y-5">
          {/* Main Lecture Presentation / Screen Share Viewer */}
          <ScreenShareViewer
            stream={screen.screenStream}
            isSharing={false}
            isTeacherSharing={screen.isTeacherSharing}
            teacherName={screen.teacherSharingName}
            isTeacher={false}
            sharingError={screen.sharingError}
            disabled={!isWsConnected}
          />

          {/* Student Attention & Confusion Indicators Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-neutral-border pb-2">
              <div>
                <h3 className="text-xs font-bold text-brand-navy uppercase tracking-wider">
                  Live Attention & Confusion Indicators
                </h3>
                <p className="text-[11px] text-text-muted mt-0.5">
                  Calculated locally on your machine from head orientation, eye gaze, and facial stability relative to your initial baseline.
                </p>
              </div>
              <span className="text-[10px] font-mono text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full shrink-0">
                100% On-Device
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FourLevelIndicator
                type="attention"
                state={activeEngagementState}
                score={activeEngagementEvidence}
                confidence={activeConfidence}
                showExplanation={true}
              />

              <FourLevelIndicator
                type="confusion"
                state={activeConfusionState}
                score={activeConfusionEvidence}
                confidence={inferenceData?.confusion?.confidence ?? null}
                showExplanation={true}
              />
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-lg text-text-muted text-[11px] flex items-center justify-between gap-2">
              <span>
                <strong>Privacy Boundary:</strong> Raw webcam video never leaves your browser sandbox. Only derived aggregate integers representing engagement signals are transmitted to the instructor to help pace the lecture.
              </span>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN (4 of 12 cols): Self-View Camera & Classroom Chat */}
        <div className="lg:col-span-4 space-y-5">
          {/* Self-View Camera Card */}
          <div className="card-panel bg-panel-bg p-4 space-y-3 rounded-xl border border-neutral-border shadow-xs">
            <div className="flex justify-between items-center border-b border-neutral-border pb-2.5">
              <h3 className="text-xs font-bold text-brand-navy uppercase tracking-wider">Self-View Monitor</h3>
              {cameraStatus === 'active' ? (
                <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                  Camera Active
                </span>
              ) : (
                <span className="text-[10px] text-text-muted font-mono">Camera Off</span>
              )}
            </div>

            {/* Live Camera Preview Container */}
            <div className="bg-slate-900 border border-slate-800 rounded-lg aspect-video flex flex-col items-center justify-center text-center relative overflow-hidden shadow-inner">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover ${cameraStatus === 'active' ? 'block' : 'hidden'}`}
              />

              {cameraStatus === 'requesting' && (
                <div className="p-4 space-y-2 text-white">
                  <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
                  <p className="text-xs font-semibold">Starting camera...</p>
                  <p className="text-[10px] text-slate-400">Waiting for browser authorization</p>
                </div>
              )}

              {cameraStatus === 'idle' && (
                <div className="p-4 space-y-2.5 text-center text-slate-300">
                  <p className="text-xs font-medium">Camera access required for live analysis</p>
                  <Button variant="primary" onClick={startCamera} className="text-xs py-1.5 px-3">
                    Enable Camera
                  </Button>
                </div>
              )}

              {cameraStatus === 'error' && (
                <div className="p-4 space-y-2 text-center">
                  <p className="text-xs font-semibold text-rose-400">{cameraError || 'Camera unavailable'}</p>
                  <Button variant="secondary" onClick={startCamera} className="text-xs py-1 px-3">
                    Retry Permission
                  </Button>
                </div>
              )}
            </div>

            {/* Clean Status Badges for Camera & Baseline */}
            {cameraStatus === 'active' && (
              <div className="space-y-2 text-xs pt-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-text-muted">Face Detection:</span>
                  {isLandmarkerLoading ? (
                    <span className="text-amber-600 font-medium">Loading detector...</span>
                  ) : landmarkerError ? (
                    <span className="text-danger-600 font-medium">Detector error</span>
                  ) : faceDetected ? (
                    <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                      <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
                      Aligned
                    </span>
                  ) : (
                    <span className="text-neutral-500 font-medium">Searching for face...</span>
                  )}
                </div>

                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-text-muted">Personal Baseline:</span>
                  {baselineData?.ready ? (
                    <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                      <svg className="w-3 h-3 text-emerald-600" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      Calibrated
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-amber-700 font-medium">
                      <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-ping"></span>
                      Calibrating ({temporalData?.sampleCount ?? 0}/30)
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Real-time Classroom Chat */}
          <ClassroomChat
            sessionId={id}
            currentUser={user}
            isWsConnected={isWsConnected}
            connectionState={connectionState}
            retryCount={retryCount}
            lastMessage={lastMessage}
            onSendMessage={sendChatMessage}
          />
        </div>
      </div>

      {/* Developer Diagnostics Pathway (Hidden / Collapsible at bottom) */}
      <details className="text-[11px] text-text-muted border-t border-neutral-border pt-4">
        <summary className="cursor-pointer hover:text-brand-navy font-mono text-[10px] uppercase tracking-wider">
          &rsaquo; Engineering Diagnostics (Debug Pathway Only)
        </summary>
        <div className="mt-3 p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1 font-mono text-[10px]">
          <div className="flex justify-between">
            <span>EAR / Gaze (X, Y):</span>
            <span>{ear?.toFixed(3) ?? '--'} / {gazeX?.toFixed(2) ?? '--'}, {gazeY?.toFixed(2) ?? '--'}</span>
          </div>
          <div className="flex justify-between">
            <span>Head Pose (Y, P, R):</span>
            <span>{yaw?.toFixed(1) ?? '--'}&deg;, {pitch?.toFixed(1) ?? '--'}&deg;, {roll?.toFixed(1) ?? '--'}&deg;</span>
          </div>
          <div className="flex justify-between">
            <span>Temporal Window (5.0s):</span>
            <span>{temporalData?.sampleCount ?? 0} frames ({((temporalData?.windowSpanMs ?? 0) / 1000).toFixed(1)}s)</span>
          </div>
          <div className="flex justify-between">
            <span>Evidence Rating:</span>
            <span>{inferenceData?.quality?.rating || 'Limited'}</span>
          </div>
        </div>
      </details>
    </PageContainer>
  )
}
