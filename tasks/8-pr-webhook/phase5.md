# Phase 5: orchestrator-cli

## 사전 준비

먼저 아래 문서들을 반드시 읽고 프로젝트의 전체 아키텍처와 설계 의도를 완전히 이해하라:

- `/spec/spec.md`
- `/spec/architecture.md`
- `/spec/adr.md`
- `/tasks/8-pr-webhook/spec-diff.md` (이번 task의 문서 변경 기록)

그리고 이전 phase의 작업물을 반드시 확인하라:

- `/src/types/index.ts` (WebhookConfig, GlobalConfig)
- `/src/webhook-receiver/index.ts` (IWebhookReceiver)
- `/src/webhook-receiver/smee-receiver.ts` (SmeeReceiver)
- `/src/server/index.ts` (createServer, ServerDeps)
- `/src/server/routes/webhooks.ts` (webhooksRouter)
- `/src/services/pr-event.service.ts` (PrEventService)
- `/src/services/orchestrator.service.ts` (기존 Orchestrator)
- `/src/store/fs-store.ts` (config 로딩)

## 작업 내용

### 1. fs-store에 config 로딩 기능 추가

`/src/store/fs-store.ts`에 GlobalConfig 로딩 메서드 추가:

```typescript
import type { GlobalConfig } from '../types/index.js'

// IStore 인터페이스에 추가
export interface IStore {
  // ... 기존 메서드들 ...
  getGlobalConfig(): GlobalConfig
  updateGlobalConfig(config: Partial<GlobalConfig>): void
}

// FsStore 구현에 추가
export class FsStore implements IStore {
  // ... 기존 코드 ...

  private get configPath(): string {
    return path.join(this.basePath, '.cc-company', 'config.json')
  }

  getGlobalConfig(): GlobalConfig {
    if (!fs.existsSync(this.configPath)) {
      return { version: '1.0.0' }
    }
    return JSON.parse(fs.readFileSync(this.configPath, 'utf-8'))
  }

  updateGlobalConfig(updates: Partial<GlobalConfig>): void {
    const current = this.getGlobalConfig()
    const updated = { ...current, ...updates }
    fs.writeFileSync(this.configPath, JSON.stringify(updated, null, 2))
  }
}
```

### 2. Orchestrator에 Webhook Receiver 통합

`/src/services/orchestrator.service.ts` 수정:

```typescript
import { SmeeReceiver } from '../webhook-receiver/smee-receiver.js'
import { PrEventService } from './pr-event.service.js'
import { GhClient } from '../gh-client/index.js'
import type { IWebhookReceiver } from '../webhook-receiver/index.js'

export class OrchestratorService {
  private webhookReceiver: IWebhookReceiver | null = null
  private prEventService: PrEventService | null = null

  // ... 기존 코드 ...

  async start(): Promise<void> {
    const config = this.store.getGlobalConfig()
    const serverConfig = config.ticketServer ?? { port: 3847, ... }

    // 1. PrEventService 초기화
    if (config.webhook?.enabled) {
      const ghClient = new GhClient()  // 기본 gh 계정 사용
      this.prEventService = new PrEventService(
        this.ticketService,
        this.store,
        ghClient,
        config.webhook
      )
    }

    // 2. Ticket Server 시작 (prEventService 주입)
    this.server = createServer({
      ticketService: this.ticketService,
      agentStatusStore: this.agentStatusStore,
      webhookSecret: config.webhook?.secret,
      prEventService: this.prEventService ?? undefined,
    })

    this.httpServer = this.server.listen(serverConfig.port, () => {
      console.log(`[Orchestrator] Ticket Server started on port ${serverConfig.port}`)
    })

    // 3. Webhook Receiver 시작
    if (config.webhook?.enabled && config.webhook.smeeUrl) {
      const targetUrl = `http://localhost:${serverConfig.port}/webhooks/github`
      this.webhookReceiver = new SmeeReceiver(config.webhook.smeeUrl, targetUrl)
      await this.webhookReceiver.start()
      console.log(`[Orchestrator] Webhook receiver started (smee)`)
    } else if (config.webhook?.enabled) {
      console.log(`[Orchestrator] Webhook enabled (direct mode, listening on /webhooks/github)`)
    }

    // 4. Agent workers 시작 (기존 로직)
    await this.spawnAgentWorkers()
  }

  async stop(): Promise<void> {
    // Webhook Receiver 중지
    if (this.webhookReceiver) {
      await this.webhookReceiver.stop()
      this.webhookReceiver = null
    }

    // ... 기존 종료 로직 ...
  }
}
```

### 3. Server에 prEventService 주입 미들웨어 추가

`/src/server/index.ts` 수정:

```typescript
import type { PrEventService } from '../services/pr-event.service.js'

export interface ServerDeps {
  ticketService: TicketService
  agentStatusStore: AgentStatusStore
  webhookSecret?: string
  prEventService?: PrEventService
}

export function createServer(deps: ServerDeps) {
  const app = express()

  app.use(express.json())

  // 서비스 주입 미들웨어
  app.use((req, _res, next) => {
    req.ticketService = deps.ticketService
    if (deps.prEventService) {
      req.prEventService = deps.prEventService
    }
    next()
  })

  // Webhook 라우트
  if (deps.prEventService) {
    app.use(
      '/webhooks',
      verifyGitHubSignature(deps.webhookSecret),
      webhooksRouter
    )
  }

  // 기존 라우트들
  app.use('/tickets', ticketsRouter)
  app.use('/agents', agentsRouter)

  // 에러 핸들러
  app.use(errorHandler)

  return app
}
```

### 4. CLI 명령어 추가

`/src/commands/webhook.ts` 생성:

```typescript
import { Command } from 'commander'
import { FsStore } from '../store/fs-store.js'

export function createWebhookCommand(): Command {
  const webhook = new Command('webhook')
    .description('Webhook 설정 관리')

  webhook
    .command('setup <smee-url>')
    .description('smee.io URL 설정 및 webhook 활성화')
    .action((smeeUrl: string) => {
      const store = new FsStore(process.cwd())
      const config = store.getGlobalConfig()

      store.updateGlobalConfig({
        ...config,
        webhook: {
          ...config.webhook,
          enabled: true,
          smeeUrl,
        },
      })

      console.log('Webhook 설정이 저장되었습니다.')
      console.log(`  smeeUrl: ${smeeUrl}`)
      console.log(`  enabled: true`)
      console.log('')
      console.log('다음 단계:')
      console.log('1. GitHub 저장소 Settings > Webhooks에서 webhook 추가')
      console.log(`2. Payload URL: ${smeeUrl}`)
      console.log('3. Content type: application/json')
      console.log('4. Events: Pull request reviews, Pull request review comments')
      console.log('5. cc-company start로 서버 시작')
    })

  webhook
    .command('status')
    .description('현재 webhook 설정 표시')
    .action(() => {
      const store = new FsStore(process.cwd())
      const config = store.getGlobalConfig()
      const webhookConfig = config.webhook

      if (!webhookConfig) {
        console.log('Webhook이 설정되지 않았습니다.')
        console.log('cc-company webhook setup <smee-url>로 설정하세요.')
        return
      }

      console.log('Webhook 설정:')
      console.log(`  enabled: ${webhookConfig.enabled}`)
      console.log(`  smeeUrl: ${webhookConfig.smeeUrl ?? '(없음)'}`)
      console.log(`  secret: ${webhookConfig.secret ? '(설정됨)' : '(없음)'}`)
      console.log(`  approveCondition: ${webhookConfig.approveCondition ?? 'any'}`)
    })

  webhook
    .command('disable')
    .description('Webhook 비활성화')
    .action(() => {
      const store = new FsStore(process.cwd())
      const config = store.getGlobalConfig()

      store.updateGlobalConfig({
        ...config,
        webhook: {
          ...config.webhook,
          enabled: false,
        },
      })

      console.log('Webhook이 비활성화되었습니다.')
    })

  webhook
    .command('set-secret <secret>')
    .description('GitHub webhook secret 설정')
    .action((secret: string) => {
      const store = new FsStore(process.cwd())
      const config = store.getGlobalConfig()

      store.updateGlobalConfig({
        ...config,
        webhook: {
          ...config.webhook,
          secret,
        },
      })

      console.log('Webhook secret이 설정되었습니다.')
    })

  webhook
    .command('set-approve-condition <condition>')
    .description('PR approve 조건 설정 (any | all)')
    .action((condition: string) => {
      if (condition !== 'any' && condition !== 'all') {
        console.error('조건은 "any" 또는 "all"이어야 합니다.')
        process.exit(1)
      }

      const store = new FsStore(process.cwd())
      const config = store.getGlobalConfig()

      store.updateGlobalConfig({
        ...config,
        webhook: {
          ...config.webhook,
          approveCondition: condition as 'any' | 'all',
        },
      })

      console.log(`Approve 조건이 "${condition}"으로 설정되었습니다.`)
    })

  return webhook
}
```

### 5. CLI 메인에 webhook 명령어 등록

`/src/index.ts` 수정:

```typescript
import { createWebhookCommand } from './commands/webhook.js'

// ... 기존 코드 ...

program.addCommand(createWebhookCommand())
```

## Acceptance Criteria

```bash
npm run build  # 컴파일 에러 없음
npm test       # 모든 테스트 통과
```

추가 수동 검증:
```bash
# webhook 명령어 동작 확인
cc-company webhook status
cc-company webhook setup https://smee.io/test-url
cc-company webhook status
cc-company webhook disable
```

## AC 검증 방법

위 AC 커맨드를 실행하라. 모두 통과하면 `/tasks/8-pr-webhook/index.json`의 phase 5 status를 `"completed"`로 변경하라.
수정 3회 이상 시도해도 실패하면 status를 `"error"`로 변경하고, 에러 내용을 index.json의 해당 phase에 `"error_message"` 필드로 기록하라.

## 주의사항

- webhook이 disabled면 SmeeReceiver를 시작하지 마라.
- smeeUrl이 없으면 direct mode로 간주하고, 서버만 시작해 webhook을 직접 수신하도록 하라.
- prEventService가 없으면 /webhooks 라우트를 등록하지 마라.
- 기존 start 명령어의 동작을 깨뜨리지 마라 (webhook 설정 없어도 정상 동작).
- 기존 테스트를 깨뜨리지 마라.
