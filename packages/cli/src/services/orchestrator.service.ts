import { ChildProcess, fork } from 'child_process'
import * as path from 'path'
import * as fs from 'fs'
import { fileURLToPath } from 'url'
import * as http from 'http'
import type { Express } from 'express'
import { createApp } from '@agentinc/server'
import {
  TicketService,
  PrEventService,
  FsTicketStore,
  AgentStatusStore,
  FsStore,
} from '@agentinc/core'
import type { TicketServerConfig, GlobalConfig } from '@agentinc/core'
import { SmeeReceiver, type IWebhookReceiver } from '@agentinc/server'
import { GhClient } from '../gh-client/index.js'

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
  private webhookReceiver: IWebhookReceiver | null = null

  constructor(private config: OrchestratorConfig) {}

  /**
   * 시스템 시작
   * 1. Ticket Server 시작
   * 2. Webhook Receiver 시작 (설정 시)
   * 3. 모든 agent worker spawn
   * 4. Shutdown 핸들러 등록
   */
  async start(): Promise<void> {
    const { basePath, ticketServerConfig } = this.config

    // 1. Store 초기화
    // FsStore는 .agentinc 경로 자체를 rootPath로 받음
    const agentincPath = path.join(basePath, '.agentinc')
    const store = new FsStore(agentincPath)
    // FsTicketStore와 AgentStatusStore는 basePath (process.cwd() 수준)를 받음
    const ticketStore = new FsTicketStore(basePath)
    const agentStatusStore = new AgentStatusStore(basePath, ticketServerConfig.heartbeatTimeoutMs)

    // 2. Service 초기화
    const ticketService = new TicketService(ticketStore, store)
    const globalConfig = store.getGlobalConfig()
    const webhookConfig = globalConfig.webhook

    // 3. PrEventService 초기화 (webhook이 enabled인 경우)
    let prEventService: PrEventService | undefined
    if (webhookConfig?.enabled) {
      const ghClient = new GhClient()  // 기본 gh 계정 사용
      prEventService = new PrEventService(
        ticketService,
        store,
        ghClient,
        webhookConfig
      )
    }

    // 4. HTTP 서버 시작 (prEventService 주입)
    const app = createApp({
      ticketService,
      agentStatusStore,
      webhookSecret: webhookConfig?.secret,
      prEventService,
    })
    this.server = await this.startServer(app, ticketServerConfig.port)

    console.log('')
    console.log('\ud83d\ude80 Agent Inc Daemon Started')
    console.log(`\u251c\u2500 Ticket API:  http://localhost:${ticketServerConfig.port}`)
    console.log(`\u251c\u2500 Dashboard:   http://localhost:${ticketServerConfig.port}`)
    console.log('\u2514\u2500 Press Ctrl+C to stop')
    console.log('')

    // 5. Webhook Receiver 시작 (설정 시)
    if (webhookConfig?.enabled && webhookConfig.smeeUrl) {
      const targetUrl = `http://localhost:${ticketServerConfig.port}/webhooks/github`
      this.webhookReceiver = new SmeeReceiver(webhookConfig.smeeUrl, targetUrl)
      await this.webhookReceiver.start()
      console.log(`[Orchestrator] Webhook receiver started (smee)`)
    } else if (webhookConfig?.enabled) {
      console.log(`[Orchestrator] Webhook enabled (direct mode, listening on /webhooks/github)`)
    }

    // 6. 모든 agent worker spawn
    const agents = store.listAgents()
    for (const agent of agents) {
      this.spawnWorker(agent.name)
    }

    console.log(`[Orchestrator] Spawned ${agents.length} agent workers`)

    // 7. Shutdown 핸들러 등록
    this.registerShutdownHandlers()

    // 8. 서버 종료 대기 (무한 대기)
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
    const __filename = fileURLToPath(import.meta.url)
    const __dirname = path.dirname(__filename)
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

      // 1. Webhook Receiver 중지
      if (this.webhookReceiver) {
        await this.webhookReceiver.stop()
        this.webhookReceiver = null
      }

      // 2. 모든 worker 종료 신호
      for (const [name, worker] of this.workers) {
        console.log(`[Orchestrator] Stopping worker '${name}'`)
        worker.kill('SIGTERM')
      }

      // 3. Worker 종료 대기 (최대 5초)
      await this.waitForWorkers(5000)

      // 4. 서버 종료
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
  const configPath = path.join(basePath, '.agentinc', 'config.json')
  try {
    const configStr = fs.readFileSync(configPath, 'utf-8')
    const config: GlobalConfig = JSON.parse(configStr)
    return { ...DEFAULT_CONFIG, ...config.ticketServer }
  } catch {
    return DEFAULT_CONFIG
  }
}
