import React from 'react'

export default function MetricCard({
  label,
  value,
  sublabel,
  valueColor = 'text-brand-navy',
  badge = null
}) {
  return (
    <div className="card-panel py-3.5 px-4 flex flex-col justify-between">
      <div className="flex justify-between items-start">
        <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-text-muted">
          {label}
        </span>
        {badge}
      </div>

      <div className="my-1.5">
        <div className={`text-2xl font-black ${valueColor} tracking-tight`}>
          {value !== null && typeof value !== 'undefined' ? value : '—'}
        </div>
      </div>

      {sublabel && (
        <span className="text-[10px] text-text-muted leading-tight">
          {sublabel}
        </span>
      )}
    </div>
  )
}
