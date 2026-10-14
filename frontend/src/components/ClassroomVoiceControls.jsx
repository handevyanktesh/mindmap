import React from 'react'
import Button from './Button'

function MicIcon({ className = 'w-3.5 h-3.5' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="22" />
      <line x1="8" y1="22" x2="16" y2="22" />
    </svg>
  )
}

function MicOffIcon({ className = 'w-3.5 h-3.5' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="2" y1="2" x2="22" y2="22" />
      <path d="M18.89 13.23A7.12 7.12 0 0 0 19 12v-2" />
      <path d="M5 10v2a7 7 0 0 0 12 5" />
      <path d="M15 9.34V5a3 3 0 0 0-5.68-1.33" />
      <path d="M9 9v3a3 3 0 0 0 5.12 2.12" />
      <line x1="12" y1="19" x2="12" y2="22" />
      <line x1="8" y1="22" x2="16" y2="22" />
    </svg>
  )
}

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
            <MicIcon className="w-3.5 h-3.5 text-brand-navy" />
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
              {isMuted ? <MicOffIcon className="w-3.5 h-3.5" /> : <MicIcon className="w-3.5 h-3.5" />}
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
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-neutral-light border border-neutral-border/60 text-[11px] font-mono">
            <span
              className={`w-2 h-2 rounded-full transition-colors ${
                !isMuted && isSpeaking
                  ? 'bg-emerald-500 animate-pulse ring-2 ring-emerald-300'
                  : !isMuted
                    ? 'bg-emerald-500'
                    : 'bg-neutral-400'
              }`}
            />
            <span className="text-text-muted font-sans font-medium">
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
              className={`inline-flex items-center gap-1.5 text-[11px] px-2.5 py-0.5 rounded-full border shrink-0 transition-colors ${
                !peer.is_muted && peer.is_speaking
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300 font-semibold shadow-xs'
                  : 'bg-neutral-light text-text-muted border-neutral-border'
              }`}
            >
              {peer.is_muted ? (
                <MicOffIcon className="w-3 h-3 text-neutral-400" />
              ) : (
                <MicIcon className={`w-3 h-3 ${peer.is_speaking ? 'text-emerald-600' : 'text-neutral-500'}`} />
              )}
              <span>{peer.user_name || 'Participant'}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
