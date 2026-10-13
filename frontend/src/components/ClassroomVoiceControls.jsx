import React from 'react'
import Button from './Button'

export default function ClassroomVoiceControls({
  isVoiceJoined,
  isMuted,
  isSpeaking,
  voiceStatus,
  voiceError,
  remotePeers = {},
  onJoinVoice,
  onLeaveVoice,
  onToggleMute,
  disabled = false,
  className = ''
}) {
  const peerList = Object.entries(remotePeers)

  return (
    <div className={`flex flex-wrap items-center gap-2.5 p-2.5 rounded-lg border border-neutral-border bg-panel-bg shadow-xs ${className}`}>
      {/* Voice Status & Controls */}
      <div className="flex items-center gap-2">
        {!isVoiceJoined ? (
          <Button
            variant="secondary"
            onClick={onJoinVoice}
            disabled={disabled || voiceStatus === 'requesting'}
            className="text-xs py-1.5 px-3 flex items-center gap-1.5 font-medium"
          >
            <span className="text-sm">ðŸŽ™ï¸</span>
            {voiceStatus === 'requesting' ? 'Connecting Mic...' : 'Join Classroom Voice'}
          </Button>
        ) : (
          <div className="flex items-center gap-1.5">
            <Button
              variant={isMuted ? 'secondary' : 'primary'}
              onClick={onToggleMute}
              disabled={disabled}
              className={`text-xs py-1.5 px-3 flex items-center gap-1.5 font-medium transition-colors ${
                !isMuted && isSpeaking ? 'ring-2 ring-emerald-500 animate-pulse' : ''
              }`}
            >
              <span>{isMuted ? 'ðŸ”‡' : 'ðŸŽ™ï¸'}</span>
              <span>{isMuted ? 'Unmute' : 'Mute'}</span>
            </Button>

            <Button
              variant="secondary"
              onClick={onLeaveVoice}
              disabled={disabled}
              className="text-xs py-1.5 px-2.5 text-danger-600 hover:text-danger-700 hover:bg-danger-50 border-danger-200"
              title="Leave Voice Channel"
            >
              Leave Voice
            </Button>
          </div>
        )}

        {/* Live Audio Indicator */}
        {isVoiceJoined && (
          <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-neutral-light border border-neutral-border/60 text-[11px] font-mono">
            <span
              className={`w-2 h-2 rounded-full ${
                !isMuted && isSpeaking
                  ? 'bg-emerald-500 animate-pulse'
                  : !isMuted
                    ? 'bg-emerald-400'
                    : 'bg-neutral-400'
              }`}
            />
            <span className="text-text-muted">
              {!isMuted && isSpeaking ? 'Speaking' : isMuted ? 'Muted' : 'Mic Active'}
            </span>
          </div>
        )}
      </div>

      {/* Voice Error notice */}
      {voiceError && (
        <span className="text-[11px] text-danger-600 font-medium px-2 py-0.5 rounded bg-danger-50 border border-danger-200">
          {voiceError}
        </span>
      )}

      {/* Peer Voice Presence List */}
      {peerList.length > 0 && (
        <div className="flex items-center gap-1.5 border-l border-neutral-border pl-2.5 overflow-x-auto text-xs">
          <span className="text-[10px] text-text-muted uppercase font-bold tracking-wider shrink-0">
            In Voice ({peerList.length}):
          </span>
          {peerList.map(([peerId, peer]) => (
            <span
              key={peerId}
              className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border shrink-0 transition-colors ${
                !peer.is_muted && peer.is_speaking
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300 font-semibold shadow-xs animate-pulse'
                  : 'bg-neutral-light text-text-muted border-neutral-border'
              }`}
            >
              <span>{peer.is_muted ? 'ðŸ”‡' : 'ðŸŽ™ï¸'}</span>
              <span>{peer.user_name || 'Participant'}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
