import type { TicketService } from './ticket.service.js'
import type { IStore } from '../store/store.js'
import type {
  IGhClient,
  PrReviewInfo,
  WebhookConfig,
  AgentConfig,
  Ticket,
  TicketMetadata,
} from '../types/index.js'
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
    // MVP에서는 comment 기능으로 대체 (metadata 업데이트 API가 없음)
    // TODO: TicketService에 updateMetadata 메서드 추가 시 metadata.github.commentIds도 업데이트
    await this.ticketService.addComment(ticket.id, {
      author: 'webhook',
      content: `New review comment by @${event.comment.user.login}: ${event.comment.body.slice(0, 200)}${event.comment.body.length > 200 ? '...' : ''}\n\nURL: ${event.comment.html_url}`,
    })

    console.log(`[PrEventService] Added comment to ticket ${ticket.id}, new commentId: ${commentId}`)
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
    let reviews: PrReviewInfo[] = []
    try {
      reviews = await this.ghClient.getPrReviews(prUrl)
    } catch (error) {
      console.error(`[PrEventService] Failed to get PR reviews: ${error}`)
      // gh CLI 실패 시 'any' 조건으로 fallback
      return true
    }

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
