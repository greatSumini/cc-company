import express, { Express } from 'express'
import path from 'path'
import { fileURLToPath } from 'url'
import { ticketsRouter } from './routes/tickets.js'
import { agentsRouter } from './routes/agents.js'
import { webhooksRouter } from './routes/webhooks.js'
import { eventsRouter } from './routes/events.js'
import { errorHandler } from './middleware/error-handler.js'
import { verifyGitHubSignature } from './middleware/webhook-signature.js'
import type { TicketService, IAgentStatusStore, IStore } from '@agentinc/core'
import type { PullRequestReviewCommentEvent, PullRequestReviewEvent } from '@agentinc/core'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

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
  agentStore?: IStore
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
    if (deps.agentStore) {
      req.agentStore = deps.agentStore
    }
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
  app.use('/events', eventsRouter)

  // 정적 파일 서빙 (프로덕션)
  const publicPath = path.join(__dirname, '../public')
  app.use(express.static(publicPath))

  // SPA fallback — API 라우트가 아닌 모든 GET 요청을 index.html로
  app.get('*', (req, res, next) => {
    // API 요청은 무시
    if (req.path.startsWith('/tickets') ||
        req.path.startsWith('/agents') ||
        req.path.startsWith('/events') ||
        req.path.startsWith('/webhooks')) {
      return next()
    }

    res.sendFile(path.join(publicPath, 'index.html'), (err) => {
      if (err) {
        // public/index.html이 없으면 (개발 모드) 404
        res.status(404).send('Dashboard not built. Run: pnpm build:web')
      }
    })
  })

  app.use(errorHandler)

  return app
}

// Express Request 타입 확장
declare global {
  namespace Express {
    interface Request {
      ticketService: TicketService
      agentStatusStore: IAgentStatusStore
      agentStore?: IStore
      prEventService?: IPrEventService
    }
  }
}

// Re-export types and classes for external use
export { ticketsRouter } from './routes/tickets.js'
export { agentsRouter } from './routes/agents.js'
export { webhooksRouter } from './routes/webhooks.js'
export { eventsRouter } from './routes/events.js'
export { errorHandler } from './middleware/error-handler.js'
export { verifyGitHubSignature } from './middleware/webhook-signature.js'
export { SmeeReceiver } from './webhook-receiver/smee-receiver.js'
export { SseReceiver } from './webhook-receiver/sse-receiver.js'
export type { IWebhookReceiver, WebhookEvent, WebhookEventHandler } from './webhook-receiver/index.js'
export { eventBus } from './events/event-bus.js'
export type { ServerEvent } from './events/event-bus.js'
