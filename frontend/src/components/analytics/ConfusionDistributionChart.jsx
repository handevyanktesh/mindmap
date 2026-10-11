import React from 'react'

export default function ConfusionDistributionChart({
  title = 'Confusion Signal Distribution',
  subtitle = 'Aggregate distribution of inferred behavioural confusion signals',
  lowPct = null,
  elevatedPct = null,
  uncertainPct = null,
  lowCount = 0,
  elevatedCount = 0,
  uncertainCount = 0
}) {
  const isAvailable = lowPct !== null || elevatedPct !== null

  if (!isAvailable) {
    return (
      <div className="card-panel p-4 space-y-3">
        <div>
          <h4 className="text-xs font-bold text-brand-navy uppercase tracking-wider">{title}</h4>
          <p className="text-[11px] text-text-muted mt-0.5">{subtitle}</p>
        </div>
        <div className="py-6 text-center bg-neutral-light/50 border border-dashed border-neutral-border rounded">
          <p className="text-xs text-text-muted italic">
            Confusion telemetry unavailable for this session.
          </p>
        </div>
      </div>
    )
  }

  const lPct = Math.max(0, lowPct || 0)
  const ePct = Math.max(0, elevatedPct || 0)
  const uPct = Math.max(0, uncertainPct || 0)

  return (
    <div className="card-panel p-4 space-y-3">
      <div className="flex justify-between items-start">
        <div>
          <h4 className="text-xs font-bold text-brand-navy uppercase tracking-wider">{title}</h4>
          <p className="text-[11px] text-text-muted mt-0.5">{subtitle}</p>
        </div>
        <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-semibold border ${
          ePct > 35
            ? 'text-rose-700 bg-rose-50 border-rose-200'
            : 'text-indigo-700 bg-indigo-50 border-indigo-200'
        }`}>
          {ePct}% Elevated
        </span>
      </div>

      {/* Segmented Horizontal Bar */}
      <div className="h-4 w-full bg-neutral-200 rounded-full overflow-hidden flex shadow-inner">
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
            className="bg-slate-400 transition-all duration-500"
            title={`Uncertain: ${uPct}% (${uncertainCount} observations)`}
          />
        )}
      </div>

      {/* Legend & Counts */}
      <div className="grid grid-cols-3 gap-2 pt-1 text-[11px]">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-indigo-500 inline-block" />
          <span className="text-text-muted">Low:</span>
          <span className="font-semibold text-brand-navy">{lPct}%</span>
          <span className="text-[10px] text-neutral-400">({lowCount})</span>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-rose-500 inline-block" />
          <span className="text-text-muted">Elevated:</span>
          <span className="font-semibold text-brand-navy">{ePct}%</span>
          <span className="text-[10px] text-neutral-400">({elevatedCount})</span>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-slate-400 inline-block" />
          <span className="text-text-muted">Uncertain:</span>
          <span className="font-semibold text-brand-navy">{uPct}%</span>
          <span className="text-[10px] text-neutral-400">({uncertainCount})</span>
        </div>
      </div>
    </div>
  )
}
