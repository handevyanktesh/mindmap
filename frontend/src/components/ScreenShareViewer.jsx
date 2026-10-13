import React, { useRef, useEffect, useState } from 'react'
import Button from './Button'

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

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream
    }
  }, [stream])

  const toggleFullscreen = () => {
    if (!containerRef.current) return
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {})
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {})
    }
  }

  const hasActiveStream = Boolean(stream && (isSharing || isTeacherSharing))

  return (
    <div
      ref={containerRef}
      className={`card-panel p-0 overflow-hidden bg-neutral-900 border border-neutral-800 rounded-lg shadow-sm flex flex-col aspect-video relative ${className}`}
    >
      {/* Top Banner overlay */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between p-3 bg-gradient-to-b from-black/80 to-transparent text-white">
        <div className="flex items-center gap-2">
          {hasActiveStream ? (
            <>
              <span className="w-2.5 h-2.5 rounded-full bg-danger-500 animate-pulse"></span>
              <span className="text-xs font-semibold tracking-wide">
                {isSharing ? 'Sharing Your Screen' : `${teacherName}'s Shared Screen`}
              </span>
            </>
          ) : (
            <span className="text-xs text-neutral-400 font-medium">Classroom Presentation Screen</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {hasActiveStream && (
            <button
              onClick={toggleFullscreen}
              className="text-neutral-300 hover:text-white text-xs px-2 py-1 rounded bg-black/40 hover:bg-black/60 transition-colors"
              title="Toggle Fullscreen"
            >
              {isFullscreen ? 'Exit Fullscreen' : 'â›¶ Fullscreen'}
            </button>
          )}

          {isTeacher && isSharing && (
            <Button
              variant="secondary"
              onClick={onStopSharing}
              className="text-xs py-1 px-2.5 bg-danger-600 hover:bg-danger-700 text-white border-none shadow-xs"
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
          muted={isSharing} // Mute local preview to prevent feedback
          className="w-full h-full object-contain bg-black"
        />
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-neutral-400 space-y-3">
          {isTeacherSharing ? (
            <div className="space-y-2">
              <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
              <p className="text-xs font-semibold text-neutral-200">
                Connecting to {teacherName}'s screen share...
              </p>
            </div>
          ) : (
            <div className="space-y-3 max-w-sm">
              <div className="w-12 h-12 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center text-xl mx-auto text-neutral-300">
                ðŸ–¥ï¸
              </div>
              <div>
                <p className="text-xs font-semibold text-neutral-200">No screen broadcast currently active</p>
                <p className="text-[11px] text-neutral-400 mt-1">
                  {isTeacher
                    ? 'Share your entire screen, window, or tab with students in this session.'
                    : "The instructor's screen or presentation slides will appear here when sharing begins."}
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
            <p className="text-xs text-danger-400 font-medium bg-danger-950/40 border border-danger-800 px-3 py-1.5 rounded max-w-xs">
              {sharingError}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
