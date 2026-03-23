# Phase 2: ticket-store

## 사전 준비

먼저 아래 문서들을 반드시 읽고 프로젝트의 전체 아키텍처와 설계 의도를 완전히 이해하라:

- `/spec/spec.md`
- `/spec/architecture.md`
- `/spec/adr.md`
- `/spec/testing.md`
- `/spec/test-cases.md`
- `/tasks/7-ticket-system/spec-diff.md` (이번 task의 문서 변경 기록)

그리고 이전 phase의 작업물을 반드시 확인하라:

- `/src/types/index.ts` (Phase 1에서 추가된 타입들)

기존 store 구현 패턴을 참고하라:

- `/src/store/store.ts` (IStore 인터페이스)
- `/src/store/fs-store.ts` (파일 기반 구현 패턴)

## 작업 내용

Ticket 저장소와 Agent Status 저장소를 구현한다.

### 1. `src/store/ticket-store.ts` — ITicketStore 인터페이스

```typescript
import {
  Ticket,
  CreateTicketInput,
  UpdateTicketInput,
  TicketFilter,
  Comment,
  CreateCommentInput,
} from '../types'

export interface ITicketStore {
  // CRUD
  create(input: Omit<Ticket, 'id' | 'version' | 'comments' | 'createdAt'>): Promise<Ticket>
  get(id: string): Promise<Ticket | null>
  list(filter?: TicketFilter): Promise<Ticket[]>
  update(id: string, input: UpdateTicketInput): Promise<Ticket>

  // 취소
  cancel(id: string, expectedVersion: number): Promise<Ticket>

  // 코멘트
  addComment(ticketId: string, input: CreateCommentInput): Promise<Comment>

  // 실행 로그
  saveLog(ticketId: string, log: string): Promise<void>
  getLog(ticketId: string): Promise<string | null>
}

export class OptimisticLockError extends Error {
  constructor(message = 'Version mismatch') {
    super(message)
    this.name = 'OptimisticLockError'
  }
}

export class TicketNotFoundError extends Error {
  constructor(id: string) {
    super(`Ticket not found: ${id}`)
    this.name = 'TicketNotFoundError'
  }
}

export class InvalidStatusTransitionError extends Error {
  constructor(from: string, to: string) {
    super(`Invalid status transition: ${from} -> ${to}`)
    this.name = 'InvalidStatusTransitionError'
  }
}
```

### 2. `src/store/fs-ticket-store.ts` — 파일 기반 구현

핵심 구현 요구사항:

- **저장 경로**: `.cc-company/tickets/{id}.json`
- **로그 경로**: `.cc-company/tickets/{id}/execution.log`
- **ID 생성**: `crypto.randomUUID()` 사용
- **낙관적 락**: `update()` 시 `expectedVersion`과 현재 `version` 비교, 불일치 시 `OptimisticLockError`
- **cancel 제약**: `blocked`, `ready` 상태에서만 취소 가능. 그 외 상태에서는 `InvalidStatusTransitionError`
- **list 필터**: status, assignee, type 필드로 필터링. 모든 필드는 AND 조건.
- **정렬**: priority 순 (urgent > high > normal > low), 같으면 createdAt 오름차순

구현 시그니처:

```typescript
import { ITicketStore, OptimisticLockError, TicketNotFoundError, InvalidStatusTransitionError } from './ticket-store'
import { Ticket, TicketFilter, UpdateTicketInput, Comment, CreateCommentInput } from '../types'

export class FsTicketStore implements ITicketStore {
  constructor(private basePath: string) {}

  private get ticketsDir(): string { /* .cc-company/tickets */ }
  private ticketPath(id: string): string { /* tickets/{id}.json */ }
  private ticketLogDir(id: string): string { /* tickets/{id}/ */ }
  private ticketLogPath(id: string): string { /* tickets/{id}/execution.log */ }

  async create(input: Omit<Ticket, 'id' | 'version' | 'comments' | 'createdAt'>): Promise<Ticket> { ... }
  async get(id: string): Promise<Ticket | null> { ... }
  async list(filter?: TicketFilter): Promise<Ticket[]> { ... }
  async update(id: string, input: UpdateTicketInput): Promise<Ticket> { ... }
  async cancel(id: string, expectedVersion: number): Promise<Ticket> { ... }
  async addComment(ticketId: string, input: CreateCommentInput): Promise<Comment> { ... }
  async saveLog(ticketId: string, log: string): Promise<void> { ... }
  async getLog(ticketId: string): Promise<string | null> { ... }
}
```

priority 정렬 헬퍼:

```typescript
const PRIORITY_ORDER: Record<TicketPriority, number> = {
  urgent: 0,
  high: 1,
  normal: 2,
  low: 3,
}
```

### 3. `src/store/agent-status-store.ts` — Agent 상태 저장소

```typescript
import { AgentStatus, AgentState } from '../types'

export interface IAgentStatusStore {
  get(name: string): Promise<AgentStatus | null>
  getAll(): Promise<Record<string, AgentStatus>>
  updateState(name: string, state: AgentState, currentTicketId?: string): Promise<void>
  updateHeartbeat(name: string): Promise<void>
  remove(name: string): Promise<void>
}

export class AgentStatusStore implements IAgentStatusStore {
  constructor(
    private basePath: string,
    private heartbeatTimeoutMs: number = 30000
  ) {}

  private get statusPath(): string { /* .cc-company/status/agents.json */ }

  // getAll() 호출 시 heartbeatTimeout 초과한 agent는 state를 'offline'으로 반환
  async getAll(): Promise<Record<string, AgentStatus>> { ... }

  async get(name: string): Promise<AgentStatus | null> { ... }
  async updateState(name: string, state: AgentState, currentTicketId?: string): Promise<void> { ... }
  async updateHeartbeat(name: string): Promise<void> { ... }
  async remove(name: string): Promise<void> { ... }
}
```

- **저장 경로**: `.cc-company/status/agents.json`
- **offline 판정**: `getAll()` 또는 `get()` 호출 시 `lastHeartbeatAt`이 `heartbeatTimeoutMs`를 초과하면 `state`를 `'offline'`으로 반환 (파일은 수정하지 않음)

### 4. 테스트 작성

#### `src/store/__tests__/fs-ticket-store.test.ts`

`/spec/test-cases.md`의 `fs-ticket-store` 섹션에 명시된 테스트 케이스를 구현하라.

테스트 setup/teardown:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { FsTicketStore } from '../fs-ticket-store'

describe('FsTicketStore', () => {
  let testDir: string
  let store: FsTicketStore

  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-ticket-test-'))
    store = new FsTicketStore(testDir)
  })

  afterEach(() => {
    fs.rmSync(testDir, { recursive: true, force: true })
  })

  // 테스트 케이스들...
})
```

#### `src/store/__tests__/agent-status-store.test.ts`

`/spec/test-cases.md`의 `agent-status-store` 섹션에 명시된 테스트 케이스를 구현하라.

## Acceptance Criteria

```bash
npm run build  # 컴파일 에러 없음
npm test       # 모든 테스트 통과 (기존 + 신규)
```

## AC 검증 방법

위 AC 커맨드를 실행하라. 모두 통과하면 `/tasks/7-ticket-system/index.json`의 phase 2 status를 `"completed"`로 변경하라.
수정 3회 이상 시도해도 실패하면 status를 `"error"`로 변경하고, 에러 내용을 index.json의 해당 phase에 `"error_message"` 필드로 기록하라.

## 주의사항

- 비동기 함수는 모두 `async/await`로 구현하라 (callback 금지).
- 파일 I/O는 `fs.promises` 또는 `fs.*Sync` 중 일관되게 선택하라. 기존 fs-store 패턴을 따르라.
- 테스트는 실제 파일 I/O를 수행한다. mock 사용하지 마라.
- 디렉토리가 없으면 자동 생성하라 (`fs.mkdirSync(..., { recursive: true })`).
