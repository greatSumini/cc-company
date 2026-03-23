# Phase 1: types-metadata

## 사전 준비

먼저 아래 문서들을 반드시 읽고 프로젝트의 전체 아키텍처와 설계 의도를 완전히 이해하라:

- `/spec/spec.md`
- `/spec/architecture.md`
- `/spec/adr.md`
- `/tasks/8-pr-webhook/spec-diff.md` (이번 task의 문서 변경 기록)

그리고 아래 파일들을 읽고 현재 구현 상태를 파악하라:

- `/src/types/index.ts`
- `/src/store/ticket-store.ts`
- `/src/store/fs-ticket-store.ts`

## 작업 내용

### 1. `/src/types/index.ts` 수정

#### 1.1 TicketMetadata 인터페이스 추가

파일 하단, Ticket 인터페이스 위에 추가:

```typescript
// ============================================
// Ticket Metadata Types
// ============================================

export type TicketSource = 'user' | 'webhook' | 'agent'
export type GithubEventType = 'review_comment' | 'review_approved' | 'conflict_resolve'

export interface GithubTicketMetadata {
  repo: string                    // owner/repo
  prNumber: number
  prUrl: string
  commentIds?: string[]           // 묶인 comment IDs (중복 방지용)
  eventType?: GithubEventType
  reviewers?: string[]            // requested reviewers (approve 조건 체크용)
}

export interface TicketMetadata {
  source?: TicketSource
  github?: GithubTicketMetadata
}
```

#### 1.2 Ticket 인터페이스에 metadata 필드 추가

```typescript
export interface Ticket {
  // ... 기존 필드들 ...
  metadata?: TicketMetadata       // 추가
  version: number
}
```

#### 1.3 WebhookConfig 인터페이스 추가

GlobalConfig 위에 추가:

```typescript
// ============================================
// Webhook Config Types
// ============================================

export type ApproveCondition = 'any' | 'all'

export interface WebhookConfig {
  enabled: boolean
  secret?: string                 // GitHub webhook secret (signature 검증용)
  smeeUrl?: string                // smee.io 채널 URL (로컬 개발용)
  approveCondition?: ApproveCondition  // 기본: 'any'
}
```

#### 1.4 GlobalConfig에 webhook 추가

```typescript
export interface GlobalConfig {
  version: string
  ticketServer?: TicketServerConfig
  webhook?: WebhookConfig         // 추가
}
```

#### 1.5 CreateTicketInput에 metadata 추가

```typescript
export interface CreateTicketInput {
  title: string
  prompt: string
  assignee: string
  cc?: string[]
  priority?: TicketPriority
  createdBy: string
  metadata?: TicketMetadata       // 추가
}
```

### 2. `/src/store/ticket-store.ts` 수정

ITicketStore.create() 메서드의 input 타입이 Ticket의 일부 필드를 제외하는데, metadata가 optional이므로 자동으로 포함된다. 별도 수정 불필요.

다만 명시성을 위해 주석을 추가하라:

```typescript
export interface ITicketStore {
  // CRUD
  // metadata는 optional이므로 input에 포함 가능
  create(
    input: Omit<Ticket, 'id' | 'version' | 'comments' | 'createdAt'>
  ): Promise<Ticket>
  // ...
}
```

### 3. `/src/store/fs-ticket-store.ts` 수정

create() 메서드에서 metadata 필드가 input에 있으면 그대로 저장되도록 확인. JSON.stringify/parse가 자동으로 처리하므로 코드 변경은 필요 없다. 단, input spread 시 metadata가 포함되는지 확인:

```typescript
async create(
  input: Omit<Ticket, 'id' | 'version' | 'comments' | 'createdAt'>
): Promise<Ticket> {
  this.ensureTicketsDir()

  const ticket: Ticket = {
    ...input,  // metadata가 있으면 여기에 포함됨
    id: crypto.randomUUID(),
    version: 1,
    comments: [],
    createdAt: new Date().toISOString(),
  }

  fs.writeFileSync(this.ticketPath(ticket.id), JSON.stringify(ticket, null, 2))
  return ticket
}
```

현재 구현이 이미 이 형태라면 수정 불필요.

### 4. `/src/services/ticket.service.ts` 수정

createTicket() 메서드에서 metadata를 전달하도록 수정:

```typescript
async createTicket(input: CreateTicketInput): Promise<Ticket> {
  // ... 기존 로직 ...

  const taskTicket = await this.ticketStore.create({
    title: input.title,
    prompt: input.prompt,
    type: 'task',
    assignee: input.assignee,
    priority: input.priority ?? 'normal',
    status: hasCc ? 'blocked' : 'ready',
    createdBy: input.createdBy,
    ccReviewTicketIds: [],
    metadata: input.metadata,     // 추가
  })

  // ... 나머지 로직 ...
}
```

## Acceptance Criteria

```bash
npm run build  # 컴파일 에러 없음
npm test       # 모든 테스트 통과
```

## AC 검증 방법

위 AC 커맨드를 실행하라. 모두 통과하면 `/tasks/8-pr-webhook/index.json`의 phase 1 status를 `"completed"`로 변경하라.
수정 3회 이상 시도해도 실패하면 status를 `"error"`로 변경하고, 에러 내용을 index.json의 해당 phase에 `"error_message"` 필드로 기록하라.

## 주의사항

- metadata는 optional 필드다. 기존 ticket 생성 로직에 영향을 주지 않아야 한다.
- 기존 테스트가 깨지지 않도록 주의하라.
- 타입 정의만 추가하고, 실제 webhook 처리 로직은 이후 phase에서 구현한다.
