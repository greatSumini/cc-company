# Phase 1: types

## 사전 준비

먼저 아래 문서들을 반드시 읽고 프로젝트의 전체 아키텍처와 설계 의도를 완전히 이해하라:

- `/docs/spec.md`
- `/docs/architecture.md`
- `/docs/adr.md`
- `/tasks/7-ticket-system/docs-diff.md` (이번 task의 문서 변경 기록)

그리고 기존 타입 정의를 확인하라:

- `/src/types/index.ts`

## 작업 내용

Ticket 시스템에 필요한 타입 정의를 추가한다.

### 1. `src/types/index.ts` — Ticket 관련 타입 추가

파일 끝에 다음 타입들을 추가:

```typescript
// ============================================
// Ticket System Types
// ============================================

export type TicketStatus = 'blocked' | 'ready' | 'in_progress' | 'completed' | 'failed' | 'cancelled'
export type TicketType = 'task' | 'cc_review'
export type TicketPriority = 'low' | 'normal' | 'high' | 'urgent'

export interface Comment {
  id: string
  author: string
  content: string
  createdAt: string
}

export interface TicketResult {
  exitCode: number
  logPath: string
}

export interface Ticket {
  id: string
  title: string
  prompt: string
  type: TicketType
  parentTicketId?: string
  ccReviewTicketIds?: string[]
  assignee: string
  priority: TicketPriority
  status: TicketStatus
  createdBy: string
  createdAt: string
  startedAt?: string
  completedAt?: string
  cancelledAt?: string
  result?: TicketResult
  comments: Comment[]
  version: number
}

export interface CreateTicketInput {
  title: string
  prompt: string
  assignee: string
  cc?: string[]
  priority?: TicketPriority
  createdBy: string
}

export interface UpdateTicketInput {
  status?: TicketStatus
  priority?: TicketPriority
  startedAt?: string
  completedAt?: string
  cancelledAt?: string
  result?: TicketResult
  expectedVersion: number
}

export interface TicketFilter {
  status?: TicketStatus
  assignee?: string
  type?: TicketType
}

export interface CreateCommentInput {
  author: string
  content: string
}

// ============================================
// Agent Status Types
// ============================================

export type AgentState = 'offline' | 'idle' | 'working'

export interface AgentStatus {
  name: string
  state: AgentState
  currentTicketId?: string
  processStartedAt?: string
  lastHeartbeatAt?: string
}

// ============================================
// Ticket Server Config
// ============================================

export interface TicketServerConfig {
  port: number
  pollingIntervalMs: number
  idleTimeoutMs: number
  heartbeatTimeoutMs: number
}
```

### 2. `src/types/index.ts` — AgentConfig 확장

기존 `AgentConfig` 인터페이스에 `can_delegate` 필드를 추가:

```typescript
export interface AgentConfig {
  name: string
  description: string
  gh_user?: string
  can_delegate?: boolean  // 추가
  subagents?: string[]
  skills?: string[]
  hooks?: string[]
}
```

### 3. `src/types/index.ts` — GlobalConfig 타입 추가 (없으면 생성)

config.json을 위한 타입을 추가하거나 확장:

```typescript
export interface GlobalConfig {
  version: string
  ticketServer?: TicketServerConfig
}
```

## Acceptance Criteria

```bash
npm run build  # 컴파일 에러 없음
npm test       # 기존 테스트 모두 통과
```

## AC 검증 방법

위 AC 커맨드를 실행하라. 모두 통과하면 `/tasks/7-ticket-system/index.json`의 phase 1 status를 `"completed"`로 변경하라.
수정 3회 이상 시도해도 실패하면 status를 `"error"`로 변경하고, 에러 내용을 index.json의 해당 phase에 `"error_message"` 필드로 기록하라.

## 주의사항

- 타입 정의만 추가하라. 구현 코드는 건드리지 마라.
- 기존 타입을 수정할 때 하위 호환성을 유지하라 (optional 필드 추가만).
- 기존 테스트가 깨지지 않도록 주의하라.
