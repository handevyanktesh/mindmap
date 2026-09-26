import assert from 'node:assert'
import {
  euclideanDistance,
  calculateSingleEyeEAR,
  calculateEAR,
  LEFT_EYE_LANDMARKS,
  RIGHT_EYE_LANDMARKS
} from './eyeFeatures.js'

console.log('--- Running EAR Utility Verification Tests ---')

// 1. Valid symmetric eye landmarks produce a valid EAR
{
  const p1 = { x: 0.2, y: 0.5 }
  const p4 = { x: 0.4, y: 0.5 } // width = 0.20
  const p2 = { x: 0.26, y: 0.46 }
  const p6 = { x: 0.26, y: 0.54 } // height1 = 0.08
  const p3 = { x: 0.34, y: 0.46 }
  const p5 = { x: 0.34, y: 0.54 } // height2 = 0.08

  const ear = calculateSingleEyeEAR(p1, p2, p3, p4, p5, p6)
  assert(typeof ear === 'number' && Number.isFinite(ear), 'EAR should be a finite number')
  // Expected: (0.08 + 0.08) / (2 * 0.20) = 0.16 / 0.40 = 0.40
  assert(Math.abs(ear - 0.4) < 1e-6, `Expected EAR 0.40, got ${ear}`)
  console.log('✓ Test 1 Passed: Valid eye landmarks produce expected EAR (0.40)')
}

// 2. Different vertical eye openness changes EAR as expected
{
  const p1 = { x: 0.2, y: 0.5 }
  const p4 = { x: 0.4, y: 0.5 }

  // Open eye
  const openP2 = { x: 0.26, y: 0.45 }
  const openP6 = { x: 0.26, y: 0.55 } // height 0.10
  const openP3 = { x: 0.34, y: 0.45 }
  const openP5 = { x: 0.34, y: 0.55 } // height 0.10
  const openEAR = calculateSingleEyeEAR(p1, openP2, openP3, p4, openP5, openP6)

  // Partially closed eye
  const closedP2 = { x: 0.26, y: 0.48 }
  const closedP6 = { x: 0.26, y: 0.52 } // height 0.04
  const closedP3 = { x: 0.34, y: 0.48 }
  const closedP5 = { x: 0.34, y: 0.52 } // height 0.04
  const closedEAR = calculateSingleEyeEAR(p1, closedP2, closedP3, p4, closedP5, closedP6)

  assert(openEAR > closedEAR, `Open EAR (${openEAR}) must be strictly greater than closed EAR (${closedEAR})`)
  console.log(`✓ Test 2 Passed: Open eye EAR (${openEAR.toFixed(2)}) > Closed eye EAR (${closedEAR.toFixed(2)})`)
}

// 3. Invalid/missing landmarks do not crash
{
  assert.deepStrictEqual(calculateEAR(null), { leftEAR: null, rightEAR: null, ear: null })
  assert.deepStrictEqual(calculateEAR(undefined), { leftEAR: null, rightEAR: null, ear: null })
  assert.deepStrictEqual(calculateEAR([]), { leftEAR: null, rightEAR: null, ear: null })
  assert.deepStrictEqual(calculateEAR([{ x: 0, y: 0 }]), { leftEAR: null, rightEAR: null, ear: null })
  assert.strictEqual(euclideanDistance(null, { x: 1, y: 1 }), null)
  assert.strictEqual(euclideanDistance({ x: 'a', y: 1 }, { x: 1, y: 1 }), null)
  assert.strictEqual(euclideanDistance({ x: NaN, y: 1 }, { x: 1, y: 1 }), null)
  console.log('✓ Test 3 Passed: Invalid, empty, or missing landmarks handled safely without exceptions')
}

// 4. Zero horizontal eye distance does not produce NaN/Infinity
{
  const pSame = { x: 0.3, y: 0.5 }
  const pTop = { x: 0.3, y: 0.4 }
  const pBottom = { x: 0.3, y: 0.6 }
  const earZeroWidth = calculateSingleEyeEAR(pSame, pTop, pTop, pSame, pBottom, pBottom)
  assert.strictEqual(earZeroWidth, null, 'Zero eye width must safely return null instead of Infinity/NaN')
  console.log('✓ Test 4 Passed: Zero horizontal distance handled safely without NaN/Infinity')
}

// 5. Both left and right eye values are combined correctly
{
  // Build a synthetic 478-landmark array
  const syntheticLandmarks = Array.from({ length: 478 }, () => ({ x: 0, y: 0, z: 0 }))

  // Configure Left Eye for EAR = 0.30: width = 0.20, heights = 0.06 -> (0.06+0.06)/(2*0.20) = 0.30
  syntheticLandmarks[LEFT_EYE_LANDMARKS.p1] = { x: 0.6, y: 0.5 }
  syntheticLandmarks[LEFT_EYE_LANDMARKS.p4] = { x: 0.8, y: 0.5 }
  syntheticLandmarks[LEFT_EYE_LANDMARKS.p2] = { x: 0.66, y: 0.47 }
  syntheticLandmarks[LEFT_EYE_LANDMARKS.p6] = { x: 0.66, y: 0.53 }
  syntheticLandmarks[LEFT_EYE_LANDMARKS.p3] = { x: 0.74, y: 0.47 }
  syntheticLandmarks[LEFT_EYE_LANDMARKS.p5] = { x: 0.74, y: 0.53 }

  // Configure Right Eye for EAR = 0.20: width = 0.20, heights = 0.04 -> (0.04+0.04)/(2*0.20) = 0.20
  syntheticLandmarks[RIGHT_EYE_LANDMARKS.p1] = { x: 0.2, y: 0.5 }
  syntheticLandmarks[RIGHT_EYE_LANDMARKS.p4] = { x: 0.4, y: 0.5 }
  syntheticLandmarks[RIGHT_EYE_LANDMARKS.p2] = { x: 0.26, y: 0.48 }
  syntheticLandmarks[RIGHT_EYE_LANDMARKS.p6] = { x: 0.26, y: 0.52 }
  syntheticLandmarks[RIGHT_EYE_LANDMARKS.p3] = { x: 0.34, y: 0.48 }
  syntheticLandmarks[RIGHT_EYE_LANDMARKS.p5] = { x: 0.34, y: 0.52 }

  const result = calculateEAR(syntheticLandmarks)
  assert(Math.abs(result.leftEAR - 0.30) < 1e-6, `Expected leftEAR 0.30, got ${result.leftEAR}`)
  assert(Math.abs(result.rightEAR - 0.20) < 1e-6, `Expected rightEAR 0.20, got ${result.rightEAR}`)
  assert(Math.abs(result.ear - 0.25) < 1e-6, `Expected combined ear 0.25, got ${result.ear}`)
  console.log(`✓ Test 5 Passed: Left (${result.leftEAR.toFixed(2)}) and Right (${result.rightEAR.toFixed(2)}) combined to average (${result.ear.toFixed(2)})`)
}

console.log('--- All 5 EAR Verification Tests Passed! ---')
