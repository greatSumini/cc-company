import { cn } from '@/lib/utils'

type BadgeVariant =
  // Ticket Status
  | 'blocked' | 'ready' | 'in_progress' | 'completed' | 'failed' | 'cancelled'
  // Priority
  | 'critical' | 'high' | 'medium' | 'low'
  // Type
  | 'task' | 'cc_review'
  // Agent Status
  | 'idle' | 'working' | 'offline'
  // Generic
  | 'default'

interface BadgeProps {
  variant: BadgeVariant
  children: React.ReactNode
  className?: string
}

const variantStyles: Record<BadgeVariant, string> = {
  // Ticket Status
  blocked: 'bg-red-100 text-red-400',
  ready: 'bg-blue-100 text-blue-400',
  in_progress: 'bg-yellow-100 text-yellow-400',
  completed: 'bg-green-100 text-green-400',
  failed: 'bg-red-100 text-red-400',
  cancelled: 'bg-gray-100 text-gray-400',

  // Priority
  critical: 'bg-red-100 text-red-400',
  high: 'bg-orange-100 text-orange-400',
  medium: 'bg-blue-100 text-blue-400',
  low: 'bg-gray-100 text-gray-400',

  // Type
  task: 'bg-purple-100 text-purple-400',
  cc_review: 'bg-green-100 text-green-400',

  // Agent Status
  idle: 'bg-gray-100 text-gray-400',
  working: 'bg-green-100 text-green-400',
  offline: 'bg-red-100 text-red-400',

  // Default
  default: 'bg-gray-100 text-gray-400',
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
