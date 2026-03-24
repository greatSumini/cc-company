// core 패키지에서 타입 import
import type { Ticket, TicketStatus, TicketType, TicketPriority } from '@agentinc/core'

export type { Ticket, TicketStatus, TicketType, TicketPriority }

// UI용 헬퍼 타입
export type KanbanColumn = 'blocked' | 'ready' | 'working' | 'done'

export function getKanbanColumn(status: TicketStatus): KanbanColumn {
  switch (status) {
    case 'blocked':
      return 'blocked'
    case 'ready':
      return 'ready'
    case 'in_progress':
      return 'working'
    case 'completed':
    case 'failed':
    case 'cancelled':
      return 'done'
    default:
      return 'ready'
  }
}
