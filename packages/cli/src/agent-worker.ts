import * as path from 'path'
import { FsStore } from '@agentinc/core'
import type { TicketServerConfig } from '@agentinc/core'
import { AgentRunnerService } from './services/agent-runner.service.js'
import { runClaude } from './claude-runner/run-claude.js'

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

  // FsStore는 .agentinc 경로를 rootPath로 받음
  const agentincPath = path.join(basePath, '.agentinc')
  const store = new FsStore(agentincPath)
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
    workingDir: basePath,  // project root (process.cwd())
    runClaude: (prompt, ac) => runClaude(prompt, ac, { store, basePath: agentincPath }),
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
