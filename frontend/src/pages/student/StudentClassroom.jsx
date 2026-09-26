import React, { useState, useEffect } from 'react'
import { useParams, Link, useLocation, useNavigate } from 'react-router-dom'
import PageContainer from '../../components/PageContainer'
import Button from '../../components/Button'
import StatusBadge from '../../components/StatusBadge'
import { useSessionWebSocket } from '../../hooks/useSessionWebSocket'
import { useCamera } from '../../hooks/useCamera'
import { useFaceLandmarker } from '../../hooks/useFaceLandmarker'

export default function StudentClassroom() {
  const { id } = useParams()
  const location = useLocation()
  const navigate = useNavigate()

  const [participation, setParticipation] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [leaving, setLeaving] = useState(false)

  const token = localStorage.getItem('token')
  const isJoined = participation !== null && participation.status === 'joined'

  // Real-time WebSocket connection
  const { isConnected: isWsConnected } = useSessionWebSocket(
    id,
    token,
    isJoined
  )

  // Browser webcam preview (100% local, no raw frames transmitted)
  const {
    videoRef,
    status: cameraStatus,
    error: cameraError,
    startCamera,
    stopCamera
  } = useCamera(isJoined)

  // MediaPipe Face Landmarker (runs strictly browser-locally on active camera)
  const {
    isLoading: isLandmarkerLoading,
    error: landmarkerError,
    faceDetected,
    ear,
    gazeX,
    gazeY
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
        const res = await fetch(`http://localhost:8000/api/sessions/${id}/join`, {
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
            const partRes = await fetch(`http://localhost:8000/api/sessions/${id}/participation`, {
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

  const handleLeaveSession = async () => {
    stopCamera()
    setLeaving(true)
    try {
      const token = localStorage.getItem('token')
      await fetch(`http://localhost:8000/api/sessions/${id}/leave`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      })
    } catch (err) {
      console.error('Error leaving session:', err)
    } finally {
      navigate('/student')
    }
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
          {isWsConnected && <StatusBadge status="info" label="Realtime Sync" />}
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

      {/* Main Classroom Workspace Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* Lecture Content Panel (Slides/Stream mock) */}
        <div className="lg:col-span-3 space-y-4">
          <div className="bg-panel-bg border border-neutral-border rounded-lg overflow-hidden shadow-sm">
            {/* Aspect Ratio slide mock container */}
            <div className="bg-brand-navy text-white flex flex-col justify-between p-8 aspect-video select-none">
              <div className="flex justify-between items-center text-xs font-mono text-neutral-400">
                <span>Lecture Slide #12 &mdash; Fundamental Theorem of Calculus</span>
                <span>MindMap Player</span>
              </div>
              
              <div className="text-center my-auto space-y-4">
                <h2 className="text-xl md:text-2xl font-bold font-sans">
                  {"f(x) = \u222B[a, b] f'(t) dt"}
                </h2>
                <p className="text-xs text-neutral-400 max-w-sm mx-auto font-sans leading-relaxed">
                  The derivative of an integral function yields the original continuous curve parameters. Pay close attention to bounds definition.
                </p>
              </div>
              
              <div className="flex justify-between items-center text-xs text-neutral-400 pt-4 border-t border-neutral-800">
                <span>Live Audio Stream: Connected</span>
                <span>Lecture Mode: Broadcast</span>
              </div>
            </div>

            {/* Slide Navigation Mock */}
            <div className="p-3 bg-neutral-light border-t border-neutral-border flex justify-between items-center text-xs text-text-muted">
              <span>Synchronized with Instructor's Presentation screen</span>
              <div className="flex gap-2">
                <button type="button" className="px-2.5 py-1 bg-panel-bg border border-neutral-border rounded disabled:opacity-50" disabled>&larr; Prev</button>
                <button type="button" className="px-2.5 py-1 bg-panel-bg border border-neutral-border rounded disabled:opacity-50" disabled>Next &rarr;</button>
              </div>
            </div>
          </div>
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
        </div>

      </div>
    </PageContainer>
  )
}
