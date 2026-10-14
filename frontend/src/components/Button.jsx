import React from 'react'

export default function Button({
  children,
  type = 'button',
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  className = '',
  ...props
}) {
  let variantClass = 'btn-primary'
  if (variant === 'secondary') variantClass = 'btn-secondary'
  else if (variant === 'accent') variantClass = 'btn-accent'
  else if (variant === 'danger') variantClass = 'btn-danger'
  else if (variant === 'ghost') variantClass = 'btn-ghost'
  else if (variant === 'outline') {
    variantClass = 'border border-neutral-border text-brand-navy hover:bg-neutral-light bg-transparent active:bg-slate-200'
  }

  let sizeClass = 'px-3.5 py-2 text-sm'
  if (size === 'sm') sizeClass = 'px-2.5 py-1 text-xs'
  else if (size === 'lg') sizeClass = 'px-5 py-2.5 text-base'
  else if (size === 'icon') sizeClass = 'p-2 text-sm'

  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={`${variantClass} ${sizeClass} ${className}`}
      {...props}
    >
      {loading ? (
        <span className="inline-flex items-center gap-2">
          <svg
            className="animate-spin -ml-0.5 h-3.5 w-3.5 text-current"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <span>{children}</span>
        </span>
      ) : (
        children
      )}
    </button>
  )
}

