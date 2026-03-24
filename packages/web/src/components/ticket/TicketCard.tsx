import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { useAgentStore } from '@/stores/agent-store'
import { useUIStore } from '@/stores/ui-store'
import type { Ticket } from '@/types/ticket'

interface TicketCardProps {
  ticket: Ticket
}

// Priority 색상 매핑
const priorityVariant: Record<string, 'red' | 'yellow' | 'gray' | 'blue'> = {
  urgent: 'red',
  high: 'yellow',
  normal: 'gray',
  low: 'blue',
}

// Type 색상 매핑
const typeVariant: Record<string, 'purple' | 'green'> = {
  task: 'purple',
  cc_review: 'green',
}

// Done 상태 아이콘
const doneIcons: Record<string, string> = {
  completed: '✅',
  failed: '❌',
  cancelled: '🚫',
}

export function TicketCard({ ticket }: TicketCardProps) {
  const statuses = useAgentStore((s) => s.statuses)
  const setSelectedTicketId = useUIStore((s) => s.setSelectedTicketId)

  const shortId = ticket.id.slice(0, 6)
  const isDone = ['completed', 'failed', 'cancelled'].includes(ticket.status)
  const agentStatus = statuses[ticket.assignee]

  // 상대 시간 계산
  const createdAt = new Date(ticket.createdAt)
  const relativeTime = getRelativeTime(createdAt)

  return (
    <div
      onClick={() => setSelectedTicketId(ticket.id)}
      className={cn(
        'bg-white border border-gray-200 rounded-lg shadow-soft',
        'hover:shadow-soft-md hover:border-gray-300 transition-all',
        'p-3 cursor-pointer',
        'flex flex-col gap-2'
      )}
    >
      {/* 상단: Priority, ID, Type, Done 아이콘 */}
      <div className="flex items-center gap-2 text-xs">
        <Badge variant={priorityVariant[ticket.priority] || 'gray'}>
          {ticket.priority}
        </Badge>
        <span className="text-gray-400">#{shortId}</span>
        <Badge variant={typeVariant[ticket.type] || 'gray'}>
          {ticket.type}
        </Badge>
        {isDone && (
          <span className="ml-auto">{doneIcons[ticket.status]}</span>
        )}
      </div>

      {/* 제목 */}
      <h3 className="text-sm font-medium text-gray-900 line-clamp-2">
        {ticket.title}
      </h3>

      {/* 하단: Assignee, 시간 */}
      <div className="flex items-center justify-between text-xs text-gray-500">
        <div className="flex items-center gap-1.5">
          <span
            className={cn(
              'w-1.5 h-1.5 rounded-full',
              agentStatus === 'working' ? 'bg-green-500' : 'bg-gray-300'
            )}
          />
          <span>{ticket.assignee}</span>
        </div>
        <span>{relativeTime}</span>
      </div>

      {/* 추가 정보: 댓글 수, GitHub 링크 */}
      {(ticket.comments?.length > 0 || ticket.metadata?.github?.prUrl) && (
        <div className="flex items-center gap-3 text-xs text-gray-400">
          {ticket.comments?.length > 0 && (
            <span>💬 {ticket.comments.length}</span>
          )}
          {ticket.metadata?.github?.prUrl && (
            <a
              href={ticket.metadata.github.prUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="hover:text-gray-600"
            >
              🔗 PR #{ticket.metadata.github.prNumber}
            </a>
          )}
        </div>
      )}
    </div>
  )
}

// 상대 시간 헬퍼 함수
function getRelativeTime(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return '방금 전'
  if (diffMins < 60) return `${diffMins}분 전`
  if (diffHours < 24) return `${diffHours}시간 전`
  return `${diffDays}일 전`
}
