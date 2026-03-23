import { QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { queryClient } from '@/lib/query-client'
import { Layout } from '@/components/layout/Layout'
import { HomePage } from '@/pages/HomePage'
import { SubagentsPage } from '@/pages/SubagentsPage'
import { SkillsPage } from '@/pages/SkillsPage'
import { WebhooksPage } from '@/pages/WebhooksPage'

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Layout>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/subagents" element={<SubagentsPage />} />
            <Route path="/skills" element={<SkillsPage />} />
            <Route path="/webhooks" element={<WebhooksPage />} />
          </Routes>
        </Layout>
      </BrowserRouter>
    </QueryClientProvider>
  )
}

export default App
