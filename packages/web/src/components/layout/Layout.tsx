import { ReactNode } from 'react'
import { Sidebar } from './Sidebar'
import { useConnectionStore } from '@/stores/connection-store'
import { cn } from '@/lib/utils'

interface LayoutProps {
  children: ReactNode
}

export function Layout({ children }: LayoutProps) {
  const connectionState = useConnectionStore((s) => s.state)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-6">
        <h1 className="text-lg font-semibold text-gray-900">Agent Inc</h1>
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'w-2 h-2 rounded-full',
              connectionState === 'connected' && 'bg-green-500',
              connectionState === 'connecting' && 'bg-yellow-500',
              connectionState === 'disconnected' && 'bg-red-500'
            )}
          />
          <span className="text-xs text-gray-500">
            {connectionState === 'connected' && 'Live'}
            {connectionState === 'connecting' && 'Connecting...'}
            {connectionState === 'disconnected' && 'Disconnected'}
          </span>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <Sidebar />

        {/* Main Content */}
        <main className="flex-1 p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
