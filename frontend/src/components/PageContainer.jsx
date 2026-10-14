import React from 'react'

export default function PageContainer({
  children,
  className = '',
  size = 'default'
}) {
  let maxWidth = 'max-w-5xl'
  if (size === 'small') maxWidth = 'max-w-md'
  else if (size === 'default') maxWidth = 'max-w-5xl'
  else if (size === 'large') maxWidth = 'max-w-7xl'
  else if (size === 'full') maxWidth = 'max-w-full'

  return (
    <div className={`w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 ${maxWidth} ${className}`}>
      {children}
    </div>
  )
}

