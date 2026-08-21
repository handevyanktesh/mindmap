import React from 'react'

export default function StatusBadge({
  status = 'info',
  label,
  className = ''
}) {
  let badgeStyle = 'bg-primary-50 text-primary-600 border border-primary-100'
  
  if (status === 'success') {
    badgeStyle = 'bg-success-50 text-success-600 border border-success-200'
  } else if (status === 'warning') {
    badgeStyle = 'bg-warning-50 text-warning-600 border border-warning-200'
  } else if (status === 'danger') {
    badgeStyle = 'bg-danger-50 text-danger-600 border border-danger-200'
  }

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-semibold uppercase tracking-wider ${badgeStyle} ${className}`}>
      {label}
    </span>
  )
}
