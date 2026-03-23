# Phase 3: ticket-service

## 사전 준비

먼저 아래 문서들을 반드시 읽고 프로젝트의 전체 아키텍처와 설계 의도를 완전히 이해하라:

- `/spec/spec.md`
- `/spec/architecture.md`
- `/spec/adr.md`
- `/spec/testing.md`
- `/spec/test-cases.md`
- `/tasks/7-ticket-system/spec-diff.md` (이번 task의 문서 변경 기록)

그리고 이전 phase의 작업물을 반드시 확인하라:

- `/src/types/index.ts` (Phase 1)
- `/src/store/ticket-store.ts` (Phase 2)
- `/src/store/fs-ticket-store.ts` (Phase 2)
- `/src/store/agent-status-store.ts` (Phase 2)

기존 service 패턴을 참고하라:

- `/src/services/agent.service.ts`

## 작업 내용

Ticket 비즈니스 로직을 담당하는 TicketService를 구현한다.

### 1. `src/services/ticket.service.ts`

```typescript
import { ITicketStore } from '../store/ticket-store'
import { IStore } from '../store/store'
import {
  Ticket,
  CreateTicketInput,
  TicketFilter,
  TicketPriority,
  CreateCommentInput,
  Comment,
} from '../types'

export class TicketService {
  constructor(
    private ticketStore: ITicketStore,
    private agentStore: IStore
  ) {}

  /**
   * Ticket 생성
   * - cc가 있으면 원본 ticket은 status=blocked로 생성
   * - cc된 agent 수만큼 cc_review ticket도 함께 생성
   * - cc가 없으면 status=ready로 생성
   * - createdBy가 agent name이면 해당 agent의 can_delegate 확인
   */
  async createTicket(input: CreateTicketInput): Promise<Ticket> { ... }

  /**
   * Ticket 조회
   */
  async getTicket(id: string): Promise<Ticket | null> { ... }

  /**
   * Ticket 목록 조회
   */
  async listTickets(filter?: TicketFilter): Promise<Ticket[]> { ... }

  /**
   * Ticket 상태 업데이트
   * - in_progress로 변경 시 startedAt 자동 설정
   * - completed/failed로 변경 시 completedAt 자동 설정
   */
  async updateTicketStatus(
    id: string,
    status: Ticket['status'],
    expectedVersion: number,
    result?: Ticket['result']
  ): Promise<Ticket> { ... }

  /**
   * Ticket priority 업데이트
   * - task ticket인 경우 연결된 cc_review tickets의 priority도 함께 변경
   */
  async updateTicketPriority(
    id: string,
    priority: TicketPriority,
    expectedVersion: number
  ): Promise<Ticket> { ... }

  /**
   * Ticket 취소
   * - blocked, ready 상태에서만 가능
   * - task ticket인 경우 연결된 cc_review tickets도 함께 취소
   */
  async cancelTicket(id: string, expectedVersion: number): Promise<Ticket> { ... }

  /**
   * Comment 추가
   * - cc_review ticket에 comment 추가 시 parent ticket에도 복사
   */
  async addComment(ticketId: string, input: CreateCommentInput): Promise<Comment> { ... }

  /**
   * cc_review 완료 확인
   * - 모든 cc_review가 completed면 parent ticket을 blocked -> ready로 전환
   * - cc_review들의 comments를 parent ticket에 복사
   *
   * 이 메서드는 cc_review ticket이 completed될 때 호출되어야 함
   */
  async checkCcCompletion(parentTicketId: string): Promise<void> { ... }

  /**
   * 실행 로그 저장
   */
  async saveLog(ticketId: string, log: string): Promise<void> { ... }

  /**
   * 실행 로그 조회
   */
  async getLog(ticketId: string): Promise<string | null> { ... }
}
```

### 핵심 비즈니스 규칙

#### cc_review ticket 생성

cc가 있을 때 `createTicket()` 내부 로직:

```typescript
// 1. 원본 task ticket 생성 (status: blocked)
const taskTicket = await this.ticketStore.create({
  ...input,
  type: 'task',
  status: 'blocked',
  ccReviewTicketIds: [], // 아래에서 채움
})

// 2. 각 cc agent에 대해 cc_review ticket 생성
const ccReviewIds: string[] = []
for (const ccAgent of input.cc) {
  const ccReview = await this.ticketStore.create({
    title: `[CC Review] ${input.title}`,
    prompt: '', // cc_review는 prompt 없음, parent 참조
    type: 'cc_review',
    assignee: ccAgent,
    priority: input.priority ?? 'normal',
    status: 'ready',
    parentTicketId: taskTicket.id,
    createdBy: input.createdBy,
  })
  ccReviewIds.push(ccReview.id)
}

// 3. task ticket에 ccReviewTicketIds 업데이트
await this.ticketStore.update(taskTicket.id, {
  ccReviewTicketIds: ccReviewIds,
  expectedVersion: taskTicket.version,
})
```

#### 위임 권한 확인

`createdBy`가 `'user'`가 아니면 (agent name이면):

```typescript
const agent = this.agentStore.getAgent(input.createdBy)
if (!agent.can_delegate) {
  throw new Error(`Agent '${input.createdBy}' does not have delegation permission`)
}
```

#### checkCcCompletion 로직

```typescript
async checkCcCompletion(parentTicketId: string): Promise<void> {
  const parent = await this.ticketStore.get(parentTicketId)
  if (!parent || parent.type !== 'task' || parent.status !== 'blocked') return

  const ccReviewIds = parent.ccReviewTicketIds ?? []
  if (ccReviewIds.length === 0) return

  // 모든 cc_review가 completed인지 확인
  const ccReviews = await Promise.all(
    ccReviewIds.map(id => this.ticketStore.get(id))
  )

  const allCompleted = ccReviews.every(r => r?.status === 'completed')
  if (!allCompleted) return

  // comments 복사
  for (const review of ccReviews) {
    if (!review) continue
    for (const comment of review.comments) {
      await this.ticketStore.addComment(parentTicketId, {
        author: comment.author,
        content: comment.content,
      })
    }
  }

  // parent status -> ready
  await this.ticketStore.update(parentTicketId, {
    status: 'ready',
    expectedVersion: parent.version,
  })
}
```

### 2. 테스트 작성

#### `src/services/__tests__/ticket.service.test.ts`

`/spec/test-cases.md`의 `ticket.service` 섹션에 명시된 테스트 케이스를 구현하라.

테스트 setup:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { TicketService } from '../ticket.service'
import { FsTicketStore } from '../../store/fs-ticket-store'
import { FsStore } from '../../store/fs-store'

describe('TicketService', () => {
  let testDir: string
  let ticketStore: FsTicketStore
  let agentStore: FsStore
  let service: TicketService

  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-ticket-svc-test-'))
    ticketStore = new FsTicketStore(testDir)
    agentStore = new FsStore(testDir)
    service = new TicketService(ticketStore, agentStore)

    // 테스트용 agent 생성
    fs.mkdirSync(path.join(testDir, 'agents', 'developer'), { recursive: true })
    fs.writeFileSync(
      path.join(testDir, 'agents', 'developer', 'agent.json'),
      JSON.stringify({ name: 'developer', description: 'test', can_delegate: true })
    )
    fs.mkdirSync(path.join(testDir, 'agents', 'designer'), { recursive: true })
    fs.writeFileSync(
      path.join(testDir, 'agents', 'designer', 'agent.json'),
      JSON.stringify({ name: 'designer', description: 'test', can_delegate: false })
    )
  })

  afterEach(() => {
    fs.rmSync(testDir, { recursive: true, force: true })
  })

  // 테스트 케이스들...
})
```

## Acceptance Criteria

```bash
npm run build  # 컴파일 에러 없음
npm test       # 모든 테스트 통과 (기존 + 신규)
```

## AC 검증 방법

위 AC 커맨드를 실행하라. 모두 통과하면 `/tasks/7-ticket-system/index.json`의 phase 3 status를 `"completed"`로 변경하라.
수정 3회 이상 시도해도 실패하면 status를 `"error"`로 변경하고, 에러 내용을 index.json의 해당 phase에 `"error_message"` 필드로 기록하라.

## 주의사항

- Store의 낙관적 락 에러를 적절히 처리하라. Service에서 재시도 로직은 구현하지 않는다 (호출자 책임).
- `checkCcCompletion()`은 cc_review가 completed될 때마다 호출되어야 한다. 이 호출은 Phase 5 (agent-runner)에서 구현된다.
- 트랜잭션이 없으므로 중간 실패 시 부분 업데이트가 발생할 수 있다. MVP에서는 허용한다.
