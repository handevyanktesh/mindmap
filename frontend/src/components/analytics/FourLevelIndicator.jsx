import React from 'react'

/**
 * Standardized Four-Level Behavioural Indicator
 *
 * Maps attention-related and confusion-related signals into four standardized,
 * non-judgmental descriptive categories: Very Low, Low, Moderate, High, or Uncertain.
 *
 * Strict Guardrails:
 * - Does NOT present heuristic scores as empirical class probabilities or diagnostic labels.
 * - Represents uncertainty and missing data explicitly.
 */

export function mapScoreToFourLevel(type, score, state = null) {
  if (score === null || score === undefined || Number.isNaN(score) || state === 'UNCERTAIN') {
    return 'uncertain'
  }

  // If score is 0-100 percentage
  const normalized = score > 1 ? score / 100 : score

  if (type === 'attention') {
    // Normal behaviour corresponds to high attention; reduced corresponds to lower attention
    if (state === 'NORMAL_BEHAVIOUR') {
      return normalized >= 0.70 ? 'high' : 'moderate'
    }
    if (state === 'REDUCED_ENGAGEMENT_LIKE') {
      return normalized >= 0.40 ? 'low' : 'very_low'
    }
    // Continuous fallback if state is not provided
    if (normalized >= 0.75) return 'high'
    if (normalized >= 0.50) return 'moderate'
    if (normalized >= 0.25) return 'low'
    return 'very_low'
  }

  if (type === 'confusion') {
    // Low confusion is positive; elevated is higher intensity
    if (state === 'LOW') {
      return normalized < 0.20 ? 'very_low' : 'low'
    }
    if (state === 'ELEVATED') {
      return normalized >= 0.55 ? 'high' : 'moderate'
    }
    // Continuous fallback if state is not provided
    if (normalized >= 0.65) return 'high'
    if (normalized >= 0.40) return 'moderate'
    if (normalized >= 0.15) return 'low'
    return 'very_low'
  }

  return 'uncertain'
}

export const LEVEL_CONFIG = {
  attention: {
    high: {
      label: 'High Attention',
      badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
      dotClass: 'bg-emerald-500',
      barClass: 'bg-emerald-500',
      description: 'Engagement signals are steady and focused relative to your baseline.'
    },
    moderate: {
      label: 'Moderate Attention',
      badgeClass: 'bg-blue-50 text-blue-800 border-blue-200',
      dotClass: 'bg-blue-500',
      barClass: 'bg-blue-500',
      description: 'Focus signals are within normal expected classroom variations.'
    },
    low: {
      label: 'Low Attention',
      badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
      dotClass: 'bg-amber-500',
      barClass: 'bg-amber-500',
      description: 'Observable gaze or posture has drifted away from the active screen.'
    },
    very_low: {
      label: 'Very Low Attention',
      badgeClass: 'bg-rose-50 text-rose-800 border-rose-200',
      dotClass: 'bg-rose-500',
      barClass: 'bg-rose-500',
      description: 'Noticeable reduction in screen engagement detected over recent frames.'
    },
    uncertain: {
      label: 'Not enough data yet',
      badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
      dotClass: 'bg-slate-400',
      barClass: 'bg-slate-300',
      description: 'Calibrating personal baseline or awaiting steady camera observations.'
    }
  },
  confusion: {
    very_low: {
      label: 'Very Low Confusion',
      badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
      dotClass: 'bg-emerald-500',
      barClass: 'bg-emerald-500',
      description: 'Steady gaze and posture indicate lesson material is being followed smoothly.'
    },
    low: {
      label: 'Low Confusion',
      badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
      dotClass: 'bg-slate-500',
      barClass: 'bg-slate-400',
      description: 'Gaze direction and head orientation remain stable.'
    },
    moderate: {
      label: 'Moderate Confusion',
      badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
      dotClass: 'bg-amber-500',
      barClass: 'bg-amber-500',
      description: 'Slightly elevated gaze shifts and head adjustments detected.'
    },
    high: {
      label: 'Elevated Confusion',
      badgeClass: 'bg-rose-50 text-rose-800 border-rose-200',
      dotClass: 'bg-rose-500',
      barClass: 'bg-rose-500',
      description: 'Frequent re-centering and posture adjustments indicate potential confusion.'
    },
    uncertain: {
      label: 'Not enough data yet',
      badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
      dotClass: 'bg-slate-400',
      barClass: 'bg-slate-300',
      description: 'Awaiting sufficient video observation frames to evaluate signals.'
    }
  }
}

export default function FourLevelIndicator({
  type = 'attention', // 'attention' | 'confusion'
  level = null, // 'very_low' | 'low' | 'moderate' | 'high' | 'uncertain'
  score = null, // Numeric score if available
  state = null, // Raw inference state
  confidence = null,
  compact = false,
  showExplanation = true,
  className = ''
}) {
  const resolvedLevel = level || mapScoreToFourLevel(type, score, state)
  const config = LEVEL_CONFIG[type]?.[resolvedLevel] || LEVEL_CONFIG[type]?.uncertain

  if (compact) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${config.badgeClass} ${className}`}
        title={config.description}
      >
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${config.dotClass}`} />
        <span>{config.label}</span>
      </span>
    )
  }

  return (
    <div className={`card-panel bg-panel-bg p-4 space-y-3 ${className}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-text-muted">
            {type === 'attention' ? 'Attention-related Estimate' : 'Confusion-related Estimate'}
          </span>
          <h4 className="font-bold text-brand-navy text-sm mt-0.5">
            {config.label}
          </h4>
        </div>
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${config.badgeClass}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${config.dotClass}`} />
          {resolvedLevel !== 'uncertain' ? resolvedLevel.replace('_', ' ').toUpperCase() : 'UNCERTAIN'}
        </span>
      </div>

      {/* Level Intensity Bar (4 Segments) */}
      <div className="space-y-1">
        <div className="grid grid-cols-4 gap-1.5 h-2">
          {['very_low', 'low', 'moderate', 'high'].map((lvl, idx) => {
            const levelIdx = ['very_low', 'low', 'moderate', 'high'].indexOf(resolvedLevel)
            const isActive = levelIdx >= idx && resolvedLevel !== 'uncertain'
            return (
              <div
                key={lvl}
                className={`rounded-full transition-colors ${
                  isActive
                    ? config.barClass
                    : 'bg-slate-200/80'
                }`}
                title={`Level ${idx + 1}: ${lvl.replace('_', ' ')}`}
              />
            )
          })}
        </div>
        <div className="flex justify-between text-[9px] font-mono text-text-muted">
          <span>Very Low</span>
          <span>Low</span>
          <span>Moderate</span>
          <span>High</span>
        </div>
      </div>

      {/* Ordinary Language Explanation */}
      {showExplanation && (
        <p className="text-xs text-text-muted leading-relaxed">
          {config.description}
        </p>
      )}

      {/* Signal Confidence / Quality */}
      <div className="flex items-center justify-between pt-2 border-t border-neutral-border text-[10px] text-text-muted font-mono">
        <span>Signal Confidence:</span>
        <span className="font-semibold text-brand-navy">
          {confidence !== null && typeof confidence === 'number'
            ? `${Math.round(confidence * 100)}% Evidence Support`
            : resolvedLevel === 'uncertain'
              ? 'Pending Calibration'
              : 'Standard Evidence'}
        </span>
      </div>
    </div>
  )
}
