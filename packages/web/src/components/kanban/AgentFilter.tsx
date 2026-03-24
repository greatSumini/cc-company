import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { useUIStore } from '@/stores/ui-store'
import { cn } from '@/lib/utils'

export function AgentFilter() {
  const agentFilter = useUIStore((s) => s.agentFilter)
  const setAgentFilter = useUIStore((s) => s.setAgentFilter)

  const { data: agents = [] } = useQuery({
    queryKey: ['agents'],
    queryFn: api.agents.list,
  })

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-gray-500">Filter:</span>
      <div className="flex gap-1">
        <button
          onClick={() => setAgentFilter(null)}
          className={cn(
            'px-3 py-1 rounded text-sm transition-colors',
            agentFilter === null
              ? 'bg-gray-900 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          )}
        >
          All
        </button>
        {(agents as { name: string }[]).map((agent) => (
          <button
            key={agent.name}
            onClick={() => setAgentFilter(agent.name)}
            className={cn(
              'px-3 py-1 rounded text-sm transition-colors',
              agentFilter === agent.name
                ? 'bg-gray-900 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            )}
          >
            {agent.name}
          </button>
        ))}
      </div>
    </div>
  )
}
