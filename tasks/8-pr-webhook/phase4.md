# Phase 4: pr-event-service

## 사전 준비

먼저 아래 문서들을 반드시 읽고 프로젝트의 전체 아키텍처와 설계 의도를 완전히 이해하라:

- `/spec/spec.md`
- `/spec/architecture.md`
- `/spec/adr.md` (특히 ADR-020, ADR-021)
- `/tasks/8-pr-webhook/spec-diff.md` (이번 task의 문서 변경 기록)

그리고 이전 phase의 작업물을 반드시 확인하라:

- `/src/types/index.ts` (TicketMetadata, WebhookConfig, GithubEventType)
- `/src/types/github-events.ts` (GitHub 이벤트 타입)
- `/src/services/ticket.service.ts` (기존 TicketService)
- `/src/store/store.ts` (IStore 인터페이스)

## 작업 내용

### 1. `/src/gh-client/index.ts` 생성

gh CLI 래퍼. merge.service와 pr-event.service에서 사용:

```typescript
import { execSync } from 'child_process'

/**
 * gh CLI 래퍼 인터페이스
 * 테스트 시 mock 주입 가능
 */
export interface IGhClient {
  /**
   * PR 정보 조회
   */
  getPrInfo(prUrl: string): Promise<PrInfo>

  /**
   * PR의 현재 review 상태 조회
   */
  getPrReviews(prUrl: string): Promise<PrReviewInfo[]>
}

export interface PrInfo {
  number: number
  title: string
  state: 'OPEN' | 'CLOSED' | 'MERGED'
  baseRefName: string
  headRefName: string
  url: string
  author: {
    login: string
  }
  reviewRequests: {
    login: string
  }[]
}

export interface PrReviewInfo {
  author: {
    login: string
  }
  state: 'APPROVED' | 'CHANGES_REQUESTED' | 'COMMENTED' | 'DISMISSED' | 'PENDING'
}

/**
 * gh CLI 구현체
 */
export class GhClient implements IGhClient {
  constructor(private readonly ghUser?: string) {}

  private execGh(args: string): string {
    const userFlag = this.ghUser ? `--hostname github.com` : ''
    // gh_user가 있으면 해당 계정의 토큰 사용
    const env = this.ghUser
      ? { ...process.env, GH_TOKEN: this.getToken() }
      : process.env

    return execSync(`gh ${args} ${userFlag}`, {
      encoding: 'utf-8',
      env,
    }).trim()
  }

  private getToken(): string {
    if (!this.ghUser) return ''
    return execSync(`gh auth token --user ${this.ghUser}`, {
      encoding: 'utf-8',
    }).trim()
  }

  async getPrInfo(prUrl: string): Promise<PrInfo> {
    const json = this.execGh(
      `pr view ${prUrl} --json number,title,state,baseRefName,headRefName,url,author,reviewRequests`
    )
    return JSON.parse(json)
  }

  async getPrReviews(prUrl: string): Promise<PrReviewInfo[]> {
    const json = this.execGh(`pr view ${prUrl} --json reviews`)
    const data = JSON.parse(json)
    return data.reviews || []
  }
}
```

### 2. `/src/services/pr-event.service.ts` 생성

핵심 비즈니스 로직:

```typescript
import type { TicketService } from './ticket.service.js'
import type { IStore } from '../store/store.js'
import type { IGhClient, PrReviewInfo } from '../gh-client/index.js'
import type { WebhookConfig, AgentConfig, Ticket, TicketMetadata } from '../types/index.js'
import type {
  PullRequestReviewCommentEvent,
  PullRequestReviewEvent,
} from '../types/github-events.js'

export class PrEventService {
  constructor(
    private readonly ticketService: TicketService,
    private readonly agentStore: IStore,
    private readonly ghClient: IGhClient,
    private readonly config: WebhookConfig
  ) {}

  /**
   * PR review comment 이벤트 처리
   *
   * 1. PR author의 gh_user로 agent 매칭
   * 2. 기존 ticket 검색 (같은 PR, review_comment, ready/blocked)
   * 3. 있으면 comment 추가, 없으면 새 ticket 생성
   */
  async handleReviewComment(event: PullRequestReviewCommentEvent): Promise<void> {
    const prAuthor = event.pull_request.user.login
    const agent = this.findAgentByGhUser(prAuthor)

    if (!agent) {
      console.log(`[PrEventService] No agent found for gh_user: ${prAuthor}, ignoring`)
      return
    }

    const prNumber = event.pull_request.number
    const repo = event.repository.full_name
    const commentAuthor = event.comment.user.login

    // 기존 ticket 검색: 같은 PR + review_comment + ready/blocked
    const existing = await this.findExistingPrTicket(
      agent.name,
      repo,
      prNumber,
      'review_comment'
    )

    if (existing) {
      // 기존 ticket에 comment 추가
      await this.appendCommentToTicket(existing, event)
      console.log(`[PrEventService] Appended comment to existing ticket: ${existing.id}`)
    } else {
      // 새 ticket 생성
      await this.createReviewCommentTicket(agent, event)
      console.log(`[PrEventService] Created new review_comment ticket for PR #${prNumber}`)
    }
  }

  /**
   * PR review approved 이벤트 처리
   *
   * 1. PR author의 gh_user로 agent 매칭
   * 2. approveCondition 체크 (any 또는 all)
   * 3. 조건 충족 시 merge ticket 생성
   */
  async handleReviewApproved(event: PullRequestReviewEvent): Promise<void> {
    const prAuthor = event.pull_request.user.login
    const agent = this.findAgentByGhUser(prAuthor)

    if (!agent) {
      console.log(`[PrEventService] No agent found for gh_user: ${prAuthor}, ignoring`)
      return
    }

    const prNumber = event.pull_request.number
    const repo = event.repository.full_name
    const prUrl = event.pull_request.html_url

    // 이미 merge ticket이 있는지 확인
    const existingMerge = await this.findExistingPrTicket(
      agent.name,
      repo,
      prNumber,
      'review_approved'
    )

    if (existingMerge) {
      console.log(`[PrEventService] Merge ticket already exists: ${existingMerge.id}`)
      return
    }

    // approve 조건 체크
    const conditionMet = await this.checkApproveCondition(event)
    if (!conditionMet) {
      console.log(`[PrEventService] Approve condition not met for PR #${prNumber}`)
      return
    }

    // merge ticket 생성
    await this.createMergeTicket(agent, event)
    console.log(`[PrEventService] Created merge ticket for PR #${prNumber}`)
  }

  /**
   * gh_user로 agent 찾기
   */
  private findAgentByGhUser(ghUsername: string): AgentConfig | null {
    const agents = this.agentStore.listAgents()
    return agents.find((a) => a.gh_user === ghUsername) ?? null
  }

  /**
   * 기존 PR ticket 검색
   * - 같은 repo, prNumber, eventType
   * - status: ready 또는 blocked
   */
  private async findExistingPrTicket(
    assignee: string,
    repo: string,
    prNumber: number,
    eventType: string
  ): Promise<Ticket | null> {
    // ready 상태 검색
    const readyTickets = await this.ticketService.listTickets({
      assignee,
      status: 'ready',
    })

    // blocked 상태 검색
    const blockedTickets = await this.ticketService.listTickets({
      assignee,
      status: 'blocked',
    })

    const allTickets = [...readyTickets, ...blockedTickets]

    return (
      allTickets.find(
        (t) =>
          t.metadata?.github?.repo === repo &&
          t.metadata?.github?.prNumber === prNumber &&
          t.metadata?.github?.eventType === eventType
      ) ?? null
    )
  }

  /**
   * 기존 ticket에 comment 정보 추가
   */
  private async appendCommentToTicket(
    ticket: Ticket,
    event: PullRequestReviewCommentEvent
  ): Promise<void> {
    const commentId = String(event.comment.id)
    const existingIds = ticket.metadata?.github?.commentIds ?? []

    // 이미 추가된 comment면 스킵
    if (existingIds.includes(commentId)) {
      return
    }

    // prompt에 새 comment 내용 추가
    const newCommentSection = `

---

**[New Comment by @${event.comment.user.login}]**

${event.comment.body}

> ${event.comment.html_url}
`

    const updatedPrompt = ticket.prompt + newCommentSection
    const updatedCommentIds = [...existingIds, commentId]

    // ticket 업데이트 (직접 store 접근 필요)
    // TicketService에 updatePrompt 메서드가 없으므로,
    // 여기서는 comment 추가로 대체 (ticket.comments에 기록)
    await this.ticketService.addComment(ticket.id, {
      author: 'webhook',
      content: `New review comment by @${event.comment.user.login}: ${event.comment.body.slice(0, 100)}...`,
    })

    // metadata 업데이트는 현재 TicketService API로 불가능
    // TODO: TicketService에 updateMetadata 메서드 추가 또는 직접 store 접근
    // MVP에서는 comment로 기록하고, 중복 체크는 comment 내용으로 판단
    console.log(`[PrEventService] Added comment to ticket ${ticket.id}, commentIds: ${updatedCommentIds}`)
  }

  /**
   * review_comment ticket 생성
   */
  private async createReviewCommentTicket(
    agent: AgentConfig,
    event: PullRequestReviewCommentEvent
  ): Promise<void> {
    const pr = event.pull_request
    const comment = event.comment
    const repo = event.repository.full_name

    const prompt = `PR #${pr.number}에 review comment가 달렸습니다. 확인 후 반영하세요.

## PR 정보
- **Title**: ${pr.title}
- **URL**: ${pr.html_url}
- **Branch**: ${pr.head.ref} → ${pr.base.ref}

## Review Comment

**Author**: @${comment.user.login}

${comment.body}

> Comment URL: ${comment.html_url}

---

위 comment를 확인하고, 필요한 수정을 반영한 후 push하세요.
`

    const metadata: TicketMetadata = {
      source: 'webhook',
      github: {
        repo,
        prNumber: pr.number,
        prUrl: pr.html_url,
        commentIds: [String(comment.id)],
        eventType: 'review_comment',
      },
    }

    await this.ticketService.createTicket({
      title: `[PR Review] #${pr.number} - ${comment.user.login}의 comment`,
      prompt,
      assignee: agent.name,
      createdBy: 'webhook',
      metadata,
    })
  }

  /**
   * approve 조건 체크
   */
  private async checkApproveCondition(
    event: PullRequestReviewEvent
  ): Promise<boolean> {
    const condition = this.config.approveCondition ?? 'any'
    const prUrl = event.pull_request.html_url

    if (condition === 'any') {
      // 최소 1개 approve면 충족 (이벤트가 approve이므로 이미 충족)
      return true
    }

    // 'all': 모든 requested reviewer가 approve해야 함
    const requestedReviewers = event.pull_request.requested_reviewers.map(
      (r) => r.login
    )

    if (requestedReviewers.length === 0) {
      // requested reviewer가 없으면 any와 동일
      return true
    }

    // 현재 review 상태 조회
    const reviews = await this.ghClient.getPrReviews(prUrl)

    // 각 requested reviewer의 최신 review 상태 확인
    const approvedReviewers = new Set<string>()
    for (const review of reviews) {
      if (review.state === 'APPROVED') {
        approvedReviewers.add(review.author.login)
      }
    }

    // 모든 requested reviewer가 approve했는지 확인
    const allApproved = requestedReviewers.every((r) =>
      approvedReviewers.has(r)
    )

    return allApproved
  }

  /**
   * merge ticket 생성
   */
  private async createMergeTicket(
    agent: AgentConfig,
    event: PullRequestReviewEvent
  ): Promise<void> {
    const pr = event.pull_request
    const repo = event.repository.full_name

    const prompt = `PR #${pr.number}이 approved 되었습니다. base branch로 merge하세요.

## PR 정보
- **Title**: ${pr.title}
- **URL**: ${pr.html_url}
- **Branch**: ${pr.head.ref} → ${pr.base.ref}

## Approved by
- @${event.review.user.login}

---

위 PR을 ${pr.base.ref} branch로 merge하세요.

1. 먼저 base branch와 conflict가 없는지 확인하세요.
2. Conflict가 없으면 \`gh pr merge ${pr.html_url} --auto\`로 merge하세요.
3. Conflict가 있으면 해결 후 merge하세요.
`

    const metadata: TicketMetadata = {
      source: 'webhook',
      github: {
        repo,
        prNumber: pr.number,
        prUrl: pr.html_url,
        eventType: 'review_approved',
        reviewers: [event.review.user.login],
      },
    }

    await this.ticketService.createTicket({
      title: `[PR Merge] #${pr.number} - ${pr.title}`,
      prompt,
      assignee: agent.name,
      createdBy: 'webhook',
      metadata,
    })
  }
}
```

### 3. TicketService에 메타데이터 업데이트 기능 추가 (선택)

`appendCommentToTicket`에서 metadata.github.commentIds를 업데이트해야 하는데, 현재 TicketService API로는 불가능하다.

**Option A**: ITicketStore에 `updateMetadata` 메서드 추가
**Option B**: 기존 comment 기능으로 대체 (MVP)

**MVP에서는 Option B 사용**: comment로 기록하고, 중복 ticket 생성 방지는 title + prNumber로 판단.

## Acceptance Criteria

```bash
npm run build  # 컴파일 에러 없음
npm test       # 모든 테스트 통과
```

## AC 검증 방법

위 AC 커맨드를 실행하라. 모두 통과하면 `/tasks/8-pr-webhook/index.json`의 phase 4 status를 `"completed"`로 변경하라.
수정 3회 이상 시도해도 실패하면 status를 `"error"`로 변경하고, 에러 내용을 index.json의 해당 phase에 `"error_message"` 필드로 기록하라.

## 주의사항

- `findAgentByGhUser`가 null을 반환하면 이벤트를 조용히 무시하라. 에러를 던지지 마라.
- gh CLI 호출이 실패하면 적절히 에러 처리하라 (try-catch).
- metadata 업데이트가 어려우면 comment로 대체하고, TODO 주석을 남겨라.
- 기존 테스트를 깨뜨리지 마라.
