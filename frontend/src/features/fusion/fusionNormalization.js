/**
 * Multimodal Feature Fusion Normalization Utilities
 *
 * Provides pure mathematical normalization transformations for:
 * - Eye Aspect Ratio (EAR)
 * - Normalized Gaze Coordinates and Variability
 * - Head Pose Orientations (Yaw, Pitch, Roll) and Instability
 *
 * All transformations are bounded, deterministic, and strictly reject
 * invalid/non-finite inputs without producing NaN or Infinity.
 *
 * IMPORTANT:
 * - These are pure geometric and signal-processing normalizations.
 * - They do NOT represent attention, distraction, confusion, or mental state.
 */

// ============================================================================
// Documented Engineering Baseline Parameters
// ============================================================================

/**
 * EAR Normalization Constants
 * Typical biological human eye aspect ratio spans approximately [0.15, 0.38].
 * - Below 0.18: closed or mostly closed eye state.
 * - Above 0.35: fully open or wide-open eye state.
 */
export const EAR_MIN_BASELINE = 0.15
export const EAR_MAX_BASELINE = 0.38
export const EAR_STD_MAX_SCALE = 0.10

/**
 * Gaze Normalization Constants
 * MediaPipe iris gaze coordinates range in [0, 1] where (0.5, 0.5) is centered.
 * Maximum deviation from optical center (0.5, 0.5) in normalized image space is 0.5.
 */
export const GAZE_CENTER_X = 0.5
export const GAZE_CENTER_Y = 0.5
export const GAZE_MAX_CENTER_OFFSET = 0.5
export const GAZE_STD_MAX_SCALE = 0.25
export const GAZE_DISPLACEMENT_MAX_SCALE = 5.0

/**
 * Head Pose Normalization Constants (in degrees)
 * Operational human head rotation boundaries for front-facing classroom setting.
 */
export const HEAD_POSE_MAX_YAW = 60.0    // ±60 degrees horizontal turn
export const HEAD_POSE_MAX_PITCH = 45.0  // ±45 degrees vertical tilt/nod
export const HEAD_POSE_MAX_ROLL = 45.0   // ±45 degrees lateral tilt
export const HEAD_POSE_ANGULAR_DISPLACEMENT_MAX_SCALE = 180.0 // cumulative degrees in window

// ============================================================================
// Primitive Math Helpers
// ============================================================================

/**
 * Clamps a numerical value within [min, max].
 * Returns null if value is not a finite number.
 *
 * @param {number|null|undefined} val
 * @param {number} min
 * @param {number} max
 * @returns {number|null}
 */
export function clamp(val, min, max) {
  if (val === null || val === undefined || typeof val !== 'number' || !Number.isFinite(val)) {
    return null
  }
  return Math.min(Math.max(val, min), max)
}

/**
 * Linearly rescales a scalar from [inMin, inMax] to [0, 1], with strict clamping.
 * Returns null if input is null or non-finite.
 *
 * @param {number|null|undefined} val
 * @param {number} inMin
 * @param {number} inMax
 * @returns {number|null}
 */
export function normalizeLinear(val, inMin, inMax) {
  if (val === null || val === undefined || typeof val !== 'number' || !Number.isFinite(val)) {
    return null
  }
  if (inMax <= inMin) return 0.0
  const ratio = (val - inMin) / (inMax - inMin)
  return Math.min(Math.max(ratio, 0.0), 1.0)
}

// ============================================================================
// Modality-Specific Normalizers
// ============================================================================

/**
 * Normalizes Eye Aspect Ratio (EAR) into a bounded [0, 1] range.
 * 0.0 corresponds to fully closed eyes (<= EAR_MIN_BASELINE).
 * 1.0 corresponds to fully open eyes (>= EAR_MAX_BASELINE).
 *
 * @param {number|null|undefined} ear
 * @returns {number|null}
 */
export function normalizeEAR(ear) {
  return normalizeLinear(ear, EAR_MIN_BASELINE, EAR_MAX_BASELINE)
}

/**
 * Normalizes EAR standard deviation (variability/flutter) into [0, 1].
 *
 * @param {number|null|undefined} earStd
 * @returns {number|null}
 */
export function normalizeEARVariability(earStd) {
  return normalizeLinear(earStd, 0.0, EAR_STD_MAX_SCALE)
}

/**
 * Normalizes 2D Gaze coordinates (X, Y) into a centeredness / alignment index in [0, 1].
 * 1.0 corresponds to gaze aligned exactly with the optical center (0.5, 0.5).
 * 0.0 corresponds to maximum eccentric boundary gaze.
 *
 * @param {number|null|undefined} meanX - Normalized iris X in [0, 1]
 * @param {number|null|undefined} meanY - Normalized iris Y in [0, 1]
 * @returns {number|null} Alignment index in [0, 1], or null if inputs invalid
 */
export function normalizeGazeAlignment(meanX, meanY) {
  if (
    meanX === null || meanX === undefined || typeof meanX !== 'number' || !Number.isFinite(meanX) ||
    meanY === null || meanY === undefined || typeof meanY !== 'number' || !Number.isFinite(meanY)
  ) {
    return null
  }

  // Normalized offset from optical center in [-1, +1]
  const dx = (meanX - GAZE_CENTER_X) / GAZE_MAX_CENTER_OFFSET
  const dy = (meanY - GAZE_CENTER_Y) / GAZE_MAX_CENTER_OFFSET

  // Euclidean radial eccentricity in [0, sqrt(2)] -> clamped to [0, 1]
  const radialDistance = Math.sqrt(dx * dx + dy * dy)
  const clampedEccentricity = Math.min(1.0, radialDistance)

  return Math.max(0.0, 1.0 - clampedEccentricity)
}

/**
 * Normalizes accumulated temporal gaze displacement into [0, 1].
 *
 * @param {number|null|undefined} displacement
 * @returns {number|null}
 */
export function normalizeGazeDisplacement(displacement) {
  return normalizeLinear(displacement, 0.0, GAZE_DISPLACEMENT_MAX_SCALE)
}

/**
 * Normalizes head orientation angles (yaw, pitch, roll in degrees)
 * into a frontal alignment index in [0, 1].
 * 1.0 corresponds to direct frontal camera orientation (0°, 0°, 0°).
 * 0.0 corresponds to exceeding operational angular boundaries.
 *
 * @param {number|null|undefined} yaw - Horizontal rotation in degrees
 * @param {number|null|undefined} pitch - Vertical nod in degrees
 * @param {number|null|undefined} roll - Lateral tilt in degrees
 * @returns {number|null} Frontal alignment index in [0, 1], or null if invalid
 */
export function normalizeHeadPoseAlignment(yaw, pitch, roll) {
  if (
    yaw === null || yaw === undefined || typeof yaw !== 'number' || !Number.isFinite(yaw) ||
    pitch === null || pitch === undefined || typeof pitch !== 'number' || !Number.isFinite(pitch) ||
    roll === null || roll === undefined || typeof roll !== 'number' || !Number.isFinite(roll)
  ) {
    return null
  }

  // Normalized angular deviations relative to respective operational maxes
  const ny = Math.abs(yaw) / HEAD_POSE_MAX_YAW
  const np = Math.abs(pitch) / HEAD_POSE_MAX_PITCH
  const nr = Math.abs(roll) / HEAD_POSE_MAX_ROLL

  // Root-mean-square angular deviation normalized to [0, 1]
  const compositeDeviation = Math.sqrt((ny * ny + np * np + nr * nr) / 3.0)
  const clampedDeviation = Math.min(1.0, compositeDeviation)

  return Math.max(0.0, 1.0 - clampedDeviation)
}

/**
 * Normalizes accumulated 3D head pose angular displacement into [0, 1].
 *
 * @param {number|null|undefined} angularDisplacement - Total angular travel in degrees
 * @returns {number|null}
 */
export function normalizePoseAngularDisplacement(angularDisplacement) {
  return normalizeLinear(angularDisplacement, 0.0, HEAD_POSE_ANGULAR_DISPLACEMENT_MAX_SCALE)
}
