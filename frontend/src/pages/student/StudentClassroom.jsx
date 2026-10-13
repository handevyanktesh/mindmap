import React, { useState, useEffect, useRef } from 'react'
import { useParams, Link, useLocation, useNavigate } from 'react-router-dom'
import PageContainer from '../../components/PageContainer'
import Button from '../../components/Button'
import StatusBadge from '../../components/StatusBadge'
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
    fusedData,
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
      <PageContainer size="small" className="py-12">
        <div className="card-panel space-y-4 text-center">
          <StatusBadge status="info" label="Session Concluded" />
          <h3 className="text-h3 text-brand-navy">Lecture Session Has Ended</h3>
          <p className="text-xs text-text-muted leading-relaxed">
            Your instructor has concluded this session. Camera access and local behavioral processing have been stopped.
          </p>
          <div className="pt-2">
            <Link to="/student">
              <Button variant="primary">Return to Student Portal</Button>
            </Link>
          </div>
        </div>
      </PageContainer>
    )
  }

  if (loading) {
    return (
      <PageContainer size="large" className="py-12 text-center">
        <p className="text-xs text-text-muted">Connecting and joining session...</p>
      </PageContainer>
    )
  }

  if (error) {
    return (
      <PageContainer size="small" className="py-12">
        <div className="card-panel space-y-4 text-center">
          <h3 className="text-h3 text-danger-600">Unable to Join Session</h3>
          <p className="text-xs text-text-muted">{error}</p>
          <div className="pt-2">
            <Link to="/student">
              <Button variant="primary">Return to Student Portal</Button>
            </Link>
          </div>
        </div>
      </PageContainer>
    )
  }

  return (
    <PageContainer size="large" className="py-6 space-y-6">
      {/* Classroom Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-panel-bg border border-neutral-border rounded p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <StatusBadge status="success" label="Active Participant" />
          {connectionState === 'connected' && <StatusBadge status="info" label="Realtime Sync" />}
          {connectionState === 'reconnecting' && <StatusBadge status="warning" label={`Reconnecting (${retryCount}/5)...`} />}
          {connectionState === 'failed' && <StatusBadge status="danger" label="Sync Offline" />}
          <div>
            <h2 className="font-bold text-brand-navy text-base">{courseTitle}</h2>
            <p className="text-[10px] text-text-muted">
              Live Session &bull; Joined at {participation?.joined_at ? new Date(participation.joined_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Now'}
            </p>
          </div>
        </div>
        <Button
          variant="secondary"
          onClick={handleLeaveSession}
          disabled={leaving}
          className="text-xs py-1.5 px-3 border-danger-200 text-danger-600 hover:bg-danger-50"
        >
          {leaving ? 'Leaving...' : 'Exit Room'}
        </Button>
      </div>

      {/* Classroom Voice Controls */}
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

      {/* Main Classroom Workspace Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">

        {/* Lecture Content Panel (Screenshare / Presentation View) */}
        <div className="lg:col-span-3 space-y-4">
          <ScreenShareViewer
            stream={screen.screenStream}
            isSharing={false}
            isTeacherSharing={screen.isTeacherSharing}
            teacherName={screen.teacherSharingName}
            isTeacher={false}
            sharingError={screen.sharingError}
            disabled={!isWsConnected}
          />
        </div>

        {/* Local Diagnostics & Metrics sidebar */}
        <div className="space-y-6">
          {/* Self view camera wrapper */}
          <div className="card-panel bg-panel-bg space-y-4">
            <div className="flex justify-between items-center border-b border-neutral-border pb-2">
              <h3 className="text-h3 text-xs uppercase tracking-wider text-text-muted">Self-View Monitor</h3>
              {cameraStatus === 'active' && (
                <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-emerald-600">
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                  Camera Active
                </span>
              )}
            </div>

            {/* Live camera preview container */}
            <div className="bg-neutral-light border border-neutral-border rounded aspect-video flex flex-col items-center justify-center text-center relative overflow-hidden">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover ${cameraStatus === 'active' ? 'block' : 'hidden'}`}
              />

              {cameraStatus === 'requesting' && (
                <div className="p-4 space-y-1">
                  <p className="text-xs font-semibold text-brand-navy">Starting camera...</p>
                  <p className="text-[10px] text-text-muted">Waiting for browser permission</p>
                </div>
              )}

              {cameraStatus === 'idle' && (
                <div className="p-4 space-y-2">
                  <p className="text-xs text-text-muted">Camera access required</p>
                  <Button variant="secondary" onClick={startCamera} className="text-xs py-1 px-3">
                    Enable Camera
                  </Button>
                </div>
              )}

              {cameraStatus === 'error' && (
                <div className="p-4 space-y-2 text-center">
                  <p className="text-xs font-semibold text-danger-600">{cameraError || 'Camera unavailable'}</p>
                  <Button variant="secondary" onClick={startCamera} className="text-xs py-1 px-3">
                    Retry Permission
                  </Button>
                </div>
              )}
            </div>

            {/* Face Landmarker Pipeline Status Indicator */}
            {cameraStatus === 'active' && (
              <div className="space-y-1.5 text-[11px] px-2.5 py-2 bg-neutral-light rounded border border-neutral-border">
                <div className="flex items-center justify-between">
                  <span className="text-text-muted">Face Landmarks:</span>
                  {isLandmarkerLoading ? (
                    <span className="text-amber-600 font-medium">Model loading...</span>
                  ) : landmarkerError ? (
                    <span className="text-danger-600 font-medium">Model error</span>
                  ) : faceDetected ? (
                    <span className="inline-flex items-center gap-1 font-semibold text-emerald-600">
                      <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
                      Face detected
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 font-medium text-neutral-500">
                      <span className="w-1.5 h-1.5 bg-neutral-400 rounded-full"></span>
                      No face detected
                    </span>
                  )}
                </div>

                {faceDetected && (
                  <>
                    <div className="flex items-center justify-between pt-1 border-t border-neutral-border/60 text-[10px] text-text-muted">
                      <span>Local EAR (Eye Aspect Ratio):</span>
                      <span className="font-mono font-semibold text-brand-navy">
                        {ear !== null && typeof ear === 'number' ? ear.toFixed(3) : '--'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-text-muted">
                      <span>Local Gaze (X / Y):</span>
                      <span className="font-mono font-semibold text-brand-navy">
                        {gazeX !== null && typeof gazeX === 'number' ? gazeX.toFixed(2) : '--'}
                        {' / '}
                        {gazeY !== null && typeof gazeY === 'number' ? gazeY.toFixed(2) : '--'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-text-muted">
                      <span>Local Head Pose (Y / P / R):</span>
                      <span className="font-mono font-semibold text-brand-navy">
                        {yaw !== null && typeof yaw === 'number' ? `${yaw > 0 ? '+' : ''}${yaw}Â°` : '--'}
                        {' / '}
                        {pitch !== null && typeof pitch === 'number' ? `${pitch > 0 ? '+' : ''}${pitch}Â°` : '--'}
                        {' / '}
                        {roll !== null && typeof roll === 'number' ? `${roll > 0 ? '+' : ''}${roll}Â°` : '--'}
                      </span>
                    </div>

                    {/* Windowed Temporal Analysis (5.0s rolling window) */}
                    <div className="pt-2 border-t border-neutral-border/60 space-y-1">
                      <div className="flex items-center justify-between text-[10px] font-semibold text-text-muted">
                        <span>Temporal Window (5.0s):</span>
                        <span className="font-mono text-brand-navy">
                          {temporalData?.sampleCount ?? 0} frames ({((temporalData?.windowSpanMs ?? 0) / 1000).toFixed(1)}s)
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[10px] text-text-muted">
                        <span>EAR Mean &plusmn; Std:</span>
                        <span className="font-mono font-medium text-brand-navy">
                          {temporalData?.ear?.mean !== null && typeof temporalData?.ear?.mean === 'number'
                            ? `${temporalData.ear.mean.toFixed(3)} \u00B1 ${temporalData.ear.std?.toFixed(3) ?? '0.000'}`
                            : '--'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[10px] text-text-muted">
                        <span>Gaze Mean (X / Y):</span>
                        <span className="font-mono font-medium text-brand-navy">
                          {temporalData?.gaze?.meanX !== null && typeof temporalData?.gaze?.meanX === 'number'
                            ? `${temporalData.gaze.meanX.toFixed(2)} / ${temporalData.gaze.meanY?.toFixed(2)}`
                            : '--'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[10px] text-text-muted">
                        <span>Head Pose Mean (Y/P/R):</span>
                        <span className="font-mono font-medium text-brand-navy">
                          {temporalData?.headPose?.meanYaw !== null && typeof temporalData?.headPose?.meanYaw === 'number'
                            ? `${temporalData.headPose.meanYaw > 0 ? '+' : ''}${temporalData.headPose.meanYaw.toFixed(1)}Â° / ${temporalData.headPose.meanPitch > 0 ? '+' : ''}${temporalData.headPose.meanPitch.toFixed(1)}Â° / ${temporalData.headPose.meanRoll > 0 ? '+' : ''}${temporalData.headPose.meanRoll.toFixed(1)}Â°`
                            : '--'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[10px] text-text-muted">
                        <span>Displacement (Gaze / Pose):</span>
                        <span className="font-mono font-medium text-brand-navy">
                          {temporalData?.gaze?.displacement !== null && typeof temporalData?.gaze?.displacement === 'number'
                            ? temporalData.gaze.displacement.toFixed(2)
                            : '--'}
                          {' / '}
                          {temporalData?.headPose?.angularDisplacement !== null && typeof temporalData?.headPose?.angularDisplacement === 'number'
                            ? `${temporalData.headPose.angularDisplacement.toFixed(1)}Â°`
                            : '--'}
                        </span>
                      </div>
                    </div>

                    {/* Multimodal Signal Fusion (Quality-Gated Bounded Representation) */}
                    <div className="pt-2 border-t border-neutral-border/60 space-y-1">
                      <div className="flex items-center justify-between text-[10px] font-semibold text-text-muted">
                        <span>Multimodal Signal:</span>
                        <span className="font-mono text-brand-navy">
                          {fusedData?.valid ? (
                            <span className="text-emerald-600 font-semibold">Valid</span>
                          ) : (
                            <span className="text-neutral-500">Unavailable</span>
                          )}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[10px] text-text-muted">
                        <span>Modality Coverage:</span>
                        <span className="font-mono font-medium text-brand-navy">
                          {fusedData?.modalityCoverage?.availableCount ?? 0} / {fusedData?.modalityCoverage?.totalCount ?? 3}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[10px] text-text-muted">
                        <span>Fusion Output:</span>
                        <span className="font-mono font-semibold text-brand-navy">
                          {fusedData?.fusedSignal !== null && typeof fusedData?.fusedSignal === 'number'
                            ? fusedData.fusedSignal.toFixed(3)
                            : '--'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[10px] text-text-muted">
                        <span>Contributions (E / G / P):</span>
                        <span className="font-mono font-medium text-brand-navy">
                          {fusedData?.contributions?.ear !== null && typeof fusedData?.contributions?.ear === 'number'
                            ? fusedData.contributions.ear.toFixed(2)
                            : '--'}
                          {' / '}
                          {fusedData?.contributions?.gaze !== null && typeof fusedData?.contributions?.gaze === 'number'
                            ? fusedData.contributions.gaze.toFixed(2)
                            : '--'}
                          {' / '}
                          {fusedData?.contributions?.headPose !== null && typeof fusedData?.contributions?.headPose === 'number'
                            ? fusedData.contributions.headPose.toFixed(2)
                            : '--'}
                        </span>
                      </div>
                    </div>

                    {/* Personal Behavioural Baseline (Quality-Gated Reference) */}
                    <div className="pt-2 border-t border-neutral-border/60 space-y-1">
                      <div className="flex items-center justify-between text-[10px] font-semibold text-text-muted">
                        <span>Personal Baseline:</span>
                        <span className="font-mono text-brand-navy">
                          {baselineData?.ready ? (
                            <span className="text-emerald-600 font-semibold">Ready</span>
                          ) : (
                            <span className="text-amber-600 font-medium">
                              Calibrating ({baselineData?.warmupProgress?.current ?? 0}/{baselineData?.warmupProgress?.target ?? 30})
                            </span>
                          )}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[10px] text-text-muted">
                        <span>Baseline Ref (E / G / P):</span>
                        <span className="font-mono font-medium text-brand-navy">
                          {baselineData?.baseline?.ear?.value !== null && typeof baselineData?.baseline?.ear?.value === 'number'
                            ? baselineData.baseline.ear.value.toFixed(2)
                            : '--'}
                          {' / '}
                          {baselineData?.baseline?.gaze?.x !== null && typeof baselineData?.baseline?.gaze?.x === 'number'
                            ? `${baselineData.baseline.gaze.x.toFixed(2)},${baselineData.baseline.gaze.y.toFixed(2)}`
                            : '--'}
                          {' / '}
                          {baselineData?.baseline?.headPose?.yaw !== null && typeof baselineData?.baseline?.headPose?.yaw === 'number'
                            ? `${baselineData.baseline.headPose.yaw.toFixed(0)}Â°`
                            : '--'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[10px] text-text-muted">
                        <span>Behavioural Deviation:</span>
                        <span className="font-mono font-semibold text-brand-navy">
                          {baselineData?.ready ? (
                            <>
                              EAR: {baselineData?.deviation?.ear !== null && typeof baselineData?.deviation?.ear === 'number' ? baselineData.deviation.ear.toFixed(3) : '--'}
                              {' | '}
                              Gaze: {baselineData?.deviation?.gaze !== null && typeof baselineData?.deviation?.gaze === 'number' ? baselineData.deviation.gaze.toFixed(2) : '--'}
                              {' | '}
                              Pose: {baselineData?.deviation?.headPose !== null && typeof baselineData?.deviation?.headPose === 'number' ? `${baselineData.deviation.headPose.toFixed(1)}Â°` : '--'}
                            </>
                          ) : (
                            <span className="text-text-muted font-normal">Pending calibration</span>
                          )}
                        </span>
                      </div>
                    </div>

                    {/* Behavioural Assessment (Interpretable Inference) */}
                    <div className="pt-2 border-t border-neutral-border/60 space-y-1">
                      <div className="flex items-center justify-between text-[10px] font-semibold text-text-muted">
                        <span>Behavioural Assessment:</span>
                        <span className="font-mono text-brand-navy text-[10px]">
                          {inferenceData?.quality?.rating || 'Limited'} Evidence
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[10px] text-text-muted">
                        <span>Engagement-related:</span>
                        <span className="font-mono font-semibold text-brand-navy">
                          {inferenceData?.engagement?.state === 'NORMAL_BEHAVIOUR' && (
                            <span className="text-emerald-600">Normal behaviour</span>
                          )}
                          {inferenceData?.engagement?.state === 'REDUCED_ENGAGEMENT_LIKE' && (
                            <span className="text-amber-600">Reduced-engagement-like</span>
                          )}
                          {inferenceData?.engagement?.state === 'UNCERTAIN' && (
                            <span className="text-neutral-500">Uncertain</span>
                          )}
                          {inferenceData?.engagement?.confidence !== null && typeof inferenceData?.engagement?.confidence === 'number' ? (
                            <span className="text-[9px] font-normal text-text-muted ml-1">
                              (conf: {inferenceData.engagement.confidence.toFixed(2)})
                            </span>
                          ) : null}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[10px] text-text-muted">
                        <span>Confusion-related signal:</span>
                        <span className="font-mono font-semibold text-brand-navy">
                          {inferenceData?.confusion?.state === 'LOW' && (
                            <span className="text-brand-navy">Low</span>
                          )}
                          {inferenceData?.confusion?.state === 'ELEVATED' && (
                            <span className="text-amber-600">Elevated</span>
                          )}
                          {inferenceData?.confusion?.state === 'UNCERTAIN' && (
                            <span className="text-neutral-500">Uncertain</span>
                          )}
                          {inferenceData?.confusion?.confidence !== null && typeof inferenceData?.confusion?.confidence === 'number' ? (
                            <span className="text-[9px] font-normal text-text-muted ml-1">
                              (conf: {inferenceData.confusion.confidence.toFixed(2)})
                            </span>
                          ) : null}
                        </span>
                      </div>

                      <p className="text-[8.5px] text-text-muted/80 pt-0.5 leading-tight italic">
                        Observable facial behavioural signals only; not a direct measure of internal mental state.
                      </p>
                    </div>
                  </>
                )}
              </div>
            )}

            <p className="text-[9px] text-text-muted text-center font-sans">
              Webcam stream is processed 100% locally. Raw video is never transmitted.
            </p>
          </div>

          {/* Behavioural coefficients */}
          <div className="card-panel bg-panel-bg space-y-4">
            <h3 className="text-h3 text-xs uppercase tracking-wider text-text-muted">Your Local Metrics</h3>

            <div className="space-y-3 font-sans text-xs">
              <div>
                <div className="flex justify-between mb-1 font-semibold text-text-navy">
                  <span>Engagement Estimate</span>
                  <span>92%</span>
                </div>
                <div className="w-full bg-neutral-light border border-neutral-border rounded-full h-2">
                  <div className="bg-primary-600 h-full rounded-full" style={{ width: '92%' }}></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between mb-1 font-semibold text-text-navy">
                  <span>Confusion-related Signal</span>
                  <span>5%</span>
                </div>
                <div className="w-full bg-neutral-light border border-neutral-border rounded-full h-2">
                  <div className="bg-emerald-500 h-full rounded-full" style={{ width: '5%' }}></div>
                </div>
              </div>
            </div>

            <div className="border-t border-neutral-border pt-3 text-[9px] text-text-muted leading-relaxed">
              * Local values represent temporary measurements based on simulated behavioural signals. Only derived numerical values are pushed.
            </div>
          </div>

          {/* Live Classroom Chat */}
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
    </PageContainer>
  )
}
