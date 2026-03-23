# Phase 3: webhook-route

## 사전 준비

먼저 아래 문서들을 반드시 읽고 프로젝트의 전체 아키텍처와 설계 의도를 완전히 이해하라:

- `/spec/spec.md`
- `/spec/architecture.md`
- `/spec/adr.md`
- `/tasks/8-pr-webhook/spec-diff.md` (이번 task의 문서 변경 기록)

그리고 이전 phase의 작업물을 반드시 확인하라:

- `/src/types/index.ts` (WebhookConfig 타입)
- `/src/webhook-receiver/index.ts` (WebhookEvent 타입)
- `/src/server/index.ts` (Express 앱 설정)
- `/src/server/routes/tickets.ts` (기존 라우트 패턴 참고)

## 작업 내용

### 1. `/src/types/github-events.ts` 생성

GitHub webhook payload 타입 정의:

```typescript
/**
 * GitHub Webhook Event Types
 *
 * 참고: https://docs.github.com/en/webhooks/webhook-events-and-payloads
 */

export interface GithubUser {
  login: string
  id: number
  avatar_url: string
  type: string
}

export interface GithubRepository {
  id: number
  name: string
  full_name: string  // owner/repo
  private: boolean
  html_url: string
}

export interface GithubPullRequest {
  number: number
  title: string
  html_url: string
  state: 'open' | 'closed'
  user: GithubUser
  base: {
    ref: string      // base branch name
    repo: GithubRepository
  }
  head: {
    ref: string      // head branch name
    repo: GithubRepository
  }
  requested_reviewers: GithubUser[]
}

export interface GithubReviewComment {
  id: number
  body: string
  user: GithubUser
  html_url: string
  created_at: string
}

export interface GithubReview {
  id: number
  user: GithubUser
  body: string | null
  state: 'approved' | 'changes_requested' | 'commented' | 'dismissed' | 'pending'
  submitted_at: string
  html_url: string
}

/**
 * pull_request_review_comment event
 * https://docs.github.com/en/webhooks/webhook-events-and-payloads#pull_request_review_comment
 */
export interface PullRequestReviewCommentEvent {
  action: 'created' | 'edited' | 'deleted'
  comment: GithubReviewComment
  pull_request: GithubPullRequest
  repository: GithubRepository
  sender: GithubUser
}

/**
 * pull_request_review event
 * https://docs.github.com/en/webhooks/webhook-events-and-payloads#pull_request_review
 */
export interface PullRequestReviewEvent {
  action: 'submitted' | 'edited' | 'dismissed'
  review: GithubReview
  pull_request: GithubPullRequest
  repository: GithubRepository
  sender: GithubUser
}

/**
 * 지원하는 GitHub 이벤트 타입
 */
export type SupportedGithubEvent =
  | { type: 'pull_request_review_comment'; payload: PullRequestReviewCommentEvent }
  | { type: 'pull_request_review'; payload: PullRequestReviewEvent }
```

### 2. `/src/server/middleware/webhook-signature.ts` 생성

GitHub webhook signature 검증 미들웨어:

```typescript
import * as crypto from 'crypto'
import type { RequestHandler } from 'express'

/**
 * GitHub webhook signature 검증 미들웨어
 *
 * X-Hub-Signature-256 헤더를 검증하여 요청이 GitHub에서 온 것인지 확인.
 * secret이 설정되지 않으면 검증을 스킵한다 (개발 편의).
 */
export function verifyGitHubSignature(secret: string | undefined): RequestHandler {
  return (req, res, next) => {
    // secret 미설정 시 검증 스킵
    if (!secret) {
      console.warn('[webhook-signature] No secret configured, skipping verification')
      return next()
    }

    const signature = req.headers['x-hub-signature-256'] as string | undefined
    if (!signature) {
      console.error('[webhook-signature] Missing X-Hub-Signature-256 header')
      return res.status(401).json({ error: 'Missing signature header' })
    }

    // body가 이미 파싱되어 있으므로 다시 stringify
    // 주의: Express json middleware가 body를 파싱한 후이므로,
    // 원본 raw body가 필요하면 별도 처리 필요
    const payload = JSON.stringify(req.body)
    const expected = `sha256=${crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex')}`

    // 타이밍 공격 방지를 위한 constant-time 비교
    const signatureBuffer = Buffer.from(signature)
    const expectedBuffer = Buffer.from(expected)

    if (signatureBuffer.length !== expectedBuffer.length) {
      console.error('[webhook-signature] Signature length mismatch')
      return res.status(401).json({ error: 'Invalid signature' })
    }

    if (!crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) {
      console.error('[webhook-signature] Signature mismatch')
      return res.status(401).json({ error: 'Invalid signature' })
    }

    next()
  }
}
```

**중요**: Express의 `express.json()` 미들웨어가 body를 파싱한 후에 signature를 검증하면, 파싱 과정에서 whitespace 등이 변경될 수 있어 signature가 맞지 않을 수 있다. 이를 해결하려면:

1. raw body를 별도로 저장하거나
2. body를 다시 stringify하여 검증 (위 코드)

위 코드는 2번 방식을 사용한다. GitHub은 compact JSON을 보내므로 대부분 동작하지만, 엄밀한 검증이 필요하면 `express.json({ verify: ... })` 옵션으로 raw body를 저장해야 한다. MVP에서는 2번 방식으로 진행하고, 문제 발생 시 개선한다.

### 3. `/src/server/routes/webhooks.ts` 생성

```typescript
import { Router } from 'express'
import type { PullRequestReviewCommentEvent, PullRequestReviewEvent } from '../../types/github-events.js'

export const webhooksRouter = Router()

/**
 * POST /webhooks/github
 *
 * GitHub webhook 이벤트 수신 엔드포인트.
 * X-GitHub-Event 헤더로 이벤트 타입 구분.
 *
 * 지원 이벤트:
 * - pull_request_review_comment: PR review comment 생성/수정/삭제
 * - pull_request_review: PR review 제출/수정/기각
 */
webhooksRouter.post('/github', async (req, res, next) => {
  try {
    const eventType = req.headers['x-github-event'] as string | undefined
    const deliveryId = req.headers['x-github-delivery'] as string | undefined

    console.log(`[webhooks] Received GitHub event: ${eventType} (delivery: ${deliveryId})`)

    if (!eventType) {
      return res.status(400).json({ error: 'Missing X-GitHub-Event header' })
    }

    // 이벤트 타입별 처리
    switch (eventType) {
      case 'pull_request_review_comment': {
        const payload = req.body as PullRequestReviewCommentEvent
        // action: created만 처리 (edited, deleted는 무시)
        if (payload.action === 'created') {
          await req.prEventService.handleReviewComment(payload)
        }
        break
      }

      case 'pull_request_review': {
        const payload = req.body as PullRequestReviewEvent
        // action: submitted + state: approved만 처리
        if (payload.action === 'submitted' && payload.review.state === 'approved') {
          await req.prEventService.handleReviewApproved(payload)
        }
        break
      }

      case 'ping': {
        // GitHub webhook 설정 시 보내는 ping 이벤트
        console.log('[webhooks] Received ping event')
        break
      }

      default:
        console.log(`[webhooks] Ignoring unsupported event: ${eventType}`)
    }

    // GitHub은 2xx 응답을 기대
    res.status(200).json({ received: true })
  } catch (error) {
    next(error)
  }
})
```

### 4. Express 타입 확장

`/src/server/index.ts`에서 `req.prEventService`를 사용하려면 타입 확장 필요.

`/src/types/express.d.ts` 생성 또는 기존 파일에 추가:

```typescript
import type { PrEventService } from '../services/pr-event.service.js'

declare global {
  namespace Express {
    interface Request {
      prEventService: PrEventService
    }
  }
}
```

**주의**: 이 파일은 PrEventService가 Phase 4에서 구현된 후에 import가 가능하다. 현재 phase에서는:

1. 타입 선언만 추가하고, 실제 서비스 주입은 Phase 5에서 구현
2. 또는 빈 stub 서비스를 임시로 생성

**권장**: 타입 선언에서 PrEventService 대신 인터페이스를 사용:

```typescript
// /src/types/express.d.ts
import type { TicketService } from '../services/ticket.service.js'

// PrEventService는 아직 없으므로 인터페이스로 선언
interface IPrEventService {
  handleReviewComment(payload: unknown): Promise<void>
  handleReviewApproved(payload: unknown): Promise<void>
}

declare global {
  namespace Express {
    interface Request {
      ticketService: TicketService
      prEventService: IPrEventService  // 추가
    }
  }
}
```

### 5. `/src/server/index.ts` 수정

webhooks 라우트 등록:

```typescript
import { webhooksRouter } from './routes/webhooks.js'
import { verifyGitHubSignature } from './middleware/webhook-signature.js'

// ... 기존 코드 ...

export function createServer(deps: ServerDeps) {
  const app = express()

  // JSON body parser
  app.use(express.json())

  // ... 기존 미들웨어 ...

  // Webhook 라우트 (signature 검증 미들웨어 적용)
  // deps.webhookSecret은 config에서 전달받음
  app.use(
    '/webhooks',
    verifyGitHubSignature(deps.webhookSecret),
    webhooksRouter
  )

  // 기존 라우트들
  app.use('/tickets', ticketsRouter)
  app.use('/agents', agentsRouter)

  // ... 에러 핸들러 ...

  return app
}
```

ServerDeps 인터페이스에 추가:

```typescript
interface ServerDeps {
  ticketService: TicketService
  agentStatusStore: AgentStatusStore
  webhookSecret?: string      // 추가
  prEventService?: IPrEventService  // 추가 (Phase 5에서 실제 서비스 주입)
}
```

## Acceptance Criteria

```bash
npm run build  # 컴파일 에러 없음
npm test       # 모든 테스트 통과
```

## AC 검증 방법

위 AC 커맨드를 실행하라. 모두 통과하면 `/tasks/8-pr-webhook/index.json`의 phase 3 status를 `"completed"`로 변경하라.
수정 3회 이상 시도해도 실패하면 status를 `"error"`로 변경하고, 에러 내용을 index.json의 해당 phase에 `"error_message"` 필드로 기록하라.

## 주의사항

- webhook-signature 검증에서 raw body 이슈가 발생하면 주석에 기록하고 MVP에서는 스킵 가능.
- prEventService는 Phase 4에서 구현한다. 현재는 타입만 선언하고, 서버 시작 시 주입은 Phase 5에서 처리.
- 기존 테스트를 깨뜨리지 마라.
- ping 이벤트는 반드시 처리해야 한다 (GitHub webhook 설정 확인용).
