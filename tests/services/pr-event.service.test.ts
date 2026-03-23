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
