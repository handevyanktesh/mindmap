/**
 * Behavioural Inference State Machine
 *
 * Implements deterministic temporal hysteresis to prevent flickering of
 * displayed behavioural states.
 *
 * Rule:
 * A candidate state must be observed in STATE_CONFIRMATION_WINDOWS (2)
 * consecutive inference windows before becoming the stable displayed state.
 */

import {
  STATE_CONFIRMATION_WINDOWS,
  ENGAGEMENT_STATE,
  CONFUSION_STATE
} from './inferenceConstants.js'

import { inferEngagementCandidate } from './engagementInference.js'
import { inferConfusionCandidate } from './confusionInference.js'

export class InferenceStateMachine {
  /**
   * @param {object} [options]
   * @param {number} [options.confirmationWindows=STATE_CONFIRMATION_WINDOWS]
   */
  constructor(options = {}) {
    this.confirmationWindows = options.confirmationWindows || STATE_CONFIRMATION_WINDOWS
    this.reset()
  }

  /**
   * Resets internal hysteresis counters and stable states.
   */
  reset() {
    this.stableEngagementState = ENGAGEMENT_STATE.UNCERTAIN
    this.pendingEngagementState = null
    this.engagementCandidateCount = 0

    this.stableConfusionState = CONFUSION_STATE.UNCERTAIN
    this.pendingConfusionState = null
    this.confusionCandidateCount = 0

    this.lastInference = this._createEmptyResult()
  }

  /**
   * Evaluates one observation cycle, updates hysteresis filters, and returns
   * the full interpretable behavioural inference result.
   *
   * @param {object} params
   * @param {object} params.deviations - { ear, gaze, headPose } from baselineTracker
   * @param {boolean} params.baselineReady - Whether baseline is established
   * @param {object} [params.temporalData] - Windowed temporal stats
   * @param {number} [params.sustainedDurationMs=0] - Observed sustained duration in ms
   * @returns {object} Full inference output
   */
  update(params) {
    const engagementCandidate = inferEngagementCandidate(params)
    const confusionCandidate = inferConfusionCandidate(params)

    // Apply Hysteresis: Engagement-related State
    this.stableEngagementState = this._updateStateHysteresis(
      this.stableEngagementState,
      engagementCandidate.state,
      'engagement'
    )

    // Apply Hysteresis: Confusion-related State
    this.stableConfusionState = this._updateStateHysteresis(
      this.stableConfusionState,
      confusionCandidate.state,
      'confusion'
    )

    // Quality Summary
    const coverage = engagementCandidate.coverage !== undefined ? engagementCandidate.coverage : 0.0
    const agreement = engagementCandidate.agreement !== undefined ? engagementCandidate.agreement : null
    const baselineReady = Boolean(params?.baselineReady)
    const temporalReady = Boolean(params?.temporalData && params.temporalData.sampleCount >= 5)

    let qualityRating = 'Limited'
    if (baselineReady && temporalReady && coverage >= 1.0) {
      qualityRating = 'High'
    } else if (baselineReady && temporalReady && coverage >= 0.6) {
      qualityRating = 'Moderate'
    }

    this.lastInference = {
      engagement: {
        state: this.stableEngagementState,
        candidateState: engagementCandidate.state,
        evidence: engagementCandidate.evidence,
        confidence: engagementCandidate.confidence
      },
      confusion: {
        state: this.stableConfusionState,
        candidateState: confusionCandidate.state,
        evidence: confusionCandidate.evidence,
        confidence: confusionCandidate.confidence
      },
      quality: {
        coverage,
        agreement,
        baselineReady,
        temporalReady,
        rating: qualityRating
      },
      modalityEvidence: engagementCandidate.intensities || {
        ear: null,
        gaze: null,
        pose: null
      }
    }

    return this.lastInference
  }

  /**
   * Internal hysteresis transition evaluator.
   *
   * @private
   * @param {string} currentStable
   * @param {string} candidate
   * @param {'engagement'|'confusion'} type
   * @returns {string} New stable state
   */
  _updateStateHysteresis(currentStable, candidate, type) {
    const isPendingMatch = type === 'engagement'
      ? this.pendingEngagementState === candidate
      : this.pendingConfusionState === candidate

    if (candidate === currentStable) {
      // Current candidate matches stable state; reset pending candidate
      if (type === 'engagement') {
        this.pendingEngagementState = null
        this.engagementCandidateCount = 0
      } else {
        this.pendingConfusionState = null
        this.confusionCandidateCount = 0
      }
      return currentStable
    }

    // New candidate differs from current stable state
    if (isPendingMatch) {
      if (type === 'engagement') {
        this.engagementCandidateCount++
        if (this.engagementCandidateCount >= this.confirmationWindows) {
          this.stableEngagementState = candidate
          this.pendingEngagementState = null
          this.engagementCandidateCount = 0
          return candidate
        }
      } else {
        this.confusionCandidateCount++
        if (this.confusionCandidateCount >= this.confirmationWindows) {
          this.stableConfusionState = candidate
          this.pendingConfusionState = null
          this.confusionCandidateCount = 0
          return candidate
        }
      }
    } else {
      // First occurrence of new candidate
      if (type === 'engagement') {
        this.pendingEngagementState = candidate
        this.engagementCandidateCount = 1
        if (this.confirmationWindows <= 1) {
          this.stableEngagementState = candidate
          return candidate
        }
      } else {
        this.pendingConfusionState = candidate
        this.confusionCandidateCount = 1
        if (this.confirmationWindows <= 1) {
          this.stableConfusionState = candidate
          return candidate
        }
      }
    }

    return currentStable
  }

  /**
   * Generates the initial empty result schema.
   *
   * @private
   * @returns {object}
   */
  _createEmptyResult() {
    return {
      engagement: {
        state: ENGAGEMENT_STATE.UNCERTAIN,
        candidateState: ENGAGEMENT_STATE.UNCERTAIN,
        evidence: null,
        confidence: 0.0
      },
      confusion: {
        state: CONFUSION_STATE.UNCERTAIN,
        candidateState: CONFUSION_STATE.UNCERTAIN,
        evidence: null,
        confidence: 0.0
      },
      quality: {
        coverage: 0.0,
        agreement: null,
        baselineReady: false,
        temporalReady: false,
        rating: 'Limited'
      },
      modalityEvidence: {
        ear: null,
        gaze: null,
        pose: null
      }
    }
  }

  /**
   * Returns the last computed inference state.
   *
   * @returns {object}
   */
  getState() {
    return this.lastInference
  }
}
