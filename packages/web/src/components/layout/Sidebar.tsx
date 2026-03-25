import { Link, useLocation } from 'react-router-dom'
import { Home, Users, Package, Zap, Webhook } from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { path: '/', label: 'Home', icon: Home },
  { path: '/agents', label: 'Agents', icon: Users },
  { path: '/subagents', label: 'Subagents', icon: Package },
  { path: '/skills', label: 'Skills', icon: Zap },
  { path: '/webhooks', label: 'Webhooks', icon: Webhook },
]

export function Sidebar() {
  const location = useLocation()

  return (
    <aside className="w-56 bg-white border-r border-gray-200 min-h-[calc(100vh-3.5rem)]">
      <nav className="p-3">
        <ul className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = location.pathname === item.path

            return (
              <li key={item.path}>
                <Link
                  to={item.path}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
                    isActive
                      ? 'bg-blue-50 text-gray-900 border-l-2 border-blue-400 -ml-[2px] pl-[14px]'
                      : 'text-gray-600 hover:bg-gray-50'
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>
    </aside>
  )
}
