import React from 'react'

export default function DistributionBarChart({
  title = 'Engagement Distribution',
  subtitle = 'Aggregate distribution of inferred student engagement states',
  normalPct = null,
  reducedPct = null,
  uncertainPct = null,
  normalCount = 0,
  reducedCount = 0,
  uncertainCount = 0
}) {
  const isAvailable = normalPct !== null || reducedPct !== null

  if (!isAvailable) {
    return (
      <div className="card-panel p-4 space-y-3">
        <div>
          <h4 className="text-xs font-bold text-brand-navy uppercase tracking-wider">{title}</h4>
          <p className="text-[11px] text-text-muted mt-0.5">{subtitle}</p>
        </div>
        <div className="py-6 text-center bg-neutral-light/50 border border-dashed border-neutral-border rounded">
          <p className="text-xs text-text-muted italic">
            Telemetry unavailable for this session. Historical biometrics are not persisted to database.
          </p>
        </div>
      </div>
    )
  }

  const nPct = Math.max(0, normalPct || 0)
  const rPct = Math.max(0, reducedPct || 0)
  const uPct = Math.max(0, uncertainPct || 0)

  return (
    <div className="card-panel p-4 space-y-3">
      <div className="flex justify-between items-start">
        <div>
          <h4 className="text-xs font-bold text-brand-navy uppercase tracking-wider">{title}</h4>
          <p className="text-[11px] text-text-muted mt-0.5">{subtitle}</p>
        </div>
        <span className="text-[10px] font-mono text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded font-semibold">
          {nPct}% Normal
        </span>
      </div>

      {/* Segmented Horizontal Bar */}
      <div className="h-4 w-full bg-neutral-200 rounded-full overflow-hidden flex shadow-inner">
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
            className="bg-slate-400 transition-all duration-500"
            title={`Uncertain / Baseline: ${uPct}% (${uncertainCount} observations)`}
          />
        )}
      </div>

      {/* Legend & Counts */}
      <div className="grid grid-cols-3 gap-2 pt-1 text-[11px]">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block" />
          <span className="text-text-muted">Normal:</span>
          <span className="font-semibold text-brand-navy">{nPct}%</span>
          <span className="text-[10px] text-neutral-400">({normalCount})</span>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-amber-500 inline-block" />
          <span className="text-text-muted">Reduced:</span>
          <span className="font-semibold text-brand-navy">{rPct}%</span>
          <span className="text-[10px] text-neutral-400">({reducedCount})</span>
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
