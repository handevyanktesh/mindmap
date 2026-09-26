import assert from 'node:assert'
import {
  calculateEyeGaze,
  calculateGaze,
  LEFT_IRIS_LANDMARKS,
  RIGHT_IRIS_LANDMARKS,
  LEFT_EYE_BOUNDS,
  RIGHT_EYE_BOUNDS
} from './gazeFeatures.js'

console.log('--- Running Gaze Features Verification Tests ---')

// 1. Centered iris position produces expected normalized gaze value (~0.5, 0.5)
{
  const c1 = { x: 0.20, y: 0.50 }
  const c2 = { x: 0.40, y: 0.50 } // width = 0.20, midpoint = 0.30
  const top = { x: 0.30, y: 0.40 }
  const bottom = { x: 0.30, y: 0.60 } // height = 0.20, midpoint = 0.50
  const irisCenter = { x: 0.30, y: 0.50 } // exactly center

  const result = calculateEyeGaze(irisCenter, c1, c2, top, bottom)
  assert(result.gazeX !== null && result.gazeY !== null, 'gazeX and gazeY should not be null')
  assert(Math.abs(result.gazeX - 0.5) < 1e-6, `Expected gazeX 0.5, got ${result.gazeX}`)
  assert(Math.abs(result.gazeY - 0.5) < 1e-6, `Expected gazeY 0.5, got ${result.gazeY}`)
  console.log('✓ Test 1 Passed: Centered iris produces expected (0.50, 0.50) gaze')
}

// 2. Iris movement toward one side changes gazeX in expected direction
{
  const c1 = { x: 0.20, y: 0.50 }
  const c2 = { x: 0.40, y: 0.50 }
  const top = { x: 0.30, y: 0.40 }
  const bottom = { x: 0.30, y: 0.60 }

  const irisLeft = { x: 0.24, y: 0.50 }   // 20% across -> gazeX = 0.20
  const irisCenter = { x: 0.30, y: 0.50 } // 50% across -> gazeX = 0.50
  const irisRight = { x: 0.36, y: 0.50 }  // 80% across -> gazeX = 0.80

  const resLeft = calculateEyeGaze(irisLeft, c1, c2, top, bottom)
  const resCenter = calculateEyeGaze(irisCenter, c1, c2, top, bottom)
  const resRight = calculateEyeGaze(irisRight, c1, c2, top, bottom)

  assert(resLeft.gazeX < resCenter.gazeX, 'Moving left must decrease gazeX')
  assert(resCenter.gazeX < resRight.gazeX, 'Moving right must increase gazeX')
  assert(Math.abs(resLeft.gazeX - 0.20) < 1e-6, `Expected 0.20, got ${resLeft.gazeX}`)
  assert(Math.abs(resRight.gazeX - 0.80) < 1e-6, `Expected 0.80, got ${resRight.gazeX}`)
  console.log(`✓ Test 2 Passed: Horizontal iris shift correctly changes gazeX (${resLeft.gazeX.toFixed(2)} -> ${resCenter.gazeX.toFixed(2)} -> ${resRight.gazeX.toFixed(2)})`)
}

// 3. Iris movement vertically changes gazeY appropriately
{
  const c1 = { x: 0.20, y: 0.50 }
  const c2 = { x: 0.40, y: 0.50 }
  const top = { x: 0.30, y: 0.40 }
  const bottom = { x: 0.30, y: 0.60 }

  const irisUp = { x: 0.30, y: 0.44 }   // Looking up (closer to top y=0.40) -> gazeY = 0.20
  const irisCenter = { x: 0.30, y: 0.50 }
  const irisDown = { x: 0.30, y: 0.56 } // Looking down (closer to bottom y=0.60) -> gazeY = 0.80

  const resUp = calculateEyeGaze(irisUp, c1, c2, top, bottom)
  const resCenter = calculateEyeGaze(irisCenter, c1, c2, top, bottom)
  const resDown = calculateEyeGaze(irisDown, c1, c2, top, bottom)

  assert(resUp.gazeY < resCenter.gazeY, 'Looking up must decrease gazeY')
  assert(resCenter.gazeY < resDown.gazeY, 'Looking down must increase gazeY')
  assert(Math.abs(resUp.gazeY - 0.20) < 1e-6, `Expected gazeY 0.20, got ${resUp.gazeY}`)
  assert(Math.abs(resDown.gazeY - 0.80) < 1e-6, `Expected gazeY 0.80, got ${resDown.gazeY}`)
  console.log(`✓ Test 3 Passed: Vertical iris shift correctly changes gazeY (${resUp.gazeY.toFixed(2)} -> ${resCenter.gazeY.toFixed(2)} -> ${resDown.gazeY.toFixed(2)})`)
}

// 4. Left and right eye values combine correctly
{
  const synthetic = Array.from({ length: 478 }, () => ({ x: 0, y: 0, z: 0 }))

  // Left Eye setup (Observer's right side of image)
  // cornerInner: 362 (x=0.60), cornerOuter: 263 (x=0.80), center x=0.70
  // upper: 386 (y=0.40), lower: 374 (y=0.60)
  synthetic[LEFT_EYE_BOUNDS.cornerInner] = { x: 0.60, y: 0.50 }
  synthetic[LEFT_EYE_BOUNDS.cornerOuter] = { x: 0.80, y: 0.50 }
  synthetic[LEFT_EYE_BOUNDS.eyelidUpper] = { x: 0.70, y: 0.40 }
  synthetic[LEFT_EYE_BOUNDS.eyelidLower] = { x: 0.70, y: 0.60 }
  // Left iris at 60% horizontal (0.72) and 40% vertical (0.48)
  synthetic[LEFT_IRIS_LANDMARKS.center] = { x: 0.72, y: 0.48 } // gazeX = 0.60, gazeY = 0.40

  // Right Eye setup (Observer's left side of image)
  // cornerOuter: 33 (x=0.20), cornerInner: 133 (x=0.40)
  // upper: 159 (y=0.40), lower: 145 (y=0.60)
  synthetic[RIGHT_EYE_BOUNDS.cornerOuter] = { x: 0.20, y: 0.50 }
  synthetic[RIGHT_EYE_BOUNDS.cornerInner] = { x: 0.40, y: 0.50 }
  synthetic[RIGHT_EYE_BOUNDS.eyelidUpper] = { x: 0.30, y: 0.40 }
  synthetic[RIGHT_EYE_BOUNDS.eyelidLower] = { x: 0.30, y: 0.60 }
  // Right iris at 40% horizontal (0.28) and 60% vertical (0.52)
  synthetic[RIGHT_IRIS_LANDMARKS.center] = { x: 0.28, y: 0.52 } // gazeX = 0.40, gazeY = 0.60

  const result = calculateGaze(synthetic)
  assert(Math.abs(result.leftGazeX - 0.60) < 1e-6, `Expected leftGazeX 0.60, got ${result.leftGazeX}`)
  assert(Math.abs(result.rightGazeX - 0.40) < 1e-6, `Expected rightGazeX 0.40, got ${result.rightGazeX}`)
  assert(Math.abs(result.gazeX - 0.50) < 1e-6, `Expected combined gazeX 0.50, got ${result.gazeX}`)

  assert(Math.abs(result.leftGazeY - 0.40) < 1e-6, `Expected leftGazeY 0.40, got ${result.leftGazeY}`)
  assert(Math.abs(result.rightGazeY - 0.60) < 1e-6, `Expected rightGazeY 0.60, got ${result.rightGazeY}`)
  assert(Math.abs(result.gazeY - 0.50) < 1e-6, `Expected combined gazeY 0.50, got ${result.gazeY}`)

  console.log(`✓ Test 4 Passed: Left (X:${result.leftGazeX.toFixed(2)}, Y:${result.leftGazeY.toFixed(2)}) & Right (X:${result.rightGazeX.toFixed(2)}, Y:${result.rightGazeY.toFixed(2)}) combined to (X:${result.gazeX.toFixed(2)}, Y:${result.gazeY.toFixed(2)})`)
}

// 5. Missing iris landmarks (<478) are handled safely
{
  const partial = Array.from({ length: 468 }, () => ({ x: 0.5, y: 0.5 }))
  const resPartial = calculateGaze(partial)
  assert.strictEqual(resPartial.gazeX, null)
  assert.strictEqual(resPartial.gazeY, null)
  assert.strictEqual(resPartial.leftGazeX, null)
  assert.strictEqual(resPartial.rightGazeX, null)
  console.log('✓ Test 5 Passed: Missing iris landmarks (<478) safely return null without throwing')
}

// 6. Zero eye width/height does not produce NaN/Infinity
{
  const pSame = { x: 0.30, y: 0.50 }
  const resultZero = calculateEyeGaze(pSame, pSame, pSame, pSame, pSame)
  assert.strictEqual(resultZero.gazeX, null, 'Zero eye width must safely return null instead of NaN/Infinity')
  assert.strictEqual(resultZero.gazeY, null, 'Zero eye height must safely return null instead of NaN/Infinity')
  console.log('✓ Test 6 Passed: Zero eye dimensions safely produce null instead of NaN or Infinity')
}

// 7. Invalid coordinates are handled safely
{
  assert.strictEqual(calculateEyeGaze(null, {}, {}, {}, {}).gazeX, null)
  assert.strictEqual(calculateEyeGaze({ x: NaN, y: 0.5 }, { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0.5, y: -1 }, { x: 0.5, y: 1 }).gazeX, null)
  assert.strictEqual(calculateEyeGaze({ x: 'invalid', y: 0.5 }, { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0.5, y: -1 }, { x: 0.5, y: 1 }).gazeX, null)
  assert.deepStrictEqual(calculateGaze(null), {
    leftGazeX: null,
    rightGazeX: null,
    gazeX: null,
    leftGazeY: null,
    rightGazeY: null,
    gazeY: null
  })
  console.log('✓ Test 7 Passed: Invalid coordinates, NaN, and null safely handled without errors')
}

console.log('--- All 7 Gaze Verification Tests Passed! ---')
