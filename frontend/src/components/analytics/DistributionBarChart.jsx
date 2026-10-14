import React from 'react'

export default function DistributionBarChart({
  title = 'Engagement Distribution',
  subtitle = 'Aggregate distribution of inferred student engagement states',
  normalPct = null,
  reducedPct = null,
  uncertainPct = null,
  normalCount = 0,
  reducedCount = 0,
  uncertainCount = 0,
  className = ''
}) {
  const isAvailable = normalPct !== null || reducedPct !== null

  if (!isAvailable) {
    return (
      <div className={`card-panel p-5 space-y-3 bg-panel-bg border border-neutral-border rounded-lg shadow-xs ${className}`}>
        <div>
          <h4 className="text-xs font-bold text-brand-navy uppercase tracking-wider">{title}</h4>
          <p className="text-xs text-text-muted mt-0.5">{subtitle}</p>
        </div>
        <div className="py-8 text-center bg-slate-50 border border-dashed border-slate-200 rounded-lg">
          <p className="text-xs text-text-muted italic max-w-sm mx-auto">
            Telemetry data is not yet recorded for this session. Aggregate metrics appear once active students stream telemetry.
          </p>
        </div>
      </div>
    )
  }

  const nPct = Math.max(0, normalPct || 0)
  const rPct = Math.max(0, reducedPct || 0)
  const uPct = Math.max(0, uncertainPct || 0)

  return (
    <div className={`card-panel p-5 space-y-4 bg-panel-bg border border-neutral-border rounded-lg shadow-xs ${className}`}>
      <div className="flex justify-between items-start gap-3">
        <div>
          <h4 className="text-xs font-bold text-brand-navy uppercase tracking-wider">{title}</h4>
          <p className="text-xs text-text-muted mt-0.5">{subtitle}</p>
        </div>
        <span className="text-xs font-mono font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full shrink-0">
          {nPct}% Normal
        </span>
      </div>

      {/* Segmented Horizontal Bar */}
      <div className="h-3.5 w-full bg-slate-100 border border-slate-200/80 rounded-full overflow-hidden flex shadow-inner">
        {nPct > 0 && (
          <div
            style={{ width: `${nPct}%` }}
            className="bg-emerald-500 transition-all duration-500"
            title={`Normal Behaviour: ${nPct}% (${normalCount} observations)`}
          />
        )}
        {rPct > 0 && (
          <div
            style={{ width: `${rPct}%` }}
            className="bg-amber-500 transition-all duration-500"
            title={`Reduced Engagement-like: ${rPct}% (${reducedCount} observations)`}
          />
        )}
        {uPct > 0 && (
          <div
            style={{ width: `${uPct}%` }}
            className="bg-slate-300 transition-all duration-500"
            title={`Uncertain / Baseline: ${uPct}% (${uncertainCount} observations)`}
          />
        )}
      </div>

      {/* Legend & Observation Counts */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1 text-xs">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-xs bg-emerald-500 shrink-0 inline-block" />
          <span className="text-text-muted">Normal:</span>
          <span className="font-semibold text-brand-navy">{nPct}%</span>
          <span className="text-[11px] text-slate-400">({normalCount})</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-xs bg-amber-500 shrink-0 inline-block" />
          <span className="text-text-muted">Reduced:</span>
          <span className="font-semibold text-brand-navy">{rPct}%</span>
          <span className="text-[11px] text-slate-400">({reducedCount})</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-xs bg-slate-300 shrink-0 inline-block" />
          <span className="text-text-muted">Uncertain:</span>
          <span className="font-semibold text-brand-navy">{uPct}%</span>
          <span className="text-[11px] text-slate-400">({uncertainCount})</span>
        </div>
      </div>
    </div>
  )
}

