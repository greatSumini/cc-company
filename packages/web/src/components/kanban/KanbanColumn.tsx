import { TicketCard } from '@/components/ticket/TicketCard'
import type { Ticket } from '@/types/ticket'

interface KanbanColumnProps {
  title: string
  tickets: Ticket[]
  count: number
  maxDisplay?: number
  showMoreLabel?: string
}

export function KanbanColumn({
  title,
  tickets,
  count,
  maxDisplay,
  showMoreLabel,
}: KanbanColumnProps) {
  const displayTickets = maxDisplay ? tickets.slice(0, maxDisplay) : tickets
  const hasMore = maxDisplay && tickets.length > maxDisplay

  return (
    <div className="flex flex-col w-72 min-w-72">
      {/* Column Header */}
      <div className="flex items-center gap-2 mb-3 px-1">
        <h2 className="text-sm font-semibold text-gray-700">{title}</h2>
        <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
          {count}
        </span>
      </div>

      {/* Tickets */}
      <div className="flex flex-col gap-2 flex-1">
        {displayTickets.map((ticket) => (
          <TicketCard key={ticket.id} ticket={ticket} />
        ))}

        {/* 더 보기 */}
        {hasMore && (
          <button className="text-xs text-gray-500 hover:text-gray-700 py-2">
            {showMoreLabel || `+${tickets.length - maxDisplay!}개 더 보기`}
          </button>
        )}

        {/* 빈 상태 */}
        {tickets.length === 0 && (
          <div className="text-xs text-gray-400 text-center py-8">
            티켓 없음
          </div>
        )}
      </div>
    </div>
  )
}
