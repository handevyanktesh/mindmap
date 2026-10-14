import React from 'react'

export default function MetricCard({
  label,
  value,
  sublabel,
  valueColor = 'text-brand-navy',
  badge = null,
  className = ''
}) {
  return (
    <div className={`card-panel py-4 px-5 flex flex-col justify-between bg-panel-bg border border-neutral-border rounded-lg shadow-xs transition-shadow hover:shadow-sm ${className}`}>
      <div className="flex justify-between items-start gap-2">
        <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-text-muted">
          {label}
        </span>
        {badge}
      </div>

      <div className="my-2">
        <div className={`text-2xl sm:text-3xl font-bold ${valueColor} tracking-tight`}>
          {value !== null && typeof value !== 'undefined' ? value : '—'}
        </div>
      </div>

      {sublabel && (
        <span className="text-xs text-text-muted leading-tight">
          {sublabel}
        </span>
      )}
    </div>
  )
}

