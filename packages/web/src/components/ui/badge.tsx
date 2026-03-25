import { cn } from '@/lib/utils'

interface BadgeProps {
  variant: 'blue' | 'green' | 'yellow' | 'red' | 'purple' | 'gray' | 'orange'
  children: React.ReactNode
  className?: string
}

const variantStyles = {
  blue: 'bg-blue-100 text-blue-400',
  green: 'bg-green-100 text-green-400',
  yellow: 'bg-yellow-100 text-yellow-400',
  red: 'bg-red-100 text-red-400',
  purple: 'bg-purple-100 text-purple-400',
  gray: 'bg-gray-100 text-gray-400',
  orange: 'bg-orange-100 text-orange-400',
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
