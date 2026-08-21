import React from 'react'

export default function Input({
  label,
  id,
  type = 'text',
  error,
  className = '',
  ...props
}) {
  return (
    <div className={className}>
      {label && (
        <label htmlFor={id} className={`block text-xs font-semibold mb-1.5 ${error ? 'text-danger-600' : 'text-brand-navy-light'}`}>
          {label}
        </label>
      )}
      <input
        id={id}
        type={type}
        className={`input-text ${error ? 'input-text-error' : ''}`}
        {...props}
      />
      {error && (
        <p className="mt-1 text-xs text-danger-600 font-medium">
          {error}
        </p>
      )}
    </div>
  )
}
