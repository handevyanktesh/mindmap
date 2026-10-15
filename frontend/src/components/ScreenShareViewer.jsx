import React, { useRef, useEffect, useState } from 'react'
import Button from './Button'

function MonitorIcon({ className = 'w-6 h-6' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  )
}

function MaximizeIcon({ className = 'w-3.5 h-3.5' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
    </svg>
  )
}

function MinimizeIcon({ className = 'w-3.5 h-3.5' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 14h6v6m10-10h-6V4m0 6 7-7M3 21l7-7" />
    </svg>
  )
}

export default function ScreenShareViewer({
  stream,
  isSharing = false,
  isTeacherSharing = false,
  teacherName = 'Instructor',
  isTeacher = false,
  onStartSharing,
  onStopSharing,
  sharingError = '',
  disabled = false,
  className = ''
}) {
  const videoRef = useRef(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const containerRef = useRef(null)

  const hasActiveStream = Boolean(stream && (isSharing || isTeacherSharing))

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream
      videoRef.current.play?.().catch((err) => {
        console.warn('Screen share video playback warning:', err)
      })
    }
  }, [stream, hasActiveStream])

  const toggleFullscreen = () => {
    if (!containerRef.current) return
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {})
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {})
    }
  }

  return (
    <div
      ref={containerRef}
      className={`card-panel p-0 overflow-hidden bg-slate-950 border border-slate-800 rounded-xl shadow-md flex flex-col aspect-video relative ${className}`}
    >
      {/* Top Banner overlay */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between p-3.5 bg-gradient-to-b from-black/85 via-black/40 to-transparent text-white">
        <div className="flex items-center gap-2">
          {hasActiveStream ? (
            <>
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse ring-4 ring-rose-500/20"></span>
              <span className="text-xs font-semibold tracking-wide">
                {isSharing ? 'Sharing Your Screen' : `${teacherName}'s Shared Screen`}
              </span>
            </>
          ) : (
            <span className="text-xs text-slate-300 font-medium flex items-center gap-1.5">
              <MonitorIcon className="w-4 h-4 text-slate-400" />
              Classroom Presentation Screen
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {hasActiveStream && (
            <button
              onClick={toggleFullscreen}
              className="text-slate-300 hover:text-white text-xs px-2.5 py-1.5 rounded-md bg-black/50 hover:bg-black/75 backdrop-blur-sm transition-colors flex items-center gap-1.5 border border-white/10"
              title="Toggle Fullscreen"
            >
              {isFullscreen ? (
                <>
                  <MinimizeIcon className="w-3.5 h-3.5" />
                  <span>Exit Fullscreen</span>
                </>
              ) : (
                <>
                  <MaximizeIcon className="w-3.5 h-3.5" />
                  <span>Fullscreen</span>
                </>
              )}
            </button>
          )}

          {isTeacher && isSharing && (
            <Button
              variant="danger"
              size="sm"
              onClick={onStopSharing}
              className="text-xs py-1 px-3 shadow-xs"
            >
              Stop Sharing
            </Button>
          )}
        </div>
      </div>

      {/* Main Video or Fallback View */}
      {hasActiveStream ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={true} // Screen share has no audio; muted ensures unblocked autoplay across all browsers
          className="w-full h-full object-contain bg-black"
        />
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-slate-400 space-y-3">
          {isTeacherSharing ? (
            <div className="space-y-3">
              <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
              <p className="text-xs font-semibold text-slate-200">
                Connecting to {teacherName}'s screen share...
              </p>
            </div>
          ) : (
            <div className="space-y-3.5 max-w-sm">
              <div className="w-14 h-14 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto text-slate-400 shadow-inner">
                <MonitorIcon className="w-7 h-7 text-indigo-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-100">No screen broadcast currently active</p>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  {isTeacher
                    ? 'Share your entire screen, window, or browser tab with students in this session.'
                    : "The instructor's screen or presentation slides will appear here when broadcast begins."}
                </p>
              </div>

              {isTeacher && (
                <Button
                  variant="primary"
                  onClick={onStartSharing}
                  disabled={disabled}
                  className="text-xs py-2 px-4 shadow-sm"
                >
                  Share Screen
                </Button>
              )}
            </div>
          )}

          {sharingError && (
            <p className="text-xs text-rose-300 font-medium bg-rose-950/60 border border-rose-800 px-3 py-1.5 rounded-md max-w-xs">
              {sharingError}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
