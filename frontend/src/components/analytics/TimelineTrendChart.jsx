import React from 'react'

export default function TimelineTrendChart({
  timeline = [],
  title = 'Session Behaviour Timeline Progression',
  subtitle = 'Continuous trajectory of classroom normal behaviour and elevated confusion over time'
}) {
  if (!timeline || timeline.length < 2) {
    return (
      <div className="card-panel p-4 space-y-3">
        <div>
          <h4 className="text-xs font-bold text-brand-navy uppercase tracking-wider">{title}</h4>
          <p className="text-[11px] text-text-muted mt-0.5">{subtitle}</p>
        </div>
        <div className="py-8 text-center bg-neutral-light/50 border border-dashed border-neutral-border rounded">
          <p className="text-xs text-text-muted italic">
            Timeline trajectory data unavailable. Continuous timeline is recorded during live teacher monitoring.
          </p>
        </div>
      </div>
    )
  }

  const width = 600
  const height = 180
  const padLeft = 40
  const padRight = 20
  const padTop = 20
  const padBottom = 30

  const plotWidth = width - padLeft - padRight
  const plotHeight = height - padTop - padBottom

  const n = timeline.length
  const getX = (idx) => padLeft + (idx / (n - 1)) * plotWidth
  const getY = (val) => padTop + plotHeight - ((Math.min(100, Math.max(0, val || 0)) / 100) * plotHeight)

  // Build SVG path strings
  const normalPoints = timeline.map((pt, i) => `${getX(i)},${getY(pt.normal_pct)}`).join(' ')
  const confusionPoints = timeline.map((pt, i) => `${getX(i)},${getY(pt.elevated_confusion_pct)}`).join(' ')

  const normalPath = timeline.map((pt, i) => `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getY(pt.normal_pct)}`).join(' ')
  const confusionPath = timeline.map((pt, i) => `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getY(pt.elevated_confusion_pct)}`).join(' ')

  // Start & End timestamps
  const startTime = timeline[0].time_label || ''
  const endTime = timeline[timeline.length - 1].time_label || ''

  return (
    <div className="card-panel p-4 space-y-3">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
        <div>
          <h4 className="text-xs font-bold text-brand-navy uppercase tracking-wider">{title}</h4>
          <p className="text-[11px] text-text-muted mt-0.5">{subtitle}</p>
        </div>
        <div className="flex items-center gap-4 text-[10px] font-mono">
          <span className="flex items-center gap-1.5 text-emerald-700">
            <span className="w-2.5 h-0.5 bg-emerald-500 inline-block" /> Normal Behaviour %
          </span>
          <span className="flex items-center gap-1.5 text-rose-700">
            <span className="w-2.5 h-0.5 bg-rose-500 inline-block" /> Elevated Confusion %
          </span>
        </div>
      </div>

      <div className="w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-44 select-none"
          preserveAspectRatio="none"
        >
          {/* Y Axis Gridlines & Labels */}
          {[0, 25, 50, 75, 100].map((level) => {
            const y = getY(level)
            return (
              <g key={level}>
                <line
                  x1={padLeft}
                  y1={y}
                  x2={width - padRight}
                  y2={y}
                  stroke="#e2e8f0"
                  strokeDasharray={level === 0 || level === 100 ? 'none' : '3 3'}
                  strokeWidth="1"
                />
                <text
                  x={padLeft - 6}
                  y={y + 3}
                  textAnchor="end"
                  fontSize="9"
                  fill="#94a3b8"
                  fontFamily="monospace"
                >
                  {level}%
                </text>
              </g>
            )
          })}

          {/* Normal Behaviour Line */}
          <path
            d={normalPath}
            fill="none"
            stroke="#10b981"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Elevated Confusion Line */}
          <path
            d={confusionPath}
            fill="none"
            stroke="#f43f5e"
            strokeWidth="2"
            strokeDasharray="4 2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Timeline Nodes */}
          {timeline.map((pt, i) => (
            <g key={i}>
              <circle
                cx={getX(i)}
                cy={getY(pt.normal_pct)}
                r="3"
                fill="#10b981"
                className="hover:r-4 transition-all"
              >
                <title>{`Normal: ${pt.normal_pct}% at ${pt.time_label}`}</title>
              </circle>
              <circle
                cx={getX(i)}
                cy={getY(pt.elevated_confusion_pct)}
                r="2.5"
                fill="#f43f5e"
              >
                <title>{`Confusion: ${pt.elevated_confusion_pct}% at ${pt.time_label}`}</title>
              </circle>
            </g>
          ))}

          {/* X Axis Time Labels */}
          <text
            x={padLeft}
            y={height - 8}
            textAnchor="start"
            fontSize="9"
            fill="#94a3b8"
            fontFamily="monospace"
          >
            {startTime}
          </text>
          <text
            x={width - padRight}
            y={height - 8}
            textAnchor="end"
            fontSize="9"
            fill="#94a3b8"
            fontFamily="monospace"
          >
            {endTime}
          </text>
        </svg>
      </div>
    </div>
  )
}
