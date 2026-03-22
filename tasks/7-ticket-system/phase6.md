# Phase 6: orchestrator

## 사전 준비

먼저 아래 문서들을 반드시 읽고 프로젝트의 전체 아키텍처와 설계 의도를 완전히 이해하라:

- `/docs/spec.md`
- `/docs/architecture.md`
- `/docs/adr.md`
- `/tasks/7-ticket-system/docs-diff.md` (이번 task의 문서 변경 기록)

그리고 이전 phase의 작업물을 반드시 확인하라:

- `/src/types/index.ts` (Phase 1)
- `/src/store/fs-ticket-store.ts` (Phase 2)
- `/src/store/agent-status-store.ts` (Phase 2)
- `/src/services/ticket.service.ts` (Phase 3)
- `/src/server/index.ts` (Phase 4)
- `/src/services/agent-runner.service.ts` (Phase 5)
- `/src/claude-runner/run-claude.ts` (Phase 5)

기존 command 패턴을 참고하라:

- `/src/commands/run.ts`
- `/src/commands/context.ts`

## 작업 내용

Orchestrator 서비스와 `start` command를 구현한다.

### 1. `src/services/orchestrator.service.ts`

```typescript
import { ChildProcess, fork } from 'child_process'
import * as path from 'path'
import * as http from 'http'
import { Express } from 'express'
import { createApp } from '../server'
import { TicketService } from './ticket.service'
import { FsTicketStore } from '../store/fs-ticket-store'
import { AgentStatusStore } from '../store/agent-status-store'
import { FsStore } from '../store/fs-store'
import { TicketServerConfig, GlobalConfig } from '../types'

export interface OrchestratorConfig {
  basePath: string
  ticketServerConfig: TicketServerConfig
}

const DEFAULT_CONFIG: TicketServerConfig = {
  port: 3847,
  pollingIntervalMs: 5000,
  idleTimeoutMs: 180000,
  heartbeatTimeoutMs: 30000,
}

export class OrchestratorService {
  private server: http.Server | null = null
  private workers: Map<string, ChildProcess> = new Map()
  private shuttingDown = false

  constructor(private config: OrchestratorConfig) {}

  /**
   * 시스템 시작
   * 1. Ticket Server 시작
   * 2. 모든 agent worker spawn
   * 3. Shutdown 핸들러 등록
   */
  async start(): Promise<void> {
    const { basePath, ticketServerConfig } = this.config

    // 1. Store 초기화
    const store = new FsStore(basePath)
    const ticketStore = new FsTicketStore(basePath)
    const agentStatusStore = new AgentStatusStore(basePath, ticketServerConfig.heartbeatTimeoutMs)

    // 2. Service 초기화
    const ticketService = new TicketService(ticketStore, store)

    // 3. HTTP 서버 시작
    const app = createApp({ ticketService, agentStatusStore })
    this.server = await this.startServer(app, ticketServerConfig.port)

    console.log(`[Orchestrator] Ticket Server started on http://localhost:${ticketServerConfig.port}`)

    // 4. 모든 agent worker spawn
    const agents = store.listAgents()
    for (const agent of agents) {
      this.spawnWorker(agent.name)
    }

    console.log(`[Orchestrator] Spawned ${agents.length} agent workers`)

    // 5. Shutdown 핸들러 등록
    this.registerShutdownHandlers()

    // 6. 서버 종료 대기 (무한 대기)
    await this.waitForShutdown()
  }

  private startServer(app: Express, port: number): Promise<http.Server> {
    return new Promise((resolve, reject) => {
      const server = app.listen(port, () => {
        resolve(server)
      })
      server.on('error', reject)
    })
  }

  private spawnWorker(agentName: string): void {
    const workerPath = path.resolve(__dirname, '..', 'agent-worker.js')
    const { basePath, ticketServerConfig } = this.config

    const worker = fork(workerPath, [], {
      env: {
        ...process.env,
        CC_AGENT_NAME: agentName,
        CC_BASE_PATH: basePath,
        CC_SERVER_URL: `http://localhost:${ticketServerConfig.port}`,
        CC_POLLING_INTERVAL_MS: String(ticketServerConfig.pollingIntervalMs),
        CC_IDLE_TIMEOUT_MS: String(ticketServerConfig.idleTimeoutMs),
      },
      stdio: ['inherit', 'inherit', 'inherit', 'ipc'],
    })

    worker.on('exit', (code) => {
      console.log(`[Orchestrator] Agent worker '${agentName}' exited with code ${code}`)
      this.workers.delete(agentName)

      // 재시작하지 않음 (idle timeout으로 종료된 것)
    })

    worker.on('error', (error) => {
      console.error(`[Orchestrator] Agent worker '${agentName}' error:`, error)
    })

    this.workers.set(agentName, worker)
  }

  private registerShutdownHandlers(): void {
    const shutdown = async () => {
      if (this.shuttingDown) return
      this.shuttingDown = true

      console.log('\n[Orchestrator] Shutting down...')

      // 1. 모든 worker 종료 신호
      for (const [name, worker] of this.workers) {
        console.log(`[Orchestrator] Stopping worker '${name}'`)
        worker.kill('SIGTERM')
      }

      // 2. Worker 종료 대기 (최대 5초)
      await this.waitForWorkers(5000)

      // 3. 서버 종료
      if (this.server) {
        await new Promise<void>((resolve) => {
          this.server!.close(() => resolve())
        })
      }

      console.log('[Orchestrator] Shutdown complete')
      process.exit(0)
    }

    process.on('SIGINT', shutdown)
    process.on('SIGTERM', shutdown)
  }

  private async waitForWorkers(timeoutMs: number): Promise<void> {
    const start = Date.now()
    while (this.workers.size > 0 && Date.now() - start < timeoutMs) {
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    // 타임아웃 시 강제 종료
    for (const [name, worker] of this.workers) {
      console.log(`[Orchestrator] Force killing worker '${name}'`)
      worker.kill('SIGKILL')
    }
  }

  private waitForShutdown(): Promise<void> {
    return new Promise(() => {
      // 무한 대기 (SIGINT/SIGTERM으로만 종료)
    })
  }
}

/**
 * config.json에서 ticketServer 설정 로드
 */
export function loadTicketServerConfig(basePath: string): TicketServerConfig {
  const configPath = path.join(basePath, 'config.json')
  try {
    const configStr = require('fs').readFileSync(configPath, 'utf-8')
    const config: GlobalConfig = JSON.parse(configStr)
    return { ...DEFAULT_CONFIG, ...config.ticketServer }
  } catch {
    return DEFAULT_CONFIG
  }
}
```

### 2. `src/agent-worker.ts` — Fork 엔트리포인트

```typescript
import { AgentRunnerService } from './services/agent-runner.service'
import { FsStore } from './store/fs-store'
import { runClaude } from './claude-runner/run-claude'
import { AgentConfig, TicketServerConfig } from './types'

async function main() {
  const agentName = process.env.CC_AGENT_NAME
  const basePath = process.env.CC_BASE_PATH
  const serverUrl = process.env.CC_SERVER_URL
  const pollingIntervalMs = parseInt(process.env.CC_POLLING_INTERVAL_MS || '5000', 10)
  const idleTimeoutMs = parseInt(process.env.CC_IDLE_TIMEOUT_MS || '180000', 10)

  if (!agentName || !basePath || !serverUrl) {
    console.error('Missing required environment variables')
    process.exit(1)
  }

  const store = new FsStore(basePath)
  const agentConfig = store.getAgent(agentName)

  if (!agentConfig) {
    console.error(`Agent '${agentName}' not found`)
    process.exit(1)
  }

  const config: TicketServerConfig = {
    port: 0, // 사용되지 않음
    pollingIntervalMs,
    idleTimeoutMs,
    heartbeatTimeoutMs: 30000,
  }

  const runner = new AgentRunnerService({
    serverUrl,
    config,
    agentConfig,
    runClaude: async (prompt, ac) => runClaude(prompt, ac, { store, basePath }),
  })

  // SIGTERM 핸들링
  process.on('SIGTERM', () => {
    console.log(`[${agentName}] Received SIGTERM, stopping...`)
    runner.stop()
  })

  await runner.run()
}

main().catch((error) => {
  console.error('Agent worker error:', error)
  process.exit(1)
})
```

### 3. `src/commands/start.ts` — Start Command

```typescript
import { Command } from 'commander'
import { createContext } from './context'
import { OrchestratorService, loadTicketServerConfig } from '../services/orchestrator.service'

export function registerStartCommand(program: Command): void {
  program
    .command('start')
    .description('Start Ticket Server and all agent workers')
    .action(async () => {
      const ctx = createContext()
      const basePath = ctx.basePath

      const ticketServerConfig = loadTicketServerConfig(basePath)

      const orchestrator = new OrchestratorService({
        basePath,
        ticketServerConfig,
      })

      await orchestrator.start()
    })
}
```

### 4. `src/index.ts` — Command 등록

기존 command 등록 부분에 `start` command를 추가:

```typescript
import { registerStartCommand } from './commands/start'

// ... 기존 코드 ...

registerStartCommand(program)
```

### 5. `package.json` — 빌드 설정 확인

`agent-worker.ts`가 `dist/agent-worker.js`로 빌드되는지 확인하라. tsconfig.json의 include에 포함되어야 한다.

## Acceptance Criteria

```bash
npm run build  # 컴파일 에러 없음
npm test       # 모든 테스트 통과
```

## AC 검증 방법

위 AC 커맨드를 실행하라. 모두 통과하면 `/tasks/7-ticket-system/index.json`의 phase 6 status를 `"completed"`로 변경하라.
수정 3회 이상 시도해도 실패하면 status를 `"error"`로 변경하고, 에러 내용을 index.json의 해당 phase에 `"error_message"` 필드로 기록하라.

## 주의사항

- `child_process.fork()`의 경로는 컴파일된 `.js` 파일 경로여야 한다 (`dist/agent-worker.js`).
- 환경변수로 설정 전달 시 모든 값을 문자열로 변환하라.
- Graceful shutdown 시 worker들이 현재 작업을 완료할 수 있도록 SIGTERM → 대기 → SIGKILL 순서로 처리하라.
- 서버가 모든 agent 종료 후에도 계속 실행되어야 한다.
