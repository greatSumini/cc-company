import { Link, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { useAgentStore } from '@/stores/agent-store'
import { cn } from '@/lib/utils'

const navItems = [
  { path: '/subagents', label: 'Subagents', icon: '📦' },
  { path: '/skills', label: 'Skills', icon: '⚡' },
  { path: '/webhooks', label: 'Webhooks', icon: '🔗' },
]

export function Sidebar() {
  const location = useLocation()
  const statuses = useAgentStore((s) => s.statuses)

  const { data: agents = [] } = useQuery({
    queryKey: ['agents'],
    queryFn: api.agents.list,
  })

  return (
    <aside className="w-56 bg-white border-r border-gray-200 min-h-[calc(100vh-3.5rem)]">
      {/* Agents Section */}
      <div className="p-4">
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
          Agents
        </h2>
        <ul className="space-y-1">
          {(agents as { name: string }[]).map((agent) => (
            <li key={agent.name}>
              <div className="flex items-center gap-2 px-2 py-1.5 rounded text-sm text-gray-700">
                <span
                  className={cn(
                    'w-2 h-2 rounded-full',
                    statuses[agent.name] === 'working' ? 'bg-green-500' : 'bg-gray-300'
                  )}
                />
                {agent.name}
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="border-t border-gray-200" />

      {/* Navigation Section */}
      <div className="p-4">
        <ul className="space-y-1">
          {navItems.map((item) => (
            <li key={item.path}>
              <Link
                to={item.path}
                className={cn(
                  'flex items-center gap-2 px-2 py-1.5 rounded text-sm transition-colors',
                  location.pathname === item.path
                    ? 'bg-gray-100 text-gray-900'
                    : 'text-gray-600 hover:bg-gray-50'
                )}
              >
                <span>{item.icon}</span>
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  )
}
