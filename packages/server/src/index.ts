import express, { Express } from 'express'
import { ticketsRouter } from './routes/tickets.js'
import { agentsRouter } from './routes/agents.js'
import { webhooksRouter } from './routes/webhooks.js'
import { errorHandler } from './middleware/error-handler.js'
import { verifyGitHubSignature } from './middleware/webhook-signature.js'
import type { TicketService, IAgentStatusStore } from '@agentinc/core'
import type { PullRequestReviewCommentEvent, PullRequestReviewEvent } from '@agentinc/core'

/**
 * PrEventService 인터페이스
 * Phase 4에서 실제 구현. 현재는 타입만 선언.
 */
export interface IPrEventService {
  handleReviewComment(payload: PullRequestReviewCommentEvent): Promise<void>
  handleReviewApproved(payload: PullRequestReviewEvent): Promise<void>
}

export interface ServerDependencies {
  ticketService: TicketService
  agentStatusStore: IAgentStatusStore
  webhookSecret?: string
  prEventService?: IPrEventService
}

export function createApp(deps: ServerDependencies): Express {
  const app = express()

  app.use(express.json())

  // 의존성을 request에 주입
  app.use((req, res, next) => {
    req.ticketService = deps.ticketService
    req.agentStatusStore = deps.agentStatusStore
    if (deps.prEventService) {
      req.prEventService = deps.prEventService
    }
    next()
  })

  // Webhook 라우트 (signature 검증 미들웨어 적용)
  app.use(
    '/webhooks',
    verifyGitHubSignature(deps.webhookSecret),
    webhooksRouter
  )

  app.use('/tickets', ticketsRouter)
  app.use('/agents', agentsRouter)

  app.use(errorHandler)

  return app
}

// Express Request 타입 확장
declare global {
  namespace Express {
    interface Request {
      ticketService: TicketService
      agentStatusStore: IAgentStatusStore
      prEventService?: IPrEventService
    }
  }
}

// Re-export types and classes for external use
export { ticketsRouter } from './routes/tickets.js'
export { agentsRouter } from './routes/agents.js'
export { webhooksRouter } from './routes/webhooks.js'
export { errorHandler } from './middleware/error-handler.js'
export { verifyGitHubSignature } from './middleware/webhook-signature.js'
export { SmeeReceiver } from './webhook-receiver/smee-receiver.js'
export { SseReceiver } from './webhook-receiver/sse-receiver.js'
export type { IWebhookReceiver, WebhookEvent, WebhookEventHandler } from './webhook-receiver/index.js'
