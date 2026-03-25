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
            'px-3 py-1.5 rounded-md text-sm transition-colors border',
            agentFilter === null
              ? 'bg-blue-50 text-gray-900 border-blue-400'
              : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
          )}
        >
          All
        </button>
        {(agents as { name: string }[]).map((agent) => (
          <button
            key={agent.name}
            onClick={() => setAgentFilter(agent.name)}
            className={cn(
              'px-3 py-1.5 rounded-md text-sm transition-colors border',
              agentFilter === agent.name
                ? 'bg-blue-50 text-gray-900 border-blue-400'
                : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
            )}
          >
            {agent.name}
          </button>
        ))}
      </div>
    </div>
  )
}
