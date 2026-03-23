import { Command } from 'commander'
import { ensureInitialized } from './context.js'
import { OrchestratorService, loadTicketServerConfig } from '../services/orchestrator.service.js'

export function registerStartCommand(program: Command): void {
  program
    .command('start')
    .description('Start Ticket Server and all agent workers')
    .action(async () => {
      ensureInitialized()

      // basePath는 process.cwd() (프로젝트 루트)
      const basePath = process.cwd()

      const ticketServerConfig = loadTicketServerConfig(basePath)

      const orchestrator = new OrchestratorService({
        basePath,
        ticketServerConfig,
      })

      await orchestrator.start()
    })
}
