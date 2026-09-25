import { useState, useRef, useEffect, useCallback } from 'react'

export function useCamera(autoStart = false) {
  const [stream, setStream] = useState(null)
  const [status, setStatus] = useState('idle') // 'idle' | 'requesting' | 'active' | 'error'
  const [error, setError] = useState(null)
  const videoRef = useRef(null)
  const streamRef = useRef(null)

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        track.stop()
      })
      streamRef.current = null
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null
    }

    setStream(null)
    setStatus('idle')
    setError(null)
  }, [])

  const startCamera = useCallback(async () => {
    // Prevent duplicate requests if already active or requesting
    if (streamRef.current && streamRef.current.active) {
      return
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setStatus('error')
      setError('Camera access is not supported by this browser.')
      return
    }

    // Stop any existing stream before starting a new one
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }

    setStatus('requesting')
    setError(null)

    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false
      })

      streamRef.current = mediaStream
      setStream(mediaStream)
      setStatus('active')

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream
      }
    } catch (err) {
      setStatus('error')
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setError('Camera permission was denied.')
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setError('No camera was detected.')
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        setError('The camera is currently unavailable or in use by another application.')
      } else if (err.name === 'OverconstrainedError') {
        setError('The requested camera configuration is not supported.')
      } else {
        setError('Unable to access camera.')
      }
    }
  }, [])

  // Keep videoRef srcObject in sync with stream
  useEffect(() => {
    if (videoRef.current && streamRef.current && videoRef.current.srcObject !== streamRef.current) {
      videoRef.current.srcObject = streamRef.current
    }
  }, [stream])

  // Handle autoStart and unmount cleanup
  useEffect(() => {
    if (autoStart) {
      startCamera()
    }

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
        streamRef.current = null
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null
      }
    }
  }, [autoStart, startCamera])

  return {
    videoRef,
    stream,
    status,
    error,
    startCamera,
    stopCamera
  }
}
