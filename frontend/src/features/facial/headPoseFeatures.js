/**
 * MediaPipe Face Landmarker Head Pose Estimation
 *
 * Derives 3D head orientation (Yaw, Pitch, Roll in degrees) from
 * facial landmarks using a 3D orthonormal facial coordinate basis.
 *
 * Centralized Landmark Correspondences:
 * - Right Eye Outer Corner: Index 33  (lateral canthus, stable rigid skull point)
 * - Left Eye Outer Corner:  Index 263 (lateral canthus, stable rigid skull point)
 * - Nose Bridge (Sellion):  Index 168 (glabella/nasal bone junction, rigid)
 * - Nose Tip:               Index 1   (nasal apex, sagittal protrusion)
 * - Chin (Gnathion):        Index 152 (mental protuberance, vertical lower boundary)
 * - Right Mouth Corner:     Index 61  (cheilion)
 * - Left Mouth Corner:      Index 291 (cheilion)
 *
 * Geometric Coordinate System:
 * - Defined in camera image space: X points right, Y points down, Z points forward.
 * - Transverse Axis (uX): Normalized vector pointing from Right Eye (33) to Left Eye (263).
 * - Vertical Axis (uY):   Vector from Nose Bridge (168) to Chin (152).
 * - Sagittal Normal (uZ): Orthonormal cross product (uX x uY) pointing out of the face.
 *
 * Sign Conventions:
 * - Yaw (degrees):
 *     Horizontal head rotation around the vertical Y axis.
 *     + = Turning head to the right
 *     - = Turning head to the left
 *     0° = Frontal orientation facing camera
 * - Pitch (degrees):
 *     Vertical head rotation around the transverse X axis.
 *     + = Nodding head down (chin down)
 *     - = Looking head up (chin up)
 *     0° = Level head orientation
 * - Roll (degrees):
 *     In-plane head rotation around the sagittal optical Z axis.
 *     + = Tilting head toward the right shoulder
 *     - = Tilting head toward the left shoulder
 *     0° = Level horizontal eye axis
 */

export const HEAD_POSE_LANDMARKS = {
  rightEyeOuter: 33,
  leftEyeOuter: 263,
  noseBridge: 168,
  noseTip: 1,
  chin: 152,
  rightMouthCorner: 61,
  leftMouthCorner: 291
}

/**
 * Calculates 3D Head Pose (Yaw, Pitch, Roll in degrees) from MediaPipe landmarks.
 *
 * @param {Array<object>} landmarks - 478 normalized facial landmarks ({x, y, z})
 * @returns {{ yaw: number | null, pitch: number | null, roll: number | null }}
 */
export function calculateHeadPose(landmarks) {
  const unavailableResult = {
    yaw: null,
    pitch: null,
    roll: null
  }

  if (!Array.isArray(landmarks) || landmarks.length < 264) {
    return unavailableResult
  }

  const pRight = landmarks[HEAD_POSE_LANDMARKS.rightEyeOuter]
  const pLeft = landmarks[HEAD_POSE_LANDMARKS.leftEyeOuter]
  const pBridge = landmarks[HEAD_POSE_LANDMARKS.noseBridge]
  const pChin = landmarks[HEAD_POSE_LANDMARKS.chin]

  if (!pRight || !pLeft || !pBridge || !pChin) {
    return unavailableResult
  }

  const pts = [pRight, pLeft, pBridge, pChin]
  for (let i = 0; i < pts.length; i++) {
    const pt = pts[i]
    if (
      typeof pt.x !== 'number' ||
      typeof pt.y !== 'number' ||
      typeof pt.z !== 'number' ||
      !Number.isFinite(pt.x) ||
      !Number.isFinite(pt.y) ||
      !Number.isFinite(pt.z)
    ) {
      return unavailableResult
    }
  }

  const EPSILON = 1e-6

  // 1. Transverse vector (Right Eye to Left Eye)
  const vx = {
    x: pLeft.x - pRight.x,
    y: pLeft.y - pRight.y,
    z: pLeft.z - pRight.z
  }
  const lenX = Math.hypot(vx.x, vx.y, vx.z)
  if (lenX <= EPSILON) {
    return unavailableResult
  }
  const ux = {
    x: vx.x / lenX,
    y: vx.y / lenX,
    z: vx.z / lenX
  }

  // 2. Vertical vector (Nose Bridge to Chin)
  const vy = {
    x: pChin.x - pBridge.x,
    y: pChin.y - pBridge.y,
    z: pChin.z - pBridge.z
  }
  const lenY = Math.hypot(vy.x, vy.y, vy.z)
  if (lenY <= EPSILON) {
    return unavailableResult
  }

  // 3. Sagittal normal vector (ux cross vy)
  const vz = {
    x: ux.y * vy.z - ux.z * vy.y,
    y: ux.z * vy.x - ux.x * vy.z,
    z: ux.x * vy.y - ux.y * vy.x
  }
  const lenZ = Math.hypot(vz.x, vz.y, vz.z)
  if (lenZ <= EPSILON) {
    return unavailableResult
  }
  const uz = {
    x: vz.x / lenZ,
    y: vz.y / lenZ,
    z: vz.z / lenZ
  }

  const toDeg = 180 / Math.PI

  // Extract Euler angles with defined sign conventions:
  // Yaw: horizontal rotation around Y. Turning right = positive, turning left = negative.
  const rawYaw = -Math.atan2(uz.x, uz.z) * toDeg

  // Pitch: vertical rotation around X. Looking down = positive, looking up = negative.
  const rawPitch = Math.asin(Math.max(-1, Math.min(1, -uz.y))) * toDeg

  // Roll: in-plane rotation around Z. Tilting toward right shoulder = positive, left = negative.
  const rawRoll = Math.atan2(ux.y, ux.x) * toDeg

  if (
    !Number.isFinite(rawYaw) ||
    !Number.isFinite(rawPitch) ||
    !Number.isFinite(rawRoll)
  ) {
    return unavailableResult
  }

  return {
    yaw: +rawYaw.toFixed(1),
    pitch: +rawPitch.toFixed(1),
    roll: +rawRoll.toFixed(1)
  }
}
