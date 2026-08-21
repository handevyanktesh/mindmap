import React from 'react'

export default function PageContainer({
  children,
  className = '',
  size = 'default'
}) {
  const maxWidth = size === 'small' ? 'max-w-md' : size === 'large' ? 'max-w-6xl' : 'max-w-4xl'

  return (
    <div className={`w-full mx-auto px-6 py-8 ${maxWidth} ${className}`}>
      {children}
    </div>
  )
}
