/**
 * Personal Behavioural Baseline Tracker
 *
 * Establishes and maintains an individual student's natural reference baseline
 * across Eye Aspect Ratio (EAR), Gaze coordinates, and 3D Head Pose orientation.
 *
 * Design Principles:
 * 1. 100% pure JavaScript — framework-independent, no React or DOM dependencies.
 * 2. Quality-Gated Updates — invalid, corrupt, or missing observations are strictly
 *    rejected and NEVER converted to zero.
 * 3. Warm-up Readiness — baselines require an explicit warm-up sample threshold
 *    before being marked ready and emitting behavioural deviations.
 * 4. Robust Central Tendency — uses median over bounded history for initial estimation.
 * 5. Slow Adaptation — once ready, updates via low-pass EMA filtering (alpha = 0.02)
 *    to track subtle posture drifts while rejecting transient movements.
 * 6. Explicit Deviation Semantics — clearly distinguishes zero deviation (perfect match)
 *    from unavailable deviation (null).
 * 7. Architectural Boundary — strictly a BEHAVIOURAL BASELINE & DEVIATION layer.
 *    Does NOT perform attention, distraction, or confusion scoring.
 */

import {
  calculateMedian,
  calculateStandardDeviation,
  updateEMA,
  calculateEuclideanDistance2D,
  calculateAngularDistance3D
} from './baselineStats.js'

// ============================================================================
// Documented Engineering Baseline Parameters
// ============================================================================

/**
 * Number of valid observations required per modality before
 * that modality's baseline is considered established.
 * At ~10Hz throttled updates, 30 observations ≈ 3 seconds of stable engagement.
 */
export const BASELINE_WARMUP_OBSERVATIONS = 30

/**
 * Maximum observation history capacity per modality to prevent memory growth.
 */
export const BASELINE_MAX_HISTORY = 120

/**
 * Slow adaptation factor (alpha) for exponential moving average updates.
 * alpha = 0.02 ensures baseline adapts over hundreds of frames, preventing
 * transient head turns or eye glances from suddenly redefining the student's baseline.
 */
export const BASELINE_ADAPTATION_RATE = 0.02

/**
 * Maximum expected deviation scale constants used for normalizing deviations to [0, 1].
 */
export const DEVIATION_SCALE_EAR = 0.20    // 0.20 EAR change represents extreme eyelid transition
export const DEVIATION_SCALE_GAZE = 0.50   // 0.50 normalized distance from optical baseline
export const DEVIATION_SCALE_POSE = 45.0   // 45 degrees 3D angular departure from posture baseline

export class BaselineTracker {
  /**
   * @param {object} [options]
   * @param {number} [options.warmupObservations=BASELINE_WARMUP_OBSERVATIONS]
   * @param {number} [options.maxHistory=BASELINE_MAX_HISTORY]
   * @param {number} [options.adaptationRate=BASELINE_ADAPTATION_RATE]
   */
  constructor(options = {}) {
    this.warmupObservations = options.warmupObservations || BASELINE_WARMUP_OBSERVATIONS
    this.maxHistory = options.maxHistory || BASELINE_MAX_HISTORY
    this.adaptationRate = options.adaptationRate || BASELINE_ADAPTATION_RATE

    this.reset()
  }

  /**
   * Completely resets tracker state, observation history, and baselines.
   */
  reset() {
    this.sampleCounts = {
      ear: 0,
      gaze: 0,
      headPose: 0,
      totalUpdates: 0
    }

    this.history = {
      ear: [],
      gaze: [], // array of { x, y }
      headPose: [] // array of { yaw, pitch, roll }
    }

    this.baseline = {
      ear: {
        value: null,
        variability: null,
        sampleCount: 0
      },
      gaze: {
        x: null,
        y: null,
        stdX: null,
        stdY: null,
        sampleCount: 0
      },
      headPose: {
        yaw: null,
        pitch: null,
        roll: null,
        variability: null,
        sampleCount: 0
      }
    }

    this.lastState = this._createState(null, { earReady: false, gazeReady: false, poseReady: false }, false, false)
  }

  /**
   * Extracts sanitized observation values from either a temporalData structure
   * or a flat features object.
   *
   * @private
   * @param {object} raw
   * @returns {{ ear: number|null, gazeX: number|null, gazeY: number|null, yaw: number|null, pitch: number|null, roll: number|null }}
   */
  _extractObservation(raw) {
    if (!raw || typeof raw !== 'object') {
      return { ear: null, gazeX: null, gazeY: null, yaw: null, pitch: null, roll: null }
    }

    // Branch A: Temporal data structure from extractTemporalFeatures
    if (raw.ear && typeof raw.ear === 'object' && ('mean' in raw.ear)) {
      const minTemporalSamples = 5
      const validSamples = raw.validSamples || {}

      const ear = (validSamples.ear >= minTemporalSamples && typeof raw.ear.mean === 'number' && Number.isFinite(raw.ear.mean))
        ? raw.ear.mean
        : null

      const gazeX = (validSamples.gaze >= minTemporalSamples && typeof raw.gaze?.meanX === 'number' && Number.isFinite(raw.gaze.meanX))
        ? raw.gaze.meanX
        : null

      const gazeY = (validSamples.gaze >= minTemporalSamples && typeof raw.gaze?.meanY === 'number' && Number.isFinite(raw.gaze.meanY))
        ? raw.gaze.meanY
        : null

      const yaw = (validSamples.pose >= minTemporalSamples && typeof raw.headPose?.meanYaw === 'number' && Number.isFinite(raw.headPose.meanYaw))
        ? raw.headPose.meanYaw
        : null

      const pitch = (validSamples.pose >= minTemporalSamples && typeof raw.headPose?.meanPitch === 'number' && Number.isFinite(raw.headPose.meanPitch))
        ? raw.headPose.meanPitch
        : null

      const roll = (validSamples.pose >= minTemporalSamples && typeof raw.headPose?.meanRoll === 'number' && Number.isFinite(raw.headPose.meanRoll))
        ? raw.headPose.meanRoll
        : null

      return { ear, gazeX, gazeY, yaw, pitch, roll }
    }

    // Branch B: Flat feature object (e.g. { ear, gazeX, gazeY, yaw, pitch, roll })
    const ear = typeof raw.ear === 'number' && Number.isFinite(raw.ear) ? raw.ear : null
    const gazeX = typeof raw.gazeX === 'number' && Number.isFinite(raw.gazeX) ? raw.gazeX : null
    const gazeY = typeof raw.gazeY === 'number' && Number.isFinite(raw.gazeY) ? raw.gazeY : null
    const yaw = typeof raw.yaw === 'number' && Number.isFinite(raw.yaw) ? raw.yaw : null
    const pitch = typeof raw.pitch === 'number' && Number.isFinite(raw.pitch) ? raw.pitch : null
    const roll = typeof raw.roll === 'number' && Number.isFinite(raw.roll) ? raw.roll : null

    return { ear, gazeX, gazeY, yaw, pitch, roll }
  }

  /**
   * Updates the baseline tracker with a new observation and computes deviations.
   * Quality-gated: only valid modalities update their respective baselines.
   *
   * @param {object} rawObservation
   * @returns {object} Baseline and deviation state
   */
  update(rawObservation) {
    const obs = this._extractObservation(rawObservation)

    const isEARValid = obs.ear !== null
    const isGazeValid = obs.gazeX !== null && obs.gazeY !== null
    const isPoseValid = obs.yaw !== null && obs.pitch !== null && obs.roll !== null

    const priorBaseline = {
      ear: this.baseline.ear.value,
      gazeX: this.baseline.gaze.x,
      gazeY: this.baseline.gaze.y,
      yaw: this.baseline.headPose.yaw,
      pitch: this.baseline.headPose.pitch,
      roll: this.baseline.headPose.roll
    }
    const priorReady = {
      ear: this.sampleCounts.ear >= this.warmupObservations,
      gaze: this.sampleCounts.gaze >= this.warmupObservations,
      headPose: this.sampleCounts.headPose >= this.warmupObservations
    }

    if (isEARValid || isGazeValid || isPoseValid) {
      this.sampleCounts.totalUpdates++
    }

    // 1. Quality-gated EAR Update
    if (isEARValid) {
      this.sampleCounts.ear++
      this.history.ear.push(obs.ear)
      if (this.history.ear.length > this.maxHistory) {
        this.history.ear.shift()
      }

      if (this.sampleCounts.ear <= this.warmupObservations) {
        // Calibration warm-up: compute robust median
        this.baseline.ear.value = calculateMedian(this.history.ear)
        this.baseline.ear.variability = calculateStandardDeviation(this.history.ear)
      } else {
        // Slow adaptation: update EMA
        this.baseline.ear.value = updateEMA(this.baseline.ear.value, obs.ear, this.adaptationRate)
        const currentSpread = Math.abs(obs.ear - this.baseline.ear.value)
        this.baseline.ear.variability = updateEMA(this.baseline.ear.variability, currentSpread, this.adaptationRate)
      }
      this.baseline.ear.sampleCount = this.sampleCounts.ear
    }

    // 2. Quality-gated Gaze Update
    if (isGazeValid) {
      this.sampleCounts.gaze++
      this.history.gaze.push({ x: obs.gazeX, y: obs.gazeY })
      if (this.history.gaze.length > this.maxHistory) {
        this.history.gaze.shift()
      }

      if (this.sampleCounts.gaze <= this.warmupObservations) {
        // Calibration warm-up: compute robust 2D median
        const xValues = this.history.gaze.map((g) => g.x)
        const yValues = this.history.gaze.map((g) => g.y)
        this.baseline.gaze.x = calculateMedian(xValues)
        this.baseline.gaze.y = calculateMedian(yValues)
        this.baseline.gaze.stdX = calculateStandardDeviation(xValues)
        this.baseline.gaze.stdY = calculateStandardDeviation(yValues)
      } else {
        // Slow adaptation: update EMA
        this.baseline.gaze.x = updateEMA(this.baseline.gaze.x, obs.gazeX, this.adaptationRate)
        this.baseline.gaze.y = updateEMA(this.baseline.gaze.y, obs.gazeY, this.adaptationRate)
      }
      this.baseline.gaze.sampleCount = this.sampleCounts.gaze
    }

    // 3. Quality-gated Head Pose Update
    if (isPoseValid) {
      this.sampleCounts.headPose++
      this.history.headPose.push({ yaw: obs.yaw, pitch: obs.pitch, roll: obs.roll })
      if (this.history.headPose.length > this.maxHistory) {
        this.history.headPose.shift()
      }

      if (this.sampleCounts.headPose <= this.warmupObservations) {
        // Calibration warm-up: compute robust 3D median
        const yawValues = this.history.headPose.map((p) => p.yaw)
        const pitchValues = this.history.headPose.map((p) => p.pitch)
        const rollValues = this.history.headPose.map((p) => p.roll)
        this.baseline.headPose.yaw = calculateMedian(yawValues)
        this.baseline.headPose.pitch = calculateMedian(pitchValues)
        this.baseline.headPose.roll = calculateMedian(rollValues)
        this.baseline.headPose.variability = calculateStandardDeviation(yawValues)
      } else {
        // Slow adaptation: update EMA
        this.baseline.headPose.yaw = updateEMA(this.baseline.headPose.yaw, obs.yaw, this.adaptationRate)
        this.baseline.headPose.pitch = updateEMA(this.baseline.headPose.pitch, obs.pitch, this.adaptationRate)
        this.baseline.headPose.roll = updateEMA(this.baseline.headPose.roll, obs.roll, this.adaptationRate)
      }
      this.baseline.headPose.sampleCount = this.sampleCounts.headPose
    }

    // 4. Compute Readiness & Reference Baseline for Deviations
    const earReady = this.sampleCounts.ear >= this.warmupObservations
    const gazeReady = this.sampleCounts.gaze >= this.warmupObservations
    const poseReady = this.sampleCounts.headPose >= this.warmupObservations
    const overallReady = earReady && gazeReady && poseReady

    const referenceBaseline = {
      ear: priorReady.ear ? priorBaseline.ear : this.baseline.ear.value,
      gazeX: priorReady.gaze ? priorBaseline.gazeX : this.baseline.gaze.x,
      gazeY: priorReady.gaze ? priorBaseline.gazeY : this.baseline.gaze.y,
      yaw: priorReady.headPose ? priorBaseline.yaw : this.baseline.headPose.yaw,
      pitch: priorReady.headPose ? priorBaseline.pitch : this.baseline.headPose.pitch,
      roll: priorReady.headPose ? priorBaseline.roll : this.baseline.headPose.roll
    }

    this.lastState = this._createState(obs, { earReady, gazeReady, poseReady }, overallReady, true, referenceBaseline)
    return this.lastState
  }

  /**
   * Constructs the structured state object including deviations and coverage.
   *
   * @private
   */
  _createState(currentObs, readinessFlags, overallReady, hasRun, referenceBaseline = null) {
    const isOverallReady = Boolean(overallReady)
    const earReady = Boolean(readinessFlags?.earReady)
    const gazeReady = Boolean(readinessFlags?.gazeReady)
    const poseReady = Boolean(readinessFlags?.poseReady)

    const ref = referenceBaseline || {
      ear: this.baseline.ear.value,
      gazeX: this.baseline.gaze.x,
      gazeY: this.baseline.gaze.y,
      yaw: this.baseline.headPose.yaw,
      pitch: this.baseline.headPose.pitch,
      roll: this.baseline.headPose.roll
    }

    // Modality coverage
    const isEARAvailable = Boolean(currentObs && currentObs.ear !== null)
    const isGazeAvailable = Boolean(currentObs && currentObs.gazeX !== null && currentObs.gazeY !== null)
    const isPoseAvailable = Boolean(currentObs && currentObs.yaw !== null && currentObs.pitch !== null && currentObs.roll !== null)

    let availableCount = 0
    if (isEARAvailable) availableCount++
    if (isGazeAvailable) availableCount++
    if (isPoseAvailable) availableCount++

    // Deviations (null if modality not ready OR current observation is missing)
    let earDeviation = null
    let normalizedEarDev = null
    if (earReady && isEARAvailable && ref.ear !== null) {
      earDeviation = Math.abs(currentObs.ear - ref.ear)
      normalizedEarDev = Math.min(1.0, earDeviation / DEVIATION_SCALE_EAR)
    }

    let gazeDeviation = null
    let normalizedGazeDev = null
    if (gazeReady && isGazeAvailable && ref.gazeX !== null && ref.gazeY !== null) {
      gazeDeviation = calculateEuclideanDistance2D(currentObs.gazeX, currentObs.gazeY, ref.gazeX, ref.gazeY)
      if (gazeDeviation !== null) {
        normalizedGazeDev = Math.min(1.0, gazeDeviation / DEVIATION_SCALE_GAZE)
      }
    }

    let headPoseDeviation = null
    let normalizedPoseDev = null
    if (poseReady && isPoseAvailable && ref.yaw !== null) {
      headPoseDeviation = calculateAngularDistance3D(
        currentObs.yaw, currentObs.pitch, currentObs.roll,
        ref.yaw, ref.pitch, ref.roll
      )
      if (headPoseDeviation !== null) {
        normalizedPoseDev = Math.min(1.0, headPoseDeviation / DEVIATION_SCALE_POSE)
      }
    }

    // Composite deviation: average of available normalized deviations
    const validNormDevs = [normalizedEarDev, normalizedGazeDev, normalizedPoseDev].filter((v) => v !== null)
    const compositeDeviation = validNormDevs.length > 0
      ? validNormDevs.reduce((acc, v) => acc + v, 0) / validNormDevs.length
      : null

    const valid = Boolean(hasRun && availableCount > 0)

    return {
      ready: isOverallReady,
      readiness: {
        ear: earReady,
        gaze: gazeReady,
        headPose: poseReady,
        overall: isOverallReady
      },
      warmupProgress: {
        current: Math.min(this.warmupObservations, Math.max(this.sampleCounts.ear, this.sampleCounts.gaze, this.sampleCounts.headPose)),
        target: this.warmupObservations,
        ratio: Math.min(1.0, Math.max(this.sampleCounts.ear, this.sampleCounts.gaze, this.sampleCounts.headPose) / this.warmupObservations)
      },
      sampleCounts: { ...this.sampleCounts },
      baseline: {
        ear: { ...this.baseline.ear },
        gaze: { ...this.baseline.gaze },
        headPose: { ...this.baseline.headPose }
      },
      deviation: {
        ear: earDeviation,
        gaze: gazeDeviation,
        headPose: headPoseDeviation,
        composite: compositeDeviation
      },
      normalizedDeviation: {
        ear: normalizedEarDev,
        gaze: normalizedGazeDev,
        headPose: normalizedPoseDev,
        composite: compositeDeviation
      },
      modalityCoverage: {
        ear: isEARAvailable,
        gaze: isGazeAvailable,
        headPose: isPoseAvailable,
        availableCount,
        totalCount: 3
      },
      valid
    }
  }

  /**
   * Returns current baseline and deviation state.
   *
   * @returns {object}
   */
  getState() {
    return this.lastState
  }
}
