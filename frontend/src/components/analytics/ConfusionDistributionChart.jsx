import React from 'react'

export default function ConfusionDistributionChart({
  title = 'Confusion Signal Distribution',
  subtitle = 'Aggregate distribution of inferred behavioural confusion signals',
  lowPct = null,
  elevatedPct = null,
  uncertainPct = null,
  lowCount = 0,
  elevatedCount = 0,
  uncertainCount = 0,
  className = ''
}) {
  const isAvailable = lowPct !== null || elevatedPct !== null

  if (!isAvailable) {
    return (
      <div className={`card-panel p-5 space-y-3 bg-panel-bg border border-neutral-border rounded-lg shadow-xs ${className}`}>
        <div>
          <h4 className="text-xs font-bold text-brand-navy uppercase tracking-wider">{title}</h4>
          <p className="text-xs text-text-muted mt-0.5">{subtitle}</p>
        </div>
        <div className="py-8 text-center bg-slate-50 border border-dashed border-slate-200 rounded-lg">
          <p className="text-xs text-text-muted italic max-w-sm mx-auto">
            Confusion telemetry is not yet recorded for this session. Aggregates appear once active students stream telemetry.
          </p>
        </div>
      </div>
    )
  }

  const lPct = Math.max(0, lowPct || 0)
  const ePct = Math.max(0, elevatedPct || 0)
  const uPct = Math.max(0, uncertainPct || 0)

  return (
    <div className={`card-panel p-5 space-y-4 bg-panel-bg border border-neutral-border rounded-lg shadow-xs ${className}`}>
      <div className="flex justify-between items-start gap-3">
        <div>
          <h4 className="text-xs font-bold text-brand-navy uppercase tracking-wider">{title}</h4>
          <p className="text-xs text-text-muted mt-0.5">{subtitle}</p>
        </div>
        <span
          className={`text-xs font-mono font-semibold px-2 py-0.5 rounded-full border shrink-0 ${
            ePct > 35
              ? 'text-rose-800 bg-rose-50 border-rose-200'
              : 'text-indigo-800 bg-indigo-50 border-indigo-200'
          }`}
        >
          {ePct}% Elevated
        </span>
      </div>

      {/* Segmented Horizontal Bar */}
      <div className="h-3.5 w-full bg-slate-100 border border-slate-200/80 rounded-full overflow-hidden flex shadow-inner">
        {lPct > 0 && (
          <div
            style={{ width: `${lPct}%` }}
            className="bg-indigo-500 transition-all duration-500"
            title={`Low Confusion: ${lPct}% (${lowCount} observations)`}
          />
        )}
        {ePct > 0 && (
          <div
            style={{ width: `${ePct}%` }}
            className="bg-rose-500 transition-all duration-500"
            title={`Elevated Confusion: ${ePct}% (${elevatedCount} observations)`}
          />
        )}
        {uPct > 0 && (
          <div
            style={{ width: `${uPct}%` }}
            className="bg-slate-300 transition-all duration-500"
            title={`Uncertain: ${uPct}% (${uncertainCount} observations)`}
          />
        )}
      </div>

      {/* Legend & Observation Counts */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1 text-xs">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-xs bg-indigo-500 shrink-0 inline-block" />
          <span className="text-text-muted">Low:</span>
          <span className="font-semibold text-brand-navy">{lPct}%</span>
          <span className="text-[11px] text-slate-400">({lowCount})</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-xs bg-rose-500 shrink-0 inline-block" />
          <span className="text-text-muted">Elevated:</span>
          <span className="font-semibold text-brand-navy">{ePct}%</span>
          <span className="text-[11px] text-slate-400">({elevatedCount})</span>
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

