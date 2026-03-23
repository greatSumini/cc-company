# Phase 3: Server API 확장

## 사전 준비

먼저 아래 문서들을 반드시 읽고 프로젝트의 전체 아키텍처와 설계 의도를 완전히 이해하라:

- `/spec/architecture.md` — 전체 아키텍처 (SSE 실시간 업데이트 섹션 포함)
- `/spec/adr.md` — ADR-024 (SSE 실시간 업데이트) 확인
- `/tasks/12-gui-dashboard/spec-diff.md` — 이번 task의 문서 변경 기록

그리고 이전 phase의 작업물을 반드시 확인하라:

- `packages/server/src/` — Phase 2에서 생성된 server 패키지 구조
- `packages/server/src/routes/` — 기존 tickets, agents 라우트
- `packages/core/src/services/` — TicketService, AgentService 등

이전 phase에서 만들어진 코드를 꼼꼼히 읽고, 설계 의도를 이해한 뒤 작업하라.

## 작업 내용

### 1. EventBus 구현

#### 1.1 `packages/server/src/events/event-bus.ts` 생성

```typescript
import { EventEmitter } from 'events'

export type ServerEvent =
  | { type: 'ticket:created'; payload: unknown }
  | { type: 'ticket:updated'; payload: unknown }
  | { type: 'agent:status'; payload: { agent: string; state: 'idle' | 'working' } }

class EventBus extends EventEmitter {
  emitEvent(event: ServerEvent): void {
    this.emit(event.type, event.payload)
  }
}

export const eventBus = new EventBus()
```

#### 1.2 `packages/server/src/events/index.ts` 생성

```typescript
export * from './event-bus.js'
```

### 2. SSE 엔드포인트 구현

#### 2.1 `packages/server/src/routes/events.ts` 생성

```typescript
import { Router, Request, Response } from 'express'
import { eventBus } from '../events/event-bus.js'

const router = Router()

// SSE 클라이언트 관리
const clients = new Set<Response>()

router.get('/events', (req: Request, res: Response) => {
  // SSE 헤더 설정
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no') // nginx 프록시 대응
  res.flushHeaders()

  // 클라이언트 등록
  clients.add(res)

  // 연결 확인용 초기 이벤트
  res.write(`event: connected\ndata: ${JSON.stringify({ time: Date.now() })}\n\n`)

  // 연결 종료 시 정리
  req.on('close', () => {
    clients.delete(res)
  })
})

// 모든 클라이언트에게 이벤트 브로드캐스트
function broadcast(event: string, data: unknown): void {
  const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
  clients.forEach(client => {
    client.write(message)
  })
}

// 이벤트 버스 리스너 등록
eventBus.on('ticket:created', (payload) => broadcast('ticket:created', payload))
eventBus.on('ticket:updated', (payload) => broadcast('ticket:updated', payload))
eventBus.on('agent:status', (payload) => broadcast('agent:status', payload))

export default router
```

### 3. GET /agents 엔드포인트 추가

#### 3.1 `packages/server/src/routes/agents.ts` 수정

기존 파일에 `GET /agents` 엔드포인트를 추가하라. 기존에 `GET /agents/status`만 있을 것이다.

```typescript
import { Router } from 'express'
import { FsStore } from '@agentinc/core'

const router = Router()

// 에이전트 목록 조회
router.get('/', (req, res) => {
  const store = new FsStore(process.cwd())
  const agents = store.listAgents()
  res.json(agents)
})

// 기존 /status 엔드포인트 유지
router.get('/status', (req, res) => {
  // 기존 로직 유지
})

export default router
```

**주의**: FsStore 인스턴스 생성 방식이 기존 코드와 일치하는지 확인하라. 의존성 주입 패턴을 사용하고 있다면 그 방식을 따르라.

### 4. 인증 미들웨어 껍데기 생성

#### 4.1 `packages/server/src/middleware/auth.ts` 생성

```typescript
import { Request, Response, NextFunction } from 'express'

export interface AuthContext {
  isAuthenticated: boolean
  userId?: string
  permissions?: string[]
}

declare global {
  namespace Express {
    interface Request {
      auth?: AuthContext
    }
  }
}

/**
 * 인증 미들웨어 (현재는 항상 인증된 것으로 처리)
 * 향후 원격 호스팅 시 실제 인증 로직 추가 예정
 */
export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  // 현재: 항상 인증된 것으로 처리
  req.auth = { isAuthenticated: true }
  next()
}
```

### 5. 서비스에 EventBus 연동

#### 5.1 TicketService 수정

`packages/core/src/services/ticket.service.ts`를 수정하여 이벤트를 발행하도록 한다.

**핵심 설계 결정**: EventBus는 server 패키지에 있으므로, core의 TicketService가 직접 import할 수 없다. 대신 **콜백 패턴**을 사용한다.

```typescript
// packages/core/src/services/ticket.service.ts

export interface TicketServiceOptions {
  onTicketCreated?: (ticket: Ticket) => void
  onTicketUpdated?: (ticket: Ticket) => void
}

export class TicketService {
  private options: TicketServiceOptions

  constructor(store: ITicketStore, options: TicketServiceOptions = {}) {
    this.store = store
    this.options = options
  }

  create(data: CreateTicketDto): Ticket {
    const ticket = this.store.create(data)
    this.options.onTicketCreated?.(ticket)
    return ticket
  }

  update(id: string, changes: Partial<Ticket>, version: number): Ticket {
    const ticket = this.store.update(id, changes, version)
    this.options.onTicketUpdated?.(ticket)
    return ticket
  }
}
```

#### 5.2 Server에서 TicketService 생성 시 콜백 연결

`packages/server/src/routes/tickets.ts` 또는 서비스 초기화 코드에서:

```typescript
import { TicketService, FsTicketStore } from '@agentinc/core'
import { eventBus } from '../events/event-bus.js'

const ticketStore = new FsTicketStore(/* ... */)
const ticketService = new TicketService(ticketStore, {
  onTicketCreated: (ticket) => eventBus.emitEvent({ type: 'ticket:created', payload: ticket }),
  onTicketUpdated: (ticket) => eventBus.emitEvent({ type: 'ticket:updated', payload: ticket }),
})
```

### 6. Express 앱에 라우트 등록

#### 6.1 `packages/server/src/index.ts` 수정

```typescript
import express from 'express'
import ticketsRouter from './routes/tickets.js'
import agentsRouter from './routes/agents.js'
import eventsRouter from './routes/events.js'

const app = express()

app.use(express.json())

// API 라우트
app.use('/tickets', ticketsRouter)
app.use('/agents', agentsRouter)
app.use('/events', eventsRouter)  // SSE 엔드포인트 추가

export { app, eventBus } from './events/event-bus.js'
export function createServer(port: number = 3847) {
  return app.listen(port, () => {
    console.log(`Ticket API: http://localhost:${port}`)
  })
}
```

### 7. 테스트 작성

#### 7.1 `packages/server/tests/routes/events.test.ts` 생성

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import { app } from '../../src/index.js'
import { eventBus } from '../../src/events/event-bus.js'

describe('GET /events (SSE)', () => {
  it('SSE 연결 성공 시 올바른 헤더를 반환한다', async () => {
    const response = await request(app)
      .get('/events')
      .expect(200)
      .expect('Content-Type', /text\/event-stream/)
      .expect('Cache-Control', 'no-cache')
  })

  it('연결 시 connected 이벤트를 수신한다', (done) => {
    const req = request(app)
      .get('/events')
      .buffer(false)
      .parse((res, callback) => {
        let data = ''
        res.on('data', (chunk) => {
          data += chunk.toString()
          if (data.includes('event: connected')) {
            req.abort()
            expect(data).toContain('event: connected')
            done()
          }
        })
      })
  })

  it('eventBus emit 시 클라이언트가 이벤트를 수신한다', (done) => {
    const testTicket = { id: 'test-123', title: 'Test' }

    const req = request(app)
      .get('/events')
      .buffer(false)
      .parse((res, callback) => {
        let data = ''
        res.on('data', (chunk) => {
          data += chunk.toString()
          if (data.includes('ticket:created')) {
            req.abort()
            expect(data).toContain('event: ticket:created')
            expect(data).toContain('test-123')
            done()
          }
        })
      })

    // 연결 후 이벤트 발행
    setTimeout(() => {
      eventBus.emitEvent({ type: 'ticket:created', payload: testTicket })
    }, 100)
  })
})
```

#### 7.2 `packages/server/tests/routes/agents.test.ts` 생성

```typescript
import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { app } from '../../src/index.js'

describe('GET /agents', () => {
  it('에이전트 목록을 배열로 반환한다', async () => {
    const response = await request(app)
      .get('/agents')
      .expect(200)

    expect(Array.isArray(response.body)).toBe(true)
  })

  it('각 에이전트는 name과 description을 포함한다', async () => {
    const response = await request(app)
      .get('/agents')
      .expect(200)

    if (response.body.length > 0) {
      expect(response.body[0]).toHaveProperty('name')
      expect(response.body[0]).toHaveProperty('description')
    }
  })
})
```

## Acceptance Criteria

```bash
# 1. server 패키지 빌드
pnpm --filter @agentinc/server build

# 2. server 패키지 테스트
pnpm --filter @agentinc/server test

# 3. 전체 빌드 (의존성 확인)
pnpm build
```

모든 명령이 에러 없이 완료되어야 한다.

## AC 검증 방법

위 AC 커맨드를 실행하라. 모두 통과하면 `/tasks/12-gui-dashboard/index.json`의 phase 3 status를 `"completed"`로 변경하라.
수정 3회 이상 시도해도 실패하면 status를 `"error"`로 변경하고, 에러 내용을 `"error_message"` 필드로 기록하라.

## 주의사항

- **순환 의존성 금지**: core → server import 금지. 콜백 패턴 사용.
- **SSE 헤더 정확히**: `Content-Type: text/event-stream`, `Cache-Control: no-cache`
- **이벤트 포맷 정확히**: `event: {name}\ndata: {json}\n\n` (줄바꿈 2개 필수)
- 기존 테스트가 깨지지 않도록 주의하라.
- TicketService 수정 시 기존 생성자 시그니처와의 호환성 유지 (options를 optional로).
