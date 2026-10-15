import { useState, useEffect, useRef, useCallback } from 'react'
import { getIceServers } from '../features/webrtc/webrtcConfig'

/**
 * Hook for teacher screen sharing and student remote screen viewing via WebRTC.
 * Supports native getDisplayMedia, track.onended browser stops, peer connection management,
 * and automated signaling relay.
 */
export function useScreenShare({
  sessionId,
  currentUser,
  isWsConnected,
  lastMessage,
  sendSignal,
  sendScreenshareStarted,
  sendScreenshareStopped,
  isTeacher = false
}) {
  const [isSharing, setIsSharing] = useState(false)
  const [isTeacherSharing, setIsTeacherSharing] = useState(false)
  const [teacherSharingName, setTeacherSharingName] = useState('')
  const [screenStream, setScreenStream] = useState(null)
  const [sharingError, setSharingError] = useState('')

  const screenStreamRef = useRef(null)
  const peerConnectionsRef = useRef(new Map()) // peer_id -> RTCPeerConnection
  const pendingCandidatesRef = useRef(new Map()) // peer_id -> candidate array

  // Stop sharing screen (Teacher)
  const stopScreenShare = useCallback(() => {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((track) => {
        try {
          track.stop()
        } catch (_) {}
      })
      screenStreamRef.current = null
    }

    peerConnectionsRef.current.forEach((pc) => {
      try {
        pc.close()
      } catch {}
    })
    peerConnectionsRef.current.clear()
    pendingCandidatesRef.current.clear()

    setIsSharing(false)
    setScreenStream(null)
    setSharingError('')

    if (isTeacher && sendScreenshareStopped) {
      sendScreenshareStopped()
    }
  }, [isTeacher, sendScreenshareStopped])

  // Start sharing screen (Teacher only)
  const startScreenShare = useCallback(async () => {
    if (!isTeacher) {
      setSharingError('Only teachers are permitted to share screen in this classroom.')
      return
    }

    if (!isWsConnected) {
      setSharingError('Cannot start screen share: Classroom is offline.')
      return
    }

    setSharingError('')

    try {
      if (!navigator.mediaDevices?.getDisplayMedia) {
        throw new Error('Your browser does not support display media screen sharing.')
      }

      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: 'always' },
        audio: false
      })

      screenStreamRef.current = stream
      setScreenStream(stream)
      setIsSharing(true)

      // Listen for browser's native "Stop Sharing" floating button
      const videoTrack = stream.getVideoTracks()[0]
      if (videoTrack) {
        videoTrack.onended = () => {
          stopScreenShare()
        }
      }

      // Notify classroom peers that screen sharing has started
      if (sendScreenshareStarted) {
        sendScreenshareStarted()
      }
    } catch (err) {
      console.warn('Screen share initiation cancelled or failed:', err)
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setSharingError('Screen sharing permission was cancelled or denied.')
      } else {
        setSharingError(err.message || 'Unable to share screen.')
      }
      setIsSharing(false)
      setScreenStream(null)
    }
  }, [isTeacher, isWsConnected, sendScreenshareStarted, stopScreenShare])

  // Teacher initiates WebRTC connection with a student viewer
  const connectWithViewer = useCallback(async (studentId) => {
    if (!isTeacher || !screenStreamRef.current || typeof RTCPeerConnection === 'undefined') return

    let pc = peerConnectionsRef.current.get(studentId)
    if (pc) {
      try {
        pc.close()
      } catch {}
    }

    pc = new RTCPeerConnection({ iceServers: getIceServers() })
    peerConnectionsRef.current.set(studentId, pc)

    // Add screen track
    screenStreamRef.current.getTracks().forEach((track) => {
      pc.addTrack(track, screenStreamRef.current)
    })

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        peerConnectionsRef.current.delete(studentId)
      }
    }

    pc.onicecandidate = (event) => {
      if (event.candidate && sendSignal) {
        sendSignal(studentId, {
          type: 'candidate',
          candidate: event.candidate.toJSON ? event.candidate.toJSON() : event.candidate,
          media: 'screen'
        })
      }
    }

    try {
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)
      if (sendSignal) {
        sendSignal(studentId, {
          type: 'offer',
          sdp: offer.sdp,
          media: 'screen'
        })
      }
    } catch (err) {
      console.error('Error offering screen share to student:', err)
    }
  }, [isTeacher, sendSignal])

  // Student receives WebRTC screen connection
  const handleRemoteOffer = useCallback(async (teacherId, sdp) => {
    if (typeof RTCPeerConnection === 'undefined') return

    let pc = peerConnectionsRef.current.get(teacherId)
    if (pc) {
      try {
        pc.close()
      } catch {}
    }

    pc = new RTCPeerConnection({ iceServers: getIceServers() })
    peerConnectionsRef.current.set(teacherId, pc)

    pc.ontrack = (event) => {
      const stream = (event.streams && event.streams[0]) || (event.track ? new MediaStream([event.track]) : null)
      if (stream) {
        setScreenStream(stream)
        setIsTeacherSharing(true)
      }
    }

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        setScreenStream(null)
        setIsTeacherSharing(false)
        peerConnectionsRef.current.delete(teacherId)
      }
    }

    pc.onicecandidate = (event) => {
      if (event.candidate && sendSignal) {
        sendSignal(teacherId, {
          type: 'candidate',
          candidate: event.candidate.toJSON ? event.candidate.toJSON() : event.candidate,
          media: 'screen'
        })
      }
    }

    try {
      await pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp }))
      // Flush any queued ICE candidates
      const queued = pendingCandidatesRef.current.get(teacherId) || []
      for (const cand of queued) {
        await pc.addIceCandidate(new RTCIceCandidate(cand))
      }
      pendingCandidatesRef.current.delete(teacherId)

      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)
      if (sendSignal) {
        sendSignal(teacherId, {
          type: 'answer',
          sdp: answer.sdp,
          media: 'screen'
        })
      }
    } catch (err) {
      console.error('Error answering teacher screen share:', err)
    }
  }, [sendSignal])

  // Process incoming messages
  useEffect(() => {
    if (!lastMessage) return

    const { type, data, sender_id, signal } = lastMessage

    // 1. Teacher started screen share -> Student prepares and signals ready to view
    if (type === 'screenshare_started' && data) {
      if (!isTeacher) {
        setIsTeacherSharing(true)
        setTeacherSharingName(data.teacher_name || 'Teacher')
        if (data.teacher_id && sendSignal) {
          sendSignal(data.teacher_id, {
            type: 'viewer_ready',
            media: 'screen'
          })
        }
      }
    }

    // 2. Teacher stopped screen share
    if (type === 'screenshare_stopped') {
      setIsTeacherSharing(false)
      setTeacherSharingName('')
      if (!isTeacher) {
        setScreenStream(null)
        peerConnectionsRef.current.forEach((pc) => {
          try {
            pc.close()
          } catch {}
        })
        peerConnectionsRef.current.clear()
        pendingCandidatesRef.current.clear()
      }
    }

    // 3. WebRTC signaling relay for screen share
    if (type === 'webrtc_signal' && signal && signal.media === 'screen') {
      const peerId = sender_id
      if (!peerId) return

      if (signal.type === 'offer' && !isTeacher) {
        handleRemoteOffer(peerId, signal.sdp)
      } else if (signal.type === 'answer' && isTeacher) {
        const pc = peerConnectionsRef.current.get(peerId)
        if (pc) {
          pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: signal.sdp })).then(() => {
            const queued = pendingCandidatesRef.current.get(peerId) || []
            queued.forEach((c) => pc.addIceCandidate(new RTCIceCandidate(c)))
            pendingCandidatesRef.current.delete(peerId)
          }).catch(console.error)
        }
      } else if (signal.type === 'candidate' && signal.candidate) {
        const pc = peerConnectionsRef.current.get(peerId)
        if (pc && pc.remoteDescription) {
          pc.addIceCandidate(new RTCIceCandidate(signal.candidate)).catch(console.error)
        } else {
          const list = pendingCandidatesRef.current.get(peerId) || []
          list.push(signal.candidate)
          pendingCandidatesRef.current.set(peerId, list)
        }
      }
    }

    // 4. Session termination cleanup
    if (type === 'session_ended') {
      stopScreenShare()
      setIsTeacherSharing(false)
      setScreenStream(null)
    }
  }, [lastMessage, isTeacher, stopScreenShare, handleRemoteOffer, sendSignal])

  // If teacher is sharing and a student signals presence or requests connection
  useEffect(() => {
    if (isTeacher && isSharing) {
      if (lastMessage?.type === 'webrtc_signal' && lastMessage.signal?.type === 'viewer_ready') {
        connectWithViewer(lastMessage.sender_id)
      } else if (lastMessage?.type === 'student_behaviour_telemetry' && lastMessage.data?.user_id) {
        const studentId = lastMessage.data.user_id
        if (!peerConnectionsRef.current.has(studentId)) {
          connectWithViewer(studentId)
        }
      }
    }
  }, [isTeacher, isSharing, lastMessage, connectWithViewer])

  // Teardown when component unmounts
  useEffect(() => {
    return () => {
      stopScreenShare()
    }
  }, [stopScreenShare])

  return {
    isSharing,
    isTeacherSharing,
    teacherSharingName,
    screenStream,
    sharingError,
    startScreenShare,
    stopScreenShare,
    connectWithViewer
  }
}
