import { QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { queryClient } from '@/lib/query-client'
import { Layout } from '@/components/layout/Layout'
import { HomePage } from '@/pages/HomePage'
import { SubagentsPage } from '@/pages/SubagentsPage'
import { SkillsPage } from '@/pages/SkillsPage'
import { WebhooksPage } from '@/pages/WebhooksPage'
import { useSSE } from '@/hooks/useSSE'
import { useAgentStatuses } from '@/hooks/useAgents'

// SSE 연결 및 초기 상태 로드를 담당하는 컴포넌트
function AppInitializer({ children }: { children: React.ReactNode }) {
  useSSE()
  useAgentStatuses()
  return <>{children}</>
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppInitializer>
          <Layout>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/subagents" element={<SubagentsPage />} />
              <Route path="/skills" element={<SkillsPage />} />
              <Route path="/webhooks" element={<WebhooksPage />} />
            </Routes>
          </Layout>
        </AppInitializer>
      </BrowserRouter>
    </QueryClientProvider>
  )
}

export default App
