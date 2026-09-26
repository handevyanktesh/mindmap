/**
 * MediaPipe Face Landmarker Iris and Eye Landmark Indices
 *
 * MediaPipe Face Landmarker canonical topology with iris (478 landmarks):
 *
 * Left Eye (subject's left eye / observer's right):
 * - Iris Center: 473
 * - Iris Perimeter: 474 (right), 475 (top), 476 (left), 477 (bottom)
 * - Inner Corner (medial canthus, towards nose): 362
 * - Outer Corner (lateral canthus, towards temple): 263
 * - Upper Eyelid peak: 386
 * - Lower Eyelid trough: 374
 *
 * Right Eye (subject's right eye / observer's left):
 * - Iris Center: 468
 * - Iris Perimeter: 469 (right), 470 (top), 471 (left), 472 (bottom)
 * - Outer Corner (lateral canthus, towards temple): 33
 * - Inner Corner (medial canthus, towards nose): 133
 * - Upper Eyelid peak: 159
 * - Lower Eyelid trough: 145
 *
 * Coordinate Convention & Semantics:
 * - Normalized image coordinates: x in [0, 1] from image left to image right;
 *   y in [0, 1] from image top to image bottom.
 * - Horizontal Gaze (gazeX):
 *     Normalized ratio of iris center x between the eye's horizontal bounds [leftX, rightX].
 *     0.0 = iris at image-left corner of the eye
 *     0.5 = iris horizontally centered in the eye
 *     1.0 = iris at image-right corner of the eye
 * - Vertical Gaze (gazeY):
 *     Normalized ratio of iris center y between the eye's vertical bounds [topY, bottomY].
 *     0.0 = iris at upper eyelid peak (looking upward in camera frame)
 *     0.5 = iris vertically centered in the eye
 *     1.0 = iris at lower eyelid trough (looking downward in camera frame)
 *
 * Note on Head Pose:
 * - These gaze measurements represent eye-relative iris displacements within
 *   the eye socket and are NOT yet head-pose compensated.
 */

export const LEFT_IRIS_LANDMARKS = {
  center: 473,
  perimeter: [474, 475, 476, 477]
}

export const RIGHT_IRIS_LANDMARKS = {
  center: 468,
  perimeter: [469, 470, 471, 472]
}

export const LEFT_EYE_BOUNDS = {
  cornerInner: 362,
  cornerOuter: 263,
  eyelidUpper: 386,
  eyelidLower: 374
}

export const RIGHT_EYE_BOUNDS = {
  cornerOuter: 33,
  cornerInner: 133,
  eyelidUpper: 159,
  eyelidLower: 145
}

/**
 * Calculates normalized 2D gaze for a single eye given its iris center and eye boundaries.
 *
 * @param {object} irisPoint - {x, y} of the iris center
 * @param {object} corner1 - First horizontal corner point {x, y}
 * @param {object} corner2 - Second horizontal corner point {x, y}
 * @param {object} upperEyelid - Upper eyelid point {x, y}
 * @param {object} lowerEyelid - Lower eyelid point {x, y}
 * @returns {{ gazeX: number | null, gazeY: number | null }}
 */
export function calculateEyeGaze(irisPoint, corner1, corner2, upperEyelid, lowerEyelid) {
  if (
    !irisPoint ||
    !corner1 ||
    !corner2 ||
    !upperEyelid ||
    !lowerEyelid ||
    typeof irisPoint.x !== 'number' ||
    typeof irisPoint.y !== 'number' ||
    typeof corner1.x !== 'number' ||
    typeof corner1.y !== 'number' ||
    typeof corner2.x !== 'number' ||
    typeof corner2.y !== 'number' ||
    typeof upperEyelid.x !== 'number' ||
    typeof upperEyelid.y !== 'number' ||
    typeof lowerEyelid.x !== 'number' ||
    typeof lowerEyelid.y !== 'number' ||
    !Number.isFinite(irisPoint.x) ||
    !Number.isFinite(irisPoint.y) ||
    !Number.isFinite(corner1.x) ||
    !Number.isFinite(corner1.y) ||
    !Number.isFinite(corner2.x) ||
    !Number.isFinite(corner2.y) ||
    !Number.isFinite(upperEyelid.x) ||
    !Number.isFinite(upperEyelid.y) ||
    !Number.isFinite(lowerEyelid.x) ||
    !Number.isFinite(lowerEyelid.y)
  ) {
    return { gazeX: null, gazeY: null }
  }

  const EPSILON = 1e-6

  // Horizontal bounds (camera-left to camera-right)
  const leftX = Math.min(corner1.x, corner2.x)
  const rightX = Math.max(corner1.x, corner2.x)
  const eyeWidth = rightX - leftX

  let gazeX = null
  if (eyeWidth > EPSILON) {
    const rawGazeX = (irisPoint.x - leftX) / eyeWidth
    if (Number.isFinite(rawGazeX)) {
      gazeX = rawGazeX
    }
  }

  // Vertical bounds (camera-top to camera-bottom in image coordinates)
  const topY = Math.min(upperEyelid.y, lowerEyelid.y)
  const bottomY = Math.max(upperEyelid.y, lowerEyelid.y)
  const eyeHeight = bottomY - topY

  let gazeY = null
  if (eyeHeight > EPSILON) {
    const rawGazeY = (irisPoint.y - topY) / eyeHeight
    if (Number.isFinite(rawGazeY)) {
      gazeY = rawGazeY
    }
  }

  return { gazeX, gazeY }
}

/**
 * Calculates normalized gaze features (left, right, and combined) from MediaPipe landmarks.
 *
 * @param {Array<object>} landmarks - 478 normalized facial landmarks ({x, y, z})
 * @returns {{
 *   leftGazeX: number | null,
 *   rightGazeX: number | null,
 *   gazeX: number | null,
 *   leftGazeY: number | null,
 *   rightGazeY: number | null,
 *   gazeY: number | null
 * }}
 */
export function calculateGaze(landmarks) {
  const unavailableResult = {
    leftGazeX: null,
    rightGazeX: null,
    gazeX: null,
    leftGazeY: null,
    rightGazeY: null,
    gazeY: null
  }

  if (!Array.isArray(landmarks) || landmarks.length < 478) {
    return unavailableResult
  }

  const getPt = (idx) => landmarks[idx]

  // --- Left Eye Gaze ---
  const leftIrisCenter = getPt(LEFT_IRIS_LANDMARKS.center)
  const leftCornerInner = getPt(LEFT_EYE_BOUNDS.cornerInner)
  const leftCornerOuter = getPt(LEFT_EYE_BOUNDS.cornerOuter)
  const leftUpper = getPt(LEFT_EYE_BOUNDS.eyelidUpper)
  const leftLower = getPt(LEFT_EYE_BOUNDS.eyelidLower)

  const leftResult = calculateEyeGaze(
    leftIrisCenter,
    leftCornerInner,
    leftCornerOuter,
    leftUpper,
    leftLower
  )

  // --- Right Eye Gaze ---
  const rightIrisCenter = getPt(RIGHT_IRIS_LANDMARKS.center)
  const rightCornerOuter = getPt(RIGHT_EYE_BOUNDS.cornerOuter)
  const rightCornerInner = getPt(RIGHT_EYE_BOUNDS.cornerInner)
  const rightUpper = getPt(RIGHT_EYE_BOUNDS.eyelidUpper)
  const rightLower = getPt(RIGHT_EYE_BOUNDS.eyelidLower)

  const rightResult = calculateEyeGaze(
    rightIrisCenter,
    rightCornerOuter,
    rightCornerInner,
    rightUpper,
    rightLower
  )

  const leftGazeX = leftResult.gazeX
  const leftGazeY = leftResult.gazeY
  const rightGazeX = rightResult.gazeX
  const rightGazeY = rightResult.gazeY

  // Combined Horizontal Gaze
  let gazeX = null
  if (leftGazeX !== null && rightGazeX !== null) {
    gazeX = (leftGazeX + rightGazeX) / 2.0
  } else if (leftGazeX !== null) {
    gazeX = leftGazeX
  } else if (rightGazeX !== null) {
    gazeX = rightGazeX
  }

  // Combined Vertical Gaze
  let gazeY = null
  if (leftGazeY !== null && rightGazeY !== null) {
    gazeY = (leftGazeY + rightGazeY) / 2.0
  } else if (leftGazeY !== null) {
    gazeY = leftGazeY
  } else if (rightGazeY !== null) {
    gazeY = rightGazeY
  }

  return {
    leftGazeX,
    rightGazeX,
    gazeX,
    leftGazeY,
    rightGazeY,
    gazeY
  }
}
