/**
 * Behavioural Inference Constants
 *
 * Explicitly named engineering baseline parameters for deterministic inference.
 *
 * NOTE: These thresholds and weights are initial engineering design parameters
 * and have not yet been empirically calibrated on a labelled clinical or
 * ground-truth dataset.
 */

// ============================================================================
// PART 1: Normalized Deviation Thresholds
// ============================================================================
/**
 * Reference deviation thresholds representing the magnitude of departure from personal baseline
 * that corresponds to full normalized intensity (1.0).
 */
export const EAR_DEVIATION_THRESHOLD = 0.10     // Dimensionless EAR departure
export const GAZE_DEVIATION_THRESHOLD = 0.15    // 2D Euclidean distance departure in normalized eye coords
export const POSE_DEVIATION_THRESHOLD = 20.0    // Degrees 3D angular departure from baseline posture

// ============================================================================
// PART 2: Modality Evidence Weights (sum = 1.0)
// ============================================================================
export const MODALITY_WEIGHT_EAR = 0.25
export const MODALITY_WEIGHT_GAZE = 0.40
export const MODALITY_WEIGHT_POSE = 0.35

// ============================================================================
// PART 3: Modality Coverage
// ============================================================================
export const TOTAL_EXPECTED_MODALITIES = 3

// ============================================================================
// PART 4: Cross-Modal Agreement
// ============================================================================
export const AGREEMENT_INTENSITY_THRESHOLD = 0.50

// ============================================================================
// PART 5: Persistence
// ============================================================================
export const PERSISTENCE_TARGET_MS = 4000 // 4.0 seconds sustained duration target

// ============================================================================
// PART 6: Engagement-Related Evidence Weights (sum = 1.0)
// ============================================================================
export const ENGAGEMENT_MODALITY_WEIGHT = 0.55
export const ENGAGEMENT_PERSISTENCE_WEIGHT = 0.30
export const ENGAGEMENT_AGREEMENT_WEIGHT = 0.15

// ============================================================================
// PART 7: Engagement-Related Evidence State Thresholds
// ============================================================================
export const ENGAGEMENT_THRESHOLD = 0.35
export const ENGAGEMENT_STATE_MODERATE_THRESHOLD = 0.35 // Backwards-compatible alias

export const ENGAGEMENT_STATE = {
  NORMAL: 'NORMAL_BEHAVIOUR',
  REDUCED: 'REDUCED_ENGAGEMENT_LIKE',
  UNCERTAIN: 'UNCERTAIN'
}

// ============================================================================
// PART 8: Confidence Weights (sum = 1.0)
// ============================================================================
export const CONFIDENCE_COVERAGE_WEIGHT = 0.40
export const CONFIDENCE_PERSISTENCE_WEIGHT = 0.35
export const CONFIDENCE_EVIDENCE_WEIGHT = 0.25

// ============================================================================
// PART 10: Confusion-Related Evidence Weights (sum = 1.0)
// ============================================================================
export const CONFUSION_GAZE_WEIGHT = 0.40
export const CONFUSION_POSE_WEIGHT = 0.30
export const CONFUSION_DEVIATION_WEIGHT = 0.20
export const CONFUSION_PERSISTENCE_WEIGHT = 0.10

// Scaling reference constants for confusion raw instability signals
export const CONFUSION_GAZE_INSTABILITY_SCALE = 0.20  // stdX/Y scale
export const CONFUSION_POSE_INSTABILITY_SCALE = 15.0  // degrees pose angular std scale

// ============================================================================
// PART 11: Confusion Signal State Thresholds
// ============================================================================
export const CONFUSION_THRESHOLD = 0.35
export const CONFUSION_STATE_ELEVATED_THRESHOLD = 0.35 // Backwards-compatible alias

export const CONFUSION_STATE = {
  LOW: 'LOW',
  ELEVATED: 'ELEVATED',
  UNCERTAIN: 'UNCERTAIN'
}

// ============================================================================
// PART 12: State Hysteresis
// ============================================================================
export const STATE_CONFIRMATION_WINDOWS = 2
