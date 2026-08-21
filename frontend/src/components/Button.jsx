import React from 'react'

export default function Button({
  children,
  type = 'button',
  variant = 'primary',
  className = '',
  ...props
}) {
  let variantClass = 'btn-primary'
  if (variant === 'secondary') variantClass = 'btn-secondary'
  if (variant === 'accent') variantClass = 'btn-accent'

  return (
    <button
      type={type}
      className={`${variantClass} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}
