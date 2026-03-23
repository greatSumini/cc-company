# Phase 7: tests-guide

## 사전 준비

먼저 아래 문서들을 반드시 읽고 프로젝트의 전체 아키텍처와 설계 의도를 완전히 이해하라:

- `/spec/spec.md`
- `/spec/architecture.md`
- `/spec/adr.md`
- `/spec/testing.md` (테스트 전략)
- `/tasks/8-pr-webhook/spec-diff.md` (이번 task의 문서 변경 기록)

그리고 이전 phase의 작업물을 반드시 확인하라:

- `/src/services/pr-event.service.ts`
- `/src/services/merge.service.ts`
- `/src/server/middleware/webhook-signature.ts`
- `/src/gh-client/index.ts`

기존 테스트 파일들도 확인하라:

- `/tests/` 디렉토리 구조
- 기존 테스트 패턴 (vitest 사용)

## 작업 내용

### 1. 테스트 fixture 생성

`/tests/fixtures/github-events/` 디렉토리 생성 및 fixture 파일들:

#### `/tests/fixtures/github-events/review-comment-created.json`

```json
{
  "action": "created",
  "comment": {
    "id": 12345,
    "body": "이 부분 수정이 필요합니다.",
    "user": {
      "login": "reviewer1",
      "id": 1001,
      "avatar_url": "https://avatars.githubusercontent.com/u/1001",
      "type": "User"
    },
    "html_url": "https://github.com/test-org/test-repo/pull/42#discussion_r12345",
    "created_at": "2026-03-23T10:00:00Z"
  },
  "pull_request": {
    "number": 42,
    "title": "feat: add new feature",
    "html_url": "https://github.com/test-org/test-repo/pull/42",
    "state": "open",
    "user": {
      "login": "dev-bot",
      "id": 2001,
      "avatar_url": "https://avatars.githubusercontent.com/u/2001",
      "type": "User"
    },
    "base": {
      "ref": "main",
      "repo": {
        "id": 1,
        "name": "test-repo",
        "full_name": "test-org/test-repo",
        "private": false,
        "html_url": "https://github.com/test-org/test-repo"
      }
    },
    "head": {
      "ref": "feature/new-feature",
      "repo": {
        "id": 1,
        "name": "test-repo",
        "full_name": "test-org/test-repo",
        "private": false,
        "html_url": "https://github.com/test-org/test-repo"
      }
    },
    "requested_reviewers": []
  },
  "repository": {
    "id": 1,
    "name": "test-repo",
    "full_name": "test-org/test-repo",
    "private": false,
    "html_url": "https://github.com/test-org/test-repo"
  },
  "sender": {
    "login": "reviewer1",
    "id": 1001,
    "avatar_url": "https://avatars.githubusercontent.com/u/1001",
    "type": "User"
  }
}
```

#### `/tests/fixtures/github-events/review-approved.json`

```json
{
  "action": "submitted",
  "review": {
    "id": 67890,
    "user": {
      "login": "reviewer1",
      "id": 1001,
      "avatar_url": "https://avatars.githubusercontent.com/u/1001",
      "type": "User"
    },
    "body": "LGTM!",
    "state": "approved",
    "submitted_at": "2026-03-23T11:00:00Z",
    "html_url": "https://github.com/test-org/test-repo/pull/42#pullrequestreview-67890"
  },
  "pull_request": {
    "number": 42,
    "title": "feat: add new feature",
    "html_url": "https://github.com/test-org/test-repo/pull/42",
    "state": "open",
    "user": {
      "login": "dev-bot",
      "id": 2001,
      "avatar_url": "https://avatars.githubusercontent.com/u/2001",
      "type": "User"
    },
    "base": {
      "ref": "main",
      "repo": {
        "id": 1,
        "name": "test-repo",
        "full_name": "test-org/test-repo",
        "private": false,
        "html_url": "https://github.com/test-org/test-repo"
      }
    },
    "head": {
      "ref": "feature/new-feature",
      "repo": {
        "id": 1,
        "name": "test-repo",
        "full_name": "test-org/test-repo",
        "private": false,
        "html_url": "https://github.com/test-org/test-repo"
      }
    },
    "requested_reviewers": []
  },
  "repository": {
    "id": 1,
    "name": "test-repo",
    "full_name": "test-org/test-repo",
    "private": false,
    "html_url": "https://github.com/test-org/test-repo"
  },
  "sender": {
    "login": "reviewer1",
    "id": 1001,
    "avatar_url": "https://avatars.githubusercontent.com/u/1001",
    "type": "User"
  }
}
```

### 2. PrEventService 테스트

`/tests/services/pr-event.service.test.ts` 생성:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PrEventService } from '../../src/services/pr-event.service.js'
import type { TicketService } from '../../src/services/ticket.service.js'
import type { IStore } from '../../src/store/store.js'
import type { IGhClient } from '../../src/gh-client/index.js'
import type { WebhookConfig, AgentConfig, Ticket } from '../../src/types/index.js'

// fixture import
import reviewCommentEvent from '../fixtures/github-events/review-comment-created.json'
import reviewApprovedEvent from '../fixtures/github-events/review-approved.json'

describe('PrEventService', () => {
  let service: PrEventService
  let mockTicketService: TicketService
  let mockAgentStore: IStore
  let mockGhClient: IGhClient
  let config: WebhookConfig

  const mockAgent: AgentConfig = {
    name: 'developer',
    description: 'Developer agent',
    gh_user: 'dev-bot',
  }

  beforeEach(() => {
    mockTicketService = {
      createTicket: vi.fn().mockResolvedValue({ id: 'ticket-1' }),
      listTickets: vi.fn().mockResolvedValue([]),
      addComment: vi.fn().mockResolvedValue({ id: 'comment-1' }),
    } as unknown as TicketService

    mockAgentStore = {
      listAgents: vi.fn().mockReturnValue([mockAgent]),
    } as unknown as IStore

    mockGhClient = {
      getPrInfo: vi.fn(),
      getPrReviews: vi.fn().mockResolvedValue([]),
    } as unknown as IGhClient

    config = { enabled: true, approveCondition: 'any' }

    service = new PrEventService(
      mockTicketService,
      mockAgentStore,
      mockGhClient,
      config
    )
  })

  describe('handleReviewComment', () => {
    it('TC 1.1: 첫 comment, agent 매칭 → 새 ticket 생성', async () => {
      await service.handleReviewComment(reviewCommentEvent as any)

      expect(mockTicketService.createTicket).toHaveBeenCalledWith(
        expect.objectContaining({
          assignee: 'developer',
          metadata: expect.objectContaining({
            source: 'webhook',
            github: expect.objectContaining({
              prNumber: 42,
              eventType: 'review_comment',
            }),
          }),
        })
      )
    })

    it('TC 1.2: agent 없음 → ticket 생성 안 함', async () => {
      vi.mocked(mockAgentStore.listAgents).mockReturnValue([])

      await service.handleReviewComment(reviewCommentEvent as any)

      expect(mockTicketService.createTicket).not.toHaveBeenCalled()
    })

    it('TC 1.3: 기존 ready ticket 있음 → comment 추가', async () => {
      const existingTicket: Partial<Ticket> = {
        id: 'existing-1',
        status: 'ready',
        assignee: 'developer',
        prompt: 'original prompt',
        metadata: {
          source: 'webhook',
          github: {
            repo: 'test-org/test-repo',
            prNumber: 42,
            prUrl: 'https://github.com/test-org/test-repo/pull/42',
            eventType: 'review_comment',
            commentIds: ['c1'],
          },
        },
      }

      vi.mocked(mockTicketService.listTickets).mockResolvedValue([existingTicket as Ticket])

      await service.handleReviewComment(reviewCommentEvent as any)

      expect(mockTicketService.createTicket).not.toHaveBeenCalled()
      expect(mockTicketService.addComment).toHaveBeenCalled()
    })

    it('TC 1.5: 기존 in_progress ticket 있음 → 새 ticket 생성', async () => {
      const existingTicket: Partial<Ticket> = {
        id: 'existing-1',
        status: 'in_progress',
        assignee: 'developer',
        metadata: {
          github: {
            repo: 'test-org/test-repo',
            prNumber: 42,
            prUrl: 'https://github.com/test-org/test-repo/pull/42',
            eventType: 'review_comment',
          },
        },
      }

      // listTickets는 ready/blocked만 반환하므로 빈 배열
      vi.mocked(mockTicketService.listTickets).mockResolvedValue([])

      await service.handleReviewComment(reviewCommentEvent as any)

      expect(mockTicketService.createTicket).toHaveBeenCalled()
    })
  })

  describe('handleReviewApproved', () => {
    it('TC 2.1: any 조건, 1개 approve → merge ticket 생성', async () => {
      await service.handleReviewApproved(reviewApprovedEvent as any)

      expect(mockTicketService.createTicket).toHaveBeenCalledWith(
        expect.objectContaining({
          assignee: 'developer',
          metadata: expect.objectContaining({
            github: expect.objectContaining({
              eventType: 'review_approved',
            }),
          }),
        })
      )
    })

    it('TC 2.4: 이미 merge ticket 존재 → 새 ticket 생성 안 함', async () => {
      const existingMergeTicket: Partial<Ticket> = {
        id: 'merge-1',
        status: 'ready',
        assignee: 'developer',
        metadata: {
          github: {
            repo: 'test-org/test-repo',
            prNumber: 42,
            prUrl: 'https://github.com/test-org/test-repo/pull/42',
            eventType: 'review_approved',
          },
        },
      }

      vi.mocked(mockTicketService.listTickets).mockResolvedValue([existingMergeTicket as Ticket])

      await service.handleReviewApproved(reviewApprovedEvent as any)

      expect(mockTicketService.createTicket).not.toHaveBeenCalled()
    })

    it('TC 2.5: agent 없음 → ticket 생성 안 함', async () => {
      vi.mocked(mockAgentStore.listAgents).mockReturnValue([])

      await service.handleReviewApproved(reviewApprovedEvent as any)

      expect(mockTicketService.createTicket).not.toHaveBeenCalled()
    })
  })

  describe('findAgentByGhUser', () => {
    it('TC 3.1: 매칭 agent 존재 → agent 반환', () => {
      const agents = mockAgentStore.listAgents()
      const found = agents.find((a) => a.gh_user === 'dev-bot')
      expect(found).toEqual(mockAgent)
    })

    it('TC 3.2: 매칭 agent 없음 → undefined', () => {
      const agents = mockAgentStore.listAgents()
      const found = agents.find((a) => a.gh_user === 'unknown')
      expect(found).toBeUndefined()
    })
  })
})
```

### 3. Webhook Signature 테스트

`/tests/middleware/webhook-signature.test.ts` 생성:

```typescript
import { describe, it, expect, vi } from 'vitest'
import * as crypto from 'crypto'
import { verifyGitHubSignature } from '../../src/server/middleware/webhook-signature.js'
import type { Request, Response, NextFunction } from 'express'

describe('verifyGitHubSignature', () => {
  const secret = 'test-secret'

  function createMockReq(body: object, signature?: string): Partial<Request> {
    return {
      body,
      headers: signature ? { 'x-hub-signature-256': signature } : {},
    }
  }

  function createValidSignature(body: object, secret: string): string {
    const payload = JSON.stringify(body)
    const hmac = crypto.createHmac('sha256', secret).update(payload).digest('hex')
    return `sha256=${hmac}`
  }

  it('TC 4.1: 유효한 signature → next() 호출', () => {
    const middleware = verifyGitHubSignature(secret)
    const body = { test: 'data' }
    const signature = createValidSignature(body, secret)

    const req = createMockReq(body, signature) as Request
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as unknown as Response
    const next = vi.fn() as NextFunction

    middleware(req, res, next)

    expect(next).toHaveBeenCalled()
    expect(res.status).not.toHaveBeenCalled()
  })

  it('TC 4.2: 잘못된 signature → 401', () => {
    const middleware = verifyGitHubSignature(secret)
    const body = { test: 'data' }

    const req = createMockReq(body, 'sha256=invalid') as Request
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as unknown as Response
    const next = vi.fn() as NextFunction

    middleware(req, res, next)

    expect(next).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(401)
  })

  it('TC 4.3: signature 헤더 없음 → 401', () => {
    const middleware = verifyGitHubSignature(secret)
    const body = { test: 'data' }

    const req = createMockReq(body) as Request
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as unknown as Response
    const next = vi.fn() as NextFunction

    middleware(req, res, next)

    expect(next).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(401)
  })

  it('TC 4.4: secret 미설정 → 검증 스킵, next() 호출', () => {
    const middleware = verifyGitHubSignature(undefined)
    const body = { test: 'data' }

    const req = createMockReq(body) as Request
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as unknown as Response
    const next = vi.fn() as NextFunction

    middleware(req, res, next)

    expect(next).toHaveBeenCalled()
  })

  it('TC 4.5: 빈 body → 정상 검증', () => {
    const middleware = verifyGitHubSignature(secret)
    const body = {}
    const signature = createValidSignature(body, secret)

    const req = createMockReq(body, signature) as Request
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as unknown as Response
    const next = vi.fn() as NextFunction

    middleware(req, res, next)

    expect(next).toHaveBeenCalled()
  })
})
```

### 4. MergeService 테스트

`/tests/services/merge.service.test.ts` 생성:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MergeService } from '../../src/services/merge.service.js'
import type { IGhClient, PrInfo } from '../../src/gh-client/index.js'
import type { TicketService } from '../../src/services/ticket.service.js'
import type { AgentConfig } from '../../src/types/index.js'

// execSync mock
vi.mock('child_process', () => ({
  execSync: vi.fn(),
}))

import { execSync } from 'child_process'

describe('MergeService', () => {
  let service: MergeService
  let mockGhClient: IGhClient
  let mockTicketService: TicketService

  const mockAgent: AgentConfig = {
    name: 'developer',
    description: 'Developer agent',
    gh_user: 'dev-bot',
  }

  const mockPrInfo: PrInfo = {
    number: 42,
    title: 'feat: add new feature',
    state: 'OPEN',
    baseRefName: 'main',
    headRefName: 'feature/new-feature',
    url: 'https://github.com/test-org/test-repo/pull/42',
    author: { login: 'dev-bot' },
    reviewRequests: [],
  }

  beforeEach(() => {
    vi.clearAllMocks()

    mockGhClient = {
      getPrInfo: vi.fn().mockResolvedValue(mockPrInfo),
      getPrReviews: vi.fn().mockResolvedValue([]),
    } as unknown as IGhClient

    mockTicketService = {
      createTicket: vi.fn().mockResolvedValue({ id: 'ticket-1' }),
    } as unknown as TicketService

    service = new MergeService({
      ghClient: mockGhClient,
      ticketService: mockTicketService,
      workingDir: '/tmp/test-repo',
    })
  })

  it('TC 5.1: merge 성공', async () => {
    vi.mocked(execSync).mockReturnValue(Buffer.from(''))

    const result = await service.executeMerge(
      'https://github.com/test-org/test-repo/pull/42',
      mockAgent
    )

    expect(result.success).toBe(true)
    expect(result.merged).toBe(true)
    expect(result.conflicted).toBe(false)
  })

  it('TC 5.2: conflict 발생', async () => {
    vi.mocked(execSync)
      .mockReturnValueOnce(Buffer.from(''))  // checkout
      .mockReturnValueOnce(Buffer.from(''))  // fetch
      .mockImplementationOnce(() => {        // rebase - conflict
        throw new Error('CONFLICT (content): Merge conflict in file.ts')
      })
      .mockReturnValueOnce(Buffer.from(''))  // rebase --abort

    const result = await service.executeMerge(
      'https://github.com/test-org/test-repo/pull/42',
      mockAgent
    )

    expect(result.success).toBe(false)
    expect(result.conflicted).toBe(true)
    expect(mockTicketService.createTicket).toHaveBeenCalledWith(
      expect.objectContaining({
        title: expect.stringContaining('[Conflict]'),
        metadata: expect.objectContaining({
          github: expect.objectContaining({
            eventType: 'conflict_resolve',
          }),
        }),
      })
    )
  })

  it('TC 5.3: gh pr merge 실패', async () => {
    vi.mocked(execSync)
      .mockReturnValueOnce(Buffer.from(''))  // checkout
      .mockReturnValueOnce(Buffer.from(''))  // fetch
      .mockReturnValueOnce(Buffer.from(''))  // rebase
      .mockReturnValueOnce(Buffer.from(''))  // push
      .mockImplementationOnce(() => {        // gh pr merge
        throw new Error('GraphQL: Pull request is not mergeable')
      })

    const result = await service.executeMerge(
      'https://github.com/test-org/test-repo/pull/42',
      mockAgent
    )

    expect(result.success).toBe(false)
    expect(result.merged).toBe(false)
    expect(result.error).toContain('gh pr merge failed')
  })

  it('TC 5.4: PR 정보 조회 실패', async () => {
    vi.mocked(mockGhClient.getPrInfo).mockRejectedValue(new Error('Not found'))

    const result = await service.executeMerge(
      'https://github.com/test-org/test-repo/pull/999',
      mockAgent
    )

    expect(result.success).toBe(false)
    expect(result.error).toContain('Not found')
  })
})
```

### 5. 사용자 가이드 (선택)

`/docs/guides/webhook-setup.md` 생성:

```markdown
# Webhook 설정 가이드

cc-company가 GitHub PR 이벤트를 자동으로 처리하도록 webhook을 설정하는 방법.

## 1. smee.io 채널 생성

1. https://smee.io 접속
2. "Start a new channel" 클릭
3. 생성된 URL 복사 (예: `https://smee.io/abcd1234`)

## 2. cc-company 설정

```bash
cc-company webhook setup https://smee.io/abcd1234
```

선택적으로 webhook secret 설정:
```bash
cc-company webhook set-secret your-secret-here
```

## 3. GitHub 저장소 설정

1. 저장소 Settings > Webhooks > Add webhook
2. **Payload URL**: smee.io URL 입력
3. **Content type**: `application/json`
4. **Secret**: (선택) cc-company에 설정한 secret
5. **Events**:
   - Pull request reviews
   - Pull request review comments
6. "Add webhook" 클릭

## 4. 확인

```bash
# 설정 확인
cc-company webhook status

# 서버 시작
cc-company start
```

GitHub에서 테스트 PR을 생성하고 review comment를 달면 ticket이 생성됨.

## 트러블슈팅

### Webhook이 도착하지 않는 경우

1. smee.io 페이지에서 이벤트가 수신되는지 확인
2. `cc-company start` 로그에서 webhook 수신 로그 확인
3. GitHub webhook 설정의 "Recent Deliveries"에서 응답 상태 확인

### Signature 검증 실패

- secret이 GitHub과 cc-company 양쪽에 동일하게 설정되었는지 확인
- secret 미설정 시 검증은 스킵됨
```

## Acceptance Criteria

```bash
npm run build  # 컴파일 에러 없음
npm test       # 모든 테스트 통과 (새 테스트 23개 포함)
```

## AC 검증 방법

위 AC 커맨드를 실행하라. 모두 통과하면 `/tasks/8-pr-webhook/index.json`의 phase 7 status를 `"completed"`로 변경하라.
수정 3회 이상 시도해도 실패하면 status를 `"error"`로 변경하고, 에러 내용을 index.json의 해당 phase에 `"error_message"` 필드로 기록하라.

## 주의사항

- 테스트는 vitest를 사용하라. jest 스타일로 작성하지 마라.
- mock은 `vi.fn()`, `vi.mocked()`를 사용하라.
- fixture JSON 파일은 실제 GitHub webhook payload 구조와 일치해야 한다.
- 기존 테스트를 깨뜨리지 마라.
- 가이드 문서는 선택사항이다. 테스트 통과가 우선.
