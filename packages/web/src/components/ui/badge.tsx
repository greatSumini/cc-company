import { cn } from '@/lib/utils'

interface BadgeProps {
  variant: 'blue' | 'green' | 'yellow' | 'red' | 'purple' | 'gray'
  children: React.ReactNode
  className?: string
}

const variantStyles = {
  blue: 'bg-badge-blue-bg text-badge-blue-text',
  green: 'bg-badge-green-bg text-badge-green-text',
  yellow: 'bg-badge-yellow-bg text-badge-yellow-text',
  red: 'bg-badge-red-bg text-badge-red-text',
  purple: 'bg-badge-purple-bg text-badge-purple-text',
  gray: 'bg-badge-gray-bg text-badge-gray-text',
}

export function Badge({ variant, children, className }: BadgeProps) {
  return (
    <span className={cn(
      'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium',
      variantStyles[variant],
      className
    )}>
      {children}
    </span>
  )
}
