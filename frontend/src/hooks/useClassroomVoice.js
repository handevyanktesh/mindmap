import { useState, useEffect, useRef, useCallback } from 'react'
import { getIceServers } from '../features/webrtc/webrtcConfig'

/**
 * Hook for managing peer-to-peer classroom voice communication.
 * Provides microphone permission handling, mute controls, local voice-activity detection,
 * and automated WebRTC mesh signaling for small classroom cohorts.
 */
export function useClassroomVoice({
  sessionId,
  currentUser,
  isWsConnected,
  lastMessage,
  sendSignal,
  sendVoiceJoin,
  sendVoiceLeave,
  sendVoiceStatus
}) {
  const [isVoiceJoined, setIsVoiceJoined] = useState(false)
  const [isMuted, setIsMuted] = useState(true)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [voiceStatus, setVoiceStatus] = useState('idle') // 'idle' | 'requesting' | 'connected' | 'error'
  const [voiceError, setVoiceError] = useState('')
  const [remotePeers, setRemotePeers] = useState({}) // { [user_id]: { user_name, role, is_muted, is_speaking } }

  const localStreamRef = useRef(null)
  const peerConnectionsRef = useRef(new Map()) // target_id -> RTCPeerConnection
  const audioElementsRef = useRef(new Map()) // target_id -> HTMLAudioElement
  const audioContextRef = useRef(null)
  const analyserRef = useRef(null)
  const speechIntervalRef = useRef(null)
  const pendingIceCandidatesRef = useRef(new Map()) // target_id -> array of RTCIceCandidateInit

  // Clean up all resources
  const teardownAll = useCallback(() => {
    // 1. Stop local audio tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop())
      localStreamRef.current = null
    }

    // 2. Close peer connections
    peerConnectionsRef.current.forEach((pc) => {
      try {
        pc.close()
      } catch {}
    })
    peerConnectionsRef.current.clear()

    // 3. Clean up audio elements
    audioElementsRef.current.forEach((audio) => {
      try {
        audio.pause()
        audio.srcObject = null
      } catch {}
    })
    audioElementsRef.current.clear()

    // 4. Audio analysis cleanup
    if (speechIntervalRef.current) {
      clearInterval(speechIntervalRef.current)
      speechIntervalRef.current = null
    }
    if (audioContextRef.current) {
      try {
        audioContextRef.current.close()
      } catch {}
      audioContextRef.current = null
    }
    analyserRef.current = null

    pendingIceCandidatesRef.current.clear()
    setIsVoiceJoined(false)
    setIsSpeaking(false)
    setVoiceStatus('idle')
    setRemotePeers({})
  }, [])

  // Create an RTCPeerConnection for voice
  const createPeerConnection = useCallback((targetId) => {
    if (typeof RTCPeerConnection === 'undefined') return null

    const pc = new RTCPeerConnection({ iceServers: getIceServers() })

    // Add local tracks if available
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current)
      })
    }

    pc.onicecandidate = (event) => {
      if (event.candidate && sendSignal) {
        sendSignal(targetId, {
          type: 'candidate',
          candidate: event.candidate,
          media: 'voice'
        })
      }
    }

    pc.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        let audio = audioElementsRef.current.get(targetId)
        if (!audio) {
          audio = new Audio()
          audio.autoplay = true
          audioElementsRef.current.set(targetId, audio)
        }
        audio.srcObject = event.streams[0]
        audio.play().catch(() => {
          // Autoplay policy fallback
        })
      }
    }

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        const audio = audioElementsRef.current.get(targetId)
        if (audio) {
          audio.pause()
          audio.srcObject = null
          audioElementsRef.current.delete(targetId)
        }
        setRemotePeers((prev) => {
          if (!prev[targetId]) return prev
          const next = { ...prev }
          delete next[targetId]
          return next
        })
      }
    }

    peerConnectionsRef.current.set(targetId, pc)
    return pc
  }, [sendSignal])

  // Join the classroom voice channel
  const joinVoice = useCallback(async () => {
    if (!isWsConnected) {
      setVoiceError('Cannot join voice: Classroom is disconnected.')
      return
    }

    setVoiceStatus('requesting')
    setVoiceError('')

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Your browser does not support microphone audio capture.')
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        },
        video: false
      })

      // Default to muted
      stream.getAudioTracks().forEach((t) => {
        t.enabled = false
      })
      localStreamRef.current = stream
      setIsMuted(true)

      // Initialize local speech detection analyser
      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext
        if (AudioCtx) {
          const ctx = new AudioCtx()
          audioContextRef.current = ctx
          const source = ctx.createMediaStreamSource(stream)
          const analyser = ctx.createAnalyser()
          analyser.fftSize = 256
          source.connect(analyser)
          analyserRef.current = analyser

          const dataArray = new Uint8Array(analyser.frequencyBinCount)
          speechIntervalRef.current = setInterval(() => {
            if (!analyserRef.current || !localStreamRef.current) return
            analyserRef.current.getByteFrequencyData(dataArray)
            let sum = 0
            for (let i = 0; i < dataArray.length; i++) {
              sum += dataArray[i]
            }
            const avg = sum / dataArray.length
            const isAudible = avg > 25
            setIsSpeaking(isAudible)
          }, 200)
        }
      } catch (_) {
        // Speech analysis optional
      }

      setIsVoiceJoined(true)
      setVoiceStatus('connected')

      if (sendVoiceJoin) sendVoiceJoin()
      if (sendVoiceStatus) sendVoiceStatus(true, false)
    } catch (err) {
      console.error('Microphone error:', err)
      setVoiceStatus('error')
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setVoiceError('Microphone permission was denied. Please allow microphone access.')
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setVoiceError('No microphone hardware detected on this device.')
      } else {
        setVoiceError(err.message || 'Unable to access microphone.')
      }
    }
  }, [isWsConnected, sendVoiceJoin, sendVoiceStatus])

  // Leave the voice channel
  const leaveVoice = useCallback(() => {
    teardownAll()
    if (sendVoiceLeave) sendVoiceLeave()
  }, [teardownAll, sendVoiceLeave])

  // Toggle local mute
  const toggleMute = useCallback(() => {
    if (!localStreamRef.current) return
    const nextMuted = !isMuted
    localStreamRef.current.getAudioTracks().forEach((track) => {
      track.enabled = !nextMuted
    })
    setIsMuted(nextMuted)
    if (nextMuted) setIsSpeaking(false)
    if (sendVoiceStatus) sendVoiceStatus(nextMuted, false)
  }, [isMuted, sendVoiceStatus])

  // Handle incoming signaling messages and presence
  useEffect(() => {
    if (!lastMessage) return

    const handleMessage = async () => {
      const { type, data, sender_id, signal } = lastMessage

      // 1. Peer joined voice: create offer if we are in voice
      if (type === 'voice_peer_joined' && data && isVoiceJoined) {
        const peerId = data.user_id
        if (peerId !== currentUser?.id) {
          setRemotePeers((prev) => ({
            ...prev,
            [peerId]: {
              user_name: data.user_name || 'Participant',
              role: data.role || 'student',
              is_muted: true,
              is_speaking: false
            }
          }))

          const pc = createPeerConnection(peerId)
          if (pc) {
            try {
              const offer = await pc.createOffer()
              await pc.setLocalDescription(offer)
              if (sendSignal) {
                sendSignal(peerId, {
                  type: 'offer',
                  sdp: offer.sdp,
                  media: 'voice'
                })
              }
            } catch (err) {
              console.error('Failed to create voice offer:', err)
            }
          }
        }
      }

      // 2. Peer left voice
      if (type === 'voice_peer_left' && data) {
        const peerId = data.user_id
        setRemotePeers((prev) => {
          const next = { ...prev }
          delete next[peerId]
          return next
        })
        const pc = peerConnectionsRef.current.get(peerId)
        if (pc) {
          try {
            pc.close()
          } catch {}
          peerConnectionsRef.current.delete(peerId)
        }
        const audio = audioElementsRef.current.get(peerId)
        if (audio) {
          try {
            audio.pause()
            audio.srcObject = null
          } catch {}
          audioElementsRef.current.delete(peerId)
        }
      }

      // 3. Voice status update (mute / speaking)
      if (type === 'voice_status' && data) {
        const peerId = data.user_id
        setRemotePeers((prev) => ({
          ...prev,
          [peerId]: {
            ...(prev[peerId] || {}),
            user_name: data.user_name || prev[peerId]?.user_name || 'Participant',
            role: data.role || prev[peerId]?.role || 'student',
            is_muted: data.is_muted,
            is_speaking: data.is_speaking
          }
        }))
      }

      // 4. WebRTC signaling relay for voice
      if (type === 'webrtc_signal' && signal && signal.media === 'voice') {
        const peerId = sender_id
        if (!peerId || peerId === currentUser?.id) return

        let pc = peerConnectionsRef.current.get(peerId)
        if (!pc) {
          pc = createPeerConnection(peerId)
        }
        if (!pc) return

        if (signal.type === 'offer') {
          try {
            await pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: signal.sdp }))
            // Process any queued candidates
            const queued = pendingIceCandidatesRef.current.get(peerId) || []
            for (const cand of queued) {
              await pc.addIceCandidate(new RTCIceCandidate(cand))
            }
            pendingIceCandidatesRef.current.delete(peerId)

            const answer = await pc.createAnswer()
            await pc.setLocalDescription(answer)
            if (sendSignal) {
              sendSignal(peerId, {
                type: 'answer',
                sdp: answer.sdp,
                media: 'voice'
              })
            }
          } catch (err) {
            console.error('Error handling voice offer:', err)
          }
        } else if (signal.type === 'answer') {
          try {
            await pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: signal.sdp }))
            const queued = pendingIceCandidatesRef.current.get(peerId) || []
            for (const cand of queued) {
              await pc.addIceCandidate(new RTCIceCandidate(cand))
            }
            pendingIceCandidatesRef.current.delete(peerId)
          } catch (err) {
            console.error('Error handling voice answer:', err)
          }
        } else if (signal.type === 'candidate' && signal.candidate) {
          try {
            if (pc.remoteDescription) {
              await pc.addIceCandidate(new RTCIceCandidate(signal.candidate))
            } else {
              const list = pendingIceCandidatesRef.current.get(peerId) || []
              list.push(signal.candidate)
              pendingIceCandidatesRef.current.set(peerId, list)
            }
          } catch (err) {
            console.error('Error adding voice ICE candidate:', err)
          }
        }
      }

      // 5. Session termination event
      if (type === 'session_ended') {
        teardownAll()
      }
    }

    handleMessage()
  }, [lastMessage, isVoiceJoined, currentUser, createPeerConnection, sendSignal, teardownAll])

  // Teardown when unmounting
  useEffect(() => {
    return () => {
      teardownAll()
    }
  }, [teardownAll])

  return {
    isVoiceJoined,
    isMuted,
    isSpeaking,
    voiceStatus,
    voiceError,
    remotePeers,
    joinVoice,
    leaveVoice,
    toggleMute
  }
}
