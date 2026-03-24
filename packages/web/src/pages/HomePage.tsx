import { KanbanBoard } from '@/components/kanban/KanbanBoard'
import { AgentFilter } from '@/components/kanban/AgentFilter'
import { TicketDetailPanel } from '@/components/ticket/TicketDetailPanel'

export function HomePage() {
  return (
    <div className="space-y-4">
      {/* Header with Filter */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Tickets</h1>
        <AgentFilter />
      </div>

      {/* Kanban Board */}
      <KanbanBoard />

      {/* Detail Panel */}
      <TicketDetailPanel />
    </div>
  )
}
