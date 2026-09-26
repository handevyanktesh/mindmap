import assert from 'node:assert'
import {
  calculateHeadPose,
  HEAD_POSE_LANDMARKS
} from './headPoseFeatures.js'

console.log('--- Running Head Pose Verification Tests ---')

// Helper to create synthetic 478-landmark array
function createNeutralLandmarks() {
  const landmarks = Array.from({ length: 478 }, () => ({ x: 0, y: 0, z: 0 }))
  landmarks[HEAD_POSE_LANDMARKS.rightEyeOuter] = { x: 0.35, y: 0.40, z: 0.00 }
  landmarks[HEAD_POSE_LANDMARKS.leftEyeOuter]  = { x: 0.65, y: 0.40, z: 0.00 }
  landmarks[HEAD_POSE_LANDMARKS.noseBridge]     = { x: 0.50, y: 0.35, z: 0.00 }
  landmarks[HEAD_POSE_LANDMARKS.chin]           = { x: 0.50, y: 0.75, z: 0.00 }
  return landmarks
}

// 1. Neutral synthetic configuration produces a valid numerical pose (~0°, ~0°, ~0°)
{
  const neutral = createNeutralLandmarks()
  const result = calculateHeadPose(neutral)

  assert(result.yaw !== null && result.pitch !== null && result.roll !== null, 'Angles must not be null')
  assert(Math.abs(result.yaw) < 0.1, `Expected yaw ~0, got ${result.yaw}`)
  assert(Math.abs(result.pitch) < 0.1, `Expected pitch ~0, got ${result.pitch}`)
  assert(Math.abs(result.roll) < 0.1, `Expected roll ~0, got ${result.roll}`)
  console.log(`✓ Test 1 Passed: Neutral pose produces near-zero orientation (Yaw: ${result.yaw}°, Pitch: ${result.pitch}°, Roll: ${result.roll}°)`)
}

// 2. Controlled horizontal transformation changes yaw in expected direction
{
  const cos20 = Math.cos(20 * Math.PI / 180)
  const sin20 = Math.sin(20 * Math.PI / 180)

  // Turn Right (+20 deg): left eye moves back (+z), right eye moves forward (-z)
  const rightTurn = createNeutralLandmarks()
  rightTurn[HEAD_POSE_LANDMARKS.rightEyeOuter] = { x: 0.50 - 0.15 * cos20, y: 0.40, z: -0.15 * sin20 }
  rightTurn[HEAD_POSE_LANDMARKS.leftEyeOuter]  = { x: 0.50 + 0.15 * cos20, y: 0.40, z: +0.15 * sin20 }
  const resRight = calculateHeadPose(rightTurn)

  // Turn Left (-20 deg): left eye moves forward (-z), right eye moves back (+z)
  const leftTurn = createNeutralLandmarks()
  leftTurn[HEAD_POSE_LANDMARKS.rightEyeOuter] = { x: 0.50 - 0.15 * cos20, y: 0.40, z: +0.15 * sin20 }
  leftTurn[HEAD_POSE_LANDMARKS.leftEyeOuter]  = { x: 0.50 + 0.15 * cos20, y: 0.40, z: -0.15 * sin20 }
  const resLeft = calculateHeadPose(leftTurn)

  assert(resRight.yaw > 0, `Right turn yaw must be positive, got ${resRight.yaw}`)
  assert(resLeft.yaw < 0, `Left turn yaw must be negative, got ${resLeft.yaw}`)
  assert(Math.abs(resRight.yaw - 20) < 0.5, `Expected right yaw ~20°, got ${resRight.yaw}`)
  assert(Math.abs(resLeft.yaw - (-20)) < 0.5, `Expected left yaw ~-20°, got ${resLeft.yaw}`)
  console.log(`✓ Test 2 Passed: Controlled horizontal turn correctly produces Yaw Right (+${resRight.yaw}°) and Yaw Left (${resLeft.yaw}°)`)
}

// 3. Controlled vertical transformation changes pitch in expected direction
{
  const cos15 = Math.cos(15 * Math.PI / 180)
  const sin15 = Math.sin(15 * Math.PI / 180)

  // Pitch Down (+15 deg): chin tilts back (+z), nose bridge forward (-z)
  const pitchDown = createNeutralLandmarks()
  pitchDown[HEAD_POSE_LANDMARKS.noseBridge] = { x: 0.50, y: 0.55 - 0.20 * cos15, z: -0.20 * sin15 }
  pitchDown[HEAD_POSE_LANDMARKS.chin]       = { x: 0.50, y: 0.55 + 0.20 * cos15, z: +0.20 * sin15 }
  const resDown = calculateHeadPose(pitchDown)

  // Pitch Up (-15 deg): chin tilts forward (-z), nose bridge back (+z)
  const pitchUp = createNeutralLandmarks()
  pitchUp[HEAD_POSE_LANDMARKS.noseBridge] = { x: 0.50, y: 0.55 - 0.20 * cos15, z: +0.20 * sin15 }
  pitchUp[HEAD_POSE_LANDMARKS.chin]       = { x: 0.50, y: 0.55 + 0.20 * cos15, z: -0.20 * sin15 }
  const resUp = calculateHeadPose(pitchUp)

  assert(resDown.pitch > 0, `Nodding down must produce positive pitch, got ${resDown.pitch}`)
  assert(resUp.pitch < 0, `Looking up must produce negative pitch, got ${resUp.pitch}`)
  assert(Math.abs(resDown.pitch - 15) < 0.5, `Expected pitch down ~15°, got ${resDown.pitch}`)
  assert(Math.abs(resUp.pitch - (-15)) < 0.5, `Expected pitch up ~-15°, got ${resUp.pitch}`)
  console.log(`✓ Test 3 Passed: Controlled vertical nod correctly produces Pitch Down (+${resDown.pitch}°) and Pitch Up (${resUp.pitch}°)`)
}

// 4. Controlled in-plane rotation changes roll in expected direction
{
  const cos10 = Math.cos(10 * Math.PI / 180)
  const sin10 = Math.sin(10 * Math.PI / 180)

  // Tilt Right Shoulder (+10 deg): right eye lowers (+y), left eye rises (-y)
  const rollRight = createNeutralLandmarks()
  rollRight[HEAD_POSE_LANDMARKS.rightEyeOuter] = { x: 0.50 - 0.15 * cos10, y: 0.40 - 0.15 * sin10, z: 0.00 }
  rollRight[HEAD_POSE_LANDMARKS.leftEyeOuter]  = { x: 0.50 + 0.15 * cos10, y: 0.40 + 0.15 * sin10, z: 0.00 }
  const resRight = calculateHeadPose(rollRight)

  // Tilt Left Shoulder (-10 deg): left eye lowers (+y), right eye rises (-y)
  const rollLeft = createNeutralLandmarks()
  rollLeft[HEAD_POSE_LANDMARKS.rightEyeOuter] = { x: 0.50 - 0.15 * cos10, y: 0.40 + 0.15 * sin10, z: 0.00 }
  rollLeft[HEAD_POSE_LANDMARKS.leftEyeOuter]  = { x: 0.50 + 0.15 * cos10, y: 0.40 - 0.15 * sin10, z: 0.00 }
  const resLeft = calculateHeadPose(rollLeft)

  assert(resRight.roll > 0, `Right tilt must produce positive roll, got ${resRight.roll}`)
  assert(resLeft.roll < 0, `Left tilt must produce negative roll, got ${resLeft.roll}`)
  assert(Math.abs(resRight.roll - 10) < 0.5, `Expected roll right ~10°, got ${resRight.roll}`)
  assert(Math.abs(resLeft.roll - (-10)) < 0.5, `Expected roll left ~-10°, got ${resLeft.roll}`)
  console.log(`✓ Test 4 Passed: Controlled in-plane tilt correctly produces Roll Right (+${resRight.roll}°) and Roll Left (${resLeft.roll}°)`)
}

// 5. Invalid/missing landmarks are handled safely
{
  assert.deepStrictEqual(calculateHeadPose(null), { yaw: null, pitch: null, roll: null })
  assert.deepStrictEqual(calculateHeadPose(undefined), { yaw: null, pitch: null, roll: null })
  assert.deepStrictEqual(calculateHeadPose([]), { yaw: null, pitch: null, roll: null })
  assert.deepStrictEqual(calculateHeadPose(Array.from({ length: 100 }, () => ({ x: 0, y: 0, z: 0 }))), { yaw: null, pitch: null, roll: null })
  console.log('✓ Test 5 Passed: Missing, null, or insufficient landmarks safely return null values')
}

// 6. Degenerate geometry does not produce NaN/Infinity
{
  const collocated = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5, z: 0.5 }))
  const resCollocated = calculateHeadPose(collocated)
  assert.strictEqual(resCollocated.yaw, null)
  assert.strictEqual(resCollocated.pitch, null)
  assert.strictEqual(resCollocated.roll, null)

  const nonFinite = createNeutralLandmarks()
  nonFinite[HEAD_POSE_LANDMARKS.noseBridge] = { x: NaN, y: 0.5, z: 0 }
  const resNonFinite = calculateHeadPose(nonFinite)
  assert.strictEqual(resNonFinite.yaw, null)

  console.log('✓ Test 6 Passed: Degenerate geometry and non-finite coordinates safely return null without NaN/Infinity')
}

console.log('--- All 6 Head Pose Verification Tests Passed! ---')
