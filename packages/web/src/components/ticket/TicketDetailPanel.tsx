import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { useUIStore } from '@/stores/ui-store'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { Ticket } from '@/types/ticket'

const priorityVariant: Record<string, 'red' | 'yellow' | 'gray' | 'blue'> = {
  urgent: 'red',
  high: 'yellow',
  normal: 'gray',
  low: 'blue',
}

const statusLabels: Record<string, string> = {
  blocked: 'Blocked',
  ready: 'Ready',
  in_progress: 'Working',
  completed: 'Completed',
  failed: 'Failed',
  cancelled: 'Cancelled',
}

export function TicketDetailPanel() {
  const selectedTicketId = useUIStore((s) => s.selectedTicketId)
  const setSelectedTicketId = useUIStore((s) => s.setSelectedTicketId)

  const { data: ticket, isLoading } = useQuery({
    queryKey: ['ticket', selectedTicketId],
    queryFn: () => api.tickets.get(selectedTicketId!),
    enabled: !!selectedTicketId,
  })

  if (!selectedTicketId) {
    return null
  }

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/20 z-40"
        onClick={() => setSelectedTicketId(null)}
      />

      {/* Panel */}
      <div className="fixed right-0 top-14 bottom-0 w-96 bg-white border-l border-gray-200 z-50 overflow-y-auto shadow-lg">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 truncate pr-4">
            {isLoading ? '로딩 중...' : (ticket as Ticket)?.title}
          </h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelectedTicketId(null)}
          >
            ✕
          </Button>
        </div>

        {isLoading ? (
          <div className="p-4 text-gray-500">로딩 중...</div>
        ) : ticket ? (
          <TicketDetailContent ticket={ticket as Ticket} />
        ) : null}
      </div>
    </>
  )
}

function TicketDetailContent({ ticket }: { ticket: Ticket }) {
  return (
    <div className="p-4 space-y-6">
      {/* 기본 정보 */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 w-20">Status</span>
          <span className="text-sm font-medium">{statusLabels[ticket.status]}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 w-20">Assignee</span>
          <span className="text-sm">{ticket.assignee}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 w-20">Priority</span>
          <Badge variant={priorityVariant[ticket.priority] || 'gray'}>
            {ticket.priority}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 w-20">Type</span>
          <span className="text-sm">{ticket.type}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 w-20">Created</span>
          <span className="text-sm text-gray-600">
            {new Date(ticket.createdAt).toLocaleString('ko-KR')}
          </span>
        </div>
        {ticket.startedAt && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 w-20">Started</span>
            <span className="text-sm text-gray-600">
              {new Date(ticket.startedAt).toLocaleString('ko-KR')}
            </span>
          </div>
        )}
        {ticket.completedAt && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 w-20">Completed</span>
            <span className="text-sm text-gray-600">
              {new Date(ticket.completedAt).toLocaleString('ko-KR')}
            </span>
          </div>
        )}
      </section>

      {/* Prompt */}
      <section>
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
          Prompt
        </h3>
        <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-700 whitespace-pre-wrap">
          {ticket.prompt}
        </div>
      </section>

      {/* GitHub */}
      {ticket.metadata?.github?.prUrl && (
        <section>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            GitHub
          </h3>
          <a
            href={ticket.metadata.github.prUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-blue-600 hover:underline"
          >
            PR #{ticket.metadata.github.prNumber}
          </a>
        </section>
      )}

      {/* Comments */}
      {ticket.comments && ticket.comments.length > 0 && (
        <section>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Comments ({ticket.comments.length})
          </h3>
          <div className="space-y-3">
            {ticket.comments.map((comment) => (
              <div
                key={comment.id}
                className="bg-gray-50 rounded-lg p-3"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-gray-700">
                    {comment.author}
                  </span>
                  <span className="text-xs text-gray-400">
                    {new Date(comment.createdAt).toLocaleString('ko-KR')}
                  </span>
                </div>
                <p className="text-sm text-gray-600">{comment.content}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Result */}
      {ticket.result && (
        <section>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Result
          </h3>
          <div className="bg-gray-50 rounded-lg p-3 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Exit Code</span>
              <span className={`text-sm font-medium ${ticket.result.exitCode === 0 ? 'text-green-600' : 'text-red-600'}`}>
                {ticket.result.exitCode} {ticket.result.exitCode === 0 ? '✅' : '❌'}
              </span>
            </div>
            {ticket.result.logPath && (
              <div className="text-xs text-gray-500">
                Log: {ticket.result.logPath}
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  )
}
