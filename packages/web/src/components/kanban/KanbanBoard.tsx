import { useMemo } from 'react'
import { useUIStore } from '@/stores/ui-store'
import { useTickets } from '@/hooks/useTickets'
import { KanbanColumn } from './KanbanColumn'
import { getKanbanColumn } from '@/types/ticket'
import type { Ticket } from '@/types/ticket'

const DONE_MAX_DISPLAY = 20

export function KanbanBoard() {
  const agentFilter = useUIStore((s) => s.agentFilter)
  const { data: tickets = [], isLoading } = useTickets()

  // 필터링 및 컬럼별 분류
  const columns = useMemo(() => {
    const filtered = agentFilter
      ? (tickets as Ticket[]).filter((t) => t.assignee === agentFilter)
      : (tickets as Ticket[])

    const blocked: Ticket[] = []
    const ready: Ticket[] = []
    const working: Ticket[] = []
    const done: Ticket[] = []

    filtered.forEach((ticket) => {
      const column = getKanbanColumn(ticket.status)
      switch (column) {
        case 'blocked':
          blocked.push(ticket)
          break
        case 'ready':
          ready.push(ticket)
          break
        case 'working':
          working.push(ticket)
          break
        case 'done':
          done.push(ticket)
          break
      }
    })

    // Done은 최신순 정렬
    done.sort((a, b) =>
      new Date(b.completedAt || b.createdAt).getTime() -
      new Date(a.completedAt || a.createdAt).getTime()
    )

    return { blocked, ready, working, done }
  }, [tickets, agentFilter])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        로딩 중...
      </div>
    )
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      <KanbanColumn
        title="Blocked"
        tickets={columns.blocked}
        count={columns.blocked.length}
      />
      <KanbanColumn
        title="Ready"
        tickets={columns.ready}
        count={columns.ready.length}
      />
      <KanbanColumn
        title="Working"
        tickets={columns.working}
        count={columns.working.length}
      />
      <KanbanColumn
        title="Done"
        tickets={columns.done}
        count={columns.done.length}
        maxDisplay={DONE_MAX_DISPLAY}
      />
    </div>
  )
}
