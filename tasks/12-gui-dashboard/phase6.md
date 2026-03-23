# Phase 6: 실시간 업데이트 연동

## 사전 준비

먼저 아래 문서들을 반드시 읽고 프로젝트의 전체 아키텍처와 설계 의도를 완전히 이해하라:

- `/spec/architecture.md` — SSE 실시간 업데이트 섹션
- `/spec/adr.md` — ADR-024 (SSE 실시간 업데이트), ADR-025 (상태 관리)
- `/tasks/12-gui-dashboard/spec-diff.md` — 이번 task의 문서 변경 기록

그리고 이전 phase의 작업물을 반드시 확인하라:

- `packages/server/src/routes/events.ts` — Phase 3에서 구현한 SSE 엔드포인트
- `packages/server/src/events/event-bus.ts` — EventBus 구현
- `packages/web/src/stores/` — Zustand 스토어
- `packages/web/src/lib/query-client.ts` — React Query 클라이언트
- `packages/web/src/components/kanban/KanbanBoard.tsx` — Kanban 보드

이전 phase에서 만들어진 코드를 꼼꼼히 읽고, 설계 의도를 이해한 뒤 작업하라.

## 작업 내용

### 1. useSSE 훅 구현

#### 1.1 `packages/web/src/hooks/useSSE.ts` 생성

```typescript
import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAgentStore } from '@/stores/agent-store'
import type { Ticket } from '@/types/ticket'

const SSE_URL = '/events'
const RECONNECT_DELAY = 3000

export function useSSE() {
  const queryClient = useQueryClient()
  const updateAgentStatus = useAgentStore((s) => s.updateStatus)
  const eventSourceRef = useRef<EventSource | null>(null)
  const reconnectTimeoutRef = useRef<number | null>(null)

  useEffect(() => {
    function connect() {
      // 기존 연결 정리
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
      }

      const eventSource = new EventSource(SSE_URL)
      eventSourceRef.current = eventSource

      // 연결 성공
      eventSource.addEventListener('connected', () => {
        console.log('[SSE] Connected')
      })

      // 티켓 생성 이벤트
      eventSource.addEventListener('ticket:created', (event) => {
        const ticket = JSON.parse(event.data) as Ticket
        console.log('[SSE] ticket:created', ticket.id)

        // React Query 캐시에 새 티켓 추가
        queryClient.setQueryData<Ticket[]>(['tickets'], (old = []) => {
          // 중복 방지
          if (old.some((t) => t.id === ticket.id)) {
            return old
          }
          return [...old, ticket]
        })
      })

      // 티켓 업데이트 이벤트
      eventSource.addEventListener('ticket:updated', (event) => {
        const ticket = JSON.parse(event.data) as Ticket
        console.log('[SSE] ticket:updated', ticket.id, ticket.status)

        // React Query 캐시 업데이트
        queryClient.setQueryData<Ticket[]>(['tickets'], (old = []) => {
          return old.map((t) => (t.id === ticket.id ? ticket : t))
        })

        // 개별 티켓 캐시도 업데이트
        queryClient.setQueryData(['ticket', ticket.id], ticket)
      })

      // Agent 상태 변경 이벤트
      eventSource.addEventListener('agent:status', (event) => {
        const { agent, state } = JSON.parse(event.data) as {
          agent: string
          state: 'idle' | 'working'
        }
        console.log('[SSE] agent:status', agent, state)

        // Zustand 스토어 업데이트
        updateAgentStatus(agent, state)
      })

      // 에러 처리 및 재연결
      eventSource.onerror = (error) => {
        console.error('[SSE] Error:', error)
        eventSource.close()

        // 재연결 시도
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current)
        }
        reconnectTimeoutRef.current = window.setTimeout(() => {
          console.log('[SSE] Reconnecting...')
          connect()
        }, RECONNECT_DELAY)
      }
    }

    connect()

    // Cleanup
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
    }
  }, [queryClient, updateAgentStatus])
}
```

### 2. useTickets 훅 구현

#### 2.1 `packages/web/src/hooks/useTickets.ts` 생성

```typescript
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import type { Ticket } from '@/types/ticket'

interface UseTicketsOptions {
  status?: string
  assignee?: string
}

export function useTickets(options: UseTicketsOptions = {}) {
  return useQuery<Ticket[]>({
    queryKey: ['tickets', options],
    queryFn: () => api.tickets.list(options) as Promise<Ticket[]>,
    // SSE로 실시간 업데이트하므로 polling 불필요
    refetchOnWindowFocus: false,
  })
}

export function useTicket(id: string | null) {
  return useQuery<Ticket>({
    queryKey: ['ticket', id],
    queryFn: () => api.tickets.get(id!) as Promise<Ticket>,
    enabled: !!id,
  })
}
```

### 3. useAgents 훅 구현

#### 3.1 `packages/web/src/hooks/useAgents.ts` 생성

```typescript
import { useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'
import { api } from '@/lib/api-client'
import { useAgentStore } from '@/stores/agent-store'

interface Agent {
  name: string
  description: string
}

interface AgentStatus {
  agent: string
  state: 'idle' | 'working'
  lastHeartbeatAt: string
}

export function useAgents() {
  return useQuery<Agent[]>({
    queryKey: ['agents'],
    queryFn: () => api.agents.list() as Promise<Agent[]>,
  })
}

export function useAgentStatuses() {
  const setStatuses = useAgentStore((s) => s.setStatuses)

  const query = useQuery<AgentStatus[]>({
    queryKey: ['agents', 'status'],
    queryFn: () => api.agents.status() as Promise<AgentStatus[]>,
    // 초기 로드만, 이후 SSE로 업데이트
    refetchOnWindowFocus: false,
  })

  // 초기 상태를 Zustand에 동기화
  useEffect(() => {
    if (query.data) {
      const statusMap: Record<string, 'idle' | 'working'> = {}
      query.data.forEach((s) => {
        statusMap[s.agent] = s.state
      })
      setStatuses(statusMap)
    }
  }, [query.data, setStatuses])

  return query
}
```

### 4. hooks/index.ts 생성

#### 4.1 `packages/web/src/hooks/index.ts` 생성

```typescript
export * from './useSSE'
export * from './useTickets'
export * from './useAgents'
```

### 5. App에 SSE 연결 추가

#### 5.1 `packages/web/src/App.tsx` 수정

```tsx
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
```

### 6. Sidebar에 실시간 Agent 상태 반영

#### 6.1 `packages/web/src/components/layout/Sidebar.tsx` 수정 확인

Phase 4에서 이미 `useAgentStore`를 사용하여 agent 상태를 표시하도록 구현되어 있다. SSE 연동으로 자동 업데이트됨을 확인하라.

기존 코드가 아래와 같이 되어 있는지 확인:

```tsx
const statuses = useAgentStore((s) => s.statuses)

// ...

<span
  className={cn(
    'w-2 h-2 rounded-full',
    statuses[agent.name] === 'working' ? 'bg-green-500' : 'bg-gray-300'
  )}
/>
```

### 7. KanbanBoard에서 useTickets 훅 사용

#### 7.1 `packages/web/src/components/kanban/KanbanBoard.tsx` 수정

기존 직접 `useQuery` 호출을 `useTickets` 훅으로 교체:

```tsx
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

  // 나머지는 기존과 동일
  // ...
}
```

### 8. 연결 상태 표시 (선택사항)

#### 8.1 `packages/web/src/stores/connection-store.ts` 생성

```typescript
import { create } from 'zustand'

type ConnectionState = 'connecting' | 'connected' | 'disconnected'

interface ConnectionStore {
  state: ConnectionState
  setState: (state: ConnectionState) => void
}

export const useConnectionStore = create<ConnectionStore>((set) => ({
  state: 'connecting',
  setState: (state) => set({ state }),
}))
```

#### 8.2 useSSE 훅 수정 (연결 상태 추적)

```typescript
import { useConnectionStore } from '@/stores/connection-store'

export function useSSE() {
  const queryClient = useQueryClient()
  const updateAgentStatus = useAgentStore((s) => s.updateStatus)
  const setConnectionState = useConnectionStore((s) => s.setState)
  // ...

  useEffect(() => {
    function connect() {
      setConnectionState('connecting')
      // ...

      eventSource.addEventListener('connected', () => {
        console.log('[SSE] Connected')
        setConnectionState('connected')
      })

      eventSource.onerror = (error) => {
        console.error('[SSE] Error:', error)
        setConnectionState('disconnected')
        // ...
      }
    }
    // ...
  }, [queryClient, updateAgentStatus, setConnectionState])
}
```

#### 8.3 Header에 연결 상태 표시 (선택사항)

`packages/web/src/components/layout/Layout.tsx`의 Header에 연결 상태 인디케이터 추가:

```tsx
import { useConnectionStore } from '@/stores/connection-store'

// Header 내부
const connectionState = useConnectionStore((s) => s.state)

// 연결 상태 표시
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
```

## Acceptance Criteria

```bash
# 1. web 패키지 빌드
pnpm --filter @agentinc/web build

# 2. 전체 빌드 확인
pnpm build
```

**수동 확인 항목** (server와 web 동시 실행 필요):

1. **터미널 1**: `agentinc start` (API 서버 시작)
2. **터미널 2**: `pnpm --filter @agentinc/web dev` (Vite dev server)
3. 브라우저에서 http://localhost:3848 접속
4. 콘솔에서 `[SSE] Connected` 로그 확인
5. (선택) Header에 "Live" 연결 상태 표시 확인
6. 새 티켓 생성 시 (CLI로 `agentinc ticket create`) Kanban 보드에 실시간 반영 확인
7. Agent 상태 변경 시 Sidebar에 실시간 반영 확인

## AC 검증 방법

위 AC 커맨드를 실행하라. 빌드 성공하고 수동 확인이 완료되면 `/tasks/12-gui-dashboard/index.json`의 phase 6 status를 `"completed"`로 변경하라.
수정 3회 이상 시도해도 실패하면 status를 `"error"`로 변경하고, 에러 내용을 `"error_message"` 필드로 기록하라.

## 주의사항

- **EventSource URL**: 개발 모드에서는 Vite proxy를 통해 `/events`로 접근. 프로덕션에서는 같은 도메인이므로 동일하게 동작.
- **중복 이벤트 처리**: `ticket:created` 핸들러에서 중복 티켓 추가 방지 로직 필수.
- **메모리 누수 방지**: useEffect cleanup에서 EventSource 및 timeout 정리 필수.
- **타입 안정성**: SSE 이벤트 데이터 파싱 시 타입 assertion 사용. 런타임 검증은 생략 (신뢰할 수 있는 내부 서버).
- **재연결 로직**: 단순 delay 후 재연결. 지수 백오프는 과잉 구현이므로 생략.
- 연결 상태 표시 기능은 선택사항이다. 시간이 부족하면 생략해도 무방.
