import express, { Express } from 'express'
import { ticketsRouter } from './routes/tickets.js'
import { agentsRouter } from './routes/agents.js'
import { errorHandler } from './middleware/error-handler.js'
import { TicketService } from '../services/ticket.service.js'
import { IAgentStatusStore } from '../store/agent-status-store.js'

export interface ServerDependencies {
  ticketService: TicketService
  agentStatusStore: IAgentStatusStore
}

export function createApp(deps: ServerDependencies): Express {
  const app = express()

  app.use(express.json())

  // 의존성을 request에 주입
  app.use((req, res, next) => {
    req.ticketService = deps.ticketService
    req.agentStatusStore = deps.agentStatusStore
    next()
  })

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
    }
  }
}
