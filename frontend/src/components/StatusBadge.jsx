import React from 'react'

export default function StatusBadge({
  status = 'info',
  label,
  dot = false,
  className = ''
}) {
  let badgeStyle = 'bg-primary-50 text-primary-700 border-primary-200/80'
  let dotColor = 'bg-primary-500'

  if (status === 'success') {
    badgeStyle = 'bg-emerald-50 text-emerald-800 border-emerald-200'
    dotColor = 'bg-emerald-500'
  } else if (status === 'warning') {
    badgeStyle = 'bg-amber-50 text-amber-800 border-amber-200'
    dotColor = 'bg-amber-500'
  } else if (status === 'danger') {
    badgeStyle = 'bg-rose-50 text-rose-800 border-rose-200'
    dotColor = 'bg-rose-500'
  } else if (status === 'neutral' || status === 'muted') {
    badgeStyle = 'bg-slate-100 text-slate-700 border-slate-200'
    dotColor = 'bg-slate-400'
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${badgeStyle} ${className}`}
    >
      {dot && (
        <span
          className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColor} ${status === 'success' || status === 'warning' ? 'animate-pulse' : ''}`}
        />
      )}
      <span>{label}</span>
    </span>
  )
}

