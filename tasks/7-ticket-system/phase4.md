# Phase 4: http-server

## 사전 준비

먼저 아래 문서들을 반드시 읽고 프로젝트의 전체 아키텍처와 설계 의도를 완전히 이해하라:

- `/docs/spec.md`
- `/docs/architecture.md`
- `/docs/adr.md`
- `/tasks/7-ticket-system/docs-diff.md` (이번 task의 문서 변경 기록)

그리고 이전 phase의 작업물을 반드시 확인하라:

- `/src/types/index.ts` (Phase 1)
- `/src/store/ticket-store.ts` (Phase 2)
- `/src/store/fs-ticket-store.ts` (Phase 2)
- `/src/store/agent-status-store.ts` (Phase 2)
- `/src/services/ticket.service.ts` (Phase 3)

## 작업 내용

Ticket Server (HTTP API)를 구현한다.

### 0. 의존성 추가

```bash
npm install express
npm install -D @types/express
```

### 1. `src/server/index.ts` — Express 앱

```typescript
import express, { Express } from 'express'
import { ticketsRouter } from './routes/tickets'
import { agentsRouter } from './routes/agents'
import { errorHandler } from './middleware/error-handler'
import { TicketService } from '../services/ticket.service'
import { IAgentStatusStore } from '../store/agent-status-store'

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
```

### 2. `src/server/routes/tickets.ts`

```typescript
import { Router } from 'express'
import { TicketPriority, TicketStatus } from '../../types'

export const ticketsRouter = Router()

/**
 * GET /tickets
 * Query params: status, assignee, type
 */
ticketsRouter.get('/', async (req, res, next) => {
  try {
    const filter = {
      status: req.query.status as TicketStatus | undefined,
      assignee: req.query.assignee as string | undefined,
      type: req.query.type as 'task' | 'cc_review' | undefined,
    }
    const tickets = await req.ticketService.listTickets(filter)
    res.json(tickets)
  } catch (error) {
    next(error)
  }
})

/**
 * GET /tickets/:id
 */
ticketsRouter.get('/:id', async (req, res, next) => {
  try {
    const ticket = await req.ticketService.getTicket(req.params.id)
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' })
    }
    res.json(ticket)
  } catch (error) {
    next(error)
  }
})

/**
 * POST /tickets
 * Body: { title, prompt, assignee, cc?, priority?, createdBy }
 */
ticketsRouter.post('/', async (req, res, next) => {
  try {
    const { title, prompt, assignee, cc, priority, createdBy } = req.body
    const ticket = await req.ticketService.createTicket({
      title,
      prompt,
      assignee,
      cc,
      priority,
      createdBy: createdBy ?? 'user',
    })
    res.status(201).json(ticket)
  } catch (error) {
    next(error)
  }
})

/**
 * PATCH /tickets/:id
 * Body: { status?, priority?, expectedVersion, result? }
 */
ticketsRouter.patch('/:id', async (req, res, next) => {
  try {
    const { status, priority, expectedVersion, result } = req.body

    if (expectedVersion === undefined) {
      return res.status(400).json({ error: 'expectedVersion is required' })
    }

    let ticket
    if (status) {
      ticket = await req.ticketService.updateTicketStatus(
        req.params.id,
        status,
        expectedVersion,
        result
      )
    } else if (priority) {
      ticket = await req.ticketService.updateTicketPriority(
        req.params.id,
        priority,
        expectedVersion
      )
    } else {
      return res.status(400).json({ error: 'status or priority is required' })
    }

    res.json(ticket)
  } catch (error) {
    next(error)
  }
})

/**
 * DELETE /tickets/:id
 * Body: { expectedVersion }
 */
ticketsRouter.delete('/:id', async (req, res, next) => {
  try {
    const { expectedVersion } = req.body

    if (expectedVersion === undefined) {
      return res.status(400).json({ error: 'expectedVersion is required' })
    }

    const ticket = await req.ticketService.cancelTicket(req.params.id, expectedVersion)
    res.json(ticket)
  } catch (error) {
    next(error)
  }
})

/**
 * GET /tickets/:id/log
 */
ticketsRouter.get('/:id/log', async (req, res, next) => {
  try {
    const log = await req.ticketService.getLog(req.params.id)
    if (log === null) {
      return res.status(404).json({ error: 'Log not found' })
    }
    res.type('text/plain').send(log)
  } catch (error) {
    next(error)
  }
})

/**
 * POST /tickets/:id/comments
 * Body: { author, content }
 */
ticketsRouter.post('/:id/comments', async (req, res, next) => {
  try {
    const { author, content } = req.body
    const comment = await req.ticketService.addComment(req.params.id, { author, content })
    res.status(201).json(comment)
  } catch (error) {
    next(error)
  }
})
```

### 3. `src/server/routes/agents.ts`

```typescript
import { Router } from 'express'

export const agentsRouter = Router()

/**
 * GET /agents/status
 */
agentsRouter.get('/status', async (req, res, next) => {
  try {
    const statuses = await req.agentStatusStore.getAll()
    res.json(statuses)
  } catch (error) {
    next(error)
  }
})

/**
 * GET /agents/:name/status
 */
agentsRouter.get('/:name/status', async (req, res, next) => {
  try {
    const status = await req.agentStatusStore.get(req.params.name)
    if (!status) {
      return res.status(404).json({ error: 'Agent not found' })
    }
    res.json(status)
  } catch (error) {
    next(error)
  }
})

/**
 * PATCH /agents/:name/heartbeat
 * Agent가 주기적으로 호출하여 alive 상태 유지
 */
agentsRouter.patch('/:name/heartbeat', async (req, res, next) => {
  try {
    await req.agentStatusStore.updateHeartbeat(req.params.name)
    res.json({ ok: true })
  } catch (error) {
    next(error)
  }
})

/**
 * PATCH /agents/:name/state
 * Body: { state, currentTicketId? }
 */
agentsRouter.patch('/:name/state', async (req, res, next) => {
  try {
    const { state, currentTicketId } = req.body
    await req.agentStatusStore.updateState(req.params.name, state, currentTicketId)
    res.json({ ok: true })
  } catch (error) {
    next(error)
  }
})
```

### 4. `src/server/middleware/error-handler.ts`

```typescript
import { Request, Response, NextFunction } from 'express'
import {
  OptimisticLockError,
  TicketNotFoundError,
  InvalidStatusTransitionError,
} from '../../store/ticket-store'

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  console.error('[Server Error]', err.message)

  if (err instanceof OptimisticLockError) {
    res.status(409).json({ error: err.message })
    return
  }

  if (err instanceof TicketNotFoundError) {
    res.status(404).json({ error: err.message })
    return
  }

  if (err instanceof InvalidStatusTransitionError) {
    res.status(400).json({ error: err.message })
    return
  }

  // 위임 권한 에러
  if (err.message.includes('does not have delegation permission')) {
    res.status(403).json({ error: err.message })
    return
  }

  // 기타 에러
  res.status(500).json({ error: 'Internal server error' })
}
```

## Acceptance Criteria

```bash
npm run build  # 컴파일 에러 없음
npm test       # 기존 테스트 모두 통과
```

## AC 검증 방법

위 AC 커맨드를 실행하라. 모두 통과하면 `/tasks/7-ticket-system/index.json`의 phase 4 status를 `"completed"`로 변경하라.
수정 3회 이상 시도해도 실패하면 status를 `"error"`로 변경하고, 에러 내용을 index.json의 해당 phase에 `"error_message"` 필드로 기록하라.

## 주의사항

- HTTP 서버 테스트는 작성하지 않는다 (통합 테스트는 과잉).
- Express 타입 확장 (`declare global`)이 제대로 동작하는지 확인하라.
- 에러 핸들러에서 모든 커스텀 에러를 적절한 HTTP 상태 코드로 매핑하라.
- async 핸들러에서 반드시 try/catch로 에러를 next()에 전달하라.
