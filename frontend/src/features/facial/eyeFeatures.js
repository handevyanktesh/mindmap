/**
 * MediaPipe Face Mesh Eye Landmark Indices
 *
 * Based on canonical MediaPipe 468/478 Face Mesh topology:
 *
 * Left Eye (subject's left eye / observer's right):
 * - p1: Inner corner (medial canthus)  -> index 362
 * - p2: Upper eyelid lateral           -> index 385
 * - p3: Upper eyelid medial            -> index 387
 * - p4: Outer corner (lateral canthus) -> index 263
 * - p5: Lower eyelid medial            -> index 373
 * - p6: Lower eyelid lateral           -> index 380
 *
 * Right Eye (subject's right eye / observer's left):
 * - p1: Outer corner (lateral canthus) -> index 33
 * - p2: Upper eyelid lateral           -> index 160
 * - p3: Upper eyelid medial            -> index 158
 * - p4: Inner corner (medial canthus)  -> index 133
 * - p5: Lower eyelid medial            -> index 153
 * - p6: Lower eyelid lateral           -> index 144
 */
export const LEFT_EYE_LANDMARKS = {
  p1: 362,
  p2: 385,
  p3: 387,
  p4: 263,
  p5: 373,
  p6: 380
}

export const RIGHT_EYE_LANDMARKS = {
  p1: 33,
  p2: 160,
  p3: 158,
  p4: 133,
  p5: 153,
  p6: 144
}

/**
 * Computes 2D Euclidean distance between two points {x, y}.
 * Handles normalized MediaPipe coordinates safely.
 *
 * @param {object} pA - First point with {x, y}
 * @param {object} pB - Second point with {x, y}
 * @returns {number | null} - Distance or null if invalid coordinates
 */
export function euclideanDistance(pA, pB) {
  if (
    !pA ||
    !pB ||
    typeof pA.x !== 'number' ||
    typeof pA.y !== 'number' ||
    typeof pB.x !== 'number' ||
    typeof pB.y !== 'number' ||
    !Number.isFinite(pA.x) ||
    !Number.isFinite(pA.y) ||
    !Number.isFinite(pB.x) ||
    !Number.isFinite(pB.y)
  ) {
    return null
  }
  const dx = pA.x - pB.x
  const dy = pA.y - pB.y
  return Math.hypot(dx, dy)
}

/**
 * Calculates EAR for an eye given 6 specific landmark points { p1, p2, p3, p4, p5, p6 }.
 *
 * Standard Eye Aspect Ratio formula (Soukupová & Čech, 2016):
 * EAR = (||p2 - p6|| + ||p3 - p5||) / (2 * ||p1 - p4||)
 *
 * @param {object} p1 - Horizontal eye corner 1
 * @param {object} p2 - Upper eyelid vertical point 1
 * @param {object} p3 - Upper eyelid vertical point 2
 * @param {object} p4 - Horizontal eye corner 2
 * @param {object} p5 - Lower eyelid vertical point 2 (paired with p3)
 * @param {object} p6 - Lower eyelid vertical point 1 (paired with p2)
 * @returns {number | null} - Calculated EAR or null if invalid / zero width
 */
export function calculateSingleEyeEAR(p1, p2, p3, p4, p5, p6) {
  const distA = euclideanDistance(p2, p6) // Vertical distance 1
  const distB = euclideanDistance(p3, p5) // Vertical distance 2
  const distC = euclideanDistance(p1, p4) // Horizontal distance (eye width)

  if (distA === null || distB === null || distC === null) {
    return null
  }

  // Numerical safeguard: avoid division by zero or negative/negligible eye width
  const EPSILON = 1e-6
  if (distC <= EPSILON) {
    return null
  }

  const ear = (distA + distB) / (2.0 * distC)

  // Validate finite non-negative number
  if (!Number.isFinite(ear) || Number.isNaN(ear) || ear < 0) {
    return null
  }

  return ear
}

/**
 * Calculates Eye Aspect Ratio (EAR) for left, right, and combined average
 * from a MediaPipe facial landmark array.
 *
 * @param {Array<object>} landmarks - Array of normalized landmarks ({x, y, z})
 * @returns {{ leftEAR: number | null, rightEAR: number | null, ear: number | null }}
 */
export function calculateEAR(landmarks) {
  const unavailableResult = {
    leftEAR: null,
    rightEAR: null,
    ear: null
  }

  if (!Array.isArray(landmarks) || landmarks.length === 0) {
    return unavailableResult
  }

  // Find highest landmark index required across both eyes (387)
  const maxRequiredIndex = Math.max(
    ...Object.values(LEFT_EYE_LANDMARKS),
    ...Object.values(RIGHT_EYE_LANDMARKS)
  )

  if (landmarks.length <= maxRequiredIndex) {
    return unavailableResult
  }

  const getPt = (idx) => landmarks[idx]

  // Left Eye EAR
  const leftP1 = getPt(LEFT_EYE_LANDMARKS.p1)
  const leftP2 = getPt(LEFT_EYE_LANDMARKS.p2)
  const leftP3 = getPt(LEFT_EYE_LANDMARKS.p3)
  const leftP4 = getPt(LEFT_EYE_LANDMARKS.p4)
  const leftP5 = getPt(LEFT_EYE_LANDMARKS.p5)
  const leftP6 = getPt(LEFT_EYE_LANDMARKS.p6)

  const leftEAR = calculateSingleEyeEAR(leftP1, leftP2, leftP3, leftP4, leftP5, leftP6)

  // Right Eye EAR
  const rightP1 = getPt(RIGHT_EYE_LANDMARKS.p1)
  const rightP2 = getPt(RIGHT_EYE_LANDMARKS.p2)
  const rightP3 = getPt(RIGHT_EYE_LANDMARKS.p3)
  const rightP4 = getPt(RIGHT_EYE_LANDMARKS.p4)
  const rightP5 = getPt(RIGHT_EYE_LANDMARKS.p5)
  const rightP6 = getPt(RIGHT_EYE_LANDMARKS.p6)

  const rightEAR = calculateSingleEyeEAR(rightP1, rightP2, rightP3, rightP4, rightP5, rightP6)

  // Combined EAR = (leftEAR + rightEAR) / 2
  let combinedEAR = null
  if (leftEAR !== null && rightEAR !== null) {
    combinedEAR = (leftEAR + rightEAR) / 2.0
  }

  return {
    leftEAR,
    rightEAR,
    ear: combinedEAR
  }
}
