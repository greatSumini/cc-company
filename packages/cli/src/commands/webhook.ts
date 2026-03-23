import { Command } from 'commander'
import * as path from 'path'
import { FsStore } from '@agentinc/core'

export function registerWebhookCommand(program: Command): void {
  const webhook = program
    .command('webhook')
    .description('Webhook 설정 관리')

  webhook
    .command('setup <smee-url>')
    .description('smee.io URL 설정 및 webhook 활성화')
    .action((smeeUrl: string) => {
      const agentincPath = path.join(process.cwd(), '.agentinc')
      const store = new FsStore(agentincPath)
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
      console.log('5. agentinc start로 서버 시작')
    })

  webhook
    .command('status')
    .description('현재 webhook 설정 표시')
    .action(() => {
      const agentincPath = path.join(process.cwd(), '.agentinc')
      const store = new FsStore(agentincPath)
      const config = store.getGlobalConfig()
      const webhookConfig = config.webhook

      if (!webhookConfig) {
        console.log('Webhook이 설정되지 않았습니다.')
        console.log('agentinc webhook setup <smee-url>로 설정하세요.')
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
      const agentincPath = path.join(process.cwd(), '.agentinc')
      const store = new FsStore(agentincPath)
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
      const agentincPath = path.join(process.cwd(), '.agentinc')
      const store = new FsStore(agentincPath)
      const config = store.getGlobalConfig()

      store.updateGlobalConfig({
        ...config,
        webhook: {
          enabled: config.webhook?.enabled ?? false,
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

      const agentincPath = path.join(process.cwd(), '.agentinc')
      const store = new FsStore(agentincPath)
      const config = store.getGlobalConfig()

      store.updateGlobalConfig({
        ...config,
        webhook: {
          enabled: config.webhook?.enabled ?? false,
          ...config.webhook,
          approveCondition: condition as 'any' | 'all',
        },
      })

      console.log(`Approve 조건이 "${condition}"으로 설정되었습니다.`)
    })
}
