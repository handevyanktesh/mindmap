import { useState, useRef, useEffect } from 'react'
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision'
import { calculateEAR } from '../features/facial/eyeFeatures'
import { calculateGaze } from '../features/facial/gazeFeatures'
import { calculateHeadPose } from '../features/facial/headPoseFeatures'

const WASM_CDN_PATH = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm'
const MODEL_ASSET_URL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task'

const INITIAL_GAZE = {
  leftGazeX: null,
  rightGazeX: null,
  gazeX: null,
  leftGazeY: null,
  rightGazeY: null,
  gazeY: null
}

const INITIAL_HEAD_POSE = {
  yaw: null,
  pitch: null,
  roll: null
}

/**
 * Hook to manage MediaPipe Face Landmarker lifecycle and real-time detection
 * on an active HTML <video> element.
 *
 * @param {React.RefObject<HTMLVideoElement>} videoRef - Ref to the local video element
 * @param {boolean} enabled - Whether detection loop should be running (e.g. camera is active)
 */
export function useFaceLandmarker(videoRef, enabled = true) {
  const [isLoading, setIsLoading] = useState(true)
  const [isReady, setIsReady] = useState(false)
  const [error, setError] = useState(null)
  const [faceDetected, setFaceDetected] = useState(false)
  const [landmarks, setLandmarks] = useState(null)
  const [earData, setEarData] = useState({ leftEAR: null, rightEAR: null, ear: null })
  const [gazeData, setGazeData] = useState(INITIAL_GAZE)
  const [headPoseData, setHeadPoseData] = useState(INITIAL_HEAD_POSE)

  const landmarkerRef = useRef(null)
  const animFrameRef = useRef(null)
  const lastVideoTimeRef = useRef(-1)
  const lastTimestampRef = useRef(0)
  const landmarksRef = useRef(null)
  const earDataRef = useRef({ leftEAR: null, rightEAR: null, ear: null })
  const gazeDataRef = useRef(INITIAL_GAZE)
  const headPoseDataRef = useRef(INITIAL_HEAD_POSE)
  const lastStateUpdateTimeRef = useRef(0)

  // Initialize MediaPipe Face Landmarker once
  useEffect(() => {
    let isCancelled = false

    async function initFaceLandmarker() {
      setIsLoading(true)
      setError(null)

      try {
        const filesetResolver = await FilesetResolver.forVisionTasks(WASM_CDN_PATH)
        if (isCancelled) return

        let landmarker = null
        try {
          // Attempt GPU delegate first for hardware-accelerated processing
          landmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
            baseOptions: {
              modelAssetPath: MODEL_ASSET_URL,
              delegate: 'GPU'
            },
            outputFaceBlendshapes: false,
            outputFacialTransformationMatrixes: false,
            runningMode: 'VIDEO',
            numFaces: 1
          })
        } catch (gpuError) {
          console.warn('FaceLandmarker GPU initialization failed; attempting CPU fallback:', gpuError)
          if (isCancelled) return

          landmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
            baseOptions: {
              modelAssetPath: MODEL_ASSET_URL,
              delegate: 'CPU'
            },
            outputFaceBlendshapes: false,
            outputFacialTransformationMatrixes: false,
            runningMode: 'VIDEO',
            numFaces: 1
          })
        }

        if (isCancelled) {
          if (landmarker && typeof landmarker.close === 'function') {
            landmarker.close()
          }
          return
        }

        landmarkerRef.current = landmarker
        setIsReady(true)
        setIsLoading(false)
      } catch (err) {
        console.error('Failed to initialize FaceLandmarker:', err)
        if (!isCancelled) {
          setError(err.message || 'Failed to initialize MediaPipe Face Landmarker.')
          setIsLoading(false)
          setIsReady(false)
        }
      }
    }

    initFaceLandmarker()

    return () => {
      isCancelled = true
      if (landmarkerRef.current && typeof landmarkerRef.current.close === 'function') {
        try {
          landmarkerRef.current.close()
        } catch (_err) {
          // Ignore close error during teardown
        }
        landmarkerRef.current = null
      }
      setIsReady(false)
    }
  }, [])

  // Animation frame detection loop
  useEffect(() => {
    if (!enabled || !isReady || !landmarkerRef.current) {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current)
        animFrameRef.current = null
      }
      setFaceDetected(false)
      setLandmarks(null)
      setEarData({ leftEAR: null, rightEAR: null, ear: null })
      setGazeData(INITIAL_GAZE)
      setHeadPoseData(INITIAL_HEAD_POSE)
      landmarksRef.current = null
      earDataRef.current = { leftEAR: null, rightEAR: null, ear: null }
      gazeDataRef.current = INITIAL_GAZE
      headPoseDataRef.current = INITIAL_HEAD_POSE
      lastVideoTimeRef.current = -1
      return
    }

    let isRunning = true

    function detectFrame() {
      if (!isRunning) return

      const video = videoRef?.current
      const landmarker = landmarkerRef.current

      if (video && landmarker && video.readyState >= 2 && !video.paused) {
        if (video.currentTime !== lastVideoTimeRef.current) {
          lastVideoTimeRef.current = video.currentTime

          // Enforce strictly monotonically increasing timestamp for detectForVideo
          const now = performance.now()
          const timestamp = now > lastTimestampRef.current ? now : lastTimestampRef.current + 1
          lastTimestampRef.current = timestamp

          try {
            const results = landmarker.detectForVideo(video, timestamp)
            const hasFace = Boolean(
              results &&
              results.faceLandmarks &&
              results.faceLandmarks.length > 0 &&
              results.faceLandmarks[0].length > 0
            )

            const currentLandmarks = hasFace ? results.faceLandmarks[0] : null
            landmarksRef.current = currentLandmarks

            // Compute Eye Aspect Ratio (EAR) from landmarks
            const currentEAR = hasFace
              ? calculateEAR(currentLandmarks)
              : { leftEAR: null, rightEAR: null, ear: null }
            earDataRef.current = currentEAR

            // Compute Normalized Gaze from landmarks and iris
            const currentGaze = hasFace
              ? calculateGaze(currentLandmarks)
              : INITIAL_GAZE
            gazeDataRef.current = currentGaze

            // Compute Head Pose (Yaw, Pitch, Roll) from 3D landmarks
            const currentPose = hasFace
              ? calculateHeadPose(currentLandmarks)
              : INITIAL_HEAD_POSE
            headPoseDataRef.current = currentPose

            const nowTime = Date.now()
            // Throttle React state updates to avoid unnecessary 60fps re-renders
            // Trigger immediately on detection status transition
            setFaceDetected((prev) => {
              if (prev !== hasFace) {
                setLandmarks(currentLandmarks)
                setEarData(currentEAR)
                setGazeData(currentGaze)
                setHeadPoseData(currentPose)
                lastStateUpdateTimeRef.current = nowTime
                return hasFace
              }
              // If detection state is unchanged, throttle state updates to ~10Hz
              if (hasFace && nowTime - lastStateUpdateTimeRef.current > 100) {
                setLandmarks(currentLandmarks)
                setEarData(currentEAR)
                setGazeData(currentGaze)
                setHeadPoseData(currentPose)
                lastStateUpdateTimeRef.current = nowTime
              }
              return prev
            })
          } catch (err) {
            console.warn('FaceLandmarker detectForVideo error:', err)
          }
        }
      }

      if (isRunning) {
        animFrameRef.current = requestAnimationFrame(detectFrame)
      }
    }

    animFrameRef.current = requestAnimationFrame(detectFrame)

    return () => {
      isRunning = false
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current)
        animFrameRef.current = null
      }
      setFaceDetected(false)
      setLandmarks(null)
      setEarData({ leftEAR: null, rightEAR: null, ear: null })
      setGazeData(INITIAL_GAZE)
      setHeadPoseData(INITIAL_HEAD_POSE)
      landmarksRef.current = null
      earDataRef.current = { leftEAR: null, rightEAR: null, ear: null }
      gazeDataRef.current = INITIAL_GAZE
      headPoseDataRef.current = INITIAL_HEAD_POSE
      lastVideoTimeRef.current = -1
    }
  }, [enabled, isReady, videoRef])

  return {
    isLoading,
    isReady,
    error,
    faceDetected,
    landmarks,
    landmarksRef,
    ear: earData.ear,
    leftEAR: earData.leftEAR,
    rightEAR: earData.rightEAR,
    earDataRef,
    gazeX: gazeData.gazeX,
    gazeY: gazeData.gazeY,
    leftGazeX: gazeData.leftGazeX,
    rightGazeX: gazeData.rightGazeX,
    leftGazeY: gazeData.leftGazeY,
    rightGazeY: gazeData.rightGazeY,
    gazeDataRef,
    yaw: headPoseData.yaw,
    pitch: headPoseData.pitch,
    roll: headPoseData.roll,
    headPoseDataRef
  }
}
