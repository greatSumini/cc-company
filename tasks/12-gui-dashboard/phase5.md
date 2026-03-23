# Phase 5: Kanban 보드 구현

## 사전 준비

먼저 아래 문서들을 반드시 읽고 프로젝트의 전체 아키텍처와 설계 의도를 완전히 이해하라:

- `/spec/architecture.md` — Ticket 모델, GUI 아키텍처
- `/spec/adr.md` — ADR-017 (Ticket 시스템)
- `/tasks/12-gui-dashboard/spec-diff.md` — 이번 task의 문서 변경 기록

그리고 이전 phase의 작업물을 반드시 확인하라:

- `packages/web/src/components/` — Phase 4에서 생성된 기본 컴포넌트
- `packages/web/src/lib/api-client.ts` — API 클라이언트
- `packages/web/src/stores/` — Zustand 스토어
- `packages/core/src/types/index.ts` — Ticket 타입 정의 (status, priority, type 등)

이전 phase에서 만들어진 코드를 꼼꼼히 읽고, 설계 의도를 이해한 뒤 작업하라.

## 작업 내용

### 1. Ticket 타입 정의 (Web용)

#### 1.1 `packages/web/src/types/ticket.ts` 생성

core 패키지의 타입을 참조하되, 필요시 re-export하거나 확장:

```typescript
// core 패키지에서 타입 import
import type { Ticket, TicketStatus, TicketType } from '@agentinc/core'

export type { Ticket, TicketStatus, TicketType }

// UI용 헬퍼 타입
export type KanbanColumn = 'blocked' | 'ready' | 'working' | 'done'

export function getKanbanColumn(status: TicketStatus): KanbanColumn {
  switch (status) {
    case 'blocked':
      return 'blocked'
    case 'ready':
      return 'ready'
    case 'in_progress':
      return 'working'
    case 'completed':
    case 'failed':
    case 'cancelled':
      return 'done'
    default:
      return 'ready'
  }
}
```

### 2. Ticket Card 컴포넌트

#### 2.1 `packages/web/src/components/ticket/TicketCard.tsx` 생성

```tsx
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { useAgentStore } from '@/stores/agent-store'
import { useUIStore } from '@/stores/ui-store'
import type { Ticket } from '@/types/ticket'

interface TicketCardProps {
  ticket: Ticket
}

// Priority 색상 매핑
const priorityVariant: Record<string, 'red' | 'yellow' | 'gray' | 'blue'> = {
  urgent: 'red',
  high: 'yellow',
  normal: 'gray',
  low: 'blue',
}

// Type 색상 매핑
const typeVariant: Record<string, 'purple' | 'green'> = {
  task: 'purple',
  cc_review: 'green',
}

// Done 상태 아이콘
const doneIcons: Record<string, string> = {
  completed: '✅',
  failed: '❌',
  cancelled: '🚫',
}

export function TicketCard({ ticket }: TicketCardProps) {
  const statuses = useAgentStore((s) => s.statuses)
  const setSelectedTicketId = useUIStore((s) => s.setSelectedTicketId)

  const shortId = ticket.id.slice(0, 6)
  const isDone = ['completed', 'failed', 'cancelled'].includes(ticket.status)
  const agentStatus = statuses[ticket.assignee]

  // 상대 시간 계산
  const createdAt = new Date(ticket.createdAt)
  const relativeTime = getRelativeTime(createdAt)

  return (
    <div
      onClick={() => setSelectedTicketId(ticket.id)}
      className={cn(
        'card card-hover p-3 cursor-pointer',
        'flex flex-col gap-2'
      )}
    >
      {/* 상단: Priority, ID, Type, Done 아이콘 */}
      <div className="flex items-center gap-2 text-xs">
        <Badge variant={priorityVariant[ticket.priority] || 'gray'}>
          {ticket.priority}
        </Badge>
        <span className="text-gray-400">#{shortId}</span>
        <Badge variant={typeVariant[ticket.type] || 'gray'}>
          {ticket.type}
        </Badge>
        {isDone && (
          <span className="ml-auto">{doneIcons[ticket.status]}</span>
        )}
      </div>

      {/* 제목 */}
      <h3 className="text-sm font-medium text-gray-900 line-clamp-2">
        {ticket.title}
      </h3>

      {/* 하단: Assignee, 시간 */}
      <div className="flex items-center justify-between text-xs text-gray-500">
        <div className="flex items-center gap-1.5">
          <span
            className={cn(
              'w-1.5 h-1.5 rounded-full',
              agentStatus === 'working' ? 'bg-green-500' : 'bg-gray-300'
            )}
          />
          <span>{ticket.assignee}</span>
        </div>
        <span>{relativeTime}</span>
      </div>

      {/* 추가 정보: 댓글 수, GitHub 링크 */}
      {(ticket.comments?.length > 0 || ticket.metadata?.github?.prUrl) && (
        <div className="flex items-center gap-3 text-xs text-gray-400">
          {ticket.comments?.length > 0 && (
            <span>💬 {ticket.comments.length}</span>
          )}
          {ticket.metadata?.github?.prUrl && (
            <a
              href={ticket.metadata.github.prUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="hover:text-gray-600"
            >
              🔗 PR #{ticket.metadata.github.prNumber}
            </a>
          )}
        </div>
      )}
    </div>
  )
}

// 상대 시간 헬퍼 함수
function getRelativeTime(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return '방금 전'
  if (diffMins < 60) return `${diffMins}분 전`
  if (diffHours < 24) return `${diffHours}시간 전`
  return `${diffDays}일 전`
}
```

### 3. Kanban Column 컴포넌트

#### 3.1 `packages/web/src/components/kanban/KanbanColumn.tsx` 생성

```tsx
import { TicketCard } from '@/components/ticket/TicketCard'
import type { Ticket } from '@/types/ticket'

interface KanbanColumnProps {
  title: string
  tickets: Ticket[]
  count: number
  maxDisplay?: number
  showMoreLabel?: string
}

export function KanbanColumn({
  title,
  tickets,
  count,
  maxDisplay,
  showMoreLabel,
}: KanbanColumnProps) {
  const displayTickets = maxDisplay ? tickets.slice(0, maxDisplay) : tickets
  const hasMore = maxDisplay && tickets.length > maxDisplay

  return (
    <div className="flex flex-col w-72 min-w-72">
      {/* Column Header */}
      <div className="flex items-center gap-2 mb-3 px-1">
        <h2 className="text-sm font-semibold text-gray-700">{title}</h2>
        <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
          {count}
        </span>
      </div>

      {/* Tickets */}
      <div className="flex flex-col gap-2 flex-1">
        {displayTickets.map((ticket) => (
          <TicketCard key={ticket.id} ticket={ticket} />
        ))}

        {/* 더 보기 */}
        {hasMore && (
          <button className="text-xs text-gray-500 hover:text-gray-700 py-2">
            {showMoreLabel || `+${tickets.length - maxDisplay!}개 더 보기`}
          </button>
        )}

        {/* 빈 상태 */}
        {tickets.length === 0 && (
          <div className="text-xs text-gray-400 text-center py-8">
            티켓 없음
          </div>
        )}
      </div>
    </div>
  )
}
```

### 4. Kanban Board 컴포넌트

#### 4.1 `packages/web/src/components/kanban/KanbanBoard.tsx` 생성

```tsx
import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { useUIStore } from '@/stores/ui-store'
import { KanbanColumn } from './KanbanColumn'
import { getKanbanColumn } from '@/types/ticket'
import type { Ticket } from '@/types/ticket'

const DONE_MAX_DISPLAY = 20

export function KanbanBoard() {
  const agentFilter = useUIStore((s) => s.agentFilter)

  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ['tickets'],
    queryFn: () => api.tickets.list(),
  })

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
```

### 5. Ticket Detail Panel 컴포넌트

#### 5.1 `packages/web/src/components/ticket/TicketDetailPanel.tsx` 생성

```tsx
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { useUIStore } from '@/stores/ui-store'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { Ticket } from '@/types/ticket'

const priorityVariant: Record<string, 'red' | 'yellow' | 'gray' | 'blue'> = {
  urgent: 'red',
  high: 'yellow',
  normal: 'gray',
  low: 'blue',
}

const statusLabels: Record<string, string> = {
  blocked: 'Blocked',
  ready: 'Ready',
  in_progress: 'Working',
  completed: 'Completed',
  failed: 'Failed',
  cancelled: 'Cancelled',
}

export function TicketDetailPanel() {
  const selectedTicketId = useUIStore((s) => s.selectedTicketId)
  const setSelectedTicketId = useUIStore((s) => s.setSelectedTicketId)

  const { data: ticket, isLoading } = useQuery({
    queryKey: ['ticket', selectedTicketId],
    queryFn: () => api.tickets.get(selectedTicketId!),
    enabled: !!selectedTicketId,
  })

  if (!selectedTicketId) {
    return null
  }

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/20 z-40"
        onClick={() => setSelectedTicketId(null)}
      />

      {/* Panel */}
      <div className="fixed right-0 top-14 bottom-0 w-96 bg-white border-l border-gray-200 z-50 overflow-y-auto shadow-lg">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 truncate pr-4">
            {isLoading ? '로딩 중...' : (ticket as Ticket)?.title}
          </h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelectedTicketId(null)}
          >
            ✕
          </Button>
        </div>

        {isLoading ? (
          <div className="p-4 text-gray-500">로딩 중...</div>
        ) : ticket ? (
          <TicketDetailContent ticket={ticket as Ticket} />
        ) : null}
      </div>
    </>
  )
}

function TicketDetailContent({ ticket }: { ticket: Ticket }) {
  return (
    <div className="p-4 space-y-6">
      {/* 기본 정보 */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 w-20">Status</span>
          <span className="text-sm font-medium">{statusLabels[ticket.status]}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 w-20">Assignee</span>
          <span className="text-sm">{ticket.assignee}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 w-20">Priority</span>
          <Badge variant={priorityVariant[ticket.priority] || 'gray'}>
            {ticket.priority}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 w-20">Type</span>
          <span className="text-sm">{ticket.type}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 w-20">Created</span>
          <span className="text-sm text-gray-600">
            {new Date(ticket.createdAt).toLocaleString('ko-KR')}
          </span>
        </div>
        {ticket.startedAt && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 w-20">Started</span>
            <span className="text-sm text-gray-600">
              {new Date(ticket.startedAt).toLocaleString('ko-KR')}
            </span>
          </div>
        )}
        {ticket.completedAt && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 w-20">Completed</span>
            <span className="text-sm text-gray-600">
              {new Date(ticket.completedAt).toLocaleString('ko-KR')}
            </span>
          </div>
        )}
      </section>

      {/* Prompt */}
      <section>
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
          Prompt
        </h3>
        <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-700 whitespace-pre-wrap">
          {ticket.prompt}
        </div>
      </section>

      {/* GitHub */}
      {ticket.metadata?.github?.prUrl && (
        <section>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            GitHub
          </h3>
          <a
            href={ticket.metadata.github.prUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-blue-600 hover:underline"
          >
            PR #{ticket.metadata.github.prNumber}
          </a>
        </section>
      )}

      {/* Comments */}
      {ticket.comments && ticket.comments.length > 0 && (
        <section>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Comments ({ticket.comments.length})
          </h3>
          <div className="space-y-3">
            {ticket.comments.map((comment) => (
              <div
                key={comment.id}
                className="bg-gray-50 rounded-lg p-3"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-gray-700">
                    {comment.author}
                  </span>
                  <span className="text-xs text-gray-400">
                    {new Date(comment.createdAt).toLocaleString('ko-KR')}
                  </span>
                </div>
                <p className="text-sm text-gray-600">{comment.content}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Result */}
      {ticket.result && (
        <section>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Result
          </h3>
          <div className="bg-gray-50 rounded-lg p-3 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Exit Code</span>
              <span className={`text-sm font-medium ${ticket.result.exitCode === 0 ? 'text-green-600' : 'text-red-600'}`}>
                {ticket.result.exitCode} {ticket.result.exitCode === 0 ? '✅' : '❌'}
              </span>
            </div>
            {ticket.result.logPath && (
              <div className="text-xs text-gray-500">
                Log: {ticket.result.logPath}
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  )
}
```

### 6. Agent Filter 컴포넌트

#### 6.1 `packages/web/src/components/kanban/AgentFilter.tsx` 생성

```tsx
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
```

### 7. HomePage 업데이트

#### 7.1 `packages/web/src/pages/HomePage.tsx` 수정

```tsx
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
```

### 8. index 파일 정리

#### 8.1 `packages/web/src/components/kanban/index.ts` 생성

```typescript
export * from './KanbanBoard'
export * from './KanbanColumn'
export * from './AgentFilter'
```

#### 8.2 `packages/web/src/components/ticket/index.ts` 생성

```typescript
export * from './TicketCard'
export * from './TicketDetailPanel'
```

## Acceptance Criteria

```bash
# 1. web 패키지 빌드
pnpm --filter @agentinc/web build

# 2. 개발 서버 실행 및 수동 확인
pnpm --filter @agentinc/web dev
```

**수동 확인 항목**:
- Kanban 보드에 4개 컬럼 (Blocked, Ready, Working, Done) 표시
- Ticket Card에 priority 뱃지, ID, type 뱃지, title, assignee, 시간 표시
- Done 컬럼에 최대 20개 티켓 + "더 보기" 버튼 (티켓이 20개 초과시)
- Card 클릭 시 오른쪽에 상세 패널 슬라이드
- Agent Filter 동작 (All/개별 agent 선택)

## AC 검증 방법

위 AC 커맨드를 실행하라. 빌드 성공하고 수동 확인이 완료되면 `/tasks/12-gui-dashboard/index.json`의 phase 5 status를 `"completed"`로 변경하라.
수정 3회 이상 시도해도 실패하면 status를 `"error"`로 변경하고, 에러 내용을 `"error_message"` 필드로 기록하라.

## 주의사항

- **디자인 원칙 준수**:
  - Card: `card` 클래스 사용 (흰색 배경, 옅은 shadow, 얇은 border)
  - 뱃지만 파스텔톤 배경 사용
  - Done 상태 아이콘: ✅ (completed), ❌ (failed), 🚫 (cancelled)
- Ticket 타입은 `@agentinc/core`에서 import하라. 타입이 없으면 any로 우회하지 말고 core 패키지 타입을 확인하라.
- `line-clamp-2` 클래스 사용을 위해 Tailwind에 `@tailwindcss/line-clamp` 플러그인이 필요할 수 있다. Tailwind 3.3+에서는 기본 포함.
- API 응답 타입 캐스팅은 임시방편. 이후 phase에서 타입 안정성을 개선할 수 있다.
